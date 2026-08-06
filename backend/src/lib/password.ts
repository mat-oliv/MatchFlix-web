import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// scrypt do próprio Node em vez de bcrypt: evita dependência nativa, que
// complicaria o build da imagem Docker.
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number
) => Promise<Buffer>;

const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = await scryptAsync(password, salt, KEYLEN);
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;

  const derived = await scryptAsync(password, salt, KEYLEN);
  const expected = Buffer.from(hash, 'hex');

  // timingSafeEqual exige buffers do mesmo tamanho
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}
