#!/usr/bin/env node
import { a as browserProfileDir, i as getFetchWorkerSpawnLockPath, n as getFetchWorkerPidPath, o as cacheDir, r as getFetchWorkerSocketPath, s as settingsPath, t as ensureFetchWorkerDir } from "./worker-protocol-mZ6tvTgF.js";
import "node:module";
import { createInterface } from "node:readline/promises";
import { exec, execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { RequestError } from "@octokit/request-error";
import { Octokit } from "@octokit/rest";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path, { basename, delimiter, dirname, extname, join } from "node:path";
import fs, { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { EXIT, SKIP, visit } from "unist-util-visit";
import { randomUUID } from "node:crypto";
import { connect } from "node:net";
import { createInterface as createInterface$1 } from "node:readline";
import { fileURLToPath } from "node:url";
import { Command, InvalidArgumentError, Option } from "commander";
// node_modules/typebox/build/system/memory/metrics.mjs
/** TypeBox instantiation metrics */
const Metrics = {
	assign: 0,
	create: 0,
	clone: 0,
	discard: 0,
	update: 0
};
// node_modules/typebox/build/guard/string.mjs
function IsBetween(value, min, max) {
	return value >= min && value <= max;
}
function IsZeroWidthJoiner(value) {
	return value === 8205;
}
function IsHighSurrogate(value) {
	return IsBetween(value, 55296, 56319);
}
function IsRegionalIndicator(value) {
	return IsBetween(value, 127462, 127487);
}
function IsVariationSelector(value) {
	return IsBetween(value, 65024, 65039);
}
function IsCombiningMark(value) {
	return IsBetween(value, 768, 879) || IsBetween(value, 6832, 6911) || IsBetween(value, 7616, 7679) || IsBetween(value, 65056, 65071);
}
function CodePointLength(value) {
	return value > 65535 ? 2 : 1;
}
function ConsumeModifiers(value, index) {
	while (index < value.length) {
		const point = value.codePointAt(index);
		if (IsCombiningMark(point) || IsVariationSelector(point)) index += CodePointLength(point);
		else break;
	}
	return index;
}
function NextGraphemeClusterIndex(value, clusterStart) {
	const startCP = value.codePointAt(clusterStart);
	let clusterEnd = clusterStart + CodePointLength(startCP);
	clusterEnd = ConsumeModifiers(value, clusterEnd);
	while (clusterEnd < value.length - 1 && IsZeroWidthJoiner(value.codePointAt(clusterEnd))) {
		const nextCP = value.codePointAt(clusterEnd + 1);
		clusterEnd += 1 + CodePointLength(nextCP);
		clusterEnd = ConsumeModifiers(value, clusterEnd);
	}
	if (IsRegionalIndicator(startCP) && clusterEnd < value.length && IsRegionalIndicator(value.codePointAt(clusterEnd))) clusterEnd += CodePointLength(value.codePointAt(clusterEnd));
	return clusterEnd;
}
function IsGraphemeCodePoint(value) {
	return value >= 768 && (IsHighSurrogate(value) || IsCombiningMark(value) || IsVariationSelector(value) || IsZeroWidthJoiner(value));
}
/** Checks if a string has at least a minimum number of grapheme clusters */
function IsMinLengthSegmented(value, minLength) {
	let count = 0;
	let index = 0;
	while (index < value.length) {
		index = NextGraphemeClusterIndex(value, index);
		if (++count >= minLength) return true;
	}
	return false;
}
/** Checks if a string has at most a maximum number of grapheme clusters */
function IsMaxLengthSegmented(value, maxLength) {
	let count = 0;
	let index = 0;
	while (index < value.length) {
		index = NextGraphemeClusterIndex(value, index);
		if (++count > maxLength) return false;
	}
	return true;
}
/** Fast check for minimum grapheme length, falls back to full check if needed */
function IsMinLength$2(value, minLength) {
	if (minLength === 0) return true;
	if (value.length < minLength) return false;
	let index = 0;
	while (true) {
		if (IsGraphemeCodePoint(value.charCodeAt(index))) return IsMinLengthSegmented(value, minLength);
		if (++index >= minLength) return true;
	}
}
/** Fast check for maximum grapheme length, falls back to full check if needed */
function IsMaxLength$2(value, maxLength) {
	if (value.length <= maxLength) return true;
	let index = 0;
	while (true) {
		if (IsGraphemeCodePoint(value.charCodeAt(index))) return IsMaxLengthSegmented(value, maxLength);
		if (++index > maxLength) return false;
	}
}
/** Returns true if this value is an array */
function IsArray$1(value) {
	return Array.isArray(value);
}
/** Returns true if this value is bigint */
function IsBigInt$1(value) {
	return IsEqual(typeof value, "bigint");
}
/** Returns true if this value is a boolean */
function IsBoolean$2(value) {
	return IsEqual(typeof value, "boolean");
}
/** Returns true if this value is a constructor */
function IsConstructor$1(value) {
	if (IsUndefined$1(value) || !IsFunction$1(value)) return false;
	const result = Function.prototype.toString.call(value);
	if (/^class\s/.test(result)) return true;
	if (/\[native code\]/.test(result)) return true;
	return false;
}
/** Returns true if this value is a function */
function IsFunction$1(value) {
	return IsEqual(typeof value, "function");
}
/** Returns true if this value is integer */
function IsInteger$1(value) {
	return Number.isInteger(value);
}
/** Returns true if this value is null */
function IsNull$1(value) {
	return IsEqual(value, null);
}
/** Returns true if this value is number */
function IsNumber$2(value) {
	return Number.isFinite(value);
}
/** Returns true if this value is an object but not an array */
function IsObjectNotArray(value) {
	return IsObject$1(value) && !IsArray$1(value);
}
/** Returns true if this value is an object */
function IsObject$1(value) {
	return IsEqual(typeof value, "object") && !IsNull$1(value);
}
/** Returns true if this value is string */
function IsString$2(value) {
	return IsEqual(typeof value, "string");
}
/** Returns true if this value is symbol */
function IsSymbol$1(value) {
	return IsEqual(typeof value, "symbol");
}
/** Returns true if this value is undefined */
function IsUndefined$1(value) {
	return IsEqual(value, void 0);
}
function IsEqual(left, right) {
	return left === right;
}
function IsGreaterThan(left, right) {
	return left > right;
}
function IsLessThan(left, right) {
	return left < right;
}
function IsLessEqualThan(left, right) {
	return left <= right;
}
function IsGreaterEqualThan(left, right) {
	return left >= right;
}
function IsMultipleOf$1(dividend, divisor) {
	if (IsBigInt$1(dividend) || IsBigInt$1(divisor)) return BigInt(dividend) % BigInt(divisor) === 0n;
	const tolerance = 1e-10;
	if (!IsNumber$2(dividend)) return true;
	if (IsInteger$1(dividend) && 1 / divisor % 1 === 0) return true;
	const mod = dividend % divisor;
	return Math.min(Math.abs(mod), Math.abs(mod - divisor), Math.abs(mod + divisor)) < tolerance;
}
/** Returns true if the value appears to be an instance of a class. */
function IsClassInstance(value) {
	if (!IsObject$1(value)) return false;
	const proto = globalThis.Object.getPrototypeOf(value);
	if (IsNull$1(proto)) return false;
	return IsEqual(typeof proto.constructor, "function") && !(IsEqual(proto.constructor, globalThis.Object) || IsEqual(proto.constructor.name, "Object"));
}
function IsValueLike(value) {
	return IsBigInt$1(value) || IsBoolean$2(value) || IsNull$1(value) || IsNumber$2(value) || IsString$2(value) || IsUndefined$1(value);
}
/** Returns true if the string has at most the given number of graphemes */
function IsMaxLength$1(value, length) {
	return IsMaxLength$2(value, length);
}
/** Returns true if the string has at least the given number of graphemes */
function IsMinLength$1(value, length) {
	return IsMinLength$2(value, length);
}
/** Returns true if every element from offset satisfies the callback, short-circuiting on the first failure */
function Every(value, offset, callback) {
	return value.every((item, index) => index < offset || callback(item, index));
}
/** Returns true if every element from offset satisfies the callback, using exhaustive enumeration */
function EveryAll(value, offset, callback) {
	let result = true;
	value.forEach((item, index) => {
		if (index >= offset && !callback(item, index)) result = false;
	});
	return result;
}
/** Returns true if some element satisfies the callback, short-circuiting on the first success */
function Some(value, callback) {
	return value.some((value, index) => callback(value, index));
}
/** Returns true if some element satisfies the callback, using exhaustive enumeration */
function SomeAll(value, callback) {
	let result = false;
	value.forEach((item, index) => {
		if (callback(item, index)) result = true;
	});
	return result;
}
/** Returns the count of elements that satisfy the callback */
function Counted(value, callback) {
	return value.reduce((result, value, index) => callback(value, index) ? ++result : result, 0);
}
/** Shifts the left-most element from an array and dispatches to the true arm, or the false arm if empty */
function ShiftLeft(array, true_, false_) {
	return IsEqual(array.length, 0) ? false_() : true_(array[0], array.slice(1));
}
/** Returns true if the PropertyKey is Unsafe (ref: prototype-pollution). */
function IsUnsafePropertyKey(key) {
	return IsEqual(key, "__proto__") || IsEqual(key, "constructor") || IsEqual(key, "prototype");
}
/** Returns true if this value has this property key */
function HasPropertyKey(value, key) {
	return IsUnsafePropertyKey(key) ? Object.prototype.hasOwnProperty.call(value, key) : key in value;
}
/** Returns object entries as `[string, Value][]` */
function Entries(value) {
	return Object.entries(value);
}
/** Returns property keys for this object via `Object.getOwnPropertyNames({ ... })` */
function Keys(value) {
	return Object.getOwnPropertyNames(value);
}
/** Returns the property keys for this object via `Object.getOwnPropertySymbols({ ... })` */
function Symbols(value) {
	return Object.getOwnPropertySymbols(value);
}
function DeepEqualObject(left, right) {
	if (!IsObject$1(right)) return false;
	const keys = Keys(left);
	return IsEqual(keys.length, Keys(right).length) && keys.every((key) => IsDeepEqual(left[key], right[key]));
}
function DeepEqualArray(left, right) {
	return IsArray$1(right) && IsEqual(left.length, right.length) && left.every((_, index) => IsDeepEqual(left[index], right[index]));
}
/** Returns true if left and right values are structurally equal */
function IsDeepEqual(left, right) {
	return IsArray$1(left) ? DeepEqualArray(left, right) : IsObject$1(left) ? DeepEqualObject(left, right) : IsEqual(left, right);
}
// node_modules/typebox/build/guard/globals.mjs
function IsBoolean$1(value) {
	return value instanceof Boolean;
}
function IsNumber$1(value) {
	return value instanceof Number;
}
function IsString$1(value) {
	return value instanceof String;
}
function IsTypeArray(value) {
	return globalThis.ArrayBuffer.isView(value);
}
/** Returns true if the value is a RegExp */
function IsRegExp(value) {
	return value instanceof globalThis.RegExp;
}
/** Returns true if the value is a Date */
function IsDate$1(value) {
	return value instanceof globalThis.Date;
}
/** Returns true if the value is a Set */
function IsSet(value) {
	return value instanceof globalThis.Set;
}
/** Returns true if the value is a Map */
function IsMap(value) {
	return value instanceof globalThis.Map;
}
// node_modules/typebox/build/system/settings/settings.mjs
const settings = {
	immutableTypes: false,
	maxErrors: 8,
	maxInstantiationCount: 128,
	useAcceleration: true,
	exactOptionalPropertyTypes: false,
	enumerableKind: false,
	correctiveParse: false,
	unionPrioritySort: true
};
/** Gets current system settings */
function Get$2() {
	return settings;
}
// node_modules/typebox/build/system/memory/freeze.mjs
/** Conditionally freezes the value if `immutableTypes` is true, otherwise no action. */
function Freeze(value) {
	return Get$2().immutableTypes ? Object.freeze(value) : value;
}
// node_modules/typebox/build/system/memory/clone.mjs
function FromClassInstance(value) {
	return value;
}
function IsSchemaObject$1(value) {
	return HasPropertyKey(value, "~kind") || HasPropertyKey(value, "~unsafe");
}
function FromSchemaObject(value) {
	const result = {};
	for (const key of Keys(value)) {
		if (IsUnsafePropertyKey(key)) continue;
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		descriptor.value = FromValue$2(descriptor.value);
		if (IsEqual(descriptor.enumerable, true)) result[key] = descriptor.value;
		else Object.defineProperty(result, key, descriptor);
	}
	return result;
}
function FromPlainObject(value) {
	const result = {};
	for (const key of Keys(value)) {
		if (IsUnsafePropertyKey(key)) continue;
		result[key] = FromValue$2(value[key]);
	}
	for (const key of Symbols(value)) result[key] = FromValue$2(value[key]);
	return result;
}
function FromObject$13(value) {
	return IsClassInstance(value) ? FromClassInstance(value) : IsSchemaObject$1(value) ? FromSchemaObject(value) : FromPlainObject(value);
}
function FromArray$9(value) {
	return value.map((element) => FromValue$2(element));
}
function FromTypedArray(value) {
	return value.slice();
}
function FromRegExp$1(value) {
	return new RegExp(value.source, value.flags);
}
function FromMap(value) {
	return new Map(FromValue$2([...value.entries()]));
}
function FromSet(value) {
	return new Set(FromValue$2([...value.values()]));
}
function FromValue$2(value) {
	return IsTypeArray(value) ? FromTypedArray(value) : IsRegExp(value) ? FromRegExp$1(value) : IsMap(value) ? FromMap(value) : IsSet(value) ? FromSet(value) : IsArray$1(value) ? FromArray$9(value) : IsObject$1(value) ? FromObject$13(value) : value;
}
/**
* Returns a Clone of the given value. This function is similar to structuredClone()
* but also supports deep cloning instances of Map, Set and TypeArray.
*/
function Clone$1(value) {
	Metrics.clone += 1;
	return FromValue$2(value);
}
// node_modules/typebox/build/system/memory/create.mjs
function MergeHidden(left, right) {
	for (const key of Object.keys(right)) Object.defineProperty(left, key, {
		configurable: true,
		writable: true,
		enumerable: false,
		value: right[key]
	});
	return left;
}
function Merge(left, right) {
	return {
		...left,
		...right
	};
}
/**
* Creates an object with hidden, enumerable, and optional property sets. This function
* ensures types are instantiated according to configuration rules for enumerable and
* non-enumerable properties.
*/
function Create(hidden, enumerable, options = {}) {
	Metrics.create += 1;
	const withOptions = Merge(enumerable, options);
	return Freeze(Get$2().enumerableKind ? Merge(withOptions, hidden) : MergeHidden(withOptions, hidden));
}
// node_modules/typebox/build/system/memory/update.mjs
/**
* Updates a value with new properties while preserving property enumerability. Use this function to modify
* existing types without altering their configuration.
*/
function Update$1(current, hidden, enumerable) {
	Metrics.update += 1;
	const settings = Get$2();
	const result = Clone$1(current);
	for (const key of Object.keys(hidden)) Object.defineProperty(result, key, {
		configurable: true,
		writable: true,
		enumerable: settings.enumerableKind,
		value: hidden[key]
	});
	for (const key of Object.keys(enumerable)) Object.defineProperty(result, key, {
		configurable: true,
		enumerable: true,
		writable: true,
		value: enumerable[key]
	});
	return Freeze(result);
}
function IsSchema$1(value) {
	return IsObject$1(value);
}
// node_modules/typebox/build/type/engine/optional/instantiate_add.mjs
function AddOptionalOperation(type) {
	return Update$1(type, { "~optional": true }, {});
}
function AddOptionalAction(type, options) {
	return Update$1(AddOptionalOperation(type), {}, options);
}
// node_modules/typebox/build/type/types/array.mjs
/** Creates an Array type. */
function _Array_(items, options) {
	return Create({ "~kind": "Array" }, {
		type: "array",
		items
	}, options);
}
/** Creates a Never type. */
function Never(options) {
	return Create({ "~kind": "Never" }, { not: {} }, options);
}
// node_modules/typebox/build/type/action/_add_optional.mjs
/** Applies an AddOptional action to a type. */
function AddOptional(type, options = {}) {
	return AddOptionalAction(type, options);
}
// node_modules/typebox/build/type/types/_optional.mjs
/** Applies an Optional modifier to the given type. */
function Optional(type) {
	return AddOptional(type);
}
/** Returns true if the given value is TOptional */
function IsOptional(value) {
	return IsSchema$1(value) && HasPropertyKey(value, "~optional");
}
// node_modules/typebox/build/type/types/properties.mjs
/** Creates a RequiredArray derived from the given TProperties value. */
function RequiredArray(properties) {
	return Keys(properties).filter((key) => !IsOptional(properties[key]));
}
// node_modules/typebox/build/type/types/object.mjs
/** Creates an Object type. */
function _Object_(properties, options = {}) {
	const requiredKeys = RequiredArray(properties);
	return Create({ "~kind": "Object" }, {
		type: "object",
		...requiredKeys.length > 0 ? { required: requiredKeys } : {},
		properties
	}, options);
}
// node_modules/typebox/build/type/types/unknown.mjs
/** Creates an Unknown type. */
function Unknown(options) {
	return Create({ ["~kind"]: "Unknown" }, {}, options);
}
// node_modules/typebox/build/type/types/unsafe.mjs
/** Creates a Unsafe type. */
function Unsafe(schema) {
	return Update$1(schema, { ["~unsafe"]: null }, {});
}
// node_modules/typebox/build/system/arguments/arguments.mjs
/**
* Match arguments for overloaded functions that use the `...args: unknown[]` pattern. Arguments
* are parsed using argument length only.
*/
function Match$3(args, match) {
	return match[args.length]?.(...args) ?? (() => {
		throw Error("Invalid Arguments");
	})();
}
// node_modules/typebox/build/system/unreachable/unreachable.mjs
/** Used for unreachable logic */
function Unreachable() {
	throw new Error("Unreachable");
}
// node_modules/typebox/build/system/hashing/hash.mjs
function InstanceKeys(value) {
	const propertyKeys = /* @__PURE__ */ new Set();
	let current = value;
	while (current && current !== Object.prototype) {
		for (const key of Reflect.ownKeys(current)) if (key !== "constructor" && typeof key !== "symbol") propertyKeys.add(key);
		current = Object.getPrototypeOf(current);
	}
	return [...propertyKeys];
}
function IsIEEE754(value) {
	return typeof value === "number";
}
var ByteMarker;
(function(ByteMarker) {
	ByteMarker[ByteMarker["Array"] = 0] = "Array";
	ByteMarker[ByteMarker["BigInt"] = 1] = "BigInt";
	ByteMarker[ByteMarker["Boolean"] = 2] = "Boolean";
	ByteMarker[ByteMarker["Date"] = 3] = "Date";
	ByteMarker[ByteMarker["Constructor"] = 4] = "Constructor";
	ByteMarker[ByteMarker["Function"] = 5] = "Function";
	ByteMarker[ByteMarker["Null"] = 6] = "Null";
	ByteMarker[ByteMarker["Number"] = 7] = "Number";
	ByteMarker[ByteMarker["Object"] = 8] = "Object";
	ByteMarker[ByteMarker["RegExp"] = 9] = "RegExp";
	ByteMarker[ByteMarker["String"] = 10] = "String";
	ByteMarker[ByteMarker["Symbol"] = 11] = "Symbol";
	ByteMarker[ByteMarker["TypeArray"] = 12] = "TypeArray";
	ByteMarker[ByteMarker["Undefined"] = 13] = "Undefined";
})(ByteMarker || (ByteMarker = {}));
let Accumulator = BigInt("14695981039346656037");
const [Prime, Size] = [BigInt("1099511628211"), BigInt("18446744073709551616")];
const Bytes = Array.from({ length: 256 }).map((_, i) => BigInt(i));
const F64 = /* @__PURE__ */ new Float64Array(1);
const F64In = new DataView(F64.buffer);
const F64Out = new Uint8Array(F64.buffer);
function FNV1A64_OP(byte) {
	Accumulator = Accumulator ^ Bytes[byte];
	Accumulator = Accumulator * Prime % Size;
}
function FromArray$8(value) {
	FNV1A64_OP(ByteMarker.Array);
	for (const item of value) FromValue$1(item);
}
function FromBigInt$5(value) {
	FNV1A64_OP(ByteMarker.BigInt);
	F64In.setBigInt64(0, value);
	for (const byte of F64Out) FNV1A64_OP(byte);
}
function FromBoolean$5(value) {
	FNV1A64_OP(ByteMarker.Boolean);
	FNV1A64_OP(value ? 1 : 0);
}
function FromConstructor(value) {
	FNV1A64_OP(ByteMarker.Constructor);
	FromValue$1(value.toString());
}
function FromDate(value) {
	FNV1A64_OP(ByteMarker.Date);
	FromValue$1(value.getTime());
}
function FromFunction(value) {
	FNV1A64_OP(ByteMarker.Function);
	FromValue$1(value.toString());
}
function FromNull$1(_value) {
	FNV1A64_OP(ByteMarker.Null);
}
function FromNumber$4(value) {
	FNV1A64_OP(ByteMarker.Number);
	F64In.setFloat64(0, value, true);
	for (const byte of F64Out) FNV1A64_OP(byte);
}
function FromObject$12(value) {
	FNV1A64_OP(ByteMarker.Object);
	for (const key of InstanceKeys(value).sort()) {
		FromValue$1(key);
		FromValue$1(value[key]);
	}
}
function FromRegExp(value) {
	FNV1A64_OP(ByteMarker.RegExp);
	FromString$6(value.toString());
}
const encoder = new TextEncoder();
function FromString$6(value) {
	FNV1A64_OP(ByteMarker.String);
	for (const byte of encoder.encode(value)) FNV1A64_OP(byte);
}
function FromSymbol(value) {
	FNV1A64_OP(ByteMarker.Symbol);
	FromValue$1(value.toString());
}
function FromTypeArray(value) {
	FNV1A64_OP(ByteMarker.TypeArray);
	const buffer = new Uint8Array(value.buffer);
	for (let i = 0; i < buffer.length; i++) FNV1A64_OP(buffer[i]);
}
function FromUndefined$1(_value) {
	return FNV1A64_OP(ByteMarker.Undefined);
}
function FromValue$1(value) {
	return IsTypeArray(value) ? FromTypeArray(value) : IsDate$1(value) ? FromDate(value) : IsRegExp(value) ? FromRegExp(value) : IsBoolean$1(value) ? FromBoolean$5(value.valueOf()) : IsString$1(value) ? FromString$6(value.valueOf()) : IsNumber$1(value) ? FromNumber$4(value.valueOf()) : IsIEEE754(value) ? FromNumber$4(value) : IsArray$1(value) ? FromArray$8(value) : IsBoolean$2(value) ? FromBoolean$5(value) : IsBigInt$1(value) ? FromBigInt$5(value) : IsConstructor$1(value) ? FromConstructor(value) : IsNull$1(value) ? FromNull$1(value) : IsObject$1(value) ? FromObject$12(value) : IsString$2(value) ? FromString$6(value) : IsSymbol$1(value) ? FromSymbol(value) : IsUndefined$1(value) ? FromUndefined$1(value) : IsFunction$1(value) ? FromFunction(value) : Unreachable();
}
/** Generates a FNV1A-64 non cryptographic hash of the given value */
function HashCode(value) {
	Accumulator = BigInt("14695981039346656037");
	FromValue$1(value);
	return Accumulator;
}
/** Generates a FNV1A-64 non cryptographic hash of the given value */
function Hash(value) {
	return HashCode(value).toString(16).padStart(16, "0");
}
// node_modules/typebox/build/system/locale/en_US.mjs
/** en_US: English (United States) - ISO 639-1 language code 'en' with ISO 3166-1 alpha-2 country code 'US' for United States. */
function en_US(error) {
	switch (error.keyword) {
		case "additionalProperties": return "must not have additional properties";
		case "anyOf": return "must match a schema in anyOf";
		case "boolean": return "schema is false";
		case "const": return "must be equal to constant";
		case "contains": return "must contain at least 1 valid item";
		case "dependencies": return `must have properties ${error.params.dependencies.join(", ")} when property ${error.params.property} is present`;
		case "dependentRequired": return `must have properties ${error.params.dependencies.join(", ")} when property ${error.params.property} is present`;
		case "enum": return "must be equal to one of the allowed values";
		case "exclusiveMaximum": return `must be ${error.params.comparison} ${error.params.limit}`;
		case "exclusiveMinimum": return `must be ${error.params.comparison} ${error.params.limit}`;
		case "format": return `must match format "${error.params.format}"`;
		case "if": return `must match "${error.params.failingKeyword}" schema`;
		case "maxItems": return `must not have more than ${error.params.limit} items`;
		case "maxLength": return `must not have more than ${error.params.limit} characters`;
		case "maxProperties": return `must not have more than ${error.params.limit} properties`;
		case "maximum": return `must be ${error.params.comparison} ${error.params.limit}`;
		case "minItems": return `must not have fewer than ${error.params.limit} items`;
		case "minLength": return `must not have fewer than ${error.params.limit} characters`;
		case "minProperties": return `must not have fewer than ${error.params.limit} properties`;
		case "minimum": return `must be ${error.params.comparison} ${error.params.limit}`;
		case "multipleOf": return `must be multiple of ${error.params.multipleOf}`;
		case "not": return "must not be valid";
		case "oneOf": return "must match exactly one schema in oneOf";
		case "pattern": return `must match pattern "${error.params.pattern}"`;
		case "propertyNames": return `property names ${error.params.propertyNames.join(", ")} are invalid`;
		case "required": return `must have required properties ${error.params.requiredProperties.join(", ")}`;
		case "type": return typeof error.params.type === "string" ? `must be ${error.params.type}` : `must be either ${error.params.type.join(" or ")}`;
		case "unevaluatedItems": return "must not have unevaluated items";
		case "unevaluatedProperties": return "must not have unevaluated properties";
		case "uniqueItems": return `must not have duplicate items`;
		case "~refine": return error.params.message;
		default: return "an unknown validation error occurred";
	}
}
// node_modules/typebox/build/system/locale/_config.mjs
let locale = en_US;
/** Gets the locale */
function Get$1() {
	return locale;
}
/** Creates a BigInt type. */
function BigInt$1(options) {
	return Create({ "~kind": "BigInt" }, { type: "bigint" }, options);
}
// node_modules/typebox/build/type/types/boolean.mjs
/** Creates a Boolean type. */
function Boolean$1(options) {
	return Create({ "~kind": "Boolean" }, { type: "boolean" }, options);
}
// node_modules/typebox/build/type/types/integer.mjs
const IntegerPattern = "-?(?:0|[1-9][0-9]*)";
/** Creates a Integer type. */
function Integer(options) {
	return Create({ "~kind": "Integer" }, { type: "integer" }, options);
}
// node_modules/typebox/build/type/types/literal.mjs
var InvalidLiteralValue = class extends Error {
	constructor(value) {
		super(`Invalid Literal value`);
		Object.defineProperty(this, "cause", {
			value: { value },
			writable: false,
			configurable: false,
			enumerable: false
		});
	}
};
function LiteralTypeName(value) {
	return IsBigInt$1(value) ? "bigint" : IsBoolean$2(value) ? "boolean" : IsNumber$2(value) ? "number" : IsString$2(value) ? "string" : (() => {
		throw new InvalidLiteralValue(value);
	})();
}
/** Creates a Literal type. */
function Literal(value, options) {
	return Create({ "~kind": "Literal" }, {
		type: LiteralTypeName(value),
		const: value
	}, options);
}
// node_modules/typebox/build/type/types/null.mjs
/** Creates a Null type. */
function Null(options) {
	return Create({ "~kind": "Null" }, { type: "null" }, options);
}
/** Creates a Number type. */
function Number$1(options) {
	return Create({ "~kind": "Number" }, { type: "number" }, options);
}
// node_modules/typebox/build/type/types/string.mjs
/** Creates a String type. */
function String$1(options) {
	return Create({ "~kind": "String" }, { type: "string" }, options);
}
// node_modules/typebox/build/type/types/union.mjs
/** Creates a Union type. */
function Union(anyOf, options = {}) {
	return Create({ "~kind": "Union" }, { anyOf }, options);
}
// node_modules/typebox/build/type/types/record.mjs
const IntegerKey = `^${IntegerPattern}$`;
// node_modules/typebox/build/type/script/mapping.mjs
function PatternBigIntMapping(input) {
	return BigInt$1();
}
function PatternStringMapping(input) {
	return String$1();
}
function PatternNumberMapping(input) {
	return Number$1();
}
function PatternIntegerMapping(input) {
	return Integer();
}
function PatternNeverMapping(input) {
	return Never();
}
function PatternTextMapping(input) {
	return Literal(input);
}
function PatternBaseMapping(input) {
	return input;
}
function PatternGroupMapping(input) {
	return Union(input[1]);
}
function PatternUnionMapping(input) {
	return input.length === 3 ? [...input[0], ...input[2]] : input.length === 1 ? [...input[0]] : [];
}
function PatternTermMapping(input) {
	return [input[0], ...input[1]];
}
function PatternBodyMapping(input) {
	return input;
}
// node_modules/typebox/build/type/script/token/internal/match.mjs
/** Checks the value is a Tuple-2 [string, string] result */
function IsMatch(value) {
	return IsEqual(value.length, 2);
}
/** Matches on a result and dispatches either left or right arm */
function Match$2(input, ok, fail) {
	return IsMatch(input) ? ok(input[0], input[1]) : fail();
}
// node_modules/typebox/build/type/script/token/internal/take.mjs
function TakeVariant(variant, input) {
	return IsEqual(input.indexOf(variant), 0) ? [variant, input.slice(variant.length)] : [];
}
/** Takes one of the given variants or fail */
function Take(variants, input) {
	for (let i = 0; i < variants.length; i++) {
		const result = TakeVariant(variants[i], input);
		if (IsMatch(result)) return result;
	}
	return [];
}
// node_modules/typebox/build/type/script/token/internal/char.mjs
function Range(start, end) {
	return Array.from({ length: end - start + 1 }, (_, i) => String.fromCharCode(start + i));
}
const Alpha = [...Range(97, 122), ...Range(65, 90)];
const Digit = ["0", ...Range(49, 57)];
// node_modules/typebox/build/type/script/token/internal/trim.mjs
const LineComment = "//";
const OpenComment = "/*";
const CloseComment = "*/";
function DiscardMultilineComment(input) {
	const index = input.indexOf(CloseComment);
	return IsEqual(index, -1) ? "" : input.slice(index + 2);
}
function DiscardLineComment(input) {
	const index = input.indexOf("\n");
	return IsEqual(index, -1) ? "" : input.slice(index);
}
function TrimStartUntilNewline(input) {
	return input.replace(/^[ \t\r\f\v]+/, "");
}
function TrimWhitespace(input) {
	const trimmed = TrimStartUntilNewline(input);
	return trimmed.startsWith(OpenComment) ? TrimWhitespace(DiscardMultilineComment(trimmed.slice(2))) : trimmed.startsWith(LineComment) ? TrimWhitespace(DiscardLineComment(trimmed.slice(2))) : trimmed;
}
function Trim(input) {
	const trimmed = input.trimStart();
	return trimmed.startsWith(OpenComment) ? Trim(DiscardMultilineComment(trimmed.slice(2))) : trimmed.startsWith(LineComment) ? Trim(DiscardLineComment(trimmed.slice(2))) : trimmed;
}
[...Digit];
// node_modules/typebox/build/type/script/token/const.mjs
function TakeConst(const_, input) {
	return Take([const_], input);
}
/** Matches if next is the given Const value */
function Const(const_, input) {
	return IsEqual(const_, "") ? ["", input] : const_.startsWith("\n") ? TakeConst(const_, TrimWhitespace(input)) : const_.startsWith(" ") ? TakeConst(const_, input) : TakeConst(const_, Trim(input));
}
[...[
	...Alpha,
	"_",
	"$"
], ...Digit];
[...Digit];
// node_modules/typebox/build/type/script/token/until.mjs
function TakeOne(input) {
	return IsEqual(input, "") ? [] : [input.slice(0, 1), input.slice(1)];
}
function IsInputMatchSentinal(end, input) {
	return ShiftLeft(end, (left, right) => input.startsWith(left) ? true : IsInputMatchSentinal(right, input), () => false);
}
/** Match Input until but not including End. No match if End not found. */
function Until(end, input, result = "") {
	return Match$2(TakeOne(input), (One, Rest) => IsInputMatchSentinal(end, input) ? [result, input] : Until(end, Rest, `${result}${One}`), () => []);
}
// node_modules/typebox/build/type/script/token/until_1.mjs
/** Match Input until but not including End. No match if End not found or match is zero-length. */
function Until_1(end, input) {
	return Match$2(Until(end, input), (Until, UntilRest) => IsEqual(Until, "") ? [] : [Until, UntilRest], () => []);
}
// node_modules/typebox/build/type/script/parser.mjs
const If = (result, left, right = () => []) => result.length === 2 ? left(result) : right();
const PatternBigInt = (input) => If(Const("-?(?:0|[1-9][0-9]*)n", input), ([_0, input]) => [PatternBigIntMapping(_0), input]);
const PatternString = (input) => If(Const(".*", input), ([_0, input]) => [PatternStringMapping(_0), input]);
const PatternNumber = (input) => If(Const("-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?", input), ([_0, input]) => [PatternNumberMapping(_0), input]);
const PatternInteger = (input) => If(Const("-?(?:0|[1-9][0-9]*)", input), ([_0, input]) => [PatternIntegerMapping(_0), input]);
const PatternNever = (input) => If(Const("(?!)", input), ([_0, input]) => [PatternNeverMapping(_0), input]);
const PatternText = (input) => If(Until_1([
	"-?(?:0|[1-9][0-9]*)n",
	".*",
	"-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?",
	"-?(?:0|[1-9][0-9]*)",
	"(?!)",
	"(",
	")",
	"$",
	"|"
], input), ([_0, input]) => [PatternTextMapping(_0), input]);
const PatternBase = (input) => If(If(PatternBigInt(input), ([_0, input]) => [_0, input], () => If(PatternString(input), ([_0, input]) => [_0, input], () => If(PatternNumber(input), ([_0, input]) => [_0, input], () => If(PatternInteger(input), ([_0, input]) => [_0, input], () => If(PatternNever(input), ([_0, input]) => [_0, input], () => If(PatternGroup(input), ([_0, input]) => [_0, input], () => If(PatternText(input), ([_0, input]) => [_0, input], () => []))))))), ([_0, input]) => [PatternBaseMapping(_0), input]);
const PatternGroup = (input) => If(If(Const("(", input), ([_0, input]) => If(PatternBody(input), ([_1, input]) => If(Const(")", input), ([_2, input]) => [[
	_0,
	_1,
	_2
], input]))), ([_0, input]) => [PatternGroupMapping(_0), input]);
const PatternUnion = (input) => If(If(If(PatternTerm(input), ([_0, input]) => If(Const("|", input), ([_1, input]) => If(PatternUnion(input), ([_2, input]) => [[
	_0,
	_1,
	_2
], input]))), ([_0, input]) => [_0, input], () => If(If(PatternTerm(input), ([_0, input]) => [[_0], input]), ([_0, input]) => [_0, input], () => If([[], input], ([_0, input]) => [_0, input], () => []))), ([_0, input]) => [PatternUnionMapping(_0), input]);
const PatternTerm = (input) => If(If(PatternBase(input), ([_0, input]) => If(PatternBody(input), ([_1, input]) => [[_0, _1], input])), ([_0, input]) => [PatternTermMapping(_0), input]);
const PatternBody = (input) => If(If(PatternUnion(input), ([_0, input]) => [_0, input], () => If(PatternTerm(input), ([_0, input]) => [_0, input], () => [])), ([_0, input]) => [PatternBodyMapping(_0), input]);
new RegExp(IntegerKey);
// src/core/repo-entry.ts
var EntryNotFoundError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "EntryNotFoundError";
	}
};
var EntryTooLargeError = class extends Error {
	size;
	constructor(size) {
		super(`File is ${size} bytes.`);
		this.size = size;
		this.name = "EntryTooLargeError";
	}
};
function submoduleUrl(gitmodules, path) {
	let sectionPath;
	let sectionUrl;
	for (const rawLine of [...gitmodules.split("\n"), "[end]"]) {
		const line = rawLine.trim();
		if (line.startsWith("[")) {
			if (sectionPath === path && sectionUrl) return sectionUrl;
			sectionPath = void 0;
			sectionUrl = void 0;
			continue;
		}
		const setting = /^(path|url)\s*=\s*(.+)$/.exec(line);
		if (setting?.[1] === "path") sectionPath = setting[2];
		else if (setting?.[1] === "url") sectionUrl = setting[2];
	}
}
// node_modules/typebox/build/schema/types/_refine.mjs
/**
* Returns true if the schema contains an '~refine` keyword
* @specification None
*/
function IsRefine(value) {
	return HasPropertyKey(value, "~refine") && IsArray$1(value["~refine"]) && Every(value["~refine"], 0, (value) => IsObject$1(value) && HasPropertyKey(value, "check") && HasPropertyKey(value, "error") && IsFunction$1(value.check) && IsFunction$1(value.error));
}
// node_modules/typebox/build/schema/types/schema.mjs
/** Returns true if this value is object like */
function IsSchemaObject(value) {
	return IsObject$1(value) && !IsArray$1(value);
}
/** Returns true if this value is a boolean */
function IsSchemaBoolean(value) {
	return IsBoolean$2(value);
}
/** Returns true if this value is schema like */
function IsSchema(value) {
	return IsSchemaObject(value) || IsSchemaBoolean(value);
}
// node_modules/typebox/build/schema/types/additionalItems.mjs
/**
* Returns true if the schema contains a valid additionalItems property
* @specification Json Schema 7
*/
function IsAdditionalItems(schema) {
	return HasPropertyKey(schema, "additionalItems") && IsSchema(schema.additionalItems);
}
// node_modules/typebox/build/schema/types/additionalProperties.mjs
/**
* Returns true if the schema contains a valid additionalProperties property
* @specification Json Schema 7
*/
function IsAdditionalProperties(schema) {
	return HasPropertyKey(schema, "additionalProperties") && IsSchema(schema.additionalProperties);
}
// node_modules/typebox/build/schema/types/allOf.mjs
/**
* Returns true if the schema contains a valid allOf property
* @specification Json Schema 7
*/
function IsAllOf(schema) {
	return HasPropertyKey(schema, "allOf") && IsArray$1(schema.allOf) && schema.allOf.every((value) => IsSchema(value));
}
// node_modules/typebox/build/schema/types/anchor.mjs
/**
* Returns true if the schema contains a valid $anchor property
*/
function IsAnchor(schema) {
	return HasPropertyKey(schema, "$anchor") && IsString$2(schema.$anchor);
}
// node_modules/typebox/build/schema/types/anyOf.mjs
/**
* Returns true if the schema contains a valid anyOf property
* @specification Json Schema 7
*/
function IsAnyOf(schema) {
	return HasPropertyKey(schema, "anyOf") && IsArray$1(schema.anyOf) && schema.anyOf.every((value) => IsSchema(value));
}
// node_modules/typebox/build/schema/types/const.mjs
/**
* Returns true if the schema contains a valid const property
* @specification Json Schema 7
*/
function IsConst(value) {
	return HasPropertyKey(value, "const");
}
// node_modules/typebox/build/schema/types/contains.mjs
/**
* Returns true if the schema contains a valid contains property
* @specification Json Schema 7
*/
function IsContains(schema) {
	return HasPropertyKey(schema, "contains") && IsSchema(schema.contains);
}
// node_modules/typebox/build/schema/types/dependencies.mjs
/**
* Returns true if the schema contains a valid dependencies property
* @specification Json Schema 7
*/
function IsDependencies(schema) {
	return HasPropertyKey(schema, "dependencies") && IsObject$1(schema.dependencies) && Object.values(schema.dependencies).every((value) => IsSchema(value) || IsArray$1(value) && value.every((value) => IsString$2(value)));
}
// node_modules/typebox/build/schema/types/dependentRequired.mjs
/**
* Returns true if the schema contains a valid dependentRequired property
* @specification Json Schema 2019-09
*/
function IsDependentRequired(schema) {
	return HasPropertyKey(schema, "dependentRequired") && IsObject$1(schema.dependentRequired) && Object.values(schema.dependentRequired).every((value) => IsArray$1(value) && value.every((value) => IsString$2(value)));
}
// node_modules/typebox/build/schema/types/dependentSchemas.mjs
/**
* Returns true if the schema contains a valid dependentRequired property
* @specification Json Schema 2019-09
*/
function IsDependentSchemas(schema) {
	return HasPropertyKey(schema, "dependentSchemas") && IsObject$1(schema.dependentSchemas) && Object.values(schema.dependentSchemas).every((value) => IsSchema(value));
}
// node_modules/typebox/build/schema/types/dynamicAnchor.mjs
/**
* Returns true if the schema contains a valid $dynamicAnchor property
*/
function IsDynamicAnchor(schema) {
	return HasPropertyKey(schema, "$dynamicAnchor") && IsString$2(schema.$dynamicAnchor);
}
// node_modules/typebox/build/schema/types/dynamicRef.mjs
/**
* Returns true if the schema contains a valid $dynamicRef property
*/
function IsDynamicRef(schema) {
	return HasPropertyKey(schema, "$dynamicRef") && IsString$2(schema.$dynamicRef);
}
// node_modules/typebox/build/schema/types/else.mjs
/**
* Returns true if the schema contains a valid else property
* @specification Json Schema 7
*/
function IsElse(schema) {
	return HasPropertyKey(schema, "else") && IsSchema(schema.else);
}
// node_modules/typebox/build/schema/types/enum.mjs
/**
* Returns true if the schema contains a valid enum property
* @specification Json Schema 7
*/
function IsEnum(schema) {
	return HasPropertyKey(schema, "enum") && IsArray$1(schema.enum);
}
// node_modules/typebox/build/schema/types/exclusiveMaximum.mjs
/**
* Returns true if the schema contains a valid exclusiveMaximum property
* @specification Json Schema 7
*/
function IsExclusiveMaximum(schema) {
	return HasPropertyKey(schema, "exclusiveMaximum") && (IsNumber$2(schema.exclusiveMaximum) || IsBigInt$1(schema.exclusiveMaximum));
}
// node_modules/typebox/build/schema/types/exclusiveMinimum.mjs
/**
* Returns true if the schema contains a valid exclusiveMinimum property
* @specification Json Schema 7
*/
function IsExclusiveMinimum(schema) {
	return HasPropertyKey(schema, "exclusiveMinimum") && (IsNumber$2(schema.exclusiveMinimum) || IsBigInt$1(schema.exclusiveMinimum));
}
// node_modules/typebox/build/schema/types/format.mjs
/**
* Returns true if the schema contains a valid format property
* @specification Json Schema 7
*/
function IsFormat(schema) {
	return HasPropertyKey(schema, "format") && IsString$2(schema.format);
}
// node_modules/typebox/build/schema/types/id.mjs
/**
* Returns true if the schema contains a valid $id property
* @specification Json Schema 7
*/
function IsId(schema) {
	return HasPropertyKey(schema, "$id") && IsString$2(schema.$id);
}
// node_modules/typebox/build/schema/types/if.mjs
/**
* Returns true if the schema contains a valid $id property
* @specification Json Schema 7
*/
function IsIf(schema) {
	return HasPropertyKey(schema, "if") && IsSchema(schema.if);
}
// node_modules/typebox/build/schema/types/items.mjs
/**
* Returns true if the schema contains a valid items property
* @specification Json Schema 7
*/
function IsItems(schema) {
	return HasPropertyKey(schema, "items") && (IsSchema(schema.items) || IsArray$1(schema.items) && schema.items.every((value) => {
		return IsSchema(value);
	}));
}
/** Returns true if this schema is a sized items variant */
function IsItemsSized(schema) {
	return IsItems(schema) && IsArray$1(schema.items);
}
// node_modules/typebox/build/schema/types/maximum.mjs
/**
* Returns true if the schema contains a valid maximum property
* @specification Json Schema 7
*/
function IsMaximum(schema) {
	return HasPropertyKey(schema, "maximum") && (IsNumber$2(schema.maximum) || IsBigInt$1(schema.maximum));
}
// node_modules/typebox/build/schema/types/maxContains.mjs
/**
* Returns true if the schema contains a valid maxContains property
* @specification Json Schema 2019-09
*/
function IsMaxContains(schema) {
	return HasPropertyKey(schema, "maxContains") && IsNumber$2(schema.maxContains);
}
// node_modules/typebox/build/schema/types/maxItems.mjs
/**
* Returns true if the schema contains a valid maxItems property
* @specification Json Schema 7
*/
function IsMaxItems(schema) {
	return HasPropertyKey(schema, "maxItems") && IsNumber$2(schema.maxItems);
}
// node_modules/typebox/build/schema/types/maxLength.mjs
/**
* Returns true if the schema contains a valid maxLength property
* @specification Json Schema 7
*/
function IsMaxLength(schema) {
	return HasPropertyKey(schema, "maxLength") && IsNumber$2(schema.maxLength);
}
// node_modules/typebox/build/schema/types/maxProperties.mjs
/**
* Returns true if the schema contains a valid maxProperties property
* @specification Json Schema 7
*/
function IsMaxProperties(schema) {
	return HasPropertyKey(schema, "maxProperties") && IsNumber$2(schema.maxProperties);
}
// node_modules/typebox/build/schema/types/minimum.mjs
/**
* Returns true if the schema contains a valid minimum property
* @specification Json Schema 7
*/
function IsMinimum(schema) {
	return HasPropertyKey(schema, "minimum") && (IsNumber$2(schema.minimum) || IsBigInt$1(schema.minimum));
}
// node_modules/typebox/build/schema/types/minContains.mjs
/**
* Returns true if the schema contains a valid maxContains property
* @specification Json Schema 2019-09
*/
function IsMinContains(schema) {
	return HasPropertyKey(schema, "minContains") && IsNumber$2(schema.minContains);
}
// node_modules/typebox/build/schema/types/minItems.mjs
/**
* Returns true if the schema contains a valid minItems property
* @specification Json Schema 7
*/
function IsMinItems(schema) {
	return HasPropertyKey(schema, "minItems") && IsNumber$2(schema.minItems);
}
// node_modules/typebox/build/schema/types/minLength.mjs
/**
* Returns true if the schema contains a valid minLength property
* @specification Json Schema 7
*/
function IsMinLength(schema) {
	return HasPropertyKey(schema, "minLength") && IsNumber$2(schema.minLength);
}
// node_modules/typebox/build/schema/types/minProperties.mjs
/**
* Returns true if the schema contains a valid minProperties property
* @specification Json Schema 7
*/
function IsMinProperties(schema) {
	return HasPropertyKey(schema, "minProperties") && IsNumber$2(schema.minProperties);
}
// node_modules/typebox/build/schema/types/multipleOf.mjs
/**
* Returns true if the schema contains a valid multipleOf property
* @specification Json Schema 7
*/
function IsMultipleOf(schema) {
	return HasPropertyKey(schema, "multipleOf") && (IsNumber$2(schema.multipleOf) || IsBigInt$1(schema.multipleOf));
}
// node_modules/typebox/build/schema/types/not.mjs
/**
* Returns true if the schema contains a valid not property
* @specification Json Schema 7
*/
function IsNot(schema) {
	return HasPropertyKey(schema, "not") && IsSchema(schema.not);
}
// node_modules/typebox/build/schema/types/oneOf.mjs
/**
* Returns true if the schema contains a valid oneOf property
* @specification Json Schema 7
*/
function IsOneOf(schema) {
	return HasPropertyKey(schema, "oneOf") && IsArray$1(schema.oneOf) && schema.oneOf.every((value) => IsSchema(value));
}
// node_modules/typebox/build/schema/types/pattern.mjs
/**
* Returns true if the schema contains a valid pattern property
* @specification Json Schema 7
*/
function IsPattern(schema) {
	return HasPropertyKey(schema, "pattern") && (IsString$2(schema.pattern) || schema.pattern instanceof RegExp);
}
// node_modules/typebox/build/schema/types/patternProperties.mjs
/**
* Returns true if the schema contains a valid patternProperties property
* @specification Json Schema 7
*/
function IsPatternProperties(schema) {
	return HasPropertyKey(schema, "patternProperties") && IsObject$1(schema.patternProperties) && Object.values(schema.patternProperties).every((value) => IsSchema(value));
}
// node_modules/typebox/build/schema/types/prefixItems.mjs
/**
* Returns true if the schema contains a valid prefixItems property
*/
function IsPrefixItems(schema) {
	return HasPropertyKey(schema, "prefixItems") && IsArray$1(schema.prefixItems) && schema.prefixItems.every((schema) => IsSchema(schema));
}
// node_modules/typebox/build/schema/types/properties.mjs
/**
* Returns true if the schema contains a valid properties property
* @specification Json Schema 7
*/
function IsProperties(schema) {
	return HasPropertyKey(schema, "properties") && IsObject$1(schema.properties) && Object.values(schema.properties).every((value) => IsSchema(value));
}
// node_modules/typebox/build/schema/types/propertyNames.mjs
/**
* Returns true if the schema contains a valid propertyNames property
* @specification Json Schema 7
*/
function IsPropertyNames(schema) {
	return HasPropertyKey(schema, "propertyNames") && (IsObject$1(schema.propertyNames) || IsSchema(schema.propertyNames));
}
// node_modules/typebox/build/schema/types/recursiveAnchor.mjs
/**
* Returns true if the schema contains a valid $recursiveAnchor property
*/
function IsRecursiveAnchor(schema) {
	return HasPropertyKey(schema, "$recursiveAnchor") && IsBoolean$2(schema.$recursiveAnchor);
}
/**
* Returns true if the schema contains a valid $recursiveAnchor property that is true
*/
function IsRecursiveAnchorTrue(schema) {
	return IsRecursiveAnchor(schema) && IsEqual(schema.$recursiveAnchor, true);
}
// node_modules/typebox/build/schema/types/recursiveRef.mjs
/**
* Returns true if the schema contains a valid $recursiveRef property
*/
function IsRecursiveRef(schema) {
	return HasPropertyKey(schema, "$recursiveRef") && IsString$2(schema.$recursiveRef);
}
// node_modules/typebox/build/schema/types/ref.mjs
/**
* Returns true if the schema contains a valid $ref property
* @specification Json Schema 7
*/
function IsRef(schema) {
	return HasPropertyKey(schema, "$ref") && IsString$2(schema.$ref);
}
// node_modules/typebox/build/schema/types/required.mjs
/**
* Returns true if the schema contains a valid required property
* @specification Json Schema 7
*/
function IsRequired(schema) {
	return HasPropertyKey(schema, "required") && IsArray$1(schema.required) && schema.required.every((value) => IsString$2(value));
}
// node_modules/typebox/build/schema/types/then.mjs
/**
* Returns true if the schema contains a valid then property
* @specification Json Schema 7
*/
function IsThen(schema) {
	return HasPropertyKey(schema, "then") && IsSchema(schema.then);
}
// node_modules/typebox/build/schema/types/type.mjs
/**
* Returns true if the schema contains a valid type property
* @specification Json Schema 7
*/
function IsType(schema) {
	return HasPropertyKey(schema, "type") && (IsString$2(schema.type) || IsArray$1(schema.type) && schema.type.every((value) => IsString$2(value)));
}
// node_modules/typebox/build/schema/types/uniqueItems.mjs
/**
* Returns true if the schema contains a valid uniqueItems property
* @specification Json Schema 7
*/
function IsUniqueItems(schema) {
	return HasPropertyKey(schema, "uniqueItems") && IsBoolean$2(schema.uniqueItems);
}
// node_modules/typebox/build/schema/types/unevaluatedItems.mjs
/**
* Returns true if the schema contains a valid unevaluatedItems property
* @specification Json Schema 2019-09
*/
function IsUnevaluatedItems(schema) {
	return HasPropertyKey(schema, "unevaluatedItems") && IsSchema(schema.unevaluatedItems);
}
// node_modules/typebox/build/schema/types/unevaluatedProperties.mjs
/**
* Returns true if the schema contains a valid unevaluatedProperties property
* @specification Json Schema 2019-09
*/
function IsUnevaluatedProperties(schema) {
	return HasPropertyKey(schema, "unevaluatedProperties") && IsSchema(schema.unevaluatedProperties);
}
// node_modules/typebox/build/schema/engine/_context.mjs
var CheckContext = class {
	constructor() {
		const indices = /* @__PURE__ */ new Set();
		const keys = /* @__PURE__ */ new Set();
		this.stack = [{
			indices,
			keys
		}];
	}
	Push() {
		const indices = /* @__PURE__ */ new Set();
		const keys = /* @__PURE__ */ new Set();
		this.stack.push({
			indices,
			keys
		});
		return true;
	}
	Pop() {
		this.stack.pop();
		return true;
	}
	AddIndex(index) {
		this.GetIndices().add(index);
		return true;
	}
	AddKey(key) {
		this.GetKeys().add(key);
		return true;
	}
	GetIndices() {
		return this.stack[this.stack.length - 1].indices;
	}
	GetKeys() {
		return this.stack[this.stack.length - 1].keys;
	}
	Merge(results) {
		for (const context of results) {
			context.GetIndices().forEach((value) => this.GetIndices().add(value));
			context.GetKeys().forEach((value) => this.GetKeys().add(value));
		}
		return true;
	}
};
var ErrorContext = class extends CheckContext {
	constructor() {
		super();
		this.errors = [];
	}
	AtCapacity() {
		return this.errors.length >= Get$2().maxErrors;
	}
	AddError(error) {
		if (!this.AtCapacity()) this.errors.push(error);
		return false;
	}
	GetErrors() {
		return this.errors;
	}
};
// node_modules/typebox/build/schema/engine/_refine.mjs
function CheckRefine(_stack, _context, schema, value) {
	return Every(schema["~refine"], 0, (refinement, _) => refinement.check(value));
}
function ErrorRefine(_stack, context, schemaPath, instancePath, schema, value) {
	return EveryAll(schema["~refine"], 0, (refinement, index) => {
		return refinement.check(value) || context.AddError({
			keyword: "~refine",
			schemaPath,
			instancePath,
			params: {
				index,
				message: refinement.error(value)
			}
		});
	});
}
// node_modules/typebox/build/schema/engine/additionalItems.mjs
function IsValid$4(schema) {
	return IsItems(schema) && IsArray$1(schema.items);
}
function CheckAdditionalItems(stack, context, schema, value) {
	if (!IsValid$4(schema)) return true;
	return Every(value, 0, (item, index) => {
		return IsLessThan(index, schema.items.length) || CheckSchemaPushStack(stack, context, schema.additionalItems, item) && context.AddIndex(index);
	});
}
function ErrorAdditionalItems(stack, context, schemaPath, instancePath, schema, value) {
	if (!IsValid$4(schema)) return true;
	return Every(value, 0, (item, index) => {
		const nextSchemaPath = `${schemaPath}/additionalItems`;
		const nextInstancePath = `${instancePath}/${index}`;
		return IsLessThan(index, schema.items.length) || ErrorSchemaPushStack(stack, context, nextSchemaPath, nextInstancePath, schema.additionalItems, item) && context.AddIndex(index);
	});
}
// node_modules/typebox/build/schema/engine/_regexp.mjs
/** Standard RegExp with Unicode */
function UnicodeRegExp(pattern) {
	return new RegExp(pattern, "u");
}
// node_modules/typebox/build/schema/engine/additionalProperties.mjs
function GetPropertyKeyAsPattern(key) {
	return `^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;
}
function GetPropertiesPattern(schema) {
	const patterns = [];
	if (IsPatternProperties(schema)) patterns.push(...Keys(schema.patternProperties));
	if (IsProperties(schema)) patterns.push(...Keys(schema.properties).map(GetPropertyKeyAsPattern));
	return IsEqual(patterns.length, 0) ? "(?!)" : `(${patterns.join("|")})`;
}
function CheckAdditionalProperties(stack, context, schema, value) {
	const regexp = UnicodeRegExp(GetPropertiesPattern(schema));
	return Every(Keys(value), 0, (key, _index) => {
		return regexp.test(key) || CheckSchemaPushStack(stack, context, schema.additionalProperties, value[key]) && context.AddKey(key);
	});
}
function ErrorAdditionalProperties(stack, context, schemaPath, instancePath, schema, value) {
	const regexp = UnicodeRegExp(GetPropertiesPattern(schema));
	const additionalProperties = [];
	return EveryAll(Keys(value), 0, (key, _index) => {
		const nextSchemaPath = `${schemaPath}/additionalProperties`;
		const nextInstancePath = `${instancePath}/${key}`;
		const isAdditionalProperty = regexp.test(key) || ErrorSchemaPushStack(stack, context, nextSchemaPath, nextInstancePath, schema.additionalProperties, value[key]) && context.AddKey(key);
		if (!isAdditionalProperty) additionalProperties.push(key);
		return isAdditionalProperty;
	}) || context.AddError({
		keyword: "additionalProperties",
		schemaPath,
		instancePath,
		params: { additionalProperties }
	});
}
// node_modules/typebox/build/schema/engine/allOf.mjs
function CheckAllOf(stack, context, schema, value) {
	const results = schema.allOf.reduce((result, schema) => {
		const nextContext = new CheckContext();
		return CheckSchema(stack, nextContext, schema, value) ? [...result, nextContext] : result;
	}, []);
	return IsEqual(results.length, schema.allOf.length) && context.Merge(results);
}
function ErrorAllOf(stack, context, schemaPath, instancePath, schema, value) {
	const failedContexts = [];
	const results = schema.allOf.reduce((result, schema, index) => {
		const nextSchemaPath = `${schemaPath}/allOf/${index}`;
		const nextContext = new ErrorContext();
		const isSchema = ErrorSchema(stack, nextContext, nextSchemaPath, instancePath, schema, value);
		if (!isSchema) failedContexts.push(nextContext);
		return isSchema ? [...result, nextContext] : result;
	}, []);
	const isAllOf = IsEqual(results.length, schema.allOf.length) && context.Merge(results);
	if (!isAllOf) failedContexts.forEach((failed) => failed.GetErrors().forEach((error) => context.AddError(error)));
	return isAllOf;
}
// node_modules/typebox/build/schema/engine/anyOf.mjs
function CheckAnyOf(stack, context, schema, value) {
	const results = schema.anyOf.reduce((result, schema) => {
		const nextContext = new CheckContext();
		return CheckSchema(stack, nextContext, schema, value) ? [...result, nextContext] : result;
	}, []);
	return IsGreaterThan(results.length, 0) && context.Merge(results);
}
function ErrorAnyOf(stack, context, schemaPath, instancePath, schema, value) {
	const failedContexts = [];
	const results = schema.anyOf.reduce((result, schema, index) => {
		const nextContext = new ErrorContext();
		const isSchema = ErrorSchema(stack, nextContext, `${schemaPath}/anyOf/${index}`, instancePath, schema, value);
		if (!isSchema) failedContexts.push(nextContext);
		return isSchema ? [...result, nextContext] : result;
	}, []);
	const isAnyOf = IsGreaterThan(results.length, 0) && context.Merge(results);
	if (!isAnyOf) failedContexts.forEach((failed) => failed.GetErrors().forEach((error) => context.AddError(error)));
	return isAnyOf || context.AddError({
		keyword: "anyOf",
		schemaPath,
		instancePath,
		params: {}
	});
}
// node_modules/typebox/build/schema/engine/boolean.mjs
function CheckSchemaBoolean(_stack, _context, schema, _value) {
	return schema;
}
function ErrorSchemaBoolean(stack, context, schemaPath, instancePath, schema, value) {
	return CheckSchemaBoolean(stack, context, schema, value) || context.AddError({
		keyword: "boolean",
		schemaPath,
		instancePath,
		params: {}
	});
}
// node_modules/typebox/build/schema/engine/const.mjs
function CheckConst(_stack, _context, schema, value) {
	return IsValueLike(schema.const) ? IsEqual(value, schema.const) : IsDeepEqual(value, schema.const);
}
function ErrorConst(stack, context, schemaPath, instancePath, schema, value) {
	return CheckConst(stack, context, schema, value) || context.AddError({
		keyword: "const",
		schemaPath,
		instancePath,
		params: { allowedValue: schema.const }
	});
}
// node_modules/typebox/build/schema/engine/contains.mjs
function IsValid$3(schema) {
	return !(IsMinContains(schema) && IsEqual(schema.minContains, 0));
}
function CheckContains(stack, context, schema, value) {
	if (!IsValid$3(schema)) return true;
	return !IsEqual(value.length, 0) && SomeAll(value, (item, index) => {
		return CheckSchema(stack, context, schema.contains, item) && context.AddIndex(index);
	});
}
function ErrorContains(stack, context, schemaPath, instancePath, schema, value) {
	return CheckContains(stack, context, schema, value) || context.AddError({
		keyword: "contains",
		schemaPath,
		instancePath,
		params: { minContains: 1 }
	});
}
// node_modules/typebox/build/schema/engine/dependencies.mjs
function CheckDependencies(stack, context, schema, value) {
	const isLength = IsEqual(Keys(value).length, 0);
	const isEvery = Every(Entries(schema.dependencies), 0, ([key, schema]) => {
		return !HasPropertyKey(value, key) || (IsArray$1(schema) ? schema.every((key) => HasPropertyKey(value, key)) : CheckSchema(stack, context, schema, value));
	});
	return isLength || isEvery;
}
function ErrorDependencies(stack, context, schemaPath, instancePath, schema, value) {
	const isLength = IsEqual(Keys(value).length, 0);
	const isEvery = EveryAll(Entries(schema.dependencies), 0, ([key, schema]) => {
		const nextSchemaPath = `${schemaPath}/dependencies/${key}`;
		return !HasPropertyKey(value, key) || (IsArray$1(schema) ? schema.every((dependency) => HasPropertyKey(value, dependency) || context.AddError({
			keyword: "dependencies",
			schemaPath,
			instancePath,
			params: {
				property: key,
				dependencies: schema
			}
		})) : ErrorSchema(stack, context, nextSchemaPath, instancePath, schema, value));
	});
	return isLength || isEvery;
}
// node_modules/typebox/build/schema/engine/dependentRequired.mjs
function CheckDependentRequired(_stack, _context, schema, value) {
	const isLength = IsEqual(Keys(value).length, 0);
	const isEvery = Every(Entries(schema.dependentRequired), 0, ([key, keys]) => {
		return !HasPropertyKey(value, key) || keys.every((key) => HasPropertyKey(value, key));
	});
	return isLength || isEvery;
}
function ErrorDependentRequired(_stack, context, schemaPath, instancePath, schema, value) {
	const isLength = IsEqual(Keys(value).length, 0);
	const isEveryEntry = EveryAll(Entries(schema.dependentRequired), 0, ([key, keys]) => {
		return !HasPropertyKey(value, key) || EveryAll(keys, 0, (dependency) => HasPropertyKey(value, dependency) || context.AddError({
			keyword: "dependentRequired",
			schemaPath,
			instancePath,
			params: {
				property: key,
				dependencies: keys
			}
		}));
	});
	return isLength || isEveryEntry;
}
// node_modules/typebox/build/schema/engine/dependentSchemas.mjs
function CheckDependentSchemas(stack, context, schema, value) {
	const isLength = IsEqual(Keys(value).length, 0);
	const isEvery = Every(Entries(schema.dependentSchemas), 0, ([key, schema]) => {
		return !HasPropertyKey(value, key) || CheckSchema(stack, context, schema, value);
	});
	return isLength || isEvery;
}
function ErrorDependentSchemas(stack, context, schemaPath, instancePath, schema, value) {
	const isLength = IsEqual(Keys(value).length, 0);
	const isEvery = EveryAll(Entries(schema.dependentSchemas), 0, ([key, schema]) => {
		const nextSchemaPath = `${schemaPath}/dependentSchemas/${key}`;
		return !HasPropertyKey(value, key) || ErrorSchema(stack, context, nextSchemaPath, instancePath, schema, value);
	});
	return isLength || isEvery;
}
// node_modules/typebox/build/schema/engine/dynamicRef.mjs
function CheckDynamicRef(stack, context, schema, value) {
	const target = stack.DynamicRef(schema) ?? false;
	return IsSchema(target) && CheckSchema(stack, context, target, value);
}
function ErrorDynamicRef(stack, context, _schemaPath, instancePath, schema, value) {
	const target = stack.DynamicRef(schema) ?? false;
	return IsSchema(target) && ErrorSchema(stack, context, "#", instancePath, target, value);
}
// node_modules/typebox/build/schema/engine/enum.mjs
function CheckEnum(_stack, _context, schema, value) {
	return Some(schema.enum, (option) => IsValueLike(option) ? IsEqual(value, option) : IsDeepEqual(value, option));
}
function ErrorEnum(stack, context, schemaPath, instancePath, schema, value) {
	return CheckEnum(stack, context, schema, value) || context.AddError({
		keyword: "enum",
		schemaPath,
		instancePath,
		params: { allowedValues: schema.enum }
	});
}
// node_modules/typebox/build/schema/engine/exclusiveMaximum.mjs
function CheckExclusiveMaximum(_stack, _context, schema, value) {
	return IsLessThan(value, schema.exclusiveMaximum);
}
function ErrorExclusiveMaximum(stack, context, schemaPath, instancePath, schema, value) {
	return CheckExclusiveMaximum(stack, context, schema, value) || context.AddError({
		keyword: "exclusiveMaximum",
		schemaPath,
		instancePath,
		params: {
			comparison: "<",
			limit: schema.exclusiveMaximum
		}
	});
}
// node_modules/typebox/build/schema/engine/exclusiveMinimum.mjs
function CheckExclusiveMinimum(_stack, _context, schema, value) {
	return IsGreaterThan(value, schema.exclusiveMinimum);
}
function ErrorExclusiveMinimum(stack, context, schemaPath, instancePath, schema, value) {
	return CheckExclusiveMinimum(stack, context, schema, value) || context.AddError({
		keyword: "exclusiveMinimum",
		schemaPath,
		instancePath,
		params: {
			comparison: ">",
			limit: schema.exclusiveMinimum
		}
	});
}
// node_modules/typebox/build/format/date.mjs
const DAYS = [
	0,
	31,
	28,
	31,
	30,
	31,
	30,
	31,
	31,
	30,
	31,
	30,
	31
];
const DATE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;
function IsLeapYear(year) {
	return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
/**
* Returns true if the value is a ISO8601 Date component string
* @description https://datatracker.ietf.org/doc/html/rfc3339
* @example `2020-12-12`
*/
function IsDate(value) {
	const matches = DATE.exec(value);
	if (!matches) return false;
	const year = +matches[1];
	const month = +matches[2];
	const day = +matches[3];
	return month >= 1 && month <= 12 && day >= 1 && day <= (month === 2 && IsLeapYear(year) ? 29 : DAYS[month]);
}
// node_modules/typebox/build/format/time.mjs
const TIME = /^(\d\d):(\d\d):(\d\d)(?:\.\d+)?(?:([Zz])|([+-])(\d\d):(\d\d))?$/;
/**
* Returns true if the value is an ISO time string
* @specification https://datatracker.ietf.org/doc/html/rfc3339
*/
function IsTime(value, strictTimeZone = true) {
	const matches = TIME.exec(value);
	if (!matches) return false;
	if (strictTimeZone && !matches[4] && !matches[5]) return false;
	const hr = +matches[1];
	const min = +matches[2];
	const sec = +matches[3];
	if (hr > 23 || min > 59 || sec > 60) return false;
	if (matches[5]) {
		const tzH = +matches[6];
		const tzM = +matches[7];
		if (tzH > 23 || tzM > 59) return false;
	}
	if (sec < 60) return true;
	const tzSign = matches[5] === "-" ? -1 : 1;
	const tzH = +(matches[6] || 0);
	const tzM = +(matches[7] || 0);
	return ((hr * 60 + min - tzSign * (tzH * 60 + tzM)) % 1440 + 1440) % 1440 === 1439;
}
// node_modules/typebox/build/format/date_time.mjs
/**
* Returns true if the value is a ISO8601 DateTime string
* @specification https://datatracker.ietf.org/doc/html/rfc3339
* @example `2020-12-12T20:20:40+00:00`
*/
function IsDateTime(value) {
	const dateTime = value.split(/T/i);
	return dateTime.length === 2 && IsDate(dateTime[0]) && IsTime(dateTime[1]);
}
// node_modules/typebox/build/format/duration.mjs
const Duration = /^P((\d+Y(\d+M(\d+D)?)?|\d+M(\d+D)?|\d+D)(T(\d+H(\d+M(\d+S)?)?|\d+M(\d+S)?|\d+S))?|T(\d+H(\d+M(\d+S)?)?|\d+M(\d+S)?|\d+S)|\d+W)$/;
/**
* Returns true if the value is a valid ISO-8601 duration.
* @specification https://tools.ietf.org/html/rfc3339
*/
function IsDuration(value) {
	return Duration.test(value);
}
// node_modules/typebox/build/format/email.mjs
const Email = /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[^"\\]|\\[\x20-\x7e])*")@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*|\[(?:IPv6:[a-f0-9:]+|(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(?:\.(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3})\])$/i;
/**
* Returns true if the value is an Email
* @specification https://datatracker.ietf.org/doc/html/rfc5322
*/
function IsEmail(value) {
	return Email.test(value);
}
// node_modules/typebox/build/format/idna/pattern/pattern.mjs
const RE_RULE_HYPHEN_PLACEMENT = /^(?!-).*(?<!-)$/;
const RE_RULE_NOT_RESERVED_ACE = /^(?!..--)/;
const RE_ASCII_LDH = /^[a-zA-Z0-9-]*$/;
const RE_NON_ASCII = /[^\p{ASCII}]/u;
const RE_ASCII_DIGIT = /[0-9]/;
const RE_ARABIC_INDIC_DIGIT = /[\u{0660}-\u{0669}]/u;
const RE_EXT_ARABIC_INDIC_DIGIT = /[\u{06f0}-\u{06f9}]/u;
const RE_COMMON_SEPARATOR = /[\u{002e}\u{002c}\u{003a}\u{002f}]/u;
const RE_EUROPEAN_SEPARATOR = /[\u{002d}\u{002b}]/u;
const RE_MARK_NONSPACING = /\p{Mn}/u;
const RE_MARK_SPACING_COMBINING = /\p{Mc}/u;
const RE_COMBINING_MARK = /[\p{Mn}\p{Mc}\p{Me}]/u;
const RE_LETTER = /\p{L}/u;
const RE_NUMBER_DECIMAL = /\p{Nd}/u;
const RE_SCRIPT_GREEK = /\p{Script=Greek}/u;
const RE_SCRIPT_HEBREW = /\p{Script=Hebrew}/u;
const RE_SCRIPT_JAPANESE = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
const RE_SCRIPT_ARABIC_LETTER = /[\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Mandaic}]/u;
const RE_VIRAMA = /[\u{094d}\u{09cd}\u{0a4d}\u{0acd}\u{0b4d}\u{0bcd}\u{0c4d}\u{0ccd}\u{0d3b}\u{0d3c}\u{0d4d}\u{0dca}\u{1b44}\u{1baa}\u{1bab}\u{a9c0}\u{11046}\u{1107f}\u{110b9}\u{11133}\u{11134}\u{111c0}\u{11235}\u{1134d}\u{11442}\u{114c2}\u{115bf}\u{1163f}\u{116b6}\u{11c3f}\u{11d44}\u{11d45}]/u;
const RE_RFC5892_DISALLOWED = /[\u{0640}\u{07fa}\u{302e}\u{302f}\u{3031}\u{3032}\u{3033}\u{3034}\u{3035}\u{303b}]/u;
const RE_CONTEXTO_EXCEPTIONS = /[\u{00b7}\u{0375}\u{05f3}\u{05f4}\u{200c}\u{200d}\u{30fb}]/u;
const RE_PVALID_EXCEPTIONS = /[\u{00df}\u{03c2}\u{06fd}\u{06fe}\u{0f0b}\u{3007}]/u;
const RE_EUROPEAN_NUMBER = new RegExp([RE_ASCII_DIGIT, RE_EXT_ARABIC_INDIC_DIGIT].map((regexp) => regexp.source).join("|"), "u");
const RE_PERMITTED_CATEGORY = new RegExp([
	RE_LETTER,
	RE_EUROPEAN_SEPARATOR,
	RE_COMMON_SEPARATOR,
	RE_NUMBER_DECIMAL,
	RE_MARK_NONSPACING,
	RE_MARK_SPACING_COMBINING,
	RE_CONTEXTO_EXCEPTIONS,
	RE_PVALID_EXCEPTIONS
].map((regexp) => regexp.source).join("|"), "u");
// node_modules/typebox/build/format/idna/label/ascii.mjs
function IsAsciiLabel(value) {
	return RE_RULE_HYPHEN_PLACEMENT.test(value) && RE_RULE_NOT_RESERVED_ACE.test(value) && RE_ASCII_LDH.test(value);
}
// node_modules/typebox/build/format/idna/format/puny.mjs
const PUNYCODE_BASE = 36;
const PUNYCODE_TMIN = 1;
const PUNYCODE_TMAX = 26;
const PUNYCODE_SKEW = 38;
const PUNYCODE_DAMP = 700;
const PUNYCODE_INITIAL_BIAS = 72;
const PUNYCODE_INITIAL_N = 128;
function ThrowDontCare() {
	throw null;
}
function IsAcePrefixed(value) {
	return value.toLowerCase().startsWith("xn--");
}
function Adapt(delta, numPoints, firstTime) {
	delta = firstTime ? Math.floor(delta / PUNYCODE_DAMP) : delta >> 1;
	delta += Math.floor(delta / numPoints);
	let k = 0;
	while (delta > 455) {
		delta = Math.floor(delta / 35);
		k += PUNYCODE_BASE;
	}
	return k + Math.floor(36 * delta / (delta + PUNYCODE_SKEW));
}
function Decode$7(value) {
	const output = [];
	let n = PUNYCODE_INITIAL_N;
	let i = 0;
	let bias = PUNYCODE_INITIAL_BIAS;
	const delimIdx = value.lastIndexOf("-");
	if (delimIdx > 0) for (let j = 0; j < delimIdx; j++) {
		const cp = value.charCodeAt(j);
		if (cp >= 128) ThrowDontCare();
		output.push(cp);
	}
	let inIdx = delimIdx < 0 ? 0 : delimIdx + 1;
	while (inIdx < value.length) {
		const oldi = i;
		let w = 1;
		let k = PUNYCODE_BASE;
		while (true) {
			if (inIdx >= value.length) ThrowDontCare();
			const ch = value.charCodeAt(inIdx++);
			let digit;
			if (ch >= 97 && ch <= 122) digit = ch - 97;
			else if (ch >= 48 && ch <= 57) digit = ch - 48 + 26;
			else ThrowDontCare();
			i += digit * w;
			const t = k <= bias ? PUNYCODE_TMIN : k >= bias + PUNYCODE_TMAX ? PUNYCODE_TMAX : k - bias;
			if (digit < t) break;
			w *= PUNYCODE_BASE - t;
			k += PUNYCODE_BASE;
		}
		const outLen = output.length + 1;
		bias = Adapt(i - oldi, outLen, oldi === 0);
		n += Math.floor(i / outLen);
		i %= outLen;
		output.splice(i, 0, n);
		i++;
	}
	return String.fromCodePoint(...output);
}
function DigitToChar(digit) {
	return digit < 26 ? String.fromCharCode(digit + 97) : String.fromCharCode(digit - 26 + 48);
}
const RE_REPLACE_NON_ASCII = new RegExp(RE_NON_ASCII.source, "gu");
function Encode$7(input) {
	const basic = input.replace(RE_REPLACE_NON_ASCII, "");
	const basicLength = basic.length;
	const result = basicLength > 0 ? [basic, "-"] : [];
	const codePoints = Array.from(input, (char) => char.codePointAt(0));
	let n = PUNYCODE_INITIAL_N;
	let delta = 0;
	let bias = PUNYCODE_INITIAL_BIAS;
	let handledCPCount = basicLength;
	while (handledCPCount < codePoints.length) {
		let m = Infinity;
		for (const cp of codePoints) if (cp >= n && cp < m) m = cp;
		delta += (m - n) * (handledCPCount + 1);
		n = m;
		for (const cp of codePoints) {
			if (cp < n) delta++;
			if (cp === n) {
				let q = delta;
				for (let k = PUNYCODE_BASE;; k += PUNYCODE_BASE) {
					const t = k <= bias ? PUNYCODE_TMIN : k >= bias + PUNYCODE_TMAX ? PUNYCODE_TMAX : k - bias;
					if (q < t) break;
					const digit = t + (q - t) % (PUNYCODE_BASE - t);
					result.push(DigitToChar(digit));
					q = Math.floor((q - t) / (PUNYCODE_BASE - t));
				}
				result.push(DigitToChar(q));
				bias = Adapt(delta, handledCPCount + 1, handledCPCount === basicLength);
				delta = 0;
				handledCPCount++;
			}
		}
		delta++;
		n++;
	}
	return result.join("");
}
// node_modules/typebox/build/format/idna/format/bidi.mjs
const RE_RTL_ALLOWED = /^(?:R|AL|AN|EN|ES|CS|ET|ON|BN|NSM)$/;
const RE_LTR_ALLOWED = /^(?:L|EN|ES|CS|ET|ON|BN|NSM)$/;
const RE_RTL_CLASSES = /^(?:R|AL|AN)$/;
function HasBidiChars(value) {
	if (IsAcePrefixed(value)) try {
		return HasRightToLeftCharacters(Decode$7(value.slice(4).toLowerCase()));
	} catch {
		return false;
	}
	return HasRightToLeftCharacters(value);
}
function GetBidiClass(codePoint) {
	const char = String.fromCodePoint(codePoint);
	return RE_EUROPEAN_NUMBER.test(char) ? "EN" : RE_ARABIC_INDIC_DIGIT.test(char) ? "AN" : RE_MARK_NONSPACING.test(char) ? "NSM" : RE_SCRIPT_HEBREW.test(char) ? "R" : RE_SCRIPT_ARABIC_LETTER.test(char) ? "AL" : RE_LETTER.test(char) ? "L" : "ON";
}
function HasRightToLeftCharacters(value) {
	for (const ch of value) if (RE_RTL_CLASSES.test(GetBidiClass(ch.codePointAt(0)))) return true;
	return false;
}
function SatisfiesBidiRule(value) {
	let isRtl = false;
	let allowed = RE_LTR_ALLOWED;
	let sawEN = false;
	let sawAN = false;
	let isFirst = true;
	for (const ch of value) {
		const bidiClass = GetBidiClass(ch.codePointAt(0));
		if (isFirst) {
			if (bidiClass !== "L" && bidiClass !== "R" && bidiClass !== "AL") return false;
			isRtl = bidiClass === "R" || bidiClass === "AL";
			allowed = isRtl ? RE_RTL_ALLOWED : RE_LTR_ALLOWED;
			isFirst = false;
		}
		if (!allowed.test(bidiClass)) return false;
		if (bidiClass === "EN") sawEN = true;
		else if (bidiClass === "AN") sawAN = true;
	}
	if (isRtl && sawEN && sawAN) return false;
	return true;
}
// node_modules/typebox/build/format/idna/label/unicode.mjs
function ExceedsMaxALabelLength(value) {
	return RE_NON_ASCII.test(value) && Encode$7(value).length + 4 > 63;
}
function HasInvalidHyphens(chars) {
	if (chars[0] === "-" || chars[chars.length - 1] === "-") return true;
	return chars.slice(2).join("").startsWith("--");
}
function IsUnicodeLabel(value) {
	if (ExceedsMaxALabelLength(value)) return false;
	if (HasRightToLeftCharacters(value) && !SatisfiesBidiRule(value)) return false;
	const chars = [...value];
	const codePoints = chars.map((c) => c.codePointAt(0));
	const length = codePoints.length;
	if (HasInvalidHyphens(chars)) return false;
	if (RE_COMBINING_MARK.test(chars[0])) return false;
	let hasJapanese = false;
	for (let i = 0; i < length; i++) {
		const codePoint = codePoints[i];
		const char = chars[i];
		if (RE_RFC5892_DISALLOWED.test(char)) return false;
		if (!RE_PERMITTED_CATEGORY.test(char)) return false;
		if (RE_SCRIPT_JAPANESE.test(char)) hasJapanese = true;
		const prev = codePoints[i - 1], next = codePoints[i + 1];
		switch (codePoint) {
			case 183:
				if (prev !== 108 || next !== 108) return false;
				break;
			case 885:
				if (!next || !RE_SCRIPT_GREEK.test(chars[i + 1])) return false;
				break;
			case 1523:
			case 1524:
				if (!prev || !RE_SCRIPT_HEBREW.test(chars[i - 1])) return false;
				break;
			case 8204:
				if (!prev || prev < 128 && !RE_VIRAMA.test(chars[i - 1])) return false;
				break;
			case 8205: if (!prev || !RE_VIRAMA.test(chars[i - 1])) return false;
		}
	}
	if (value.includes("・") && !hasJapanese) return false;
	return true;
}
// node_modules/typebox/build/format/idna/label/puny.mjs
function IsPunyLabel(value) {
	if (!IsAcePrefixed(value)) return false;
	try {
		const body = value.slice(4).toLowerCase();
		if (body.lastIndexOf("-") === 0) return false;
		const decoded = Decode$7(body);
		if (!RE_NON_ASCII.test(decoded)) return false;
		return IsUnicodeLabel(decoded);
	} catch {
		return false;
	}
}
// node_modules/typebox/build/format/idna/hostname.mjs
function IsValidLabelLength$1(value) {
	return value.length > 0 && value.length <= 63;
}
function IsLabel$1(value) {
	return IsValidLabelLength$1(value) && (IsPunyLabel(value) || IsAsciiLabel(value));
}
function IsHostname$1(value) {
	if (value.length === 0 || value.length > 253) return false;
	if (value.charCodeAt(value.length - 1) === 46) return false;
	return value.split(".").every((label) => IsLabel$1(label));
}
// node_modules/typebox/build/format/idna/idn-hostname.mjs
function IsValidLabelLength(value) {
	return value.length > 0 && value.length <= 63;
}
function IsLabel(value) {
	return IsValidLabelLength(value) && (IsPunyLabel(value) || IsUnicodeLabel(value));
}
function NormalizeHostname(value) {
	return value.replace(/[\uff01-\uff5e]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 65248)).normalize("NFC").replace(/[\u00ad\u034f\u180b-\u180d\u200b\ufe00-\ufe0f\u{e0100}-\u{e01ef}]/gu, "").replace(/[\u002E\u3002\uFF0E\uFF61]/g, ".");
}
function IsIdnHostname$1(value) {
	if (value.length === 0 || value.includes(" ")) return false;
	const normalized = NormalizeHostname(value);
	if (normalized.length > 253) return false;
	const labels = normalized.split(".");
	const hasBidiChars = labels.some((label) => HasBidiChars(label));
	return labels.every((label) => IsLabel(label) && (!hasBidiChars || SatisfiesBidiRule(label)));
}
// node_modules/typebox/build/format/hostname.mjs
/**
* Returns true if the value is a valid hostname.
* @specification https://tools.ietf.org/html/rfc1123
* @specification https://tools.ietf.org/html/rfc5891
* @specification https://tools.ietf.org/html/rfc5892
*/
function IsHostname(value) {
	return IsHostname$1(value);
}
// node_modules/typebox/build/format/idn_email.mjs
const IdnEmail = /^(?:[A-Za-z0-9!#$%&'*+\/=?^_`{|}~\u{0080}-\u{10FFFF}-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`{|}~\u{0080}-\u{10FFFF}-]+)*|"(?:[^"\\]|\\.)*")@[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,62})(?<!-)(?:\.[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,62})(?<!-))*$/iu;
/**
* Returns true if the value is an IdnEmail
* @specification https://datatracker.ietf.org/doc/html/rfc4952
*/
function IsIdnEmail(value) {
	return IdnEmail.test(value.normalize("NFC"));
}
// node_modules/typebox/build/format/idn_hostname.mjs
/**
* Returns true if the value is a valid internationalized (IDN) hostname.
* @specification https://tools.ietf.org/html/rfc3490
* @specification https://tools.ietf.org/html/rfc5891
* @specification https://tools.ietf.org/html/rfc5892
* @specification https://tools.ietf.org/html/rfc5893
*/
function IsIdnHostname(value) {
	return IsIdnHostname$1(value);
}
// node_modules/typebox/build/format/ipv4.mjs
const IPv4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
/**
* Returns true if the value is a IPV4 address
* @specification http://tools.ietf.org/html/rfc2673#section-3.2
*/
function IsIPv4(value) {
	return IPv4.test(value);
}
// node_modules/typebox/build/format/ipv6.mjs
const IPv6 = /^(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:)?[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)$/i;
/**
* Returns true if the value is an IPv6 address
* @specification http://tools.ietf.org/html/rfc2373#section-2.2
*/
function IsIPv6(value) {
	return IPv6.test(value);
}
// node_modules/typebox/build/format/iri_reference.mjs
const InvalidIriChars$1 = /[\x00-\x20\x7F\\]|%(?![0-9a-fA-F]{2})/;
const MalformedScheme = /^[a-zA-Z][a-zA-Z0-9+\-.]*\/\//;
/**
* Returns true if the value is an IRI reference
* @specification https://tools.ietf.org/html/rfc3987
*/
function IsIriReference(value) {
	return !InvalidIriChars$1.test(value) && !MalformedScheme.test(value) && URL.canParse(value, "http://example.com");
}
// node_modules/typebox/build/format/iri.mjs
const IpvFutureMatchMaxLength = 2048;
const IpvFutureMatch = /\[[vV][0-9a-fA-F]+\.[^\]]+\]/;
const InvalidIriChars = /[\x00-\x20<>\^`{|}\\]/;
const InvalidPercentEncoding = /%(?![0-9a-fA-F]{2})/;
function NarrowIpvFuture(value) {
	return value.length < IpvFutureMatchMaxLength ? value.replace(IpvFutureMatch, "[::1]") : value;
}
/**
* Returns true if the value is a valid Internationalized Resource Identifier.
* @specification https://datatracker.ietf.org/doc/html/rfc3987
*/
function IsIri(value) {
	if (InvalidIriChars.test(value)) return false;
	if (InvalidPercentEncoding.test(value)) return false;
	return URL.canParse(NarrowIpvFuture(value));
}
// node_modules/typebox/build/format/json_pointer_uri_fragment.mjs
const JsonPointerUriFragment = /^#(?:\/(?:[a-z0-9_\-.!$&'()*+,;:=@]|%[0-9a-f]{2}|~0|~1)*)*$/i;
/**
* Returns true if the value is a json pointer uri fragment
* @specification https://datatracker.ietf.org/doc/html/rfc6901
* @source https://github.com/ajv-validator/ajv-formats
*/
function IsJsonPointerUriFragment(value) {
	return JsonPointerUriFragment.test(value);
}
// node_modules/typebox/build/format/json_pointer.mjs
const JsonPointer = /^(?:\/(?:[^~/]|~0|~1)*)*$/;
/**
* Returns true if the value is a json pointer
* @specification https://datatracker.ietf.org/doc/html/rfc6901
* @source https://github.com/ajv-validator/ajv-formats
*/
function IsJsonPointer(value) {
	return JsonPointer.test(value);
}
// node_modules/typebox/build/format/regex.mjs
/**
* Returns true if the value is a regular expression string pattern
* @specification https://ecma-international.org/ecma-262
*/
function IsRegex(value) {
	try {
		new RegExp(value, "u");
		return true;
	} catch {
		return false;
	}
}
// node_modules/typebox/build/format/relative_json_pointer.mjs
const RelativeJsonPointer = /^(?:0|[1-9][0-9]*)(?:#|(?:\/(?:[^~/]|~0|~1)*)*)$/;
/**
* Returns true if the value is a relative json pointer
* @specification https://datatracker.ietf.org/doc/html/rfc6901
* @source https://github.com/ajv-validator/ajv-formats
*/
function IsRelativeJsonPointer(value) {
	return RelativeJsonPointer.test(value);
}
// node_modules/typebox/build/format/uri_reference.mjs
const UriReference = /^(?:[a-z][a-z0-9+\-.]*:(?:\/\/(?:(?:[-a-z0-9._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:[\da-f]{1,4}:){6}(?:[\da-f]{1,4}:[\da-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))|::(?:[\da-f]{1,4}:){5}(?:[\da-f]{1,4}:[\da-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))|(?:[\da-f]{1,4})?::(?:[\da-f]{1,4}:){4}(?:[\da-f]{1,4}:[\da-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))|(?:(?:[\da-f]{1,4}:){0,1}[\da-f]{1,4})?::(?:[\da-f]{1,4}:){3}(?:[\da-f]{1,4}:[\da-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))|(?:(?:[\da-f]{1,4}:){0,2}[\da-f]{1,4})?::(?:[\da-f]{1,4}:){2}(?:[\da-f]{1,4}:[\da-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))|(?:(?:[\da-f]{1,4}:){0,3}[\da-f]{1,4})?::[\da-f]{1,4}:(?:[\da-f]{1,4}:[\da-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))|(?:(?:[\da-f]{1,4}:){0,4}[\da-f]{1,4})?::(?:[\da-f]{1,4}:[\da-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))|(?:(?:[\da-f]{1,4}:){0,5}[\da-f]{1,4})?::[\da-f]{1,4}|(?:(?:[\da-f]{1,4}:){0,6}[\da-f]{1,4})?::)|v[0-9a-f]+\.[-a-z0-9._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)|(?:[-a-z0-9._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[-a-z0-9._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[-a-z0-9._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[-a-z0-9._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[-a-z0-9._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[-a-z0-9._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:\/\/(?:(?:[-a-z0-9._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:[\da-f]{1,4}:){6}(?:[\da-f]{1,4}:[\da-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))|::(?:[\da-f]{1,4}:){5}(?:[\da-f]{1,4}:[\da-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))|(?:[\da-f]{1,4})?::(?:[\da-f]{1,4}:){4}(?:[\da-f]{1,4}:[\da-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))|(?:(?:[\da-f]{1,4}:){0,1}[\da-f]{1,4})?::(?:[\da-f]{1,4}:){3}(?:[\da-f]{1,4}:[\da-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))|(?:(?:[\da-f]{1,4}:){0,2}[\da-f]{1,4})?::(?:[\da-f]{1,4}:){2}(?:[\da-f]{1,4}:[\da-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))|(?:(?:[\da-f]{1,4}:){0,3}[\da-f]{1,4})?::[\da-f]{1,4}:(?:[\da-f]{1,4}:[\da-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))|(?:(?:[\da-f]{1,4}:){0,4}[\da-f]{1,4})?::(?:[\da-f]{1,4}:[\da-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))|(?:(?:[\da-f]{1,4}:){0,5}[\da-f]{1,4})?::[\da-f]{1,4}|(?:(?:[\da-f]{1,4}:){0,6}[\da-f]{1,4})?::)|v[0-9a-f]+\.[-a-z0-9._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)|(?:[-a-z0-9._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[-a-z0-9._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[-a-z0-9._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[-a-z0-9._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[-a-z0-9._~!$&'()*+,;=@]|%[0-9a-f]{2})+(?:\/(?:[-a-z0-9._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?)(?:\?(?:[-a-z0-9._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[-a-z0-9._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
/**
* Returns true if the value is a valid Uri Reference.
* @specification https://tools.ietf.org/html/rfc3986
*/
function IsUriReference(value) {
	return UriReference.test(value);
}
// node_modules/typebox/build/format/uri_template.mjs
const UriTemplate = /^(?:(?:[^\x00-\x20"<>%\\^`{|}\x7f]|%[0-9a-f]{2})|\{[+#./;?&=,!@|]?(?:[a-z0-9_]|%[0-9a-f]{2})+(?:\.(?:[a-z0-9_]|%[0-9a-f]{2})+)*(?::[1-9]\d{0,3}|\*)?(?:,(?:[a-z0-9_]|%[0-9a-f]{2})+(?:\.(?:[a-z0-9_]|%[0-9a-f]{2})+)*(?::[1-9]\d{0,3}|\*)?)*\})*$/i;
/**
* Returns true if the value is a valid Uri Template
* @specification https://datatracker.ietf.org/doc/html/rfc6570
*/
function IsUriTemplate(value) {
	return UriTemplate.test(value);
}
// node_modules/typebox/build/format/uri.mjs
const Uri = /^[a-z][a-z0-9+\-.]*:(?:\/\/(?:(?:[-a-z0-9._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:[\da-f]{1,4}:){6}(?:[\da-f]{1,4}:[\da-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))|::(?:[\da-f]{1,4}:){5}(?:[\da-f]{1,4}:[\da-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))|(?:[\da-f]{1,4})?::(?:[\da-f]{1,4}:){4}(?:[\da-f]{1,4}:[\da-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))|(?:(?:[\da-f]{1,4}:){0,1}[\da-f]{1,4})?::(?:[\da-f]{1,4}:){3}(?:[\da-f]{1,4}:[\da-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))|(?:(?:[\da-f]{1,4}:){0,2}[\da-f]{1,4})?::(?:[\da-f]{1,4}:){2}(?:[\da-f]{1,4}:[\da-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))|(?:(?:[\da-f]{1,4}:){0,3}[\da-f]{1,4})?::[\da-f]{1,4}:(?:[\da-f]{1,4}:[\da-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))|(?:(?:[\da-f]{1,4}:){0,4}[\da-f]{1,4})?::(?:[\da-f]{1,4}:[\da-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))|(?:(?:[\da-f]{1,4}:){0,5}[\da-f]{1,4})?::[\da-f]{1,4}|(?:(?:[\da-f]{1,4}:){0,6}[\da-f]{1,4})?::)|v[0-9a-f]+\.[-a-z0-9._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)|(?:[-a-z0-9._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[-a-z0-9._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[-a-z0-9._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[-a-z0-9._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[-a-z0-9._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[-a-z0-9._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?(?:\?(?:[-a-z0-9._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[-a-z0-9._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
/**
* Returns true if the value is a valid Uniform Resource Identifier.
* @specification https://tools.ietf.org/html/rfc3986
*/
function IsUri(value) {
	return Uri.test(value);
}
// node_modules/typebox/build/format/url.mjs
/**
* Returns true if the value is a valid Uniform Resource Locator
* @specification https://datatracker.ietf.org/doc/html/rfc3986
* @specification https://datatracker.ietf.org/doc/html/rfc3987
*/
function IsUrl(value) {
	return URL.canParse(value);
}
// node_modules/typebox/build/format/uuid.mjs
const Uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
/**
* Returns true if the value is a uuid
* @specification https://www.rfc-editor.org/info/rfc4122/
* @specification https://www.rfc-editor.org/info/rfc9562/
*/
function IsUuid(value) {
	return Uuid.test(value);
}
// node_modules/typebox/build/format/_registry.mjs
const formats = /* @__PURE__ */ new Map();
/** Clears all entries */
function Clear() {
	formats.clear();
}
/** Tests a value against a format, if the format is not registered, true */
function Test(format, value) {
	return formats.get(format)?.(value) ?? true;
}
/** Resets all formats to defaults */
function Reset() {
	Clear();
	formats.set("date-time", IsDateTime);
	formats.set("date", IsDate);
	formats.set("duration", IsDuration);
	formats.set("email", IsEmail);
	formats.set("hostname", IsHostname);
	formats.set("idn-email", IsIdnEmail);
	formats.set("idn-hostname", IsIdnHostname);
	formats.set("ipv4", IsIPv4);
	formats.set("ipv6", IsIPv6);
	formats.set("iri-reference", IsIriReference);
	formats.set("iri", IsIri);
	formats.set("json-pointer-uri-fragment", IsJsonPointerUriFragment);
	formats.set("json-pointer", IsJsonPointer);
	formats.set("regex", IsRegex);
	formats.set("relative-json-pointer", IsRelativeJsonPointer);
	formats.set("time", IsTime);
	formats.set("uri-reference", IsUriReference);
	formats.set("uri-template", IsUriTemplate);
	formats.set("uri", IsUri);
	formats.set("url", IsUrl);
	formats.set("uuid", IsUuid);
}
Reset();
// node_modules/typebox/build/schema/engine/format.mjs
function CheckFormat(_stack, _context, schema, value) {
	return Test(schema.format, value);
}
function ErrorFormat(stack, context, schemaPath, instancePath, schema, value) {
	return CheckFormat(stack, context, schema, value) || context.AddError({
		keyword: "format",
		schemaPath,
		instancePath,
		params: { format: schema.format }
	});
}
// node_modules/typebox/build/schema/engine/if.mjs
function CheckIf(stack, context, schema, value) {
	const thenSchema = IsThen(schema) ? schema.then : true;
	const elseSchema = IsElse(schema) ? schema.else : true;
	return CheckSchema(stack, context, schema.if, value) ? CheckSchema(stack, context, thenSchema, value) : CheckSchema(stack, context, elseSchema, value);
}
function ErrorIf(stack, context, schemaPath, instancePath, schema, value) {
	const thenSchema = IsThen(schema) ? schema.then : true;
	const elseSchema = IsElse(schema) ? schema.else : true;
	const trueContext = new ErrorContext();
	const isIf = ErrorSchema(stack, trueContext, `${schemaPath}/if`, instancePath, schema.if, value) ? ErrorSchema(stack, trueContext, `${schemaPath}/then`, instancePath, thenSchema, value) || context.AddError({
		keyword: "if",
		schemaPath,
		instancePath,
		params: { failingKeyword: "then" }
	}) : ErrorSchema(stack, context, `${schemaPath}/else`, instancePath, elseSchema, value) || context.AddError({
		keyword: "if",
		schemaPath,
		instancePath,
		params: { failingKeyword: "else" }
	});
	if (isIf) context.Merge([trueContext]);
	return isIf;
}
// node_modules/typebox/build/schema/engine/items.mjs
function CheckItemsSized(stack, context, schema, value) {
	return Every(schema.items, 0, (schema, index) => {
		return IsLessEqualThan(value.length, index) || CheckSchemaPushStack(stack, context, schema, value[index]) && context.AddIndex(index);
	});
}
function ErrorItemsSized(stack, context, schemaPath, instancePath, schema, value) {
	return EveryAll(schema.items, 0, (schema, index) => {
		const nextSchemaPath = `${schemaPath}/items/${index}`;
		const nextInstancePath = `${instancePath}/${index}`;
		return IsLessEqualThan(value.length, index) || ErrorSchemaPushStack(stack, context, nextSchemaPath, nextInstancePath, schema, value[index]) && context.AddIndex(index);
	});
}
function CheckItemsUnsized(stack, context, schema, value) {
	return Every(value, IsPrefixItems(schema) ? schema.prefixItems.length : 0, (element, index) => {
		return CheckSchemaPushStack(stack, context, schema.items, element) && context.AddIndex(index);
	});
}
function ErrorItemsUnsized(stack, context, schemaPath, instancePath, schema, value) {
	return EveryAll(value, IsPrefixItems(schema) ? schema.prefixItems.length : 0, (element, index) => {
		return ErrorSchemaPushStack(stack, context, `${schemaPath}/items`, `${instancePath}/${index}`, schema.items, element) && context.AddIndex(index);
	});
}
function CheckItems(stack, context, schema, value) {
	return IsItemsSized(schema) ? CheckItemsSized(stack, context, schema, value) : CheckItemsUnsized(stack, context, schema, value);
}
function ErrorItems(stack, context, schemaPath, instancePath, schema, value) {
	return IsItemsSized(schema) ? ErrorItemsSized(stack, context, schemaPath, instancePath, schema, value) : ErrorItemsUnsized(stack, context, schemaPath, instancePath, schema, value);
}
// node_modules/typebox/build/schema/engine/maxContains.mjs
function IsValid$2(schema) {
	return IsContains(schema);
}
function CheckMaxContains(stack, context, schema, value) {
	if (!IsValid$2(schema)) return true;
	return IsLessEqualThan(Counted(value, (item) => CheckSchema(stack, context, schema.contains, item)), schema.maxContains);
}
function ErrorMaxContains(stack, context, schemaPath, instancePath, schema, value) {
	const minContains = IsMinContains(schema) ? schema.minContains : 1;
	return CheckMaxContains(stack, context, schema, value) || context.AddError({
		keyword: "contains",
		schemaPath,
		instancePath,
		params: {
			minContains,
			maxContains: schema.maxContains
		}
	});
}
// node_modules/typebox/build/schema/engine/maximum.mjs
function CheckMaximum(_stack, _context, schema, value) {
	return IsLessEqualThan(value, schema.maximum);
}
function ErrorMaximum(stack, context, schemaPath, instancePath, schema, value) {
	return CheckMaximum(stack, context, schema, value) || context.AddError({
		keyword: "maximum",
		schemaPath,
		instancePath,
		params: {
			comparison: "<=",
			limit: schema.maximum
		}
	});
}
// node_modules/typebox/build/schema/engine/maxItems.mjs
function CheckMaxItems(_stack, _context, schema, value) {
	return IsLessEqualThan(value.length, schema.maxItems);
}
function ErrorMaxItems(stack, context, schemaPath, instancePath, schema, value) {
	return CheckMaxItems(stack, context, schema, value) || context.AddError({
		keyword: "maxItems",
		schemaPath,
		instancePath,
		params: { limit: schema.maxItems }
	});
}
// node_modules/typebox/build/schema/engine/maxLength.mjs
function CheckMaxLength(_stack, _context, schema, value) {
	return IsMaxLength$1(value, schema.maxLength);
}
function ErrorMaxLength(stack, context, schemaPath, instancePath, schema, value) {
	return CheckMaxLength(stack, context, schema, value) || context.AddError({
		keyword: "maxLength",
		schemaPath,
		instancePath,
		params: { limit: schema.maxLength }
	});
}
// node_modules/typebox/build/schema/engine/maxProperties.mjs
function CheckMaxProperties(_stack, _context, schema, value) {
	return IsLessEqualThan(Keys(value).length, schema.maxProperties);
}
function ErrorMaxProperties(stack, context, schemaPath, instancePath, schema, value) {
	return CheckMaxProperties(stack, context, schema, value) || context.AddError({
		keyword: "maxProperties",
		schemaPath,
		instancePath,
		params: { limit: schema.maxProperties }
	});
}
// node_modules/typebox/build/schema/engine/minContains.mjs
function IsValid$1(schema) {
	return IsContains(schema);
}
function CheckMinContains(stack, context, schema, value) {
	if (!IsValid$1(schema)) return true;
	return IsGreaterEqualThan(Counted(value, (item, index) => CheckSchema(stack, context, schema.contains, item) && context.AddIndex(index)), schema.minContains);
}
function ErrorMinContains(stack, context, schemaPath, instancePath, schema, value) {
	return CheckMinContains(stack, context, schema, value) || context.AddError({
		keyword: "contains",
		schemaPath,
		instancePath,
		params: { minContains: schema.minContains }
	});
}
// node_modules/typebox/build/schema/engine/minimum.mjs
function CheckMinimum(_stack, _context, schema, value) {
	return IsGreaterEqualThan(value, schema.minimum);
}
function ErrorMinimum(stack, context, schemaPath, instancePath, schema, value) {
	return CheckMinimum(stack, context, schema, value) || context.AddError({
		keyword: "minimum",
		schemaPath,
		instancePath,
		params: {
			comparison: ">=",
			limit: schema.minimum
		}
	});
}
// node_modules/typebox/build/schema/engine/minItems.mjs
function CheckMinItems(_stack, _context, schema, value) {
	return IsGreaterEqualThan(value.length, schema.minItems);
}
function ErrorMinItems(stack, context, schemaPath, instancePath, schema, value) {
	return CheckMinItems(stack, context, schema, value) || context.AddError({
		keyword: "minItems",
		schemaPath,
		instancePath,
		params: { limit: schema.minItems }
	});
}
// node_modules/typebox/build/schema/engine/minLength.mjs
function CheckMinLength(_stack, _context, schema, value) {
	return IsMinLength$1(value, schema.minLength);
}
function ErrorMinLength(stack, context, schemaPath, instancePath, schema, value) {
	return CheckMinLength(stack, context, schema, value) || context.AddError({
		keyword: "minLength",
		schemaPath,
		instancePath,
		params: { limit: schema.minLength }
	});
}
// node_modules/typebox/build/schema/engine/minProperties.mjs
function CheckMinProperties(_stack, _context, schema, value) {
	return IsGreaterEqualThan(Keys(value).length, schema.minProperties);
}
function ErrorMinProperties(stack, context, schemaPath, instancePath, schema, value) {
	return CheckMinProperties(stack, context, schema, value) || context.AddError({
		keyword: "minProperties",
		schemaPath,
		instancePath,
		params: { limit: schema.minProperties }
	});
}
// node_modules/typebox/build/schema/engine/multipleOf.mjs
function CheckMultipleOf(_stack, _context, schema, value) {
	return IsMultipleOf$1(value, schema.multipleOf);
}
function ErrorMultipleOf(stack, context, schemaPath, instancePath, schema, value) {
	return CheckMultipleOf(stack, context, schema, value) || context.AddError({
		keyword: "multipleOf",
		schemaPath,
		instancePath,
		params: { multipleOf: schema.multipleOf }
	});
}
// node_modules/typebox/build/schema/engine/not.mjs
function CheckNot(stack, context, schema, value) {
	const nextContext = new CheckContext();
	return !CheckSchema(stack, nextContext, schema.not, value) && context.Merge([nextContext]);
}
function ErrorNot(stack, context, schemaPath, instancePath, schema, value) {
	return CheckNot(stack, context, schema, value) || context.AddError({
		keyword: "not",
		schemaPath,
		instancePath,
		params: {}
	});
}
// node_modules/typebox/build/schema/engine/oneOf.mjs
function CheckOneOf(stack, context, schema, value) {
	const passedContexts = schema.oneOf.reduce((result, schema) => {
		const nextContext = new CheckContext();
		return CheckSchema(stack, nextContext, schema, value) ? [...result, nextContext] : result;
	}, []);
	return IsEqual(passedContexts.length, 1) && context.Merge(passedContexts);
}
function ErrorOneOf(stack, context, schemaPath, instancePath, schema, value) {
	const failedContexts = [];
	const passingSchemas = [];
	const passedContexts = schema.oneOf.reduce((result, schema, index) => {
		const nextContext = new ErrorContext();
		const isSchema = ErrorSchema(stack, nextContext, `${schemaPath}/oneOf/${index}`, instancePath, schema, value);
		if (isSchema) passingSchemas.push(index);
		if (!isSchema) failedContexts.push(nextContext);
		return isSchema ? [...result, nextContext] : result;
	}, []);
	const isOneOf = IsEqual(passedContexts.length, 1) && context.Merge(passedContexts);
	if (!isOneOf && IsEqual(passingSchemas.length, 0)) failedContexts.forEach((failed) => failed.GetErrors().forEach((error) => context.AddError(error)));
	return isOneOf || context.AddError({
		keyword: "oneOf",
		schemaPath,
		instancePath,
		params: { passingSchemas }
	});
}
// node_modules/typebox/build/schema/engine/pattern.mjs
function CheckPattern(_stack, _context, schema, value) {
	return (IsString$2(schema.pattern) ? UnicodeRegExp(schema.pattern) : schema.pattern).test(value);
}
function ErrorPattern(stack, context, schemaPath, instancePath, schema, value) {
	return CheckPattern(stack, context, schema, value) || context.AddError({
		keyword: "pattern",
		schemaPath,
		instancePath,
		params: { pattern: schema.pattern }
	});
}
// node_modules/typebox/build/schema/engine/patternProperties.mjs
function CheckPatternProperties(stack, context, schema, value) {
	return Every(Entries(schema.patternProperties), 0, ([pattern, schema]) => {
		const regexp = UnicodeRegExp(pattern);
		return Every(Entries(value), 0, ([key, prop]) => {
			return !regexp.test(key) || CheckSchemaPushStack(stack, context, schema, prop) && context.AddKey(key);
		});
	});
}
function ErrorPatternProperties(stack, context, schemaPath, instancePath, schema, value) {
	return EveryAll(Entries(schema.patternProperties), 0, ([pattern, schema]) => {
		const nextSchemaPath = `${schemaPath}/patternProperties/${pattern}`;
		const regexp = UnicodeRegExp(pattern);
		return EveryAll(Entries(value), 0, ([key, value]) => {
			const nextInstancePath = `${instancePath}/${key}`;
			return !regexp.test(key) || ErrorSchemaPushStack(stack, context, nextSchemaPath, nextInstancePath, schema, value) && context.AddKey(key);
		});
	});
}
// node_modules/typebox/build/schema/engine/prefixItems.mjs
function CheckPrefixItems(stack, context, schema, value) {
	return IsEqual(value.length, 0) || Every(schema.prefixItems, 0, (schema, index) => {
		return IsLessEqualThan(value.length, index) || CheckSchemaPushStack(stack, context, schema, value[index]) && context.AddIndex(index);
	});
}
function ErrorPrefixItems(stack, context, schemaPath, instancePath, schema, value) {
	return IsEqual(value.length, 0) || EveryAll(schema.prefixItems, 0, (schema, index) => {
		const nextSchemaPath = `${schemaPath}/prefixItems/${index}`;
		const nextInstancePath = `${instancePath}/${index}`;
		return IsLessEqualThan(value.length, index) || ErrorSchemaPushStack(stack, context, nextSchemaPath, nextInstancePath, schema, value[index]) && context.AddIndex(index);
	});
}
// node_modules/typebox/build/schema/engine/_exact_optional.mjs
function IsExactOptional(required, key) {
	return required.includes(key) || Get$2().exactOptionalPropertyTypes;
}
function InexactOptionalCheck(value, key) {
	return IsUndefined$1(value[key]);
}
// node_modules/typebox/build/schema/engine/properties.mjs
function CheckProperties(stack, context, schema, value) {
	const required = IsRequired(schema) ? schema.required : [];
	return Every(Entries(schema.properties), 0, ([key, schema]) => {
		const isProperty = !HasPropertyKey(value, key) || CheckSchemaPushStack(stack, context, schema, value[key]) && context.AddKey(key);
		return IsExactOptional(required, key) ? isProperty : InexactOptionalCheck(value, key) || isProperty;
	});
}
function ErrorProperties(stack, context, schemaPath, instancePath, schema, value) {
	const required = IsRequired(schema) ? schema.required : [];
	return EveryAll(Entries(schema.properties), 0, ([key, schema]) => {
		const nextSchemaPath = `${schemaPath}/properties/${key}`;
		const nextInstancePath = `${instancePath}/${key}`;
		const isProperty = () => !HasPropertyKey(value, key) || ErrorSchemaPushStack(stack, context, nextSchemaPath, nextInstancePath, schema, value[key]) && context.AddKey(key);
		return IsExactOptional(required, key) ? isProperty() : InexactOptionalCheck(value, key) || isProperty();
	});
}
// node_modules/typebox/build/schema/engine/propertyNames.mjs
function CheckPropertyNames(stack, context, schema, value) {
	return Every(Keys(value), 0, (key, _index) => CheckSchema(stack, context, schema.propertyNames, key));
}
function ErrorPropertyNames(stack, context, schemaPath, instancePath, schema, value) {
	const propertyNames = [];
	return EveryAll(Keys(value), 0, (key, _index) => {
		const nextInstancePath = `${instancePath}/${key}`;
		const isPropertyName = ErrorSchema(stack, context, `${schemaPath}/propertyNames`, nextInstancePath, schema.propertyNames, key);
		if (!isPropertyName) propertyNames.push(key);
		return isPropertyName;
	}) || context.AddError({
		keyword: "propertyNames",
		schemaPath,
		instancePath,
		params: { propertyNames }
	});
}
// node_modules/typebox/build/schema/engine/recursiveRef.mjs
function CheckRecursiveRef(stack, context, schema, value) {
	const target = stack.RecursiveRef(schema) ?? false;
	return IsSchema(target) && CheckSchema(stack, context, target, value);
}
function ErrorRecursiveRef(stack, context, _schemaPath, instancePath, schema, value) {
	const target = stack.RecursiveRef(schema) ?? false;
	return IsSchema(target) && ErrorSchema(stack, context, "#", instancePath, target, value);
}
// node_modules/typebox/build/schema/engine/ref.mjs
function CheckRef(stack, context, schema, value) {
	const target = stack.Ref(schema) ?? false;
	const nextContext = new CheckContext();
	const result = IsSchema(target) && CheckSchema(stack, nextContext, target, value);
	if (result) context.Merge([nextContext]);
	return result;
}
function ErrorRef(stack, context, _schemaPath, instancePath, schema, value) {
	const target = stack.Ref(schema) ?? false;
	const nextContext = new ErrorContext();
	const result = IsSchema(target) && ErrorSchema(stack, nextContext, "#", instancePath, target, value);
	if (result) context.Merge([nextContext]);
	if (!result) nextContext.GetErrors().forEach((error) => context.AddError(error));
	return result;
}
// node_modules/typebox/build/schema/engine/required.mjs
function CheckRequired(_stack, _context, schema, value) {
	return Every(schema.required, 0, (key) => HasPropertyKey(value, key));
}
function ErrorRequired(_stack, context, schemaPath, instancePath, schema, value) {
	const requiredProperties = [];
	return EveryAll(schema.required, 0, (key) => {
		const hasKey = HasPropertyKey(value, key);
		if (!hasKey) requiredProperties.push(key);
		return hasKey;
	}) || context.AddError({
		keyword: "required",
		schemaPath,
		instancePath,
		params: { requiredProperties }
	});
}
// node_modules/typebox/build/schema/engine/type.mjs
function CheckTypeName(_stack, _context, type, _schema, value) {
	return IsEqual(type, "object") ? IsObjectNotArray(value) : IsEqual(type, "array") ? IsArray$1(value) : IsEqual(type, "boolean") ? IsBoolean$2(value) : IsEqual(type, "integer") ? IsInteger$1(value) : IsEqual(type, "number") ? IsNumber$2(value) : IsEqual(type, "null") ? IsNull$1(value) : IsEqual(type, "string") ? IsString$2(value) : IsEqual(type, "bigint") ? IsBigInt$1(value) : IsEqual(type, "constructor") ? IsConstructor$1(value) : IsEqual(type, "function") ? IsFunction$1(value) : IsEqual(type, "symbol") ? IsSymbol$1(value) : IsEqual(type, "undefined") ? IsUndefined$1(value) : IsEqual(type, "void") ? IsUndefined$1(value) : true;
}
function CheckTypeNames(stack, context, types, schema, value) {
	return Some(types, (type) => CheckTypeName(stack, context, type, schema, value));
}
function CheckType(stack, context, schema, value) {
	return IsArray$1(schema.type) ? CheckTypeNames(stack, context, schema.type, schema, value) : CheckTypeName(stack, context, schema.type, schema, value);
}
function ErrorType(stack, context, schemaPath, instancePath, schema, value) {
	return (IsArray$1(schema.type) ? CheckTypeNames(stack, context, schema.type, schema, value) : CheckTypeName(stack, context, schema.type, schema, value)) || context.AddError({
		keyword: "type",
		schemaPath,
		instancePath,
		params: { type: schema.type }
	});
}
// node_modules/typebox/build/schema/engine/unevaluatedItems.mjs
function CheckUnevaluatedItems(stack, context, schema, value) {
	const indices = context.GetIndices();
	return Every(value, 0, (item, index) => {
		return (indices.has(index) || CheckSchema(stack, context, schema.unevaluatedItems, item)) && context.AddIndex(index);
	});
}
function ErrorUnevaluatedItems(stack, context, schemaPath, instancePath, schema, value) {
	const indices = context.GetIndices();
	const unevaluatedItems = [];
	return EveryAll(value, 0, (item, index) => {
		const nextContext = new ErrorContext();
		const isEvaluatedItem = (indices.has(index) || ErrorSchema(stack, nextContext, schemaPath, instancePath, schema.unevaluatedItems, item)) && context.AddIndex(index);
		if (!isEvaluatedItem) unevaluatedItems.push(index);
		return isEvaluatedItem;
	}) || context.AddError({
		keyword: "unevaluatedItems",
		schemaPath,
		instancePath,
		params: { unevaluatedItems }
	});
}
// node_modules/typebox/build/schema/engine/unevaluatedProperties.mjs
function CheckUnevaluatedProperties(stack, context, schema, value) {
	const keys = context.GetKeys();
	return Every(Entries(value), 0, ([key, prop]) => {
		return keys.has(key) || CheckSchema(stack, context, schema.unevaluatedProperties, prop) && context.AddKey(key);
	});
}
function ErrorUnevaluatedProperties(stack, context, schemaPath, instancePath, schema, value) {
	const keys = context.GetKeys();
	const unevaluatedProperties = [];
	return EveryAll(Entries(value), 0, ([key, prop]) => {
		const nextContext = new ErrorContext();
		const isEvaluatedProperty = keys.has(key) || ErrorSchema(stack, nextContext, schemaPath, instancePath, schema.unevaluatedProperties, prop) && context.AddKey(key);
		if (!isEvaluatedProperty) unevaluatedProperties.push(key);
		return isEvaluatedProperty;
	}) || context.AddError({
		keyword: "unevaluatedProperties",
		schemaPath,
		instancePath,
		params: { unevaluatedProperties }
	});
}
// node_modules/typebox/build/schema/engine/uniqueItems.mjs
function IsValid(schema) {
	return !IsEqual(schema.uniqueItems, false);
}
function CheckUniqueItems(_stack, _context, schema, value) {
	if (!IsValid(schema)) return true;
	const set = new Set(value.map(Hash)).size;
	const isLength = value.length;
	return IsEqual(set, isLength);
}
function ErrorUniqueItems(_stack, context, schemaPath, instancePath, schema, value) {
	if (!IsValid(schema)) return true;
	const set = /* @__PURE__ */ new Set();
	const duplicateItems = value.reduce((result, value, index) => {
		const hash = Hash(value);
		if (set.has(hash)) return [...result, index];
		set.add(hash);
		return result;
	}, []);
	return IsEqual(duplicateItems.length, 0) || context.AddError({
		keyword: "uniqueItems",
		schemaPath,
		instancePath,
		params: { duplicateItems }
	});
}
// node_modules/typebox/build/schema/engine/schema.mjs
function CheckSchemaPushStack(stack, context, schema, value) {
	return context.Push() && CheckSchema(stack, context, schema, value) && context.Pop();
}
function CheckSchema(stack, context, schema, value) {
	stack.Push(schema);
	const result = IsSchemaBoolean(schema) ? CheckSchemaBoolean(stack, context, schema, value) : (!IsType(schema) || CheckType(stack, context, schema, value)) && (!(IsObject$1(value) && !IsArray$1(value)) || (!IsRequired(schema) || CheckRequired(stack, context, schema, value)) && (!IsAdditionalProperties(schema) || CheckAdditionalProperties(stack, context, schema, value)) && (!IsDependencies(schema) || CheckDependencies(stack, context, schema, value)) && (!IsDependentRequired(schema) || CheckDependentRequired(stack, context, schema, value)) && (!IsDependentSchemas(schema) || CheckDependentSchemas(stack, context, schema, value)) && (!IsPatternProperties(schema) || CheckPatternProperties(stack, context, schema, value)) && (!IsProperties(schema) || CheckProperties(stack, context, schema, value)) && (!IsPropertyNames(schema) || CheckPropertyNames(stack, context, schema, value)) && (!IsMinProperties(schema) || CheckMinProperties(stack, context, schema, value)) && (!IsMaxProperties(schema) || CheckMaxProperties(stack, context, schema, value))) && (!IsArray$1(value) || (!IsAdditionalItems(schema) || CheckAdditionalItems(stack, context, schema, value)) && (!IsContains(schema) || CheckContains(stack, context, schema, value)) && (!IsItems(schema) || CheckItems(stack, context, schema, value)) && (!IsMaxContains(schema) || CheckMaxContains(stack, context, schema, value)) && (!IsMaxItems(schema) || CheckMaxItems(stack, context, schema, value)) && (!IsMinContains(schema) || CheckMinContains(stack, context, schema, value)) && (!IsMinItems(schema) || CheckMinItems(stack, context, schema, value)) && (!IsPrefixItems(schema) || CheckPrefixItems(stack, context, schema, value)) && (!IsUniqueItems(schema) || CheckUniqueItems(stack, context, schema, value))) && (!IsString$2(value) || (!IsMaxLength(schema) || CheckMaxLength(stack, context, schema, value)) && (!IsMinLength(schema) || CheckMinLength(stack, context, schema, value)) && (!IsFormat(schema) || CheckFormat(stack, context, schema, value)) && (!IsPattern(schema) || CheckPattern(stack, context, schema, value))) && (!(IsNumber$2(value) || IsBigInt$1(value)) || (!IsExclusiveMaximum(schema) || CheckExclusiveMaximum(stack, context, schema, value)) && (!IsExclusiveMinimum(schema) || CheckExclusiveMinimum(stack, context, schema, value)) && (!IsMaximum(schema) || CheckMaximum(stack, context, schema, value)) && (!IsMinimum(schema) || CheckMinimum(stack, context, schema, value)) && (!IsMultipleOf(schema) || CheckMultipleOf(stack, context, schema, value))) && (!IsRef(schema) || CheckRef(stack, context, schema, value)) && (!IsRecursiveRef(schema) || CheckRecursiveRef(stack, context, schema, value)) && (!IsDynamicRef(schema) || CheckDynamicRef(stack, context, schema, value)) && (!IsConst(schema) || CheckConst(stack, context, schema, value)) && (!IsEnum(schema) || CheckEnum(stack, context, schema, value)) && (!IsIf(schema) || CheckIf(stack, context, schema, value)) && (!IsNot(schema) || CheckNot(stack, context, schema, value)) && (!IsAllOf(schema) || CheckAllOf(stack, context, schema, value)) && (!IsAnyOf(schema) || CheckAnyOf(stack, context, schema, value)) && (!IsOneOf(schema) || CheckOneOf(stack, context, schema, value)) && (!IsUnevaluatedItems(schema) || !IsArray$1(value) || CheckUnevaluatedItems(stack, context, schema, value)) && (!IsUnevaluatedProperties(schema) || !IsObject$1(value) || CheckUnevaluatedProperties(stack, context, schema, value)) && (!IsRefine(schema) || CheckRefine(stack, context, schema, value));
	stack.Pop(schema);
	return result;
}
function ErrorSchemaPushStack(stack, context, schemaPath, instancePath, schema, value) {
	return context.Push() && ErrorSchema(stack, context, schemaPath, instancePath, schema, value) && context.Pop();
}
function ErrorSchema(stack, context, schemaPath, instancePath, schema, value) {
	if (context.AtCapacity()) return false;
	stack.Push(schema);
	const result = IsSchemaBoolean(schema) ? ErrorSchemaBoolean(stack, context, schemaPath, instancePath, schema, value) : !!(+(!IsType(schema) || ErrorType(stack, context, schemaPath, instancePath, schema, value)) & +(!(IsObject$1(value) && !IsArray$1(value)) || !!(+(!IsRequired(schema) || ErrorRequired(stack, context, schemaPath, instancePath, schema, value)) & +(!IsAdditionalProperties(schema) || ErrorAdditionalProperties(stack, context, schemaPath, instancePath, schema, value)) & +(!IsDependencies(schema) || ErrorDependencies(stack, context, schemaPath, instancePath, schema, value)) & +(!IsDependentRequired(schema) || ErrorDependentRequired(stack, context, schemaPath, instancePath, schema, value)) & +(!IsDependentSchemas(schema) || ErrorDependentSchemas(stack, context, schemaPath, instancePath, schema, value)) & +(!IsPatternProperties(schema) || ErrorPatternProperties(stack, context, schemaPath, instancePath, schema, value)) & +(!IsProperties(schema) || ErrorProperties(stack, context, schemaPath, instancePath, schema, value)) & +(!IsPropertyNames(schema) || ErrorPropertyNames(stack, context, schemaPath, instancePath, schema, value)) & +(!IsMinProperties(schema) || ErrorMinProperties(stack, context, schemaPath, instancePath, schema, value)) & +(!IsMaxProperties(schema) || ErrorMaxProperties(stack, context, schemaPath, instancePath, schema, value)))) & +(!IsArray$1(value) || !!(+(!IsAdditionalItems(schema) || ErrorAdditionalItems(stack, context, schemaPath, instancePath, schema, value)) & +(!IsContains(schema) || ErrorContains(stack, context, schemaPath, instancePath, schema, value)) & +(!IsItems(schema) || ErrorItems(stack, context, schemaPath, instancePath, schema, value)) & +(!IsMaxContains(schema) || ErrorMaxContains(stack, context, schemaPath, instancePath, schema, value)) & +(!IsMaxItems(schema) || ErrorMaxItems(stack, context, schemaPath, instancePath, schema, value)) & +(!IsMinContains(schema) || ErrorMinContains(stack, context, schemaPath, instancePath, schema, value)) & +(!IsMinItems(schema) || ErrorMinItems(stack, context, schemaPath, instancePath, schema, value)) & +(!IsPrefixItems(schema) || ErrorPrefixItems(stack, context, schemaPath, instancePath, schema, value)) & +(!IsUniqueItems(schema) || ErrorUniqueItems(stack, context, schemaPath, instancePath, schema, value)))) & +(!IsString$2(value) || !!(+(!IsMaxLength(schema) || ErrorMaxLength(stack, context, schemaPath, instancePath, schema, value)) & +(!IsMinLength(schema) || ErrorMinLength(stack, context, schemaPath, instancePath, schema, value)) & +(!IsFormat(schema) || ErrorFormat(stack, context, schemaPath, instancePath, schema, value)) & +(!IsPattern(schema) || ErrorPattern(stack, context, schemaPath, instancePath, schema, value)))) & +(!(IsNumber$2(value) || IsBigInt$1(value)) || !!(+(!IsExclusiveMaximum(schema) || ErrorExclusiveMaximum(stack, context, schemaPath, instancePath, schema, value)) & +(!IsExclusiveMinimum(schema) || ErrorExclusiveMinimum(stack, context, schemaPath, instancePath, schema, value)) & +(!IsMaximum(schema) || ErrorMaximum(stack, context, schemaPath, instancePath, schema, value)) & +(!IsMinimum(schema) || ErrorMinimum(stack, context, schemaPath, instancePath, schema, value)) & +(!IsMultipleOf(schema) || ErrorMultipleOf(stack, context, schemaPath, instancePath, schema, value)))) & +(!IsRef(schema) || ErrorRef(stack, context, schemaPath, instancePath, schema, value)) & +(!IsRecursiveRef(schema) || ErrorRecursiveRef(stack, context, schemaPath, instancePath, schema, value)) & +(!IsDynamicRef(schema) || ErrorDynamicRef(stack, context, schemaPath, instancePath, schema, value)) & +(!IsConst(schema) || ErrorConst(stack, context, schemaPath, instancePath, schema, value)) & +(!IsEnum(schema) || ErrorEnum(stack, context, schemaPath, instancePath, schema, value)) & +(!IsIf(schema) || ErrorIf(stack, context, schemaPath, instancePath, schema, value)) & +(!IsNot(schema) || ErrorNot(stack, context, schemaPath, instancePath, schema, value)) & +(!IsAllOf(schema) || ErrorAllOf(stack, context, schemaPath, instancePath, schema, value)) & +(!IsAnyOf(schema) || ErrorAnyOf(stack, context, schemaPath, instancePath, schema, value)) & +(!IsOneOf(schema) || ErrorOneOf(stack, context, schemaPath, instancePath, schema, value)) & +(!IsUnevaluatedItems(schema) || !IsArray$1(value) || ErrorUnevaluatedItems(stack, context, schemaPath, instancePath, schema, value)) & +(!IsUnevaluatedProperties(schema) || !IsObject$1(value) || ErrorUnevaluatedProperties(stack, context, schemaPath, instancePath, schema, value))) && (!IsRefine(schema) || ErrorRefine(stack, context, schemaPath, instancePath, schema, value));
	stack.Pop(schema);
	return result;
}
// node_modules/typebox/build/schema/pointer/pointer.mjs
function GetIndex(index, value) {
	return IsObject$1(value) && !IsUnsafePropertyKey(index) ? value[index] : void 0;
}
function GetIndices(indices, value) {
	return indices.reduce((value, index) => GetIndex(index, value), value);
}
/** Returns an array of path indices for the given pointer */
function Indices(pointer) {
	if (IsEqual(pointer.length, 0)) return [];
	const indices = pointer.split("/").map((index) => index.replace(/~1/g, "/").replace(/~0/g, "~"));
	return indices.length > 0 && indices[0] === "" ? indices.slice(1) : indices;
}
/** Gets a value at the pointer, or undefined if not exists */
function Get(value, pointer) {
	return GetIndices(Indices(pointer), value);
}
// node_modules/typebox/build/schema/resolve/resolve.mjs
const DefaultBase = "https://json-schema.org";
function FindDynamicAnchor(schema, name) {
	if (IsObject$1(schema) && IsDynamicAnchor(schema) && IsEqual(schema.$dynamicAnchor, name)) return schema;
	if (IsObject$1(schema)) for (const key of Keys(schema)) {
		const result = FindDynamicAnchor(schema[key], name);
		if (result) return result;
	}
}
function FindBase(schema, base, target) {
	if (IsEqual(schema, target)) return base.href;
	const nextBase = IsSchemaObject(schema) && IsId(schema) ? new URL(schema.$id, base.href) : base;
	if (IsArray$1(schema)) for (const item of schema) {
		const result = FindBase(item, nextBase, target);
		if (!IsUndefined$1(result)) return result;
	}
	else if (IsObject$1(schema)) for (const key of Keys(schema)) {
		const result = FindBase(schema[key], nextBase, target);
		if (!IsUndefined$1(result)) return result;
	}
}
function MatchId(schema, base, ref) {
	if (IsEqual(schema.$id, ref.hash)) return schema;
	const absoluteRef = new URL(ref.href, base.href);
	if (IsEqual(base.pathname, absoluteRef.pathname)) return ref.hash.startsWith("#") ? MatchHash(schema, ref) : schema;
}
function MatchAnchor(schema, base, ref) {
	const absoluteAnchor = new URL(`#${schema.$anchor}`, base.href);
	const absoluteRef = new URL(ref.href, base.href);
	return IsEqual(absoluteAnchor.href, absoluteRef.href) ? schema : void 0;
}
function MatchDynamicAnchor(schema, base, ref) {
	const absoluteAnchor = new URL(`#${schema.$dynamicAnchor}`, base.href);
	const absoluteRef = new URL(ref.href, base.href);
	return IsEqual(absoluteAnchor.href, absoluteRef.href) ? schema : void 0;
}
function MatchHash(schema, ref) {
	if (ref.href.endsWith("#")) return schema;
	if (!ref.hash.startsWith("#")) return void 0;
	const fragment = decodeURIComponent(ref.hash.slice(1));
	if (!fragment.startsWith("/")) return void 0;
	return Get(schema, fragment);
}
function Match(schema, base, ref) {
	if (IsId(schema)) {
		const result = MatchId(schema, base, ref);
		if (!IsUndefined$1(result)) return result;
	}
	if (IsAnchor(schema)) {
		const result = MatchAnchor(schema, base, ref);
		if (!IsUndefined$1(result)) return result;
	}
	if (IsDynamicAnchor(schema)) {
		const result = MatchDynamicAnchor(schema, base, ref);
		if (!IsUndefined$1(result)) return result;
	}
	return MatchHash(schema, ref);
}
function FromArray$4(schema, base, ref) {
	return schema.reduce((result, item) => {
		const match = FromValue(item, base, ref);
		return !IsUndefined$1(match) ? match : result;
	}, void 0);
}
function SkipProperty(key) {
	return IsEqual(key, "const") || IsEqual(key, "enum");
}
function FromObject$4(schema, base, ref) {
	return Keys(schema).reduce((result, key) => {
		if (SkipProperty(key)) return result;
		const match = FromValue(schema[key], base, ref);
		return !IsUndefined$1(match) ? match : result;
	}, void 0);
}
function FromValue(schema, base, ref) {
	const nextBase = IsSchemaObject(schema) && IsId(schema) ? new URL(schema.$id, base.href) : base;
	if (IsSchemaObject(schema)) {
		const result = Match(schema, nextBase, ref);
		if (!IsUndefined$1(result)) return result;
	}
	if (IsArray$1(schema)) return FromArray$4(schema, nextBase, ref);
	if (IsObject$1(schema)) return FromObject$4(schema, nextBase, ref);
}
function Base(schema, base, target) {
	return FindBase(schema, new URL(base || ".", DefaultBase), target);
}
function Resource(context, schema, base, ref) {
	const result = Ref(context, schema, base, ref, false);
	return IsSchemaObject(result) && IsId(result) ? result : void 0;
}
function CanonicalHref(url) {
	return url.href.split("#")[0];
}
function RefContext(context, ref) {
	return HasPropertyKey(context, ref) ? context[ref] : void 0;
}
function RefLocal(schema, base, ref) {
	return FromValue(schema, base, ref);
}
function RefRemote(context, base, ref) {
	const canonicalHref = CanonicalHref(ref);
	if (IsEqual(canonicalHref, CanonicalHref(base))) return void 0;
	if (!HasPropertyKey(context, canonicalHref)) return void 0;
	const remoteSchema = context[canonicalHref];
	const remoteBase = IsSchemaObject(remoteSchema) && IsId(remoteSchema) ? new URL(remoteSchema.$id, canonicalHref) : new URL(canonicalHref);
	return IsEqual(ref.hash, "") ? remoteSchema : FromValue(remoteSchema, remoteBase, ref);
}
function LegacyRetrievedResource(root, lexicalSchema, referenceBase, ref, schema) {
	if (!ref.$ref.startsWith("#")) return void 0;
	if (HasPropertyKey(root, "$schema")) return void 0;
	const targetBase = Base(lexicalSchema, referenceBase, schema);
	if (IsUndefined$1(targetBase) || IsEqual(targetBase, referenceBase)) return void 0;
	return {
		target: schema,
		base: targetBase,
		root: lexicalSchema
	};
}
function RemoteRetrievedResource(context, canonical, schema) {
	const remoteRoot = context[canonical];
	if (!IsSchemaObject(remoteRoot)) return void 0;
	return {
		target: schema,
		base: canonical,
		root: remoteRoot
	};
}
function FindRetrievedResource(stackframe, ref, schema, canonical, isRemote) {
	const remote = isRemote ? RemoteRetrievedResource(stackframe.context, canonical, schema) : void 0;
	if (!IsUndefined$1(remote)) return remote;
	return LegacyRetrievedResource(stackframe.root, stackframe.lexicalSchema, stackframe.referenceBase, ref, schema);
}
function FindResolvedResource(context, root, referenceBase, canonical, schema, ids) {
	if (IsId(schema)) return void 0;
	const resource = Resource(context, root, referenceBase, canonical);
	if (!resource || ids.includes(resource)) return void 0;
	return {
		target: schema,
		resource
	};
}
function Ref(remotes, schema, base, ref, applySchemaId = true) {
	const initialBase = new URL(base || ".", DefaultBase);
	const resolvedBase = applySchemaId && IsId(schema) ? new URL(schema.$id, initialBase) : initialBase;
	const initialRef = new URL(ref, resolvedBase.href);
	return RefContext(remotes, ref) ?? RefLocal(schema, resolvedBase, initialRef) ?? RefRemote(remotes, resolvedBase, initialRef);
}
function DynamicRef(context, root, base, schema, dynamicRef, dynamicAnchors) {
	const initialBase = new URL(base || ".", DefaultBase);
	const fragmentTarget = Ref(context, dynamicRef.$dynamicRef.startsWith("#") ? schema : root, base, dynamicRef.$dynamicRef, false);
	if (IsUndefined$1(fragmentTarget)) {
		const fragment = new URL(dynamicRef.$dynamicRef, initialBase).hash;
		if (!fragment.startsWith("#/") && fragment.startsWith("#")) {
			const name = decodeURIComponent(fragment.slice(1));
			return dynamicAnchors.find((anchor) => IsEqual(anchor.$dynamicAnchor, name)) ?? FindDynamicAnchor(root, name);
		}
		return;
	}
	if (!IsSchemaObject(fragmentTarget) || !IsDynamicAnchor(fragmentTarget)) return fragmentTarget;
	if (new URL(dynamicRef.$dynamicRef, initialBase).hash.startsWith("#/")) return fragmentTarget;
	return dynamicAnchors.find((anchor) => IsEqual(anchor.$dynamicAnchor, fragmentTarget.$dynamicAnchor)) ?? fragmentTarget;
}
function ResolveRef$1(stackframe, ref) {
	const source = stackframe.inRetrievedFrame ? stackframe.lexicalSchema : stackframe.root;
	const refRoot = ref.$ref.startsWith("#") ? stackframe.lexicalSchema : source;
	const schema = Ref(stackframe.context, refRoot, stackframe.referenceBase, ref.$ref, false);
	if (!schema || !IsSchemaObject(schema)) return { schema };
	const canonical = new URL(ref.$ref, stackframe.referenceBase).href.split("#")[0];
	const isRemote = !IsEqual(canonical, stackframe.resourceBase);
	return {
		schema,
		retrievedResource: FindRetrievedResource(stackframe, ref, schema, canonical, isRemote),
		resolvedResource: isRemote ? FindResolvedResource(stackframe.context, stackframe.root, stackframe.referenceBase, canonical, schema, stackframe.ids) : void 0
	};
}
function ResolveRecursiveRef(stackframe, recursiveRef) {
	const refRoot = IsRecursiveAnchorTrue(stackframe.lexicalSchema) ? stackframe.recursiveAnchors[0] : stackframe.lexicalSchema;
	return Ref(stackframe.context, refRoot, stackframe.lexicalBase, recursiveRef.$recursiveRef, false);
}
function ResolveDynamicRef(stackframe, dynamicRef) {
	return DynamicRef(stackframe.context, stackframe.root, stackframe.lexicalBase, stackframe.lexicalSchema, dynamicRef, stackframe.dynamicAnchors);
}
// node_modules/typebox/build/schema/engine/_stack.mjs
var __classPrivateFieldGet = function(receiver, state, kind, f) {
	if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
	if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
	return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _Stack_instances;
var _Stack_StackFrame;
var _Stack_ApplyRefResult;
var _Stack_BuildBase;
var _Stack_ResourceBaseURL;
var _Stack_ReferenceBaseURL;
var _Stack_LexicalSchema;
var _Stack_RegisterResourceAnchorArray;
var _Stack_UnregisterResourceAnchorArray;
var _Stack_RegisterResourceAnchors;
var _Stack_UnregisterResourceAnchors;
var _Stack_RegisterResource;
var _Stack_UnregisterResource;
var _Stack_EnterResolvedResource;
var _Stack_ExitResolvedResource;
var Stack = class {
	constructor(context, schema) {
		_Stack_instances.add(this);
		this.context = context;
		this.schema = schema;
		this.ids = [];
		this.resourceIds = [];
		this.anchors = [];
		this.recursiveAnchors = [];
		this.dynamicAnchors = [];
		this.retrievedResources = /* @__PURE__ */ new Map();
		this.retrievedFrames = [];
		this.resolvedResources = /* @__PURE__ */ new Map();
		this.pendingResource = true;
	}
	LexicalBaseURL() {
		return __classPrivateFieldGet(this, _Stack_instances, "m", _Stack_BuildBase).call(this, this.ids);
	}
	Push(schema) {
		if (!IsSchemaObject(schema)) return;
		if (IsId(schema)) __classPrivateFieldGet(this, _Stack_instances, "m", _Stack_RegisterResource).call(this, schema);
		if (IsAnchor(schema)) this.anchors.push(schema);
		if (IsRecursiveAnchorTrue(schema)) this.recursiveAnchors.push(schema);
		if (IsDynamicAnchor(schema)) this.dynamicAnchors.push(schema);
		const retrievedResource = this.retrievedResources.get(schema);
		if (retrievedResource) this.retrievedFrames.push({
			schema: retrievedResource.root,
			base: retrievedResource.base,
			idDepth: this.ids.length,
			resourceDepth: this.resourceIds.length
		});
	}
	Pop(schema) {
		if (!IsSchemaObject(schema)) return;
		if (IsId(schema)) __classPrivateFieldGet(this, _Stack_instances, "m", _Stack_UnregisterResource).call(this, schema);
		if (IsAnchor(schema)) this.anchors.pop();
		if (IsRecursiveAnchorTrue(schema)) this.recursiveAnchors.pop();
		if (IsDynamicAnchor(schema)) this.dynamicAnchors.pop();
		if (this.retrievedResources.has(schema)) this.retrievedFrames.pop();
		__classPrivateFieldGet(this, _Stack_instances, "m", _Stack_ExitResolvedResource).call(this, schema);
	}
	Ref(ref) {
		const result = ResolveRef$1(__classPrivateFieldGet(this, _Stack_instances, "m", _Stack_StackFrame).call(this), ref);
		__classPrivateFieldGet(this, _Stack_instances, "m", _Stack_ApplyRefResult).call(this, result);
		return result.schema;
	}
	RecursiveRef(recursiveRef) {
		const result = ResolveRecursiveRef(__classPrivateFieldGet(this, _Stack_instances, "m", _Stack_StackFrame).call(this), recursiveRef);
		if (result) this.pendingResource = true;
		return result;
	}
	DynamicRef(dynamicRef) {
		const result = ResolveDynamicRef(__classPrivateFieldGet(this, _Stack_instances, "m", _Stack_StackFrame).call(this), dynamicRef);
		if (result) this.pendingResource = true;
		return result;
	}
};
_Stack_instances = /* @__PURE__ */ new WeakSet(), _Stack_StackFrame = function _Stack_StackFrame() {
	return {
		context: this.context,
		root: this.schema,
		ids: this.ids,
		lexicalSchema: __classPrivateFieldGet(this, _Stack_instances, "m", _Stack_LexicalSchema).call(this),
		lexicalBase: this.LexicalBaseURL(),
		referenceBase: __classPrivateFieldGet(this, _Stack_instances, "m", _Stack_ReferenceBaseURL).call(this),
		resourceBase: __classPrivateFieldGet(this, _Stack_instances, "m", _Stack_ResourceBaseURL).call(this),
		recursiveAnchors: this.recursiveAnchors,
		dynamicAnchors: this.dynamicAnchors,
		inRetrievedFrame: this.retrievedFrames.length > 0
	};
}, _Stack_ApplyRefResult = function _Stack_ApplyRefResult(result) {
	if (!IsUndefined$1(result.schema)) this.pendingResource = true;
	if (!IsUndefined$1(result.resolvedResource)) __classPrivateFieldGet(this, _Stack_instances, "m", _Stack_EnterResolvedResource).call(this, result.resolvedResource.target, result.resolvedResource.resource);
	if (!IsUndefined$1(result.retrievedResource)) this.retrievedResources.set(result.retrievedResource.target, {
		base: result.retrievedResource.base,
		root: result.retrievedResource.root
	});
}, _Stack_BuildBase = function _Stack_BuildBase(stack) {
	const frame = this.retrievedFrames[this.retrievedFrames.length - 1];
	const base = frame ? new URL(frame.base) : new URL(DefaultBase);
	return (frame ? stack.slice(frame.idDepth) : stack).reduce((result, schema) => new URL(schema.$id, result), base).href;
}, _Stack_ResourceBaseURL = function _Stack_ResourceBaseURL() {
	const frame = this.retrievedFrames[this.retrievedFrames.length - 1];
	if (!frame) return __classPrivateFieldGet(this, _Stack_instances, "m", _Stack_BuildBase).call(this, this.resourceIds);
	return this.resourceIds.slice(frame.resourceDepth).reduce((result, schema) => new URL(schema.$id, result), new URL(frame.base)).href;
}, _Stack_ReferenceBaseURL = function _Stack_ReferenceBaseURL() {
	if (this.retrievedFrames.length > 0) return __classPrivateFieldGet(this, _Stack_instances, "m", _Stack_ResourceBaseURL).call(this);
	const lexical = this.ids[this.ids.length - 1];
	if (lexical && !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(lexical.$id)) return this.LexicalBaseURL();
	return __classPrivateFieldGet(this, _Stack_instances, "m", _Stack_ResourceBaseURL).call(this);
}, _Stack_LexicalSchema = function _Stack_LexicalSchema() {
	const frame = this.retrievedFrames[this.retrievedFrames.length - 1];
	if (frame) return this.ids.length > frame.idDepth ? this.ids[this.ids.length - 1] : frame.schema;
	return this.ids.length > 0 ? this.ids[this.ids.length - 1] : this.schema;
}, _Stack_RegisterResourceAnchorArray = function _Stack_RegisterResourceAnchorArray(schema) {
	schema.forEach((schema) => __classPrivateFieldGet(this, _Stack_instances, "m", _Stack_RegisterResourceAnchors).call(this, schema, false));
}, _Stack_UnregisterResourceAnchorArray = function _Stack_UnregisterResourceAnchorArray(schema) {
	schema.forEach((schema) => __classPrivateFieldGet(this, _Stack_instances, "m", _Stack_UnregisterResourceAnchors).call(this, schema, false));
}, _Stack_RegisterResourceAnchors = function _Stack_RegisterResourceAnchors(schema, isRoot = true) {
	if (IsSchemaBoolean(schema)) return;
	if (IsArray$1(schema)) return __classPrivateFieldGet(this, _Stack_instances, "m", _Stack_RegisterResourceAnchorArray).call(this, schema);
	if (!IsSchemaObject(schema)) return;
	const current = schema;
	if (!isRoot && IsId(current)) return;
	if (!isRoot && IsDynamicAnchor(current)) this.dynamicAnchors.push(current);
	for (const key of Keys(current)) __classPrivateFieldGet(this, _Stack_instances, "m", _Stack_RegisterResourceAnchors).call(this, current[key], false);
}, _Stack_UnregisterResourceAnchors = function _Stack_UnregisterResourceAnchors(schema, isRoot = true) {
	if (IsSchemaBoolean(schema)) return;
	if (IsArray$1(schema)) return __classPrivateFieldGet(this, _Stack_instances, "m", _Stack_UnregisterResourceAnchorArray).call(this, schema);
	if (!IsSchemaObject(schema)) return;
	const current = schema;
	if (!isRoot && IsId(current)) return;
	if (!isRoot && IsDynamicAnchor(current)) this.dynamicAnchors.pop();
	for (const key of Keys(current)) __classPrivateFieldGet(this, _Stack_instances, "m", _Stack_UnregisterResourceAnchors).call(this, current[key], false);
}, _Stack_RegisterResource = function _Stack_RegisterResource(schema) {
	this.ids.push(schema);
	const isResource = this.pendingResource;
	this.pendingResource = false;
	if (isResource) this.resourceIds.push(schema);
	__classPrivateFieldGet(this, _Stack_instances, "m", _Stack_RegisterResourceAnchors).call(this, schema, true);
}, _Stack_UnregisterResource = function _Stack_UnregisterResource(schema) {
	this.ids.pop();
	if (this.resourceIds.length > 0 && IsEqual(this.resourceIds[this.resourceIds.length - 1], schema)) this.resourceIds.pop();
	__classPrivateFieldGet(this, _Stack_instances, "m", _Stack_UnregisterResourceAnchors).call(this, schema, true);
}, _Stack_EnterResolvedResource = function _Stack_EnterResolvedResource(target, resource) {
	__classPrivateFieldGet(this, _Stack_instances, "m", _Stack_RegisterResource).call(this, resource);
	this.resolvedResources.set(target, resource);
}, _Stack_ExitResolvedResource = function _Stack_ExitResolvedResource(target) {
	if (!this.resolvedResources.has(target)) return;
	const resource = this.resolvedResources.get(target);
	__classPrivateFieldGet(this, _Stack_instances, "m", _Stack_UnregisterResource).call(this, resource);
	this.resolvedResources.delete(target);
};
// node_modules/typebox/build/schema/errors.mjs
/** Returns an array of validation errors for the given value. */
function Errors$1(...args) {
	const [context, schema, value] = Match$3(args, {
		3: (context, schema, value) => [
			context,
			schema,
			value
		],
		2: (schema, value) => [
			{},
			schema,
			value
		]
	});
	const stack = new Stack(context, schema);
	const errorContext = new ErrorContext();
	const result = ErrorSchema(stack, errorContext, "#", "", schema, value);
	const errors = errorContext.GetErrors();
	const locale = Get$1();
	return [result, errors.map((error) => ({
		...error,
		message: locale(error)
	}))];
}
// node_modules/typebox/build/schema/check.mjs
/** Checks a value against the provided schema */
function Check$1(...args) {
	const [context, schema, value] = Match$3(args, {
		3: (context, schema, value) => [
			context,
			schema,
			value
		],
		2: (schema, value) => [
			{},
			schema,
			value
		]
	});
	return CheckSchema(new Stack(context, schema), new CheckContext(), schema, value);
}
// node_modules/typebox/build/value/check/check.mjs
/** Checks a value matches the provided type. */
function Check(...args) {
	const [context, type, value] = Match$3(args, {
		3: (context, type, value) => [
			context,
			type,
			value
		],
		2: (type, value) => [
			{},
			type,
			value
		]
	});
	return Check$1(context, type, value);
}
// node_modules/typebox/build/value/errors/errors.mjs
/** Returns an array of validation errors for the given value. */
function Errors(...args) {
	const [context, type, value] = Match$3(args, {
		3: (context, type, value) => [
			context,
			type,
			value
		],
		2: (type, value) => [
			{},
			type,
			value
		]
	});
	const [_, errors] = Errors$1(context, type, value);
	return errors;
}
BigInt(Number.MAX_SAFE_INTEGER);
BigInt(Number.MIN_SAFE_INTEGER);
Union([
	_Object_({
		type: Literal("insert"),
		path: String$1(),
		value: Unknown()
	}),
	Object({
		type: Literal("update"),
		path: String$1(),
		value: Unknown()
	}),
	_Object_({
		type: Literal("delete"),
		path: String$1()
	})
]);
// src/core/typebox.ts
function parseTypeBoxValue(schema, value, context) {
	if (Check(schema, value)) return value;
	throw new Error(formatTypeBoxError(schema, value, context));
}
function safeParseTypeBoxValue(schema, value) {
	return Check(schema, value) ? value : void 0;
}
function formatTypeBoxError(schema, value, context) {
	const firstError = Errors(schema, value)[0];
	if (!firstError) return `${context}: invalid value.`;
	const path = firstError.instancePath.length > 0 ? firstError.instancePath : "/";
	if (firstError.schemaPath.endsWith("/additionalProperties")) return `${context}: ${path} is not a recognized key`;
	return `${context}: ${path} ${firstError.message}`;
}
// src/core/github.ts
const execFileAsync$1 = promisify(execFile);
var GitHubApiError = class extends Error {
	status;
	cause;
	constructor(message, status, cause) {
		super(message, cause === void 0 ? void 0 : { cause });
		this.status = status;
		this.cause = cause;
		this.name = "GitHubApiError";
	}
};
async function resolveGhCliToken() {
	try {
		const { stdout } = await execFileAsync$1("gh", ["auth", "token"], { timeout: 1e4 });
		const token = stdout.trim();
		return token.length > 0 ? token : void 0;
	} catch {
		return;
	}
}
const SILENT_OCTOKIT_LOG = {
	debug: () => {},
	info: () => {},
	warn: () => {},
	error: () => {}
};
function apiBaseUrl(webUrl) {
	return webUrl === "https://github.com" ? "https://api.github.com" : `${webUrl}/api/v3`;
}
function createGitHubClient(token, webUrl) {
	return new GitHubClient(new Octokit({
		...token ? { auth: token } : {},
		baseUrl: apiBaseUrl(webUrl),
		userAgent: "pi-librarian",
		log: SILENT_OCTOKIT_LOG,
		request: {
			log: SILENT_OCTOKIT_LOG,
			headers: { "x-github-api-version": "2022-11-28" }
		}
	}));
}
function createGitHubClientProvider(tokenResolver, webUrl) {
	let client;
	return () => {
		client ??= tokenResolver().then((token) => createGitHubClient(token, webUrl));
		return client;
	};
}
function rateLimitResetSeconds(headers) {
	const reset = Number(headers?.["x-ratelimit-reset"]);
	const serverDate = Date.parse(String(headers?.date ?? ""));
	if (!Number.isFinite(reset) || Number.isNaN(serverDate)) return;
	return Math.max(0, Math.ceil(reset - serverDate / 1e3));
}
const GITHUB_ERROR_DATA_SCHEMA = _Object_({ message: Optional(String$1()) });
function errorDetail(error) {
	return safeParseTypeBoxValue(GITHUB_ERROR_DATA_SCHEMA, error.response?.data)?.message ?? error.message;
}
function normalizeGitHubError(error, operation) {
	if (!(error instanceof RequestError)) throw error;
	const headers = error.response?.headers;
	if ((error.status === 403 || error.status === 429) && String(headers?.["x-ratelimit-remaining"]) === "0") {
		const reset = rateLimitResetSeconds(headers);
		throw new GitHubApiError(`GitHub ${operation} rate limit reached${reset === void 0 ? "" : `; resets in ${reset}s`}.`, error.status, error);
	}
	const detail = errorDetail(error).slice(0, 300);
	throw new GitHubApiError(`GitHub API ${error.status} during ${operation}${detail ? `: ${detail}` : ""}`, error.status, error);
}
function requestOptions(signal) {
	return signal ? { signal } : {};
}
const REPO_SEARCH_ITEM_SCHEMA = _Object_({
	full_name: String$1(),
	html_url: String$1(),
	description: Union([String$1(), Null()]),
	stargazers_count: Number$1(),
	language: Union([String$1(), Null()]),
	topics: Optional(_Array_(String$1())),
	pushed_at: Union([String$1(), Null()]),
	archived: Boolean$1(),
	fork: Boolean$1()
});
function searchResponseSchema(item) {
	return _Object_({
		total_count: Number$1(),
		incomplete_results: Boolean$1(),
		items: _Array_(item)
	});
}
const CODE_SEARCH_MATCH_SCHEMA = _Object_({ fragment: Optional(String$1()) });
const CODE_SEARCH_ITEM_SCHEMA = _Object_({
	path: String$1(),
	html_url: String$1(),
	repository: _Object_({ full_name: String$1() }),
	text_matches: Optional(_Array_(CODE_SEARCH_MATCH_SCHEMA))
});
const CONTENTS_ENTRY_SCHEMA = _Object_({
	type: String$1(),
	name: String$1(),
	path: String$1(),
	size: Number$1(),
	sha: String$1(),
	content: Optional(String$1()),
	encoding: Optional(String$1()),
	target: Optional(String$1()),
	submodule_git_url: Optional(String$1())
});
const REPO_META_SCHEMA = _Object_({
	full_name: String$1(),
	default_branch: String$1(),
	private: Boolean$1()
});
function entryType(type) {
	switch (type) {
		case "dir": return "directory";
		case "symlink": return "symlink";
		case "submodule": return "submodule";
		default: return "file";
	}
}
function commitFromBlobUrl(url) {
	return /\/blob\/([0-9a-f]{40})\//.exec(url)?.[1];
}
var GitHubClient = class {
	octokit;
	constructor(octokit) {
		this.octokit = octokit;
	}
	async get(request, schema) {
		try {
			return parseTypeBoxValue(schema, (await this.octokit.request(request.route, {
				...request.params,
				request: requestOptions(request.signal)
			})).data, `GitHub ${request.operation}`);
		} catch (error) {
			normalizeGitHubError(error, request.operation);
		}
	}
	async getRaw(request) {
		try {
			const data = (await this.octokit.request(request.route, {
				...request.params,
				mediaType: { format: "raw" },
				request: requestOptions(request.signal)
			})).data;
			if (typeof data === "string") return Buffer.from(data);
			if (data instanceof ArrayBuffer) return Buffer.from(data);
			throw new Error(`GitHub ${request.operation} returned no raw content.`);
		} catch (error) {
			normalizeGitHubError(error, request.operation);
		}
	}
	async graphql(query, variables, schema, operation, signal) {
		try {
			return parseTypeBoxValue(schema, await this.octokit.graphql(query, {
				...variables,
				request: requestOptions(signal)
			}), `GitHub ${operation}`);
		} catch (error) {
			normalizeGitHubError(error, operation);
		}
	}
	async searchRepositories(params) {
		const payload = await this.get({
			route: "GET /search/repositories",
			params: {
				q: params.query,
				per_page: params.limit,
				...params.sort === "best-match" ? {} : {
					sort: params.sort,
					order: "desc"
				}
			},
			operation: "repository search",
			signal: params.signal
		}, searchResponseSchema(REPO_SEARCH_ITEM_SCHEMA));
		return {
			totalCount: payload.total_count,
			incompleteResults: payload.incomplete_results,
			hits: payload.items.map((item) => ({
				repo: item.full_name,
				url: item.html_url,
				description: item.description ?? void 0,
				stars: item.stargazers_count,
				language: item.language ?? void 0,
				topics: item.topics ?? [],
				pushedAt: item.pushed_at ?? void 0,
				archived: item.archived,
				fork: item.fork
			}))
		};
	}
	async searchCode(params) {
		const payload = await this.get({
			route: "GET /search/code",
			params: {
				q: params.query,
				per_page: params.limit,
				mediaType: { format: "text-match" }
			},
			operation: "code search",
			signal: params.signal
		}, searchResponseSchema(CODE_SEARCH_ITEM_SCHEMA));
		return {
			totalCount: payload.total_count,
			incompleteResults: payload.incomplete_results,
			hits: payload.items.map((item) => ({
				repo: item.repository.full_name,
				path: item.path,
				url: item.html_url,
				commit: commitFromBlobUrl(item.html_url),
				fragments: (item.text_matches ?? []).flatMap((match) => match.fragment ? [match.fragment] : [])
			}))
		};
	}
	async readEntry(params) {
		const request = {
			route: "GET /repos/{owner}/{repo}/contents/{path}",
			params: {
				owner: params.owner,
				repo: params.repo,
				path: params.path,
				...params.ref ? { ref: params.ref } : {}
			},
			operation: `read ${params.owner}/${params.repo}/${params.path}`,
			signal: params.signal
		};
		try {
			const payload = await this.get(request, Union([_Array_(CONTENTS_ENTRY_SCHEMA), CONTENTS_ENTRY_SCHEMA]));
			if (Array.isArray(payload)) return {
				type: "directory",
				entries: payload.map((entry) => ({
					name: entry.name,
					type: entryType(entry.type)
				}))
			};
			switch (entryType(payload.type)) {
				case "symlink": return {
					type: "symlink",
					target: payload.target ?? ""
				};
				case "submodule": return {
					type: "submodule",
					url: payload.submodule_git_url
				};
				case "directory": throw new Error(`Unexpected directory entry during ${request.operation}.`);
			}
			if (payload.size > params.maxBytes) throw new EntryTooLargeError(payload.size);
			if (payload.encoding === "base64" && payload.content !== void 0 && payload.content.length > 0) return {
				type: "file",
				size: payload.size,
				bytes: Buffer.from(payload.content, "base64")
			};
			return {
				type: "file",
				size: payload.size,
				bytes: await this.getRaw(request)
			};
		} catch (error) {
			if (error instanceof GitHubApiError && error.status === 404) throw new EntryNotFoundError(`Not found: ${params.owner}/${params.repo}/${params.path}${params.ref ? ` at ${params.ref}` : ""}.\nGitHub returns the same 404 for a missing path, ref, or repository and for a private repository your token cannot read.`);
			throw error;
		}
	}
	async getRepo(owner, repo, signal) {
		const payload = await this.get({
			route: "GET /repos/{owner}/{repo}",
			params: {
				owner,
				repo
			},
			operation: `repo lookup for ${owner}/${repo}`,
			signal
		}, REPO_META_SCHEMA);
		return {
			fullName: payload.full_name,
			defaultBranch: payload.default_branch,
			isPrivate: payload.private
		};
	}
};
function createGitHubFileReader(provider) {
	return { async readEntry(request) {
		const [owner, repo, ...rest] = request.repo.split("/");
		if (!owner || !repo || rest.length > 0) throw new Error(`GitHub repositories are owner/repo; "${request.repo}" is not.`);
		return (await provider()).readEntry({
			owner,
			repo,
			path: request.path,
			ref: request.ref,
			maxBytes: request.maxBytes,
			signal: request.signal
		});
	} };
}
// src/core/migrate.ts
const PI_KEYS = /* @__PURE__ */ new Set([
	"model",
	"thinkingLevel",
	"tools",
	"debug"
]);
function piLegacyPaths(env) {
	const configured = env.PI_CODING_AGENT_DIR;
	const agentDir = configured ? configured.replace(/^~(?=$|\/)/, os.homedir()) : path.join(os.homedir(), ".pi", "agent");
	return {
		piSettings: path.join(agentDir, "settings.json"),
		browserProfile: path.join(agentDir, "browser-profile")
	};
}
function librarianPaths(env) {
	return {
		settings: settingsPath(env),
		browserProfile: browserProfileDir(env)
	};
}
function isObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function readPiSettings(file) {
	let parsed;
	try {
		parsed = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
	} catch (error) {
		throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!isObject(parsed)) throw new Error(`${file}: expected a JSON object.`);
	return parsed;
}
function migrateFromPi(legacy, current) {
	const moved = [];
	const { librarian, ...rest } = existsSync(legacy.piSettings) ? readPiSettings(legacy.piSettings) : {};
	if (librarian !== void 0) {
		if (!isObject(librarian)) throw new Error(`${legacy.piSettings}: "librarian" must be an object to migrate.`);
		if (existsSync(current.settings)) throw new Error(`Librarian settings exist both under "librarian" in ${legacy.piSettings} and in ${current.settings}. Merge them into ${current.settings} and remove the "librarian" key.`);
		const shared = {};
		const pi = {};
		for (const [key, value] of Object.entries(librarian)) (PI_KEYS.has(key) ? pi : shared)[key] = value;
		mkdirSync(path.dirname(current.settings), { recursive: true });
		writeFileSync(current.settings, `${JSON.stringify(Object.keys(pi).length > 0 ? {
			...shared,
			pi
		} : shared, null, 2)}\n`, { flag: "wx" });
		const temporary = `${legacy.piSettings}.librarian-migration`;
		writeFileSync(temporary, `${JSON.stringify(rest, null, 2)}\n`);
		renameSync(temporary, legacy.piSettings);
		moved.push(`settings from ${legacy.piSettings} to ${current.settings}`);
	}
	if (existsSync(legacy.browserProfile)) {
		if (existsSync(current.browserProfile)) throw new Error(`Browser profiles exist at both ${legacy.browserProfile} and ${current.browserProfile}. Keep one and delete the other.`);
		mkdirSync(path.dirname(current.browserProfile), { recursive: true });
		renameSync(legacy.browserProfile, current.browserProfile);
		moved.push(`browser profile from ${legacy.browserProfile} to ${current.browserProfile}`);
	}
	return moved;
}
// src/core/string-enum.ts
function StringEnum(values, options) {
	return Unsafe({
		type: "string",
		enum: values,
		...options
	});
}
// src/core/settings.ts
const THINKING_LEVELS = [
	"off",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
	"max"
];
const THINKING_LEVEL_SCHEMA = Union([
	Literal(THINKING_LEVELS[0]),
	Literal(THINKING_LEVELS[1]),
	Literal(THINKING_LEVELS[2]),
	Literal(THINKING_LEVELS[3]),
	Literal(THINKING_LEVELS[4]),
	Literal(THINKING_LEVELS[5]),
	Literal(THINKING_LEVELS[6])
]);
const SOURCE_KINDS = [
	"github",
	"gitlab",
	"bitbucket-server",
	"sourcegraph"
];
const CLONE_SOURCE_KINDS = [
	"github",
	"gitlab",
	"bitbucket-server"
];
const SOURCE_ROLES = [
	"clone",
	"code-search",
	"repo-search"
];
const CODEX_REASONING_EFFORTS = [
	"none",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh"
];
const SOURCE_KIND_SCHEMA = StringEnum(SOURCE_KINDS);
const SOURCE_ROLE_SCHEMA = StringEnum(SOURCE_ROLES);
const STRICT = { additionalProperties: false };
const SOURCE_SCHEMA = _Object_({
	name: String$1({ minLength: 1 }),
	url: String$1({ minLength: 1 }),
	kind: SOURCE_KIND_SCHEMA,
	disabled: Optional(_Array_(SOURCE_ROLE_SCHEMA, { uniqueItems: true })),
	tokenEnv: Optional(String$1({ minLength: 1 })),
	tokenCommand: Optional(String$1({ pattern: "\\S" })),
	advancedSearch: Optional(Boolean$1()),
	description: Optional(String$1({
		pattern: "\\S",
		maxLength: 300
	}))
}, STRICT);
const WEB_SETTINGS_SCHEMA = _Object_({
	parallel: Optional(_Object_({ apiKeyCommand: Optional(String$1({ pattern: "\\S" })) }, STRICT)),
	fetch: Optional(_Object_({
		browser: Optional(_Object_({
			executablePath: Optional(String$1()),
			profileDir: Optional(String$1())
		}, STRICT)),
		challenge: Optional(_Object_({
			escalation: Optional(StringEnum(["headed", "never"])),
			headlessWaitSecs: Optional(Number$1({ exclusiveMinimum: 0 })),
			headedWaitSecs: Optional(Number$1({ exclusiveMinimum: 0 }))
		}, STRICT))
	}, STRICT))
}, STRICT);
const PI_SETTINGS_SCHEMA = _Object_({
	model: Optional(String$1()),
	thinkingLevel: Optional(THINKING_LEVEL_SCHEMA),
	tools: Optional(_Object_({ disabled: Optional(_Array_(String$1())) }, STRICT)),
	debug: Optional(_Object_({ persistRuns: Optional(Boolean$1()) }, STRICT))
}, STRICT);
const CODEX_SETTINGS_SCHEMA = _Object_({
	model: Optional(String$1({ pattern: "\\S" })),
	reasoningEffort: Optional(StringEnum(CODEX_REASONING_EFFORTS))
}, STRICT);
const LIBRARIAN_FILE_SETTINGS_SCHEMA = _Object_({
	sources: Optional(_Array_(SOURCE_SCHEMA)),
	builtInSources: Optional(_Object_({
		github: Optional(Boolean$1()),
		"gitlab.com": Optional(Boolean$1())
	}, STRICT)),
	search: Optional(_Object_({
		timeoutSeconds: Optional(Number$1({ exclusiveMinimum: 0 })),
		defaultLimit: Optional(Integer({
			minimum: 1,
			maximum: 50
		}))
	}, STRICT)),
	web: Optional(WEB_SETTINGS_SCHEMA),
	cacheDir: Optional(String$1()),
	pi: Optional(PI_SETTINGS_SCHEMA),
	codex: Optional(CODEX_SETTINGS_SCHEMA)
}, STRICT);
var ModelReference = class {
	provider;
	modelId;
	constructor(provider, modelId) {
		this.provider = provider;
		this.modelId = modelId;
	}
	toString() {
		return this.provider ? `${this.provider}/${this.modelId}` : this.modelId;
	}
};
const SEARCH_SOURCE_ROLES = ["code-search", "repo-search"];
function isCloneSourceKind(kind) {
	return CLONE_SOURCE_KINDS.some((cloneKind) => cloneKind === kind);
}
function possibleRoles(kind) {
	return isCloneSourceKind(kind) ? SOURCE_ROLES : SEARCH_SOURCE_ROLES;
}
const DEFAULT_HEADLESS_WAIT_SECONDS = 10;
const DEFAULT_HEADED_WAIT_SECONDS = 20;
const CONVENTIONAL_TOKEN_ENV = {
	github: ["GITHUB_TOKEN", "GH_TOKEN"],
	gitlab: ["GITLAB_ACCESS_TOKEN"],
	"bitbucket-server": ["BITBUCKET_TOKEN"],
	sourcegraph: ["SRC_ACCESS_TOKEN"]
};
function expandHome(rawPath) {
	if (rawPath === "~") return os.homedir();
	if (rawPath.startsWith(`~${path.sep}`) || rawPath.startsWith("~/")) return path.join(os.homedir(), rawPath.slice(2));
	return rawPath;
}
function parseModelReference(value) {
	const trimmed = value?.trim();
	if (!trimmed) return;
	const slashIndex = trimmed.indexOf("/");
	if (slashIndex === -1) return new ModelReference(void 0, trimmed);
	if (slashIndex === 0 || slashIndex === trimmed.length - 1) return;
	return new ModelReference(trimmed.slice(0, slashIndex), trimmed.slice(slashIndex + 1));
}
function normalizeAbsolutePath(value, key) {
	const trimmed = value?.trim();
	if (!trimmed) return;
	const expanded = expandHome(trimmed);
	if (!path.isAbsolute(expanded)) throw new Error(`${key} must be an absolute path or start with "~/".`);
	return path.normalize(expanded);
}
function resolveWebSettings(file, env) {
	const browser = file?.fetch?.browser;
	const challenge = file?.fetch?.challenge;
	return {
		parallel: {
			apiKey: env.PARALLEL_API_KEY?.trim() || void 0,
			apiKeyCommand: file?.parallel?.apiKeyCommand
		},
		fetch: {
			browser: {
				executablePath: normalizeAbsolutePath(browser?.executablePath, "web.fetch.browser.executablePath"),
				profileDir: normalizeAbsolutePath(browser?.profileDir, "web.fetch.browser.profileDir") ?? browserProfileDir(env)
			},
			challenge: {
				escalation: challenge?.escalation ?? "headed",
				headlessWaitSecs: challenge?.headlessWaitSecs ?? DEFAULT_HEADLESS_WAIT_SECONDS,
				headedWaitSecs: challenge?.headedWaitSecs ?? DEFAULT_HEADED_WAIT_SECONDS
			}
		}
	};
}
function normalizeToolNames(values) {
	if (!values) return [];
	return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}
function normalizeSourceUrl(value, name) {
	let url;
	try {
		url = new URL(value);
	} catch {
		throw new Error(`sources "${name}" has an invalid url.`);
	}
	if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" && url.pathname !== "" || url.search || url.hash) throw new Error(`sources "${name}" url must be an HTTPS origin without credentials, a path, query, or fragment.`);
	return url;
}
const BUILT_IN_SOURCES = [{
	name: "github",
	url: "https://github.com",
	kind: "github",
	enabledByDefault: true
}, {
	name: "gitlab.com",
	url: "https://gitlab.com",
	kind: "gitlab",
	enabledByDefault: false
}];
const ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
function validateTokenEnv(value, name) {
	const trimmed = value.trim();
	if (!ENV_NAME_PATTERN.test(trimmed) || /^(glpat-|ghp_|gho_|github_pat_|sgp_|BBDC-)/.test(trimmed)) throw new Error(`sources "${name}" tokenEnv must name an environment variable, not hold a credential.`);
	return trimmed;
}
function resolveToken(kind, tokenEnv, env) {
	for (const variable of tokenEnv ? [tokenEnv] : CONVENTIONAL_TOKEN_ENV[kind]) {
		const value = env[variable]?.trim();
		if (value) return {
			kind: "value",
			value
		};
	}
}
function rolesWithCredential(kind, roles, token) {
	return token || kind === "github" ? [...roles] : roles.filter((role) => role === "clone");
}
function builtInSources(switches, env) {
	return BUILT_IN_SOURCES.filter((source) => switches?.[source.name] ?? source.enabledByDefault).map((source) => {
		const token = resolveToken(source.kind, void 0, env);
		return {
			name: source.name,
			url: source.url,
			kind: source.kind,
			roles: rolesWithCredential(source.kind, SOURCE_ROLES, token),
			token,
			advancedSearch: false,
			description: void 0
		};
	});
}
function normalizeSources(values, switches, env) {
	const sources = builtInSources(switches, env);
	const names = new Set(BUILT_IN_SOURCES.map((source) => source.name));
	const hostnames = new Set(BUILT_IN_SOURCES.map((source) => new URL(source.url).hostname));
	for (const value of values ?? []) {
		const name = value.name.trim();
		if (!name) throw new Error("sources names cannot be blank.");
		if (names.has(name)) throw new Error(`sources contains duplicate or reserved source name "${name}".`);
		const url = normalizeSourceUrl(value.url.trim(), name);
		const hostname = url.hostname.toLowerCase();
		if (hostnames.has(hostname)) throw new Error(`sources contains duplicate or reserved hostname "${hostname}".`);
		if (value.advancedSearch !== void 0 && value.kind !== "gitlab") throw new Error(`sources "${name}" sets advancedSearch, which only gitlab sources have.`);
		const disabled = value.disabled ?? [];
		const roles = possibleRoles(value.kind).filter((role) => !disabled.includes(role));
		if (roles.length === 0) throw new Error(`sources "${name}" disables every role supported by ${value.kind}. Remove the declaration instead.`);
		if (value.tokenEnv !== void 0 && value.tokenCommand !== void 0) throw new Error(`sources "${name}" sets both tokenEnv and tokenCommand; keep one.`);
		const tokenEnv = value.tokenEnv === void 0 ? void 0 : validateTokenEnv(value.tokenEnv, name);
		const token = value.tokenCommand === void 0 ? resolveToken(value.kind, tokenEnv, env) : {
			kind: "command",
			command: value.tokenCommand.trim()
		};
		names.add(name);
		hostnames.add(hostname);
		sources.push({
			name,
			url: url.origin.toLowerCase(),
			kind: value.kind,
			roles: rolesWithCredential(value.kind, roles, token),
			token,
			advancedSearch: value.advancedSearch ?? false,
			description: value.description?.trim()
		});
	}
	return sources;
}
function resolveLibrarianSettings(fileSettings, env) {
	const pi = fileSettings.pi;
	return {
		sources: normalizeSources(fileSettings.sources, fileSettings.builtInSources, env),
		search: {
			timeoutSeconds: fileSettings.search?.timeoutSeconds ?? 15,
			defaultLimit: fileSettings.search?.defaultLimit ?? 10
		},
		web: resolveWebSettings(fileSettings.web, env),
		cacheDir: normalizeAbsolutePath(fileSettings.cacheDir, "cacheDir") ?? cacheDir(env),
		pi: {
			model: parseModelReference(pi?.model),
			thinkingLevel: pi?.thinkingLevel,
			tools: { disabled: normalizeToolNames(pi?.tools?.disabled) },
			debug: { persistRuns: pi?.debug?.persistRuns ?? false }
		},
		codex: {
			model: fileSettings.codex?.model?.trim(),
			reasoningEffort: fileSettings.codex?.reasoningEffort
		}
	};
}
function parseSettings(fileSettings, env) {
	return resolveLibrarianSettings(parseTypeBoxValue(LIBRARIAN_FILE_SETTINGS_SCHEMA, fileSettings, "Invalid settings"), env);
}
function loadSettings(env) {
	const file = settingsPath(env);
	let content;
	try {
		content = readFileSync(file, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return parseSettings({}, env);
		throw error;
	}
	try {
		return parseSettings(JSON.parse(content), env);
	} catch (error) {
		throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
	}
}
// src/core/bitbucket.ts
var BitbucketApiError = class extends Error {
	status;
	constructor(message, status) {
		super(message);
		this.status = status;
		this.name = "BitbucketApiError";
	}
};
const ERRORS_SCHEMA = _Object_({ errors: _Array_(_Object_({ message: String$1() })) });
const REPOSITORY_SCHEMA = _Object_({
	slug: String$1(),
	name: String$1(),
	description: Optional(String$1()),
	archived: Optional(Boolean$1()),
	project: _Object_({ key: String$1() })
});
const CODE_HIT_SCHEMA = _Object_({
	repository: REPOSITORY_SCHEMA,
	file: String$1(),
	hitContexts: _Array_(_Array_(_Object_({
		line: Number$1(),
		text: String$1()
	}))),
	hitCount: Number$1()
});
const CODE_RESULT_SCHEMA = _Object_({ code: _Object_({
	count: Number$1(),
	isLastPage: Boolean$1(),
	values: _Array_(Unknown())
}) });
const PAGE_SCHEMA = _Object_({
	isLastPage: Boolean$1(),
	values: _Array_(Unknown())
});
const LISTING_PAGE_SIZE$1 = 1e3;
const MAX_LISTING_PAGES$1 = 20;
const BROWSE_SCHEMA = _Object_({ children: _Object_({
	isLastPage: Boolean$1(),
	nextPageStart: Optional(Number$1()),
	values: _Array_(_Object_({
		path: _Object_({ name: String$1() }),
		type: String$1(),
		size: Optional(Number$1())
	}))
}) });
function decodeHit(text) {
	return text.replace(/<\/?em>/g, "").replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16))).replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(Number(decimal))).replace(/&quot;/g, "\"").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
function repository(parsed) {
	return {
		repo: `${parsed.project.key}/${parsed.slug}`,
		name: parsed.name,
		description: parsed.description || void 0,
		archived: parsed.archived ?? false
	};
}
function browseType(type) {
	switch (type) {
		case "DIRECTORY": return "directory";
		case "SUBMODULE": return "submodule";
		default: return "file";
	}
}
function splitRepo(repo) {
	const [project, slug, ...rest] = repo.split("/");
	if (!project || !slug || rest.length > 0) throw new Error(`Bitbucket repositories are PROJECT/repo; "${repo}" is not.`);
	return {
		project,
		slug
	};
}
var BitbucketClient = class {
	url;
	token;
	constructor(url, token) {
		this.url = url;
		this.token = token;
	}
	async authorize() {
		await this.token();
	}
	async request(path, init, signal) {
		const url = new URL(path, this.url);
		for (const [key, value] of Object.entries(init.params ?? {})) if (value !== void 0) url.searchParams.set(key, value);
		const response = await fetch(url, {
			method: init.method ?? "GET",
			headers: {
				authorization: `Bearer ${await this.token()}`,
				"user-agent": "pi-librarian",
				...init.body === void 0 ? {} : { "content-type": "application/json" }
			},
			...init.body === void 0 ? {} : { body: JSON.stringify(init.body) },
			...signal ? { signal } : {}
		});
		if (!response.ok) {
			const text = await response.text();
			let message = text.slice(0, 200);
			try {
				const parsed = safeParseTypeBoxValue(ERRORS_SCHEMA, JSON.parse(text));
				if (parsed?.errors[0]) message = parsed.errors[0].message;
			} catch {}
			if (response.status === 401) throw new BitbucketApiError(`Bitbucket rejected the token (401): ${message}`, 401);
			throw new BitbucketApiError(`Bitbucket API ${response.status}: ${message}`, response.status);
		}
		return response;
	}
	async searchCode(query, limit, signal) {
		const response = await this.request("/rest/search/latest/search", {
			method: "POST",
			body: {
				query,
				entities: { code: {
					start: 0,
					limit
				} },
				limits: {
					primary: limit,
					secondary: 10
				}
			}
		}, signal);
		const parsed = safeParseTypeBoxValue(CODE_RESULT_SCHEMA, await response.json());
		if (!parsed) throw new Error("Bitbucket code search returned an unexpected payload shape.");
		const hits = [];
		for (const value of parsed.code.values) {
			const hit = parseTypeBoxValue(CODE_HIT_SCHEMA, value, "Bitbucket code search result");
			hits.push({
				repo: repository(hit.repository).repo,
				path: hit.file,
				hitCount: hit.hitCount,
				lines: hit.hitContexts.flat().filter((line) => line.text.includes("<em>")).map((line) => ({
					lineNumber: line.line,
					text: decodeHit(line.text)
				}))
			});
		}
		return {
			count: parsed.code.count,
			isLastPage: parsed.code.isLastPage,
			hits
		};
	}
	async searchRepositories(params, signal) {
		const response = await this.request("/rest/api/1.0/repos", { params: {
			name: params.name,
			projectkey: params.project,
			limit: String(params.limit)
		} }, signal);
		const parsed = safeParseTypeBoxValue(PAGE_SCHEMA, await response.json());
		if (!parsed) throw new Error("Bitbucket repository search returned an unexpected payload shape.");
		return {
			repositories: parsed.values.map((value) => repository(parseTypeBoxValue(REPOSITORY_SCHEMA, value, "Bitbucket repository"))),
			isLastPage: parsed.isLastPage
		};
	}
	async projectExists(project, signal) {
		try {
			await this.request(`/rest/api/1.0/projects/${encodeURIComponent(project)}`, {}, signal);
			return true;
		} catch (error) {
			if (error instanceof BitbucketApiError && error.status === 404) return false;
			throw error;
		}
	}
	async readEntry(repo, path, ref, maxBytes, signal) {
		const { project, slug } = splitRepo(repo);
		const base = `/rest/api/1.0/projects/${encodeURIComponent(project)}/repos/${encodeURIComponent(slug)}`;
		const cleanPath = path.replace(/^\/+|\/+$/g, "");
		const encodedPath = cleanPath.split("/").map(encodeURIComponent).join("/");
		const location = `${repo}/${cleanPath}${ref ? ` at ${ref}` : ""}`;
		const browse = async (browsePath) => {
			try {
				const children = [];
				let start = 0;
				for (let page = 0; page < MAX_LISTING_PAGES$1; page += 1) {
					const response = await this.request(`${base}/browse${browsePath ? `/${browsePath}` : ""}`, { params: {
						at: ref,
						limit: String(LISTING_PAGE_SIZE$1),
						start: String(start)
					} }, signal);
					const parsed = parseTypeBoxValue(BROWSE_SCHEMA, await response.json(), "Bitbucket browse");
					children.push(...parsed.children.values);
					if (parsed.children.isLastPage || parsed.children.nextPageStart === void 0) return children;
					start = parsed.children.nextPageStart;
				}
				throw new Error(`${repo}/${browsePath} has more than ${MAX_LISTING_PAGES$1 * LISTING_PAGE_SIZE$1} entries; clone it with checkout_repo and list it locally.`);
			} catch (error) {
				if (error instanceof BitbucketApiError && error.status === 404) throw new EntryNotFoundError(`Not found: ${location}.\n${error.message}`);
				throw error;
			}
		};
		const slash = cleanPath.lastIndexOf("/");
		const parent = slash === -1 ? "" : cleanPath.slice(0, slash);
		const name = slash === -1 ? cleanPath : cleanPath.slice(slash + 1);
		let type = "directory";
		let size;
		if (cleanPath) {
			const entry = (await browse(parent.split("/").map(encodeURIComponent).join("/"))).find((sibling) => sibling.path.name === name);
			if (!entry) throw new EntryNotFoundError(`Not found: ${location}. Paths are case-sensitive; list ${parent || "the repository root"} to see what is there.`);
			type = browseType(entry.type);
			size = entry.size;
		}
		if (type === "directory") return {
			type: "directory",
			entries: (await browse(encodedPath)).map((child) => ({
				name: child.path.name,
				type: browseType(child.type)
			}))
		};
		if (type === "submodule") try {
			return {
				type: "submodule",
				url: submoduleUrl(await (await this.request(`${base}/raw/.gitmodules`, { params: { at: ref } }, signal)).text(), cleanPath)
			};
		} catch (error) {
			if (error instanceof BitbucketApiError && error.status === 404) return {
				type: "submodule",
				url: void 0
			};
			throw error;
		}
		if (size !== void 0 && size > maxBytes) throw new EntryTooLargeError(size);
		const raw = await this.request(`${base}/raw/${encodedPath}`, { params: { at: ref } }, signal);
		const bytes = Buffer.from(await raw.arrayBuffer());
		return {
			type: "file",
			size: bytes.length,
			bytes
		};
	}
};
function createBitbucketFileReader(client) {
	return { readEntry: (request) => client.readEntry(request.repo, request.path, request.ref, request.maxBytes, request.signal) };
}
// src/core/checkout.ts
const execFileAsync = promisify(execFile);
const FETCH_DEBOUNCE_MS = 9e5;
var CheckoutError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "CheckoutError";
	}
};
const GUIDANCE_FILES = ["AGENTS.md", "CLAUDE.md"];
function repoCachePath(cacheDir, repo) {
	return path.join(cacheDir, "repos", ...repo.split("/"));
}
function normalizeRepoPath(rawPath, input) {
	const parts = rawPath.replace(/^\/+/, "").replace(/\.git$/, "").split("/");
	if (parts.some((part, index) => !(index === 0 ? /^~?[\w.-]+$/ : /^[\w.-]+$/).test(part))) throw invalidRepo(input);
	return parts.join("/");
}
function stripScmPrefix(repoPath) {
	return /^scm\//i.test(repoPath) ? repoPath.slice(4) : repoPath;
}
function declaredKind(sources, hostname) {
	return sources.find((source) => new URL(source.url).hostname.toLowerCase() === hostname)?.kind;
}
function invalidRepo(input) {
	return new CheckoutError(`Invalid repository "${input}". Pass a host-relative repository path with source, or an HTTPS/SSH repository URL without source.`);
}
function repoIdentity(host, repoPath) {
	return `${host.replace(/:\d+$/, "")}/${repoPath}`.toLowerCase();
}
function parseUrlReference(trimmed, input, sources) {
	let url;
	try {
		url = new URL(trimmed.replace(/\.git$/, ""));
	} catch {
		throw invalidRepo(input);
	}
	if (url.protocol !== "https:" && url.protocol !== "ssh:") throw invalidRepo(input);
	const urlRepoPath = normalizeRepoPath(url.pathname, input);
	const host = url.host.toLowerCase();
	const repoPath = url.protocol === "https:" && declaredKind(sources, url.hostname.toLowerCase()) === "bitbucket-server" ? stripScmPrefix(urlRepoPath) : urlRepoPath;
	const user = url.username || "git";
	const cloneUrl = url.protocol === "https:" ? `https://${host}/${urlRepoPath}.git` : `ssh://${user}@${host}/${urlRepoPath}.git`;
	return {
		key: repoIdentity(host, repoPath),
		cloneUrls: [cloneUrl]
	};
}
function parseScpReference(trimmed, input) {
	const match = /^(?<user>[\w.-]+)@(?<host>[\w.-]+):(?<path>[\w./-]+?)(?:\.git)?$/.exec(trimmed);
	if (!match?.groups) return;
	const user = match.groups.user;
	const rawHost = match.groups.host;
	const rawPath = match.groups.path;
	if (!user || !rawHost || !rawPath) throw invalidRepo(input);
	const host = rawHost.toLowerCase();
	const repoPath = normalizeRepoPath(rawPath, input);
	return {
		key: repoIdentity(host, repoPath),
		cloneUrls: [`${user}@${host}:${repoPath}.git`]
	};
}
function parseCloneUrlReference(trimmed, input, sources) {
	return /^[a-z][\w+.-]*:\/\//i.test(trimmed) ? parseUrlReference(trimmed, input, sources) : parseScpReference(trimmed, input);
}
function cloneSources(sources) {
	return sources.filter((source) => source.roles.includes("clone"));
}
function resolveCloneSource(sources, sourceName) {
	const candidates = cloneSources(sources);
	const source = candidates.find((source) => source.name === sourceName);
	if (source) return source;
	const usable = `Pass an HTTPS/SSH clone URL, or use one of: ${candidates.map((source) => source.name).join(", ")}.`;
	const declared = sources.find((source) => source.name === sourceName);
	if (declared) throw new CheckoutError(`Source "${sourceName}" cannot clone (${declared.kind === "sourcegraph" ? "kind sourcegraph" : "cloning disabled in settings"}). ${usable}`);
	throw new CheckoutError(`Unknown source "${sourceName}". ${usable}`);
}
function deriveReference(trimmed, input, source) {
	let repoPath = normalizeRepoPath(trimmed.replace(/^\/+/, ""), input);
	let prefix;
	switch (source.kind) {
		case "github":
			if (repoPath.split("/").length !== 2) throw new CheckoutError(`Invalid repository "${input}" for source "${source.name}". GitHub requires exactly owner/repo.`);
			prefix = "";
			break;
		case "gitlab":
			prefix = "";
			break;
		case "bitbucket-server":
			repoPath = stripScmPrefix(repoPath);
			prefix = "scm/";
	}
	const baseUrl = new URL(source.url);
	const host = baseUrl.host.toLowerCase();
	return {
		key: repoIdentity(host, repoPath),
		cloneUrls: [`${baseUrl.protocol}//${host}/${prefix}${repoPath}.git`]
	};
}
function parseRepoReference(input, sources, sourceName) {
	const trimmed = input.trim().replace(/\/+$/, "");
	const cloneUrlReference = parseCloneUrlReference(trimmed, input, sources);
	if (cloneUrlReference) {
		if (sourceName) throw new CheckoutError(`Repository "${input}" is already a clone URL. Remove source "${sourceName}".`);
		return cloneUrlReference;
	}
	const clonable = cloneSources(sources);
	const only = clonable.length === 1 ? clonable[0] : void 0;
	if (!sourceName && only) return deriveReference(trimmed, input, only);
	if (!sourceName) throw new CheckoutError(`Repository "${input}" is a shorthand path. Pass source to select its code host, or pass an HTTPS/SSH clone URL.`);
	return deriveReference(trimmed, input, resolveCloneSource(sources, sourceName));
}
function redactCredentials(text) {
	return text.replace(/(\w+:\/\/)[^/\s@]*:[^/\s@]*@/g, "$1<redacted>@");
}
async function git(args, cwd, signal) {
	try {
		const { stdout } = await execFileAsync("git", args, {
			...cwd ? { cwd } : {},
			...signal ? { signal } : {},
			timeout: 3e5,
			maxBuffer: 33554432,
			env: {
				...process.env,
				GIT_TERMINAL_PROMPT: "0"
			}
		});
		return stdout.trim();
	} catch (error) {
		const message = (error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "").trim() || (error instanceof Error ? error.message : String(error));
		throw new CheckoutError(`git ${args[0]} failed: ${redactCredentials(message).slice(0, 500)}`);
	}
}
async function pathExists(target) {
	try {
		await fs.access(target);
		return true;
	} catch {
		return false;
	}
}
async function currentRemoteKey(dest, sources, signal) {
	try {
		const remoteUrl = await git([
			"remote",
			"get-url",
			"origin"
		], dest, signal);
		return parseCloneUrlReference(remoteUrl, remoteUrl, sources)?.key;
	} catch {
		return;
	}
}
async function clone(reference, dest, signal) {
	await fs.mkdir(path.dirname(dest), { recursive: true });
	const failures = [];
	for (const url of reference.cloneUrls) try {
		await git([
			"clone",
			"--filter=blob:none",
			url,
			dest
		], void 0, signal);
		return;
	} catch (error) {
		failures.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
		await fs.rm(dest, {
			recursive: true,
			force: true
		});
	}
	throw new CheckoutError(`Could not clone ${reference.key}. Tried ${failures.length} URL(s):\n${failures.join("\n")}\nPass the exact clone URL if this host uses a different layout, or check that credentials for it are configured.`);
}
async function fetchIfStale(dest, signal) {
	let lastFetched = 0;
	try {
		lastFetched = (await fs.stat(path.join(dest, ".git", "FETCH_HEAD"))).mtimeMs;
	} catch {}
	if (Date.now() - lastFetched < FETCH_DEBOUNCE_MS) return;
	await git([
		"fetch",
		"origin",
		"--prune"
	], dest, signal);
}
async function defaultBranch(repo, dest, signal) {
	try {
		return (await git(["symbolic-ref", "refs/remotes/origin/HEAD"], dest, signal)).replace("refs/remotes/origin/", "");
	} catch {
		try {
			await git([
				"remote",
				"set-head",
				"origin",
				"--auto"
			], dest, signal);
		} catch (error) {
			if (error instanceof Error && error.message.includes("Cannot determine remote HEAD")) throw new CheckoutError(`Cloned ${repo}, but it has no remote HEAD and may be empty. Pass a ref after the repository has a commit.`);
			throw error;
		}
		return (await git(["symbolic-ref", "refs/remotes/origin/HEAD"], dest, signal)).replace("refs/remotes/origin/", "");
	}
}
async function checkoutRepo(repoInput, sources, sourceName, ref, cacheDir, signal) {
	const repo = parseRepoReference(repoInput, sources, sourceName);
	const dest = repoCachePath(cacheDir, repo.key);
	const reusedClone = await pathExists(path.join(dest, ".git")) && await currentRemoteKey(dest, sources, signal) === repo.key;
	if (!reusedClone) await fs.rm(dest, {
		recursive: true,
		force: true
	});
	if (reusedClone) await fetchIfStale(dest, signal);
	else await clone(repo, dest, signal);
	let checkedOutRef;
	if (ref) {
		try {
			await git([
				"fetch",
				"origin",
				ref
			], dest, signal);
			await git([
				"checkout",
				"--force",
				"--detach",
				"FETCH_HEAD"
			], dest, signal);
		} catch {
			await git([
				"checkout",
				"--force",
				"--detach",
				ref
			], dest, signal);
		}
		await git([
			"reset",
			"--hard",
			"HEAD"
		], dest, signal);
		checkedOutRef = ref;
	} else {
		const branch = await defaultBranch(repo.key, dest, signal);
		await git([
			"checkout",
			"--force",
			branch
		], dest, signal);
		await git([
			"reset",
			"--hard",
			`origin/${branch}`
		], dest, signal);
		checkedOutRef = branch;
	}
	await git(["clean", "-fdx"], dest, signal);
	const headSha = await git(["rev-parse", "HEAD"], dest, signal);
	const files = await git(["ls-files"], dest, signal);
	const paths = files.length === 0 ? [] : files.split("\n");
	const guidance = GUIDANCE_FILES.filter((name) => paths.includes(name));
	return {
		repo: repo.key,
		path: dest,
		headSha,
		ref: checkedOutRef,
		fileCount: paths.length,
		guidance,
		reusedClone
	};
}
// src/core/credential-command.ts
const execAsync = promisify(exec);
async function runCredentialCommand(command, label, signal) {
	let value;
	try {
		const child = execAsync(command, {
			timeout: 3e4,
			maxBuffer: 65536,
			...signal ? { signal } : {}
		});
		child.child.stdin?.end();
		value = (await child).stdout.trim();
	} catch {
		throw new Error(`${label} failed`);
	}
	if (!value || /\s/.test(value)) throw new Error(`${label} must print a single nonempty value`);
	return value;
}
// src/core/gitlab.ts
var GitLabApiError = class extends Error {
	status;
	constructor(message, status) {
		super(message);
		this.status = status;
		this.name = "GitLabApiError";
	}
};
const CODE_SEARCHES_PER_WINDOW = 30;
const LISTING_PAGE_SIZE = 1e3;
const MAX_LISTING_PAGES = 20;
const RATE_WINDOW_MS = 6e4;
var CodeSearchWindow = class {
	now;
	windowStart = 0;
	used = 0;
	constructor(now) {
		this.now = now;
	}
	take() {
		const now = this.now();
		if (now - this.windowStart >= RATE_WINDOW_MS) {
			this.windowStart = now;
			this.used = 0;
		}
		if (this.used >= CODE_SEARCHES_PER_WINDOW) {
			const wait = Math.ceil((this.windowStart + RATE_WINDOW_MS - now) / 1e3);
			throw new GitLabApiError(`GitLab allows ${CODE_SEARCHES_PER_WINDOW} code searches a minute; the next one is possible in ${wait}s.`, 429);
		}
		this.used += 1;
	}
};
const MESSAGE_SCHEMA = _Object_({
	message: Optional(Unknown()),
	error: Optional(String$1())
});
function errorMessage(body) {
	try {
		const parsed = safeParseTypeBoxValue(MESSAGE_SCHEMA, JSON.parse(body));
		if (parsed?.error) return parsed.error;
		if (typeof parsed?.message === "string") return parsed.message;
		const nested = safeParseTypeBoxValue(MESSAGE_SCHEMA, parsed?.message);
		if (nested?.error) return nested.error;
	} catch {}
	return body.slice(0, 200);
}
function listBody(body) {
	if (!Array.isArray(body)) throw new Error("GitLab returned an object where it lists results.");
	return body;
}
const PROJECT_SCHEMA = _Object_({
	id: Number$1(),
	path_with_namespace: String$1(),
	default_branch: Optional(Union([String$1(), Null()])),
	repository_access_level: Optional(String$1())
});
const BLOB_HIT_SCHEMA = _Object_({
	id: Union([String$1(), Null()]),
	path: String$1(),
	data: String$1(),
	ref: String$1(),
	startline: Number$1(),
	project_id: Number$1()
});
const PROJECT_SEARCH_ITEM_SCHEMA = _Object_({
	path_with_namespace: String$1(),
	web_url: String$1(),
	description: Optional(Union([String$1(), Null()])),
	star_count: Optional(Number$1()),
	last_activity_at: Optional(String$1()),
	topics: Optional(_Array_(String$1()))
});
const TREE_ENTRY_SCHEMA = _Object_({
	name: String$1(),
	type: String$1(),
	mode: String$1()
});
function treeEntryType(entry) {
	if (entry.type === "tree") return "directory";
	if (entry.type === "commit") return "submodule";
	return entry.mode === "120000" ? "symlink" : "file";
}
var GitLabClient = class {
	url;
	token;
	codeSearches;
	projects = /* @__PURE__ */ new Map();
	constructor(url, token, now) {
		this.url = url;
		this.token = token;
		this.codeSearches = new CodeSearchWindow(now);
	}
	async authorize() {
		await this.token();
	}
	async request(path, params, signal, method = "GET") {
		const url = new URL(`/api/v4${path}`, this.url);
		for (const [key, value] of Object.entries(params)) if (value !== void 0) url.searchParams.set(key, value);
		const response = await fetch(url, {
			method,
			headers: {
				"private-token": await this.token(),
				"user-agent": "pi-librarian"
			},
			...signal ? { signal } : {}
		});
		if (!response.ok) {
			const message = method === "HEAD" ? response.statusText : errorMessage(await response.text());
			if (response.status === 401) throw new GitLabApiError(`GitLab rejected the token (401): ${message}`, 401);
			throw new GitLabApiError(`GitLab API ${response.status}: ${message}`, response.status);
		}
		return response;
	}
	resolveProject(path, signal) {
		const key = path.toLowerCase();
		let project = this.projects.get(key);
		if (!project) {
			project = this.request(`/projects/${encodeURIComponent(path)}`, {}, signal).then(async (response) => {
				const parsed = safeParseTypeBoxValue(PROJECT_SCHEMA, await response.json());
				if (!parsed) throw new Error(`GitLab project ${path} returned an unexpected payload shape.`);
				const resolved = {
					id: parsed.id,
					path: parsed.path_with_namespace,
					defaultBranch: parsed.default_branch ?? void 0,
					repositoryRestricted: parsed.repository_access_level !== void 0 && parsed.repository_access_level !== "enabled"
				};
				if (!this.projects.has(String(parsed.id))) this.projects.set(String(parsed.id), Promise.resolve(resolved));
				return resolved;
			}).catch((error) => {
				this.projects.delete(key);
				if (error instanceof GitLabApiError && error.status === 404) throw new GitLabApiError(`No GitLab project ${path}, or it is not visible to this token.`, 404);
				throw error;
			});
			this.projects.set(key, project);
		}
		return project;
	}
	async refExists(projectId, ref, signal) {
		try {
			await this.request(`/projects/${projectId}/repository/commits/${encodeURIComponent(ref)}`, {}, signal);
			return true;
		} catch (error) {
			if (error instanceof GitLabApiError && error.status === 404) return false;
			throw error;
		}
	}
	async searchBlobs(scope, search, ref, page, perPage, signal) {
		this.codeSearches.take();
		const path = scope === "instance" ? "/search" : `/projects/${scope.projectId}/search`;
		const response = await this.request(path, {
			scope: "blobs",
			search,
			search_type: scope === "instance" ? void 0 : "basic",
			ref,
			page: String(page),
			per_page: String(perPage)
		}, signal);
		const body = await response.json();
		const hits = [];
		for (const item of listBody(body)) {
			const parsed = parseTypeBoxValue(BLOB_HIT_SCHEMA, item, "GitLab code search result");
			hits.push({
				pathMatch: parsed.id !== null,
				path: parsed.path,
				data: parsed.data,
				ref: parsed.ref,
				startline: parsed.startline,
				projectId: parsed.project_id
			});
		}
		const total = Number(response.headers.get("x-total"));
		return {
			hits,
			total: Number.isFinite(total) && response.headers.has("x-total") ? total : void 0,
			hasNextPage: (response.headers.get("x-next-page") ?? "") !== ""
		};
	}
	async projectPath(projectId, signal) {
		return (await this.resolveProject(String(projectId), signal)).path;
	}
	async searchProjects(params, signal) {
		const response = await this.request("/projects", params, signal);
		const body = await response.json();
		const hits = [];
		for (const item of listBody(body)) {
			const parsed = parseTypeBoxValue(PROJECT_SEARCH_ITEM_SCHEMA, item, "GitLab project search result");
			hits.push({
				path: parsed.path_with_namespace,
				url: parsed.web_url,
				description: parsed.description || void 0,
				stars: parsed.star_count,
				lastActivityAt: parsed.last_activity_at,
				topics: parsed.topics ?? []
			});
		}
		const total = Number(response.headers.get("x-total"));
		return {
			total: response.headers.has("x-total") && Number.isFinite(total) ? total : void 0,
			hits
		};
	}
	async submoduleTarget(projectId, path, ref, signal) {
		try {
			return submoduleUrl(await (await this.request(`/projects/${projectId}/repository/files/.gitmodules/raw`, { ref }, signal)).text(), path);
		} catch (error) {
			if (error instanceof GitLabApiError && error.status === 404) return;
			throw error;
		}
	}
	async readEntry(projectPath, path, ref, maxBytes, signal) {
		const project = await this.resolveProject(projectPath, signal);
		const cleanPath = path.replace(/^\/+|\/+$/g, "");
		const location = `${project.path}/${cleanPath}${ref ? ` at ${ref}` : ""}`;
		const treeEntries = async (treePath) => {
			const entries = [];
			for (let page = 1; page <= MAX_LISTING_PAGES; page += 1) {
				const response = await this.request(`/projects/${project.id}/repository/tree`, {
					path: treePath || void 0,
					ref,
					per_page: String(LISTING_PAGE_SIZE),
					page: String(page)
				}, signal);
				for (const item of listBody(await response.json())) entries.push(parseTypeBoxValue(TREE_ENTRY_SCHEMA, item, "GitLab tree entry"));
				if ((response.headers.get("x-next-page") ?? "") === "") return entries;
			}
			throw new Error(`${project.path}/${treePath} has more than ${MAX_LISTING_PAGES * LISTING_PAGE_SIZE} entries; clone it with checkout_repo and list it locally.`);
		};
		const slash = cleanPath.lastIndexOf("/");
		const parent = slash === -1 ? "" : cleanPath.slice(0, slash);
		const name = slash === -1 ? cleanPath : cleanPath.slice(slash + 1);
		let type = "directory";
		if (cleanPath) {
			let siblings;
			try {
				siblings = await treeEntries(parent);
			} catch (error) {
				if (error instanceof GitLabApiError && error.status === 404) throw new EntryNotFoundError(`Not found: ${location}.\nGitLab says: ${error.message}`);
				throw error;
			}
			const entry = siblings.find((sibling) => sibling.name === name);
			if (!entry) throw new EntryNotFoundError(`Not found: ${location}. Paths are case-sensitive; list ${parent || "the repository root"} to see what is there.`);
			type = treeEntryType(entry);
		}
		if (type === "directory") return {
			type: "directory",
			entries: (await treeEntries(cleanPath)).map((entry) => ({
				name: entry.name,
				type: treeEntryType(entry)
			}))
		};
		if (type === "submodule") return {
			type: "submodule",
			url: await this.submoduleTarget(project.id, cleanPath, ref, signal)
		};
		const rawPath = `/projects/${project.id}/repository/files/${encodeURIComponent(cleanPath)}/raw`;
		const head = await this.request(rawPath, { ref }, signal, "HEAD");
		const size = Number(head.headers.get("x-gitlab-size"));
		if (Number.isFinite(size) && size > maxBytes) throw new EntryTooLargeError(size);
		const bytes = Buffer.from(await (await this.request(rawPath, { ref }, signal)).arrayBuffer());
		if (type === "symlink") return {
			type: "symlink",
			target: bytes.toString("utf-8").trim()
		};
		return {
			type: "file",
			size: bytes.length,
			bytes
		};
	}
};
function createGitLabFileReader(client) {
	return { readEntry: (request) => client.readEntry(request.repo, request.path, request.ref, request.maxBytes, request.signal) };
}
// src/core/sourcegraph.ts
var SourcegraphError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "SourcegraphError";
	}
};
const SKIPPED_SCHEMA = _Object_({
	reason: String$1(),
	title: String$1()
});
const PROGRESS_SCHEMA = _Object_({
	done: Boolean$1(),
	matchCount: Number$1(),
	repositoriesCount: Optional(Number$1()),
	durationMs: Number$1(),
	skipped: Optional(_Array_(SKIPPED_SCHEMA))
});
const ALERT_SCHEMA = _Object_({
	title: String$1(),
	description: Optional(Union([String$1(), Null()]))
});
const ERROR_SCHEMA = _Object_({ message: String$1() });
const LINE_MATCH_SCHEMA = _Object_({
	line: String$1(),
	lineNumber: Number$1()
});
const SYMBOL_SCHEMA = _Object_({
	name: String$1(),
	containerName: Optional(String$1()),
	kind: String$1(),
	line: Number$1()
});
const MATCH_SCHEMA = _Object_({
	type: String$1(),
	repository: String$1(),
	path: Optional(String$1()),
	commit: Optional(String$1()),
	description: Optional(String$1()),
	fork: Optional(Boolean$1()),
	archived: Optional(Boolean$1()),
	lineMatches: Optional(Union([_Array_(LINE_MATCH_SCHEMA), Null()])),
	symbols: Optional(_Array_(SYMBOL_SCHEMA))
});
function toMatch(value) {
	const parsed = parseTypeBoxValue(MATCH_SCHEMA, value, "Sourcegraph match");
	return {
		type: parsed.type,
		repository: parsed.repository,
		path: parsed.path,
		commit: parsed.commit,
		description: parsed.description,
		fork: parsed.fork ?? false,
		archived: parsed.archived ?? false,
		lines: (parsed.lineMatches ?? []).map((line) => ({
			lineNumber: line.lineNumber + 1,
			text: line.line
		})),
		symbols: (parsed.symbols ?? []).map((symbol) => ({
			name: symbol.name,
			containerName: symbol.containerName || void 0,
			kind: symbol.kind,
			line: symbol.line
		}))
	};
}
var SourcegraphClient = class {
	url;
	token;
	constructor(url, token) {
		this.url = url;
		this.token = token;
	}
	async authorize() {
		await this.token();
	}
	async streamSearch(params) {
		const url = new URL("/.api/search/stream", this.url);
		url.searchParams.set("q", params.query);
		url.searchParams.set("v", "V3");
		url.searchParams.set("t", params.patternType);
		const response = await fetch(url, {
			headers: {
				authorization: `token ${await this.token()}`,
				accept: "text/event-stream",
				"user-agent": "pi-librarian"
			},
			signal: params.signal
		});
		if (response.status === 401 || response.status === 403) throw new SourcegraphError(`Sourcegraph rejected the token (${response.status}): ${(await response.text()).trim().slice(0, 200)}`);
		if (!response.ok || !response.body) throw new SourcegraphError(`Sourcegraph search returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
		const result = {
			matches: [],
			progress: {
				matchCount: 0,
				repositoriesCount: 0,
				durationMs: 0,
				skipped: []
			},
			done: false,
			alerts: []
		};
		const handle = (event, data) => {
			const payload = JSON.parse(data);
			switch (event) {
				case "matches":
					if (!Array.isArray(payload)) throw new SourcegraphError("Sourcegraph matches event was not a list.");
					for (const value of payload) result.matches.push(toMatch(value));
					break;
				case "progress": {
					const progress = parseTypeBoxValue(PROGRESS_SCHEMA, payload, "Sourcegraph progress");
					result.progress = {
						matchCount: progress.matchCount,
						repositoriesCount: progress.repositoriesCount ?? 0,
						durationMs: progress.durationMs,
						skipped: (progress.skipped ?? []).map((skipped) => ({
							reason: skipped.reason,
							title: skipped.title
						}))
					};
					break;
				}
				case "alert": {
					const alert = parseTypeBoxValue(ALERT_SCHEMA, payload, "Sourcegraph alert");
					result.alerts.push({
						title: alert.title,
						description: alert.description ?? void 0
					});
					break;
				}
				case "error": throw new SourcegraphError(`Sourcegraph: ${safeParseTypeBoxValue(ERROR_SCHEMA, payload)?.message ?? data.slice(0, 200)}`);
				case "done": result.done = true;
			}
		};
		const decoder = new TextDecoder();
		let buffer = "";
		try {
			for await (const chunk of response.body) {
				buffer += decoder.decode(chunk, { stream: true });
				let boundary = buffer.indexOf("\n\n");
				while (boundary !== -1) {
					const block = buffer.slice(0, boundary);
					buffer = buffer.slice(boundary + 2);
					let event = "message";
					const data = [];
					for (const line of block.split("\n")) if (line.startsWith("event:")) event = line.slice(6).trim();
					else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
					if (data.length > 0) handle(event, data.join("\n"));
					boundary = buffer.indexOf("\n\n");
				}
			}
		} catch (error) {
			params.onPartial(result);
			throw error;
		}
		return result;
	}
};
const DEFAULT_MAX_BYTES = 51200;
function formatSize(bytes) {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / 1048576).toFixed(1)}MB`;
}
function truncateHead(content) {
	const lines = content.length === 0 ? [] : content.split("\n");
	if (content.endsWith("\n")) lines.pop();
	if (lines.length <= 2e3 && Buffer.byteLength(content, "utf-8") <= 51200) return {
		content,
		truncated: false,
		truncatedBy: null,
		outputLines: lines.length,
		firstLineExceedsLimit: false
	};
	if (Buffer.byteLength(lines[0] ?? "", "utf-8") > 51200) return {
		content: "",
		truncated: true,
		truncatedBy: "bytes",
		outputLines: 0,
		firstLineExceedsLimit: true
	};
	const kept = [];
	let bytes = 0;
	let truncatedBy = "lines";
	for (const [index, line] of lines.entries()) {
		if (index >= 2e3) break;
		const lineBytes = Buffer.byteLength(line, "utf-8") + (index > 0 ? 1 : 0);
		if (bytes + lineBytes > 51200) {
			truncatedBy = "bytes";
			break;
		}
		kept.push(line);
		bytes += lineBytes;
	}
	if (kept.length >= 2e3) truncatedBy = "lines";
	return {
		content: kept.join("\n"),
		truncated: true,
		truncatedBy,
		outputLines: kept.length,
		firstLineExceedsLimit: false
	};
}
// src/core/delivery.ts
async function writeSearchArtifact(cacheDir, toolCallId, records) {
	const directory = path.join(cacheDir, "searches", toolCallId.replace(/[^\w.-]/g, "_"));
	await fs.mkdir(directory, { recursive: true });
	const artifactPath = path.join(directory, "results.jsonl");
	const body = records.map((record) => `${JSON.stringify(record)}\n`).join("");
	await fs.writeFile(artifactPath, body);
	return {
		path: artifactPath,
		lineCount: records.length,
		byteCount: Buffer.byteLength(body)
	};
}
const MAX_LINE_CHARS = 200;
function clipLine(text) {
	const trimmed = text.trimEnd();
	return trimmed.length <= MAX_LINE_CHARS ? trimmed : `${trimmed.slice(0, MAX_LINE_CHARS)}…`;
}
function formatCount(count) {
	return count.toLocaleString("en-US");
}
function plural(count, singular, pluralForm = `${singular}s`) {
	return `${formatCount(count)} ${count === 1 ? singular : pluralForm}`;
}
function formatArtifact(artifact) {
	return `${artifact.path} (${plural(artifact.lineCount, "line")}, ${formatSize(artifact.byteCount)})`;
}
function formatDigestHeader(header) {
	const completeness = header.complete === void 0 ? "" : header.complete ? " Complete." : ` Incomplete: ${header.incompleteReason ?? "the engine did not cover every repository"}.`;
	const shown = header.shownCount === header.fetchedCount ? `showing all ${formatCount(header.shownCount)}` : `showing ${formatCount(header.shownCount)}`;
	return [`${header.found} (${header.source}).${completeness}`, `Fetched ${formatCount(header.fetchedCount)}${header.limitHit ? " (limit)" : ""}; ${shown}. Full results: ${formatArtifact(header.artifact)}`].join("\n");
}
function indent(text, prefix) {
	return text.split("\n").map((line) => `${prefix}${line}`).join("\n");
}
function formatEntryHeadline(entry) {
	return `${entry.label}${entry.revision ? ` (${entry.revision})` : ""}`;
}
function formatEntries(entries) {
	const width = String(entries.length).length;
	const lines = [];
	let currentGroup;
	for (const [index, entry] of entries.entries()) {
		if (entry.group && entry.group.label !== currentGroup) {
			currentGroup = entry.group.label;
			lines.push(entry.group.cloneSource ? `${entry.group.label} — clone with source: ${entry.group.cloneSource}` : entry.group.label);
		}
		const number = `${String(index + 1).padStart(width)}.`;
		lines.push(` ${number} ${formatEntryHeadline(entry)}${entry.meta ? ` — ${entry.meta}` : ""}`);
		if (entry.detail) lines.push(indent(entry.detail, " ".repeat(width + 3)));
	}
	return lines.join("\n");
}
function formatDigest(header, entries) {
	const headerText = formatDigestHeader(header);
	return entries.length === 0 ? headerText : `${headerText}\n\n${formatEntries(entries)}`;
}
// src/core/tool.ts
function defineTool(tool) {
	return tool;
}
// src/core/tools/names.ts
const LIBRARIAN_TOOL_NAMES = {
	searchCodeGitHub: "search_code_github",
	searchCodeGrepApp: "search_code_grepapp",
	searchCodeSourcegraph: "search_code_sourcegraph",
	searchCodeGitLab: "search_code_gitlab",
	searchCodeBitbucket: "search_code_bitbucket",
	searchReposGitHub: "search_repos_github",
	searchReposSourcegraph: "search_repos_sourcegraph",
	searchReposGitLab: "search_repos_gitlab",
	searchReposBitbucket: "search_repos_bitbucket",
	findDefinition: "find_definition",
	readFile: "read_file",
	checkoutRepo: "checkout_repo",
	provideResults: "provide_results"
};
Object.values(LIBRARIAN_TOOL_NAMES);
// src/core/budget.ts
var SearchTimeoutError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "SearchTimeoutError";
	}
};
function searchTimeoutMessage(timeoutSeconds, found, advice) {
	return `${found ? `${timeoutSeconds}s limit hit; ${found} found.` : `${timeoutSeconds}s limit hit before any results arrived.`}\nNarrow it before retrying: ${advice}`;
}
async function withSearchDeadline(deadlineMs, signal, onExpired, run) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(/* @__PURE__ */ new Error("search deadline")), deadlineMs);
	const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
	const expired = () => controller.signal.aborted && !signal?.aborted;
	try {
		return await run({
			signal: combined,
			expired
		});
	} catch (error) {
		if (expired()) throw onExpired();
		throw error;
	} finally {
		clearTimeout(timer);
	}
}
// src/core/tools/shared.ts
function limitParameter(maximum, defaultLimit) {
	return Optional(Integer({
		minimum: 1,
		maximum,
		description: `How many results to return. Default: ${defaultLimit}. Raise it only when the first results did not answer the question; each result with matched lines costs about 1 KB of context.`
	}));
}
function resolveLimit(requested, search, maximum) {
	return Math.min(requested ?? search.defaultLimit, maximum, 50);
}
function sourceLabels(sources) {
	return sources.map((source) => `${source.name} (${new URL(source.url).host})`).join(", ");
}
function sourceProperties(instances, description) {
	return instances.length > 1 ? { source: StringEnum(instances.map((instance) => instance.name), { description: `${description}: ${sourceLabels(instances)}.` }) } : {};
}
function selectInstance(instances, params) {
	if (instances.length === 1 && instances[0]) return instances[0];
	const requested = "source" in params && typeof params.source === "string" ? params.source : void 0;
	const instance = instances.find((candidate) => candidate.name === requested);
	if (!instance) throw new Error(`Unknown source "${requested ?? ""}". Use one of: ${instances.map((candidate) => candidate.name).join(", ")}.`);
	return instance;
}
function rejectUnsafeValue(argument, value) {
	const trimmed = value.trim();
	if (trimmed.length === 0) throw new Error(`${argument} cannot be blank.`);
	if (/[\s"'()]/.test(trimmed)) throw new Error(`${argument} cannot contain spaces, quotes, or parentheses: "${value}".`);
	return trimmed;
}
function validateIsoDate(argument, value) {
	const trimmed = value.trim();
	if (!/^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed) || Number.isNaN(Date.parse(`${trimmed}T00:00:00Z`))) throw new Error(`${argument} must be a date as YYYY-MM-DD, e.g. 2026-01-01: "${value}".`);
	return trimmed;
}
function runRestSearch(search, signal, advice, run) {
	return withSearchDeadline(search.timeoutSeconds * 1e3, signal, () => new SearchTimeoutError(searchTimeoutMessage(search.timeoutSeconds, void 0, advice)), (deadline) => run(deadline.signal));
}
// src/core/tools/checkout-repo.ts
function createCheckoutRepoTool(cacheDir, sources) {
	const clonable = cloneSources(sources);
	const CheckoutRepoParams = _Object_({
		repo: String$1({ description: "Repository path, e.g. platform/widget-sdk, or a full HTTPS or SSH clone URL." }),
		source: Optional(StringEnum(clonable.map((source) => source.name), { description: clonable.length === 1 ? `Source for the code: ${sourceLabels(clonable)}, the only one, so it may be omitted.` : `Source for the code: ${sourceLabels(clonable)}. Omit when repo is a full clone URL.` })),
		ref: Optional(String$1({ description: "Branch, tag, or commit. To check a search result, pass its commit so line numbers agree. Default: the default branch." }))
	});
	return defineTool({
		name: LIBRARIAN_TOOL_NAMES.checkoutRepo,
		label: "Checkout repo",
		description: "Clone a repository into a local cache and check out a branch, tag, or commit, returning its path for grep, read, and git log, blame, and diff. Clones are reused across calls.",
		promptGuidelines: ["Do not clone repositories with git directly; use checkout_repo."],
		parameters: CheckoutRepoParams,
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			openWorldHint: true
		},
		async execute(_toolCallId, params, signal) {
			try {
				const result = await checkoutRepo(params.repo, sources, params.source, params.ref, cacheDir, signal);
				return {
					content: [{
						type: "text",
						text: [
							`Checked out ${params.source ? `${params.repo} (${params.source})` : params.repo} at ${result.ref}, commit ${result.headSha.slice(0, 12)}.`,
							`Local path: ${result.path}`,
							`${plural(result.fileCount, "file")}.`,
							...result.guidance.length > 0 ? [`Agent guidance at the repository root: ${result.guidance.join(", ")}.`] : []
						].join("\n")
					}],
					details: {
						kind: "checkout_repo",
						source: params.source,
						repo: params.repo,
						identity: result.repo,
						path: result.path,
						ref: result.ref,
						headSha: result.headSha,
						fileCount: result.fileCount
					}
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				throw new Error(`${message}\nIf the repository name is uncertain, resolve it with a repository search first.`);
			}
		}
	});
}
// src/core/tools/sourcegraph-search.ts
const CLIENT_GRACE_MS = 3e3;
const COMPLETE_SKIP_REASONS = /* @__PURE__ */ new Set(["repository-fork", "repository-archived"]);
var SourcegraphAlertError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "SourcegraphAlertError";
	}
};
function alertText(alert) {
	return alert.description ? `${alert.title}: ${alert.description}` : alert.title;
}
async function runSourcegraphSearch(request) {
	const { search } = request;
	const timeoutMs = search.timeoutSeconds * 1e3;
	let partial;
	const timeoutError = (found) => new SearchTimeoutError(searchTimeoutMessage(search.timeoutSeconds, found ? request.describeFound(found) : void 0, request.advice));
	await request.client.authorize();
	const result = await withSearchDeadline(timeoutMs + CLIENT_GRACE_MS, request.signal, () => timeoutError(partial), (deadline) => request.client.streamSearch({
		query: `${request.query} timeout:${search.timeoutSeconds}s`,
		patternType: request.patternType,
		signal: deadline.signal,
		onPartial: (found) => {
			partial = found;
		}
	}));
	const skipped = result.progress.skipped;
	if (!result.done || result.progress.durationMs >= timeoutMs || skipped.some((entry) => entry.reason === "shard-timeout")) throw timeoutError(result);
	if (result.matches.length === 0 && result.alerts.length > 0) throw new SourcegraphAlertError(result.alerts.map(alertText).join("\n"));
	const shortfall = skipped.filter((entry) => !COMPLETE_SKIP_REASONS.has(entry.reason));
	return {
		result,
		complete: shortfall.length === 0,
		incompleteReason: shortfall.length === 0 ? void 0 : shortfall.map((entry) => entry.reason === "shard-match-limit" ? "reached the result limit for one search" : entry.title).join("; "),
		warnings: result.alerts.map(alertText)
	};
}
function validateRe2(argument, pattern) {
	if (/\(\?<?[=!]/.test(pattern)) throw new Error(`${argument} uses lookaround, which RE2 does not support.`);
	if (/\\[1-9]/.test(pattern)) throw new Error(`${argument} uses a backreference, which RE2 does not support.`);
	const javascript = pattern.replace(/\(\?[imsU]+\)/g, "").replace(/\(\?[imsU]*-?[imsU]*:/g, "(?:").replace(/\(\?P</g, "(?<").replace(/\[\[:[a-z]+:\]\]/g, "\\w").replace(/\\[pP]\{?[A-Za-z]+\}?/g, "\\w").replace(/\\[Az]/g, "");
	try {
		new RegExp(javascript);
	} catch (error) {
		throw new Error(`${argument} is not a valid regular expression: ${error instanceof Error ? error.message : String(error)}`);
	}
	return pattern;
}
function validateRegex(argument, pattern) {
	const trimmed = pattern.trim();
	if (trimmed.length === 0) throw new Error(`${argument} cannot be blank.`);
	if (/[\s"']/.test(trimmed)) throw new Error(`${argument} cannot contain spaces or quotes; use \\s or \\x22 in the pattern: "${pattern}".`);
	return validateRe2(argument, trimmed);
}
function repoFilter(patterns) {
	if (!patterns || patterns.length === 0) return;
	const validated = patterns.map((pattern) => validateRegex("repos", pattern));
	return validated.length === 1 ? `repo:${validated[0]}` : `repo:${validated.map((pattern) => `(?:${pattern})`).join("|")}`;
}
function rejectKeywordFilters(pattern) {
	const trimmed = pattern.trim();
	const unquoted = trimmed.replace(/"[^"]*"/g, " ");
	const filter = /(^|[\s(])(-?[A-Za-z_.]+):\S/.exec(unquoted);
	if (filter) throw new Error(`pattern contains a filter "${filter[2]}:". Use the repos, path, and language arguments instead, or quote it to search for the text.`);
	return trimmed;
}
function mapRepository(name, cloneSources) {
	const [host, ...rest] = name.split("/");
	const source = cloneSources.find((candidate) => new URL(candidate.url).hostname.toLowerCase() === host?.toLowerCase());
	if (source && rest.length > 0) return {
		group: {
			label: source.name,
			cloneSource: source.name
		},
		repo: rest.join("/")
	};
	return {
		group: {
			label: "not a declared source",
			cloneSource: void 0
		},
		repo: name
	};
}
function groupInRankOrder(entries) {
	const order = [];
	for (const entry of entries) if (!order.includes(entry.group.label)) order.push(entry.group.label);
	return order.flatMap((label) => entries.filter((entry) => entry.group.label === label));
}
function sourcegraphClients(instances, clients, instance) {
	const client = clients.get(instance.name);
	if (!client || !instances.includes(instance)) throw new Error(`No Sourcegraph client for source "${instance.name}".`);
	return client;
}
// src/core/tools/find-definition.ts
const SOURCEGRAPH_MAX$2 = 50;
const SYMBOL_RESULT_LIMIT = 1e3;
const SYMBOL_KINDS = [
	"function",
	"method",
	"class",
	"struct",
	"interface",
	"enum",
	"variable",
	"constant",
	"field",
	"property"
];
function escapeRegex(text) {
	return text.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&");
}
function buildDefinitionQuery(query) {
	const symbol = rejectUnsafeValue("symbol", query.symbol);
	const parts = ["type:symbol", `count:${SYMBOL_RESULT_LIMIT}`];
	if (query.kind) parts.push(`select:symbol.${query.kind}`);
	const repos = repoFilter(query.repos);
	if (repos) parts.push(repos);
	if (query.language) parts.push(`lang:${rejectUnsafeValue("language", query.language)}`);
	if (!query.includeVendored) parts.push("-file:(^|/)vendor/");
	parts.push(`/^${escapeRegex(symbol)}$/`);
	return parts.join(" ");
}
function createFindDefinitionTool(instances, clients, cloneSources, cacheDir, search) {
	const Params = _Object_({
		...sourceProperties(instances, "Which Sourcegraph to search"),
		symbol: String$1({ description: "Exact symbol name, e.g. NewClient." }),
		kind: Optional(StringEnum(SYMBOL_KINDS, { description: "Only definitions of this kind. Kinds are exact: `function` excludes `method` (Go receivers, Java members), `class` excludes `struct`. Omit unless the name is ambiguous." })),
		repos: Optional(_Array_(String$1(), {
			description: "Restrict to repositories matching these RE2 patterns.",
			maxItems: 20
		})),
		language: Optional(String$1({ description: "Restrict to a language, e.g. go." })),
		include_vendored: Optional(Boolean$1({ description: "Include copies under vendor/ directories. Default: false." })),
		limit: limitParameter(SOURCEGRAPH_MAX$2, search.defaultLimit)
	});
	return defineTool({
		name: LIBRARIAN_TOOL_NAMES.findDefinition,
		label: "Find definition",
		description: "Locate where a symbol is defined, by exact name, across every repository the Sourcegraph instance indexes. Returns definition sites with 1-based line numbers; a miss can mean the language or repository is not indexed for symbols.",
		parameters: Params,
		annotations: {
			readOnlyHint: true,
			openWorldHint: true
		},
		async execute(toolCallId, params, signal) {
			const instance = selectInstance(instances, params);
			const client = sourcegraphClients(instances, clients, instance);
			const query = buildDefinitionQuery({
				symbol: params.symbol,
				kind: params.kind,
				repos: params.repos,
				language: params.language,
				includeVendored: params.include_vendored ?? false
			});
			const limit = resolveLimit(params.limit, search, SOURCEGRAPH_MAX$2);
			const outcome = await runSourcegraphSearch({
				client,
				search,
				signal,
				query,
				patternType: "standard",
				describeFound: (partial) => plural(partial.matches.length, "definition"),
				advice: "restrict repos or language, or set kind."
			});
			const definitions = outcome.result.matches.flatMap((match) => match.symbols.map((symbol) => ({
				match,
				symbol
			})));
			const entries = groupInRankOrder(definitions.map(({ match, symbol }) => {
				const mapped = mapRepository(match.repository, cloneSources);
				return {
					group: mapped.group,
					label: `${mapped.repo} — ${match.path ?? ""}:${symbol.line}`,
					...match.commit ? { revision: match.commit.slice(0, 7) } : {},
					meta: `${symbol.kind.toLowerCase()}${symbol.containerName ? ` in ${symbol.containerName}` : ""}`
				};
			}).slice(0, limit));
			const artifact = await writeSearchArtifact(cacheDir, toolCallId, definitions.map(({ match, symbol }) => {
				const mapped = mapRepository(match.repository, cloneSources);
				return {
					instance: instance.name,
					repository: match.repository,
					source: mapped.group.cloneSource ?? null,
					repo: mapped.repo,
					path: match.path,
					line: symbol.line,
					...match.commit ? { commit: match.commit } : {},
					name: symbol.name,
					kind: symbol.kind,
					...symbol.containerName ? { container: symbol.containerName } : {}
				};
			}));
			return {
				content: [{
					type: "text",
					text: formatDigest({
						found: `${plural(definitions.length, "definition")} of ${params.symbol}`,
						source: instance.name,
						complete: outcome.complete,
						incompleteReason: outcome.incompleteReason,
						fetchedCount: definitions.length,
						limitHit: false,
						shownCount: entries.length,
						artifact
					}, entries)
				}],
				details: {
					kind: "find_definition",
					source: instance.name,
					symbol: params.symbol,
					matchCount: definitions.length,
					fetchedCount: definitions.length,
					shownCount: entries.length,
					complete: outcome.complete,
					incompleteReason: outcome.incompleteReason,
					artifact,
					entries
				}
			};
		}
	});
}
// src/core/tools/read-file.ts
const MAX_READ_BYTES = 5242880;
const DEFAULT_LINE_LIMIT = 2e3;
function isBinary(bytes) {
	return bytes.subarray(0, 8e3).includes(0);
}
function entrySuffix(type) {
	switch (type) {
		case "directory": return "/";
		case "symlink": return " (symlink)";
		case "submodule": return " (submodule)";
		case "file": return "";
	}
}
function listing(path, entries) {
	const prefix = path.replace(/^\/+|\/+$/g, "");
	return entries.map((entry) => `${prefix ? `${prefix}/${entry.name}` : entry.name}${entrySuffix(entry.type)}`).join("\n");
}
function page(content, offset, limit) {
	const allLines = content.split("\n");
	const startLine = offset - 1;
	if (startLine >= allLines.length) throw new Error(`Offset ${offset} is beyond end of file (${allLines.length} lines total).`);
	const selectedLines = allLines.slice(startLine, Math.min(startLine + limit, allLines.length));
	const truncated = truncateHead(selectedLines.join("\n"));
	if (truncated.firstLineExceedsLimit) return {
		text: `[Line ${offset} is ${formatSize(Buffer.byteLength(allLines[startLine] ?? "", "utf-8"))}, exceeds ${formatSize(DEFAULT_MAX_BYTES)} limit.]`,
		shownLines: 0,
		totalLines: allLines.length
	};
	const shownLines = truncated.truncated ? truncated.outputLines : selectedLines.length;
	const endLine = offset + shownLines - 1;
	if (endLine >= allLines.length) return {
		text: truncated.content,
		shownLines,
		totalLines: allLines.length
	};
	const limitNote = truncated.truncated && truncated.truncatedBy !== "lines" ? ` (${formatSize(DEFAULT_MAX_BYTES)} limit)` : "";
	return {
		text: `${truncated.content}\n\n[Showing lines ${offset}-${endLine} of ${allLines.length}${limitNote}. Use offset=${endLine + 1} to continue.]`,
		shownLines,
		totalLines: allLines.length
	};
}
function createReadFileTool(instances, readers) {
	const Params = _Object_({
		...sourceProperties(instances, "Source for the code"),
		repo: String$1({ description: "Repository path, e.g. platform/widget-sdk." }),
		path: String$1({ description: "File or directory path within the repository." }),
		ref: Optional(String$1({ description: "Branch, tag, or commit. To check a search result, pass its commit so line numbers agree. Default: the default branch." })),
		offset: Optional(Integer({
			minimum: 1,
			description: "Line number to start reading from, 1-based."
		})),
		limit: Optional(Integer({
			minimum: 1,
			description: `Maximum number of lines to read. Default: ${DEFAULT_LINE_LIMIT}.`
		}))
	});
	return defineTool({
		name: LIBRARIAN_TOOL_NAMES.readFile,
		label: "Read file",
		description: "Read one file, or list one directory, from a repository without cloning it. Long files come back in pages of up to 2,000 lines; files over about 5 MB and binary files are refused. For exploring several files, cloning is faster.",
		promptGuidelines: ["Read files from code hosts with read_file or checkout_repo, never with curl, gh, or other network commands in bash."],
		parameters: Params,
		annotations: {
			readOnlyHint: true,
			openWorldHint: true
		},
		async execute(_toolCallId, params, signal) {
			const instance = selectInstance(instances, params);
			const reader = readers.get(instance.name);
			if (!reader) throw new Error(`No file reader for source "${instance.name}".`);
			const location = `${params.repo}/${params.path}`;
			const details = (entryType, shownLines, totalLines) => ({
				kind: "read_file",
				source: instance.name,
				repo: params.repo,
				path: params.path,
				entryType,
				shownLines,
				totalLines
			});
			let entry;
			try {
				entry = await reader.readEntry({
					repo: params.repo,
					path: params.path,
					ref: params.ref,
					maxBytes: MAX_READ_BYTES,
					signal
				});
			} catch (error) {
				if (error instanceof EntryTooLargeError) throw new Error(`${location} is ${formatSize(error.size)}, over the ${formatSize(MAX_READ_BYTES)} read limit. Clone it with checkout_repo and read it locally instead.`);
				throw error;
			}
			switch (entry.type) {
				case "directory": return {
					content: [{
						type: "text",
						text: listing(params.path, entry.entries) || "(empty directory)"
					}],
					details: details("directory", entry.entries.length, entry.entries.length)
				};
				case "symlink": return {
					content: [{
						type: "text",
						text: `${location} is a symlink to ${entry.target} — read that path instead.`
					}],
					details: details("symlink", 0, 0)
				};
				case "submodule": return {
					content: [{
						type: "text",
						text: `${location} is a submodule${entry.url ? ` pointing at ${entry.url}` : ""} — read it from that repository.`
					}],
					details: details("submodule", 0, 0)
				};
				case "file": {
					if (isBinary(entry.bytes)) throw new Error(`${location} is a binary file (${formatSize(entry.size)}); its content would be noise in context.`);
					const result = page(entry.bytes.toString("utf-8"), params.offset ?? 1, params.limit ?? DEFAULT_LINE_LIMIT);
					return {
						content: [{
							type: "text",
							text: result.text
						}],
						details: details("file", result.shownLines, result.totalLines)
					};
				}
			}
		}
	});
}
// src/core/tools/search-code-bitbucket.ts
const BITBUCKET_MAX$1 = 50;
const COUNT_CAP = 1e4;
const MATCHED_LINES_SHOWN$2 = 5;
function buildBitbucketCodeQuery(query) {
	const pattern = query.pattern.trim();
	if (pattern.length === 0) throw new Error("pattern cannot be blank.");
	const modifier = /(^|\s|\()(-?[A-Za-z_]+):\S/.exec(pattern.replace(/"[^"]*"/g, " "));
	if (modifier) throw new Error(`pattern contains a modifier "${modifier[2]}:". Use the project, repo, language, extension, and path arguments instead, or quote it to search for the text.`);
	if (/(^|\s)\S*\*/.test(pattern.replace(/"[^"]*"/g, " "))) throw new Error("Bitbucket code search has no wildcards; search whole words.");
	const parts = [pattern];
	if (query.repo && !query.project) throw new Error("repo requires project; pass the project key and the repository slug.");
	if (query.project) {
		const project = rejectUnsafeValue("project", query.project);
		parts.push(query.repo ? `repo:${project}/${rejectUnsafeValue("repo", query.repo)}` : `project:${project}`);
	}
	if (query.language) parts.push(`lang:${rejectUnsafeValue("language", query.language)}`);
	if (query.extension) parts.push(`ext:${rejectUnsafeValue("extension", query.extension).replace(/^\./, "")}`);
	if (query.path) parts.push(`path:${rejectUnsafeValue("path", query.path).replace(/^\/+|\/+$/g, "")}`);
	return parts.join(" ");
}
function createSearchCodeBitbucketTool(instances, clients, cacheDir, search) {
	const Params = _Object_({
		...sourceProperties(instances, "Which Bitbucket to search"),
		pattern: String$1({ description: "Whole words to find, case-insensitively; words must all appear in the file. Quote a phrase to keep it together, join alternatives with OR, exclude with NOT or -word, group with parentheses. Matches whole tokens only — no substrings, no wildcards, no regex — and ignores punctuation." }),
		project: Optional(String$1({ description: "Restrict to a project key, e.g. PROJ." })),
		repo: Optional(String$1({ description: "Restrict to one repository slug in project. Requires project." })),
		language: Optional(String$1({ description: "Restrict to a language, e.g. go." })),
		extension: Optional(String$1({ description: "File extension without the dot, e.g. go." })),
		path: Optional(String$1({ description: "Restrict to paths containing this directory, e.g. internal." })),
		limit: limitParameter(BITBUCKET_MAX$1, search.defaultLimit)
	});
	return defineTool({
		name: LIBRARIAN_TOOL_NAMES.searchCodeBitbucket,
		label: "Search Bitbucket code",
		description: "Search code across every repository on a Bitbucket Server instance, by whole words. Results come with their matched lines; no more than about 1,000 results of any search can be read.",
		parameters: Params,
		annotations: {
			readOnlyHint: true,
			openWorldHint: true
		},
		async execute(toolCallId, params, signal) {
			const instance = selectInstance(instances, params);
			const client = clients.get(instance.name);
			if (!client) throw new Error(`No Bitbucket client for source "${instance.name}".`);
			const query = buildBitbucketCodeQuery({
				pattern: params.pattern,
				project: params.project,
				repo: params.repo,
				language: params.language,
				extension: params.extension,
				path: params.path
			});
			const limit = resolveLimit(params.limit, search, BITBUCKET_MAX$1);
			await client.authorize();
			const result = await runRestSearch(search, signal, "add project, language, or path, or more words.", async (searchSignal) => {
				try {
					return await client.searchCode(query, limit, searchSignal);
				} catch (error) {
					if (error instanceof BitbucketApiError && error.status === 400) throw new Error(`${error.message}\nThe pattern or a modifier is malformed; check quotes and parentheses.`);
					throw error;
				}
			});
			if (result.count === 0 && params.project && !await client.projectExists(params.project, signal)) throw new Error(`No Bitbucket project ${params.project} on ${instance.name}, or it is not visible to this token. This is not an empty result.`);
			const repos = new Set(result.hits.map((hit) => hit.repo));
			const entries = result.hits.map((hit) => {
				const lines = hit.lines.slice(0, MATCHED_LINES_SHOWN$2);
				const detail = [...lines.map((line) => `${line.lineNumber}: ${clipLine(line.text)}`), ...hit.lines.length > lines.length ? [`… ${hit.lines.length - lines.length} more matched lines`] : []].join("\n");
				return {
					label: `${hit.repo} — ${hit.path}`,
					...detail ? { detail } : {}
				};
			});
			const artifact = await writeSearchArtifact(cacheDir, toolCallId, result.hits.map((hit) => ({
				source: instance.name,
				...hit
			})));
			const allFetched = result.isLastPage;
			return {
				content: [{
					type: "text",
					text: formatDigest({
						found: allFetched ? `${plural(result.count, "file")} across ${plural(repos.size, "repo")}` : `${result.count >= COUNT_CAP ? `${formatCount(COUNT_CAP)}+` : formatCount(result.count)} files match`,
						source: instance.name,
						complete: void 0,
						incompleteReason: void 0,
						fetchedCount: result.hits.length,
						limitHit: !allFetched,
						shownCount: entries.length,
						artifact
					}, entries)
				}],
				details: {
					kind: "search_code_bitbucket",
					source: instance.name,
					unit: "files",
					matchCount: result.count,
					repoCount: allFetched ? repos.size : void 0,
					fetchedCount: result.hits.length,
					shownCount: entries.length,
					complete: void 0,
					artifact,
					entries
				}
			};
		}
	});
}
// src/core/tools/search-code-github.ts
const GITHUB_CODE_SEARCH_MAX = 50;
const NARROWING_ADVICE = "set owner or repos, or add path, filename, or extension.";
function validateGitHubCodePattern(pattern) {
	const trimmed = pattern.trim();
	if (trimmed.length === 0) throw new Error("pattern cannot be blank.");
	if ((trimmed.match(/"/g) ?? []).length % 2 !== 0) throw new Error("pattern has an unbalanced quote; quote a phrase at both ends.");
	const unquoted = trimmed.replace(/"[^"]*"/g, " ");
	if (/(^|\s)OR(\s|$)/.test(unquoted)) throw new Error("GitHub code search reads OR as AND. Search each alternative separately, or quote it to find the word OR.");
	if (/[()]/.test(unquoted)) throw new Error("GitHub code search cannot group with parentheses; quote them to search for them.");
	const qualifier = /(^|\s)(-?[A-Za-z_]+):\S/.exec(unquoted);
	if (qualifier) throw new Error(`pattern contains a qualifier "${qualifier[2]}:". Use the owner, repos, path, filename, extension, and language arguments instead, or quote it to search for the text.`);
	return trimmed;
}
function trimBlankLines(fragment) {
	return fragment.replace(/^(\s*\n)+/, "").replace(/(\n\s*)+$/, "");
}
function buildGitHubCodeQuery(query) {
	const parts = [validateGitHubCodePattern(query.pattern)];
	if (query.repos && query.repos.length > 0) {
		if (!query.owner) throw new Error("repos requires owner; pass owner and the bare repository names.");
		const owner = rejectUnsafeValue("owner", query.owner);
		for (const repo of query.repos) {
			const name = rejectUnsafeValue("repos", repo);
			if (name.includes("/")) throw new Error(`repos takes bare names under owner: pass owner "${name.split("/")[0]}" and repos ["${name.split("/").slice(1).join("/")}"].`);
			parts.push(`repo:${owner}/${name}`);
		}
	} else if (query.owner) parts.push(`user:${rejectUnsafeValue("owner", query.owner)}`);
	if (query.path) parts.push(`path:${rejectUnsafeValue("path", query.path).replace(/^\/+|\/+$/g, "")}`);
	if (query.filename) parts.push(`filename:${rejectUnsafeValue("filename", query.filename)}`);
	if (query.extension) parts.push(`extension:${rejectUnsafeValue("extension", query.extension).replace(/^\./, "")}`);
	if (query.language) parts.push(`language:${rejectUnsafeValue("language", query.language)}`);
	return parts.join(" ");
}
async function unsearchableScopeError(client, owner, repos, signal) {
	const reasons = [];
	for (const repo of owner ? repos ?? [] : []) try {
		const meta = await client.getRepo(owner ?? "", repo, signal);
		if (meta.fullName.toLowerCase() !== `${owner}/${repo}`.toLowerCase()) reasons.push(`${owner}/${repo} was renamed to ${meta.fullName}`);
	} catch (error) {
		if (error instanceof GitHubApiError && error.status === 404) reasons.push(`${owner}/${repo} does not exist or is private to you`);
		else throw error;
	}
	const detail = reasons.length > 0 ? reasons.join("; ") : "the scope may be missing, private to you, renamed, or a fork GitHub does not index";
	return /* @__PURE__ */ new Error(`GitHub could not search this scope: ${detail}. This is not an empty result.`);
}
function createSearchCodeGitHubTool(instances, clients, cacheDir, search) {
	const maximum = GITHUB_CODE_SEARCH_MAX;
	const Params = _Object_({
		...sourceProperties(instances, "Which GitHub to search"),
		pattern: String$1({ description: "Text to find, matched case-insensitively as a substring. Space-separated words must all appear in the file; quote a phrase to match it exactly; -word excludes. No regex, no OR, no parentheses." }),
		owner: Optional(String$1({ description: "Restrict to repositories owned by this user or organization." })),
		repos: Optional(_Array_(String$1(), {
			description: "Restrict to these repositories under owner, by bare name, e.g. drizzle-orm. Requires owner.",
			maxItems: 20
		})),
		path: Optional(String$1({ description: "Directory from the repository root, e.g. drizzle-kit/src. Not a glob and not a file name." })),
		filename: Optional(String$1({ description: "File name or suffix, e.g. drizzle.config.ts." })),
		extension: Optional(String$1({ description: "File extension, e.g. ts." })),
		language: Optional(String$1({ description: "Restrict to a language, e.g. typescript." })),
		limit: limitParameter(maximum, search.defaultLimit)
	});
	return defineTool({
		name: LIBRARIAN_TOOL_NAMES.searchCodeGitHub,
		label: "Search GitHub code",
		description: "Search code on GitHub's default branches, including private repositories your token can read. Returns matching files with short excerpts, without line numbers; files over about 350 KB are not indexed. Limited to 10 searches a minute.",
		parameters: Params,
		annotations: {
			readOnlyHint: true,
			openWorldHint: true
		},
		async execute(toolCallId, params, signal) {
			const instance = selectInstance(instances, params);
			const provider = clients.get(instance.name);
			if (!provider) throw new Error(`No GitHub client for source "${instance.name}".`);
			const query = buildGitHubCodeQuery({
				pattern: params.pattern,
				owner: params.owner,
				repos: params.repos,
				path: params.path,
				filename: params.filename,
				extension: params.extension,
				language: params.language
			});
			const limit = resolveLimit(params.limit, search, maximum);
			const client = await provider();
			let result;
			try {
				result = await runRestSearch(search, signal, NARROWING_ADVICE, (searchSignal) => client.searchCode({
					query,
					limit,
					signal: searchSignal
				}));
			} catch (error) {
				if (error instanceof GitHubApiError && error.status === 408) throw new SearchTimeoutError(`GitHub stopped the search at its own time limit, about 9s.\nNarrow it before retrying: ${NARROWING_ADVICE}`);
				if (error instanceof GitHubApiError && error.status === 422 && params.language) throw new Error(`${error.message}\nIf the language is the problem, use its GitHub name, e.g. typescript, c#, or jupyter-notebook.`);
				throw error;
			}
			if (result.incompleteResults && result.hits.length === 0) throw await unsearchableScopeError(client, params.owner, params.repos, signal);
			const repos = new Set(result.hits.map((hit) => hit.repo));
			const allFetched = result.hits.length >= result.totalCount;
			const entries = result.hits.map((hit) => {
				const fragments = hit.fragments.slice(0, 2).map((fragment) => trimBlankLines(fragment).split("\n").slice(0, 3).join("\n")).join("\n…\n");
				return {
					label: `${hit.repo} — ${hit.path}`,
					url: hit.url,
					...hit.commit ? { revision: hit.commit.slice(0, 7) } : {},
					...fragments ? { detail: fragments } : {}
				};
			});
			const artifact = await writeSearchArtifact(cacheDir, toolCallId, result.hits.map((hit) => ({
				source: instance.name,
				...hit
			})));
			const found = allFetched ? `${plural(result.totalCount, "file")} across ${plural(repos.size, "repo")}` : `${formatCount(result.totalCount)} files match`;
			const complete = result.incompleteResults ? false : void 0;
			return {
				content: [{
					type: "text",
					text: formatDigest({
						found,
						source: instance.name,
						complete,
						incompleteReason: "GitHub did not finish searching every file",
						fetchedCount: result.hits.length,
						limitHit: !allFetched,
						shownCount: entries.length,
						artifact
					}, entries)
				}],
				details: {
					kind: "search_code_github",
					source: instance.name,
					unit: "files",
					matchCount: result.totalCount,
					repoCount: allFetched ? repos.size : void 0,
					fetchedCount: result.hits.length,
					shownCount: entries.length,
					complete,
					artifact,
					entries
				}
			};
		}
	});
}
// src/core/tools/search-code-gitlab.ts
const GITLAB_MAX$1 = 50;
const PAGE_SIZE = 50;
const MAX_PAGES = 4;
const MATCHED_LINES_SHOWN$1 = 5;
const FILTER_WORDS = /(^|\s)-?(filename|path|extension|blob):/i;
function buildGitLabCodeSearch(query) {
	if (query.pattern.trim().length < 2) throw new Error("pattern must be at least two characters; GitLab silently finds nothing for one.");
	if (FILTER_WORDS.test(query.pattern)) throw new Error("pattern contains a filter; use the filename, path, and extension arguments instead.");
	const parts = [query.pattern];
	if (query.filename) parts.push(`filename:${rejectUnsafeValue("filename", query.filename)}`);
	if (query.path) parts.push(`path:${rejectUnsafeValue("path", query.path).replace(/^\/+|\/+$/g, "")}`);
	if (query.extension) parts.push(`extension:${rejectUnsafeValue("extension", query.extension).replace(/^\./, "")}`);
	return parts.join(" ");
}
function matchingLines(hit, pattern) {
	const needle = pattern.toLowerCase();
	return hit.data.split("\n").map((text, offset) => ({
		lineNumber: hit.startline + offset,
		text
	})).filter((line) => line.text.toLowerCase().includes(needle));
}
function groupByFile(hits, pattern) {
	const files = /* @__PURE__ */ new Map();
	for (const hit of hits) {
		const key = `${hit.projectId}:${hit.path}`;
		const file = files.get(key) ?? {
			projectId: hit.projectId,
			path: hit.path,
			ref: hit.ref,
			pathMatch: false,
			lines: []
		};
		if (hit.pathMatch) file.pathMatch = true;
		else file.lines.push(...matchingLines(hit, pattern));
		files.set(key, file);
	}
	return [...files.values()];
}
function createSearchCodeGitLabTool(instances, clients, cacheDir, search) {
	const projectOptional = instances.every((instance) => instance.advancedSearch);
	const projectDescription = projectOptional ? "Restrict to one project, e.g. platform/widget-sdk." : "Project path, e.g. platform/widget-sdk.";
	const Params = _Object_({
		...sourceProperties(instances, "Which GitLab to search"),
		pattern: String$1({ description: "Text to find, matched case-insensitively as one exact string — spaces and quotes included. No regex, and several words are a phrase, not separate terms. At least two characters." }),
		project: projectOptional ? Optional(String$1({ description: projectDescription })) : String$1({ description: projectDescription }),
		ref: Optional(String$1({ description: "Branch, tag, or commit. Default: the default branch." })),
		filename: Optional(String$1({ description: "File name, wildcards allowed, e.g. *_test.go." })),
		path: Optional(String$1({ description: "Directory within the project, e.g. internal/git." })),
		extension: Optional(String$1({ description: "File extension without the dot, e.g. go." })),
		limit: limitParameter(GITLAB_MAX$1, search.defaultLimit)
	});
	return defineTool({
		name: LIBRARIAN_TOOL_NAMES.searchCodeGitLab,
		label: "Search GitLab code",
		description: `Search the code of ${projectOptional ? "a GitLab instance" : "one GitLab project"} for an exact string. Results are unranked — files whose path matches come first, then matches in path order. Filters scan the whole project, which is slow on very large repositories. Limited to 30 searches a minute.`,
		parameters: Params,
		annotations: {
			readOnlyHint: true,
			openWorldHint: true
		},
		async execute(toolCallId, params, signal) {
			const instance = selectInstance(instances, params);
			const client = clients.get(instance.name);
			if (!client) throw new Error(`No GitLab client for source "${instance.name}".`);
			const searchText = buildGitLabCodeSearch({
				pattern: params.pattern,
				filename: params.filename,
				path: params.path,
				extension: params.extension
			});
			const limit = resolveLimit(params.limit, search, GITLAB_MAX$1);
			const advice = Boolean(params.filename || params.path || params.extension) ? "filters scan the whole project; search without them, then read the files." : "use a rarer pattern, or narrow with path.";
			await client.authorize();
			const { files, hasMore, total, projectPaths } = await runRestSearch(search, signal, advice, async (searchSignal) => {
				const project = params.project ? await client.resolveProject(params.project, searchSignal) : void 0;
				if (project && params.ref && !await client.refExists(project.id, params.ref, searchSignal)) throw new Error(`Ref ${params.ref} does not exist in ${project.path}; there is nothing to search.`);
				const hits = [];
				let page = 1;
				let more = true;
				let lastTotal;
				while (more && page <= MAX_PAGES && groupByFile(hits, params.pattern).length < limit) {
					try {
						const result = await client.searchBlobs(project ? { projectId: project.id } : "instance", searchText, params.ref, page, PAGE_SIZE, searchSignal);
						hits.push(...result.hits);
						more = result.hasNextPage;
						lastTotal = result.total;
					} catch (error) {
						if (error instanceof GitLabApiError && /supported only with advanced search/.test(error.message)) throw new Error(`${instance.name} searches one project at a time; name one with project. If it does have advanced search, advancedSearch is set wrongly for this source.`);
						throw error;
					}
					page += 1;
				}
				if (hits.length === 0 && project?.repositoryRestricted) throw new Error(`${project.path}'s repository is restricted, so GitLab returns no code for it to this token. This is not an empty result.`);
				const grouped = groupByFile(hits, params.pattern);
				const paths = /* @__PURE__ */ new Map();
				for (const projectId of new Set(grouped.map((file) => file.projectId))) paths.set(projectId, await client.projectPath(projectId, searchSignal));
				return {
					files: grouped,
					hasMore: more,
					total: lastTotal,
					projectPaths: paths
				};
			});
			const entries = files.slice(0, limit).map((file) => {
				const lines = file.lines.slice(0, MATCHED_LINES_SHOWN$1);
				const detailLines = [
					...file.pathMatch ? ["(the path matches)"] : [],
					...lines.map((line) => `${line.lineNumber}: ${clipLine(line.text)}`),
					...file.lines.length > lines.length ? [`… ${file.lines.length - lines.length} more matched lines`] : []
				];
				return {
					label: `${projectPaths.get(file.projectId) ?? file.projectId} — ${file.path}`,
					...detailLines.length > 0 ? { detail: detailLines.join("\n") } : {}
				};
			});
			const artifact = await writeSearchArtifact(cacheDir, toolCallId, files.map((file) => ({
				source: instance.name,
				repo: projectPaths.get(file.projectId),
				path: file.path,
				ref: file.ref,
				pathMatch: file.pathMatch,
				lines: file.lines
			})));
			const repoCount = projectPaths.size;
			return {
				content: [{
					type: "text",
					text: formatDigest({
						found: `${hasMore ? `At least ${plural(files.length, "file")} across ${plural(repoCount, "repo")}${total === void 0 ? "" : `, ${plural(total, "hit")} or more`}` : `${plural(files.length, "file")} across ${plural(repoCount, "repo")}`}, unranked`,
						source: instance.name,
						complete: void 0,
						incompleteReason: void 0,
						fetchedCount: files.length,
						limitHit: hasMore,
						shownCount: entries.length,
						artifact
					}, entries)
				}],
				details: {
					kind: "search_code_gitlab",
					source: instance.name,
					unit: "files",
					matchCount: files.length,
					repoCount,
					fetchedCount: files.length,
					shownCount: entries.length,
					complete: void 0,
					ranked: false,
					atLeast: hasMore,
					artifact,
					entries
				}
			};
		}
	});
}
// src/core/grep-app.ts
const GREP_MCP_URL = "https://mcp.grep.app";
const GREP_ATTEMPT_TIMEOUTS_MS = [
	3e3,
	5e3,
	7e3
];
const GREP_RETRY_DELAY_MS = 300;
var GrepError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "GrepError";
	}
};
const MCP_TEXT_CONTENT_SCHEMA = _Object_({
	type: Literal("text"),
	text: String$1()
});
const MCP_CALL_RESULT_SCHEMA = _Object_({
	content: Optional(_Array_(Unknown())),
	isError: Optional(Boolean$1())
});
const MCP_ERROR_SCHEMA = _Object_({ message: String$1() });
const MCP_RESPONSE_SCHEMA = _Object_({
	result: Optional(Unknown()),
	error: Optional(Unknown())
});
function parseHeader(line, name) {
	const prefix = `${name}: `;
	return line.startsWith(prefix) ? line.slice(prefix.length).trim() : void 0;
}
function parseGrepSearchText(text) {
	if (text.trim() === "No results found for your query.") return;
	let repo;
	let path;
	let url;
	let license;
	const snippets = [];
	let currentSnippet;
	function finishSnippet() {
		if (!currentSnippet) return;
		snippets.push({
			lineNumber: currentSnippet.lineNumber,
			content: currentSnippet.lines.join("\n").trimEnd()
		});
		currentSnippet = void 0;
	}
	for (const line of text.split("\n")) {
		const parsedRepo = parseHeader(line, "Repository");
		if (parsedRepo) {
			repo = parsedRepo;
			continue;
		}
		const parsedPath = parseHeader(line, "Path");
		if (parsedPath) {
			path = parsedPath;
			continue;
		}
		const parsedUrl = parseHeader(line, "URL");
		if (parsedUrl) {
			url = parsedUrl;
			continue;
		}
		const parsedLicense = parseHeader(line, "License");
		if (parsedLicense) {
			license = parsedLicense === "Unknown" ? void 0 : parsedLicense;
			continue;
		}
		const snippetStart = /^--- Snippet \d+ \(Line (\d+)\) ---$/.exec(line);
		if (snippetStart) {
			finishSnippet();
			currentSnippet = {
				lineNumber: Number(snippetStart[1]),
				lines: []
			};
			continue;
		}
		if (currentSnippet) currentSnippet.lines.push(line.startsWith("> ") ? line.slice(2) : line);
	}
	finishSnippet();
	if (!repo || !path) return;
	return {
		repo,
		path,
		url,
		license,
		snippets
	};
}
function parseGrepMcpEvents(body) {
	const matches = [];
	for (const rawLine of body.split("\n")) {
		const line = rawLine.trimEnd();
		if (!line.startsWith("data: ")) continue;
		const response = safeParseTypeBoxValue(MCP_RESPONSE_SCHEMA, JSON.parse(line.slice(6)));
		if (!response) continue;
		const error = safeParseTypeBoxValue(MCP_ERROR_SCHEMA, response.error);
		if (error) throw new GrepError(error.message);
		const result = safeParseTypeBoxValue(MCP_CALL_RESULT_SCHEMA, response.result);
		if (!result) continue;
		if (result.isError) throw new GrepError((result.content ?? []).map((rawContent) => safeParseTypeBoxValue(MCP_TEXT_CONTENT_SCHEMA, rawContent)?.text).filter((text) => text !== void 0).join("\n").trim() || "Grep MCP returned an error result.");
		for (const rawContent of result.content ?? []) {
			const content = safeParseTypeBoxValue(MCP_TEXT_CONTENT_SCHEMA, rawContent);
			if (!content) continue;
			const match = parseGrepSearchText(content.text);
			if (match) matches.push(match);
		}
	}
	return { matches };
}
function buildGrepArguments(params) {
	const args = { query: params.query };
	if (params.matchCase) args.matchCase = true;
	if (params.matchWholeWords) args.matchWholeWords = true;
	if (params.useRegexp) args.useRegexp = true;
	if (params.repo) args.repo = params.repo;
	if (params.path) args.path = params.path;
	if (params.language && params.language.length > 0) args.language = params.language;
	return args;
}
function extractHtmlTitle(body) {
	return /<title[^>]*>(.*?)<\/title>/is.exec(body)?.[1]?.replace(/\s+/g, " ").trim();
}
function formatHttpError(status, body) {
	return `Grep MCP returned ${status}: ${extractHtmlTitle(body) ?? body.slice(0, 200)}`;
}
function formatTransientError(error) {
	return `Grep MCP ${error instanceof GrepTransientHttpError ? `returned ${error.status}` : "request failed"} after retry (transient backend error). Retry, or simplify the query.`;
}
function delay(milliseconds, signal) {
	if (signal?.aborted) return Promise.reject(signal.reason);
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(resolve, milliseconds);
		signal?.addEventListener("abort", () => {
			clearTimeout(timeout);
			reject(signal.reason);
		}, { once: true });
	});
}
async function searchCodeGrepAttempt(params, signal, timeoutMs) {
	const timeoutSignal = AbortSignal.timeout(timeoutMs);
	const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
	const response = await fetch(GREP_MCP_URL, {
		method: "POST",
		headers: {
			accept: "application/json, text/event-stream",
			"content-type": "application/json",
			"user-agent": "pi-librarian"
		},
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "tools/call",
			params: {
				name: "searchGitHub",
				arguments: buildGrepArguments(params)
			}
		}),
		signal: requestSignal
	});
	const body = await response.text();
	if (!response.ok) {
		if (response.status >= 500) throw new GrepTransientHttpError(response.status, body);
		throw new GrepError(formatHttpError(response.status, body));
	}
	return parseGrepMcpEvents(body);
}
var GrepTransientHttpError = class extends Error {
	status;
	constructor(status, body) {
		super(formatHttpError(status, body));
		this.name = "GrepTransientHttpError";
		this.status = status;
	}
};
async function searchCodeGrep(params, signal) {
	if (signal?.aborted) throw signal.reason;
	let transientError;
	for (const [attempt, timeoutMs] of GREP_ATTEMPT_TIMEOUTS_MS.entries()) {
		if (attempt > 0) await delay(GREP_RETRY_DELAY_MS, signal);
		try {
			return await searchCodeGrepAttempt(params, signal, timeoutMs);
		} catch (error) {
			if (error instanceof GrepError || signal?.aborted) throw error;
			transientError = error;
		}
	}
	throw new GrepError(formatTransientError(transientError));
}
// src/core/tools/search-code-grepapp.ts
const GREP_APP_SOURCE = "grep.app";
const GREP_APP_MAX = 10;
function matchDetail(match) {
	const lines = match.snippets.slice(0, 2).map((snippet) => snippet.content.split("\n").slice(0, 8).map((line, offset) => `${snippet.lineNumber + offset}: ${clipLine(line)}`).join("\n")).join("\n…\n");
	return lines.length > 0 ? lines : void 0;
}
function createSearchCodeGrepAppTool(cacheDir, search) {
	const Params = _Object_({
		pattern: String$1({ description: "Code to find, as it appears in files: e.g. `useState(` rather than `react hook state`." }),
		regex: Optional(Boolean$1({ description: "Treat pattern as a regular expression instead of literal text. Supports (?s) for multi-line patterns. Default: false." })),
		repo: Optional(String$1({ description: "Restrict to a repository or repository prefix, e.g. drizzle-team/drizzle-orm or vercel." })),
		language: Optional(String$1({ description: "Restrict to a language, e.g. TypeScript." })),
		path: Optional(String$1({ description: "Restrict to file paths matching this pattern." })),
		limit: limitParameter(GREP_APP_MAX, search.defaultLimit)
	});
	return defineTool({
		name: LIBRARIAN_TOOL_NAMES.searchCodeGrepApp,
		label: "Search public code",
		description: "Search public open-source code on GitHub by literal pattern or regex, through grep.app. Public code only; it reaches no private repository.",
		parameters: Params,
		annotations: {
			readOnlyHint: true,
			openWorldHint: true
		},
		async execute(toolCallId, params, signal) {
			const limit = resolveLimit(params.limit, search, GREP_APP_MAX);
			const matches = (await runRestSearch(search, signal, "add repo, language, or path.", (searchSignal) => searchCodeGrep({
				query: params.pattern,
				...params.regex ? { useRegexp: true } : {},
				...params.repo ? { repo: params.repo } : {},
				...params.language ? { language: [params.language] } : {},
				...params.path ? { path: params.path } : {}
			}, searchSignal))).matches;
			const repoCount = new Set(matches.map((match) => match.repo)).size;
			const entries = matches.slice(0, limit).map((match) => {
				const detail = matchDetail(match);
				return {
					label: `${match.repo} — ${match.path}`,
					...match.url ? { url: match.url } : {},
					...detail ? { detail } : {}
				};
			});
			const artifact = await writeSearchArtifact(cacheDir, toolCallId, matches.map((match) => ({
				source: GREP_APP_SOURCE,
				...match
			})));
			return {
				content: [{
					type: "text",
					text: formatDigest({
						found: `${plural(matches.length, "file")} across ${plural(repoCount, "repo")}`,
						source: GREP_APP_SOURCE,
						complete: void 0,
						incompleteReason: void 0,
						fetchedCount: matches.length,
						limitHit: false,
						shownCount: entries.length,
						artifact
					}, entries)
				}],
				details: {
					kind: "search_code_grepapp",
					source: GREP_APP_SOURCE,
					unit: "files",
					matchCount: matches.length,
					repoCount,
					fetchedCount: matches.length,
					shownCount: entries.length,
					complete: void 0,
					artifact,
					entries
				}
			};
		}
	});
}
// src/core/tools/search-code-sourcegraph.ts
const SOURCEGRAPH_MAX$1 = 50;
const MATCHED_LINES_SHOWN = 5;
const RESULT_LIMIT = {
	repos: 5e3,
	files: 1e3,
	matches: 2e3
};
function escapeBareSlashes(pattern) {
	let escaped = "";
	for (let index = 0; index < pattern.length; index += 1) {
		const char = pattern[index];
		if (char === "\\") {
			escaped += pattern.slice(index, index + 2);
			index += 1;
		} else escaped += char === "/" ? "\\/" : char;
	}
	return escaped;
}
function encodeSourcegraphPattern(pattern, patternType) {
	switch (patternType) {
		case "literal":
			if (pattern.length === 0) throw new Error("pattern cannot be empty.");
			return `content:"${pattern.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
		case "regexp":
			if (pattern.length === 0) throw new Error("pattern cannot be empty.");
			validateRe2("pattern", pattern);
			return `/${escapeBareSlashes(pattern)}/`;
		case "keyword": return rejectKeywordFilters(pattern);
	}
}
function buildSourcegraphCodeQuery(query) {
	const parts = ["type:file", `count:${RESULT_LIMIT[query.detail]}`];
	if (query.detail === "repos") parts.push("select:repo");
	else if (query.detail === "files") parts.push("select:file");
	const repos = repoFilter(query.repos);
	if (repos) parts.push(repos);
	if (query.path) parts.push(`file:${validateRegex("path", query.path)}`);
	if (query.language) parts.push(`lang:${rejectUnsafeValue("language", query.language)}`);
	parts.push(encodeSourcegraphPattern(query.pattern, query.patternType));
	return parts.join(" ");
}
function found(detail, result) {
	const { matchCount, repositoriesCount } = result.progress;
	switch (detail) {
		case "repos": return plural(matchCount, "repo");
		case "files": return `${plural(matchCount, "file")} across ${plural(repositoriesCount, "repo")}`;
		case "matches": return `${plural(matchCount, "match", "matches")} in ${plural(result.matches.length, "file")} across ${plural(repositoriesCount, "repo")}`;
	}
}
function createSearchCodeSourcegraphTool(instances, clients, cloneSources, cacheDir, search) {
	const Params = _Object_({
		...sourceProperties(instances, "Which Sourcegraph to search"),
		pattern: String$1({ description: "Code to find, as it appears in files." }),
		pattern_type: Optional(StringEnum([
			"literal",
			"keyword",
			"regexp"
		], { description: "How to read the pattern. literal: the exact text, spaces and punctuation included. keyword: every term somewhere in the same file, any order, matching substrings; quote a phrase to keep it together, join alternatives with OR, exclude with NOT — a leading - is searched as text. regexp: RE2, matched within one line. Default: literal." })),
		detail: Optional(StringEnum([
			"repos",
			"files",
			"matches"
		], { description: "What each result is: a repository, a file, or a file with its matched lines — and so what the result limit counts. repos stays complete across the whole instance; files and matches may hit the limit on a broad pattern. Default: files." })),
		repos: Optional(_Array_(String$1(), {
			description: "Restrict to repositories whose names match these RE2 patterns, e.g. ^git\\.example\\.com/PROJ/. The only filter that makes a search faster.",
			maxItems: 20
		})),
		path: Optional(String$1({ description: "Restrict to file paths matching this RE2 pattern." })),
		language: Optional(String$1({ description: "Restrict to a language, e.g. go." })),
		limit: limitParameter(SOURCEGRAPH_MAX$1, search.defaultLimit)
	});
	return defineTool({
		name: LIBRARIAN_TOOL_NAMES.searchCodeSourcegraph,
		label: "Search code across repos",
		description: "Search code across every repository the Sourcegraph instance indexes, and report whether the search covered them all. Results are ranked across repositories; line numbers are from the indexed commit.",
		promptGuidelines: ["To find callers of a symbol across repositories with search_code_sourcegraph, search the name as a regexp with word boundaries, e.g. \\bNewClient\\b."],
		parameters: Params,
		annotations: {
			readOnlyHint: true,
			openWorldHint: true
		},
		async execute(toolCallId, params, signal) {
			const instance = selectInstance(instances, params);
			const client = sourcegraphClients(instances, clients, instance);
			const detail = params.detail ?? "files";
			const patternType = params.pattern_type ?? "literal";
			const query = buildSourcegraphCodeQuery({
				pattern: params.pattern,
				patternType,
				detail,
				repos: params.repos,
				path: params.path,
				language: params.language
			});
			const limit = resolveLimit(params.limit, search, SOURCEGRAPH_MAX$1);
			const outcome = await runSourcegraphSearch({
				client,
				search,
				signal,
				query,
				patternType: patternType === "keyword" ? "keyword" : "standard",
				describeFound: (partial) => found(detail, partial),
				advice: "restrict repos, add a path or language, or ask for detail repos."
			});
			const units = outcome.result.matches.filter((match) => detail === "repos" ? match.type === "repo" : match.type === "content" || match.type === "path");
			const entries = groupInRankOrder(units.map((match) => {
				const mapped = mapRepository(match.repository, cloneSources);
				const lines = match.lines.slice(0, MATCHED_LINES_SHOWN);
				return {
					group: mapped.group,
					label: detail === "repos" ? mapped.repo : `${mapped.repo} — ${match.path ?? ""}`,
					...detail !== "repos" && match.commit ? { revision: match.commit.slice(0, 7) } : {},
					...detail === "matches" && lines.length > 0 ? { detail: [...lines.map((line) => `${line.lineNumber}: ${clipLine(line.text)}`), ...match.lines.length > lines.length ? [`… ${match.lines.length - lines.length} more matched lines`] : []].join("\n") } : {}
				};
			}).slice(0, limit));
			const artifact = await writeSearchArtifact(cacheDir, toolCallId, units.map((match) => {
				const mapped = mapRepository(match.repository, cloneSources);
				return {
					instance: instance.name,
					repository: match.repository,
					source: mapped.group.cloneSource ?? null,
					repo: mapped.repo,
					...match.path ? { path: match.path } : {},
					...match.commit ? { commit: match.commit } : {},
					...match.lines.length > 0 ? { lines: match.lines } : {}
				};
			}));
			const warnings = outcome.warnings.map((warning) => `Warning: ${warning}`);
			return {
				content: [{
					type: "text",
					text: [formatDigest({
						found: found(detail, outcome.result),
						source: instance.name,
						complete: outcome.complete,
						incompleteReason: outcome.incompleteReason,
						fetchedCount: units.length,
						limitHit: false,
						shownCount: entries.length,
						artifact
					}, entries), ...warnings].join("\n\n")
				}],
				details: {
					kind: "search_code_sourcegraph",
					source: instance.name,
					unit: detail,
					matchCount: outcome.result.progress.matchCount,
					repoCount: detail === "repos" ? void 0 : outcome.result.progress.repositoriesCount,
					fetchedCount: units.length,
					shownCount: entries.length,
					complete: outcome.complete,
					incompleteReason: outcome.incompleteReason,
					artifact,
					entries
				}
			};
		}
	});
}
// src/core/web-urls.ts
function bitbucketRepoPath(repo) {
	const [project, slug, ...rest] = repo.split("/");
	return project && slug && rest.length === 0 ? `projects/${project}/repos/${slug}` : void 0;
}
function repoWebUrl(source, repo) {
	switch (source.kind) {
		case "github":
		case "gitlab": return `${source.url}/${repo}`;
		case "bitbucket-server": {
			const repoPath = bitbucketRepoPath(repo);
			return repoPath ? `${source.url}/${repoPath}` : void 0;
		}
		case "sourcegraph": return `${source.url}/${repo}`;
	}
}
// src/core/tools/search-repos-bitbucket.ts
const BITBUCKET_MAX = 50;
function createSearchReposBitbucketTool(instances, clients, cacheDir, search) {
	const Params = _Object_({
		...sourceProperties(instances, "Which Bitbucket to search"),
		name: Optional(String$1({ description: "Repositories whose name starts with this, case-insensitively." })),
		project: Optional(String$1({ description: "Restrict to a project key, e.g. PROJ." })),
		limit: limitParameter(BITBUCKET_MAX, search.defaultLimit)
	});
	return defineTool({
		name: LIBRARIAN_TOOL_NAMES.searchReposBitbucket,
		label: "Search Bitbucket repos",
		description: "Find repositories on a Bitbucket Server instance by the start of their name, optionally within one project. Bitbucket reports no total, only whether more exist.",
		parameters: Params,
		annotations: {
			readOnlyHint: true,
			openWorldHint: true
		},
		async execute(toolCallId, params, signal) {
			const instance = selectInstance(instances, params);
			const client = clients.get(instance.name);
			if (!client) throw new Error(`No Bitbucket client for source "${instance.name}".`);
			const limit = resolveLimit(params.limit, search, BITBUCKET_MAX);
			const project = params.project ? rejectUnsafeValue("project", params.project) : void 0;
			await client.authorize();
			const result = await runRestSearch(search, signal, "add project, or a longer name.", (searchSignal) => client.searchRepositories({
				name: params.name?.trim() || void 0,
				project,
				limit
			}, searchSignal));
			if (result.repositories.length === 0 && project && !await client.projectExists(project, signal)) throw new Error(`No Bitbucket project ${project} on ${instance.name}, or it is not visible to this token.`);
			const entries = result.repositories.map((repository) => {
				const url = repoWebUrl(instance, repository.repo);
				return {
					label: repository.repo,
					...url ? { url } : {},
					...repository.archived ? { meta: "archived" } : {},
					...repository.description ? { detail: repository.description } : {}
				};
			});
			const artifact = await writeSearchArtifact(cacheDir, toolCallId, result.repositories.map((repository) => ({
				source: instance.name,
				...repository
			})));
			const count = result.repositories.length;
			return {
				content: [{
					type: "text",
					text: formatDigest({
						found: result.isLastPage ? `${plural(count, "repository", "repositories")} match` : `More than ${plural(count, "repository", "repositories")} match`,
						source: instance.name,
						complete: void 0,
						incompleteReason: void 0,
						fetchedCount: count,
						limitHit: !result.isLastPage,
						shownCount: entries.length,
						artifact
					}, entries)
				}],
				details: {
					kind: "search_repos_bitbucket",
					source: instance.name,
					matchCount: count,
					fetchedCount: count,
					shownCount: entries.length,
					complete: void 0,
					artifact,
					entries
				}
			};
		}
	});
}
// src/core/github-languages.ts
const GITHUB_LANGUAGES = /* @__PURE__ */ new Set([
	"1c-enterprise",
	"2-dimensional-array",
	"4d",
	"abap",
	"abap-cds",
	"abl",
	"abnf",
	"abuild",
	"acfm",
	"ackrc",
	"aconf",
	"actionscript",
	"actionscript-3",
	"actionscript3",
	"ad-block",
	"ad-block-filters",
	"ada",
	"ada2005",
	"ada95",
	"adb",
	"adblock",
	"adblock-filter-list",
	"adobe-composite-font-metrics",
	"adobe-font-metrics",
	"adobe-multiple-font-metrics",
	"advpl",
	"afdko",
	"agda",
	"ags",
	"ags-script",
	"ahk",
	"aidl",
	"aiken",
	"al",
	"aleo",
	"algol",
	"alloy",
	"alpine-abuild",
	"altium",
	"altium-designer",
	"amfm",
	"ampl",
	"amusewiki",
	"angelscript",
	"answer-set-programming",
	"ant-build-system",
	"antlers",
	"antlr",
	"apache",
	"apacheconf",
	"apex",
	"api-blueprint",
	"apkbuild",
	"apl",
	"apollo-guidance-computer",
	"apples",
	"applescript",
	"arc",
	"arexx",
	"arkts",
	"as3",
	"ascii-stl",
	"asciidoc",
	"asl",
	"asm",
	"asn.1",
	"asp",
	"asp.net",
	"aspectj",
	"aspx",
	"aspx-vb",
	"assembly",
	"astro",
	"asymptote",
	"ats",
	"ats2",
	"au3",
	"augeas",
	"autoconf",
	"autohotkey",
	"autoit",
	"autoit3",
	"autoitscript",
	"avro-idl",
	"awk",
	"b",
	"b-(formal-method)",
	"b3d",
	"b4x",
	"ballerina",
	"baml",
	"bash",
	"bash-session",
	"basic",
	"basic-for-android",
	"bat",
	"batch",
	"batchfile",
	"bazel",
	"bbcode",
	"be",
	"beef",
	"befunge",
	"bend",
	"bend2",
	"berry",
	"bh",
	"bibtex",
	"bibtex-style",
	"bicep",
	"bikeshed",
	"bird",
	"bird2",
	"bird3",
	"bison",
	"bitbake",
	"blade",
	"blitz3d",
	"blitzbasic",
	"blitzmax",
	"blitzplus",
	"blp",
	"blueprint",
	"bluespec",
	"bluespec-bh",
	"bluespec-bsv",
	"bluespec-classic",
	"bmax",
	"boo",
	"boogie",
	"bplus",
	"bqn",
	"brainfuck",
	"brighterscript",
	"brightscript",
	"bro",
	"browserslist",
	"bru",
	"bsdmake",
	"bsv",
	"buildstream",
	"byond",
	"bzl",
	"c",
	"c#",
	"c++",
	"c++-objdump",
	"c-objdump",
	"c2hs",
	"c2hs-haskell",
	"c3",
	"cabal",
	"cabal-config",
	"caddy",
	"caddyfile",
	"cadence",
	"cairo",
	"cairo-zero",
	"cake",
	"cakescript",
	"cameligo",
	"cangjie",
	"cap'n-proto",
	"cap-cds",
	"carbon",
	"carto",
	"cartocss",
	"cask",
	"cds",
	"ceylon",
	"cfc",
	"cfm",
	"cfml",
	"chapel",
	"charity",
	"checksum",
	"checksums",
	"chpl",
	"chuck",
	"cil",
	"circom",
	"cirru",
	"clarion",
	"clarity",
	"classic-asp",
	"classic-qbasic",
	"classic-quickbasic",
	"classic-visual-basic",
	"clean",
	"click",
	"clipper",
	"clips",
	"clojure",
	"closure-templates",
	"cloud-firestore-security-rules",
	"clue",
	"cmake",
	"cobol",
	"coccinelle",
	"codeowners",
	"codeql",
	"coffee",
	"coffee-script",
	"coffeescript",
	"coldfusion",
	"coldfusion-cfc",
	"coldfusion-html",
	"collada",
	"commit",
	"common-lisp",
	"common-workflow-language",
	"component-pascal",
	"conf",
	"conll",
	"conll-u",
	"conll-x",
	"console",
	"containerfile",
	"cooklang",
	"cool",
	"coq",
	"cperl",
	"cpp",
	"cpp-objdump",
	"cql",
	"creole",
	"cron",
	"cron-table",
	"crontab",
	"crystal",
	"csharp",
	"cson",
	"csound",
	"csound-csd",
	"csound-document",
	"csound-orc",
	"csound-sco",
	"csound-score",
	"css",
	"csv",
	"cucumber",
	"cuda",
	"cue",
	"cue-sheet",
	"curl-config",
	"curlrc",
	"curry",
	"cweb",
	"cwl",
	"cycript",
	"cylc",
	"cypher",
	"cython",
	"d",
	"d-objdump",
	"d2",
	"d2lang",
	"dafny",
	"darcs-patch",
	"dart",
	"daslang",
	"dataweave",
	"dcl",
	"debian-package-control-file",
	"delphi",
	"denizenscript",
	"desktop",
	"dhall",
	"diff",
	"digital-command-language",
	"dircolors",
	"directx-3d-file",
	"django",
	"dlang",
	"dm",
	"dns-zone",
	"dockerfile",
	"dogescript",
	"dosbatch",
	"dosini",
	"dotenv",
	"dpatch",
	"dtrace",
	"dtrace-script",
	"dune",
	"dylan",
	"e",
	"e-mail",
	"eagle",
	"earthfile",
	"earthly",
	"eask",
	"easybuild",
	"ebnf",
	"ec",
	"ecere-projects",
	"ecl",
	"eclipse",
	"ecmarkdown",
	"ecmarkup",
	"ecr",
	"edge",
	"edgeql",
	"editor-config",
	"editorconfig",
	"edje-data-collection",
	"edn",
	"eeschema-schematic",
	"eex",
	"eiffel",
	"ejs",
	"electronic-business-card",
	"elisp",
	"elixir",
	"elm",
	"elvish",
	"elvish-transcript",
	"emacs",
	"emacs-lisp",
	"emacs-muse",
	"email",
	"emberscript",
	"eml",
	"envrc",
	"eq",
	"erb",
	"erlang",
	"esdl",
	"euphoria",
	"f#",
	"f*",
	"factor",
	"fancy",
	"fantom",
	"faust",
	"fb",
	"fennel",
	"figfont",
	"figlet-font",
	"filebench-wml",
	"filterscript",
	"firrtl",
	"fish",
	"flatbuffers",
	"flex",
	"flix",
	"fluent",
	"flux",
	"formatted",
	"forth",
	"fortran",
	"fortran-free-form",
	"foxpro",
	"fpp",
	"freebasic",
	"freemarker",
	"frege",
	"fsharp",
	"fstar",
	"ftl",
	"fundamental",
	"futhark",
	"g-code",
	"game-maker-language",
	"gaml",
	"gams",
	"gap",
	"gas",
	"gcc-machine-description",
	"gdb",
	"gdscript",
	"gdshader",
	"gedcom",
	"gemfile.lock",
	"gemini",
	"gemtext",
	"genero-4gl",
	"genero-per",
	"genie",
	"genshi",
	"gentoo-ebuild",
	"gentoo-eclass",
	"geojson",
	"gerber-image",
	"gettext-catalog",
	"gf",
	"gherkin",
	"git-attributes",
	"git-blame-ignore-revs",
	"git-commit",
	"git-config",
	"git-ignore",
	"git-revision-list",
	"gitattributes",
	"gitconfig",
	"gitignore",
	"gitmodules",
	"gjs",
	"gleam",
	"glimmer-js",
	"glimmer-ts",
	"glsl",
	"glyph",
	"glyph-bitmap-distribution-format",
	"gn",
	"gno",
	"gnolang",
	"gnu-asm",
	"gnuplot",
	"go",
	"go-checksums",
	"go-mod",
	"go-module",
	"go-sum",
	"go-template",
	"go-work",
	"go-work-sum",
	"go-workspace",
	"go.mod",
	"go.sum",
	"go.work",
	"go.work.sum",
	"godot-resource",
	"golang",
	"golo",
	"gosu",
	"gotmpl",
	"grace",
	"gradle",
	"gradle-kotlin-dsl",
	"grammatical-framework",
	"graph-modeling-language",
	"graphql",
	"graphviz-(dot)",
	"groff",
	"groovy",
	"groovy-server-pages",
	"gsc",
	"gsp",
	"gtk",
	"gtk-1",
	"gtk-2",
	"gtkrc",
	"gts",
	"hack",
	"haml",
	"handlebars",
	"haproxy",
	"harbour",
	"hare",
	"hash",
	"hashes",
	"hashicorp-configuration-language",
	"haskell",
	"haxe",
	"hbs",
	"hcl",
	"heex",
	"help",
	"hip",
	"hiveql",
	"hls-playlist",
	"hlsl",
	"hocon",
	"holyc",
	"hoon",
	"hosts",
	"hosts-file",
	"html",
	"html+django",
	"html+ecr",
	"html+eex",
	"html+erb",
	"html+jinja",
	"html+php",
	"html+razor",
	"html+ruby",
	"htmlbars",
	"htmldjango",
	"http",
	"hurl",
	"hxml",
	"hy",
	"hylang",
	"hyphy",
	"i7",
	"ical",
	"icalendar",
	"idl",
	"idris",
	"ignore",
	"ignore-list",
	"igor",
	"igor-pro",
	"igorpro",
	"ijm",
	"il-assembly",
	"ilasm",
	"ile-rpg",
	"imagej-macro",
	"imba",
	"imhex",
	"imhex-pattern-language",
	"imhexpatternlanguage",
	"imhexpl",
	"inc",
	"inform-7",
	"inform7",
	"ini",
	"ink",
	"inno-setup",
	"inputrc",
	"io",
	"ioke",
	"ipython-notebook",
	"irc",
	"irc-log",
	"irc-logs",
	"isabelle",
	"isabelle-root",
	"ispc",
	"j",
	"jac",
	"jai",
	"janet",
	"jar-manifest",
	"jasmin",
	"jass",
	"jass2",
	"java",
	"java-properties",
	"java-server-page",
	"java-server-pages",
	"java-template-engine",
	"javascript",
	"javascript+erb",
	"jcl",
	"jest-snapshot",
	"jetbrains-mps",
	"jflex",
	"jinja",
	"jison",
	"jison-lex",
	"jolie",
	"jq",
	"jruby",
	"js",
	"json",
	"json-with-comments",
	"json5",
	"jsonc",
	"jsoniq",
	"jsonl",
	"jsonld",
	"jsonnet",
	"jsp",
	"jte",
	"julia",
	"julia-repl",
	"jupyter-notebook",
	"just",
	"justfile",
	"kaitai-struct",
	"kak",
	"kakounescript",
	"kakscript",
	"kcl",
	"kdl",
	"kerboscript",
	"keyvalues",
	"kframework",
	"kicad-layout",
	"kicad-legacy-layout",
	"kicad-schematic",
	"kickstart",
	"kit",
	"koka",
	"kolmafia-ash",
	"kotlin",
	"krl",
	"ksy",
	"kusto",
	"kvlang",
	"labview",
	"lambdapi",
	"langium",
	"lark",
	"lasso",
	"lassoscript",
	"latex",
	"latte",
	"lean",
	"lean-4",
	"lean4",
	"leex",
	"leo",
	"less",
	"less-css",
	"lex",
	"lfe",
	"lhaskell",
	"lhs",
	"ligolang",
	"lilypond",
	"limbo",
	"linear-programming",
	"linker-script",
	"linux-kernel-module",
	"liquid",
	"liquidsoap",
	"lisp",
	"litcoffee",
	"literate-agda",
	"literate-coffeescript",
	"literate-haskell",
	"live-script",
	"livecode-script",
	"livescript",
	"llvm",
	"llvm-tablegen",
	"lobster",
	"logos",
	"logtalk",
	"lolcode",
	"lookml",
	"loomscript",
	"ls",
	"lsl",
	"ltspice-symbol",
	"lua",
	"luau",
	"m",
	"m2",
	"m3u",
	"m3u-playlist",
	"m4",
	"m4sugar",
	"m68k",
	"macaulay2",
	"macruby",
	"mail",
	"make",
	"makefile",
	"mako",
	"man",
	"man-page",
	"manpage",
	"markdown",
	"marko",
	"markojs",
	"mask",
	"mathematica",
	"mathematical-programming-system",
	"matlab",
	"maven-pom",
	"max",
	"max/msp",
	"maxmsp",
	"maxscript",
	"mbox",
	"mcfunction",
	"md",
	"mdoc",
	"mdsvex",
	"mdx",
	"mediawiki",
	"mercury",
	"mermaid",
	"mermaid-example",
	"meson",
	"metal",
	"metta",
	"mf",
	"microsoft-developer-studio-project",
	"microsoft-visual-studio-solution",
	"minid",
	"miniscript",
	"miniyaml",
	"minizinc",
	"minizinc-data",
	"mint",
	"mirah",
	"mirc-script",
	"mlir",
	"mma",
	"modelica",
	"modula-2",
	"modula-3",
	"module-management-system",
	"mojo",
	"monkey",
	"monkey-c",
	"moocode",
	"moonbit",
	"moonscript",
	"motoko",
	"motorola-68k-assembly",
	"move",
	"mps",
	"mql4",
	"mql5",
	"msil",
	"mtml",
	"muf",
	"mumps",
	"mupad",
	"muse",
	"mustache",
	"myghty",
	"nanorc",
	"nargo",
	"nasal",
	"nasl",
	"nasm",
	"ncl",
	"ne-on",
	"nearley",
	"nemerle",
	"neon",
	"neosnippet",
	"nesc",
	"netlinx",
	"netlinx+erb",
	"netlogo",
	"nette-object-notation",
	"newlisp",
	"nextflow",
	"nginx",
	"nginx-configuration-file",
	"nickel",
	"nim",
	"ninja",
	"nit",
	"nix",
	"nixos",
	"njk",
	"nl",
	"nmodl",
	"node",
	"noir",
	"npm-config",
	"npmrc",
	"nroff",
	"nsis",
	"nu",
	"nu-script",
	"numpy",
	"nunjucks",
	"nush",
	"nushell",
	"nushell-script",
	"nvim",
	"nwscript",
	"oasv2",
	"oasv2-json",
	"oasv2-yaml",
	"oasv3",
	"oasv3-json",
	"oasv3-yaml",
	"oberon",
	"obj-c",
	"obj-c++",
	"obj-j",
	"objc",
	"objc++",
	"objdump",
	"object-data-instance-notation",
	"objective-c",
	"objective-c++",
	"objective-j",
	"objectivec",
	"objectivec++",
	"objectivej",
	"objectpascal",
	"objectscript",
	"objj",
	"ocaml",
	"octave",
	"odin",
	"odin-lang",
	"odinlang",
	"omgrofl",
	"omnet++-msg",
	"omnet++-ned",
	"omnetpp-msg",
	"omnetpp-ned",
	"oncrpc",
	"ooc",
	"opa",
	"opal",
	"open-policy-agent",
	"openapi-specification-v2",
	"openapi-specification-v3",
	"opencl",
	"openedge",
	"openedge-abl",
	"openqasm",
	"openrc",
	"openrc-runscript",
	"openscad",
	"openstep-property-list",
	"opentofu",
	"opentype-feature-file",
	"option-list",
	"opts",
	"opy",
	"org",
	"osascript",
	"overpassql",
	"overpy",
	"ox",
	"oxygene",
	"oz",
	"p4",
	"pact",
	"pan",
	"pandoc",
	"papyrus",
	"parrot",
	"parrot-assembly",
	"parrot-internal-representation",
	"pascal",
	"pasm",
	"pawn",
	"pcbnew",
	"pddl",
	"peg.js",
	"pep8",
	"perl",
	"perl-6",
	"perl6",
	"php",
	"pic",
	"pickle",
	"picolisp",
	"piglatin",
	"pikchr",
	"pike",
	"pip-requirements",
	"pir",
	"pkg-config",
	"pkgconf",
	"pkl",
	"plain-text",
	"plantuml",
	"plpgsql",
	"plsql",
	"pod",
	"pod-6",
	"pogoscript",
	"polar",
	"pony",
	"portugol",
	"posh",
	"postcss",
	"postscr",
	"postscript",
	"pot",
	"pov-ray",
	"pov-ray-sdl",
	"povray",
	"power-query",
	"powerbuilder",
	"powerquery",
	"powershell",
	"praat",
	"prisma",
	"pro*c",
	"processing",
	"procfile",
	"progress",
	"proguard",
	"prolog",
	"promela",
	"propeller-spin",
	"proto",
	"protobuf",
	"protobuf-text-format",
	"protocol-buffer",
	"protocol-buffer-text-format",
	"protocol-buffers",
	"public-key",
	"pug",
	"puppet",
	"pure-data",
	"purebasic",
	"purescript",
	"pwsh",
	"py",
	"py3",
	"pycon",
	"pyret",
	"pyrex",
	"python",
	"python-console",
	"python-traceback",
	"python3",
	"q",
	"q#",
	"qb",
	"qb64",
	"qbasic",
	"ql",
	"qmake",
	"qml",
	"qsharp",
	"qt-script",
	"quake",
	"quakec",
	"quartus-simulation-ip",
	"quickbasic",
	"quint",
	"r",
	"racket",
	"ragel",
	"ragel-rb",
	"ragel-ruby",
	"rake",
	"raku",
	"raml",
	"rascal",
	"rascript",
	"raw",
	"raw-token-data",
	"razor",
	"rb",
	"rbs",
	"rbx",
	"rdoc",
	"readline",
	"readline-config",
	"realbasic",
	"reason",
	"reasonligo",
	"rebol",
	"record-jar",
	"red",
	"red/system",
	"redcode",
	"redirect-rules",
	"redirects",
	"redscript",
	"regex",
	"regexp",
	"regular-expression",
	"ren'py",
	"renderscript",
	"renpy",
	"rescript",
	"restructuredtext",
	"rexx",
	"rez",
	"rhai",
	"rhtml",
	"rich-text-format",
	"ring",
	"riot",
	"rmarkdown",
	"robotframework",
	"robots",
	"robots-exclusion-rules",
	"robots-txt",
	"robotx.txt",
	"roc",
	"rocq",
	"rocq-prover",
	"roff",
	"roff-manpage",
	"ron",
	"ros-interface",
	"rosmsg",
	"rouge",
	"routeros-script",
	"rpc",
	"rpcgen",
	"rpgle",
	"rpm-spec",
	"rs",
	"rs-274x",
	"rscript",
	"rss",
	"rst",
	"ruby",
	"runoff",
	"rust",
	"rusthon",
	"sage",
	"sail",
	"salt",
	"saltstack",
	"saltstate",
	"sarif",
	"sas",
	"sass",
	"scala",
	"scaml",
	"scenic",
	"scheme",
	"scilab",
	"scss",
	"sdc",
	"sed",
	"self",
	"selinux-kernel-policy-language",
	"selinux-policy",
	"sepolicy",
	"sfv",
	"sh",
	"shaderlab",
	"shell",
	"shell-script",
	"shellcheck-config",
	"shellcheckrc",
	"shellsession",
	"shen",
	"sieve",
	"simple-file-verification",
	"singularity",
	"sip",
	"slang",
	"slash",
	"slice",
	"slim",
	"slint",
	"smali",
	"smalltalk",
	"smarty",
	"smithy",
	"sml",
	"smpl",
	"smt",
	"snakefile",
	"snakemake",
	"snipmate",
	"snippet",
	"solidity",
	"soong",
	"sourcemod",
	"sourcepawn",
	"soy",
	"sparql",
	"specfile",
	"spicedb-schema",
	"spline-font-database",
	"splus",
	"sqf",
	"sql",
	"sqlpl",
	"sqlrpgle",
	"squeak",
	"squirrel",
	"srecode-template",
	"ssh-config",
	"ssh_config",
	"sshconfig",
	"sshd_config",
	"sshdconfig",
	"stan",
	"standard-ml",
	"star",
	"starlark",
	"stata",
	"stl",
	"stla",
	"ston",
	"stringtemplate",
	"stylus",
	"subrip-text",
	"sugarss",
	"sum",
	"sums",
	"supercollider",
	"surql",
	"surrealql",
	"survex-data",
	"svelte",
	"svg",
	"sway",
	"sweave",
	"swift",
	"swig",
	"systemverilog",
	"tab-seperated-values",
	"tablegen",
	"tabular-model-definition-language",
	"tact",
	"talon",
	"tape",
	"tcl",
	"tcsh",
	"tea",
	"teal",
	"templ",
	"terra",
	"terraform",
	"terraform-template",
	"tex",
	"texinfo",
	"text",
	"text-proto",
	"textgrid",
	"textile",
	"textmate-properties",
	"thrift",
	"ti-program",
	"tl",
	"tl-verilog",
	"tla",
	"tm-properties",
	"tmdl",
	"toit",
	"tolk",
	"toml",
	"topojson",
	"tor-config",
	"torrc",
	"traveling-salesman-problem",
	"travelling-salesman-problem",
	"tree-sitter-query",
	"troff",
	"ts",
	"tsp",
	"tsplib-data",
	"tsq",
	"tsql",
	"tsv",
	"tsx",
	"turing",
	"turtle",
	"twig",
	"txl",
	"typ",
	"type-language",
	"typescript",
	"typescriptreact",
	"typespec",
	"typst",
	"ucode",
	"udiff",
	"ultisnip",
	"ultisnips",
	"unified-parallel-c",
	"unity3d-asset",
	"unix-asm",
	"unix-assembly",
	"uno",
	"unrealscript",
	"untyped-plutus-core",
	"ur",
	"ur/web",
	"urweb",
	"v",
	"vala",
	"valve-data-format",
	"vb-.net",
	"vb-6",
	"vb.net",
	"vb6",
	"vba",
	"vbnet",
	"vbscript",
	"vcard",
	"vcl",
	"vdf",
	"velocity",
	"velocity-template-language",
	"vento",
	"verilog",
	"verse",
	"vespa",
	"vespa-schema-definition",
	"vhdl",
	"vhs",
	"vim",
	"vim-help-file",
	"vim-script",
	"vim-snippet",
	"vimhelp",
	"viml",
	"vimscript",
	"virtual-contact-file",
	"visual-basic",
	"visual-basic-.net",
	"visual-basic-6",
	"visual-basic-6.0",
	"visual-basic-classic",
	"visual-basic-for-applications",
	"vlang",
	"volt",
	"vtl",
	"vtt",
	"vue",
	"vyper",
	"wasm",
	"wast",
	"wavefront-material",
	"wavefront-object",
	"wdl",
	"web-ontology-language",
	"webassembly",
	"webassembly-interface-type",
	"webidl",
	"webvtt",
	"wget-config",
	"wgetrc",
	"wgsl",
	"whiley",
	"wiki",
	"wikitext",
	"win32-message-file",
	"winbatch",
	"windows-registry-entries",
	"wisp",
	"wit",
	"witcher-script",
	"wl",
	"wolfram",
	"wolfram-lang",
	"wolfram-language",
	"wollok",
	"workflow-description-language",
	"world-of-warcraft-addon-data",
	"wren",
	"wrenlang",
	"wsdl",
	"x-bitmap",
	"x-font-directory-index",
	"x-pixmap",
	"x10",
	"xbase",
	"xbm",
	"xc",
	"xcompose",
	"xdc",
	"xdr",
	"xhtml",
	"xmake",
	"xml",
	"xml+genshi",
	"xml+kid",
	"xml-property-list",
	"xojo",
	"xonsh",
	"xpages",
	"xpm",
	"xproc",
	"xquery",
	"xs",
	"xsd",
	"xsl",
	"xslt",
	"xten",
	"xtend",
	"yacc",
	"yaml",
	"yang",
	"yara",
	"yas",
	"yasnippet",
	"yml",
	"yul",
	"zap",
	"zeek",
	"zenscript",
	"zephir",
	"zig",
	"zil",
	"zimpl",
	"zmodel",
	"zsh"
]);
// src/core/tools/search-repos-github.ts
const GITHUB_REPO_SEARCH_MAX = 50;
function normalizeGitHubLanguage(language) {
	const normalized = language.trim().toLowerCase().replace(/\s+/g, "-");
	if (!GITHUB_LANGUAGES.has(normalized)) throw new Error(`GitHub does not know the language "${language}", and would silently search every language instead. Use its GitHub name, e.g. typescript, c#, or jupyter-notebook.`);
	return normalized;
}
function buildGitHubRepoQuery(query) {
	const parts = [];
	const text = query.text?.trim();
	if (text) {
		const qualifier = /(^|\s)(-?[A-Za-z_]+):\S/.exec(text.replace(/"[^"]*"/g, " "));
		if (qualifier) throw new Error(`text contains a qualifier "${qualifier[2]}:". Use the language, topics, min_stars, and pushed_after arguments instead.`);
		parts.push(text);
		if (query.inReadme) parts.push("in:readme");
	}
	if (query.language) parts.push(`language:${normalizeGitHubLanguage(query.language)}`);
	for (const topic of query.topics) parts.push(`topic:${rejectUnsafeValue("topics", topic)}`);
	if (query.minStars !== void 0) parts.push(`stars:>=${query.minStars}`);
	if (query.pushedAfter) parts.push(`pushed:>${validateIsoDate("pushed_after", query.pushedAfter)}`);
	if (parts.length === 0) throw new Error("Give at least one of text, language, topics, min_stars, or pushed_after; an empty query asks for all of GitHub.");
	if (query.includeForks) parts.push("fork:true");
	if (!query.includeArchived) parts.push("archived:false");
	return parts.join(" ");
}
function repoMeta(hit) {
	const meta = [`★${hit.stars}`];
	if (hit.language) meta.push(hit.language);
	if (hit.pushedAt) meta.push(`last modified ${hit.pushedAt.slice(0, 10)}`);
	if (hit.archived) meta.push("archived");
	if (hit.fork) meta.push("fork");
	return meta.join(" · ");
}
function repoDetail(hit) {
	const lines = [...hit.description ? [hit.description] : [], ...hit.topics.length > 0 ? [`topics: ${hit.topics.join(", ")}`] : []];
	return lines.length > 0 ? lines.join("\n") : void 0;
}
function createSearchReposGitHubTool(instances, clients, cacheDir, search) {
	const maximum = GITHUB_REPO_SEARCH_MAX;
	const Params = _Object_({
		...sourceProperties(instances, "Which GitHub to search"),
		text: Optional(String$1({ description: "Terms matched against name, description, and topics." })),
		in_readme: Optional(Boolean$1({ description: "Search README text instead of name and description — far broader. Default: false." })),
		language: Optional(String$1({ description: "Restrict to a primary language, e.g. typescript." })),
		topics: Optional(_Array_(String$1(), {
			description: "Only repos tagged with every one of these topics.",
			maxItems: 10
		})),
		min_stars: Optional(Integer({
			minimum: 0,
			description: "Only repos with at least this many stars."
		})),
		pushed_after: Optional(String$1({ description: "Only repos pushed to after this date, YYYY-MM-DD." })),
		include_forks: Optional(Boolean$1({ description: "Include forks. Default: false." })),
		include_archived: Optional(Boolean$1({ description: "Include archived repos. Default: true." })),
		sort: Optional(StringEnum([
			"best-match",
			"stars",
			"updated"
		], { description: "Ordering. Use stars to find what is popular. Default: best-match." })),
		limit: limitParameter(maximum, search.defaultLimit)
	});
	return defineTool({
		name: LIBRARIAN_TOOL_NAMES.searchReposGitHub,
		label: "Search GitHub repos",
		description: "Find GitHub repositories by name, description, topics, language, stars, and recent activity. Returns repositories with their metadata, ranked by relevance or stars.",
		parameters: Params,
		annotations: {
			readOnlyHint: true,
			openWorldHint: true
		},
		async execute(toolCallId, params, signal) {
			const instance = selectInstance(instances, params);
			const provider = clients.get(instance.name);
			if (!provider) throw new Error(`No GitHub client for source "${instance.name}".`);
			const query = buildGitHubRepoQuery({
				text: params.text,
				inReadme: params.in_readme ?? false,
				language: params.language,
				topics: params.topics ?? [],
				minStars: params.min_stars,
				pushedAfter: params.pushed_after,
				includeForks: params.include_forks ?? false,
				includeArchived: params.include_archived ?? true
			});
			const limit = resolveLimit(params.limit, search, maximum);
			const client = await provider();
			const result = await runRestSearch(search, signal, "add language, topics, or min_stars.", (searchSignal) => client.searchRepositories({
				query,
				sort: params.sort ?? "best-match",
				limit,
				signal: searchSignal
			}));
			if (result.incompleteResults && result.hits.length === 0) throw new Error("GitHub could not finish this repository search and found nothing before it stopped. This is not an empty result; narrow it and retry.");
			const complete = result.incompleteResults ? false : void 0;
			const entries = result.hits.map((hit) => {
				const detail = repoDetail(hit);
				return {
					label: hit.repo,
					url: hit.url,
					meta: repoMeta(hit),
					...detail ? { detail } : {}
				};
			});
			const artifact = await writeSearchArtifact(cacheDir, toolCallId, result.hits.map((hit) => ({
				source: instance.name,
				...hit
			})));
			return {
				content: [{
					type: "text",
					text: formatDigest({
						found: `${formatCount(result.totalCount)} repositories match`,
						source: instance.name,
						complete,
						incompleteReason: "GitHub did not finish searching every repository",
						fetchedCount: result.hits.length,
						limitHit: result.hits.length < result.totalCount,
						shownCount: entries.length,
						artifact
					}, entries)
				}],
				details: {
					kind: "search_repos_github",
					source: instance.name,
					matchCount: result.totalCount,
					fetchedCount: result.hits.length,
					shownCount: entries.length,
					complete,
					artifact,
					entries
				}
			};
		}
	});
}
// src/core/tools/search-repos-gitlab.ts
const GITLAB_MAX = 50;
const SORTS = [
	"activity",
	"stars",
	"updated",
	"created",
	"name"
];
const ORDERING = {
	activity: {
		order_by: "last_activity_at",
		sort: "desc"
	},
	stars: {
		order_by: "star_count",
		sort: "desc"
	},
	updated: {
		order_by: "updated_at",
		sort: "desc"
	},
	created: {
		order_by: "created_at",
		sort: "desc"
	},
	name: {
		order_by: "path",
		sort: "asc"
	}
};
function buildGitLabProjectSearch(query) {
	const ordering = ORDERING[query.sort];
	return {
		search: query.name?.trim() || void 0,
		search_namespaces: query.name?.includes("/") ? "true" : void 0,
		simple: "true",
		archived: query.includeArchived ? void 0 : "false",
		topic: query.topics.length > 0 ? query.topics.map((topic) => rejectUnsafeValue("topics", topic)).join(",") : void 0,
		last_activity_after: query.changedAfter ? `${validateIsoDate("changed_after", query.changedAfter)}T00:00:00Z` : void 0,
		order_by: ordering.order_by,
		sort: ordering.sort,
		per_page: String(query.limit)
	};
}
function projectMeta(hit) {
	const meta = [...hit.stars === void 0 ? [] : [`★${hit.stars}`], ...hit.lastActivityAt ? [`last active ${hit.lastActivityAt.slice(0, 10)}`] : []];
	return meta.length > 0 ? meta.join(" · ") : void 0;
}
function createSearchReposGitLabTool(instances, clients, cacheDir, search) {
	const Params = _Object_({
		...sourceProperties(instances, "Which GitLab to search"),
		name: Optional(String$1({ description: "Text matched against project path, name, group path, or description. Every word must appear in the same one of those; words under three characters are ignored." })),
		topics: Optional(_Array_(String$1(), {
			description: "Only projects with every one of these topics, exact and case-sensitive.",
			maxItems: 10
		})),
		changed_after: Optional(String$1({ description: "Only projects with activity after this date, YYYY-MM-DD." })),
		include_archived: Optional(Boolean$1({ description: "Include archived projects. Default: false." })),
		sort: Optional(StringEnum(SORTS, { description: "Ordering. Default: activity, most recently active first." })),
		limit: limitParameter(GITLAB_MAX, search.defaultLimit)
	});
	return defineTool({
		name: LIBRARIAN_TOOL_NAMES.searchReposGitLab,
		label: "Search GitLab projects",
		description: "Find GitLab projects by name, group, description, topic, and recent activity. Returns projects with their stars and last activity.",
		parameters: Params,
		annotations: {
			readOnlyHint: true,
			openWorldHint: true
		},
		async execute(toolCallId, params, signal) {
			const instance = selectInstance(instances, params);
			const client = clients.get(instance.name);
			if (!client) throw new Error(`No GitLab client for source "${instance.name}".`);
			const limit = resolveLimit(params.limit, search, GITLAB_MAX);
			const query = buildGitLabProjectSearch({
				name: params.name,
				topics: params.topics ?? [],
				changedAfter: params.changed_after,
				includeArchived: params.include_archived ?? false,
				sort: params.sort ?? "activity",
				limit
			});
			await client.authorize();
			const result = await runRestSearch(search, signal, "add topics, or a more distinctive name.", (searchSignal) => client.searchProjects(query, searchSignal));
			const entries = result.hits.map((hit) => {
				const meta = projectMeta(hit);
				return {
					label: hit.path,
					url: hit.url,
					...meta ? { meta } : {},
					...hit.description ? { detail: hit.description } : {}
				};
			});
			const artifact = await writeSearchArtifact(cacheDir, toolCallId, result.hits.map((hit) => ({
				source: instance.name,
				...hit
			})));
			const matchCount = result.total ?? result.hits.length;
			return {
				content: [{
					type: "text",
					text: formatDigest({
						found: `${result.total === void 0 ? "At least " : ""}${plural(matchCount, "project")} match`,
						source: instance.name,
						complete: void 0,
						incompleteReason: void 0,
						fetchedCount: result.hits.length,
						limitHit: result.hits.length < matchCount,
						shownCount: entries.length,
						artifact
					}, entries)
				}],
				details: {
					kind: "search_repos_gitlab",
					source: instance.name,
					matchCount,
					fetchedCount: result.hits.length,
					shownCount: entries.length,
					complete: void 0,
					artifact,
					entries
				}
			};
		}
	});
}
// src/core/tools/search-repos-sourcegraph.ts
const SOURCEGRAPH_MAX = 50;
const REPO_RESULT_LIMIT = 5e3;
const HISTORY_SCOPE_LIMIT = 1e3;
function buildSourcegraphRepoQuery(query, count) {
	const parts = ["type:repo", `count:${count}`];
	if (query.name) parts.push(`repo:${validateRegex("name", query.name)}`);
	for (const topic of query.topics) parts.push(`repo:has.topic(${rejectUnsafeValue("topics", topic)})`);
	if (query.containsPath) parts.push(`repo:has.path(${validateRegex("contains_path", query.containsPath)})`);
	if (query.changedAfter) parts.push(`repo:has.commit.after(${validateIsoDate("changed_after", query.changedAfter)})`);
	if (query.includeForks) parts.push("fork:yes");
	if (query.includeArchived) parts.push("archived:yes");
	return parts.join(" ");
}
function createSearchReposSourcegraphTool(instances, clients, cloneSources, cacheDir, search) {
	const Params = _Object_({
		...sourceProperties(instances, "Which Sourcegraph to search"),
		name: Optional(String$1({ description: "RE2 pattern matched against repository names." })),
		topics: Optional(_Array_(String$1(), {
			description: "Only repos with every one of these topics.",
			maxItems: 10
		})),
		contains_path: Optional(String$1({ description: "Only repos with a file whose path matches this RE2 pattern, e.g. ^go\\.mod$." })),
		changed_after: Optional(String$1({ description: "Only repos with a commit after this date, YYYY-MM-DD. Walks git history, about 10 ms per repository in scope, so it is refused above about 1,000 repositories — narrow with name first." })),
		include_forks: Optional(Boolean$1({ description: "Include forks. Default: false." })),
		include_archived: Optional(Boolean$1({ description: "Include archived repos. Default: false." })),
		limit: limitParameter(SOURCEGRAPH_MAX, search.defaultLimit)
	});
	return defineTool({
		name: LIBRARIAN_TOOL_NAMES.searchReposSourcegraph,
		label: "Search Sourcegraph repos",
		description: "Find repositories the Sourcegraph instance indexes by name, topic, a file they contain, or recent commits. Answers what a repository is; to find repositories containing some code, search code with detail repos instead. Results are unordered.",
		parameters: Params,
		annotations: {
			readOnlyHint: true,
			openWorldHint: true
		},
		async execute(toolCallId, params, signal) {
			const instance = selectInstance(instances, params);
			const client = sourcegraphClients(instances, clients, instance);
			const repoQuery = {
				name: params.name,
				topics: params.topics ?? [],
				containsPath: params.contains_path,
				changedAfter: params.changed_after,
				includeForks: params.include_forks ?? false,
				includeArchived: params.include_archived ?? false
			};
			const query = buildSourcegraphRepoQuery(repoQuery, REPO_RESULT_LIMIT);
			const limit = resolveLimit(params.limit, search, SOURCEGRAPH_MAX);
			if (repoQuery.changedAfter) {
				if ((await runSourcegraphSearch({
					client,
					search,
					signal,
					query: buildSourcegraphRepoQuery({
						...repoQuery,
						changedAfter: void 0
					}, 1001),
					patternType: "standard",
					describeFound: (partial) => plural(partial.matches.length, "repo"),
					advice: "narrow name."
				})).result.matches.length > HISTORY_SCOPE_LIMIT) throw new Error(`changed_after covers more than ${formatCount(HISTORY_SCOPE_LIMIT)} repositories, which takes longer than the search budget; narrow with name first.`);
			}
			const outcome = await runSourcegraphSearch({
				client,
				search,
				signal,
				query,
				patternType: "standard",
				describeFound: (partial) => plural(partial.matches.length, "repo"),
				advice: "narrow name, or drop changed_after."
			});
			const repos = outcome.result.matches.filter((match) => match.type === "repo");
			const entries = groupInRankOrder(repos.map((match) => {
				const mapped = mapRepository(match.repository, cloneSources);
				const flags = [...match.fork ? ["fork"] : [], ...match.archived ? ["archived"] : []];
				return {
					group: mapped.group,
					label: mapped.repo,
					...flags.length > 0 ? { meta: flags.join(" · ") } : {},
					...match.description ? { detail: match.description } : {}
				};
			}).slice(0, limit));
			const artifact = await writeSearchArtifact(cacheDir, toolCallId, repos.map((match) => {
				const mapped = mapRepository(match.repository, cloneSources);
				return {
					instance: instance.name,
					repository: match.repository,
					source: mapped.group.cloneSource ?? null,
					repo: mapped.repo,
					...match.description ? { description: match.description } : {},
					fork: match.fork,
					archived: match.archived
				};
			}));
			return {
				content: [{
					type: "text",
					text: formatDigest({
						found: `${plural(repos.length, "repository", "repositories")} match`,
						source: instance.name,
						complete: outcome.complete,
						incompleteReason: outcome.incompleteReason,
						fetchedCount: repos.length,
						limitHit: false,
						shownCount: entries.length,
						artifact
					}, entries)
				}],
				details: {
					kind: "search_repos_sourcegraph",
					source: instance.name,
					matchCount: repos.length,
					fetchedCount: repos.length,
					shownCount: entries.length,
					complete: outcome.complete,
					incompleteReason: outcome.incompleteReason,
					artifact,
					entries
				}
			};
		}
	});
}
// src/core/tools/index.ts
function sourcesWith(sources, kind, role) {
	return sources.filter((source) => source.kind === kind && source.roles.includes(role));
}
function tokenResolver(source, token) {
	if (token.kind === "value") return async () => token.value;
	let resolved;
	return () => {
		resolved ??= runCredentialCommand(token.command, `librarian.sources "${source.name}" tokenCommand`, void 0).catch((error) => {
			resolved = void 0;
			throw error;
		});
		return resolved;
	};
}
function createRepoClients(settings, ghCliToken) {
	const github = /* @__PURE__ */ new Map();
	const sourcegraph = /* @__PURE__ */ new Map();
	const gitlab = /* @__PURE__ */ new Map();
	const bitbucket = /* @__PURE__ */ new Map();
	const readers = /* @__PURE__ */ new Map();
	for (const source of settings.sources) switch (source.kind) {
		case "github": {
			const token = source.token;
			const provider = createGitHubClientProvider(token === void 0 ? source.name === "github" ? ghCliToken : async () => void 0 : tokenResolver(source, token), source.url);
			github.set(source.name, provider);
			readers.set(source.name, createGitHubFileReader(provider));
			break;
		}
		case "sourcegraph":
			if (source.token) sourcegraph.set(source.name, new SourcegraphClient(source.url, tokenResolver(source, source.token)));
			break;
		case "gitlab":
			if (source.token) {
				const client = new GitLabClient(source.url, tokenResolver(source, source.token), Date.now);
				gitlab.set(source.name, client);
				readers.set(source.name, createGitLabFileReader(client));
			}
			break;
		case "bitbucket-server": if (source.token) {
			const client = new BitbucketClient(source.url, tokenResolver(source, source.token));
			bitbucket.set(source.name, client);
			readers.set(source.name, createBitbucketFileReader(client));
		}
	}
	return {
		github,
		sourcegraph,
		gitlab,
		bitbucket,
		readers
	};
}
function readableSources(settings, clients) {
	return settings.sources.filter((source) => source.roles.includes("clone") && clients.readers.has(source.name));
}
function withSourceNotes(tool, instances) {
	const notes = instances.flatMap((instance) => instance.description === void 0 ? [] : [`- ${instance.name}: ${instance.description}`]);
	return notes.length === 0 ? tool : {
		...tool,
		description: `${tool.description}\n\nNotes on its sources:\n${notes.join("\n")}`
	};
}
function createRepoTools(settings, clients) {
	const { cacheDir, search, sources } = settings;
	const tools = [];
	const impliedSources = /* @__PURE__ */ new Map([[LIBRARIAN_TOOL_NAMES.searchCodeGrepApp, "grep.app"]]);
	const add = (tool, instances) => {
		tools.push(withSourceNotes(tool, instances));
		if (instances.length === 1 && instances[0]) impliedSources.set(tool.name, instances[0].name);
	};
	const githubCode = sourcesWith(sources, "github", "code-search");
	if (githubCode.length > 0) add(createSearchCodeGitHubTool(githubCode, clients.github, cacheDir, search), githubCode);
	tools.push(createSearchCodeGrepAppTool(cacheDir, search));
	const gitlabCode = sourcesWith(sources, "gitlab", "code-search");
	if (gitlabCode.length > 0) add(createSearchCodeGitLabTool(gitlabCode, clients.gitlab, cacheDir, search), gitlabCode);
	const bitbucketCode = sourcesWith(sources, "bitbucket-server", "code-search");
	if (bitbucketCode.length > 0) add(createSearchCodeBitbucketTool(bitbucketCode, clients.bitbucket, cacheDir, search), bitbucketCode);
	const clonable = cloneSources(sources);
	const sourcegraphCode = sourcesWith(sources, "sourcegraph", "code-search");
	if (sourcegraphCode.length > 0) {
		add(createSearchCodeSourcegraphTool(sourcegraphCode, clients.sourcegraph, clonable, cacheDir, search), sourcegraphCode);
		add(createFindDefinitionTool(sourcegraphCode, clients.sourcegraph, clonable, cacheDir, search), sourcegraphCode);
	}
	const githubRepos = sourcesWith(sources, "github", "repo-search");
	if (githubRepos.length > 0) add(createSearchReposGitHubTool(githubRepos, clients.github, cacheDir, search), githubRepos);
	const gitlabRepos = sourcesWith(sources, "gitlab", "repo-search");
	if (gitlabRepos.length > 0) add(createSearchReposGitLabTool(gitlabRepos, clients.gitlab, cacheDir, search), gitlabRepos);
	const bitbucketRepos = sourcesWith(sources, "bitbucket-server", "repo-search");
	if (bitbucketRepos.length > 0) add(createSearchReposBitbucketTool(bitbucketRepos, clients.bitbucket, cacheDir, search), bitbucketRepos);
	const sourcegraphRepos = sourcesWith(sources, "sourcegraph", "repo-search");
	if (sourcegraphRepos.length > 0) add(createSearchReposSourcegraphTool(sourcegraphRepos, clients.sourcegraph, clonable, cacheDir, search), sourcegraphRepos);
	const readable = readableSources(settings, clients);
	if (readable.length > 0) add(createReadFileTool(readable, clients.readers), readable);
	tools.push(withSourceNotes(createCheckoutRepoTool(cacheDir, sources), clonable));
	return {
		tools,
		impliedSources
	};
}
// src/core/web/shared.ts
function getErrorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}
function summarizeExcerpt(text, maxLength = 220) {
	if (!text) return "";
	const normalized = text.replace(/\s+/g, " ").trim();
	if (normalized.length <= maxLength) return normalized;
	return `${normalized.slice(0, maxLength - 1)}…`;
}
function formatWarnings(warnings) {
	if (!warnings?.length) return [];
	return warnings.map((warning) => {
		const type = warning.type ? `[${warning.type}] ` : "";
		const message = warning.message.trim();
		return message ? `${type}${message}` : void 0;
	}).filter((warning) => Boolean(warning));
}
function slugify(value) {
	return value.toLowerCase().replace(/https?:\/\//g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
async function writeDocumentBody(artifactDir, url, name, content) {
	const filePath = path.join(artifactDir, slugify(url) || "document", safeArtifactName(name));
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, content);
	return {
		name,
		path: filePath,
		lines: countLines(content),
		bytes: Buffer.isBuffer(content) ? content.byteLength : Buffer.byteLength(content, "utf8")
	};
}
function countLines(content) {
	if (Buffer.isBuffer(content)) return 0;
	if (content.length === 0) return 0;
	let lines = 1;
	for (let index = 0; index < content.length; index += 1) if (content.charCodeAt(index) === 10) lines += 1;
	if (content.endsWith("\n")) lines -= 1;
	return lines;
}
function safeArtifactName(name) {
	return path.normalize(name).replace(/^([/\\])+/, "").split(path.sep).filter((part) => part && part !== "." && part !== "..").join(path.sep) || "body";
}
// src/core/web/delivery.ts
const EXCERPT_LENGTH = 260;
function deliverFetchResults(result) {
	const resolved = result.outcomes.filter((outcome) => outcome.document);
	const failed = result.outcomes.filter((outcome) => !outcome.document);
	const sections = [];
	for (const [index, outcome] of resolved.entries()) if (outcome.document) sections.push(renderDocument(index, outcome.document));
	if (failed.length > 0) sections.push(["Failed:", ...failed.map((outcome) => `- ${outcome.url}: ${formatAttemptTrail(outcome)}`)].join("\n"));
	return {
		text: sections.join("\n\n") || "No extracted results.",
		resolved,
		failed
	};
}
function renderDocument(index, document) {
	const lines = [`${index + 1}. ${document.title}`];
	if (document.facts.length > 0) lines.push(`   ${document.facts.join(" · ")}`);
	lines.push(`   ${document.link ?? document.url}`);
	const firstBody = document.bodies[0];
	if (firstBody) {
		lines.push(`   bodies (in ${path.dirname(firstBody.path)}/):`);
		for (const body of document.bodies) lines.push(`   - ${body.name} (${body.lines.toLocaleString()} lines, ${formatSize(body.bytes)})`);
	}
	const excerpt = summarizeExcerpt(document.excerpt, EXCERPT_LENGTH);
	if (excerpt) lines.push(`   excerpt: ${excerpt}`);
	if (document.highlights?.length) {
		lines.push("   highlights:");
		for (const highlight of document.highlights) lines.push(`   - ${highlight.replaceAll("\n", "\n     ")}`);
	}
	return lines.join("\n");
}
function formatAttemptTrail(outcome) {
	if (outcome.attempts.length === 0) return "no fetcher could handle this URL";
	return outcome.attempts.map((attempt) => `${attempt.source}: ${attempt.reason}`).join(" → ");
}
// src/core/web/router.ts
async function fetchDocuments(fetchers, urls, artifactRoot, objective, signal) {
	const outcomesByUrl = new Map(urls.map((url) => [url, {
		url,
		attempts: []
	}]));
	const warnings = [];
	for (const fetcher of fetchers) {
		const remainingUrls = [...outcomesByUrl.values()].filter((outcome) => !outcome.document).map((outcome) => outcome.url);
		if (remainingUrls.length === 0) break;
		if (signal?.aborted) throw new Error("Fetch cancelled.");
		const matchingUrls = remainingUrls.filter((url) => fetcher.canFetch(url));
		if (matchingUrls.length === 0) continue;
		let result;
		try {
			result = await fetcher.fetch({
				urls: matchingUrls,
				artifactDir: artifactRoot,
				objective,
				signal
			});
		} catch (error) {
			if (signal?.aborted) throw new Error("Fetch cancelled.");
			const reason = getErrorMessage(error);
			for (const url of matchingUrls) outcomesByUrl.get(url)?.attempts.push({
				source: fetcher.source,
				url,
				reason
			});
			continue;
		}
		warnings.push(...result.warnings);
		for (const document of result.documents) {
			const outcome = outcomesByUrl.get(document.url);
			if (outcome) outcome.document = document;
		}
		for (const failure of result.failures) outcomesByUrl.get(failure.url)?.attempts.push({
			source: fetcher.source,
			...failure
		});
	}
	return {
		outcomes: urls.flatMap((url) => {
			const outcome = outcomesByUrl.get(url);
			return outcome ? [outcome] : [];
		}),
		warnings
	};
}
// src/core/web/fetch.ts
const fetchParameters = _Object_({
	urls: _Array_(String$1({ description: "A URL to extract." }), {
		description: "One or more URLs to extract.",
		minItems: 1,
		maxItems: 10
	}),
	objective: Optional(String$1({ description: "Optional extraction goal. Source-native fetchers ignore it." }))
});
const webFetchOutput = _Object_({
	documents: _Array_(_Object_({
		url: String$1(),
		link: Optional(String$1()),
		kind: String$1(),
		source: String$1(),
		title: String$1(),
		facts: _Array_(String$1()),
		excerpt: Optional(String$1()),
		highlights: Optional(_Array_(String$1())),
		bodies: _Array_(_Object_({
			name: String$1(),
			path: String$1({ description: "Absolute path of the body file." }),
			lines: Integer(),
			bytes: Integer()
		}))
	})),
	failed: _Array_(_Object_({
		url: String$1(),
		attempts: _Array_(_Object_({
			source: String$1(),
			reason: String$1()
		}))
	})),
	warnings: _Array_(_Object_({
		message: String$1(),
		type: Optional(String$1())
	}))
});
function toStructuredContent(result) {
	return {
		documents: result.outcomes.flatMap(({ document }) => document ? [{
			url: document.url,
			...document.link ? { link: document.link } : {},
			kind: document.kind,
			source: document.source,
			title: document.title,
			facts: document.facts,
			...document.excerpt ? { excerpt: document.excerpt } : {},
			...document.highlights ? { highlights: document.highlights } : {},
			bodies: document.bodies
		}] : []),
		failed: result.outcomes.filter((outcome) => !outcome.document).map((outcome) => ({
			url: outcome.url,
			attempts: outcome.attempts.map(({ source, reason }) => ({
				source,
				reason
			}))
		})),
		warnings: result.warnings.map(({ message, type }) => type ? {
			message,
			type
		} : { message })
	};
}
function createWebFetchTool(fetchers, cacheDir) {
	return defineTool({
		name: "web_fetch",
		label: "Fetch Web",
		description: "Fetch specific URLs. Every document's content is written as native files (markdown, patches, source files) under a per-call artifact directory; the tool result is a digest with per-document facts, file paths, and a short excerpt.",
		promptSnippet: "Fetch contents of URLs",
		promptGuidelines: [...fetchers.flatMap((fetcher) => fetcher.promptGuidelines), "Use web_fetch when you already have a specific URL and need more than search snippets."],
		parameters: fetchParameters,
		outputSchema: webFetchOutput,
		annotations: {
			readOnlyHint: true,
			destructiveHint: false
		},
		execute: async (toolCallId, params, signal, onUpdate) => {
			onUpdate?.({
				content: [{
					type: "text",
					text: `Fetching ${params.urls.length} URL(s) from the web...`
				}],
				details: void 0
			});
			try {
				const artifactRoot = path.join(cacheDir, "fetches", toolCallId.replace(/[^\w.-]/g, "_"));
				const result = await fetchDocuments(fetchers, params.urls, artifactRoot, params.objective, signal);
				const delivery = deliverFetchResults(result);
				return {
					content: [{
						type: "text",
						text: delivery.text
					}],
					details: {
						kind: "web_fetch",
						count: delivery.resolved.length,
						outcomes: result.outcomes,
						resolved: delivery.resolved,
						failed: delivery.failed,
						warnings: result.warnings.length > 0 ? result.warnings : null
					},
					structuredContent: toStructuredContent(result)
				};
			} catch (error) {
				throw new Error(`web_fetch failed: ${getErrorMessage(error)}`);
			}
		}
	});
}
// src/core/web/fetchers/github/pagination.ts
async function listWithCap(limit, fetchPage) {
	const items = [];
	const perPage = Math.min(100, limit + 1);
	let page = 1;
	while (items.length <= limit) {
		const pageItems = await fetchPage(page, perPage);
		items.push(...pageItems);
		if (pageItems.length < perPage) break;
		page += 1;
	}
	const truncated = items.length > limit;
	return {
		items: items.slice(0, limit),
		truncated
	};
}
// src/core/web/fetchers/github/shared.ts
const GITHUB_USER_SCHEMA = Union([_Object_({ login: String$1() }), Null()]);
const GIT_ACTOR_SCHEMA = Union([_Object_({
	name: Optional(String$1()),
	date: Optional(String$1())
}), Null()]);
function formatState(item) {
	const reason = item.pull_request ? item.pull_request.merged_at ? "merged" : item.draft ? "draft" : void 0 : item.state_reason;
	return reason ? `${item.state}/${reason}` : item.state;
}
function truncateUtf8Bytes(value, maxBytes) {
	const buffer = Buffer.from(value, "utf8");
	if (buffer.byteLength <= maxBytes) return value;
	const decoder = new TextDecoder("utf-8", { fatal: true });
	for (let end = maxBytes; end >= 0; end -= 1) try {
		return decoder.decode(buffer.subarray(0, end));
	} catch {}
	return "";
}
function escapeTableCell(value) {
	return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
// src/core/web/fetchers/github/action-run.ts
const ACTION_RUN_LIMIT = 100;
const JOB_LIMIT = 200;
const ARTIFACT_LIMIT = 100;
const NULLABLE_STRING = Union([String$1(), Null()]);
const WORKFLOW_RUN_LIST_ITEM_SCHEMA = _Object_({
	run_number: Number$1(),
	display_title: String$1(),
	name: Optional(NULLABLE_STRING),
	status: NULLABLE_STRING,
	conclusion: NULLABLE_STRING,
	event: String$1(),
	head_branch: NULLABLE_STRING,
	actor: Optional(GITHUB_USER_SCHEMA),
	run_started_at: Optional(String$1()),
	created_at: String$1(),
	html_url: String$1()
});
const WORKFLOW_RUNS_SCHEMA = _Object_({
	total_count: Number$1(),
	workflow_runs: _Array_(WORKFLOW_RUN_LIST_ITEM_SCHEMA)
});
const WORKFLOW_RUN_SCHEMA = _Object_({
	id: Number$1(),
	run_number: Number$1(),
	run_attempt: Optional(Number$1()),
	display_title: String$1(),
	name: Optional(NULLABLE_STRING),
	status: NULLABLE_STRING,
	conclusion: NULLABLE_STRING,
	event: String$1(),
	head_branch: NULLABLE_STRING,
	head_sha: String$1(),
	head_commit: Union([_Object_({ message: String$1() }), Null()]),
	actor: Optional(GITHUB_USER_SCHEMA),
	run_started_at: Optional(String$1()),
	created_at: String$1(),
	updated_at: String$1(),
	html_url: String$1()
});
const WORKFLOW_JOB_SCHEMA = _Object_({
	name: String$1(),
	status: String$1(),
	conclusion: NULLABLE_STRING,
	runner_name: NULLABLE_STRING,
	started_at: String$1(),
	completed_at: NULLABLE_STRING,
	html_url: NULLABLE_STRING,
	steps: Optional(_Array_(_Object_({
		name: String$1(),
		status: String$1(),
		conclusion: NULLABLE_STRING,
		started_at: Optional(NULLABLE_STRING),
		completed_at: Optional(NULLABLE_STRING)
	})))
});
const WORKFLOW_ARTIFACT_SCHEMA = _Object_({
	name: String$1(),
	size_in_bytes: Number$1(),
	expired: Boolean$1(),
	created_at: NULLABLE_STRING,
	expires_at: NULLABLE_STRING,
	archive_download_url: String$1()
});
async function fetchActionRunList(context, target) {
	const response = await context.client.get({
		route: "GET /repos/{owner}/{repo}/actions/runs",
		params: {
			owner: target.owner,
			repo: target.repo,
			per_page: ACTION_RUN_LIMIT
		},
		operation: `Actions runs of ${target.owner}/${target.repo}`,
		signal: context.signal
	}, WORKFLOW_RUNS_SCHEMA);
	const runs = response.workflow_runs;
	const total = response.total_count;
	const truncated = total > runs.length;
	return {
		kind: "github.action_run_list",
		source: context.source,
		url: target.url,
		title: `${target.owner}/${target.repo} Actions runs`,
		facts: [truncated ? `${total} runs, showing first ${runs.length}` : `${total} runs`],
		excerpt: runs.map((run) => `#${run.run_number} ${run.display_title || run.name}`).join("\n") || void 0,
		bodies: [await writeDocumentBody(context.artifactDir, target.url, "listing.md", renderActionRunList(target, runs, truncated))]
	};
}
async function fetchActionRun(context, target) {
	const runParams = {
		owner: target.owner,
		repo: target.repo,
		run_id: target.runId
	};
	const runName = `Actions run ${target.runId} of ${target.owner}/${target.repo}`;
	const [run, jobs, artifacts] = await Promise.all([
		context.client.get({
			route: "GET /repos/{owner}/{repo}/actions/runs/{run_id}",
			params: runParams,
			operation: runName,
			signal: context.signal
		}, WORKFLOW_RUN_SCHEMA),
		listWithCap(JOB_LIMIT, async (page, perPage) => {
			return (await context.client.get({
				route: "GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs",
				params: {
					...runParams,
					page,
					per_page: perPage
				},
				operation: `jobs of ${runName}`,
				signal: context.signal
			}, _Object_({ jobs: _Array_(WORKFLOW_JOB_SCHEMA) }))).jobs;
		}),
		listWithCap(ARTIFACT_LIMIT, async (page, perPage) => {
			return (await context.client.get({
				route: "GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts",
				params: {
					...runParams,
					page,
					per_page: perPage
				},
				operation: `artifacts of ${runName}`,
				signal: context.signal
			}, _Object_({ artifacts: _Array_(WORKFLOW_ARTIFACT_SCHEMA) }))).artifacts;
		})
	]);
	const title = run.display_title || run.name || `Actions run ${run.id}`;
	return {
		kind: "github.action_run",
		source: context.source,
		url: target.url,
		link: run.html_url,
		title: `${target.owner}/${target.repo} run #${run.run_number}: ${title}`,
		facts: [
			`${run.status}${run.conclusion ? ` (${run.conclusion})` : ""}`,
			...run.name ? [`workflow ${run.name}`] : [],
			`event ${run.event}`,
			...run.head_branch ? [`branch ${run.head_branch}`] : [],
			`${jobs.items.length} job${jobs.items.length === 1 ? "" : "s"}`,
			`${artifacts.items.length} artifact${artifacts.items.length === 1 ? "" : "s"}`,
			...jobs.truncated || artifacts.truncated ? ["some lists capped; see run.md"] : []
		],
		excerpt: run.head_commit?.message ?? run.display_title,
		bodies: [await writeDocumentBody(context.artifactDir, target.url, "run.md", renderActionRunMarkdown(run, jobs.items, jobs.truncated, artifacts.items, artifacts.truncated))]
	};
}
function renderActionRunList(target, runs, truncated) {
	const lines = [
		`# ${target.owner}/${target.repo} Actions runs`,
		"",
		"| Run | Title | Workflow | Status | Event | Branch | Actor | Started | URL |",
		"| ---: | --- | --- | --- | --- | --- | --- | --- | --- |"
	];
	for (const run of runs) lines.push(`| ${run.run_number} | ${escapeTableCell(run.display_title || "")} | ${escapeTableCell(run.name ?? "")} | ${run.status}${run.conclusion ? ` (${run.conclusion})` : ""} | ${run.event} | ${escapeTableCell(run.head_branch ?? "")} | ${escapeTableCell(run.actor?.login ?? "")} | ${run.run_started_at ?? run.created_at} | ${escapeTableCell(run.html_url)} |`);
	if (truncated) lines.push("", `[listing capped at ${ACTION_RUN_LIMIT} runs]`);
	return `${lines.join("\n")}\n`;
}
function renderActionRunMarkdown(run, jobs, jobsTruncated, artifacts, artifactsTruncated) {
	const lines = [
		`# ${run.display_title || run.name || `Actions run ${run.id}`}`,
		"",
		`- Workflow: ${run.name ?? "unknown"}`,
		`- Run: #${run.run_number}, attempt ${run.run_attempt ?? 1}`,
		`- Status: ${run.status}${run.conclusion ? ` (${run.conclusion})` : ""}`,
		`- Event: ${run.event}`,
		`- Actor: ${run.actor?.login ?? "unknown"}`,
		`- Branch: ${run.head_branch ?? "unknown"}`,
		`- Commit: ${run.head_sha}`,
		`- Started: ${run.run_started_at ?? run.created_at}`,
		`- Updated: ${run.updated_at}`,
		`- URL: ${run.html_url}`,
		"",
		"## Jobs"
	];
	if (jobs.length === 0) lines.push("", "(none)");
	for (const job of jobs) {
		lines.push("", `### ${job.name}`, "", `- Status: ${job.status}${job.conclusion ? ` (${job.conclusion})` : ""}`, `- Runner: ${job.runner_name ?? "unknown"}`, `- Started: ${job.started_at}`, `- Completed: ${job.completed_at ?? "not completed"}`, `- URL: ${job.html_url ?? "unavailable"}`);
		if (job.steps && job.steps.length > 0) {
			lines.push("", "| Step | Status | Conclusion | Started | Completed |", "| --- | --- | --- | --- | --- |");
			for (const step of job.steps) lines.push(`| ${escapeTableCell(step.name)} | ${step.status} | ${step.conclusion ?? ""} | ${step.started_at ?? ""} | ${step.completed_at ?? ""} |`);
		}
	}
	if (jobsTruncated) lines.push("", `[jobs capped at ${JOB_LIMIT}]`);
	lines.push("", "## Artifacts", "");
	if (artifacts.length === 0) lines.push("(none)");
	else {
		lines.push("| Name | Size | Expired | Created | Expires | Archive API URL |", "| --- | ---: | --- | --- | --- | --- |");
		for (const artifact of artifacts) lines.push(`| ${escapeTableCell(artifact.name)} | ${artifact.size_in_bytes} | ${artifact.expired ? "yes" : "no"} | ${artifact.created_at ?? ""} | ${artifact.expires_at ?? ""} | ${escapeTableCell(artifact.archive_download_url)} |`);
	}
	if (artifactsTruncated) lines.push("", `[artifacts capped at ${ARTIFACT_LIMIT}]`);
	return `${lines.join("\n")}\n`;
}
// src/core/web/fetchers/github/commit.ts
const COMMIT_FILE_LIMIT = 300;
const COMMIT_COMMENT_LIMIT = 100;
const PATCH_TEXT_LIMIT$1 = 4e5;
const COMMIT_FILE_SCHEMA = _Object_({
	filename: String$1(),
	status: String$1(),
	additions: Number$1(),
	deletions: Number$1(),
	changes: Number$1(),
	previous_filename: Optional(String$1()),
	patch: Optional(String$1())
});
const COMMIT_SCHEMA = _Object_({
	sha: String$1(),
	html_url: String$1(),
	author: GITHUB_USER_SCHEMA,
	committer: GITHUB_USER_SCHEMA,
	commit: _Object_({
		message: String$1(),
		author: GIT_ACTOR_SCHEMA,
		committer: GIT_ACTOR_SCHEMA,
		verification: Optional(_Object_({ verified: Boolean$1() }))
	}),
	stats: Optional(_Object_({
		additions: Optional(Number$1()),
		deletions: Optional(Number$1())
	}))
});
const COMMIT_FILES_PAGE_SCHEMA = _Object_({ files: Optional(_Array_(COMMIT_FILE_SCHEMA)) });
const COMMIT_COMMENT_SCHEMA = _Object_({
	user: GITHUB_USER_SCHEMA,
	created_at: String$1(),
	body: String$1()
});
async function fetchCommit(context, target) {
	const [commit, files, comments] = await Promise.all([
		context.client.get({
			route: "GET /repos/{owner}/{repo}/commits/{ref}",
			params: {
				owner: target.owner,
				repo: target.repo,
				ref: target.ref,
				per_page: 1
			},
			operation: `commit ${target.owner}/${target.repo}@${target.ref}`,
			signal: context.signal
		}, COMMIT_SCHEMA),
		listCommitFiles(context, target),
		listWithCap(COMMIT_COMMENT_LIMIT, (page, perPage) => context.client.get({
			route: "GET /repos/{owner}/{repo}/commits/{commit_sha}/comments",
			params: {
				owner: target.owner,
				repo: target.repo,
				commit_sha: target.ref,
				page,
				per_page: perPage
			},
			operation: `comments on ${target.owner}/${target.repo}@${target.ref}`,
			signal: context.signal
		}, _Array_(COMMIT_COMMENT_SCHEMA)))
	]);
	const summary = commit.commit.message.split("\n", 1)[0] || commit.sha;
	const author = commit.author?.login ?? commit.commit.author?.name;
	return {
		kind: "github.commit",
		source: context.source,
		url: target.url,
		link: commit.html_url,
		title: `${target.owner}/${target.repo}@${commit.sha.slice(0, 12)}: ${summary}`,
		facts: [
			...author ? [`by ${author}`] : [],
			...commit.commit.author?.date ? [`authored ${commit.commit.author.date}`] : [],
			`+${commit.stats?.additions ?? 0} -${commit.stats?.deletions ?? 0}`,
			`${files.items.length} file${files.items.length === 1 ? "" : "s"}${files.truncated ? ` shown (capped at ${COMMIT_FILE_LIMIT})` : ""}`,
			`${comments.items.length} comment${comments.items.length === 1 ? "" : "s"}`,
			...commit.commit.verification?.verified ? ["verified signature"] : []
		],
		excerpt: commit.commit.message,
		bodies: [await writeDocumentBody(context.artifactDir, target.url, "commit.md", renderCommitMarkdown(commit, files, comments)), await writeDocumentBody(context.artifactDir, target.url, "diff.patch", renderCommitPatch(files))]
	};
}
async function listCommitFiles(context, target) {
	let patchBytes = 0;
	return await listWithCap(COMMIT_FILE_LIMIT, async (page, perPage) => {
		return ((await context.client.get({
			route: "GET /repos/{owner}/{repo}/commits/{ref}",
			params: {
				owner: target.owner,
				repo: target.repo,
				ref: target.ref,
				page,
				per_page: perPage
			},
			operation: `files of ${target.owner}/${target.repo}@${target.ref}`,
			signal: context.signal
		}, COMMIT_FILES_PAGE_SCHEMA)).files ?? []).map((file) => {
			const patch = file.patch;
			let cappedPatch = patch;
			let patchTruncated = false;
			if (patch) {
				const remaining = PATCH_TEXT_LIMIT$1 - patchBytes;
				if (remaining <= 0) {
					cappedPatch = void 0;
					patchTruncated = true;
				} else if (Buffer.byteLength(patch, "utf8") > remaining) {
					cappedPatch = truncateUtf8Bytes(patch, remaining);
					patchBytes = PATCH_TEXT_LIMIT$1;
					patchTruncated = true;
				} else patchBytes += Buffer.byteLength(patch, "utf8");
			}
			return {
				filename: file.filename,
				status: file.status,
				additions: file.additions,
				deletions: file.deletions,
				changes: file.changes,
				previous_filename: file.previous_filename,
				patch: cappedPatch,
				patch_truncated: patchTruncated
			};
		});
	});
}
function renderCommitMarkdown(commit, files, comments) {
	const lines = [
		`# ${commit.commit.message.split("\n", 1)[0] || commit.sha}`,
		"",
		`- Commit: ${commit.sha}`,
		`- Author: ${commit.author?.login ?? commit.commit.author?.name ?? "unknown"}`,
		`- Authored: ${commit.commit.author?.date ?? "unknown"}`,
		`- Committer: ${commit.committer?.login ?? commit.commit.committer?.name ?? "unknown"}`,
		`- Committed: ${commit.commit.committer?.date ?? "unknown"}`,
		`- URL: ${commit.html_url}`,
		"",
		"## Message",
		"",
		commit.commit.message,
		"",
		"## Files",
		"",
		"| File | Status | Additions | Deletions | Changes |",
		"| --- | --- | ---: | ---: | ---: |"
	];
	for (const file of files.items) lines.push(`| ${escapeTableCell(file.filename)} | ${file.status} | ${file.additions} | ${file.deletions} | ${file.changes} |`);
	if (files.truncated) lines.push("", `[files capped at ${COMMIT_FILE_LIMIT}]`);
	lines.push("", "## Comments");
	if (comments.items.length === 0) lines.push("", "(none)");
	for (const comment of comments.items) lines.push("", `### ${comment.user?.login ?? "unknown"} at ${comment.created_at}`, "", comment.body);
	if (comments.truncated) lines.push("", `[comments capped at ${COMMIT_COMMENT_LIMIT}]`);
	return `${lines.join("\n")}\n`;
}
function renderCommitPatch(files) {
	const lines = [];
	for (const file of files.items) {
		lines.push(`diff --git a/${file.previous_filename ?? file.filename} b/${file.filename}`, `# status: ${file.status}; additions: ${file.additions}; deletions: ${file.deletions}`);
		if (file.patch) lines.push(file.patch);
		else lines.push("[patch unavailable]");
		if (file.patch_truncated) lines.push("[patch truncated]");
		lines.push("");
	}
	if (files.truncated) lines.push(`[files capped at ${COMMIT_FILE_LIMIT}]`, "");
	return lines.join("\n");
}
// src/core/web/fetchers/github/commit-list.ts
const COMMIT_LIST_LIMIT = 100;
const EXCERPT_LIMIT = 20;
const COMMIT_LIST_SCHEMA = _Array_(_Object_({
	sha: String$1(),
	html_url: String$1(),
	author: GITHUB_USER_SCHEMA,
	commit: _Object_({
		message: String$1(),
		author: GIT_ACTOR_SCHEMA
	})
}));
async function fetchCommitList(context, target) {
	const resolved = await resolveCommitList(context, target);
	const commits = await listWithCap(COMMIT_LIST_LIMIT, (page, perPage) => context.client.get(listCommitsRequest(context, target, resolved, page, perPage), COMMIT_LIST_SCHEMA));
	const scope = [resolved.ref ?? "default branch", resolved.path].filter(Boolean).join(" ");
	const title = `${target.owner}/${target.repo} commits: ${scope}`;
	return {
		kind: "github.commit_list",
		source: context.source,
		url: target.url,
		title,
		facts: [
			`${commits.items.length} commit${commits.items.length === 1 ? "" : "s"}${commits.truncated ? ` shown (capped at ${COMMIT_LIST_LIMIT})` : ""}`,
			`ref: ${resolved.ref ?? "default branch"}`,
			...resolved.path ? [`path: ${resolved.path}`] : []
		],
		excerpt: renderCommitListExcerpt(commits.items),
		bodies: [await writeDocumentBody(context.artifactDir, target.url, "commits.md", renderCommitListMarkdown(title, commits))]
	};
}
async function resolveCommitList(context, target) {
	if (target.parts.length === 0) return {};
	if (target.parts.length === 1) return { ref: target.parts[0] };
	for (let index = 1; index <= target.parts.length; index += 1) {
		const candidate = {
			ref: target.parts.slice(0, index).join("/"),
			path: target.parts.slice(index).join("/") || void 0
		};
		try {
			if ((await context.client.get(listCommitsRequest(context, target, candidate, 1, 1), COMMIT_LIST_SCHEMA)).length > 0) return candidate;
		} catch (error) {
			if (!(error instanceof GitHubApiError && error.status === 404)) throw error;
		}
	}
	throw new Error("Could not resolve GitHub commits URL ref/path split.");
}
function listCommitsRequest(context, target, resolved, page, perPage) {
	return {
		route: "GET /repos/{owner}/{repo}/commits",
		params: {
			owner: target.owner,
			repo: target.repo,
			...resolved.ref ? { sha: resolved.ref } : {},
			...resolved.path ? { path: resolved.path } : {},
			page,
			per_page: perPage
		},
		operation: `commit history of ${target.owner}/${target.repo}`,
		signal: context.signal
	};
}
function renderCommitListExcerpt(items) {
	if (items.length === 0) return void 0;
	return items.slice(0, EXCERPT_LIMIT).map((item) => `${item.sha.slice(0, 12)} ${commitSummary(item)}`).join("\n");
}
function renderCommitListMarkdown(title, commits) {
	const lines = [
		`# ${title}`,
		"",
		"| Commit | Summary | Author | Date | URL |",
		"| --- | --- | --- | --- | --- |"
	];
	for (const item of commits.items) lines.push(`| ${item.sha.slice(0, 12)} | ${escapeTableCell(commitSummary(item))} | ${escapeTableCell(item.author?.login ?? item.commit.author?.name ?? "unknown")} | ${escapeTableCell(item.commit.author?.date ?? "unknown")} | ${escapeTableCell(item.html_url)} |`);
	if (commits.truncated) lines.push("", `[commits capped at ${COMMIT_LIST_LIMIT}]`);
	return `${lines.join("\n")}\n`;
}
function commitSummary(item) {
	return item.commit.message.split("\n", 1)[0] || item.sha;
}
// src/core/web/fetchers/github/content.ts
const DIRECTORY_LIMIT = 1e3;
const RAW_CONTENT_LIMIT = 104857600;
const CONTENT_FILE_SCHEMA = _Object_({
	type: String$1(),
	name: String$1(),
	path: String$1(),
	size: Number$1(),
	content: Optional(String$1()),
	encoding: Optional(String$1()),
	html_url: Union([String$1(), Null()])
});
const DIRECTORY_ENTRY_SCHEMA = _Object_({
	type: String$1(),
	name: String$1(),
	path: String$1(),
	size: Number$1()
});
const DIRECTORY_SCHEMA = _Object_({
	type: Literal("dir"),
	html_url: Union([String$1(), Null()]),
	entries: _Array_(DIRECTORY_ENTRY_SCHEMA)
});
const CONTENT_TYPE_SCHEMA = _Object_({ type: String$1() });
function contentsRequest(context, target) {
	return {
		route: "GET /repos/{owner}/{repo}/contents/{path}",
		params: {
			owner: target.owner,
			repo: target.repo,
			path: target.path,
			...target.ref ? { ref: target.ref } : {},
			mediaType: { format: "object" }
		},
		operation: `read ${target.owner}/${target.repo}/${target.path}`,
		signal: context.signal
	};
}
async function fetchFile(context, target) {
	const item = await context.client.get(contentsRequest(context, target), CONTENT_FILE_SCHEMA);
	if (item.type === "dir") throw new Error(`Expected file but GitHub returned a directory: ${target.path}`);
	return buildFileDocument(context, "github.file", target, item);
}
async function fetchReadme(context, target) {
	return buildFileDocument(context, "github.readme", target, await context.client.get({
		route: "GET /repos/{owner}/{repo}/readme",
		params: {
			owner: target.owner,
			repo: target.repo,
			mediaType: { format: "object" }
		},
		operation: `README of ${target.owner}/${target.repo}`,
		signal: context.signal
	}, CONTENT_FILE_SCHEMA));
}
async function buildFileDocument(context, kind, target, item) {
	const content = await readContentFile(context, target, item);
	const body = await writeDocumentBody(context.artifactDir, target.url, item.name, content);
	return {
		kind,
		source: context.source,
		url: target.url,
		link: item.html_url ?? void 0,
		title: kind === "github.readme" ? `${target.owner}/${target.repo} README` : `${target.owner}/${target.repo}:${item.path}`,
		facts: [
			`repo ${target.owner}/${target.repo}`,
			...target.ref ? [`ref ${target.ref}`] : [],
			`path ${item.path}`,
			...Buffer.isBuffer(content) ? ["binary"] : [],
			...kind === "github.readme" ? [`whole repository: git clone ${context.webUrl}/${target.owner}/${target.repo}.git`] : []
		],
		excerpt: Buffer.isBuffer(content) ? void 0 : content,
		bodies: [body]
	};
}
async function fetchDirectory(context, target) {
	const directory = await context.client.get(contentsRequest(context, target), DIRECTORY_SCHEMA);
	const entries = directory.entries;
	const likelyIncomplete = entries.length >= DIRECTORY_LIMIT;
	const title = `${target.owner}/${target.repo}:${target.path || "/"}`;
	return {
		kind: "github.directory",
		source: context.source,
		url: target.url,
		title,
		link: directory.html_url ?? void 0,
		facts: [`${entries.length} entr${entries.length === 1 ? "y" : "ies"}`, ...likelyIncomplete ? ["listing may be incomplete"] : []],
		excerpt: entries.map((entry) => entry.type === "dir" ? `${entry.name}/` : entry.name).join(", "),
		bodies: [await writeDocumentBody(context.artifactDir, target.url, "listing.md", renderDirectoryMarkdown(title, entries, likelyIncomplete))]
	};
}
async function readContentFile(context, target, item) {
	if (item.encoding === "base64" && item.content) return decodeTextOrBuffer(Buffer.from(item.content.replace(/\n/g, ""), "base64"));
	if (item.content) return item.content;
	if (item.size > RAW_CONTENT_LIMIT) throw new Error(`GitHub raw file exceeds ${RAW_CONTENT_LIMIT} byte limit.`);
	return decodeTextOrBuffer(await context.client.getRaw(contentsRequest(context, {
		owner: target.owner,
		repo: target.repo,
		path: item.path,
		ref: target.ref
	})));
}
function decodeTextOrBuffer(buffer) {
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
	} catch {
		return buffer;
	}
}
async function resolveRefPath(context, target, expected) {
	for (let index = 1; index < target.parts.length; index += 1) {
		const ref = target.parts.slice(0, index).join("/");
		const contentPath = target.parts.slice(index).join("/");
		try {
			const isDirectory = (await context.client.get(contentsRequest(context, {
				owner: target.owner,
				repo: target.repo,
				path: contentPath,
				ref
			}), CONTENT_TYPE_SCHEMA)).type === "dir";
			if (expected === "directory" && isDirectory || expected === "file" && !isDirectory) return {
				owner: target.owner,
				repo: target.repo,
				ref,
				path: contentPath
			};
		} catch (error) {
			if (!(error instanceof GitHubApiError && error.status === 404)) throw error;
		}
	}
	throw new Error(`Could not resolve GitHub ${target.marker} URL ref/path split.`);
}
function renderDirectoryMarkdown(title, entries, incomplete) {
	const lines = [
		`# ${title}`,
		"",
		"| Type | Path | Size |",
		"| --- | --- | --- |"
	];
	for (const entry of entries) lines.push(`| ${escapeTableCell(entry.type)} | ${escapeTableCell(entry.path)} | ${entry.size} |`);
	if (incomplete) lines.push("", "[listing may be incomplete: GitHub returned 1,000 entries]");
	return lines.join("\n");
}
// src/core/web/fetchers/github/discussion.ts
const DISCUSSION_COMMENT_LIMIT = 100;
const DISCUSSION_REPLY_LIMIT = 100;
const PAGE_INFO_SCHEMA = _Object_({ hasNextPage: Boolean$1() });
const DISCUSSION_REPLY_SCHEMA = _Object_({
	author: GITHUB_USER_SCHEMA,
	body: String$1(),
	createdAt: String$1()
});
const DISCUSSION_COMMENT_SCHEMA = _Object_({
	author: GITHUB_USER_SCHEMA,
	body: String$1(),
	createdAt: String$1(),
	isAnswer: Boolean$1(),
	replies: _Object_({
		nodes: _Array_(DISCUSSION_REPLY_SCHEMA),
		pageInfo: PAGE_INFO_SCHEMA
	})
});
const DISCUSSION_QUERY_SCHEMA = _Object_({ repository: Union([_Object_({ discussion: Union([_Object_({
	title: String$1(),
	number: Number$1(),
	url: String$1(),
	body: String$1(),
	createdAt: String$1(),
	updatedAt: String$1(),
	answerChosenAt: Union([String$1(), Null()]),
	author: GITHUB_USER_SCHEMA,
	category: _Object_({ name: String$1() }),
	labels: _Object_({ nodes: _Array_(_Object_({ name: String$1() })) }),
	comments: _Object_({
		nodes: _Array_(DISCUSSION_COMMENT_SCHEMA),
		pageInfo: PAGE_INFO_SCHEMA
	})
}), Null()]) }), Null()]) });
const DISCUSSION_QUERY = `
  query Discussion($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      discussion(number: $number) {
        title
        number
        url
        body
        createdAt
        updatedAt
        answerChosenAt
        author { login }
        category { name }
        labels(first: 100) { nodes { name } }
        comments(first: ${DISCUSSION_COMMENT_LIMIT}) {
          nodes {
            author { login }
            body
            createdAt
            updatedAt
            isAnswer
            replies(first: ${DISCUSSION_REPLY_LIMIT}) {
              nodes {
                author { login }
                body
                createdAt
                updatedAt
              }
              pageInfo { hasNextPage }
            }
          }
          pageInfo { hasNextPage }
        }
      }
    }
  }
`;
async function fetchDiscussion(context, target) {
	const discussion = (await context.client.graphql(DISCUSSION_QUERY, {
		owner: target.owner,
		repo: target.repo,
		number: target.number
	}, DISCUSSION_QUERY_SCHEMA, `discussion ${target.owner}/${target.repo}#${target.number}`, context.signal)).repository?.discussion;
	if (!discussion) throw new Error(`GitHub discussion #${target.number} was not found.`);
	const repliesTruncated = discussion.comments.nodes.some((comment) => comment.replies.pageInfo.hasNextPage);
	const commentsTruncated = discussion.comments.pageInfo.hasNextPage;
	return {
		kind: "github.discussion",
		source: context.source,
		url: target.url,
		link: discussion.url,
		title: `${target.owner}/${target.repo}#${discussion.number}: ${discussion.title}`,
		facts: [
			`category ${discussion.category.name}`,
			...discussion.author?.login ? [`by ${discussion.author.login}`] : [],
			discussion.answerChosenAt ? "answered" : "unanswered",
			`${discussion.comments.nodes.length} comment${discussion.comments.nodes.length === 1 ? "" : "s"}`,
			...discussion.labels.nodes.length > 0 ? [`labels ${discussion.labels.nodes.map((label) => label.name).join(", ")}`] : [],
			...commentsTruncated || repliesTruncated ? ["conversation capped; see discussion.md"] : []
		],
		excerpt: discussion.body || discussion.comments.nodes[0]?.body,
		bodies: [await writeDocumentBody(context.artifactDir, target.url, "discussion.md", renderDiscussionMarkdown(discussion, commentsTruncated))]
	};
}
function renderDiscussionMarkdown(discussion, commentsTruncated) {
	const lines = [
		`# ${discussion.title}`,
		"",
		`- Author: ${discussion.author?.login ?? "unknown"}`,
		`- Category: ${discussion.category.name}`,
		`- Created: ${discussion.createdAt}`,
		`- Updated: ${discussion.updatedAt}`,
		`- Answered: ${discussion.answerChosenAt ? `yes, at ${discussion.answerChosenAt}` : "no"}`,
		`- URL: ${discussion.url}`,
		"",
		"## Body",
		"",
		discussion.body || "(no body)",
		"",
		"## Comments"
	];
	if (discussion.comments.nodes.length === 0) lines.push("", "(none)");
	for (const comment of discussion.comments.nodes) {
		lines.push("", `### ${comment.author?.login ?? "unknown"} at ${comment.createdAt}${comment.isAnswer ? " (answer)" : ""}`, "", comment.body);
		for (const reply of comment.replies.nodes) lines.push("", `#### Reply from ${reply.author?.login ?? "unknown"} at ${reply.createdAt}`, "", reply.body);
		if (comment.replies.pageInfo.hasNextPage) lines.push("", `[replies capped at ${DISCUSSION_REPLY_LIMIT}]`);
	}
	if (commentsTruncated) lines.push("", `[comments capped at ${DISCUSSION_COMMENT_LIMIT}]`);
	return `${lines.join("\n")}\n`;
}
const TIMELINE_LIMIT = 300;
const ISSUE_SCHEMA = _Object_({
	title: String$1(),
	html_url: String$1(),
	state: String$1(),
	state_reason: Optional(Union([String$1(), Null()])),
	user: GITHUB_USER_SCHEMA,
	created_at: String$1(),
	updated_at: String$1(),
	body: Optional(Union([String$1(), Null()])),
	comments: Number$1(),
	labels: _Array_(_Object_({ name: String$1() }))
});
const ISSUE_COMMENT_SCHEMA = _Object_({
	user: GITHUB_USER_SCHEMA,
	body: Optional(String$1()),
	created_at: String$1()
});
const TIMELINE_ITEM_SCHEMA = _Object_({ event: String$1() });
const COMMIT_EVENT_SCHEMA = _Object_({
	actor: GITHUB_USER_SCHEMA,
	created_at: String$1(),
	commit_id: Union([String$1(), Null()]),
	commit_url: Union([String$1(), Null()]),
	state_reason: Optional(Union([String$1(), Null()]))
});
const PLAIN_EVENT_SCHEMA = _Object_({
	actor: GITHUB_USER_SCHEMA,
	created_at: String$1()
});
const CROSS_REFERENCED_EVENT_SCHEMA = _Object_({
	actor: Optional(GITHUB_USER_SCHEMA),
	created_at: String$1(),
	source: _Object_({ issue: _Object_({
		number: Number$1(),
		title: String$1(),
		state: String$1(),
		state_reason: Optional(Union([String$1(), Null()])),
		draft: Optional(Boolean$1()),
		repository_url: String$1(),
		pull_request: Optional(_Object_({ merged_at: Optional(Union([String$1(), Null()])) }))
	}) })
});
async function fetchIssue(context, target) {
	const issue = await context.client.get({
		route: "GET /repos/{owner}/{repo}/issues/{issue_number}",
		params: {
			owner: target.owner,
			repo: target.repo,
			issue_number: target.number,
			mediaType: { format: "full" }
		},
		operation: `issue ${target.owner}/${target.repo}#${target.number}`,
		signal: context.signal
	}, ISSUE_SCHEMA);
	const [comments, timeline] = await Promise.all([listIssueComments(context, target, 200), listIssueTimeline(context, target)]);
	const labels = issue.labels.map((label) => label.name);
	const closingCommit = issue.state === "closed" && !timeline.truncated ? timeline.closingCommit : void 0;
	const model = {
		title: `${target.owner}/${target.repo}#${target.number}: ${issue.title}`,
		html_url: issue.html_url,
		state: issue.state,
		state_reason: issue.state_reason,
		author: issue.user?.login,
		created_at: issue.created_at,
		updated_at: issue.updated_at,
		body: issue.body,
		timeline,
		comments: comments.items,
		comments_truncated: comments.truncated
	};
	return {
		kind: "github.issue",
		source: context.source,
		url: target.url,
		link: issue.html_url,
		title: model.title,
		facts: [
			`${issue.state}${issue.state_reason ? ` (${issue.state_reason})` : ""}`,
			...closingCommit ? [`closed by commit ${closingCommit.slice(0, 7)}`] : [],
			...issue.user?.login ? [`by ${issue.user.login}`] : [],
			`${issue.comments} comment${issue.comments === 1 ? "" : "s"}`,
			...comments.truncated ? [`comments capped at 200`] : [],
			...timeline.truncated ? [`timeline capped at ${TIMELINE_LIMIT} events`] : [],
			...labels.length > 0 ? [`labels ${labels.join(", ")}`] : []
		],
		excerpt: issue.body ?? comments.items[0]?.body ?? void 0,
		bodies: [await writeDocumentBody(context.artifactDir, target.url, "conversation.md", renderIssueMarkdown(model))]
	};
}
async function listIssueComments(context, target, limit) {
	return listWithCap(limit, (page, perPage) => context.client.get({
		route: "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
		params: {
			owner: target.owner,
			repo: target.repo,
			issue_number: target.number,
			page,
			per_page: perPage,
			mediaType: { format: "full" }
		},
		operation: `comments on ${target.owner}/${target.repo}#${target.number}`,
		signal: context.signal
	}, _Array_(ISSUE_COMMENT_SCHEMA)));
}
async function listIssueTimeline(context, target) {
	const operation = `timeline of ${target.owner}/${target.repo}#${target.number}`;
	const items = await listWithCap(TIMELINE_LIMIT, (page, perPage) => context.client.get({
		route: "GET /repos/{owner}/{repo}/issues/{issue_number}/timeline",
		params: {
			owner: target.owner,
			repo: target.repo,
			issue_number: target.number,
			page,
			per_page: perPage
		},
		operation,
		signal: context.signal
	}, _Array_(TIMELINE_ITEM_SCHEMA)));
	const repo = `${target.owner}/${target.repo}`;
	const entries = [];
	let closingCommit;
	for (const item of items.items) {
		const what = `GitHub ${operation}: ${item.event} event`;
		switch (item.event) {
			case "closed":
			case "merged":
			case "referenced": {
				const event = parseTypeBoxValue(COMMIT_EVENT_SCHEMA, item, what);
				if (item.event === "closed") closingCommit = event.commit_id ?? void 0;
				entries.push({
					createdAt: event.created_at,
					actor: event.actor?.login,
					event: item.event,
					detail: commitEventDetail(repo, COMMIT_PREPOSITIONS[item.event], event)
				});
				break;
			}
			case "reopened":
			case "connected": {
				const event = parseTypeBoxValue(PLAIN_EVENT_SCHEMA, item, what);
				entries.push({
					createdAt: event.created_at,
					actor: event.actor?.login,
					event: item.event,
					detail: void 0
				});
				break;
			}
			case "cross-referenced": {
				const event = parseTypeBoxValue(CROSS_REFERENCED_EVENT_SCHEMA, item, what);
				const issue = event.source.issue;
				entries.push({
					createdAt: event.created_at,
					actor: event.actor?.login,
					event: item.event,
					detail: `from ${issue.pull_request ? "PR" : "issue"} ${repositoryName(issue.repository_url)}#${issue.number} [${formatState(issue)}] ${issue.title}`
				});
				break;
			}
		}
	}
	return {
		entries,
		truncated: items.truncated,
		closingCommit
	};
}
const COMMIT_PREPOSITIONS = {
	closed: "by",
	merged: "as",
	referenced: "from"
};
function commitEventDetail(repo, preposition, event) {
	const parts = [];
	if (event.commit_id) {
		const commitRepo = event.commit_url ? /\/repos\/([^/]+\/[^/]+)\/commits\//.exec(event.commit_url)?.[1] : void 0;
		const foreign = commitRepo && commitRepo.toLowerCase() !== repo.toLowerCase();
		parts.push(`${preposition} commit ${event.commit_id.slice(0, 7)}${foreign ? ` in ${commitRepo}` : ""}`);
	}
	if (event.state_reason) parts.push(`(${event.state_reason})`);
	return parts.length > 0 ? parts.join(" ") : void 0;
}
function repositoryName(repositoryUrl) {
	return new URL(repositoryUrl).pathname.split("/").slice(-2).join("/");
}
function renderIssueMarkdown(issue) {
	const lines = [
		`# ${issue.title}`,
		"",
		`- State: ${issue.state}${issue.state_reason ? ` (${issue.state_reason})` : ""}`,
		`- Author: ${issue.author ?? "unknown"}`,
		`- Created: ${issue.created_at}`,
		`- Updated: ${issue.updated_at}`,
		`- URL: ${issue.html_url}`,
		"",
		"## Body",
		"",
		issue.body ?? "(no body)"
	];
	appendTimeline(lines, issue.timeline);
	appendIssueComments(lines, issue.comments, issue.comments_truncated);
	return lines.join("\n");
}
function appendTimeline(lines, timeline) {
	lines.push("", "## Timeline", "");
	if (timeline.entries.length === 0) lines.push("(none)");
	for (const entry of timeline.entries) lines.push(`- ${entry.createdAt.slice(0, 10)} ${entry.actor ?? "unknown"} ${entry.event}${entry.detail ? ` ${entry.detail}` : ""}`);
	if (timeline.truncated) lines.push("", `[timeline capped at ${TIMELINE_LIMIT} events]`);
}
function appendIssueComments(lines, comments, truncated, title = "Comments") {
	lines.push("", `## ${title}`);
	if (comments.length === 0) lines.push("", "(none)");
	for (const comment of comments) lines.push("", `### ${comment.user?.login ?? "unknown"} at ${comment.created_at}`, "", comment.body ?? "");
	if (truncated) lines.push("", "[comments truncated]");
}
// src/core/web/fetchers/github/listing.ts
const LISTING_LIMIT = 100;
const SEARCH_ISSUE_ITEM_SCHEMA = _Object_({
	number: Number$1(),
	title: String$1(),
	state: String$1(),
	state_reason: Optional(Union([String$1(), Null()])),
	draft: Optional(Boolean$1()),
	pull_request: Optional(_Object_({ merged_at: Optional(Union([String$1(), Null()])) })),
	user: GITHUB_USER_SCHEMA,
	labels: _Array_(_Object_({ name: String$1() })),
	comments: Number$1(),
	updated_at: String$1(),
	html_url: String$1()
});
const SEARCH_ISSUES_SCHEMA = _Object_({
	total_count: Number$1(),
	items: _Array_(SEARCH_ISSUE_ITEM_SCHEMA)
});
async function fetchListing(context, target) {
	const query = buildListQuery(target);
	const response = await context.client.get({
		route: "GET /search/issues",
		params: {
			q: query,
			per_page: LISTING_LIMIT
		},
		operation: "issue search",
		signal: context.signal
	}, SEARCH_ISSUES_SCHEMA);
	const items = response.items;
	const title = `${target.owner}/${target.repo} ${target.tab}: ${query}`;
	const total = response.total_count;
	const capped = total > items.length;
	return {
		kind: target.tab === "issues" ? "github.issue_list" : "github.pull_request_list",
		source: context.source,
		url: target.url,
		title,
		facts: [capped ? `${total} matches, showing first ${items.length}` : `${total} matches`, `query: ${query}`],
		excerpt: renderListingExcerpt(items),
		bodies: [await writeDocumentBody(context.artifactDir, target.url, "listing.md", renderListingMarkdown(title, items))]
	};
}
function renderListingExcerpt(items) {
	if (items.length === 0) return void 0;
	return items.map((item) => `#${item.number} [${formatState(item)}] ${item.title} (${item.comments} comment${item.comments === 1 ? "" : "s"})`).join("\n");
}
function renderListingMarkdown(title, items) {
	const lines = [
		`# ${title}`,
		"",
		"| Number | Title | State | Author | Labels | Comments | Updated | URL |",
		"| --- | --- | --- | --- | --- | ---: | --- | --- |"
	];
	for (const item of items) lines.push(`| #${item.number} | ${escapeTableCell(item.title)} | ${escapeTableCell(formatState(item))} | ${escapeTableCell(item.user?.login ?? "")} | ${escapeTableCell(item.labels.map((label) => label.name).join(", "))} | ${item.comments} | ${escapeTableCell(item.updated_at)} | ${escapeTableCell(item.html_url)} |`);
	return `${lines.join("\n")}\n`;
}
function buildListQuery(target) {
	const repoQualifier = `repo:${target.owner}/${target.repo}`;
	const userQuery = target.q?.trim();
	if (!userQuery) return `${repoQualifier} ${target.tab === "issues" ? "is:issue" : "is:pr"} state:open`;
	return [
		repoQualifier,
		hasTypeQualifier(userQuery) ? void 0 : target.tab === "issues" ? "is:issue" : "is:pr",
		userQuery
	].filter(isPresent).join(" ");
}
function hasTypeQualifier(query) {
	return /(?:^|\s)(?:is:(?:issue|pr)|type:(?:issue|pr))(?:\s|$)/i.test(query);
}
function isPresent(value) {
	return value !== void 0;
}
// src/core/web/fetchers/github/pull-request.ts
const PR_REVIEW_LIMIT = 100;
const PR_REVIEW_COMMENT_LIMIT = 200;
const PR_FILE_LIMIT = 300;
const PATCH_TEXT_LIMIT = 4e5;
const PULL_REQUEST_SCHEMA = _Object_({
	title: String$1(),
	html_url: String$1(),
	state: String$1(),
	user: GITHUB_USER_SCHEMA,
	draft: Optional(Boolean$1()),
	merged: Boolean$1(),
	base: _Object_({ label: String$1() }),
	head: _Object_({ label: String$1() }),
	additions: Number$1(),
	deletions: Number$1(),
	changed_files: Number$1(),
	commits: Number$1(),
	body: Union([String$1(), Null()])
});
const REVIEW_SCHEMA = _Object_({
	user: GITHUB_USER_SCHEMA,
	body: String$1(),
	state: String$1()
});
const REVIEW_COMMENT_SCHEMA = _Object_({
	user: GITHUB_USER_SCHEMA,
	body: String$1(),
	path: String$1(),
	diff_hunk: String$1()
});
const PULL_REQUEST_FILE_SCHEMA = _Object_({
	filename: String$1(),
	status: String$1(),
	additions: Number$1(),
	deletions: Number$1(),
	previous_filename: Optional(String$1()),
	patch: Optional(String$1())
});
async function fetchPullRequest(context, target) {
	const pr = await context.client.get({
		route: "GET /repos/{owner}/{repo}/pulls/{pull_number}",
		params: {
			owner: target.owner,
			repo: target.repo,
			pull_number: target.number,
			mediaType: { format: "full" }
		},
		operation: `pull request ${target.owner}/${target.repo}#${target.number}`,
		signal: context.signal
	}, PULL_REQUEST_SCHEMA);
	const [timeline, issueComments, reviews, reviewComments, files] = await Promise.all([
		listIssueTimeline(context, target),
		listIssueComments(context, target, 200),
		listWithCap(PR_REVIEW_LIMIT, (page, perPage) => context.client.get(pullRequestListRequest(context, target, "reviews", page, perPage), _Array_(REVIEW_SCHEMA))),
		listWithCap(PR_REVIEW_COMMENT_LIMIT, (page, perPage) => context.client.get(pullRequestListRequest(context, target, "comments", page, perPage), _Array_(REVIEW_COMMENT_SCHEMA))),
		listPullRequestFiles(context, target)
	]);
	const model = {
		issue_comments_truncated: issueComments.truncated,
		reviews_truncated: reviews.truncated,
		review_comments_truncated: reviewComments.truncated,
		files_truncated: files.truncated,
		title: `${target.owner}/${target.repo}#${target.number}: ${pr.title}`,
		html_url: pr.html_url,
		state: pr.state,
		author: pr.user?.login,
		draft: pr.draft ?? false,
		merged: pr.merged,
		base: pr.base.label,
		head: pr.head.label,
		additions: pr.additions,
		deletions: pr.deletions,
		changed_files: pr.changed_files,
		commits: pr.commits,
		body: pr.body,
		timeline,
		issue_comments: issueComments.items,
		reviews: reviews.items,
		review_comments: reviewComments.items,
		files: files.items
	};
	return {
		kind: "github.pull_request",
		source: context.source,
		url: target.url,
		link: pr.html_url,
		title: model.title,
		facts: [
			`${pr.state}${pr.draft ? " draft" : ""}${pr.merged ? " merged" : ""}`,
			...pr.user?.login ? [`by ${pr.user.login}`] : [],
			`+${pr.additions} -${pr.deletions}`,
			`${pr.changed_files} file${pr.changed_files === 1 ? "" : "s"}`,
			`${issueComments.items.length} issue comment${issueComments.items.length === 1 ? "" : "s"}`,
			`${reviews.items.length} review${reviews.items.length === 1 ? "" : "s"}`,
			...issueComments.truncated || reviews.truncated || reviewComments.truncated || files.truncated || timeline.truncated ? ["some lists capped; see conversation.md markers"] : []
		],
		excerpt: pr.body ?? issueComments.items[0]?.body ?? void 0,
		bodies: [await writeDocumentBody(context.artifactDir, target.url, "conversation.md", renderPullRequestMarkdown(model)), await writeDocumentBody(context.artifactDir, target.url, "diff.patch", renderPullRequestPatch(files.items))]
	};
}
function pullRequestListRequest(context, target, list, page, perPage) {
	return {
		route: `GET /repos/{owner}/{repo}/pulls/{pull_number}/${list}`,
		params: {
			owner: target.owner,
			repo: target.repo,
			pull_number: target.number,
			page,
			per_page: perPage,
			...list === "files" ? {} : { mediaType: { format: "full" } }
		},
		operation: `${list === "comments" ? "review comments" : list} of ${target.owner}/${target.repo}#${target.number}`,
		signal: context.signal
	};
}
async function listPullRequestFiles(context, target) {
	let patchBytes = 0;
	return listWithCap(PR_FILE_LIMIT, async (page, perPage) => {
		return (await context.client.get(pullRequestListRequest(context, target, "files", page, perPage), _Array_(PULL_REQUEST_FILE_SCHEMA))).map((file) => {
			const patch = file.patch;
			let patch_truncated = false;
			let cappedPatch = patch;
			if (patch) {
				const remaining = PATCH_TEXT_LIMIT - patchBytes;
				if (remaining <= 0) {
					cappedPatch = void 0;
					patch_truncated = true;
				} else if (Buffer.byteLength(patch, "utf8") > remaining) {
					cappedPatch = truncateUtf8Bytes(patch, remaining);
					patch_truncated = true;
					patchBytes = PATCH_TEXT_LIMIT;
				} else patchBytes += Buffer.byteLength(patch, "utf8");
			}
			return {
				filename: file.filename,
				status: file.status,
				additions: file.additions,
				deletions: file.deletions,
				previous_filename: file.previous_filename,
				patch_truncated,
				patch: cappedPatch
			};
		});
	});
}
function renderPullRequestMarkdown(pr) {
	const lines = [
		`# ${pr.title}`,
		"",
		`- State: ${pr.state}${pr.draft ? " (draft)" : ""}${pr.merged ? " (merged)" : ""}`,
		`- Author: ${pr.author ?? "unknown"}`,
		`- Base: ${pr.base}`,
		`- Head: ${pr.head}`,
		`- Changes: +${pr.additions} -${pr.deletions} across ${pr.changed_files} file(s)`,
		`- Commits: ${pr.commits}`,
		`- URL: ${pr.html_url}`,
		"",
		"## Body",
		"",
		pr.body ?? "(no body)"
	];
	appendTimeline(lines, pr.timeline);
	appendIssueComments(lines, pr.issue_comments, pr.issue_comments_truncated, "Issue comments");
	appendReviews(lines, pr.reviews, pr.reviews_truncated);
	appendReviewComments(lines, pr.review_comments, pr.review_comments_truncated);
	appendPullRequestFiles(lines, pr.files, pr.files_truncated);
	return lines.join("\n");
}
function appendReviews(lines, reviews, truncated) {
	lines.push("", "## Reviews");
	if (reviews.length === 0) lines.push("", "(none)");
	for (const review of reviews) lines.push("", `### ${review.state} by ${review.user?.login ?? "unknown"}`, "", review.body);
	if (truncated) lines.push("", "[reviews truncated]");
}
function appendReviewComments(lines, comments, truncated) {
	lines.push("", "## Review comments");
	if (comments.length === 0) lines.push("", "(none)");
	for (const comment of comments) lines.push("", `### ${comment.path} by ${comment.user?.login ?? "unknown"}`, "", comment.diff_hunk ? `\`\`\`diff\n${comment.diff_hunk}\n\`\`\`\n` : "", comment.body);
	if (truncated) lines.push("", "[review comments truncated]");
}
function renderPullRequestPatch(files) {
	return files.flatMap((file) => {
		if (!file.patch) return [];
		const oldPath = file.previous_filename ?? file.filename;
		return [
			`diff --git a/${oldPath} b/${file.filename}`,
			`--- a/${oldPath}`,
			`+++ b/${file.filename}`,
			file.patch,
			file.patch_truncated ? "[patch truncated]" : ""
		];
	}).filter(Boolean).join("\n");
}
function appendPullRequestFiles(lines, files, truncated) {
	lines.push("", "## Files", "", "| Status | File | + | - |", "| --- | --- | ---: | ---: |");
	for (const file of files) lines.push(`| ${escapeTableCell(file.status)} | ${escapeTableCell(file.filename)} | ${file.additions} | ${file.deletions} |`);
	if (truncated) lines.push("", "[files truncated]");
}
// src/core/web/fetchers/github/release.ts
const RELEASE_SCHEMA = _Object_({
	name: Union([String$1(), Null()]),
	tag_name: String$1(),
	html_url: String$1(),
	target_commitish: String$1(),
	draft: Boolean$1(),
	prerelease: Boolean$1(),
	author: GITHUB_USER_SCHEMA,
	created_at: String$1(),
	published_at: Union([String$1(), Null()]),
	body: Optional(Union([String$1(), Null()])),
	assets: _Array_(_Object_({
		name: String$1(),
		content_type: String$1(),
		size: Number$1(),
		download_count: Number$1(),
		browser_download_url: String$1()
	}))
});
async function fetchRelease(context, target) {
	return await buildReleaseDocument(context, target, await context.client.get({
		route: "GET /repos/{owner}/{repo}/releases/tags/{tag}",
		params: {
			owner: target.owner,
			repo: target.repo,
			tag: target.tag
		},
		operation: `release ${target.tag} of ${target.owner}/${target.repo}`,
		signal: context.signal
	}, RELEASE_SCHEMA));
}
async function fetchLatestRelease(context, target) {
	return await buildReleaseDocument(context, target, await context.client.get({
		route: "GET /repos/{owner}/{repo}/releases/latest",
		params: {
			owner: target.owner,
			repo: target.repo
		},
		operation: `latest release of ${target.owner}/${target.repo}`,
		signal: context.signal
	}, RELEASE_SCHEMA));
}
async function buildReleaseDocument(context, target, release) {
	const title = release.name || release.tag_name;
	return {
		kind: "github.release",
		source: context.source,
		url: target.url,
		link: release.html_url,
		title: `${target.owner}/${target.repo} ${title}`,
		facts: [
			`tag ${release.tag_name}`,
			...release.draft ? ["draft"] : [],
			...release.prerelease ? ["prerelease"] : [],
			...release.author?.login ? [`by ${release.author.login}`] : [],
			...release.published_at ? [`published ${release.published_at}`] : [],
			`${release.assets.length} asset${release.assets.length === 1 ? "" : "s"}`
		],
		excerpt: release.body ?? void 0,
		bodies: [await writeDocumentBody(context.artifactDir, target.url, "release.md", renderReleaseMarkdown(release))]
	};
}
function renderReleaseMarkdown(release) {
	const lines = [
		`# ${release.name || release.tag_name}`,
		"",
		`- Tag: ${release.tag_name}`,
		`- Target: ${release.target_commitish}`,
		`- Author: ${release.author?.login ?? "unknown"}`,
		`- Created: ${release.created_at}`,
		`- Published: ${release.published_at ?? "not published"}`,
		`- Draft: ${release.draft ? "yes" : "no"}`,
		`- Prerelease: ${release.prerelease ? "yes" : "no"}`,
		`- URL: ${release.html_url}`,
		"",
		"## Release notes",
		"",
		release.body ?? "(no release notes)",
		"",
		"## Assets",
		""
	];
	if (release.assets.length === 0) {
		lines.push("(none)");
		return lines.join("\n");
	}
	lines.push("| Name | Content type | Size | Downloads | URL |", "| --- | --- | ---: | ---: | --- |");
	for (const asset of release.assets) lines.push(`| ${escapeTableCell(asset.name)} | ${escapeTableCell(asset.content_type)} | ${asset.size} | ${asset.download_count} | ${escapeTableCell(asset.browser_download_url)} |`);
	return lines.join("\n");
}
// src/core/web/fetchers/github/repository-collection.ts
const COLLECTION_LIMIT = 100;
const TAG_SCHEMA = _Object_({
	name: String$1(),
	commit: _Object_({ sha: String$1() }),
	zipball_url: String$1()
});
const BRANCH_SCHEMA = _Object_({
	name: String$1(),
	commit: _Object_({ sha: String$1() }),
	protected: Boolean$1()
});
async function fetchRepositoryCollection(context, target) {
	function listPage(page, perPage) {
		return {
			route: `GET /repos/{owner}/{repo}/${target.collection}`,
			params: {
				owner: target.owner,
				repo: target.repo,
				page,
				per_page: perPage
			},
			operation: `${target.collection} of ${target.owner}/${target.repo}`,
			signal: context.signal
		};
	}
	switch (target.collection) {
		case "releases": return await fetchCollection(context, target, {
			kind: "github.release_list",
			fetchPage: (page, perPage) => context.client.get(listPage(page, perPage), _Array_(RELEASE_SCHEMA)),
			excerpt: (release) => release.name || release.tag_name,
			render: (releases, truncated) => renderReleases(target, releases, truncated)
		});
		case "tags": return await fetchCollection(context, target, {
			kind: "github.tag_list",
			fetchPage: (page, perPage) => context.client.get(listPage(page, perPage), _Array_(TAG_SCHEMA)),
			excerpt: (tag) => tag.name,
			render: (tags, truncated) => renderTags(target, tags, truncated)
		});
		case "branches": return await fetchCollection(context, target, {
			kind: "github.branch_list",
			fetchPage: (page, perPage) => context.client.get(listPage(page, perPage), _Array_(BRANCH_SCHEMA)),
			excerpt: (branch) => branch.name,
			render: (branches, truncated) => renderBranches(target, branches, truncated)
		});
	}
}
async function fetchCollection(context, target, spec) {
	const result = await listWithCap(COLLECTION_LIMIT, spec.fetchPage);
	return {
		kind: spec.kind,
		source: context.source,
		url: target.url,
		title: `${target.owner}/${target.repo} ${target.collection}`,
		facts: [`${result.items.length} ${target.collection}${result.truncated ? ` shown (capped at ${COLLECTION_LIMIT})` : ""}`],
		excerpt: result.items.map(spec.excerpt).join("\n") || void 0,
		bodies: [await writeDocumentBody(context.artifactDir, target.url, "listing.md", spec.render(result.items, result.truncated))]
	};
}
function renderReleases(target, releases, truncated) {
	const lines = [
		`# ${target.owner}/${target.repo} releases`,
		"",
		"| Name | Tag | State | Published | Author | Assets | URL |",
		"| --- | --- | --- | --- | --- | ---: | --- |"
	];
	for (const release of releases) {
		const state = release.draft ? "draft" : release.prerelease ? "prerelease" : "published";
		lines.push(`| ${escapeTableCell(release.name ?? "")} | ${escapeTableCell(release.tag_name)} | ${state} | ${release.published_at ?? ""} | ${escapeTableCell(release.author?.login ?? "")} | ${release.assets.length} | ${escapeTableCell(release.html_url)} |`);
	}
	appendCap(lines, truncated);
	return `${lines.join("\n")}\n`;
}
function renderTags(target, tags, truncated) {
	const lines = [
		`# ${target.owner}/${target.repo} tags`,
		"",
		"| Tag | Commit | Archive |",
		"| --- | --- | --- |"
	];
	for (const tag of tags) lines.push(`| ${escapeTableCell(tag.name)} | ${tag.commit.sha} | ${escapeTableCell(tag.zipball_url)} |`);
	appendCap(lines, truncated);
	return `${lines.join("\n")}\n`;
}
function renderBranches(target, branches, truncated) {
	const lines = [
		`# ${target.owner}/${target.repo} branches`,
		"",
		"| Branch | Commit | Protected |",
		"| --- | --- | --- |"
	];
	for (const branch of branches) lines.push(`| ${escapeTableCell(branch.name)} | ${branch.commit.sha} | ${branch.protected ? "yes" : "no"} |`);
	appendCap(lines, truncated);
	return `${lines.join("\n")}\n`;
}
function appendCap(lines, truncated) {
	if (truncated) lines.push("", `[listing capped at ${COLLECTION_LIMIT} items]`);
}
// src/core/web/fetchers/github/urls.ts
const GITHUB_HOST = "github.com";
const RAW_GITHUB_HOST = "raw.githubusercontent.com";
const API_GITHUB_HOST = "api.github.com";
function parseGitHubUrl(url, webUrl) {
	let parsed;
	try {
		parsed = new URL(url);
	} catch {
		return;
	}
	const host = parsed.host;
	const webHost = new URL(webUrl).host;
	const parts = parsed.pathname.split("/").filter(Boolean).map(decodeURIComponent);
	if (webHost === GITHUB_HOST && host === RAW_GITHUB_HOST) {
		const [owner, repo, ...rest] = parts;
		if (!owner || !repo || rest.length < 2) return void 0;
		return {
			type: "ambiguous_file",
			target: {
				owner,
				repo,
				marker: "raw",
				parts: rest,
				url
			}
		};
	}
	if (webHost === GITHUB_HOST && host === API_GITHUB_HOST) {
		const [reposMarker, owner, repo, contentsMarker, ...pathParts] = parts;
		if (reposMarker !== "repos" || !owner || !repo || contentsMarker !== "contents") return;
		const ref = parsed.searchParams.get("ref") ?? void 0;
		const contentPath = pathParts.join("/");
		if (!contentPath) return void 0;
		return {
			type: "file",
			target: {
				owner,
				repo,
				ref,
				path: contentPath,
				url
			}
		};
	}
	if (host !== webHost) return void 0;
	const [owner, repo, marker, numberOrRef, ...rest] = parts;
	if (!owner || !repo) return void 0;
	if (!marker) return {
		type: "readme",
		target: {
			owner,
			repo,
			url
		}
	};
	if (marker === "issues" || marker === "pull" || marker === "pulls") {
		if (!numberOrRef) {
			if (marker === "pull") return void 0;
			const q = parsed.searchParams.get("q") ?? void 0;
			return {
				type: marker === "issues" ? "issue_list" : "pull_request_list",
				target: {
					owner,
					repo,
					tab: marker === "issues" ? "issues" : "pulls",
					...q ? { q } : {},
					url
				}
			};
		}
		const number = parsePositiveInteger(marker === "issues" ? numberOrRef : stripDiffFormat(numberOrRef));
		if (!number) return void 0;
		return marker === "issues" ? {
			type: "issue",
			target: {
				owner,
				repo,
				number,
				url
			}
		} : {
			type: "pull_request",
			target: {
				owner,
				repo,
				number,
				url
			}
		};
	}
	if (marker === "releases") {
		if (!numberOrRef) return {
			type: "repository_collection",
			target: {
				owner,
				repo,
				collection: "releases",
				url
			}
		};
		if (numberOrRef === "latest" && rest.length === 0) return {
			type: "latest_release",
			target: {
				owner,
				repo,
				url
			}
		};
		if (numberOrRef === "tag" && rest.length > 0) return {
			type: "release",
			target: {
				owner,
				repo,
				tag: rest.join("/"),
				url
			}
		};
		return;
	}
	if ((marker === "tags" || marker === "branches") && !numberOrRef) return {
		type: "repository_collection",
		target: {
			owner,
			repo,
			collection: marker,
			url
		}
	};
	if (marker === "commit" && numberOrRef && rest.length === 0) return {
		type: "commit",
		target: {
			owner,
			repo,
			ref: stripDiffFormat(numberOrRef),
			url
		}
	};
	if (marker === "commits") return {
		type: "commit_list",
		target: {
			owner,
			repo,
			parts: numberOrRef ? [numberOrRef, ...rest] : [],
			url
		}
	};
	if (marker === "actions") {
		if (!numberOrRef || numberOrRef === "runs" && rest.length === 0) return {
			type: "action_run_list",
			target: {
				owner,
				repo,
				url
			}
		};
		if (numberOrRef !== "runs") return void 0;
		const runId = parsePositiveInteger(rest[0] ?? "");
		if (!runId) return void 0;
		return {
			type: "action_run",
			target: {
				owner,
				repo,
				runId,
				url
			}
		};
	}
	if (marker === "discussions" && numberOrRef && rest.length === 0) {
		const number = parsePositiveInteger(numberOrRef);
		if (!number) return void 0;
		return {
			type: "discussion",
			target: {
				owner,
				repo,
				number,
				url
			}
		};
	}
	if ((marker === "blob" || marker === "raw") && numberOrRef && rest.length > 0) return {
		type: "ambiguous_file",
		target: {
			owner,
			repo,
			marker,
			parts: [numberOrRef, ...rest],
			url
		}
	};
	if (marker === "tree" && numberOrRef) return {
		type: "ambiguous_directory",
		target: {
			owner,
			repo,
			marker,
			parts: [numberOrRef, ...rest],
			url
		}
	};
}
function stripDiffFormat(value) {
	return value.replace(/\.(?:diff|patch)$/, "");
}
function parsePositiveInteger(value) {
	if (!/^\d+$/.test(value)) return void 0;
	const number = Number(value);
	return Number.isSafeInteger(number) && number > 0 ? number : void 0;
}
function servesUrl(webUrl, url) {
	let host;
	try {
		host = new URL(url).host;
	} catch {
		return false;
	}
	const webHost = new URL(webUrl).host;
	return webHost === GITHUB_HOST ? [
		GITHUB_HOST,
		RAW_GITHUB_HOST,
		API_GITHUB_HOST
	].includes(host) : host === webHost;
}
// src/core/web/fetchers/github/index.ts
function createGitHubFetcher(hosts) {
	function hostFor(url) {
		return hosts.find((host) => servesUrl(host.webUrl, url));
	}
	async function fetchOne(url, signal, artifactDir) {
		const host = hostFor(url);
		if (!host) return { status: "unsupported" };
		try {
			const parsed = parseGitHubUrl(url, host.webUrl);
			if (!parsed) return { status: "unsupported" };
			return {
				status: "resolved",
				document: await resolveGitHubUrl({
					client: await host.client(),
					source: host.source,
					webUrl: host.webUrl,
					signal,
					artifactDir
				}, parsed)
			};
		} catch (error) {
			return {
				status: "failed",
				reason: getErrorMessage(error)
			};
		}
	}
	return {
		source: "github",
		promptGuidelines: ["Use web_fetch directly on GitHub URLs for source-native API results: repos, files, and directories; issues, PRs, and Discussions with their conversations; commits and patches; commit history for a repo, branch, or file path; tagged and latest releases with asset metadata; Actions runs with jobs and artifacts; and issue, PR, release, tag, branch, and Actions-run listings."],
		canFetch: (url) => hostFor(url) !== void 0,
		async fetch({ urls, signal, artifactDir }) {
			if (signal?.aborted) throw new Error("Fetch cancelled.");
			const results = await Promise.all(urls.map(async (url) => ({
				url,
				result: await fetchOne(url, signal, artifactDir)
			})));
			const documents = [];
			const failures = [];
			for (const { url, result } of results) if (result.status === "resolved") documents.push(result.document);
			else if (result.status === "failed") failures.push({
				url,
				reason: result.reason
			});
			return {
				documents,
				failures,
				warnings: []
			};
		}
	};
}
async function resolveGitHubUrl(context, parsed) {
	switch (parsed.type) {
		case "file": return await fetchFile(context, parsed.target);
		case "readme": return await fetchReadme(context, parsed.target);
		case "issue": return await fetchIssue(context, parsed.target);
		case "pull_request": return await fetchPullRequest(context, parsed.target);
		case "release": return await fetchRelease(context, parsed.target);
		case "latest_release": return await fetchLatestRelease(context, parsed.target);
		case "commit": return await fetchCommit(context, parsed.target);
		case "commit_list": return await fetchCommitList(context, parsed.target);
		case "repository_collection": return await fetchRepositoryCollection(context, parsed.target);
		case "action_run": return await fetchActionRun(context, parsed.target);
		case "action_run_list": return await fetchActionRunList(context, parsed.target);
		case "discussion": return await fetchDiscussion(context, parsed.target);
		case "issue_list":
		case "pull_request_list": return await fetchListing(context, parsed.target);
		case "ambiguous_file": return await fetchFile(context, {
			...await resolveRefPath(context, parsed.target, "file"),
			url: parsed.target.url
		});
		case "ambiguous_directory": return await fetchDirectory(context, {
			...await resolveRefPath(context, parsed.target, "directory"),
			url: parsed.target.url
		});
	}
}
// src/core/web/fetchers/local/local.ts
function createLocalFetcher(client, extractor) {
	async function fetchOne(url, artifactDir) {
		const slug = slugify(url) || "document";
		const downloadDir = path.join(artifactDir, slug);
		const result = await client.fetch(url, downloadDir);
		const file = path.join(downloadDir, result.name);
		if (isHtmlContentType(result.contentType)) return buildPageDocument(url, artifactDir, file, result);
		return buildFileDocument(url, file, result);
	}
	async function buildPageDocument(url, artifactDir, file, result) {
		const markdown = (await extractor.extractToMarkdown(file, url)).trim();
		if (!markdown) throw new Error(`${extractor.name} extracted no content`);
		const body = await writeDocumentBody(artifactDir, url, "content.md", `${markdown}\n`);
		await unlink(file);
		return {
			kind: "local.page",
			source: "local",
			url,
			...result.finalUrl !== url ? { link: result.finalUrl } : {},
			title: result.title || result.finalUrl,
			facts: result.notes,
			excerpt: markdown,
			bodies: [body]
		};
	}
	function buildFileDocument(url, file, result) {
		return {
			kind: "local.file",
			source: "local",
			url,
			...result.finalUrl !== url ? { link: result.finalUrl } : {},
			title: result.name,
			facts: [
				result.contentType,
				formatSize(result.bytes),
				...result.notes
			],
			bodies: [{
				name: result.name,
				path: file,
				lines: 0,
				bytes: result.bytes
			}]
		};
	}
	return {
		source: "local",
		promptGuidelines: [],
		canFetch: isHttpUrl,
		async fetch({ urls, artifactDir, signal }) {
			const documents = [];
			const failures = [];
			await Promise.all(urls.map(async (url) => {
				if (signal?.aborted) {
					failures.push({
						url,
						reason: "Fetch cancelled."
					});
					return;
				}
				try {
					documents.push(await fetchOne(url, artifactDir));
				} catch (error) {
					failures.push({
						url,
						reason: getErrorMessage(error)
					});
				}
			}));
			return {
				documents,
				failures,
				warnings: []
			};
		}
	};
}
function isHttpUrl(url) {
	try {
		const { protocol } = new URL(url);
		return protocol === "http:" || protocol === "https:";
	} catch {
		return false;
	}
}
function isHtmlContentType(contentType) {
	const mime = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
	return mime === "text/html" || mime === "application/xhtml+xml";
}
// src/core/web/fetchers/local/local-extractor.ts
function createRehypeExtractor() {
	const pipeline = unified().use(rehypeParse).use(removeBaseElements).use(unwrapShadowTemplates).use(pruneToContentRoot).use(stripCruft).use(demoteLayoutTables).use(flattenCodeBlocks).use(rehypeRemark).use(remarkGfm, { tablePipeAlign: false }).use(remarkStringify, {
		bullet: "-",
		fences: true
	});
	return {
		name: "rehype",
		async extractToMarkdown(htmlPath, _url) {
			const html = await readFile(htmlPath, "utf8");
			return String(await pipeline.process(html));
		}
	};
}
function removeBaseElements() {
	return (tree) => {
		visit(tree, "element", (node, index, parent) => {
			if (node.tagName === "base" && parent && index !== void 0) {
				parent.children.splice(index, 1);
				return index;
			}
		});
	};
}
function unwrapShadowTemplates() {
	return (tree) => {
		visit(tree, "element", (node) => {
			node.children = node.children.flatMap((child) => child.type === "element" && child.tagName === "template" && child.properties.shadowRootMode !== void 0 ? (child.content?.children ?? []).filter((node) => node.type !== "doctype") : [child]);
		});
	};
}
const CONTENT_ROOTS = [
	"main",
	"article",
	"body"
];
function pruneToContentRoot() {
	return (tree) => {
		for (const tagName of CONTENT_ROOTS) {
			let found;
			visit(tree, "element", (node) => {
				if (node.tagName === tagName) {
					found = node;
					return EXIT;
				}
			});
			if (found) {
				tree.children = [found];
				return;
			}
		}
	};
}
const CRUFT_TAGS = /* @__PURE__ */ new Set([
	"script",
	"style",
	"noscript"
]);
function stripCruft() {
	return (tree) => {
		visit(tree, (node, index, parent) => {
			if (!parent || index === void 0) return;
			if (node.type === "comment" || node.type === "element" && (CRUFT_TAGS.has(node.tagName) || String(node.properties.ariaHidden) === "true" && !containsAltImage(node) || node.tagName === "a" && !hasVisibleContent(node))) {
				parent.children.splice(index, 1);
				return index;
			}
		});
	};
}
function containsAltImage(node) {
	let found = false;
	visit(node, "element", (child) => {
		if (child.tagName === "img" && typeof child.properties.alt === "string" && child.properties.alt.trim()) {
			found = true;
			return EXIT;
		}
	});
	return found;
}
function hasVisibleContent(node) {
	let visible = false;
	visit(node, (child) => {
		if (child.type === "text" && child.value.trim() || child.type === "element" && child.tagName === "img") {
			visible = true;
			return EXIT;
		}
	});
	return visible;
}
const BLOCK_TAGS = /* @__PURE__ */ new Set([
	"div",
	"p",
	"table",
	"ul",
	"ol",
	"pre",
	"blockquote",
	"form",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"section",
	"article",
	"center"
]);
const TABLE_TAGS = /* @__PURE__ */ new Set([
	"table",
	"thead",
	"tbody",
	"tfoot",
	"tr",
	"td",
	"th"
]);
function demoteLayoutTables() {
	return (tree) => {
		visit(tree, "element", (node) => {
			if (node.tagName === "table" && hasBlockContent(node)) demote(node);
		});
	};
}
function hasBlockContent(node) {
	return node.children.some((child) => child.type === "element" && (BLOCK_TAGS.has(child.tagName) || hasBlockContent(child)));
}
function demote(node) {
	if (TABLE_TAGS.has(node.tagName)) node.tagName = "div";
	for (const child of node.children) if (child.type === "element") demote(child);
}
function flattenCodeBlocks() {
	return (tree) => {
		visit(tree, "element", (node) => {
			if (node.tagName !== "pre") return;
			const language = findLanguage(node);
			node.children = [{
				type: "element",
				tagName: "code",
				properties: language ? { className: [`language-${language}`] } : {},
				children: [{
					type: "text",
					value: preText(node)
				}]
			}];
			return SKIP;
		});
	};
}
function preText(node) {
	const text = node.children.map((child) => {
		if (child.type === "text") return child.value;
		if (child.type !== "element") return "";
		return child.tagName === "br" ? "\n" : preText(child);
	}).join("");
	return node.tagName === "div" && !text.endsWith("\n") ? `${text}\n` : text;
}
function findLanguage(pre) {
	let language;
	visit(pre, "element", (node) => {
		const fromData = node.properties.dataLanguage;
		if (typeof fromData === "string" && fromData) {
			language = fromData;
			return EXIT;
		}
		const classes = Array.isArray(node.properties.className) ? node.properties.className : [];
		for (const name of classes) {
			const match = /^language-(\S+)$/.exec(String(name));
			if (match) {
				language = match[1];
				return EXIT;
			}
		}
	});
	return language;
}
// src/core/web/fetchers/local/worker-connection.ts
const HERE = fileURLToPath(import.meta.url);
const WORKER_PATH = join(dirname(HERE), `fetch-worker${extname(HERE)}`);
const SPAWN_CONNECT_ATTEMPTS = 30;
const SPAWN_LOCK_STALE_MS = 1e4;
const REQUEST_DEADLINE_BASE_MS = 3e4;
function resolveNode() {
	if (basename(process.execPath).toLowerCase().startsWith("node")) return process.execPath;
	for (const dir of (process.env.PATH ?? "").split(delimiter)) {
		if (!dir) continue;
		const candidate = join(dir, "node");
		if (existsSync(candidate)) return candidate;
	}
	return null;
}
function acquireSpawnLock() {
	ensureFetchWorkerDir();
	const lockPath = getFetchWorkerSpawnLockPath();
	for (let attempt = 0; attempt < 5; attempt += 1) try {
		writeFileSync(lockPath, `${process.pid}\n${Date.now()}\n`, { flag: "wx" });
		return true;
	} catch (error) {
		if (!(error instanceof Error) || error.code !== "EEXIST") throw error;
		if (isSpawnLockStale(lockPath)) {
			try {
				unlinkSync(lockPath);
			} catch {}
			continue;
		}
		return false;
	}
	return false;
}
function isSpawnLockStale(lockPath) {
	try {
		const [pidLine = "", createdAtLine = "0"] = readFileSync(lockPath, "utf8").trim().split("\n");
		const pid = Number.parseInt(pidLine, 10);
		const createdAt = Number.parseInt(createdAtLine, 10);
		if (Number.isFinite(pid)) try {
			process.kill(pid, 0);
		} catch {
			return true;
		}
		return !Number.isFinite(createdAt) || Date.now() - createdAt > SPAWN_LOCK_STALE_MS;
	} catch {
		return true;
	}
}
function releaseSpawnLock() {
	try {
		unlinkSync(getFetchWorkerSpawnLockPath());
	} catch {}
}
const STALL_SILENCE_MS = 2e4;
function createFetchWorkerClient(getSettings) {
	const socketPath = getFetchWorkerSocketPath();
	let sock = null;
	let connecting = null;
	const pending = /* @__PURE__ */ new Map();
	function connectOnce() {
		return new Promise((resolve) => {
			const candidate = connect(socketPath, () => resolve(candidate));
			candidate.on("error", () => {
				if (sock === candidate) sock = null;
				resolve(null);
			});
			candidate.on("close", () => {
				if (sock === candidate) sock = null;
				failAllPending(/* @__PURE__ */ new Error("fetch worker connection closed"));
			});
		});
	}
	function armDeadline(id, request, deadlineMs) {
		if (request.deadline) return;
		request.deadline = setTimeout(() => {
			pending.delete(id);
			onPendingChanged();
			terminateWorker();
			request.reject(/* @__PURE__ */ new Error(`fetch worker did not respond within ${deadlineMs / 1e3}s`));
		}, deadlineMs);
	}
	let stallTimer = null;
	function onPendingChanged() {
		if (stallTimer) clearTimeout(stallTimer);
		stallTimer = null;
		holdProcessWhilePending();
		if (pending.size === 0) return;
		stallTimer = setTimeout(() => void terminateWorker(), STALL_SILENCE_MS);
	}
	function holdProcessWhilePending() {
		if (pending.size > 0) sock?.ref();
		else sock?.unref();
	}
	function attachReader(socket) {
		createInterface$1({
			input: socket,
			crlfDelay: Number.POSITIVE_INFINITY
		}).on("line", (line) => {
			let event;
			try {
				event = JSON.parse(line);
			} catch {
				return;
			}
			onPendingChanged();
			if (event.event === "heartbeat") return;
			const request = pending.get(event.id);
			if (!request) return;
			if (event.event === "status") {
				if (event.stage === "started") armDeadline(event.id, request, REQUEST_DEADLINE_BASE_MS + event.budgetSecs * 1e3);
				return;
			}
			pending.delete(event.id);
			onPendingChanged();
			if (request.deadline) clearTimeout(request.deadline);
			request.resolve(event);
		});
	}
	function failAllPending(error) {
		for (const request of pending.values()) {
			if (request.deadline) clearTimeout(request.deadline);
			request.reject(error);
		}
		pending.clear();
		onPendingChanged();
	}
	async function ensureConnected() {
		if (sock && !sock.destroyed) return sock;
		connecting ??= establishConnection().finally(() => {
			connecting = null;
		});
		return connecting;
	}
	async function establishConnection() {
		let socket = await connectOnce();
		if (!socket) {
			const spawnedHere = acquireSpawnLock();
			try {
				if (spawnedHere) {
					const node = resolveNode();
					if (!node) throw new Error("no node interpreter found to spawn the fetch worker");
					const settings = getSettings();
					const config = {
						profileDir: settings.browser.profileDir,
						...settings.browser.executablePath ? { executablePath: settings.browser.executablePath } : {},
						challenge: settings.challenge
					};
					spawn(node, [WORKER_PATH, JSON.stringify(config)], {
						detached: true,
						stdio: "ignore"
					}).unref();
				}
				for (let attempt = 0; attempt < SPAWN_CONNECT_ATTEMPTS && !socket; attempt += 1) {
					await new Promise((resolve) => setTimeout(resolve, 100));
					socket = await connectOnce();
				}
				if (!socket) throw new Error("fetch worker did not start");
			} finally {
				if (spawnedHere) releaseSpawnLock();
			}
		}
		sock = socket;
		holdProcessWhilePending();
		attachReader(socket);
		return socket;
	}
	async function readWorkerPid() {
		try {
			const pid = Number.parseInt(await readFile(getFetchWorkerPidPath(), "utf8"), 10);
			return Number.isInteger(pid) && pid > 0 ? pid : null;
		} catch {
			return null;
		}
	}
	async function terminateWorker() {
		sock?.destroy();
		sock = null;
		const pid = await readWorkerPid();
		if (pid) try {
			process.kill(pid, "SIGTERM");
		} catch {}
	}
	async function request(payload) {
		const socket = await ensureConnected();
		return new Promise((resolve, reject) => {
			const request = {
				resolve,
				reject,
				deadline: null
			};
			pending.set(payload.id, request);
			onPendingChanged();
			if (payload.op !== "fetch") armDeadline(payload.id, request, REQUEST_DEADLINE_BASE_MS);
			socket.write(`${JSON.stringify(payload)}\n`);
		});
	}
	return {
		async fetch(url, downloadDir) {
			const event = await request({
				id: randomUUID(),
				op: "fetch",
				url,
				downloadDir
			});
			if (event.event === "error") throw new Error(event.reason);
			if (event.event !== "result" || event.op !== "fetch") throw new Error("fetch worker returned a malformed result");
			const { id, event: _event, op, notes, ...result } = event;
			return {
				...result,
				notes: notes ?? []
			};
		},
		async openBrowser() {
			const event = await request({
				id: randomUUID(),
				op: "open-browser"
			});
			if (event.event === "error") throw new Error(event.reason);
		},
		async restart() {
			const pid = await readWorkerPid();
			await terminateWorker();
			if (!pid) return;
			const gaveUpAt = Date.now() + 5e3;
			while (Date.now() < gaveUpAt) {
				await new Promise((resolve) => setTimeout(resolve, 100));
				try {
					process.kill(pid, 0);
				} catch {
					return;
				}
			}
			try {
				process.kill(pid, "SIGKILL");
			} catch {}
		}
	};
}
// src/core/web/parallel.ts
const DEFAULT_SEARCH_MODE = "advanced";
const API_URL = "https://api.parallel.ai/v1";
const PARALLEL_ERROR_SCHEMA = _Object_({ error: _Object_({ message: String$1() }) });
const PARALLEL_GATEWAY_ERROR_SCHEMA = _Object_({ message: String$1() });
var ParallelClient = class {
	settings;
	constructor(settings) {
		this.settings = settings;
	}
	search(request, signal) {
		return this.post("search", request, signal);
	}
	extract(request, signal) {
		return this.post("extract", request, signal);
	}
	async post(endpoint, body, signal) {
		const response = await fetch(`${API_URL}/${endpoint}`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-api-key": await resolveApiKey(this.settings, signal)
			},
			body: JSON.stringify(body),
			...signal ? { signal } : {}
		});
		const payload = await response.json().catch(() => void 0);
		if (!response.ok) {
			const detail = safeParseTypeBoxValue(PARALLEL_ERROR_SCHEMA, payload)?.error.message ?? safeParseTypeBoxValue(PARALLEL_GATEWAY_ERROR_SCHEMA, payload)?.message;
			throw new Error(`Parallel ${endpoint} returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
		}
		return payload;
	}
};
function hasParallelCredentials(settings) {
	return settings.apiKey !== void 0 || settings.apiKeyCommand !== void 0;
}
async function resolveApiKey(settings, signal) {
	if (settings.apiKey) return settings.apiKey;
	if (!settings.apiKeyCommand) throw new Error("Parallel credentials are not configured");
	return runCredentialCommand(settings.apiKeyCommand, "Parallel API key command", signal);
}
function normalizeSearchQueries(searchQueries, objective) {
	const cleaned = (searchQueries ?? []).map((query) => query.trim()).filter(Boolean);
	return cleaned.length > 0 ? cleaned : [objective];
}
function clampMaxResults(maxResults) {
	if (maxResults === void 0) return 5;
	return Math.min(Math.max(maxResults, 1), 8);
}
function validateAfterDate(afterDate) {
	if (!afterDate) return void 0;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(afterDate)) throw new Error(`Invalid after_date: ${afterDate}. Expected YYYY-MM-DD.`);
	const date = /* @__PURE__ */ new Date(`${afterDate}T00:00:00Z`);
	if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== afterDate) throw new Error(`Invalid after_date: ${afterDate}. Expected a real calendar date in YYYY-MM-DD format.`);
	return afterDate;
}
const nullableString = Union([String$1(), Null()]);
const parallelWarnings = Optional(Union([_Array_(_Object_({
	message: String$1(),
	type: String$1()
})), Null()]));
const parallelSearchResponse = _Object_({
	results: _Array_(_Object_({
		url: String$1(),
		title: Optional(nullableString),
		publish_date: Optional(nullableString),
		excerpts: _Array_(String$1())
	})),
	warnings: parallelWarnings
});
const parallelExtractResponse = _Object_({
	results: _Array_(_Object_({
		url: String$1(),
		title: Optional(nullableString),
		publish_date: Optional(nullableString),
		excerpts: _Array_(String$1()),
		full_content: Optional(nullableString),
		acquired_at: Optional(nullableString)
	})),
	errors: _Array_(_Object_({
		url: String$1(),
		error_type: String$1(),
		http_status_code: Union([Number$1(), Null()]),
		content: nullableString
	})),
	warnings: parallelWarnings
});
function parseParallelSearchResponse(response) {
	const parsed = parseTypeBoxValue(parallelSearchResponse, response, "Parallel search response");
	return {
		results: parsed.results.map(({ url, title, publish_date, excerpts }) => ({
			url,
			...title != null ? { title } : {},
			...publish_date != null ? { publish_date } : {},
			excerpts
		})),
		warnings: (parsed.warnings ?? []).map(({ message, type }) => ({
			message,
			type
		}))
	};
}
function buildSearchSummary(results, warnings) {
	const warningLines = formatWarnings(warnings);
	const resultText = results.length === 0 ? "No results." : results.map((result, index) => {
		const title = result.title?.trim() || result.url;
		const publishDate = result.publish_date ? ` (${result.publish_date})` : "";
		const excerpts = result.excerpts.map((excerpt, excerptIndex) => {
			return `${result.excerpts.length > 1 ? `   Excerpt ${excerptIndex + 1}: ` : "   "}${excerpt}`;
		});
		return [
			`${index + 1}. ${title}${publishDate}`,
			`   ${result.url}`,
			...excerpts
		].join("\n");
	}).join("\n\n");
	if (warningLines.length === 0) return resultText;
	return [
		`Warnings:`,
		...warningLines.map((warning) => `- ${warning}`),
		"",
		resultText
	].join("\n");
}
function createParallelFetcher(client) {
	return {
		source: "parallel",
		promptGuidelines: [],
		canFetch: () => true,
		async fetch({ urls, objective, artifactDir, signal }) {
			const { results, errors, warnings } = parseTypeBoxValue(parallelExtractResponse, await client.extract({
				urls,
				...objective ? { objective } : {},
				advanced_settings: { full_content: true }
			}, signal), "Parallel extract response");
			const requestedByCanonical = new Map(urls.map((url) => [canonicalUrl(url), url]));
			return {
				documents: await Promise.all(results.map(async (item) => {
					const requestedUrl = requestedByCanonical.get(canonicalUrl(item.url)) ?? item.url;
					const body = await writeDocumentBody(artifactDir, requestedUrl, "content.md", item.full_content ?? "");
					return {
						kind: "parallel.page",
						source: "parallel",
						url: requestedUrl,
						...item.url !== requestedUrl ? { link: item.url } : {},
						title: item.title?.trim() || item.url,
						facts: [...item.publish_date ? [`published ${item.publish_date}`] : [], ...item.acquired_at ? [`acquired ${item.acquired_at.slice(0, 10)}`] : []],
						...objective ? { highlights: item.excerpts } : { excerpt: item.excerpts[0] },
						bodies: [body]
					};
				})),
				warnings: formatWarnings(warnings).map((message) => ({
					type: "parallel",
					message
				})),
				failures: errors.map((error) => ({
					url: error.url,
					reason: formatParallelError(error)
				}))
			};
		}
	};
}
function canonicalUrl(url) {
	let href;
	try {
		const parsed = new URL(url);
		parsed.hash = "";
		href = parsed.href;
	} catch {
		return url;
	}
	try {
		href = decodeURI(href);
	} catch {}
	return href.endsWith("/") ? href.slice(0, -1) : href;
}
function formatParallelError(error) {
	const bits = [`type=${error.error_type}`];
	if (error.http_status_code != null) bits.push(`status=${error.http_status_code}`);
	if (error.content?.trim()) bits.push(`content=${error.content.trim()}`);
	return bits.join(" | ");
}
// src/core/web/search.ts
const searchParameters = _Object_({
	objective: String$1({ description: "What you want to learn from the web search." }),
	search_queries: Optional(_Array_(String$1({ description: "A search query string." }), {
		description: "Specific search queries to run. If omitted, the objective is used as a single query.",
		minItems: 1,
		maxItems: 8
	})),
	max_results: Optional(Integer({
		description: `Upper bound on results to return. Defaults to 5; capped at 8.`,
		minimum: 1,
		maximum: 8
	})),
	after_date: Optional(String$1({ description: "Only include results published on or after this RFC 3339 date (YYYY-MM-DD). Set it when recent results matter." }))
});
const webSearchOutput = _Object_({
	results: _Array_(_Object_({
		url: String$1(),
		title: Optional(String$1()),
		publish_date: Optional(String$1()),
		excerpts: _Array_(String$1())
	})),
	warnings: _Array_(_Object_({
		message: String$1(),
		type: Optional(String$1())
	}))
});
function createWebSearchTool(client) {
	return defineTool({
		name: "web_search",
		label: "Search Web",
		description: "Search the web and return relevant results with excerpts.",
		promptSnippet: "Search the web for sources and current information",
		promptGuidelines: ["Prefer a focused objective and 1-5 specific queries for web_search."],
		parameters: searchParameters,
		outputSchema: webSearchOutput,
		annotations: {
			readOnlyHint: true,
			destructiveHint: false
		},
		execute: async (_toolCallId, params, signal, onUpdate) => {
			const searchQueries = normalizeSearchQueries(params.search_queries, params.objective);
			onUpdate?.({
				content: [{
					type: "text",
					text: `Searching the web for: ${params.objective}`
				}],
				details: void 0
			});
			try {
				const afterDate = validateAfterDate(params.after_date);
				const { results, warnings } = parseParallelSearchResponse(await client.search({
					objective: params.objective,
					search_queries: searchQueries,
					mode: DEFAULT_SEARCH_MODE,
					advanced_settings: {
						max_results: clampMaxResults(params.max_results),
						...afterDate ? { source_policy: { after_date: afterDate } } : {}
					}
				}, signal));
				const structuredContent = {
					results,
					warnings
				};
				return {
					content: [{
						type: "text",
						text: buildSearchSummary(results, warnings)
					}],
					details: {
						kind: "web_search",
						objective: params.objective,
						count: results.length,
						results,
						warnings
					},
					structuredContent
				};
			} catch (error) {
				throw new Error(`Parallel search failed: ${getErrorMessage(error)}`);
			}
		}
	});
}
// src/core/web/index.ts
function createWebTools(settings, github, loadFetchSettings) {
	const hosts = settings.sources.flatMap((source) => {
		const client = github.get(source.name);
		return client ? [{
			source: source.name,
			webUrl: source.url,
			client
		}] : [];
	});
	const parallel = hasParallelCredentials(settings.web.parallel) ? new ParallelClient(settings.web.parallel) : void 0;
	const worker = createFetchWorkerClient(loadFetchSettings);
	const fetch = createWebFetchTool([
		createGitHubFetcher(hosts),
		...parallel ? [createParallelFetcher(parallel)] : [],
		createLocalFetcher(worker, createRehypeExtractor())
	], settings.cacheDir);
	return {
		search: parallel ? createWebSearchTool(parallel) : void 0,
		fetch,
		worker
	};
}
// src/cli/codex.ts
const AGENT_PROMPT = fileURLToPath(new URL("../../plugin/agents/librarian.md", import.meta.url));
const RULE = `# Written by \`librarian codex setup\`. The librarian role runs the librarian command, which
# writes its cache under ~/.cache/agents/librarian and reaches code hosts over the network; this
# rule runs it outside the sandbox without asking. \`librarian codex uninstall\` removes it.
prefix_rule(pattern=["librarian"], decision="allow")
`;
function readAgentPrompt() {
	const match = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/.exec(readFileSync(AGENT_PROMPT, "utf8"));
	const description = match?.[1]?.match(/^description: (".*")$/m)?.[1];
	if (!match?.[2] || !description) throw new Error(`${AGENT_PROMPT} has no quoted description and body`);
	return {
		description: JSON.parse(description),
		body: match[2]
	};
}
function renderCodexRole(prompt, codex) {
	if (prompt.body.includes("'''")) throw new Error("the librarian prompt cannot contain '''");
	const description = `${prompt.description} Spawn it with fork_turns "none": it needs only the question, not this conversation.`;
	return [
		"# Written by `librarian codex setup`; rerun it after upgrading the librarian or editing its settings.",
		"name = \"librarian\"",
		`description = ${JSON.stringify(description)}`,
		...codex.model ? [`model = ${JSON.stringify(codex.model)}`] : [],
		...codex.reasoningEffort ? [`model_reasoning_effort = ${JSON.stringify(codex.reasoningEffort)}`] : [],
		`developer_instructions = '''\n${prompt.body}'''`,
		""
	].join("\n");
}
function write(file, content) {
	const existing = existsSync(file) ? readFileSync(file, "utf8") : void 0;
	if (existing === content) return "unchanged";
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, content);
	return existing === void 0 ? "created" : "updated";
}
function onPath(command, env) {
	return (env.PATH ?? "").split(path.delimiter).some((dir) => dir.length > 0 && existsSync(path.join(dir, command)));
}
function codexFiles(env) {
	const home = env.CODEX_HOME?.trim() || path.join(os.homedir(), ".codex");
	return {
		role: path.join(home, "agents", "librarian.toml"),
		rule: path.join(home, "rules", "librarian.rules")
	};
}
function setupCodex(env, codex) {
	const { role, rule } = codexFiles(env);
	const roleState = write(role, renderCodexRole(readAgentPrompt(), codex));
	const ruleState = write(rule, RULE);
	const lines = [`${roleState[0]?.toUpperCase()}${roleState.slice(1)} ${role}: the librarian role.`, `${ruleState[0]?.toUpperCase()}${ruleState.slice(1)} ${rule}: lets the librarian command run without approval, outside Codex's sandbox.`];
	if (roleState !== "unchanged" || ruleState !== "unchanged") lines.push("Restart Codex to load them.");
	if (!onPath("librarian", env)) lines.push("The librarian command is not on PATH, so the role cannot run it. Install it with `npm install --global @thurstonsand/pi-librarian`.");
	return lines.join("\n");
}
async function uninstallCodex(env, confirm) {
	const { role, rule } = codexFiles(env);
	const present = [role, rule].filter((file) => existsSync(file));
	if (present.length === 0) return `Nothing to remove: neither ${role} nor ${rule} exists.`;
	if (!await confirm(`Remove ${present.join(" and ")}?`)) return "Removed nothing.";
	for (const file of present) rmSync(file);
	return [...present.map((file) => `Removed ${file}.`), "Restart Codex to unload them."].join("\n");
}
// src/cli/program.ts
const GLOBAL_COMMANDS = /* @__PURE__ */ new Set([
	"grepapp",
	"clone",
	"web",
	"codex",
	"help"
]);
const CODE_TOOLS = {
	github: LIBRARIAN_TOOL_NAMES.searchCodeGitHub,
	gitlab: LIBRARIAN_TOOL_NAMES.searchCodeGitLab,
	"bitbucket-server": LIBRARIAN_TOOL_NAMES.searchCodeBitbucket,
	sourcegraph: LIBRARIAN_TOOL_NAMES.searchCodeSourcegraph
};
const REPO_TOOLS = {
	github: {
		tool: LIBRARIAN_TOOL_NAMES.searchReposGitHub,
		query: "text"
	},
	gitlab: {
		tool: LIBRARIAN_TOOL_NAMES.searchReposGitLab,
		query: "name"
	},
	"bitbucket-server": {
		tool: LIBRARIAN_TOOL_NAMES.searchReposBitbucket,
		query: "name"
	},
	sourcegraph: {
		tool: LIBRARIAN_TOOL_NAMES.searchReposSourcegraph,
		query: "name"
	}
};
function kebab(key) {
	return key.replaceAll("_", "-");
}
function parseNumber(value) {
	if (!/^-?\d+(\.\d+)?$/.test(value)) throw new InvalidArgumentError("Not a number.");
	return Number(value);
}
function collect(value, previous) {
	return [...previous ?? [], value];
}
function toolCommand(name, tool, positionals, fixed, write) {
	const schema = tool.parameters;
	const required = new Set(schema.required);
	const command = new Command(name).summary(tool.label).description(tool.description).showHelpAfterError();
	for (const key of positionals) {
		const property = schema.properties[key];
		if (!property) throw new Error(`${tool.name} has no parameter ${key}`);
		const label = property.type === "array" ? `${kebab(key)}...` : kebab(key);
		command.argument(required.has(key) ? `<${label}>` : `[${label}]`, property.description);
	}
	const options = /* @__PURE__ */ new Map();
	for (const [key, property] of Object.entries(schema.properties)) {
		if (positionals.includes(key) || key in fixed) continue;
		const flag = `--${kebab(key)}`;
		let option;
		if (property.type === "boolean") {
			option = new Option(flag, property.description);
			command.addOption(new Option(`--no-${kebab(key)}`, `Negates ${flag}.`));
		} else if (property.type === "array") option = new Option(`${flag} <value>`, `${property.description ?? ""} Repeat for several.`.trim()).argParser(collect);
		else if (property.type === "integer" || property.type === "number") option = new Option(`${flag} <n>`, property.description).argParser(parseNumber);
		else {
			option = new Option(`${flag} <value>`, property.description);
			if (property.enum) option.choices(property.enum);
		}
		if (required.has(key)) option.makeOptionMandatory();
		command.addOption(option);
		options.set(key, option);
	}
	command.action(async () => {
		const params = { ...fixed };
		positionals.forEach((key, index) => {
			const value = command.processedArgs[index];
			if (value !== void 0) params[key] = value;
		});
		for (const [key, option] of options) {
			const value = command.getOptionValue(option.attributeName());
			if (value !== void 0) params[key] = value;
		}
		const checked = parseTypeBoxValue(tool.parameters, params, "Invalid arguments");
		write(`${(await tool.execute(randomUUID(), checked, void 0)).content.map((part) => part.text).join("\n")}\n`);
	});
	return command;
}
function sourceDescription(source) {
	return source.description ?? `${source.kind} at ${new URL(source.url).host}`;
}
function createProgram(input) {
	const { settings, clients, repoTools, web, write } = input;
	const tool = (name) => {
		const found = repoTools.find((candidate) => candidate.name === name);
		if (!found) throw new Error(`no ${name} tool`);
		return found;
	};
	const includes = (list, source) => list.some((candidate) => candidate.name === source.name);
	const sourceArgument = (name, source) => "source" in tool(name).parameters.properties ? { source: source.name } : {};
	const program = new Command("librarian").description("Research code and documentation outside this workspace. Commands exist only for configured sources; run `librarian <command> --help` for each one's arguments and query syntax.").showHelpAfterError();
	const readable = readableSources(settings, clients);
	const clonable = cloneSources(settings.sources);
	for (const source of settings.sources) {
		if (GLOBAL_COMMANDS.has(source.name)) throw new Error(`Source "${source.name}" collides with librarian's own command; rename it.`);
		const command = new Command(source.name).description(sourceDescription(source));
		if (includes(sourcesWith(settings.sources, source.kind, "code-search"), source)) {
			const name = CODE_TOOLS[source.kind];
			command.addCommand(toolCommand("code", tool(name), ["pattern"], sourceArgument(name, source), write));
		}
		if (includes(sourcesWith(settings.sources, source.kind, "repo-search"), source)) {
			const { tool: name, query } = REPO_TOOLS[source.kind];
			command.addCommand(toolCommand("repos", tool(name), [query], sourceArgument(name, source), write));
		}
		if (includes(readable, source)) {
			const name = LIBRARIAN_TOOL_NAMES.readFile;
			command.addCommand(toolCommand("read", tool(name), ["repo", "path"], sourceArgument(name, source), write));
		}
		if (includes(clonable, source)) command.addCommand(toolCommand("clone", tool(LIBRARIAN_TOOL_NAMES.checkoutRepo), ["repo"], { source: source.name }, write));
		if (source.kind === "sourcegraph" && includes(sourcesWith(settings.sources, "sourcegraph", "code-search"), source)) {
			const name = LIBRARIAN_TOOL_NAMES.findDefinition;
			command.addCommand(toolCommand("definition", tool(name), ["symbol"], sourceArgument(name, source), write));
		}
		if (command.commands.length > 0) program.addCommand(command);
	}
	program.addCommand(toolCommand("grepapp", tool(LIBRARIAN_TOOL_NAMES.searchCodeGrepApp), ["pattern"], {}, write));
	program.addCommand(toolCommand("clone", tool(LIBRARIAN_TOOL_NAMES.checkoutRepo), ["repo"], {}, write).summary("Clone a repository by its full HTTPS or SSH URL").description("Clone a repository by its full HTTPS or SSH URL into the shared cache and check out a branch, tag, or commit, returning its path for grep, read, and git log, blame, and diff. Clones are reused across calls. To clone by repository path, use `librarian <source> clone`."));
	const webCommand = new Command("web").description("Search the web and fetch pages");
	if (web.search) webCommand.addCommand(toolCommand("search", web.search, ["objective"], {}, write));
	webCommand.addCommand(toolCommand("fetch", web.fetch, ["urls"], {}, write));
	program.addCommand(webCommand);
	program.addCommand(new Command("codex").description("Install the librarian into Codex, or remove it").addCommand(new Command("setup").description("Write the librarian role to ~/.codex/agents and allow the librarian command in ~/.codex/rules").action(async () => write(`${await input.setupCodex()}\n`))).addCommand(new Command("uninstall").description("Remove the librarian role and rule that `codex setup` wrote, after asking").action(async () => write(`${await input.uninstallCodex()}\n`))));
	return program;
}
// src/cli/librarian.ts
try {
	for (const move of migrateFromPi(piLegacyPaths(process.env), librarianPaths(process.env))) process.stderr.write(`librarian: moved its ${move}\n`);
	const settings = loadSettings(process.env);
	const clients = createRepoClients(settings, resolveGhCliToken);
	await createProgram({
		settings,
		clients,
		repoTools: createRepoTools(settings, clients).tools,
		web: createWebTools(settings, clients.github, () => loadSettings(process.env).web.fetch),
		setupCodex: async () => setupCodex(process.env, settings.codex),
		uninstallCodex: () => uninstallCodex(process.env, async (question) => {
			const prompt = createInterface({
				input: process.stdin,
				output: process.stderr
			});
			const closed = new Promise((resolve) => prompt.once("close", () => resolve("")));
			const answer = await Promise.race([prompt.question(`${question} [y/N] `), closed]);
			prompt.close();
			return /^y(es)?$/i.test(answer.trim());
		}),
		write: (text) => process.stdout.write(text)
	}).parseAsync();
} catch (error) {
	process.stderr.write(`librarian: ${getErrorMessage(error)}\n`);
	process.exitCode = 1;
}
export {};
