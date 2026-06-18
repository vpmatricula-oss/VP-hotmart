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
  if (v === 'bulk') return renderBulk();
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
        <button class="btn btn-ghost" id="f-export">⬇️ Exportar CSV</button>
      </div>
    </div>

    <div class="card" style="padding:8px"><div id="sales-table"></div></div>`;

  $('#f-prod').addEventListener('change', applySalesFilter);
  $('#f-status').addEventListener('change', applySalesFilter);
  $('#f-clear').onclick = () => { $('#f-prod').value = ''; $('#f-status').value = ''; applySalesFilter(); };
  $('#f-export').onclick = exportSalesCSV;
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
function applySalesFilter() {
  const prod = $('#f-prod').value; // id do produto
  const status = $('#f-status').value;
  salesFiltered = salesLogs.filter(l => {
    const okProd = !prod || l.productId === prod;
    const okStatus = !status || (l.status || '').toLowerCase().includes(status);
    return okProd && okStatus;
  });
  $('#sales-table').innerHTML = salesTableHTML(salesFiltered);
}

function exportSalesCSV() {
  const head = ['Data', 'Produto', 'Nome', 'Telefone', 'Email', 'CPF', 'Evento', 'Status', 'Erro'];
  const rows = [head];
  salesFiltered.forEach(l => rows.push([
    new Date(l.at).toLocaleString('pt-BR'), logProductName(l), l.buyerName || '',
    l.buyerPhone || '', l.buyerEmail || '', l.buyerDocument || '', l.event || '', l.status || '', l.error || '',
  ]));
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'vendas.csv';
  a.click();
  toast('CSV exportado ⬇️');
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
      <td style="white-space:nowrap">${when}</td>
      <td><b>${esc(logProductName(l))}</b></td>
      <td>${esc(l.buyerName || '—')}</td>
      <td style="white-space:nowrap">${esc(l.buyerPhone || '—')}</td>
      <td>${esc(l.buyerEmail || '—')}</td>
      <td style="white-space:nowrap">${esc(l.buyerDocument || '—')}</td>
      <td><span class="status-tag status-${cls}">${esc(l.status || '')}</span>${l.error ? `<br><span style="color:var(--red);font-size:11px">${esc(l.error)}</span>` : ''}</td>
    </tr>`;
  }).join('');
  return `<div style="padding:10px 14px 4px;color:var(--muted);font-size:12px;font-weight:600">${logs.length} registro(s)</div>
    <div style="overflow-x:auto"><table class="table">
      <thead><tr><th>Data</th><th>Produto</th><th>Nome</th><th>Telefone</th><th>E-mail</th><th>CPF</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
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
