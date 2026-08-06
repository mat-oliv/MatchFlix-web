import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password.js';

const prisma = new PrismaClient();

// Contas de demonstração. Existem para que um banco recém-criado já dê pra usar,
// e para manter logáveis os usuários criados antes da autenticação existir.
const CONTAS = [
  { id: 'demo-user', username: 'demo', senha: 'demo1234', name: 'Usuário Demo' },
  { id: 'amigo-1', username: 'amigo', senha: 'amigo1234', name: 'Amigo' },
];

async function main() {
  for (const conta of CONTAS) {
    const passwordHash = await hashPassword(conta.senha);

    await prisma.user.upsert({
      where: { id: conta.id },
      update: { username: conta.username, passwordHash },
      create: {
        id: conta.id,
        username: conta.username,
        passwordHash,
        name: conta.name,
      },
    });

    console.log(`✔ conta pronta: ${conta.username} / ${conta.senha}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
