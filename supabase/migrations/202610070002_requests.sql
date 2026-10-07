create function smd.handle(actor smd.profiles, method text, path text, params jsonb, body jsonb) returns jsonb
language plpgsql set search_path='' as $$
#variable_conflict use_variable
declare parts text[]:=string_to_array(trim(both '/' from path),'/'); id uuid; m smd.members; e smd.events; p smd.payments;
  club smd.settings; user_row smd.profiles; rate smd.rates; today date:=smd.today(); as_of date:=coalesce((params->>'asOf')::date,smd.today());
  page integer:=coalesce((params->>'page')::integer,1); lim integer:=coalesce((params->>'limit')::integer,20);
  rows jsonb; all_rows jsonb; totals jsonb; due_stats jsonb; future_stats jsonb; result jsonb; added integer:=0; member_id uuid;
begin
  if page<1 or lim not between 1 and 100 then perform smd.fail(400,'INVALID_PAGINATION','إعدادات الصفحات غير صحيحة.'); end if;
  select * into club from smd.settings where smd.settings.id=1;
  if path='/auth/me' and method='GET' then return smd.user_json(actor)||jsonb_build_object('permissions',smd.permissions(actor.role)); end if;
  if path='/auth/revoke-sessions' and method='POST' then
    update smd.profiles set revoked_before=clock_timestamp() where smd.profiles.id=actor.id;
    return jsonb_build_object('message','تم إبطال الجلسات.');
  end if;
  if path='/club' and method='GET' then return jsonb_build_object('clubName',club."clubName",'businessTimezone',club."businessTimezone",'businessToday',today); end if;
  if method='GET' and (parts[1]='reports' or (parts[1]='members' and parts[3]='historical-statement')) then
    if parts[1]='reports' and actor.role<>'admin' then perform smd.fail(403,'FORBIDDEN','ليس لديك صلاحية عرض التقارير العامة.'); end if;
    return smd.report(case when parts[1]='members' then 'statement' else parts[2] end,
      params||case when parts[1]='members' then jsonb_build_object('memberId',parts[2]) else '{}'::jsonb end);
  end if;
  if parts[1]='members' then
    if method<>'GET' and actor.role<>'admin' then perform smd.fail(403,'FORBIDDEN','إدارة المنتسبين للمدير فقط.'); end if;
    if array_length(parts,1)>1 then
      id:=parts[2]::uuid; select * into m from smd.members where smd.members.id=id;
      if m.id is null then perform smd.fail(404,'MEMBER_NOT_FOUND','المنتسب غير موجود.'); end if;
    end if;
    if method='GET' and path='/members' then
      select coalesce(jsonb_agg(to_jsonb(x) order by x."fullName",x.id),'[]') into rows from smd.members x
        where (coalesce(params->>'search','')='' or position(lower(params->>'search') in lower(x."fullName"||' '||x.phone||' '||x."membershipNumber"))>0)
          and (params->>'status' is null or x.status=params->>'status')
          and (params->>'archived'='include' or (coalesce(params->>'archived','exclude')='exclude' and x."archivedAt" is null) or (params->>'archived'='only' and x."archivedAt" is not null));
      return smd.page(rows,page,lim);
    elsif method='GET' and parts[3]='statement' then
      if as_of>today or as_of<'1900-01-01' then perform smd.fail(400,'INVALID_DATE','تاريخ الوضعية غير صحيح.'); end if;
      select coalesce(jsonb_agg(smd.obligation_json(to_jsonb(f),as_of) order by f."dueOn",f.id),'[]') into all_rows from smd.finance(as_of) f where f."memberId"=id;
      totals:=smd.stats(all_rows);
      select smd.stats(coalesce(jsonb_agg(x),'[]')) into due_stats from jsonb_array_elements(all_rows) x where (x->>'dueOn')::date<=as_of;
      select coalesce(jsonb_agg(x),'[]') into rows from jsonb_array_elements(all_rows) x
        where coalesce(params->>'maturity','all')='all' or (params->>'maturity'='due' and (x->>'dueOn')::date<=as_of) or (params->>'maturity'='future' and (x->>'dueOn')::date>as_of);
      select * into rate from smd.rates where "effectiveOn"<=date_trunc('month',today)::date order by "effectiveOn" desc limit 1;
      select * into p from smd.payments where "memberId"=id and status='posted' order by "paidOn" desc,"createdAt" desc limit 1;
      return jsonb_build_object('member',to_jsonb(m),'asOf',as_of,'businessTimezone',club."businessTimezone",'currency','MRU',
        'currentMonthlyRate',jsonb_build_object('amount',smd.cash(rate.amount),'effectiveOn',rate."effectiveOn",'asOf',today),
        'lastPayment',case when p.id is not null then smd.payment_json(p) end,'contributions',smd.page(rows,page,lim),
        'totals',jsonb_build_object('monthlyDue',totals->>'monthlyDue','eventsDue',totals->>'eventsDue','totalDue',totals->>'due',
          'totalPaid',totals->>'paid','remaining',totals->>'remaining','monthlyArrears',due_stats->>'monthlyRemaining','eventArrears',due_stats->>'eventRemaining',
          'arrears',due_stats->>'remaining','financialStatusLabel',case when (totals->>'remaining')::numeric=0 then 'مسدد بالكامل' when (due_stats->>'remaining')::numeric>0 then 'عليه متأخرات' else 'التزامات مستقبلية' end));
    elsif method='GET' and array_length(parts,1)=2 then return jsonb_build_object('member',to_jsonb(m));
    elsif method='POST' and path='/members' then
      if (body->>'joinedOn')::date>today or (body->>'joinedOn')::date<'1900-01-01' then perform smd.fail(400,'INVALID_DATE','تاريخ الانتساب غير صحيح.'); end if;
      insert into smd.members("fullName",phone,"membershipNumber","joinedOn",status,notes)
        values(trim(body->>'fullName'),trim(body->>'phone'),trim(body->>'membershipNumber'),(body->>'joinedOn')::date,body->>'status',nullif(trim(body->>'notes'),'')) returning * into m;
      if m.status='active' then insert into smd.activity("memberId","startsOn") values(m.id,m."joinedOn"); perform smd.generate(m.id); end if;
      perform smd.log(actor.id,'member.created',m.id); return jsonb_build_object('member',to_jsonb(m));
    elsif method='PATCH' and array_length(parts,1)=2 then
      update smd.members set "fullName"=coalesce(trim(body->>'fullName'),"fullName"),phone=coalesce(trim(body->>'phone'),phone),
        "membershipNumber"=coalesce(trim(body->>'membershipNumber'),"membershipNumber"),notes=case when body ? 'notes' then nullif(trim(body->>'notes'),'') else notes end,"updatedAt"=now()
        where smd.members.id=id returning * into m;
      perform smd.log(actor.id,'member.updated',id); return jsonb_build_object('member',to_jsonb(m));
    elsif (method='PATCH' and parts[3]='activity') or (method='POST' and parts[3]='archive') or (method='DELETE' and array_length(parts,1)=2) then
      select * into m from smd.members where smd.members.id=id for update;
      if method='DELETE' and not exists(select 1 from smd.obligations where "memberId"=id) and not exists(select 1 from smd.payments where "memberId"=id) then
        delete from smd.activity where "memberId"=id; delete from smd.members where smd.members.id=id;
        perform smd.log(actor.id,'member.deleted',id); return jsonb_build_object('action','deleted','id',id);
      end if;
      if parts[3]='activity' and m."archivedAt" is not null then perform smd.fail(409,'MEMBER_ARCHIVED','لا يمكن تغيير نشاط منتسب مؤرشف.'); end if;
      if parts[3]='activity' and (body->>'status' is null or body->>'status' not in ('active','inactive')) then perform smd.fail(400,'INVALID_STATUS','الحالة غير صحيحة.'); end if;
      if parts[3]='activity' and body->>'status'='active' then
        if m.status<>'active' then
          update smd.activity set "endsOn"=null where "memberId"=id and "endsOn"=today+1;
          if not found then insert into smd.activity("memberId","startsOn") values(id,today); end if;
          update smd.members set status='active',"updatedAt"=now() where smd.members.id=id;
          perform smd.generate(id);
        end if;
      else
        update smd.activity set "endsOn"=today+1 where "memberId"=id and "endsOn" is null;
        update smd.members set status='inactive',"updatedAt"=now(),"archivedAt"=case when parts[3]='activity' then "archivedAt" else coalesce("archivedAt",now()) end where smd.members.id=id;
      end if;
      select * into m from smd.members where smd.members.id=id;
      perform smd.log(actor.id,'member.activity',id,jsonb_build_object('status',m.status,'archivedAt',m."archivedAt"));
      return jsonb_build_object('member',to_jsonb(m))||case when parts[3]='activity' then '{}'::jsonb else jsonb_build_object('action','archived') end;
    end if;
  elsif parts[1]='events' then
    if actor.role<>'admin' then perform smd.fail(403,'FORBIDDEN','إدارة الدورات للمدير فقط.'); end if;
    if array_length(parts,1)>1 then
      id:=parts[2]::uuid; select * into e from smd.events where smd.events.id=id for update;
      if e.id is null then perform smd.fail(404,'EVENT_NOT_FOUND','الدورة غير موجودة.'); end if;
    end if;
    if method='GET' and path='/events' then
      select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('contributionAmount',smd.cash(x."contributionAmount")) order by x."eventOn" desc,x.id),'[]') into rows from smd.events x
        where (coalesce(params->>'search','')='' or position(lower(params->>'search') in lower(x.name||' '||x.type))>0)
          and (params->>'from' is null or x."eventOn">=(params->>'from')::date) and (params->>'to' is null or x."eventOn"<=(params->>'to')::date);
      return smd.page(rows,page,lim);
    elsif method='GET' and array_length(parts,1)=2 then
      select coalesce(jsonb_agg(smd.obligation_json(to_jsonb(f),today)||jsonb_build_object('fullName',x."fullName",'membershipNumber',x."membershipNumber") order by x."fullName",f.id),'[]') into all_rows
        from smd.finance(today) f join smd.members x on x.id=f."memberId" where f."eventId"=id;
      totals:=smd.stats(all_rows);
      select coalesce(jsonb_agg(x),'[]') into rows from jsonb_array_elements(all_rows) x where params->>'paymentStatus' is null or x->>'paymentStatus'=params->>'paymentStatus';
      return jsonb_build_object('event',to_jsonb(e)||jsonb_build_object('contributionAmount',smd.cash(e."contributionAmount")),'asOf',today,'currency','MRU','participants',smd.page(rows,page,lim),
        'summary',jsonb_build_object('participantCount',totals->'count','paidCount',totals->'paidCount','partialCount',totals->'partialCount','unpaidCount',totals->'unpaidCount',
          'totalDue',totals->>'due','totalPaid',totals->>'paid','remaining',totals->>'remaining'));
    elsif (method='POST' and path='/events') or (method='POST' and parts[3]='participants') then
      if path='/events' then
        insert into smd.events(name,type,"eventOn","contributionAmount",notes) values(trim(body->>'name'),trim(body->>'type'),(body->>'eventOn')::date,smd.money(body->>'contributionAmount'),nullif(trim(body->>'notes'),'')) returning * into e;
      end if;
      if jsonb_typeof(body->'memberIds') is distinct from 'array' or jsonb_array_length(body->'memberIds')>500 then perform smd.fail(400,'INVALID_PARTICIPANTS','قائمة المشاركين غير صحيحة.'); end if;
      for member_id in select distinct value::uuid from jsonb_array_elements_text(body->'memberIds') order by value::uuid loop
        select * into m from smd.members where smd.members.id=member_id for update;
        if m.id is null or m."archivedAt" is not null then perform smd.fail(400,'INVALID_PARTICIPANT','أحد المشاركين غير موجود أو مؤرشف.'); end if;
        insert into smd.obligations("memberId","targetType","dueOn",label,"eventId",amount) values(member_id,'event',e."eventOn",e.name,e.id,e."contributionAmount") on conflict("memberId","eventId") do nothing;
        if found then added:=added+1; end if;
      end loop;
      perform smd.log(actor.id,'event.participants',e.id,jsonb_build_object('created',added));
      return jsonb_build_object('event',to_jsonb(e)||jsonb_build_object('contributionAmount',smd.cash(e."contributionAmount")),'contributionsCreated',added);
    elsif method='PATCH' and array_length(parts,1)=2 then
      if (body->>'eventOn')::date is distinct from e."eventOn" and exists(select 1 from smd.obligations where "eventId"=id) then perform smd.fail(409,'EVENT_DATE_IMMUTABLE','تاريخ دورة لها مساهمات محفوظ لحماية السجل المالي.'); end if;
      update smd.events set name=trim(body->>'name'),type=trim(body->>'type'),"eventOn"=(body->>'eventOn')::date,"contributionAmount"=smd.money(body->>'contributionAmount'),notes=nullif(trim(body->>'notes'),'') where smd.events.id=id returning * into e;
      perform smd.log(actor.id,'event.updated',id); return jsonb_build_object('event',to_jsonb(e)||jsonb_build_object('contributionAmount',smd.cash(e."contributionAmount")));
    elsif method='DELETE' and array_length(parts,1)=2 then
      if exists(select 1 from smd.obligations where "eventId"=id) then perform smd.fail(409,'EVENT_HAS_HISTORY','لا يمكن حذف دورة لها سجل مالي.'); end if;
      delete from smd.events where smd.events.id=id; perform smd.log(actor.id,'event.deleted',id); return jsonb_build_object('id',id,'message','تم حذف الدورة.');
    end if;
  elsif parts[1]='payments' then
    if method='GET' and path='/payments' then
      select coalesce(jsonb_agg(smd.payment_json(x) order by x."paidOn" desc,x."createdAt" desc,x.id),'[]') into rows from smd.payments x join smd.members y on y.id=x."memberId"
        where (params->>'memberId' is null or x."memberId"=(params->>'memberId')::uuid) and (params->>'status' is null or x.status=params->>'status')
          and (params->>'category' is null or x.category=params->>'category') and (params->>'method' is null or x.method=params->>'method')
          and (params->>'from' is null or x."paidOn">=(params->>'from')::date) and (params->>'to' is null or x."paidOn"<=(params->>'to')::date)
          and (coalesce(params->>'search','')='' or position(lower(params->>'search') in lower(x."receiptNumber"||' '||y."fullName"||' '||y."membershipNumber"))>0);
      return smd.page(rows,page,lim);
    elsif method='POST' and path='/payments/preview' then
      if body->>'replacementPaymentId' is not null and actor.role<>'admin' then perform smd.fail(403,'FORBIDDEN','تصحيح الدفعات للمدير فقط.'); end if;
      return smd.payment_plan(body,(body->>'replacementPaymentId')::uuid);
    elsif method='POST' and path='/payments' then return smd.post_payment(actor.id,body);
    elsif array_length(parts,1)>=2 then
      id:=parts[2]::uuid; select * into p from smd.payments where smd.payments.id=id;
      if p.id is null then perform smd.fail(404,'PAYMENT_NOT_FOUND','الدفعة غير موجودة.'); end if;
      if method='GET' and array_length(parts,1)=2 then return smd.payment_detail(id);
      elsif method='GET' and parts[3]='receipt' then
        return jsonb_build_object('receiptNumber',p."receiptNumber",'isValid',p.status='posted','status',p.status,'statusLabel',case when p.status='posted' then 'صالحة' else 'ملغاة' end,
          'replacementPaymentId',(select x.id from smd.payments x where x."replacesPaymentId"=id), 'snapshot',p.snapshot,
          'cancellation',case when p.status='cancelled' then jsonb_build_object('at',p."cancelledAt",'byUserId',p."cancelledByUserId",'reason',p."cancellationReason") end);
      elsif method='POST' and parts[3] in ('cancel','replace') then
        if actor.role<>'admin' then perform smd.fail(403,'FORBIDDEN','تصحيح الدفعات للمدير فقط.'); end if;
        if length(trim(coalesce(body->>'reason','')))=0 then perform smd.fail(400,'REASON_REQUIRED','سبب التصحيح مطلوب.'); end if;
        if parts[3]='replace' then return smd.post_payment(actor.id,body,id); end if;
        perform 1 from smd.members where smd.members.id=p."memberId" for update;
        select * into p from smd.payments where smd.payments.id=id for update;
        if p.status='cancelled' and p."cancellationReason"<>trim(body->>'reason') then perform smd.fail(409,'ALREADY_CANCELLED','الدفعة ملغاة بسبب آخر.'); end if;
        if p.status='posted' then
          update smd.payments set status='cancelled',"cancelledAt"=now(),"cancelledByUserId"=actor.id,"cancellationReason"=trim(body->>'reason') where smd.payments.id=id;
          perform smd.log(actor.id,'payment.cancelled',id,jsonb_build_object('reason',body->>'reason'));
        end if;
        return smd.payment_detail(id);
      end if;
    end if;
  elsif path='/arrears' and method='GET' then
    select coalesce(jsonb_agg(to_jsonb(x)-'monthly'-'event'||jsonb_build_object('monthlyArrears',smd.cash(x.monthly),'eventArrears',smd.cash(x.event),'arrears',smd.cash(x.monthly+x.event)) order by (x.monthly+x.event) desc,x.id),'[]') into rows from (
      select mem.id,mem."fullName",mem."membershipNumber",mem.phone,mem.status,mem."archivedAt",
        coalesce(sum(f."remainingAmount") filter(where f."targetType"='monthly'),0) as monthly,coalesce(sum(f."remainingAmount") filter(where f."targetType"='event'),0) as event
      from smd.members mem join smd.finance(today) f on f."memberId"=mem.id and f."dueOn"<=today
      where (params->>'status' is null or mem.status=params->>'status') and (coalesce(params->>'search','')='' or position(lower(params->>'search') in lower(mem."fullName"||' '||mem.phone||' '||mem."membershipNumber"))>0)
      group by mem.id having sum(f."remainingAmount")>0
        and (coalesce(params->>'category','all')='all' or (params->>'category'='monthly' and sum(f."remainingAmount") filter(where f."targetType"='monthly')>0) or (params->>'category'='event' and sum(f."remainingAmount") filter(where f."targetType"='event')>0))
    ) x;
    select jsonb_build_object('monthlyArrears',smd.cash(sum((x->>'monthlyArrears')::numeric)),'eventArrears',smd.cash(sum((x->>'eventArrears')::numeric)),'totalArrears',smd.cash(sum((x->>'arrears')::numeric))) into totals from jsonb_array_elements(rows) x;
    return smd.page(rows,page,lim)||jsonb_build_object('asOf',today,'businessTimezone',club."businessTimezone",'currency','MRU','totals',totals);
  elsif path='/dashboard' and method='GET' then
    if actor.role<>'admin' then perform smd.fail(403,'FORBIDDEN','لوحة التحكم للمدير فقط.'); end if;
    select smd.stats(coalesce(jsonb_agg(to_jsonb(f)),'[]')) into totals from smd.finance(today) f where f."dueOn"<=today;
    return jsonb_build_object('asOf',today,'businessTimezone',club."businessTimezone",'currency','MRU',
      'collectionPeriod',jsonb_build_object('from',date_trunc('month',today)::date,'toExclusive',(date_trunc('month',today)+interval '1 month')::date),
      'memberCount',(select count(*) from smd.members where "archivedAt" is null),'activeMemberCount',(select count(*) from smd.members where "archivedAt" is null and status='active'),
      'inactiveMemberCount',(select count(*) from smd.members where "archivedAt" is null and status='inactive'),
      'membersWhoPaid',(select count(distinct pay."memberId") from smd.payments pay join smd.members mem on mem.id=pay."memberId" where pay.status='posted' and pay."paidOn">=date_trunc('month',today)::date and mem."archivedAt" is null),
      'membersWithArrears',(select count(distinct "memberId") from smd.finance(today) where "dueOn"<=today and "remainingAmount">0),
      'monthlyCollections',(select smd.cash(sum(amount)) from smd.payments where status='posted' and "paidOn">=date_trunc('month',today)::date),
      'totalArrears',totals->>'remaining','monthlyArrears',totals->>'monthlyRemaining','eventArrears',totals->>'eventRemaining');
  elsif parts[1]='settings' then
    if actor.role<>'admin' then perform smd.fail(403,'FORBIDDEN','الإعدادات للمدير فقط.'); end if;
    if path='/settings' and method='GET' then
      return jsonb_build_object('club',to_jsonb(club),'businessToday',today,
        'currentMonthlyRate',(select to_jsonb(r)||jsonb_build_object('amount',smd.cash(r.amount)) from smd.rates r where "effectiveOn"<=date_trunc('month',today)::date order by "effectiveOn" desc limit 1),
        'nextMonthlyRate',(select to_jsonb(r)||jsonb_build_object('amount',smd.cash(r.amount)) from smd.rates r where "effectiveOn">date_trunc('month',today)::date order by "effectiveOn" limit 1));
    elsif path='/settings' and method='PATCH' then
      if not exists(select 1 from pg_timezone_names where name=body->>'businessTimezone') or length(trim(coalesce(body->>'clubName',''))) not between 1 and 200 then perform smd.fail(400,'INVALID_SETTINGS','اسم النادي أو المنطقة الزمنية غير صحيح.'); end if;
      update smd.settings set "clubName"=trim(body->>'clubName'),"businessTimezone"=body->>'businessTimezone',"receiptOptions"=body->'receiptOptions',"updatedAt"=now(),"updatedByUserId"=actor.id where smd.settings.id=1 returning * into club;
      perform smd.log(actor.id,'settings.updated',null); return jsonb_build_object('club',to_jsonb(club));
    elsif path='/settings/monthly-rates' and method='GET' then
      select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('amount',smd.cash(r.amount)) order by r."effectiveOn" desc),'[]') into rows from smd.rates r;
      return smd.page(rows,page,lim);
    elsif path='/settings/monthly-rates' and method='POST' then
      if (body->>'effectiveOn')::date<=today or extract(day from (body->>'effectiveOn')::date)<>1 then perform smd.fail(400,'INVALID_RATE_DATE','التعرفة الجديدة تبدأ في أول شهر مستقبلي.'); end if;
      insert into smd.rates(amount,"effectiveOn") values(smd.money(body->>'amount'),(body->>'effectiveOn')::date) returning * into rate;
      perform smd.log(actor.id,'rate.created',rate.id); return jsonb_build_object('rate',to_jsonb(rate)||jsonb_build_object('amount',smd.cash(rate.amount)));
    end if;
  elsif parts[1]='users' then
    if actor.role<>'admin' then perform smd.fail(403,'FORBIDDEN','إدارة الحسابات للمدير فقط.'); end if;
    if path='/users' and method='GET' then
      select coalesce(jsonb_agg(smd.user_json(u) order by u."fullName",u.id),'[]') into rows from smd.profiles u;
      result:=smd.page(rows,page,lim); return (result-'items')||jsonb_build_object('users',result->'items');
    elsif method='PATCH' and array_length(parts,1)=2 then
      id:=parts[2]::uuid; select * into user_row from smd.profiles where smd.profiles.id=id for update;
      if user_row.id is null then perform smd.fail(404,'USER_NOT_FOUND','الحساب غير موجود.'); end if;
      if id=actor.id and body ? 'role' and body->>'role'<>actor.role then perform smd.fail(400,'OWN_ROLE_CHANGE','لا يمكن تغيير دور حسابك.'); end if;
      if user_row.role='admin' and user_row."isActive" and (coalesce(body->>'role',user_row.role)<>'admin' or coalesce((body->>'isActive')::boolean,user_row."isActive")=false)
        and (select count(*) from smd.profiles where role='admin' and "isActive")<=1 then perform smd.fail(409,'LAST_ADMIN','يجب الحفاظ على مدير نشط واحد على الأقل.'); end if;
      update smd.profiles set "fullName"=coalesce(trim(body->>'fullName'),"fullName"),role=coalesce(body->>'role',role),"isActive"=coalesce((body->>'isActive')::boolean,"isActive"),"updatedAt"=now(),
        revoked_before=case when (body ? 'role' and body->>'role'<>role) or (body ? 'isActive' and (body->>'isActive')::boolean<>"isActive") then clock_timestamp() else revoked_before end
        where smd.profiles.id=id returning * into user_row;
      perform smd.log(actor.id,'user.updated',id); return jsonb_build_object('user',smd.user_json(user_row));
    end if;
  elsif path='/contributions/monthly/generate' and method='POST' then
    if actor.role<>'admin' then perform smd.fail(403,'FORBIDDEN','توليد الاشتراكات للمدير فقط.'); end if;
    return jsonb_build_object('created',smd.generate());
  end if;
  perform smd.fail(404,'ROUTE_NOT_FOUND','العملية غير موجودة.'); return null;
