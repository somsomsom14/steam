-- 매칭 일정 참여자
CREATE TABLE IF NOT EXISTS room_schedule_participants (
  schedule_id UUID NOT NULL REFERENCES room_schedules(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (schedule_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_schedule_participants_schedule
  ON room_schedule_participants(schedule_id);

ALTER TABLE room_schedule_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "schedule_participants_select" ON room_schedule_participants;
CREATE POLICY "schedule_participants_select"
  ON room_schedule_participants FOR SELECT USING (true);
