# Graph Report - src  (2026-07-15)

## Corpus Check
- 6 files · ~11,831 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 158 nodes · 445 edges · 13 communities (9 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4a0c8bff`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]

## God Nodes (most connected - your core abstractions)
1. `DataverseClient` - 39 edges
2. `clone()` - 23 edges
3. `money()` - 18 edges
4. `paymentTotals()` - 16 edges
5. `validateFavorecido()` - 12 edges
6. `cleanGuid()` - 10 edges
7. `now()` - 10 edges
8. `buildState()` - 9 edges
9. `moneyInput()` - 8 edges
10. `profit()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `FavorecidoDrawer()` --calls--> `validateFavorecido()`  [EXTRACTED]
  App.jsx → domain/payment.js
- `dashboardRanking()` --calls--> `money()`  [EXTRACTED]
  App.jsx → domain/payment.js
- `OverviewView()` --calls--> `money()`  [EXTRACTED]
  App.jsx → domain/payment.js
- `RepasseGrid()` --calls--> `money()`  [EXTRACTED]
  App.jsx → domain/payment.js
- `LotsView()` --calls--> `money()`  [EXTRACTED]
  App.jsx → domain/payment.js

## Communities (13 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.17
Nodes (18): createLotSnapshot(), DOCUMENT_STATUS, ITEM_STATUS, LOT_STATUS, PAYMENT_STATUS, buildState(), CHOICES, dataverse (+10 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (8): App(), FavorecidoDrawer(), FavorecidosView(), maskPix(), monthRange(), months, PaymentsView(), groupMonthly()

### Community 3 - "Community 3"
Cohesion: 0.47
Nodes (9): ServiceFinanceRow(), fromCents(), isEligibleService(), marginPercent(), moneyInput(), parseMoney(), profit(), toCents() (+1 more)

### Community 6 - "Community 6"
Cohesion: 0.62
Nodes (6): digits(), repeated(), validateFavorecido(), validCnpj(), validCpf(), FavorecidoDrawer()

### Community 7 - "Community 7"
Cohesion: 0.38
Nodes (7): LotDetailDrawer(), LotsView(), statusText(), canCancel(), canPay(), canRevert(), LotDetailDrawer()

### Community 8 - "Community 8"
Cohesion: 0.48
Nodes (5): money(), buildPaymentPdf(), safe(), LotsView(), RepasseGrid()

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (6): loadRepasseColumns(), previousRange(), REPASSE_COLUMNS, statusText(), toDateInput(), viewColumns()

### Community 10 - "Community 10"
Cohesion: 0.31
Nodes (4): normalizedSearchMatches(), normalizeSearchText(), searchableTextMatches(), searchTokens()

### Community 11 - "Community 11"
Cohesion: 0.39
Nodes (8): LotDrawer(), eligibleServices(), paymentTotals(), dashboardBuckets(), dashboardRanking(), LotDrawer(), OverviewView(), percentChange()

## Knowledge Gaps
- **3 isolated node(s):** `REPASSE_COLUMNS`, `reservationDetailLabels`, `months`
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DataverseClient` connect `Community 5` to `Community 0`, `Community 2`, `Community 4`, `Community 12`?**
  _High betweenness centrality (0.213) - this node is a cross-community bridge._
- **Why does `clone()` connect `Community 12` to `Community 0`, `Community 2`, `Community 4`, `Community 5`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `paymentTotals()` connect `Community 11` to `Community 0`, `Community 1`, `Community 3`, `Community 6`, `Community 9`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **What connects `REPASSE_COLUMNS`, `reservationDetailLabels`, `months` to the rest of the system?**
  _3 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1286549707602339 - nodes in this community are weakly interconnected._
- **Should `Community 9` be split into smaller, more focused modules?**
  _Cohesion score 0.07977207977207977 - nodes in this community are weakly interconnected._