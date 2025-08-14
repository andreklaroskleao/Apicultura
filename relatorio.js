import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, currentUser, userHives } from './script.js';

// --- REFERÊNCIAS AO DOM ---
const reportFiltersForm = document.getElementById('report-filters-form');
const reportHiveSelect = document.getElementById('report-hive-select');
const reportResultsContainer = document.getElementById('report-results-container');
const reportSummary = document.getElementById('report-summary');
const reportTableBody = document.getElementById('report-table-body');
const printReportBtn = document.getElementById('print-report-btn');
const reportTitle = document.getElementById('report-title');


// --- LÓGICA DE RELATÓRIOS ---

/**
 * Inicializa a página de Relatórios. Sua principal função é popular o filtro de colmeias.
 */
export const initializeReportPage = () => {
    if (!currentUser) return;
    reportResultsContainer.classList.add('hidden'); // Garante que resultados antigos fiquem ocultos
    populateHiveFilter();
};

/**
 * Popula o menu suspenso de seleção de colmeias com base na lista de colmeias
 * do usuário (userHives), que já foi carregada pelo script.js.
 */
const populateHiveFilter = () => {
    reportHiveSelect.innerHTML = '<option value="all">Todas as Colmeias</option>';
    
    // A variável 'userHives' é importada de script.js e é a fonte de dados correta
    userHives.forEach(hive => {
        const option = document.createElement('option');
        option.value = hive.id;
        const ownerLabel = hive.ownerId === currentUser.uid ? '' : ` (${hive.ownerApiaryName})`;
        option.textContent = `Colmeia #${hive.id}${ownerLabel}`;
        reportHiveSelect.appendChild(option);
    });
};

// Listener do formulário de filtros
reportFiltersForm.addEventListener('submit', (e) => {
    e.preventDefault();
    generateReport();
});

/**
 * Constrói e executa uma consulta ao Firestore com base nos filtros selecionados
 * pelo usuário e, em seguida, chama a função para exibir os resultados.
 */
const generateReport = async () => {
    const selectedHive = reportHiveSelect.value;
    const startDate = document.getElementById('report-date-start').value;
    const endDate = document.getElementById('report-date-end').value;

    let queryConstraints = [where("accessibleTo", "array-contains", currentUser.uid)];

    if (selectedHive !== 'all') {
        queryConstraints.push(where("hiveId", "==", selectedHive));
    }
    if (startDate) {
        queryConstraints.push(where("data", ">=", startDate));
    }
    if (endDate) {
        queryConstraints.push(where("data", "<=", endDate));
    }
    
    // Adiciona uma ordenação por data para os resultados
    queryConstraints.push(orderBy("data", "desc"));

    try {
        const collectionsQuery = query(collection(db, "collections"), ...queryConstraints);
        const snapshot = await getDocs(collectionsQuery);
        const filteredCollections = snapshot.docs.map(doc => doc.data());

        displayReport(filteredCollections, selectedHive, startDate, endDate);

    } catch (error) {
        console.error("Erro ao gerar relatório:", error);
        alert("Ocorreu um erro ao buscar os dados para o relatório. Verifique o console para mais detalhes.");
        // Nota: Se o erro for sobre um índice em falta, o Firebase fornecerá um link no console para criá-lo com um clique.
    }
};

/**
 * Renderiza os dados do relatório na tela, incluindo o resumo e a tabela.
 */
const displayReport = (collections, hive, start, end) => {
    reportTableBody.innerHTML = '';
    reportSummary.innerHTML = '';
    
    if (collections.length === 0) {
        reportTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Nenhum resultado encontrado para os filtros selecionados.</td></tr>';
        reportResultsContainer.classList.remove('hidden');
        reportTitle.textContent = "Relatório sem resultados";
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
            <td>${record.numeroColeta || 'N/A'}</td>
            <td>${colonyWeight.toFixed(2)} kg</td>
        `;
        reportTableBody.appendChild(tr);
    });

    const averageWeight = totalColonyWeight / collections.length;
    reportSummary.innerHTML = `
        <div class="summary-card">
            <span class="summary-value">${collections.length}</span>
            <span class="summary-label">Total de Coletas</span>
        </div>
        <div class="summary-card">
            <span class="summary-value">${averageWeight.toFixed(2)} kg</span>
            <span class="summary-label">Média Peso Colônia</span>
        </div>
    `;

    let titleText = `Relatório para ${hive === 'all' ? 'Todas as Colmeias' : `a Colmeia #${hive}`}`;
    if (start || end) {
        titleText += ` de ${start || 'início'} até ${end || 'hoje'}`;
    }
    reportTitle.textContent = titleText;

    reportResultsContainer.classList.remove('hidden');
};

// Listener para o botão de imprimir
printReportBtn.addEventListener('click', () => {
    window.print();
});
