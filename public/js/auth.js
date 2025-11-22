document.addEventListener('DOMContentLoaded', () => {
    
    // LOGIN
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const btn = document.getElementById('btn-login');
            
            btn.innerText = "Entrando...";
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
                    window.location.href = 'dashboard.html';
                } else {
                    alert(data.message);
                    btn.innerText = "Iniciar Sesión";
                    btn.disabled = false;
                }
            } catch (error) {
                alert("Error de conexión");
                btn.innerText = "Iniciar Sesión";
                btn.disabled = false;
            }
        });
    }

    // SIGNUP (NUEVO CON NOMBRES)
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-signup');
            btn.innerText = "Creando cuenta...";
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
                    alert("¡Cuenta creada! Inicia sesión.");
                    window.location.href = 'login.html';
                } else {
                    const err = await res.json();
                    alert(err.message);
                    btn.innerText = "Registrarme";
                    btn.disabled = false;
                }
            } catch (error) {
                alert("Error de conexión");
                btn.innerText = "Registrarme";
                btn.disabled = false;
            }
        });
    }
});