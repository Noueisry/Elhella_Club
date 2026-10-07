-- Independent PostgreSQL schema for frontend-supabase. No MySQL data is imported.
create schema smd;
revoke all on schema smd from public, anon, authenticated;

create table smd.profiles (
  id uuid primary key references auth.users(id), login text not null unique,
  "fullName" text not null check (length(trim("fullName")) between 2 and 200),
  role text not null check (role in ('admin','treasurer')), "isActive" boolean not null default true,
  "createdAt" timestamptz not null default now(), "updatedAt" timestamptz not null default now(),
  revoked_before timestamptz
);
create table smd.settings (
  id integer primary key default 1 check (id=1), "clubName" text not null,
  "businessTimezone" text not null default 'Africa/Nouakchott', currency text not null default 'MRU' check (currency='MRU'),
  "receiptOptions" jsonb, "updatedAt" timestamptz not null default now(), "updatedByUserId" uuid references smd.profiles
);
insert into smd.settings("clubName") values ('نادي الرماية التقليدية');
create table smd.rates (
  id uuid primary key default gen_random_uuid(), amount numeric(14,2) not null check(amount>0),
  "effectiveOn" date not null unique check (extract(day from "effectiveOn")=1), "createdAt" timestamptz not null default now()
);
insert into smd.rates(amount,"effectiveOn") values (1000,'1900-01-01');
create table smd.members (
  id uuid primary key default gen_random_uuid(), "fullName" text not null check(length(trim("fullName")) between 2 and 200),
  phone text not null check(length(trim(phone)) between 1 and 32), "membershipNumber" text not null unique check(length(trim("membershipNumber")) between 1 and 50),
  "joinedOn" date not null, status text not null check(status in ('active','inactive')), notes text,
  "archivedAt" timestamptz, "createdAt" timestamptz not null default now(), "updatedAt" timestamptz not null default now()
);
create table smd.activity (
  id uuid primary key default gen_random_uuid(), "memberId" uuid not null references smd.members,
  "startsOn" date not null, "endsOn" date, check("endsOn" is null or "endsOn">"startsOn")
);
create unique index activity_open on smd.activity("memberId") where "endsOn" is null;
create table smd.events (
  id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 2 and 200),
  type text not null check(length(trim(type)) between 1 and 100), "eventOn" date not null,
  "contributionAmount" numeric(14,2) not null check("contributionAmount">0), notes text
);
create table smd.obligations (
  id uuid primary key default gen_random_uuid(), "memberId" uuid not null references smd.members,
  "targetType" text not null check("targetType" in ('monthly','event')), "dueOn" date not null,
  label text not null, year integer, month integer, "eventId" uuid references smd.events,
  amount numeric(14,2) not null check(amount>0), "createdAt" timestamptz not null default now(),
  check (("targetType"='monthly' and year is not null and month between 1 and 12 and "eventId" is null)
    or ("targetType"='event' and "eventId" is not null and year is null and month is null)),
  unique("memberId",year,month), unique("memberId","eventId")
);
create table smd.payments (
  id uuid primary key default gen_random_uuid(), "memberId" uuid not null references smd.members,
  amount numeric(14,2) not null check(amount>0), "paidOn" date not null,
  "receiptNumber" text not null unique, category text not null check(category in ('monthly','event','arrears','other')),
  method text not null check(method in ('cash','transfer','other')), status text not null check(status in ('posted','cancelled')),
  notes text, "createdByUserId" uuid not null references smd.profiles, "createdAt" timestamptz not null default now(),
  "cancelledAt" timestamptz, "cancelledByUserId" uuid references smd.profiles, "cancellationReason" text,
  "replacesPaymentId" uuid unique references smd.payments, idempotency_key uuid not null unique, request jsonb not null, snapshot jsonb not null
);
create table smd.allocations (
  id uuid primary key default gen_random_uuid(), "paymentId" uuid not null references smd.payments,
  "memberId" uuid not null references smd.members, "contributionId" uuid not null references smd.obligations,
  amount numeric(14,2) not null check(amount>0), "createdAt" timestamptz not null default now(), unique("paymentId","contributionId")
);
create table smd.audit (
  id bigint generated always as identity primary key, "actorId" uuid references smd.profiles,
  action text not null, "entityId" uuid, detail jsonb, "createdAt" timestamptz not null default now()
);
create index obligation_member_due on smd.obligations("memberId","dueOn");
create index allocation_target on smd.allocations("contributionId");
create index payment_member_date on smd.payments("memberId","paidOn");

