import './lib/load-env.js'; // PRECISA ser o primeiro import (carrega o .env antes de tudo)
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { store } from './lib/store.js';
import { enviarBoasVindas } from './lib/manychat.js';
import { auth } from './lib/auth.js';
import { wooEnabled, wooPing, getBookRedeemers } from './lib/woocommerce.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const app = express();
const PORT = process.env.PORT || 3000;

// Cache de contatos do ManyChat (telefone -> subscriber_id), guardado no nosso banco.
const subscriberCache = {
  get: (phone) => store.getSubscriber(phone),
  set: (phone, id) => store.saveSubscriber(phone, id),
};

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Arquivos estáticos (css/js), MENOS o index.html — a home é protegida abaixo.
app.use(express.static(PUBLIC, { index: false }));

// ----------------------- Autenticação -----------------------
app.get('/login', (req, res) => {
  if (auth.isLogged(req)) return res.redirect('/');
  res.sendFile(path.join(PUBLIC, 'login.html'));
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (auth.checkCredentials(email, password)) {
    res.setHeader('Set-Cookie', auth.makeCookie());
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'E-mail ou senha inválidos' });
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', auth.clearCookie());
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => res.json({ logged: auth.isLogged(req), authEnabled: auth.enabled }));

// Home (painel) — protegida por login.
app.get('/', auth.requireAuth, (req, res) => res.sendFile(path.join(PUBLIC, 'index.html')));

// ----------------------- API: Produtos -----------------------
app.get('/api/products', auth.requireAuth, async (req, res) => res.json(await store.getProducts()));

app.post('/api/products', auth.requireAuth, async (req, res) => res.json(await store.addProduct(req.body)));

app.put('/api/products/:id', auth.requireAuth, async (req, res) => {
  const p = await store.updateProduct(req.params.id, req.body);
  if (!p) return res.status(404).json({ error: 'Produto não encontrado' });
  res.json(p);
});

app.delete('/api/products/:id', auth.requireAuth, async (req, res) => {
  await store.deleteProduct(req.params.id);
  res.json({ ok: true });
});

// ----------------------- API: Configurações -----------------------
app.get('/api/settings', auth.requireAuth, async (req, res) => {
  const s = await store.getSettings();
  res.json({
    hasManychatToken: !!s.manychatToken,
    manychatTokenMasked: s.manychatToken ? '••••••' + s.manychatToken.slice(-4) : '',
    hotmartHottok: s.hotmartHottok || '',
    defaultCountryCode: s.defaultCountryCode || '55',
    backend: store.backend,
  });
});

app.post('/api/settings', auth.requireAuth, async (req, res) => {
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
app.get('/api/logs', auth.requireAuth, async (req, res) => res.json(await store.getLogs()));

app.delete('/api/logs/:id', auth.requireAuth, async (req, res) => {
  await store.deleteLog(req.params.id);
  res.json({ ok: true });
});

// Reprocessa (reenvia) o disparo de um registro de venda.
app.post('/api/logs/:id/reprocess', auth.requireAuth, async (req, res) => {
  const log = await store.getLog(req.params.id);
  if (!log) return res.status(404).json({ error: 'Registro não encontrado' });
  const produto = log.productId ? await store.getProduct(log.productId) : null;
  if (!produto) return res.status(400).json({ error: 'Registro antigo sem produto vinculado — não dá para reprocessar.' });
  if (!log.buyerPhone) return res.status(400).json({ error: 'Registro sem telefone — não dá para reprocessar.' });
  try {
    const s = await store.getSettings();
    const r = await enviarBoasVindas({
      token: s.manychatToken,
      countryCode: s.defaultCountryCode,
      produto,
      buyer: { name: log.buyerName, checkout_phone: log.buyerPhone, email: log.buyerEmail, document: log.buyerDocument },
      cache: subscriberCache,
    });
    await store.updateLog(log.id, { status: 'enviado', error: '', detail: `reprocessado · subscriber ${r.subscriberId}` });
    res.json({ ok: true });
  } catch (e) {
    await store.updateLog(log.id, { status: 'falhou', error: e.message });
    res.status(400).json({ ok: false, error: e.message });
  }
});

// ----------------------- API: Teste de envio manual -----------------------
app.post('/api/test-send', auth.requireAuth, async (req, res) => {
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
      cache: subscriberCache,
    });
    await store.addLog({ event: 'TESTE_MANUAL', productId: produto.id, productName: produto.name, buyerName: name || 'Teste', buyerPhone: phone, status: 'enviado', detail: `subscriber ${r.subscriberId}` });
    res.json({ ok: true, ...r });
  } catch (e) {
    await store.addLog({ event: 'TESTE_MANUAL', status: 'falhou', error: e.message });
    res.status(400).json({ error: e.message });
  }
});

