// Cliente WooCommerce — SOMENTE LEITURA (apenas requisições GET).
// Nunca cria, edita ou apaga nada na loja.
const WURL = process.env.WOO_URL;
const CK = process.env.WOO_CK;
const CS = process.env.WOO_CS;

export const wooEnabled = !!(WURL && CK && CS);
const authHeader = wooEnabled ? 'Basic ' + Buffer.from(`${CK}:${CS}`).toString('base64') : '';

async function wooGet(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${WURL}/wp-json/wc/v3/${path}?${qs}`, { headers: { Authorization: authHeader } });
  if (!res.ok) throw new Error('WooCommerce ' + res.status + ': ' + (await res.text()).slice(0, 140));
  return { data: await res.json(), totalPages: Number(res.headers.get('x-wp-totalpages') || 1) };
}

// Testa a conexão (leitura simples).
export async function wooPing() {
  if (!wooEnabled) return { ok: false, error: 'WooCommerce não configurado' };
  try {
    await wooGet('products', { per_page: 1 });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Verifica, POR E-MAIL, quem já resgatou o livro = pedido do produto COM cupom e status válido.
// Escala com o nº de compradores (não com o total de resgates). Consultas em paralelo.
// Retorna Map(email -> { coupon, status, orderId } | null=não resgatou | undefined=erro).
// opts.coupon: se informado, só conta o resgate se o pedido usou ESSE cupom (ex: '5hv65dnx').
// opts.after:  se informado (ISO date), só conta pedidos a partir dessa data.
export async function getRedemptionForEmails(bookProductId, emails, opts = {}) {
  const VALID = new Set(['completed', 'processing', 'on-hold']);
  const couponWanted = (opts.coupon || '').toLowerCase().trim();
  const result = new Map();
  const queue = [...new Set(emails.map(e => String(e).toLowerCase().trim()).filter(Boolean))];
  const CONC = 8;
  async function worker() {
    while (queue.length) {
      const email = queue.shift();
      try {
        const params = { product: bookProductId, search: email, per_page: 20, status: 'any', _fields: 'id,status,billing,coupon_lines,date_created' };
        if (opts.after) params.after = opts.after;
        const { data } = await wooGet('orders', params);
        let found = null;
        for (const o of (Array.isArray(data) ? data : [])) {
          if ((o.billing?.email || '').toLowerCase().trim() !== email) continue;
          if (!VALID.has(o.status)) continue;
          const coupons = (o.coupon_lines || []).map(c => String(c.code).toLowerCase()).filter(Boolean);
          const matches = couponWanted ? coupons.includes(couponWanted) : coupons.length > 0;
          if (matches) { found = { coupon: coupons.join(', '), status: o.status, orderId: o.id }; break; }
        }
        result.set(email, found);
      } catch {
        result.set(email, undefined); // erro de consulta -> desconhecido (tratado como pendente)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONC, queue.length || 1) }, worker));
  return result;
}
