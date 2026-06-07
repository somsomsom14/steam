-- Room chat: image attachments + storage bucket

ALTER TABLE room_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'image')),
  ADD COLUMN IF NOT EXISTS attachment_url TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'room-chat',
  'room-chat',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

DROP POLICY IF EXISTS "room_chat_public_read" ON storage.objects;
CREATE POLICY "room_chat_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'room-chat');