-- Tables are private, RLS enabled, with no direct browser privileges or policies.
do $$ declare t text; begin
  foreach t in array array['profiles','settings','rates','members','activity','events','obligations','payments','allocations','audit'] loop
    execute format('alter table smd.%I enable row level security',t);
    execute format('revoke all on smd.%I from public, anon, authenticated',t);
  end loop;
end $$;

create function smd.fail(status integer, code text, message text) returns void
language plpgsql set search_path='' as $$ begin
  raise exception using errcode='P0001', message=jsonb_build_object('status',status,'code',code,'message',message)::text;
end $$;
create function smd.cash(value numeric) returns text language sql immutable set search_path='' as $$ select round(coalesce(value,0),2)::text $$;
create function smd.money(value text) returns numeric language plpgsql immutable set search_path='' as $$ begin
  if value is null or value !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$' or value::numeric<=0 then
    perform smd.fail(400,'INVALID_AMOUNT','المبلغ يجب أن يكون موجباً وبدقة منزلتين عشريتين.');
  end if;
  return value::numeric(14,2);
end $$;
create function smd.today() returns date language sql stable set search_path='' as $$
  select (now() at time zone "businessTimezone")::date from smd.settings where id=1
$$;
create function smd.user_json(p smd.profiles) returns jsonb language sql stable set search_path='' as $$
  select to_jsonb(p)-'revoked_before'
$$;
create function smd.active_session(actor uuid, session_id uuid, cutoff timestamptz) returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from auth.sessions s where s.id=session_id and s.user_id=actor and s.created_at>coalesce(cutoff,'-infinity'))
$$;
create function smd.permissions(role text) returns jsonb language sql immutable set search_path='' as $$
  select case when role='admin' then '["profile","dashboard.read","members.read","members.manage","events.manage","contributions.manage","payments.read","payments.create","payments.correct","receipts.read","arrears.read","reports.read","users.manage","settings.manage"]'::jsonb
  else '["profile","members.read","payments.read","payments.create","receipts.read","arrears.read"]'::jsonb end
$$;
create function smd.page(items jsonb, page integer, lim integer) returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object('items',coalesce((select jsonb_agg(value order by ord) from jsonb_array_elements(coalesce(items,'[]')) with ordinality as r(value,ord)
    where ord>(page-1)*lim and ord<=page*lim),'[]'::jsonb),'total',jsonb_array_length(coalesce(items,'[]')),'page',page,'limit',lim)
$$;
create function smd.log(actor uuid, action text, entity uuid, detail jsonb default '{}') returns void language sql set search_path='' as $$
  insert into smd.audit("actorId",action,"entityId",detail) values(actor,action,entity,detail)
$$;

-- Generation is server side, idempotent, and serialized per member with payments.
create function smd.generate(member_id uuid default null) returns integer language plpgsql set search_path='' as $$
declare m smd.members; d date; start_day date; rate numeric; added integer; total integer:=0;
begin
  for m in select * from smd.members where member_id is null or id=member_id order by id for update loop
    for d in select generate_series(date_trunc('month',m."joinedOn")::date,date_trunc('month',smd.today())::date,'1 month')::date loop
      select min(greatest(a."startsOn",d,m."joinedOn")) into start_day from smd.activity a
        where a."memberId"=m.id and a."startsOn"<(d+interval '1 month')::date
          and (a."endsOn" is null or a."endsOn">d) and greatest(a."startsOn",d,m."joinedOn")<=smd.today();
      if start_day is not null then
        select amount into rate from smd.rates where "effectiveOn"<=d order by "effectiveOn" desc limit 1;
        insert into smd.obligations("memberId","targetType","dueOn",label,year,month,amount)
          values(m.id,'monthly',start_day,'اشتراك شهري',extract(year from d),extract(month from d),rate)
          on conflict("memberId",year,month) do nothing;
        get diagnostics added=row_count; total:=total+added;
      end if;
    end loop;
  end loop;
  return total;
end $$;

