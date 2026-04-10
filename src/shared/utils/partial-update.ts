type WithoutUndefinedValues<T> = { [K in keyof T]: Exclude<T[K], undefined> }

export function pickDefined<T extends object>(obj: T): Partial<WithoutUndefinedValues<T>> {
  const result: Partial<WithoutUndefinedValues<T>> = {}
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) {
      result[key] = obj[key] as Exclude<T[typeof key], undefined>
    }
  }
  return result
}
