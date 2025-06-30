# iAN Chatbot API

Backend API para el chatbot de iAN usando GPT-4o-mini.

## Configuración Local

1. Instalar dependencias:
```bash
cd api
npm install
```

2. Configurar variables de entorno:
   - Copia `.env.example` a `.env`
   - Agrega tu API key de OpenAI

3. Ejecutar localmente con Vercel CLI:
```bash
npm run dev
```

## Despliegue en Vercel

1. Instalar Vercel CLI (si no lo tienes):
```bash
npm i -g vercel
```

2. Conectar con Vercel:
```bash
vercel
```

3. Configurar variables de entorno en Vercel:
```bash
vercel env add OPENAI_API_KEY
vercel env add ALLOWED_ORIGIN
```

4. Desplegar:
```bash
npm run deploy
```

## Actualizar la URL del API en el Frontend

Una vez desplegado, actualiza la URL en `js/chatbot-demo.js`:
```javascript
const API_ENDPOINT = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api/chat'
    : 'https://TU-PROYECTO.vercel.app/api/chat'; // Reemplaza con tu URL
```

## Estructura del API

- `/api/chat` - Endpoint principal del chatbot
  - Method: POST
  - Body: `{ message: string, conversationHistory: array }`
  - Response: `{ response: string, usage: object }`

## Seguridad

- CORS configurado para tu dominio
- Rate limiting: 10 requests por minuto
- API key segura en variables de entorno
- Validación de entrada (máx 500 caracteres)