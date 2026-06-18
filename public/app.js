// ====================== Estado & helpers ======================
const state = { products: [], current: null, view: 'product' };
const $ = (s, el = document) => el.querySelector(s);
async function handle(res) {
  if (res.status === 401) { window.location = '/login'; throw new Error('401'); }
  return res.json();
}
const api = {
  get: (u) => fetch(u).then(handle),
  post: (u, b) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(handle),
  put: (u, b) => fetch(u, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(handle),
  del: (u) => fetch(u, { method: 'DELETE' }).then(handle),
};
async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location = '/login';
}
window.logout = logout;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function toast(msg, isErr = false) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast show' + (isErr ? ' err' : '');
  setTimeout(() => (t.className = 'toast'), 2600);
}

// ====================== Carga inicial ======================
async function boot() {
  await loadProducts();
  await checkConn();
  setInterval(checkConn, 15000);

  document.querySelectorAll('.general-nav .nav-item').forEach(b =>
    b.addEventListener('click', () => selectView(b.dataset.view)));
  $('#add-product').addEventListener('click', addProduct);

  if (state.products.length) selectProduct(state.products[0].id);
  else selectView('product'); // tela vazia
}

async function loadProducts() {
  state.products = await api.get('/api/products');
  renderTabs();
}

function renderTabs() {
  const nav = $('#product-tabs');
  nav.innerHTML = '';
  if (!state.products.length) {
    nav.innerHTML = `<div style="font-size:12px;color:var(--muted);padding:8px 12px">Nenhum produto ainda.</div>`;
  }
  state.products.forEach(p => {
    const b = document.createElement('button');
    b.className = 'tab' + (state.view === 'product' && state.current === p.id ? ' active' : '');
    b.innerHTML = `<span class="swatch" style="background:${p.color}"></span>
      <span class="tab-name">${esc(p.name)}</span>
      <span class="mini-badge ${p.active ? 'on' : ''}">${p.active ? 'ON' : 'OFF'}</span>`;
    b.onclick = () => selectProduct(p.id);
    nav.appendChild(b);
  });
}

function setNavActive() {
  document.querySelectorAll('.general-nav .nav-item').forEach(b =>
    b.classList.toggle('active', state.view === b.dataset.view));
  renderTabs();
}

// ====================== Navegação ======================
function selectProduct(id) { state.view = 'product'; state.current = id; setNavActive(); renderProduct(); }
function selectView(v) {
  state.view = v; state.current = null; setNavActive();
  if (v === 'sales') return renderSales();
  if (v === 'settings') return renderSettings();
  if (v === 'guide') return renderGuide();
  if (v === 'livro') return renderLivro();
  renderEmpty();
}

async function addProduct() {
  const p = await api.post('/api/products', { name: 'Novo produto', active: false });
  await loadProducts();
  selectProduct(p.id);
  toast('Produto criado ✨');
}

// ====================== Tela: Produto ======================
function renderEmpty() {
  $('#view').innerHTML = `<div class="empty"><div class="big">🚀</div>
    <h2>Comece criando seu primeiro produto</h2>
    <p>Cada produto da Hotmart vira uma aba aqui. Configure o template do ManyChat e o link do grupo.</p>
    <br><button class="btn btn-primary" onclick="addProduct()">＋ Criar produto</button></div>`;
}

