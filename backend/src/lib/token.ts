import { createHmac, timingSafeEqual } from 'node:crypto';

// Token assinado com HMAC via node:crypto — mesma ideia de um JWT, sem dependência.
// Formato: <payload base64url>.<assinatura base64url>
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;

function segredo(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET não configurada no .env');
  return s;
}

function assinar(payload: string): string {
  return createHmac('sha256', segredo()).update(payload).digest('base64url');
}

export function criarToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ userId, exp: Date.now() + VALIDADE_MS })
  ).toString('base64url');

  return `${payload}.${assinar(payload)}`;
}

export function lerToken(token: string): { userId: string } | null {
  const [payload, assinatura] = token.split('.');
  if (!payload || !assinatura) return null;

  const esperada = Buffer.from(assinar(payload));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length) return null;
  if (!timingSafeEqual(esperada, recebida)) return null;

  try {
    const { userId, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof userId !== 'string' || typeof exp !== 'number') return null;
    if (Date.now() > exp) return null;
    return { userId };
  } catch {
    return null;
  }
}
