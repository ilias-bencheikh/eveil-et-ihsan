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
            // Récupérer l'élève (sans champs parentNom désormais)
            db.get(`SELECT activationToken, nom, prenom FROM eleves WHERE id = ?`, [userId], async (err, eleve) => {
                if (err) {
                    console.error('DB error fetching eleve:', err);
                    return res.status(500).json({ error: 'Erreur DB' });
                }

                // Si un email est fourni et qu'on a un token d'activation pour l'élève, envoyer directement
                if (email && eleve && eleve.activationToken) {
                    const activationLink = `http://${req.headers.host}/activation.html?token=${eleve.activationToken}`;
                    const userName = `${eleve.prenom} ${eleve.nom}`;
                    try {
                        await sendEmail(email, 'activation', userName, activationLink);
                        return res.json({ success: true, message: 'Email envoyé avec succès' });
                    } catch (emailError) {
                        console.error('Erreur envoi email:', emailError);
                        return res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email. Vérifiez la configuration.' });
                    }
                }

                // Sinon, chercher les parents liés à cet élève
                db.all(`SELECT p.id, p.email, p.nom, p.prenom, p.activationToken, ep.isPrimary FROM eleve_parent ep JOIN parents p ON ep.parentId = p.id WHERE ep.eleveId = ? ORDER BY ep.isPrimary DESC`, [userId], async (err2, parents) => {
                    if (err2) {
                        console.error('DB error fetching parents:', err2);
                        return res.status(500).json({ error: 'Erreur DB' });
                    }

                    if (!parents || parents.length === 0) {
                        return res.status(404).json({ error: 'Aucun parent trouvé et aucun email fourni' });
                    }

                    // Si un email a été fourni mais l'utilisateur n'existe pas en tant qu'eleve activable,
                    // essayer d'envoyer au parent correspondant à cet email (activation parent)
                    if (email) {
                        const matchParent = parents.find(p => p.email === email);
                        if (matchParent) {
                            if (!matchParent.activationToken) {
                                return res.status(400).json({ error: 'Le parent n\'a pas de token d\'activation' });
                            }
                            const activationLink = `http://${req.headers.host}/activation.html?token=${matchParent.activationToken}&type=parent`;
                            const userName = `${matchParent.prenom || ''} ${matchParent.nom || ''}`.trim();
                            try {
                                await sendEmail(email, 'activation', userName || 'Parent', activationLink);
                                return res.json({ success: true, message: 'Email envoyé au parent' });
                            } catch (emailError) {
                                console.error('Erreur envoi email parent:', emailError);
                                return res.status(500).json({ error: 'Erreur envoi email au parent' });
                            }
                        }
                    }

                    // Sinon envoyer aux parents (priorité au parent primaire)
                    const sendResults = [];
                    for (const p of parents) {
                        if (!p.email) continue;
                        if (!p.activationToken) {
                            // si parent sans token, on génère un token? ici on retourne erreur pour éviter modifications DB inattendues
                            sendResults.push({ email: p.email, status: 'no-token' });
                            continue;
                        }
                        const activationLink = `http://${req.headers.host}/activation.html?token=${p.activationToken}&type=parent`;
                        const userName = `${p.prenom || ''} ${p.nom || ''}`.trim() || 'Parent';
                        try {
                            await sendEmail(p.email, 'activation', userName, activationLink);
                            sendResults.push({ email: p.email, status: 'sent' });
                        } catch (e) {
                            console.error('Erreur envoi email parent:', e);
                            sendResults.push({ email: p.email, status: 'error' });
                        }
                    }

                    if (sendResults.length === 0) {
                        return res.status(400).json({ error: 'Aucun email parent valide trouvé' });
                    }

                    return res.json({ success: true, message: 'Emails envoyés aux parents', results: sendResults });
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
