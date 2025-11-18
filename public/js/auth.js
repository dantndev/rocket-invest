// public/js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. VERIFICAR ESTADO DE SESIÓN EN EL UI (Para index.html) ---
    const token = localStorage.getItem('token');
    const authButtons = document.getElementById('auth-buttons'); // Div con botones Login/Signup
    const userProfile = document.getElementById('user-profile'); // Div con "Hola Inversor"
    const logoutBtn = document.getElementById('logout-btn');     // Botón de salir

    // Referencias Mobile (NUEVAS)
    const mobileAuthButtons = document.getElementById('mobile-auth-buttons');
    const mobileUserProfile = document.getElementById('mobile-user-profile');
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');

    // Solo ejecutamos esto si los elementos existen (es decir, si estamos en index.html)
    if (authButtons && userProfile) {
        if (token) {
            // CASO: USUARIO LOGUEADO
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
            // CASO: VISITANTE (NO LOGUEADO)
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

    // --- 2. LÓGICA DE LOGOUT (CERRAR SESIÓN) ---
    const handleLogout = () => {
        localStorage.removeItem('token');
        window.location.reload(); // Recargar para limpiar estado
    };

    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', handleLogout);

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
                        //alert('¡Bienvenido! Entrando a la App...');
                        window.location.href = '/dashboard.html'; 
                    } else {
                        // REGISTRO EXITOSO
                        //alert('Registro exitoso. Ya tienes tus $50,000 iniciales. Por favor inicia sesión.');
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

    // --- 4. LÓGICA DEL MENÚ MÓVIL (HAMBURGUESA) ---
    // Esto asegura que el menú funcione siempre
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            // Alternar visibilidad
            mobileMenu.classList.toggle('hidden');
            mobileMenu.classList.toggle('flex');
        });
    }

});