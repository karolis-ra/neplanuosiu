-- Allow service-only partners to see the reservation context for bookings that
-- include one of their services. Without these policies, the UI can see the
-- service approval row but receives null booking/room/venue details.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'bookings'
      and policyname = 'Service providers can read bookings for their services'
  ) then
    create policy "Service providers can read bookings for their services"
    on public.bookings
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.booking_services bs
        join public.services s on s.id = bs.service_id
        join public.service_providers sp on sp.id = s.provider_id
        where bs.booking_id = bookings.id
          and sp.owner_id = auth.uid()
      )
      or exists (
        select 1
        from public.booking_approvals ba
        join public.service_providers sp on sp.id = ba.provider_id
        where ba.booking_id = bookings.id
          and ba.approval_type = 'service'
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
      and tablename = 'rooms'
      and policyname = 'Service providers can read rooms for their service bookings'
  ) then
    create policy "Service providers can read rooms for their service bookings"
    on public.rooms
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.bookings b
        join public.booking_services bs on bs.booking_id = b.id
        join public.services s on s.id = bs.service_id
        join public.service_providers sp on sp.id = s.provider_id
        where b.room_id = rooms.id
          and sp.owner_id = auth.uid()
      )
      or exists (
        select 1
        from public.bookings b
        join public.booking_approvals ba on ba.booking_id = b.id
        join public.service_providers sp on sp.id = ba.provider_id
        where b.room_id = rooms.id
          and ba.approval_type = 'service'
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
      and tablename = 'venues'
      and policyname = 'Service providers can read venues for their service bookings'
  ) then
    create policy "Service providers can read venues for their service bookings"
    on public.venues
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.rooms r
        join public.bookings b on b.room_id = r.id
        join public.booking_services bs on bs.booking_id = b.id
        join public.services s on s.id = bs.service_id
        join public.service_providers sp on sp.id = s.provider_id
        where r.venue_id = venues.id
          and sp.owner_id = auth.uid()
      )
      or exists (
        select 1
        from public.rooms r
        join public.bookings b on b.room_id = r.id
        join public.booking_approvals ba on ba.booking_id = b.id
        join public.service_providers sp on sp.id = ba.provider_id
        where r.venue_id = venues.id
          and ba.approval_type = 'service'
          and sp.owner_id = auth.uid()
      )
    );
  end if;
end $$;
