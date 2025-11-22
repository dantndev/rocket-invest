// public/js/admin.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    
    // 1. Validación de Sesión
    if (!token) { 
        window.location.href = '/login.html'; 
        return; 
    }

    // Mostrar indicador de carga
    const errorDiv = document.getElementById('error-msg');
    const contentDiv = document.getElementById('admin-content');
    
    // Limpiar estado previo
    if(errorDiv) {
        errorDiv.innerText = "Cargando datos del sistema...";
        errorDiv.classList.remove('hidden', 'text-red-500', 'border-red-500', 'bg-red-900/20');
        errorDiv.classList.add('text-blue-400', 'border-blue-500', 'bg-blue-900/20', 'animate-pulse');
    }

    try {
        // 2. Petición al Backend
        const res = await fetch('/api/admin/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // 3. Manejo de Errores de Permisos (403)
        if (res.status === 403) {
            if(errorDiv) {
                errorDiv.innerText = "⛔ ACCESO DENEGADO: Debes iniciar sesión como admin@rocket.com";
                errorDiv.classList.replace('text-blue-400', 'text-red-500');
                errorDiv.classList.replace('border-blue-500', 'border-red-500');
                errorDiv.classList.replace('bg-blue-900/20', 'bg-red-900/20');
                errorDiv.classList.remove('animate-pulse');
            }
            return;
        }

        if (!res.ok) throw new Error("Error en el servidor");

        // 4. Renderizado de Datos (Éxito)
        const data = await res.json();
        
        if(errorDiv) errorDiv.classList.add('hidden'); // Ocultar carga
        if(contentDiv) contentDiv.classList.remove('hidden'); // Mostrar dashboard

        renderAdmin(data);

    } catch (e) {
        console.error(e);
        if(errorDiv) {
            errorDiv.innerText = "❌ Error de conexión: " + e.message;
            errorDiv.classList.replace('text-blue-400', 'text-red-500');
            errorDiv.classList.remove('animate-pulse');
        }
    }
});

function renderAdmin(data) {
    const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

    const elUsers = document.getElementById('total-users');
    const elAum = document.getElementById('total-aum');
    const table = document.getElementById('users-table');

    if(elUsers) elUsers.innerText = data.totalUsers;
    if(elAum) elAum.innerText = fmt.format(data.totalAUM);

    if(table) {
        table.innerHTML = '';
        data.users.forEach(u => {
            const row = `
                <tr class="hover:bg-green-900/10 transition-colors font-mono text-xs">
                    <td class="p-4 text-gray-400">#${u.id}</td>
                    <td class="p-4 text-white">${u.email}</td>
                    <td class="p-4 text-right text-green-400">${fmt.format(u.balance)}</td>
                    <td class="p-4 text-center"><span class="px-2 py-1 bg-green-900/50 text-green-300 rounded-full text-[10px]">ACTIVO</span></td>
                </tr>
            `;
            table.innerHTML += row;
        });
    }
}