/**
 * utils/id.ts
 * -----------
 * Makes short unique ids. We use the browser's own random generator, so nothing
 * is ever sent anywhere.
 */

/** A short id that is unique inside this document. */
export function newId(prefix = ''): string {
  const random = Math.random().toString(36).slice(2, 8)
  const time = Date.now().toString(36)
  return prefix ? `${prefix}_${time}${random}` : `${time}${random}`
}
