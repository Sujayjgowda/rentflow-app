const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const { initDB, query } = require('./db');

// Ensure directories exist
fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/tenants', require('./routes/tenants'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ========================================
// Auto-generate monthly rent transactions
// Runs at 00:01 on the 5th of every month
// ========================================
async function generateMonthlyTransactions() {
    console.log('⏰ Running monthly transaction generation...');
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1; // 1-based
        const dueDate = `${year}-${String(month).padStart(2, '0')}-05`;

        // Get all active tenants linked to active properties
        const tenants = await query(`
            SELECT t.id as tenant_id, t.name as tenant_name, 
                   p.id as property_id, p.name as property_name, p.rent_amount, p.owner_id
            FROM tenants t
            JOIN properties p ON t.property_id = p.id
            WHERE t.is_active = 1 AND p.is_active = 1 AND p.rent_amount > 0
        `);

        let created = 0;
        for (const tenant of tenants.rows) {
            // Check if a transaction already exists for this tenant+property this month
            const existing = await query(`
                SELECT id FROM transactions 
                WHERE tenant_id = $1 AND property_id = $2 
                AND EXTRACT(YEAR FROM due_date::date) = $3 
                AND EXTRACT(MONTH FROM due_date::date) = $4
            `, [tenant.tenant_id, tenant.property_id, year, month]);

            if (existing.rows.length === 0) {
                const txId = uuidv4();
                await query(`
                    INSERT INTO transactions (id, property_id, tenant_id, amount, due_date, mode, status, notes, created_by)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [txId, tenant.property_id, tenant.tenant_id, tenant.rent_amount, dueDate, 'cash', 'pending', `Auto-generated rent for ${now.toLocaleString('default', { month: 'long' })} ${year}`, tenant.owner_id]);
                created++;
                console.log(`  ✅ Created pending transaction for ${tenant.tenant_name} — ₹${tenant.rent_amount} (${tenant.property_name})`);
            }
        }
        console.log(`📋 Monthly generation complete: ${created} new transaction(s) created`);
    } catch (err) {
        console.error('❌ Monthly transaction generation error:', err.message);
    }
}

// Initialize database then start server
initDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n🏠 RentFlow running at http://localhost:${PORT}`);
        console.log(`🗄️  Connected to PostgreSQL (Neon)\n`);
    });

    // Schedule: 00:01 on the 5th of every month
    cron.schedule('1 0 5 * *', generateMonthlyTransactions, { timezone: 'Asia/Kolkata' });
    console.log('📅 Cron scheduled: auto-generate transactions on 5th of every month');
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});
