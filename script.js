// Importações necessárias do SDK do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    doc, 
    getDoc,
    setDoc,
    updateDoc, 
    deleteDoc,
    query,
    where,
    writeBatch,
    getDocs,
    setLogLevel,
    arrayUnion,
    arrayRemove,
    orderBy,
    runTransaction,
    enableIndexedDbPersistence // <-- ADICIONADO PARA OFFLINE
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// Importações das funções de inicialização das outras abas
import { initializeReportPage } from './relatorio.js';
import { initializeMonitoringPage } from './monitoramento.js';
import { initializeManagementPage } from './gestao.js';


// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyC3_s5t0j0KAwVCs1_pxt2HOviAtrT02Fs",
  authDomain: "projeto-teste-klar.firebaseapp.com",
  projectId: "projeto-teste-klar",
  storageBucket: "projeto-teste-klar.appspot.com",
  messagingSenderId: "533984280350",
  appId: "1:533984280350:web:2e950faaa892056350530f",
  measurementId: "G-8G7LVKX571"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- HABILITAR PERSISTÊNCIA OFFLLINE ---
try {
    await enableIndexedDbPersistence(db);
    console.log("Persistência offline do Firestore ativada!");
} catch (err) {
    if (err.code == 'failed-precondition') {
        console.warn("Falha ao habilitar persistência. Múltiplas abas abertas podem causar este problema.");
    } else if (err.code == 'unimplemented') {
        console.error("Este navegador não suporta persistência offline.");
    }
}
// ------------------------------------

setLogLevel('debug');

// --- REFERÊNCIAS AO DOM ---
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const authError = document.getElementById('auth-error');
const logoutButton = document.getElementById('logout-button');
const userInfoDisplay = document.getElementById('user-info');
const dataForm = document.getElementById('data-form');
const dataTableBody = document.getElementById('data-table-body');
const formTitle = document.getElementById('form-title');
const collectionIdInput = document.getElementById('collection-id');
const hiveIdSelect = document.getElementById('hive-id-select');
const cancelEditButton = document.getElementById('cancel-edit-button');
const registerStateSelect = document.getElementById('register-state');
const registerCitySelect = document.getElementById('register-city');
// Views
const dashboardView = document.getElementById('dashboard-view');
const mapView = document.getElementById('map-view'); // NOVA VIEW
const monitoringView = document.getElementById('monitoring-view');
const managementView = document.getElementById('management-view');
const reportsView = document.getElementById('reports-view');
const adminView = document.getElementById('admin-view');
// Links de Navegação
const dashboardLink = document.getElementById('dashboard-link');
const mapViewLink = document.getElementById('map-view-link'); // NOVO LINK
const monitoringLink = document.getElementById('monitoring-link');
const managementLink = document.getElementById('management-link');
const reportsLink = document.getElementById('reports-link');
const adminPanelLink = document.getElementById('admin-panel-link');
// Outros
const adminUsersTableBody = document.getElementById('admin-users-table-body');
const notificationBell = document.getElementById('notification-bell');
const notificationCount = document.getElementById('notification-count');
const notificationDropdown = document.getElementById('notification-dropdown');
const requestAccessBtn = document.getElementById('request-access-btn');
const requestAccessModal = document.getElementById('request-access-modal');
const requestAccessForm = document.getElementById('request-access-form');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const viewDetailsModal = document.getElementById('view-details-modal');
const viewModalTitle = document.getElementById('view-modal-title');
const viewModalBody = document.getElementById('view-modal-body');
const viewModalCloseBtn = document.getElementById('view-modal-close-btn');
const viewModalCloseBtn2 = document.getElementById('view-modal-close-btn-2');
const profileButton = document.getElementById('profile-button');
const profileModal = document.getElementById('profile-modal');
const profileModalCloseBtn = document.getElementById('profile-modal-close-btn');
const profileModalCloseBtn2 = document.getElementById('profile-modal-close-btn-2');
const profileForm = document.getElementById('profile-form');
// Gestão de Colmeias
const hiveForm = document.getElementById('hive-form');
const hiveIdInput = document.getElementById('hive-id-input');
const hivesTableBody = document.getElementById('hives-table-body');
// Filtro de Coletas
const collectionFilterInput = document.getElementById('collection-filter-input');
// Modal de Edição de Colmeia
const editHiveModal = document.getElementById('edit-hive-modal');
const editHiveForm = document.getElementById('edit-hive-form');
const editHiveModalTitle = document.getElementById('edit-hive-modal-title');
const editHiveIdInput = document.getElementById('edit-hive-id');
const editHiveModalCloseBtn = document.getElementById('edit-hive-modal-close-btn');
const editHiveModalCancelBtn = document.getElementById('edit-hive-modal-cancel-btn');


let currentUser = null;
let unsubscribeFromCollections = null;
let unsubscribeFromNotifications = null;
let unsubscribeFromHives = null;
let notificationSound;
let userHives = []; 
let allUserCollections = []; 

// Variáveis para os mapas
let creationMap = null;
let creationMarker = null;
let fullMap = null; // Mapa principal
let hiveIcon = null;
let hiveMarkersLayer = null; // Camada para os marcadores

// EXPORTAÇÕES para outros módulos
export { db, currentUser, userHives };

// --- INICIALIZAÇÃO DO SOM ---
document.body.addEventListener('click', () => {
    if (typeof Tone !== 'undefined' && Tone.context.state !== 'running') {
        Tone.context.resume();
    }
    if (typeof Tone !== 'undefined' && !notificationSound) {
        notificationSound = new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 }
        }).toDestination();
    }
}, { once: true });


// --- LÓGICA DE NAVEGAÇÃO E UI ---
const switchTabs = (showLogin) => {
    loginTab.classList.toggle('active', showLogin);
    registerTab.classList.toggle('active', !showLogin);
    loginForm.classList.toggle('hidden', !showLogin);
    registerForm.classList.toggle('hidden', showLogin);
    authError.textContent = '';
};

