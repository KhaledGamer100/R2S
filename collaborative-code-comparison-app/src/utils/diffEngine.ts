// Smart Diffing Engine for comparing code/text solutions
// Uses LCS (Longest Common Subsequence) algorithm for line-level and character-level diffing

import { CharDiff, ComparisonResult, DiffLine } from '../types';

/**
 * Compute the LCS dynamic programming table
 */
function computeLCS(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = [];

  for (let i = 0; i <= m; i++) {
    dp[i] = new Array(n + 1).fill(0);
    for (let j = 1; j <= n; j++) {
      if (i === 0) {
        dp[i][j] = 0;
      } else if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

/**
 * Backtrack through LCS table to produce diff lines
 */
function backtrackLCS(dp: number[][], a: string[], b: string[]): DiffLine[] {
  const result: DiffLine[] = [];
  let i = a.length;
  let j = b.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.unshift({ type: 'equal', line1: a[i - 1], line2: b[j - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', line2: b[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'removed', line1: a[i - 1] });
      i--;
    }
  }

  // Merge consecutive removed + added into "modified" with char-level diff
  const merged: DiffLine[] = [];
  let k = 0;
  while (k < result.length) {
    if (
      result[k].type === 'removed' &&
      k + 1 < result.length &&
      result[k + 1].type === 'added'
    ) {
      const charDiffs = computeCharDiff(
        result[k].line1 || '',
        result[k + 1].line2 || ''
      );
      merged.push({
        type: 'modified',
        line1: result[k].line1,
        line2: result[k + 1].line2,
        charDiffs,
      });
      k += 2;
    } else if (
      result[k].type === 'removed' &&
      k + 1 < result.length &&
      result[k + 1].type === 'removed'
    ) {
      // Multiple removals - keep separate
      merged.push(result[k]);
      k++;
    } else {
      merged.push(result[k]);
      k++;
    }
  }

  return merged;
}

/**
 * Character-level diff using LCS
 * Falls back to word-level for very long strings
 */
function computeCharDiff(a: string, b: string): CharDiff[] {
  // For long strings, use word-level diff instead
  if (a.length > 300 || b.length > 300) {
    return computeWordDiff(a, b);
  }

  const charsA = a.split('');
  const charsB = b.split('');
  const dp = computeLCS(charsA, charsB);

  const temp: CharDiff[] = [];
  let i = charsA.length;
  let j = charsB.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && charsA[i - 1] === charsB[j - 1]) {
      temp.unshift({ type: 'equal', value: charsA[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      temp.unshift({ type: 'added', value: charsB[j - 1] });
      j--;
    } else {
      temp.unshift({ type: 'removed', value: charsA[i - 1] });
      i--;
    }
  }

  // Merge consecutive same-type entries
  return mergeCharDiffs(temp);
}

/**
 * Word-level diff for long strings
 */
function computeWordDiff(a: string, b: string): CharDiff[] {
  // Split by whitespace and word boundaries
  const wordsA = a.split(/(\s+|[{}()[\];,.<>:!=+\-*/&|?])/);
  const wordsB = b.split(/(\s+|[{}()[\];,.<>:!=+\-*/&|?])/);

  const dp = computeLCS(wordsA, wordsB);
  const temp: CharDiff[] = [];
  let i = wordsA.length;
  let j = wordsB.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && wordsA[i - 1] === wordsB[j - 1]) {
      temp.unshift({ type: 'equal', value: wordsA[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      temp.unshift({ type: 'added', value: wordsB[j - 1] });
      j--;
    } else {
      temp.unshift({ type: 'removed', value: wordsA[i - 1] });
      i--;
    }
  }

  return mergeCharDiffs(temp);
}

/**
 * Merge consecutive CharDiff entries of the same type
 */
function mergeCharDiffs(diffs: CharDiff[]): CharDiff[] {
  const result: CharDiff[] = [];
  for (const d of diffs) {
    if (result.length > 0 && result[result.length - 1].type === d.type) {
      result[result.length - 1].value += d.value;
    } else {
      result.push({ type: d.type, value: d.value });
    }
  }
  return result;
}

/**
 * Attempt to format minified code by adding newlines
 * Detects minified code by average line length
 */
function tryFormat(input: string): string {
  if (!input.trim()) return input;

  const lines = input.split('\n');
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);

  if (nonEmptyLines.length === 0) return input;

  const avgLineLength =
    nonEmptyLines.reduce((sum, l) => sum + l.length, 0) / nonEmptyLines.length;

  // If average line is very long, it's likely minified
  if (avgLineLength > 150) {
    let formatted = input;

    // Add newlines after semicolons, opening braces, closing braces
    formatted = formatted.replace(/;(?!\s*\n)/g, ';\n');
    formatted = formatted.replace(/\{(?!\s*\n)/g, '{\n');
    formatted = formatted.replace(/\}(?!\s*\n)/g, '\n}\n');
    formatted = formatted.replace(/,(?=[^\s\n])/g, ',\n');

    // Add newlines before common keywords
    formatted = formatted.replace(
      /(?<!\w)(function|var|let|const|if|else|for|while|return|class|import|export)(?!\w)/g,
      '\n$1'
    );

    // Clean up excessive blank lines
    formatted = formatted.replace(/\n{3,}/g, '\n\n');

    return formatted;
  }

  return input;
}

/**
 * Main comparison function - the primary API for the diff engine
 * Takes two solution strings and returns a detailed ComparisonResult
 */
export function compareSolutions(
  sol1: string,
  sol2: string
): ComparisonResult {
  // Handle empty cases
  if (!sol1.trim() && !sol2.trim()) {
    return {
      matchPercentage: 100,
      totalLines: 0,
      matchedLines: 0,
      differentLines: 0,
      diffLines: [],
      matchedContent: [],
      differentContent: [],
    };
  }

  if (!sol1.trim() || !sol2.trim()) {
    const nonEmpty = sol1.trim() || sol2.trim();
    const lines = nonEmpty.split('\n');
    return {
      matchPercentage: 0,
      totalLines: lines.length,
      matchedLines: 0,
      differentLines: lines.length,
      diffLines: lines.map((l) =>
        sol1.trim()
          ? { type: 'removed' as const, line1: l }
          : { type: 'added' as const, line2: l }
      ),
      matchedContent: [],
      differentContent: lines.map((l) =>
        sol1.trim()
          ? { type: 'removed' as const, line1: l }
          : { type: 'added' as const, line2: l }
      ),
    };
  }

  // Try to format minified code for better diff results
  const formatted1 = tryFormat(sol1.trim());
  const formatted2 = tryFormat(sol2.trim());

  const lines1 = formatted1.split('\n');
  const lines2 = formatted2.split('\n');

  // Compute LCS and diff
  const dp = computeLCS(lines1, lines2);
  const diffLines = backtrackLCS(dp, lines1, lines2);

  // Calculate statistics
  const equalLines = diffLines.filter((d) => d.type === 'equal').length;
  const totalCompared = Math.max(lines1.length, lines2.length);

  // Match percentage: weighted by how many lines match
  const matchPercentage =
    totalCompared > 0
      ? Math.round((equalLines / totalCompared) * 100)
      : sol1 === sol2
        ? 100
        : 0;

  return {
    matchPercentage,
    totalLines: totalCompared,
    matchedLines: equalLines,
    differentLines: diffLines.filter((d) => d.type !== 'equal').length,
    diffLines,
    matchedContent: diffLines
      .filter((d) => d.type === 'equal')
      .map((d) => d.line1 || ''),
    differentContent: diffLines.filter((d) => d.type !== 'equal'),
  };
}

/**
 * Compute a quick similarity score between two strings
 * Used for live preview before full diff
 */
export function quickSimilarity(a: string, b: string): number {
  if (a === b) return 100;
  if (!a || !b) return 0;

  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;

  // Simple Jaccard similarity on character bigrams
  const bigramsA = new Set<string>();
  const bigramsB = new Set<string>();

  for (let i = 0; i < a.length - 1; i++) {
    bigramsA.add(a.substring(i, i + 2));
  }
  for (let i = 0; i < b.length - 1; i++) {
    bigramsB.add(b.substring(i, i + 2));
  }

  let intersection = 0;
  bigramsA.forEach((b) => {
    if (bigramsB.has(b)) intersection++;
  });

  const union = bigramsA.size + bigramsB.size - intersection;
  return union > 0 ? Math.round((intersection / union) * 100) : 0;
}
