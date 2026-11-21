import { Type } from "typebox";
// GitHub reports a deleted account as a null user.
export const GITHUB_USER_SCHEMA = Type.Union([Type.Object({ login: Type.String() }), Type.Null()]);
export const GIT_ACTOR_SCHEMA = Type.Union([
    Type.Object({ name: Type.Optional(Type.String()), date: Type.Optional(Type.String()) }),
    Type.Null(),
]);
// `open`, `closed/completed`, `closed/merged`, `open/draft`: the state with whatever says how it got
// there. A pull request reports draft or merged in place of a state_reason.
export function formatState(item) {
    const reason = item.pull_request
        ? item.pull_request.merged_at
            ? "merged"
            : item.draft
                ? "draft"
                : undefined
        : item.state_reason;
    return reason ? `${item.state}/${reason}` : item.state;
}
export function truncateUtf8Bytes(value, maxBytes) {
    const buffer = Buffer.from(value, "utf8");
    if (buffer.byteLength <= maxBytes)
        return value;
    const decoder = new TextDecoder("utf-8", { fatal: true });
    for (let end = maxBytes; end >= 0; end -= 1) {
        try {
            return decoder.decode(buffer.subarray(0, end));
        }
        catch {
            // Drop the partial code point and try again.
        }
    }
    return "";
}
export function escapeTableCell(value) {
    return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
