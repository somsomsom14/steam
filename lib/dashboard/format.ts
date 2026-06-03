/** Steam playtime_forever: minutes → display hours */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

export function formatHours(minutes: number): string {
  const h = minutes / 60;
  if (h >= 1000) return `${Math.round(h).toLocaleString("ko-KR")}시간`;
  if (h >= 100) return `${Math.round(h).toLocaleString("ko-KR")}시간`;
  if (h >= 10) return `${Math.round(h)}시간`;
  if (h >= 1) return `${h.toFixed(1)}시간`;
  if (minutes > 0) return `${minutes}분`;
  return "0시간";
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
