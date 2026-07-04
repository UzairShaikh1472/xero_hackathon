import { queryOptions } from "@tanstack/react-query";

import { fetchControlRoom, fetchFollowUps, fetchHealth, fetchReceivablesDraftsBatch } from "./api";

export const controlRoomQuery = queryOptions({
  queryKey: ["kinetic", "control-room"],
  queryFn: () => fetchControlRoom(),
  staleTime: 60_000,
  refetchOnWindowFocus: false,
});

export const draftsQuery = queryOptions({
  queryKey: ["kinetic", "drafts"],
  queryFn: () => fetchReceivablesDraftsBatch(),
  staleTime: 60_000,
  refetchOnWindowFocus: false,
  retry: 1,
});

export const healthQuery = queryOptions({
  queryKey: ["kinetic", "health"],
  queryFn: () => fetchHealth(),
  staleTime: 30_000,
});

export const followUpsQuery = queryOptions({
  queryKey: ["kinetic", "follow-ups"],
  queryFn: () => fetchFollowUps(),
  staleTime: 30_000,
  refetchOnWindowFocus: false,
});
