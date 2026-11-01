-- =====================================================================
--  Sociyo – Supabase database setup
--  Run this ONCE in your Supabase project: SQL Editor → New query →
--  paste this whole file → Run.  It is safe to run again (idempotent).
--
--  Design
--  • Every piece of society data (flats, residents, bills, complaints…) is a
--    JSON document in public.records, keyed by (society_id, collection, id).
--    This mirrors the app's data layer one-to-one.
--  • Clients never touch the tables directly. All reads and writes go through
--    the SECURITY DEFINER functions below, which check membership and role
--    for every single record (see can_write / visible_record).
--  • public.members links a Supabase login (phone or email) to a resident
--    record and caches their role, flat and status.
--  • public.changes is a tiny change-log (no personal data) that phones
--    subscribe to through Supabase Realtime, then pull what changed.
-- =====================================================================

create extension if not exists pgcrypto;

create table if not exists public.records (
  society_id  text        not null,
  collection  text        not null,
  id          text        not null,
  data        jsonb       not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  primary key (society_id, collection, id)
);

create table if not exists public.members (
  auth_id      uuid        not null references auth.users(id) on delete cascade,
  society_id   text        not null,
  user_id      text        not null,
  role         text        not null default 'resident',
  apartment_id text,
  status       text        not null default 'active',
  created_at   timestamptz not null default now(),
  primary key (auth_id, society_id)
);

create table if not exists public.changes (
  seq        bigserial   primary key,
  society_id text        not null,
  collection text        not null,
  id         text        not null,
  op         text        not null,
  at         timestamptz not null default now()
);
create index if not exists changes_society_seq on public.changes (society_id, seq);
create index if not exists changes_at on public.changes (at);

alter table public.records enable row level security;
alter table public.members enable row level security;
alter table public.changes enable row level security;
revoke all on public.records, public.members from anon, authenticated;
revoke all on public.changes from anon;
grant select on public.changes to authenticated;

-- ---------------------------------------------------------------------
--  Membership & roles
-- ---------------------------------------------------------------------
create or replace function public.member_of(p_soc text) returns public.members
language sql stable security definer set search_path = public as $$
  select * from public.members
  where auth_id = auth.uid() and society_id = p_soc and status = 'active'
  limit 1
$$;

create or replace function public.is_member(p_soc text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members
                 where auth_id = auth.uid() and society_id = p_soc and status = 'active')
$$;

-- Role groups – must match src/lib/rbac.js
create or replace function public.role_in(p_role text, p_group text) returns boolean
language sql immutable as $$
  select coalesce(p_role = any (case p_group
    when 'admin'        then array['super_admin','chairman','secretary']
    when 'publish'      then array['super_admin','chairman','secretary','committee']
    when 'moderate'     then array['super_admin','chairman','secretary','committee']
    when 'finance'      then array['super_admin','chairman','treasurer']
    when 'finance_view' then array['super_admin','chairman','treasurer','secretary']
    when 'complaints'   then array['super_admin','chairman','secretary','committee','facility_manager']
    when 'facilities'   then array['super_admin','chairman','secretary','facility_manager']
    when 'gate'         then array['security','super_admin']
    when 'visitor_logs' then array['super_admin','chairman','secretary','security','facility_manager']
    when 'contact_view' then array['super_admin','chairman','secretary','security','facility_manager']
    else array[]::text[] end), false)
$$;

drop policy if exists changes_read on public.changes;
create policy changes_read on public.changes for select to authenticated
  using (public.is_member(society_id));

-- ---------------------------------------------------------------------
--  Helpers for "may only change these fields / only my own items"
-- ---------------------------------------------------------------------
create or replace function public.only_changed(o jsonb, n jsonb, allowed text[]) returns boolean
language sql immutable as $$
  -- 'updatedAt' is a bookkeeping timestamp the app sets on every edit
  select (coalesce(o, '{}'::jsonb) - (allowed || array['updatedAt'])) = (coalesce(n, '{}'::jsonb) - (allowed || array['updatedAt']))
$$;

