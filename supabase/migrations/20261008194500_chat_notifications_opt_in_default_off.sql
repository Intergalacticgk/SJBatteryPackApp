-- Chat notifications are opt-in: the app asks once (first time the user opens chat).
alter table public.push_tokens
  alter column notify_chat_general set default false,
  alter column notify_chat_watch_parties set default false,
  alter column notify_chat_merch set default false,
  alter column notify_chat_sharks set default false;

-- Nobody has opted in yet (the columns were added minutes ago defaulting to true).
update public.push_tokens
set notify_chat_general = false,
    notify_chat_watch_parties = false,
    notify_chat_merch = false,
    notify_chat_sharks = false;
