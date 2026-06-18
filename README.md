# Painel Hotmart + ManyChat 🔥🤖

Sistema local para gerenciar produtos da Hotmart em abas e disparar, automaticamente,
um template de boas-vindas do **ManyChat** quando uma compra é aprovada — com o link do grupo de WhatsApp.

## Como rodar (passo a passo)

1. Instale as dependências (uma vez só):
   ```
   npm install
   ```
2. Inicie o sistema:
   ```
   npm start
   ```
3. Abra no navegador: **http://localhost:3000**

## Como configurar

### 1. ManyChat (aba ⚙️ Configurações)
- No ManyChat: **Settings → API → Generate Token** e cole o token no painel.
- Em cada Flow de boas-vindas: **⋯ → Get Flow API Trigger** → copie o `flow_ns`
  (começa com `content...`) e cole no campo **Flow ID** do produto.
- No template, você pode usar os campos `{{whatsapp_link}}` e `{{produto_nome}}`,
  que o sistema preenche automaticamente.

### 2. Hotmart (aba ⚙️ Configurações)
- Em **Ferramentas → Webhook (Postback)**, crie um webhook apontando para:
  `https://SEU-DOMINIO/webhook/hotmart`
- Evento: **Compra aprovada (PURCHASE_APPROVED)**.
- Copie o **hottok** que a Hotmart mostra e cole no painel (segurança).

### 3. Produtos (abas à esquerda)
- Cada produto vira uma aba. Preencha **ID da Hotmart**, **Flow do ManyChat** e **link do grupo**.
- Marque **Produto ativo** para o disparo automático funcionar.
- Produtos novos que chegarem pela Hotmart **aparecem como aba sozinhos** (entram desativados até você configurar).

## Importante: localhost x Hotmart

A Hotmart roda na internet e **não consegue** acessar `localhost` do seu PC.
Para receber os webhooks de verdade, exponha o sistema com **ngrok**:

```
npm start                 # deixa rodando em um terminal
ngrok http 3000           # em outro terminal -> gera uma URL pública https://xxxx.ngrok.app
```

Use a URL do ngrok (`https://xxxx.ngrok.app/webhook/hotmart`) lá na Hotmart.

> Para testar sem Hotmart, use o botão **🧪 Enviar teste** dentro de cada produto.

## Onde ficam os dados
Tudo é salvo em `data/db.json` (produtos, configurações e logs). Simples e local.
