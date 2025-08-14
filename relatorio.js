import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, currentUser } from './script.js';

// --- REFERÊNCIAS AO DOM ---
const reportFiltersForm = document.getElementById('report-filters-form');
const reportHiveSelect = document.getElementById('report-hive-select');
const reportResultsContainer = document.getElementById('report-results-container');
const reportSummary = document.getElementById('report-summary');
const reportTableBody = document.getElementById('report-table-body');
const printReportBtn = document.getElementById('print-report-btn');
const reportTitle = document.getElementById('report-title');

let allCollections = [];

// --- LÓGICA DE RELATÓRIOS ---
export const initializeReportPage = async () => {
    if (!currentUser) return;

    const collectionsRef = collection(db, "collections");
    const q = query(collectionsRef, where("accessibleTo", "array-contains", currentUser.uid));
    const querySnapshot = await getDocs(q);
    
    allCollections = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    populateHiveFilter();
};

const populateHiveFilter = () => {
    const hiveIds = [...new Set(allCollections.map(record => record.hiveId))];
    hiveIds.sort();

    reportHiveSelect.innerHTML = '<option value="all">Todas as Colmeias</option>';
    hiveIds.forEach(id => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `Colmeia #${id}`;
        reportHiveSelect.appendChild(option);
    });
};

reportFiltersForm.addEventListener('submit', (e) => {
    e.preventDefault();
    generateReport();
});

const generateReport = () => {
    const selectedHive = reportHiveSelect.value;
    const startDate = document.getElementById('report-date-start').value;
    const endDate = document.getElementById('report-date-end').value;

    let filteredCollections = allCollections;

    if (selectedHive !== 'all') {
        filteredCollections = filteredCollections.filter(record => record.hiveId === selectedHive);
    }
    if (startDate) {
        filteredCollections = filteredCollections.filter(record => record.data >= startDate);
    }
    if (endDate) {
        filteredCollections = filteredCollections.filter(record => record.data <= endDate);
    }

    displayReport(filteredCollections, selectedHive, startDate, endDate);
};

const displayReport = (collections, hive, start, end) => {
    reportTableBody.innerHTML = '';
    
    if (collections.length === 0) {
        reportTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Nenhum resultado encontrado para os filtros selecionados.</td></tr>';
        reportSummary.innerHTML = '';
        reportResultsContainer.classList.remove('hidden');
        return;
    }

    let totalColonyWeight = 0;

    collections.forEach(record => {
        const colonyWeight = ((record.pesoNinhoVazio + record.pesoQuadrosOperculos + record.pesoMelgueiraVazia + record.pesoQuadrosMelgueira) * 1.02) - (record.pesoNinhoVazio + record.pesoQuadrosOperculos + record.pesoMelgueiraVazia + record.pesoQuadrosMelgueira);
        totalColonyWeight += colonyWeight;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${record.hiveId}</td>
            <td>${record.data}</td>
            <td>${record.numeroColeta}</td>
            <td>${colonyWeight.toFixed(2)}</td>
        `;
        reportTableBody.appendChild(tr);
    });

    const averageWeight = totalColonyWeight / collections.length;
    reportSummary.innerHTML = `
        <div>
            <span class="summary-value">${collections.length}</span>
            <span class="summary-label">Coletas</span>
        </div>
        <div>
            <span class="summary-value">${averageWeight.toFixed(2)}</span>
            <span class="summary-label">Média Peso Colônia (kg)</span>
        </div>
    `;

    let titleText = `Relatório para ${hive === 'all' ? 'Todas as Colmeias' : `a Colmeia #${hive}`}`;
    if (start || end) {
        titleText += ` de ${start || 'início'} até ${end || 'hoje'}`;
    }
    reportTitle.textContent = titleText;

    reportResultsContainer.classList.remove('hidden');
};

printReportBtn.addEventListener('click', () => {
    window.print();
});