loginTab.addEventListener('click', () => switchTabs(true));
registerTab.addEventListener('click', () => switchTabs(false));

function showView(viewToShow) {
    dashboardView.classList.add('hidden');
    mapView.classList.add('hidden');
    monitoringView.classList.add('hidden');
    managementView.classList.add('hidden');
    reportsView.classList.add('hidden');
    adminView.classList.add('hidden');
    
    viewToShow.classList.remove('hidden');

    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    
    if (viewToShow === dashboardView) {
        dashboardLink.classList.add('active');
        setTimeout(() => { if (creationMap) creationMap.invalidateSize(); }, 100);
    }
    if (viewToShow === mapView) {
        mapViewLink.classList.add('active');
        setTimeout(() => { if (fullMap) fullMap.invalidateSize(); }, 100);
    }
    if (viewToShow === monitoringView) monitoringLink.classList.add('active');
    if (viewToShow === managementView) managementLink.classList.add('active');
    if (viewToShow === reportsView) reportsLink.classList.add('active');
    if (viewToShow === adminView) adminPanelLink.classList.add('active');
};

dashboardLink.addEventListener('click', (e) => { e.preventDefault(); showView(dashboardView); });
mapViewLink.addEventListener('click', (e) => { e.preventDefault(); showView(mapView); initializeFullMapView(); });
monitoringLink.addEventListener('click', (e) => { e.preventDefault(); showView(monitoringView); initializeMonitoringPage(); });
managementLink.addEventListener('click', (e) => { e.preventDefault(); showView(managementView); initializeManagementPage(); });
reportsLink.addEventListener('click', (e) => { e.preventDefault(); showView(reportsView); initializeReportPage(); });
adminPanelLink.addEventListener('click', (e) => { e.preventDefault(); showView(adminView); });


