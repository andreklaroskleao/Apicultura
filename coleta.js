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
    const todayBtn = document.getElementById('today-btn');

    let currentStep = 0;
    const totalSteps = formSteps.length;
    let collectionData = {}; 

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

    if (todayBtn) {
        todayBtn.addEventListener('click', setCurrentDate);
    }
    
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

    // --- LÓGICA DE LEITURA DE QR CODE ---
    const scanQrBtn = document.getElementById('scan-qr-btn');
    const qrReaderDiv = document.getElementById('qr-reader');
    const qrSuccessMessage = document.getElementById('qr-success-message');
    const qrSuccessText = document.getElementById('qr-success-text');
    
    if (scanQrBtn && qrReaderDiv && typeof Html5Qrcode !== 'undefined') {
        const html5QrCode = new Html5Qrcode("qr-reader");

        const stopScanner = () => {
            if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode.stop().then(() => {
                    qrReaderDiv.style.display = 'none';
                    scanQrBtn.style.display = 'block';
                }).catch(err => {
                    console.error("Falha ao parar o leitor de QR Code.", err);
                    qrReaderDiv.style.display = 'none';
                    scanQrBtn.style.display = 'block';
                });
            } else {
                qrReaderDiv.style.display = 'none';
                scanQrBtn.style.display = 'block';
            }
        };

        scanQrBtn.addEventListener('click', () => {
            qrReaderDiv.style.display = 'block';
            scanQrBtn.style.display = 'none';

            const qrCodeSuccessCallback = (decodedText, decodedResult) => {
                stopScanner();
                const optionExists = Array.from(hiveSelect.options).some(opt => opt.value === decodedText);

                if (optionExists) {
                    hiveSelect.value = decodedText;
                    
                    qrSuccessText.textContent = `Colmeia #${decodedText} selecionada!`;
                    qrSuccessMessage.classList.remove('hidden');
                    qrSuccessMessage.classList.add('visible');

                    setTimeout(() => {
                        qrSuccessMessage.classList.remove('visible');
                        if (nextBtn) nextBtn.click();
                        setTimeout(() => qrSuccessMessage.classList.add('hidden'), 500);
                    }, 2000);

                } else {
                    alert(`Erro: Colmeia com ID "${decodedText}" não encontrada.`);
                }
            };

            const config = { fps: 10, qrbox: { width: 250, height: 250 } };

            html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
                .catch(err => {
                    alert("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
                    stopScanner();
                });
        });
    }
    
    // --- LÓGICA DE TRANSCRIÇÃO DE VOZ ---
    const convertWordsToNumbers = (text) => {
        const wordMap = {
            'zero': '0', 'um': '1', 'uma': '1', 'dois': '2', 'duas': '2', 'três': '3', 'quatro': '4',
            'cinco': '5', 'seis': '6', 'sete': '7', 'oito': '8', 'nove': '9', 'dez': '10',
            'vírgula': '.', 'ponto': '.'
        };
        // Converte a frase para minúsculas e aplica o mapeamento de palavras
        return text.toLowerCase().split(' ').map(word => wordMap[word] || word).join(' ');
    };

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
                    console.error("Erro ao tentar iniciar o reconhecimento de voz.", error);
                    activeMicButton = null;
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

                // Etapa 1: Converte palavras como "dois" ou "vírgula" para "2" ou "."
                let processedText = convertWordsToNumbers(transcript);

                // Etapa 2: Substitui a vírgula (seja do browser ou da nossa conversão) por ponto.
                processedText = processedText.replace(/,/g, '.');
                
                // Etapa 3: Remove todos os caracteres que NÃO SÃO dígitos ou ponto.
                processedText = processedText.replace(/[^0-9.]/g, '');

                if (targetInput.type === 'number') {
                    const numericValue = parseFloat(processedText);
                    if (!isNaN(numericValue)) {
                        targetInput.value = numericValue;
                    } else {
                        console.warn(`Não foi possível converter "${transcript}" para um número após o processamento.`);
                    }
                } else {
                    // Para a textarea, usamos o texto original sem processamento numérico
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
