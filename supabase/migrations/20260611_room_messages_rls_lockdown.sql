-- room_messages RLS 잠금
-- anon 역할의 PostgREST 직접 조회(SELECT) 및 쓰기 차단
-- 서버 API Route는 SUPABASE_SERVICE_ROLE_KEY 사용 → RLS 우회
-- 브라우저 실시간(room_messages postgres_changes)은 SELECT 정책 필요 → GET API 폴링으로 대체

DROP POLICY IF EXISTS "room_messages_select" ON public.room_messages;
DROP POLICY IF EXISTS "room_messages_insert" ON public.room_messages;
DROP POLICY IF EXISTS "room_messages_update" ON public.room_messages;
DROP POLICY IF EXISTS "room_messages_delete" ON public.room_messages;

ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
