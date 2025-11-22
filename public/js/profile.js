document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    const form = document.getElementById('kyc-form');
    const fileInput = document.getElementById('document');
    const fileNameDisplay = document.getElementById('file-name');
    const successDiv = document.getElementById('kyc-success');
    const statusText = document.getElementById('kyc-status-text');
    const badge = document.getElementById('kyc-badge');

    // 1. Cargar Estado
    try {
        const res = await fetch('/api/auth/profile', { headers: { 'Authorization': `Bearer ${token}` } });
        const user = await res.json();

        if (user.kyc_status === 'verified') {
            statusText.innerText = "Verificado"; statusText.className = "font-bold text-lg text-green-500";
            badge.className = "h-12 w-12 rounded-full bg-green-100 flex items-center justify-center";
            badge.innerHTML = '<span class="material-symbols-outlined text-green-500">verified</span>';
            form.classList.add('hidden'); successDiv.classList.remove('hidden');
            successDiv.querySelector('h3').innerText = "Cuenta Verificada";
        } else if (user.kyc_status === 'pending') {
            statusText.innerText = "En Revisión"; statusText.className = "font-bold text-lg text-orange-500";
            badge.className = "h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center";
            badge.innerHTML = '<span class="material-symbols-outlined text-orange-500">hourglass_top</span>';
            form.classList.add('hidden'); successDiv.classList.remove('hidden');
        } else {
            statusText.innerText = "No Verificado"; statusText.className = "font-bold text-lg text-red-500";
            badge.className = "h-12 w-12 rounded-full bg-red-100 flex items-center justify-center";
            badge.innerHTML = '<span class="material-symbols-outlined text-red-500">warning</span>';
        }
    } catch (e) { console.error(e); }

    // 2. Archivo
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            fileNameDisplay.innerText = e.target.files[0].name;
            fileNameDisplay.classList.remove('hidden');
        }
    });

    // 3. Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-submit-kyc');
        btn.disabled = true; btn.innerText = "Subiendo...";

        const formData = new FormData();
        formData.append('rfc', document.getElementById('rfc').value);
        formData.append('curp', document.getElementById('curp').value);
        formData.append('phone', document.getElementById('phone').value);
        formData.append('document', fileInput.files[0]);

        try {
            const res = await fetch('/api/kyc/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (res.ok) {
                form.classList.add('hidden');
                successDiv.classList.remove('hidden');
                statusText.innerText = "En Revisión";
                statusText.className = "font-bold text-lg text-orange-500";
                badge.innerHTML = '<span class="material-symbols-outlined text-orange-500">hourglass_top</span>';
            } else { alert("Error al subir."); btn.disabled = false; btn.innerText = "Reintentar"; }
        } catch (error) { alert("Error conexión."); btn.disabled = false; }
    });
});