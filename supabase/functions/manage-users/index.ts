import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const url = Deno.env.get('SUPABASE_URL')!;
const publicKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const failure = (status: number, code: string, message: string) => reply({ error: { code, message } }, status);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return failure(405, 'METHOD_NOT_ALLOWED', 'العملية غير مسموحة.');
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return failure(401, 'UNAUTHENTICATED', 'سجل الدخول أولاً.');
  const caller = createClient(url, publicKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: identity, error: authError } = await caller.auth.getUser();
  if (authError || !identity.user) return failure(401, 'UNAUTHENTICATED', 'انتهت الجلسة.');
  try {
    const token = authorization.slice(7).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const sessionId = JSON.parse(atob(token)).session_id;
    if (typeof sessionId !== 'string') return failure(401, 'UNAUTHENTICATED', 'انتهت الجلسة.');
    const { path, input } = await request.json();
    const permitted = await admin.rpc('smd_manage_user', { p_actor: identity.user.id, p_id: identity.user.id, p_input: {}, p_action: 'authorize', p_session: sessionId });
    if (permitted.error) return failure(403, 'FORBIDDEN', 'إدارة الحسابات للمدير النشط فقط.');
    if (typeof input?.password !== 'string' || input.password.length < 12 || new TextEncoder().encode(input.password).length > 72) return failure(400, 'INVALID_PASSWORD', 'كلمة المرور من 12 حرفاً إلى 72 بايت.');
    if (path === '/users') {
      if (typeof input.login !== 'string' || !/^[a-z0-9][a-z0-9._@+\-]{2,99}$/i.test(input.login) || typeof input.fullName !== 'string' || !input.fullName.trim() || !['admin', 'treasurer'].includes(input.role)) return failure(400, 'INVALID_USER', 'بيانات الحساب غير صحيحة.');
      const domain = Deno.env.get('AUTH_LOGIN_DOMAIN') ?? 'club.invalid';
      const login = input.login.trim().toLowerCase();
      const { data, error } = await admin.auth.admin.createUser({ email: login.includes('@') ? login : `${login}@${domain}`, password: input.password, email_confirm: true });
      if (error || !data.user) return failure(409, 'USER_CREATE_FAILED', 'تعذر إنشاء الحساب. قد يكون اسم الدخول مستخدماً.');
      const saved = await admin.rpc('smd_manage_user', { p_actor: identity.user.id, p_id: data.user.id, p_input: { login, fullName: input.fullName, role: input.role }, p_action: 'create', p_session: sessionId });
      if (saved.error) { await admin.auth.admin.deleteUser(data.user.id); return failure(400, 'USER_CREATE_FAILED', 'تعذر حفظ بيانات الحساب.'); }
      return reply(saved.data);
    }
    const match = /^\/users\/([a-f0-9-]{36})\/password$/.exec(path ?? '');
    if (!match) return failure(404, 'ROUTE_NOT_FOUND', 'العملية غير موجودة.');
    // Revoke before changing the password so old access tokens cannot keep reading data.
    const revoked = await admin.rpc('smd_manage_user', { p_actor: identity.user.id, p_id: match[1], p_input: {}, p_action: 'password', p_session: sessionId });
    if (revoked.error) return failure(400, 'PASSWORD_RESET_FAILED', 'تعذر تعديل هذا الحساب.');
    const updated = await admin.auth.admin.updateUserById(match[1], { password: input.password });
    if (updated.error) return failure(400, 'PASSWORD_RESET_FAILED', 'تعذر تغيير كلمة المرور. أعد المحاولة.');
    return reply(revoked.data);
  } catch {
    return failure(400, 'INVALID_REQUEST', 'الطلب غير صحيح.');
  }
});