// --- LÓGICA DO MAPA E CLIMA ---
function initializeCreationMap(lat, lng) {
    if (creationMap) {
        creationMap.setView([lat, lng], 13);
        creationMarker.setLatLng([lat, lng]);
        return;
    }

    hiveIcon = L.icon({
        iconUrl: 'hive-icon.png',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
    });

    creationMap = L.map('hive-map-container').setView([lat, lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(creationMap);

    creationMarker = L.marker([lat, lng], { 
        draggable: true,
        icon: hiveIcon
    }).addTo(creationMap);
}

function initializeFullMapView() {
    if (!fullMap) {
        // CORREÇÃO: Adiciona coordenadas padrão para evitar erro se currentUser.latitude não existir.
        const initialLat = currentUser?.latitude || -31.33; // Usa a latitude do usuário ou o padrão de Bagé
        const initialLng = currentUser?.longitude || -54.10; // Usa a longitude do usuário ou o padrão de Bagé

        fullMap = L.map('full-map-container').setView([initialLat, initialLng], 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(fullMap);
        hiveMarkersLayer = L.layerGroup().addTo(fullMap);
    }
    
    hiveMarkersLayer.clearLayers();

    userHives.forEach(hive => {
        if (hive.latitude && hive.longitude) {
            const marker = L.marker([hive.latitude, hive.longitude], { icon: hiveIcon })
                .addTo(hiveMarkersLayer)
                .bindPopup(`<b>Colmeia #${hive.id}</b><br>${hive.boxType || ''}`);
            
            marker.on('click', () => {
                showHiveDetails(hive.id);
            });
        }
    });
}

function getWeatherDescription(code) {
    const weatherCodes = {
        0: { desc: "Céu limpo", icon: "fa-sun" },
        1: { desc: "Quase limpo", icon: "fa-cloud-sun" },
        2: { desc: "Parcialmente nublado", icon: "fa-cloud-sun" },
        3: { desc: "Nublado", icon: "fa-cloud" },
        45: { desc: "Nevoeiro", icon: "fa-smog" },
        48: { desc: "Nevoeiro com gelo", icon: "fa-smog" },
        51: { desc: "Garoa leve", icon: "fa-cloud-rain" },
        53: { desc: "Garoa moderada", icon: "fa-cloud-rain" },
        55: { desc: "Garoa forte", icon: "fa-cloud-rain" },
        61: { desc: "Chuva fraca", icon: "fa-cloud-showers-heavy" },
        63: { desc: "Chuva moderada", icon: "fa-cloud-showers-heavy" },
        65: { desc: "Chuva forte", icon: "fa-cloud-showers-heavy" },
        80: { desc: "Pancadas de chuva fracas", icon: "fa-cloud-bolt" },
        81: { desc: "Pancadas de chuva moderadas", icon: "fa-cloud-bolt" },
        82: { desc: "Pancadas de chuva violentas", icon: "fa-cloud-bolt" }
    };
    return weatherCodes[code] || { desc: "Não disponível", icon: "fa-question-circle" };
}

async function fetchCurrentWeather(hiveId, lat, lon) {
    const weatherElement = document.getElementById(`weather-info-${hiveId}`);
    if (!weatherElement) return;

    try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await response.json();

        if (data.current_weather) {
            const temp = data.current_weather.temperature;
            const weatherCode = data.current_weather.weathercode;
            const { desc, icon } = getWeatherDescription(weatherCode);
            weatherElement.innerHTML = `<i class="fa-solid ${icon} mr-2"></i> ${temp}°C - ${desc}`;
        } else {
            weatherElement.textContent = "Não disponível";
        }
    } catch (error) {
        console.error("Erro ao buscar clima:", error);
        weatherElement.textContent = "Erro ao carregar";
    }
}


// --- API IBGE E GEOLOCALIZAÇÃO ---
async function fetchStates() {
    try {
        const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
        const states = await response.json();
        registerStateSelect.innerHTML = '<option value="">Selecione um Estado</option>';
        states.forEach(state => {
            const option = document.createElement('option');
            option.value = state.sigla;
            option.textContent = state.nome;
            registerStateSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Erro ao buscar estados:", error);
    }
}

async function fetchCities(stateUF) {
    if (!stateUF) {
        registerCitySelect.innerHTML = '<option value="">Selecione um Estado primeiro</option>';
        return;
    }
    try {
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${stateUF}/municipios`);
        const cities = await response.json();
        registerCitySelect.innerHTML = '<option value="">Selecione uma Cidade</option>';
        cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city.nome;
            option.textContent = city.nome;
            registerCitySelect.appendChild(option);
        });
    } catch (error) {
        console.error("Erro ao buscar cidades:", error);
    }
}

registerStateSelect.addEventListener('change', (e) => fetchCities(e.target.value));

async function getCoordsForCity(city, state) {
    try {
        const statesResponse = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
        const states = await statesResponse.json();
        const stateObj = states.find(s => s.sigla.toLowerCase() === state.toLowerCase());
        const stateFullName = stateObj ? stateObj.nome : state;
        
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=20&language=pt&format=json`);
        const data = await response.json();

        if (data.results) {
            const location = data.results.find(res => res.admin1 && res.admin1.toLowerCase() === stateFullName.toLowerCase());
            if (location) {
                return { latitude: location.latitude, longitude: location.longitude };
            }
        }
        return null;
    } catch (error) {
        console.error("Erro ao obter coordenadas:", error);
        return null;
    }
}


// --- LÓGICA DE AUTENTICAÇÃO E PERFIL ---
onAuthStateChanged(auth, async (user) => {
    if (unsubscribeFromCollections) unsubscribeFromCollections();
    if (unsubscribeFromNotifications) unsubscribeFromNotifications();
    if (unsubscribeFromHives) unsubscribeFromHives();

    if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            authError.textContent = '';
            currentUser = { uid: user.uid, email: user.email, ...userDoc.data() };
            
            userInfoDisplay.textContent = currentUser.name ? currentUser.name.split(' ')[0] : currentUser.email;

            authContainer.classList.add('hidden');
            appContainer.classList.remove('hidden');
            
            if (currentUser.role === 'admin') {
                adminPanelLink.classList.remove('hidden');
                loadAdminUsers();
            } else {
                adminPanelLink.classList.add('hidden');
            }
            
            showView(dashboardView);
            initializeCreationMap(currentUser.latitude || -31.33, currentUser.longitude || -54.10);
            listenToHives(currentUser.uid);
            listenToCollections(currentUser.uid);
            listenForNotifications(currentUser.uid);
        } else {
             console.error("User is authenticated, but no user document found in Firestore. Logging out.");
             authError.textContent = "Dados da conta não encontrados. Por favor, registe-se novamente.";
             signOut(auth);
        }
    } else {
        currentUser = null;
        authContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const apiaryName = document.getElementById('register-apiary').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const state = registerStateSelect.value;
    const city = registerCitySelect.value;
    
    if (!state || !city || !name || !apiaryName) {
        authError.textContent = "Todos os campos são obrigatórios.";
        return;
    }

    authError.textContent = 'A obter coordenadas...';
    const coords = await getCoordsForCity(city, state);
    if (!coords) {
        authError.textContent = "Não foi possível encontrar a localização. Tente novamente.";
        return;
    }
    authError.textContent = '';

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        await setDoc(doc(db, "users", user.uid), {
            name: name,
            apiaryName: apiaryName,
            email: user.email,
            role: 'user',
            state: registerStateSelect.options[registerStateSelect.selectedIndex].text,
            city: city,
            latitude: coords.latitude,
            longitude: coords.longitude,
            createdAt: new Date()
        });
    } catch (error) {
        authError.textContent = "Falha no registo: " + error.message;
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    authError.textContent = '';
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        authError.textContent = "Falha no login: " + error.message;
    }
});

logoutButton.addEventListener('click', () => signOut(auth));

profileButton.addEventListener('click', () => {
    document.getElementById('profile-name').value = currentUser.name || '';
    document.getElementById('profile-apiary').value = currentUser.apiaryName || '';
    document.getElementById('profile-email').textContent = currentUser.email;
    document.getElementById('profile-location').textContent = `${currentUser.city}, ${currentUser.state}`;
    profileModal.classList.add('is-open');
});

profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newName = document.getElementById('profile-name').value.trim();
    const newApiaryName = document.getElementById('profile-apiary').value.trim();
    
    const dataToUpdate = {};
    if (newName && newName !== currentUser.name) {
        dataToUpdate.name = newName;
    }
    if (newApiaryName && newApiaryName !== currentUser.apiaryName) {
        dataToUpdate.apiaryName = newApiaryName;
    }

    if (Object.keys(dataToUpdate).length > 0) {
        try {
            const userDocRef = doc(db, "users", currentUser.uid);
            await updateDoc(userDocRef, dataToUpdate);
            
            if(dataToUpdate.name) {
                currentUser.name = newName;
                 userInfoDisplay.textContent = newName.split(' ')[0];
            }
            if(dataToUpdate.apiaryName) currentUser.apiaryName = newApiaryName;

            alert("Perfil atualizado com sucesso!");
            profileModal.classList.remove('is-open');
        } catch (error) {
            console.error("Erro ao atualizar perfil:", error);
            alert("Não foi possível atualizar o perfil.");
        }
    } else {
        profileModal.classList.remove('is-open');
    }
});

profileModalCloseBtn.addEventListener('click', () => profileModal.classList.remove('is-open'));
profileModalCloseBtn2.addEventListener('click', () => profileModal.classList.remove('is-open'));


// --- GESTÃO DE COLMEIAS E COLETAS (LÓGICA CENTRAL)---

