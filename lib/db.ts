import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

let prisma: PrismaClient;

if (tursoUrl && tursoToken) {
  // use turso client
  const libsql = createClient({
    url: tursoUrl,
    authToken: tursoToken,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaLibSQL(libsql as any);
  prisma = new PrismaClient({ adapter });
} else {
  // use local sqlite
  prisma = new PrismaClient();
}

export { prisma };
