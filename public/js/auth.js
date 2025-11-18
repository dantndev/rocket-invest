// public/js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. VERIFICAR ESTADO DE SESIÓN EN EL UI ---
    const token = localStorage.getItem('token');
    
    // Referencias Desktop
    const authButtons = document.getElementById('auth-buttons');
    const userProfile = document.getElementById('user-profile');
    
    // Referencias Mobile (NUEVAS)
    const mobileAuthButtons = document.getElementById('mobile-auth-buttons');
    const mobileUserProfile = document.getElementById('mobile-user-profile');
    
    // Botones de Logout
    const logoutBtn = document.getElementById('logout-btn');
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');

    // Función para manejar el Logout
    const handleLogout = () => {
        localStorage.removeItem('token');
        window.location.reload(); // Recargar para limpiar estado
    };

    // Si estamos en una página que tiene estos elementos (index.html)
    if (authButtons) {
        if (token) {
            // --- USUARIO LOGUEADO ---
            // Desktop: Ocultar Login, Mostrar Perfil
            authButtons.classList.add('hidden');
            authButtons.classList.remove('flex');
            userProfile.classList.remove('hidden');
            userProfile.classList.add('flex');
            
            // Mobile: Ocultar Login, Mostrar Perfil
            if(mobileAuthButtons) {
                mobileAuthButtons.classList.add('hidden');
                mobileAuthButtons.classList.remove('flex');
                mobileUserProfile.classList.remove('hidden');
                mobileUserProfile.classList.add('flex');
            }
        } else {
            // --- VISITANTE ---
            // Desktop: Mostrar Login, Ocultar Perfil
            authButtons.classList.remove('hidden');
            authButtons.classList.add('flex');
            userProfile.classList.add('hidden');
            userProfile.classList.remove('flex');
            
            // Mobile: Mostrar Login, Ocultar Perfil
            if(mobileAuthButtons) {
                mobileAuthButtons.classList.remove('hidden');
                mobileAuthButtons.classList.add('flex');
                mobileUserProfile.classList.add('hidden');
                mobileUserProfile.classList.remove('flex');
            }
        }
    }

    // --- 2. LISTENERS DE LOGOUT ---
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', handleLogout);

    // --- 3. LÓGICA DE FORMULARIOS (LOGIN Y REGISTRO) ---
    const loginForm = document.querySelector('form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    // Detectar en qué página estamos
    const isLoginPage = window.location.pathname.includes('login.html');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = emailInput.value;
            const password = passwordInput.value;
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
                        // LOGIN EXITOSO
                        localStorage.setItem('token', data.token);
                        alert('¡Bienvenido! Entrando a la App...');
                        window.location.href = '/dashboard.html'; 
                    } else {
                        // REGISTRO EXITOSO
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