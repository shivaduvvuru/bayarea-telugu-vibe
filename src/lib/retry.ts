/**
 * Retry an async read with exponential backoff.
 *
 * Used for desk queue reads so a temporary timeout or cold-start hiccup shows a
 * retry instead of an empty queue. Auth failures are never retried — they need
 * the editor to unlock again.
 */
export function isRetryableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/unauthorized|forbidden|401|403|passcode|session/i.test(message)) return false;
  return true;
}

export async function retryWithBackoff<T>(
  run: (attempt: number) => Promise<T>,
  options: {
    attempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {},
): Promise<T> {
  const attempts = options.attempts ?? 4;
  const base = options.baseDelayMs ?? 400;
  const max = options.maxDelayMs ?? 4000;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await run(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !isRetryableError(error)) break;
      options.onRetry?.(attempt, error);
      const delay = Math.min(max, base * 2 ** (attempt - 1));
      const jitter = Math.random() * delay * 0.25;
      await new Promise((resolve) => setTimeout(resolve, delay + jitter));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
