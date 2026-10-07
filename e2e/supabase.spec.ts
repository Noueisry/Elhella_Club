import { test, expect, type Page } from '@playwright/test';
import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

let db: PGlite;
const adminId = randomUUID(), treasurerId = randomUUID();
const today = new Date().toISOString().slice(0, 10);
let queue = Promise.resolve();
test.beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key,email text);
    create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default clock_timestamp());
    create function auth.jwt() returns jsonb language sql as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql as $$ select (auth.jwt()->>'sub')::uuid $$;
    grant usage on schema auth to anon,authenticated; grant execute on all functions in schema auth to anon,authenticated;`);
  const directory = new URL('../../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, directory), 'utf8'));
  await db.query(`insert into auth.users values($1,'admin@club.invalid'),($2,'cashier@club.invalid')`, [adminId, treasurerId]);
  await db.query(`insert into auth.sessions(id,user_id) values($1,$1),($2,$2)`, [adminId, treasurerId]);
  await db.query(`insert into smd.profiles(id,login,"fullName",role) values($1,'admin','المدير','admin'),($2,'cashier','أمين الصندوق','treasurer')`, [adminId, treasurerId]);
});
test.afterAll(() => db.close());

function session(id: string) {
  const claims = { sub: id, session_id:id, role: 'authenticated', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 };
  const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.test`;
  return { access_token: token, refresh_token: `${id}-refresh`, expires_in: 3600, expires_at: claims.exp, token_type: 'bearer',
    user: { id, aud: 'authenticated', role: 'authenticated', email: id === adminId ? 'admin@club.invalid' : 'cashier@club.invalid', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } };
}
async function rpc(user: string, method: string, path: string, body: object = {}, params: object = {}) {
  await db.exec('set role authenticated');
  try {
    await db.query(`select set_config('request.jwt.claims',$1,false)`, [JSON.stringify({ sub: user, session_id:user, iat: Math.floor(Date.now() / 1000) })]);
    return (await db.query<{ result: Record<string, unknown> }>(`select public.smd_request($1,$2,$3::jsonb,$4::jsonb) as result`, [method, path, JSON.stringify(params), JSON.stringify(body)])).rows[0]!.result;
  } finally { await db.exec('reset role'); }
}
async function connect(page: Page) {
  const oldApi: string[] = [];
  page.on('request', (request) => { if (/\/api\//.test(request.url()) || request.url().includes(':4000')) oldApi.push(request.url()); });
  await page.route('https://smd-test.supabase.co/**', async (route) => {
    const request = route.request(), url = new URL(request.url());
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 200, headers: cors }); return; }
    if (url.pathname === '/auth/v1/token') {
      const body = request.postDataJSON(); const id = body.email === 'admin@club.invalid' ? adminId : body.email === 'cashier@club.invalid' ? treasurerId : null;
      if (!id || body.password !== 'Test-password-123') { await route.fulfill({ status: 400, headers: cors, json: { code: 'invalid_credentials', msg: 'Invalid login credentials' } }); return; }
      await route.fulfill({ headers: cors, json: session(id) }); return;
    }
    if (url.pathname === '/auth/v1/logout') { await route.fulfill({ headers: cors, json: {} }); return; }
    if (url.pathname === '/rest/v1/rpc/smd_request') {
      const body = request.postDataJSON();
      const token = request.headers().authorization?.slice(7).split('.')[1];
      const claims = token ? JSON.parse(Buffer.from(token, 'base64url').toString()) : {};
      const work = queue.then(async () => {
        try { await route.fulfill({ headers: cors, json: await rpc(claims.sub, body.p_method, body.p_path, body.p_body, body.p_params) }); }
        catch (error) {
          await route.fulfill({ status: 400, headers: cors, json: { code: 'P0001', message: error instanceof Error ? error.message : 'unknown' } });
        }
      });
      queue = work.catch(() => {}); await work; return;
    }
    await route.fulfill({ status: 404, headers: cors, json: {} });
  });
  return oldApi;
}
async function login(page: Page, name = 'admin') {
  await page.goto('/login');
  await page.getByLabel('اسم الدخول').fill(name);
  await page.getByLabel('كلمة المرور').fill('Test-password-123');
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await expect(page.getByRole('heading', { name: name === 'admin' ? 'لوحة التحكم' : 'المنتسبون', exact: true })).toBeVisible();
}

