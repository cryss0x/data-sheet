/*
 * public/sw.js
 * ------------
 * The small "offline helper".
 *
 * It is a plain JavaScript file, not part of the app's build, and it does only
 * two things:
 *   1. keeps a copy of the app's own files (html, css, javascript, icons) in the
 *      browser's cache, so the app opens even with no internet connection;
 *   2. never touches anything to do with the user's documents - those live in
 *      the folder they chose, or in the browser's own storage.
 *
 * There are no outside connections of any kind.
 */

const CACHE_NAME = 'data-sheet-v1'

/* The few files that are always needed to open the app. */
const CORE_FILES = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png']

/* Adds the app's own files to the cache as they are used. */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      // One file failing (an old icon, for example) must not stop the install.
      await Promise.allSettled(CORE_FILES.map((file) => cache.add(file)))
      await self.skipWaiting()
    })(),
  )
})

/* Removes old copies when a new version is published. */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))
      await self.clients.claim()
    })(),
  )
})

/**
 * Serves the app from the cache first, so it opens instantly and works offline.
 * If a file is not in the cache yet, it is taken from the network and then put in
 * the cache for next time.
 */
self.addEventListener('fetch', (event) => {
  const request = event.request

  // Only ordinary requests to this site are handled. Nothing else is touched.
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME)

      // Looking at the app: try the saved copy of index.html so it works offline.
      if (request.mode === 'navigate') {
        const saved = await cache.match('/index.html')
        if (saved) {
          // Refresh the copy in the background so a new version is picked up.
          void fetchAndStore(cache, '/index.html')
          return saved
        }
      }

      const saved = await cache.match(request)
      if (saved) {
        void fetchAndStore(cache, request)
        return saved
      }

      try {
        return await fetchAndStore(cache, request)
      } catch {
        // Offline and not in the cache: send back the app itself, so the user
        // sees a working page rather than the browser's error page.
        if (request.mode === 'navigate') {
          const shell = await cache.match('/index.html')
          if (shell) return shell
        }
        return new Response('This file is not available offline yet.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        })
      }
    })(),
  )
})

/** Fetches a file and keeps a copy, returning the answer either way. */
async function fetchAndStore(cache, request) {
  const answer = await fetch(request)
  if (answer && answer.status === 200 && answer.type === 'basic') {
    await cache.put(request, answer.clone())
  }
  return answer
}