// ----------------------- API: Disparo em massa (1 destinatário por chamada) -----------------------
app.post('/api/send-welcome', auth.requireAuth, async (req, res) => {
  const { productId, name, phone, email, document } = req.body || {};
  const produto = await store.getProduct(productId);
  if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
  try {
    const s = await store.getSettings();
    const r = await enviarBoasVindas({
      token: s.manychatToken,
      countryCode: s.defaultCountryCode,
      produto,
      buyer: { name, checkout_phone: phone, email, document },
      cache: subscriberCache,
    });
    await store.addLog({ event: 'DISPARO_MASSA', productId: produto.id, productName: produto.name, buyerName: name || '—', buyerPhone: phone || '', buyerEmail: email || '', buyerDocument: document || '', status: 'enviado', detail: `subscriber ${r.subscriberId}` });
    res.json({ ok: true });
  } catch (e) {
    await store.addLog({ event: 'DISPARO_MASSA', productId: produto.id, productName: produto.name, buyerName: name || '—', buyerPhone: phone || '', buyerEmail: email || '', buyerDocument: document || '', status: 'falhou', error: e.message });
    res.status(400).json({ ok: false, error: e.message });
  }
});

// ----------------------- API: Livro (cruzamento WooCommerce) -----------------------
app.get('/api/livro/status', auth.requireAuth, async (req, res) => {
  res.json({ wooEnabled, ...(wooEnabled ? await wooPing() : {}) });
});

// Cruza compradores (Hotmart, dos logs) com quem já resgatou o livro no Woo (pedido com cupom).
app.get('/api/livro/cross', auth.requireAuth, async (req, res) => {
  try {
    const produto = await store.getProduct(req.query.productId);
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    if (!produto.livroWooProductId) return res.status(400).json({ error: 'Configure o ID do livro (Woo) na aba deste produto.' });
    if (!wooEnabled) return res.status(400).json({ error: 'WooCommerce não está configurado no servidor.' });

    // Compradores deste produto (e-mails únicos, a partir dos logs)
    const logs = await store.getLogs();
    const buyers = new Map();
    for (const l of logs) {
      if (l.productId === produto.id && l.buyerEmail) {
        const e = l.buyerEmail.toLowerCase().trim();
        if (!buyers.has(e)) buyers.set(e, { email: l.buyerEmail, name: l.buyerName || '—', phone: l.buyerPhone || '', document: l.buyerDocument || '' });
      }
    }

    const redeemers = await getBookRedeemers(produto.livroWooProductId);
    const ok = [], pendente = [];
    for (const [email, info] of buyers) {
      if (redeemers.has(email)) ok.push({ ...info, woo: redeemers.get(email) });
      else pendente.push(info);
    }
    res.json({
      produto: produto.name,
      hasBookFlow: !!produto.livroFlowNs,
      buyers: buyers.size,
      redeemersTotal: redeemers.size,
      ok, pendente,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Dispara a mensagem do livro para UM destinatário (frontend faz o loop, evita timeout).
app.post('/api/livro/send-one', auth.requireAuth, async (req, res) => {
  const { productId, name, phone, email, document } = req.body || {};
  const produto = await store.getProduct(productId);
  if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
  if (!produto.livroFlowNs) return res.status(400).json({ error: 'Configure o Flow do livro (ManyChat) na aba deste produto.' });
  try {
    const s = await store.getSettings();
    const r = await enviarBoasVindas({
      token: s.manychatToken, countryCode: s.defaultCountryCode, produto,
      buyer: { name, checkout_phone: phone, email, document }, cache: subscriberCache,
      flowNs: produto.livroFlowNs,
    });
    await store.addLog({ event: 'LIVRO', productId: produto.id, productName: produto.name, buyerName: name || '—', buyerPhone: phone || '', buyerEmail: email || '', buyerDocument: document || '', status: 'enviado', detail: `livro · subscriber ${r.subscriberId}` });
    res.json({ ok: true });
  } catch (e) {
    await store.addLog({ event: 'LIVRO', productId: produto.id, productName: produto.name, buyerName: name || '—', buyerPhone: phone || '', buyerEmail: email || '', buyerDocument: document || '', status: 'falhou', error: e.message });
    res.status(400).json({ ok: false, error: e.message });
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
    productId: produto?.id || '', // ID fixo (não muda em renomeações) -> usado no filtro
    productName: produto?.name || product.name || '—', // nome no momento da venda
    buyerName: buyer.name || '—',
    buyerEmail: buyer.email || '',
    buyerPhone: buyer.checkout_phone || buyer.phone || '',
    buyerDocument: buyer.document || buyer.cpf || buyer.doc || '', // CPF
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
      cache: subscriberCache,
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
