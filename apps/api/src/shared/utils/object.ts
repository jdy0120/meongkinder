export function isEmpty(value: object | string | null | undefined) {
  if (
    value == "" ||
    value == null ||
    value == undefined ||
    (value != null && typeof value == "object" && !Object.keys(value).length)
  ) {
    return true;
  }

  return false;
}

export function isNotEmpty(value: object | string | null | undefined) {
  return !isEmpty(value);
}

export function pick(
  object: Record<string, any>,
  keys: string[],
): Record<string, any> {
  return keys.reduce<Record<string, any>>((obj, key) => {
    const value = object[key] as unknown;
    if (isNotEmpty(value as object | string | null | undefined)) {
      obj[key] = value;
    }

    return obj;
  }, {});
}
