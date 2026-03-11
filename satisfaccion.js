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
 * Inicializar la encuesta con parámetros de la URL
 */
function initFromParams() {
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

            // Enfocar el textarea
            setTimeout(() => {
                commentInput.focus();
            }, 100);
        });
    });
}

/**
 * Enviar valoración a la API
 * @param {boolean} skipComment - Si true, envía sin comentario
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

    // Preparar datos del voto
    const voteData = {
        answer: {
            rating: parseInt(selectedValue)
        }
    };

    // Añadir comentario si existe y no se omite
    if (!skipComment && commentInput.value.trim()) {
        voteData.answer.comment = commentInput.value.trim();
    }

    // Construir URL con parámetros opcionales
    let apiUrl = `${API_BASE_URL}/${REALM}${API_SURVEYS_PATH}/${SURVEY_ID}/vote`;
    const queryParams = [];
    if (APP_ID) queryParams.push(`app=${APP_ID}`);
    if (queryParams.length > 0) {
        apiUrl += '?' + queryParams.join('&');
    }

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept-Language': 'es'
            },
            body: JSON.stringify(voteData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Error HTTP ${response.status}`);
        }

        // Éxito - mostrar pantalla de agradecimiento
        surveyScreen.classList.add('hidden');
        thankYouScreen.classList.add('visible');

        console.log('[Encuesta] Voto enviado correctamente:', voteData);

    } catch (error) {
        console.error('[Encuesta] Error al enviar:', error);
        showError('Error al enviar la encuesta. Por favor, inténtalo de nuevo.');
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
function initEventListeners() {
    submitBtn.addEventListener('click', () => submitRating(false));
    skipBtn.addEventListener('click', () => submitRating(true));

    // Permitir enviar con Enter en el textarea
    commentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !isSubmitting) {
            e.preventDefault();
            submitRating(false);
        }
    });
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    initFromParams();
    initFaceButtons();
    initEventListeners();
});
