document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    await loadProfileStatus(token);

    const form = document.getElementById('kyc-form');
    if(form) form.addEventListener('submit', e => submitKYC(e, token));
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
        } else { alert("Error"); btn.disabled=false; }
    } catch(e) { alert("Error"); btn.disabled=false; }
}

window.showKycForm = () => { document.getElementById('profile-menu').classList.add('hidden'); document.getElementById('kyc-section').classList.remove('hidden'); }
window.showProfileMenu = () => { document.getElementById('kyc-section').classList.add('hidden'); document.getElementById('profile-menu').classList.remove('hidden'); }