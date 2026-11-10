import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';

// scrypt do próprio Node em vez de bcrypt: evita dependência nativa, que
// complicaria o build da imagem Docker.
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions
) => Promise<Buffer>;

type Parametros = { ln: number; r: number; p: number };

/**
 * Custo do scrypt: o mínimo recomendado pela OWASP (N = 2^17, r = 8, p = 1). Cada hash
 * usa 128 MiB de memória e ~190 ms de CPU, de propósito: é o que torna caro testar
 * milhões de senhas contra um banco vazado. O padrão do Node (N = 2^14) custava 23 ms,
 * oito vezes menos.
 */
const ATUAL: Parametros = { ln: 17, r: 8, p: 1 };

// Parâmetros padrão do Node, com que foram gravadas as senhas de antes do formato PHC.
const LEGADO: Parametros = { ln: 14, r: 8, p: 1 };

const KEYLEN = 64;
const SALT_BYTES = 16;
const PREFIXO_ATUAL = `$scrypt$ln=${ATUAL.ln},r=${ATUAL.r},p=${ATUAL.p}$`;
const FORMATO_PHC = /^\$scrypt\$ln=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

function derivar(password: string, salt: string | Buffer, { ln, r, p }: Parametros) {
  const N = 2 ** ln;
  // O teto padrão do Node é 32 MiB e o custo atual pede 128 MiB (128 · N · r).
  return scryptAsync(password, salt, KEYLEN, { N, r, p, maxmem: 2 * 128 * N * r });
}

// Base64 sem o `=` do fim, como pede o formato PHC.
const b64 = (buffer: Buffer) => buffer.toString('base64').replace(/=+$/, '');

/**
 * Gera o hash a gravar no banco. A senha em si nunca é gravada.
 *
 * Formato PHC (o mesmo do argon2): `$scrypt$ln=17,r=8,p=1$<salt>$<hash>`. Os parâmetros
 * viajam junto do hash, então subir o custo no futuro não invalida as senhas já
 * gravadas — cada uma é conferida com os parâmetros com que nasceu.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await derivar(password, salt, ATUAL);
  return `${PREFIXO_ATUAL}${b64(salt)}$${b64(derived)}`;
}

/** Lê o hash gravado, no formato PHC ou no antigo `<salt hex>:<hash hex>`. */
function interpretar(stored: string) {
  const phc = FORMATO_PHC.exec(stored);
  if (phc) {
    const [, ln, r, p, salt, hash] = phc;
    return {
      parametros: { ln: Number(ln), r: Number(r), p: Number(p) },
      salt: Buffer.from(salt, 'base64'),
      hash: Buffer.from(hash, 'base64'),
    };
  }

  // No formato antigo o salt entra no scrypt como o próprio TEXTO hexadecimal, não
  // como os bytes que ele representa — decodificar aqui faria toda senha antiga falhar.
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return null;
  return { parametros: LEGADO, salt, hash: Buffer.from(hash, 'hex') };
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const gravado = interpretar(stored);
  if (!gravado) return false;

  const derived = await derivar(password, gravado.salt, gravado.parametros);

  // timingSafeEqual exige buffers do mesmo tamanho
  if (gravado.hash.length !== derived.length) return false;
  return timingSafeEqual(gravado.hash, derived);
}

/**
 * Se o hash foi gravado num formato ou custo que não é o atual. O login usa isso para
 * refazê-lo: é o único momento em que a senha está em mãos.
 */
export function precisaRefazerHash(stored: string): boolean {
  return !stored.startsWith(PREFIXO_ATUAL);
}
