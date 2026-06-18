// Cliente da API do ManyChat (https://api.manychat.com)
const BASE = 'https://api.manychat.com';

async function call(token, route, { method = 'GET', body } = {}) {
  if (!token) throw new Error('Token do ManyChat não configurado.');
  const res = await fetch(BASE + route, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = {};
  try { json = await res.json(); } catch { /* resposta vazia */ }
  if (!res.ok || json.status === 'error') {
    const msg = json?.message || json?.details || `ManyChat respondeu ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return json.data ?? json;
}

// Normaliza telefone para o formato internacional com "+" (ex: +5511999998888)
export function normalizePhone(raw, countryCode = '55') {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (!digits.startsWith(countryCode) && digits.length <= 11) digits = countryCode + digits;
  return '+' + digits;
}

export const manychat = {
  // Procura assinante pelo telefone (campo de sistema do WhatsApp)
  async findByPhone(token, phone) {
    try {
      const data = await call(token, `/fb/subscriber/findBySystemField?phone=${encodeURIComponent(phone)}`);
      return data?.id ? data : null;
    } catch {
      return null;
    }
  },

  // Cria assinante de WhatsApp
  async createSubscriber(token, { phone, name }) {
    const [first, ...rest] = String(name || '').trim().split(' ');
    const data = await call(token, '/fb/subscriber/createSubscriber', {
      method: 'POST',
      body: {
        whatsapp_phone: phone,
        first_name: first || 'Aluno',
        last_name: rest.join(' ') || '',
        has_opt_in_sms: false,
        has_opt_in_email: false,
        consent_phrase: 'Compra aprovada na Hotmart',
      },
    });
    return data;
  },

  // Define um campo personalizado (ignora erro caso o campo não exista no ManyChat)
  async trySetField(token, subscriberId, fieldName, value) {
    if (value === undefined || value === null || value === '') return;
    try {
      await call(token, '/fb/subscriber/setCustomFieldByName', {
        method: 'POST',
        body: { subscriber_id: subscriberId, field_name: fieldName, field_value: value },
      });
    } catch { /* campo não existe no ManyChat: tudo bem, segue o jogo */ }
  },

  // Dispara um flow/template para o assinante
  async sendFlow(token, subscriberId, flowNs) {
    return call(token, '/fb/sending/sendFlow', {
      method: 'POST',
      body: { subscriber_id: subscriberId, flow_ns: flowNs },
    });
  },
};

// Fluxo de boas-vindas completo: encontra/cria o aluno e dispara o template do produto.
export async function enviarBoasVindas({ token, countryCode, produto, buyer }) {
  if (!produto.manychatFlowNs) throw new Error('Produto sem template (flow do ManyChat) configurado.');
  const rawPhone = buyer.checkout_phone || buyer.phone || buyer.whatsapp || buyer.cellphone || '';
  const phone = normalizePhone(rawPhone, countryCode);
  if (!phone) throw new Error('Comprador sem telefone no payload da Hotmart.');

  let sub = await manychat.findByPhone(token, phone);
  if (!sub) sub = await manychat.createSubscriber(token, { phone, name: buyer.name });
  const subscriberId = sub.id;

  // Campos opcionais que o template pode usar ({{whatsapp_link}}, {{produto_nome}})
  await manychat.trySetField(token, subscriberId, 'whatsapp_link', produto.whatsappGroupLink);
  await manychat.trySetField(token, subscriberId, 'produto_nome', produto.name);

  await manychat.sendFlow(token, subscriberId, produto.manychatFlowNs);
  return { subscriberId, phone };
}
