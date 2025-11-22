document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    try {
        // Carga de datos "silenciosa" al inicio
        const res = await fetch('/api/admin/stats?t=' + Date.now(), { headers: { 'Authorization': `Bearer ${token}` } });
        
        if (res.status === 403) {
            document.getElementById('admin-menu').innerHTML = '';
            const err = document.getElementById('error-msg');
            err.innerText = "⛔ ACCESO DENEGADO: No tienes permisos de Administrador.";
            err.classList.remove('hidden');
            return;
        }

        if (res.ok) {
            const data = await res.json();
            populateAdmin(data);
        }
    } catch (e) { console.error(e); }
});

function populateAdmin(data) {
    const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

    // Llenar contadores del menú
    document.getElementById('count-users').innerText = data.totalUsers;
    
    // Llenar Sección Finanzas
    document.getElementById('total-aum-display').innerText = fmt.format(data.totalAUM);

    // Llenar Tabla Usuarios
    const table = document.getElementById('users-table');
    table.innerHTML = '';
    data.users.forEach(u => {
        table.innerHTML += `
            <tr class="hover:bg-slate-700/50 transition-colors">
                <td class="p-4 font-mono text-slate-500">#${u.id}</td>
                <td class="p-4">
                    <div class="font-bold text-white">${u.first_name || 'Sin Nombre'} ${u.last_name || ''}</div>
                    <div class="text-xs text-slate-400">${u.email}</div>
                </td>
                <td class="p-4 text-right font-mono text-emerald-400">${fmt.format(u.balance)}</td>
                <td class="p-4 text-center"><span class="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Activo</span></td>
            </tr>
        `;
    });
}

// Navegación
window.showSection = function(id) {
    document.getElementById('admin-menu').classList.add('hidden');
    document.getElementById('section-' + id).classList.remove('hidden');
}

window.showMenu = function() {
    document.querySelectorAll('[id^="section-"]').forEach(el => el.classList.add('hidden'));
    document.getElementById('admin-menu').classList.remove('hidden');
}