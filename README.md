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

## V3

- **Tarifa e bandeira tarifária**: em Ajustes, informe a tarifa (R$/kWh) do
  seu período e, opcionalmente, a bandeira tarifária vigente com o valor
  adicional (R$ a cada 100 kWh). Ambas ficam salvas por período, já que
  tarifa e bandeira mudam ao longo do tempo — um período arquivado mantém
  o valor que estava em vigor quando foi registrado.
- **Estimativa de conta**: com a tarifa configurada, o Início mostra o
  valor estimado do consumo atual e da previsão de fechamento em R$. O
  Histórico também mostra o valor estimado de cada período para comparação.
- Esse valor é só uma estimativa do custo de energia (tarifa × consumo +
  adicional de bandeira). Contas reais também incluem impostos, taxas de
  distribuição e outros itens que o app não tem como saber.

### v3.1 — calibrado com uma fatura real

- **Tarifa = TUSD + TE somadas.** O boleto separa "Consumo-TUSD" e
  "Consumo-TE" em duas linhas com preços unitários diferentes; a tarifa que
  o app pede é a soma dos dois.
- **Taxas fixas do período (R$)**: novo campo para itens do boleto que não
  escalam com o consumo — Contribuição de Iluminação Pública (COSIP),
  pequenas taxas como ICMS-CDE, etc. Somado uma única vez na "conta
  estimada" (previsão final), não no valor parcial do consumo até agora.
- Validado contra uma fatura real: com TUSD+TE somadas, a bandeira
  recalculada como R$/100kWh e as taxas fixas somadas à parte, a estimativa
  bateu com o total real a menos de R$0,01 de diferença.

### v3.2 — padrões de tarifa e importação de leituras

- **Padrões de tarifa persistentes**: os valores calibrados com a fatura
  real (tarifa 1.0754 R$/kWh, bandeira amarela R$2.5253/100kWh, taxas
  fixas R$29.45) agora ficam salvos como padrão de verdade — não é mais só
  um placeholder de exemplo. Uma nova tabela `tariff_defaults` guarda esses
  valores; a migração automática já os semeia e retroalimenta qualquer
  período existente que ainda não tinha tarifa configurada.
- Sempre que uma tarifa é salva em um período, o padrão é atualizado junto
  — então o próximo "Iniciar novo período" já vem pré-preenchido.
- **Importar leituras via CSV**: em Ajustes, novo card para subir um
  arquivo CSV (colunas tipo Data/Hora/Leitura_kWh) e importar em massa
  pro período atual, com opção de substituir as leituras já existentes.
  Parser tolera variações de cabeçalho e ignora colunas de consumo/delta
  (o app recalcula isso sozinho a partir da leitura bruta do medidor).

## V4 — repaginada visual

Aplicado o kit de marca e os mockups fornecidos (paleta, tipografia, ícones
e novos componentes de UI).

- **Paleta**: verde `#16C76A`, verde escuro `#15803D`, azul `#2563EB`,
  amarelo `#F5B91E`, vermelho `#EF4444`, texto `#10233F`, texto secundário
  `#64748B` — alinhada com o kit de ícones fornecido.
- **Tipografia**: Poppins (títulos e números grandes) + Inter (corpo),
  self-hosted via `@fontsource` — sem chamadas externas ao Google Fonts em
  tempo de execução, então o PWA instalado continua funcionando 100% offline.
- **Ícone do app**: nova marca (raio + linha de evolução + ponto de
  destaque), aplicada em todos os tamanhos (192/512/maskable/apple-touch/favicon).
- **Ícones internos**: 15 ícones de traço do kit fornecido, convertidos em
  componentes React (`components/icons.tsx`), usados na navegação e nos
  cabeçalhos das telas.
- **Medidor de ritmo** (`components/RhythmGauge.tsx`): gauge semicircular
  com agulha e zonas verde/amarela/vermelha comparando o consumo diário
  médio com o ritmo necessário pra bater a meta.
- **Gráfico de evolução**: zona segura sombreada até a meta, linha
  tracejada da meta, balão de previsão colorido conforme está acima ou
  abaixo da meta, e legenda.
- **Insight automático**: card com o dia de maior consumo do período,
  gerado a partir dos dados que já existiam (melhor/pior dia).
- **Registrar leitura**: ícones nos campos, cálculo do consumo desde a
  última leitura em tempo real (antes só aparecia depois de salvar),
  contador de caracteres na observação, rodapé de confiança.
- **Histórico reestruturado**: agora tem duas seções — um log de consumo
  com abas Dia/Semana/Mês (novo) do período atual, e a comparação entre
  períodos (que já existia na V2) logo abaixo.
