# MI-TEAM

Steam 라이브러리 기반 팀원 매칭 서비스. 스팀 로그인 → 게임 동기화 → 대시보드 분석 → AI 문의 → 게임별 방 채팅.

## 주요 기능

- **Steam OpenID 로그인** 및 보유 게임·업적 동기화
- **대시보드** 플레이타임·장르·성향 요약
- **AI 문의** 게임 추천, 방 추천, 성향 분석 (Gemini)
- **방** 게임별 팀 모집, 실시간 채팅, 일정, 공지

## 기술 스택

Next.js 16 · React 19 · Supabase · Google Gemini · Steam Web API

## 사전 준비

- Node.js 20+
- [Supabase](https://supabase.com) 프로젝트
- [Steam Web API Key](https://steamcommunity.com/dev/apikey)
- [Google AI Studio](https://aistudio.google.com) Gemini API Key

## 환경 변수

프로젝트 루트에 `.env.local` 파일을 만듭니다.

```env
# 사이트 URL (배포 도메인, Steam OpenID callback에 사용)
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# 세션 JWT (32자 이상 랜덤 문자열)
SESSION_SECRET=

# Steam
STEAM_API_KEY=

# Gemini (코드에서 gemini-1.5-flash 고정)
GEMINI_API_KEY=
```

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속.

## Supabase 설정

1. SQL Editor에서 `supabase_schema.sql` 실행 (최초 1회)
2. `supabase/migrations/` 아래 SQL을 **파일명 순서대로** 실행

| 순서 | 파일 |
|------|------|
| 1 | `20260603_rooms.sql` |
| 2 | `20260604_avatars_storage.sql` |
| 3 | `20260605_schedule_participants.sql` |
| 4 | `20260606_chat.sql` |
| 5 | `20260607_user_games_store_price.sql` |
| 6 | `20260608_room_chat_attachments.sql` |
| 7 | `20260609_chat_rls_lockdown.sql` |
| 8 | `20260610_user_data_rls_lockdown.sql` |
| 9 | `20260611_room_messages_rls_lockdown.sql` |

Storage 버킷: `avatars`, `room-chat` (마이그레이션에서 생성)

## 배포

### Vercel (권장)

1. GitHub 저장소 연결
2. 환경 변수 전부 등록 (`NEXT_PUBLIC_*` 포함)
3. `NEXT_PUBLIC_SITE_URL`을 배포 URL로 설정
4. Steam OpenID callback: `{SITE_URL}/api/auth/steam/callback`

### Node 서버

```bash
npm run build
npm start
```

포트 기본값 3000. `NEXT_PUBLIC_SITE_URL`은 실제 접속 도메인과 일치해야 합니다.

## 프로젝트 구조

```
app/              페이지 및 API Route
components/       UI 컴포넌트
lib/              Steam·AI·Supabase·세션 로직
public/images/    랜딩·기본 아바타 이미지
supabase/         DB 마이그레이션
```

## 보안 참고

- 민감 API는 서버 Route + `SUPABASE_SERVICE_ROLE_KEY` 사용
- `chat_*`, `users`, `user_games`, `room_messages` 테이블은 anon 직접 접근 차단 (RLS)
- `.env.local`은 Git에 커밋하지 않음
