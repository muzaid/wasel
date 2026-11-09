-- =====================================================================
-- Wasel migration 007 — refunds, Wasel credit, coupons & discount codes, help desk / contact us
--   • Coupons: Wasel-wide (admin) or business discount codes (owner/manager). % or ₪, limits, dates.
--     A business code only works on deliveries sent TO that business; the business pays for it.
--   • Wasel credit: a wallet per user, filled by refunds paid as credit, spent at checkout.
--   • Refunds: customer / business asks with a reason (+ photo); an admin approves or rejects.
--   • Help desk: tickets with a message thread. Guests can use "Contact us" (email or phone required).
-- Run once in Supabase → SQL Editor after 006. Safe to re-run.
-- =====================================================================

-- ---------- ledger: new kinds ----------
alter table wasel_ledger drop constraint if exists wasel_ledger_kind_check;
alter table wasel_ledger add constraint wasel_ledger_kind_check check (kind in
  ('platform_fee','courier_earning','cod_collected','cod_settled','payout','adjustment','discount','refund'));

-- ---------- coupons ----------
create table if not exists wasel_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  title text,                                             -- short description shown to customers
  business_id uuid references wasel_businesses(id) on delete cascade,   -- null = Wasel coupon (admin)
  kind text not null default 'percent' check (kind in ('percent','fixed')),
  value numeric(10,2) not null check (value > 0),
  max_discount numeric(10,2),                             -- cap for % coupons
  min_price numeric(10,2) not null default 0,
  max_uses int check (max_uses is null or max_uses > 0),
  per_user_limit int not null default 1 check (per_user_limit > 0),
  used_count int not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_public boolean not null default true,                -- listed in customers' "Your coupons"
  active boolean not null default true,
  created_by uuid references wasel_profiles(id),
  created_at timestamptz not null default now(),
  constraint wasel_coupons_percent_ck check (kind <> 'percent' or value <= 100)
);
create unique index if not exists wasel_coupons_code_uq on wasel_coupons(upper(code));
create index if not exists wasel_coupons_business_idx on wasel_coupons(business_id);

create or replace function wasel_coupon_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.code := upper(regexp_replace(coalesce(new.code, ''), '\s', '', 'g'));
  if new.code !~ '^[A-Z0-9_-]{3,24}$' then raise exception 'bad_code'; end if;
  if tg_op = 'INSERT' then new.created_by := coalesce(auth.uid(), new.created_by); new.used_count := 0;
  else new.used_count := old.used_count; new.business_id := old.business_id; end if;   -- counters & owner are server-side
  return new;
end $$;
drop trigger if exists wasel_coupon_before_write on wasel_coupons;
create trigger wasel_coupon_before_write before insert or update on wasel_coupons for each row execute function wasel_coupon_before_write();

alter table wasel_coupons enable row level security;
drop policy if exists p_coupon_sel on wasel_coupons;
create policy p_coupon_sel on wasel_coupons for select using (wasel_is_admin() or wasel_is_member(business_id, 'manager'));
drop policy if exists p_coupon_ins on wasel_coupons;
create policy p_coupon_ins on wasel_coupons for insert with check (
  (business_id is null and wasel_is_admin()) or (business_id is not null and (wasel_is_member(business_id, 'manager') or wasel_is_admin())));
drop policy if exists p_coupon_upd on wasel_coupons;
create policy p_coupon_upd on wasel_coupons for update using (wasel_is_admin() or wasel_is_member(business_id, 'manager'));
drop policy if exists p_coupon_del on wasel_coupons;
create policy p_coupon_del on wasel_coupons for delete using ((wasel_is_admin() or wasel_is_member(business_id, 'manager')) and used_count = 0);

