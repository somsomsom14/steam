-- Rooms feature migration

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  game_name TEXT NOT NULL,
  game_appid INTEGER NOT NULL,
  game_thumbnail TEXT,
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notice TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_members (
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('host', 'member')),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS room_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  target_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_metadata (
  appid INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  genres JSONB NOT NULL DEFAULT '[]'::JSONB,
  tags JSONB NOT NULL DEFAULT '[]'::JSONB,
  categories JSONB NOT NULL DEFAULT '[]'::JSONB
);

CREATE TABLE IF NOT EXISTS room_banned (
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  banned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_game_name ON rooms(game_name);
CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_room_messages_room_id_created ON room_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_schedules_room_id ON room_schedules(room_id);

-- Enable Realtime (run once; ignore "already exists" error)
ALTER PUBLICATION supabase_realtime ADD TABLE room_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_members;

-- RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_banned ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_metadata ENABLE ROW LEVEL SECURITY;

-- SELECT open for all (needed for realtime with anon key)
-- All writes go through API routes using service_role key (bypasses RLS)
CREATE POLICY "rooms_select" ON rooms FOR SELECT USING (true);
CREATE POLICY "room_members_select" ON room_members FOR SELECT USING (true);
CREATE POLICY "room_messages_select" ON room_messages FOR SELECT USING (true);
CREATE POLICY "room_schedules_select" ON room_schedules FOR SELECT USING (true);
CREATE POLICY "room_banned_select" ON room_banned FOR SELECT USING (true);
CREATE POLICY "game_metadata_select" ON game_metadata FOR SELECT USING (true);