create function smd.finance(as_of date, cutoff timestamptz default 'infinity') returns table (
  id uuid, "memberId" uuid, "targetType" text, "dueOn" date, label text, year integer, month integer, "eventId" uuid,
  amount numeric, "paidAmount" numeric, "remainingAmount" numeric
) language sql stable set search_path='' as $$
  select o.id,o."memberId",o."targetType",o."dueOn",o.label,o.year,o.month,o."eventId",o.amount,
    coalesce(sum(a.amount) filter(where p.id is not null),0)::numeric as paid,
    o.amount-coalesce(sum(a.amount) filter(where p.id is not null),0)::numeric as remaining
  from smd.obligations o left join smd.allocations a on a."contributionId"=o.id and a."createdAt"<cutoff
    left join smd.payments p on p.id=a."paymentId" and p."createdAt"<cutoff
      and (cutoff='infinity' or p."paidOn"<=as_of)
      and (p.status='posted' or (p."cancelledAt">=cutoff))
  where o."createdAt"<cutoff group by o.id
$$;
create function smd.obligation_json(row_data jsonb, as_of date) returns jsonb language sql immutable set search_path='' as $$
  select row_data||jsonb_build_object('amount',smd.cash((row_data->>'amount')::numeric),
    'paidAmount',smd.cash((row_data->>'paidAmount')::numeric),'remainingAmount',smd.cash((row_data->>'remainingAmount')::numeric),
    'paymentStatus',case when (row_data->>'remainingAmount')::numeric=0 then 'paid' when (row_data->>'paidAmount')::numeric>0 then 'partial' else 'unpaid' end,
    'paymentStatusLabel',case when (row_data->>'remainingAmount')::numeric=0 then 'مدفوع' when (row_data->>'paidAmount')::numeric>0 then 'مدفوع جزئياً' else 'غير مدفوع' end,
    'isDue',(row_data->>'dueOn')::date<=as_of,'isOverdue',(row_data->>'dueOn')::date<=as_of and (row_data->>'remainingAmount')::numeric>0,
    'dueStatusLabel',case when (row_data->>'dueOn')::date>as_of then 'مستقبلي' when (row_data->>'remainingAmount')::numeric>0 then 'متأخر' else 'مستحق' end)
$$;
create function smd.stats(rows jsonb) returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object('due',smd.cash(sum((r->>'amount')::numeric)), 'paid',smd.cash(sum((r->>'paidAmount')::numeric)),
    'remaining',smd.cash(sum((r->>'remainingAmount')::numeric)),
    'monthlyDue',smd.cash(sum((r->>'amount')::numeric) filter(where r->>'targetType'='monthly')),
    'eventsDue',smd.cash(sum((r->>'amount')::numeric) filter(where r->>'targetType'='event')),
    'monthlyRemaining',smd.cash(sum((r->>'remainingAmount')::numeric) filter(where r->>'targetType'='monthly')),
    'eventRemaining',smd.cash(sum((r->>'remainingAmount')::numeric) filter(where r->>'targetType'='event')),
    'count',count(*),'paidCount',count(*) filter(where (r->>'remainingAmount')::numeric=0),
    'partialCount',count(*) filter(where (r->>'paidAmount')::numeric>0 and (r->>'remainingAmount')::numeric>0),
    'unpaidCount',count(*) filter(where (r->>'paidAmount')::numeric=0)) from jsonb_array_elements(coalesce(rows,'[]')) r
$$;
create function smd.payment_json(p smd.payments) returns jsonb language sql stable set search_path='' as $$
  select (to_jsonb(p)-array['request','snapshot','idempotency_key'])||jsonb_build_object('amount',smd.cash(p.amount),
    'member',(select jsonb_build_object('id',id,'fullName',"fullName",'membershipNumber',"membershipNumber") from smd.members where id=p."memberId"),
    'createdBy',(select jsonb_build_object('id',id,'fullName',"fullName") from smd.profiles where id=p."createdByUserId"))
$$;
create function smd.payment_detail(payment_id uuid) returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('payment',smd.payment_json(p),'replacementPaymentId',(select id from smd.payments where "replacesPaymentId"=p.id),
    'allocations',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'memberId',a."memberId",'paymentId',a."paymentId",'amount',smd.cash(a.amount),
      'monthlyContributionId',case when o."targetType"='monthly' then o.id end,'eventContributionId',case when o."targetType"='event' then o.id end))
      from smd.allocations a join smd.obligations o on o.id=a."contributionId" where a."paymentId"=p.id),'[]'))
  from smd.payments p where p.id=payment_id
$$;

