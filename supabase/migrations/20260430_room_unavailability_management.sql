create extension if not exists pgcrypto;

create table if not exists public.room_unavailability (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now()
);

alter table public.room_unavailability
  add column if not exists id uuid default gen_random_uuid();

alter table public.room_unavailability
  add column if not exists room_id uuid references public.rooms(id) on delete cascade;

alter table public.room_unavailability
  add column if not exists date date;

alter table public.room_unavailability
  add column if not exists start_time time;

alter table public.room_unavailability
  add column if not exists end_time time;

alter table public.room_unavailability
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.room_unavailability'::regclass
      and contype = 'p'
  ) then
    alter table public.room_unavailability
      add constraint room_unavailability_pkey primary key (id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.room_unavailability'::regclass
      and conname = 'room_unavailability_time_order'
  ) then
    alter table public.room_unavailability
      add constraint room_unavailability_time_order
      check (end_time > start_time)
      not valid;
  end if;
end $$;

create index if not exists room_unavailability_room_date_idx
  on public.room_unavailability (room_id, date);

alter table public.room_unavailability enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'room_unavailability'
      and policyname = 'Anyone can read room unavailability'
  ) then
    create policy "Anyone can read room unavailability"
    on public.room_unavailability
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
      and tablename = 'room_unavailability'
      and policyname = 'Venue owners can create room unavailability'
  ) then
    create policy "Venue owners can create room unavailability"
    on public.room_unavailability
    for insert
    to authenticated
    with check (
      exists (
        select 1
        from public.rooms r
        join public.venues v on v.id = r.venue_id
        where r.id = room_unavailability.room_id
          and v.owner_id = auth.uid()
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
      and tablename = 'room_unavailability'
      and policyname = 'Venue owners can update room unavailability'
  ) then
    create policy "Venue owners can update room unavailability"
    on public.room_unavailability
    for update
    to authenticated
    using (
      exists (
        select 1
        from public.rooms r
        join public.venues v on v.id = r.venue_id
        where r.id = room_unavailability.room_id
          and v.owner_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1
        from public.rooms r
        join public.venues v on v.id = r.venue_id
        where r.id = room_unavailability.room_id
          and v.owner_id = auth.uid()
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
      and tablename = 'room_unavailability'
      and policyname = 'Venue owners can delete room unavailability'
  ) then
    create policy "Venue owners can delete room unavailability"
    on public.room_unavailability
    for delete
    to authenticated
    using (
      exists (
        select 1
        from public.rooms r
        join public.venues v on v.id = r.venue_id
        where r.id = room_unavailability.room_id
          and v.owner_id = auth.uid()
      )
    );
  end if;
end $$;
