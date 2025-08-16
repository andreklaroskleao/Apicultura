import { getFirestore, collection, doc, onSnapshot, setDoc, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, currentUser } from './script.js';

// --- REFERÊNCIAS AO DOM ---
const extractionForm = document.getElementById('extraction-form');
const extractionTableBody = document.getElementById('extraction-table-body');
const inventoryList = document.getElementById('inventory-list');
const stockModal = document.getElementById('stock-modal');
const stockModalTitle = document.getElementById('stock-modal-title');
const stockForm = document.getElementById('stock-form');
const stockModalCancel = document.getElementById('stock-modal-cancel');
// Financeiro
const financialSummary = document.getElementById('financial-summary');
const costsForm = document.getElementById('costs-form');
const salesForm = document.getElementById('sales-form');
const costsTableBody = document.getElementById('costs-table-body');
const salesTableBody = document.getElementById('sales-table-body');

let currentInventory = {};
let allExtractions = [];
let allCosts = [];
let allSales = [];
let unsubscribeInventory, unsubscribeExtractions, unsubscribeCosts, unsubscribeSales;
let currentStockUpdate = {};
const defaultItems = {
    'melgueiras': 'Melgueiras',
    'quadros': 'Quadros de Ninho/Melgueira',
    'cera': 'Cera Alveolada (kg)',
    'epis': 'EPIs (Unidades)'
};

// --- INICIALIZAÇÃO ---
export const initializeManagementPage = () => {
    if (!currentUser) return;
    // Cancela listeners anteriores para evitar duplicação
    if (unsubscribeInventory) unsubscribeInventory();
    if (unsubscribeExtractions) unsubscribeExtractions();
    if (unsubscribeCosts) unsubscribeCosts();
    if (unsubscribeSales) unsubscribeSales();
    
    listenToInventory();
    listenToExtractions();
    listenToCosts();
    listenToSales();
};

// --- CONTROLE FINANCEIRO ---
const calculateFinancialSummary = () => {
    const totalRevenue = allSales.reduce((sum, sale) => sum + sale.total, 0);
    const totalCosts = allCosts.reduce((sum, cost) => sum + cost.value, 0);
    const netProfit = totalRevenue - totalCosts;

    financialSummary.innerHTML = `
        <div class="summary-card-financial bg-revenue">
            <span class="summary-label">Receita Total</span>
            <span class="summary-value">R$ ${totalRevenue.toFixed(2)}</span>
        </div>
        <div class="summary-card-financial bg-costs">
            <span class="summary-label">Custos Totais</span>
            <span class="summary-value">R$ ${totalCosts.toFixed(2)}</span>
        </div>
        <div class="summary-card-financial bg-profit">
            <span class="summary-label">Lucro Líquido</span>
            <span class="summary-value">R$ ${netProfit.toFixed(2)}</span>
        </div>
    `;
};

// --- VENDAS ---
const listenToSales = () => {
    const salesCollection = collection(db, `users/${currentUser.uid}/sales`);
    unsubscribeSales = onSnapshot(salesCollection, (snapshot) => {
        allSales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (salesTableBody) {
            salesTableBody.innerHTML = '';
            allSales.forEach(sale => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${sale.date}</td>
                    <td>${sale.volume} kg</td>
                    <td>R$ ${sale.pricePerKg.toFixed(2)}</td>
                    <td>R$ ${sale.total.toFixed(2)}</td>
                    <td><button class="delete-sale-btn button-danger text-xs" data-id="${sale.id}"><i class="fa-solid fa-trash"></i></button></td>
                `;
                salesTableBody.appendChild(tr);
            });
        }
        calculateFinancialSummary();
    });
};

// --- CUSTOS ---
const listenToCosts = () => {
    const costsCollection = collection(db, `users/${currentUser.uid}/costs`);
    unsubscribeCosts = onSnapshot(costsCollection, (snapshot) => {
        allCosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (costsTableBody) {
            costsTableBody.innerHTML = '';
            allCosts.forEach(cost => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${cost.date}</td>
                    <td>${cost.description}</td>
                    <td>R$ ${cost.value.toFixed(2)}</td>
                    <td><button class="delete-cost-btn button-danger text-xs" data-id="${cost.id}"><i class="fa-solid fa-trash"></i></button></td>
                `;
                costsTableBody.appendChild(tr);
            });
        }
        calculateFinancialSummary();
    });
};

// --- CONTROLE DE EXTRAÇÃO ---
const listenToExtractions = () => {
    const extractionsCollection = collection(db, `users/${currentUser.uid}/extractions`);
    unsubscribeExtractions = onSnapshot(extractionsCollection, (snapshot) => {
        allExtractions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (extractionTableBody) {
            extractionTableBody.innerHTML = '';
            allExtractions.forEach(data => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${data.date}</td>
                    <td>${data.volume.toFixed(1)}</td>
                    <td>${data.destination}</td>
                    <td>
                        <button class="delete-extraction-btn button-danger text-xs" data-id="${data.id}"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                extractionTableBody.appendChild(tr);
            });
        }
        calculateFinancialSummary();
    });
};

// --- GESTÃO DE MATERIAIS ---
const listenToInventory = () => {
    const inventoryRef = doc(db, `users/${currentUser.uid}/inventory`, 'stock');
    unsubscribeInventory = onSnapshot(inventoryRef, (docSnap) => {
        currentInventory = docSnap.exists() ? docSnap.data() : {};
        renderInventory();
    });
};