create function smd.payment_plan(input jsonb, replacement uuid default null) returns jsonb language plpgsql set search_path='' as $$
declare m smd.members; o record; a jsonb; allocations jsonb:='[]'; amount numeric:=smd.money(input->>'amount');
  available numeric; take numeric; left_amount numeric:=amount; allocated numeric:=0; total_before numeric; released numeric;
  paid_on date:=(input->>'paidOn')::date; category text:=input->>'category'; mode text:=input->>'allocationMode'; original smd.payments;
begin
  select * into m from smd.members where id=(input->>'memberId')::uuid for update;
  if m.id is null then perform smd.fail(404,'MEMBER_NOT_FOUND','المنتسب غير موجود.'); end if;
  if paid_on is null or paid_on<m."joinedOn" or paid_on>smd.today() then perform smd.fail(400,'PAYMENT_DATE_INVALID','تاريخ الدفع يجب أن يكون بين الانتساب واليوم.'); end if;
  if category is null or category not in ('monthly','event','arrears','other') or input->>'method' is null or input->>'method' not in ('cash','transfer','other') or mode is null or mode not in ('explicit','oldest_due') then
    perform smd.fail(400,'INVALID_PAYMENT','بيانات الدفعة غير صحيحة.'); end if;
  if replacement is not null then
    select * into original from smd.payments where id=replacement for update;
    if original.id is null or original.status<>'posted' or original."memberId"<>m.id then perform smd.fail(409,'INVALID_REPLACEMENT','الدفعة الأصلية غير قابلة للاستبدال.'); end if;
    if length(trim(coalesce(input->>'reason','')))<1 then perform smd.fail(400,'REASON_REQUIRED','سبب التصحيح مطلوب.'); end if;
  end if;
  if category='other' and (mode<>'explicit' or length(trim(coalesce(input->>'notes','')))=0) then
    perform smd.fail(400,'OTHER_EXPLICIT_REQUIRED','نوع أخرى يحتاج إلى ملاحظات وتوزيع صريح.'); end if;
  select coalesce(sum("remainingAmount"),0) into total_before from smd.finance(smd.today()) where "memberId"=m.id;
  total_before:=total_before+coalesce(original.amount,0);
  if mode='oldest_due' then
    if input ? 'allocations' then perform smd.fail(400,'ALLOCATION_MODE_CONFLICT','لا تجمع بين التوزيع الآلي والتحديد الصريح.'); end if;
    for o in select f.*,coalesce((select sum(x.amount) from smd.allocations x where x."paymentId"=replacement and x."contributionId"=f.id),0) as released
      from smd.finance(smd.today()) f where f."memberId"=m.id and f."dueOn"<=paid_on
      and (category='arrears' or f."targetType"=category) order by f."dueOn",f."targetType",f.id limit 500 loop
      available:=o."remainingAmount"+o.released; take:=least(available,left_amount);
      if take>0 then
        allocations:=allocations||jsonb_build_array(jsonb_build_object('targetType',o."targetType",'contributionId',o.id,'amount',smd.cash(take),
          'label',o.label,'dueOn',o."dueOn",'year',o.year,'month',o.month,'remainingBefore',smd.cash(available),'remainingAfter',smd.cash(available-take)));
        left_amount:=left_amount-take;
      end if;
      exit when left_amount=0;
    end loop;
    if left_amount>0 then perform smd.fail(400,'OVERPAYMENT','المبلغ يتجاوز الديون القابلة للتسديد.'); end if;
  else
    if jsonb_typeof(input->'allocations') is distinct from 'array' or jsonb_array_length(input->'allocations') not between 1 and 500 then
      perform smd.fail(400,'ALLOCATIONS_REQUIRED','اختر من 1 إلى 500 مساهمة.'); end if;
    if (select count(distinct (x->>'contributionId')::uuid) from jsonb_array_elements(input->'allocations') x)<>jsonb_array_length(input->'allocations') then
      perform smd.fail(400,'DUPLICATE_ALLOCATION','المساهمة مكررة.'); end if;
    for a in select value from jsonb_array_elements(input->'allocations') order by value->>'contributionId' loop
      select * into o from smd.finance(smd.today()) where id=(a->>'contributionId')::uuid;
      if o.id is null or o."memberId"<>m.id or o."targetType" is distinct from a->>'targetType' then perform smd.fail(400,'CONTRIBUTION_MEMBER_MISMATCH','المساهمة لا تخص المنتسب.'); end if;
      if (category in ('monthly','event') and category<>o."targetType") or (category='arrears' and o."dueOn">paid_on) then
        perform smd.fail(400,'PAYMENT_CATEGORY_MISMATCH','نوع الدفعة لا يطابق المساهمات المختارة.'); end if;
      select coalesce(sum(amount),0) into released from smd.allocations where "paymentId"=replacement and "contributionId"=o.id;
      available:=o."remainingAmount"+released; take:=smd.money(a->>'amount');
      if take>available then perform smd.fail(409,'OVERPAYMENT','المبلغ يتجاوز الرصيد المتبقي للمساهمة.'); end if;
      allocated:=allocated+take;
      allocations:=allocations||jsonb_build_array(jsonb_build_object('targetType',o."targetType",'contributionId',o.id,'amount',smd.cash(take),
        'label',o.label,'dueOn',o."dueOn",'year',o.year,'month',o.month,'remainingBefore',smd.cash(available),'remainingAfter',smd.cash(available-take)));
    end loop;
    if allocated<>amount then perform smd.fail(400,'ALLOCATION_TOTAL_MISMATCH','مجموع التوزيع يجب أن يساوي مبلغ الدفعة.'); end if;
  end if;
  return jsonb_build_object('amount',smd.cash(amount),'paidOn',paid_on,'currency','MRU','indicative',true,
    'remainingBefore',smd.cash(total_before),'remainingAfter',smd.cash(total_before-amount),'allocations',allocations);
