// Dashboard View - Renders the main dashboard with resources list

/**
 * Render the dashboard view
 * @param {Object} app - App instance
 * @returns {string} HTML string
 */
export function renderDashboardView(app) {
    const showUnpublished = document.getElementById('toggle-unpublished')?.checked || false;
    const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
    
    let html = `
        <!-- Page Header -->
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Cita previa y Reservas</h1>
            <p class="mt-2 text-lg text-slate-500 max-w-3xl">
                Gestiona las reservas y citas con el personal del ayuntamiento.
            </p>
        </div>

        <!-- Toolbar / Filters -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-8 flex flex-col xl:flex-row gap-4 justify-between items-center">
            <!-- Search -->
            <div class="flex flex-col sm:flex-row gap-4 w-full xl:w-auto flex-grow">
                <div class="relative w-full sm:w-72 xl:w-96">
                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <i class="fa-solid fa-magnifying-glass text-slate-400"></i>
                    </div>
                    <input type="text" id="search-input" onkeyup="app.renderCurrentView()"
                        class="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition"
                        placeholder="Busca grupos o recursos...">
                </div>

                <!-- Type Filters -->
                <div class="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                    <button onclick="app.setFilterType('all')" id="btn-filter-all"
                        class="filter-btn px-3 py-1.5 rounded-full text-xs font-medium bg-blue-600 text-white transition-colors border border-blue-600">
                        Todos
                    </button>
                    <button onclick="app.setFilterType('booking')" id="btn-filter-booking"
                        class="filter-btn px-3 py-1.5 rounded-full text-xs font-medium bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 transition-colors">
                        Reservas
                    </button>
                    <button onclick="app.setFilterType('bon')" id="btn-filter-bon"
                        class="filter-btn px-3 py-1.5 rounded-full text-xs font-medium bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 transition-colors">
                        Bonos
                    </button>
                    <button onclick="app.setFilterType('appointment')" id="btn-filter-appointment"
                        class="filter-btn px-3 py-1.5 rounded-full text-xs font-medium bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 transition-colors">
                        Citas
                    </button>
                </div>
            </div>

            <!-- Actions Toolbar -->
            <div class="flex flex-wrap items-center gap-3 justify-center xl:justify-end w-full xl:w-auto">
                <!-- Navigation Links -->
                <div class="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-200">
                    <a href="#/kiosko"
                        class="px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-white hover:shadow-sm transition-all whitespace-nowrap"
                        title="Kiosko">
                        <i class="fa-solid fa-ticket mr-1.5"></i> Kiosko
                    </a>
                    <a href="./citaprevia_web.html" target="_blank"
                        class="px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-white hover:shadow-sm transition-all whitespace-nowrap"
                        title="Web">
                        <i class="fa-solid fa-globe mr-1.5"></i> Web
                    </a>
                    <a href="#/tv"
                        class="px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-white hover:shadow-sm transition-all whitespace-nowrap"
                        title="TV">
                        <i class="fa-solid fa-tv mr-1.5"></i> TV
                    </a>
                    <a href="#/stats"
                        class="px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-white hover:shadow-sm transition-all whitespace-nowrap"
                        title="Estadísticas">
                        <i class="fa-solid fa-chart-bar mr-1.5"></i> Stats
                    </a>
                </div>

                <div class="h-8 w-px bg-slate-200 mx-1"></div>

                <!-- Toggle Unpublished -->
                <label
                    class="flex items-center cursor-pointer select-none bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                    title="Mostrar No Publicados">
                    <div class="relative">
                        <input type="checkbox" id="toggle-unpublished" class="sr-only peer"
                            onchange="app.renderCurrentView()">
                        <div
                            class="block bg-slate-300 w-8 h-5 rounded-full peer-checked:bg-blue-600 transition-colors">
                        </div>
                        <div
                            class="absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform peer-checked:translate-x-full">
                        </div>
                    </div>
                </label>

                <!-- Settings Button -->
                <button
                    class="bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 px-3 py-2 rounded-lg transition-all shadow-sm"
                    title="Ajustes">
                    <i class="fa-solid fa-gear"></i>
                </button>

                <!-- Add Button -->
                <button
                    class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm flex items-center transition-all hover:shadow-md">
                    <span>Añadir</span>
                    <i class="fa-solid fa-plus ml-2"></i>
                </button>
            </div>
        </div>

        <!-- Loading State -->
        <div id="loading-indicator" class="text-center py-12 hidden">
            <i class="fa-solid fa-circle-notch fa-spin text-4xl text-blue-600"></i>
            <p class="mt-4 text-slate-500">Cargando recursos...</p>
        </div>

        <!-- MASONRY GRID CONTAINER -->
        <div id="resources-grid" class="masonry-grid pb-12">
    `;

    // Render resources
    const sortedGroups = Object.keys(app.groupedData || {}).sort();
    
    sortedGroups.forEach(groupName => {
        let resources = app.groupedData[groupName] || [];

        // Filter by search, published status, and type
        resources = resources.filter(r => {
            const name = r.name || r.title || "";
            const matchesSearch = name.toLowerCase().includes(searchTerm) || groupName.toLowerCase().includes(searchTerm);
            const matchesPub = showUnpublished ? true : r.published;
            let matchesType = true;
            if (app.currentTypeFilter !== 'all') {
                matchesType = r.type === app.currentTypeFilter;
            }
            return matchesSearch && matchesPub && matchesType;
        });

        if (resources.length === 0) return;

        // Create group card
        html += `
            <div class="mb-6 break-inside-avoid bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow duration-300 fade-in">
                <div class="px-5 py-4 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                    <div>
                        <h3 class="text-lg font-bold text-slate-800 leading-tight uppercase">${groupName}</h3>
                        <span class="text-xs text-slate-400 font-medium">${resources.length} Recursos</span>
                    </div>
                    <div class="flex space-x-1">
                        <button class="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-md transition" title="Usuarios">
                            <i class="fa-solid fa-users"></i>
                        </button>
                        <button class="text-slate-400 hover:text-green-600 hover:bg-green-50 p-1.5 rounded-md transition" title="Editar">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                    </div>
                </div>
                <div class="divide-y divide-slate-100">
        `;

        resources.forEach(res => {
            const imgUrl = res.photo ? `${res.photo}?w=210&h=140&thumbnail=true` : 'https://via.placeholder.com/210x140?text=No+Image';
            const resName = res.name || res.title || "Sin nombre";

            html += `
                <div onclick="navigateToResource('${res._id}')" class="group px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-4">
                    <img src="${imgUrl}" class="w-16 h-12 object-cover rounded-lg shadow-sm group-hover:scale-105 transition-transform duration-300" alt="${resName}" onerror="this.src='https://via.placeholder.com/210x140?text=Error'">
                    <div class="flex-grow">
                        <h4 class="text-sm font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">${resName}</h4>
                        ${!res.published ? '<span class="text-xs text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-full border border-red-100">No Publicado</span>' : ''}
                    </div>
                    <i class="fa-solid fa-chevron-right text-slate-300 text-xs group-hover:text-blue-500 transition-colors"></i>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    html += `
        </div>
    `;

    return html;
}

