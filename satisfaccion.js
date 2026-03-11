/**
 * Encuesta de Satisfacción - Digital Value
 * Conecta con la API de encuestas del Ayuntamiento
 */

// Configuración de la API
const API_BASE_URL = 'https://public.digitalvalue.es:8848';
const API_SURVEYS_PATH = '/surveys';

// Obtener parámetros de la URL
const urlParams = new URLSearchParams(window.location.search);
const REALM = urlParams.get('realm') || 'alcantir';
const SURVEY_ID = urlParams.get('surveyId') || null;
const APP_ID = urlParams.get('app') || null;
const TITLE = urlParams.get('title') || null;
const SUBTITLE = urlParams.get('subtitle') || null;
const PRIVACY_URL = urlParams.get('privacyUrl') || null;
const AUTO_RESET = 8; // segundos hasta reset automático

// Variables para la configuración de la encuesta
let surveyConfig = null;
let chainConfig = null; // Config de la encuesta enlazada
let chainSurveys = []; // Encuestas enlazadas
let currentStep = 1; // 1 = rating, 2 = comentarios (si hay chain)

// Elementos del DOM
const surveyScreen = document.getElementById('surveyScreen');
const thankYouScreen = document.getElementById('thankYouScreen');
const faceButtons = document.querySelectorAll('.face-btn');
const commentSection = document.getElementById('commentSection');
const commentInput = document.getElementById('commentInput');
const submitBtn = document.getElementById('submitBtn');
const skipBtn = document.getElementById('skipBtn');
const errorMessage = document.getElementById('errorMessage');
const realmIndicator = document.getElementById('realmIndicator');
const surveyTitle = document.getElementById('surveyTitle');
const surveySubtitle = document.getElementById('surveySubtitle');
const privacyLink = document.getElementById('privacyLink');

let selectedValue = null;
let isSubmitting = false;

/**
 * Obtener configuración de la encuesta
 */
