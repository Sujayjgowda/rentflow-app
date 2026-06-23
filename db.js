const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Initialize database tables
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('landlord', 'tenant', 'admin')),
                phone TEXT UNIQUE NOT NULL,
                avatar_color TEXT DEFAULT '#6366f1',
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS properties (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                address TEXT,
                rent_amount NUMERIC NOT NULL DEFAULT 0,
                due_day INTEGER NOT NULL DEFAULT 1,
                property_type TEXT DEFAULT 'apartment',
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS tenants (
                id TEXT PRIMARY KEY,
                property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
                user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
                name TEXT NOT NULL,
                email TEXT,
                phone TEXT,
                lease_start TEXT,
                lease_end TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
                tenant_id TEXT REFERENCES tenants(id) ON DELETE SET NULL,
                amount NUMERIC NOT NULL,
                date_paid TEXT,
                due_date TEXT NOT NULL,
                mode TEXT DEFAULT 'cash',
                status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('paid', 'pending', 'overdue')),
                receipt_path TEXT,
                notes TEXT,
                created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS activity_log (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
                action TEXT NOT NULL,
                details TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS rent_agreements (
                id TEXT PRIMARY KEY,
                property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_type TEXT,
                uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS advance_payments (
                id TEXT PRIMARY KEY,
                property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
                tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                amount NUMERIC NOT NULL,
                paid_date TEXT NOT NULL,
                notes TEXT,
                created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS shared_bills (
                id TEXT PRIMARY KEY,
                property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
                tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                bill_name TEXT NOT NULL,
                total_amount NUMERIC NOT NULL,
                tenant_share NUMERIC NOT NULL,
                due_date TEXT NOT NULL,
                file_path TEXT,
                status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('paid', 'pending')),
                created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
    console.log('✅ Database tables initialized');

    // Run schema constraint migration if needed
    try {
      await client.query(`
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
        ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('landlord', 'tenant', 'admin'));
      `);
      console.log('✅ Users role constraint verified/migrated');
    } catch (migrationErr) {
      console.warn('⚠️ Users role constraint migration warning:', migrationErr.message);
    }

    // Migrate: make email optional and phone mandatory
    try {
      await client.query(`
        ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
      `);
      console.log('✅ Email column made optional');
    } catch (migrationErr) {
      console.warn('⚠️ Email migration warning:', migrationErr.message);
    }

    try {
      await client.query(`
        ALTER TABLE users ALTER COLUMN phone SET NOT NULL;
      `);
      console.log('✅ Phone column made mandatory');
    } catch (migrationErr) {
      console.warn('⚠️ Phone migration warning:', migrationErr.message);
    }

    // Add unique constraint on phone if not exists
    try {
      await client.query(`
        ALTER TABLE users ADD CONSTRAINT users_phone_key UNIQUE (phone);
      `);
      console.log('✅ Phone unique constraint added');
    } catch (migrationErr) {
      // Constraint may already exist
      if (!migrationErr.message.includes('already exists')) {
        console.warn('⚠️ Phone unique constraint warning:', migrationErr.message);
      }
    }

    // Seed admin account if it doesn't exist
    const adminCheck = await client.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (adminCheck.rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const { v4: uuidv4 } = require('uuid');
      const adminId = uuidv4();
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@rentflow.com';
      const adminPhone = process.env.ADMIN_PHONE || '9999999999';
      const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword123';
      const passwordHash = bcrypt.hashSync(adminPassword, 10);

      await client.query(`
        INSERT INTO users (id, name, email, phone, password_hash, role, avatar_color)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [adminId, 'RentFlow Admin', adminEmail, adminPhone, passwordHash, 'admin', '#4f46e5']);
      console.log(`👤 Seeded default admin user: ${adminEmail}`);
    }
  } catch (err) {
    console.error('❌ Database initialization error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// Helper: query wrapper
async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query, initDB };
