const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const webpush = require('web-push');
require('dotenv').config();

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
        const userId = req.userId || 'anonyme';
        const subString = JSON.stringify(subscription);

        // Vérifier si cet abonnement existe déjà pour cet utilisateur
        db.get(
            `SELECT id FROM push_subscriptions WHERE userId = ? AND subscription LIKE ?`,
            [userId, '%' + subscription.endpoint + '%'],
            (err, row) => {
                if (err) {
                    console.error('Erreur SQLite lecture push_subscriptions:', err.message);
                    return res.status(500).json({ error: 'Erreur base de données' });
                }

                if (row) {
                    // L'abonnement existe déjà, pas besoin de le dupliquer
                    console.log('PUSH ABONNEMENT DEJA EXISTANT:', userId);
                    return res.status(200).json({ message: 'Abonnement déjà enregistré' });
                }

                // Sauvegarder dans SQLite si non existant
                db.run(
                    `INSERT INTO push_subscriptions (userId, subscription) VALUES (?, ?)`,
                    [userId, subString],
                    function(err) {
                        if (err) {
                            console.error('Erreur SQLite push_subscriptions:', err.message);
                            return res.status(500).json({ error: 'Erreur lors de la sauvegarde de l\'abonnement' });
                        }
                        console.log('NOUVEAU PUSH ABONNEMENT RECU:', userId); 
                        res.status(201).json({ message: 'Abonnement réussi' });
                    }
                );
            }
        );
    } catch (error) {
        console.error('Erreur /subscribe:', error);
        res.status(500).json({ error: 'Erreur interne' });
    }
});

// Supprimer un abonnement (quand on se déconnecte)
router.post('/unsubscribe', (req, res) => {
    const userId = req.userId || 'anonyme';
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