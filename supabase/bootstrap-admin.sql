-- Create the user first in Supabase Dashboard > Authentication > Users.
-- Run this once in the SQL Editor, after replacing the email and full name.
-- Never put passwords or service_role keys in this script or in the frontend.
do $$
declare user_id uuid;
begin
  perform pg_advisory_xact_lock(71963001);
  if exists(select 1 from smd.profiles) then raise exception 'Le premier compte existe déjà.'; end if;
  select id into user_id from auth.users where lower(email)='admin@club.invalid';
  if user_id is null then raise exception 'Créer admin@club.invalid dans Supabase Auth avant cet amorçage.'; end if;
  insert into smd.profiles(id,login,"fullName",role) values(user_id,'admin','مدير النادي','admin');
end $$;
