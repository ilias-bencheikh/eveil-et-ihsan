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
    }
});

// Initialisation de la base de données
function initDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Table élèves
            db.run(`CREATE TABLE IF NOT EXISTS eleves (
                id TEXT PRIMARY KEY,
                nom TEXT NOT NULL,
                prenom TEXT NOT NULL,
                dateNaissance TEXT,
                classe TEXT,
                email TEXT,
                password TEXT,
                activationToken TEXT,
                activated INTEGER DEFAULT 0,
                resetToken TEXT,
                resetExpires INTEGER,
                enFamille INTEGER DEFAULT 0,
                nombreFamille INTEGER DEFAULT 1,
                familleLienId TEXT,
                photo TEXT,
                parentNom TEXT,
                parentPrenom TEXT,
                parentTel TEXT
            )`);

            // Ajouter les colonnes parent si elles n'existent pas (migration)
            db.run(`ALTER TABLE eleves ADD COLUMN parentNom TEXT`, () => {});
            db.run(`ALTER TABLE eleves ADD COLUMN parentPrenom TEXT`, () => {});
            db.run(`ALTER TABLE eleves ADD COLUMN parentTel TEXT`, () => {});
            // Colonnes pour les frais d'inscription
            db.run(`ALTER TABLE eleves ADD COLUMN fraisInscription REAL DEFAULT 0`, () => {});
            db.run(`ALTER TABLE eleves ADD COLUMN nbPaiements INTEGER DEFAULT 1`, () => {});
            db.run(`ALTER TABLE eleves ADD COLUMN fraisValide INTEGER DEFAULT 0`, () => {});
            // Nombre de paiements déjà validés
            db.run(`ALTER TABLE eleves ADD COLUMN paiementsEffectues INTEGER DEFAULT 0`, () => {});

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
                FOREIGN KEY (eleveId) REFERENCES eleves(id)
            )`);

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
                FOREIGN KEY (eleveId) REFERENCES eleves(id),
                FOREIGN KEY (professeurId) REFERENCES professeurs(id)
            )`);

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

            // Table tokens (pour la réinitialisation de mot de passe)
            db.run(`CREATE TABLE IF NOT EXISTS tokens (
                id TEXT PRIMARY KEY,
                token TEXT NOT NULL,
                userId TEXT NOT NULL,
                role TEXT NOT NULL,
                expires INTEGER NOT NULL,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP
            )`);

            // Insérer le compte admin s'il n'existe pas
            db.get('SELECT id FROM staff WHERE id = ?', ['admin1'], (err, row) => {
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
                            console.log('✅ Compte admin créé');
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
