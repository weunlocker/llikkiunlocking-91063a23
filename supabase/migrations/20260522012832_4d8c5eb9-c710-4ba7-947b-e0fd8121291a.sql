
-- Status enum
CREATE TYPE public.support_ticket_status AS ENUM ('open', 'pending', 'closed');
CREATE TYPE public.support_ticket_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE public.support_sender_type AS ENUM ('user', 'admin');

-- Tickets
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  status public.support_ticket_status NOT NULL DEFAULT 'open',
  priority public.support_ticket_priority NOT NULL DEFAULT 'normal',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unread_for_admin BOOLEAN NOT NULL DEFAULT true,
  unread_for_user BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_user ON public.support_tickets(user_id);
CREATE INDEX idx_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_tickets_last_msg ON public.support_tickets(last_message_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own tickets" ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own tickets" ON public.support_tickets
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins view all tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update all tickets" ON public.support_tickets
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete tickets" ON public.support_tickets
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Messages
CREATE TABLE public.support_ticket_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_type public.support_sender_type NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_msgs_ticket ON public.support_ticket_messages(ticket_id, created_at);

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view messages on own tickets" ON public.support_ticket_messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
  );
CREATE POLICY "Users insert messages on own tickets" ON public.support_ticket_messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid() AND sender_type = 'user' AND
    EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid() AND t.status <> 'closed')
  );
CREATE POLICY "Admins view all messages" ON public.support_ticket_messages
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert messages" ON public.support_ticket_messages
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin') AND sender_id = auth.uid() AND sender_type = 'admin'
  );

-- Trigger: update ticket last_message_at + unread flags on new message
CREATE OR REPLACE FUNCTION public.bump_ticket_on_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.support_tickets
    SET last_message_at = NEW.created_at,
        updated_at = now(),
        unread_for_admin = CASE WHEN NEW.sender_type = 'user' THEN true ELSE unread_for_admin END,
        unread_for_user  = CASE WHEN NEW.sender_type = 'admin' THEN true ELSE unread_for_user END,
        status = CASE WHEN NEW.sender_type = 'user' AND status = 'pending' THEN 'open'
                      WHEN NEW.sender_type = 'admin' AND status = 'open' THEN 'pending'
                      ELSE status END
   WHERE id = NEW.ticket_id;
  RETURN NEW;
END;$$;

CREATE TRIGGER trg_bump_ticket_on_message
  AFTER INSERT ON public.support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_ticket_on_message();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_ticket_messages;
ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;
ALTER TABLE public.support_ticket_messages REPLICA IDENTITY FULL;
