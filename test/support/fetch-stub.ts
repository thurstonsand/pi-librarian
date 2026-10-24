import { vi } from "vitest";

export interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
  body: string | undefined;
}

export type Route = (request: RecordedRequest) => Response | Promise<Response> | undefined;

// Stubs the network boundary only, so the real clients, request building, and response parsing run.
export function stubFetch(routes: Route[]): RecordedRequest[] {
  const requests: RecordedRequest[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const recorded: RecordedRequest = {
        method: request.method,
        url: new URL(request.url),
        headers: request.headers,
        body: request.body ? await request.text() : undefined,
      };
      requests.push(recorded);
      if (init?.signal?.aborted || request.signal.aborted) {
        throw new DOMException("aborted", "AbortError");
      }
      for (const route of routes) {
        const response = await route(recorded);
        if (response) {
          return response;
        }
      }
      return Response.json({ message: `no stub for ${recorded.url}` }, { status: 599 });
    }),
  );
  return requests;
}