-- Arrays of ids (likes, readBy …): items added or removed must be my own id.
create or replace function public.ids_delta_ok(o jsonb, n jsonb, me text) returns boolean
language sql immutable as $$
  select not exists (
    (select x from jsonb_array_elements_text(coalesce(n, '[]'::jsonb)) x
     except select x from jsonb_array_elements_text(coalesce(o, '[]'::jsonb)) x)
    union
    (select x from jsonb_array_elements_text(coalesce(o, '[]'::jsonb)) x
     except select x from jsonb_array_elements_text(coalesce(n, '[]'::jsonb)) x)
    except select me)
$$;

-- Arrays of objects (comments, rsvps …): others' items must stay unchanged,
-- and anything new must carry my id in field `k`.
create or replace function public.objs_delta_ok(o jsonb, n jsonb, me text, k text default 'userId') returns boolean
language sql immutable as $$
  select not exists (select 1 from jsonb_array_elements(coalesce(o, '[]'::jsonb)) e
                     where e ->> k is distinct from me and not coalesce(n, '[]'::jsonb) @> jsonb_build_array(e))
     and not exists (select 1 from jsonb_array_elements(coalesce(n, '[]'::jsonb)) e
                     where e ->> k is distinct from me and not coalesce(o, '[]'::jsonb) @> jsonb_build_array(e))
$$;

-- A vote may only ADD one ballot, cast by me, with the right voter key,
-- on an open poll, and never twice for the same flat/person.
create or replace function public.vote_ok(o jsonb, n jsonb, m public.members) returns boolean
language plpgsql stable as $$
declare
  ov jsonb := coalesce(o -> 'votes', '[]'::jsonb);
  nv jsonb := coalesce(n -> 'votes', '[]'::jsonb);
  added jsonb;
  key text;
begin
  if jsonb_array_length(nv) <> jsonb_array_length(ov) + 1 or not nv @> ov then return false; end if;
  select e into added from jsonb_array_elements(nv) e where not ov @> jsonb_build_array(e) limit 1;
  if added ->> 'userId' is distinct from m.user_id then return false; end if;
  key := case when (o ->> 'eligibility') in ('apartment', 'owners') then m.apartment_id else m.user_id end;
  if key is null or added ->> 'voterKey' is distinct from key then return false; end if;
  if exists (select 1 from jsonb_array_elements(ov) e where e ->> 'voterKey' = key) then return false; end if;
  if (o ->> 'closesAt')::timestamptz <= now() then return false; end if;
  return true;
end $$;

-- ---------------------------------------------------------------------
--  Write permissions – one place, per collection.  n is null for delete.
-- ---------------------------------------------------------------------
create or replace function public.can_write(m public.members, p_col text, p_id text, o jsonb, n jsonb)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  me  text := m.user_id;
  r   text := m.role;
  apt text := m.apartment_id;
  creating boolean := o is null;
  fac jsonb;
