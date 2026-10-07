import axios, { AxiosError, AxiosHeaders, CanceledError, type InternalAxiosRequestConfig } from 'axios';
import { getSupabase } from './supabase-client';

export function serviceError(config: InternalAxiosRequestConfig, status: number, code: string, message: string): AxiosError {
  return new AxiosError(message, code, config, undefined, {
    config, status, statusText: code, headers: new AxiosHeaders(),
    data: { error: { code, message, requestId: crypto.randomUUID() } },
  });
}
// The existing services retain their contract; their transport is Supabase only.
export const apiClient = axios.create({
  timeout: 30000,
  adapter: async (config) => {
    if (config.signal?.aborted) throw new CanceledError();
    const supabase = getSupabase();
    const path = config.url ?? '';
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data ?? {};
    const abort = new AbortController();
    const cancel = () => abort.abort();
    config.signal?.addEventListener?.('abort', cancel);
    const timer = setTimeout(cancel, config.timeout ?? 30000);
    let value: unknown;
    try {
      if ((path === '/users' && config.method === 'post') || /^\/users\/[^/]+\/password$/.test(path)) {
        const { data, error } = await supabase.functions.invoke('manage-users', { body: { path, input: body }, signal: abort.signal });
        if (error) {
          const response = 'context' in error && error.context instanceof Response ? error.context : undefined;
          const detail = response ? await response.json().catch(() => null) : null;
          throw serviceError(config, response?.status ?? 503, detail?.error?.code ?? 'SUPABASE_ERROR', detail?.error?.message ?? 'تعذر إكمال إدارة الحساب.');
        }
        value = data;
      } else {
        const { data, error } = await supabase.rpc('smd_request', {
          p_method: (config.method ?? 'get').toUpperCase(), p_path: path, p_params: config.params ?? {}, p_body: body,
        }).abortSignal(abort.signal);
        if (error) {
          let detail: { status?: number; code?: string; message?: string } | undefined;
          try { detail = JSON.parse(error.message); } catch { /* Do not expose SQL diagnostics. */ }
          throw serviceError(config, detail?.status ?? (error.code === 'PGRST301' ? 401 : 503), detail?.code ?? 'SUPABASE_ERROR', detail?.message ?? 'تعذر الاتصال بقاعدة البيانات. تحقق من إعداد Supabase.');
        }
        value = data;
      }
      return { data: { data: value }, status: 200, statusText: 'OK', headers: new AxiosHeaders(), config };
    } catch (error) {
      if (config.signal?.aborted) throw new CanceledError();
      throw error;
    } finally {
      clearTimeout(timer);
      config.signal?.removeEventListener?.('abort', cancel);
    }
  },
});
apiClient.interceptors.response.use((response) => response, (error: unknown) => {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) window.dispatchEvent(new Event('smd:unauthenticated'));
    if (error.response?.status === 403) window.dispatchEvent(new Event('smd:forbidden'));
  }
  return Promise.reject(error);
});
