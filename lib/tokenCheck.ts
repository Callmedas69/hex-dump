export const TOKEN_CHECK_TIMEOUT_MS = 12_000;
export const TOKEN_RPC_TIMEOUT_MS = 8_000;

export class TokenCheckTimeoutError extends Error {
  constructor() {
    super("The token balance check timed out.");
    this.name = "TokenCheckTimeoutError";
  }
}

/** Bound the whole check, including RPC retries/fallbacks, and discard late results. */
export function runTokenCheck<T>(read: () => Promise<T>, signal: AbortSignal, timeoutMs = TOKEN_CHECK_TIMEOUT_MS): Promise<T> {
  if (signal.aborted) return Promise.reject(new DOMException("Check cancelled.", "AbortError"));
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    function finish(complete: () => void) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      complete();
    }
    const abort = () => finish(() => reject(new DOMException("Check cancelled.", "AbortError")));
    const timer = setTimeout(() => finish(() => reject(new TokenCheckTimeoutError())), timeoutMs);
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve().then(() => {
      if (signal.aborted) throw new DOMException("Check cancelled.", "AbortError");
      return read();
    }).then(
      value => finish(() => resolve(value)),
      error => finish(() => reject(error)),
    );
  });
}
