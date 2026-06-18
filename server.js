import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { store } from './lib/store.js';
import { enviarBoasVindas } from './lib/manychat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------- API: Produtos -----------------------
app.get('/api/products', async (req, res) => res.json(await store.getProducts()));

app.post('/api/products', async (req, res) => res.json(await store.addProduct(req.body)));

app.put('/api/products/:id', async (req, res) => {
  const p = await store.updateProduct(req.params.id, req.body);
  if (!p) return res.status(404).json({ error: 'Produto não encontrado' });
  res.json(p);
});

app.delete('/api/products/:id', async (req, res) => {
  await store.deleteProduct(req.params.id);
  res.json({ ok: true });
});

// ----------------------- API: Configurações -----------------------
app.get('/api/settings', async (req, res) => {
  const s = await store.getSettings();
  res.json({
    hasManychatToken: !!s.manychatToken,
    manychatTokenMasked: s.manychatToken ? '••••••' + s.manychatToken.slice(-4) : '',
    hotmartHottok: s.hotmartHottok || '',
    defaultCountryCode: s.defaultCountryCode || '55',
    backend: store.backend,
  });
});

app.post('/api/settings', async (req, res) => {
  const patch = {};
  if (typeof req.body.manychatToken === 'string' && req.body.manychatToken.trim()) {
    patch.manychatToken = req.body.manychatToken.trim();
  }
  if (typeof req.body.hotmartHottok === 'string') patch.hotmartHottok = req.body.hotmartHottok.trim();
  if (typeof req.body.defaultCountryCode === 'string') patch.defaultCountryCode = req.body.defaultCountryCode.trim() || '55';
  await store.saveSettings(patch);
  res.json({ ok: true });
});

// ----------------------- API: Logs / Vendas -----------------------
app.get('/api/logs', async (req, res) => res.json(await store.getLogs()));

// ----------------------- API: Teste de envio manual -----------------------
app.post('/api/test-send', async (req, res) => {
  try {
    const { productId, phone, name } = req.body;
    const produto = await store.getProduct(productId);
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    const s = await store.getSettings();
    const r = await enviarBoasVindas({
      token: s.manychatToken,
      countryCode: s.defaultCountryCode,
      produto,
      buyer: { name: name || 'Teste', checkout_phone: phone },
    });
    await store.addLog({ event: 'TESTE_MANUAL', productName: produto.name, buyerName: name || 'Teste', buyerPhone: phone, status: 'enviado', detail: `subscriber ${r.subscriberId}` });
    res.json({ ok: true, ...r });
  } catch (e) {
    await store.addLog({ event: 'TESTE_MANUAL', status: 'falhou', error: e.message });
    res.status(400).json({ error: e.message });
  }
});

// ----------------------- Webhook da Hotmart -----------------------
// Configure na Hotmart: https://SEU-DOMINIO/webhook/hotmart
app.post('/webhook/hotmart', async (req, res) => {
  const body = req.body || {};
  const settings = await store.getSettings();

  // Validação do hottok (token de segurança da Hotmart), se configurado.
  const hottok = req.query.hottok || body.hottok || req.headers['x-hotmart-hottok'];
  if (settings.hotmartHottok && hottok !== settings.hotmartHottok) {
    await store.addLog({ event: 'WEBHOOK', status: 'rejeitado', error: 'hottok inválido' });
    return res.status(401).json({ error: 'hottok inválido' });
  }

  // O payload da Hotmart v2 vem em body.data; versões antigas vêm no topo.
  const data = body.data || body;
  const product = data.product || { id: body.prod, name: body.prod_name };
  const buyer = data.buyer || { name: body.name, email: body.email, checkout_phone: body.phone };
  const event = body.event || data.purchase?.status || body.status;
  const isApproved = event === 'PURCHASE_APPROVED' || data.purchase?.status === 'APPROVED' || event === 'approved';

  // Cria a aba do produto automaticamente se for a primeira vez que ele aparece.
  let produto = await store.findProductByHotmartId(product.id);
  if (!produto && product.id) {
    produto = await store.addProduct({
      hotmartProductId: product.id,
      name: product.name || `Produto ${product.id}`,
      auto: true,
      active: false, // entra desativado até você configurar o template
    });
  }

  const log = {
    event: event || 'desconhecido',
    productName: product.name || produto?.name || '—',
    buyerName: buyer.name || '—',
    buyerEmail: buyer.email || '',
    buyerPhone: buyer.checkout_phone || buyer.phone || '',
    status: 'recebido',
  };

  if (!isApproved) {
    log.status = `ignorado (${event || 'sem status'})`;
    await store.addLog(log);
    return res.json({ ok: true, ignored: true });
  }

  try {
    if (!produto) throw new Error('Produto não identificado no payload.');
    if (produto.active === false) throw new Error('Produto está desativado/sem configuração no painel.');
    const r = await enviarBoasVindas({
      token: settings.manychatToken,
      countryCode: settings.defaultCountryCode,
      produto,
      buyer,
    });
    log.status = 'enviado';
    log.detail = `ManyChat subscriber ${r.subscriberId}`;
  } catch (e) {
    log.status = 'falhou';
    log.error = e.message;
  }
  await store.addLog(log);
  res.json({ ok: true, status: log.status });
});

// Healthcheck simples
app.get('/api/health', (req, res) => res.json({ ok: true, backend: store.backend, time: new Date().toISOString() }));

// Em produção na Vercel, o app é exportado como função serverless.
// Localmente (npm start), sobe o servidor normal.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log('\n  ✅ Painel Hotmart + ManyChat rodando!');
    console.log(`  🔗 Abra no navegador:  http://localhost:${PORT}`);
    console.log(`  📩 Webhook da Hotmart:  http://localhost:${PORT}/webhook/hotmart`);
    console.log(`  💾 Armazenamento: ${store.backend}\n`);
  });
}

export default app;
