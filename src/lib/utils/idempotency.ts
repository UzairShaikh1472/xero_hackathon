import type { ExecutionHistoryEntry, NegotiationDraft } from "../domain/types.js";

const executionStore = new Map<string, unknown>();
const draftStore = new Map<string, NegotiationDraft>();
const executionHistory: ExecutionHistoryEntry[] = [];

export function getStoredExecution<T>(key: string) {
  return executionStore.get(key) as T | undefined;
}

export function storeExecution<T>(key: string, value: T) {
  executionStore.set(key, value);
}

export function storeDraft(draft: NegotiationDraft) {
  draftStore.set(draft.id, draft);
}

export function getStoredDraft(id: string) {
  return draftStore.get(id);
}

export function appendExecutionHistory(entry: ExecutionHistoryEntry) {
  executionHistory.unshift(entry);
}

export function getExecutionHistory() {
  return [...executionHistory];
}
