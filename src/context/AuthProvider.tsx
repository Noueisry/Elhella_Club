import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { AuthContext, type AuthContextValue } from './auth-context';
import type { AuthSession } from '../models/auth';
import * as service from '../services/auth.service';
import { getSupabase } from '../services/supabase-client';
import { env } from '../config/env';

export function AuthProvider({ children }: PropsWithChildren) {
  const cache = useQueryClient();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const revision = useRef(0), identity = useRef<string | null>(null);
  const accept = useCallback((current: AuthSession) => {
    if (identity.current !== current.user.id) cache.clear();
    identity.current = current.user.id; setSession(current); setStatus('authenticated'); setError('');
  }, [cache]);
  const forget = useCallback((message = '') => { revision.current++; identity.current = null; setSession(null); setStatus('anonymous'); setNotice(message); cache.clear(); }, [cache]);
  const restore = useCallback(async (signal?: AbortSignal) => {
    const version = ++revision.current;
    try { const current = await service.currentSession(signal); if (!signal?.aborted && version === revision.current) accept(current); }
    catch (failure) {
      if (signal?.aborted || version !== revision.current) return;
      if (axios.isAxiosError(failure) && failure.response?.status === 401) forget();
      else { setError(service.errorMessage(failure)); setStatus('error'); }
    }
  }, [accept, forget]);
  useEffect(() => {
    const abort = new AbortController();
    void restore(abort.signal);
    return () => abort.abort();
  }, [restore]);
  useEffect(() => {
    const expired = () => forget(session ? 'انتهت الجلسة. سجل الدخول من جديد.' : '');
    window.addEventListener('smd:unauthenticated', expired);
    return () => window.removeEventListener('smd:unauthenticated', expired);
  }, [forget, session]);
  useEffect(() => {
    if (env.configurationError) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const { data } = getSupabase().auth.onAuthStateChange((event) => {
      clearTimeout(timeout);
      if (event === 'SIGNED_OUT') forget();
      // Defer requests outside the Auth callback to avoid its session lock.
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'SIGNED_IN') timeout = setTimeout(() => { void restore(); }, 0);
    });
    return () => { clearTimeout(timeout); data.subscription.unsubscribe(); };
  }, [forget, restore]);
  async function login(login: string, password: string) {
    const current = await service.login(login, password); revision.current++; cache.clear(); accept(current); setNotice('');
  }
  async function logout() {
    try { await service.logout(); }
    catch (failure) { if (!axios.isAxiosError(failure) || failure.response?.status !== 401) throw failure; }
    forget('تم تسجيل الخروج.');
  }
  async function changePassword(currentPassword: string, newPassword: string) {
    await service.changePassword(currentPassword, newPassword); forget('تم تغيير كلمة المرور. سجل الدخول من جديد.');
  }
  return <AuthContext.Provider value={{ user: session?.user ?? null, status, error, notice, login, logout, changePassword, restore }}>{children}</AuthContext.Provider>;
}