create table if not exists wasel_coupon_redemptions (
  id bigserial primary key,
  coupon_id uuid not null references wasel_coupons(id) on delete cascade,
  user_id uuid not null references wasel_profiles(id) on delete cascade,
  shipment_id uuid not null unique references wasel_shipments(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table wasel_coupon_redemptions enable row level security;
drop policy if exists p_red_sel on wasel_coupon_redemptions;
create policy p_red_sel on wasel_coupon_redemptions for select using (user_id = auth.uid() or wasel_is_admin());

-- ---------- Wasel credit (wallet) ----------
create table if not exists wasel_wallets (
  user_id uuid primary key references wasel_profiles(id) on delete cascade,
  balance numeric(10,2) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists wasel_credit_tx (
  id bigserial primary key,
  user_id uuid not null references wasel_profiles(id) on delete cascade,
  amount numeric(10,2) not null,                          -- + added, − spent
  reason text not null check (reason in ('refund','spent','returned','adjustment')),
  shipment_id uuid references wasel_shipments(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists wasel_credit_tx_user_idx on wasel_credit_tx(user_id, created_at desc);
alter table wasel_wallets enable row level security;
alter table wasel_credit_tx enable row level security;
drop policy if exists p_wallet_sel on wasel_wallets;
create policy p_wallet_sel on wasel_wallets for select using (user_id = auth.uid() or wasel_is_admin());
drop policy if exists p_ctx_sel on wasel_credit_tx;
create policy p_ctx_sel on wasel_credit_tx for select using (user_id = auth.uid() or wasel_is_admin());

-- internal: move credit (never callable from the API)
create or replace function wasel__credit(p_user uuid, p_amount numeric, p_reason text, p_shipment uuid, p_note text default null) returns numeric
language plpgsql security definer set search_path = public as $$
declare b numeric;
begin
  if p_amount = 0 then return coalesce((select balance from wasel_wallets where user_id = p_user), 0); end if;
  insert into wasel_wallets(user_id, balance) values (p_user, 0) on conflict do nothing;
  update wasel_wallets set balance = balance + p_amount, updated_at = now() where user_id = p_user returning balance into b;
  if b < 0 then raise exception 'not_enough_credit'; end if;
  insert into wasel_credit_tx(user_id, amount, reason, shipment_id, note) values (p_user, p_amount, p_reason, p_shipment, p_note);
  return b;
end $$;
revoke execute on function wasel__credit(uuid, numeric, text, uuid, text) from public, anon, authenticated;

-- ---------- shipments: discount & credit ----------
alter table wasel_shipments add column if not exists coupon_id uuid references wasel_coupons(id) on delete set null;
alter table wasel_shipments add column if not exists discount_amount numeric(10,2) not null default 0;
alter table wasel_shipments add column if not exists credit_used numeric(10,2) not null default 0;

-- the client can never set money fields itself
create or replace function wasel_shipment_money_reset() returns trigger language plpgsql as $$
begin new.coupon_id := null; new.discount_amount := 0; new.credit_used := 0; return new; end $$;
drop trigger if exists wasel_shipment_money_reset on wasel_shipments;
create trigger wasel_shipment_money_reset before insert on wasel_shipments for each row execute function wasel_shipment_money_reset();

-- discount for a coupon at a given price
create or replace function wasel_coupon_discount(c wasel_coupons, p_price numeric) returns numeric
language sql immutable as $$
  select greatest(0, least(p_price, case when c.kind = 'percent'
    then least(round(p_price * c.value / 100, 2), coalesce(c.max_discount, p_price)) else c.value end));
$$;

-- why a coupon can't be used ('' = it can)
create or replace function wasel__coupon_problem(c wasel_coupons, p_user uuid, p_price numeric, p_recipient_business uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when c.id is null or not c.active then 'coupon_not_found'
    when now() < c.starts_at then 'coupon_not_started'
    when c.ends_at is not null and now() > c.ends_at then 'coupon_expired'
    when c.max_uses is not null and c.used_count >= c.max_uses then 'coupon_used_up'
    when (select count(*) from wasel_coupon_redemptions r where r.coupon_id = c.id and r.user_id = p_user) >= c.per_user_limit then 'coupon_already_used'
    when p_price < c.min_price then 'coupon_min_price'
    when c.business_id is not null and c.business_id is distinct from p_recipient_business then 'coupon_other_business'
    else '' end;
$$;

-- live check for the checkout preview
create or replace function wasel_check_coupon(p_code text, p_price numeric, p_recipient_business uuid default null) returns json
language plpgsql stable security definer set search_path = public as $$
declare c wasel_coupons; prob text;
begin
  select * into c from wasel_coupons where upper(code) = upper(trim(p_code));
  prob := wasel__coupon_problem(c, auth.uid(), p_price, p_recipient_business);
  if prob <> '' then return json_build_object('ok', false, 'error', prob); end if;
  return json_build_object('ok', true, 'code', c.code, 'title', c.title, 'kind', c.kind, 'value', c.value,
    'discount', wasel_coupon_discount(c, p_price),
    'business', (select business_name from wasel_businesses where id = c.business_id));
end $$;
grant execute on function wasel_check_coupon(text, numeric, uuid) to anon, authenticated;

-- coupons a customer can see in "Your coupons"
create or replace function wasel_my_coupons() returns table(code text, title text, kind text, value numeric, min_price numeric,
  ends_at timestamptz, business_id uuid, business_name text, uses_left int)
language sql stable security definer set search_path = public as $$
  select c.code, c.title, c.kind, c.value, c.min_price, c.ends_at, c.business_id, b.business_name,
    c.per_user_limit - (select count(*)::int from wasel_coupon_redemptions r where r.coupon_id = c.id and r.user_id = auth.uid())
  from wasel_coupons c left join wasel_businesses b on b.id = c.business_id
  where c.active and c.is_public and now() >= c.starts_at and (c.ends_at is null or now() <= c.ends_at)
    and (c.max_uses is null or c.used_count < c.max_uses)
    and (select count(*) from wasel_coupon_redemptions r where r.coupon_id = c.id and r.user_id = auth.uid()) < c.per_user_limit
  order by c.business_id nulls first, c.created_at desc;
$$;
grant execute on function wasel_my_coupons() to authenticated;

-- apply a coupon to a delivery that is still waiting for a courier
create or replace function wasel_apply_coupon(p_id uuid, p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments; c wasel_coupons; prob text; d numeric;
begin
  select * into sh from wasel_shipments where id = p_id for update;
  if sh is null or not wasel_can_manage_shipment(p_id) then raise exception 'forbidden'; end if;
  if sh.status <> 'searching' then raise exception 'coupon_too_late'; end if;
  if sh.coupon_id is not null then raise exception 'coupon_already_applied'; end if;
  select * into c from wasel_coupons where upper(code) = upper(trim(p_code)) for update;
  prob := wasel__coupon_problem(c, sh.sender_id, sh.price, sh.recipient_business_id);
  if prob <> '' then raise exception '%', prob; end if;
  d := wasel_coupon_discount(c, sh.price);
  insert into wasel_coupon_redemptions(coupon_id, user_id, shipment_id) values (c.id, sh.sender_id, p_id);
  update wasel_coupons set used_count = used_count + 1 where id = c.id;
  update wasel_shipments set coupon_id = c.id, discount_amount = d where id = p_id;
  insert into wasel_shipment_events(shipment_id, status, note) values (p_id, 'searching', 'coupon ' || c.code);
  return json_build_object('discount', d, 'pay', sh.price - d - sh.credit_used);
end $$;
grant execute on function wasel_apply_coupon(uuid, text) to authenticated;

-- pay part of a delivery with Wasel credit (as much as possible, or up to p_max)
create or replace function wasel_apply_credit(p_id uuid, p_max numeric default null) returns numeric
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments; bal numeric; use numeric;
begin
  select * into sh from wasel_shipments where id = p_id for update;
  if sh is null or sh.sender_id is distinct from auth.uid() then raise exception 'forbidden'; end if;
  if sh.status <> 'searching' then raise exception 'coupon_too_late'; end if;
  select balance into bal from wasel_wallets where user_id = sh.sender_id for update;
  use := least(coalesce(bal, 0), greatest(0, sh.price - sh.discount_amount - sh.credit_used), coalesce(p_max, 1e9));
  if use <= 0 then return 0; end if;
  perform wasel__credit(sh.sender_id, -use, 'spent', p_id);
  update wasel_shipments set credit_used = credit_used + use where id = p_id;
  return use;
end $$;
grant execute on function wasel_apply_credit(uuid, numeric) to authenticated;

-- price changes (courier chosen / send to all): keep discount & credit consistent
create or replace function wasel_shipment_discount_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare c wasel_coupons; extra numeric;
begin
  if new.price is distinct from old.price then
    if new.coupon_id is not null then
      select * into c from wasel_coupons where id = new.coupon_id;
      if c.id is not null then new.discount_amount := wasel_coupon_discount(c, new.price); end if;
    end if;
    new.discount_amount := least(new.discount_amount, new.price);
    extra := new.credit_used - (new.price - new.discount_amount);
    if extra > 0 then                                    -- cheaper now: give the unused credit back
      new.credit_used := new.credit_used - extra;
      perform wasel__credit(new.sender_id, extra, 'returned', new.id);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists wasel_shipment_discount_sync on wasel_shipments;
create trigger wasel_shipment_discount_sync before update of price on wasel_shipments for each row execute function wasel_shipment_discount_sync();

-- delivered: record who paid the discount; cancelled / expired: give coupon & credit back
create or replace function wasel_shipment_money_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare c wasel_coupons;
begin
  if new.status = old.status then return new; end if;
  if new.status = 'delivered' and new.discount_amount > 0 then
    select * into c from wasel_coupons where id = new.coupon_id;
    insert into wasel_ledger(shipment_id, courier_id, business_id, kind, amount, note)
    values (new.id, new.courier_id, c.business_id, 'discount', new.discount_amount, 'coupon ' || coalesce(c.code, '?'));
  elsif new.status in ('cancelled', 'expired') then
    if new.credit_used > 0 then
      perform wasel__credit(new.sender_id, new.credit_used, 'returned', new.id);
      update wasel_shipments set credit_used = 0 where id = new.id;
    end if;
    if new.coupon_id is not null then
      delete from wasel_coupon_redemptions where shipment_id = new.id;
      update wasel_coupons set used_count = greatest(0, used_count - 1) where id = new.coupon_id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists wasel_shipment_money_after on wasel_shipments;
create trigger wasel_shipment_money_after after update of status on wasel_shipments for each row execute function wasel_shipment_money_after();

-- ---------- refunds ----------
create table if not exists wasel_refunds (
  id bigserial primary key,
  shipment_id uuid not null references wasel_shipments(id) on delete cascade,
  requester_id uuid not null references wasel_profiles(id) on delete cascade,
  reason text not null check (reason in ('damaged','not_picked_up','charged_twice','late','lost','other')),
  details text,
  photo_url text,
  amount numeric(10,2) not null check (amount > 0),
  method text not null default 'card' check (method in ('card','credit')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  decided_by uuid references wasel_profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists wasel_refunds_status_idx on wasel_refunds(status, created_at desc);
create index if not exists wasel_refunds_shipment_idx on wasel_refunds(shipment_id);
alter table wasel_refunds enable row level security;
drop policy if exists p_refund_sel on wasel_refunds;
create policy p_refund_sel on wasel_refunds for select using (requester_id = auth.uid() or wasel_is_admin() or wasel_can_manage_shipment(shipment_id));

create or replace function wasel__refundable(p_shipment uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select greatest(0, s.price - s.discount_amount
    - coalesce((select sum(amount) from wasel_refunds r where r.shipment_id = s.id and r.status in ('pending','approved')), 0))
  from wasel_shipments s where s.id = p_shipment;
$$;

create or replace function wasel_request_refund(p_shipment uuid, p_reason text, p_details text, p_amount numeric,
  p_photo text default null, p_method text default 'card') returns bigint
language plpgsql security definer set search_path = public as $$
declare sh wasel_shipments; rid bigint; maxv numeric;
begin
  select * into sh from wasel_shipments where id = p_shipment;
  if sh is null or auth.uid() is null or not wasel_can_manage_shipment(p_shipment) then raise exception 'forbidden'; end if;
  if sh.status not in ('delivered','cancelled','expired','accepted','arrived_pickup','picked_up','in_transit') then raise exception 'refund_not_allowed'; end if;
  if exists(select 1 from wasel_refunds where shipment_id = p_shipment and status = 'pending') then raise exception 'refund_pending'; end if;
  maxv := wasel__refundable(p_shipment);
  if p_amount is null or p_amount <= 0 or p_amount > maxv then raise exception 'refund_amount'; end if;
  insert into wasel_refunds(shipment_id, requester_id, reason, details, photo_url, amount, method)
  values (p_shipment, auth.uid(), p_reason, nullif(trim(coalesce(p_details, '')), ''), p_photo, round(p_amount, 2), coalesce(p_method, 'card'))
  returning id into rid;
  perform wasel_notify(u.user_id, 'refund_requested', sh.code || ' · ₪' || round(p_amount, 2), '/admin/refunds')
  from (select distinct user_id from wasel_user_roles where role = 'admin'
        union select id from wasel_profiles where role = 'admin') u;
  return rid;
end $$;
grant execute on function wasel_request_refund(uuid, text, text, numeric, text, text) to authenticated;

create or replace function wasel_decide_refund(p_id bigint, p_approve boolean, p_note text default null, p_method text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r wasel_refunds; sh wasel_shipments;
begin
  if not wasel_is_admin() then raise exception 'forbidden'; end if;
  select * into r from wasel_refunds where id = p_id for update;
  if r is null then raise exception 'not_found'; end if;
  if r.status <> 'pending' then raise exception 'already_decided'; end if;
  select * into sh from wasel_shipments where id = r.shipment_id;
  update wasel_refunds set status = case when p_approve then 'approved' else 'rejected' end,
    method = coalesce(p_method, method), admin_note = nullif(trim(coalesce(p_note, '')), ''),
    decided_by = auth.uid(), decided_at = now()
  where id = p_id returning * into r;
  if p_approve then
    insert into wasel_ledger(shipment_id, courier_id, business_id, kind, amount, note)
    values (sh.id, sh.courier_id, sh.business_id, 'refund', r.amount, r.method || ': ' || r.reason);
    if r.method = 'credit' then perform wasel__credit(r.requester_id, r.amount, 'refund', sh.id, 'refund #' || r.id); end if;
  end if;
  perform wasel_notify(r.requester_id, case when p_approve then 'refund_approved' else 'refund_rejected' end,
    sh.code || ' · ₪' || r.amount, '/refunds');
end $$;
grant execute on function wasel_decide_refund(bigint, boolean, text, text) to authenticated;

-- ---------- help desk / contact us ----------
create table if not exists wasel_tickets (
  id bigserial primary key,
  user_id uuid references wasel_profiles(id) on delete set null,      -- null = guest (contact form)
  name text, email text, phone text,
  role text,                                                          -- customer / business / courier / guest
  topic text not null default 'other' check (topic in ('delivery','payment','refund','coupon','account','courier','payout','business','partnership','press','complaint','other')),
  subject text not null,
  shipment_id uuid references wasel_shipments(id) on delete set null,
  status text not null default 'open' check (status in ('open','answered','solved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wasel_tickets_user_idx on wasel_tickets(user_id, updated_at desc);
create index if not exists wasel_tickets_status_idx on wasel_tickets(status, updated_at desc);
create table if not exists wasel_ticket_messages (
  id bigserial primary key,
  ticket_id bigint not null references wasel_tickets(id) on delete cascade,
  sender_id uuid references wasel_profiles(id) on delete set null,
  is_staff boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists wasel_ticket_messages_idx on wasel_ticket_messages(ticket_id, created_at);
alter table wasel_tickets enable row level security;
alter table wasel_ticket_messages enable row level security;
drop policy if exists p_ticket_sel on wasel_tickets;
create policy p_ticket_sel on wasel_tickets for select using ((user_id is not null and user_id = auth.uid()) or wasel_is_admin());
drop policy if exists p_tmsg_sel on wasel_ticket_messages;
create policy p_tmsg_sel on wasel_ticket_messages for select using (
  wasel_is_admin() or exists(select 1 from wasel_tickets t where t.id = ticket_id and t.user_id is not null and t.user_id = auth.uid()));

create or replace function wasel__notify_admins(p_title text, p_body text, p_link text) returns void
language sql security definer set search_path = public as $$
  select wasel_notify(u.id, p_title, p_body, p_link) from (
    select user_id as id from wasel_user_roles where role = 'admin' union select id from wasel_profiles where role = 'admin') u;
$$;
revoke execute on function wasel__notify_admins(text, text, text) from public, anon, authenticated;

create or replace function wasel_open_ticket(p_topic text, p_subject text, p_body text, p_name text default null,
  p_email text default null, p_phone text default null, p_shipment uuid default null, p_role text default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); tid bigint; pr wasel_profiles;
begin
  if coalesce(trim(p_subject), '') = '' or coalesce(trim(p_body), '') = '' then raise exception 'message_required'; end if;
  if length(p_body) > 4000 or length(p_subject) > 200 then raise exception 'message_too_long'; end if;
  if me is null and coalesce(trim(p_email), '') = '' and coalesce(trim(p_phone), '') = '' then raise exception 'contact_required'; end if;
  if p_shipment is not null and (me is null or not wasel_can_see_shipment(p_shipment)) then raise exception 'forbidden'; end if;
  if me is not null then select * into pr from wasel_profiles where id = me; end if;
  insert into wasel_tickets(user_id, name, email, phone, role, topic, subject, shipment_id)
  values (me, coalesce(nullif(trim(p_name), ''), pr.full_name), nullif(trim(coalesce(p_email, '')), ''),
          coalesce(nullif(trim(coalesce(p_phone, '')), ''), pr.phone), coalesce(p_role, case when me is null then 'guest' end),
          coalesce(p_topic, 'other'), trim(p_subject), p_shipment)
  returning id into tid;
  insert into wasel_ticket_messages(ticket_id, sender_id, is_staff, body) values (tid, me, false, trim(p_body));
  perform wasel__notify_admins('ticket_new', trim(p_subject), '/admin/tickets/' || tid);
  return tid;
end $$;
grant execute on function wasel_open_ticket(text, text, text, text, text, text, uuid, text) to anon, authenticated;

create or replace function wasel_ticket_reply(p_ticket bigint, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare t wasel_tickets; staff boolean := wasel_is_admin();
begin
  select * into t from wasel_tickets where id = p_ticket for update;
  if t is null or auth.uid() is null or (not staff and t.user_id is distinct from auth.uid()) then raise exception 'forbidden'; end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'message_required'; end if;
  insert into wasel_ticket_messages(ticket_id, sender_id, is_staff, body) values (p_ticket, auth.uid(), staff, trim(p_body));
  update wasel_tickets set status = case when staff then 'answered' else 'open' end, updated_at = now() where id = p_ticket;
  if staff and t.user_id is not null then perform wasel_notify(t.user_id, 'ticket_answered', t.subject, '/help/' || p_ticket);
  elsif not staff then perform wasel__notify_admins('ticket_reply', t.subject, '/admin/tickets/' || p_ticket); end if;
end $$;
grant execute on function wasel_ticket_reply(bigint, text) to authenticated;

create or replace function wasel_ticket_status(p_ticket bigint, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare t wasel_tickets;
begin
  select * into t from wasel_tickets where id = p_ticket;
  if t is null or auth.uid() is null or (not wasel_is_admin() and t.user_id is distinct from auth.uid()) then raise exception 'forbidden'; end if;
  if p_status not in ('open','answered','solved') then raise exception 'invalid_transition'; end if;
  update wasel_tickets set status = p_status, updated_at = now() where id = p_ticket;
end $$;
grant execute on function wasel_ticket_status(bigint, text) to authenticated;

-- realtime for the help-desk thread and refunds (best effort; ignore if already added)
do $$ begin alter publication supabase_realtime add table wasel_ticket_messages; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table wasel_refunds; exception when others then null; end $$;

-- ---------- "About us" numbers (public, totals only) ----------
create or replace function wasel_public_stats() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'deliveries', (select count(*) from wasel_shipments where status = 'delivered'),
    'couriers', (select count(*) from wasel_couriers where verification = 'approved'));
$$;
grant execute on function wasel_public_stats() to anon, authenticated;
