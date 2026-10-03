/* Preventivo Rapido — service worker.
   Tutti i file dell'app (libreria Supabase compresa) in cache: l'app si apre anche senza rete.
   Le chiamate a Supabase (dati e login) passano sempre dalla rete. */
const CACHE = 'pr-antizanzare-v1';
const FILES = ['./', 'index.html', 'calcolo.js', 'supabase.min.js', 'catalogo-riserva.json', 'manifest.json',
  'icon.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.hostname.endsWith('supabase.co')) return;

  // file dell'app: prima la rete (aggiornamenti subito), se manca la cache
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request)
        .then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); return r; })
        .catch(() => caches.match(e.request, { ignoreSearch: true }))
    );
    return;
  }
});
