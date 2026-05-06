export interface AbortableTask<T> {
  promise: Promise<T>;
  abort: () => void;
  signal: AbortSignal;
}

export function abortable<T>(executor: (signal: AbortSignal) => Promise<T>): AbortableTask<T> {
  const controller = new AbortController();
  const promise = executor(controller.signal);

  return {
    promise,
    abort: () => controller.abort(),
    signal: controller.signal,
  };
}
