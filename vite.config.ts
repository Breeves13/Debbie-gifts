import { defineConfig, type Plugin } from 'vite'
import tailwindcss from '@tailwindcss/vite'

function offlineShell(): Plugin {
  return {
    name: 'gift-tracker-offline-shell',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter(name => name.startsWith('assets/') && /\.(js|css)$/.test(name)).sort()
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `
const prefix = 'debbies-gifts-shell-';
const cacheName = prefix + ${JSON.stringify(files.join('|'))};
const shell = new URL('./index.html', self.registration.scope).href;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(
    [shell, './manifest.webmanifest', './gift.svg', './icon-192.png', './icon-512.png', ...${JSON.stringify(files)}]
  )));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(prefix) && key !== cacheName)
    .map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.open(cacheName).then(cache => cache.match(shell))));
    return;
  }
  event.respondWith(caches.open(cacheName).then(cache => cache.match(request)).then(cached => cached || fetch(request)));
});
`,
      })
    },
  }
}

export default defineConfig({ plugins: [tailwindcss(), offlineShell()], base: './', build: { target: 'safari15' } })
