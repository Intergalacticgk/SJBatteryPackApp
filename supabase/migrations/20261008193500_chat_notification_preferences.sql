-- Per-room chat notification toggles + link a device token to the signed-in user
-- (so the sender is not notified about their own message).
alter table public.push_tokens
  add column if not exists user_id uuid,
  add column if not exists notify_chat_general boolean not null default true,
  add column if not exists notify_chat_watch_parties boolean not null default true,
  add column if not exists notify_chat_merch boolean not null default true,
  add column if not exists notify_chat_sharks boolean not null default true;

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

-- The "Prospect Talk" room is now "Sharks" (room id 'prospects' -> 'sharks').
update public.chat_messages set room = 'sharks' where room = 'prospects';