function listenToHives(userId) {
    const q = query(collection(db, "hives"), where("accessibleTo", "array-contains", userId));
    
    unsubscribeFromHives = onSnapshot(q, async (snapshot) => {
        const hivesPromises = snapshot.docs.map(async (hiveDoc) => {
            const hiveData = { id: hiveDoc.id, ...hiveDoc.data() };
            const ownerDocRef = doc(db, "users", hiveData.ownerId);
            const ownerDoc = await getDoc(ownerDocRef);
            hiveData.ownerApiaryName = ownerDoc.exists() ? ownerDoc.data().apiaryName : 'Desconhecido';
            return hiveData;
        });

        userHives = await Promise.all(hivesPromises);
        userHives.sort((a, b) => a.id - b.id);

        renderHivesTable();
        populateHiveSelects();
        renderCollectionsTable();
        if (fullMap) {
            initializeFullMapView();
        }
    });
}

function listenToCollections(userId) {
    const collectionsRef = collection(db, "collections");
    const q = query(collectionsRef, where("accessibleTo", "array-contains", userId), orderBy("data", "desc"));

    unsubscribeFromCollections = onSnapshot(q, (snapshot) => {
        allUserCollections = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCollectionsTable();
    }, (error) => {
        console.error("Erro ao buscar coletas:", error);
        dataTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Erro ao carregar coletas.</td></tr>`;
    });
}

function renderCollectionsTable() {
    dataTableBody.innerHTML = '';
    if (allUserCollections.length === 0) {
        dataTableBody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">Nenhuma coleta encontrada.</td></tr>';
        return;
    }
    
    allUserCollections.forEach(collection => {
        const pesoColoniaAbelhas = ((collection.pesoNinhoVazio + collection.pesoQuadrosOperculos + collection.pesoMelgueiraVazia + collection.pesoQuadrosMelgueira) * 1.02) - (collection.pesoNinhoVazio + collection.pesoQuadrosOperculos + collection.pesoMelgueiraVazia + collection.pesoQuadrosMelgueira);

        const tr = document.createElement('tr');
        tr.setAttribute('data-id', collection.id);
        tr.setAttribute('data-hiveid', collection.hiveId);
        
        const hive = userHives.find(h => h.id === collection.hiveId);
        const isOwner = hive ? hive.ownerId === currentUser.uid : false;
        const canEdit = isOwner || (hive && hive.editors && hive.editors.includes(currentUser.uid));

        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap font-medium">#${collection.hiveId}</td>
            <td class="px-6 py-4 whitespace-nowrap">${collection.data || ''}</td>
            <td class="px-6 py-4 whitespace-nowrap text-green-600 font-semibold">${pesoColoniaAbelhas.toFixed(2)} kg</td>
            <td class="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">${collection.observacoes || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                <button class="view-btn text-blue-600 hover:text-blue-900" title="Visualizar Detalhes da Coleta" data-id="${collection.id}"><i class="fa-solid fa-eye"></i></button>
                ${canEdit ? `<button class="edit-btn text-indigo-600 hover:text-indigo-900" title="Editar Coleta" data-id="${collection.id}"><i class="fa-solid fa-pencil"></i></button>` : ''}
                ${isOwner ? `<button class="delete-collection-btn text-red-600 hover:text-red-900" title="Excluir Coleta" data-id="${collection.id}" data-hiveid="${collection.hiveId}"><i class="fa-solid fa-trash"></i></button>` : ''}
            </td>
        `;
        dataTableBody.appendChild(tr);
    });

    collectionFilterInput.dispatchEvent(new Event('input'));
    attachTableActionListeners();
}

function attachTableActionListeners() {
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.onclick = (e) => showCollectionDetails(e.currentTarget.dataset.id);
    });
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.onclick = (e) => setupEditForm(e.currentTarget.dataset.id);
    });
    document.querySelectorAll('.delete-collection-btn').forEach(btn => {
        btn.onclick = (e) => deleteCollection(e.currentTarget.dataset.id, e.currentTarget.dataset.hiveid);
    });
}

function renderHivesTable() {
    hivesTableBody.innerHTML = '';
    const myHives = userHives.filter(h => h.ownerId === currentUser.uid);

    if (myHives.length === 0) {
        hivesTableBody.innerHTML = '<tr><td colspan="2" class="p-4 text-center text-gray-500">Nenhuma colmeia registrada.</td></tr>';
        return;
    }

    myHives.forEach(hive => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap font-medium">#${hive.id}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                <button class="view-hive-btn text-blue-600 hover:text-blue-900" data-hiveid="${hive.id}" title="Visualizar / Gerir Colmeia"><i class="fa-solid fa-eye"></i></button>
                <button class="delete-hive-btn text-red-600 hover:text-red-900" data-hiveid="${hive.id}" title="Excluir Colmeia"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        hivesTableBody.appendChild(tr);
    });

    document.querySelectorAll('.view-hive-btn').forEach(btn => {
        btn.addEventListener('click', (e) => showHiveDetails(e.currentTarget.dataset.hiveid));
    });
    document.querySelectorAll('.delete-hive-btn').forEach(btn => {
        btn.addEventListener('click', (e) => deleteHive(e.currentTarget.dataset.hiveid));
    });
}

function populateHiveSelects() {
    const optionsHtml = userHives.map(hive => {
        const ownerLabel = hive.ownerId === currentUser.uid ? '' : ` (${hive.ownerApiaryName})`;
        return `<option value="${hive.id}">Colmeia #${hive.id}${ownerLabel}</option>`;
    }).join('');
    
    hiveIdSelect.innerHTML = `<option value="">Selecione...</option>${optionsHtml}`;
}

hiveForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newHiveId = hiveIdInput.value.trim();
    const boxType = document.getElementById('hive-box-type').value;
    const queen = document.getElementById('hive-queen').value.trim();
    const installationYear = document.getElementById('hive-installation-year').value;

    if (!newHiveId || !boxType || !queen || !installationYear) {
        alert("Todos os campos para adicionar a colmeia são obrigatórios.");
        return;
    }

    const { lat, lng } = creationMarker.getLatLng();

    try {
        const hiveRef = doc(db, "hives", newHiveId);
        
        await setDoc(hiveRef, {
            ownerId: currentUser.uid,
            createdAt: new Date(),
            accessibleTo: [currentUser.uid],
            editors: [],
            boxType: boxType,
            queen: queen,
            installationYear: parseInt(installationYear),
            latitude: lat,
            longitude: lng
        });

        hiveForm.reset();
        initializeCreationMap(currentUser.latitude, currentUser.longitude);
        
        console.log(`Colmeia #${newHiveId} criada com sucesso.`);

    } catch (error) {
        console.error("Erro ao adicionar colmeia:", error);
        alert("Ocorreu um erro ao criar a colmeia. A causa mais provável é que este N° já existe.");
    }
});

