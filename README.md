# Saldo Claro

Agente financiero conversacional para registrar gastos, controlar presupuestos y escalar consultas sensibles desde web y una experiencia simulada de WhatsApp.

Proyecto del **Track 2: Interfaces Inteligentes para Finanzas Personales y Canales Masivos** de Agentic Scale · Ecuador Tech Week 2026.

- Aplicación pública: https://agentic-scale-hackathon.vercel.app
- API pública: https://saldo-claro-api.onrender.com
- Documentación de la API: https://saldo-claro-api.onrender.com/docs

## Qué permite hacer

- Interpretar gastos escritos en lenguaje natural con Google Gemini.
- Extraer monto, fecha, categoría y comercio.
- Solicitar información faltante y confirmar antes de guardar.
- Editar el ingreso, consultar el saldo y eliminar movimientos incorrectos.
- Crear, editar y eliminar presupuestos con alertas configurables.
- Responder consultas desde una base de conocimiento aprobada.
- Detectar reclamos o casos sensibles y crear tickets para atención humana.
- Administrar tickets por estado y conservar el contexto entregado.
- Simular el mismo flujo financiero desde una interfaz tipo WhatsApp.

## Arquitectura

Este repositorio es un **monorepo**: frontend y backend viven juntos, pero están separados por carpetas y responsabilidades. Esto permite ejecutar una sola suite de pruebas, mantener los contratos sincronizados y desplegar cada aplicación desde el mismo historial.

```text
Usuario web / WhatsApp simulado
              │
              ▼
       frontend/ (React)
              │ HTTPS + JSON
              ▼
       backend/ (FastAPI)
        ┌─────┼──────────┐
        ▼     ▼          ▼
     agent/ services/ data/
     Gemini  reglas     base aprobada
        └─────┼──────────┘
              ▼
          SQLite (demo)
```

Gemini interpreta texto, pero **no guarda ni confirma operaciones**. FastAPI recibe la propuesta, Pydantic valida su estructura, Python aplica reglas determinísticas y el usuario confirma antes de persistir.

## Mapa del repositorio

```text
saldo-claro/
├── frontend/                 # Aplicación React y estilos
│   ├── src/App.jsx           # Pantallas, estado y acciones de interfaz
│   ├── src/api.js            # Cliente HTTP del backend
│   ├── src/styles.css        # Diseño responsive
│   └── vite.config.js        # Configuración de Vite
├── backend/
│   ├── main.py               # Endpoints FastAPI
│   └── api_schemas.py        # Contratos de entrada y salida
├── agent/
│   ├── gemini_client.py      # Integración con Gemini y modo local
│   └── schemas.py            # ExpenseDraft y categorías
├── services/
│   ├── transactions.py       # Gastos, ingresos y SQLite
│   ├── budgets.py            # Presupuestos y alertas
│   ├── support.py            # Soporte y tickets
│   └── validation.py         # Reglas que no dependen del LLM
├── data/
│   └── approved_knowledge.json # Conocimiento autorizado
├── tests/                    # 16 pruebas automatizadas
├── render.yaml               # Despliegue del backend en Render
├── vercel.json               # Despliegue del frontend en Vercel
├── environment.yml           # Entorno Anaconda
└── requirements.txt          # Dependencias Python
```

## Dónde editar según la tarea

| Quiero cambiar... | Archivo o carpeta principal |
|---|---|
| Diseño, textos, navegación o pantallas | `frontend/src/App.jsx` y `frontend/src/styles.css` |
| URL o llamadas al backend | `frontend/src/api.js` |
| Endpoints de la API | `backend/main.py` |
| Contratos JSON y validación de campos | `backend/api_schemas.py` y `agent/schemas.py` |
| Prompt o modelo de Gemini | `agent/gemini_client.py` |
| Gastos, ingresos o persistencia | `services/transactions.py` |
| Presupuestos y alertas | `services/budgets.py` |
| Soporte, casos sensibles o tickets | `services/support.py` |
| Reglas financieras | `services/validation.py` |
| Respuestas aprobadas | `data/approved_knowledge.json` |
| Pruebas | `tests/` |

## Instalación completa

### Requisitos

- Git
- Anaconda o Miniconda
- Node.js y npm
- Una clave de Gemini para el modo conectado (opcional para las pruebas locales controladas)

### 1. Clonar

```bash
git clone https://github.com/emiemilioo/Agentic-Scale-Hackathon.git
cd Agentic-Scale-Hackathon
```

### 2. Preparar Python

```bash
conda env create -f environment.yml
conda activate saldo-claro
```

Si el entorno ya existe:

```bash
conda env update -f environment.yml --prune
conda activate saldo-claro
```

### 3. Configurar variables

Copia `.env.example` como `.env` en la raíz:

```env
GEMINI_API_KEY=tu_clave
GEMINI_MODEL=gemini-3.5-flash
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

No subas `.env` ni claves al repositorio. Sin clave, el extractor utiliza un modo local controlado.

### 4. Ejecutar el backend

Desde la raíz:

```bash
uvicorn backend.main:app --reload
```

- API: http://127.0.0.1:8000
- Swagger: http://127.0.0.1:8000/docs
- Salud: http://127.0.0.1:8000/api/health

### 5. Ejecutar el frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Abrir http://localhost:5173.

## Pruebas y compilación

Desde la raíz:

```bash
python -m pytest -q
```

Resultado esperado: **16 pruebas aprobadas**.

Para validar el frontend:

```bash
cd frontend
npm run build
```

## Contrato frontend-backend

La interfaz nunca accede directamente a SQLite ni a Gemini. Todas las acciones pasan por `frontend/src/api.js` y los endpoints de `backend/main.py`.

Cuando se agregue o cambie un endpoint:

1. Definir o actualizar el esquema en `backend/api_schemas.py`.
2. Implementar el endpoint en `backend/main.py`.
3. Agregar la función correspondiente en `frontend/src/api.js`.
4. Consumirla desde `frontend/src/App.jsx`.
5. Crear o actualizar pruebas.

## Despliegue

- **Vercel** compila la carpeta `frontend/`.
- **Render** instala `requirements.txt` y ejecuta `uvicorn backend.main:app`.
- `VITE_API_URL` conecta el frontend con Render.
- `CORS_ORIGINS` autoriza el dominio público de Vercel.
- `GEMINI_API_KEY` se configura únicamente como secreto de Render.

Los cambios fusionados y subidos a `main` activan despliegues automáticos.

## Limitaciones del MVP

- SQLite y los datos son compartidos en el despliegue de demostración.
- No existe autenticación ni separación por usuario.
- WhatsApp es una simulación; la Cloud API es una integración futura.
- La base de conocimiento aprobada es pequeña y deliberadamente controlada.
- Para producción se recomienda PostgreSQL, identidad, roles, auditoría y monitoreo.

## Seguridad

- La IA no escribe directamente en la base.
- Los gastos requieren confirmación explícita.
- Las reglas críticas se validan fuera del modelo.
- Las consultas sensibles se escalan a una persona.
- Las claves y archivos `.env` están excluidos del repositorio.

## Equipo

Equipo CodDivas · Agentic Scale 2026.