const renderInventory = () => {
    if (inventoryList) {
        inventoryList.innerHTML = '';
        Object.entries(defaultItems).forEach(([key, name]) => {
            const quantity = currentInventory[key] || 0;
            const itemEl = document.createElement('div');
            itemEl.className = 'inventory-item';
            itemEl.innerHTML = `
                <span class="inventory-item-name">${name}</span>
                <div class="inventory-controls">
                    <button class="stock-change-btn" data-item="${key}" data-action="remove">-</button>
                    <span class="stock-quantity">${quantity}</span>
                    <button class="stock-change-btn" data-item="${key}" data-action="add">+</button>
                </div>
            `;
            inventoryList.appendChild(itemEl);
        });
    }
};

const openStockModal = (item, action) => {
    currentStockUpdate = { item, action };
    stockModalTitle.textContent = `${action === 'add' ? 'Adicionar ao' : 'Remover do'} Estoque de ${defaultItems[item]}`;
    stockForm.reset();
    stockModal.classList.add('is-open');
};

// --- LISTENERS DE EVENTOS (AGORA DENTRO DO DOMCONTENTLOADED) ---
document.addEventListener('DOMContentLoaded', () => {

    if (salesForm) {
        salesForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const saleData = {
                date: document.getElementById('sale-date').value,
                volume: parseFloat(document.getElementById('sale-volume').value),
                pricePerKg: parseFloat(document.getElementById('sale-price').value),
                createdAt: new Date()
            };
            saleData.total = saleData.volume * saleData.pricePerKg;

            try {
                await addDoc(collection(db, `users/${currentUser.uid}/sales`), saleData);
                salesForm.reset();
            } catch (error) {
                console.error("Erro ao registar venda:", error);
                alert("Falha ao registar a venda.");
            }
        });
    }

    if (salesTableBody) {
        salesTableBody.addEventListener('click', async (e) => {
            if (e.target.closest('.delete-sale-btn')) {
                const docId = e.target.closest('.delete-sale-btn').dataset.id;
                if (confirm("Tem a certeza que deseja apagar este registo de venda?")) {
                    await deleteDoc(doc(db, `users/${currentUser.uid}/sales`, docId));
                }
            }
        });
    }

    if (costsForm) {
        costsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const costData = {
                date: document.getElementById('cost-date').value,
                description: document.getElementById('cost-description').value,
                value: parseFloat(document.getElementById('cost-value').value),
                createdAt: new Date()
            };

            try {
                await addDoc(collection(db, `users/${currentUser.uid}/costs`), costData);
                costsForm.reset();
            } catch (error) {
                console.error("Erro ao registar custo:", error);
                alert("Falha ao registar o custo.");
            }
        });
    }

    if (costsTableBody) {
        costsTableBody.addEventListener('click', async (e) => {
            if (e.target.closest('.delete-cost-btn')) {
                const docId = e.target.closest('.delete-cost-btn').dataset.id;
                if (confirm("Tem a certeza que deseja apagar este registo de custo?")) {
                    await deleteDoc(doc(db, `users/${currentUser.uid}/costs`, docId));
                }
            }
        });
    }

    if (extractionForm) {
        extractionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return;

            const extractionData = {
                date: document.getElementById('extraction-date').value,
                volume: parseFloat(document.getElementById('extraction-volume').value),
                destination: document.getElementById('extraction-destination').value,
                notes: document.getElementById('extraction-notes').value,
                createdAt: new Date()
            };

            try {
                await addDoc(collection(db, `users/${currentUser.uid}/extractions`), extractionData);
                extractionForm.reset();
            } catch (error) {
                console.error("Erro ao adicionar registo de extração:", error);
                alert("Falha ao salvar o registo.");
            }
        });
    }

    if (extractionTableBody) {
        extractionTableBody.addEventListener('click', async (e) => {
            if (e.target.closest('.delete-extraction-btn')) {
                const docId = e.target.closest('.delete-extraction-btn').dataset.id;
                if (confirm("Tem a certeza que deseja apagar este registo de extração?")) {
                    await deleteDoc(doc(db, `users/${currentUser.uid}/extractions`, docId));
                }
            }
        });
    }
    
    if (inventoryList) {
        inventoryList.addEventListener('click', (e) => {
            if (e.target.classList.contains('stock-change-btn')) {
                const { item, action } = e.target.dataset;
                openStockModal(item, action);
            }
        });
    }
    
    if (stockForm) {
        stockForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const quantity = parseInt(document.getElementById('stock-quantity').value);
            if (isNaN(quantity) || quantity <= 0) {
                alert("Por favor, insira uma quantidade válida.");
                return;
            }

            const { item, action } = currentStockUpdate;
            const currentQuantity = currentInventory[item] || 0;
            const newQuantity = action === 'add' ? currentQuantity + quantity : currentQuantity - quantity;

            if (newQuantity < 0) {
                alert("A quantidade em estoque não pode ser negativa.");
                return;
            }

            try {
                const inventoryRef = doc(db, `users/${currentUser.uid}/inventory`, 'stock');
                await setDoc(inventoryRef, { [item]: newQuantity }, { merge: true });
                stockModal.classList.remove('is-open');
            } catch (error) { // <-- BRACES WERE MISSING HERE
                console.error("Erro ao atualizar o estoque:", error);
                alert("Falha ao atualizar o estoque.");
            }
        });
    }

    if (stockModalCancel) {
        stockModalCancel.addEventListener('click', () => {
            stockModal.classList.remove('is-open');
        });
    }
});