async function deleteHive(hiveId) {
    if (confirm(`ATENÇÃO: Isto irá excluir a colmeia #${hiveId} e TODOS os registos de coleta associados a ela. Esta ação é irreversível. Deseja continuar?`)) {
        try {
            const batch = writeBatch(db);
            
            const hiveRef = doc(db, "hives", hiveId);
            batch.delete(hiveRef);

            const collectionsQuery = query(collection(db, "collections"), where("hiveId", "==", hiveId), where("accessibleTo", "array-contains", currentUser.uid));
            const collectionsSnapshot = await getDocs(collectionsQuery);
            collectionsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
        } catch (error) {
            console.error(`Erro ao excluir colmeia ${hiveId}:`, error);
            alert("Ocorreu um erro ao excluir a colmeia e suas coletas.");
        }
    }
}


dataForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const hiveId = hiveIdSelect.value;
    if (!hiveId) {
        alert("Por favor, selecione uma colmeia.");
        return;
    }

    const hive = userHives.find(h => h.id === hiveId);
    if (!hive) {
        alert("Colmeia selecionada inválida.");
        return;
    }

    const collectionData = {
        hiveId: hiveId,
        data: document.getElementById('data').value,
        ownerId: hive.ownerId,
        accessibleTo: hive.accessibleTo,
        editors: hive.editors,
        lastUpdatedAt: new Date(),
        numeroColeta: parseInt(document.getElementById('numeroColeta').value),
        numeroMelgueiras: parseInt(document.getElementById('numeroMelgueiras').value),
        pesoNinhoVazio: parseFloat(document.getElementById('pesoNinhoVazio').value),
        pesoQuadrosOperculos: parseFloat(document.getElementById('pesoQuadrosOperculos').value),
        pesoMelgueiraVazia: parseFloat(document.getElementById('pesoMelgueiraVazia').value),
        pesoQuadrosMelgueira: parseFloat(document.getElementById('pesoQuadrosMelgueira').value),
        observacoes: document.getElementById('observacoes').value,
    };

    const collectionId = collectionIdInput.value;
    try {
        if (collectionId) {
            const collectionRef = doc(db, "collections", collectionId);
            const {createdAt, ...updateData} = collectionData;
            await updateDoc(collectionRef, updateData);
        } else {
            collectionData.createdAt = new Date();
            await addDoc(collection(db, "collections"), collectionData);
        }
        
        resetForm();
    } catch (error) {
        console.error("Erro ao salvar dados da coleta:", error);
        alert("Falha ao salvar os dados.");
    }
});

async function setupEditForm(collId) {
    const collectionRef = doc(db, "collections", collId);
    const docSnap = await getDoc(collectionRef);
    if (!docSnap.exists()) {
        alert("Erro: Coleta não encontrada.");
        return;
    }
    const data = docSnap.data();
    formTitle.textContent = `Editar Coleta da Colmeia #${data.hiveId}`;
    collectionIdInput.value = docSnap.id;
    hiveIdSelect.value = data.hiveId;
    hiveIdSelect.disabled = true;

    document.getElementById('data').value = data.data;
    document.getElementById('numeroColeta').value = data.numeroColeta;
    document.getElementById('numeroMelgueiras').value = data.numeroMelgueiras;
    document.getElementById('pesoNinhoVazio').value = data.pesoNinhoVazio;
    document.getElementById('pesoQuadrosOperculos').value = data.pesoQuadrosOperculos;
    document.getElementById('pesoMelgueiraVazia').value = data.pesoMelgueiraVazia;
    document.getElementById('pesoQuadrosMelgueira').value = data.pesoQuadrosMelgueira;
    document.getElementById('observacoes').value = data.observacoes;
    
    cancelEditButton.classList.remove('hidden');
    window.scrollTo(0, 0);
}

function resetForm() {
    dataForm.reset();
    collectionIdInput.value = '';
    hiveIdSelect.disabled = false;
    formTitle.textContent = "Adicionar Nova Coleta";
    cancelEditButton.classList.add('hidden');
}
cancelEditButton.addEventListener('click', resetForm);

async function deleteCollection(collId, hiveId) {
    if (confirm(`Tem a certeza que deseja excluir esta coleta da colmeia #${hiveId}?`)) {
        try {
            await deleteDoc(doc(db, "collections", collId));
        } catch (error) {
            console.error("Erro ao excluir coleta:", error);
            alert("Falha ao excluir a coleta.");
        }
    }
}