begin
  -- deletes
  if n is null then
    return case p_col
      when 'posts'         then o ->> 'userId' = me or role_in(r, 'moderate')
      when 'announcements' then role_in(r, 'publish')
      when 'aptCharges'    then role_in(r, 'finance')
      when 'notifications' then o ->> 'userId' = me
      else role_in(r, 'admin') end;
  end if;

  case p_col
  when 'societies' then
    return not creating and role_in(r, 'admin');

  when 'towers', 'apartments', 'alerts', 'registrations' then
    return role_in(r, 'admin');

  when 'users' then
    if role_in(r, 'admin') then
      -- only a super admin can create another super admin
      if n ->> 'role' = 'super_admin' and r <> 'super_admin' and coalesce(o ->> 'role', '') <> 'super_admin' then return false; end if;
      return true;
    end if;
    if creating then   -- a resident adding a family member with their own login
      return n ->> 'familyOf' = me and n ->> 'apartmentId' = apt and n ->> 'role' = 'resident'
         and coalesce(n ->> 'status', 'active') = 'active';
    end if;
    if p_id = me then
      return only_changed(o, n, array['name','phone','email','bio','avatar','color','privacy','prefs','family','vehicles','emergencyContact']);
    end if;
    return false;

  when 'staff', 'contacts', 'facilities' then
    return role_in(r, 'facilities');

  when 'announcements' then
    if role_in(r, 'publish') then return true; end if;
    return not creating and only_changed(o, n, array['readBy','ackBy'])
       and ids_delta_ok(o -> 'readBy', n -> 'readBy', me) and ids_delta_ok(o -> 'ackBy', n -> 'ackBy', me);

  when 'posts' then
    if creating then return n ->> 'userId' = me and coalesce((n ->> 'hidden')::boolean, false) = false; end if;
    if role_in(r, 'moderate') then return true; end if;
    if o ->> 'userId' = me then
      return only_changed(o, n, array['text','media','category','showApartment','likes','comments','reports'])
         and ids_delta_ok(o -> 'likes', n -> 'likes', me) and objs_delta_ok(o -> 'reports', n -> 'reports', me);
    end if;
    return only_changed(o, n, array['likes','comments','reports'])
       and ids_delta_ok(o -> 'likes', n -> 'likes', me)
       and objs_delta_ok(o -> 'comments', n -> 'comments', me)
       and objs_delta_ok(o -> 'reports', n -> 'reports', me);

  when 'complaints' then
    if role_in(r, 'complaints') then return true; end if;
    if creating then
      return n ->> 'userId' = me and n ->> 'status' = 'submitted' and n ->> 'assigneeId' is null;
    end if;
    if o ->> 'userId' is distinct from me then return false; end if;
    return only_changed(o, n, array['comments','history','status','rating','feedback','reopenCount'])
       and (n ->> 'status' = o ->> 'status' or n ->> 'status' in ('submitted','closed'))
       and objs_delta_ok(o -> 'comments', n -> 'comments', me)
       and objs_delta_ok(o -> 'history', n -> 'history', me, 'by');

  when 'settings' then
    if p_id = 'ticketSeq' then   -- any member raising a ticket bumps the counter
      return coalesce((n ->> 'value')::int, 0) > coalesce((o ->> 'value')::int, 0);
    end if;
    if p_id = 'billing' then return role_in(r, 'finance'); end if;
    return role_in(r, 'admin');

  when 'bills' then
    -- only the treasurer/chairman/super admin can mark a bill paid (after verifying the money)
    return role_in(r, 'finance');

  when 'payments' then
    if role_in(r, 'finance') then return true; end if;
    -- a resident reports "I have paid" (UPI/bank ref); it stays pending until verified
    return creating and n ->> 'apartmentId' = apt and n ->> 'userId' = me and n ->> 'status' = 'pending';

  when 'aptCharges' then
    return role_in(r, 'finance');

  when 'visitors' then
    if role_in(r, 'gate') then return true; end if;
    if creating then
      return n ->> 'apartmentId' = apt and n ->> 'hostId' = me and n ->> 'status' = 'preapproved';
    end if;
    return o ->> 'apartmentId' = apt
       and n ->> 'status' in ('approved','rejected','cancelled')
       and only_changed(o, n, array['status','respondedBy','respondedAt']);

  when 'bookings' then
    if role_in(r, 'facilities') then return true; end if;
    if creating then
      select data into fac from records where society_id = m.society_id and collection = 'facilities' and id = n ->> 'facilityId';
      if fac is null or coalesce((fac ->> 'active')::boolean, true) = false then return false; end if;
      return n ->> 'apartmentId' = apt and n ->> 'userId' = me
         and (n ->> 'status' = 'pending' or (n ->> 'status' = 'confirmed' and coalesce((fac ->> 'requiresApproval')::boolean, false) = false))
         and (n ->> 'start')::timestamptz > now();
    end if;
    return o ->> 'apartmentId' = apt and n ->> 'status' = 'cancelled'
       and only_changed(o, n, array['status','cancelledBy']);

  when 'listings' then
    if creating then return n ->> 'userId' = me; end if;
    return o ->> 'userId' = me or role_in(r, 'moderate');

  when 'events' then
    if creating then return n ->> 'organizerId' = me and r <> 'security'; end if;
    if o ->> 'organizerId' = me or role_in(r, 'publish') then return true; end if;
    -- attendees: their own RSVP, reminder, photos, the expenses they paid and
    -- payments between attendees that they made or received
    return only_changed(o, n, array['rsvps','reminders','gallery','expenses','settlements'])
       and objs_delta_ok(o -> 'rsvps', n -> 'rsvps', me)
       and ids_delta_ok(o -> 'reminders', n -> 'reminders', me)
       and objs_delta_ok(o -> 'gallery', n -> 'gallery', me)
       and objs_delta_ok(o -> 'expenses', n -> 'expenses', me)
       and objs_delta_ok(o -> 'settlements', n -> 'settlements', me)
       and not exists (select 1 from jsonb_array_elements(coalesce(n -> 'settlements', '[]'::jsonb)) x
                       where not coalesce(o -> 'settlements', '[]'::jsonb) @> jsonb_build_array(x)
                         and x ->> 'from' is distinct from me and x ->> 'to' is distinct from me);

  when 'polls' then
    if creating then return role_in(r, 'publish') and n ->> 'createdBy' = me and coalesce(jsonb_array_length(n -> 'votes'), 0) = 0; end if;
    if role_in(r, 'publish') and only_changed(o, n, array['closesAt','question','description']) then return true; end if;
    return only_changed(o, n, array['votes']) and vote_ok(o, n, m);

  when 'notifications' then
    if creating then return true; end if;
    return o ->> 'userId' = me and only_changed(o, n, array['read']);

  else
    return role_in(r, 'admin');
  end case;
