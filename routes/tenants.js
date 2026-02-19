const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// List tenants (optionally filtered by property)
router.get('/', authenticate, (req, res) => {
    try {
        const { property_id } = req.query;
        let tenants;

        if (req.user.role === 'landlord') {
            if (property_id) {
                // Verify ownership
                const prop = db.prepare('SELECT id FROM properties WHERE id = ? AND owner_id = ?').get(property_id, req.user.id);
                if (!prop) return res.status(404).json({ error: 'Property not found' });

                tenants = db.prepare(`
          SELECT t.*, p.name as property_name 
          FROM tenants t JOIN properties p ON t.property_id = p.id 
          WHERE t.property_id = ? AND t.is_active = 1 
          ORDER BY t.created_at DESC
        `).all(property_id);
            } else {
                tenants = db.prepare(`
          SELECT t.*, p.name as property_name 
          FROM tenants t 
          JOIN properties p ON t.property_id = p.id 
          WHERE p.owner_id = ? AND t.is_active = 1 
          ORDER BY t.created_at DESC
        `).all(req.user.id);
            }
        } else {
            tenants = db.prepare(`
        SELECT t.*, p.name as property_name 
        FROM tenants t 
        JOIN properties p ON t.property_id = p.id 
        WHERE t.user_id = ? AND t.is_active = 1
      `).all(req.user.id);
        }

        res.json(tenants);
    } catch (err) {
        console.error('List tenants error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add tenant to property
router.post('/', authenticate, requireRole('landlord'), (req, res) => {
    try {
        const { property_id, name, email, phone, lease_start, lease_end } = req.body;

        if (!property_id || !name) {
            return res.status(400).json({ error: 'Property ID and tenant name are required' });
        }

        const prop = db.prepare('SELECT id FROM properties WHERE id = ? AND owner_id = ?').get(property_id, req.user.id);
        if (!prop) return res.status(404).json({ error: 'Property not found' });

        // Check if tenant user exists by email
        let user_id = null;
        if (email) {
            const tenantUser = db.prepare('SELECT id FROM users WHERE email = ? AND role = ?').get(email, 'tenant');
            if (tenantUser) user_id = tenantUser.id;
        }

        const id = uuidv4();
        db.prepare(
            'INSERT INTO tenants (id, property_id, user_id, name, email, phone, lease_start, lease_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(id, property_id, user_id, name, email || null, phone || null, lease_start || null, lease_end || null);

        db.prepare('INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)').run(
            req.user.id, 'add_tenant', `Added tenant ${name} to property`
        );

        const tenant = db.prepare('SELECT t.*, p.name as property_name FROM tenants t JOIN properties p ON t.property_id = p.id WHERE t.id = ?').get(id);
        res.status(201).json(tenant);
    } catch (err) {
        console.error('Add tenant error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update tenant
router.put('/:id', authenticate, requireRole('landlord'), (req, res) => {
    try {
        const tenant = db.prepare(`
      SELECT t.* FROM tenants t JOIN properties p ON t.property_id = p.id 
      WHERE t.id = ? AND p.owner_id = ?
    `).get(req.params.id, req.user.id);
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

        const { name, email, phone, lease_start, lease_end, is_active } = req.body;
        db.prepare(`
      UPDATE tenants SET name = ?, email = ?, phone = ?, lease_start = ?, lease_end = ?, is_active = ? WHERE id = ?
    `).run(
            name || tenant.name,
            email !== undefined ? email : tenant.email,
            phone !== undefined ? phone : tenant.phone,
            lease_start || tenant.lease_start,
            lease_end || tenant.lease_end,
            is_active !== undefined ? (is_active ? 1 : 0) : tenant.is_active,
            req.params.id
        );

        const updated = db.prepare('SELECT t.*, p.name as property_name FROM tenants t JOIN properties p ON t.property_id = p.id WHERE t.id = ?').get(req.params.id);
        res.json(updated);
    } catch (err) {
        console.error('Update tenant error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete tenant (soft delete)
router.delete('/:id', authenticate, requireRole('landlord'), (req, res) => {
    try {
        const tenant = db.prepare(`
      SELECT t.* FROM tenants t JOIN properties p ON t.property_id = p.id 
      WHERE t.id = ? AND p.owner_id = ?
    `).get(req.params.id, req.user.id);
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

        db.prepare('UPDATE tenants SET is_active = 0 WHERE id = ?').run(req.params.id);

        db.prepare('INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)').run(
            req.user.id, 'remove_tenant', `Removed tenant ${tenant.name}`
        );

        res.json({ message: 'Tenant removed' });
    } catch (err) {
        console.error('Delete tenant error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
