export type PartialWrite<T> = { [K in keyof T]?: T[K] | undefined }
