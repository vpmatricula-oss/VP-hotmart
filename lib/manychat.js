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

// Acha/cria o subscriber e devolve o ID, usando um cache próprio (Supabase) para
// não depender da busca por telefone do ManyChat (que não acha contatos criados via API).
async function resolverSubscriberId(token, phone, name, cache) {
  // 1) Cache local (telefone -> id): cobre quem já comprou antes.
  if (cache) {
    const cached = await cache.get(phone);
    if (cached) return cached;
  }
  // 2) Busca no ManyChat por telefone (cobre contatos "orgânicos" com o campo phone preenchido).
  const found = await manychat.findByPhone(token, phone);
  if (found?.id) {
    if (cache) await cache.set(phone, found.id);
    return found.id;
  }
  // 3) Cria o contato.
  try {
    const created = await manychat.createSubscriber(token, { phone, name });
    if (cache && created?.id) await cache.set(phone, created.id);
    return created.id;
  } catch (e) {
    // 4) Já existe mas a busca por telefone não achou (contato só com whatsapp_phone).
    if (/already exists/i.test(e.message)) {
      const retry = await manychat.findByPhone(token, phone);
      if (retry?.id) { if (cache) await cache.set(phone, retry.id); return retry.id; }
      throw new Error('Contato já existe no ManyChat, mas a API não localiza pelo telefone (' + phone + '). Acontece com contatos antigos criados só com whatsapp_phone.');
    }
    throw e;
  }
}

// Fluxo de boas-vindas completo: encontra/cria o aluno e dispara o template do produto.
// flowNs (opcional) sobrescreve o flow do produto — usado, por ex., para o disparo do livro.
export async function enviarBoasVindas({ token, countryCode, produto, buyer, cache, flowNs }) {
  const flow = flowNs || produto.manychatFlowNs;
  if (!flow) throw new Error('Produto sem template (flow do ManyChat) configurado.');
  const rawPhone = buyer.checkout_phone || buyer.phone || buyer.whatsapp || buyer.cellphone || '';
  const phone = normalizePhone(rawPhone, countryCode);
  if (!phone) throw new Error('Comprador sem telefone no payload da Hotmart.');

  const subscriberId = await resolverSubscriberId(token, phone, buyer.name, cache);

  // Campos opcionais que o template pode usar ({{whatsapp_link}}, {{produto_nome}})
  await manychat.trySetField(token, subscriberId, 'whatsapp_link', produto.whatsappGroupLink);
  await manychat.trySetField(token, subscriberId, 'produto_nome', produto.name);

  await manychat.sendFlow(token, subscriberId, flow);
  return { subscriberId, phone };
}
