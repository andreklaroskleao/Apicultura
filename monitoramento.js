import { getFirestore, collection, getDocs, query, where, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, currentUser } from './script.js';

// --- REFERÊNCIAS AO DOM ---
const monitoringView = document.getElementById('monitoring-view');
const monitoringHiveSelect = document.getElementById('monitoring-hive-select');
const searchHiveBtn = document.getElementById('search-hive-btn');
const panoramaContainer = document.getElementById('panorama-container');
const panoramaTitle = document.getElementById('panorama-title');
const printPanoramaBtn = document.getElementById('print-panorama-btn');
// Cards de Resumo
const summaryTotalCollections = document.getElementById('summary-total-collections');
const summaryAvgWeight = document.getElementById('summary-avg-weight');
const summaryLastCollection = document.getElementById('summary-last-collection');
// Gráfico
const colonyWeightChartCanvas = document.getElementById('colony-weight-chart');
let colonyWeightChart = null;
// Formulários de Monitoramento
const notesForm = document.getElementById('notes-form');
const healthForm = document.getElementById('health-form');
const extraNotesTextarea = document.getElementById('extra-notes');
const pestPresenceInput = document.getElementById('pest-presence');
const queenReplacementInput = document.getElementById('queen-replacement');
// Tabela de Clima
const weatherTableBody = document.getElementById('weather-table-body');

let allUserRecords = [];

// --- LÓGICA DE MONITORAMENTO ---
export const initializeMonitoringPage = async () => {
    if (!currentUser) return;
    panoramaContainer.classList.add('hidden'); // Esconde o panorama ao trocar de página

    const recordsCollection = collection(db, "collections");
    const q = query(recordsCollection, where("accessibleTo", "array-contains", currentUser.uid));
    const querySnapshot = await getDocs(q);
    
    allUserRecords = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    populateHiveFilter();
};

const populateHiveFilter = () => {
    const hiveIds = [...new Set(allUserRecords.map(record => record.hiveId))];
    hiveIds.sort();

    monitoringHiveSelect.innerHTML = '<option value="">Selecione...</option>';
    hiveIds.forEach(id => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `Colmeia #${id}`;
        monitoringHiveSelect.appendChild(option);
    });
};

searchHiveBtn.addEventListener('click', () => {
    const selectedHiveId = monitoringHiveSelect.value;
    if (selectedHiveId) {
        fetchAndDisplayPanorama(selectedHiveId);
    } else {
        alert("Por favor, selecione uma colmeia.");
    }
});

