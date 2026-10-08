/**
 * utils/normalize.ts
 * ------------------
 * Finding "the same thing" written in a slightly different way.
 *
 * Real records contain "T537 EBR", "T537EBR" and "t537ebr". These are the same
 * truck, so we compare them without spaces and without capitals.
 */

/** The key used to decide if two words mean the same thing. */
export function matchKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toUpperCase()
}

/** Are these two words the same thing (ignoring spaces and capitals)? */
export function isSameWord(a: string, b: string): boolean {
  const ka = matchKey(a)
  const kb = matchKey(b)
  return ka.length > 0 && ka === kb
}

/** A tidy copy for comparison: capitals fixed, spaces squeezed. */
export function tidy(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toUpperCase()
}

/**
 * Counts how many single-letter changes are needed to turn `a` into `b`.
 * This is the simple, well known "Levenshtein distance" and is only used to
 * decide whether to show a gentle "Did you mean ...?" hint.
 */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1
  const cols = b.length + 1
  let previous = new Array<number>(cols)
  let current = new Array<number>(cols)

  for (let j = 0; j < cols; j += 1) previous[j] = j

  for (let i = 1; i < rows; i += 1) {
    current[0] = i
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost)
    }
    const swap = previous
    previous = current
    current = swap
  }
  return previous[cols - 1]
}

/**
 * Looks for an existing saved word that is very close to what the user typed.
 * Returns the saved word (so we can show "Did you mean T537 EBR?") or null.
 */
export function findSimilarWord(typed: string, options: string[]): string | null {
  const target = tidy(typed)
  if (target.length < 3) return null

  // Exact match (ignoring spaces/capitals) means there is nothing to suggest.
  if (options.some((option) => isSameWord(option, typed))) return null

  // The tolerance grows a little with the length of the word, so long truck
  // numbers are not "similar" to everything.
  const tolerance = target.length <= 4 ? 1 : target.length <= 8 ? 2 : 3

  let best: string | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const option of options) {
    const score = editDistance(target, tidy(option))
    if (score < bestScore) {
      bestScore = score
      best = option
    }
  }
  return best !== null && bestScore <= tolerance ? best : null
}