end $$;

create function public.smd_request(p_method text, p_path text, p_params jsonb default '{}', p_body jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor smd.profiles; result jsonb;
begin
  if p_method='GET' and p_path in ('/health/live','/health/ready') then
    if p_path='/health/live' then return jsonb_build_object('status','ok','api','available','timestamp',now(),'uptimeSeconds',0); end if;
    return jsonb_build_object('status','ok','api','available','database','available','timestamp',now(),'businessTimezone',(select "businessTimezone" from smd.settings where id=1));
  end if;
  -- Lock profiles before mutations so disabling an account cannot race a payment.
  if p_method<>'GET' then perform pg_advisory_xact_lock(71963001); end if;
  select * into actor from smd.profiles where id=auth.uid();
  if actor.id is null or not actor."isActive" or not smd.active_session(actor.id,(auth.jwt()->>'session_id')::uuid,actor.revoked_before) then
    perform smd.fail(401,'UNAUTHENTICATED','الحساب غير مفعل أو انتهت الجلسة.'); end if;
  result:=smd.handle(actor,p_method,p_path,coalesce(p_params,'{}'),coalesce(p_body,'{}'));
  return result;
exception
  when unique_violation then perform smd.fail(409,'DUPLICATE','هذه البيانات مسجلة مسبقاً.'); return null;
  when invalid_text_representation or datetime_field_overflow or not_null_violation or check_violation or numeric_value_out_of_range then
    perform smd.fail(400,'VALIDATION_ERROR','البيانات غير صحيحة. راجع الحقول والتواريخ والمبالغ.'); return null;
  when foreign_key_violation then perform smd.fail(409,'HAS_DEPENDENCIES','هذه البيانات مرتبطة بسجل محفوظ.'); return null;
end $$;
revoke all on function public.smd_request(text,text,jsonb,jsonb) from public;
grant execute on function public.smd_request(text,text,jsonb,jsonb) to anon, authenticated;
-- Deny helper execution even if smd is accidentally added to the exposed schemas.
revoke all on all functions in schema smd from public, anon, authenticated;
alter default privileges in schema smd revoke execute on functions from public;
