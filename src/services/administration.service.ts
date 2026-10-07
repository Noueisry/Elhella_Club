import { apiClient } from './api-client';
import type { ApiResponse } from '../types/api';
import type { Page } from '../models/business';
import type { ManagedUser, MonthlyRate, Settings, SettingsInput, UserInput, UserUpdate } from '../models/administration';
export async function getUsers(page: number, limit: number, signal?: AbortSignal) { const value = (await apiClient.get<ApiResponse<{ users: ManagedUser[]; total: number; page: number; limit: number }>>('/users', { params: { page, limit }, signal })).data.data; return { ...value, items: value.users }; }
export async function createUser(input: UserInput) { return (await apiClient.post<ApiResponse<{ user: ManagedUser }>>('/users', input)).data.data; }
export async function updateUser(id: string, input: UserUpdate) { return (await apiClient.patch<ApiResponse<{ user: ManagedUser }>>(`/users/${id}`, input)).data.data; }
export async function resetUserPassword(id: string, password: string) { return (await apiClient.post<ApiResponse<{ message: string }>>(`/users/${id}/password`, { password })).data.data; }
export async function getSettings(signal?: AbortSignal) { return (await apiClient.get<ApiResponse<Settings>>('/settings', { signal })).data.data; }
export async function updateSettings(input: SettingsInput) { return (await apiClient.patch<ApiResponse<{ club: Settings['club'] }>>('/settings', input)).data.data; }
export async function getRates(page: number, limit: number, signal?: AbortSignal) { return (await apiClient.get<ApiResponse<Page<MonthlyRate>>>('/settings/monthly-rates', { params: { page, limit }, signal })).data.data; }
export async function scheduleRate(input: { amount: string; effectiveOn: string }) { return (await apiClient.post<ApiResponse<{ rate: MonthlyRate }>>('/settings/monthly-rates', input)).data.data; }
