// public/js/dashboard.js (Solo actualiza esta función)

window.initStripePayment = async function() {
    const amount = document.getElementById('deposit-amount').value;
    const btn = document.getElementById('btn-init-stripe');
    
    if(!amount || amount <= 0) { alert("Monto inválido"); return; }
    
    btn.disabled = true;
    btn.innerText = "Conectando con Banco...";

    try {
        // 1. Pedir Intent al Servidor
        const res = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ amount: amount, token: localStorage.getItem('token') })
        });

        // Verificación de errores del servidor
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || `Error del servidor: ${res.status}`);
        }

        const data = await res.json();
        if(!data.clientSecret) throw new Error("No se recibió llave de pago");

        // 2. Mostrar Elemento de Tarjeta
        document.getElementById('deposit-step-1').classList.add('hidden');
        document.getElementById('stripe-container').classList.remove('hidden');

        const appearance = { theme: document.documentElement.classList.contains('dark') ? 'night' : 'stripe' };
        elements = stripe.elements({ clientSecret: data.clientSecret, appearance });
        const paymentElement = elements.create('payment');
        paymentElement.mount('#payment-element');

        // Listener para el botón final de pago
        document.getElementById('btn-confirm-stripe').onclick = async (e) => {
            e.preventDefault();
            e.target.disabled = true;
            e.target.innerText = "Procesando...";

            const { error } = await stripe.confirmPayment({
                elements,
                redirect: 'if_required'
            });

            if (error) {
                alert(error.message);
                e.target.disabled = false;
                e.target.innerText = "Pagar Ahora";
            } else {
                await fetch('/api/deposit', {
                    method: 'POST',
                    headers: {'Content-Type':'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}`},
                    body: JSON.stringify({ amount: amount, token: localStorage.getItem('token') })
                });
                closeDepositModal();
                updateUserData(localStorage.getItem('token'));
                showSuccess(); // Modal verde
                
                // Resetear formulario
                document.getElementById('deposit-amount').value = '';
                document.getElementById('deposit-step-1').classList.remove('hidden');
                document.getElementById('stripe-container').classList.add('hidden');
                btn.disabled = false; btn.innerText = "Iniciar Pago Seguro";
                
                // Actualizar gráfica
                fetchPersonalChart(localStorage.getItem('token'), 'netWorth');
            }
        };

    } catch (error) {
        console.error("Error Stripe:", error);
        alert("No se pudo iniciar el pago: " + error.message); // Alerta detallada
        btn.disabled = false;
        btn.innerText = "Iniciar Pago Seguro";
    }
}