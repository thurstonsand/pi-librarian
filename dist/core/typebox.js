import { Value } from "typebox/value";
export function parseTypeBoxValue(schema, value, context) {
    if (Value.Check(schema, value)) {
        return value;
    }
    throw new Error(formatTypeBoxError(schema, value, context));
}
export function safeParseTypeBoxValue(schema, value) {
    return Value.Check(schema, value) ? value : undefined;
}
function formatTypeBoxError(schema, value, context) {
    const firstError = Value.Errors(schema, value)[0];
    if (!firstError) {
        return `${context}: invalid value.`;
    }
    const path = firstError.instancePath.length > 0 ? firstError.instancePath : "/";
    // TypeBox reports a key a strict object forbids as "schema is false", which names no cause.
    if (firstError.schemaPath.endsWith("/additionalProperties")) {
        return `${context}: ${path} is not a recognized key`;
    }
    return `${context}: ${path} ${firstError.message}`;
}
