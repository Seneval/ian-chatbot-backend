# iAN Chatbot Backend

Backend API para el sistema de chatbots con IA de iAN (Inteligencia Artificial para Negocios).

## Características

- 🤖 Integración con OpenAI Assistants API
- 🔐 Sistema de autenticación multi-cliente
- 📊 Analytics y logs de conversaciones
- 🚀 API RESTful escalable
- 📈 Insights automáticos para clientes

## Requisitos

- Node.js >= 18.0.0
- MongoDB (próximamente)
- Cuenta de OpenAI con API key

## Instalación

1. Instalar dependencias:
```bash
npm install
```

2. Configurar variables de entorno:
```bash
cp .env.example .env
```

3. Editar `.env` con tus valores:
- `OPENAI_API_KEY`: Tu API key de OpenAI
- `JWT_SECRET`: Secret para tokens de clientes
- `ADMIN_JWT_SECRET`: Secret para tokens de admin

## Desarrollo

Ejecutar en modo desarrollo con hot-reload:
```bash
npm run dev
```

Ejecutar en producción:
```bash
npm start
```

## API Endpoints

### Autenticación

- `POST /api/auth/admin/login` - Login de administrador
- `POST /api/auth/client` - Crear nuevo cliente
- `GET /api/auth/clients` - Listar todos los clientes
- `GET /api/auth/client/:clientId` - Obtener detalles de cliente
- `PUT /api/auth/client/:clientId` - Actualizar cliente
- `POST /api/auth/client/:clientId/regenerate-token` - Regenerar token

### Chat

- `POST /api/chat/session` - Crear nueva sesión de chat
- `POST /api/chat/message` - Enviar mensaje al asistente
- `GET /api/chat/history/:sessionId` - Obtener historial de chat

### Analytics

- `GET /api/analytics/overview/:clientId` - Resumen de analytics
- `GET /api/analytics/conversations/:clientId` - Listar conversaciones
- `GET /api/analytics/conversation/:conversationId` - Detalles de conversación
- `GET /api/analytics/export/:clientId` - Exportar datos
- `GET /api/analytics/insights/:clientId` - Obtener insights

## Seguridad

- Todos los endpoints de chat requieren token de cliente
- Los endpoints de analytics requieren token de administrador
- Rate limiting implementado (30 requests/minuto)
- CORS configurado para dominios permitidos

## Integración del Widget

Para integrar el chatbot en un sitio web:

```html
<!-- iAN Chatbot Widget -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'https://chat.inteligenciaartificialparanegocios.com/widget.js';
    script.setAttribute('data-client-token', 'CLIENT_TOKEN_HERE');
    script.setAttribute('data-position', 'bottom-right');
    script.async = true;
    document.head.appendChild(script);
  })();
</script>
```

## Deployment

Este backend está diseñado para ser desplegado en Vercel:

1. Conectar repositorio a Vercel
2. Configurar variables de entorno en Vercel
3. Deploy automático en cada push a la rama `dev`

## Licencia

Propiedad de iAN - Inteligencia Artificial para Negocios