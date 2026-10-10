/**
 * Fuzzy Search & Typo-Tolerant Matching Utilities
 * 
 * Nagbibigay-daan sa paghahanap ng trabaho kahit may slight typo,
 * kulang na letra, o partial keyword (hal. "test g" -> "Test Job").
 */

// Helper para i-calculate ang Levenshtein distance sa pagitan ng dalawang strings
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) dp[i] = [i];
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // deletion
        dp[i][j - 1] + 1,       // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
}

// Normalizer: ginagawang lowercase, tinatanggal ang accents at special symbols
export function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Bigram / Dice coefficient similarity (0.0 to 1.0)
export function stringSimilarity(str1: string, str2: string): number {
  const s1 = normalizeText(str1).replace(/\s+/g, '');
  const s2 = normalizeText(str2).replace(/\s+/g, '');
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) {
    return s1 === s2 ? 1.0 : 0;
  }

  const bigrams1 = new Map<string, number>();
  for (let i = 0; i < s1.length - 1; i++) {
    const bg = s1.substring(i, i + 2);
    bigrams1.set(bg, (bigrams1.get(bg) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bg = s2.substring(i, i + 2);
    const count = bigrams1.get(bg) || 0;
    if (count > 0) {
      bigrams1.set(bg, count - 1);
      intersection++;
    }
  }

  return (2.0 * intersection) / (s1.length - 1 + s2.length - 1);
}

/**
 * Nagbabalik ng match score mula 0 hanggang 1.
 * 0 = Walang kaugnayan
 * 1 = Eksaktong pareho
 */
export function getFuzzyScore(rawQuery: string, rawTarget: string): number {
  if (!rawQuery || !rawTarget) return 0;

  const q = normalizeText(rawQuery);
  const t = normalizeText(rawTarget);
  if (!q || !t) return 0;

  // 1. Eksaktong pareho
  if (t === q) return 1.0;

  // 2. Target ay nagsisimula sa eksaktong query (hal. "test" sa "test job")
  if (t.startsWith(q)) return 0.98;

  // 3. Direct substring match kahit saan sa loob ng target
  if (t.includes(q)) return 0.95;

  const qWords = q.split(' ').filter(Boolean);
  const tWords = t.split(' ').filter(Boolean);

  if (qWords.length === 0 || tWords.length === 0) return 0;

  const totalQueryChars = qWords.reduce((sum, w) => sum + w.length, 0);
  let totalWordScore = 0;

  for (const qw of qWords) {
    let bestWordMatchScore = 0;

    for (const tw of tWords) {
      // Direct exact word match
      if (tw === qw) {
        bestWordMatchScore = 1.0;
        break;
      }

      // Word starts with query word
      if (qw.length >= 2 && tw.startsWith(qw)) {
        bestWordMatchScore = Math.max(bestWordMatchScore, 0.85 + (qw.length / tw.length) * 0.1);
      } else if (qw.length === 1 && tw.startsWith(qw)) {
        bestWordMatchScore = Math.max(bestWordMatchScore, 0.4);
      }

      // Query word starts with target word (hal. user typed "dishwashing", target is "dish")
      if (tw.length >= 2 && qw.startsWith(tw)) {
        bestWordMatchScore = Math.max(bestWordMatchScore, 0.8 + (tw.length / qw.length) * 0.1);
      }

      // Substring match sa loob ng salita (hal. "tutor" sa "tutoring" o "crew" sa "servicecrew")
      if (qw.length >= 3 && tw.includes(qw)) {
        bestWordMatchScore = Math.max(bestWordMatchScore, 0.8 + (qw.length / tw.length) * 0.1);
      } else if (tw.length >= 3 && qw.includes(tw)) {
        bestWordMatchScore = Math.max(bestWordMatchScore, 0.75 + (tw.length / qw.length) * 0.1);
      }

      // Typo tolerance (Levenshtein distance)
      if (qw.length >= 3 && tw.length >= 3) {
        const maxLen = Math.max(qw.length, tw.length);
        const maxAllowed = maxLen <= 4 ? 1 : maxLen <= 8 ? 2 : 3;
        const dist = levenshteinDistance(qw, tw);
        if (dist <= maxAllowed) {
          const sim = 1 - dist / maxLen;
          bestWordMatchScore = Math.max(bestWordMatchScore, 0.65 + sim * 0.25);
        }
      }
    }

    const wordWeight = totalQueryChars > 0 ? qw.length / totalQueryChars : 1 / qWords.length;
    totalWordScore += bestWordMatchScore * wordWeight;
  }

  // Fallback string similarity para sa magkadikit na mga salita
  const diceSim = stringSimilarity(q, t);

  if (totalWordScore > 0) {
    return Math.max(totalWordScore, diceSim * 0.85);
  }

  if (diceSim >= 0.3) {
    return diceSim * 0.75;
  }

  // Prefix slice similarity kapag may tuluy-tuloy na typo (hal. "testjob")
  if (q.length >= 4) {
    const tSub = t.substring(0, Math.min(t.length, q.length + 3));
    const dist = levenshteinDistance(q, tSub);
    const sim = 1 - dist / Math.max(q.length, tSub.length);
    if (sim >= 0.5) {
      return sim * 0.7;
    }
  }

  return 0;
}

export interface MatchResult {
  matches: boolean;
  score: number;
  isApproximate: boolean;
}

export type FieldInput =
  | string
  | null
  | undefined
  | string[]
  | { value: string | null | undefined | string[]; weight?: number };

/**
 * Sinusuri kung nag-ma-match ang query sa alinman sa mga ibinigay na fields ng Job.
 * Nagbabalik ng matches: true kung score >= threshold (default 0.25).
 */
export function matchJobWithQuery(
  query: string,
  fields: FieldInput[],
  threshold = 0.25
): MatchResult {
  if (!query || !query.trim()) {
    return { matches: true, score: 1.0, isApproximate: false };
  }

  let maxScore = 0;

  for (const field of fields) {
    if (!field) continue;

    let targetValue: any = field;
    let fieldWeight = 1.0;

    if (typeof field === 'object' && !Array.isArray(field) && 'value' in field) {
      targetValue = (field as any).value;
      fieldWeight = (field as any).weight ?? 1.0;
    }

    if (!targetValue) continue;

    if (Array.isArray(targetValue)) {
      for (const item of targetValue) {
        if (typeof item === 'string' && item) {
          const rawScore = getFuzzyScore(query, item);
          const weightedScore = rawScore * fieldWeight;
          if (weightedScore > maxScore) maxScore = weightedScore;
        }
      }
    } else if (typeof targetValue === 'string' && targetValue) {
      const rawScore = getFuzzyScore(query, targetValue);
      const weightedScore = rawScore * fieldWeight;
      if (weightedScore > maxScore) maxScore = weightedScore;
    }
  }

  return {
    matches: maxScore >= threshold,
    score: maxScore,
    isApproximate: maxScore > 0 && maxScore < 0.85,
  };
}
