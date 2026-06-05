import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
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

export const maxDuration = 60;

type EnrichedGame = {
  appid: number;
  game_name: string;
  genres: string[];
  categories: string[];
  tags: string[];
  playtime_forever: number;
  playtime_2weeks: number;
  source: string;
  /** 한국 스토어 정가(원). 무료=0, 미조회=null */
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

export async function POST(_req: NextRequest) {
  // 1. 세션 검증
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const session = await verifySession(token);
  if (!session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { userId, steamId } = session;
  const supabase = createSupabaseServerClient();

  const player = await getPlayerSummaries(steamId);
  const profilePublic = player?.communityvisibilitystate === 3;

  // 2. 보유 게임 + 최근 게임 병렬 조회
  const [{ games: ownedGames, gameCount: apiGameCount }, recentGames] =
    await Promise.all([
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
  console.log(
    `[sync] Valheim(892970) 원본: ${valheimOwned ? `있음 "${valheimOwned.name}"` : "없음"}`
  );
  console.log(
    `[sync] Escape Simulator(1435790): ${escapeOwned ? `있음 playtime=${escapeOwned.playtime_forever}분` : "API 응답 없음"}`
  );
  console.log(`[sync] GetRecentlyPlayedGames: ${recentGames.length}개`);
  console.log(`[sync] 처리 대상: ${allGames.length}개`);

  // 2.5 플레이 시간·이름 먼저 DB 저장 (메타 수집 전 — 타임아웃 시에도 게임 누락 방지)
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

  // 3. 메타데이터 수집 — 실패해도 게임 자체는 반드시 반환
  const metaFailures: MetaFailure[] = [];

  const enriched = await batchProcess<(typeof allGames)[0], EnrichedGame>(
    allGames,
    async (game): Promise<EnrichedGame> => {
      // 최상위 try/catch — 어떤 예외도 null 반환을 막음
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
        // 절대 null이 반환되지 않도록 최후 안전망
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
    300
  );

  // batchProcess null → 메타데이터 없이도 반드시 저장 (appdetails/steamspy 실패와 무관)
  const recovered: EnrichedGame[] = enriched.map((g, i) => {
    if (g !== null) return g;
    const src = allGames[i];
    console.warn(
      `[sync] batchProcess null 복구 — appid=${src.appid} "${src.name}" (메타 없이 저장)`
    );
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

  // 4. 메타데이터 포함 전체 upsert
  const saveFailures = await upsertGameRows(supabase, gameRows);

  // 5. 사후 검증 — DB에 실제로 저장된 appid와 비교해 누락 게임 특정
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
  if (escapeOwned && !escapeStored) {
    const ef = saveFailures.find((f) => f.appid === ESCAPE_SIMULATOR_APPID);
    console.error(
      `[sync] Escape Simulator(1435790) API에는 있으나 DB 미저장:`,
      ef?.reason ?? "원인 불명"
    );
  } else if (escapeStored) {
    console.log(`[sync] Escape Simulator(1435790): DB 저장 확인 ✓`);
  }

  if (valheimOwned && !valheimStored) {
    const vf = saveFailures.find((f) => f.appid === VALHEIM_APPID);
    console.error(
      `[sync] Valheim(892970) 원본에는 있으나 DB 미저장 — upsert 실패:`,
      vf?.reason ?? "원인 불명 (saveFailures/RLS 확인)"
    );
  } else if (valheimOwned && valheimStored) {
    console.log(`[sync] Valheim(892970): 원본 O → DB 저장 O`);
  }

  const savedCount = storedSet.size;

  // 6. 로그 요약
  console.log(`[sync] ── 결과 ──────────────────────────────`);
  console.log(`[sync] Steam 원본: ${allGames.length}개 | DB 저장: ${savedCount}개 | 누락: ${missingGames.length}개`);

  if (nullDroppedItems.length > 0) {
    console.warn(`[sync] batchProcess null 누락:`, nullDroppedItems.map((g) => g.appid));
  }
  if (metaFailures.length > 0) {
    console.log(`[sync] 메타데이터 실패 (빈 배열 저장): ${metaFailures.length}개`);
    metaFailures.forEach(({ appid, game_name, reasons }) =>
      console.log(`  appid=${appid} "${game_name}" → ${reasons.join(" | ")}`)
    );
  }
  if (saveFailures.length > 0) {
    console.warn(`[sync] upsert 실패: ${saveFailures.length}개`);
    saveFailures.forEach(({ appid, reason }) =>
      console.warn(`  appid=${appid} → ${reason}`)
    );
  }
  if (missingGames.length > 0) {
    console.warn(`[sync] ★ 최종 누락 게임:`, missingGames);
  } else {
    console.log(`[sync] 전체 ${savedCount}개 완벽 저장 ✓`);
  }

  // 6. 업적 수집
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
          a.unlocktime > 0
            ? new Date(a.unlocktime * 1000).toISOString()
            : null,
      }));

      const { error } = await supabase
        .from("user_achievements")
        .upsert(rows, { onConflict: "user_id,appid,achievement_name" });
      if (error) {
        console.error(
          `[sync] user_achievements 실패 (appid ${game.appid}): ${error.message}`
        );
      }
    },
    2,
    250
  );

  // games_updated_at 갱신 (실패해도 응답에 영향 없음)
  await supabase
    .from("users")
    .update({ games_updated_at: new Date().toISOString() })
    .eq("id", userId);

  return NextResponse.json({
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
    missing: missingGames,           // ← 누락된 게임 목록 (appid + name)
    null_dropped: nullDroppedItems.map((g) => g.appid),
    meta_failures: metaFailures.map((f) => ({
      appid: f.appid,
      game_name: f.game_name,
      reasons: f.reasons,
    })),
    save_failures: saveFailures,
  });
}
