export type ApiError =
  | { kind: 'network'; traceId: string; message: string }
  | { kind: 'http'; status: number; traceId: string; message: string }
  | { kind: 'parse'; traceId: string; message: string }
