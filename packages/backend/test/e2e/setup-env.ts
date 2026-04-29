process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PORT = process.env.PORT || '3000';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e_jwt_secret_at_least_32_characters';

process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_USERNAME = process.env.DB_USERNAME || 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
process.env.DB_DATABASE = process.env.DB_DATABASE || 'fundtrader';

process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';

process.env.MASTER_KEY = process.env.MASTER_KEY || 'e2e_master_key_at_least_32_characters_long';
process.env.ENCRYPTION_SALT = process.env.ENCRYPTION_SALT || 'e2e_salt_at_least_16_chars';

process.env.SCHEDULER_ENABLED = process.env.SCHEDULER_ENABLED || 'false';
process.env.BROKER_MOCK = process.env.BROKER_MOCK || 'true';
process.env.TELEGRAM_POLLING_ENABLED = process.env.TELEGRAM_POLLING_ENABLED || 'false';

process.env.ALLOWED_ORIGINS =
  process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001';
