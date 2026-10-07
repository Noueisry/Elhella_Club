import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';

const db = new PGlite();
const admin = randomUUID(), treasurer = randomUUID();
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key, email text);
    create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default clock_timestamp());
    create function auth.jwt() returns jsonb language sql as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql as $$ select (auth.jwt()->>'sub')::uuid $$;
    grant usage on schema auth to anon,authenticated; grant execute on all functions in schema auth to anon,authenticated;`);
  const directory = new URL('../../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, directory), 'utf8'));
  await db.query(`insert into auth.users values($1,'admin@club.invalid'),($2,'cashier@club.invalid')`, [admin,treasurer]);
  await db.query(`insert into auth.sessions(id,user_id) values($1,$1),($2,$2)`, [admin,treasurer]);
  await db.query(`insert into smd.profiles(id,login,"fullName",role) values($1,'admin','المدير','admin'),($2,'cashier','أمين الصندوق','treasurer')`, [admin,treasurer]);
});
after(() => db.close());

async function request(method, path, body = {}, params = {}, user = admin) {
  await db.exec(`set role authenticated`);
  try {
    await db.query(`select set_config('request.jwt.claims',$1,false)`, [JSON.stringify({ sub: user, session_id:user, iat: Math.floor(Date.now()/1000), role: 'authenticated' })]);
    const response = await db.query(`select public.smd_request($1,$2,$3::jsonb,$4::jsonb) as result`,[method,path,JSON.stringify(params),JSON.stringify(body)]);
    return response.rows[0].result;
  } finally { await db.exec('reset role'); }
}
async function member(status = 'active', joinedOn = new Date().toISOString().slice(0,7)+'-01') {
  return (await request('POST','/members',{ fullName:'منتسب الاختبار',phone:'22212345',membershipNumber:randomUUID(),joinedOn,status,notes:null })).member;
}
const statement = (id) => request('GET',`/members/${id}/statement`);
function payment(m, amount = '500.00') {
  return { memberId:m.id,amount,paidOn:new Date().toISOString().slice(0,10),category:'monthly',method:'cash',allocationMode:'oldest_due',notes:null,idempotencyKey:randomUUID() };
}
const rejectsCode = (operation,code) => assert.rejects(operation,(error) => JSON.parse(error.message).code===code);

test('migration and session expose the same frontend contract',async () => {
  const profile = await request('GET','/auth/me');
  assert.equal(profile.role,'admin'); assert.ok(profile.permissions.includes('users.manage')); assert.equal(profile.revoked_before,undefined);
  const club = await request('GET','/club'); assert.equal(club.businessTimezone,'Africa/Nouakchott');
});
test('anonymous callers have only health access and no helper or table privileges',async () => {
  await db.exec('set role anon');
  try {
    await db.query(`select set_config('request.jwt.claims','{}',false)`);
    const health = await db.query(`select public.smd_request('GET','/health/ready') as result`); assert.equal(health.rows[0].result.database,'available');
    await rejectsCode(db.query(`select public.smd_request('GET','/members')`),'UNAUTHENTICATED');
    await assert.rejects(db.query(`select * from smd.members`),/permission denied/);
    await assert.rejects(db.query(`select smd.generate()`),/permission denied/);
    await assert.rejects(db.query(`select public.smd_manage_user($1,$1,'{}','authorize',$1)`,[admin]),/permission denied/);
  } finally { await db.exec('reset role'); }
});
test('treasurer permissions are enforced by SQL on direct RPC calls',async () => {
  await rejectsCode(request('POST','/members',{}, {},treasurer),'FORBIDDEN');
  await rejectsCode(request('GET','/dashboard',{}, {},treasurer),'FORBIDDEN');
  await rejectsCode(request('GET','/reports/monthly',{}, {},treasurer),'FORBIDDEN');
  await rejectsCode(request('GET','/users',{}, {},treasurer),'FORBIDDEN');
  await rejectsCode(request('GET','/events',{}, {},treasurer),'FORBIDDEN');
  const profile = await request('GET','/auth/me',{}, {},treasurer); assert.ok(profile.permissions.includes('payments.create'));
});
test('monthly billing is exact and idempotent',async () => {
  const m = await member(); const before = await statement(m.id); assert.equal(before.totals.totalDue,'1000.00');
  await request('POST','/contributions/monthly/generate'); const after = await statement(m.id);
  assert.equal(after.contributions.total,1); assert.equal(after.totals.totalDue,'1000.00');
});
test('inactive members are billed only from reactivation',async () => {
  const m = await member('inactive'); assert.equal((await statement(m.id)).totals.totalDue,'0.00');
  await request('PATCH',`/members/${m.id}/activity`,{status:'active'}); assert.equal((await statement(m.id)).totals.totalDue,'1000.00');
  await request('PATCH',`/members/${m.id}/activity`,{status:'inactive'});
  await request('PATCH',`/members/${m.id}/activity`,{status:'active'}); assert.equal((await statement(m.id)).contributions.total,1);
});
test('payments preview without writing, persist atomically and replay safely',async () => {
  const m = await member(); const input = payment(m,'500.25');
  const preview = await request('POST','/payments/preview',input,{},treasurer); assert.equal(preview.remainingAfter,'499.75');
  assert.equal((await statement(m.id)).totals.totalPaid,'0.00');
  const paid = await request('POST','/payments',input,{},treasurer); assert.equal(paid.payment.amount,'500.25');
  const replay = await request('POST','/payments',input,{},treasurer); assert.equal(replay.payment.id,paid.payment.id); assert.equal(replay.replayed,true);
  await rejectsCode(request('POST','/payments',{...input,amount:'600.00'}, {},treasurer),'IDEMPOTENCY_CONFLICT');
  assert.equal((await statement(m.id)).totals.remaining,'499.75');
  const receipt = await request('GET',`/payments/${paid.payment.id}/receipt`); assert.equal(receipt.snapshot.remainingBalance,'499.75');
});
test('overpayments and duplicate allocations leave balances unchanged',async () => {
  const m = await member(); const input = payment(m,'1000.01');
  await rejectsCode(request('POST','/payments',input),'OVERPAYMENT'); assert.equal((await statement(m.id)).totals.totalPaid,'0.00');
  const contribution = (await statement(m.id)).contributions.items[0];
  const allocation = { targetType:'monthly',contributionId:contribution.id,amount:'250.00' };
  await rejectsCode(request('POST','/payments',{...payment(m),allocationMode:'explicit',allocations:[allocation,allocation]}),'DUPLICATE_ALLOCATION');
});
test('future events stay outside arrears and financial dates are preserved',async () => {
  const m = await member('inactive'); const future = new Date(Date.now()+86400000*10).toISOString().slice(0,10);
  const event = (await request('POST','/events',{name:'دورة الاختبار',type:'تدريب',eventOn:future,contributionAmount:'250.50',notes:null,memberIds:[m.id]})).event;
  assert.equal(typeof event.contributionAmount,'string');
  const s = await statement(m.id); assert.equal(s.totals.remaining,'250.50'); assert.equal(s.totals.arrears,'0.00');
  const detail = await request('GET',`/events/${event.id}`); assert.equal(detail.summary.participantCount,1);
  await rejectsCode(request('DELETE',`/events/${event.id}`),'EVENT_HAS_HISTORY');
  const repeated = await request('POST',`/events/${event.id}/participants`,{memberIds:[m.id]}); assert.equal(repeated.contributionsCreated,0);
});
test('replacement failure preserves the original; correction updates current balances',async () => {
  const m = await member(); const original = await request('POST','/payments',payment(m));
  await rejectsCode(request('POST',`/payments/${original.payment.id}/replace`,{...payment(m,'1001.00'),reason:'تصحيح'}),'OVERPAYMENT');
  assert.equal((await request('GET',`/payments/${original.payment.id}`)).payment.status,'posted');
  const replaced = await request('POST',`/payments/${original.payment.id}/replace`,{...payment(m,'600.00'),reason:'تصحيح'});
  assert.equal(replaced.payment.replacesPaymentId,original.payment.id); assert.equal((await statement(m.id)).totals.totalPaid,'600.00');
  await request('POST',`/payments/${replaced.payment.id}/cancel`,{reason:'إلغاء'}); assert.equal((await statement(m.id)).totals.totalPaid,'0.00');
  const oldReceipt = await request('GET',`/payments/${original.payment.id}/receipt`); assert.equal(oldReceipt.isValid,false); assert.equal(oldReceipt.snapshot.remainingBalance,'500.00');
});
test('reports preserve their cutoff across a later cancellation',async () => {
  const m = await member(); const original = await request('POST','/payments',payment(m));
  const before = await request('GET',`/members/${m.id}/historical-statement`); assert.equal(before.totals.stock.paid,'500.00');
  await request('POST',`/payments/${original.payment.id}/cancel`,{reason:'إلغاء'});
  const frozen = await request('GET',`/members/${m.id}/historical-statement`,{}, {recordedBefore:before.meta.recordedBefore});
  assert.equal(frozen.totals.stock.paid,'500.00');
  const after = await request('GET',`/members/${m.id}/historical-statement`); assert.equal(after.totals.stock.paid,'0.00');
  assert.equal(after.payments.items[0].status,'cancelled');
});
test('members with financial history are archived and cannot reactivate',async () => {
  const m = await member(); const removed = await request('DELETE',`/members/${m.id}`); assert.equal(removed.action,'archived');
  await rejectsCode(request('PATCH',`/members/${m.id}/activity`,{status:'active'}),'MEMBER_ARCHIVED');
  const empty = await member('inactive'); const deleted = await request('DELETE',`/members/${empty.id}`); assert.equal(deleted.action,'deleted');
});
test('settings and all report kinds match the screen contract',async () => {
  const settings = await request('GET','/settings'); assert.equal(settings.currentMonthlyRate.amount,'1000.00');
  for (const kind of ['daily','monthly','annual','events','arrears']) {
    const report = await request('GET',`/reports/${kind}`); assert.equal(report.meta.kind,kind); assert.ok(report.contributions.items); assert.ok(report.payments.items);
  }
  const arrears = await request('GET','/arrears'); assert.equal(typeof arrears.totals.totalArrears,'string');
  const dashboard = await request('GET','/dashboard'); assert.equal(typeof dashboard.monthlyCollections,'string');
  const users = await request('GET','/users'); assert.equal(users.users.length,2);
});
test('last admin protection, account disable and JWT revocation apply server side',async () => {
  await rejectsCode(request('PATCH',`/users/${admin}`,{isActive:false}),'LAST_ADMIN');
  await request('PATCH',`/users/${treasurer}`,{isActive:false});
  await rejectsCode(request('GET','/members',{}, {},treasurer),'UNAUTHENTICATED');
  await request('POST','/auth/revoke-sessions');
  await rejectsCode(request('GET','/members'),'UNAUTHENTICATED');
  await db.exec('set role authenticated');
  try {
    await db.query(`select set_config('request.jwt.claims',$1,false)`,[JSON.stringify({sub:admin,session_id:admin,iat:Math.floor(Date.now()/1000)+3600})]);
    await rejectsCode(db.query(`select public.smd_request('GET','/members')`),'UNAUTHENTICATED');
  } finally { await db.exec('reset role'); }
});
