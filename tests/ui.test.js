import test from "node:test";
import assert from "node:assert/strict";
import {
  lotCreationDrawer,
  lotDetailLoadingDrawer,
  scheduleAfterPaint,
} from "../src/lib/ui.js";

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

test("cancelamento impede trabalho agendado", () => {
  const calls = [];
  let frame;
  let cancelledFrame;

  const cancel = scheduleAfterPaint(() => calls.push("callback"), {
    requestFrame: (callback) => {
      frame = callback;
      return 7;
    },
    cancelFrame: (id) => {
      cancelledFrame = id;
    },
    setTask: () => 8,
    clearTask: () => {},
  });

  cancel();
  frame();

  assert.equal(cancelledFrame, 7);
  assert.deepEqual(calls, []);
});

test("abre drawer de criação antes da confirmação remota do lote", () => {
  assert.deepEqual(
    lotCreationDrawer({ services: [{ id: "service-1" }, { id: "service-2" }] }),
    { type: "lotCreating", serviceCount: 2 },
  );
});

test("abre drawer de detalhe antes de carregar dados remotos", () => {
  const lot = { id: "lot-1", identifier: "PT-2026-130222" };
  assert.deepEqual(lotDetailLoadingDrawer(lot), {
    type: "lotDetailLoading",
    lot,
  });
});
