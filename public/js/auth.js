document.addEventListener('DOMContentLoaded', () => {
    
    // --- LÓGICA DE LOGIN ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const btn = document.getElementById('btn-login');
            
            btn.innerText = "Verificando...";
            btn.disabled = true;

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();

                if (res.ok) {
                    localStorage.setItem('token', data.token);
                    // Pequeño delay para feedback visual
                    btn.innerText = "¡Éxito!";
                    btn.classList.replace('bg-primary', 'bg-green-500');
                    setTimeout(() => window.location.href = 'dashboard.html', 500);
                } else {
                    alert(data.message || "Credenciales incorrectas");
                    btn.innerText = "Iniciar Sesión";
                    btn.disabled = false;
                }
            } catch (error) {
                console.error(error);
                alert("Error de conexión con el servidor");
                btn.innerText = "Iniciar Sesión";
                btn.disabled = false;
            }
        });
    }

    // --- LÓGICA DE REGISTRO ---
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-signup');
            const originalText = btn.innerHTML;
            
            btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">sync</span> Creando cuenta...';
            btn.disabled = true;

            const data = {
                first_name: document.getElementById('first_name').value,
                last_name: document.getElementById('last_name').value,
                email: document.getElementById('email').value,
                password: document.getElementById('password').value
            };

            try {
                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (res.ok) {
                    // Éxito: Mostrar Modal
                    const modal = document.getElementById('success-modal');
                    if (modal) {
                        modal.classList.remove('hidden');
                    } else {
                        // Fallback
                        alert("¡Cuenta creada! Inicia sesión.");
                        window.location.href = 'login.html';
                    }
                } else {
                    const err = await res.json();
                    alert(err.message || "Error al registrar");
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            } catch (error) {
                console.error(error);
                alert("Error de conexión con el servidor");
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }
});