document.addEventListener('DOMContentLoaded', () => {
    const selector = document.getElementById('partner-selector');
    
    // Cargar datos iniciales
    loadPartnerData(selector.value);

    // Listener de cambio de partner
    selector.addEventListener('change', (e) => {
        loadPartnerData(e.target.value);
    });

    // Formulario Solicitud
    const form = document.getElementById('request-form');
    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button');
            const originalText = btn.innerText;
            btn.disabled = true;
            btn.innerText = "Enviando...";

            const data = {
                providerName: selector.value,
                fundName: document.getElementById('req-name').value,
                ticker: document.getElementById('req-ticker').value,
                targetAmount: document.getElementById('req-target').value,
                description: document.getElementById('req-desc').value
            };

            try {
                const res = await fetch('/api/partner/request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (res.ok) {
                    alert("Solicitud enviada correctamente. El equipo de administración la revisará.");
                    closeRequestModal();
                    form.reset();
                } else {
                    alert("Error al enviar solicitud.");
                }
            } catch (err) {
                console.error(err);
                alert("Error de conexión.");
            } finally {
                btn.disabled = false;
                btn.innerText = originalText;
            }
        });
    }
});

async function loadPartnerData(providerName) {
    const dashboard = document.getElementById('partner-dashboard');
    dashboard.classList.add('animate-pulse', 'opacity-50');

    try {
        const res = await fetch('/api/partner/stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ providerName })
        });

        if (!res.ok) throw new Error("Error cargando datos");
        const data = await res.json();

        renderDashboard(data);

    } catch (error) {
        console.error(error);
        alert("No se pudieron cargar los datos del partner.");
    } finally {
        dashboard.classList.remove('animate-pulse', 'opacity-50');
    }
}

function renderDashboard(data) {
    const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
    const num = new Intl.NumberFormat('es-MX');

    document.getElementById('total-raised').innerText = fmt.format(data.totalRaised);
    document.getElementById('total-investors').innerText = num.format(data.totalInvestors);
    document.getElementById('active-funds').innerText = data.activeFunds;

    const tbody = document.getElementById('funds-table-body');
    tbody.innerHTML = '';

    data.funds.forEach(f => {
        const row = `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-6 py-4">
                    <p class="font-bold text-slate-900">${f.name}</p>
                    <p class="text-xs text-slate-400">Meta: ${fmt.format(f.target)}</p>
                </td>
                <td class="px-6 py-4 text-right font-mono text-slate-600">${fmt.format(f.raised)}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-2">
                        <div class="w-full bg-slate-100 rounded-full h-1.5">
                            <div class="bg-indigo-600 h-1.5 rounded-full" style="width: ${f.progress}%"></div>
                        </div>
                        <span class="text-xs font-bold text-indigo-600">${f.progress.toFixed(0)}%</span>
                    </div>
                </td>
                <td class="px-6 py-4 text-right font-bold text-slate-900">${num.format(f.investors)}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// Modales
window.openRequestModal = function() {
    document.getElementById('request-modal').classList.remove('hidden');
}
window.closeRequestModal = function() {
    document.getElementById('request-modal').classList.add('hidden');
}