end $$;

-- ---------------------------------------------------------------------
--  Read filter – what a member may see of each record (null = hidden)
-- ---------------------------------------------------------------------
create or replace function public.visible_record(m public.members, p_col text, p_id text, d jsonb)
returns jsonb language plpgsql stable as $$
declare p jsonb;
begin
  case p_col
  when 'bills', 'payments' then
    if d ->> 'apartmentId' = m.apartment_id or role_in(m.role, 'finance_view') then return d; end if;
    return null;
  when 'notifications' then
    return case when d ->> 'userId' = m.user_id then d end;
  when 'registrations' then
    return case when role_in(m.role, 'admin') then d end;
  when 'complaints' then
    if role_in(m.role, 'complaints') then return d; end if;
    if d ->> 'userId' = m.user_id or (m.apartment_id is not null and d ->> 'apartmentId' = m.apartment_id) then
      return d - 'internalNotes';
    end if;
    return null;
  when 'visitors' then
    if role_in(m.role, 'visitor_logs') or d ->> 'apartmentId' = m.apartment_id then return d; end if;
    return null;
  when 'users' then
    if p_id = m.user_id or role_in(m.role, 'contact_view')
       or (m.apartment_id is not null and d ->> 'apartmentId' = m.apartment_id) then
      return d;
    end if;
    p := coalesce(d -> 'privacy', '{}'::jsonb);
    d := d - 'vehicles' - 'emergencyContact';
    if coalesce((p ->> 'showPhone')::boolean, false) = false then d := d - 'phone'; end if;
    if coalesce((p ->> 'showEmail')::boolean, false) = false then d := d - 'email'; end if;
    if coalesce((p ->> 'showFamily')::boolean, false) = false then d := d - 'family'; end if;
    if (p ->> 'showApartment') = 'false' then d := d - 'apartmentId'; end if;
    return d;
  else
    return d;
  end case;
end $$;

