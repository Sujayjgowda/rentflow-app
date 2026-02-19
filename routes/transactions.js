const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
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
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.pdf', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(ext));
    }
});

const router = express.Router();

// List transactions with filters
router.get('/', authenticate, (req, res) => {
    try {
        const { property_id, tenant_id, status, from_date, to_date, limit = 50, offset = 0 } = req.query;
        let where = [];
        let params = [];

        if (req.user.role === 'landlord') {
            where.push('p.owner_id = ?');
            params.push(req.user.id);
        } else {
            where.push('ten.user_id = ?');
            params.push(req.user.id);
        }

        if (property_id) { where.push('tr.property_id = ?'); params.push(property_id); }
        if (tenant_id) { where.push('tr.tenant_id = ?'); params.push(tenant_id); }
        if (status) { where.push('tr.status = ?'); params.push(status); }
        if (from_date) { where.push('tr.due_date >= ?'); params.push(from_date); }
        if (to_date) { where.push('tr.due_date <= ?'); params.push(to_date); }

        const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

        const transactions = db.prepare(`
      SELECT tr.*, p.name as property_name, ten.name as tenant_name
      FROM transactions tr
      JOIN properties p ON tr.property_id = p.id
      LEFT JOIN tenants ten ON tr.tenant_id = ten.id
      ${whereClause}
      ORDER BY tr.due_date DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), parseInt(offset));

        const countResult = db.prepare(`
      SELECT COUNT(*) as total
      FROM transactions tr
      JOIN properties p ON tr.property_id = p.id
      LEFT JOIN tenants ten ON tr.tenant_id = ten.id
      ${whereClause}
    `).get(...params);

        res.json({ transactions, total: countResult.total });
    } catch (err) {
        console.error('List transactions error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get transaction summary for reports
router.get('/summary', authenticate, (req, res) => {
    try {
        const { year, property_id } = req.query;
        const targetYear = year || new Date().getFullYear();

        let ownerFilter = '';
        let params = [targetYear];

        if (req.user.role === 'landlord') {
            ownerFilter = 'AND p.owner_id = ?';
            params.push(req.user.id);
        } else {
            ownerFilter = 'AND ten.user_id = ?';
            params.push(req.user.id);
        }

        if (property_id) {
            ownerFilter += ' AND tr.property_id = ?';
            params.push(property_id);
        }

        // Monthly summary
        const monthly = db.prepare(`
      SELECT 
        CAST(strftime('%m', tr.due_date) AS INTEGER) as month,
        SUM(CASE WHEN tr.status = 'paid' THEN tr.amount ELSE 0 END) as paid_amount,
        SUM(CASE WHEN tr.status != 'paid' THEN tr.amount ELSE 0 END) as pending_amount,
        COUNT(CASE WHEN tr.status = 'paid' THEN 1 END) as paid_count,
        COUNT(CASE WHEN tr.status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN tr.status = 'overdue' THEN 1 END) as overdue_count,
        COUNT(*) as total_count
      FROM transactions tr
      JOIN properties p ON tr.property_id = p.id
      LEFT JOIN tenants ten ON tr.tenant_id = ten.id
      WHERE strftime('%Y', tr.due_date) = ? ${ownerFilter}
      GROUP BY strftime('%m', tr.due_date)
      ORDER BY month
    `).all(...params);

        // Annual totals
        const annual = db.prepare(`
      SELECT 
        SUM(CASE WHEN tr.status = 'paid' THEN tr.amount ELSE 0 END) as total_paid,
        SUM(CASE WHEN tr.status != 'paid' THEN tr.amount ELSE 0 END) as total_pending,
        COUNT(CASE WHEN tr.status = 'paid' THEN 1 END) as paid_count,
        COUNT(CASE WHEN tr.status = 'overdue' THEN 1 END) as overdue_count,
        COUNT(*) as total_count
      FROM transactions tr
      JOIN properties p ON tr.property_id = p.id
      LEFT JOIN tenants ten ON tr.tenant_id = ten.id
      WHERE strftime('%Y', tr.due_date) = ? ${ownerFilter}
    `).get(...params);

        // By property breakdown
        const byProperty = db.prepare(`
      SELECT 
        p.id, p.name,
        SUM(CASE WHEN tr.status = 'paid' THEN tr.amount ELSE 0 END) as paid_amount,
        SUM(CASE WHEN tr.status != 'paid' THEN tr.amount ELSE 0 END) as pending_amount,
        COUNT(*) as total_count
      FROM transactions tr
      JOIN properties p ON tr.property_id = p.id
      LEFT JOIN tenants ten ON tr.tenant_id = ten.id
      WHERE strftime('%Y', tr.due_date) = ? ${ownerFilter}
      GROUP BY p.id
      ORDER BY paid_amount DESC
    `).all(...params);

        // By payment mode
        const byMode = db.prepare(`
      SELECT 
        tr.mode,
        COUNT(*) as count,
        SUM(tr.amount) as total_amount
      FROM transactions tr
      JOIN properties p ON tr.property_id = p.id
      LEFT JOIN tenants ten ON tr.tenant_id = ten.id
      WHERE tr.status = 'paid' AND strftime('%Y', tr.due_date) = ? ${ownerFilter}
      GROUP BY tr.mode
    `).all(...params);

        res.json({ monthly, annual, byProperty, byMode, year: parseInt(targetYear) });
    } catch (err) {
        console.error('Transaction summary error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create transaction
router.post('/', authenticate, upload.single('receipt'), (req, res) => {
    try {
        const { property_id, tenant_id, amount, date_paid, due_date, mode, status, notes } = req.body;

        if (!property_id || !amount || !due_date) {
            return res.status(400).json({ error: 'Property ID, amount, and due date are required' });
        }

        // Verify access
        if (req.user.role === 'landlord') {
            const prop = db.prepare('SELECT id FROM properties WHERE id = ? AND owner_id = ?').get(property_id, req.user.id);
            if (!prop) return res.status(404).json({ error: 'Property not found' });
        }

        const id = uuidv4();
        const receipt_path = req.file ? `/uploads/${req.file.filename}` : null;

        db.prepare(`
      INSERT INTO transactions (id, property_id, tenant_id, amount, date_paid, due_date, mode, status, receipt_path, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, property_id, tenant_id || null, parseFloat(amount), date_paid || null, due_date, mode || 'cash', status || 'pending', receipt_path, notes || null, req.user.id);

        db.prepare('INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)').run(
            req.user.id, 'create_transaction', `Recorded ₹${amount} transaction for ${due_date}`
        );

        const transaction = db.prepare(`
      SELECT tr.*, p.name as property_name, ten.name as tenant_name
      FROM transactions tr
      JOIN properties p ON tr.property_id = p.id
      LEFT JOIN tenants ten ON tr.tenant_id = ten.id
      WHERE tr.id = ?
    `).get(id);

        res.status(201).json(transaction);
    } catch (err) {
        console.error('Create transaction error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update transaction
router.put('/:id', authenticate, (req, res) => {
    try {
        const transaction = db.prepare(`
      SELECT tr.* FROM transactions tr JOIN properties p ON tr.property_id = p.id
      WHERE tr.id = ? AND (p.owner_id = ? OR tr.created_by = ?)
    `).get(req.params.id, req.user.id, req.user.id);

        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

        const { amount, date_paid, due_date, mode, status, notes } = req.body;
        db.prepare(`
      UPDATE transactions SET amount = ?, date_paid = ?, due_date = ?, mode = ?, status = ?, notes = ? WHERE id = ?
    `).run(
            amount !== undefined ? parseFloat(amount) : transaction.amount,
            date_paid !== undefined ? date_paid : transaction.date_paid,
            due_date || transaction.due_date,
            mode || transaction.mode,
            status || transaction.status,
            notes !== undefined ? notes : transaction.notes,
            req.params.id
        );

        const updated = db.prepare(`
      SELECT tr.*, p.name as property_name, ten.name as tenant_name
      FROM transactions tr
      JOIN properties p ON tr.property_id = p.id
      LEFT JOIN tenants ten ON tr.tenant_id = ten.id
      WHERE tr.id = ?
    `).get(req.params.id);

        res.json(updated);
    } catch (err) {
        console.error('Update transaction error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete transaction
router.delete('/:id', authenticate, (req, res) => {
    try {
        const transaction = db.prepare(`
      SELECT tr.* FROM transactions tr JOIN properties p ON tr.property_id = p.id
      WHERE tr.id = ? AND p.owner_id = ?
    `).get(req.params.id, req.user.id);

        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

        // Delete receipt file if exists
        if (transaction.receipt_path) {
            const filePath = path.join(__dirname, '..', transaction.receipt_path);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
        res.json({ message: 'Transaction deleted' });
    } catch (err) {
        console.error('Delete transaction error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
