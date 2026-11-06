// A search that runs past its budget has already failed at the librarian's job, so exceeding it is
// an error that tells the librarian to narrow the query, never a partial answer it would cite.
export class SearchTimeoutError extends Error {
    constructor(message) {
        super(message);
        this.name = "SearchTimeoutError";
    }
}
export function searchTimeoutMessage(timeoutSeconds, found, advice) {
    const head = found
        ? `${timeoutSeconds}s limit hit; ${found} found.`
        : `${timeoutSeconds}s limit hit before any results arrived.`;
    return `${head}\nNarrow it before retrying: ${advice}`;
}
// Runs a search under a client deadline, cancelling the request when it passes. The same signal
// carries the caller's own cancellation, so aborting a run aborts its in-flight searches.
export async function withSearchDeadline(deadlineMs, signal, onExpired, run) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("search deadline")), deadlineMs);
    const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    const expired = () => controller.signal.aborted && !signal?.aborted;
    try {
        return await run({ signal: combined, expired });
    }
    catch (error) {
        if (expired()) {
            throw onExpired();
        }
        throw error;
    }
    finally {
        clearTimeout(timer);
    }
}
