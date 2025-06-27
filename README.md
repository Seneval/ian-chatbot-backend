# iAN Chatbot Backend

Backend API para el sistema de chatbots con inteligencia artificial de iAN (Inteligencia Artificial para Negocios).

## 🚀 Características

- **Multi-tenant**: Soporta múltiples clientes con aislamiento de datos
- **Integración con OpenAI**: Usa Assistants API para conversaciones inteligentes
- **Autenticación JWT**: Sistema seguro con tokens para clientes y administradores
- **Rate Limiting**: Protección contra abuso con límites configurables
- **Analytics**: Seguimiento de uso y métricas por cliente
- **Escalable**: Diseñado para manejar 100+ clientes concurrentes

## 📋 Requisitos Previos

- Node.js >= 18.0.0
- Cuenta de OpenAI con acceso a Assistants API
- MongoDB (opcional, actualmente usa almacenamiento en memoria)
- Cuenta de Vercel para deployment

## 🛠️ Instalación Local

1. Clonar el repositorio:
```bash
git clone https://github.com/Seneval/ian-chatbot-backend.git
cd ian-chatbot-backend
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
```bash
cp .env.example .env
# Editar .env con tus valores
```

4. Ejecutar en modo desarrollo:
```bash
npm run dev
```

## 🚀 Deployment en Vercel

### Opción 1: Deploy con Vercel CLI

1. Instalar Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

### Opción 2: Deploy desde GitHub

1. Fork este repositorio
2. Ir a [vercel.com](https://vercel.com)
3. Importar el repositorio
4. Configurar las variables de entorno:
   - `OPENAI_API_KEY`: Tu API key de OpenAI
   - `JWT_SECRET`: Secret para tokens de clientes
   - `ADMIN_JWT_SECRET`: Secret para tokens de admin
   - `MONGODB_URI`: (opcional) URI de MongoDB Atlas

## 🔧 Variables de Entorno

| Variable | Descripción | Requerido |
|----------|-------------|-----------|
| `OPENAI_API_KEY` | API Key de OpenAI | ✅ |
| `JWT_SECRET` | Secret para JWT de clientes | ✅ |
| `ADMIN_JWT_SECRET` | Secret para JWT de admin | ✅ |
| `MONGODB_URI` | URI de MongoDB | ❌ |
| `PORT` | Puerto del servidor (default: 3000) | ❌ |
| `NODE_ENV` | Ambiente (development/production) | ❌ |
| `RATE_LIMIT_MAX` | Máximo de requests por ventana | ❌ |

## 📝 Licencia

Este proyecto es propiedad de iAN (Inteligencia Artificial para Negocios).
