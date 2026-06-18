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

// E-mails que JÁ resgataram o livro = pedido do produto COM cupom aplicado e status válido.
// Retorna Map(email_minusculo -> { coupon, status, orderId }).
export async function getBookRedeemers(bookProductId) {
  const VALID = new Set(['completed', 'processing', 'on-hold']);
  const out = new Map();
  const collect = (orders) => {
    for (const o of orders) {
      const coupons = (o.coupon_lines || []).map(c => c.code).filter(Boolean);
      if (!coupons.length) continue;
      if (!VALID.has(o.status)) continue;
      const email = (o.billing?.email || '').toLowerCase().trim();
      if (email && !out.has(email)) out.set(email, { coupon: coupons.join(', '), status: o.status, orderId: o.id });
    }
  };
  const base = { product: bookProductId, per_page: 100, status: 'any' };
  const first = await wooGet('orders', { ...base, page: 1 });
  collect(first.data);
  const pages = Math.min(first.totalPages, 40); // teto de segurança
  if (pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) => wooGet('orders', { ...base, page: i + 2 }))
    );
    rest.forEach(r => collect(r.data));
  }
  return out;
}
