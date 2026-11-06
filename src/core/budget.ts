// A search that runs past its budget has already failed at the librarian's job, so exceeding it is
// an error that tells the librarian to narrow the query, never a partial answer it would cite.
export class SearchTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SearchTimeoutError";
  }
}

export function searchTimeoutMessage(
  timeoutSeconds: number,
  found: string | undefined,
  advice: string,
): string {
  const head = found
    ? `${timeoutSeconds}s limit hit; ${found} found.`
    : `${timeoutSeconds}s limit hit before any results arrived.`;
  return `${head}\nNarrow it before retrying: ${advice}`;
}

export interface SearchDeadline {
  signal: AbortSignal;
  expired(): boolean;
}

// Runs a search under a client deadline, cancelling the request when it passes. The same signal
// carries the caller's own cancellation, so aborting a run aborts its in-flight searches.
export async function withSearchDeadline<T>(
  deadlineMs: number,
  signal: AbortSignal | undefined,
  onExpired: () => Error,
  run: (deadline: SearchDeadline) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("search deadline")), deadlineMs);
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const expired = () => controller.signal.aborted && !signal?.aborted;
  try {
    return await run({ signal: combined, expired });
  } catch (error) {
    if (expired()) {
      throw onExpired();
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
