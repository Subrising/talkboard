const CACHE = 'talkboard-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-512.png',
  './icons/arm.png',
  './icons/backpain.png',
  './icons/blanket.png',
  './icons/breathe.png',
  './icons/chest.png',
  './icons/closer.png',
  './icons/cold.png',
  './icons/confused.png',
  './icons/drink.png',
  './icons/drymouth.png',
  './icons/family.png',
  './icons/footy.png',
  './icons/forgive.png',
  './icons/frustrated.png',
  './icons/glasses.png',
  './icons/golf.png',
  './icons/goodbye.png',
  './icons/head.png',
  './icons/heart.png',
  './icons/holdhand.png',
  './icons/hot.png',
  './icons/hug.png',
  './icons/hungry.png',
  './icons/kiss.png',
  './icons/leg.png',
  './icons/love.png',
  './icons/medication.png',
  './icons/move.png',
  './icons/nurse.png',
  './icons/ok.png',
  './icons/pain.png',
  './icons/peace.png',
  './icons/proud.png',
  './icons/question.png',
  './icons/quiet.png',
  './icons/scared.png',
  './icons/sick.png',
  './icons/sit.png',
  './icons/sleep.png',
  './icons/sorry.png',
  './icons/stop.png',
  './icons/strong.png',
  './icons/talk.png',
  './icons/tennis.png',
  './icons/thanks.png',
  './icons/throat.png',
  './icons/together.png',
  './icons/toilet.png',
  './icons/tummy.png',
  './icons/tv.png',
  './icons/understand.png',
  './icons/wait.png',
  './icons/win.png',
  './icons/wrong.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first for navigation (so updates arrive), cache fallback for offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(m => m || caches.match('./index.html')))
  );
});
