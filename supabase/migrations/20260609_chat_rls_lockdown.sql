-- AI 채팅 테이블 RLS 잠금
-- anon / authenticated 역할의 PostgREST 직접 접근 차단
-- 서버 API Route는 SUPABASE_SERVICE_ROLE_KEY 사용 → RLS 우회, 기존 기능 유지

-- ── chat_sessions: 기존 전체 허용 정책 제거 ────────────────────────────────
DROP POLICY IF EXISTS "chat_sessions_select" ON public.chat_sessions;
DROP POLICY IF EXISTS "chat_sessions_insert" ON public.chat_sessions;
DROP POLICY IF EXISTS "chat_sessions_update" ON public.chat_sessions;
DROP POLICY IF EXISTS "chat_sessions_delete" ON public.chat_sessions;

-- ── chat_messages: 기존 전체 허용 정책 제거 ────────────────────────────────
DROP POLICY IF EXISTS "chat_messages_select" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_insert" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_update" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_delete" ON public.chat_messages;

-- RLS 유지 + 정책 없음 = anon/authenticated 에서 SELECT/INSERT/UPDATE/DELETE 모두 거부
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
