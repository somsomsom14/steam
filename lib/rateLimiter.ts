/**
 * 배치 처리기: items를 concurrency 단위로 나눠서 병렬 실행,
 * 각 배치 사이에 delayMs 대기. API rate limit 대응용.
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency = 3,
  delayMs = 250
): Promise<(R | null)[]> {
  const results: (R | null)[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map(processor));

    for (let j = 0; j < settled.length; j++) {
      const r = settled[j];
      if (r.status === "fulfilled") {
        results.push(r.value);
      } else {
        const item = batch[j];
        console.error(
          `[batchProcess] processor rejected (index ${i + j}):`,
          r.reason,
          item
        );
        results.push(null);
      }
    }

    if (i + concurrency < items.length && delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
