const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// List properties for landlord
router.get('/', authenticate, (req, res) => {
    try {
        let properties;
        if (req.user.role === 'landlord') {
            properties = db.prepare(`
        SELECT p.*, 
          (SELECT COUNT(*) FROM tenants t WHERE t.property_id = p.id AND t.is_active = 1) as tenant_count,
          (SELECT COALESCE(SUM(tr.amount), 0) FROM transactions tr WHERE tr.property_id = p.id AND tr.status = 'paid') as total_collected,
          (SELECT COUNT(*) FROM transactions tr WHERE tr.property_id = p.id AND tr.status = 'overdue') as overdue_count
        FROM properties p 
        WHERE p.owner_id = ? AND p.is_active = 1
        ORDER BY p.created_at DESC
      `).all(req.user.id);
        } else {
            // Tenant: get properties they are assigned to
            properties = db.prepare(`
        SELECT p.*, 
          (SELECT COUNT(*) FROM tenants t WHERE t.property_id = p.id AND t.is_active = 1) as tenant_count
        FROM properties p 
        JOIN tenants t ON t.property_id = p.id 
        WHERE t.user_id = ? AND t.is_active = 1 AND p.is_active = 1
        ORDER BY p.created_at DESC
      `).all(req.user.id);
        }
        res.json(properties);
    } catch (err) {
        console.error('List properties error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single property
router.get('/:id', authenticate, (req, res) => {
    try {
        const property = db.prepare('SELECT * FROM properties WHERE id = ? AND is_active = 1').get(req.params.id);
        if (!property) {
            return res.status(404).json({ error: 'Property not found' });
        }
        // Verify access
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
router.post('/', authenticate, requireRole('landlord'), (req, res) => {
    try {
        const { name, address, rent_amount, due_day, property_type } = req.body;

        if (!name || rent_amount === undefined) {
            return res.status(400).json({ error: 'Property name and rent amount are required' });
        }

        const id = uuidv4();
        db.prepare(
            'INSERT INTO properties (id, owner_id, name, address, rent_amount, due_day, property_type) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(id, req.user.id, name, address || '', rent_amount, due_day || 1, property_type || 'apartment');

        db.prepare('INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)').run(
            req.user.id, 'create_property', `Created property: ${name}`
        );

        const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(id);
        res.status(201).json(property);
    } catch (err) {
        console.error('Create property error:', err.message, err.stack);
        res.status(500).json({ error: 'Internal server error', detail: err.message });
    }
});

// Update property
router.put('/:id', authenticate, requireRole('landlord'), (req, res) => {
    try {
        const property = db.prepare('SELECT * FROM properties WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
        if (!property) {
            return res.status(404).json({ error: 'Property not found' });
        }

        const { name, address, rent_amount, due_day, property_type } = req.body;
        db.prepare(
            'UPDATE properties SET name = ?, address = ?, rent_amount = ?, due_day = ?, property_type = ? WHERE id = ?'
        ).run(
            name || property.name,
            address !== undefined ? address : property.address,
            rent_amount !== undefined ? rent_amount : property.rent_amount,
            due_day || property.due_day,
            property_type || property.property_type,
            req.params.id
        );

        const updated = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
        res.json(updated);
    } catch (err) {
        console.error('Update property error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete property (soft delete)
router.delete('/:id', authenticate, requireRole('landlord'), (req, res) => {
    try {
        const property = db.prepare('SELECT * FROM properties WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
        if (!property) {
            return res.status(404).json({ error: 'Property not found' });
        }

        db.prepare('UPDATE properties SET is_active = 0 WHERE id = ?').run(req.params.id);

        db.prepare('INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)').run(
            req.user.id, 'delete_property', `Deleted property: ${property.name}`
        );

        res.json({ message: 'Property deleted' });
    } catch (err) {
        console.error('Delete property error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
