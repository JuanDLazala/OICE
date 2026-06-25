// OICE Asistente Migratorio — Netlify Function
// Uses built-in 'https' module — no dependencies needed

const https = require('https');

const SYSTEM = `Eres el Asistente OICE, orientador experto en migración colombiana del Observatorio Internacional de los Colombianos en el Exterior.

LÍMITES: Eres orientación INFORMATIVA, no asesoría legal. Siempre recomienda verificar con la Cancillería o un abogado para trámites específicos.

PROGRAMAS CLAVE:
- Ley de Retorno (1565/2012): exención aranceles e IVA para bienes al regresar. cancilleria.gov.co
- Fondo Emprender SENA: capital semilla no reembolsable hasta 180 SMLMV. fondoemprender.com
- ICETEX becas exterior: posgrados y maestrías financiadas. icetex.gov.co/becas
- SENA Virtual: +200 cursos gratuitos en línea. senasofiaplus.edu.co
- Convenio pensión Colombia-España: suma semanas cotizadas en ambos países
- Convenio pensión Colombia-Ecuador y Colombia-Chile: misma lógica
- Trámites consulares (pasaporte, cédula, apostillas): cancilleria.gov.co
- Migración Colombia: visas, salvoconductos, permisos. migracioncolombia.gov.co
- Homologación títulos: MEN, 3-6 meses. mineducacion.gov.co
- Repatriación humanitaria: gestión directa con el consulado local
- Voto exterior 2026: inscripción en consulado, 4 curules disponibles. registraduria.gov.co
- Colombia Nos Une (portal integral): colombianosune.com

FORMATO DE RESPUESTA:
- Escribe en español con tono cálido, cercano y directo como un orientador humano
- NO uses ## ni ### como encabezados — usa texto en negrita con ** para los títulos de sección
- Para listas usa viñetas con - o números con 1.
- Separa secciones con una línea en blanco, no con ---
- Incluye siempre el portal oficial al final de cada programa
- No inventes teléfonos ni nombres de funcionarios
- Respuestas concisas: máximo 300 palabras salvo que pregunten algo muy complejo`;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key no configurada en Netlify. Ve a Site configuration → Environment variables y agrega ANTHROPIC_API_KEY.' }) };
  }

  let parsed;
  try {
    parsed = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cuerpo de solicitud inválido' }) };
  }

  const { message, history } = parsed;
  if (!message || !message.trim()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Mensaje vacío' }) };
  }

  const messages = [
    ...(Array.isArray(history) ? history.slice(-8) : []),
    { role: 'user', content: String(message).trim().slice(0, 2000) },
  ];

  const requestBody = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system: SYSTEM,
    messages,
  });

  try {
    const reply = await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'api.anthropic.com',
          path: '/v1/messages',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody),
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (res.statusCode !== 200) {
                reject(new Error(`Anthropic ${res.statusCode}: ${json.error?.message || data.slice(0, 200)}`));
              } else {
                resolve(json.content?.[0]?.text || '');
              }
            } catch (e) {
              reject(new Error('Error parseando respuesta de Anthropic'));
            }
          });
        }
      );
      req.on('error', reject);
      req.setTimeout(28000, () => { req.destroy(); reject(new Error('Timeout')); });
      req.write(requestBody);
      req.end();
    });

    if (!reply) throw new Error('Respuesta vacía');
    return { statusCode: 200, headers, body: JSON.stringify({ reply }) };

  } catch (err) {
    console.error('OICE chat error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: `Error del asistente: ${err.message}` }),
    };
  }
};
