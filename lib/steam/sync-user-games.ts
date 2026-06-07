import {
  getOwnedGames,
  getRecentlyPlayedGames,
  getAppDetails,
  getSteamSpyTags,
  getPlayerAchievements,
  getPlayerSummaries,
  mergeOwnedAndRecent,
} from "@/lib/steam";
import { createSupabaseServerClient } from "@/lib/supabase";
import { batchProcess } from "@/lib/rateLimiter";

export type SyncProgress = {
  percent: number;
  phase: string;
  processed?: number;
  total?: number;
};

export type SyncResult = {
  success: true;
  profile_public: boolean;
  api_game_count: number;
  owned_from_api: number;
  merged_total: number;
  total: number;
  saved: number;
  escape_simulator: {
    appid: number;
    in_api: boolean;
    in_db: boolean;
    playtime_minutes: number;
  };
  valheim_in_api: boolean;
  valheim_in_db: boolean;
  missing: { appid: number; name: string }[];
  null_dropped: number[];
  meta_failures: { appid: number; game_name: string; reasons: string[] }[];
  save_failures: { appid: number; reason: string }[];
};

type EnrichedGame = {
  appid: number;
  game_name: string;
  genres: string[];
  categories: string[];
  tags: string[];
  playtime_forever: number;
  playtime_2weeks: number;
  source: string;
  store_price_krw: number | null;
};

type MetaFailure = { appid: number; game_name: string; reasons: string[] };
type SaveFailure = { appid: number; reason: string };

const ESCAPE_SIMULATOR_APPID = 1435790;
const VALHEIM_APPID = 892970;

