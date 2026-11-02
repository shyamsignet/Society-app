-- Run once in Supabase → SQL Editor (already included in setup.sql for new projects).
-- Adds SociYo subscriptions: 30-day trial, yearly plan, platform owner console, read-only after expiry.

-- ---------------------------------------------------------------------
--  Subscriptions: the platform owner bills each society. Societies can read
--  their own status (my_subscription) but never change it.
-- ---------------------------------------------------------------------
create table if not exists public.platform_admins (
  auth_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.platform_settings (
  id   int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb   -- business name, UPI, bank, phone, email, GSTIN, address
);
insert into public.platform_settings (id) values (1) on conflict do nothing;
create table if not exists public.subscriptions (
  society_id     text primary key,
  plan           text not null default 'yearly',   -- yearly | complimentary
  status         text not null default 'trial',    -- trial | active | suspended (expiry is computed)
  price_per_flat numeric not null default 20,      -- ₹ per flat per month
  trial_ends     timestamptz,
  paid_until     timestamptz,
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create table if not exists public.subscription_payments (
  id             bigserial primary key,
  society_id     text not null,
  invoice_no     text not null unique,
  amount         numeric not null,
  flats          int not null,
  price_per_flat numeric not null,
  months         int not null,
  period_from    date not null,
  period_to      date not null,
  method         text not null default '',
  ref            text not null default '',
  note           text not null default '',
  recorded_by    uuid,
  created_at     timestamptz not null default now()
);
create sequence if not exists public.invoice_seq;
alter table public.platform_admins enable row level security;
alter table public.platform_settings enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_payments enable row level security;
revoke all on public.platform_admins, public.platform_settings, public.subscriptions, public.subscription_payments from anon, authenticated;
revoke all on sequence public.invoice_seq from anon, authenticated;

-- 'ok' | 'grace' (expired, 15 days to renew) | 'locked' (read-only)
create or replace function public.subscription_state(p_soc text) returns text
language sql stable security definer set search_path = public as $$
  select case
    when s.society_id is null then 'ok'
    when s.status = 'suspended' then 'locked'
    when s.plan = 'complimentary' then 'ok'
    when greatest(coalesce(s.trial_ends, '-infinity'::timestamptz), coalesce(s.paid_until, '-infinity'::timestamptz)) >= now() then 'ok'
    when greatest(coalesce(s.trial_ends, '-infinity'::timestamptz), coalesce(s.paid_until, '-infinity'::timestamptz)) + interval '15 days' >= now() then 'grace'
    else 'locked' end
  from (select p_soc as k) x left join public.subscriptions s on s.society_id = x.k
$$;



create or replace function public._write(m public.members, p_soc text, p_col text, p_id text, p_patch jsonb, p_replace boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  old jsonb;
  newd jsonb;
begin
  if p_col !~ '^[A-Za-z]{2,30}$' or p_id is null or length(p_id) > 120 then
    raise exception 'invalid_record' using errcode = '22023';
  end if;
  if subscription_state(p_soc) = 'locked' then
    raise exception 'subscription_expired' using errcode = '42501';
  end if;
  if p_col = 'bookings' then   -- serialise bookings per facility to stop double booking
    perform pg_advisory_xact_lock(hashtext(p_soc || ':' || coalesce(p_patch ->> 'facilityId', p_id)));
  end if;
  select data into old from records where society_id = p_soc and collection = p_col and id = p_id for update;
  newd := case when old is null or p_replace then p_patch else old || p_patch end;
  newd := newd || jsonb_build_object('id', p_id, 'societyId', p_soc);
  if old is null and not newd ? 'createdAt' then newd := newd || jsonb_build_object('createdAt', now()); end if;

  if not can_write(m, p_col, p_id, old, newd) then
    raise exception 'permission_denied:%', p_col using errcode = '42501';
  end if;

  if p_col = 'bookings' and newd ->> 'status' in ('pending','confirmed') then
    if exists (
      select 1 from records b
      where b.society_id = p_soc and b.collection = 'bookings' and b.id <> p_id
        and b.data ->> 'facilityId' = newd ->> 'facilityId'
        and b.data ->> 'status' in ('pending','confirmed')
        and tstzrange((b.data ->> 'start')::timestamptz, (b.data ->> 'end')::timestamptz)
         && tstzrange((newd ->> 'start')::timestamptz, (newd ->> 'end')::timestamptz)) then
      raise exception 'slot_taken' using errcode = '23P01';
    end if;
  end if;

  insert into records (society_id, collection, id, data, updated_by)
  values (p_soc, p_col, p_id, newd, auth.uid())
  on conflict (society_id, collection, id)
  do update set data = excluded.data, updated_at = now(), updated_by = auth.uid();

  insert into changes (society_id, collection, id, op) values (p_soc, p_col, p_id, 'upsert');

  if p_col = 'users' then   -- keep login memberships in step with the resident record
    update members set role = coalesce(newd ->> 'role', 'resident'),
                       apartment_id = newd ->> 'apartmentId',
                       status = coalesce(newd ->> 'status', 'active')
    where society_id = p_soc and user_id = p_id;
  end if;
end $$;

create or replace function public.delete_record(p_society text, p_collection text, p_id text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.members := _require_member(p_society); old jsonb;
begin
  if subscription_state(p_society) = 'locked' then raise exception 'subscription_expired' using errcode = '42501'; end if;
  select data into old from records where society_id = p_society and collection = p_collection and id = p_id;
  if old is null then return; end if;
  if not can_write(m, p_collection, p_id, old, null) then
    raise exception 'permission_denied:%', p_collection using errcode = '42501';
  end if;
  delete from records where society_id = p_society and collection = p_collection and id = p_id;
  insert into changes (society_id, collection, id, op) values (p_society, p_collection, p_id, 'delete');
end $$;

create or replace function public.create_society(p_society text, p_info jsonb, p_admin jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare m public.members; ph text; em text; uid text := coalesce(p_admin ->> 'id', 'u_' || substr(md5(random()::text), 1, 10));
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_society !~ '^[a-z0-9][a-z0-9_-]{2,39}$' then raise exception 'invalid_society_code' using errcode = '22023'; end if;
  if exists (select 1 from records where society_id = p_society) then raise exception 'society_exists' using errcode = '23505'; end if;
  if coalesce(trim(p_info ->> 'name'), '') = '' then raise exception 'society_name_required' using errcode = '22023'; end if;
  select phone, email into ph, em from auth.users where id = auth.uid();

  insert into subscriptions (society_id, trial_ends) values (p_society, now() + interval '30 days')
  on conflict (society_id) do nothing;
  insert into members (auth_id, society_id, user_id, role, apartment_id, status)
  values (auth.uid(), p_society, uid, 'super_admin', p_admin ->> 'apartmentId', 'active');
  m := member_of(p_society);

  perform _write(m, p_society, 'users', uid,
    p_admin || jsonb_build_object('role', 'super_admin', 'status', 'active',
      'phone', coalesce(p_admin ->> 'phone', case when ph is null or ph = '' then null else '+' || ph end),
      'email', coalesce(p_admin ->> 'email', em)), true);
  -- societies record is written directly (can_write forbids *creating* societies)
  insert into records (society_id, collection, id, data, updated_by)
  values (p_society, 'societies', p_society, p_info || jsonb_build_object('id', p_society, 'societyId', p_society, 'createdAt', now()), auth.uid());
  insert into changes (society_id, collection, id, op) values (p_society, 'societies', p_society, 'upsert');
end $$;

revoke all on function public._write(public.members, text, text, text, jsonb, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------
--  Subscription API
-- ---------------------------------------------------------------------
-- Any member: the society's plan and status; committee also sees invoices.
create or replace function public.my_subscription(p_society text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m public.members := _require_member(p_society); s public.subscriptions; flats int; pays jsonb := '[]'::jsonb;
begin
  select * into s from subscriptions where society_id = p_society;
  select count(*) into flats from records where society_id = p_society and collection = 'apartments';
  if role_in(m.role, 'admin') or role_in(m.role, 'finance') then
    select coalesce(jsonb_agg(to_jsonb(p) - 'recorded_by' order by p.created_at desc), '[]'::jsonb) into pays
    from subscription_payments p where p.society_id = p_society;
  end if;
  return jsonb_build_object(
    'state', subscription_state(p_society), 'plan', coalesce(s.plan, 'none'), 'status', s.status,
    'pricePerFlat', coalesce(s.price_per_flat, 20), 'trialEnds', s.trial_ends, 'paidUntil', s.paid_until,
    'flats', flats, 'graceDays', 15, 'payments', pays,
    'payTo', (select data from platform_settings where id = 1));
end $$;

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where auth_id = auth.uid())
$$;

create or replace function public._require_platform_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_platform_admin() then raise exception 'permission_denied:platform' using errcode = '42501'; end if;
end $$;

-- Platform owner: every society with its usage and subscription.
create or replace function public.platform_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _require_platform_admin();
  return jsonb_build_object(
    'settings', (select data from platform_settings where id = 1),
    'societies', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from (
      select r.society_id as id, r.data ->> 'name' as name, r.data ->> 'city' as city, r.created_at,
             (select count(*) from records a where a.society_id = r.society_id and a.collection = 'apartments') as flats,
             (select count(*) from members mm where mm.society_id = r.society_id and mm.status = 'active') as logins,
             (select max(c.at) from changes c where c.society_id = r.society_id) as last_activity,
             s.plan, s.status, s.price_per_flat, s.trial_ends, s.paid_until, s.notes,
             subscription_state(r.society_id) as state,
             coalesce((select jsonb_agg(to_jsonb(p) - 'recorded_by' order by p.created_at desc) from subscription_payments p where p.society_id = r.society_id), '[]'::jsonb) as payments
      from records r left join subscriptions s on s.society_id = r.society_id
      where r.collection = 'societies') t), '[]'::jsonb));
end $$;

-- Platform owner records a payment received: extends paid_until and issues an invoice number.
create or replace function public.platform_record_payment(p_society text, p_amount numeric, p_months int, p_method text default '', p_ref text default '', p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.subscriptions; flats int; d_from date; d_to date; fy text; inv text; pay public.subscription_payments;
begin
  perform _require_platform_admin();
  if not exists (select 1 from records where society_id = p_society and collection = 'societies') then raise exception 'society_not_found' using errcode = 'P0002'; end if;
  if coalesce(p_amount, 0) < 0 or coalesce(p_months, 0) < 1 or p_months > 60 then raise exception 'invalid_payment' using errcode = '22023'; end if;
  insert into subscriptions (society_id, trial_ends) values (p_society, now()) on conflict (society_id) do nothing;
  select * into s from subscriptions where society_id = p_society for update;
  select count(*) into flats from records where society_id = p_society and collection = 'apartments';
  -- a payment during the trial starts after the trial; a renewal continues from paid-until
  d_from := greatest(coalesce(s.paid_until, '-infinity'::timestamptz), coalesce(s.trial_ends, '-infinity'::timestamptz), now())::date;
  d_to := (d_from + make_interval(months => p_months))::date;
  fy := case when extract(month from now()) >= 4 then to_char(now(), 'YYYY') || '-' || to_char(now() + interval '1 year', 'YY')
             else to_char(now() - interval '1 year', 'YYYY') || '-' || to_char(now(), 'YY') end;
  inv := 'SY/' || fy || '/' || lpad(nextval('invoice_seq')::text, 4, '0');
  insert into subscription_payments (society_id, invoice_no, amount, flats, price_per_flat, months, period_from, period_to, method, ref, note, recorded_by)
  values (p_society, inv, p_amount, flats, s.price_per_flat, p_months, d_from, d_to, coalesce(p_method, ''), coalesce(p_ref, ''), coalesce(p_note, ''), auth.uid())
  returning * into pay;
  update subscriptions set paid_until = d_to::timestamptz + interval '23 hours 59 minutes', status = case when status = 'suspended' then status else 'active' end,
         plan = case when plan = 'complimentary' then plan else 'yearly' end, updated_at = now()
  where society_id = p_society;
  return to_jsonb(pay) - 'recorded_by';
end $$;

-- Platform owner edits a subscription: price, trial end, paid-until, plan, status, notes.
create or replace function public.platform_update_subscription(p_society text, p_patch jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _require_platform_admin();
  if not exists (select 1 from records where society_id = p_society and collection = 'societies') then raise exception 'society_not_found' using errcode = 'P0002'; end if;
  if coalesce(p_patch ->> 'plan', 'yearly') not in ('yearly', 'complimentary') or coalesce(p_patch ->> 'status', 'trial') not in ('trial', 'active', 'suspended') then
    raise exception 'invalid_subscription' using errcode = '22023';
  end if;
  insert into subscriptions (society_id, trial_ends) values (p_society, now() + interval '30 days') on conflict (society_id) do nothing;
  update subscriptions set
    plan           = coalesce(p_patch ->> 'plan', plan),
    status         = coalesce(p_patch ->> 'status', status),
    price_per_flat = coalesce((p_patch ->> 'pricePerFlat')::numeric, price_per_flat),
    trial_ends     = case when p_patch ? 'trialEnds' then (p_patch ->> 'trialEnds')::timestamptz else trial_ends end,
    paid_until     = case when p_patch ? 'paidUntil' then (p_patch ->> 'paidUntil')::timestamptz else paid_until end,
    notes          = coalesce(p_patch ->> 'notes', notes),
    updated_at     = now()
  where society_id = p_society;
end $$;

-- Platform owner: business details shown on invoices and the "how to pay" box.
create or replace function public.platform_set_settings(p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _require_platform_admin();
  update platform_settings set data = coalesce(p_data, '{}'::jsonb) where id = 1;
end $$;

-- Existing societies get a 30-day trial from the day this runs (once).
insert into public.subscriptions (society_id, trial_ends)
select society_id, now() + interval '30 days' from public.records where collection = 'societies'
on conflict (society_id) do nothing;



revoke execute on function public.subscription_state(text), public._require_platform_admin() from public, anon, authenticated;
revoke execute on function public.my_subscription(text), public.is_platform_admin(), public.platform_overview(),
  public.platform_record_payment(text, numeric, int, text, text, text), public.platform_update_subscription(text, jsonb),
  public.platform_set_settings(jsonb) from public, anon;
grant execute on function public.my_subscription(text), public.is_platform_admin(), public.platform_overview(),
  public.platform_record_payment(text, numeric, int, text, text, text), public.platform_update_subscription(text, jsonb),
  public.platform_set_settings(jsonb) to authenticated;
