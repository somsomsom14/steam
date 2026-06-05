-- Steam 스토어 한국 정가(원) — 라이브러리 총 자산 가치용
ALTER TABLE public.user_games
  ADD COLUMN IF NOT EXISTS store_price_krw INTEGER;

COMMENT ON COLUMN public.user_games.store_price_krw IS 'Steam KR 정가(원). 무료=0, 미조회=NULL. 동기화 시 appdetails에서 저장';
