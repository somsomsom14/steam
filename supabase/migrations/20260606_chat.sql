-- AI 문의방: 대화 세션 & 메시지

CREATE TABLE IF NOT EXISTS chat_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT '새 대화',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated
  ON chat_sessions(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
  ON chat_messages(session_id, created_at ASC);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_sessions_select" ON chat_sessions;
CREATE POLICY "chat_sessions_select" ON chat_sessions FOR SELECT USING (true);
DROP POLICY IF EXISTS "chat_sessions_insert" ON chat_sessions;
CREATE POLICY "chat_sessions_insert" ON chat_sessions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "chat_sessions_update" ON chat_sessions;
CREATE POLICY "chat_sessions_update" ON chat_sessions FOR UPDATE USING (true);
DROP POLICY IF EXISTS "chat_sessions_delete" ON chat_sessions;
CREATE POLICY "chat_sessions_delete" ON chat_sessions FOR DELETE USING (true);

DROP POLICY IF EXISTS "chat_messages_select" ON chat_messages;
CREATE POLICY "chat_messages_select" ON chat_messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "chat_messages_insert" ON chat_messages;
CREATE POLICY "chat_messages_insert" ON chat_messages FOR INSERT WITH CHECK (true);
