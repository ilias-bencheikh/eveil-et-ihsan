const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const webpush = require('web-push');

// Configurer web-push avec nos clés VAPID
const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

if (publicVapidKey && privateVapidKey) {
    webpush.setVapidDetails(
        'mailto:' + (process.env.EMAIL_USER || 'contact@example.com'),
        publicVapidKey,
        privateVapidKey
    );
}

// Récupérer la clé publique (pour le front-end)
router.get('/vapid-public-key', (req, res) => {
    res.json({ publicKey: publicVapidKey });
});

// S'abonner aux notifications
router.post('/subscribe', (req, res) => {
    try {
        const subscription = req.body;
        // On récupère l'ID de l'utilisateur depuis son token/session (ajouté par le middleware requireAuth)
        const userId = req.user ? req.user.id : 'anonyme';

        // Sauvegarder dans SQLite
        db.run(
            `INSERT INTO push_subscriptions (userId, subscription) VALUES (?, ?)`,
            [userId, JSON.stringify(subscription)],
            function(err) {
                if (err) {
                    console.error('Erreur SQLite push_subscriptions:', err.message);
                    return res.status(500).json({ error: 'Erreur lors de la sauvegarde de l\'abonnement' });
                }
                res.status(201).json({ message: 'Abonnement réussi' });
            }
        );
    } catch (error) {
        console.error('Erreur /subscribe:', error);
        res.status(500).json({ error: 'Erreur interne' });
    }
});

// Supprimer un abonnement (quand on se déconnecte)
router.post('/unsubscribe', (req, res) => {
    const userId = req.user ? req.user.id : 'anonyme';
    db.run(
        `DELETE FROM push_subscriptions WHERE userId = ?`,
        [userId],
        (err) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur lors de la désinscription' });
            }
            res.status(200).json({ message: 'Désinscription réussie' });
        }
    );
});

module.exports = router;