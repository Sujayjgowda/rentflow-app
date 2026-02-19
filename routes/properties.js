const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// List properties for landlord
router.get('/', authenticate, async (req, res) => {
    try {
        let result;
        if (req.user.role === 'landlord') {
            result = await query(`
                SELECT p.*, 
                  (SELECT COUNT(*) FROM tenants t WHERE t.property_id = p.id AND t.is_active = 1) as tenant_count,
                  (SELECT COALESCE(SUM(tr.amount), 0) FROM transactions tr WHERE tr.property_id = p.id AND tr.status = 'paid') as total_collected,
                  (SELECT COUNT(*) FROM transactions tr WHERE tr.property_id = p.id AND tr.status = 'overdue') as overdue_count
                FROM properties p 
                WHERE p.owner_id = $1 AND p.is_active = 1
                ORDER BY p.created_at DESC
            `, [req.user.id]);
        } else {
            result = await query(`
                SELECT p.*, 
                  (SELECT COUNT(*) FROM tenants t WHERE t.property_id = p.id AND t.is_active = 1) as tenant_count
                FROM properties p 
                JOIN tenants t ON t.property_id = p.id 
                WHERE t.user_id = $1 AND t.is_active = 1 AND p.is_active = 1
                ORDER BY p.created_at DESC
            `, [req.user.id]);
        }
        res.json(result.rows);
    } catch (err) {
        console.error('List properties error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single property
router.get('/:id', authenticate, async (req, res) => {
    try {
        const result = await query('SELECT * FROM properties WHERE id = $1 AND is_active = 1', [req.params.id]);
        const property = result.rows[0];
        if (!property) {
            return res.status(404).json({ error: 'Property not found' });
        }
        if (req.user.role === 'landlord' && property.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        res.json(property);
    } catch (err) {
        console.error('Get property error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create property
router.post('/', authenticate, requireRole('landlord'), async (req, res) => {
    try {
        const { name, address, rent_amount, due_day, property_type } = req.body;

        if (!name || rent_amount === undefined) {
            return res.status(400).json({ error: 'Property name and rent amount are required' });
        }

        const id = uuidv4();
        await query(
            'INSERT INTO properties (id, owner_id, name, address, rent_amount, due_day, property_type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [id, req.user.id, name, address || '', rent_amount, due_day || 1, property_type || 'apartment']
        );

        await query('INSERT INTO activity_log (user_id, action, details) VALUES ($1, $2, $3)',
            [req.user.id, 'create_property', `Created property: ${name}`]
        );

        const result = await query('SELECT * FROM properties WHERE id = $1', [id]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create property error:', err.message, err.stack);
        res.status(500).json({ error: 'Internal server error', detail: err.message });
    }
});

// Update property
router.put('/:id', authenticate, requireRole('landlord'), async (req, res) => {
    try {
        const propResult = await query('SELECT * FROM properties WHERE id = $1 AND owner_id = $2', [req.params.id, req.user.id]);
        const property = propResult.rows[0];
        if (!property) {
            return res.status(404).json({ error: 'Property not found' });
        }

        const { name, address, rent_amount, due_day, property_type } = req.body;
        await query(
            'UPDATE properties SET name = $1, address = $2, rent_amount = $3, due_day = $4, property_type = $5 WHERE id = $6',
            [
                name || property.name,
                address !== undefined ? address : property.address,
                rent_amount !== undefined ? rent_amount : property.rent_amount,
                due_day || property.due_day,
                property_type || property.property_type,
                req.params.id
            ]
        );

        const result = await query('SELECT * FROM properties WHERE id = $1', [req.params.id]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update property error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete property (soft delete)
router.delete('/:id', authenticate, requireRole('landlord'), async (req, res) => {
    try {
        const propResult = await query('SELECT * FROM properties WHERE id = $1 AND owner_id = $2', [req.params.id, req.user.id]);
        const property = propResult.rows[0];
        if (!property) {
            return res.status(404).json({ error: 'Property not found' });
        }

        await query('UPDATE properties SET is_active = 0 WHERE id = $1', [req.params.id]);

        await query('INSERT INTO activity_log (user_id, action, details) VALUES ($1, $2, $3)',
            [req.user.id, 'delete_property', `Deleted property: ${property.name}`]
        );

        res.json({ message: 'Property deleted' });
    } catch (err) {
        console.error('Delete property error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
