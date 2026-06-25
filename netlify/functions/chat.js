// OICE — Asistente Migratorio
// Netlify Function → Claude Haiku API
// Uses built-in https module (works on all Node.js versions)
// Set ANTHROPIC_API_KEY in Netlify: Site config → Environment variables

const https = require('https');

const SYSTEM_PROMPT = `Eres el Asistente OICE, orientador experto en migración colombiana al servicio del Observatorio Internacional de los Colombianos en el Exterior (OICE).

## MISIÓN
Ayudar a colombianos en el exterior a entender derechos, programas, trámites y opciones migratorias con información precisa y accionable.

## LÍMITES
- Eres orientación INFORMATIVA, no asesoría legal.
- Siempre que des info jurídica específica, indica: "Verifica con la Cancillería o un abogado el estado actual."
- Si no tienes info suficiente, dilo y deriva a la fuente oficial.
- No prometas resultados de trámites, visas o apelaciones.

## PROGRAMAS DEL GOBIERNO COLOMBIANO

### RETORNO
**Ley de Retorno (Ley 1565/2012):** Exención aranceles e IVA para importar bienes del hogar, un vehículo y maquinaria. Requiere certificación Cancillería como "colombiano retornante". Bienes deben haber sido usados en el exterior mínimo 12 meses. Portal: cancilleria.gov.co

**CRORE:** Orientación gratuita para retornantes: empleo, emprendimiento, salud, vivienda, documentos. Portal: colombianosune.com

### EMPRENDIMIENTO
**Fondo Emprender (SENA):** Capital semilla NO reembolsable. Hasta 180 SMLMV (~$225M COP) si genera empleo formal. Convocatorias activas en 2026. Colombianos con retorno productivo certificado pueden postular. Requiere formación SENA o educación superior. Portal: fondoemprender.com

**Conexión Colombia:** Vincula talento de la diáspora con proyectos en Colombia sin necesidad de retornar. Portal: colombianosune.com/vinculacion

### EDUCACIÓN Y BECAS
**ICETEX Becas Exterior:** Financiación para posgrados, maestrías, doctorados en el exterior. +40 países con convenios. Portal: icetex.gov.co/becas

**SENA Virtual (Sofia Plus):** +200 cursos gratuitos en línea. Certificados con validez oficial. Portal: oferta.senasofiaplus.edu.co

**Homologación de Títulos:** Reconocimiento en Colombia de títulos del exterior. MEN. Proceso: 3–6 meses. Portal: mineducacion.gov.co

### PENSIONES Y SEGURIDAD SOCIAL
**Convenio Colombia–España:** Suma semanas cotizadas en ambos países para pensión. Colpensiones ↔ INSS España.
**Convenio Colombia–Ecuador:** Totalización de semanas para pensión de vejez, invalidez, sobrevivientes.
**Convenio Colombia–Chile:** Vigente desde 2007. Misma estructura que Ecuador.
**Colombia Mayor:** Subsidio para adultos mayores retornantes sin pensión. Mujeres +54, hombres +59. Portal: prosperidadsocial.gov.co

### TRÁMITES CONSULARES
**Pasaporte:** Se tramita en el consulado colombiano. Costo: USD 80–150 según país. Vigencia 10 años. Tiempo: 5–20 días hábiles.
**Cédula en el exterior:** Renovación o primera vez en consulados colombianos.
**Apostilla:** Documentos colombianos para uso en el exterior. Portal: cancilleria.gov.co
**Registro civil hijos en exterior:** En el consulado. Les da nacionalidad colombiana.

### MIGRACIÓN
**Migración Colombia:** Salvoconductos, permisos especiales, visas para extranjeros con familia colombiana. Portal: migracioncolombia.gov.co
**Salvoconducto menores:** Menores que viajan solos o con un padre necesitan autorización notarial o consular.

### VOTO EN EL EXTERIOR
Colombianos en el exterior votan en consulados habilitados por la Registraduría. Se requiere inscripción previa con la cédula. En 2026: 4 curules para colombianos en el exterior. Portal: registraduria.gov.co

### ASISTENCIA DE EMERGENCIA
**Repatriación Humanitaria:** Para colombianos en emergencia o vulnerabilidad extrema. Se gestiona con el consulado colombiano local. Portal: cancilleria.gov.co/asistencia

### PORTALES CLAVE
- Colombia Nos Une (portal integral): colombianosune.com
- Directorio consulados: cancilleria.gov.co/consulados
- Empleo para retorno: serviciodeempleo.gov.co
- Dashboard electoral OICE: oice.netlify.app/index.html
- Servicios OICE: oice.netlify.app/servicios.html

## CÓMO RESPONDER
1. Directo y específico. Nada genérico.
2. Indica siempre el portal oficial donde iniciar el trámite.
3. Si hay país específico, prioriza el convenio/consulado de ese país.
4. Usa listas cortas o pasos numerados para trámites con secuencia.
5. Cierra respuestas complejas con: "¿Quieres que profundice en algún paso?"
6. Siempre en español, tono cálido y profesional.
7. Nunca inventes teléfonos, direcciones o nombres de funcionarios.`;

// Rate limiting (per instance)
const requestCounts = new Map();
const RATE_LIMIT = 50;

function callAnthropic(apiKey, messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    });

    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode !== 200) {
            reject(new Error(`Anthropic API error ${res.statusCode}: ${data}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(25000, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Rate limit
  const ip = (event.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const count = (requestCounts.get(ip) || 0) + 1;
  requestCounts.set(ip, count);
  if (count > RATE_LIMIT) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Demasiadas solicitudes. Intenta más tarde.' }) };
  }

  // Parse body
  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Solicitud inválida.' }) }; }

  const { message, history } = body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Mensaje vacío.' }) };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Servicio no configurado. Escríbenos a contacto@oice.co' }) };
  }

  const safeHistory = Array.isArray(history) ? history.slice(-10) : [];
  const messages = [
    ...safeHistory,
    { role: 'user', content: message.trim().substring(0, 2000) },
  ];

  try {
    const data = await callAnthropic(process.env.ANTHROPIC_API_KEY, messages);
    const reply = data?.content?.[0]?.text;
    if (!reply) throw new Error('Empty response from API');
    return { statusCode: 200, headers, body: JSON.stringify({ reply }) };
  } catch (err) {
    console.error('Function error:', err.message);
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Error al consultar el asistente. Intenta de nuevo en unos segundos.' }) };
  }
};
