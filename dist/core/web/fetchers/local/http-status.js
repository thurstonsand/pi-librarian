export function throwForHttpError(status, url) {
    if (status >= 400)
        throw new Error(`HTTP ${status} while fetching ${url}`);
}