// --- FILTRO DA TABELA DE COLETAS ---
collectionFilterInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const rows = dataTableBody.querySelectorAll('tr');

    rows.forEach(row => {
        const hiveId = row.dataset.hiveid;
        if (hiveId && hiveId.toLowerCase().startsWith(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
});


// --- LÓGICA DE VISUALIZAÇÃO DE DETALHES E GESTÃO DE PERMISSÕES ---
function displayDetailMap(hiveId, lat, lng) {
    const mapContainerId = `hive-detail-map-${hiveId}`;
    const container = document.getElementById(mapContainerId);
    if (!container) return; 

    container.innerHTML = '';
    
    const detailMap = L.map(container, {
        zoomControl: false, 
        scrollWheelZoom: false,
        dragging: false 
    }).setView([lat, lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(detailMap);

    L.marker([lat, lng], { icon: hiveIcon }).addTo(detailMap);
}


async function showHiveDetails(hiveId) {
    const hive = userHives.find(h => h.id === hiveId);
    if (!hive) return;

    const isOwner = hive.ownerId === currentUser.uid;
    viewModalTitle.textContent = `Detalhes da Colmeia #${hive.id}`;
    
    let sharedWithHtml = '<p class="text-sm text-gray-500">Ninguém mais tem acesso.</p>';
    if (hive.accessibleTo && hive.accessibleTo.length > 1) {
        const userPromises = hive.accessibleTo.map(uid => getDoc(doc(db, "users", uid)));
        const userDocs = await Promise.all(userPromises);
        
        const usersHtml = userDocs.map(userDoc => {
            if (!userDoc.exists()) return '';
            const userData = userDoc.data();
            const uid = userDoc.id;
            const isEditor = hive.editors && hive.editors.includes(uid);
            
            const controls = isOwner && uid !== currentUser.uid ? `
                <div class="permission-controls">
                    <span class="toggle-label">Pode Editar</span>
                    <label class="toggle-switch" title="Permitir edição">
                        <input type="checkbox" class="edit-toggle" data-hiveid="${hive.id}" data-userid="${uid}" ${isEditor ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <button class="remove-share-btn" title="Remover acesso" data-hiveid="${hive.id}" data-userid="${uid}" data-username="${userData.name}"><i class="fa-solid fa-xmark"></i></button>
                </div>
            ` : (uid === hive.ownerId ? `<span class="text-sm font-semibold text-gray-600">(Dono)</span>` : '');

            return `<li>
                        <div>
                            <span class="font-semibold">${userData.name}</span>
                            <span class="text-xs text-gray-500">${userData.apiaryName || ''}</span>
                        </div>
                        ${controls}
                    </li>`;
        }).join('');

        sharedWithHtml = `
            <h4 class="font-semibold mt-4">Partilhado com:</h4>
            <ul class="shared-user-list">
                ${usersHtml}
            </ul>
        `;
    }
    
    const mapHtml = hive.latitude ? `<div id="hive-detail-map-${hive.id}"></div>` : '<p class="text-sm text-gray-500 mt-2">Localização não registrada.</p>';
    const weatherHtml = hive.latitude ? `<p><strong>Clima Atual:</strong> <span id="weather-info-${hive.id}">A carregar... <i class="fa-solid fa-spinner fa-spin"></i></span></p>` : '';


    viewModalBody.innerHTML = `
        <div class="flex justify-between items-start">
            <div class="space-y-2 mb-4">
                <p><strong>Tipo de Caixa:</strong> ${hive.boxType || 'Não informado'}</p>
                <p><strong>Rainha:</strong> ${hive.queen || 'Não informado'}</p>
                <p><strong>Ano de Instalação:</strong> ${hive.installationYear || 'Não informado'}</p>
                ${weatherHtml}
            </div>
            ${isOwner ? `<button class="open-edit-hive-btn button-primary text-sm" data-hiveid="${hive.id}">
                <i class="fa-solid fa-pencil mr-2"></i>Editar
            </button>` : ''}
        </div>
        ${mapHtml}
        <hr class="my-4">
        <h4 class="font-semibold">Gestão de Acesso</h4>
        <p class="text-sm text-gray-500 mb-2">Aqui você pode gerenciar quem tem acesso aos dados desta colmeia.</p>
        ${sharedWithHtml}
    `;
    viewDetailsModal.classList.add('is-open');

    if (hive.latitude) {
        setTimeout(() => {
            displayDetailMap(hive.id, hive.latitude, hive.longitude);
            fetchCurrentWeather(hive.id, hive.latitude, hive.longitude);
        }, 100);
    }
}

async function showCollectionDetails(collId){
    const collectionRef = doc(db, "collections", collId);
    const collectionSnap = await getDoc(collectionRef);
    if (!collectionSnap.exists()) return;
    const data = collectionSnap.data();

    viewModalTitle.textContent = `Detalhes da Coleta #${data.numeroColeta} (Colmeia #${data.hiveId})`;

    const pesoTotalDia = (data.pesoNinhoVazio || 0) + (data.pesoQuadrosOperculos || 0) + (data.pesoMelgueiraVazia || 0) + (data.pesoQuadrosMelgueira || 0);
    const pesoTotalNoite = pesoTotalDia * 1.02;
    const pesoColonia = pesoTotalNoite - pesoTotalDia;

    viewModalBody.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><strong class="font-semibold text-gray-700">Data:</strong> ${data.data}</div>
            <div><strong class="font-semibold text-gray-700">N° da Coleta:</strong> ${data.numeroColeta || 'N/A'}</div>
            <div><strong class="font-semibold text-gray-700">N° de Melgueiras:</strong> ${data.numeroMelgueiras || 'N/A'}</div>
            <div><strong class="font-semibold text-gray-700">Peso Ninho Vazio:</strong> ${data.pesoNinhoVazio} kg</div>
            <div><strong class="font-semibold text-gray-700">Peso Quadros + Opérculos:</strong> ${data.pesoQuadrosOperculos} kg</div>
            <div><strong class="font-semibold text-gray-700">Peso Melgueira Vazia:</strong> ${data.pesoMelgueiraVazia} kg</div>
            <div><strong class="font-semibold text-gray-700">Peso Quadros Melgueira:</strong> ${data.pesoQuadrosMelgueira} kg</div>
        </div>
        <hr class="my-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><strong class="font-semibold text-gray-700">Peso Total (Dia):</strong> ${pesoTotalDia.toFixed(2)} kg</div>
            <div><strong class="font-semibold text-gray-700">Peso Total (Noite):</strong> ${pesoTotalNoite.toFixed(2)} kg</div>
            <div class="md:col-span-2 text-green-600"><strong class="font-semibold">Peso Estimado da Colônia:</strong> ${pesoColonia.toFixed(2)} kg</div>
        </div>
        <div class="mt-4">
            <strong class="font-semibold text-gray-700">Observações:</strong>
            <p class="text-sm text-gray-600 p-2 bg-gray-50 rounded mt-1">${data.observacoes || 'Nenhuma'}</p>
        </div>
    `;
     viewDetailsModal.classList.add('is-open');
}


viewModalCloseBtn.addEventListener('click', () => viewDetailsModal.classList.remove('is-open'));
viewModalCloseBtn2.addEventListener('click', () => viewDetailsModal.classList.remove('is-open'));

async function toggleEditPermission(hiveId, userId, canEdit) {
    const hiveRef = doc(db, "hives", hiveId);
    try {
        await updateDoc(hiveRef, {
            editors: canEdit ? arrayUnion(userId) : arrayRemove(userId)
        });
    } catch (error) {
        console.error("Erro ao alterar permissão:", error);
        alert("Falha ao alterar a permissão de edição.");
    }
}

async function removeShare(hiveId, userId, userName) {
    if (confirm(`Tem a certeza que deseja remover o acesso de ${userName} a esta colmeia?`)) {
        const hiveRef = doc(db, "hives", hiveId);
        try {
            await updateDoc(hiveRef, {
                accessibleTo: arrayRemove(userId),
                editors: arrayRemove(userId)
            });
            showHiveDetails(hiveId);
        } catch (error) {
            console.error("Erro ao remover acesso:", error);
            alert("Falha ao remover o acesso.");
        }
    }
}

viewModalBody.addEventListener('click', (e) => {
    const editToggle = e.target.closest('.edit-toggle');
    if (editToggle) {
        const { hiveid, userid } = editToggle.dataset;
        toggleEditPermission(hiveid, userid, editToggle.checked);
        return; 
    }

    const removeBtn = e.target.closest('.remove-share-btn');
    if (removeBtn) {
        const { hiveid, userid, username } = removeBtn.dataset;
        removeShare(hiveid, userid, username);
        return;
    }

    const openEditBtn = e.target.closest('.open-edit-hive-btn');
    if(openEditBtn){
        const { hiveid } = openEditBtn.dataset;
        openEditHiveModal(hiveid);
    }
});

// --- LÓGICA DE EDIÇÃO DA COLMEIA ---

function openEditHiveModal(hiveId) {
    const hive = userHives.find(h => h.id === hiveId);
    if (!hive) {
        alert("Colmeia não encontrada para edição.");
        return;
    }

    editHiveModalTitle.textContent = `Editar Dados da Colmeia #${hive.id}`;
    editHiveIdInput.value = hive.id;
    document.getElementById('edit-hive-box-type').value = hive.boxType || '';
    document.getElementById('edit-hive-queen').value = hive.queen || '';
    document.getElementById('edit-hive-installation-year').value = hive.installationYear || '';

    viewDetailsModal.classList.remove('is-open');
    editHiveModal.classList.add('is-open');
}

editHiveForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hiveId = editHiveIdInput.value;
    const dataToUpdate = {
        boxType: document.getElementById('edit-hive-box-type').value,
        queen: document.getElementById('edit-hive-queen').value.trim(),
        installationYear: parseInt(document.getElementById('edit-hive-installation-year').value)
    };

    if (!dataToUpdate.boxType || !dataToUpdate.queen || !dataToUpdate.installationYear) {
        alert("Todos os campos são obrigatórios.");
        return;
    }

    try {
        const hiveRef = doc(db, "hives", hiveId);
        await updateDoc(hiveRef, dataToUpdate);
        alert("Dados da colmeia atualizados com sucesso!");
        editHiveModal.classList.remove('is-open');
    } catch (error) {
        console.error("Erro ao atualizar a colmeia:", error);
        alert("Falha ao atualizar os dados da colmeia.");
    }
});

editHiveModalCloseBtn.addEventListener('click', () => editHiveModal.classList.remove('is-open'));
editHiveModalCancelBtn.addEventListener('click', () => editHiveModal.classList.remove('is-open'));


// --- LÓGICA DE ADMINISTRAÇÃO ---
async function loadAdminUsers() {
    const usersCollection = collection(db, "users");
    onSnapshot(usersCollection, (snapshot) => {
        adminUsersTableBody.innerHTML = '';
        snapshot.forEach(userDoc => {
            const userData = userDoc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-6 py-4">${userData.email}</td>
                <td class="hidden sm:table-cell px-6 py-4 text-sm text-gray-600">${userData.city}, ${userData.state}</td>
                <td class="px-6 py-4">${userData.role}</td>
                <td class="px-6 py-4 text-right">
                    ${(userData.role !== 'admin' && currentUser.uid !== userDoc.id) ? 
                    `<button data-uid="${userDoc.id}" class="promote-btn button-success text-xs">Promover a Admin</button>` : ''}
                    ${(userData.role === 'admin' && currentUser.uid !== userDoc.id) ?
                    `<button data-uid="${userDoc.id}" class="demote-btn button-secondary text-xs">Rebaixar a User</button>`: ''}
                </td>
            `;
            adminUsersTableBody.appendChild(tr);
        });
        document.querySelectorAll('.promote-btn').forEach(btn => btn.addEventListener('click', (e) => updateUserRole(e.target.dataset.uid, 'admin')));
        document.querySelectorAll('.demote-btn').forEach(btn => btn.addEventListener('click', (e) => updateUserRole(e.target.dataset.uid, 'user')));
    });
}
async function updateUserRole(uid, newRole) {
    if (uid === currentUser.uid) {
        alert("Não pode alterar a sua própria role.");
        return;
    }
    const userDocRef = doc(db, "users", uid);
    await updateDoc(userDocRef, { role: newRole });
}

// --- LÓGICA DE SOLICITAÇÃO DE ACESSO E NOTIFICAÇÕES ---
requestAccessBtn.addEventListener('click', () => requestAccessModal.classList.add('is-open'));
modalCancelBtn.addEventListener('click', () => requestAccessModal.classList.remove('is-open'));
requestAccessForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hiveId = document.getElementById('record-id-input').value.trim();
    if (!hiveId) return;

    try {
        const hiveRef = doc(db, "hives", hiveId);
        const hiveSnap = await getDoc(hiveRef);

        if (!hiveSnap.exists()) {
            alert("Colmeia não encontrada. Verifique o número digitado.");
            return;
        }
        
        const ownerId = hiveSnap.data().ownerId;

        if (ownerId === currentUser.uid) {
            alert("Você já é o dono desta colmeia.");
            return;
        }

        const q = query(collection(db, "accessRequests"), where("hiveId", "==", hiveId), where("requesterId", "==", currentUser.uid));
        const existingRequests = await getDocs(q);
        if (!existingRequests.empty) {
            const existingStatus = existingRequests.docs[0].data().status;
            if (existingStatus === 'pending') {
                 alert("Você já solicitou acesso a esta colmeia. Aguarde a aprovação.");
            } else if (existingStatus === 'accepted') {
                alert("Você já tem acesso a esta colmeia.");
            } else {
                 alert("Sua solicitação anterior foi recusada.");
            }
            return;
        }

        await addDoc(collection(db, "accessRequests"), {
            requesterId: currentUser.uid,
            requesterName: currentUser.name || currentUser.email,
            ownerId: ownerId,
            hiveId: hiveId,
            status: 'pending',
            createdAt: new Date()
        });

        alert("Solicitação de acesso enviada!");
        requestAccessModal.classList.remove('is-open');
        requestAccessForm.reset();

    } catch (error) {
        console.error("Erro ao enviar solicitação de acesso:", error);
        alert("Ocorreu um erro ao enviar a sua solicitação. Verifique se tem permissão para esta ação e tente novamente.");
    }
});

function listenForNotifications(userId) {
    const q = query(collection(db, "accessRequests"), where("ownerId", "==", userId), where("status", "==", "pending"));
    unsubscribeFromNotifications = onSnapshot(q, (snapshot) => {
        const count = snapshot.size;
        notificationCount.textContent = count;
        notificationCount.classList.toggle('hidden', count === 0);
        
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                if(notificationSound) notificationSound.triggerAttackRelease("C5", "8n");
            }
        });

        notificationDropdown.innerHTML = '';
        if (snapshot.empty) {
            notificationDropdown.innerHTML = '<p class="p-4 text-sm text-center text-gray-500">Nenhuma notificação.</p>';
        } else {
            snapshot.forEach(doc => {
                const request = doc.data();
                const item = document.createElement('div');
                item.className = 'notification-item';
                const requesterDisplayName = request.requesterName || request.requesterEmail;
                item.innerHTML = `
                    <p class="notification-text"><b>${requesterDisplayName}</b> solicitou acesso à colmeia <b>#${request.hiveId}</b></p>
                    <div class="notification-actions mt-2 flex gap-2">
                        <button data-reqid="${doc.id}" data-hiveid="${request.hiveId}" data-requesterid="${request.requesterId}" class="accept-btn button-success">Aceitar</button>
                        <button data-reqid="${doc.id}" class="reject-btn button-danger">Recusar</button>
                    </div>
                `;
                notificationDropdown.appendChild(item);
            });
        }
    });
}
notificationBell.addEventListener('click', () => {
    notificationDropdown.classList.toggle('hidden');
});
document.addEventListener('click', async (e) => {
    const acceptBtn = e.target.closest('.accept-btn');
    if (acceptBtn) {
        const { reqid, hiveid, requesterid } = acceptBtn.dataset;
        await handleAccessRequest(reqid, hiveid, requesterid, 'accepted');
    }
     const rejectBtn = e.target.closest('.reject-btn');
    if (rejectBtn) {
        const { reqid } = rejectBtn.dataset;
        await handleAccessRequest(reqid, null, null, 'rejected');
    }
});

async function handleAccessRequest(requestId, hiveId, requesterId, newStatus) {
    const requestRef = doc(db, "accessRequests", requestId);
    const criticalBatch = writeBatch(db);
    
    if (newStatus === 'accepted') {
        const hiveRef = doc(db, "hives", hiveId);
        criticalBatch.update(hiveRef, {
            accessibleTo: arrayUnion(requesterId)
        });
    }
    
    criticalBatch.update(requestRef, { status: newStatus });

    try {
        await criticalBatch.commit(); 

        if (newStatus === 'accepted') {
            console.log("Acesso principal concedido. Tentando atualizar o histórico de coletas...");
            try {
                const historicalBatch = writeBatch(db);
                const collectionsQuery = query(
                    collection(db, "collections"), 
                    where("hiveId", "==", hiveId), 
                    where("accessibleTo", "array-contains", currentUser.uid)
                );
                const collectionsSnapshot = await getDocs(collectionsQuery);
                
                collectionsSnapshot.forEach(collectionDoc => {
                    historicalBatch.update(collectionDoc.ref, { accessibleTo: arrayUnion(requesterId) });
                });

                if (!collectionsSnapshot.empty) {
                    await historicalBatch.commit();
                    console.log("Histórico de coletas atualizado com sucesso.");
                }
            } catch (error) {
                console.error("Erro não-crítico ao atualizar o histórico de coletas:", error);
                alert("Acesso à colmeia foi concedido com sucesso, mas ocorreu um erro ao compartilhar o histórico de coletas antigas. O novo usuário terá acesso à colmeia e a todas as novas coletas.");
            }
        }
    } catch (error) {
        console.error("Erro crítico ao processar solicitação de acesso:", error);
        alert("Falha ao processar a solicitação. O acesso não pôde ser concedido.");
    }
}


// --- INICIALIZAÇÃO ---
(async () => {
    await fetchStates();
    
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then(registration => {
            console.log('Service Worker registrado com sucesso:', registration.scope);
          })
          .catch(error => {
            console.log('Falha no registro do Service Worker:', error);
          });
      });
    }

})();
