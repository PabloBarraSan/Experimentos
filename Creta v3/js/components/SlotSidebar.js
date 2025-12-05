// Slot Sidebar Component - Shared sidebar for calendar and admin views

/**
 * Render the sidebar HTML structure
 * @returns {string} HTML string
 */
export function renderSidebarHTML() {
    return `
        <div id="slot-sidebar" style="position: fixed; top: 0; bottom: 0; right: 0; width: 24rem; background-color: white; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); transform: translateX(100%); transition: transform 0.3s ease-in-out; z-index: 50; display: flex; flex-direction: column;">
            <div style="padding: 1rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background-color: #f8fafc;">
                <h3 style="font-weight: bold; font-size: 1.125rem; color: #1e293b; margin: 0;">Detalles del Slot</h3>
                <button onclick="closeSidebar()" style="color: #94a3b8; border: none; background: transparent; cursor: pointer; transition: color 0.2s; padding: 0.25rem;"
                        onmouseenter="this.style.color='#475569';"
                        onmouseleave="this.style.color='#94a3b8';">
                    <i class="fa-solid fa-times" style="font-size: 1.25rem;"></i>
                </button>
            </div>
            <div id="sidebar-content" style="flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 1rem;">
                <!-- Content injected via JS -->
            </div>
        </div>
        <div id="sidebar-overlay" onclick="closeSidebar()" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.2); backdrop-filter: blur(4px); display: none; z-index: 40; transition: opacity 0.2s;"></div>
    `;
}

/**
 * Initialize sidebar HTML if not already present
 */
export function ensureSidebarHTML() {
    if (!document.getElementById('slot-sidebar')) {
        document.body.insertAdjacentHTML('beforeend', renderSidebarHTML());
    }
}

/**
 * Open the sidebar with slot details
 * @param {string} slotId - ID of the clicked slot
 */
