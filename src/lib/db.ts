import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const defaultDbUrl = 'postgresql://postgres.cvccxxwkjphryzkmbcjv:E6Mf25EtmmghHFVY@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres';
const connectionString = process.env.DATABASE_URL || defaultDbUrl;

if (!globalForPrisma.prisma) {
  try {
    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5, // Serverless pool constraint to prevent Supabase connection exhaustion
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
    });
    const adapter = new PrismaPg(pool);
    globalForPrisma.prisma = new PrismaClient({ adapter });
  } catch (err) {
    console.warn('Prisma adapter initialization fallback:', err);
    globalForPrisma.prisma = new PrismaClient();
  }
}

export const db = globalForPrisma.prisma!;