test('Supabase login, session restoration and Arabic RTL navigation use no original API', async ({ page }) => {
  const oldApi = await connect(page); await page.setViewportSize({ width: 1440, height: 1000 }); await login(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar'); await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByText('الخدمة متاحة', { exact: true })).toBeVisible();
  expect((await page.locator('#navigation-drawer').boundingBox())?.x).toBeGreaterThan(1100);
  await page.reload(); await expect(page.getByRole('heading', { name: 'لوحة التحكم', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: 'فتح القائمة' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'المنتسبون', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'المنتسبون', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(oldApi).toEqual([]);
});
test('create a member from the unchanged form and read server-calculated contributions', async ({ page }) => {
  await connect(page); await login(page); await page.goto('/members');
  await page.getByRole('button', { name: 'إضافة منتسب', exact: true }).click();
  await page.getByLabel('الاسم الكامل').fill('منتسب عبر Supabase');
  await page.getByLabel('رقم الهاتف').fill('22212345');
  await page.getByLabel('رقم العضوية').fill('SUPA-UI-1');
  await page.getByLabel('تاريخ الانضمام').fill(today.slice(0, 7) + '-01');
  await page.getByRole('button', { name: 'حفظ المنتسب', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'منتسب عبر Supabase', exact: true })).toBeVisible();
  await expect(page.getByText('1.000,00 MRU', { exact: true }).first()).toBeVisible();
});
test('treasurer lands on members and is refused the administrative reports', async ({ page }) => {
  await connect(page); await login(page, 'cashier');
  await expect(page.getByRole('button', { name: 'إضافة منتسب', exact: true })).toHaveCount(0);
  await page.goto('/reports'); await expect(page.getByRole('heading', { name: 'الوصول غير مسموح', exact: true })).toBeVisible();
});
test('sign-out clears the administrator session before another account signs in', async ({ page }) => {
  await connect(page); await login(page);
  await page.getByRole('button', { name: 'تسجيل الخروج', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('smd-supabase-auth'))).toBeNull();
  await login(page, 'cashier');
  await expect(page.getByRole('link', { name: 'المستخدمون', exact: true })).toHaveCount(0);
});
test('receipt HTML escapes user content and produces a local PDF with Arabic font', async ({ page }, info) => {
  const oldApi = await connect(page);
  const created = await rpc(adminId, 'POST', '/members', { fullName: 'اسم <script>danger</script>', phone: '22212345', membershipNumber: 'SUPA-PDF', joinedOn: today, status: 'active', notes: null });
  const member = created.member as { id: string };
  const paid = await rpc(adminId, 'POST', '/payments', { memberId: member.id, amount: '500.00', paidOn: today, category: 'monthly', method: 'cash', notes: null, allocationMode: 'oldest_due', idempotencyKey: randomUUID() });
  const payment = paid.payment as { id: string };
  await login(page); await page.goto(`/payments/${payment.id}/receipt`);
  await expect(page.getByRole('heading', { name: 'وصل الدفع', exact: true })).toBeVisible();
  const frame = page.frameLocator('iframe'); await expect(frame.locator('body')).toContainText('اسم <script>danger</script>');
  await expect(frame.locator('script')).toHaveCount(0);
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'حفظ PDF', exact: true }).click();
  const file = await download; const path = await file.path(); expect(path).toBeTruthy();
  const bytes = await readFile(path!); expect(bytes.subarray(0, 5).toString()).toBe('%PDF-'); expect(bytes.length).toBeGreaterThan(5000);
  await file.saveAs(info.outputPath('receipt.pdf'));
  await page.screenshot({ path: info.outputPath('receipt.png'), fullPage: true });
  const viewer = await page.context().newPage();
  await viewer.route('**/__pdf-preview', (route) => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0"><canvas></canvas></body></html>' }));
  await viewer.goto(new URL('/__pdf-preview', page.url()).href);
  const pages = await viewer.evaluate(async (encoded) => {
    const moduleUrl = '/node_modules/pdfjs-dist/build/pdf.mjs';
    const pdf = await import(/* @vite-ignore */ moduleUrl);
    pdf.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.mjs';
    const result = await pdf.getDocument({ data: Uint8Array.from(atob(encoded), (value) => value.charCodeAt(0)) }).promise;
    const first = await result.getPage(1), viewport = first.getViewport({ scale: 1.2 });
    const canvas = document.querySelector('canvas')!; canvas.width = viewport.width; canvas.height = viewport.height;
    await first.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise;
    return result.numPages;
  }, bytes.toString('base64'));
  expect(pages).toBe(1);
  await viewer.screenshot({ path: info.outputPath('actual-receipt-pdf.png'), fullPage: true }); await viewer.close();
  expect(oldApi).toEqual([]);
});
test('bad credentials display an Arabic error without exposing Supabase diagnostics', async ({ page }) => {
  await connect(page); await page.goto('/login');
  await page.getByLabel('اسم الدخول').fill('missing'); await page.getByLabel('كلمة المرور').fill('wrong-password');
  await page.getByRole('button', { name: 'دخول', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('اسم الدخول أو كلمة المرور غير صحيحة');
});
