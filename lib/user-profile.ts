/** 서비스 표시 이름: 앱 닉네임 → Steam 닉네임 */
export function resolveDisplayName(user: {
  app_nickname?: string | null;
  steam_nickname?: string | null;
}): string {
  return (
    user.app_nickname?.trim() ||
    user.steam_nickname?.trim() ||
    "게이머"
  );
}

/** 프로필 이미지: 앱 아바타 → Steam 아바타 → 기본 이미지 */
export function resolveAvatarUrl(
  user: {
    app_avatar_url?: string | null;
    steam_avatar_url?: string | null;
  },
  fallback = "/images/miteam/game-01.jpg"
): string {
  const url = user.app_avatar_url?.trim() || user.steam_avatar_url?.trim();
  return url || fallback;
}