export function openSlotDetails(slotId) {
    const data = window.currentAppointmentsData;
    if (!data || !data.slots) return;

    const slot = data.slots.find(s => s._id === slotId);
    if (!slot) return;

    ensureSidebarHTML();

    const sidebar = document.getElementById('slot-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const content = document.getElementById('sidebar-content');

    if (!sidebar || !overlay || !content) return;

    // Populate content
    content.innerHTML = renderSlotDetails(slot);

    // Show sidebar
    sidebar.style.transform = 'translateX(0)';
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling

    // Add Escape key listener
    window.sidebarEscapeHandler = function(e) {
        if (e.key === 'Escape') {
            closeSidebar();
        }
    };
    document.addEventListener('keydown', window.sidebarEscapeHandler);
}

/**
 * Close the sidebar
 */
export function closeSidebar() {
    const sidebar = document.getElementById('slot-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (!sidebar || !overlay) return;

    sidebar.style.transform = 'translateX(100%)';
    overlay.style.display = 'none';
    document.body.style.overflow = '';

    // Remove Escape key listener
    if (window.sidebarEscapeHandler) {
        document.removeEventListener('keydown', window.sidebarEscapeHandler);
        window.sidebarEscapeHandler = null;
    }
}

/**
 * Open sidebar for an empty slot
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} settingName - Virtual setting name
 * @param {string} startHour - Start hour HH:MM
 * @param {string} endHour - End hour HH:MM
 * @param {number} seats - Number of seats
 */
export function openEmptySlotDetails(dateStr, settingName, startHour, endHour, seats) {
    ensureSidebarHTML();

    const sidebar = document.getElementById('slot-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const content = document.getElementById('sidebar-content');

    // Populate content with a "New Reservation" style
    content.innerHTML = `
        <div style="background-color: #f0fdf4; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem; border: 1px solid #bbf7d0;">
            <h4 style="font-weight: bold; color: #166534; font-size: 1.125rem; margin-bottom: 0.25rem; margin-top: 0;">Nuevo Turno: ${settingName}</h4>
            <div style="font-size: 0.875rem; color: #16a34a; margin-bottom: 0.5rem;">
                <i class="fa-regular fa-calendar" style="margin-right: 0.5rem;"></i>${new Date(dateStr).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div style="font-size: 0.875rem; color: #16a34a; margin-bottom: 0.5rem;">
                <i class="fa-regular fa-clock" style="margin-right: 0.5rem;"></i>${startHour} - ${endHour}
            </div>
            <div style="font-size: 0.75rem; color: #15803d; background-color: #dcfce7; border-radius: 0.25rem; padding: 0.25rem 0.5rem; display: inline-block;">
                <i class="fa-solid fa-users" style="margin-right: 0.25rem;"></i>${seats || 0} plazas disponibles
            </div>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <button style="width: 100%; padding: 0.75rem; background-color: #2563eb; color: white; border-radius: 0.5rem; font-weight: 500; transition: all 0.2s; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); display: flex; align-items: center; justify-content: center; gap: 0.5rem; border: none; cursor: pointer;"
                    onmouseenter="this.style.backgroundColor='#1d4ed8';"
                    onmouseleave="this.style.backgroundColor='#2563eb';">
                <i class="fa-solid fa-plus"></i>
                Crear Reserva
            </button>
            <button style="width: 100%; padding: 0.75rem; background-color: white; border: 1px solid #cbd5e1; color: #334155; border-radius: 0.5rem; font-weight: 500; transition: all 0.2s; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); display: flex; align-items: center; justify-content: center; gap: 0.5rem; cursor: pointer;"
                    onmouseenter="this.style.backgroundColor='#f1f5f9';"
                    onmouseleave="this.style.backgroundColor='white';">
                <i class="fa-solid fa-lock"></i>
                Bloquear Slot
            </button>
        </div>
    `;

    // Show sidebar
    if (sidebar && overlay) {
        sidebar.style.transform = 'translateX(0)';
        overlay.style.display = 'block';
        document.body.style.overflow = 'hidden';

        // Add Escape key listener
        window.sidebarEscapeHandler = function(e) {
            if (e.key === 'Escape') {
                closeSidebar();
            }
        };
        document.addEventListener('keydown', window.sidebarEscapeHandler);
    }
}

/**
 * Render details for a specific slot
 * @param {Object} slot - Slot object
 * @returns {string} HTML string
 */
export function renderSlotDetails(slot) {
    const startTime = new Date(slot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTime = new Date(slot.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = new Date(slot.start).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    let html = `
        <div style="background-color: #eff6ff; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem; border: 1px solid #bfdbfe;">
            <h4 style="font-weight: bold; color: #1e40af; font-size: 1.125rem; margin-bottom: 0.25rem; margin-top: 0;">${slot.title || 'Slot'}</h4>
            <div style="font-size: 0.875rem; color: #2563eb; margin-bottom: 0.5rem;">
                <i class="fa-regular fa-calendar" style="margin-right: 0.5rem;"></i>${date}
            </div>
            <div style="font-size: 0.875rem; color: #2563eb; margin-bottom: 0.5rem;">
                <i class="fa-regular fa-clock" style="margin-right: 0.5rem;"></i>${startTime} - ${endTime}
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 0.75rem; background-color: white; padding: 0.5rem; border-radius: 0.25rem; border: 1px solid #bfdbfe;">
                <span style="font-size: 0.75rem; font-weight: 500; color: #64748b; text-transform: uppercase;">Disponibilidad</span>
                <span style="font-weight: bold; color: #1d4ed8;">${slot.seats?.remaining || 0} / ${slot.seats?.total || 0}</span>
            </div>
        </div>
        
        <h4 style="font-weight: bold; color: #334155; margin-bottom: 0.75rem; display: flex; align-items: center; margin-top: 0;">
            <i class="fa-solid fa-users" style="margin-right: 0.5rem; color: #94a3b8;"></i>
            Reservas (${slot.appointments?.length || 0})
        </h4>
        
        <!-- Search Box -->
        <div style="margin-bottom: 0.75rem;">
            <div style="position: relative;">
                <div style="position: absolute; top: 0; bottom: 0; left: 0; padding-left: 0.75rem; display: flex; align-items: center; pointer-events: none;">
                    <i class="fa-solid fa-magnifying-glass" style="color: #94a3b8; font-size: 0.875rem;"></i>
                </div>
                <input type="text" 
                       id="reservation-search-${slot._id}" 
                       onkeyup="filterReservations('${slot._id}')"
                       placeholder="Buscar reservas..." 
                       style="display: block; width: 100%; padding-left: 2.5rem; padding-right: 0.75rem; padding-top: 0.5rem; padding-bottom: 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.5rem; font-size: 0.875rem; background-color: white; transition: all 0.2s;"
                       onfocus="this.style.outline='none'; this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 1px #3b82f6';"
                       onblur="this.style.borderColor='#cbd5e1'; this.style.boxShadow='none';">
            </div>
        </div>
        
        <!-- Reservas con scroll -->
        <div id="reservations-container-${slot._id}" style="background-color: white; border-radius: 0.5rem; border: 1px solid #e2e8f0; padding: 0.75rem; margin-bottom: 1rem; max-height: 500px; overflow-y: auto;">
    `;

    if (!slot.appointments || slot.appointments.length === 0) {
        html += `
            <div style="text-align: center; padding: 2rem 0; color: #94a3b8;">
                <i class="fa-regular fa-calendar-xmark" style="font-size: 1.875rem; margin-bottom: 0.5rem;"></i>
                <p style="margin: 0;">No hay reservas en este slot</p>
            </div>
        `;
    } else {
        html += '<div style="display: flex; flex-direction: column; gap: 0.75rem;">';
        slot.appointments.forEach((app, index) => {
            const statusColor = app.confirmed ? 'green' : 'orange';
            const statusText = app.confirmed ? 'Confirmada' : 'Pendiente';
            const reservationNumber = index + 1;
            const reservationDate = new Date(app.start || slot.start);
            const formattedDate = reservationDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const formattedTime = reservationDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            
            // Extract extra fields and ensure values are strings
            const extraFields = app.extra || {};
            const origin = typeof app.origin === 'string' ? app.origin : (app.origin?.name || app.origin?.title || 'web');

            const reservationId = `reservation-${app._id || index}`;
            const searchableText = `${app.user?.firstName || ''} ${app.user?.lastName || ''} ${app.user?.email || ''} ${app.user?.telephone || ''} ${origin}`.toLowerCase();
            html += `
                <div class="reservation-card" style="background-color: white; border-radius: 0.5rem; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); overflow: hidden;" data-search-text="${searchableText.replace(/"/g, '&quot;')}">
                    <!-- Top Section: Badges and Info -->
                    <div onclick="toggleReservation('${reservationId}')" style="background-color: rgba(239, 246, 255, 0.3); padding: 0.5rem 0.75rem; border-bottom: 1px solid #e2e8f0; cursor: pointer; transition: background-color 0.2s;"
                         onmouseenter="this.style.backgroundColor='rgba(239, 246, 255, 0.5)';"
                         onmouseleave="this.style.backgroundColor='rgba(239, 246, 255, 0.3)';">
                        <!-- First row: Badges -->
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <div style="width: 32px; height: 32px; border-radius: 50%; background-color: #dbeafe; color: #1d4ed8; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.875rem;">
                                    ${reservationNumber}
                                </div>
                                <span style="padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 500; ${app.confirmed ? 'background-color: #dcfce7; color: #15803d;' : 'background-color: #fed7aa; color: #c2410c;'}">
                                    ${statusText}
                                </span>
                                <span style="padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 500; background-color: #dbeafe; color: #1d4ed8; display: flex; align-items: center; gap: 0.25rem;">
                                    <i class="fa-solid fa-users" style="font-size: 0.75rem;"></i>
                                    ${app.seats || 1}
                                </span>
                            </div>
                            <i id="chevron-${reservationId}" class="fa-solid fa-chevron-down" style="color: #94a3b8; font-size: 0.75rem; transition: transform 0.2s;"></i>
                        </div>
                        <!-- Second row: Name and origin (always visible) -->
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <i class="fa-solid fa-user" style="color: #94a3b8; font-size: 0.75rem;"></i>
                                <h5 style="font-weight: 600; color: #1e293b; font-size: 0.875rem; margin: 0;">
                                    ${app.user?.firstName || 'Usuario'} ${app.user?.lastName || ''}
                                </h5>
                            </div>
                            <span style="padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 500; background-color: #f1f5f9; color: #334155;">
                                ${origin}
                            </span>
                        </div>
                    </div>
                    
                    <!-- Bottom Section: Details (Collapsed by default) -->
                    <div id="${reservationId}" style="display: none; padding: 0.75rem;">
                        
                        <!-- Info List -->
                        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.75rem; font-size: 0.75rem;">
                            <div>
                                <div style="font-weight: 500; color: #64748b; margin-bottom: 0.125rem;">Fecha de la reserva</div>
                                <div style="color: #334155;">${formattedDate} ${formattedTime}</div>
                            </div>
                            <div>
                                <div style="font-weight: 500; color: #64748b; margin-bottom: 0.125rem;">Nombre</div>
                                <div style="color: #334155;">${app.user?.firstName || '-'}</div>
                            </div>
                            <div>
                                <div style="font-weight: 500; color: #64748b; margin-bottom: 0.125rem;">Apellidos</div>
                                <div style="color: #334155;">${app.user?.lastName || '-'}</div>
                            </div>
                            <div>
                                <div style="font-weight: 500; color: #64748b; margin-bottom: 0.125rem;">Correo Electrónico</div>
                                <div style="color: #334155;">${app.user?.email || 'No email'}</div>
                            </div>
                            <div>
                                <div style="font-weight: 500; color: #64748b; margin-bottom: 0.125rem;">Teléfono</div>
                                <div style="color: #334155;">${app.user?.telephone || 'No teléfono'}</div>
                            </div>
                            ${Object.entries(extraFields).map(([key, value]) => {
                                // Convert value to string, handling objects
                                const displayValue = typeof value === 'object' && value !== null 
                                    ? (value.name || value.title || JSON.stringify(value))
                                    : String(value || '-');
                                return `
                            <div>
                                <div style="font-weight: 500; color: #64748b; margin-bottom: 0.125rem;">${key.charAt(0).toUpperCase() + key.slice(1)}</div>
                                <div style="color: #334155;">${displayValue}</div>
                            </div>
                            `;
                            }).join('')}
                        </div>
                    </div>
                    
                    <!-- Action Buttons (Always visible) -->
                    <div style="display: flex; flex-wrap: wrap; gap: 0.25rem; padding: 0.5rem; border-top: 1px solid #e2e8f0; background-color: rgba(248, 250, 252, 0.5);">
                        <button onclick="handleReservationInfo('${app._id}')" 
                                style="padding: 0.375rem; color: #475569; border: none; background: transparent; border-radius: 0.25rem; transition: all 0.2s; cursor: pointer;"
                                onmouseenter="this.style.color='#2563eb'; this.style.backgroundColor='#eff6ff';"
                                onmouseleave="this.style.color='#475569'; this.style.backgroundColor='transparent';"
                                title="Información">
                            <i class="fa-solid fa-info-circle" style="font-size: 0.75rem;"></i>
                        </button>
                        <button onclick="handleEditReservation('${app._id}')" 
                                style="padding: 0.375rem; color: #475569; border: none; background: transparent; border-radius: 0.25rem; transition: all 0.2s; cursor: pointer;"
                                onmouseenter="this.style.color='#2563eb'; this.style.backgroundColor='#eff6ff';"
                                onmouseleave="this.style.color='#475569'; this.style.backgroundColor='transparent';"
                                title="Editar reserva">
                            <i class="fa-solid fa-edit" style="font-size: 0.75rem;"></i>
                        </button>
                        <button onclick="handlePrintReservation('${app._id}')" 
                                style="padding: 0.375rem; color: #475569; border: none; background: transparent; border-radius: 0.25rem; transition: all 0.2s; cursor: pointer;"
                                onmouseenter="this.style.color='#2563eb'; this.style.backgroundColor='#eff6ff';"
                                onmouseleave="this.style.color='#475569'; this.style.backgroundColor='transparent';"
                                title="Imprimir la reserva">
                            <i class="fa-solid fa-print" style="font-size: 0.75rem;"></i>
                        </button>
                        <button onclick="handleReservationNotes('${app._id}')" 
                                style="padding: 0.375rem; color: #475569; border: none; background: transparent; border-radius: 0.25rem; transition: all 0.2s; cursor: pointer;"
                                onmouseenter="this.style.color='#ca8a04'; this.style.backgroundColor='#fef9c3';"
                                onmouseleave="this.style.color='#475569'; this.style.backgroundColor='transparent';"
                                title="Notas">
                            <i class="fa-solid fa-sticky-note" style="font-size: 0.75rem;"></i>
                        </button>
                        <button onclick="handleSendMessage('${app._id}')" 
                                style="padding: 0.375rem; color: #475569; border: none; background: transparent; border-radius: 0.25rem; transition: all 0.2s; cursor: pointer;"
                                onmouseenter="this.style.color='#2563eb'; this.style.backgroundColor='#eff6ff';"
                                onmouseleave="this.style.color='#475569'; this.style.backgroundColor='transparent';"
                                title="Enviar un mensaje">
                            <i class="fa-solid fa-comments" style="font-size: 0.75rem;"></i>
                        </button>
                        <button onclick="handleCancelReservation('${app._id}')" 
                                style="padding: 0.375rem; color: #475569; border: none; background: transparent; border-radius: 0.25rem; transition: all 0.2s; cursor: pointer; margin-left: auto;"
                                onmouseenter="this.style.color='#dc2626'; this.style.backgroundColor='#fee2e2';"
                                onmouseleave="this.style.color='#475569'; this.style.backgroundColor='transparent';"
                                title="Cancelar">
                            <i class="fa-solid fa-trash" style="font-size: 0.75rem;"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    html += `
        </div>
        
        <!-- Action Buttons -->
        <div style="display: flex; flex-direction: column; gap: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #e2e8f0;">
            <button onclick="handleReserveSlot('${slot._id}')" 
                    style="width: 100%; padding: 0.625rem; background-color: #2563eb; color: white; border-radius: 0.5rem; font-weight: 500; transition: all 0.2s; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); display: flex; align-items: center; justify-content: center; gap: 0.5rem; border: none; cursor: pointer;"
                    onmouseenter="this.style.backgroundColor='#1d4ed8';"
                    onmouseleave="this.style.backgroundColor='#2563eb';">
                <i class="fa-solid fa-plus"></i>
                Reservar
            </button>
            <button onclick="handleMoreInfo('${slot._id}')" 
                    style="width: 100%; padding: 0.625rem; background-color: white; border: 1px solid #cbd5e1; color: #334155; border-radius: 0.5rem; font-weight: 500; transition: all 0.2s; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); display: flex; align-items: center; justify-content: center; gap: 0.5rem; cursor: pointer;"
                    onmouseenter="this.style.backgroundColor='#f1f5f9';"
                    onmouseleave="this.style.backgroundColor='white';">
                <i class="fa-solid fa-info-circle"></i>
                Más info
            </button>
            <button onclick="handleDeleteSlot('${slot._id}')" 
                    style="width: 100%; padding: 0.625rem; background-color: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 0.5rem; font-weight: 500; transition: all 0.2s; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); display: flex; align-items: center; justify-content: center; gap: 0.5rem; cursor: pointer;"
                    onmouseenter="this.style.backgroundColor='#fee2e2';"
                    onmouseleave="this.style.backgroundColor='#fef2f2';">
                <i class="fa-solid fa-trash"></i>
                Eliminar
            </button>
        </div>
    `;

    return html;
}

// Expose functions globally for backward compatibility
window.openSlotDetails = openSlotDetails;
window.closeSidebar = closeSidebar;
window.renderSlotDetails = renderSlotDetails;
window.openEmptySlotDetails = openEmptySlotDetails;

