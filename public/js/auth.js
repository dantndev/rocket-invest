// public/js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. VERIFICAR ESTADO DE SESIÓN EN EL UI (Para index.html) ---
    const token = localStorage.getItem('token');
    const authButtons = document.getElementById('auth-buttons'); // Div con botones Login/Signup
    const userProfile = document.getElementById('user-profile'); // Div con "Hola Inversor"
    const logoutBtn = document.getElementById('logout-btn');     // Botón de salir

    // Solo ejecutamos esto si los elementos existen (es decir, si estamos en index.html)
    if (authButtons && userProfile) {
        if (token) {
            // CASO: USUARIO LOGUEADO
            // Ocultamos botones de registro
            authButtons.classList.add('hidden');
            authButtons.classList.remove('flex');
            
            // Mostramos perfil y acceso al dashboard
            userProfile.classList.remove('hidden');
            userProfile.classList.add('flex');
        } else {
            // CASO: VISITANTE (NO LOGUEADO)
            // Mostramos botones de registro
            authButtons.classList.remove('hidden');
            authButtons.classList.add('flex');
            
            // Ocultamos perfil
            userProfile.classList.add('hidden');
            userProfile.classList.remove('flex');
        }
    }

    // --- 2. LÓGICA DE LOGOUT (CERRAR SESIÓN) ---
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            // 1. Borrar la "llave"
            localStorage.removeItem('token');
            // 2. Recargar la página para que vuelva a verse como visitante
            window.location.reload(); 
        });
    }

    // --- 3. LÓGICA DE FORMULARIOS (LOGIN Y REGISTRO) ---
    const loginForm = document.querySelector('form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    // Detectar en qué página estamos para saber a dónde enviar los datos
    const isLoginPage = window.location.pathname.includes('login.html');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = emailInput.value;
            const password = passwordInput.value;
            // Define la ruta correcta
            const endpoint = isLoginPage ? '/api/auth/login' : '/api/auth/register';

            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    if (isLoginPage) {
                        // LOGIN EXITOSO:
                        // 1. Guardar token
                        localStorage.setItem('token', data.token);
                        alert('¡Bienvenido! Entrando a la App...');
                        // 2. REDIRECCIÓN A LA APP (DASHBOARD)
                        window.location.href = '/dashboard.html'; 
                    } else {
                        // REGISTRO EXITOSO:
                        alert('Registro exitoso. Ya tienes tus $50,000 iniciales. Por favor inicia sesión.');
                        window.location.href = '/login.html';
                    }
                } else {
                    alert('Error: ' + data.message);
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error de conexión con el servidor');
            }
        });
    }
});