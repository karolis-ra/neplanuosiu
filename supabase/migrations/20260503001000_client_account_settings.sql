create or replace function public.delete_own_client_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_role text;
begin
  select role
  into current_role
  from public.users
  where id = auth.uid();

  if auth.uid() is null then
    raise exception 'Naudotojas neprisijungęs.';
  end if;

  if coalesce(current_role, 'client') <> 'client' then
    raise exception 'Ši funkcija skirta tik kliento paskyrai ištrinti.';
  end if;

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

revoke all on function public.delete_own_client_account() from public;
grant execute on function public.delete_own_client_account() to authenticated;
