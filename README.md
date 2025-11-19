# 🚀 RocketInvest Core Platform

![Status](https://img.shields.io/badge/status-live-success)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-Proprietary-red)

**RocketInvest** es una plataforma Fintech de gestión de activos y simulación de inversiones diseñada para democratizar el acceso a fondos de inversión mediante la agregación de capital y tecnología accesible.

Esta arquitectura permite la gestión de usuarios, transaccionalidad en tiempo real (depósitos/retiros), y análisis de mercado mediante integración con APIs bursátiles externas.

🔗 **Producción:** [https://rocket-invest.onrender.com](https://rocket-invest.onrender.com)

---

## 🏛️ Arquitectura del Sistema

La plataforma utiliza una arquitectura monolítica modular desplegada en la nube, priorizando la persistencia de datos y la seguridad de las transacciones.

```mermaid
[Cliente Web] <--> [API REST (Express.js)] <--> [PostgreSQL (NeonDB)]
                          |
                          v
                  [Twelve Data API] (Market Data)

---

## Estructura del Proyecto (Referencia Visual)

rocket-invest/
├── .env                  # Variables secretas (Local)
├── .gitignore            # Archivos ignorados por Git
├── db.js                 # Conector a PostgreSQL (Neon)
├── package.json          # Dependencias y scripts
├── server.js             # Servidor Express (Backend API)
└── public/               # Frontend (Cliente)
    ├── index.html        # Landing Page
    ├── login.html        # Inicio de Sesión
    ├── signup.html       # Registro
    ├── dashboard.html    # Panel Principal
    ├── portfolios.html   # Mercado / Explorar
    ├── investments.html  # Mis Inversiones
    ├── history.html      # Historial
    └── js/
        ├── auth.js       # Lógica de Login/Registro/Logout
        ├── dashboard.js  # Lógica del Dashboard y Gráficas
        ├── history.js    # Lógica de la tabla historial
        ├── investments.js# Lógica de inversiones y venta
        └── portfolios.js # Lógica del mercado