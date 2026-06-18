// Migra o conteúdo de data/db.json para o Supabase (tabela app_state).
// Uso: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed-supabase.mjs
import fs from 'fs';

const SB_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const DB_KEY = 'hotmart_manychat_db';

if (!SB_URL || !KEY) { console.error('Faltam SUPABASE_URL/SUPABASE_SERVICE_KEY'); process.exit(1); }

const db = JSON.parse(fs.readFileSync(new URL('../data/db.json', import.meta.url), 'utf8'));

const res = await fetch(`${SB_URL}/rest/v1/app_state?on_conflict=key`, {
  method: 'POST',
  headers: {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  },
  body: JSON.stringify([{ key: DB_KEY, value: db }]),
});

console.log('Status:', res.status);
if (!res.ok) { console.error(await res.text()); process.exit(1); }
console.log('✅ Dados migrados:', db.products.length, 'produto(s),', db.logs.length, 'log(s)');
