const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { dbGet, dbRun } = require('../utils/helpers');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET /api/maintenance/status — accessible à tous (pour la page de login)
router.get('/status', async (req, res) => {
    try {
        const row = await dbGet(db, 'SELECT * FROM maintenance WHERE id = 1');
        if (!row || !row.active) {
            return res.json({ active: false });
        }
        return res.json({
            active: true,
            dateDebut: row.dateDebut,
            dateFin: row.dateFin || null,
            message: row.message || null
        });
    } catch (err) {
        console.error('Erreur status maintenance:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/maintenance/toggle — admin uniquement
router.post('/toggle', requireAuth, requireAdmin, async (req, res) => {
    const { active, dateFin, message } = req.body;
    try {
        const existing = await dbGet(db, 'SELECT * FROM maintenance WHERE id = 1');
        const now = new Date().toISOString();

        if (existing) {
            await dbRun(db,
                'UPDATE maintenance SET active = ?, dateDebut = ?, dateFin = ?, message = ? WHERE id = 1',
                [
                    active ? 1 : 0,
                    active ? now : existing.dateDebut,
                    dateFin || null,
                    message || null
                ]
            );
        } else {
            await dbRun(db,
                'INSERT INTO maintenance (id, active, dateDebut, dateFin, message) VALUES (1, ?, ?, ?, ?)',
                [active ? 1 : 0, now, dateFin || null, message || null]
            );
        }

        return res.json({
            success: true,
            active: !!active,
            dateDebut: active ? now : existing?.dateDebut,
            dateFin: dateFin || null,
            message: message || null
        });
    } catch (err) {
        console.error('Erreur toggle maintenance:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
