const CACHE_NAME = 'beecontrol-cache-v2'; // Mudei a versão para forçar a atualização
// Lista de arquivos que o aplicativo precisa para rodar offline
// Usamos './' para garantir que os caminhos são relativos à raiz do site.
const URLS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './relatorio.js',
  './monitoramento.js',
  './gestao.js',
  './fundo.png', // Adicionei a imagem de fundo que você usa
  // Adicione aqui os ícones que você criou e colocou na pasta /icons/
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// Evento de Instalação: Salva os arquivos no cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto, adicionando arquivos essenciais.');
        return cache.addAll(URLS_TO_CACHE);
      })
      .catch(error => {
        console.error('Falha ao adicionar arquivos ao cache durante a instalação:', error);
      })
  );
});

// Evento de Ativação: Limpa caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: limpando cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});


// Evento de Fetch: Intercepta as requisições
self.addEventListener('fetch', event => {
  // Ignora requisições que não são GET (ex: para o Firestore)
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Se a resposta estiver no cache, retorna ela
        if (response) {
          return response;
        }
        
        // Senão, busca na rede, clona e salva no cache para a próxima vez
        return fetch(event.request).then(
          networkResponse => {
            // Verifica se a resposta da rede é válida
            if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // Clona a resposta. Uma resposta é um Stream e só pode ser consumida uma vez.
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        );
      })
      .catch(error => {
          // Em caso de falha total (offline e não está no cache), 
          // você poderia retornar uma página offline padrão, se tivesse uma.
          console.error("Falha no fetch do Service Worker:", error);
      })
  );
});
