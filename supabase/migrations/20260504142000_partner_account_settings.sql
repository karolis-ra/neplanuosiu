create or replace function public.delete_own_partner_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_role text;
begin
  if auth.uid() is null then
    raise exception 'Naudotojas neprisijungęs.';
  end if;

  select role
  into current_role
  from public.users
  where id = auth.uid();

  if current_role not in ('venue_owner', 'service_provider') then
    raise exception 'Ši funkcija skirta tik partnerio paskyrai ištrinti.';
  end if;

  perform public.detach_partner_profiles(auth.uid());

  delete from public.favorite_rooms
  where user_id = auth.uid();

  update public.bookings
  set user_id = null
  where user_id = auth.uid();

  delete from public.users
  where id = auth.uid();

  delete from auth.users
  where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_partner_account() from public;
grant execute on function public.delete_own_partner_account() to authenticated;

do $$
begin
  if to_regclass('public.bookings') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'bookings'
        and column_name = 'user_id'
    )
  then
    alter table public.bookings alter column user_id drop not null;
  end if;

  if to_regclass('public.venues') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'venues'
        and column_name = 'owner_id'
    )
  then
    alter table public.venues alter column owner_id drop not null;
  end if;

  if to_regclass('public.service_providers') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'service_providers'
        and column_name = 'owner_id'
    )
  then
    alter table public.service_providers alter column owner_id drop not null;
  end if;
end $$;

create or replace function public.detach_partner_profiles(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  partner_venue_ids uuid[] := '{}';
  partner_provider_ids uuid[] := '{}';
begin
  select coalesce(array_agg(id), '{}'::uuid[])
  into partner_venue_ids
  from public.venues
  where owner_id = target_user_id;

  select coalesce(array_agg(id), '{}'::uuid[])
  into partner_provider_ids
  from public.service_providers
  where owner_id = target_user_id;

  update public.rooms
  set is_listed = false
  where venue_id = any(partner_venue_ids);

  update public.services
  set is_listed = false
  where provider_id = any(partner_provider_ids)
     or venue_id = any(partner_venue_ids);

  update public.venues
  set owner_id = null,
      email = null,
      phone = null
  where owner_id = target_user_id;

  update public.service_providers
  set owner_id = null,
      email = null,
      phone = null
  where owner_id = target_user_id;
end;
$$;

revoke all on function public.detach_partner_profiles(uuid) from public;

create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Tik administratorius gali ištrinti vartotojus.';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Savo administratoriaus paskyros ištrinti negalima.';
  end if;

  perform public.detach_partner_profiles(target_user_id);

  delete from public.favorite_rooms
  where user_id = target_user_id;

  update public.bookings
  set user_id = null
  where user_id = target_user_id;

  delete from public.users
  where id = target_user_id;

  delete from auth.users
  where id = target_user_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;
