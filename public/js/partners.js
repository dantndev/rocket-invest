document.addEventListener('DOMContentLoaded', () => {
    const selector = document.getElementById('partner-selector');
    
    // Listener para cambio de partner
    selector.addEventListener('change', (e) => {
        // Si estamos en la vista de fondos, recargar
        if (!document.getElementById('section-funds').classList.contains('hidden')) {
            loadPartnerData(e.target.value);
        }
    });

    // Form
    const form = document.getElementById('request-form');
    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button');
            btn.disabled = true; btn.innerText = "Enviando...";
            // (Lógica de envío igual a la anterior)...
            setTimeout(() => {
                alert("Solicitud Enviada");
                btn.disabled=false; btn.innerText="Enviar Solicitud"; form.reset(); showMenu();
            }, 1000);
        });
    }
});

async function loadPartnerData(providerName) {
    const tbody = document.getElementById('funds-table-body');
    tbody.innerHTML = '<tr><td colspan="3" class="p-6 text-center text-slate-400">Cargando...</td></tr>';

    try {
        const res = await fetch('/api/partner/stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ providerName })
        });
        const data = await res.json();

        tbody.innerHTML = '';
        if (data.funds.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="p-6 text-center text-slate-400">No hay fondos activos.</td></tr>';
            return;
        }

        const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
        data.funds.forEach(f => {
            tbody.innerHTML += `
                <tr class="hover:bg-slate-50">
                    <td class="px-6 py-4 font-bold">${f.name}</td>
                    <td class="px-6 py-4 text-right font-mono text-slate-600">${fmt.format(f.raised)}</td>
                    <td class="px-6 py-4 text-center"><span class="text-indigo-600 font-bold text-xs">${f.progress.toFixed(0)}%</span></td>
                </tr>
            `;
        });
    } catch (e) { tbody.innerHTML = '<tr><td colspan="3" class="p-6 text-center text-red-400">Error.</td></tr>'; }
}

// Navegación
window.showSection = function(id) {
    document.getElementById('partner-menu').classList.add('hidden');
    document.getElementById('section-' + id).classList.remove('hidden');
    
    // Si abrimos fondos, cargar datos
    if (id === 'funds') {
        loadPartnerData(document.getElementById('partner-selector').value);
    }
}

window.showMenu = function() {
    document.querySelectorAll('[id^="section-"]').forEach(el => el.classList.add('hidden'));
    document.getElementById('partner-menu').classList.remove('hidden');
}