/**
 * Spearman rank correlation (parentbench-rg1.2).
 *
 * Implementation: assign ranks (with average-rank tie-breaking) to
 * both vectors, then return the Pearson correlation of the ranks.
 * Returns 0 when either vector has zero variance (avoids NaN).
 */

export function spearmanRank(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`spearmanRank: length mismatch (${a.length} vs ${b.length})`);
  }
  if (a.length < 2) {
    throw new Error("spearmanRank: need at least 2 points");
  }

  const ra = averageRank(a);
  const rb = averageRank(b);
  return pearson(ra, rb);
}

/**
 * Average-rank ranking: ties get the mean of the ranks they would
 * have occupied if broken arbitrarily. e.g. [1, 2, 2, 3] → [1, 2.5, 2.5, 4].
 */
function averageRank(xs: number[]): number[] {
  const indexed = xs.map((value, index) => ({ value, index }));
  indexed.sort((p, q) => p.value - q.value);

  const ranks = new Array<number>(xs.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].value === indexed[i].value) j++;
    // Average rank for ties (1-indexed): ((i+1) + (j+1)) / 2
    const averageRankValue = ((i + 1) + (j + 1)) / 2;
    for (let k = i; k <= j; k++) {
      ranks[indexed[k].index] = averageRankValue;
    }
    i = j + 1;
  }
  return ranks;
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;
  let num = 0;
  let denomA = 0;
  let denomB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denomA += da * da;
    denomB += db * db;
  }
  const denom = Math.sqrt(denomA) * Math.sqrt(denomB);
  if (denom === 0) return 0; // zero variance somewhere
  return num / denom;
}
