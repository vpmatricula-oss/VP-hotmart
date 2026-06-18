// Semeia o cache telefone->subscriber_id no Supabase (contatos que já existem no ManyChat).
import process from 'process';

const SB_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const DB_KEY = 'hotmart_manychat_db';

const KNOWN = {
  '+5515981193053': '639409566',
  '+5511978522207': '69340533',
};

const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const get = await fetch(`${SB_URL}/rest/v1/app_state?key=eq.${DB_KEY}&select=value`, { headers: h });
const rows = await get.json();
const db = rows[0]?.value || { products: [], logs: [], settings: {} };
db.subscribers = { ...(db.subscribers || {}), ...KNOWN };

const put = await fetch(`${SB_URL}/rest/v1/app_state?on_conflict=key`, {
  method: 'POST',
  headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify([{ key: DB_KEY, value: db }]),
});
console.log('Status:', put.status);
if (!put.ok) { console.error(await put.text()); process.exit(1); }
console.log('✅ Cache de contatos semeado:', Object.keys(db.subscribers).length, 'contato(s)');