const fetchWeatherData = async (startDate, endDate) => {
    // Usa as coordenadas do utilizador. Fallback para Bagé se não existirem.
    const lat = currentUser.latitude || -31.33;
    const lon = currentUser.longitude || -54.10;
    // Usa a API de 'forecast' que também suporta datas passadas e presentes.
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=America/Sao_Paulo`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Não foi possível buscar os dados climáticos.');
        }
        const data = await response.json();
        return data.daily;
    } catch (error) {
        console.error("Erro na API Open-Meteo:", error);
        return null;
    }
};

const fetchAndDisplayPanorama = async (hiveId) => {
    const hiveCollections = allUserRecords.filter(record => record.hiveId === hiveId).sort((a, b) => new Date(a.data) - new Date(b.data));
    
    if (hiveCollections.length === 0) {
        alert("Nenhuma coleta encontrada para esta colmeia.");
        return;
    }

    const startDate = hiveCollections[0].data;
    const endDate = hiveCollections[hiveCollections.length - 1].data;
    
    const weatherData = await fetchWeatherData(startDate, endDate);

    const monitoringRef = doc(db, `hives/${hiveId}/monitoring`, 'data');
    const monitoringSnap = await getDoc(monitoringRef);
    const monitoringData = monitoringSnap.exists() ? monitoringSnap.data() : {};

    renderPanorama(hiveId, hiveCollections, monitoringData, weatherData);
    panoramaContainer.classList.remove('hidden');
};

const renderPanorama = (hiveId, collections, monitoringData, weatherData) => {
    panoramaTitle.textContent = `Panorama da Colmeia #${hiveId}`;

    extraNotesTextarea.value = monitoringData.notes || '';
    pestPresenceInput.value = monitoringData.pest || '';
    queenReplacementInput.value = monitoringData.queen || '';

    const totalWeight = collections.reduce((sum, record) => {
        const colonyWeight = ((record.pesoNinhoVazio + record.pesoQuadrosOperculos + record.pesoMelgueiraVazia + record.pesoQuadrosMelgueira) * 1.02) - (record.pesoNinhoVazio + record.pesoQuadrosOperculos + record.pesoMelgueiraVazia + record.pesoQuadrosMelgueira);
        return sum + colonyWeight;
    }, 0);
    const avgWeight = totalWeight / collections.length;
    const lastCollectionDate = collections[collections.length - 1].data;

    summaryTotalCollections.innerHTML = `<span class="summary-value">${collections.length}</span><span class="summary-label">Coletas Registradas</span>`;
    summaryAvgWeight.innerHTML = `<span class="summary-value">${avgWeight.toFixed(2)}</span><span class="summary-label">Média Peso Colônia (kg)</span>`;
    summaryLastCollection.innerHTML = `<span class="summary-value">${lastCollectionDate}</span><span class="summary-label">Última Coleta</span>`;

    const chartLabels = collections.map(c => c.data);
    const chartData = collections.map(c => {
        return ((c.pesoNinhoVazio + c.pesoQuadrosOperculos + c.pesoMelgueiraVazia + c.pesoQuadrosMelgueira) * 1.02) - (c.pesoNinhoVazio + c.pesoQuadrosOperculos + c.pesoMelgueiraVazia + c.pesoQuadrosMelgueira);
    });
    renderColonyWeightChart(chartLabels, chartData);

    // Renderiza a tabela de clima
    weatherTableBody.innerHTML = '';
    if (weatherData) {
        collections.forEach(collection => {
            const dateIndex = weatherData.time.indexOf(collection.data);
            if (dateIndex > -1) {
                const tr = document.createElement('tr');
                const tempMin = weatherData.temperature_2m_min[dateIndex] ?? 'N/A';
                const tempMax = weatherData.temperature_2m_max[dateIndex] ?? 'N/A';
                const precipitation = weatherData.precipitation_sum[dateIndex] ?? 'N/A';
                const wind = weatherData.windspeed_10m_max[dateIndex] ?? 'N/A';

                tr.innerHTML = `
                    <td>${collection.data}</td>
                    <td>${tempMin}° / ${tempMax}°</td>
                    <td>${precipitation} mm</td>
                    <td>${wind} km/h</td>
                `;
                weatherTableBody.appendChild(tr);
            }
        });
    }
};

const renderColonyWeightChart = (labels, data) => {
    if (colonyWeightChart) {
        colonyWeightChart.destroy();
    }
    const ctx = colonyWeightChartCanvas.getContext('2d');
    colonyWeightChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Peso da Colônia (kg)',
                data: data,
                borderColor: 'rgba(245, 158, 11, 1)',
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });
};

const saveMonitoringData = async (e) => {
    e.preventDefault();
    const hiveId = monitoringHiveSelect.value;
    if (!hiveId) return;

    const monitoringRef = doc(db, `hives/${hiveId}/monitoring`, 'data');
    const dataToSave = {
        notes: extraNotesTextarea.value,
        pest: pestPresenceInput.value,
        queen: queenReplacementInput.value,
        lastUpdated: new Date()
    };

    try {
        await setDoc(monitoringRef, dataToSave, { merge: true });
        alert("Dados de monitoramento salvos com sucesso!");
    } catch (error) {
        console.error("Erro ao salvar dados de monitoramento:", error);
        alert("Falha ao salvar os dados.");
    }
};

notesForm.addEventListener('submit', saveMonitoringData);
healthForm.addEventListener('submit', saveMonitoringData);

printPanoramaBtn.addEventListener('click', () => {
    window.print();
});
