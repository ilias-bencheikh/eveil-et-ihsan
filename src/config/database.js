const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Créer le dossier data s'il n'existe pas
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Connexion à la base de données SQLite
const dbPath = path.join(dataDir, 'ecole.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erreur de connexion à la base de données:', err);
    } else {
        console.log('✅ Connecté à la base de données SQLite');
        // Configurer la base de données pour une meilleure persistance
        db.run('PRAGMA synchronous = FULL');
        db.run('PRAGMA journal_mode = DELETE');
    }
});

// Initialisation de la base de données
function initDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // ==================== TABLE PARENTS ====================
            // Nouveau système : les comptes sont maintenant des comptes PARENTS
            db.run(`CREATE TABLE IF NOT EXISTS parents (
                id TEXT PRIMARY KEY,
                nom TEXT NOT NULL,
                prenom TEXT NOT NULL,
                email TEXT UNIQUE,
                password TEXT,
                tel TEXT,
                adresse TEXT,
                activationToken TEXT,
                activated INTEGER DEFAULT 0,
                resetToken TEXT,
                resetExpires INTEGER,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP
            )`);

            // Table élèves - maintenant liée aux parents
            db.run(`CREATE TABLE IF NOT EXISTS eleves (
                id TEXT PRIMARY KEY,
                nom TEXT NOT NULL,
                prenom TEXT NOT NULL,
                dateNaissance TEXT,
                classe TEXT,
                photo TEXT,
                enFamille INTEGER DEFAULT 0,
                nombreFamille INTEGER DEFAULT 1,
                familleLienId TEXT,
                -- Liens vers les parents (un enfant peut avoir 2 parents)
                parent1Id TEXT,
                parent2Id TEXT,
                -- Pour les étudiants majeurs (ont leur propre compte)
                email TEXT,
                password TEXT,
                tel TEXT,
                activationToken TEXT,
                activated INTEGER DEFAULT 0,
                resetToken TEXT,
                resetExpires INTEGER,
                status TEXT DEFAULT 'mineur',
                -- Frais d'inscription
                fraisInscription REAL DEFAULT 0,
                nbMensualites INTEGER DEFAULT 1,
                totalPaye REAL DEFAULT 0,
                fraisValide INTEGER DEFAULT 0,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (parent1Id) REFERENCES parents(id),
                FOREIGN KEY (parent2Id) REFERENCES parents(id)
            )`);

            // Table historique des paiements
            db.run(`CREATE TABLE IF NOT EXISTS paiements_historique (
                id TEXT PRIMARY KEY,
                eleveId TEXT NOT NULL,
                montant REAL NOT NULL,
                modePaiement TEXT NOT NULL,
                reference TEXT,
                notes TEXT,
                datePaiement TEXT NOT NULL,
                enregistrePar TEXT,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (eleveId) REFERENCES eleves(id)
            )`);

            // Migrations pour ancienne structure si nécessaire
            db.run(`ALTER TABLE eleves ADD COLUMN parent1Id TEXT`, () => {});
            db.run(`ALTER TABLE eleves ADD COLUMN parent2Id TEXT`, () => {});
            db.run(`ALTER TABLE eleves ADD COLUMN nbMensualites INTEGER DEFAULT 1`, () => {});
            db.run(`ALTER TABLE eleves ADD COLUMN totalPaye REAL DEFAULT 0`, () => {});
            // Anciennes colonnes gardées pour compatibilité
            db.run(`ALTER TABLE eleves ADD COLUMN parentNom TEXT`, () => {});
            db.run(`ALTER TABLE eleves ADD COLUMN parentPrenom TEXT`, () => {});
            db.run(`ALTER TABLE eleves ADD COLUMN parentTel TEXT`, () => {});
            db.run(`ALTER TABLE eleves ADD COLUMN parentAdresse TEXT`, () => {});
            // Colonnes pour les frais d'inscription
            db.run(`ALTER TABLE eleves ADD COLUMN fraisInscription REAL DEFAULT 0`, () => {});
            db.run(`ALTER TABLE eleves ADD COLUMN nbPaiements INTEGER DEFAULT 1`, () => {});
            db.run(`ALTER TABLE eleves ADD COLUMN fraisValide INTEGER DEFAULT 0`, () => {});
            // Nombre de paiements déjà validés (ancienne colonne)
            db.run(`ALTER TABLE eleves ADD COLUMN paiementsEffectues INTEGER DEFAULT 0`, () => {});
            // Colonne pour le téléphone de l'étudiant (pour majeurs)
            db.run(`ALTER TABLE eleves ADD COLUMN tel TEXT`, () => {});
            // Colonne pour le statut (mineur/majeur)
            db.run(`ALTER TABLE eleves ADD COLUMN status TEXT DEFAULT 'mineur'`, () => {});

            // Table professeurs
            db.run(`CREATE TABLE IF NOT EXISTS professeurs (
                id TEXT PRIMARY KEY,
                nom TEXT NOT NULL,
                prenom TEXT NOT NULL,
                email TEXT,
                matiere TEXT,
                password TEXT,
                activationToken TEXT,
                activated INTEGER DEFAULT 0,
                resetToken TEXT,
                resetExpires INTEGER
            )`);

            // Table classes
            db.run(`CREATE TABLE IF NOT EXISTS classes (
                id TEXT PRIMARY KEY,
                nom TEXT NOT NULL,
                niveau TEXT,
                professeurId TEXT
            )`);

            // Table absences
            db.run(`CREATE TABLE IF NOT EXISTS absences (
                id TEXT PRIMARY KEY,
                eleveId TEXT NOT NULL,
                date TEXT NOT NULL,
                type TEXT,
                motif TEXT,
                batchId TEXT,
                professeurId TEXT,
                classe TEXT,
                FOREIGN KEY (eleveId) REFERENCES eleves(id)
            )`);

            // Migration : ajouter les colonnes manquantes
            db.run(`ALTER TABLE absences ADD COLUMN batchId TEXT`, () => {});
            db.run(`ALTER TABLE absences ADD COLUMN professeurId TEXT`, () => {});
            db.run(`ALTER TABLE absences ADD COLUMN classe TEXT`, () => {});

            // Table appréciations
            db.run(`CREATE TABLE IF NOT EXISTS appreciations (
                id TEXT PRIMARY KEY,
                eleveId TEXT NOT NULL,
                professeurId TEXT NOT NULL,
                matiere TEXT,
                periode TEXT,
                note REAL,
                commentaire TEXT,
                createdByRole TEXT,
                dateCreated TEXT DEFAULT CURRENT_TIMESTAMP,
                batchId TEXT,
                classe TEXT,
                FOREIGN KEY (eleveId) REFERENCES eleves(id),
                FOREIGN KEY (professeurId) REFERENCES professeurs(id)
            )`);

            // Migrations pour ajouter les colonnes manquantes
            db.run(`ALTER TABLE appreciations ADD COLUMN dateCreated TEXT DEFAULT CURRENT_TIMESTAMP`, () => {});
            db.run(`ALTER TABLE appreciations ADD COLUMN batchId TEXT`, () => {});
            db.run(`ALTER TABLE appreciations ADD COLUMN classe TEXT`, () => {});

            // Table messages
            db.run(`CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                expediteurId TEXT NOT NULL,
                destinataireId TEXT NOT NULL,
                contenu TEXT NOT NULL,
                date TEXT NOT NULL,
                lu INTEGER DEFAULT 0
            )`);

            // Table staff (directeur, secretariat)
            db.run(`CREATE TABLE IF NOT EXISTS staff (
                id TEXT PRIMARY KEY,
                nom TEXT NOT NULL,
                prenom TEXT NOT NULL,
                email TEXT,
                role TEXT NOT NULL,
                matiere TEXT,
                password TEXT,
                activationToken TEXT,
                activated INTEGER DEFAULT 0,
                resetToken TEXT,
                resetExpires INTEGER
            )`);

            // Table actualités
            db.run(`CREATE TABLE IF NOT EXISTS actualites (
                id TEXT PRIMARY KEY,
                titre TEXT NOT NULL,
                description TEXT NOT NULL,
                date TEXT NOT NULL,
                auteurId TEXT,
                auteurNom TEXT,
                cible TEXT DEFAULT 'tous',
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP
            )`);

            // Ajouter la colonne cible si elle n'existe pas (migration)
            db.run(`ALTER TABLE actualites ADD COLUMN cible TEXT DEFAULT 'tous'`, () => {});

            // Ajouter la colonne dateFin si elle n'existe pas (migration)
            db.run(`ALTER TABLE actualites ADD COLUMN dateFin TEXT`, () => {});

            // Table tokens (pour la réinitialisation de mot de passe)
            db.run(`CREATE TABLE IF NOT EXISTS tokens (
                id TEXT PRIMARY KEY,
                token TEXT NOT NULL,
                userId TEXT NOT NULL,
                role TEXT NOT NULL,
                expires INTEGER NOT NULL,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP
            )`);

            // Table sessions (pour gérer les connexions multiples)
            db.run(`CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                token TEXT NOT NULL UNIQUE,
                userId TEXT NOT NULL,
                userRole TEXT NOT NULL,
                userEmail TEXT,
                userName TEXT,
                createdAt INTEGER NOT NULL,
                expiresAt INTEGER NOT NULL,
                lastActivity INTEGER NOT NULL,
                userAgent TEXT,
                ipAddress TEXT
            )`);

            // Insérer le compte admin par défaut s'il n'y a aucun admin
            db.get('SELECT id FROM staff WHERE role = ?', ['admin'], (err, row) => {
                if (err) {
                    console.error('Erreur vérification admin:', err);
                    return;
                }
                if (!row) {
                    db.run('INSERT INTO staff (id, nom, prenom, email, role, password, activated) VALUES (?, ?, ?, ?, ?, ?, 1)',
                        ['admin1', 'Admin', '', 'admin@ecole.fr', 'admin', 'admin'], (err) => {
                        if (err) {
                            console.error('Erreur insertion admin:', err);
                        } else {
                            console.log('✅ Compte admin par défaut créé');
                        }
                    });
                }
            });

            console.log('✅ Tables créées avec succès');
            resolve();
        });
    });
}

// Fermeture propre de la base de données
function closeDatabase() {
    return new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) {
                console.error('❌ Erreur lors de la fermeture de la base de données:', err);
                reject(err);
            } else {
                console.log('✅ Base de données fermée proprement');
                resolve();
            }
        });
    });
}

module.exports = {
    db,
    initDatabase,
    closeDatabase
};