end $$;

create function smd.post_payment(actor uuid, input jsonb, replacement uuid default null) returns jsonb language plpgsql set search_path='' as $$
declare plan jsonb; p smd.payments; a jsonb; id uuid:=gen_random_uuid(); m smd.members; club smd.settings; request jsonb;
begin
  if input->>'idempotencyKey' is null then perform smd.fail(400,'IDEMPOTENCY_REQUIRED','مفتاح العملية مطلوب.'); end if;
  perform pg_advisory_xact_lock(hashtextextended(lower(input->>'idempotencyKey'),0));
  request:=input||jsonb_build_object('replacement',replacement);
  select * into p from smd.payments where idempotency_key=(input->>'idempotencyKey')::uuid;
  if p.id is not null then
    if p.request<>request or p."createdByUserId"<>actor then perform smd.fail(409,'IDEMPOTENCY_CONFLICT','مفتاح العملية مستخدم لطلب مختلف.'); end if;
    return smd.payment_detail(p.id)||jsonb_build_object('replayed',true);
  end if;
  plan:=smd.payment_plan(input,replacement);
  select * into m from smd.members where smd.members.id=(input->>'memberId')::uuid;
  select * into club from smd.settings where smd.settings.id=1;
  if replacement is not null then
    update smd.payments set status='cancelled',"cancelledAt"=now(),"cancelledByUserId"=actor,"cancellationReason"=input->>'reason' where smd.payments.id=replacement;
    perform smd.log(actor,'payment.cancelled',replacement,jsonb_build_object('reason',input->>'reason'));
  end if;
  insert into smd.payments(id,"memberId",amount,"paidOn","receiptNumber",category,method,status,notes,"createdByUserId","replacesPaymentId",idempotency_key,request,snapshot)
    values(id,m.id,(plan->>'amount')::numeric,(input->>'paidOn')::date,'SMD-'||extract(year from (input->>'paidOn')::date)||'-'||upper(replace(id::text,'-','')),
      input->>'category',input->>'method','posted',nullif(trim(input->>'notes'),''),actor,replacement,(input->>'idempotencyKey')::uuid,request,
      jsonb_build_object('clubName',club."clubName",'memberName',m."fullName",'memberNumber',m."membershipNumber",'amount',plan->>'amount','currency','MRU',
        'category',input->>'category','method',input->>'method','paymentDate',input->>'paidOn','remainingBalance',plan->>'remainingAfter',
        'options',club."receiptOptions",'allocations',plan->'allocations'));
  for a in select value from jsonb_array_elements(plan->'allocations') loop
    insert into smd.allocations("paymentId","memberId","contributionId",amount) values(id,m.id,(a->>'contributionId')::uuid,(a->>'amount')::numeric);
  end loop;
  perform smd.log(actor,'payment.posted',id,jsonb_build_object('amount',plan->>'amount'));
  return smd.payment_detail(id)||jsonb_build_object('replayed',false);
end $$;
