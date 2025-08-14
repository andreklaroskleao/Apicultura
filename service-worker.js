const CACHE_NAME = 'beecontrol-cache-v1';
// Lista de arquivos que o aplicativo precisa para rodar offline
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/relatorio.js',
  '/monitoramento.js',
  '/gestao.js',
  'https://cdn.tailwindcss.com', // Cuidado com CDNs, idealmente baixe e sirva localmente
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
  // Adicione aqui a imagem de fundo se houver (ex: '/fundo.png')
  // Adicione os ícones do manifest
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Evento de Instalação: Salva os arquivos no cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

// Evento de Fetch: Intercepta as requisições
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Se a resposta estiver no cache, retorna ela
        if (response) {
          return response;
        }
        // Senão, busca na rede
        return fetch(event.request);
      })
  );
});