import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// Use DATABASE_URL if available (preferred for cloud deployments), otherwise individual env vars
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: { rejectUnauthorized: false }
    }
  : {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'postgres',
      database: process.env.DB_NAME || 'evolution_db',
      password: process.env.DB_PASSWORD || 'password',
      port: parseInt(process.env.DB_PORT) || 5432,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: process.env.DB_HOST && process.env.DB_HOST.includes('supabase.co') ? { rejectUnauthorized: false } : false
    };

const pool = new Pool(poolConfig);

// Test connection
pool.on('connect', () => {
  console.log('Connected to Supabase database');
});

pool.on('error', (err) => {
  console.error('Database connection error:', err);
});

export const query = (text, params) => pool.query(text, params);

export const getClient = () => pool.connect();

export default pool;