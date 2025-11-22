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
    
    // EFECTO DE CARGA SUAVE (SIN PARPADEO MOLESTO)
    dashboard.classList.add('opacity-50', 'pointer-events-none'); 

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
        // alert("No se pudieron cargar los datos del partner."); // Opcional: quitar alert si molesta
    } finally {
        // QUITAR EFECTO DE CARGA
        dashboard.classList.remove('opacity-50', 'pointer-events-none');
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

    if (data.funds.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-400">No hay fondos activos para este partner.</td></tr>';
        return;
    }

    data.funds.forEach(f => {
        const row = `
            <tr class="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-none">
                <td class="px-6 py-4">
                    <p class="font-bold text-slate-900">${f.name}</p>
                    <p class="text-xs text-slate-400">Meta: ${fmt.format(f.target)}</p>
                </td>
                <td class="px-6 py-4 text-right font-mono text-slate-600 text-sm">${fmt.format(f.raised)}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-2">
                        <div class="w-full bg-slate-100 rounded-full h-1.5">
                            <div class="bg-indigo-600 h-1.5 rounded-full transition-all duration-1000" style="width: ${f.progress}%"></div>
                        </div>
                        <span class="text-xs font-bold text-indigo-600 w-8 text-right">${f.progress.toFixed(0)}%</span>
                    </div>
                </td>
                <td class="px-6 py-4 text-right font-bold text-slate-900 text-sm">${num.format(f.investors)}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// Modales con animación suave
window.openRequestModal = function() {
    const modal = document.getElementById('request-modal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
        modal.querySelector('div').classList.add('scale-100');
    }, 10);
}

window.closeRequestModal = function() {
    const modal = document.getElementById('request-modal');
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.remove('scale-100');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 200);
}