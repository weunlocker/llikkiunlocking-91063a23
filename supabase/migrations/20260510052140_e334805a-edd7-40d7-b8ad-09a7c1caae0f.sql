CREATE TABLE IF NOT EXISTS public.telegram_chat_state (
  chat_id text PRIMARY KEY,
  bot_kind text NOT NULL,
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.telegram_chat_state ENABLE ROW LEVEL SECURITY;