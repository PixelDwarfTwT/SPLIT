create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table private.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
revoke all on private.admin_users from public, anon, authenticated;

create or replace function private.is_patungan_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.admin_users where user_id = (select auth.uid()));
$$;

create or replace function public.is_patungan_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select private.is_patungan_admin(); $$;
revoke all on function public.is_patungan_admin() from public, anon;
grant execute on function public.is_patungan_admin() to authenticated;
revoke all on function private.is_patungan_admin() from public, anon;
grant execute on function private.is_patungan_admin() to authenticated;

create table public.bill_sessions (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft' check (status in ('draft', 'completed')),
  total_amount bigint not null default 0 check (total_amount between 0 and 9007199254740991),
  menu_count integer not null default 0 check (menu_count >= 0),
  total_portions integer not null default 0 check (total_portions >= 0),
  people_with_orders integer not null default 0 check (people_with_orders >= 0 and people_with_orders <= 20),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.participants (
  id uuid primary key,
  session_id uuid not null references public.bill_sessions(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, session_id)
);
create unique index participants_unique_name_per_session
  on public.participants (session_id, lower(btrim(name)));
create index participants_session_idx on public.participants(session_id, sort_order);

create or replace function private.enforce_participant_cap()
returns trigger language plpgsql set search_path = '' as $$
declare participant_count integer;
begin
  perform 1 from public.bill_sessions where id = new.session_id and status = 'draft' for update;
  if not found then raise exception 'Perhitungan selesai tidak dapat diubah.'; end if;
  select count(*) into participant_count from public.participants where session_id = new.session_id and id <> new.id;
  if participant_count >= 20 then raise exception 'Maksimal 20 peserta.'; end if;
  return new;
end;
$$;
create trigger participants_cap_before_write before insert or update on public.participants
for each row execute function private.enforce_participant_cap();

create table public.menu_items (
  id uuid primary key,
  session_id uuid not null references public.bill_sessions(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  unit_price bigint not null check (unit_price between 1 and 9007199254740991),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, session_id)
);
create index menu_items_session_idx on public.menu_items(session_id, sort_order);

create table public.menu_item_orders (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  menu_item_id uuid not null,
  participant_id uuid not null,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (menu_item_id, participant_id),
  foreign key (menu_item_id, session_id) references public.menu_items(id, session_id) on delete cascade,
  foreign key (participant_id, session_id) references public.participants(id, session_id) on delete cascade
);
create index menu_orders_session_idx on public.menu_item_orders(session_id);

create table public.participant_payments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  participant_id uuid not null,
  amount bigint not null default 0 check (amount between 0 and 9007199254740991),
  created_at timestamptz not null default now(),
  unique (session_id, participant_id),
  foreign key (participant_id, session_id) references public.participants(id, session_id) on delete cascade
);

create or replace function private.guard_draft_session()
returns trigger language plpgsql set search_path = '' as $$
declare target_session uuid; session_status text;
begin
  if tg_table_name = 'bill_sessions' then
    target_session := old.id;
  else
    target_session := coalesce(new.session_id, old.session_id);
  end if;
  select status into session_status from public.bill_sessions where id = target_session;
  if session_status is distinct from 'draft' then raise exception 'Perhitungan selesai tidak dapat diubah.'; end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
create trigger bill_sessions_immutable before update or delete on public.bill_sessions
for each row when (old.status = 'completed') execute function private.guard_draft_session();
create trigger menu_items_draft_guard before insert or update or delete on public.menu_items
for each row execute function private.guard_draft_session();
create trigger participants_draft_guard before delete on public.participants
for each row execute function private.guard_draft_session();
create trigger menu_orders_draft_guard before insert or update or delete on public.menu_item_orders
for each row execute function private.guard_draft_session();
create trigger payments_draft_guard before insert or update or delete on public.participant_payments
for each row execute function private.guard_draft_session();

alter table public.bill_sessions enable row level security;
alter table public.participants enable row level security;
alter table public.menu_items enable row level security;
alter table public.menu_item_orders enable row level security;
alter table public.participant_payments enable row level security;

create policy admin_all_bill_sessions on public.bill_sessions for all to authenticated
using (private.is_patungan_admin()) with check (private.is_patungan_admin());
create policy admin_all_participants on public.participants for all to authenticated
using (private.is_patungan_admin()) with check (private.is_patungan_admin());
create policy admin_all_menu_items on public.menu_items for all to authenticated
using (private.is_patungan_admin()) with check (private.is_patungan_admin());
create policy admin_all_menu_orders on public.menu_item_orders for all to authenticated
using (private.is_patungan_admin()) with check (private.is_patungan_admin());
create policy admin_all_payments on public.participant_payments for all to authenticated
using (private.is_patungan_admin()) with check (private.is_patungan_admin());

revoke all on public.bill_sessions, public.participants, public.menu_items,
  public.menu_item_orders, public.participant_payments from public, anon, authenticated;
grant select on public.bill_sessions, public.participants,
  public.menu_items, public.menu_item_orders, public.participant_payments to authenticated;

create or replace function public.create_or_get_bill_session()
returns uuid language plpgsql security definer set search_path = '' as $$
declare found_id uuid;
begin
  if not private.is_patungan_admin() then raise exception 'Akses ditolak.'; end if;
  select id into found_id from public.bill_sessions where status = 'draft' order by created_at desc limit 1;
  if found_id is null then
    insert into public.bill_sessions(created_by) values (auth.uid()) returning id into found_id;
  end if;
  return found_id;
