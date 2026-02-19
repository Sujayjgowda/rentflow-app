const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.pdf', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(ext));
    }
});

const router = express.Router();

// List transactions with filters
router.get('/', authenticate, async (req, res) => {
    try {
        const { property_id, tenant_id, status, from_date, to_date, limit = 50, offset = 0 } = req.query;
        let where = [];
        let params = [];
        let paramIdx = 1;

        if (req.user.role === 'landlord') {
            where.push(`p.owner_id = $${paramIdx++}`);
            params.push(req.user.id);
        } else {
            where.push(`ten.user_id = $${paramIdx++}`);
            params.push(req.user.id);
        }

        if (property_id) { where.push(`tr.property_id = $${paramIdx++}`); params.push(property_id); }
        if (tenant_id) { where.push(`tr.tenant_id = $${paramIdx++}`); params.push(tenant_id); }
        if (status) { where.push(`tr.status = $${paramIdx++}`); params.push(status); }
        if (from_date) { where.push(`tr.due_date >= $${paramIdx++}`); params.push(from_date); }
        if (to_date) { where.push(`tr.due_date <= $${paramIdx++}`); params.push(to_date); }

        const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

        const transactions = await query(`
            SELECT tr.*, p.name as property_name, ten.name as tenant_name
            FROM transactions tr
            JOIN properties p ON tr.property_id = p.id
            LEFT JOIN tenants ten ON tr.tenant_id = ten.id
            ${whereClause}
            ORDER BY tr.due_date DESC
            LIMIT $${paramIdx++} OFFSET $${paramIdx++}
        `, [...params, parseInt(limit), parseInt(offset)]);

        const countResult = await query(`
            SELECT COUNT(*) as total
            FROM transactions tr
            JOIN properties p ON tr.property_id = p.id
            LEFT JOIN tenants ten ON tr.tenant_id = ten.id
            ${whereClause}
        `, params);

        res.json({ transactions: transactions.rows, total: parseInt(countResult.rows[0].total) });
    } catch (err) {
        console.error('List transactions error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get transaction summary for reports
router.get('/summary', authenticate, async (req, res) => {
    try {
        const { year, property_id } = req.query;
        const targetYear = year || new Date().getFullYear();

        let ownerFilter = '';
        let params = [String(targetYear)];
        let paramIdx = 2;

        if (req.user.role === 'landlord') {
            ownerFilter = `AND p.owner_id = $${paramIdx++}`;
            params.push(req.user.id);
        } else {
            ownerFilter = `AND ten.user_id = $${paramIdx++}`;
            params.push(req.user.id);
        }

        if (property_id) {
            ownerFilter += ` AND tr.property_id = $${paramIdx++}`;
            params.push(property_id);
        }

        // Monthly summary
        const monthly = await query(`
            SELECT 
                CAST(EXTRACT(MONTH FROM tr.due_date::date) AS INTEGER) as month,
                SUM(CASE WHEN tr.status = 'paid' THEN tr.amount ELSE 0 END) as paid_amount,
                SUM(CASE WHEN tr.status != 'paid' THEN tr.amount ELSE 0 END) as pending_amount,
                COUNT(CASE WHEN tr.status = 'paid' THEN 1 END) as paid_count,
                COUNT(CASE WHEN tr.status = 'pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN tr.status = 'overdue' THEN 1 END) as overdue_count,
                COUNT(*) as total_count
            FROM transactions tr
            JOIN properties p ON tr.property_id = p.id
            LEFT JOIN tenants ten ON tr.tenant_id = ten.id
            WHERE CAST(EXTRACT(YEAR FROM tr.due_date::date) AS TEXT) = $1 ${ownerFilter}
            GROUP BY EXTRACT(MONTH FROM tr.due_date::date)
            ORDER BY month
        `, params);

        // Annual totals
        const annual = await query(`
            SELECT 
                SUM(CASE WHEN tr.status = 'paid' THEN tr.amount ELSE 0 END) as total_paid,
                SUM(CASE WHEN tr.status != 'paid' THEN tr.amount ELSE 0 END) as total_pending,
                COUNT(CASE WHEN tr.status = 'paid' THEN 1 END) as paid_count,
                COUNT(CASE WHEN tr.status = 'overdue' THEN 1 END) as overdue_count,
                COUNT(*) as total_count
            FROM transactions tr
            JOIN properties p ON tr.property_id = p.id
            LEFT JOIN tenants ten ON tr.tenant_id = ten.id
            WHERE CAST(EXTRACT(YEAR FROM tr.due_date::date) AS TEXT) = $1 ${ownerFilter}
        `, params);

        // By property breakdown
        const byProperty = await query(`
            SELECT 
                p.id, p.name,
                SUM(CASE WHEN tr.status = 'paid' THEN tr.amount ELSE 0 END) as paid_amount,
                SUM(CASE WHEN tr.status != 'paid' THEN tr.amount ELSE 0 END) as pending_amount,
                COUNT(*) as total_count
            FROM transactions tr
            JOIN properties p ON tr.property_id = p.id
            LEFT JOIN tenants ten ON tr.tenant_id = ten.id
            WHERE CAST(EXTRACT(YEAR FROM tr.due_date::date) AS TEXT) = $1 ${ownerFilter}
            GROUP BY p.id, p.name
            ORDER BY paid_amount DESC
        `, params);

        // By payment mode
        const byMode = await query(`
            SELECT 
                tr.mode,
                COUNT(*) as count,
                SUM(tr.amount) as total_amount
            FROM transactions tr
            JOIN properties p ON tr.property_id = p.id
            LEFT JOIN tenants ten ON tr.tenant_id = ten.id
            WHERE tr.status = 'paid' AND CAST(EXTRACT(YEAR FROM tr.due_date::date) AS TEXT) = $1 ${ownerFilter}
            GROUP BY tr.mode
        `, params);

        res.json({
            monthly: monthly.rows,
            annual: annual.rows[0] || { total_paid: 0, total_pending: 0, paid_count: 0, overdue_count: 0, total_count: 0 },
            byProperty: byProperty.rows,
            byMode: byMode.rows,
            year: parseInt(targetYear)
        });
    } catch (err) {
        console.error('Transaction summary error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create transaction
router.post('/', authenticate, upload.single('receipt'), async (req, res) => {
    try {
        const { property_id, tenant_id, amount, date_paid, due_date, mode, status, notes } = req.body;

        if (!property_id || !amount || !due_date) {
            return res.status(400).json({ error: 'Property ID, amount, and due date are required' });
        }

        if (req.user.role === 'landlord') {
            const prop = await query('SELECT id FROM properties WHERE id = $1 AND owner_id = $2', [property_id, req.user.id]);
            if (prop.rows.length === 0) return res.status(404).json({ error: 'Property not found' });
        }

        const id = uuidv4();
        const receipt_path = req.file ? `/uploads/${req.file.filename}` : null;

        await query(`
            INSERT INTO transactions (id, property_id, tenant_id, amount, date_paid, due_date, mode, status, receipt_path, notes, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [id, property_id, tenant_id || null, parseFloat(amount), date_paid || null, due_date, mode || 'cash', status || 'pending', receipt_path, notes || null, req.user.id]);

        await query('INSERT INTO activity_log (user_id, action, details) VALUES ($1, $2, $3)',
            [req.user.id, 'create_transaction', `Recorded ₹${amount} transaction for ${due_date}`]
        );

        const result = await query(`
            SELECT tr.*, p.name as property_name, ten.name as tenant_name
            FROM transactions tr
            JOIN properties p ON tr.property_id = p.id
            LEFT JOIN tenants ten ON tr.tenant_id = ten.id
            WHERE tr.id = $1
        `, [id]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create transaction error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update transaction
router.put('/:id', authenticate, async (req, res) => {
    try {
        const txResult = await query(`
            SELECT tr.* FROM transactions tr JOIN properties p ON tr.property_id = p.id
            WHERE tr.id = $1 AND (p.owner_id = $2 OR tr.created_by = $3)
        `, [req.params.id, req.user.id, req.user.id]);
        const transaction = txResult.rows[0];

        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

        const { amount, date_paid, due_date, mode, status, notes } = req.body;
        await query(`
            UPDATE transactions SET amount = $1, date_paid = $2, due_date = $3, mode = $4, status = $5, notes = $6 WHERE id = $7
        `, [
            amount !== undefined ? parseFloat(amount) : transaction.amount,
            date_paid !== undefined ? date_paid : transaction.date_paid,
            due_date || transaction.due_date,
            mode || transaction.mode,
            status || transaction.status,
            notes !== undefined ? notes : transaction.notes,
            req.params.id
        ]);

        const result = await query(`
            SELECT tr.*, p.name as property_name, ten.name as tenant_name
            FROM transactions tr
            JOIN properties p ON tr.property_id = p.id
            LEFT JOIN tenants ten ON tr.tenant_id = ten.id
            WHERE tr.id = $1
        `, [req.params.id]);

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update transaction error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete transaction
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const txResult = await query(`
            SELECT tr.* FROM transactions tr JOIN properties p ON tr.property_id = p.id
            WHERE tr.id = $1 AND p.owner_id = $2
        `, [req.params.id, req.user.id]);
        const transaction = txResult.rows[0];

        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

        if (transaction.receipt_path) {
            const filePath = path.join(__dirname, '..', transaction.receipt_path);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        await query('DELETE FROM transactions WHERE id = $1', [req.params.id]);
        res.json({ message: 'Transaction deleted' });
    } catch (err) {
        console.error('Delete transaction error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
