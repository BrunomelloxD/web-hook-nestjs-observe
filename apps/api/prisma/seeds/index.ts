import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';

// Register each seeder here: { name, run }.
const seeders: {
  name: string;
  run: (prisma: PrismaClient) => Promise<number>;
}[] = [];

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

try {
  for (const seeder of seeders) {
    const count = await seeder.run(prisma);
    console.log(`seed ${seeder.name}: ${count} registros`);
  }
} finally {
  await prisma.$disconnect();
}
