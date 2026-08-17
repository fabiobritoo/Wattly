# Wattly — Entenda seu consumo.

PWA pessoal de monitoramento de consumo de energia. Registre a leitura do
medidor a cada dia e acompanhe consumo acumulado, média diária e previsão
de fechamento do período.

## Stack

- Next.js 14 (App Router) + TypeScript
- Postgres via `@neondatabase/serverless`, lido exclusivamente de `DATABASE_URL`
- PWA: manifest, ícones, service worker (network-first, nunca cacheando `/api/`)

## Rodando localmente

```bash
npm install
npm run build   # deve funcionar mesmo sem DATABASE_URL definida
DATABASE_URL="postgres://..." npm run dev
```

## Versão

A versão exibida no app está em `lib/version.ts` (`APP_VERSION`). Bump a
cada mudança relevante antes de dar push.