function renderProduct() {
  const p = state.products.find(x => x.id === state.current);
  if (!p) return renderEmpty();
  $('#view').innerHTML = `
    <div class="page-head">
      <h1><span class="swatch" style="width:16px;height:16px;border-radius:5px;background:${p.color}"></span>
        ${esc(p.name)}
        ${p.auto ? '<span class="auto-flag">criado pela Hotmart</span>' : ''}
        <span class="pill ${p.active ? 'on' : 'off'}">${p.active ? 'Ativo' : 'Inativo'}</span>
      </h1>
      <p>Configure o disparo de boas-vindas deste produto.</p>
    </div>

    <div class="card">
      <h3>Dados do produto</h3>
      <p class="hint">O ID da Hotmart é usado para identificar qual produto foi vendido.</p>
      <div class="row">
        <div class="field"><label>Nome do produto</label>
          <input class="input" id="f-name" value="${esc(p.name)}" /></div>
        <div class="field"><label>ID do produto na Hotmart</label>
          <div class="desc">Encontra em: Produtos → seu produto → ID</div>
          <input class="input" id="f-hot" value="${esc(p.hotmartProductId)}" placeholder="ex: 1234567" /></div>
      </div>
      <div class="field"><label>Cor da aba</label>
        <input type="color" id="f-color" value="${p.color}" style="width:60px;height:40px;border:none;border-radius:10px;cursor:pointer" /></div>
    </div>

    <div class="card">
      <h3>Template do ManyChat 🤖</h3>
      <p class="hint">Quando a compra for aprovada, o sistema dispara este flow/template aprovado para o aluno.</p>
      <div style="background:#fff7e6;border:1px solid #ffe2b8;border-radius:10px;padding:11px 13px;font-size:13px;color:#8a6d3b;margin-bottom:16px;line-height:1.5">
        💬 <b>A mensagem que o aluno recebe fica no ManyChat.</b><br>
        Para alterar o texto, edite o <b>template/flow dentro do ManyChat</b>. Os campos abaixo são só a ligação/configuração.
      </div>
      <div class="field"><label>Nome do modelo (referência)</label>
        <div class="desc">Só pra você se localizar depois — o nome do template no ManyChat. Ex: <b>Marcio 18.06</b></div>
        <input class="input" id="f-tpl-name" value="${esc(p.templateName || '')}" placeholder="ex: Marcio 18.06" /></div>
      <div class="field"><label>Flow ID do ManyChat (flow_ns)</label>
        <div class="desc">No ManyChat: Automation → seu Flow → ⋯ → Get Flow API Trigger (começa com <b>content...</b>)</div>
        <input class="input" id="f-flow" value="${esc(p.manychatFlowNs)}" placeholder="ex: content20240101000000_123456" /></div>
      <div class="field"><label>Link do grupo de WhatsApp</label>
        <div class="desc">Disponível no template como <b>{{whatsapp_link}}</b></div>
        <input class="input" id="f-wa" value="${esc(p.whatsappGroupLink)}" placeholder="https://chat.whatsapp.com/..." /></div>
    </div>

    <div class="card">
      <h3>📕 Livro (resgate via WooCommerce)</h3>
      <p class="hint">Usado na aba "📕 Livro": cruza quem comprou aqui com quem já resgatou o livro na loja.</p>
      <div class="field"><label>ID do livro no WooCommerce</label>
        <div class="desc">O ID do produto do livro na loja. Ex: <b>36519</b> (Suplementação).</div>
        <input class="input" id="f-livro-woo" value="${esc(p.livroWooProductId || '')}" placeholder="ex: 36519" /></div>
      <div class="field"><label>Flow ID da mensagem do livro (ManyChat)</label>
        <div class="desc">O flow (<b>content...</b>) que será disparado no "📕 Livro". Pode ser diferente do de boas-vindas.</div>
        <input class="input" id="f-livro-flow" value="${esc(p.livroFlowNs || '')}" placeholder="ex: content2026...." /></div>
      <div class="row">
        <div class="field"><label>Cupom do resgate (opcional)</label>
          <div class="desc">Só conta como "já resgatou" se usou ESTE cupom. Vazio = qualquer cupom.</div>
          <input class="input" id="f-livro-cupom" value="${esc(p.livroCoupon || '')}" placeholder="ex: 5hv65dnx" /></div>
        <div class="field"><label>Considerar compras a partir de</label>
          <div class="desc">Ignora compradores antes desta data.</div>
          <input class="input" type="date" id="f-livro-desde" value="${esc(p.livroDesde || '')}" /></div>
      </div>
    </div>

    <div class="card">
      <h3>Teste de envio 🧪</h3>
      <p class="hint">Dispare o template para um número agora para validar a integração.</p>
      <div class="row">
        <div class="field"><label>Telefone (com DDD)</label><input class="input" id="t-phone" placeholder="ex: 11999998888" /></div>
        <div class="field"><label>Nome</label><input class="input" id="t-name" placeholder="ex: Maria" value="Aluno Teste" /></div>
      </div>
      <button class="btn btn-ghost" id="btn-test">📤 Enviar teste</button>
    </div>

    <div class="btn-row">
      <label class="switch"><input type="checkbox" id="f-active" ${p.active ? 'checked' : ''}><span class="track"></span>
        Produto ativo (dispara automático)</label>
      <span class="spacer"></span>
      <button class="btn btn-danger" id="btn-del">🗑 Excluir</button>
      <button class="btn btn-primary" id="btn-save">💾 Salvar</button>
    </div>`;

  $('#btn-save').onclick = () => saveProduct(p.id);
  $('#btn-del').onclick = () => delProduct(p.id);
  $('#btn-test').onclick = () => testSend(p.id);
}

async function saveProduct(id) {
  const patch = {
    name: $('#f-name').value.trim() || 'Produto',
    hotmartProductId: $('#f-hot').value.trim(),
    color: $('#f-color').value,
    manychatFlowNs: $('#f-flow').value.trim(),
    whatsappGroupLink: $('#f-wa').value.trim(),
    templateName: $('#f-tpl-name').value.trim(),
    livroWooProductId: $('#f-livro-woo').value.trim(),
    livroFlowNs: $('#f-livro-flow').value.trim(),
    livroCoupon: $('#f-livro-cupom').value.trim(),
    livroDesde: $('#f-livro-desde').value.trim(),
    active: $('#f-active').checked,
  };
  await api.put('/api/products/' + id, patch);
  await loadProducts();
  renderProduct();
  toast('Salvo com sucesso ✅');
}

async function delProduct(id) {
  if (!confirm('Excluir este produto?')) return;
  await api.del('/api/products/' + id);
  await loadProducts();
  state.products.length ? selectProduct(state.products[0].id) : (selectView('product'), renderEmpty());
  toast('Produto excluído');
}

async function testSend(id) {
  const phone = $('#t-phone').value.trim();
  if (!phone) return toast('Informe um telefone', true);
  const btn = $('#btn-test'); btn.textContent = 'Enviando…'; btn.disabled = true;
  const r = await api.post('/api/test-send', { productId: id, phone, name: $('#t-name').value.trim() });
  btn.textContent = '📤 Enviar teste'; btn.disabled = false;
  r.ok ? toast('Mensagem enviada! 🎉') : toast('Erro: ' + (r.error || 'falhou'), true);
}

// ====================== Tela: Vendas / Logs ======================
let salesLogs = [];

async function renderSales() {
  salesLogs = await api.get('/api/logs');

  // Filtro lista APENAS os produtos que existem hoje (value = ID fixo, label = nome atual).
  const opts = [...state.products]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');

  $('#view').innerHTML = `
    <div class="page-head"><h1>📊 Vendas &amp; Logs</h1>
      <p>Cada compra recebida da Hotmart e o resultado do disparo no ManyChat.</p></div>

    <div class="card" style="padding:16px 18px">
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end">
        <div class="field" style="margin:0;flex:1;min-width:200px">
          <label>Produto</label>
          <select class="select" id="f-prod">
            <option value="">📦 Todos os produtos</option>
            ${opts}
          </select>
        </div>
        <div class="field" style="margin:0;min-width:170px">
          <label>Status</label>
          <select class="select" id="f-status">
            <option value="">Todos os status</option>
            <option value="enviado">✅ Enviado</option>
            <option value="falhou">❌ Falhou</option>
            <option value="ignorado">⏭️ Ignorado</option>
          </select>
        </div>
        <button class="btn btn-ghost" id="f-clear">Limpar</button>
        <button class="btn btn-ghost" id="f-export-xls">⬇️ Excel</button>
        <button class="btn btn-ghost" id="f-export-csv">⬇️ CSV</button>
      </div>
    </div>

    <div class="card" style="padding:8px"><div id="sales-table"></div></div>`;

  $('#f-prod').addEventListener('change', applySalesFilter);
  $('#f-status').addEventListener('change', applySalesFilter);
  $('#f-clear').onclick = () => { $('#f-prod').value = ''; $('#f-status').value = ''; applySalesFilter(); };
  $('#f-export-xls').onclick = exportSalesXLS;
  $('#f-export-csv').onclick = exportSalesCSV;
  applySalesFilter();
}

