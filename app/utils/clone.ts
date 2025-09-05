export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item)) as T;
  }

  if (typeof obj === "function") {
    return obj; // Return functions as-is
  }

  const cloned = {} as T;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }

  return cloned;
}

export function ensure<T extends object>(
  obj: T,
  keys: Array<[keyof T][number]>,
) {
  return keys.every(
    (k) => obj[k] !== undefined && obj[k] !== null && obj[k] !== "",
  );
}
