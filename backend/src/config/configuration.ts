export default () => ({
  app: {
    port: parseInt(process.env.PORT ?? '3001', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    jwtSecret: process.env.JWT_SECRET ?? '',
  },
  database: {
    url:
      process.env.DATABASE_URL ||
      'postgresql://neondb_owner:npg_9ByhcsjYMR7H@ep-square-paper-an5uie01-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require',
    synchronize: (process.env.DB_SYNCHRONIZE ?? 'false') === 'true',
    dropSchema: (process.env.DB_DROP_SCHEMA ?? 'false') === 'true',
  },
  seed: {
    superAdminName: process.env.SUPER_ADMIN_NAME || 'Super Admin',
    superAdminUsername: process.env.SUPER_ADMIN_USERNAME || 'superadmin',
    superAdminEmail: process.env.SUPER_ADMIN_EMAIL || 'admin@erp.com',
    superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || 'admin123',
  },
});
