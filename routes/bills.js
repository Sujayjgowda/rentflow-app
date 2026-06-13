const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '..', 'uploads', 'bills');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `bill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`);
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

// List shared bills
router.get('/', authenticate, async (req, res) => {
    try {
        const { property_id, status } = req.query;
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
            whereClauses.push(`sb.property_id = $${paramIdx++}`);
            params.push(property_id);
        }

        if (status) {
            whereClauses.push(`sb.status = $${paramIdx++}`);
            params.push(status);
        }

        const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

        // Fetch bills
        const billsResult = await query(`
            SELECT sb.*, p.name as property_name, ten.name as tenant_name
            FROM shared_bills sb
            JOIN properties p ON sb.property_id = p.id
            JOIN tenants ten ON sb.tenant_id = ten.id
            ${whereStr}
            ORDER BY sb.due_date DESC, sb.created_at DESC
        `, params);

        // Fetch pending total
        const pendingParams = [...params];
        let pendingWhere = [...whereClauses];
        
        // Add pending check specifically for total
        const pendingIdx = pendingWhere.findIndex(c => c.includes('sb.status ='));
        if (pendingIdx !== -1) {
            // override filter if status is specified
            pendingWhere[pendingIdx] = `sb.status = 'pending'`;
        } else {
            pendingWhere.push(`sb.status = 'pending'`);
        }
        
        const pendingWhereStr = pendingWhere.length > 0 ? 'WHERE ' + pendingWhere.join(' AND ') : '';
        const pendingTotalResult = await query(`
            SELECT COALESCE(SUM(sb.tenant_share), 0) as total_pending
            FROM shared_bills sb
            JOIN properties p ON sb.property_id = p.id
            JOIN tenants ten ON sb.tenant_id = ten.id
            ${pendingWhereStr}
        `, params);

        res.json({
            bills: billsResult.rows,
            total_pending: parseFloat(pendingTotalResult.rows[0]?.total_pending || 0)
        });
    } catch (err) {
        console.error('List bills error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add new shared bill (landlord only)
router.post('/', authenticate, requireRole('landlord'), upload.single('bill'), async (req, res) => {
    try {
        const { property_id, tenant_id, bill_name, total_amount, due_date, notes } = req.body;

        if (!property_id || !tenant_id || !bill_name || !total_amount || !due_date) {
            return res.status(400).json({ error: 'Property, Tenant, Bill Name, Total Amount, and Due Date are required' });
        }

        // Verify property belongs to owner
        const propCheck = await query('SELECT id, name FROM properties WHERE id = $1 AND owner_id = $2', [property_id, req.user.id]);
        if (propCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Property not found or access denied' });
        }

        // Verify tenant belongs to property
        const tenantCheck = await query('SELECT id, name FROM tenants WHERE id = $1 AND property_id = $2', [tenant_id, property_id]);
        if (tenantCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Tenant not found under this property' });
        }

        const id = uuidv4();
        const file_path = req.file ? `/uploads/bills/${req.file.filename}` : null;
        const parsedTotal = parseFloat(total_amount);
        const tenant_share = parsedTotal / 2;

        await query(`
            INSERT INTO shared_bills (id, property_id, tenant_id, bill_name, total_amount, tenant_share, due_date, file_path, status, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [id, property_id, tenant_id, bill_name, parsedTotal, tenant_share, due_date, file_path, 'pending', req.user.id]);

        await query('INSERT INTO activity_log (user_id, action, details) VALUES ($1, $2, $3)', [
            req.user.id,
            'add_shared_bill',
            `Uploaded bill "${bill_name}" for ₹${parsedTotal} (split: ₹${tenant_share} each)`
        ]);

        const result = await query(`
            SELECT sb.*, p.name as property_name, ten.name as tenant_name
            FROM shared_bills sb
            JOIN properties p ON sb.property_id = p.id
            JOIN tenants ten ON sb.tenant_id = ten.id
            WHERE sb.id = $1
        `, [id]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create bill error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update shared bill (landlord only)
router.put('/:id', authenticate, requireRole('landlord'), async (req, res) => {
    try {
        const { id } = req.params;
        const { bill_name, total_amount, due_date, status, notes } = req.body;

        // Verify bill belongs to landlord's property
        const billCheck = await query(`
            SELECT sb.* FROM shared_bills sb 
            JOIN properties p ON sb.property_id = p.id 
            WHERE sb.id = $1 AND p.owner_id = $2
        `, [id, req.user.id]);

        const bill = billCheck.rows[0];
        if (!bill) {
            return res.status(404).json({ error: 'Bill not found or access denied' });
        }

        const newTotal = total_amount !== undefined ? parseFloat(total_amount) : bill.total_amount;
        const tenant_share = newTotal / 2;

        await query(`
            UPDATE shared_bills 
            SET bill_name = $1, total_amount = $2, tenant_share = $3, due_date = $4, status = $5
            WHERE id = $6
        `, [
            bill_name || bill.bill_name,
            newTotal,
            tenant_share,
            due_date || bill.due_date,
            status || bill.status,
            id
        ]);

        const result = await query(`
            SELECT sb.*, p.name as property_name, ten.name as tenant_name
            FROM shared_bills sb
            JOIN properties p ON sb.property_id = p.id
            JOIN tenants ten ON sb.tenant_id = ten.id
            WHERE sb.id = $1
        `, [id]);

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update bill error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Mark bill status (landlord only)
router.patch('/:id/status', authenticate, requireRole('landlord'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !['paid', 'pending'].includes(status)) {
            return res.status(400).json({ error: 'Valid status is required' });
        }

        const billCheck = await query(`
            SELECT sb.* FROM shared_bills sb 
            JOIN properties p ON sb.property_id = p.id 
            WHERE sb.id = $1 AND p.owner_id = $2
        `, [id, req.user.id]);

        if (billCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Bill not found or access denied' });
        }

        await query('UPDATE shared_bills SET status = $1 WHERE id = $2', [status, id]);

        res.json({ message: `Bill status updated to ${status}` });
    } catch (err) {
        console.error('Patch bill status error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete shared bill (landlord only)
router.delete('/:id', authenticate, requireRole('landlord'), async (req, res) => {
    try {
        const { id } = req.params;

        const billCheck = await query(`
            SELECT sb.* FROM shared_bills sb 
            JOIN properties p ON sb.property_id = p.id 
            WHERE sb.id = $1 AND p.owner_id = $2
        `, [id, req.user.id]);

        const bill = billCheck.rows[0];
        if (!bill) {
            return res.status(404).json({ error: 'Bill not found or access denied' });
        }

        if (bill.file_path) {
            const fullPath = path.join(__dirname, '..', bill.file_path);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
        }

        await query('DELETE FROM shared_bills WHERE id = $1', [id]);

        res.json({ message: 'Shared bill successfully deleted' });
    } catch (err) {
        console.error('Delete bill error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
