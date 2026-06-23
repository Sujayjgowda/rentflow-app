const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `advance_receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.pdf', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(ext));
    }
});

const router = express.Router();

// List advance payments (with filters and totals)
router.get('/', authenticate, async (req, res) => {
    try {
        const { property_id, tenant_id } = req.query;
        let whereClauses = [];
        let params = [];
        let paramIdx = 1;

        if (req.user.role === 'landlord') {
            whereClauses.push(`p.owner_id = $${paramIdx++}`);
            params.push(req.user.id);
        } else {
            whereClauses.push(`ten.user_id = $${paramIdx++}`);
            params.push(req.user.id);
        }

        if (property_id) {
            whereClauses.push(`ap.property_id = $${paramIdx++}`);
            params.push(property_id);
        }

        if (tenant_id) {
            whereClauses.push(`ap.tenant_id = $${paramIdx++}`);
            params.push(tenant_id);
        }

        const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

        const result = await query(`
            SELECT ap.*, p.name as property_name, ten.name as tenant_name, u.name as created_by_name
            FROM advance_payments ap
            JOIN properties p ON ap.property_id = p.id
            JOIN tenants ten ON ap.tenant_id = ten.id
            LEFT JOIN users u ON ap.created_by = u.id
            ${whereStr}
            ORDER BY ap.paid_date DESC, ap.created_at DESC
        `, params);

        // Calculate total
        const totalResult = await query(`
            SELECT COALESCE(SUM(ap.amount), 0) as total_advance
            FROM advance_payments ap
            JOIN properties p ON ap.property_id = p.id
            JOIN tenants ten ON ap.tenant_id = ten.id
            ${whereStr}
        `, params);

        res.json({
            advances: result.rows,
            total_advance: parseFloat(totalResult.rows[0]?.total_advance || 0)
        });
    } catch (err) {
        console.error('List advances error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add advance payment (landlord only)
router.post('/', authenticate, requireRole('landlord'), upload.single('receipt'), async (req, res) => {
    try {
        const { property_id, tenant_id, amount, paid_date, notes } = req.body;

        if (!property_id || !tenant_id || !amount || !paid_date) {
            return res.status(400).json({ error: 'Property, tenant, amount, and date are required' });
        }

        // Verify property ownership
        const prop = await query('SELECT id, name FROM properties WHERE id = $1 AND owner_id = $2', [property_id, req.user.id]);
        if (prop.rows.length === 0) return res.status(404).json({ error: 'Property not found' });

        // Verify tenant belongs to property
        const tenant = await query('SELECT id, name FROM tenants WHERE id = $1 AND property_id = $2', [tenant_id, property_id]);
        if (tenant.rows.length === 0) return res.status(404).json({ error: 'Tenant not found in this property' });

        const id = uuidv4();
        const receipt_path = req.file ? `/uploads/${req.file.filename}` : null;

        await query(
            'INSERT INTO advance_payments (id, property_id, tenant_id, amount, paid_date, notes, receipt_path, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [id, property_id, tenant_id, parseFloat(amount), paid_date, notes || null, receipt_path, req.user.id]
        );

        await query('INSERT INTO activity_log (user_id, action, details) VALUES ($1, $2, $3)',
            [req.user.id, 'add_advance', `Added advance ₹${amount} for ${tenant.rows[0].name} at ${prop.rows[0].name}`]
        );

        const result = await query(`
            SELECT ap.*, p.name as property_name, ten.name as tenant_name
            FROM advance_payments ap
            JOIN properties p ON ap.property_id = p.id
            JOIN tenants ten ON ap.tenant_id = ten.id
            WHERE ap.id = $1
        `, [id]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Add advance error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update advance payment (landlord only)
router.put('/:id', authenticate, requireRole('landlord'), upload.single('receipt'), async (req, res) => {
    try {
        const advResult = await query(`
            SELECT ap.* FROM advance_payments ap
            JOIN properties p ON ap.property_id = p.id
            WHERE ap.id = $1 AND p.owner_id = $2
        `, [req.params.id, req.user.id]);
        const advance = advResult.rows[0];

        if (!advance) return res.status(404).json({ error: 'Advance payment not found' });

        const { amount, paid_date, notes } = req.body;
        
        let receipt_path = advance.receipt_path;
        if (req.file) {
            // Delete old file if exists
            if (receipt_path) {
                const oldPath = path.join(__dirname, '..', receipt_path);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            receipt_path = `/uploads/${req.file.filename}`;
        }

        await query(
            'UPDATE advance_payments SET amount = $1, paid_date = $2, notes = $3, receipt_path = $4 WHERE id = $5',
            [
                amount !== undefined ? parseFloat(amount) : advance.amount,
                paid_date || advance.paid_date,
                notes !== undefined ? notes : advance.notes,
                receipt_path,
                req.params.id
            ]
        );

        const result = await query(`
            SELECT ap.*, p.name as property_name, ten.name as tenant_name
            FROM advance_payments ap
            JOIN properties p ON ap.property_id = p.id
            JOIN tenants ten ON ap.tenant_id = ten.id
            WHERE ap.id = $1
        `, [req.params.id]);

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update advance error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete advance payment (landlord only)
router.delete('/:id', authenticate, requireRole('landlord'), async (req, res) => {
    try {
        const advResult = await query(`
            SELECT ap.* FROM advance_payments ap
            JOIN properties p ON ap.property_id = p.id
            WHERE ap.id = $1 AND p.owner_id = $2
        `, [req.params.id, req.user.id]);

        if (advResult.rows.length === 0) return res.status(404).json({ error: 'Advance payment not found' });

        const advance = advResult.rows[0];
        if (advance.receipt_path) {
            const filePath = path.join(__dirname, '..', advance.receipt_path);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        await query('DELETE FROM advance_payments WHERE id = $1', [req.params.id]);
        res.json({ message: 'Advance payment deleted' });
    } catch (err) {
        console.error('Delete advance error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
