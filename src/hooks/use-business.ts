import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/business.service';
import type { ArrearsQuery, EventQuery, MemberQuery, ParticipantQuery, StatementQuery } from '../models/business';

const key = ['business'] as const;
export const useDashboard = () => useQuery({ queryKey: [...key, 'dashboard'], queryFn: ({ signal }) => api.getDashboard(signal) });
export const useClubIdentity = () => useQuery({ queryKey: [...key, 'club'], queryFn: ({ signal }) => api.getClubIdentity(signal) });
export const useMembers = (params: MemberQuery, enabled = true) => useQuery({ queryKey: [...key, 'members', params], queryFn: ({ signal }) => api.getMembers(params, signal), enabled });
export const useMember = (id: string) => useQuery({ queryKey: [...key, 'member', id], queryFn: ({ signal }) => api.getMember(id, signal), enabled: Boolean(id) });
export const useStatement = (id: string, params: StatementQuery) => useQuery({ queryKey: [...key, 'statement', id, params], queryFn: ({ signal }) => api.getStatement(id, params, signal), enabled: Boolean(id) });
export const useMemberPayments = (id: string, page: number, limit: number) => useQuery({ queryKey: [...key, 'payments', id, page, limit], queryFn: ({ signal }) => api.getMemberPayments(id, page, limit, signal), enabled: Boolean(id) });
export const useEvents = (params: EventQuery, enabled = true) => useQuery({ queryKey: [...key, 'events', params], queryFn: ({ signal }) => api.getEvents(params, signal), enabled });
export const useEvent = (id: string, params: ParticipantQuery) => useQuery({ queryKey: [...key, 'event', id, params], queryFn: ({ signal }) => api.getEvent(id, params, signal), enabled: Boolean(id) });
export const useArrears = (params: ArrearsQuery) => useQuery({ queryKey: [...key, 'arrears', params], queryFn: ({ signal }) => api.getArrears(params, signal) });

// Member/activity/event changes affect statements, arrears and club aggregates together.
export function useBusinessMutation<T, V>(mutationFn: (input: V) => Promise<T>) {
  const cache = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => cache.invalidateQueries({ queryKey: key }) });
}
