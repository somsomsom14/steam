import { batchProcess } from "@/lib/rateLimiter";

/** Steam appdetails price_overview — KRW는 initial/100 = 원화 정가 */
type PriceOverview = {
  currency?: string;
  initial?: number;
  final?: number;
  initial_formatted?: string;
  final_formatted?: string;
};

type StoreAppData = {
  name?: string;
  is_free?: boolean;
  price_overview?: PriceOverview;
};

type AppDetailsPayload = {
  success?: boolean;
  data?: StoreAppData;
};

/** appdetails data — KRW 정가(원). 무료=0, 조회불가=null */
export function parseKrwRegularPriceFromStoreData(
  data: StoreAppData | undefined
): { priceKrw: number | null; isFree: boolean } {
  if (!data) return { priceKrw: null, isFree: false };
  if (data.is_free) return { priceKrw: 0, isFree: true };

  const initial = data.price_overview?.initial;
  if (initial == null || data.price_overview?.currency !== "KRW") {
    return { priceKrw: null, isFree: false };
  }

  return { priceKrw: Math.round(initial / 100), isFree: false };
}

export type AppKrwPrice = {
  appid: number;
  gameName: string | null;
  /** 한국 원화 정가 (원). 무료·미조회 시 0 */
  regularPriceKrw: number;
  isFree: boolean;
  /** appdetails 실패 또는 가격 정보 없음 */
  unavailable: boolean;
};

export type LibraryKrwValueResult = {
  currency: "KRW";
  /** 내 라이브러리 총 자산 가치 — 정가 합계 (원) */
  totalRegularPriceKrw: number;
  totalGames: number;
  pricedCount: number;
  freeCount: number;
  unavailableCount: number;
  games: AppKrwPrice[];
};

const STORE_APPDETAILS = "https://store.steampowered.com/api/appdetails";

/** Steam Store appdetails — 한국(KR) 정가 1건 */
export async function fetchAppKrwRegularPrice(appid: number): Promise<AppKrwPrice> {
  const url = `${STORE_APPDETAILS}?appids=${appid}&cc=kr&l=korean`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return { appid, gameName: null, regularPriceKrw: 0, isFree: false, unavailable: true };
    }

    const json = (await res.json()) as Record<string, AppDetailsPayload>;
    const block = json[String(appid)];
    if (!block?.success || !block.data) {
      return { appid, gameName: null, regularPriceKrw: 0, isFree: false, unavailable: true };
    }

    const { name } = block.data;
    const { priceKrw, isFree } = parseKrwRegularPriceFromStoreData(block.data);

    if (priceKrw === null) {
      return { appid, gameName: name ?? null, regularPriceKrw: 0, isFree: false, unavailable: true };
    }

    return {
      appid,
      gameName: name ?? null,
      regularPriceKrw: priceKrw,
      isFree,
      unavailable: false,
    };
  } catch {
    return { appid, gameName: null, regularPriceKrw: 0, isFree: false, unavailable: true };
  }
}

/**
 * AppID 목록 → 게임별 KRW 정가 + 합계 (UI 없음, 데이터만)
 * Steam Store API: 게임당 appdetails 1회
 */
export async function fetchLibraryKrwValue(
  appids: number[],
  options?: { concurrency?: number; delayMs?: number }
): Promise<LibraryKrwValueResult> {
  const unique = [...new Set(appids.filter((id) => id > 0))];
  const concurrency = options?.concurrency ?? 2;
  const delayMs = options?.delayMs ?? 300;

  const rows = await batchProcess(
    unique,
    (id) => fetchAppKrwRegularPrice(id),
    concurrency,
    delayMs
  );

  const games: AppKrwPrice[] = rows.map(
    (row, i) =>
      row ?? {
        appid: unique[i],
        gameName: null,
        regularPriceKrw: 0,
        isFree: false,
        unavailable: true,
      }
  );

  let totalRegularPriceKrw = 0;
  let pricedCount = 0;
  let freeCount = 0;
  let unavailableCount = 0;

  for (const g of games) {
    if (g.unavailable) {
      unavailableCount += 1;
      continue;
    }
    if (g.isFree) {
      freeCount += 1;
      continue;
    }
    if (g.regularPriceKrw > 0) {
      totalRegularPriceKrw += g.regularPriceKrw;
      pricedCount += 1;
    }
  }

  return {
    currency: "KRW",
    totalRegularPriceKrw,
    totalGames: games.length,
    pricedCount,
    freeCount,
    unavailableCount,
    games,
  };
}

/** DB user_games.store_price_krw 합계 (UI 연동용) */
export function sumLibraryKrwFromStoredPrices(
  rows: { store_price_krw?: number | null }[]
): number {
  return rows.reduce((sum, r) => sum + (r.store_price_krw ?? 0), 0);
}
