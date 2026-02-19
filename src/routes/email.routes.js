const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { checkPermission } = require('../middleware/auth');
const { sendEmail } = require('../config/email');

// Envoyer un email d'activation
router.post('/send-activation-email', checkPermission('create'), async (req, res) => {
    const { userId, email, type } = req.body;
    
    console.log('Envoi email activation - Params:', { userId, email, type });
    
    // email peut être null si non renseigné
    
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

        let selectFields;
        if (type === 'eleve') {
            // Récupérer l'élève + tous les parents liés en parallèle
            db.get(`SELECT id, activationToken, nom, prenom, email FROM eleves WHERE id = ?`, [userId], async (err, eleve) => {
                if (err) {
                    console.error('DB error fetching eleve:', err);
                    return res.status(500).json({ error: 'Erreur DB' });
                }

                db.all(`SELECT p.id, p.email, p.nom, p.prenom, p.activationToken, p.activated, ep.isPrimary
                        FROM eleve_parent ep JOIN parents p ON ep.parentId = p.id
                        WHERE ep.eleveId = ? ORDER BY ep.isPrimary DESC`, [userId], async (err2, parents) => {
                    if (err2) {
                        console.error('DB error fetching parents:', err2);
                        return res.status(500).json({ error: 'Erreur DB' });
                    }

                    const host = req.headers.host;
                    const sendResults = [];

                    // ---- Cas : email spécifique fourni (ex: renvoi manuel ciblé) ----
                    if (email) {
                        // Vérifier si cet email correspond à l'élève
                        if (eleve && eleve.email === email && eleve.activationToken) {
                            const activationLink = `http://${host}/activation.html?token=${eleve.activationToken}`;
                            try {
                                await sendEmail(eleve.email, 'activation', `${eleve.prenom} ${eleve.nom}`, activationLink);
                                sendResults.push({ email: eleve.email, type: 'eleve', status: 'sent' });
                            } catch (e) {
                                sendResults.push({ email: eleve.email, type: 'eleve', status: 'error' });
                            }
                        }
                        // Vérifier si cet email correspond à un parent non activé
                        const matchParent = (parents || []).find(p => p.email === email);
                        if (matchParent && !matchParent.activated && matchParent.activationToken) {
                            const activationLink = `http://${host}/activation.html?token=${matchParent.activationToken}&type=parent`;
                            try {
                                await sendEmail(matchParent.email, 'activation', `${matchParent.prenom} ${matchParent.nom}`.trim() || 'Parent', activationLink);
                                sendResults.push({ email: matchParent.email, type: 'parent', status: 'sent' });
                            } catch (e) {
                                sendResults.push({ email: matchParent.email, type: 'parent', status: 'error' });
                            }
                        }
                        if (sendResults.length === 0) {
                            return res.status(404).json({ error: 'Aucun compte en attente d\'activation pour cet email' });
                        }
                        const sentCount = sendResults.filter(r => r.status === 'sent').length;
                        return res.json({ success: true, message: `${sentCount} email(s) envoyé(s)`, results: sendResults });
                    }

                    // ---- Cas : aucun email fourni → envoyer à TOUS (élève + parents non activés) ----

                    // 1. Élève s'il a un email et un token
                    if (eleve && eleve.email && eleve.activationToken) {
                        const activationLink = `http://${host}/activation.html?token=${eleve.activationToken}`;
                        try {
                            await sendEmail(eleve.email, 'activation', `${eleve.prenom} ${eleve.nom}`, activationLink);
                            sendResults.push({ email: eleve.email, type: 'eleve', status: 'sent' });
                        } catch (e) {
                            console.error('Erreur envoi email élève:', e);
                            sendResults.push({ email: eleve.email, type: 'eleve', status: 'error' });
                        }
                    }

                    // 2. Tous les parents non encore activés
                    for (const p of (parents || [])) {
                        if (!p.email || !p.activationToken) {
                            if (p.email) sendResults.push({ email: p.email, type: 'parent', status: 'no-token' });
                            continue;
                        }
                        if (p.activated) continue; // déjà activé
                        const activationLink = `http://${host}/activation.html?token=${p.activationToken}&type=parent`;
                        try {
                            await sendEmail(p.email, 'activation', `${p.prenom} ${p.nom}`.trim() || 'Parent', activationLink);
                            sendResults.push({ email: p.email, type: 'parent', status: 'sent' });
                        } catch (e) {
                            console.error(`Erreur envoi email parent ${p.email}:`, e);
                            sendResults.push({ email: p.email, type: 'parent', status: 'error' });
                        }
                    }

                    if (sendResults.length === 0) {
                        return res.status(404).json({ error: 'Aucun compte en attente d\'activation trouvé (élève sans email ni parents)' });
                    }

                    const sentCount = sendResults.filter(r => r.status === 'sent').length;
                    return res.json({
                        success: true,
                        message: `${sentCount} email(s) d'activation envoyé(s)`,
                        results: sendResults
                    });
                });
            });
        } else {
            // Professeur ou staff
            db.get(`SELECT activationToken, nom, prenom FROM ${table} WHERE id = ?`, [userId], async (err, user) => {
                console.log('Requête DB - Table:', table, 'UserId:', userId, 'User trouvé:', !!user, 'Erreur:', err);
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
        }
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
