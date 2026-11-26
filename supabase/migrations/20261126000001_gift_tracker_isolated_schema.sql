begin;
create schema if not exists gifts;
revoke all on schema gifts from public, anon, authenticated;

create table gifts.app_users (
  user_id uuid primary key references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table gifts.recipients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  group_name text check (char_length(btrim(group_name)) between 1 and 120),
  spending_target numeric(12,2) check (spending_target >= 0 and spending_target <> 'NaN'::numeric),
  is_generic_bucket boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipient_scope check (
    (not is_generic_bucket and lower(btrim(name)) not in ('male child', 'female child', 'adult woman', 'adult man'))
    or (is_generic_bucket and group_name is null and spending_target is null
      and name in ('Male Child', 'Female Child', 'Adult Woman', 'Adult Man'))
  )
);

create unique index gift_tracker_named_recipient_unique
  on gifts.recipients (lower(btrim(name))) where not is_generic_bucket;
create unique index gift_tracker_bucket_unique
  on gifts.recipients (name) where is_generic_bucket;

create table gifts.gifts (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references gifts.recipients (id) on delete restrict,
  occasion text not null check (occasion in ('Christmas', 'Birthdays', 'Other')),
  item text not null check (char_length(btrim(item)) between 1 and 300),
  storage_location text not null default '' check (char_length(storage_location) <= 500),
  price numeric(12,2) not null check (price >= 0 and price <> 'NaN'::numeric),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index gift_tracker_gift_recipient_idx on gifts.gifts (recipient_id);
create index gift_tracker_gift_occasion_idx on gifts.gifts (occasion);
create index gift_tracker_gift_created_at_idx on gifts.gifts (created_at desc);

create function gifts.gift_tracker_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger gift_tracker_recipients_updated_at before update on gifts.recipients
for each row execute function gifts.gift_tracker_touch_updated_at();
create trigger gift_tracker_gifts_updated_at before update on gifts.gifts
for each row execute function gifts.gift_tracker_touch_updated_at();

alter table gifts.app_users enable row level security;
alter table gifts.recipients enable row level security;
alter table gifts.gifts enable row level security;

insert into gifts.recipients (name, is_generic_bucket)
values ('Male Child', true), ('Female Child', true), ('Adult Woman', true), ('Adult Man', true)
on conflict (name) where is_generic_bucket do nothing;

create function gifts.is_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and exists (select 1 from gifts.app_users u where u.user_id = auth.uid());
$$;

-- Internal write shared by both save RPCs.
create function gifts.save_gift(
  p_gift_id uuid, p_recipient_id uuid, p_occasion text, p_item text,
  p_storage_location text, p_price numeric
) returns uuid
language plpgsql set search_path = '' as $$
declare
  saved_id uuid;
begin
  if p_gift_id is null then
    insert into gifts.gifts (recipient_id, occasion, item, storage_location, price)
    values (p_recipient_id, p_occasion, p_item, p_storage_location, p_price)
    returning id into saved_id;
  else
    update gifts.gifts
    set recipient_id = p_recipient_id, occasion = p_occasion, item = p_item,
        storage_location = p_storage_location, price = p_price
    where id = p_gift_id
    returning id into saved_id;
    if not found then raise exception 'Gift is unavailable.'; end if;
  end if;
  return saved_id;
end;
$$;

revoke all on all tables in schema gifts from public, anon, authenticated;
revoke all on all sequences in schema gifts from public, anon, authenticated;
revoke all on all functions in schema gifts from public, anon, authenticated;

create function public.gift_app_is_allowed() returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if not gifts.is_allowed() then raise exception 'not authorized' using errcode = '42501'; end if;
  return true;
end;
$$;

create function public.gift_app_list_recipients()
returns table (id uuid, name text, group_name text, spending_target numeric, is_generic_bucket boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not gifts.is_allowed() then raise exception 'not authorized' using errcode = '42501'; end if;
  return query
    select r.id, r.name, r.group_name, r.spending_target, r.is_generic_bucket
    from gifts.recipients r order by r.name;
end;
$$;

create function public.gift_app_list_gifts()
returns table (id uuid, recipient_id uuid, occasion text, item text, storage_location text, price numeric, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not gifts.is_allowed() then raise exception 'not authorized' using errcode = '42501'; end if;
  return query
    select g.id, g.recipient_id, g.occasion, g.item, g.storage_location, g.price, g.created_at
    from gifts.gifts g order by g.created_at desc;
end;
$$;

create function public.gift_app_save_gift(p_gift_data jsonb, p_gift_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if not gifts.is_allowed() then raise exception 'not authorized' using errcode = '42501'; end if;
  return gifts.save_gift(p_gift_id, (p_gift_data->>'recipient_id')::uuid, p_gift_data->>'occasion',
    p_gift_data->>'item', p_gift_data->>'storage_location', (p_gift_data->>'price')::numeric);
end;
$$;

create function public.gift_app_save_gift_with_person(p_gift_data jsonb, p_gift_id uuid, p_person_data jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  person_id uuid;
begin
  if not gifts.is_allowed() then raise exception 'not authorized' using errcode = '42501'; end if;
  insert into gifts.recipients (name, group_name, spending_target)
  values (p_person_data->>'name', p_person_data->>'group_name', (p_person_data->>'spending_target')::numeric)
  returning id into person_id;

  return gifts.save_gift(p_gift_id, person_id, p_gift_data->>'occasion',
    p_gift_data->>'item', p_gift_data->>'storage_location', (p_gift_data->>'price')::numeric);
end;
$$;

create function public.gift_app_delete_gift(p_gift_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not gifts.is_allowed() then raise exception 'not authorized' using errcode = '42501'; end if;
  delete from gifts.gifts where id = p_gift_id;
  if not found then raise exception 'Gift is unavailable.'; end if;
end;
$$;

create function public.gift_app_reassign_gift(p_gift_id uuid, p_recipient_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not gifts.is_allowed() then raise exception 'not authorized' using errcode = '42501'; end if;
  if not exists (
    select 1 from gifts.recipients r where r.id = p_recipient_id and not r.is_generic_bucket
  ) then
    raise exception 'Choose a named recipient.';
  end if;
  update gifts.gifts set recipient_id = p_recipient_id where id = p_gift_id;
  if not found then raise exception 'Gift is unavailable.'; end if;
end;
$$;

revoke all on function
  public.gift_app_is_allowed(), public.gift_app_list_recipients(), public.gift_app_list_gifts(),
  public.gift_app_save_gift(jsonb, uuid), public.gift_app_save_gift_with_person(jsonb, uuid, jsonb),
  public.gift_app_delete_gift(uuid), public.gift_app_reassign_gift(uuid, uuid)
from public, anon, authenticated, service_role;

grant execute on function
  public.gift_app_is_allowed(), public.gift_app_list_recipients(), public.gift_app_list_gifts(),
  public.gift_app_save_gift(jsonb, uuid), public.gift_app_save_gift_with_person(jsonb, uuid, jsonb),
  public.gift_app_delete_gift(uuid), public.gift_app_reassign_gift(uuid, uuid)
to authenticated;

commit;
