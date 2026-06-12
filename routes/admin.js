const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// List all registered users (admin only)
router.get('/users', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const result = await query(`
            SELECT id, name, email, role, phone, avatar_color, created_at 
            FROM users 
            ORDER BY role ASC, name ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('List users error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reset password for a specific user (admin only)
router.post('/users/:id/reset-password', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.trim().length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        // Verify user exists and is not resetting their own password if they want, or they can reset any password (admin can reset admin too)
        const userCheck = await query('SELECT id, name, email FROM users WHERE id = $1', [id]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const targetUser = userCheck.rows[0];

        const password_hash = bcrypt.hashSync(newPassword, 10);
        await query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, id]);

        // Log action in activity_log
        await query(
            'INSERT INTO activity_log (user_id, action, details) VALUES ($1, $2, $3)',
            [req.user.id, 'admin_reset_password', `Admin reset password for user: ${targetUser.name} (${targetUser.email})`]
        );

        res.json({ message: `Password successfully reset for ${targetUser.name}` });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
