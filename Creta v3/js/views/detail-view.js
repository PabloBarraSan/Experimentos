// Detail View - Renders the resource detail view with action cards

/**
 * Render the detail view for a resource
 * @param {Object} resource - Resource object
 * @returns {string} HTML string
 */
export function renderDetailView(resource) {
    const resourceName = resource.name || resource.title || "Recurso";
    const groupName = resource.subtitle || "Grupo";

    return `
        <!-- Action Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div class="flex items-center gap-4">
                <!-- Botón Volver -->
                <button onclick="navigateTo('/')"
                    class="group flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-all"
                    title="Volver al listado">
                    <i class="fa-solid fa-arrow-left group-hover:-translate-x-1 transition-transform"></i>
                </button>
                <div>
                    <div class="text-xs font-bold text-blue-600 uppercase tracking-wide">${groupName}</div>
                    <h1 class="text-3xl font-bold text-slate-900 leading-none">${resourceName}</h1>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button
                    class="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors font-medium text-sm">
                    <i class="fa-solid fa-circle-question text-blue-500"></i>
                    <span>Ayuda</span>
                </button>
            </div>
        </div>

        <!-- DETAIL DASHBOARD GRID (Tarjetas de acción) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            <!-- Card: Sala d'espera -->
            <a href="#"
                class="group bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center sm:items-start sm:text-left h-full">
                <div class="h-14 w-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <i class="fa-solid fa-user text-2xl"></i>
                </div>
                <h3 class="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors mb-2">Sala d'espera</h3>
                <p class="text-sm text-slate-500 leading-relaxed">Pantalla d'espera on es mostren els torns atenent-se o per atendre</p>
            </a>

            <!-- Card: Administrador de torns -->
            <a href="#"
                class="group bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center sm:items-start sm:text-left h-full">
                <div class="h-14 w-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <i class="fa-solid fa-key text-2xl"></i>
                </div>
                <h3 class="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors mb-2">Administrador de torns</h3>
                <p class="text-sm text-slate-500 leading-relaxed">Pantalla per al funcionari, gestiona les reserves i aten les cites</p>
            </a>

            <!-- Card: Sol·licitud de torns -->
            <a href="#"
                class="group bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center sm:items-start sm:text-left h-full">
                <div class="h-14 w-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <i class="fa-solid fa-ticket text-2xl"></i>
                </div>
                <h3 class="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors mb-2">Sol·licitud de torns</h3>
                <p class="text-sm text-slate-500 leading-relaxed">Pantalla per al kiosk, torna sempre la cita més próxima</p>
            </a>

            <!-- Card: Solicitud de turnos 2 -->
            <a href="#"
                class="group bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center sm:items-start sm:text-left h-full">
                <div class="h-14 w-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <i class="fa-solid fa-ticket-simple text-2xl"></i>
                </div>
                <h3 class="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors mb-2">Solicitud de turnos 2</h3>
                <p class="text-sm text-slate-500 leading-relaxed">Pantalla per al kiosk, es possible seleccionar el dia</p>
            </a>

            <!-- Card: Calendari -->
            <a href="#"
                class="group bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center sm:items-start sm:text-left h-full">
                <div class="h-14 w-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <i class="fa-solid fa-calendar-days text-2xl"></i>
                </div>
                <h3 class="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors mb-2">Calendari</h3>
                <p class="text-sm text-slate-500 leading-relaxed">Calendari on es mostren les cites o es gestionen els horaris</p>
            </a>

            <!-- Card: Panell de comandaments -->
            <a href="#"
                class="group bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center sm:items-start sm:text-left h-full">
                <div class="h-14 w-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <i class="fa-solid fa-table-columns text-2xl"></i>
                </div>
                <h3 class="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors mb-2">Panell de comandaments</h3>
                <p class="text-sm text-slate-500 leading-relaxed">Mostra totes les cites i el seu estat</p>
            </a>

            <!-- Card: Administració -->
            <div onclick="if(app.currentResource && app.currentResource._id) { navigateToResource(app.currentResource._id, 'admin'); }"
                class="group bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center sm:items-start sm:text-left h-full cursor-pointer">
                <div class="h-14 w-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <i class="fa-solid fa-pen-to-square text-2xl"></i>
                </div>
                <h3 class="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors mb-2">Administració</h3>
                <p class="text-sm text-slate-500 leading-relaxed">Administra els ajustos, imprimeix reserves, cerca cites...</p>
            </div>

            <!-- Card: Selecció -->
            <a href="#/"
                class="group bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center sm:items-start sm:text-left h-full">
                <div class="h-14 w-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <i class="fa-solid fa-arrow-pointer text-2xl"></i>
                </div>
                <h3 class="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors mb-2">Selecció</h3>
                <p class="text-sm text-slate-500 leading-relaxed">Torna al menú on es mostren tots els recursos</p>
            </a>

            <!-- Card: Lector de QR -->
            <a href="#"
                class="group bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center sm:items-start sm:text-left h-full">
                <div class="h-14 w-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <i class="fa-solid fa-qrcode text-2xl"></i>
                </div>
                <h3 class="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors mb-2">Lector de QR</h3>
                <p class="text-sm text-slate-500 leading-relaxed">Lector de QR, para confirmar la llegada de la persona al centro o comprobar saldo del bono</p>
            </a>

            <!-- Card: Citaprevia web -->
            <a href="#"
                class="group bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center sm:items-start sm:text-left h-full">
                <div class="h-14 w-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <i class="fa-solid fa-globe text-2xl"></i>
                </div>
                <h3 class="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors mb-2">Citaprevia web</h3>
                <p class="text-sm text-slate-500 leading-relaxed">Pàgina web oberta al públic de la cita prèvia</p>
            </a>

            <!-- Card: App mòbil -->
            <a href="#"
                class="group bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center sm:items-start sm:text-left h-full">
                <div class="h-14 w-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <i class="fa-solid fa-mobile-screen text-2xl"></i>
                </div>
                <h3 class="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors mb-2">App mòbil</h3>
                <p class="text-sm text-slate-500 leading-relaxed">Aplicació mòvil de la cita prèvia</p>
            </a>
        </div>
    `;
}