let salesFiltered = [];
// Nome atual do produto de um log (resolve pelo ID fixo; respeita renomeações).
function logProductName(l) {
  if (l.productId) {
    const p = state.products.find(x => x.id === l.productId);
    if (p) return p.name;
  }
  return l.productName || '—';
}
let salesPage = 1;
const SALES_PER_PAGE = 15;

function applySalesFilter() {
  const prod = $('#f-prod').value; // id do produto
  const status = $('#f-status').value;
  salesFiltered = salesLogs.filter(l => {
    const okProd = !prod || l.productId === prod;
    const okStatus = !status || (l.status || '').toLowerCase().includes(status);
    return okProd && okStatus;
  });
  salesPage = 1;
  renderSalesTable();
}

function gotoSalesPage(p) { salesPage = p; renderSalesTable(); }
window.gotoSalesPage = gotoSalesPage;

async function reloadSalesData() {
  salesLogs = await api.get('/api/logs');
  applySalesFilter();
}
async function deleteLog(id) {
  if (!confirm('Excluir este registro de venda? (não cancela a compra, só remove da lista)')) return;
  await api.del('/api/logs/' + id);
  await reloadSalesData();
  toast('Registro excluído 🗑');
}
async function reprocessLog(id, btn) {
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  const r = await api.post('/api/logs/' + id + '/reprocess', {});
  if (r && r.ok) toast('Mensagem reenviada ✅');
  else toast('Falhou: ' + (r?.error || 'erro'), true);
  await reloadSalesData();
}
window.deleteLog = deleteLog;
window.reprocessLog = reprocessLog;

