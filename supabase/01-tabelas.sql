-- Nexo — tabelas do banco de dados
-- Cole tudo no SQL Editor da Supabase e clique em Run.

create table if not exists public.tasks (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  id         text not null,
  title      text not null,
  date       date,
  time       text,
  prio       text not null default 'media',
  lead       integer not null default 0,
  notes      text not null default '',
  done       boolean not null default false,
  notified   boolean not null default false,
  notify_at  timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.sales (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  id         text not null,
  date       date not null,
  folga      boolean not null default false,
  valor      numeric(12,2) not null default 0,
  obs        text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.expenses (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  id         text not null,
  descr      text not null default '',
  valor      numeric(12,2) not null default 0,
  cat        text not null default 'outros',
  date       date not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index if not exists tasks_avisos on public.tasks (notify_at) where not done and not notified;

-- Segurança: cada usuário só enxerga e altera os próprios dados
alter table public.tasks              enable row level security;
alter table public.sales              enable row level security;
alter table public.expenses           enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "dono" on public.tasks;
drop policy if exists "dono" on public.sales;
drop policy if exists "dono" on public.expenses;
drop policy if exists "dono" on public.push_subscriptions;
create policy "dono" on public.tasks              for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dono" on public.sales              for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dono" on public.expenses           for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dono" on public.push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Atualização em tempo real entre PC e celular
do $$ begin
  alter publication supabase_realtime add table public.tasks, public.sales, public.expenses;
exception when duplicate_object then null; end $$;
