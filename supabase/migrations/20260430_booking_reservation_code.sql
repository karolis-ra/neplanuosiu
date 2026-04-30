-- Human-readable reservation code shared by the whole booking.
-- The technical bookings.id stays as UUID; reservation_code is for users,
-- partners and admins to search and discuss reservations.

alter table public.bookings
add column if not exists reservation_code text;

create sequence if not exists public.booking_reservation_code_seq
  as bigint
  start with 1
  increment by 1
  minvalue 1;

create or replace function public.set_booking_reservation_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reservation_code is null or btrim(new.reservation_code) = '' then
    new.reservation_code :=
      'NP-' ||
      to_char(coalesce(new.event_date, current_date), 'YYYYMM') ||
      '-' ||
      lpad(nextval('public.booking_reservation_code_seq')::text, 6, '0');
  end if;

  return new;
end;
$$;

drop trigger if exists set_booking_reservation_code on public.bookings;

create trigger set_booking_reservation_code
before insert on public.bookings
for each row
execute function public.set_booking_reservation_code();

with missing_bookings as (
  select id
  from public.bookings
  where reservation_code is null
     or btrim(reservation_code) = ''
  order by created_at nulls last, event_date nulls last, id
)
update public.bookings as b
set reservation_code =
  'NP-' ||
  to_char(coalesce(b.event_date, current_date), 'YYYYMM') ||
  '-' ||
  lpad(nextval('public.booking_reservation_code_seq')::text, 6, '0')
from missing_bookings as m
where b.id = m.id;

create unique index if not exists bookings_reservation_code_key
on public.bookings (reservation_code);
