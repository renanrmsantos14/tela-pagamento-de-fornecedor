export function scheduleAfterPaint(callback, scheduler = {}) {
  const requestFrame =
    scheduler.requestFrame || globalThis.requestAnimationFrame?.bind(globalThis);
  const cancelFrame =
    scheduler.cancelFrame || globalThis.cancelAnimationFrame?.bind(globalThis);
  const setTask = scheduler.setTask || globalThis.setTimeout.bind(globalThis);
  const clearTask = scheduler.clearTask || globalThis.clearTimeout.bind(globalThis);
  let cancelled = false;
  let frameId = null;
  let taskId = null;

  const queueTask = () => {
    if (cancelled) return;
    taskId = setTask(() => {
      if (!cancelled) callback();
    }, 0);
  };

  if (requestFrame) frameId = requestFrame(queueTask);
  else queueTask();

  return () => {
    cancelled = true;
    if (frameId !== null && cancelFrame) cancelFrame(frameId);
    if (taskId !== null) clearTask(taskId);
  };
}
