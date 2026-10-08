/**
 * utils/hash.ts
 * -------------
 * A tiny "fingerprint" of some text.
 *
 * The app remembers the fingerprint of every file it has read. If the
 * fingerprint in the folder is different next time, the file was changed outside
 * the app. This is a simple, well known hashing method (djb2) - it is used only
 * to spot changes, never to keep anything secret.
 */

/** A short fingerprint of some text. */
export function fingerprint(text: string): string {
  let hash = 5381
  for (let index = 0; index < text.length; index += 1) {
    // (hash * 33) + the next character, kept inside a whole number.
    hash = (hash * 33) ^ text.charCodeAt(index)
  }
  return `${text.length}:${(hash >>> 0).toString(36)}`
}

/** The exact text the app writes into a document file. */
export function documentText(document: unknown): string {
  return JSON.stringify(document, null, 2)
}
