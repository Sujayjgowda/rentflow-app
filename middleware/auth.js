const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'rent-app-secret-key-change-in-production';

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function requireRole(role) {
    return (req, res, next) => {
        if (req.user.role !== role) {
            return res.status(403).json({ error: `Access restricted to ${role}s only` });
        }
        next();
    };
}

module.exports = { authenticate, requireRole, JWT_SECRET };