function exportSalesXLS() {
  const head = ['Data', 'Produto', 'Nome', 'Telefone', 'Email', 'CPF', 'Evento', 'Status', 'Erro'];
  const cell = (s) => `<td style="mso-number-format:'\\@'">${esc(s ?? '')}</td>`; // formato texto (preserva CPF/telefone)
  let body = '';
  salesFiltered.forEach(l => {
    const cols = [
      new Date(l.at).toLocaleString('pt-BR'), logProductName(l), l.buyerName || '',
      l.buyerPhone || '', l.buyerEmail || '', l.buyerDocument || '', l.event || '', l.status || '', l.error || '',
    ];
    body += '<tr>' + cols.map(cell).join('') + '</tr>';
  });
  const table = `<table border="1"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head><meta charset="utf-8"></head><body>${table}</body></html>`;
  const blob = new Blob(['﻿' + doc], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'vendas.xls';
  a.click();
  toast('Excel exportado ⬇️');
}

function exportSalesCSV() {
  const head = ['Data', 'Tipo', 'Produto', 'Nome', 'Telefone', 'Email', 'CPF', 'Status', 'Erro'];
  const rows = [head];
  salesFiltered.forEach(l => rows.push([
    new Date(l.at).toLocaleString('pt-BR'), l.event || '', logProductName(l), l.buyerName || '',
    l.buyerPhone || '', l.buyerEmail || '', l.buyerDocument || '', l.status || '', l.error || '',
  ]));
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'vendas.csv';
  a.click();
  toast('CSV exportado ⬇️');
}

// Badge "Tipo" — diferencia boas-vindas / livro / teste / etc.
function eventoBadge(l) {
  const e = (l.event || '').toUpperCase();
  let label = l.event || '—', bg = '#eef0f6', fg = '#7b7f95';
  if (e.includes('LIVRO')) { label = '📕 Livro'; bg = '#ede9fe'; fg = '#6d28d9'; }
  else if (e.includes('APPROVED') || e.includes('APROVAD')) { label = '🎉 Boas-vindas'; bg = '#e6f8f0'; fg = '#0b7a4f'; }
  else if (e.includes('TESTE')) { label = '🧪 Teste'; bg = '#fff7e6'; fg = '#b7791f'; }
  else if (e.includes('MASSA')) { label = '📤 Massa'; bg = '#e0f2fe'; fg = '#0369a1'; }
  else if (/(CANCEL|REFUND|CHARGEBACK|EXPIRED|COMPLETE|BILLET|PROTEST|WEBHOOK|OTHER)/.test(e)) { label = '⏭️ Ignorado'; bg = '#f1f2f8'; fg = '#9a9eb2'; }
  return `<span style="background:${bg};color:${fg};font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;white-space:nowrap">${esc(label)}</span>`;
}

function pageButtons(totalPages) {
  if (totalPages <= 1) return '';
  const p = salesPage;
  const btn = (n, txt, on = true, active = false) => `<button ${on ? '' : 'disabled'} onclick="${on ? `gotoSalesPage(${n})` : ''}"
    style="min-width:34px;height:34px;border-radius:9px;font-weight:700;font-size:13px;padding:0 8px;
    ${active ? 'background:linear-gradient(135deg,#f04e23,#ff7a4d);color:#fff' : 'background:#f4f5f9;color:#1a1c2e'};${on ? '' : 'opacity:.4'}">${txt}</button>`;
  const nums = [...new Set([1, p - 1, p, p + 1, totalPages])].filter(n => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  let html = `<div style="display:flex;gap:6px;justify-content:center;align-items:center;padding:16px;flex-wrap:wrap">`;
  html += btn(p - 1, '‹', p > 1);
  let prev = 0;
  for (const n of nums) {
    if (n - prev > 1) html += `<span style="color:var(--muted);padding:0 2px">…</span>`;
    html += btn(n, String(n), true, n === p);
    prev = n;
  }
  html += btn(p + 1, '›', p < totalPages);
  return html + '</div>';
}

function renderSalesTable() {
  const box = $('#sales-table');
  if (!box) return;
  const logs = salesFiltered;
  if (!logs.length) {
    box.innerHTML = `<div class="empty"><div class="big">📭</div><h2>Nenhuma venda encontrada</h2>
      <p>Ajuste os filtros acima ou aguarde novas vendas.</p></div>`;
    return;
  }
  const totalPages = Math.ceil(logs.length / SALES_PER_PAGE);
  if (salesPage > totalPages) salesPage = totalPages;
  const start = (salesPage - 1) * SALES_PER_PAGE;
  const pageLogs = logs.slice(start, start + SALES_PER_PAGE);

  const rows = pageLogs.map(l => {
    const cls = l.status?.includes('enviado') ? 'enviado' : l.status?.includes('falhou') ? 'falhou'
      : l.status?.includes('rejeitado') ? 'rejeitado' : l.status?.includes('ignorado') ? 'ignorado' : 'recebido';
    const when = new Date(l.at).toLocaleString('pt-BR');
    return `<tr>
      <td style="white-space:nowrap">${when}</td>
      <td>${eventoBadge(l)}</td>
      <td style="min-width:130px"><b>${esc(logProductName(l))}</b></td>
      <td style="min-width:130px">${esc(l.buyerName || '—')}</td>
      <td style="white-space:nowrap">${esc(l.buyerPhone || '—')}</td>
      <td style="min-width:180px">${esc(l.buyerEmail || '—')}</td>
      <td style="white-space:nowrap">${esc(l.buyerDocument || '—')}</td>
      <td><span class="status-tag status-${cls}">${esc(l.status || '')}</span>${l.error ? `<br><span style="color:var(--red);font-size:11px">${esc(l.error)}</span>` : ''}</td>
      <td style="white-space:nowrap">
        <button onclick="reprocessLog('${l.id}', this)" title="Reenviar a mensagem" style="background:#eef0f6;border-radius:7px;padding:6px 10px;font-size:14px;margin-right:4px">🔄</button>
        <button onclick="deleteLog('${l.id}')" title="Excluir registro" style="background:#fdecec;border-radius:7px;padding:6px 10px;font-size:14px">🗑</button>
      </td>
    </tr>`;
  }).join('');

  box.innerHTML = `
    <div style="padding:12px 14px 8px;color:var(--muted);font-size:12px;font-weight:600">
      ${logs.length} registro(s) · mostrando ${start + 1}–${Math.min(start + SALES_PER_PAGE, logs.length)} · página ${salesPage} de ${totalPages}
    </div>
    <div style="overflow-x:auto"><table class="table" style="min-width:980px">
      <thead><tr>
        <th>Data</th><th>Tipo</th><th>Produto</th><th>Nome</th><th>Telefone</th><th>E-mail</th><th>CPF</th><th>Status</th><th>Ações</th>
      </tr></thead>
      <tbody>${rows}</tbody></table></div>
    ${pageButtons(totalPages)}`;
}

// ====================== Tela: Configurações ======================
async function renderSettings() {
  const s = await api.get('/api/settings');
  const base = location.origin;
  $('#view').innerHTML = `
    <div class="page-head"><h1>⚙️ Configurações</h1>
      <p>Conecte o ManyChat e a Hotmart. Feito uma vez só.</p></div>

    <div class="card">
      <h3>🤖 ManyChat</h3>
      <p class="hint">Token da API. No ManyChat: Settings → API → Generate / copy Token.</p>
      <div class="field"><label>API Token do ManyChat</label>
        <input class="input" id="s-token" placeholder="${s.hasManychatToken ? 'Salvo: ' + s.manychatTokenMasked + ' (digite para trocar)' : 'cole o token aqui'}" /></div>
      <div class="field"><label>Código do país (DDI) padrão</label>
        <div class="desc">Usado quando o telefone vier sem DDI. Brasil = 55.</div>
        <input class="input" id="s-ddi" value="${esc(s.defaultCountryCode)}" style="max-width:120px" /></div>
    </div>

    <div class="card">
      <h3>🔥 Hotmart</h3>
      <p class="hint">Configure o webhook (Postback) na Hotmart apontando para a URL abaixo.</p>
      <div class="field"><label>URL do Webhook (cole na Hotmart)</label>
        <div class="copy-line"><div class="code" id="wh-url">${base}/webhook/hotmart</div>
          <button class="btn btn-ghost" onclick="navigator.clipboard.writeText('${base}/webhook/hotmart');toast('Copiado!')">Copiar</button></div>
        <div class="desc" style="margin-top:8px">⚠️ Em <b>localhost</b> a Hotmart não alcança seu PC. Use o ngrok (veja o README) e troque pela URL pública.</div>
      </div>
      <div class="field"><label>Hottok (token de segurança da Hotmart)</label>
        <div class="desc">Opcional, mas recomendado. A Hotmart envia esse token; preencha o mesmo valor aqui.</div>
        <input class="input" id="s-hottok" value="${esc(s.hotmartHottok)}" placeholder="cole o hottok" /></div>
    </div>

    <div class="btn-row"><span class="spacer"></span>
      <button class="btn btn-primary" id="s-save">💾 Salvar configurações</button></div>`;

  $('#s-save').onclick = async () => {
    await api.post('/api/settings', {
      manychatToken: $('#s-token').value.trim(),
      hotmartHottok: $('#s-hottok').value.trim(),
      defaultCountryCode: $('#s-ddi').value.trim(),
    });
    await checkConn();
    toast('Configurações salvas ✅');
    renderSettings();
  };
}

// ====================== Tela: Guia rápido ======================
function renderGuide() {
  $('#view').innerHTML = `
    <div class="page-head"><h1>📖 Guia rápido</h1>
      <p>Como adicionar um novo produto — tudo por aqui, sem mexer em código.</p></div>

    <div class="card">
      <h3>🔁 Como funciona o disparo automático</h3>
      <p class="hint">Vale para TODOS os produtos, não só o primeiro:</p>
      <div style="font-size:14px;line-height:2">
        💳 Compra aprovada na Hotmart<br>
        ↓ a Hotmart chama o webhook<br>
        🔍 o sistema acha o produto pelo <b>ID da Hotmart</b><br>
        🤖 se o aluno não existe no ManyChat, <b>cria o contato</b><br>
        📲 dispara o <b>Flow (template aprovado)</b> daquele produto, com o link do grupo
      </div>
    </div>

    <div class="card">
      <h3>➕ Adicionar um produto novo (passo a passo)</h3>

      <p style="font-weight:700;margin:14px 0 6px">1) No ManyChat — preparar a mensagem</p>
      <div class="hint" style="margin-bottom:6px">Cada produto tem sua própria mensagem:</div>
      <ol style="font-size:13.5px;line-height:1.9;padding-left:20px">
        <li>Crie/aprove o <b>Modelo de Mensagem (template)</b> de boas-vindas desse produto.</li>
        <li>Em <b>Automação</b>, crie um <b>Flow</b> com um bloco de WhatsApp usando esse template
            (marque <b>“Enviar fora da janela de 24h”</b> para alcançar quem acabou de comprar).</li>
        <li>No flow: <b>⋯ → Get Flow API Trigger</b> e copie o ID (começa com <b>content...</b>).
            <br><span class="hint">Dica: também dá pra pegar na URL do flow, depois de <code>/cms/files/</code>.</span></li>
      </ol>

      <p style="font-weight:700;margin:18px 0 6px">2) Aqui no painel — cadastrar</p>
      <ol style="font-size:13.5px;line-height:1.9;padding-left:20px">
        <li>Clique em <b>＋ Novo produto</b> (ou, se já houve uma venda, a aba aparece sozinha).</li>
        <li>Preencha: <b>Nome</b>, <b>ID do produto na Hotmart</b>, <b>Flow ID</b> (content...) e <b>link do grupo</b>.</li>
        <li>Ajuste o texto de pré-visualização se quiser e marque <b>Produto ativo</b> ✅.</li>
        <li><b>Salvar</b>. Pronto — esse produto já dispara sozinho.</li>
      </ol>

      <p style="font-weight:700;margin:18px 0 6px">3) Na Hotmart — uma vez só</p>
      <div class="hint">O webhook já está configurado e serve para <b>todos</b> os produtos.
        Só confira que cada produto novo tem o webhook de <b>Compra aprovada</b> ativo.</div>
    </div>

    <div class="card" style="background:#fff7f5;border-color:#ffd9cc">
      <h3>💡 Resumo de bolso</h3>
      <p style="font-size:14px;margin:0">
        <b>Produto novo</b> = pegar o <b>Flow ID</b> no ManyChat + cadastrar a aba aqui com o
        <b>ID da Hotmart</b>. O resto (criar contato + enviar) é automático. 🎉
      </p>
    </div>

    <div class="btn-row"><span class="spacer"></span>
      <button class="btn btn-primary" onclick="addProduct()">＋ Adicionar produto agora</button></div>`;
}

// ====================== Tela: Livro (cruzamento WooCommerce) ======================
let livroPendentes = [];
function renderLivro() {
  const prods = state.products.filter(p => p.livroWooProductId);
  const opts = prods.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  $('#view').innerHTML = `
    <div class="page-head"><h1>📕 Livro</h1>
      <p>Cruza quem comprou (Hotmart) com quem já resgatou o livro na loja (WooCommerce) e dispara para os pendentes.</p></div>

    <div class="card">
      <h3>1) Produto</h3>
      <p class="hint">Só aparecem produtos com o <b>ID do livro (Woo)</b> configurado na aba do produto.</p>
      ${prods.length ? `<div class="field"><label>Produto</label>
        <select class="select" id="lv-prod">${opts}</select></div>
        <button class="btn btn-primary" id="lv-go">🔎 Analisar (consultar Woo)</button>`
      : `<div class="empty" style="padding:30px"><div class="big">⚙️</div>
          <p>Nenhum produto com o livro configurado.<br>Vá na aba de um produto → card <b>📕 Livro</b> → preencha o <b>ID do livro no WooCommerce</b>.</p></div>`}
      <div id="lv-status" style="margin-top:10px;font-size:13px;color:var(--muted)"></div>
    </div>

    ${prods.length ? `<div class="card">
      <h3>🧪 Testar a mensagem do livro</h3>
      <p class="hint">Dispara o flow do livro para um número seu, só pra validar a mensagem (não mexe na lista de pendentes).</p>
      <div class="row">
        <div class="field"><label>Telefone (com DDD)</label><input class="input" id="lv-test-phone" placeholder="ex: 5511999998888" /></div>
        <div class="field"><label>Nome (como está no ManyChat)</label>
          <div class="desc">Ajuda a achar contatos que já existem. Ex: Eliane Silva</div>
          <input class="input" id="lv-test-name" placeholder="ex: Eliane Silva" /></div>
      </div>
      <button class="btn btn-ghost" id="lv-test-btn">📤 Enviar teste do livro</button>
    </div>` : ''}

    <div id="lv-result"></div>`;

  if (prods.length) {
    $('#lv-go').onclick = analisarLivro;
    $('#lv-test-btn').onclick = testarLivro;
  }
}

async function testarLivro() {
  const productId = $('#lv-prod').value;
  const phone = $('#lv-test-phone').value.trim();
  if (!phone) return toast('Informe um telefone', true);
  const btn = $('#lv-test-btn'); btn.disabled = true; btn.textContent = 'Enviando…';
  const nome = $('#lv-test-name').value.trim() || 'Teste Livro';
  const r = await api.post('/api/livro/send-one', { productId, name: nome, phone });
  btn.disabled = false; btn.textContent = '📤 Enviar teste do livro';
  r && r.ok ? toast('Teste do livro enviado ✅') : toast('Erro: ' + (r?.error || 'falhou'), true);
}

async function analisarLivro() {
  const productId = $('#lv-prod').value;
  const btn = $('#lv-go'); btn.disabled = true; btn.textContent = '⏳ Consultando WooCommerce…';
  $('#lv-result').innerHTML = '';
  try {
    const r = await api.get('/api/livro/cross?productId=' + encodeURIComponent(productId));
    btn.disabled = false; btn.textContent = '🔎 Analisar (consultar Woo)';
    if (r.error) { $('#lv-status').innerHTML = `<span style="color:var(--red)">${esc(r.error)}</span>`; return; }
    livroPendentes = r.pendente || [];
    $('#lv-status').innerHTML = `Compradores: <b>${r.buyers}</b> · Já resgataram: <b>${r.ok.length}</b> · Pendentes: <b style="color:var(--brand)">${r.pendente.length}</b>
      <br><span style="font-size:12px">Regra: cupom <b>${esc(r.coupon)}</b> · a partir de <b>${esc(r.desde)}</b></span>`;

    const rowsP = r.pendente.map((b, i) => `<tr>
      <td><input type="checkbox" class="lv-chk" data-i="${i}" checked></td>
      <td>${esc(b.name)}</td><td style="white-space:nowrap">${esc(b.phone || '—')}</td><td>${esc(b.email)}</td></tr>`).join('');
    const rowsOk = r.ok.map(b => `<tr><td>${esc(b.name)}</td><td>${esc(b.email)}</td><td>${esc(b.woo?.coupon || '')}</td><td>${esc(b.woo?.status || '')}</td></tr>`).join('');

    $('#lv-result').innerHTML = `
      <div class="card" style="background:#fff7f5;border-color:#ffd9cc">
        <h3>⏳ Pendentes — ainda NÃO resgataram o livro (${r.pendente.length})</h3>
        <div style="background:#e6f8f0;border:1px solid #b8e8d2;border-radius:10px;padding:10px 12px;font-size:13px;color:#0b7a4f;margin-bottom:14px">
          ✅ <b>Sem duplicar:</b> a lista foi verificada agora no WooCommerce. O envio vai <b>só</b> para quem ainda não resgatou — quem já pegou o livro <b>não</b> recebe.
        </div>
        ${r.hasBookFlow ? '' : '<p class="hint" style="color:var(--red)"><b>⚠️ Configure o Flow do livro na aba do produto antes de enviar.</b></p>'}
        ${r.pendente.length ? `
          <div class="btn-row" style="margin-bottom:14px">
            <button class="btn btn-primary" id="lv-send" ${r.hasBookFlow ? '' : 'disabled'} style="font-size:15px;padding:13px 22px">📕 Enviar para os ${r.pendente.length} pendentes</button>
            <span class="spacer"></span>
            <span style="font-size:12px;color:var(--muted)">desmarque alguém abaixo se quiser pular</span>
          </div>
          <div id="lv-progress" style="margin-bottom:14px"></div>
          <div style="overflow-x:auto"><table class="table">
          <thead><tr><th><input type="checkbox" id="lv-all" checked></th><th>Nome</th><th>Telefone</th><th>E-mail</th></tr></thead>
          <tbody>${rowsP}</tbody></table></div>`
        : `<p>🎉 Ninguém pendente — todos já resgataram!</p>`}
      </div>
      ${r.ok.length ? `<div class="card">
        <h3>✅ Já resgataram (${r.ok.length})</h3>
        <div style="overflow-x:auto"><table class="table"><thead><tr><th>Nome</th><th>E-mail</th><th>Cupom</th><th>Status</th></tr></thead>
          <tbody>${rowsOk}</tbody></table></div></div>` : ''}
      <div id="lv-vazamento"><div class="card"><span style="color:var(--muted);font-size:13px">🕵️ Verificando vazamento do cupom…</span></div></div>`;

    const updateBtn = () => {
      const n = document.querySelectorAll('.lv-chk:checked').length;
      const send = $('#lv-send');
      if (send) { send.textContent = `📕 Enviar para os ${n} pendentes`; send.disabled = !r.hasBookFlow || n === 0; }
    };
    const all = $('#lv-all');
    if (all) all.onchange = () => { document.querySelectorAll('.lv-chk').forEach(c => { c.checked = all.checked; }); updateBtn(); };
    document.querySelectorAll('.lv-chk').forEach(c => c.addEventListener('change', updateBtn));
    const send = $('#lv-send');
    if (send) send.onclick = () => dispararLivro(productId);
    carregarVazamento(productId); // verifica vazamento do cupom em paralelo
  } catch (e) {
    btn.disabled = false; btn.textContent = '🔎 Analisar (consultar Woo)';
    $('#lv-status').innerHTML = `<span style="color:var(--red)">Erro: ${esc(e.message)}</span>`;
  }
}

async function carregarVazamento(productId) {
  const box = $('#lv-vazamento');
  if (!box) return;
  try {
    const r = await api.get('/api/livro/vazamento?productId=' + encodeURIComponent(productId));
    if (r.error) { box.innerHTML = `<div class="card"><span class="hint" style="color:var(--red)">Vazamento: ${esc(r.error)}</span></div>`; return; }
    if (!r.vazamento.length) {
      box.innerHTML = `<div class="card" style="background:#e6f8f0;border-color:#b8e8d2">
        <h3>🔒 Cupom <b>${esc(r.coupon)}</b> — sem vazamento</h3>
        <p class="hint" style="margin:0">Usos do cupom: <b>${r.totalUsos}</b> · todos são compradores da lista ✅. Nenhum uso indevido detectado.</p></div>`;
      return;
    }
    const rows = r.vazamento.map(v => `<tr>
      <td>${esc(v.name)}</td><td>${esc(v.email)}</td>
      <td style="white-space:nowrap">${v.date ? new Date(v.date).toLocaleString('pt-BR') : '—'}</td>
      <td>${esc(v.status)}</td><td>#${esc(v.orderId)}</td></tr>`).join('');
    box.innerHTML = `<div class="card" style="background:#fdecec;border-color:#f5b7b7">
      <h3>🚨 Possível VAZAMENTO do cupom <b>${esc(r.coupon)}</b> — ${r.vazamento.length} pessoa(s)</h3>
      <p class="hint">Usaram o cupom no Woo mas <b>NÃO estão</b> na lista de compradores (Hotmart). Vale investigar:</p>
      <div style="overflow-x:auto"><table class="table">
        <thead><tr><th>Nome</th><th>E-mail</th><th>Data</th><th>Status</th><th>Pedido</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <p class="hint" style="margin-top:8px">Usos totais do cupom: ${r.totalUsos} · na lista: ${r.legitimos} · fora da lista: <b style="color:var(--red)">${r.vazamento.length}</b></p></div>`;
  } catch (e) {
    box.innerHTML = `<div class="card"><span class="hint">Não foi possível verificar vazamento agora.</span></div>`;
  }
}

async function dispararLivro(productId) {
  const selected = Array.from(document.querySelectorAll('.lv-chk')).filter(c => c.checked).map(c => livroPendentes[+c.dataset.i]);
  if (!selected.length) return toast('Selecione pelo menos 1 pessoa', true);
  if (!confirm(`Disparar a mensagem do livro para ${selected.length} pessoa(s)? Envia WhatsApp de verdade.`)) return;
  const send = $('#lv-send'); send.disabled = true;
  const prog = $('#lv-progress');
  let ok = 0, fail = 0; const fails = [];
  for (let i = 0; i < selected.length; i++) {
    const b = selected[i];
    prog.innerHTML = `<div style="font-weight:600">Enviando ${i + 1} de ${selected.length}…</div>
      <div style="height:10px;background:#eee;border-radius:6px;overflow:hidden;margin:8px 0">
        <div style="height:100%;width:${Math.round((i / selected.length) * 100)}%;background:linear-gradient(90deg,#f04e23,#ff7a4d)"></div></div>
      <div style="font-size:13px;color:var(--muted)">✅ ${ok} · ❌ ${fail}</div>`;
    try {
      const r = await api.post('/api/livro/send-one', { productId, name: b.name, phone: b.phone, email: b.email, document: b.document });
      if (r && r.ok) ok++; else { fail++; fails.push(`${b.name} ${b.phone}: ${r?.error || 'erro'}`); }
    } catch { fail++; fails.push(`${b.name}: erro`); }
  }
  prog.innerHTML = `<div style="font-weight:700;color:var(--green);font-size:15px">🎉 Concluído! ✅ ${ok} enviados · ❌ ${fail} falhas</div>
    ${fails.length ? `<details style="margin-top:8px"><summary style="cursor:pointer;color:var(--muted)">Ver falhas</summary>
      <div style="font-size:12px;color:var(--red);white-space:pre-wrap;margin-top:6px">${esc(fails.join('\n'))}</div></details>` : ''}
    <div class="hint" style="margin-top:6px">Registrado em 📊 Vendas & Logs (evento LIVRO). Clique em Analisar de novo para atualizar a lista.</div>`;
  send.disabled = false;
  toast(`Livro: ${ok} enviados`);
}

// ====================== Tela: Disparo em massa (CSV) ======================
function renderBulk() {
  const opts = state.products.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  $('#view').innerHTML = `
    <div class="page-head"><h1>📤 Disparo em massa</h1>
      <p>Envie a mensagem de boas-vindas para uma lista de pessoas (ex: alunos que já compraram).</p></div>

    <div class="card">
      <h3>1) Escolha o produto</h3>
      <p class="hint">A mensagem (Flow) desse produto será enviada para todos da lista.</p>
      <div class="field"><label>Produto</label>
        <select class="select" id="b-prod">${opts || '<option value="">Nenhum produto cadastrado</option>'}</select></div>
    </div>

    <div class="card">
      <h3>2) Cole ou suba a lista</h3>
      <p class="hint">Aceita CSV da Hotmart. Detecta as colunas <b>telefone</b>, <b>nome</b>, <b>email</b> e <b>cpf</b>.
        Sem cabeçalho? Use a ordem: <b>telefone, nome, email, cpf</b> (1 por linha).</p>
      <div class="field">
        <input type="file" id="b-file" accept=".csv,.txt" style="margin-bottom:10px" />
        <textarea class="textarea" id="b-text" placeholder="telefone;nome;email;cpf
5511999998888;Maria Silva;maria@email.com;12345678900
5511988887777;João Souza;joao@email.com;98765432100"></textarea>
      </div>
      <button class="btn btn-ghost" id="b-preview">👁️ Conferir lista</button>
      <div id="b-info" style="margin-top:12px"></div>
    </div>

    <div class="card" style="background:#fff7f5;border-color:#ffd9cc">
      <h3>3) Disparar</h3>
      <p class="hint">⚠️ Vai enviar mensagem de WhatsApp de verdade para cada pessoa da lista. Confira antes!</p>
      <button class="btn btn-primary" id="b-send" disabled>📤 Disparar para a lista</button>
      <div id="b-progress" style="margin-top:16px"></div>
    </div>`;

  let parsed = [];
  const refresh = () => {
    parsed = parseRecipients($('#b-text').value);
    const info = $('#b-info');
    if (!parsed.length) { info.innerHTML = `<span style="color:var(--muted);font-size:13px">Nenhum telefone válido encontrado ainda.</span>`; $('#b-send').disabled = true; return; }
    const sample = parsed.slice(0, 5).map(r => `<tr><td>${esc(r.phone)}</td><td>${esc(r.name || '—')}</td><td>${esc(r.email || '—')}</td><td>${esc(r.document || '—')}</td></tr>`).join('');
    info.innerHTML = `<div style="font-weight:700;margin-bottom:8px;color:var(--green)">✅ ${parsed.length} pessoa(s) na lista</div>
      <table class="table"><thead><tr><th>Telefone</th><th>Nome</th><th>E-mail</th><th>CPF</th></tr></thead><tbody>${sample}</tbody></table>
      ${parsed.length > 5 ? `<div class="hint" style="margin-top:6px">…e mais ${parsed.length - 5}.</div>` : ''}`;
    $('#b-send').disabled = false;
  };

  $('#b-file').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { $('#b-text').value = reader.result; refresh(); };
    reader.readAsText(f, 'utf-8');
  });
  $('#b-preview').onclick = refresh;
  $('#b-send').onclick = () => runBulk($('#b-prod').value, parsed);
}

