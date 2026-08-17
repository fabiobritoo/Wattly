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

  migrated = true;
}
