const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { checkPermission } = require('../middleware/auth');
const { sendEmail } = require('../config/email');

// Envoyer un email d'activation
router.post('/send-activation-email', checkPermission('create'), async (req, res) => {
    const { userId, email, type } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email non fourni' });
    }
    
    try {
        let table;
        let queryParams = '';
        
        if (type === 'eleve') {
            table = 'eleves';
        } else if (type === 'professeur') {
            table = 'professeurs';
            queryParams = '&type=professeur';
        } else if (type === 'staff') {
            table = 'staff';
            queryParams = '&type=staff';
        } else {
            return res.status(400).json({ error: 'Type utilisateur invalide' });
        }

        db.get(`SELECT activationToken, nom, prenom FROM ${table} WHERE id = ?`, [userId], async (err, user) => {
            if (err || !user) {
                return res.status(404).json({ error: 'Utilisateur non trouvé' });
            }
            
            const activationLink = `http://${req.headers.host}/activation.html?token=${user.activationToken}${queryParams}`;
            const userName = `${user.prenom} ${user.nom}`;
            
            try {
                await sendEmail(email, 'activation', userName, activationLink);
                res.json({ success: true, message: 'Email envoyé avec succès' });
            } catch (emailError) {
                console.error('Erreur envoi email:', emailError);
                res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email. Vérifiez la configuration.' });
            }
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
