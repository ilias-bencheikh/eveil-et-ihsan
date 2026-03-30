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
        // Sécurité et performance de la base de données
        db.run('PRAGMA synchronous = FULL');        // Intégrité maximale des données
        db.run('PRAGMA journal_mode = WAL');         // Write-Ahead Logging (meilleure performance)
        db.run('PRAGMA busy_timeout = 5000');        // Attendre 5s si la DB est verrouillée
        db.run('PRAGMA foreign_keys = ON');          // Activer les contraintes de clés étrangères
        db.run('PRAGMA secure_delete = ON');         // Écraser les données supprimées (sécurité)
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
                status TEXT DEFAULT 'mineur',
                tel TEXT,
                adresse TEXT,
                fraisInscription REAL DEFAULT 0,
                nbPaiements INTEGER DEFAULT 1,
                fraisValide INTEGER DEFAULT 0,
                paiementsEffectues INTEGER DEFAULT 0,
                montantPaye REAL DEFAULT 0,
                anneeScolaire TEXT
            )`);

            // Migrations pour élèves
            db.run(`ALTER TABLE eleves ADD COLUMN fraisInscription REAL DEFAULT 0`, () => {});
            db.run(`ALTER TABLE eleves ADD COLUMN nbPaiements INTEGER DEFAULT 1`, () => {});
            db.run(`ALTER TABLE eleves ADD COLUMN fraisValide INTEGER DEFAULT 0`, () => {});
            db.run(`ALTER TABLE eleves ADD COLUMN paiementsEffectues INTEGER DEFAULT 0`, () => {});
            db.run(`ALTER TABLE eleves ADD COLUMN montantPaye REAL DEFAULT 0`, () => {});
            db.run(`ALTER TABLE eleves ADD COLUMN tel TEXT`, () => {});
            db.run(`ALTER TABLE eleves ADD COLUMN status TEXT DEFAULT 'mineur'`, () => {});
            db.run(`ALTER TABLE eleves ADD COLUMN anneeScolaire TEXT`, () => {});
            db.run(`ALTER TABLE eleves ADD COLUMN adresse TEXT`, () => {});
            db.run(`ALTER TABLE eleves ADD COLUMN notifEmailMessage INTEGER DEFAULT 1`, () => {});

            // Table paiements (historique des transactions)
            db.run(`CREATE TABLE IF NOT EXISTS paiements (
                id TEXT PRIMARY KEY,
                eleveId TEXT NOT NULL,
                montant REAL NOT NULL,
                methodePaiement TEXT NOT NULL DEFAULT 'espece',
                date TEXT NOT NULL,
                note TEXT,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (eleveId) REFERENCES eleves(id) ON DELETE CASCADE
            )`);

            // Table parents (nouveau système - comptes séparés)
            db.run(`CREATE TABLE IF NOT EXISTS parents (
                id TEXT PRIMARY KEY,
                nom TEXT NOT NULL,
                prenom TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT,
                tel TEXT,
                adresse TEXT,
                profession TEXT,
                activationToken TEXT,
                activated INTEGER DEFAULT 0,
                resetToken TEXT,
                resetExpires INTEGER,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                notifEmailMessage INTEGER DEFAULT 1
            )`);
            db.run(`ALTER TABLE parents ADD COLUMN notifEmailMessage INTEGER DEFAULT 1`, () => {});

            // Table de liaison élève-parent (un élève peut avoir 2 parents)
            db.run(`CREATE TABLE IF NOT EXISTS eleve_parent (
                id TEXT PRIMARY KEY,
                eleveId TEXT NOT NULL,
                parentId TEXT NOT NULL,
                relation TEXT DEFAULT 'parent',
                isPrimary INTEGER DEFAULT 0,
                FOREIGN KEY (eleveId) REFERENCES eleves(id) ON DELETE CASCADE,
                FOREIGN KEY (parentId) REFERENCES parents(id) ON DELETE CASCADE,
                UNIQUE(eleveId, parentId)
            )`);

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
                resetExpires INTEGER,
                notifEmailMessage INTEGER DEFAULT 1
            )`);
            db.run(`ALTER TABLE professeurs ADD COLUMN notifEmailMessage INTEGER DEFAULT 1`, () => {});

            // Table classes
            db.run(`CREATE TABLE IF NOT EXISTS classes (
                id TEXT PRIMARY KEY,
                nom TEXT NOT NULL,
                niveau TEXT,
                professeurId TEXT
            )`);

            // Table emplois du temps (créneaux horaires par classe)
            db.run(`CREATE TABLE IF NOT EXISTS emplois_du_temps (
                id TEXT PRIMARY KEY,
                classeId TEXT NOT NULL,
                jour TEXT NOT NULL,
                periode TEXT NOT NULL,
                FOREIGN KEY (classeId) REFERENCES classes(id) ON DELETE CASCADE,
                UNIQUE(classeId, jour, periode)
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
                lu INTEGER DEFAULT 0,
                enfantId TEXT,
                deleted_by_sender INTEGER DEFAULT 0,
                deleted_by_receiver INTEGER DEFAULT 0
            )`);

            // Migration : ajouter enfantId aux messages (pour contexte "Parent de enfant")
            db.run(`ALTER TABLE messages ADD COLUMN enfantId TEXT`, () => {});
            // Migration : soft delete par utilisateur (boîte de réception indépendante)
            db.run(`ALTER TABLE messages ADD COLUMN deleted_by_sender INTEGER DEFAULT 0`, () => {});
            db.run(`ALTER TABLE messages ADD COLUMN deleted_by_receiver INTEGER DEFAULT 0`, () => {});
            // Migration : pièces jointes (JSON array des métadonnées de fichiers)
            db.run(`ALTER TABLE messages ADD COLUMN piecesJointes TEXT`, () => {});

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
                resetExpires INTEGER,
                notifEmailMessage INTEGER DEFAULT 1
            )`);
            db.run(`ALTER TABLE staff ADD COLUMN notifEmailMessage INTEGER DEFAULT 1`, () => {});

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

            // Ajouter la colonne piecesJointes si elle n'existe pas (migration)
            db.run(`ALTER TABLE actualites ADD COLUMN piecesJointes TEXT`, () => {});

            // Ajouter la colonne auteurRole si elle n'existe pas (migration)
            db.run(`ALTER TABLE actualites ADD COLUMN auteurRole TEXT DEFAULT 'Administration'`, () => {});

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

            // Table maintenance (mode maintenance)
            db.run(`CREATE TABLE IF NOT EXISTS maintenance (
                id INTEGER PRIMARY KEY,
                active INTEGER DEFAULT 0,
                dateDebut TEXT,
                dateFin TEXT,
                message TEXT
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
                            }
                        });
                }
            });

            // Table migrations (suivi des migrations one-time)
            db.run(`CREATE TABLE IF NOT EXISTS migrations (
                id TEXT PRIMARY KEY,
                appliedAt TEXT DEFAULT CURRENT_TIMESTAMP
            )`);

            // ── Migration : supprimer le FK constraint sur professeurId dans appreciations ──
            // Les membres du staff ne sont pas dans la table professeurs → SQLITE_CONSTRAINT.
            // On chaîne chaque étape dans son callback pour garantir l'ordre d'exécution.
            db.get(`SELECT id FROM migrations WHERE id = 'rm_appreciations_professeurId_fk'`, (err, row) => {
                if (row) return; // déjà appliqué
                db.run(`PRAGMA foreign_keys = OFF`, () => {
                    db.run(`DROP TABLE IF EXISTS appreciations_new`, () => {
                        db.run(`CREATE TABLE appreciations_new (
                            id TEXT PRIMARY KEY,
                            eleveId TEXT NOT NULL,
                            professeurId TEXT,
                            matiere TEXT,
                            periode TEXT,
                            note REAL,
                            commentaire TEXT,
                            createdByRole TEXT,
                            dateCreated TEXT DEFAULT CURRENT_TIMESTAMP,
                            batchId TEXT,
                            classe TEXT,
                            FOREIGN KEY (eleveId) REFERENCES eleves(id)
                        )`, () => {
                            db.run(`INSERT OR IGNORE INTO appreciations_new
                                    SELECT id, eleveId, professeurId, matiere, periode, note,
                                           commentaire, createdByRole, dateCreated, batchId, classe
                                    FROM appreciations`, (insertErr) => {
                                if (insertErr) {
                                    console.error('❌ Migration appreciations INSERT échouée:', insertErr);
                                    db.run(`PRAGMA foreign_keys = ON`);
                                    return;
                                }
                                db.run(`DROP TABLE appreciations`, () => {
                                    db.run(`ALTER TABLE appreciations_new RENAME TO appreciations`, () => {
                                        db.run(`PRAGMA foreign_keys = ON`);
                                        db.run(`INSERT INTO migrations (id) VALUES ('rm_appreciations_professeurId_fk')`, () => {
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
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
