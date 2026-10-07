import { apiClient } from './api-client';
import type { ApiResponse } from '../types/api';
import type { Arrears, ArrearsQuery, ClubEvent, Dashboard, EventDetail, EventInput, EventQuery, EventUpdate,
  Member, MemberInput, MemberQuery, MemberRemoval, MemberStatus, MemberUpdate, Page, ParticipantQuery, Payment, Statement, StatementQuery } from '../models/business';

async function get<T>(path: string, params: object, signal?: AbortSignal): Promise<T> {
  return (await apiClient.get<ApiResponse<T>>(path, { params, signal })).data.data;
}
export const getDashboard = (signal?: AbortSignal) => get<Dashboard>('/dashboard', {}, signal);
export const getClubIdentity = (signal?: AbortSignal) => get<{ clubName: string; businessTimezone: string; businessToday: string }>('/club', {}, signal);
export const getMembers = (params: MemberQuery, signal?: AbortSignal) => get<Page<Member>>('/members', params, signal);
export const getMember = (id: string, signal?: AbortSignal) => get<{ member: Member }>(`/members/${id}`, {}, signal);
export const getStatement = (id: string, params: StatementQuery, signal?: AbortSignal) => get<Statement>(`/members/${id}/statement`, params, signal);
export const getMemberPayments = (id: string, page: number, limit: number, signal?: AbortSignal) => get<Page<Payment>>('/payments', { memberId: id, page, limit }, signal);
export const getEvents = (params: EventQuery, signal?: AbortSignal) => get<Page<ClubEvent>>('/events', params, signal);
export const getEvent = (id: string, params: ParticipantQuery, signal?: AbortSignal) => get<EventDetail>(`/events/${id}`, params, signal);
export const getArrears = (params: ArrearsQuery, signal?: AbortSignal) => get<Arrears>('/arrears', params, signal);

export async function createMember(input: MemberInput) { return (await apiClient.post<ApiResponse<{ member: Member }>>('/members', input)).data.data; }
export async function updateMember(id: string, input: MemberUpdate) { return (await apiClient.patch<ApiResponse<{ member: Member }>>(`/members/${id}`, input)).data.data; }
export async function changeActivity(id: string, status: MemberStatus) { return (await apiClient.patch<ApiResponse<{ member: Member }>>(`/members/${id}/activity`, { status })).data.data; }
export async function removeMember(id: string) { return (await apiClient.delete<ApiResponse<MemberRemoval>>(`/members/${id}`, { data: {} })).data.data; }
export async function archiveMember(id: string) { return (await apiClient.post<ApiResponse<MemberRemoval>>(`/members/${id}/archive`, {})).data.data; }
export async function createEvent(input: EventInput) { return (await apiClient.post<ApiResponse<{ event: ClubEvent; contributionsCreated: number }>>('/events', input)).data.data; }
export async function updateEvent(id: string, input: EventUpdate) { return (await apiClient.patch<ApiResponse<{ event: ClubEvent }>>(`/events/${id}`, input)).data.data; }
export async function addParticipants(id: string, memberIds: string[]) { return (await apiClient.post<ApiResponse<{ event: ClubEvent; contributionsCreated: number }>>(`/events/${id}/participants`, { memberIds })).data.data; }
export async function removeEvent(id: string) { return (await apiClient.delete<ApiResponse<{ id: string; message: string }>>(`/events/${id}`, { data: {} })).data.data; }
