const CACHE = 'work-set-v6'
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/media/supported-one-arm-row.gif',
  '/media/floor-kettlebell-pullover.gif',
  '/media/half-kneeling-strict-press.gif',
  '/media/bottoms-up-press.gif',
  '/media/kettlebell-arm-bar.gif',
  '/media/suitcase-carry-or-march.gif',
  '/media/tall-kneeling-halo.gif',
  '/media/tall-kneeling-chop.gif',
  '/media/half-kneeling-rotational-press.gif',
  '/media/kettlebell-windmill.gif',
  '/media/figure-eight-to-hold.gif',
  '/media/around-the-body-pass.gif',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))))
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone()
    caches.open(CACHE).then((cache) => cache.put(event.request, copy))
    return response
  }).catch(() => caches.match(event.request).then((response) => response ?? caches.match('/'))))
})
