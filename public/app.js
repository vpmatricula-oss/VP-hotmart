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

  // Lista de produtos para o filtro: nomes que aparecem nos logs + produtos cadastrados.
  const names = Array.from(new Set([
    ...state.products.map(p => p.name),
    ...salesLogs.map(l => l.productName).filter(n => n && n !== '—'),
  ])).sort((a, b) => a.localeCompare(b));

  $('#view').innerHTML = `
    <div class="page-head"><h1>📊 Vendas &amp; Logs</h1>
      <p>Cada compra recebida da Hotmart e o resultado do disparo no ManyChat.</p></div>

    <div class="card" style="padding:16px 18px">
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end">
        <div class="field" style="margin:0;flex:1;min-width:200px">
          <label>Produto</label>
          <select class="select" id="f-prod">
            <option value="">📦 Todos os produtos</option>
            ${names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}
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
      </div>
    </div>

    <div class="card" style="padding:8px"><div id="sales-table"></div></div>`;

  $('#f-prod').addEventListener('change', applySalesFilter);
  $('#f-status').addEventListener('change', applySalesFilter);
  $('#f-clear').onclick = () => { $('#f-prod').value = ''; $('#f-status').value = ''; applySalesFilter(); };
  applySalesFilter();
}

function applySalesFilter() {
  const prod = $('#f-prod').value;
  const status = $('#f-status').value;
  const filtered = salesLogs.filter(l => {
    const okProd = !prod || l.productName === prod;
    const okStatus = !status || (l.status || '').toLowerCase().includes(status);
    return okProd && okStatus;
  });
  $('#sales-table').innerHTML = salesTableHTML(filtered);
}

function salesTableHTML(logs) {
  if (!logs.length) {
    return `<div class="empty"><div class="big">📭</div><h2>Nenhuma venda encontrada</h2>
      <p>Ajuste os filtros acima ou aguarde novas vendas.</p></div>`;
  }
  const rows = logs.map(l => {
    const cls = l.status?.includes('enviado') ? 'enviado' : l.status?.includes('falhou') ? 'falhou'
      : l.status?.includes('rejeitado') ? 'rejeitado' : l.status?.includes('ignorado') ? 'ignorado' : 'recebido';
    const when = new Date(l.at).toLocaleString('pt-BR');
    return `<tr>
      <td>${when}</td>
      <td><b>${esc(l.productName || '—')}</b></td>
      <td>${esc(l.buyerName || '—')}<br><span style="color:var(--muted);font-size:12px">${esc(l.buyerEmail || l.buyerPhone || '')}</span></td>
      <td>${esc(l.event || '')}</td>
      <td><span class="status-tag status-${cls}">${esc(l.status || '')}</span>${l.error ? `<br><span style="color:var(--red);font-size:11px">${esc(l.error)}</span>` : ''}</td>
    </tr>`;
  }).join('');
  return `<div style="padding:10px 14px 4px;color:var(--muted);font-size:12px;font-weight:600">${logs.length} registro(s)</div>
    <table class="table">
      <thead><tr><th>Data</th><th>Produto</th><th>Aluno</th><th>Evento</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
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