function parseRecipients(text) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const delim = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
  const first = lines[0].toLowerCase();
  let header = null, start = 0;
  if (/tel|fone|phone|whats|celular|nome|name|email|e-mail|cpf|documento/.test(first)) {
    header = lines[0].split(delim).map(h => h.trim().toLowerCase()); start = 1;
  }
  const findIdx = (terms) => header ? header.findIndex(h => terms.some(t => h.includes(t))) : -1;
  const iPhone = findIdx(['tel', 'fone', 'phone', 'whats', 'celular']);
  const iName = findIdx(['nome', 'name', 'comprador', 'cliente']);
  const iEmail = findIdx(['email', 'e-mail']);
  const iCpf = findIdx(['cpf', 'documento', 'doc']);
  const out = [];
  for (let k = start; k < lines.length; k++) {
    const cols = lines[k].split(delim).map(c => c.trim().replace(/^"|"$/g, ''));
    let phone, name, email, document;
    if (header) {
      phone = iPhone >= 0 ? cols[iPhone] : ''; name = iName >= 0 ? cols[iName] : '';
      email = iEmail >= 0 ? cols[iEmail] : ''; document = iCpf >= 0 ? cols[iCpf] : '';
    } else {
      [phone, name, email, document] = cols;
    }
    if ((phone || '').replace(/\D/g, '').length >= 8) {
      out.push({ phone, name: name || '', email: email || '', document: document || '' });
    }
  }
  return out;
}

