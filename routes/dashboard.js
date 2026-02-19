const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Landlord dashboard
router.get('/landlord', authenticate, (req, res) => {
    try {
        if (req.user.role !== 'landlord') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const userId = req.user.id;

        const propertyCount = db.prepare('SELECT COUNT(*) as count FROM properties WHERE owner_id = ? AND is_active = 1').get(userId).count;
        const tenantCount = db.prepare(`
      SELECT COUNT(*) as count FROM tenants t 
      JOIN properties p ON t.property_id = p.id 
      WHERE p.owner_id = ? AND t.is_active = 1
    `).get(userId).count;

        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;

        const monthlyIncome = db.prepare(`
      SELECT COALESCE(SUM(tr.amount), 0) as total
      FROM transactions tr JOIN properties p ON tr.property_id = p.id
      WHERE p.owner_id = ? AND tr.status = 'paid' AND tr.due_date BETWEEN ? AND ?
    `).get(userId, monthStart, monthEnd).total;

        const totalCollected = db.prepare(`
      SELECT COALESCE(SUM(tr.amount), 0) as total
      FROM transactions tr JOIN properties p ON tr.property_id = p.id
      WHERE p.owner_id = ? AND tr.status = 'paid'
    `).get(userId).total;

        const overdueCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM transactions tr JOIN properties p ON tr.property_id = p.id
      WHERE p.owner_id = ? AND tr.status = 'overdue'
    `).get(userId).count;

        const pendingCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM transactions tr JOIN properties p ON tr.property_id = p.id
      WHERE p.owner_id = ? AND tr.status = 'pending'
    `).get(userId).count;

        const recentTransactions = db.prepare(`
      SELECT tr.*, p.name as property_name, ten.name as tenant_name
      FROM transactions tr
      JOIN properties p ON tr.property_id = p.id
      LEFT JOIN tenants ten ON tr.tenant_id = ten.id
      WHERE p.owner_id = ?
      ORDER BY tr.created_at DESC
      LIMIT 10
    `).all(userId);

        const recentActivity = db.prepare(`
      SELECT * FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 10
    `).all(userId);

        // Upcoming dues (next 30 days)
        const today = now.toISOString().split('T')[0];
        const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const upcomingDues = db.prepare(`
      SELECT tr.*, p.name as property_name, ten.name as tenant_name
      FROM transactions tr
      JOIN properties p ON tr.property_id = p.id
      LEFT JOIN tenants ten ON tr.tenant_id = ten.id
      WHERE p.owner_id = ? AND tr.status IN ('pending', 'overdue') AND tr.due_date BETWEEN ? AND ?
      ORDER BY tr.due_date ASC
      LIMIT 10
    `).all(userId, today, thirtyDaysLater);

        res.json({
            stats: { propertyCount, tenantCount, monthlyIncome, totalCollected, overdueCount, pendingCount },
            recentTransactions,
            recentActivity,
            upcomingDues
        });
    } catch (err) {
        console.error('Landlord dashboard error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Tenant dashboard
router.get('/tenant', authenticate, (req, res) => {
    try {
        if (req.user.role !== 'tenant') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const userId = req.user.id;

        const activeLeases = db.prepare(`
      SELECT t.*, p.name as property_name, p.rent_amount, p.due_day, p.address
      FROM tenants t JOIN properties p ON t.property_id = p.id
      WHERE t.user_id = ? AND t.is_active = 1
    `).all(userId);

        const totalPaid = db.prepare(`
      SELECT COALESCE(SUM(tr.amount), 0) as total
      FROM transactions tr
      JOIN tenants ten ON tr.tenant_id = ten.id
      WHERE ten.user_id = ? AND tr.status = 'paid'
    `).get(userId).total;

        const pendingAmount = db.prepare(`
      SELECT COALESCE(SUM(tr.amount), 0) as total
      FROM transactions tr
      JOIN tenants ten ON tr.tenant_id = ten.id
      WHERE ten.user_id = ? AND tr.status IN ('pending', 'overdue')
    `).get(userId).total;

        const recentPayments = db.prepare(`
      SELECT tr.*, p.name as property_name
      FROM transactions tr
      JOIN properties p ON tr.property_id = p.id
      JOIN tenants ten ON tr.tenant_id = ten.id
      WHERE ten.user_id = ?
      ORDER BY tr.created_at DESC
      LIMIT 10
    `).all(userId);

        const upcomingDues = db.prepare(`
      SELECT tr.*, p.name as property_name
      FROM transactions tr
      JOIN properties p ON tr.property_id = p.id
      JOIN tenants ten ON tr.tenant_id = ten.id
      WHERE ten.user_id = ? AND tr.status IN ('pending', 'overdue')
      ORDER BY tr.due_date ASC
      LIMIT 10
    `).all(userId);

        res.json({
            stats: { totalPaid, pendingAmount, activeLeaseCount: activeLeases.length },
            activeLeases,
            recentPayments,
            upcomingDues
        });
    } catch (err) {
        console.error('Tenant dashboard error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
