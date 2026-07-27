import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createR6Session,
  deleteR6Session,
  endR6Session,
  fetchActiveR6Session,
  fetchR6Sessions,
  reopenR6Session,
  updateR6SessionDetails,
} from "@/features/rainbow-six-siege/lib/sessions";

const SESSIONS_KEY = ["r6_sessions"];
const ACTIVE_SESSION_KEY = ["r6_sessions", "active"];
const SESSION_DETAIL_KEY = ["r6_session_detail"];

export function useR6SessionsList() {
  return useQuery({ queryKey: SESSIONS_KEY, queryFn: fetchR6Sessions });
}

export function useActiveR6Session() {
  return useQuery({ queryKey: ACTIVE_SESSION_KEY, queryFn: fetchActiveR6Session });
}

export function useCreateR6Session() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createR6Session,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
      queryClient.invalidateQueries({ queryKey: ACTIVE_SESSION_KEY });
    },
  });
}

function invalidateSessionQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
  queryClient.invalidateQueries({ queryKey: ACTIVE_SESSION_KEY });
  queryClient.invalidateQueries({ queryKey: SESSION_DETAIL_KEY });
}

export function useEndR6Session() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: endR6Session,
    onSuccess: () => invalidateSessionQueries(queryClient),
  });
}

export function useReopenR6Session() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reopenR6Session,
    onSuccess: () => invalidateSessionQueries(queryClient),
  });
}

export function useUpdateR6SessionDetails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateR6SessionDetails,
    onSuccess: () => invalidateSessionQueries(queryClient),
  });
}

export function useDeleteR6Session() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteR6Session,
    onSuccess: () => invalidateSessionQueries(queryClient),
  });
}
