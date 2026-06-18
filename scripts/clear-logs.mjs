// Limpa os logs/vendas no Supabase (mantém produtos, configurações e cache de contatos).
const SB_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const DB_KEY = 'hotmart_manychat_db';
const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const get = await fetch(`${SB_URL}/rest/v1/app_state?key=eq.${DB_KEY}&select=value`, { headers: h });
const db = (await get.json())[0]?.value || {};
const antes = (db.logs || []).length;
db.logs = [];

const put = await fetch(`${SB_URL}/rest/v1/app_state?on_conflict=key`, {
  method: 'POST',
  headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify([{ key: DB_KEY, value: db }]),
});
console.log('Status:', put.status, '| logs removidos:', antes, '| logs agora: 0');
