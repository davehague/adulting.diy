import { PrismaClient } from '@prisma/client';

// Create a singleton Prisma client instance
let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // In development, we want to reuse the same instance to avoid too many connections
  if (!(global as any).prisma) {
    (global as any).prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });
  }
  prisma = (global as any).prisma;
}

export default prisma;
