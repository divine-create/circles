-- Migration 0016: Direct & Group Messaging, Read Receipts, and Marketplace Inquiry Bridge
-- Enforces multi-tenant circle isolation, anti-IDOR checks, and PostgreSQL RLS.

-- 1. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  conversation_type TEXT NOT NULL DEFAULT 'direct' CHECK (conversation_type IN ('direct', 'group', 'listing')),
  title TEXT,
  listing_id UUID,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (listing_id, circle_id) REFERENCES public.marketplace_listings(id, circle_id) ON DELETE SET NULL
);

-- 2. Participants Table
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_muted BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

-- 3. Direct Messages Table
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lightning-fast chronological pagination and member queries
CREATE INDEX IF NOT EXISTS idx_direct_messages_convo ON public.direct_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_convo_participants_user ON public.conversation_participants(user_id, circle_id);
CREATE INDEX IF NOT EXISTS idx_conversations_circle_activity ON public.conversations(circle_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_listing ON public.conversations(circle_id, listing_id);

-- Enable Row Level Security
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Grant Permissions to standard roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.direct_messages TO authenticated;

-- RLS Policies for conversations
DROP POLICY IF EXISTS conversations_select ON public.conversations;
CREATE POLICY conversations_select ON public.conversations
  FOR SELECT TO authenticated
  USING (
    public.is_active_circle_member(circle_id, auth.uid())
  );

DROP POLICY IF EXISTS conversations_insert ON public.conversations;
CREATE POLICY conversations_insert ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_circle_member(circle_id, auth.uid())
  );

DROP POLICY IF EXISTS conversations_update ON public.conversations;
CREATE POLICY conversations_update ON public.conversations
  FOR UPDATE TO authenticated
  USING (
    public.is_active_circle_member(circle_id, auth.uid())
  );

-- RLS Policies for conversation_participants
DROP POLICY IF EXISTS conversation_participants_select ON public.conversation_participants;
CREATE POLICY conversation_participants_select ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (
    public.is_active_circle_member(circle_id, auth.uid())
  );

DROP POLICY IF EXISTS conversation_participants_insert ON public.conversation_participants;
CREATE POLICY conversation_participants_insert ON public.conversation_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_circle_member(circle_id, auth.uid())
  );

DROP POLICY IF EXISTS conversation_participants_update ON public.conversation_participants;
CREATE POLICY conversation_participants_update ON public.conversation_participants
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
  );

-- RLS Policies for direct_messages
DROP POLICY IF EXISTS direct_messages_select ON public.direct_messages;
CREATE POLICY direct_messages_select ON public.direct_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
    )
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
  );

DROP POLICY IF EXISTS direct_messages_insert ON public.direct_messages;
CREATE POLICY direct_messages_insert ON public.direct_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS direct_messages_update ON public.direct_messages;
CREATE POLICY direct_messages_update ON public.direct_messages
  FOR UPDATE TO authenticated
  USING (
    sender_id = auth.uid()
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
  );
