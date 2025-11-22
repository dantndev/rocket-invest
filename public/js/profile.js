// public/js/profile.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    await loadProfileStatus(token);

    const form = document.getElementById('kyc-form');
    if(form) form.addEventListener('submit', e => submitKYC(e, token));
    
    const fileIn = document.getElementById('document');
    if(fileIn) fileIn.addEventListener('change', e => { 
        if(e.target.files.length > 0) { 
            const nameEl = document.getElementById('file-name');
            nameEl.innerText = e.target.files[0].name; 
            nameEl.classList.remove('hidden'); 
        } 
    });
});

async function loadProfileStatus(token) {
    try {
        const res = await fetch('/api/auth/profile', { headers: { 'Authorization': `Bearer ${token}` } });
        const user = await res.json();
        const menuStatus = document.getElementById('menu-kyc-status');
        
        if(menuStatus) {
            menuStatus.innerText = user.kyc_status === 'verified' ? 'Verificado' : (user.kyc_status === 'pending' ? 'En Revisión' : 'Pendiente');
            menuStatus.className = user.kyc_status === 'verified' ? 'font-bold text-green-500' : 'font-bold text-orange-500';
        }
        
        // Actualizar vista interna
        const statusText = document.getElementById('kyc-status-text');
        const badge = document.getElementById('kyc-badge');
        const form = document.getElementById('kyc-form');
        const success = document.getElementById('kyc-success');

        if(statusText && badge) {
            if (user.kyc_status === 'verified') {
                statusText.innerText = "Verificado"; statusText.className = "font-bold text-xl text-green-500";
                badge.innerHTML = '<span class="material-symbols-outlined text-green-500 text-2xl">verified</span>';
                if(form) form.classList.add('hidden'); 
                if(success) { success.classList.remove('hidden'); success.querySelector('h3').innerText = "Cuenta Verificada"; success.querySelector('p').innerText = "Todo listo."; }
            } else if (user.kyc_status === 'pending') {
                statusText.innerText = "En Revisión"; statusText.className = "font-bold text-xl text-orange-500";
                badge.innerHTML = '<span class="material-symbols-outlined text-orange-500 text-2xl">hourglass_top</span>';
                if(form) form.classList.add('hidden'); 
                if(success) success.classList.remove('hidden');
            }
        }
    } catch (e) { console.error(e); }
}

async function submitKYC(e, token) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-kyc');
    btn.disabled = true; btn.innerText = "Subiendo...";
    
    const fd = new FormData();
    fd.append('rfc', document.getElementById('rfc').value);
    fd.append('curp', document.getElementById('curp').value);
    fd.append('phone', document.getElementById('phone').value);
    fd.append('document', document.getElementById('document').files[0]);

    try {
        const res = await fetch('/api/kyc/upload', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
        if(res.ok) { 
            document.getElementById('kyc-form').classList.add('hidden');
            document.getElementById('kyc-success').classList.remove('hidden');
            loadProfileStatus(token);
        } else { alert("Error al subir"); btn.disabled=false; btn.innerText="Reintentar"; }
    } catch(e) { alert("Error"); btn.disabled=false; }
}

window.showKycForm = () => { document.getElementById('profile-menu').classList.add('hidden'); document.getElementById('kyc-section').classList.remove('hidden'); }
window.showProfileMenu = () => { document.getElementById('kyc-section').classList.add('hidden'); document.getElementById('profile-menu').classList.remove('hidden'); }