-- 1. Create the administrator in Supabase Auth first:
--    Supabase Dashboard -> Authentication -> Users -> Add user.
--
-- 2. Copy the created Auth user UUID and run this SQL in the SQL editor.

insert into public.users (id, email, full_name, role)
values (
  '<AUTH_USER_UUID>'::uuid,
  'admin@example.com',
  'Administratorius',
  'admin'
)
on conflict (id) do update
set
  email = excluded.email,
  full_name = excluded.full_name,
  role = 'admin';
