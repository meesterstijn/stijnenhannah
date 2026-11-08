// Offline met een verlopen token blijft supabase-js tot ~30 s proberen het
// token te verversen voordat een verzoek faalt. Voor niet-kritieke verzoeken
// (feedback, gedeelde oefeningen) niet zo lang laten wachten.
export const REQUEST_TIMEOUT_MS = 8000;

/** null als er binnen `ms` geen antwoord is. */
export function withTimeout<T>(
  request: PromiseLike<T>,
  ms = REQUEST_TIMEOUT_MS,
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([Promise.resolve(request), timeout]).finally(() =>
    clearTimeout(timer),
  );
}
