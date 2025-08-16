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

    // --- LÓGICA DE NAVEGAÇÃO ---
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

    const setCurrentDate = () => {
        if (!dateInput) return;
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;
    };

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
                window.location.href = '/index.html';
            } catch (error) {
                console.error("Erro ao salvar dados da coleta:", error);
                alert("Falha ao salvar os dados. Tente novamente.");
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fa-solid fa-save"></i> Salvar Coleta';
            }
        });
    }

    // --- LÓGICA DE TRANSCRIÇÃO DE VOZ ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const micButtons = document.querySelectorAll('.mic-btn-input');

    if (SpeechRecognition && micButtons.length > 0) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.continuous = false;
        recognition.interimResults = false;

        let activeMicButton = null;

        micButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetId = button.dataset.target;
                const statusElement = document.querySelector(`.mic-status-text[data-status-for="${targetId}"]`);
                
                if (activeMicButton) {
                    recognition.stop();
                    return;
                }

                activeMicButton = button;
                try {
                    recognition.start();
                } catch(error) {
                    console.error("Erro ao tentar iniciar o reconhecimento de voz. Pode já estar ativo.", error);
                    activeMicButton = null; // Reseta o botão ativo
                }

                recognition.onstart = () => {
                    button.classList.add('listening');
                    if(statusElement) statusElement.textContent = 'Ouvindo...';
                };
            });
        });

        recognition.onend = () => {
            if (activeMicButton) {
                const targetId = activeMicButton.dataset.target;
                const statusElement = document.querySelector(`.mic-status-text[data-status-for="${targetId}"]`);
                activeMicButton.classList.remove('listening');
                if(statusElement) statusElement.textContent = '';
                activeMicButton = null;
            }
        };

        recognition.onerror = (event) => {
            console.error("Erro no reconhecimento de voz:", event.error);
            if (activeMicButton) {
                const targetId = activeMicButton.dataset.target;
                const statusElement = document.querySelector(`.mic-status-text[data-status-for="${targetId}"]`);
                if(statusElement) statusElement.textContent = 'Erro ao ouvir.';
            }
        };
        
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            
            if (activeMicButton) {
                const targetId = activeMicButton.dataset.target;
                const targetInput = document.getElementById(targetId);

                // Limpa a transcrição para números, removendo pontos e substituindo vírgulas
                const cleanedTranscript = transcript.replace(/\./g, '').replace(/,/g, '.').trim();

                if (targetInput.type === 'number') {
                    // Tenta converter para número e preenche
                    const numericValue = parseFloat(cleanedTranscript);
                    if (!isNaN(numericValue)) {
                        targetInput.value = numericValue;
                    }
                } else {
                    // Para a textarea, concatena o texto
                    const textoAtual = targetInput.value;
                    targetInput.value = textoAtual ? `${textoAtual} ${transcript}` : transcript;
                }
            }
        };

    } else {
        micButtons.forEach(button => button.style.display = 'none');
        console.warn("Seu navegador não suporta a transcrição de voz.");
    }

    // --- INICIALIZAÇÃO DA PÁGINA ---
    const initializePage = () => {
        setTimeout(() => {
            populateHiveSelect();
            setCurrentDate();
            updateFormStep();
        }, 500);
    };

    initializePage();
});
