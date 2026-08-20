import { neon } from "@neondatabase/serverless";

// IMPORTANT: only DATABASE_URL is read. No fallback to POSTGRES_URL or any
// other variable name — a silent fallback here caused serious data
// inconsistency bugs on a previous project. If DATABASE_URL is missing,
// fail loudly instead of guessing.
function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL não está definida. Configure a variável de ambiente DATABASE_URL (Vercel → Storage → Postgres)."
    );
  }
  return url;
}

let migrated = false;

/**
 * Lazily-created sql tagged-template function. Throws a clear error (not a
 * generic one) if DATABASE_URL is missing, so build-time code that doesn't
 * touch the DB never fails, but any request that does gets a real message.
 *
 * Next.js intercepts fetch() internally and can cache DB queries done over
 * HTTP (which is how @neondatabase/serverless works) even on routes marked
 * dynamic. `fetchOptions: { cache: 'no-store' }` here forces no-store at the
 * driver level as a second layer of defense, on every query this client runs.
 */
export function getSql() {
  const sql = neon(getConnectionString(), {
    fetchOptions: { cache: "no-store" },
  });
  return sql;
}

/**
 * Auto-migration: creates/updates the schema idempotently. Called at the
 * top of every API route before querying. No manual migration scripts.
 */
export async function migrate() {
  if (migrated) return;
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS periods (
      id SERIAL PRIMARY KEY,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      initial_kwh NUMERIC NOT NULL,
      goal_kwh NUMERIC,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`ALTER TABLE periods ADD COLUMN IF NOT EXISTS goal_kwh NUMERIC`;
  await sql`ALTER TABLE periods ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`;
  // V3 — financial tracking: tariff rate (R$/kWh) and, optionally, the
  // Brazilian "bandeira tarifária" surcharge (R$ per 100 kWh). Both are
  // per-period, since rates and flags change over time and a historical
  // period should keep whatever was actually in effect back then.
  await sql`ALTER TABLE periods ADD COLUMN IF NOT EXISTS tariff_rate NUMERIC`;
  await sql`ALTER TABLE periods ADD COLUMN IF NOT EXISTS tariff_flag TEXT`;
  await sql`ALTER TABLE periods ADD COLUMN IF NOT EXISTS flag_surcharge_rate NUMERIC`;
  // Fixed charges that show up on the real bill but don't scale with kWh —
  // public lighting contribution (COSIP), small tax line items, etc. Added
  // once to the final estimate rather than prorated across consumption.
  await sql`ALTER TABLE periods ADD COLUMN IF NOT EXISTS fixed_fees_reais NUMERIC`;

  await sql`
    CREATE TABLE IF NOT EXISTS readings (
      id SERIAL PRIMARY KEY,
      period_id INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
      date DATE,
      kwh_reading NUMERIC NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (period_id, date)
    )
  `;
  // reading_at replaces the old one-reading-per-day "date" column, so the
  // user can log several readings in the same day (e.g. morning/night).
  // Backfill from the old column for anyone who already had data, then drop
  // the day-level uniqueness constraint that no longer applies.
  await sql`ALTER TABLE readings ADD COLUMN IF NOT EXISTS reading_at TIMESTAMPTZ`;
  await sql`
    UPDATE readings
    SET reading_at = (date::timestamp AT TIME ZONE 'UTC')
    WHERE reading_at IS NULL AND date IS NOT NULL
  `;
  await sql`UPDATE readings SET reading_at = created_at WHERE reading_at IS NULL`;
  await sql`ALTER TABLE readings DROP CONSTRAINT IF EXISTS readings_period_id_date_key`;
  await sql`ALTER TABLE readings ALTER COLUMN date DROP NOT NULL`;

  await sql`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      period_id INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Single-row table holding the standing tariff defaults, so the person
  // doesn't have to re-type their rate/flag/fixed fees every time they
  // start a new period. New periods are pre-filled from here.
  await sql`
    CREATE TABLE IF NOT EXISTS tariff_defaults (
      id INTEGER PRIMARY KEY DEFAULT 1,
      tariff_rate NUMERIC,
      tariff_flag TEXT,
      flag_surcharge_rate NUMERIC,
      fixed_fees_reais NUMERIC,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT tariff_defaults_singleton CHECK (id = 1)
    )
  `;
  // Seeded once from the person's real bill (TUSD 0.72048386 + TE
  // 0.35491782, taxas fixas R$29.45 — iluminação pública + ICMS-CDE).
  // Bandeira amarela uses ANEEL's official R$1,885/100kWh base rate (see
  // lib/tariffFlags.ts) — the R$2.5253 figure from that one bill included
  // state ICMS on top of the base fee, which isn't a safe general default
  // since ICMS % varies by state. Only fires if no default row exists yet.
  await sql`
    INSERT INTO tariff_defaults (id, tariff_rate, tariff_flag, flag_surcharge_rate, fixed_fees_reais)
    VALUES (1, 1.07540168, 'amarela', 1.885, 29.45)
    ON CONFLICT (id) DO NOTHING
  `;
  // Backfill: any period saved before a tariff was configured gets these
  // same defaults, so the current period reflects them immediately too —
  // idempotent, since it only ever touches rows that are still unset.
  await sql`
    UPDATE periods
    SET tariff_rate = 1.07540168,
        tariff_flag = 'amarela',
        flag_surcharge_rate = 1.885,
        fixed_fees_reais = 29.45
    WHERE tariff_rate IS NULL
  `;
  // Correction: the app briefly used R$2.5253/100kWh (bill-derived, with
  // ICMS baked in) as the "amarela" default before switching to ANEEL's
  // official R$1,885/100kWh base rate. Reset that specific old value back
  // to the correct one — targeted so it never touches a value the person
  // deliberately customized to something else.
  await sql`
    UPDATE tariff_defaults
    SET flag_surcharge_rate = 1.885
    WHERE tariff_flag = 'amarela' AND ROUND(flag_surcharge_rate::numeric, 4) = 2.5253
  `;
  await sql`
    UPDATE periods
    SET flag_surcharge_rate = 1.885
    WHERE tariff_flag = 'amarela' AND ROUND(flag_surcharge_rate::numeric, 4) = 2.5253
  `;

  migrated = true;
}

export type NeighborReading = { id: number; reading_at: string; kwh_reading: number } | null;

/**
 * Finds the reading immediately before and immediately after a given point
 * in time within a period (excluding `excludeId`, used when editing a
 * reading in place). Used to validate that meter readings only increase —
 * a reading lower than its predecessor (or higher than its successor)
 * almost always means a typo, not an actual meter rollback.
 */
export async function getNeighborReadings(
  periodId: number | string,
  readingAt: string,
  excludeId?: number | string
): Promise<{ previous: NeighborReading; next: NeighborReading }> {
  const sql = getSql();
  // Coerce to a real number (not a string) so the bind parameter matches
  // the integer `id` column type — Postgres won't implicitly cast a text
  // parameter against an integer column for `IS DISTINCT FROM`.
  const excludeIdNum = excludeId !== undefined && excludeId !== null ? Number(excludeId) : null;

  const previousRows = await sql`
    SELECT id, to_char(reading_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS reading_at, kwh_reading
    FROM readings
    WHERE period_id = ${periodId}
      AND reading_at < ${readingAt}
      AND id IS DISTINCT FROM ${excludeIdNum}
    ORDER BY reading_at DESC
    LIMIT 1
  `;
  const nextRows = await sql`
    SELECT id, to_char(reading_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS reading_at, kwh_reading
    FROM readings
    WHERE period_id = ${periodId}
      AND reading_at > ${readingAt}
      AND id IS DISTINCT FROM ${excludeIdNum}
    ORDER BY reading_at ASC
    LIMIT 1
  `;

  return {
    previous: previousRows[0]
      ? { id: previousRows[0].id, reading_at: previousRows[0].reading_at, kwh_reading: Number(previousRows[0].kwh_reading) }
      : null,
    next: nextRows[0]
      ? { id: nextRows[0].id, reading_at: nextRows[0].reading_at, kwh_reading: Number(nextRows[0].kwh_reading) }
      : null,
  };
}
