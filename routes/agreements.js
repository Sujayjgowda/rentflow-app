const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Configure multer for agreement uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', 'agreements');
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `agreement-${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF and image files (JPG, PNG, WebP) are allowed'));
        }
    }
});

// Get agreement for a property
router.get('/:property_id', authenticate, async (req, res) => {
    try {
        const { property_id } = req.params;

        // Verify access
        if (req.user.role === 'landlord') {
            const prop = await query('SELECT id FROM properties WHERE id = $1 AND owner_id = $2', [property_id, req.user.id]);
            if (prop.rows.length === 0) return res.status(404).json({ error: 'Property not found' });
        } else {
            const tenant = await query(
                'SELECT t.id FROM tenants t JOIN properties p ON t.property_id = p.id WHERE t.user_id = $1 AND t.property_id = $2 AND t.is_active = 1',
                [req.user.id, property_id]
            );
            if (tenant.rows.length === 0) return res.status(403).json({ error: 'Access denied' });
        }

        const result = await query(
            'SELECT ra.*, u.name as uploaded_by_name FROM rent_agreements ra LEFT JOIN users u ON ra.uploaded_by = u.id WHERE ra.property_id = $1 ORDER BY ra.updated_at DESC LIMIT 1',
            [property_id]
        );

        res.json(result.rows[0] || null);
    } catch (err) {
        console.error('Get agreement error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// List all agreements for landlord's properties
router.get('/', authenticate, async (req, res) => {
    try {
        let result;
        if (req.user.role === 'landlord') {
            result = await query(`
                SELECT ra.*, p.name as property_name, u.name as uploaded_by_name
                FROM rent_agreements ra
                JOIN properties p ON ra.property_id = p.id
                LEFT JOIN users u ON ra.uploaded_by = u.id
                WHERE p.owner_id = $1
                ORDER BY ra.updated_at DESC
            `, [req.user.id]);
        } else {
            result = await query(`
                SELECT ra.*, p.name as property_name, u.name as uploaded_by_name
                FROM rent_agreements ra
                JOIN properties p ON ra.property_id = p.id
                JOIN tenants t ON t.property_id = p.id
                LEFT JOIN users u ON ra.uploaded_by = u.id
                WHERE t.user_id = $1 AND t.is_active = 1
                ORDER BY ra.updated_at DESC
            `, [req.user.id]);
        }
        res.json(result.rows);
    } catch (err) {
        console.error('List agreements error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Upload/replace agreement (landlord only)
router.post('/:property_id', authenticate, requireRole('landlord'), upload.single('agreement'), async (req, res) => {
    try {
        const { property_id } = req.params;

        // Verify property ownership
        const prop = await query('SELECT id, name FROM properties WHERE id = $1 AND owner_id = $2', [property_id, req.user.id]);
        if (prop.rows.length === 0) return res.status(404).json({ error: 'Property not found' });

        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        // Delete old agreement file if exists
        const existing = await query('SELECT id, file_path FROM rent_agreements WHERE property_id = $1', [property_id]);
        if (existing.rows.length > 0) {
            const oldPath = path.join(__dirname, '..', existing.rows[0].file_path);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            await query('DELETE FROM rent_agreements WHERE property_id = $1', [property_id]);
        }

        const id = uuidv4();
        const filePath = `/uploads/agreements/${req.file.filename}`;

        await query(
            'INSERT INTO rent_agreements (id, property_id, file_name, file_path, file_type, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6)',
            [id, property_id, req.file.originalname, filePath, req.file.mimetype, req.user.id]
        );

        await query('INSERT INTO activity_log (user_id, action, details) VALUES ($1, $2, $3)',
            [req.user.id, 'upload_agreement', `Uploaded rent agreement for ${prop.rows[0].name}`]
        );

        const result = await query(
            'SELECT ra.*, u.name as uploaded_by_name FROM rent_agreements ra LEFT JOIN users u ON ra.uploaded_by = u.id WHERE ra.id = $1',
            [id]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Upload agreement error:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
});

// Delete agreement (landlord only)
router.delete('/:property_id', authenticate, requireRole('landlord'), async (req, res) => {
    try {
        const { property_id } = req.params;

        const prop = await query('SELECT id FROM properties WHERE id = $1 AND owner_id = $2', [property_id, req.user.id]);
        if (prop.rows.length === 0) return res.status(404).json({ error: 'Property not found' });

        const existing = await query('SELECT id, file_path FROM rent_agreements WHERE property_id = $1', [property_id]);
        if (existing.rows.length === 0) return res.status(404).json({ error: 'No agreement found' });

        const oldPath = path.join(__dirname, '..', existing.rows[0].file_path);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

        await query('DELETE FROM rent_agreements WHERE property_id = $1', [property_id]);

        res.json({ message: 'Agreement deleted' });
    } catch (err) {
        console.error('Delete agreement error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
