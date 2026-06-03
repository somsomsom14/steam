// ─── 타입 ───────────────────────────────────────────────────────────────────

export type OwnedGame = {
  appid: number;
  name: string;
  playtime_forever: number;
  playtime_2weeks?: number;
};

export type RecentGame = {
  appid: number;
  name: string;
  playtime_forever: number;
  playtime_2weeks: number;
};

/** Steam API raw game row — playtime 필드가 플랫폼별로 나뉘는 경우 대응 */
type SteamApiGameRow = {
  appid: number;
  name?: string;
  playtime_forever?: number;
  playtime_windows_forever?: number;
  playtime_mac_forever?: number;
  playtime_linux_forever?: number;
  playtime_2weeks?: number;
};

function normalizePlaytimeMinutes(row: SteamApiGameRow): number {
  return (
    Number(row.playtime_forever) ||
    Number(row.playtime_windows_forever) ||
    Number(row.playtime_mac_forever) ||
    Number(row.playtime_linux_forever) ||
    0
  );
}

function mapApiGame(row: SteamApiGameRow): OwnedGame {
  return {
    appid: row.appid,
    name: row.name?.trim() || `App ${row.appid}`,
    playtime_forever: normalizePlaytimeMinutes(row),
    playtime_2weeks: Number(row.playtime_2weeks) || 0,
  };
}

/** GetOwnedGames + GetRecentlyPlayedGames 병합 (API에 한쪽만 있는 게임 보완) */
export function mergeOwnedAndRecent(
  owned: OwnedGame[],
  recent: RecentGame[]
): OwnedGame[] {
  const map = new Map<number, OwnedGame>();

  for (const g of owned) {
    map.set(g.appid, { ...g });
  }

  for (const r of recent) {
    const existing = map.get(r.appid);
    if (!existing) {
      map.set(r.appid, {
        appid: r.appid,
        name: r.name?.trim() || `App ${r.appid}`,
        playtime_forever: normalizePlaytimeMinutes(r),
        playtime_2weeks: r.playtime_2weeks,
      });
      continue;
    }
    existing.playtime_2weeks = Math.max(
      existing.playtime_2weeks ?? 0,
      r.playtime_2weeks ?? 0
    );
    const recentTotal = normalizePlaytimeMinutes(r);
    if (recentTotal > existing.playtime_forever) {
      existing.playtime_forever = recentTotal;
    }
    if (!existing.name || existing.name.startsWith("App ")) {
      existing.name = r.name?.trim() || existing.name;
    }
  }

  return [...map.values()];
}

export type Achievement = {
  apiname: string;
  achieved: number; // 0 | 1
  unlocktime: number;
};

// ─── Steam OpenID ────────────────────────────────────────────────────────────

export function buildSteamLoginUrl(
  callbackUrl: string,
  realm: string
): string {
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": callbackUrl,
    "openid.realm": realm,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return `https://steamcommunity.com/openid/login?${params}`;
}

export async function verifySteamCallback(
  searchParams: URLSearchParams
): Promise<string | null> {
  if (searchParams.get("openid.mode") !== "id_res") return null;

  const verifyParams = new URLSearchParams(searchParams);
  verifyParams.set("openid.mode", "check_authentication");

  const res = await fetch("https://steamcommunity.com/openid/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: verifyParams.toString(),
  });

  const text = await res.text();
  if (!text.includes("is_valid:true")) return null;

  const claimedId = searchParams.get("openid.claimed_id") ?? "";
  const match = claimedId.match(
    /https:\/\/steamcommunity\.com\/openid\/id\/(\d+)/
  );
  return match ? match[1] : null;
}

// ─── Steam Web API ───────────────────────────────────────────────────────────

export async function getPlayerSummaries(steamId: string) {
  const key = process.env.STEAM_API_KEY!;
  const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamId}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  return (data.response?.players?.[0] ?? null) as {
    steamid: string;
    personaname: string;
    avatarfull: string;
    profileurl: string;
    personastate: number;
    communityvisibilitystate?: number;
  } | null;
}

export type OwnedGamesResult = {
  games: OwnedGame[];
  /** Steam API `response.game_count` (배열 길이와 동일한 경우가 많음) */
  gameCount: number;
};

const VALHEIM_APPID = 892970;

