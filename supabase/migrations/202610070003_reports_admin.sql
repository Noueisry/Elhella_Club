create function smd.report(kind text, params jsonb) returns jsonb language plpgsql set search_path='' as $$
declare club smd.settings; today date:=smd.today(); date_from date; date_to date; as_of date; cutoff timestamptz; maximum timestamptz;
  page integer:=coalesce((params->>'page')::integer,1); lim integer:=coalesce((params->>'limit')::integer,20);
  payment_page integer:=coalesce((params->>'paymentPage')::integer,1); payment_lim integer:=coalesce((params->>'paymentLimit')::integer,20);
  member_id uuid:=(params->>'memberId')::uuid; event_id uuid:=(params->>'eventId')::uuid;
  m smd.members; e smd.events; rows jsonb; details jsonb; stock jsonb; future jsonb; due_period jsonb; arrears jsonb; payments jsonb;
  collections numeric; collection_count integer; title text;
begin
  if kind is null or kind not in ('daily','monthly','annual','events','arrears','statement') then perform smd.fail(400,'INVALID_REPORT','نوع التقرير غير صحيح.'); end if;
  if page<1 or payment_page<1 or lim not between 1 and 100 or payment_lim not between 1 and 100 then perform smd.fail(400,'INVALID_PAGINATION','إعدادات الصفحات غير صحيحة.'); end if;
  select * into club from smd.settings where id=1;
  date_from:=coalesce((params->>'from')::date,'1900-01-01'); date_to:=coalesce((params->>'to')::date,'9998-12-31');
  if kind='daily' then date_from:=coalesce((params->>'date')::date,(params->>'asOf')::date,today); date_to:=date_from;
  elsif kind='monthly' then
    if params->>'month' is not null and params->>'month' !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then perform smd.fail(400,'INVALID_MONTH','الشهر غير صحيح.'); end if;
    date_from:=coalesce((params->>'month'||'-01')::date,date_trunc('month',today)::date); date_to:=(date_from+interval '1 month'-interval '1 day')::date;
  elsif kind='annual' then date_from:=make_date(coalesce((params->>'year')::integer,extract(year from today)::integer),1,1); date_to:=(date_from+interval '1 year'-interval '1 day')::date;
  end if;
  as_of:=coalesce((params->>'asOf')::date,least(date_to,today));
  if date_from>date_to or date_from<'1900-01-01' or date_to>'9998-12-31' or as_of>today or as_of<'1900-01-01' then perform smd.fail(400,'REPORT_PERIOD_INVALID','الفترة أو تاريخ الوضعية غير صالح.'); end if;
  if kind in ('daily','monthly','annual') and ((params->>'from' is not null and (params->>'from')::date<>date_from) or (params->>'to' is not null and (params->>'to')::date<>date_to)) then perform smd.fail(400,'REPORT_PERIOD_INVALID','اختر الفترة المناسبة لنوع التقرير.'); end if;
  maximum:=least(clock_timestamp(),(as_of+1)::timestamp at time zone club."businessTimezone");
  cutoff:=coalesce((params->>'recordedBefore')::timestamptz,maximum);
  if cutoff>maximum or cutoff<'1900-01-01' then perform smd.fail(400,'REPORT_CUTOFF_INVALID','وقت إقفال البيانات غير صحيح.'); end if;
  if member_id is not null then select * into m from smd.members where id=member_id; if m.id is null then perform smd.fail(404,'MEMBER_NOT_FOUND','المنتسب غير موجود.'); end if; end if;
  if kind='statement' and member_id is null then perform smd.fail(400,'MEMBER_REQUIRED','اختر المنتسب.'); end if;
  if event_id is not null then select * into e from smd.events where id=event_id; if e.id is null then perform smd.fail(404,'EVENT_NOT_FOUND','الدورة غير موجودة.'); end if; end if;
  select coalesce(jsonb_agg(smd.obligation_json(to_jsonb(f),as_of)||jsonb_build_object('memberName',mem."fullName",'membershipNumber',mem."membershipNumber") order by f."dueOn",f."memberId",f.id),'[]') into rows
    from smd.finance(as_of,cutoff) f join smd.members mem on mem.id=f."memberId"
    where (member_id is null or f."memberId"=member_id) and (event_id is null or f."eventId"=event_id) and (kind<>'events' or f."targetType"='event');
  select smd.stats(coalesce(jsonb_agg(x),'[]')) into stock from jsonb_array_elements(rows) x where (x->>'dueOn')::date<=as_of;
  select smd.stats(coalesce(jsonb_agg(x),'[]')) into future from jsonb_array_elements(rows) x where (x->>'dueOn')::date>as_of;
  select smd.stats(coalesce(jsonb_agg(x),'[]')) into due_period from jsonb_array_elements(rows) x where (x->>'dueOn')::date between date_from and date_to and (x->>'dueOn')::date<=as_of;
  select coalesce(jsonb_agg(x),'[]') into details from jsonb_array_elements(rows) x where
    (kind='arrears' and (x->>'dueOn')::date<=as_of and (x->>'remainingAmount')::numeric>0)
    or (kind<>'arrears' and (x->>'dueOn')::date between date_from and date_to and (kind in ('events','statement') or (x->>'dueOn')::date<=as_of));
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'memberName',x.name,'membershipNumber',x.number,
    'monthlyArrears',smd.cash(x.monthly),'eventArrears',smd.cash(x.event),'totalArrears',smd.cash(x.total)) order by x.total desc,x.id),'[]') into arrears from (
    select r->>'memberId' as id,r->>'memberName' as name,r->>'membershipNumber' as number,
      sum((r->>'remainingAmount')::numeric) filter(where r->>'targetType'='monthly') as monthly,
      sum((r->>'remainingAmount')::numeric) filter(where r->>'targetType'='event') as event,sum((r->>'remainingAmount')::numeric) as total
    from jsonb_array_elements(rows) r where (r->>'dueOn')::date<=as_of and (r->>'remainingAmount')::numeric>0 group by r->>'memberId',r->>'memberName',r->>'membershipNumber'
  ) x;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'receiptNumber',p."receiptNumber",'paidOn',p."paidOn",'amount',smd.cash(p.scoped_amount),
      'originalAmount',smd.cash(p.amount),'memberId',p."memberId",'memberName',p.member_name,'authorName',p.author_name,'category',p.category,'method',p.method,
      'status',case when p."cancelledAt"<cutoff then 'cancelled' else 'posted' end,'cancellationReason',case when p."cancelledAt"<cutoff then p."cancellationReason" end)
      order by p."paidOn" desc,p."createdAt" desc,p.id),'[]'),
    coalesce(sum(p.scoped_amount) filter(where p.status='posted' or p."cancelledAt">=cutoff),0),count(*) filter(where p.status='posted' or p."cancelledAt">=cutoff)
    into payments,collections,collection_count from (
    select p.*,mem."fullName" as member_name,u."fullName" as author_name,
      case when event_id is not null or kind='events' then (select coalesce(sum(a.amount),0) from smd.allocations a join smd.obligations o on o.id=a."contributionId"
        where a."paymentId"=p.id and a."createdAt"<cutoff and o."targetType"='event' and (event_id is null or o."eventId"=event_id)) else p.amount end as scoped_amount
    from smd.payments p join smd.members mem on mem.id=p."memberId" join smd.profiles u on u.id=p."createdByUserId"
    where p."createdAt"<cutoff and p."paidOn"<=as_of and p."paidOn" between date_from and date_to and (member_id is null or p."memberId"=member_id)
  ) p where p.scoped_amount>0;
  if coalesce((params->>'exportAll')::boolean,false) then
    if greatest(jsonb_array_length(details),jsonb_array_length(arrears),jsonb_array_length(payments))>5000 then perform smd.fail(413,'REPORT_EXPORT_TOO_LARGE','التقرير يتجاوز 5000 سطر. ضيّق الفترة.'); end if;
    page:=1; lim:=5000; payment_page:=1; payment_lim:=5000;
  end if;
  title:=case kind when 'daily' then 'التقرير اليومي' when 'monthly' then 'التقرير الشهري' when 'annual' then 'التقرير السنوي' when 'events' then 'تقرير الدورات' when 'arrears' then 'تقرير المتأخرات' else 'كشف حساب المنتسب' end;
  return jsonb_build_object('meta',jsonb_build_object('kind',kind,'title',title,'from',date_from,'to',date_to,'asOf',as_of,'recordedBefore',cutoff,'generatedAt',clock_timestamp(),
      'businessTimezone',club."businessTimezone",'currency','MRU','clubName',club."clubName",'basisLabel','السجل المعروف عند الإقفال',
      'member',case when m.id is not null then jsonb_build_object('id',m.id,'fullName',m."fullName",'membershipNumber',m."membershipNumber") end,
      'event',case when e.id is not null then jsonb_build_object('id',e.id,'name',e.name) end),
    'totals',jsonb_build_object('dueInPeriod',due_period,'stock',stock,'future',future,'collectionsInPeriod',smd.cash(collections),'collectionCount',collection_count),
    'contributions',smd.page(details,page,lim),'arrears',smd.page(arrears,page,lim),'payments',smd.page(payments,payment_page,payment_lim));
