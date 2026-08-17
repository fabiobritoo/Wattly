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

## V2

- **Alertas dentro do app**: banner no topo do Início quando a meta já foi
  ultrapassada, quando a previsão aponta para acima da meta, ou quando a
  última leitura veio bem acima do ritmo médio.
- **Comparação entre períodos**: aba Histórico lista todos os períodos
  (atual + arquivados) com consumo total, média diária, melhor/pior dia e
  se a meta foi cumprida.
- **Arquivamento automático**: em Ajustes, "Iniciar novo período" arquiva o
  período atual automaticamente (ele passa a aparecer só no Histórico) e
  começa um novo do zero.
- **Melhor/pior dia e média semanal**: no Início, card "Ritmo de consumo"
  com o dia de menor e maior consumo do período atual e a média semanal
  estimada (média diária × 7).
