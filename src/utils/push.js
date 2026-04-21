const webpush = require('web-push');
const { db } = require('../config/database');

const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

if (publicVapidKey && privateVapidKey) {
    webpush.setVapidDetails(
        'mailto:' + (process.env.EMAIL_USER || 'contact@example.com'),
        publicVapidKey,
        privateVapidKey
    );
}

/**
 * Envoie une notification Push à un utilisateur spécifique
 * @param {string} userId - L'ID de l'utilisateur destinataire
 * @param {object} payload - Les données de la notification { title, body, url }
 */
const sendPushNotification = (userId, payload) => {
    // Récupérer toutes les souscriptions de l'utilisateur (il peut être connecté sur son téléphone + son PC)
    db.all(
        `SELECT id, subscription FROM push_subscriptions WHERE userId = ?`,
        [userId],
        (err, rows) => {
            if (err) {
                console.error('Erreur lors de la récupération des abonnements Push pour', userId, err);
                return;
            }

            if (!rows || rows.length === 0) {
                return; // L'utilisateur n'a pas activé les notifications PWA
            }

            const stringPayload = JSON.stringify(payload);

            rows.forEach(row => {
                try {
                    const subscription = JSON.parse(row.subscription);
                    webpush.sendNotification(subscription, stringPayload)
                        .catch(error => {
                            console.error('Échec de l\'envoi Push:', error.message);
                            // Si l'abonnement a expiré ou que l'utilisateur a révoqué l'accès, 
                            // l'API renvoie une erreur 410 (Gone) ou 404. On supprime l'abonnement.
                            if (error.statusCode === 404 || error.statusCode === 410) {
                                console.log('Abonnement expiré, suppression dans la base de données (ID:', row.id, ')');
                                db.run(`DELETE FROM push_subscriptions WHERE id = ?`, [row.id]);
                            }
                        });
                } catch (e) {
                    console.error('Erreur de parsing de l\'abonnement:', e);
                }
            });
        }
    );
};

module.exports = { sendPushNotification };