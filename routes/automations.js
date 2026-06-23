const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Helper to execute automation rules
async function executeAutomationForRule(rule) {
    try {
        const { id: ta_id, property_id, tenant_id, amount, start_date, num_months, due_day, notes, created_by } = rule;
        
        const start = new Date(start_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let createdCount = 0;
        let isExpired = true;

        for (let i = 0; i < num_months; i++) {
            const targetDate = new Date(start.getFullYear(), start.getMonth() + i, 1);
            
            // Get the maximum days of this target month to clamp due_day (e.g. 31st becomes 30th for June)
            const maxDays = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
            targetDate.setDate(Math.min(due_day, maxDays));
            targetDate.setHours(0, 0, 0, 0);

            // Construct string format for DB due_date
            const yearStr = targetDate.getFullYear();
            const monthStr = String(targetDate.getMonth() + 1).padStart(2, '0');
            const dayStr = String(targetDate.getDate()).padStart(2, '0');
            const targetDueDateStr = `${yearStr}-${monthStr}-${dayStr}`;

            // Check if this calculated month's due date is <= today
            if (targetDate <= today) {
                const startStr = start.toISOString().split('T')[0];
                if (targetDueDateStr >= startStr) {
                    // Check if transaction already exists
                    const existing = await query(`
                        SELECT id FROM transactions 
                        WHERE property_id = $1 AND tenant_id = $2 AND due_date = $3
                    `, [property_id, tenant_id, targetDueDateStr]);

                    if (existing.rows.length === 0) {
                        const txId = uuidv4();
                        await query(`
                            INSERT INTO transactions (id, property_id, tenant_id, amount, due_date, status, notes, created_by)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        `, [txId, property_id, tenant_id, parseFloat(amount), targetDueDateStr, 'pending', notes || `Automated payment for ${targetDueDateStr}`, created_by]);
                        
                        createdCount++;
                    }
                }
            } else {
                // If any of the target dates are in the future, the rule is not expired
                isExpired = false;
            }
        }

        // If the automation loop completed and we didn't find any future due dates, mark as expired
        if (isExpired) {
            await query('UPDATE transaction_automations SET is_active = 0 WHERE id = $1', [ta_id]);
        }

        return { createdCount, isExpired };
    } catch (err) {
        console.error(`executeAutomationForRule ${rule.id} error:`, err);
        throw err;
    }
}

// Get all automations for landlord's properties
router.get('/', authenticate, requireRole('landlord'), async (req, res) => {
    try {
        const result = await query(`
            SELECT ta.*, p.name as property_name, ten.name as tenant_name
            FROM transaction_automations ta
            JOIN properties p ON ta.property_id = p.id
            JOIN tenants ten ON ta.tenant_id = ten.id
            WHERE p.owner_id = $1
            ORDER BY ta.created_at DESC
        `, [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error('List automations error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create automation rule (landlord only)
router.post('/', authenticate, requireRole('landlord'), async (req, res) => {
    try {
        const { property_id, tenant_id, amount, start_date, num_months, due_day, notes } = req.body;

        if (!property_id || !tenant_id || !amount || !start_date || !num_months || !due_day) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Verify property ownership
        const prop = await query('SELECT id, name FROM properties WHERE id = $1 AND owner_id = $2', [property_id, req.user.id]);
        if (prop.rows.length === 0) return res.status(404).json({ error: 'Property not found' });

        // Verify tenant belongs to property
        const tenant = await query('SELECT id, name FROM tenants WHERE id = $1 AND property_id = $2', [tenant_id, property_id]);
        if (tenant.rows.length === 0) return res.status(404).json({ error: 'Tenant not found in this property' });

        const id = uuidv4();
        await query(`
            INSERT INTO transaction_automations (id, property_id, tenant_id, amount, start_date, num_months, due_day, notes, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [id, property_id, tenant_id, parseFloat(amount), start_date, parseInt(num_months), parseInt(due_day), notes || null, req.user.id]);

        await query('INSERT INTO activity_log (user_id, action, details) VALUES ($1, $2, $3)',
            [req.user.id, 'create_automation', `Scheduled recurrence ₹${amount} monthly for ${tenant.rows[0].name}`]
        );

        // Fetch inserted rule and execute immediately to generate current transactions
        const inserted = await query('SELECT * FROM transaction_automations WHERE id = $1', [id]);
        const rule = inserted.rows[0];
        
        const execResult = await executeAutomationForRule(rule);

        res.status(201).json({ automation: rule, generated: execResult.createdCount });
    } catch (err) {
        console.error('Create automation error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update automation rule status (pause/resume)
router.put('/:id', authenticate, requireRole('landlord'), async (req, res) => {
    try {
        // Verify ownership
        const autCheck = await query(`
            SELECT ta.* FROM transaction_automations ta
            JOIN properties p ON ta.property_id = p.id
            WHERE ta.id = $1 AND p.owner_id = $2
        `, [req.params.id, req.user.id]);

        if (autCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Automation rule not found' });
        }

        const { is_active } = req.body;
        if (is_active === undefined) {
            return res.status(400).json({ error: 'is_active field is required' });
        }

        await query('UPDATE transaction_automations SET is_active = $1 WHERE id = $2', [parseInt(is_active), req.params.id]);

        // If resuming automation, execute it immediately
        if (parseInt(is_active) === 1) {
            await executeAutomationForRule(autCheck.rows[0]);
        }

        res.json({ message: `Automation updated to ${parseInt(is_active) === 1 ? 'Active' : 'Paused'}` });
    } catch (err) {
        console.error('Update automation error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete automation rule
router.delete('/:id', authenticate, requireRole('landlord'), async (req, res) => {
    try {
        const autCheck = await query(`
            SELECT ta.id FROM transaction_automations ta
            JOIN properties p ON ta.property_id = p.id
            WHERE ta.id = $1 AND p.owner_id = $2
        `, [req.params.id, req.user.id]);

        if (autCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Automation rule not found' });
        }

        await query('DELETE FROM transaction_automations WHERE id = $1', [req.params.id]);
        res.json({ message: 'Automation rule deleted' });
    } catch (err) {
        console.error('Delete automation error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = {
    router,
    executeAutomationForRule
};
