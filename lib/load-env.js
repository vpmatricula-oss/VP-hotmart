// Carrega o arquivo .env ANTES de qualquer outro módulo ler process.env.
// (na Vercel as variáveis já vêm do painel, então o loadEnvFile só falha silenciosamente)
try { process.loadEnvFile(); } catch { /* sem .env: ok */ }
