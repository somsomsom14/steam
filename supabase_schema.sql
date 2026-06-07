-- ================================================================
-- MI-TEAM Supabase Schema
-- Supabase Dashboard > SQL Editor 에서 실행하세요.
-- ================================================================

-- users
CREATE TABLE IF NOT EXISTS public.users (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  steam_id            TEXT        UNIQUE NOT NULL,
  steam_nickname      TEXT,
  steam_avatar_url    TEXT,
  steam_profile_url   TEXT,
  app_nickname        TEXT,
  app_avatar_url      TEXT,
  analysis_agreed     BOOLEAN     DEFAULT FALSE,
  analysis_agreed_at  TIMESTAMPTZ,
  profile_completed   BOOLEAN     DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- user_games
CREATE TABLE IF NOT EXISTS public.user_games (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID        REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  appid            INTEGER     NOT NULL,
  game_name        TEXT,
  genres           JSONB       DEFAULT '[]'::jsonb,
  categories       JSONB       DEFAULT '[]'::jsonb,
  tags             JSONB       DEFAULT '[]'::jsonb,
  playtime_forever INTEGER     DEFAULT 0,
  playtime_2weeks  INTEGER     DEFAULT 0,
  store_price_krw  INTEGER,
  source           TEXT        DEFAULT 'owned',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, appid)
);

-- user_achievements
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID        REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  appid            INTEGER     NOT NULL,
  achievement_name TEXT        NOT NULL,
  achieved         BOOLEAN     DEFAULT FALSE,
  unlock_time      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, appid, achievement_name)
);

-- gender 컬럼 추가 (이미 테이블이 있는 경우)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'private';

-- games_updated_at 컬럼 추가 (게임 데이터 마지막 갱신 시각)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS games_updated_at TIMESTAMPTZ;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_user_games_user_id       ON public.user_games(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON public.user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_appid   ON public.user_achievements(appid);

-- 프로필 이미지 Storage 버킷: supabase/migrations/20260604_avatars_storage.sql 실행
-- AI 문의방: supabase/migrations/20260606_chat.sql 실행
-- 환경 변수: GEMINI_API_KEY (모델 gemini-1.5-flash 고정)
