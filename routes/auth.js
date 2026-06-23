const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role, phone } = req.body;

        if (!name || !phone || !password || !role) {
            return res.status(400).json({ error: 'Name, phone number, password, and role are required' });
        }

        if (!['landlord', 'tenant'].includes(role)) {
            return res.status(400).json({ error: 'Role must be landlord or tenant' });
        }

        const trimmedPhone = phone.trim();
        const existingPhone = await query('SELECT id FROM users WHERE phone = $1', [trimmedPhone]);
        if (existingPhone.rows.length > 0) {
            return res.status(409).json({ error: 'Phone number already registered' });
        }

        if (email && email.trim() !== '') {
            const existingEmail = await query('SELECT id FROM users WHERE email = $1', [email.trim()]);
            if (existingEmail.rows.length > 0) {
                return res.status(409).json({ error: 'Email already registered' });
            }
        }

        const id = uuidv4();
        const password_hash = bcrypt.hashSync(password, 10);
        const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];
        const avatar_color = colors[Math.floor(Math.random() * colors.length)];

        await query(
            'INSERT INTO users (id, name, email, password_hash, role, phone, avatar_color) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [id, name, email ? email.trim() : null, password_hash, role, trimmedPhone, avatar_color]
        );

        // If registering as tenant, auto-link any existing tenant records with this phone or email
        if (role === 'tenant') {
            await query(`
                UPDATE tenants 
                SET user_id = $1 
                WHERE (phone = $2 OR (email = $3 AND email IS NOT NULL AND email <> ''))
                  AND user_id IS NULL
            `, [id, trimmedPhone, email ? email.trim() : null]);
        }

        await query('INSERT INTO activity_log (user_id, action, details) VALUES ($1, $2, $3)',
            [id, 'register', `${name} registered as ${role}`]
        );

        const token = jwt.sign({ id, name, phone: trimmedPhone, role }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            token,
            user: { id, name, email: email ? email.trim() : null, role, phone: trimmedPhone, avatar_color }
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Phone number (or email) and password are required' });
        }

        const trimmedIdentifier = email.trim();
        const result = await query('SELECT * FROM users WHERE phone = $1 OR email = $2', [trimmedIdentifier, trimmedIdentifier]);
        const user = result.rows[0];
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const valid = bcrypt.compareSync(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, name: user.name, phone: user.phone, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                avatar_color: user.avatar_color
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
    try {
        const result = await query('SELECT id, name, email, role, phone, avatar_color, created_at FROM users WHERE id = $1', [req.user.id]);
        const user = result.rows[0];
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update profile
router.put('/me', authenticate, async (req, res) => {
    try {
        const { name, phone } = req.body;

        if (phone && phone.trim() !== '') {
            const existingPhone = await query('SELECT id FROM users WHERE phone = $1 AND id <> $2', [phone.trim(), req.user.id]);
            if (existingPhone.rows.length > 0) {
                return res.status(409).json({ error: 'Phone number already registered by another user' });
            }
        }

        const updates = [];
        const values = [];
        let paramIdx = 1;

        if (name) { updates.push(`name = $${paramIdx++}`); values.push(name); }
        if (phone !== undefined) { updates.push(`phone = $${paramIdx++}`); values.push(phone ? phone.trim() : null); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(req.user.id);
        await query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIdx}`, values);

        const result = await query('SELECT id, name, email, role, phone, avatar_color, created_at FROM users WHERE id = $1', [req.user.id]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