async function upsertGameRows(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  rows: {
    user_id: string;
    appid: number;
    game_name: string;
    genres: string[];
    categories: string[];
    tags: string[];
    playtime_forever: number;
    playtime_2weeks: number;
    source: string;
    store_price_krw?: number | null;
  }[]
): Promise<SaveFailure[]> {
  const saveFailures: SaveFailure[] = [];
  const CHUNK_SIZE = 50;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from("user_games")
      .upsert(chunk, { onConflict: "user_id,appid" });

    if (error) {
      console.warn(
        `[sync] chunk upsert 실패 (${i}–${i + chunk.length - 1}), 개별 재시도: ${error.message}`
      );
      for (const row of chunk) {
        const { error: rowErr } = await supabase
          .from("user_games")
          .upsert(row, { onConflict: "user_id,appid" });
        if (rowErr) {
          saveFailures.push({ appid: row.appid, reason: rowErr.message });
        }
      }
    }
  }

  return saveFailures;
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export async function runSteamLibrarySync(params: {
  userId: string;
  steamId: string;
  onProgress?: (progress: SyncProgress) => void;
}): Promise<SyncResult> {
  const { userId, steamId, onProgress } = params;
  const report = (percent: number, phase: string, processed?: number, total?: number) => {
    onProgress?.({ percent: clampPercent(percent), phase, processed, total });
  };

  const supabase = createSupabaseServerClient();

  report(2, "Steam 계정 확인 중");
  const player = await getPlayerSummaries(steamId);
  const profilePublic = player?.communityvisibilitystate === 3;

  report(8, "Steam 라이브러리 불러오는 중");
  const [{ games: ownedGames, gameCount: apiGameCount }, recentGames] = await Promise.all([
    getOwnedGames(steamId),
    getRecentlyPlayedGames(steamId),
  ]);

  const mergedOwned = mergeOwnedAndRecent(ownedGames, recentGames);
  const recentMap = new Map(recentGames.map((g) => [g.appid, g.playtime_2weeks]));

  const allGames = mergedOwned.map((g) => ({
    appid: g.appid,
    name: g.name ?? `Unknown_${g.appid}`,
    playtime_forever: g.playtime_forever,
    playtime_2weeks: recentMap.get(g.appid) ?? g.playtime_2weeks ?? 0,
    source: recentMap.has(g.appid) ? "recent" : "owned",
  }));

  const valheimOwned = mergedOwned.find((g) => g.appid === VALHEIM_APPID);
  const escapeOwned = mergedOwned.find((g) => g.appid === ESCAPE_SIMULATOR_APPID);

  console.log(`[sync] ── 시작 ──────────────────────────────`);
  console.log(`[sync] 프로필 공개: ${profilePublic ? "예" : "아니오 (게임 목록 API 제한 가능)"}`);
  console.log(
    `[sync] GetOwnedGames: api game_count=${apiGameCount}, 배열=${ownedGames.length}개 → 병합 후 ${mergedOwned.length}개`
  );
  console.log(`[sync] 처리 대상: ${allGames.length}개`);

  report(15, "게임 목록 저장 중", 0, allGames.length);
  const basicRows = allGames.map((g) => ({
    user_id: userId,
    appid: g.appid,
    game_name: g.name,
    genres: [] as string[],
    categories: [] as string[],
    tags: [] as string[],
    playtime_forever: g.playtime_forever,
    playtime_2weeks: g.playtime_2weeks,
    source: g.source,
  }));

  const earlySaveFailures = await upsertGameRows(supabase, basicRows);
  console.log(`[sync] 기본 저장 완료: ${allGames.length}개 (실패 ${earlySaveFailures.length}개)`);
  report(22, "게임 정보 분석 중", 0, allGames.length);

  const metaFailures: MetaFailure[] = [];

  const enriched = await batchProcess<(typeof allGames)[0], EnrichedGame>(
    allGames,
    async (game): Promise<EnrichedGame> => {
      try {
        const reasons: string[] = [];
        let genres: string[] = [];
        let categories: string[] = [];
        let tags: string[] = [];

        let resolvedName = game.name;
        let store_price_krw: number | null = null;
        try {
          const details = await getAppDetails(game.appid);
          genres = details.genres;
          categories = details.categories;
          store_price_krw = details.store_price_krw;
          if (details.game_name) resolvedName = details.game_name;
        } catch (e) {
          reasons.push(`appdetails: ${String(e)}`);
        }

        try {
          tags = await getSteamSpyTags(game.appid);
        } catch (e) {
          reasons.push(`steamspy: ${String(e)}`);
        }

        if (reasons.length > 0) {
          metaFailures.push({ appid: game.appid, game_name: resolvedName, reasons });
        }

        return {
          appid: game.appid,
          game_name: resolvedName,
          genres,
          categories,
          tags,
          playtime_forever: game.playtime_forever,
          playtime_2weeks: game.playtime_2weeks,
          source: game.source,
          store_price_krw,
        };
      } catch (fatal) {
        console.error(`[sync] processor 치명적 오류 appid=${game.appid}:`, fatal);
        return {
          appid: game.appid,
          game_name: game.name,
          genres: [],
          categories: [],
          tags: [],
          playtime_forever: game.playtime_forever,
          playtime_2weeks: game.playtime_2weeks,
          source: game.source,
          store_price_krw: null,
        };
      }
    },
    3,
    300,
    (done, total) => {
      const ratio = done / Math.max(total, 1);
      report(22 + ratio * 58, "게임 정보 분석 중", done, total);
    }
  );

  const recovered: EnrichedGame[] = enriched.map((g, i) => {
    if (g !== null) return g;
    const src = allGames[i];
    console.warn(`[sync] batchProcess null 복구 — appid=${src.appid} "${src.name}" (메타 없이 저장)`);
    return {
      appid: src.appid,
      game_name: src.name,
      genres: [],
      categories: [],
      tags: [],
      playtime_forever: src.playtime_forever,
      playtime_2weeks: src.playtime_2weeks,
      source: src.source,
      store_price_krw: null,
    };
  });

  const nullDroppedItems = allGames.filter((_, i) => enriched[i] === null);

  const gameRows = recovered.map((g) => ({
    user_id: userId,
    appid: g.appid,
    game_name: g.game_name,
    genres: g.genres,
    categories: g.categories,
    tags: g.tags,
    playtime_forever: g.playtime_forever,
    playtime_2weeks: g.playtime_2weeks,
    source: g.source,
    store_price_krw: g.store_price_krw,
  }));

  report(84, "상세 데이터 저장 중");
  const saveFailures = await upsertGameRows(supabase, gameRows);

  report(88, "저장 결과 확인 중");
  const { data: storedRows } = await supabase
    .from("user_games")
    .select("appid")
    .eq("user_id", userId);

  const storedSet = new Set((storedRows ?? []).map((r: { appid: number }) => r.appid));
  const missingGames = allGames
    .filter((g) => !storedSet.has(g.appid))
    .map((g) => ({ appid: g.appid, name: g.name }));

  const valheimStored = storedSet.has(VALHEIM_APPID);
  const escapeStored = storedSet.has(ESCAPE_SIMULATOR_APPID);
  const savedCount = storedSet.size;

  console.log(`[sync] ── 결과 ──────────────────────────────`);
  console.log(`[sync] Steam 원본: ${allGames.length}개 | DB 저장: ${savedCount}개 | 누락: ${missingGames.length}개`);

  report(90, "업적 데이터 동기화 중", 0, allGames.length);
  await batchProcess(
    allGames,
    async (game) => {
      const achievements = await getPlayerAchievements(steamId, game.appid);
      if (achievements.length === 0) return;

      const rows = achievements.map((a) => ({
        user_id: userId,
        appid: game.appid,
        achievement_name: a.apiname,
        achieved: a.achieved === 1,
        unlock_time:
          a.unlocktime > 0 ? new Date(a.unlocktime * 1000).toISOString() : null,
      }));

      const { error } = await supabase
        .from("user_achievements")
        .upsert(rows, { onConflict: "user_id,appid,achievement_name" });
      if (error) {
        console.error(`[sync] user_achievements 실패 (appid ${game.appid}): ${error.message}`);
      }
    },
    2,
    250,
    (done, total) => {
      const ratio = done / Math.max(total, 1);
      report(90 + ratio * 8, "업적 데이터 동기화 중", done, total);
    }
  );

  await supabase
    .from("users")
    .update({ games_updated_at: new Date().toISOString() })
    .eq("id", userId);

  report(100, "동기화 완료", savedCount, allGames.length);

  return {
    success: true,
    profile_public: profilePublic,
    api_game_count: apiGameCount,
    owned_from_api: ownedGames.length,
    merged_total: mergedOwned.length,
    total: allGames.length,
    saved: savedCount,
    escape_simulator: {
      appid: ESCAPE_SIMULATOR_APPID,
      in_api: Boolean(escapeOwned),
      in_db: escapeStored,
      playtime_minutes: escapeOwned?.playtime_forever ?? 0,
    },
    valheim_in_api: Boolean(valheimOwned),
    valheim_in_db: valheimStored,
    missing: missingGames,
    null_dropped: nullDroppedItems.map((g) => g.appid),
    meta_failures: metaFailures.map((f) => ({
      appid: f.appid,
      game_name: f.game_name,
      reasons: f.reasons,
    })),
    save_failures: saveFailures,
  };
}
