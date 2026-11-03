
// AGENTE IA META PARA WHATSAPP - IMPRENTA PANAMÁ PRINT V2
// Conecta WhatsApp Cloud API + IA (Meta Llama / OpenAI)
// Autor: Meta AI para Empastado Keity / Panamá Print

const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

// CONFIGURACIÓN - LLENA TU .env
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'panama_print_123';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN; // Token permanente de Meta
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID; // ID del número
const AI_API_KEY = process.env.AI_API_KEY; // Opcional si usas OpenAI

// PROMPT DEL AGENTE - TU IMPRENTA
const SYSTEM_PROMPT = `
Eres el asistente virtual de PANAMÁ PRINT - Imprenta en Panamá City.
Nombre del negocio: Panamá Print (antes Empastado Keity)
Ubicación: Panamá City
Horario: Lunes a Viernes 8:00am - 6:00pm, Sábado 8:00am - 3:00pm, Domingo cerrado.

Tu objetivo: Responder como humano panameño, amable, rápido, profesional. No sonar robótico.

CATÁLOGO REAL:
- Tarjetas presentación 100 und: $25 (full color 2 caras, 350gr, entrega 24h)
- Volantes 1000 und 1 cara: $45 (couche 115gr)
- Banners / Lona 3x1 mts: $35
- Vinil adhesivo m2: $18
- Stickers troquelados 100 und: $30
- Sellos automáticos: $22
- Empastados Tesis: $18 c/u
- Anillados / Encuadernación: $4

FLUJO DE PEDIDO (OBLIGATORIO):
Cuando digan "quiero imprimir", "pedido", "cotizar":
1. Pregunta nombre
2. Qué producto necesita
3. Cantidad
4. ¿Tiene arte listo? Si no, ofrecemos diseño $15 adicional
5. Fecha de entrega
Al final genera RESUMEN y di: "Gracias {nombre}, ya pasé tu pedido al taller. Te confirmamos precio final y entrega en < 10 min."

REGLAS:
- Si preguntan precio, da precio base y pregunta cantidad.
- Si preguntan horario, da horario real.
- Fuera de horario (después de 6pm): "Fuera de horario ahora mismo. Te respondemos mañana 8am. Deja tu pedido aquí y lo procesamos de primero."
- Si piden humano: "Te conecto con asesor humano en < 5 min"
- Nunca inventes precios que no están en catálogo, di "déjame confirmar ese precio especial"
- Habla en español de Panamá, usa emojis moderados.
- Sé corto: máximo 3 líneas por mensaje.
`;

async function callAI(userMessage, history) {
  // OPCIÓN A: Usando API de Meta AI / Llama (si tienes acceso)
  // OPCIÓN B: Usando OpenAI como fallback - cambia URL si usas Llama
  
  try {
    // Si usas OpenAI
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
        { role: 'user', content: userMessage }
      ],
      max_tokens: 250,
      temperature: 0.7
    }, {
      headers: { 'Authorization': `Bearer ${AI_API_KEY}`, 'Content-Type': 'application/json' }
    });
    
    return response.data.choices[0].message.content;
  } catch (e) {
    console.log('Error IA:', e.message);
    // Fallback sin IA - respuestas por palabras clave
    const msg = userMessage.toLowerCase();
    if (msg.includes('hola') || msg.includes('buenas')) {
      return `¡Hola! 👋 Bienvenido a Panamá Print
1️⃣ Ver precios
2️⃣ Hacer pedido
3️⃣ Horario y ubicación
4️⃣ Hablar con asesor

¿Qué necesitas hoy?`;
    }
    if (msg.includes('precio') || msg.includes('tarjeta') || msg.includes('volante') || msg.includes('banner') || msg.includes('empastado')) {
      return `Claro, estos son nuestros más pedidos:
• Tarjetas 100 und $25
• Volantes 1000 und $45
• Banner 3x1 $35
• Empastado Tesis $18

¿qué producto y qué cantidad necesitas?`;
    }
    if (msg.includes('horario') || msg.includes('ubicacion') || msg.includes('direccion')) {
      return `*Horario de atención:*
Lunes a Viernes: 8:00am - 6:00pm
Sábado: 8:00am - 3:00pm
Domingo: Cerrado

📍 Panamá City. ¿Quieres que te mande la ubicación?`;
    }
    return `¡Perfecto! Para ayudarte rápido, dime:
1. ¿Qué necesitas imprimir?
2. ¿Qué cantidad?
Así te doy precio y tiempo de entrega exacto.`;
  }
}

async function sendWhatsAppMessage(to, text) {
  await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    to: to,
    type: 'text',
    text: { body: text }
  }, {
    headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' }
  });
}

// VERIFICACIÓN DE META (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WEBHOOK VERIFICADO');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// RECEPCIÓN DE MENSAJES (POST)
const userHistories = {}; // Memoria simple por número

app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // Responder rápido a Meta
  
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];
    
    if (!message || message.type !== 'text') return;
    
    const from = message.from;
    const text = message.text.body;
    
    console.log(`Mensaje de ${from}: ${text}`);
    
    // Historial simple
    if (!userHistories[from]) userHistories[from] = [];
    userHistories[from].push({ role: 'user', content: text });
    if (userHistories[from].length > 10) userHistories[from] = userHistories[from].slice(-10);
    
    const aiResponse = await callAI(text, userHistories[from].slice(0, -1));
    
    userHistories[from].push({ role: 'assistant', content: aiResponse });
    
    await sendWhatsAppMessage(from, aiResponse);
    
  } catch (e) {
    console.error('Error webhook:', e.response?.data || e.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Agente Panamá Print corriendo en puerto ${PORT}`));
