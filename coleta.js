import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, currentUser, userHives } from './script.js';

document.addEventListener('DOMContentLoaded', () => {
    // Só executa a lógica se estivermos na página de coleta
    if (!document.getElementById('coleta-wizard-card')) return;

    // --- REFERÊNCIAS AO DOM ---
    const formSteps = document.querySelectorAll('.form-step');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const saveBtn = document.getElementById('save-btn');
    const progressBar = document.getElementById('coleta-progress');
    const hiveSelect = document.getElementById('hive-id-select');
    const dateInput = document.getElementById('data');

    let currentStep = 0;
    const totalSteps = formSteps.length;
    let collectionData = {}; // Objeto para armazenar os dados

    // --- INICIALIZAÇÃO ---
    
    // Popula o seletor de colmeias
    const populateHiveSelect = () => {
        if (!hiveSelect) return;
        if (userHives.length === 0) {
            hiveSelect.innerHTML = `<option value="">Nenhuma colmeia encontrada</option>`;
            return;
        }
        const optionsHtml = userHives.map(hive => {
            const ownerLabel = hive.ownerId === currentUser.uid ? '' : ` (${hive.ownerApiaryName})`;
            return `<option value="${hive.id}">Colmeia #${hive.id}${ownerLabel}</option>`;
        }).join('');
        hiveSelect.innerHTML = `<option value="">Selecione...</option>${optionsHtml}`;
    };

    // Preenche a data atual
    const setCurrentDate = () => {
        if (!dateInput) return;
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;
    };
    
    // --- LÓGICA DE NAVEGAÇÃO ---
    
    const updateFormStep = () => {
        formSteps.forEach((step, index) => {
            step.classList.toggle('active', index === currentStep);
        });
        updateProgressBar();
        updateNavigationButtons();
    };

    const updateProgressBar = () => {
        if (!progressBar) return;
        const progress = (currentStep / (totalSteps - 1)) * 100;
        progressBar.style.width = `${progress}%`;
    };

    const updateNavigationButtons = () => {
        if (!prevBtn || !nextBtn || !saveBtn) return;
        prevBtn.classList.toggle('hidden', currentStep === 0);
        nextBtn.classList.toggle('hidden', currentStep === totalSteps - 1);
        saveBtn.classList.toggle('hidden', currentStep !== totalSteps - 1);
    };

    const validateStep = () => {
        const currentInput = formSteps[currentStep].querySelector('input, select, textarea');
        if (currentInput && currentInput.required && !currentInput.value) {
            alert('Por favor, preencha este campo para continuar.');
            return false;
        }
        return true;
    };
    
    const storeStepData = () => {
        const currentInput = formSteps[currentStep].querySelector('input, select, textarea');
        if (currentInput) {
            collectionData[currentInput.id] = currentInput.value;
        }
    };

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (validateStep()) {
                storeStepData();
                if (currentStep < totalSteps - 1) {
                    currentStep++;
                    updateFormStep();
                }
            }
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentStep > 0) {
                currentStep--;
                updateFormStep();
            }
        });
    }

    // --- LÓGICA DE SALVAMENTO ---
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            if (!currentUser) {
                alert("Erro: Usuário não autenticado.");
                return;
            }

            const hiveId = collectionData['hive-id-select'];
            const hive = userHives.find(h => h.id === hiveId);

            if (!hive) {
                alert("Erro: Colmeia selecionada é inválida.");
                return;
            }

            // Monta o objeto final para salvar no Firestore
            const dataToSave = {
                hiveId: hiveId,
                data: collectionData['data'],
                ownerId: hive.ownerId,
                accessibleTo: hive.accessibleTo,
                editors: hive.editors,
                createdAt: new Date(),
                lastUpdatedAt: new Date(),
                numeroColeta: parseInt(collectionData['numeroColeta']),
                numeroMelgueiras: parseInt(collectionData['numeroMelgueiras']),
                pesoNinhoVazio: parseFloat(collectionData['pesoNinhoVazio']),
                pesoQuadrosOperculos: parseFloat(collectionData['pesoQuadrosOperculos']),
                pesoMelgueiraVazia: parseFloat(collectionData['pesoMelgueiraVazia']),
                pesoQuadrosMelgueira: parseFloat(collectionData['pesoQuadrosMelgueira']),
                observacoes: collectionData['observacoes'],
            };

            try {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
                
                await addDoc(collection(db, "collections"), dataToSave);
                
                alert("Coleta salva com sucesso!");
                window.location.href = '/index.html'; // Redireciona para a página principal

            } catch (error) {
                console.error("Erro ao salvar dados da coleta:", error);
                alert("Falha ao salvar os dados. Tente novamente.");
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fa-solid fa-save"></i> Salvar Coleta';
            }
        });
    }

    // --- LÓGICA DE TRANSCRIÇÃO DE VOZ ---
    const micBtn = document.getElementById('mic-btn');
    const observacoesTextarea = document.getElementById('observacoes');
    const micStatus = document.getElementById('mic-status');

    // Verifica se o navegador suporta a Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition && micBtn && observacoesTextarea && micStatus) {
        const recognition = new SpeechRecognition();
        
        // Configurações do reconhecimento
        recognition.lang = 'pt-BR'; // Define o idioma para Português do Brasil
        recognition.continuous = false; // Para de ouvir após uma pausa na fala
        recognition.interimResults = false; // Retorna apenas o resultado final

        micBtn.addEventListener('click', () => {
            if (micBtn.classList.contains('listening')) {
                recognition.stop();
            } else {
                try {
                    recognition.start();
                } catch (error) {
                    console.error("Erro ao iniciar o reconhecimento de voz:", error);
                    micStatus.textContent = 'Não foi possível iniciar a gravação.';
                }
            }
        });

        // Evento: quando o reconhecimento começa
        recognition.onstart = () => {
            micBtn.classList.add('listening');
            micStatus.textContent = 'Ouvindo...';
        };

        // Evento: quando o reconhecimento termina
        recognition.onend = () => {
            micBtn.classList.remove('listening');
            micStatus.textContent = '';
        };

        // Evento: em caso de erro
        recognition.onerror = (event) => {
            console.error("Erro no reconhecimento de voz:", event.error);
            micStatus.textContent = 'Erro ao ouvir. Tente novamente.';
        };

        // Evento: QUANDO O RESULTADO É OBTIDO
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            
            // Adiciona o texto transcrito ao campo, mantendo o que já estava lá
            const textoAtual = observacoesTextarea.value;
            observacoesTextarea.value = textoAtual ? `${textoAtual} ${transcript}` : transcript;
        };

    } else {
        // Se o navegador não suportar a API, esconde o botão
        if (micBtn) {
            micBtn.style.display = 'none';
            console.warn("Seu navegador não suporta a transcrição de voz.");
        }
    }

    // Função de inicialização da página
    const initializePage = () => {
        // Aguarda um instante para garantir que `userHives` de `script.js` foi carregado
        setTimeout(() => {
            populateHiveSelect();
            setCurrentDate();
            updateFormStep();
        }, 500);
    };

    initializePage();
});
