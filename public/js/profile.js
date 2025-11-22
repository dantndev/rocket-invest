document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    // Cargar estado inicial
    await loadProfileStatus(token);

    // Listeners archivo y form
    const fileIn = document.getElementById('document');
    if(fileIn) fileIn.addEventListener('change', e => { if(e.target.files.length>0) { document.getElementById('file-name').innerText=e.target.files[0].name; document.getElementById('file-name').classList.remove('hidden'); } });

    const form = document.getElementById('kyc-form');
    if(form) form.addEventListener('submit', e => submitKYC(e, token));
});

async function loadProfileStatus(token) {
    try {
        const res = await fetch('/api/auth/profile', { headers: { 'Authorization': `Bearer ${token}` } });
        const user = await res.json();

        const statusText = document.getElementById('kyc-status-text');
        const badge = document.getElementById('kyc-badge');
        const form = document.getElementById('kyc-form');
        const success = document.getElementById('kyc-success');
        const menuStatus = document.getElementById('menu-kyc-status');

        // Actualizar etiqueta del menú
        if(menuStatus) {
            menuStatus.innerText = user.kyc_status === 'verified' ? 'Verificado' : (user.kyc_status === 'pending' ? 'En Revisión' : 'Pendiente');
            menuStatus.className = user.kyc_status === 'verified' ? 'text-xs font-bold uppercase text-green-500' : 'text-xs font-bold uppercase text-orange-500';
        }

        // Actualizar formulario interno
        if (user.kyc_status === 'verified') {
            statusText.innerText = "Verificado"; statusText.className = "font-bold text-xl text-green-500";
            badge.innerHTML = '<span class="material-symbols-outlined text-green-500 text-2xl">verified</span>'; badge.className = "h-14 w-14 rounded-full bg-green-100 flex items-center justify-center";
            form.classList.add('hidden'); success.classList.remove('hidden'); success.querySelector('h3').innerText = "Cuenta Verificada"; success.querySelector('p').innerText = "Todo listo.";
        } else if (user.kyc_status === 'pending') {
            statusText.innerText = "En Revisión"; statusText.className = "font-bold text-xl text-orange-500";
            badge.innerHTML = '<span class="material-symbols-outlined text-orange-500 text-2xl">hourglass_top</span>'; badge.className = "h-14 w-14 rounded-full bg-orange-100 flex items-center justify-center";
            form.classList.add('hidden'); success.classList.remove('hidden');
        } else {
            statusText.innerText = "No Verificado"; statusText.className = "font-bold text-xl text-red-500";
            badge.innerHTML = '<span class="material-symbols-outlined text-red-500 text-2xl">warning</span>'; badge.className = "h-14 w-14 rounded-full bg-red-100 flex items-center justify-center";
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
        if(res.ok) { loadProfileStatus(token); } 
        else { alert("Error al subir"); btn.disabled=false; btn.innerText="Reintentar"; }
    } catch(e) { alert("Error conexión"); btn.disabled=false; }
}

// Funciones de navegación del Perfil (Show/Hide)
window.showKycForm = function() {
    document.getElementById('profile-menu').classList.add('hidden');
    document.getElementById('kyc-section').classList.remove('hidden');
}
window.showProfileMenu = function() {
    document.getElementById('kyc-section').classList.add('hidden');
    document.getElementById('profile-menu').classList.remove('hidden');
}