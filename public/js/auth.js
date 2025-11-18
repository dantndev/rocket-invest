// public/js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. REFERENCIAS ---
    const token = localStorage.getItem('token');
    const authButtons = document.getElementById('auth-buttons');
    const userProfile = document.getElementById('user-profile');
    const mobileAuthButtons = document.getElementById('mobile-auth-buttons');
    const mobileUserProfile = document.getElementById('mobile-user-profile');
    const logoutBtn = document.getElementById('logout-btn');
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');

    // Referencias para Errores y Éxito
    const errorContainer = document.getElementById('auth-error');
    const errorText = document.getElementById('auth-error-text');
    const successModal = document.getElementById('success-modal'); // <--- NUEVO

    // --- 2. VERIFICAR ESTADO DE SESIÓN ---
    if (authButtons) {
        if (token) {
            // Logueado
            authButtons.classList.add('hidden');
            authButtons.classList.remove('flex');
            userProfile.classList.remove('hidden');
            userProfile.classList.add('flex');
            if(mobileAuthButtons) {
                mobileAuthButtons.classList.add('hidden');
                mobileAuthButtons.classList.remove('flex');
                mobileUserProfile.classList.remove('hidden');
                mobileUserProfile.classList.add('flex');
            }
        } else {
            // Visitante
            authButtons.classList.remove('hidden');
            authButtons.classList.add('flex');
            userProfile.classList.add('hidden');
            userProfile.classList.remove('flex');
            if(mobileAuthButtons) {
                mobileAuthButtons.classList.remove('hidden');
                mobileAuthButtons.classList.add('flex');
                mobileUserProfile.classList.add('hidden');
                mobileUserProfile.classList.remove('flex');
            }
        }
    }

    // Función Logout
    const handleLogout = () => {
        localStorage.removeItem('token');
        window.location.reload();
    };
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', handleLogout);

    // --- 3. FUNCIONES VISUALES (ERROR Y ÉXITO) ---
    const showError = (message) => {
        if (errorContainer && errorText) {
            errorText.textContent = message;
            errorContainer.classList.remove('hidden');
        } else { alert(message); }
    };

    const hideError = () => {
        if (errorContainer) errorContainer.classList.add('hidden');
    };

    // --- 4. LÓGICA DEL FORMULARIO ---
    const loginForm = document.querySelector('form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const isLoginPage = window.location.pathname.includes('login.html');

    if (emailInput) emailInput.addEventListener('input', hideError);
    if (passwordInput) passwordInput.addEventListener('input', hideError);
    
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
                        // LOGIN: Redirigir rápido
                        localStorage.setItem('token', data.token);
                        window.location.href = '/dashboard.html'; 
                    } else {
                        // REGISTRO: MOSTRAR MODAL DE ÉXITO (NUEVO)
                        if (successModal) {
                            successModal.classList.remove('hidden'); // Mostrar ventana
                            
                            // Esperar 2 segundos y redirigir
                            setTimeout(() => {
                                window.location.href = '/login.html';
                            }, 2000); 
                        } else {
                            // Fallback si no copiaron el HTML del modal
                            alert('Registro exitoso');
                            window.location.href = '/login.html';
                        }
                    }
                } else {
                    showError(data.message || 'Ocurrió un error');
                }
            } catch (error) {
                console.error('Error:', error);
                showError('Error de conexión con el servidor');
            }
        });
    }

    // --- 5. MENÚ MÓVIL ---
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
            mobileMenu.classList.toggle('flex');
        });
    }
});