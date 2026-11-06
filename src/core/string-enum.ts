import { type TUnsafe, Type } from "typebox";

// pi-ai's own StringEnum returns a pi-schema type since Pi 1.5.0, which TypeBox's `Static` reads as unknown.
// Pi still hands extensions a TypeBox-typed one at runtime; this is that one, so types, tests, and every Pi agree.
export function StringEnum<T extends readonly string[]>(
  values: T,
  options?: { description?: string },
): TUnsafe<T[number]> {
  return Type.Unsafe<T[number]>({ type: "string", enum: values, ...options });
}
