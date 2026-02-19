const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// List tenants (optionally filtered by property)
router.get('/', authenticate, async (req, res) => {
    try {
        const { property_id } = req.query;
        let result;

        if (req.user.role === 'landlord') {
            if (property_id) {
                const prop = await query('SELECT id FROM properties WHERE id = $1 AND owner_id = $2', [property_id, req.user.id]);
                if (prop.rows.length === 0) return res.status(404).json({ error: 'Property not found' });

                result = await query(`
                    SELECT t.*, p.name as property_name 
                    FROM tenants t JOIN properties p ON t.property_id = p.id 
                    WHERE t.property_id = $1 AND t.is_active = 1 
                    ORDER BY t.created_at DESC
                `, [property_id]);
            } else {
                result = await query(`
                    SELECT t.*, p.name as property_name 
                    FROM tenants t 
                    JOIN properties p ON t.property_id = p.id 
                    WHERE p.owner_id = $1 AND t.is_active = 1 
                    ORDER BY t.created_at DESC
                `, [req.user.id]);
            }
        } else {
            result = await query(`
                SELECT t.*, p.name as property_name 
                FROM tenants t 
                JOIN properties p ON t.property_id = p.id 
                WHERE t.user_id = $1 AND t.is_active = 1
            `, [req.user.id]);
        }

        res.json(result.rows);
    } catch (err) {
        console.error('List tenants error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add tenant to property
router.post('/', authenticate, requireRole('landlord'), async (req, res) => {
    try {
        const { property_id, name, email, phone, lease_start, lease_end } = req.body;

        if (!property_id || !name) {
            return res.status(400).json({ error: 'Property ID and tenant name are required' });
        }

        const prop = await query('SELECT id FROM properties WHERE id = $1 AND owner_id = $2', [property_id, req.user.id]);
        if (prop.rows.length === 0) return res.status(404).json({ error: 'Property not found' });

        let user_id = null;
        if (email) {
            const tenantUser = await query('SELECT id FROM users WHERE email = $1 AND role = $2', [email, 'tenant']);
            if (tenantUser.rows.length > 0) user_id = tenantUser.rows[0].id;
        }

        const id = uuidv4();
        await query(
            'INSERT INTO tenants (id, property_id, user_id, name, email, phone, lease_start, lease_end) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [id, property_id, user_id, name, email || null, phone || null, lease_start || null, lease_end || null]
        );

        await query('INSERT INTO activity_log (user_id, action, details) VALUES ($1, $2, $3)',
            [req.user.id, 'add_tenant', `Added tenant ${name} to property`]
        );

        const result = await query('SELECT t.*, p.name as property_name FROM tenants t JOIN properties p ON t.property_id = p.id WHERE t.id = $1', [id]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Add tenant error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update tenant
router.put('/:id', authenticate, requireRole('landlord'), async (req, res) => {
    try {
        const tenantResult = await query(`
            SELECT t.* FROM tenants t JOIN properties p ON t.property_id = p.id 
            WHERE t.id = $1 AND p.owner_id = $2
        `, [req.params.id, req.user.id]);
        const tenant = tenantResult.rows[0];
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

        const { name, email, phone, lease_start, lease_end, is_active } = req.body;
        await query(`
            UPDATE tenants SET name = $1, email = $2, phone = $3, lease_start = $4, lease_end = $5, is_active = $6 WHERE id = $7
        `, [
            name || tenant.name,
            email !== undefined ? email : tenant.email,
            phone !== undefined ? phone : tenant.phone,
            lease_start || tenant.lease_start,
            lease_end || tenant.lease_end,
            is_active !== undefined ? (is_active ? 1 : 0) : tenant.is_active,
            req.params.id
        ]);

        const result = await query('SELECT t.*, p.name as property_name FROM tenants t JOIN properties p ON t.property_id = p.id WHERE t.id = $1', [req.params.id]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update tenant error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete tenant (soft delete)
router.delete('/:id', authenticate, requireRole('landlord'), async (req, res) => {
    try {
        const tenantResult = await query(`
            SELECT t.* FROM tenants t JOIN properties p ON t.property_id = p.id 
            WHERE t.id = $1 AND p.owner_id = $2
        `, [req.params.id, req.user.id]);
        const tenant = tenantResult.rows[0];
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

        await query('UPDATE tenants SET is_active = 0 WHERE id = $1', [req.params.id]);

        await query('INSERT INTO activity_log (user_id, action, details) VALUES ($1, $2, $3)',
            [req.user.id, 'remove_tenant', `Removed tenant ${tenant.name}`]
        );

        res.json({ message: 'Tenant removed' });
    } catch (err) {
        console.error('Delete tenant error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
