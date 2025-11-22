document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    
    // 1. Validación de Sesión
    if (!token) { 
        window.location.href = '/login.html'; 
        return; 
    }

    // Referencias UI
    const msgDiv = document.getElementById('error-msg');
    const contentDiv = document.getElementById('admin-content');
    
    // Mostrar indicador de carga
    if(msgDiv) msgDiv.classList.remove('hidden');

    try {
        // 2. Petición al Backend
        const res = await fetch('/api/admin/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // 3. Manejo de Permisos
        if (res.status === 403) {
            if(msgDiv) {
                msgDiv.className = "mb-6 p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-center gap-3";
                msgDiv.innerHTML = `
                    <span class="material-symbols-outlined">lock</span>
                    <span class="font-bold text-sm">Acceso Denegado: Solo el administrador puede ver esto.</span>
                `;
            }
            return;
        }

        if (!res.ok) throw new Error("Error interno");

        // 4. Renderizado
        const data = await res.json();
        
        if(msgDiv) msgDiv.classList.add('hidden'); // Ocultar carga
        if(contentDiv) contentDiv.classList.remove('hidden'); // Mostrar dashboard

        renderAdmin(data);

    } catch (e) {
        console.error(e);
        if(msgDiv) {
            msgDiv.className = "mb-6 p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-center gap-3";
            msgDiv.innerHTML = `<span class="material-symbols-outlined">wifi_off</span><span class="font-bold text-sm">Error de conexión: ${e.message}</span>`;
        }
    }
});

function renderAdmin(data) {
    const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

    // KPIs
    document.getElementById('total-users').innerText = data.totalUsers;
    document.getElementById('total-aum').innerText = fmt.format(data.totalAUM);

    // Tabla
    const table = document.getElementById('users-table');
    table.innerHTML = '';

    data.users.forEach(u => {
        const row = `
            <tr class="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                <td class="p-4 font-mono text-xs text-slate-400">#${u.id}</td>
                <td class="p-4">
                    <div class="font-bold text-slate-900 dark:text-white text-sm">${u.email}</div>
                </td>
                <td class="p-4 text-right font-mono text-sm font-bold text-slate-700 dark:text-slate-300">
                    ${fmt.format(u.balance)}
                </td>
                <td class="p-4 text-center">
                    <span class="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">ACTIVO</span>
                </td>
                <td class="p-4 text-right">
                    <button class="text-slate-400 hover:text-primary transition-colors">
                        <span class="material-symbols-outlined text-lg">more_vert</span>
                    </button>
                </td>
            </tr>
        `;
        table.innerHTML += row;
    });
}