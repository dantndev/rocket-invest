// public/js/admin.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    const errorDiv = document.getElementById('error-msg');
    const contentDiv = document.getElementById('admin-content');
    if(errorDiv) { errorDiv.innerText="Cargando..."; errorDiv.classList.remove('hidden'); }

    try {
        // FIX: Agregamos timestamp para evitar caché
        const res = await fetch('/api/admin/stats?t=' + Date.now(), {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 403) {
            if(errorDiv) errorDiv.innerText = "⛔ ACCESO DENEGADO (Solo Admin)";
            return;
        }

        if (res.ok) {
            const data = await res.json();
            if(errorDiv) errorDiv.classList.add('hidden');
            if(contentDiv) contentDiv.classList.remove('hidden');
            renderAdmin(data);
        }
    } catch (e) { console.error(e); if(errorDiv) errorDiv.innerText="Error de conexión"; }
});

function renderAdmin(data) {
    const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
    document.getElementById('total-users').innerText = data.totalUsers;
    document.getElementById('total-aum').innerText = fmt.format(data.totalAUM);

    const table = document.getElementById('users-table');
    table.innerHTML = '';
    data.users.forEach(u => {
        table.innerHTML += `
            <tr class="hover:bg-slate-50 dark:hover:bg-white/5 border-b border-slate-100 dark:border-slate-800">
                <td class="p-4 text-xs text-slate-400 font-mono">#${u.id}</td>
                <td class="p-4 font-bold text-slate-800 dark:text-white">${u.email}</td>
                <td class="p-4 text-right font-mono text-emerald-600 dark:text-emerald-400">${fmt.format(u.balance)}</td>
                <td class="p-4 text-center"><span class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">ACTIVO</span></td>
            </tr>
        `;
    });
}