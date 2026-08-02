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

    // Occupancy: occupied = properties with active tenants
    const occupiedCount = (await query(`
            SELECT COUNT(DISTINCT p.id) as count FROM properties p
            JOIN tenants t ON t.property_id = p.id
            WHERE p.owner_id = $1 AND p.is_active = 1 AND t.is_active = 1
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

    const pendingAmount = (await query(`
            SELECT COALESCE(SUM(tr.amount), 0) as total
            FROM transactions tr JOIN properties p ON tr.property_id = p.id
            WHERE p.owner_id = $1 AND tr.status IN ('pending', 'overdue')
        `, [userId])).rows[0].total;

    // Monthly collection history (last 6 months)
    const monthlyCollection = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      const mEnd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-31`;
      const monthName = d.toLocaleString('default', { month: 'short' });

      const collected = (await query(`
              SELECT COALESCE(SUM(tr.amount), 0) as total
              FROM transactions tr JOIN properties p ON tr.property_id = p.id
              WHERE p.owner_id = $1 AND tr.status = 'paid' AND tr.due_date BETWEEN $2 AND $3
          `, [userId, mStart, mEnd])).rows[0].total;

      const pending = (await query(`
              SELECT COALESCE(SUM(tr.amount), 0) as total
              FROM transactions tr JOIN properties p ON tr.property_id = p.id
              WHERE p.owner_id = $1 AND tr.status IN ('pending', 'overdue') AND tr.due_date BETWEEN $2 AND $3
          `, [userId, mStart, mEnd])).rows[0].total;

      monthlyCollection.push({ month: monthName, collected: Number(collected), pending: Number(pending) });
    }

    // Tenant status (this month's collection per tenant)
    const tenantStatus = (await query(`
            SELECT ten.name as tenant_name, p.name as property_name, ten.phone,
              COALESCE(SUM(CASE WHEN tr.status = 'paid' AND tr.due_date BETWEEN $2 AND $3 THEN tr.amount ELSE 0 END), 0) as paid_amount,
              COALESCE(SUM(CASE WHEN tr.status IN ('pending', 'overdue') AND tr.due_date BETWEEN $2 AND $3 THEN tr.amount ELSE 0 END), 0) as due_amount
            FROM tenants ten
            JOIN properties p ON ten.property_id = p.id
            LEFT JOIN transactions tr ON tr.tenant_id = ten.id
            WHERE p.owner_id = $1 AND ten.is_active = 1
            GROUP BY ten.id, ten.name, p.name, ten.phone
        `, [userId, monthStart, monthEnd])).rows;

    const recentTransactions = (await query(`
            SELECT tr.*, p.name as property_name, ten.name as tenant_name
            FROM transactions tr
            JOIN properties p ON tr.property_id = p.id
            LEFT JOIN tenants ten ON tr.tenant_id = ten.id
            WHERE p.owner_id = $1
            ORDER BY tr.created_at DESC
            LIMIT 10
        `, [userId])).rows;

    // Build structured Recent Activity from transactions + bills
    // 1. Recent rent transactions (paid)
    const paidTransactions = (await query(`
            SELECT tr.amount, tr.due_date, tr.date_paid, tr.status, tr.created_at,
                   p.name as property_name, ten.name as tenant_name
            FROM transactions tr
            JOIN properties p ON tr.property_id = p.id
            LEFT JOIN tenants ten ON tr.tenant_id = ten.id
            WHERE p.owner_id = $1
            ORDER BY tr.created_at DESC
            LIMIT 10
        `, [userId])).rows;

    // 2. Recent shared bills
    const recentBills = (await query(`
            SELECT sb.bill_name, sb.total_amount, sb.tenant_share, sb.due_date, sb.status, sb.created_at,
                   p.name as property_name, ten.name as tenant_name
            FROM shared_bills sb
            JOIN properties p ON sb.property_id = p.id
            LEFT JOIN tenants ten ON sb.tenant_id = ten.id
            WHERE p.owner_id = $1
            ORDER BY sb.created_at DESC
            LIMIT 10
        `, [userId])).rows;

    // 3. Recent automations
    const recentAutomations = (await query(`
            SELECT ta.amount, ta.start_date, ta.num_months, ta.created_at,
                   p.name as property_name, ten.name as tenant_name
            FROM transaction_automations ta
            JOIN properties p ON ta.property_id = p.id
            LEFT JOIN tenants ten ON ta.tenant_id = ten.id
            WHERE p.owner_id = $1
            ORDER BY ta.created_at DESC
            LIMIT 5
        `, [userId])).rows;

    // Format into standardized activity items
    const recentActivity = [];

    for (const tr of paidTransactions) {
      const tenantName = tr.tenant_name || 'Tenant';
      const amount = Number(tr.amount);
      const payDate = tr.date_paid || tr.due_date;
      const formattedAmt = `₹${amount.toLocaleString('en-IN')}`;

      if (tr.status === 'paid') {
        recentActivity.push({
          description: `Recorded rent transaction ${formattedAmt} for ${tenantName} on ${payDate}`,
          type: 'rent_paid',
          created_at: tr.created_at
        });
      } else if (tr.status === 'pending') {
        recentActivity.push({
          description: `Rent due ${formattedAmt} for ${tenantName} on ${tr.due_date}`,
          type: 'rent_pending',
          created_at: tr.created_at
        });
      } else if (tr.status === 'overdue') {
        recentActivity.push({
          description: `Rent overdue ${formattedAmt} for ${tenantName} since ${tr.due_date}`,
          type: 'rent_overdue',
          created_at: tr.created_at
        });
      }
    }

    for (const bill of recentBills) {
      const tenantName = bill.tenant_name || 'Tenant';
      const billNameRaw = bill.bill_name || 'Bill';
      const billTitle = billNameRaw.toLowerCase().includes('bill') ? billNameRaw : `${billNameRaw} Bill`;
      const totalAmt = Number(bill.total_amount);
      const shareAmt = Number(bill.tenant_share);
      const formattedTotal = `₹${totalAmt.toLocaleString('en-IN')}`;
      const formattedShare = `₹${shareAmt.toLocaleString('en-IN')}`;

      if (bill.status === 'paid') {
        recentActivity.push({
          description: `Recorded ${billTitle} transaction ${formattedTotal} for ${tenantName} on ${bill.due_date}`,
          type: 'bill_paid',
          created_at: bill.created_at
        });
      } else {
        recentActivity.push({
          description: `Uploaded bill "${billNameRaw}" for ${formattedTotal} (split: ${formattedShare} each) for ${tenantName}`,
          type: 'bill_pending',
          created_at: bill.created_at
        });
      }
    }

    for (const auto of recentAutomations) {
      const tenantName = auto.tenant_name || 'Tenant';
      const amount = Number(auto.amount);
      const formattedAmt = `₹${amount.toLocaleString('en-IN')}`;
      recentActivity.push({
        description: `Scheduled recurrence ${formattedAmt} monthly for ${tenantName}`,
        type: 'automation',
        created_at: auto.created_at
      });
    }

    // Sort all by created_at descending, take top 10
    recentActivity.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const topActivity = recentActivity.slice(0, 10);

    // Upcoming dues (next 30 days)
    const today = now.toISOString().split('T')[0];
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const upcomingDues = (await query(`
            SELECT tr.*, p.name as property_name, ten.name as tenant_name, ten.phone as tenant_phone
            FROM transactions tr
            JOIN properties p ON tr.property_id = p.id
            LEFT JOIN tenants ten ON tr.tenant_id = ten.id
            WHERE p.owner_id = $1 AND tr.status IN ('pending', 'overdue') AND tr.due_date BETWEEN $2 AND $3
            ORDER BY tr.due_date ASC
            LIMIT 10
        `, [userId, today, thirtyDaysLater])).rows;

    res.json({
      stats: { propertyCount, tenantCount, monthlyIncome, totalCollected, overdueCount, pendingCount, occupiedCount: Number(occupiedCount), pendingAmount: Number(pendingAmount) },
      monthlyCollection,
      tenantStatus,
      recentTransactions,
      recentActivity: topActivity,
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
