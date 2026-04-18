const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { dbGet, dbRun } = require('../utils/helpers');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { exec } = require('child_process');
const { spawn } = require('child_process');

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

function restartServer() {
    console.log("Redémarrage en cours...");
    process.exit(99);
}

// POST /api/maintenance/terminal — admin uniquement
router.post('/terminal', requireAuth, requireAdmin, async (req, res) => {
    const { command } = req.body;
    if (!command) {
        return res.status(400).json({ error: 'Commande vide' });
    }

    const cmdStr = command.trim();
    const allowedExact = ['git pull', 'npm install', 'restart'];

    // On autorise un subset strict
    if (!allowedExact.includes(cmdStr) && !cmdStr.startsWith('pm2 restart')) {
        return res.status(403).json({ error: 'Commande non autorisée. Seules git pull, npm install et restart sont autorisées.' });
    }

    if (cmdStr === 'restart' || cmdStr.startsWith('pm2 restart')) {
        res.json({ output: 'Redémarrage du serveur initié...' });
        // Laisse 1 sec pour répondre, puis quitte (nodemon ou PM2 le relancera)
        console.log('Redémarrage demandé via le terminal web.');
        restartServer();
    }
    else if (cmdStr == "update") {
      res.json({ output: 'Mise à jour du serveur initiée...' });
      console.log('Mise à jour demandée via le terminal web.');
      exec('git pull && npm install', { cwd: process.cwd() }, (error, stdout, stderr) => {
          let output = stdout || '';
          if (stderr) output += '\\n' + stderr;
          if (error) output = `Erreur de mise à jour:\\n${error.message}\\n${output}`;
          console.log(output);
          // Après la mise à jour, on redémarre
          restartServer();
      });
      return; // on ne veut pas exécuter la suite du code
    }

    exec(cmdStr, { cwd: process.cwd() }, (error, stdout, stderr) => {
        let output = stdout || '';
        if (stderr) output += '\\n' + stderr;
        if (error) output = `Erreur de commande:\\n${error.message}\\n${output}`;
        return res.json({ output: output.trim() });
    });
});

module.exports = router;