end $$;

-- Called only by the Edge Function after validating the caller's Supabase JWT.
create function public.smd_manage_user(p_actor uuid, p_id uuid, p_input jsonb, p_action text, p_session uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor smd.profiles; target smd.profiles;
begin
  perform pg_advisory_xact_lock(71963001);
  select * into actor from smd.profiles where id=p_actor;
  if actor.id is null or not actor."isActive" or actor.role<>'admin' or not smd.active_session(actor.id,p_session,actor.revoked_before) then perform smd.fail(403,'FORBIDDEN','إدارة الحسابات للمدير النشط فقط.'); end if;
  if p_action='authorize' then return smd.user_json(actor); end if;
  if p_action='create' then
    if p_input->>'role' is null or p_input->>'role' not in ('admin','treasurer') or p_input->>'login' !~ '^[a-z0-9][a-z0-9._@+\-]{2,99}$' then perform smd.fail(400,'INVALID_USER','بيانات الحساب غير صحيحة.'); end if;
    insert into smd.profiles(id,login,"fullName",role) values(p_id,lower(trim(p_input->>'login')),trim(p_input->>'fullName'),p_input->>'role') returning * into target;
    perform smd.log(p_actor,'user.created',p_id); return jsonb_build_object('user',smd.user_json(target));
  elsif p_action='password' then
    if p_actor=p_id then perform smd.fail(400,'OWN_PASSWORD_RESET','استخدم شاشة تغيير كلمة مرورك.'); end if;
    update smd.profiles set revoked_before=clock_timestamp(),"updatedAt"=now() where id=p_id returning * into target;
    if target.id is null then perform smd.fail(404,'USER_NOT_FOUND','الحساب غير موجود.'); end if;
    perform smd.log(p_actor,'user.password_reset',p_id); return jsonb_build_object('message','تم تغيير كلمة المرور وإبطال الجلسات السابقة.');
  end if;
  perform smd.fail(400,'INVALID_ACTION','العملية غير صحيحة.'); return null;
end $$;
revoke all on function public.smd_manage_user(uuid,uuid,jsonb,text,uuid) from public, anon, authenticated;
grant execute on function public.smd_manage_user(uuid,uuid,jsonb,text,uuid) to service_role;
revoke all on all functions in schema smd from public, anon, authenticated;
