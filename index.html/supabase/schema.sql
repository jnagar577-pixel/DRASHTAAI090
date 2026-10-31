-- Drashta AI: Supabase schema.
-- Supabase Dashboard → SQL Editor mein ye poora script ek baar chalaiye.

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  name text,
  dob text,
  birth_time text,
  birth_place text,
  lagan_rashi text,
  moon_rashi text,
  notes text,
  chart_summary text,
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_idx on messages (conversation_id, id);

create table if not exists feedback (
  message_id bigint primary key references messages(id) on delete cascade,
  helpful boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists usage_daily (
  token_hash text not null,
  day date not null,
  count int not null default 0,
  primary key (token_hash, day)
);

-- Atomic daily counter (race condition se bachne ke liye)
create or replace function bump_usage(p_hash text, p_day date) returns int
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  insert into usage_daily (token_hash, day, count) values (p_hash, p_day, 1)
  on conflict (token_hash, day) do update set count = usage_daily.count + 1
  returning count into c;
  return c;
end $$;

-- Browser (anon key) kisi bhi table ya function ko chhoo nahi sakta.
-- Sirf server ki service_role key ka access hai.
alter table conversations enable row level security;
alter table messages enable row level security;
alter table feedback enable row level security;
alter table usage_daily enable row level security;
revoke execute on function bump_usage(text, date) from public, anon, authenticated;
grant execute on function bump_usage(text, date) to service_role;
