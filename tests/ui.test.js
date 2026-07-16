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