export function buildGetOwnedGamesUrl(steamId: string): string {
  const key = process.env.STEAM_API_KEY!;
  const params = new URLSearchParams({
    key,
    steamid: steamId,
    include_appinfo: "1",
    include_played_free_games: "1",
    include_free_sub: "1",
    skip_unvetted_apps: "0",
  });
  return `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?${params}`;
}

export async function getOwnedGames(steamId: string): Promise<OwnedGamesResult> {
  const url = buildGetOwnedGamesUrl(steamId);
  const logUrl = url.replace(process.env.STEAM_API_KEY!, "***");

  console.log(`[steam] GetOwnedGames URL: ${logUrl}`);
  console.log(
    `[steam] GetOwnedGames options: include_appinfo=1, include_played_free_games=1, include_free_sub=1, skip_unvetted_apps=0`
  );

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[steam] GetOwnedGames HTTP ${res.status}: ${body.slice(0, 200)}`);
    return { games: [], gameCount: 0 };
  }

  const data = await res.json();
  if (!data.response) {
    console.error("[steam] GetOwnedGames: response 없음", JSON.stringify(data).slice(0, 300));
    return { games: [], gameCount: 0 };
  }

  const rawGames: SteamApiGameRow[] = data.response?.games ?? [];
  const games: OwnedGame[] = rawGames.map(mapApiGame);
  const gameCount: number = data.response?.game_count ?? games.length;

  const valheim = games.find((g) => g.appid === VALHEIM_APPID);
  const escapeSim = games.find((g) => g.appid === 1435790);
  console.log(
    `[steam] GetOwnedGames 응답: game_count=${gameCount}, games.length=${games.length}, Valheim(892970)=${valheim ? `있음 "${valheim.name}" playtime=${valheim.playtime_forever}분` : "없음"}`
  );
  console.log(
    `[steam] Escape Simulator(1435790)=${escapeSim ? `있음 playtime=${escapeSim.playtime_forever}분` : "없음 — 게임 상세 공개 설정 확인"}`
  );

  if (gameCount !== games.length) {
    console.warn(
      `[steam] game_count(${gameCount})와 games 배열 길이(${games.length}) 불일치`
    );
  }

  return { games, gameCount };
}

export async function getRecentlyPlayedGames(
  steamId: string,
  count = 50
): Promise<RecentGame[]> {
  const key = process.env.STEAM_API_KEY!;
  const url = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${key}&steamid=${steamId}&count=${count}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  const raw: SteamApiGameRow[] = data.response?.games ?? [];
  return raw.map((g) => ({
    appid: g.appid,
    name: g.name?.trim() || `App ${g.appid}`,
    playtime_forever: normalizePlaytimeMinutes(g),
    playtime_2weeks: Number(g.playtime_2weeks) || 0,
  }));
}

// ─── Steam Store API ─────────────────────────────────────────────────────────

export async function getAppDetails(
  appId: number
): Promise<{ game_name?: string; genres: string[]; categories: string[] }> {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic,genres,categories&cc=us&l=english`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { genres: [], categories: [] };
    const data = await res.json();
    const appData = data[String(appId)];
    if (!appData?.success || !appData?.data) return { genres: [], categories: [] };
    return {
      game_name: appData.data.name as string | undefined,
      genres:
        appData.data.genres?.map(
          (g: { description: string }) => g.description
        ) ?? [],
      categories:
        appData.data.categories?.map(
          (c: { description: string }) => c.description
        ) ?? [],
    };
  } catch {
    return { genres: [], categories: [] };
  }
}

// ─── SteamSpy API ────────────────────────────────────────────────────────────

export async function getSteamSpyTags(appId: number): Promise<string[]> {
  const url = `https://steamspy.com/api.php?request=appdetails&appid=${appId}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data?.tags) return [];
    return Object.keys(data.tags);
  } catch {
    return [];
  }
}

// ─── 업적 ────────────────────────────────────────────────────────────────────

export async function getPlayerAchievements(
  steamId: string,
  appId: number
): Promise<Achievement[]> {
  const key = process.env.STEAM_API_KEY!;
  const url = `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?key=${key}&steamid=${steamId}&appid=${appId}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.playerstats?.achievements ?? [];
  } catch {
    return [];
  }
}
