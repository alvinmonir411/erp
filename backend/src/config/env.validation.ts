import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().optional().default('production'),
  PORT: Joi.number().optional().default(3001),
  DATABASE_URL: Joi.string().optional().allow(''),
  JWT_SECRET: Joi.string().optional().default('default_jwt_secret_key_erp_2026'),
  FRONTEND_URL: Joi.string().optional().allow(''),
  DB_SYNCHRONIZE: Joi.string().optional().default('false'),
  DB_DROP_SCHEMA: Joi.string().optional().default('false'),
  SUPER_ADMIN_NAME: Joi.string().optional(),
  SUPER_ADMIN_USERNAME: Joi.string().optional(),
  SUPER_ADMIN_EMAIL: Joi.string().optional(),
  SUPER_ADMIN_PASSWORD: Joi.string().optional(),
}).unknown(true);
