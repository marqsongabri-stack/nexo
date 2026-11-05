// Nexo — service worker: funciona offline, recebe notificações push e comprovantes compartilhados
const CACHE = 'nexo-v4';
const LIB = 'nexo-lib';
const DATA = 'nexo-data';
const SHARE = 'nexo-share';
const SHELL = ['./', './index.html', './config.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const LIB_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => ![CACHE, LIB, DATA, SHARE].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // Comprovante compartilhado pelo app do banco (menu Compartilhar)
  if (req.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      const fd = await req.formData();
      const file = fd.get('file');
      const text = ['title', 'text', 'url'].map(k => fd.get(k)).filter(Boolean).join('\n');
      const c = await caches.open(SHARE);
      await c.delete('file'); await c.delete('text');
      if (file && file.size) await c.put('file', new Response(file, { headers: { 'content-type': file.type || 'application/octet-stream', 'x-name': encodeURIComponent(file.name || '') } }));
      if (text) await c.put('text', new Response(text));
      return Response.redirect(new URL('./?shared=1#gastos', self.registration.scope).href, 303);
    })());
    return;
  }
  if (req.method !== 'GET') return;

  // Bibliotecas e fontes: guarda uma cópia pra abrir sem internet
  if (LIB_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(LIB).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok || r.type === 'opaque') c.put(req, r.clone());
      return r;
    }));
    return;
  }
  if (url.origin !== location.origin) return; // banco de dados vai direto pra rede

  // Páginas e config: rede primeiro, cópia local se estiver offline
  if (req.mode === 'navigate' || url.pathname.endsWith('/config.js')) {
    const key = req.mode === 'navigate' ? './index.html' : './config.js';
    e.respondWith(fetch(req).then(r => { const cl = r.clone(); caches.open(CACHE).then(c => c.put(key, cl)); return r; })
      .catch(() => caches.match(key)));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});

// Notificação push enviada pelo servidor de avisos (Supabase)
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data.json(); } catch (_) { d = { title: 'Nexo', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Nexo', {
    body: d.body || '', tag: d.tag, icon: 'icon-192.png', badge: 'icon-192.png',
    vibrate: [80, 40, 80], data: { url: d.url || './#afazeres' }
  }));
});

// Lembretes locais (modo sem servidor)
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'reminders') {
    e.waitUntil(caches.open(DATA).then(c =>
      c.put('reminders.json', new Response(JSON.stringify(e.data.items || []), { headers: { 'content-type': 'application/json' } }))
    ));
  }
});
async function checkDue() {
  const c = await caches.open(DATA);
  const r = await c.match('reminders.json');
  if (!r) return;
  const items = await r.json();
  const now = Date.now();
  const due = items.filter(i => i.at <= now && now - i.at < 6 * 3600e3);
  if (!due.length) return;
  for (const i of due) {
    await self.registration.showNotification('⏰ ' + i.title, {
      body: i.time ? 'Marcado para ' + i.time : 'Para hoje',
      tag: i.id, icon: 'icon-192.png', badge: 'icon-192.png', vibrate: [80, 40, 80]
    });
  }
  const rest = items.filter(i => !due.includes(i));
  await c.put('reminders.json', new Response(JSON.stringify(rest), { headers: { 'content-type': 'application/json' } }));
  const clients = await self.clients.matchAll();
  clients.forEach(cl => cl.postMessage({ type: 'notified', ids: due.map(i => i.id) }));
}
self.addEventListener('periodicsync', e => {
  if (e.tag === 'nexo-reminders') e.waitUntil(checkDue());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './#afazeres';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) { c.navigate(target); return c.focus(); } }
    return self.clients.openWindow(target);
  }));
});