async function fetchSurveyConfig() {
    if (!SURVEY_ID) return null;

    let apiUrl = `${API_BASE_URL}/${REALM}${API_SURVEYS_PATH}/${SURVEY_ID}?expand=true`;
    if (APP_ID) apiUrl += `&app=${APP_ID}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept-Language': 'es'
            }
        });

        if (response.ok) {
            surveyConfig = await response.json();
            console.log('[Encuesta] Configuración:', surveyConfig);

            // Guardar encuestas enlazadas (chain)
            chainSurveys = surveyConfig.chain || [];
            console.log('[Encuesta] Encuestas enlazadas:', chainSurveys);

            return surveyConfig;
        }
    } catch (error) {
        console.error('[Encuesta] Error obteniendo config:', error);
    }
    return null;
}

/**
 * Determinar el formato del voto según el tipo de encuesta
 */
function formatVote(value) {
    if (!surveyConfig) {
        // Si no tenemos config, enviar como número simple
        return value;
    }

    const displayType = surveyConfig.displayType || surveyConfig.displaytype || 'rating';

    switch (displayType) {
        case 'rating':
        case 'ratingStars':
            // Enviar el número directamente
            return value;

        case 'yesNo':
            // yesNo espera true/false
            return value >= 4;

        case 'options':
        case 'optionsMultiple':
            // Options espera el ID de la opción
            // Para rating 1-5, mapear a las respuestas disponibles
            return surveyConfig.answers ? surveyConfig.answers[value - 1]?._id : value;

        case 'proposals':
            // Proposals espera el ID de la propuesta
            return surveyConfig.proposals ? surveyConfig.proposals[value - 1]?._id : value;

        default:
            return value;
    }
}

/**
 * Inicializar la encuesta con parámetros de la URL
 */
async function initFromParams() {
    if (REALM) {
        realmIndicator.textContent = REALM;
    }

    if (TITLE) {
        surveyTitle.textContent = decodeURIComponent(TITLE);
    }

    if (SUBTITLE) {
        surveySubtitle.textContent = decodeURIComponent(SUBTITLE);
    }

    if (PRIVACY_URL) {
        const privacyBtn = document.getElementById('privacyBtn');
        privacyBtn.href = decodeURIComponent(PRIVACY_URL);
        privacyBtn.target = '_blank';
    } else {
        privacyLink.style.display = 'none';
    }

    console.log(`[Encuesta] Realm: ${REALM}, Survey ID: ${SURVEY_ID}, App: ${APP_ID}`);

    // Obtener configuración de la encuesta si tenemos ID
    if (SURVEY_ID) {
        await fetchSurveyConfig();
    }

    // Configurar UI según si hay encuestas enlazadas
    setTimeout(() => setupCommentSection(), 100);
}

/**
 * Configurar la sección de comentarios según el tipo de encuesta
 */
function setupCommentSection() {
    const commentStep = document.getElementById('commentStep');
    const ratingOnlySection = document.getElementById('ratingOnlySection');
    const commentOptions = document.getElementById('commentOptions');
    const commentPrompt = document.getElementById('commentPrompt');

    // Ocultar botones antiguos
    const oldButtonGroup = document.querySelector('.comment-section .button-group');
    if (oldButtonGroup) {
        oldButtonGroup.style.display = 'none';
    }

    if (chainSurveys && chainSurveys.length > 0) {
        // Hay encuestas enlazadas - mostrar paso 2
        commentStep.style.display = 'block';
        ratingOnlySection.style.display = 'none';

        // Construir opciones de la primera encuesta enlazada
        const chainId = chainSurveys[0];
        renderChainOptions(chainId, commentOptions, commentPrompt);
    } else {
        // Sin chain - mostrar solo botón de enviar
        commentStep.style.display = 'none';
        ratingOnlySection.style.display = 'block';
    }
}

/**
 * Renderizar las opciones de la encuesta enlazada
 */
function renderChainOptions(chainId, container, promptEl) {
    // Obtener config de la encuesta enlazada
    fetch(`${API_BASE_URL}/${REALM}${API_SURVEYS_PATH}/${chainId}${APP_ID ? '?app=' + APP_ID : ''}`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept-Language': 'es' }
    })
    .then(res => res.json())
    .then(config => {
        console.log('[Encuesta] Config chain:', config);

        // Actualizar prompt
        if (config.title) {
            promptEl.textContent = typeof config.title === 'object' ? config.title.es || config.title.ca || '¿Quieres añadir un comentario?' : config.title;
        }

        // Mostrar botones siempre cuando hay chain
        const buttonGroup = document.querySelector('#commentStep .button-group');
        if (buttonGroup) {
            buttonGroup.style.display = 'flex';
        }

        // Según el tipo de encuesta, renderizar opciones
        const displayType = config.displayType || config.displaytype || config.type || 'options';
        console.log('[Encuesta] DisplayType chain:', displayType);

        if (displayType === 'rating' || displayType === 'ratingStars') {
            renderRatingOptions(container, config);
        } else if (displayType === 'yesNo') {
            renderYesNoOptions(container);
        } else if (displayType === 'options' || displayType === 'optionsMultiple') {
            renderTextOptions(container, config);
        } else {
            // Por defecto, intentar renderizar como freeText (respuesta libre)
            console.log('[Encuesta] Renderizando como freeText por defecto');
            renderFreeTextOptions(container, config);
        }

        // Guardar config de la encuesta enlazada
        chainConfig = config;
    })
    .catch(err => console.error('[Encuesta] Error chain:', err));
}

/**
 * Renderizar opciones de rating para comments
 */
function renderRatingOptions(container, config) {
    const maxRating = 5;
    const wrapper = document.createElement('div');
    wrapper.className = 'comment-rating';

    for (let i = 1; i <= maxRating; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'comment-rating-btn';
        btn.dataset.value = i;
        btn.textContent = i;
        btn.addEventListener('click', () => selectCommentRating(i, wrapper));
        wrapper.appendChild(btn);
    }

    container.appendChild(wrapper);
    window.commentRatingValue = null;
}

function selectCommentRating(value, container) {
    // Quitar selección anterior
    container.querySelectorAll('.comment-rating-btn').forEach(b => b.classList.remove('selected'));
    // Seleccionar nuevo
    container.querySelector(`[data-value="${value}"]`).classList.add('selected');
    window.commentRatingValue = value;
}

/**
 * Renderizar opciones Sí/No
 */
function renderYesNoOptions(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'comment-yesno';

    const yesBtn = document.createElement('button');
    yesBtn.type = 'button';
    yesBtn.className = 'comment-yesno-btn';
    yesBtn.textContent = 'Sí';
    yesBtn.addEventListener('click', () => {
        wrapper.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
        yesBtn.classList.add('selected');
        window.commentRatingValue = true;
    });

    const noBtn = document.createElement('button');
    noBtn.type = 'button';
    noBtn.className = 'comment-yesno-btn';
    noBtn.textContent = 'No';
    noBtn.addEventListener('click', () => {
        wrapper.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
        noBtn.classList.add('selected');
        window.commentRatingValue = false;
    });

    wrapper.appendChild(yesBtn);
    wrapper.appendChild(noBtn);
    container.appendChild(wrapper);
    window.commentRatingValue = null;
}

/**
 * Renderizar opciones de texto
 */
function renderTextOptions(container, config) {
    const displayType = config.displayType || config.displaytype || 'options';

    // Si es respuesta libre (freeText), renderizar textarea
    if (displayType === 'freeText' || displayType === 'text' || displayType === 'textarea') {
        renderFreeTextOptions(container, config);
        return;
    }

    // Si es options u optionsMultiple, renderizar botones
    const answers = config.answers || config.proposals || [];
    const wrapper = document.createElement('div');
    wrapper.className = 'comment-options-list';

    answers.forEach(answer => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'comment-option-btn';
        btn.dataset.id = answer._id;
        const text = typeof answer.title === 'object' ? answer.title.es || answer.title.ca || answer.text : answer.text || answer.title;
        btn.textContent = text;
        btn.addEventListener('click', () => {
            wrapper.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            window.commentRatingValue = answer._id;
        });
        wrapper.appendChild(btn);
    });

    container.appendChild(wrapper);
    window.commentRatingValue = null;
}

/**
 * Renderizar input de texto libre
 */
function renderFreeTextOptions(container, config) {
    const wrapper = document.createElement('div');
    wrapper.className = 'free-text-input';

    const textarea = document.createElement('textarea');
    textarea.className = 'comment-textarea';
    textarea.placeholder = config.placeholder || 'Escribe tu comentario...';
    textarea.rows = config.rows || 4;
    textarea.dataset.maxLength = config.maxLength || 500;

    textarea.addEventListener('input', () => {
        // Para freeText se guarda el valor directamente como string
        window.commentRatingValue = textarea.value;
    });

    wrapper.appendChild(textarea);
    container.appendChild(wrapper);
    window.commentRatingValue = '';

    // Enfocar el textarea
    setTimeout(() => textarea.focus(), 100);
}

/**
 * Manejar selección de cara de valoración
 */
function initFaceButtons() {
    faceButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Quitar selección anterior
            faceButtons.forEach(b => b.classList.remove('selected'));

            // Seleccionar nueva cara
            btn.classList.add('selected');
            selectedValue = btn.dataset.value;

            // Mostrar área de comentario
            commentSection.classList.add('visible');

            // Enfocar el primer botón de opciones si existe
            setTimeout(() => {
                const firstOption = document.querySelector('.comment-rating-btn, .comment-yesno-btn, .comment-option-btn');
                if (firstOption) {
                    firstOption.focus();
                }
            }, 100);
        });
    });
}

/**
 * Enviar valoración a la API
 * @param {boolean} skipComment - Si true, omite el comentario
 */
async function submitRating(skipComment = false) {
    if (!selectedValue || isSubmitting) return;

    // Validar que hay surveyId
    if (SURVEY_ID === null) {
        showError('Encuesta no configurada correctamente');
        return;
    }

    isSubmitting = true;
    setButtonLoading(true);

    // Preparar datos del voto - formato completo según el ejemplo del usuario
    const voteData = {
        _id: SURVEY_ID,
        title: surveyConfig?.title || {},
        link: surveyConfig?.link || '',
        description: surveyConfig?.description || {},
        showResults: surveyConfig?.showResults || false,
        shouldConfirmAnswer: surveyConfig?.shouldConfirmAnswer || false,
        startTime: surveyConfig?.startTime || '',
        endTime: surveyConfig?.endTime || '',
        endPublicationTime: surveyConfig?.endPublicationTime || '',
        ratingRange: surveyConfig?.ratingRange || [1, 5],
        app: APP_ID || surveyConfig?.app || '',
        isActive: surveyConfig?.isActive || true,
        displayType: surveyConfig?.displayType || 'rating',
        credentials: surveyConfig?.credentials || 'none',
        isChild: surveyConfig?.isChild || false,
        submittedMessage: surveyConfig?.submittedMessage || {},
        rating: parseInt(selectedValue)
    };

    console.log('[Encuesta] Voto principal:', JSON.stringify(voteData));

    try {
        // 1. Enviar voto principal
        let apiUrl = `${API_BASE_URL}/${REALM}${API_SURVEYS_PATH}/${SURVEY_ID}/vote`;
        if (APP_ID) apiUrl += `?app=${APP_ID}`;

        console.log('[Encuesta] Enviando voto principal a:', apiUrl);

        let response = await fetch(apiUrl, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept-Language': 'es'
            },
            body: JSON.stringify(voteData)
        });

        let responseData = await response.json().catch(() => ({}));
        console.log('[Encuesta] Respuesta principal:', response.status, responseData);

        if (!response.ok) {
            throw new Error(responseData.message || responseData.error || `Error al enviar valoración`);
        }

        // 2. Si hay encuestas enlazadas y no se omite, enviar comentario
        // Solo enviar comentario si hay valor y no está vacío
        const hasCommentValue = window.commentRatingValue !== null &&
                                window.commentRatingValue !== '' &&
                                window.commentRatingValue !== undefined;

        if (chainSurveys && chainSurveys.length > 0 && hasCommentValue) {
            const chainId = chainSurveys[0];

            let chainApiUrl = `${API_BASE_URL}/${REALM}${API_SURVEYS_PATH}/${chainId}/vote`;
            if (APP_ID) chainApiUrl += `?app=${APP_ID}`;

            const chainVoteData = {
                answer: window.commentRatingValue
            };

            console.log('[Encuesta] Enviando comentario a:', chainApiUrl, chainVoteData);

            response = await fetch(chainApiUrl, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept-Language': 'es'
                },
                body: JSON.stringify(chainVoteData)
            });

            responseData = await response.json().catch(() => ({}));
            console.log('[Encuesta] Respuesta comentario:', response.status, responseData);
        }

        // Éxito - mostrar pantalla de agradecimiento
        surveyScreen.classList.add('hidden');
        thankYouScreen.classList.add('visible');

        console.log('[Encuesta] Voto(s) enviado(s) correctamente');

        // Auto-reset después de X segundos para permitir nuevo voto
        const AUTO_RESET_DELAY = AUTO_RESET * 1000;
        console.log(`[Encuesta] Reseteando en ${AUTO_RESET} segundos...`);
        setTimeout(() => {
            resetSurvey();
        }, AUTO_RESET_DELAY);

    } catch (error) {
        console.error('[Encuesta] Error al enviar:', error);
        showError(error.message || 'Error al enviar la encuesta. Por favor, inténtalo de nuevo.');
    } finally {
        isSubmitting = false;
        setButtonLoading(false);
    }
}

/**
 * Mostrar mensaje de error
 * @param {string} message - Mensaje a mostrar
 */
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('visible');
    setTimeout(() => {
        errorMessage.classList.remove('visible');
    }, 5000);
}

/**
 * Cambiar estado del botón durante el envío
 * @param {boolean} loading - Estado de carga
 */
function setButtonLoading(loading) {
    if (loading) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span>Enviando...';
        skipBtn.disabled = true;
    } else {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enviar';
        skipBtn.disabled = false;
    }
}

/**
 * Inicializar event listeners
 */
/**
 * Resettear la encuesta para el siguiente votante
 */
function resetSurvey() {
    // Resetear valores
    selectedValue = null;
    window.commentRatingValue = null;
    isSubmitting = false;

    // Quitar selección de caras
    faceButtons.forEach(b => b.classList.remove('selected'));

    // Ocultar pantalla de agradecimiento
    thankYouScreen.classList.remove('visible');

    // Mostrar pantalla de encuesta
    surveyScreen.classList.remove('hidden');

    // Resetear comment section - primero limpiar opciones
    const commentOptions = document.getElementById('commentOptions');
    if (commentOptions) {
        commentOptions.innerHTML = '';
    }

    // Ocultar comment section hasta seleccionar rating
    commentSection.classList.remove('visible');

    // Ocultar commentStep y mostrar ratingOnlySection según corresponda
    const commentStep = document.getElementById('commentStep');
    const ratingOnlySection = document.getElementById('ratingOnlySection');
    const buttonGroup = document.querySelector('#commentStep .button-group');

    if (buttonGroup) {
        buttonGroup.style.display = 'none';
    }

    // Ocultar ambos pasos inicialmente
    if (commentStep) commentStep.style.display = 'none';
    if (ratingOnlySection) {
        if (chainSurveys && chainSurveys.length > 0) {
            ratingOnlySection.style.display = 'none';
        } else {
            ratingOnlySection.style.display = 'block';
        }
    }

    // Resetear botones
    setButtonLoading(false);

    console.log('[Encuesta] Encuesta reseteada para nuevo voto');
}

function initEventListeners() {
    // Botones del paso con chain
    submitBtn.addEventListener('click', () => submitRating(false));
    skipBtn.addEventListener('click', () => submitRating(true));

    // Botón simple sin chain
    const submitBtnSimple = document.getElementById('submitBtnSimple');
    if (submitBtnSimple) {
        submitBtnSimple.addEventListener('click', () => submitRating(false));
    }

    // Permitir enviar con Enter (si hay input de comentario legacy)
    if (commentInput) {
        commentInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !isSubmitting) {
                e.preventDefault();
                submitRating(false);
            }
        });
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    await initFromParams();
    initFaceButtons();
    initEventListeners();
});
