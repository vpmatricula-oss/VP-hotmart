# Guia de Deploy 🚀 (GitHub → Vercel → Hotmart)

## Passo 1 — Subir no GitHub

1. Faça login no GitHub pelo terminal (abre o navegador):
   ```
   gh auth login
   ```
   Escolha: **GitHub.com** → **HTTPS** → **Login with a web browser** → cole o código.

2. Crie o repositório e suba o código (já dentro da pasta do projeto):
   ```
   gh repo create hotmart-manychat --private --source=. --remote=origin --push
   ```
   Pronto: o código está no seu GitHub (privado).

## Passo 2 — Publicar na Vercel

1. Acesse **https://vercel.com** e entre com sua conta do GitHub.
2. **Add New → Project** → importe o repositório `hotmart-manychat`.
3. Não precisa configurar build (já tem `vercel.json`). Clique em **Deploy**.

### 2.1 — Criar o banco (Vercel KV) — OBRIGATÓRIO
> Sem isso os dados não são salvos (a Vercel não grava arquivos).

1. No projeto, aba **Storage → Create Database → KV (Upstash Redis)** → **Create**.
2. **Connect** ao projeto. A Vercel injeta sozinha as variáveis
   `KV_REST_API_URL` e `KV_REST_API_TOKEN`.
3. Faça **Redeploy** (aba Deployments → ⋯ → Redeploy) para o app enxergar o banco.

Depois disso seu sistema fica no ar em algo como:
`https://hotmart-manychat.vercel.app`

## Passo 3 — Configurar o sistema (no ar)

1. Abra a URL da Vercel → aba **⚙️ Configurações** → cole o **token do ManyChat**.
2. Em cada **produto**: ID da Hotmart + Flow do ManyChat + link do grupo → **Produto ativo**.

## Passo 4 — Integrar com a Hotmart (webhook)

1. Na Hotmart: **Ferramentas → Webhook (Postback) → Cadastrar**.
2. URL: `https://SEU-PROJETO.vercel.app/webhook/hotmart`
3. Evento: **Compra aprovada**.
4. Copie o **hottok** gerado e cole na aba **⚙️ Configurações** do sistema.

Pronto! Compra aprovada → aluno recebe o template de boas-vindas no WhatsApp via ManyChat. 🎉

## Atualizar o sistema depois
Toda vez que mudar o código:
```
git add -A
git commit -m "minha alteração"
git push
```
A Vercel publica a nova versão sozinha.
