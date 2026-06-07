-- users / user_games / user_achievements RLS 잠금
-- anon 역할의 PostgREST 직접 접근(SELECT/INSERT/UPDATE/DELETE) 차단
-- 서버 API Route · Steam 동기화는 SUPABASE_SERVICE_ROLE_KEY 사용 → RLS 우회, 기존 기능 유지

-- ── users: 기존 정책 제거(있을 경우) ───────────────────────────────────────
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
DROP POLICY IF EXISTS "users_delete" ON public.users;

-- ── user_games: 기존 정책 제거(있을 경우) ───────────────────────────────────
DROP POLICY IF EXISTS "user_games_select" ON public.user_games;
DROP POLICY IF EXISTS "user_games_insert" ON public.user_games;
DROP POLICY IF EXISTS "user_games_update" ON public.user_games;
DROP POLICY IF EXISTS "user_games_delete" ON public.user_games;

-- ── user_achievements: 기존 정책 제거(있을 경우) ───────────────────────────
DROP POLICY IF EXISTS "user_achievements_select" ON public.user_achievements;
DROP POLICY IF EXISTS "user_achievements_insert" ON public.user_achievements;
DROP POLICY IF EXISTS "user_achievements_update" ON public.user_achievements;
DROP POLICY IF EXISTS "user_achievements_delete" ON public.user_achievements;

-- RLS 활성화 + 정책 없음 = anon/authenticated 에서 CRUD 모두 거부
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
