import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3001),
  DATABASE_URL: Joi.string().optional().allow(''),
  JWT_SECRET: Joi.string().optional().default('default_jwt_secret_key_erp_2026'),
  FRONTEND_URL: Joi.string().optional().default('http://localhost:3000'),
  DB_SYNCHRONIZE: Joi.string().valid('true', 'false').default('false'),
  DB_DROP_SCHEMA: Joi.string().valid('true', 'false').default('false'),
  SUPER_ADMIN_NAME: Joi.string().optional(),
  SUPER_ADMIN_USERNAME: Joi.string().optional(),
  SUPER_ADMIN_EMAIL: Joi.string().optional(),
  SUPER_ADMIN_PASSWORD: Joi.string().optional(),
});
