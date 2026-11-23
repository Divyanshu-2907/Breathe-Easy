import dotenv from 'dotenv';

dotenv.config();

export const config = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CACHE_TTL_MS: parseInt(process.env.CACHE_TTL_MS || '1800000', 10), // 30 minutes
  TIMEOUT_MS: parseInt(process.env.TIMEOUT_MS || '8000', 10), // 8 seconds default
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || '',
};

export default config;
