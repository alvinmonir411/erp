export default () => ({
  app: {
    port: parseInt(process.env.PORT ?? '3001', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    jwtSecret: process.env.JWT_SECRET ?? '',
  },
  database: {
    url: process.env.DATABASE_URL ?? '',
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
