document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    const errorDiv = document.getElementById('error-msg');
    const contentDiv = document.getElementById('admin-content');

    try {
        // Petición
        const res = await fetch('/api/admin/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 403) {
            if(errorDiv) {
                errorDiv.classList.remove('hidden');
                errorDiv.innerText = "ACCESO DENEGADO: Requiere permisos de Admin.";
            }
            return;
        }

        if (res.ok) {
            const data = await res.json();
            if(errorDiv) errorDiv.classList.add('hidden');
            if(contentDiv) contentDiv.classList.remove('hidden');
            renderAdmin(data);
        }
    } catch (e) { console.error(e); }
});

function renderAdmin(data) {
    const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
    document.getElementById('total-users').innerText = data.totalUsers;
    document.getElementById('total-aum').innerText = fmt.format(data.totalAUM);

    const table = document.getElementById('users-table');
    table.innerHTML = '';
    data.users.forEach(u => {
        table.innerHTML += `
            <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
                <td class="p-4 text-slate-400">#${u.id}</td>
                <td class="p-4 font-bold">${u.email}</td>
                <td class="p-4 text-right">${fmt.format(u.balance)}</td>
                <td class="p-4 text-center"><span class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">Activo</span></td>
            </tr>
        `;
    });
}