// Disparo retroativo a partir de um CSV de vendas da Hotmart.
// Uso: node scripts/backfill-csv.mjs "<arquivo.csv>"
//   env: PRODUCT_ID (id do produto no painel), PRODUCT_CODE (código Hotmart p/ filtrar), DRY=1 (só lista)
import fs from 'fs';
try { process.loadEnvFile(); } catch {}

const BASE = process.env.BASE || 'http://localhost:3000';
const EMAIL = process.env.AUTH_EMAIL;
const PASS = process.env.AUTH_PASSWORD;
const PRODUCT_ID = process.env.PRODUCT_ID || 'prod_qe110i5';
const PRODUCT_CODE = process.env.PRODUCT_CODE || '5038677';
const DRY = process.env.DRY === '1';
const CSV = process.argv[2];

// Colunas do export da Hotmart (0-based)
const C = { status: 1, prodCode: 5, name: 38, email: 39, phone: 41, doc: 42 };

const text = fs.readFileSync(CSV, 'utf8');
const lines = text.split(/\r?\n/).filter(l => l.trim());
const recipients = [];
const seen = new Set();
for (let i = 1; i < lines.length; i++) {
  const c = lines[i].split(';').map(x => x.replace(/^"|"$/g, '').trim());
  if (String(c[C.prodCode]) !== String(PRODUCT_CODE)) continue;
  if (!/aprovad/i.test(c[C.status] || '')) continue;
  const phone = c[C.phone] || '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) continue;
  if (seen.has(digits)) continue;
  seen.add(digits);
  recipients.push({ name: c[C.name], email: c[C.email], phone, document: c[C.doc] });
}

console.log(`\n== ${recipients.length} destinatário(s) (produto ${PRODUCT_CODE}, status Aprovado) ==`);
recipients.forEach((r, i) => console.log(`${String(i + 1).padStart(2)}. ${r.phone}  |  ${r.name}  |  ${r.email}`));

if (DRY) { console.log('\n[DRY-RUN] Nada foi enviado.'); process.exit(0); }

// Login
const loginRes = await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASS }) });
if (!loginRes.ok) { console.error('Login falhou'); process.exit(1); }
const cookie = (loginRes.headers.get('set-cookie') || '').split(';')[0];

let ok = 0, fail = 0; const fails = [];
for (let i = 0; i < recipients.length; i++) {
  const r = recipients[i];
  process.stdout.write(`[${i + 1}/${recipients.length}] ${r.name} ${r.phone} ... `);
  try {
    const res = await fetch(`${BASE}/api/send-welcome`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ productId: PRODUCT_ID, name: r.name, phone: r.phone, email: r.email, document: r.document }) });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.ok) { ok++; console.log('OK'); }
    else { fail++; console.log('FALHOU:', j.error || res.status); fails.push(`${r.name} ${r.phone}: ${j.error || res.status}`); }
  } catch (e) { fail++; console.log('ERRO', e.message); fails.push(`${r.name} ${r.phone}: ${e.message}`); }
}
console.log(`\n== Concluído: ${ok} enviados, ${fail} falhas (de ${recipients.length}) ==`);
if (fails.length) console.log('Falhas:\n' + fails.join('\n'));
