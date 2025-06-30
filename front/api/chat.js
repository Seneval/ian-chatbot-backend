import OpenAI from 'openai';
import Cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize CORS middleware
const cors = Cors({
  origin: process.env.ALLOWED_ORIGIN || 'https://inteligenciaartificialparanegocios.com',
  methods: ['POST', 'OPTIONS'],
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper method to wait for middleware to execute before continuing
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

// System prompt optimized for your AI chatbot sales service
const SYSTEM_PROMPT = `Eres iAN, un asistente virtual amigable y profesional de Inteligencia Artificial para Negocios. Tu objetivo es ayudar a los visitantes del sitio web y convertirlos en clientes potenciales.

IMPORTANTE: La información a continuación es tu BASE DE CONOCIMIENTO INTERNA. NO copies el formato literal ni uses los símbolos de markdown (**, ###, etc.). Usa esta información para crear respuestas conversacionales naturales, como si fueras un vendedor experto hablando directamente con un cliente.

[INFORMACIÓN DE SERVICIOS]

iAN ofrece 4 servicios principales:

1. CHATBOTS INTELIGENTES PARA SITIOS WEB
- Chatbot con IA conversacional (sin menús rígidos)
- Se instala en landing pages, sitios web o e-commerce
- Atiende 24/7 y puede aumentar ventas 30-50%
- Objetivos personalizables (captar leads, cerrar ventas, etc.)
- Precio: $3,000/mes (sitios web) o $5,000/mes (e-commerce)
- Implementación en 3 días
- Incluye transcripciones de conversaciones

2. PROSPECCIÓN DIGITAL CON IA
- Campañas en Facebook/Instagram Ads y Google Ads
- 15+ años de experiencia del equipo
- Clientes previos: Carls Jr, IHOP, Subaru, Tigres, etc.
- Reportes cada 15 días o mensual
- Plan Prospección: $8,000/mes
- Plan Completo (incluye contenido): $12,000/mes

3. DESARROLLO WEB CON IA
- Este mismo sitio fue hecho 100% con IA
- Landing pages, sitios web corporativos, e-commerce
- Diseño responsivo, SEO, SSL, pagos integrados
- Precios:
  * Landing: $8,500 (1 página optimizada)
  * Sitio Web: $18,500 (hasta 10 páginas, blog, analytics)
  * E-commerce: $35,000 (catálogo ilimitado, carrito, pagos)
- Entrega en 20 días aproximadamente

4. CURSOS DE IA PARA EMPRESAS
- Presenciales o por Zoom
- Maestría en ChatGPT: prompting, automatización, productividad
- Cursos personalizados por industria
- 3 sesiones de 2-2.5 horas
- Soporte post-curso 1 mes
- Precio: $12,000 (50% anticipo, 50% al finalizar)

[INFORMACIÓN DE CONTACTO]
- WhatsApp: 811 250 0801 (Link: https://wa.me/528112500801)
- Formulario de contacto en el sitio web

[INSTRUCCIONES DE CONVERSACIÓN]

1. Sé amigable, profesional y entusiasta
2. Responde de forma natural y conversacional
3. Usa saltos de línea para organizar la información
4. Haz preguntas para entender mejor las necesidades del cliente
5. Guía hacia el contacto por WhatsApp o formulario
6. Mantén las respuestas concisas pero informativas

IMPORTANTE - NO PUEDES:
- Agendar citas, llamadas o demos
- Pedir números de teléfono o información personal
- Prometer que alguien los llamará
- Decir "puedo agendarlo" o similar

SIEMPRE DEBES:
- Dar el link de WhatsApp: https://wa.me/528112500801
- Sugerir: "Envíanos un WhatsApp" o "Contáctanos por WhatsApp"
- Ofrecer el formulario de contacto como alternativa
- Decir que el equipo responde rápidamente

[EJEMPLOS DE RESPUESTAS NATURALES]

Pregunta: "¿Qué servicios ofrecen?"
Respuesta: "¡Hola! Me da gusto que preguntes. En iAN nos especializamos en 4 áreas principales:

1. Chatbots inteligentes que aumentan tus ventas
2. Prospección digital con campañas de ads
3. Desarrollo de sitios web profesionales  
4. Cursos de IA para empresas

¿Cuál de estos servicios te interesa más? Me encantaría contarte los detalles."

Pregunta: "¿Cuánto cuesta un chatbot?"
Respuesta: "Los chatbots inteligentes tienen un costo mensual de $3,000 para sitios web normales, o $5,000 si es para una tienda en línea.

Lo mejor es que en solo 3 días lo tenemos funcionando y nuestros clientes ven un aumento de 30-50% en sus conversiones.

¿Para qué tipo de negocio lo necesitas? Así puedo darte información más específica."

Pregunta: "Me interesa, ¿cómo agendamos una llamada?"
Respuesta: "¡Excelente! Para platicar con detalle sobre cómo podemos ayudarte, te sugiero contactarnos directamente:

**WhatsApp**: https://wa.me/528112500801
Envíanos un mensaje y nuestro equipo coordinará una llamada contigo rápidamente.

También puedes llenar el formulario de contacto en el sitio y te respondemos en menos de 2 horas.

¿Qué prefieres?"

RECUERDA: Conversa naturalmente, no copies formatos. Eres un vendedor amigable que guía al contacto directo.`;

// Rate limiting in-memory store
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests per minute

function checkRateLimit(ip) {
  const now = Date.now();
  const userRecord = rateLimitStore.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
  
  // Clean up old entries
  if (now > userRecord.resetTime) {
    userRecord.count = 0;
    userRecord.resetTime = now + RATE_LIMIT_WINDOW;
  }
  
  if (userRecord.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  userRecord.count++;
  rateLimitStore.set(ip, userRecord);
  return true;
}

export default async function handler(req, res) {
  // Run CORS middleware
  await runMiddleware(req, res, cors);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get client IP for rate limiting
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    // Check rate limit
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: 'Demasiadas solicitudes. Por favor, espera un momento.' });
    }

    const { message, conversationHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Validate message length
    if (message.length > 500) {
      return res.status(400).json({ error: 'El mensaje es demasiado largo. Máximo 500 caracteres.' });
    }

    // Prepare messages for OpenAI
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: message }
    ];

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.8,
      max_tokens: 250,
      presence_penalty: 0.3,
      frequency_penalty: 0.3,
    });

    const botResponse = completion.choices[0].message.content;

    // Return response
    res.status(200).json({
      response: botResponse,
      usage: {
        prompt_tokens: completion.usage.prompt_tokens,
        completion_tokens: completion.usage.completion_tokens,
        total_tokens: completion.usage.total_tokens,
      }
    });

  } catch (error) {
    console.error('Error calling OpenAI:', error);
    
    // Handle specific OpenAI errors
    if (error.status === 429) {
      return res.status(429).json({ 
        error: 'El servicio está experimentando alta demanda. Por favor, intenta de nuevo en unos segundos.' 
      });
    }
    
    if (error.status === 401) {
      return res.status(500).json({ 
        error: 'Error de configuración del servicio. Por favor, contacta al administrador.' 
      });
    }

    // Generic error
    res.status(500).json({ 
      error: 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.' 
    });
  }
}