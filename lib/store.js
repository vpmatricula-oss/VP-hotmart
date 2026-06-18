// Armazenamento com 2 backends automáticos:
//  - LOCAL (seu PC):   arquivo data/db.json
//  - VERCEL (produção): Vercel KV / Upstash Redis (via REST), detectado pelas variáveis de ambiente.
// A API é a mesma (assíncrona) nos dois casos.
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');
const KEY = 'hotmart_manychat_db';

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const useKV = !!(KV_URL && KV_TOKEN);

const EMPTY = { products: [], logs: [], settings: {} };
const PALETTE = ['#F04E23', '#7C3AED', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#6366F1', '#14B8A6'];
const newId = (p = 'p') => p + '_' + Math.random().toString(36).slice(2, 9);

// ---------------- Backend: Vercel KV / Upstash (REST) ----------------
async function kvCmd(cmd) {
  const res = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error('KV ' + res.status);
  return (await res.json()).result;
}

// ---------------- Leitura/escrita do "banco" inteiro ----------------
async function loadDB() {
  if (useKV) {
    const raw = await kvCmd(['GET', KEY]);
    if (!raw) return structuredClone(EMPTY);
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch { return structuredClone(EMPTY); }
  }
  // arquivo local
  try {
    return JSON.parse(await fs.readFile(DB_PATH, 'utf8'));
  } catch {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true }).catch(() => {});
    await fs.writeFile(DB_PATH, JSON.stringify(EMPTY, null, 2)).catch(() => {});
    return structuredClone(EMPTY);
  }
}

async function saveDB(db) {
  if (useKV) return void (await kvCmd(['SET', KEY, JSON.stringify(db)]));
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true }).catch(() => {});
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

export const store = {
  backend: useKV ? 'vercel-kv' : 'arquivo-local',

  // ---------- Produtos ----------
  async getProducts() { return (await loadDB()).products; },

  async getProduct(id) { return (await loadDB()).products.find(p => p.id === id) || null; },

  async findProductByHotmartId(hotmartId) {
    if (!hotmartId) return null;
    const db = await loadDB();
    return db.products.find(p => String(p.hotmartProductId) === String(hotmartId)) || null;
  },

  async addProduct(data) {
    const db = await loadDB();
    const product = {
      id: newId('prod'),
      name: data.name || 'Novo produto',
      hotmartProductId: data.hotmartProductId ? String(data.hotmartProductId) : '',
      color: data.color || PALETTE[db.products.length % PALETTE.length],
      manychatFlowNs: data.manychatFlowNs || '',
      whatsappGroupLink: data.whatsappGroupLink || '',
      welcomeTemplate: data.welcomeTemplate || '',
      active: data.active !== false,
      auto: !!data.auto,
      createdAt: new Date().toISOString(),
    };
    db.products.push(product);
    await saveDB(db);
    return product;
  },

  async updateProduct(id, patch) {
    const db = await loadDB();
    const p = db.products.find(x => x.id === id);
    if (!p) return null;
    Object.assign(p, patch, { id: p.id, createdAt: p.createdAt });
    await saveDB(db);
    return p;
  },

  async deleteProduct(id) {
    const db = await loadDB();
    db.products = db.products.filter(p => p.id !== id);
    await saveDB(db);
    return true;
  },

  // ---------- Configurações ----------
  async getSettings() {
    const s = (await loadDB()).settings || {};
    return { manychatToken: '', hotmartHottok: '', defaultCountryCode: '55', ...s };
  },
  async saveSettings(patch) {
    const db = await loadDB();
    db.settings = { ...db.settings, ...patch };
    await saveDB(db);
    return { manychatToken: '', hotmartHottok: '', defaultCountryCode: '55', ...db.settings };
  },

  // ---------- Logs / Vendas ----------
  async getLogs() { return (await loadDB()).logs.slice(0, 200); },
  async addLog(entry) {
    const db = await loadDB();
    db.logs.unshift({ id: newId('log'), at: new Date().toISOString(), ...entry });
    db.logs = db.logs.slice(0, 500);
    await saveDB(db);
  },
};
