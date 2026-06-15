export function isString(value: any): value is string {
  return typeof value === "string";
}

export function isNumber(value: any): value is number {
  return typeof value === "number";
}

export function isBoolean(value: any): value is boolean {
  return typeof value === "boolean";
}

export function isObject(value: any): value is object {
  return typeof value === "object";
}

export function isFunction(value: any): value is (...data: any) => any {
  return typeof value === "function";
}

export function isUndefined(value: any): value is undefined {
  return typeof value === "undefined";
}

export function isNull(value: any): value is null {
  return value === null;
}

export function isExists(value: any): boolean {
  return !isNull(value) && !isUndefined(value);
}
