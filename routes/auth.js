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

        if (!name || !email || !password || !role) {
            return res.status(400).json({ error: 'Name, email, password, and role are required' });
        }

        if (!['landlord', 'tenant'].includes(role)) {
            return res.status(400).json({ error: 'Role must be landlord or tenant' });
        }

        const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const id = uuidv4();
        const password_hash = bcrypt.hashSync(password, 10);
        const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];
        const avatar_color = colors[Math.floor(Math.random() * colors.length)];

        await query(
            'INSERT INTO users (id, name, email, password_hash, role, phone, avatar_color) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [id, name, email, password_hash, role, phone || null, avatar_color]
        );

        await query('INSERT INTO activity_log (user_id, action, details) VALUES ($1, $2, $3)',
            [id, 'register', `${name} registered as ${role}`]
        );

        const token = jwt.sign({ id, name, email, role }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            token,
            user: { id, name, email, role, phone: phone || null, avatar_color }
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
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const result = await query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const valid = bcrypt.compareSync(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { id: user.id, name: user.name, email: user.email, role: user.role },
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
        const updates = [];
        const values = [];
        let paramIdx = 1;

        if (name) { updates.push(`name = $${paramIdx++}`); values.push(name); }
        if (phone !== undefined) { updates.push(`phone = $${paramIdx++}`); values.push(phone); }

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
