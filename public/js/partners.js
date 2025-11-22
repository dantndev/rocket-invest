document.addEventListener('DOMContentLoaded', () => {
    const selector = document.getElementById('partner-selector');
    loadPartnerData(selector.value);
    selector.addEventListener('change', (e) => loadPartnerData(e.target.value));

    const form = document.getElementById('request-form');
    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button');
            btn.disabled = true; btn.innerText = "Enviando...";
            
            try {
                const res = await fetch('/api/partner/request', {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({
                        providerName: selector.value,
                        fundName: document.getElementById('req-name').value,
                        ticker: document.getElementById('req-ticker').value,
                        targetAmount: document.getElementById('req-target').value,
                        description: document.getElementById('req-desc').value
                    })
                });
                if(res.ok) { alert("Solicitud enviada."); window.closeRequestModal(); form.reset(); }
            } catch(e){ alert("Error"); }
            btn.disabled = false; btn.innerText = "Enviar Solicitud";
        });
    }
});

async function loadPartnerData(providerName) {
    try {
        const res = await fetch('/api/partner/stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ providerName })
        });
        if(res.ok) {
            const data = await res.json();
            renderDashboard(data);
        }
    } catch(e){ console.error(e); }
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
        tbody.innerHTML += `
        <tr class="hover:bg-slate-50">
            <td class="px-6 py-4"><p class="font-bold">${f.name}</p><p class="text-xs text-slate-400">Meta: ${fmt.format(f.target)}</p></td>
            <td class="px-6 py-4 text-right font-mono">${fmt.format(f.raised)}</td>
            <td class="px-6 py-4 text-center"><span class="text-xs font-bold text-indigo-600">${f.progress.toFixed(0)}%</span></td>
            <td class="px-6 py-4 text-right font-bold">${num.format(f.investors)}</td>
        </tr>`;
    });
}

window.openRequestModal = () => document.getElementById('request-modal').classList.remove('hidden');
window.closeRequestModal = () => document.getElementById('request-modal').classList.add('hidden');