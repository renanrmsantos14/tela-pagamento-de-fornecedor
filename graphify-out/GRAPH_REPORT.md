# Graph Report - Tela Pagamento de Fornecedores  (2026-08-18)

## Corpus Check
- 26 files · ~44,078 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 338 nodes · 735 edges · 20 communities (19 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- DataverseClient
- App.jsx
- dataverse.js
- payment.js
- scripts
- Plano de performance - 15 jul 2026
- deploy-webresource.ps1
- Contrato Dataverse — Pagamentos a Terceiros
- SearchableSelect.jsx
- update-app-version.mjs
- provision-flow.ps1
- Enviar documento do lote ao fornecedor
- Abertura responsiva do fluxo Gerar lote
- build-webresource.mjs
- dev-with-port.mjs
- Abertura Responsiva do Gerar Lote Implementation Plan
- task.md

## God Nodes (most connected - your core abstractions)
1. `DataverseClient` - 65 edges
2. `clone()` - 25 edges
3. `cleanGuid()` - 20 edges
4. `RepasseGrid()` - 14 edges
5. `paymentTotals()` - 12 edges
6. `scripts` - 11 edges
7. `money()` - 11 edges
8. `now()` - 11 edges
9. `App()` - 9 edges
10. `isLegacyPaidService()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `addFooter()` --references--> `jspdf`  [EXTRACTED]
  src/lib/document.js → package.json
- `buildPaymentPdf()` --references--> `jspdf`  [EXTRACTED]
  src/lib/document.js → package.json
- `drawLabel()` --references--> `jspdf`  [EXTRACTED]
  src/lib/document.js → package.json
- `AllServicesView()` --calls--> `money()`  [EXTRACTED]
  src/App.jsx → src/domain/payment.js
- `PaymentsView()` --calls--> `isLegacyPaidService()`  [EXTRACTED]
  src/App.jsx → src/domain/payment.js

## Import Cycles
- None detected.

## Communities (20 total, 1 thin omitted)

### Community 0 - "DataverseClient"
Cohesion: 0.13
Nodes (9): cleanGuid(), clone(), DataverseClient, escapeOData(), newId(), now(), parseSnapshot(), runtimeConfig() (+1 more)

### Community 1 - "App.jsx"
Cohesion: 0.06
Nodes (39): ALL_SERVICES_COLUMNS, AllServicesView(), App(), APP_TABS, FavorecidosView(), formatServiceDate(), GenerateLotButton(), loadActiveRepasseView() (+31 more)

### Community 2 - "dataverse.js"
Cohesion: 0.07
Nodes (30): createLotSnapshot(), buildState(), CHOICES, chunk(), dataverse, directWebResourceClientUrl(), drivers, errorLogRecord() (+22 more)

### Community 3 - "payment.js"
Cohesion: 0.14
Nodes (33): dashboardBuckets(), dashboardRanking(), FavorecidoDrawer(), LotDrawer(), OverviewView(), percentChange(), RepasseInput(), digits() (+25 more)

### Community 4 - "scripts"
Cohesion: 0.07
Nodes (32): dependencies, @fontsource/manrope, jspdf, jspdf-autotable, lucide-react, react, react-dom, @tanstack/react-virtual (+24 more)

### Community 5 - "Plano de performance - 15 jul 2026"
Cohesion: 0.12
Nodes (15): Arquivos, Arquivos, Arquivos, Criterios de aceite, Criterios de aceite, Critérios de aceite, Evidencias de base, Objetivo (+7 more)

### Community 6 - "deploy-webresource.ps1"
Cohesion: 0.38
Nodes (10): Add-ResponseId(), Create-WebResource(), Ensure-WebResourceInSolution(), Escape-ODataString(), Find-Solution(), Find-WebResource(), Get-PropertyValue(), Invoke-JsonPost() (+2 more)

### Community 7 - "Contrato Dataverse — Pagamentos a Terceiros"
Cohesion: 0.20
Nodes (9): Contrato Dataverse — Pagamentos a Terceiros, `cr40f_pagamentoaterceiro`, `cr40f_terceirofavorecido`, `cr40f_vinculomotoristafavorecido`, Dados operacionais para lançar repasse, Fonte financeira, Itens e eventos, Publicação DEV (+1 more)

### Community 8 - "SearchableSelect.jsx"
Cohesion: 0.40
Nodes (9): focusAdjacentControl(), normalizedSearchMatches(), normalizeSearchText(), SearchableMultiSelect(), SearchableSelect(), searchableTextMatches(), searchTokens(), shouldAutofocusSearch() (+1 more)

### Community 9 - "update-app-version.mjs"
Cohesion: 0.22
Nodes (8): buildInfoPath, date, lockPath, match, packageJson, packageLock, packagePath, root

### Community 10 - "provision-flow.ps1"
Cohesion: 0.46
Nodes (7): Ensure-EnvironmentVariable(), OData(), Request(), Resolve-TriggerUrl(), Scoped-Token(), Step(), Token()

### Community 11 - "Enviar documento do lote ao fornecedor"
Cohesion: 0.29
Nodes (6): ALM, Armazenamento no OneDrive, Body enviado pelo app, Contratos de Flow, Enviar documento do lote ao fornecedor, URL por ambiente

### Community 12 - "Abertura responsiva do fluxo Gerar lote"
Cohesion: 0.29
Nodes (6): Abertura responsiva do fluxo Gerar lote, Desenho aprovado, Diagnóstico, Objetivo, Tratamento de erro, Validação

### Community 13 - "build-webresource.mjs"
Cohesion: 0.29
Nodes (5): dist, html, indexPath, root, vite

### Community 14 - "dev-with-port.mjs"
Cohesion: 0.29
Nodes (3): port, root, vite

### Community 15 - "Abertura Responsiva do Gerar Lote Implementation Plan"
Cohesion: 0.50
Nodes (3): Abertura Responsiva do Gerar Lote Implementation Plan, Global Constraints, Task 1: Agendamento após pintura e feedback do botão

## Knowledge Gaps
- **80 isolated node(s):** `name`, `version`, `private`, `type`, `version:update` (+75 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DataverseClient` connect `DataverseClient` to `dataverse.js`?**
  _High betweenness centrality (0.131) - this node is a cross-community bridge._
- **Why does `buildPaymentPdf()` connect `scripts` to `App.jsx`, `payment.js`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `cleanGuid()` (e.g. with `.assignFavorecidoToServices()` and `.clearFavorecidoFromServices()`) actually correct?**
  _`cleanGuid()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `RepasseGrid()` (e.g. with `loadActiveRepasseView()` and `loadRepasseColumns()`) actually correct?**
  _`RepasseGrid()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _80 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DataverseClient` be split into smaller, more focused modules?**
  _Cohesion score 0.1253305129561079 - nodes in this community are weakly interconnected._
- **Should `App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05628415300546448 - nodes in this community are weakly interconnected._