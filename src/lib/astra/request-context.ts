import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestStore {
  requestId: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestStore>();

export function getActiveRequestId(): string | undefined {
  return asyncLocalStorage.getStore()?.requestId;
}

export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return asyncLocalStorage.run({ requestId }, fn);
}
