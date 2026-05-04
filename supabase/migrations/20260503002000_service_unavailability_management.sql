create extension if not exists pgcrypto;

create table if not exists public.service_unavailability (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now()
);

alter table public.service_unavailability
  add column if not exists id uuid default gen_random_uuid();

alter table public.service_unavailability
  add column if not exists service_id uuid references public.services(id) on delete cascade;

alter table public.service_unavailability
  add column if not exists date date;

alter table public.service_unavailability
  add column if not exists start_time time;

alter table public.service_unavailability
  add column if not exists end_time time;

alter table public.service_unavailability
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.service_unavailability'::regclass
      and contype = 'p'
  ) then
    alter table public.service_unavailability
      add constraint service_unavailability_pkey primary key (id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.service_unavailability'::regclass
      and conname = 'service_unavailability_time_order'
  ) then
    alter table public.service_unavailability
      add constraint service_unavailability_time_order
      check (end_time > start_time)
      not valid;
  end if;
end $$;

create index if not exists service_unavailability_service_date_idx
  on public.service_unavailability (service_id, date);

alter table public.service_unavailability enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'service_unavailability'
      and policyname = 'Anyone can read service unavailability'
  ) then
    create policy "Anyone can read service unavailability"
    on public.service_unavailability
    for select
    to anon, authenticated
    using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'service_unavailability'
      and policyname = 'Service providers can create service unavailability'
  ) then
    create policy "Service providers can create service unavailability"
    on public.service_unavailability
    for insert
    to authenticated
    with check (
      exists (
        select 1
        from public.services s
        join public.service_providers sp on sp.id = s.provider_id
        where s.id = service_unavailability.service_id
          and sp.owner_id = auth.uid()
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'service_unavailability'
      and policyname = 'Service providers can update service unavailability'
  ) then
    create policy "Service providers can update service unavailability"
    on public.service_unavailability
    for update
    to authenticated
    using (
      exists (
        select 1
        from public.services s
        join public.service_providers sp on sp.id = s.provider_id
        where s.id = service_unavailability.service_id
          and sp.owner_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1
        from public.services s
        join public.service_providers sp on sp.id = s.provider_id
        where s.id = service_unavailability.service_id
          and sp.owner_id = auth.uid()
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'service_unavailability'
      and policyname = 'Service providers can delete service unavailability'
  ) then
    create policy "Service providers can delete service unavailability"
    on public.service_unavailability
    for delete
    to authenticated
    using (
      exists (
        select 1
        from public.services s
        join public.service_providers sp on sp.id = s.provider_id
        where s.id = service_unavailability.service_id
          and sp.owner_id = auth.uid()
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'service_unavailability'
      and policyname = 'Admins can manage service unavailability'
  ) then
    create policy "Admins can manage service unavailability"
    on public.service_unavailability
    for all
    to authenticated
    using (
      exists (
        select 1
        from public.users u
        where u.id = auth.uid()
          and u.role = 'admin'
      )
    )
    with check (
      exists (
        select 1
        from public.users u
        where u.id = auth.uid()
          and u.role = 'admin'
      )
    );
  end if;
end $$;