end;
$$;
revoke all on function public.create_or_get_bill_session() from public, anon;
grant execute on function public.create_or_get_bill_session() to authenticated;

create or replace function public.save_bill_draft(
  p_session_id uuid, p_participants jsonb, p_menus jsonb, p_payments jsonb
)
returns void language plpgsql security definer set search_path = '' as $$
declare p jsonb; m jsonb; o jsonb; pay record; order_count integer;
begin
  if not private.is_patungan_admin() then raise exception 'Akses ditolak.'; end if;
  perform 1 from public.bill_sessions where id = p_session_id and status = 'draft' for update;
  if not found then raise exception 'Perhitungan tidak ditemukan atau sudah selesai.'; end if;
  if jsonb_typeof(p_participants) is distinct from 'array' or jsonb_array_length(p_participants) > 20 then
    raise exception 'Maksimal 20 peserta.';
  end if;
  if jsonb_typeof(p_menus) is distinct from 'array' or jsonb_array_length(p_menus) > 200 then
    raise exception 'Daftar menu tidak valid.';
  end if;
  if jsonb_typeof(p_payments) is distinct from 'object' then
    raise exception 'Daftar pembayaran tidak valid.';
  end if;

  delete from public.menu_items where session_id = p_session_id;
  delete from public.participants where session_id = p_session_id;
  for p in select value from jsonb_array_elements(p_participants) loop
    insert into public.participants(id, session_id, name, sort_order)
    values ((p->>'id')::uuid, p_session_id, btrim(p->>'name'), coalesce((p->>'sortOrder')::integer, 0));
  end loop;
  for m in select value from jsonb_array_elements(p_menus) loop
    if jsonb_typeof(m->'orders') <> 'array' or jsonb_array_length(m->'orders') < 1 then
      raise exception 'Setiap menu harus memiliki pemesan.';
    end if;
    insert into public.menu_items(id, session_id, name, unit_price, sort_order)
    values ((m->>'id')::uuid, p_session_id, btrim(m->>'name'), (m->>'unitPrice')::bigint, coalesce((m->>'sortOrder')::integer, 0));
    order_count := 0;
    for o in select value from jsonb_array_elements(m->'orders') loop
      insert into public.menu_item_orders(session_id, menu_item_id, participant_id, quantity)
      values (p_session_id, (m->>'id')::uuid, (o->>'participantId')::uuid, (o->>'quantity')::integer);
      order_count := order_count + 1;
    end loop;
    if order_count = 0 then raise exception 'Setiap menu harus memiliki pemesan.'; end if;
  end loop;
  for pay in select key, value from jsonb_each(p_payments) loop
    insert into public.participant_payments(session_id, participant_id, amount)
    values (p_session_id, pay.key::uuid, (pay.value #>> '{}')::bigint);
  end loop;
  update public.bill_sessions set updated_at = now() where id = p_session_id;
end;
$$;
revoke all on function public.save_bill_draft(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_bill_draft(uuid, jsonb, jsonb, jsonb) to authenticated;

create or replace function public.complete_bill_session(p_session_id uuid)
returns table(total_amount bigint, menu_count integer, total_portions integer, people_with_orders integer)
language plpgsql security definer set search_path = '' as $$
declare calculated_total bigint; calculated_menu_count integer; calculated_portions integer; calculated_people integer;
begin
  if not private.is_patungan_admin() then raise exception 'Akses ditolak.'; end if;
  perform 1 from public.bill_sessions where id = p_session_id and status = 'draft' for update;
  if not found then raise exception 'Perhitungan tidak ditemukan atau sudah selesai.'; end if;
  if not exists (select 1 from public.menu_items where session_id = p_session_id) then
    raise exception 'Tambahkan minimal satu menu sebelum menyelesaikan perhitungan.';
  end if;
  if exists (
    select 1 from public.menu_items m left join public.menu_item_orders o
      on o.menu_item_id = m.id and o.session_id = m.session_id
    where m.session_id = p_session_id group by m.id having coalesce(sum(o.quantity), 0) = 0
  ) then raise exception 'Setiap menu harus memiliki pemesan.'; end if;

  select coalesce(sum(m.unit_price * o.quantity), 0)::bigint,
    count(distinct m.id)::integer, coalesce(sum(o.quantity), 0)::integer,
    count(distinct o.participant_id)::integer
  into calculated_total, calculated_menu_count, calculated_portions, calculated_people
  from public.menu_items m join public.menu_item_orders o
    on o.menu_item_id = m.id and o.session_id = m.session_id
  where m.session_id = p_session_id;
  if calculated_total > 9007199254740991 then raise exception 'Total tagihan melewati batas nilai yang didukung.'; end if;

  if calculated_total <> coalesce((
    select sum(person_total) from (
      select sum(m.unit_price * o.quantity)::bigint person_total
      from public.menu_item_orders o join public.menu_items m on m.id = o.menu_item_id and m.session_id = o.session_id
      where o.session_id = p_session_id group by o.participant_id
    ) participant_totals
  ), 0) then raise exception 'Total tagihan tidak cocok.'; end if;

  update public.bill_sessions set status = 'completed', total_amount = calculated_total,
    menu_count = calculated_menu_count, total_portions = calculated_portions,
    people_with_orders = calculated_people, completed_at = now(), updated_at = now()
  where id = p_session_id;
  return query select calculated_total, calculated_menu_count, calculated_portions, calculated_people;
end;
$$;
revoke all on function public.complete_bill_session(uuid) from public, anon;
grant execute on function public.complete_bill_session(uuid) to authenticated;
