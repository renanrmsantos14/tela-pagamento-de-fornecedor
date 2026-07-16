# Abertura Responsiva do Gerar Lote Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar feedback imediato no botão Gerar lote antes da renderização pesada do drawer de revisão.

**Architecture:** Um utilitário pequeno agenda a ação depois de uma oportunidade de pintura. Um componente isolado controla apenas o estado visual do botão, evitando que o feedback dependa da renderização completa da tabela.

**Tech Stack:** React 18, JavaScript ES modules, Node test runner, CSS.

## Global Constraints

- Não alterar elegibilidade, seleção, payload ou persistência Dataverse.
- Não incluir mudanças externas de versão no commit.
- Respeitar `prefers-reduced-motion`.

---

### Task 1: Agendamento após pintura e feedback do botão

**Files:**
- Create: `src/lib/ui.js`
- Modify: `src/App.jsx:1-30, 840-875, 1624-1640, 2184-2200`
- Modify: `src/styles.css:repasse-generate-lot`
- Test: `tests/ui.test.js`

**Interfaces:**
- Produces: `scheduleAfterPaint(callback, scheduler?) => cleanup`
- Consumes: `onGenerateLot(selectedServices)` existente.

- [x] **Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { scheduleAfterPaint } from "../src/lib/ui.js";

test("agenda trabalho somente depois do frame e da tarefa seguinte", () => {
  const calls = [];
  let frame;
  let task;
  scheduleAfterPaint(() => calls.push("callback"), {
    requestFrame: (callback) => {
      frame = callback;
      return 1;
    },
    cancelFrame: () => {},
    setTask: (callback) => {
      task = callback;
      return 2;
    },
    clearTask: () => {},
  });
  assert.deepEqual(calls, []);
  frame();
  assert.deepEqual(calls, []);
  task();
  assert.deepEqual(calls, ["callback"]);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/ui.test.js`

Expected: FAIL porque `src/lib/ui.js` ainda não existe.

- [x] **Step 3: Write minimal implementation**

Criar `scheduleAfterPaint`, importar no `App.jsx` e extrair `GenerateLotButton`. O botão deve mostrar `RefreshCw` com `spin`, texto `Preparando lote...`, `disabled` e `aria-busy` enquanto aguarda. Restaurar o estado quando `lotDrawerOpen` ficar verdadeiro.

- [x] **Step 4: Add focused motion styling**

Adicionar transição curta de `transform`/`opacity`, estado ativo e regra de movimento reduzido para `.repasse-generate-lot`.

- [x] **Step 5: Run verification**

Run: `npm test`

Expected: todos os testes passam.

Run: `node --test tests/ui.test.js`

Expected: teste de agendamento passa.

Run: `npm run build`

Expected: build Vite e webresource concluídos sem erro.

- [x] **Step 6: Commit**

Adicionar apenas os arquivos da funcionalidade, incluindo o filtro anterior em `src/App.jsx`, e excluir do stage as mudanças externas de versão.
