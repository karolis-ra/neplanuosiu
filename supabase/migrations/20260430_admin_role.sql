-- Admin role support. Admin accounts are not created through public
-- registration; create the Auth user separately, then set public.users.role
-- to "admin".

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'users',
    'bookings',
    'booking_services',
    'booking_approvals',
    'venues',
    'rooms',
    'services',
    'service_providers',
    'images',
    'service_images',
    'favorite_rooms',
    'service_provider_availability',
    'service_provider_unavailability'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = table_name
          and policyname = format('Admins can manage %s', table_name)
      ) then
        execute format(
          'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
          format('Admins can manage %s', table_name),
          table_name
        );
      end if;
    end if;
  end loop;
end $$;

create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can delete users.';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Administrator cannot delete own account.';
  end if;

  delete from public.favorite_rooms
  where user_id = target_user_id;

  delete from public.users
  where id = target_user_id;

  delete from auth.users
  where id = target_user_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;
