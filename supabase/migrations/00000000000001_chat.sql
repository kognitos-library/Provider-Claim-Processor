create table if not exists provider_claims_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists provider_claims_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references provider_claims_chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content text not null default '',
  tool_call jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_provider_claims_chat_messages_session
  on provider_claims_chat_messages(session_id, created_at);

alter table provider_claims_chat_sessions enable row level security;
alter table provider_claims_chat_messages enable row level security;

create policy "Allow all on provider_claims_chat_sessions" on provider_claims_chat_sessions
  for all using (true) with check (true);

create policy "Allow all on provider_claims_chat_messages" on provider_claims_chat_messages
  for all using (true) with check (true);
