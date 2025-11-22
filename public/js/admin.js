document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    try {
        const res = await fetch('/api/admin/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 403) {
            document.getElementById('error-msg').classList.remove('hidden');
            return;
        }

        if (res.ok) {
            const data = await res.json();
            renderAdmin(data);
        }
    } catch (e) {
        console.error(e);
        alert("Error de conexión");
    }
});

function renderAdmin(data) {
    document.getElementById('admin-content').classList.remove('hidden');
    
    const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

    document.getElementById('total-users').innerText = data.totalUsers;
    document.getElementById('total-aum').innerText = fmt.format(data.totalAUM);

    const table = document.getElementById('users-table');
    table.innerHTML = '';

    data.users.forEach(u => {
        const row = `
            <tr class="hover:bg-green-900/10 transition-colors">
                <td class="p-4 font-mono text-gray-400">#${u.id}</td>
                <td class="p-4 font-bold">${u.email}</td>
                <td class="p-4 text-right font-mono">${fmt.format(u.balance)}</td>
                <td class="p-4 text-center"><span class="px-2 py-1 bg-green-900/50 text-green-300 text-xs rounded">ACTIVO</span></td>
            </tr>
        `;
        table.innerHTML += row;
    });
}