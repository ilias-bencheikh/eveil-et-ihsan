/**
 * Server principal - Gestion École Eveil et Ihsan
 * Architecture modulaire et professionnelle
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Configuration
const { SERVER_CONFIG } = require('./src/config/constants');
const { initDatabase, closeDatabase } = require('./src/config/database');
const { getLocalIpAddress } = require('./src/utils/helpers');

// Fonction de nettoyage automatique des actualités expirées
function cleanupExpiredNews() {
    const { db } = require('./src/config/database');
    const currentDate = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
    
    db.run('DELETE FROM actualites WHERE dateFin IS NOT NULL AND dateFin < ?', [currentDate], function(err) {
        if (err) {
            console.error('❌ Erreur lors du nettoyage des actualités expirées:', err);
        } else if (this.changes > 0) {
            console.log(`🗑️ ${this.changes} actualité(s) expirée(s) supprimée(s) automatiquement`);
        }
    });
}

// Routes
const {
    authRoutes,
    elevesRoutes,
    professeursRoutes,
    classesRoutes,
    absencesRoutes,
    appreciationsRoutes,
    messagerieRoutes,
    staffRoutes,
    emailRoutes,
    actualitesRoutes
} = require('./src/routes');

// Initialisation de l'application
const app = express();

// Middleware globaux
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/eleves', elevesRoutes);
app.use('/api/professeurs', professeursRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/absences', absencesRoutes);
app.use('/api/appreciations', appreciationsRoutes);
app.use('/api/messagerie', messagerieRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/actualites', actualitesRoutes);
app.use('/api', emailRoutes);

// Route principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Gestion des erreurs 404
app.use((req, res) => {
    res.status(404).json({ error: 'Route non trouvée' });
});

// Gestion globale des erreurs
app.use((err, req, res, next) => {
    console.error('❌ Erreur:', err);
    res.status(500).json({ error: 'Erreur serveur interne' });
});

// Démarrage du serveur
async function startServer() {
    try {
        // Initialiser la base de données
        await initDatabase();
        
        // Nettoyer les actualités expirées au démarrage
        cleanupExpiredNews();
        
        // Programmer un nettoyage automatique toutes les 24 heures
        setInterval(cleanupExpiredNews, 24 * 60 * 60 * 1000); // 24h en millisecondes
        
        // Démarrer le serveur
        app.listen(SERVER_CONFIG.PORT, SERVER_CONFIG.HOST, () => {
            const localIp = getLocalIpAddress();
            
            console.log('\n╔════════════════════════════════════════════════════════════╗');
            console.log('║     🎓 GESTION ÉCOLE - EVEIL ET IHSAN                      ║');
            console.log('╠════════════════════════════════════════════════════════════╣');
            console.log('║  ✅ Serveur démarré avec succès!                           ║');
            console.log('║  💾 Base de données: SQLite (data/ecole.db)                ║');
            console.log('╠════════════════════════════════════════════════════════════╣');
            console.log('║  🌐 Adresses disponibles:                                  ║');
            console.log(`║     - Local:   http://localhost:${SERVER_CONFIG.PORT}                      ║`);
            console.log(`║     - Réseau:  http://${localIp}:${SERVER_CONFIG.PORT}                  ║`);
            console.log('╠════════════════════════════════════════════════════════════╣');
            console.log('║  📱 Pour accéder depuis mobile:                            ║');
            console.log(`║     Utilisez: http://${localIp}:${SERVER_CONFIG.PORT}                  ║`);
            console.log('╚════════════════════════════════════════════════════════════╝\n');
        });
    } catch (error) {
        console.error('❌ Erreur au démarrage:', error);
        process.exit(1);
    }
}

// Fermeture propre
process.on('SIGINT', async () => {
    console.log('\n🛑 Arrêt du serveur...');
    await closeDatabase();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Arrêt du serveur...');
    await closeDatabase();
    process.exit(0);
});

// Démarrer le serveur
startServer();

module.exports = app;