-- ---------------------------------------------------------------------
--  Internal write (used by save_record / save_records / create_society)
-- ---------------------------------------------------------------------
create or replace function public._write(m public.members, p_soc text, p_col text, p_id text, p_patch jsonb, p_replace boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  old jsonb;
  newd jsonb;
begin
  if p_col !~ '^[A-Za-z]{2,30}$' or p_id is null or length(p_id) > 120 then
    raise exception 'invalid_record' using errcode = '22023';
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
revoke all on function public._write(public.members, text, text, text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.can_write(public.members, text, text, jsonb, jsonb) from public, anon, authenticated;

create or replace function public._require_member(p_soc text) returns public.members
language plpgsql stable security definer set search_path = public as $$
declare m public.members;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  m := member_of(p_soc);
  if m.auth_id is null then raise exception 'not_member' using errcode = '42501'; end if;
  return m;
end $$;

-- ---------------------------------------------------------------------
--  Public API (called from the app with supabase.rpc)
-- ---------------------------------------------------------------------
create or replace function public.save_record(p_society text, p_collection text, p_id text, p_data jsonb, p_replace boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _write(_require_member(p_society), p_society, p_collection, p_id, p_data, p_replace);
end $$;

create or replace function public.save_records(p_society text, p_rows jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare m public.members := _require_member(p_society); r jsonb; n int := 0;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    perform _write(m, p_society, r ->> 'c', r ->> 'id', r -> 'd', coalesce((r ->> 'replace')::boolean, false));
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.delete_record(p_society text, p_collection text, p_id text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.members := _require_member(p_society); old jsonb;
begin
  select data into old from records where society_id = p_society and collection = p_collection and id = p_id;
  if old is null then return; end if;
  if not can_write(m, p_collection, p_id, old, null) then
    raise exception 'permission_denied:%', p_collection using errcode = '42501';
  end if;
  delete from records where society_id = p_society and collection = p_collection and id = p_id;
  insert into changes (society_id, collection, id, op) values (p_society, p_collection, p_id, 'delete');
end $$;

-- Everything this member may see, plus the change-log position to sync from.
create or replace function public.fetch_society(p_society text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m public.members := _require_member(p_society); rows jsonb; last bigint;
begin
  select coalesce(max(seq), 0) into last from changes where society_id = p_society;
  select coalesce(jsonb_agg(jsonb_build_object('c', r.collection, 'd', v.d)), '[]'::jsonb) into rows
  from records r
  cross join lateral (select visible_record(m, r.collection, r.id, r.data) as d) v
  where r.society_id = p_society and v.d is not null;
  return jsonb_build_object('seq', last, 'records', rows, 'member', to_jsonb(m) - 'auth_id');
end $$;

-- Only what changed since `p_since` (cheap; used after a realtime ping or on a timer).
create or replace function public.fetch_changes(p_society text, p_since bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m public.members := _require_member(p_society); last bigint; recs jsonb; dels jsonb;
begin
  select coalesce(max(seq), p_since) into last from changes where society_id = p_society;
  with ch as (select distinct collection, id from changes where society_id = p_society and seq > p_since),
  j as (
    select ch.collection, ch.id, r.data, case when r.data is null then null else visible_record(m, ch.collection, ch.id, r.data) end as v
    from ch left join records r on r.society_id = p_society and r.collection = ch.collection and r.id = ch.id)
  select coalesce(jsonb_agg(jsonb_build_object('c', collection, 'd', v)) filter (where v is not null), '[]'::jsonb),
         coalesce(jsonb_agg(jsonb_build_object('c', collection, 'id', id)) filter (where data is null), '[]'::jsonb)
  into recs, dels from j;
  return jsonb_build_object('seq', last, 'records', recs, 'deleted', dels);
end $$;

-- After OTP login: link this login to resident records with the same phone/email.
create or replace function public.link_member()
returns jsonb language plpgsql security definer set search_path = public as $$
declare ph text; em text; out jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10), lower(nullif(email, ''))
  into ph, em from auth.users where id = auth.uid();

  insert into members (auth_id, society_id, user_id, role, apartment_id, status)
  select distinct on (r.society_id) auth.uid(), r.society_id, r.id,
         coalesce(r.data ->> 'role', 'resident'), r.data ->> 'apartmentId', coalesce(r.data ->> 'status', 'active')
  from records r
  where r.collection = 'users'
    and ((length(ph) = 10 and right(regexp_replace(coalesce(r.data ->> 'phone', ''), '\D', '', 'g'), 10) = ph)
      or (em is not null and lower(r.data ->> 'email') = em))
  order by r.society_id, (r.data ->> 'status' = 'active') desc, r.created_at
  on conflict (auth_id, society_id) do update
    set user_id = excluded.user_id, role = excluded.role, apartment_id = excluded.apartment_id, status = excluded.status;

  select coalesce(jsonb_agg(jsonb_build_object('societyId', society_id, 'userId', user_id, 'role', role, 'status', status)), '[]'::jsonb)
  into out from members where auth_id = auth.uid();
  return out;
end $$;

-- Start a brand-new society; the caller becomes its Super Admin.
create or replace function public.create_society(p_society text, p_info jsonb, p_admin jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare m public.members; ph text; em text; uid text := coalesce(p_admin ->> 'id', 'u_' || substr(md5(random()::text), 1, 10));
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_society !~ '^[a-z0-9][a-z0-9_-]{2,39}$' then raise exception 'invalid_society_code' using errcode = '22023'; end if;
  if exists (select 1 from records where society_id = p_society) then raise exception 'society_exists' using errcode = '23505'; end if;
  if coalesce(trim(p_info ->> 'name'), '') = '' then raise exception 'society_name_required' using errcode = '22023'; end if;
  select phone, email into ph, em from auth.users where id = auth.uid();

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

-- Before joining: the society name, towers and flats (no resident data) for the sign-up form.
create or replace function public.society_directory(p_society text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'society', (select data - 'address' - 'regNo' from records where society_id = p_society and collection = 'societies' and id = p_society),
    'towers', coalesce((select jsonb_agg(data) from records where society_id = p_society and collection = 'towers'), '[]'::jsonb),
    'apartments', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'number', data ->> 'number', 'tower', data ->> 'tower', 'type', data ->> 'type'))
                            from records where society_id = p_society and collection = 'apartments'), '[]'::jsonb))
  where auth.uid() is not null
$$;

-- A signed-in person who is not yet a member asks to join a flat.
create or replace function public.submit_registration(p_society text, p_data jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare rid text := 'reg_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12); ph text; em text;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from records where society_id = p_society and collection = 'societies') then raise exception 'society_not_found' using errcode = 'P0002'; end if;
  if is_member(p_society) then raise exception 'already_member' using errcode = '23505'; end if;
  if not exists (select 1 from records where society_id = p_society and collection = 'apartments' and id = p_data ->> 'apartmentId') then raise exception 'apartment_not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from records where society_id = p_society and collection = 'registrations' and data ->> 'authId' = auth.uid()::text and data ->> 'status' = 'pending') then
    raise exception 'registration_pending' using errcode = '23505';
  end if;
  if coalesce(trim(p_data ->> 'name'), '') = '' then raise exception 'name_required' using errcode = '22023'; end if;
  select phone, email into ph, em from auth.users where id = auth.uid();
  insert into records (society_id, collection, id, data, updated_by) values (p_society, 'registrations', rid,
    jsonb_build_object('id', rid, 'societyId', p_society, 'name', trim(p_data ->> 'name'),
      'phone', coalesce(nullif(p_data ->> 'phone', ''), case when ph is null or ph = '' then '' else '+' || ph end),
      'email', coalesce(nullif(p_data ->> 'email', ''), em, ''),
      'apartmentId', p_data ->> 'apartmentId', 'occupancy', coalesce(p_data ->> 'occupancy', 'owner'),
      'status', 'pending', 'authId', auth.uid()::text, 'createdAt', now()), auth.uid());
  insert into changes (society_id, collection, id, op) values (p_society, 'registrations', rid, 'upsert');
  return rid;
end $$;

create or replace function public.my_registrations()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(data || jsonb_build_object('societyName',
           (select s.data ->> 'name' from records s where s.society_id = r.society_id and s.collection = 'societies' limit 1))), '[]'::jsonb)
  from records r where collection = 'registrations' and data ->> 'authId' = auth.uid()::text
$$;

-- Keep the change-log small (it only needs to cover phones that were offline briefly).
create or replace function public.prune_changes() returns void
language sql security definer set search_path = public as $$
  delete from changes where at < now() - interval '7 days'
$$;

-- Function permissions: signed-in users only.
revoke execute on function public.save_record(text, text, text, jsonb, boolean), public.save_records(text, jsonb),
  public.delete_record(text, text, text), public.fetch_society(text), public.fetch_changes(text, bigint),
  public.link_member(), public.create_society(text, jsonb, jsonb), public.society_directory(text),
  public.submit_registration(text, jsonb), public.my_registrations(), public.prune_changes() from public, anon;
grant execute on function public.save_record(text, text, text, jsonb, boolean), public.save_records(text, jsonb),
  public.delete_record(text, text, text), public.fetch_society(text), public.fetch_changes(text, bigint),
  public.link_member(), public.create_society(text, jsonb, jsonb), public.society_directory(text),
  public.submit_registration(text, jsonb), public.my_registrations() to authenticated;

-- ---------------------------------------------------------------------
--  Realtime: phones listen to the change-log for their society
-- ---------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'changes') then
    execute 'alter publication supabase_realtime add table public.changes';
  end if;
end $$;

-- ---------------------------------------------------------------------
--  Photo & document storage (bucket "media", files under <society>/…)
-- ---------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('media', 'media', true, 15728640)
    on conflict (id) do nothing;
    execute 'drop policy if exists "members upload media" on storage.objects';
    execute $p$create policy "members upload media" on storage.objects for insert to authenticated
      with check (bucket_id = 'media' and public.is_member((storage.foldername(name))[1]))$p$;
  end if;
end $$;
