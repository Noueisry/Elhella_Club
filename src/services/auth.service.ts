import axios, { AxiosHeaders } from 'axios';
import { apiClient, serviceError } from './api-client';
import { getSupabase, loginEmail } from './supabase-client';
import type { AuthSession, AuthUser } from '../models/auth';
import type { ApiResponse } from '../types/api';

function authFailure(message: string, status = 400) {
  return serviceError({ headers: new AxiosHeaders() }, status, 'AUTH_ERROR', message);
}
export async function currentSession(signal?: AbortSignal): Promise<AuthSession> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error || !data.session) throw authFailure('سجل الدخول للوصول إلى التطبيق.', 401);
  const profile = await apiClient.get<ApiResponse<AuthUser>>('/auth/me', { signal });
  return { user: profile.data.data, expiresAt: new Date((data.session.expires_at ?? 0) * 1000).toISOString() };
}
export async function login(login: string, password: string): Promise<AuthSession> {
  const { error } = await getSupabase().auth.signInWithPassword({ email: loginEmail(login), password });
  if (error) throw authFailure('اسم الدخول أو كلمة المرور غير صحيحة، أو تعذر الاتصال.', error.status === 429 ? 429 : 400);
  try { return await currentSession(); }
  catch (failure) { await getSupabase().auth.signOut({ scope: 'local' }); throw failure; }
}
export async function logout(): Promise<void> {
  const { error } = await getSupabase().auth.signOut({ scope: 'local' });
  if (error) throw authFailure('تعذر تسجيل الخروج. أعد المحاولة.');
}
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) throw authFailure('انتهت الجلسة.', 401);
  const check = await supabase.auth.signInWithPassword({ email: data.user.email, password: currentPassword });
  if (check.error) throw authFailure('كلمة المرور الحالية غير صحيحة.');
  if (newPassword.length < 12 || new TextEncoder().encode(newPassword).length > 72) throw authFailure('كلمة المرور الجديدة يجب أن تحتوي على 12 حرفاً على الأقل و72 بايت كحد أقصى.');
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw authFailure('تعذر تغيير كلمة المرور.');
  await apiClient.post('/auth/revoke-sessions', {});
  await supabase.auth.signOut({ scope: 'global' });
}
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError<{ error?: { message?: string } }>(error)) return error.response?.data.error?.message ?? 'تعذر الاتصال بالخدمة. يرجى إعادة المحاولة.';
  if (error instanceof Error) return error.message;
  return 'تعذر إكمال العملية. يرجى إعادة المحاولة.';
}
