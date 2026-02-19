const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Landlord dashboard
router.get('/landlord', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'landlord') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userId = req.user.id;

    const propertyCount = (await query('SELECT COUNT(*) as count FROM properties WHERE owner_id = $1 AND is_active = 1', [userId])).rows[0].count;
    const tenantCount = (await query(`
            SELECT COUNT(*) as count FROM tenants t 
            JOIN properties p ON t.property_id = p.id 
            WHERE p.owner_id = $1 AND t.is_active = 1
        `, [userId])).rows[0].count;

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;

    const monthlyIncome = (await query(`
            SELECT COALESCE(SUM(tr.amount), 0) as total
            FROM transactions tr JOIN properties p ON tr.property_id = p.id
            WHERE p.owner_id = $1 AND tr.status = 'paid' AND tr.due_date BETWEEN $2 AND $3
        `, [userId, monthStart, monthEnd])).rows[0].total;

    const totalCollected = (await query(`
            SELECT COALESCE(SUM(tr.amount), 0) as total
            FROM transactions tr JOIN properties p ON tr.property_id = p.id
            WHERE p.owner_id = $1 AND tr.status = 'paid'
        `, [userId])).rows[0].total;

    const overdueCount = (await query(`
            SELECT COUNT(*) as count
            FROM transactions tr JOIN properties p ON tr.property_id = p.id
            WHERE p.owner_id = $1 AND tr.status = 'overdue'
        `, [userId])).rows[0].count;

    const pendingCount = (await query(`
            SELECT COUNT(*) as count
            FROM transactions tr JOIN properties p ON tr.property_id = p.id
            WHERE p.owner_id = $1 AND tr.status = 'pending'
        `, [userId])).rows[0].count;

    const recentTransactions = (await query(`
            SELECT tr.*, p.name as property_name, ten.name as tenant_name
            FROM transactions tr
            JOIN properties p ON tr.property_id = p.id
            LEFT JOIN tenants ten ON tr.tenant_id = ten.id
            WHERE p.owner_id = $1
            ORDER BY tr.created_at DESC
            LIMIT 10
        `, [userId])).rows;

    const recentActivity = (await query(`
            SELECT * FROM activity_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10
        `, [userId])).rows;

    // Upcoming dues (next 30 days)
    const today = now.toISOString().split('T')[0];
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const upcomingDues = (await query(`
            SELECT tr.*, p.name as property_name, ten.name as tenant_name
            FROM transactions tr
            JOIN properties p ON tr.property_id = p.id
            LEFT JOIN tenants ten ON tr.tenant_id = ten.id
            WHERE p.owner_id = $1 AND tr.status IN ('pending', 'overdue') AND tr.due_date BETWEEN $2 AND $3
            ORDER BY tr.due_date ASC
            LIMIT 10
        `, [userId, today, thirtyDaysLater])).rows;

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
router.get('/tenant', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'tenant') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userId = req.user.id;

    const activeLeases = (await query(`
            SELECT t.*, p.name as property_name, p.rent_amount, p.due_day, p.address
            FROM tenants t JOIN properties p ON t.property_id = p.id
            WHERE t.user_id = $1 AND t.is_active = 1
        `, [userId])).rows;

    const totalPaid = (await query(`
            SELECT COALESCE(SUM(tr.amount), 0) as total
            FROM transactions tr
            JOIN tenants ten ON tr.tenant_id = ten.id
            WHERE ten.user_id = $1 AND tr.status = 'paid'
        `, [userId])).rows[0].total;

    const pendingAmount = (await query(`
            SELECT COALESCE(SUM(tr.amount), 0) as total
            FROM transactions tr
            JOIN tenants ten ON tr.tenant_id = ten.id
            WHERE ten.user_id = $1 AND tr.status IN ('pending', 'overdue')
        `, [userId])).rows[0].total;

    const recentPayments = (await query(`
            SELECT tr.*, p.name as property_name
            FROM transactions tr
            JOIN properties p ON tr.property_id = p.id
            JOIN tenants ten ON tr.tenant_id = ten.id
            WHERE ten.user_id = $1
            ORDER BY tr.created_at DESC
            LIMIT 10
        `, [userId])).rows;

    const upcomingDues = (await query(`
            SELECT tr.*, p.name as property_name
            FROM transactions tr
            JOIN properties p ON tr.property_id = p.id
            JOIN tenants ten ON tr.tenant_id = ten.id
            WHERE ten.user_id = $1 AND tr.status IN ('pending', 'overdue')
            ORDER BY tr.due_date ASC
            LIMIT 10
        `, [userId])).rows;

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
