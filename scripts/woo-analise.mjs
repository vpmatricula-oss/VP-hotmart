// Análise: cruza compradores da Suplementação (nossos logs) com resgates do livro no Woo.
import process from 'process';
try { process.loadEnvFile(); } catch {}

const SB = process.env.SUPABASE_URL, SK = process.env.SUPABASE_SERVICE_KEY;
const WOO = process.env.WOO_URL, CK = process.env.WOO_CK, CS = process.env.WOO_CS;
const HOTMART_PRODUCT_ID = 'prod_qe110i5'; // Suplementação - Turma 5
const BOOK_PRODUCT = '36519';
const auth = 'Basic ' + Buffer.from(`${CK}:${CS}`).toString('base64');

// 1) E-mails dos compradores da Suplementação (dos nossos logs)
const sbRes = await fetch(`${SB}/rest/v1/app_state?key=eq.hotmart_manychat_db&select=value`, { headers: { apikey: SK, Authorization: `Bearer ${SK}` } });
const db = (await sbRes.json())[0].value;
const buyers = new Map(); // email -> nome
for (const l of db.logs) {
  if (l.productId === HOTMART_PRODUCT_ID && l.buyerEmail) buyers.set(l.buyerEmail.toLowerCase().trim(), l.buyerName);
}
console.log('Compradores Suplementação (Hotmart):', buyers.size);

// 2) Resgates do livro no Woo (pedidos do produto COM cupom)
const redeemed = new Map(); // email -> {coupon, status}
for (let page = 1; page <= 20; page++) {
  const r = await fetch(`${WOO}/wp-json/wc/v3/orders?product=${BOOK_PRODUCT}&per_page=100&page=${page}&status=any`, { headers: { Authorization: auth } });
  const orders = await r.json();
  if (!Array.isArray(orders) || orders.length === 0) break;
  for (const o of orders) {
    const coupons = (o.coupon_lines || []).map(c => c.code);
    if (coupons.length === 0) continue; // só conta COM cupom
    const email = (o.billing?.email || '').toLowerCase().trim();
    if (email) redeemed.set(email, { coupon: coupons.join(','), status: o.status });
  }
  if (orders.length < 100) break;
}
console.log('Resgates do livro COM cupom (Woo):', redeemed.size);

// 3) Cruzamento
const ok = [], pendente = [];
for (const [email, nome] of buyers) {
  if (redeemed.has(email)) ok.push({ email, nome, ...redeemed.get(email) });
  else pendente.push({ email, nome });
}
const irregular = [];
for (const [email, info] of redeemed) {
  if (!buyers.has(email)) irregular.push({ email, ...info });
}

console.log('\n===== RESULTADO =====');
console.log('OK (comprou e já resgatou com cupom):', ok.length);
ok.forEach(x => console.log('  ✓', x.nome, '|', x.email, '| cupom:', x.coupon));
console.log('\nPENDENTES (comprou mas NÃO resgatou) -> recebem o livro:', pendente.length);
pendente.forEach(x => console.log('  ⏳', x.nome, '|', x.email));
console.log('\nIRREGULAR (resgatou com cupom mas NÃO está na lista da Suplementação):', irregular.length, '(só conta os do livro)');
