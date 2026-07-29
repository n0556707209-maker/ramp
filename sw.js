/* LEVI RAMP — Service Worker
   חייב להיות קובץ אמיתי באותו דומיין. רישום מ-blob: נכשל תמיד.

   אסטרטגיה מעורבת, בכוונה:
   • דף ה-HTML  → רשת תחילה. כך עדכון גרסה תמיד מגיע מיד כשיש קליטה,
     ואי אפשר להיתקע על גרסה ישנה. בלי רשת — נופלים למטמון.
   • שאר הנכסים → מטמון תחילה (מהיר), עם רענון ברקע.

   הגרסה הקודמת השתמשה במטמון-תחילה גם ל-HTML, ולכן משתמש יכול היה
   להישאר תקוע על גרסה ישנה גם אחרי שהעלינו חדשה. */

const CACHE = 'levi-ramp-v4-7';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  const isHTML = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // רשת תחילה — העדכון תמיד מנצח
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // נכסים סטטיים — מטמון תחילה, רענון ברקע
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
