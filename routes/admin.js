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

// Edit user details (admin only)
router.put('/users/:id', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, phone } = req.body;

        if (!name || !email || !role) {
            return res.status(400).json({ error: 'Name, email, and role are required' });
        }

        if (!['landlord', 'tenant', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role specified' });
        }

        const userCheck = await query('SELECT id, role, email FROM users WHERE id = $1', [id]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const oldUser = userCheck.rows[0];

        // If email changed, check uniqueness
        if (email !== oldUser.email) {
            const emailCheck = await query('SELECT id FROM users WHERE email = $1 AND id <> $2', [email, id]);
            if (emailCheck.rows.length > 0) {
                return res.status(409).json({ error: 'Email already in use by another user' });
            }
        }

        await query(
            'UPDATE users SET name = $1, email = $2, role = $3, phone = $4 WHERE id = $5',
            [name, email, role, phone || null, id]
        );

        // If role changed to tenant, auto-link existing tenant records
        if (role === 'tenant' && oldUser.role !== 'tenant') {
            await query('UPDATE tenants SET user_id = $1 WHERE email = $2 AND user_id IS NULL', [id, email]);
        }

        await query(
            'INSERT INTO activity_log (user_id, action, details) VALUES ($1, $2, $3)',
            [req.user.id, 'admin_edit_user', `Admin updated user details for: ${name} (${email}) - Role: ${role}`]
        );

        res.json({ message: 'User updated successfully' });
    } catch (err) {
        console.error('Edit user error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete user (admin only)
router.delete('/users/:id', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;

        if (req.user.id === id) {
            return res.status(400).json({ error: 'You cannot delete your own admin account' });
        }

        const userCheck = await query('SELECT id, name, email FROM users WHERE id = $1', [id]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const targetUser = userCheck.rows[0];

        await query('DELETE FROM users WHERE id = $1', [id]);

        await query(
            'INSERT INTO activity_log (user_id, action, details) VALUES ($1, $2, $3)',
            [req.user.id, 'admin_delete_user', `Admin deleted user: ${targetUser.name} (${targetUser.email})`]
        );

        res.json({ message: `Successfully deleted user ${targetUser.name}` });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