async function runBulk(productId, recipients) {
  if (!productId) return toast('Escolha um produto', true);
  if (!recipients.length) return toast('Lista vazia', true);
  if (!confirm(`Disparar a mensagem para ${recipients.length} pessoa(s)? Vai enviar WhatsApp de verdade.`)) return;
  const btn = $('#b-send'); btn.disabled = true;
  const prog = $('#b-progress');
  let ok = 0, fail = 0;
  const fails = [];
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    prog.innerHTML = `<div style="font-weight:600">Enviando ${i + 1} de ${recipients.length}…</div>
      <div style="height:10px;background:#eee;border-radius:6px;overflow:hidden;margin:8px 0">
        <div style="height:100%;width:${Math.round((i / recipients.length) * 100)}%;background:linear-gradient(90deg,#f04e23,#ff7a4d)"></div></div>
      <div style="font-size:13px;color:var(--muted)">✅ ${ok} enviados · ❌ ${fail} falhas</div>`;
    try {
      const res = await api.post('/api/send-welcome', { productId, name: r.name, phone: r.phone, email: r.email, document: r.document });
      if (res && res.ok) ok++; else { fail++; fails.push(`${r.phone}: ${res?.error || 'erro'}`); }
    } catch { fail++; fails.push(`${r.phone}: erro de conexão`); }
  }
  prog.innerHTML = `<div style="font-weight:700;color:var(--green);font-size:15px">🎉 Concluído!</div>
    <div style="margin-top:6px">✅ <b>${ok}</b> enviados · ❌ <b>${fail}</b> falhas (de ${recipients.length})</div>
    ${fails.length ? `<details style="margin-top:10px"><summary style="cursor:pointer;color:var(--muted)">Ver falhas (${fails.length})</summary>
      <div style="font-size:12px;color:var(--red);margin-top:6px;white-space:pre-wrap">${esc(fails.join('\n'))}</div></details>` : ''}
    <div class="hint" style="margin-top:8px">Os disparos também ficaram registrados em 📊 Vendas &amp; Logs.</div>`;
  btn.disabled = false;
  toast(`Disparo concluído: ${ok} enviados`);
}

// ====================== Conexão (status no rodapé) ======================
async function checkConn() {
  try {
    const s = await api.get('/api/settings');
    const ok = s.hasManychatToken;
    $('#conn-dot').className = 'dot ' + (ok ? 'dot-on' : 'dot-off');
    $('#conn-text').textContent = ok ? 'ManyChat conectado' : 'ManyChat não configurado';
  } catch {
    $('#conn-dot').className = 'dot dot-off';
    $('#conn-text').textContent = 'Servidor offline';
  }
}

window.addProduct = addProduct;
window.toast = toast;
boot();
