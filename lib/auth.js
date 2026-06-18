// Autenticação simples por cookie assinado (HMAC), sem dependências externas.
import crypto from 'crypto';

const EMAIL = process.env.AUTH_EMAIL || 'vpmatricula@gmail.com';
const PASSWORD = process.env.AUTH_PASSWORD || '';
const SECRET = process.env.AUTH_SECRET || 'troque-este-segredo-em-producao';
const COOKIE = 'vpauth';
const MAX_AGE_DAYS = 7;

function sign(payload) {
  const data = String(payload);
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
  return data + '.' + sig;
}

function verifyToken(token) {
  if (!token || !token.includes('.')) return false;
  const i = token.lastIndexOf('.');
  const data = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  return Number(data) > Date.now(); // ainda não expirou
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const idx = p.indexOf('=');
    if (idx > -1) out[p.slice(0, idx).trim()] = decodeURIComponent(p.slice(idx + 1).trim());
  });
  return out;
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export const auth = {
  // Há senha configurada? (se não, o login fica desativado e o sistema fica aberto)
  enabled: !!PASSWORD,

  checkCredentials(email, password) {
    if (!PASSWORD) return false;
    return safeEqual((email || '').trim().toLowerCase(), EMAIL.toLowerCase()) && safeEqual(password || '', PASSWORD);
  },

  makeCookie() {
    const exp = Date.now() + MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const token = sign(exp);
    const secure = process.env.VERCEL ? '; Secure' : '';
    return `${COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE_DAYS * 24 * 60 * 60}; SameSite=Lax${secure}`;
  },

  clearCookie() {
    return `${COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
  },

  isLogged(req) {
    if (!PASSWORD) return true; // sem senha definida => sem trava
    return verifyToken(parseCookies(req)[COOKIE]);
  },

  // Middleware: protege rotas. APIs respondem 401; páginas redirecionam pro /login.
  requireAuth(req, res, next) {
    if (auth.isLogged(req)) return next();
    if (req.path.startsWith('/api')) return res.status(401).json({ error: 'não autenticado' });
    return res.redirect('/login');
  },
};
