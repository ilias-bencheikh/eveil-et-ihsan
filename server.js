const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Comptes de démonstration
const DEMO_ACCOUNTS = {
    professeurs: [],
    eleves: [],
    staff: [
        { id: 'admin1', email: 'admin@ecole.fr', password: 'admin', role: 'admin' }
    ]
};

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Connexion à la base de données SQLite
const db = new sqlite3.Database('./ecole.db', (err) => {
    if (err) {
        console.error('Erreur de connexion à la base de données:', err);
    } else {
        console.log('✅ Connecté à la base de données SQLite');
        initDatabase();
    }
});

// Initialisation de la base de données
function initDatabase() {
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
            familleLienId TEXT
        )`);
        
        // Ajouter les colonnes si elles n'existent pas
        db.run(`ALTER TABLE eleves ADD COLUMN enFamille INTEGER DEFAULT 0`, () => {});
        db.run(`ALTER TABLE eleves ADD COLUMN nombreFamille INTEGER DEFAULT 1`, () => {});
        db.run(`ALTER TABLE eleves ADD COLUMN familleLienId TEXT`, () => {});
        db.run(`ALTER TABLE eleves ADD COLUMN photo TEXT`, () => {});

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
        )`, () => {
            // Ajouter la colonne matiere si elle n'existe pas
            db.run(`ALTER TABLE staff ADD COLUMN matiere TEXT`, () => {});
            console.log('✅ Tables créées avec succès');
            initDemoData();
        });
    });
}

// Initialiser les données de démonstration
function initDemoData() {
    // Vérifier si des données existent déjà dans toutes les tables
    db.get('SELECT COUNT(*) as count FROM professeurs', (err, row) => {
        if (row && row.count === 0) {
            // Pas de données de démonstration à insérer
            // L'admin peut créer ses propres données
            console.log('✅ Base de données vierge - prête à l\'emploi');
        }
    });
}

// Middleware de vérification des permissions
const permissions = {
    admin: ['create', 'read', 'update', 'delete'],
    directeur: ['create', 'read', 'update', 'delete'],
    secretariat: ['create', 'read', 'update'],
    professeur: ['read', 'create_absence', 'create_appreciation'],
    eleve: ['read_own']
};

function hasPermission(role, action) {
    return permissions[role]?.includes(action) || false;
}

function checkPermission(action) {
    return (req, res, next) => {
        const userRole = req.headers['x-user-role'];
        if (hasPermission(userRole, action)) {
            next();
        } else {
            res.status(403).json({ message: 'Accès refusé' });
        }
    };
}

// ==================== ROUTES AUTHENTIFICATION ====================

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    // 1. Vérifier d'abord les comptes de démonstration (Staff hardcodé)
    let user = DEMO_ACCOUNTS.staff.find(u => u.email === email && u.password === password);
    if (user) {
        return res.json({ user, token: 'demo-token' });
    }

    // 2. Vérifier dans la table STAFF (C'est ce qui manquait !)
    db.get('SELECT * FROM staff WHERE email = ? AND password = ? AND activated = 1', 
        [email, password], 
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            
            if (row) {
                // Utilisateur trouvé dans la table staff
                return res.json({ 
                    user: {
                        id: row.id,
                        email: row.email,
                        role: row.role, // 'directeur', 'secretariat', etc.
                        nom: row.nom,
                        prenom: row.prenom,
                        matiere: row.matiere
                    }, 
                    token: 'demo-token' 
                });
            }

            // 3. Si pas trouvé, vérifier les PROFESSEURS
            db.get('SELECT * FROM professeurs WHERE email = ? AND password = ? AND activated = 1', 
                [email, password], 
                (err, row) => {
                    if (row) {
                        return res.json({ 
                            user: {
                                id: row.id,
                                email: row.email,
                                role: 'professeur',
                                nom: row.nom,
                                prenom: row.prenom,
                                matiere: row.matiere
                            }, 
                            token: 'demo-token' 
                        });
                    }
                    
                    // 4. Si pas trouvé, vérifier les ÉLÈVES
                    db.get('SELECT * FROM eleves WHERE email = ? AND password = ? AND activated = 1', 
                        [email, password], 
                        (err, row) => {
                            if (row) {
                                return res.json({ 
                                    user: {
                                        id: row.id,
                                        email: row.email,
                                        role: 'eleve',
                                        nom: row.nom,
                                        prenom: row.prenom
                                    }, 
                                    token: 'demo-token' 
                                });
                            }
                            
                            // Si personne n'est trouvé nulle part
                            res.status(401).json({ message: 'Email ou mot de passe incorrect' });
                        }
                    );
                }
            );
        }
    );
});

// Route pour activer un compte professeur
app.post('/api/professeurs/activate', (req, res) => {
    const { token, password } = req.body;
    
    db.get('SELECT * FROM professeurs WHERE activationToken = ? AND activated = 0', [token], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Token invalide ou compte déjà activé' });
        
        db.run('UPDATE professeurs SET password = ?, activated = 1, activationToken = NULL WHERE id = ?',
            [password, row.id],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ 
                    message: 'Compte activé avec succès! Vous pouvez maintenant vous connecter.',
                    email: row.email
                });
            }
        );
    });
});

// Route pour vérifier un token d'activation professeur
app.get('/api/professeurs/check-token/:token', (req, res) => {
    db.get('SELECT nom, prenom, email FROM professeurs WHERE activationToken = ? AND activated = 0', 
        [req.params.token], 
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Token invalide ou compte déjà activé' });
            res.json(row);
        }
    );
});

// Route pour activer un compte élève
app.post('/api/eleves/activate', (req, res) => {
    const { token, password } = req.body;
    
    db.get('SELECT * FROM eleves WHERE activationToken = ? AND activated = 0', [token], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Token invalide ou compte déjà activé' });
        
        db.run('UPDATE eleves SET password = ?, activated = 1, activationToken = NULL WHERE id = ?',
            [password, row.id],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ 
                    message: 'Compte activé avec succès! Vous pouvez maintenant vous connecter.',
                    email: row.email
                });
            }
        );
    });
});

// Route pour vérifier un token d'activation
app.get('/api/eleves/check-token/:token', (req, res) => {
    db.get('SELECT nom, prenom, email FROM eleves WHERE activationToken = ? AND activated = 0', 
        [req.params.token], 
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Token invalide ou compte déjà activé' });
            res.json(row);
        }
    );
});

// ==================== ROUTES ÉLÈVES ====================

app.get('/api/eleves', (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    if (userRole === 'professeur') {
        // Les profs voient uniquement leurs élèves
        db.all(`
            SELECT DISTINCT e.* FROM eleves e
            INNER JOIN classes c ON e.classe = c.nom
            WHERE c.professeurId = ?
        `, [userId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    } else {
        db.all('SELECT * FROM eleves', (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    }
});

app.get('/api/eleves/:id', (req, res) => {
    db.get('SELECT * FROM eleves WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ message: 'Élève non trouvé' });
        res.json(row);
    });
});

// Route pour récupérer toute la famille d'un élève
app.get('/api/eleves/:id/famille', (req, res) => {
    db.get('SELECT familleLienId, enFamille FROM eleves WHERE id = ?', [req.params.id], (err, eleve) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!eleve) return res.status(404).json({ message: 'Élève non trouvé' });
        
        // Si l'élève n'est pas en famille, retourner juste lui
        if (!eleve.enFamille || !eleve.familleLienId) {
            db.get('SELECT * FROM eleves WHERE id = ?', [req.params.id], (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                return res.json([row]);
            });
        } else {
            // Récupérer tous les membres de la famille
            db.all('SELECT * FROM eleves WHERE familleLienId = ?', [eleve.familleLienId], (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(rows || []);
            });
        }
    });
});

app.post('/api/eleves', checkPermission('create'), (req, res) => {
    const { nom, prenom, dateNaissance, classe, email, enFamille, nombreFamille, familleLienId, photo } = req.body;
    const id = req.body.id || Date.now().toString();
    const crypto = require('crypto');
    const activationToken = crypto.randomBytes(32).toString('hex');

    db.run('INSERT INTO eleves (id, nom, prenom, dateNaissance, classe, email, password, activationToken, activated, resetToken, resetExpires, enFamille, nombreFamille, familleLienId, photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, nom, prenom, dateNaissance, classe, email || '', null, activationToken, 0, null, null, enFamille || 0, nombreFamille || 1, familleLienId || null, photo || null],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const activationLink = `http://${req.headers.host}/activation.html?token=${activationToken}`;
            res.status(201).json({ 
                id, nom, prenom, dateNaissance, classe, email, enFamille, nombreFamille, familleLienId, photo,
                activationLink,
                message: 'Élève créé. Envoyez le lien d\'activation à l\'élève.'
            });
        }
    );
});

app.put('/api/eleves/:id', checkPermission('update'), (req, res) => {
    const { nom, prenom, dateNaissance, classe, email, photo } = req.body;

    db.run('UPDATE eleves SET nom = ?, prenom = ?, dateNaissance = ?, classe = ?, email = ?, photo = ? WHERE id = ?',
        [nom, prenom, dateNaissance, classe, email || '', photo || null, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ message: 'Élève non trouvé' });
            res.json({ id: req.params.id, nom, prenom, dateNaissance, classe, email, photo });
        }
    );
});

app.delete('/api/eleves/:id', checkPermission('delete'), (req, res) => {
    db.run('DELETE FROM eleves WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Élève non trouvé' });
        res.json({ message: 'Élève supprimé' });
    });
});

// ==================== ROUTES PROFESSEURS ====================

app.get('/api/professeurs', (req, res) => {
    db.all('SELECT * FROM professeurs', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/professeurs', checkPermission('create'), (req, res) => {
    const { nom, prenom, email, matiere } = req.body;
    const id = Date.now().toString();
    const crypto = require('crypto');
    const activationToken = crypto.randomBytes(32).toString('hex');

    db.run('INSERT INTO professeurs VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, nom, prenom, email || '', matiere, null, activationToken, 0],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const activationLink = `http://${req.headers.host}/activation.html?token=${activationToken}&type=professeur`;
            res.status(201).json({ 
                id, nom, prenom, email, matiere,
                activationLink,
                message: 'Professeur créé. Envoyez le lien d\'activation au professeur.'
            });
        }
    );
});

app.put('/api/professeurs/:id', checkPermission('update'), (req, res) => {
    const { nom, prenom, email, matiere } = req.body;

    db.run('UPDATE professeurs SET nom = ?, prenom = ?, email = ?, matiere = ? WHERE id = ?',
        [nom, prenom, email || '', matiere, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ message: 'Professeur non trouvé' });
            res.json({ id: req.params.id, nom, prenom, email, matiere });
        }
    );
});

app.delete('/api/professeurs/:id', checkPermission('delete'), (req, res) => {
    db.run('DELETE FROM professeurs WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Professeur non trouvé' });
        res.json({ message: 'Professeur supprimé' });
    });
});

// ==================== ROUTES CLASSES ====================

app.get('/api/classes', (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    if (userRole === 'professeur') {
        db.all('SELECT * FROM classes WHERE professeurId = ?', [userId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    } else {
        db.all('SELECT * FROM classes', (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    }
});

app.post('/api/classes', checkPermission('create'), (req, res) => {
    const { nom, niveau, professeurId } = req.body;
    const id = Date.now().toString();

    db.run('INSERT INTO classes VALUES (?, ?, ?, ?)',
        [id, nom, niveau, professeurId],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id, nom, niveau, professeurId });
        }
    );
});

app.put('/api/classes/:id', checkPermission('update'), (req, res) => {
    const { nom, niveau, professeurId } = req.body;

    db.run('UPDATE classes SET nom = ?, niveau = ?, professeurId = ? WHERE id = ?',
        [nom, niveau, professeurId, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ message: 'Classe non trouvée' });
            res.json({ id: req.params.id, nom, niveau, professeurId });
        }
    );
});

app.delete('/api/classes/:id', checkPermission('delete'), (req, res) => {
    db.run('DELETE FROM classes WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Classe non trouvée' });
        res.json({ message: 'Classe supprimée' });
    });
});

// ==================== ROUTES ABSENCES ====================

app.get('/api/absences', (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    if (userRole === 'professeur') {
        db.all(`
            SELECT DISTINCT a.* FROM absences a
            INNER JOIN eleves e ON a.eleveId = e.id
            INNER JOIN classes c ON e.classe = c.nom
            WHERE c.professeurId = ?
        `, [userId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    } else {
        db.all('SELECT * FROM absences', (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    }
});

app.get('/api/absences/eleve/:eleveId', (req, res) => {
    db.all('SELECT * FROM absences WHERE eleveId = ?', [req.params.eleveId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/absences', (req, res) => {
    const { eleveId, date, type, motif } = req.body;
    const id = Date.now().toString();

    db.run('INSERT INTO absences VALUES (?, ?, ?, ?, ?)',
        [id, eleveId, date, type, motif],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id, eleveId, date, type, motif });
        }
    );
});

app.put('/api/absences/:id', checkPermission('update'), (req, res) => {
    const { eleveId, date, type, motif } = req.body;

    db.run('UPDATE absences SET eleveId = ?, date = ?, type = ?, motif = ? WHERE id = ?',
        [eleveId, date, type, motif, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ message: 'Absence non trouvée' });
            res.json({ id: req.params.id, eleveId, date, type, motif });
        }
    );
});

app.delete('/api/absences/:id', checkPermission('delete'), (req, res) => {
    db.run('DELETE FROM absences WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Absence non trouvée' });
        res.json({ message: 'Absence supprimée' });
    });
});

// ==================== ROUTES APPRÉCIATIONS ====================

app.get('/api/appreciations', (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    if (userRole === 'professeur') {
        db.all(`
            SELECT DISTINCT a.* FROM appreciations a
            INNER JOIN eleves e ON a.eleveId = e.id
            INNER JOIN classes c ON e.classe = c.nom
            WHERE c.professeurId = ?
        `, [userId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    } else {
        db.all('SELECT * FROM appreciations', (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    }
});

app.get('/api/appreciations/eleve/:eleveId', (req, res) => {
    db.all('SELECT * FROM appreciations WHERE eleveId = ?', [req.params.eleveId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/appreciations', (req, res) => {
    const { eleveId, professeurId, matiere, periode, note, commentaire, createdByRole } = req.body;
    const id = Date.now().toString();

    db.run('INSERT INTO appreciations VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, eleveId, professeurId, matiere, periode, note || null, commentaire, createdByRole || null],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id, eleveId, professeurId, matiere, periode, note, commentaire, createdByRole });
        }
    );
});

app.put('/api/appreciations/:id', checkPermission('update'), (req, res) => {
    const { eleveId, professeurId, matiere, periode, note, commentaire } = req.body;

    db.run('UPDATE appreciations SET eleveId = ?, professeurId = ?, matiere = ?, periode = ?, note = ?, commentaire = ? WHERE id = ?',
        [eleveId, professeurId, matiere, periode, note || null, commentaire, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ message: 'Appréciation non trouvée' });
            res.json({ id: req.params.id, eleveId, professeurId, matiere, periode, note, commentaire });
        }
    );
});

app.delete('/api/appreciations/:id', checkPermission('delete'), (req, res) => {
    db.run('DELETE FROM appreciations WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Appréciation non trouvée' });
        res.json({ message: 'Appréciation supprimée' });
    });
});

// ==================== ROUTES MESSAGERIE ====================

app.get('/api/messagerie/destinataires', (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    let destinataires = [];

    if (userRole === 'eleve') {
        // Les élèves peuvent écrire aux profs et au secrétariat
        db.all('SELECT id, nom, prenom FROM professeurs', (err, profs) => {
            if (err) return res.status(500).json({ error: err.message });
            
            destinataires = [
                ...profs.map(p => ({ id: p.id, nom: `${p.prenom} ${p.nom}`, role: 'Professeur' })),
                ...DEMO_ACCOUNTS.staff.filter(s => s.role === 'secretariat').map(s => ({ 
                    id: s.id, nom: s.email.split('@')[0], role: 'Secrétariat' 
                }))
            ];
            res.json(destinataires);
        });
    } else if (userRole === 'professeur') {
        // Les profs peuvent écrire aux autres profs, staff et leurs élèves
        db.all(`
            SELECT DISTINCT e.id, e.nom, e.prenom FROM eleves e
            INNER JOIN classes c ON e.classe = c.nom
            WHERE c.professeurId = ?
        `, [userId], (err, eleves) => {
            if (err) return res.status(500).json({ error: err.message });
            
            db.all('SELECT id, nom, prenom FROM professeurs WHERE id != ?', [userId], (err, profs) => {
                if (err) return res.status(500).json({ error: err.message });
                
                destinataires = [
                    ...profs.map(p => ({ id: p.id, nom: `${p.prenom} ${p.nom}`, role: 'Professeur' })),
                    ...DEMO_ACCOUNTS.staff.map(s => ({ id: s.id, nom: s.email.split('@')[0], role: s.role })),
                    ...eleves.map(e => ({ id: e.id, nom: `${e.prenom} ${e.nom}`, role: 'Élève' }))
                ];
                res.json(destinataires);
            });
        });
    } else {
        // Admin, directeur, secrétariat peuvent écrire à tout le monde
        db.all('SELECT id, nom, prenom FROM eleves', (err, eleves) => {
            if (err) return res.status(500).json({ error: err.message });
            
            db.all('SELECT id, nom, prenom FROM professeurs', (err, profs) => {
                if (err) return res.status(500).json({ error: err.message });
                
                destinataires = [
                    ...eleves.map(e => ({ id: e.id, nom: `${e.prenom} ${e.nom}`, role: 'Élève' })),
                    ...profs.map(p => ({ id: p.id, nom: `${p.prenom} ${p.nom}`, role: 'Professeur' })),
                    ...DEMO_ACCOUNTS.staff.filter(s => s.id !== userId).map(s => ({ 
                        id: s.id, nom: s.email.split('@')[0], role: s.role 
                    }))
                ];
                res.json(destinataires);
            });
        });
    }
});

app.get('/api/messagerie', (req, res) => {
    const userId = req.headers['x-user-id'];

    db.all('SELECT * FROM messages WHERE expediteurId = ? OR destinataireId = ?', [userId, userId], (err, messages) => {
        if (err) return res.status(500).json({ error: err.message });

        // Enrichir avec les noms
        db.all('SELECT id, nom, prenom FROM eleves', (err, eleves) => {
            db.all('SELECT id, nom, prenom FROM professeurs', (err, profs) => {
                const allUsers = [
                    ...eleves.map(e => ({ id: e.id, nom: `${e.prenom} ${e.nom}` })),
                    ...profs.map(p => ({ id: p.id, nom: `${p.prenom} ${p.nom}` })),
                    ...DEMO_ACCOUNTS.staff.map(s => ({ id: s.id, nom: s.email.split('@')[0] }))
                ];

                const enrichedMessages = messages.map(m => {
                    const expediteur = allUsers.find(u => u.id === m.expediteurId);
                    const destinataire = allUsers.find(u => u.id === m.destinataireId);
                    return {
                        ...m,
                        expediteurNom: expediteur ? expediteur.nom : 'Inconnu',
                        destinataireNom: destinataire ? destinataire.nom : 'Inconnu',
                        lu: m.lu === 1
                    };
                });

                res.json(enrichedMessages);
            });
        });
    });
});

app.post('/api/messagerie', (req, res) => {
    const { expediteurId, destinataireId, contenu } = req.body;
    const id = Date.now().toString();
    const date = new Date().toISOString();

    db.run('INSERT INTO messages VALUES (?, ?, ?, ?, ?, 0)',
        [id, expediteurId, destinataireId, contenu, date],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id, expediteurId, destinataireId, contenu, date, lu: false });
        }
    );
});

app.put('/api/messagerie/:id/lu', (req, res) => {
    db.run('UPDATE messages SET lu = 1 WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Message non trouvé' });
        res.json({ message: 'Message marqué comme lu' });
    });
});

// ==================== ROUTES STAFF (BUREAU) ====================

app.get('/api/staff', (req, res) => {
    db.all('SELECT id, nom, prenom, email, role, activated FROM staff', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/staff/:id', (req, res) => {
    db.get('SELECT * FROM staff WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ message: 'Membre non trouvé' });
        res.json(row);
    });
});

app.post('/api/staff', (req, res) => {
    const { nom, prenom, email, role, matiere } = req.body;
    const userRole = req.headers['x-user-role'];
    
    // Vérifier les permissions
    if (userRole === 'directeur' && role === 'directeur') {
        return res.status(403).json({ error: 'Le directeur ne peut pas créer un autre directeur' });
    }
    
    if (!['admin', 'directeur'].includes(userRole)) {
        return res.status(403).json({ error: 'Permission refusée' });
    }
    
    const id = `staff_${Date.now()}`;
    const crypto = require('crypto');
    const activationToken = crypto.randomBytes(32).toString('hex');

    db.run('INSERT INTO staff (id, nom, prenom, email, role, matiere, password, activationToken, activated, resetToken, resetExpires) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, nom, prenom, email || '', role, matiere || null, null, activationToken, 0, null, null],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const activationLink = `http://${req.headers.host}/activation.html?token=${activationToken}&type=staff`;
            res.status(201).json({ 
                id, nom, prenom, email, role, matiere,
                activationLink,
                message: 'Membre du bureau créé. Envoyez le lien d\'activation.'
            });
        }
    );
});

app.put('/api/staff/:id', (req, res) => {
    const { nom, prenom, email, role, matiere } = req.body;
    const userRole = req.headers['x-user-role'];
    
    // Vérifier les permissions
    if (userRole === 'directeur' && role === 'directeur') {
        return res.status(403).json({ error: 'Le directeur ne peut pas modifier un directeur' });
    }
    
    if (!['admin', 'directeur'].includes(userRole)) {
        return res.status(403).json({ error: 'Permission refusée' });
    }

    db.run('UPDATE staff SET nom = ?, prenom = ?, email = ?, role = ?, matiere = ? WHERE id = ?',
        [nom, prenom, email || '', role, matiere || null, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ message: 'Membre non trouvé' });
            res.json({ id: req.params.id, nom, prenom, email, role, matiere });
        }
    );
});

app.delete('/api/staff/:id', (req, res) => {
    const userRole = req.headers['x-user-role'];
    
    if (!['admin', 'directeur'].includes(userRole)) {
        return res.status(403).json({ error: 'Permission refusée' });
    }

    db.run('DELETE FROM staff WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Membre non trouvé' });
        res.json({ message: 'Membre supprimé' });
    });
});

// === ROUTES D'ACTIVATION MANQUANTES POUR LE STAFF ===

// Route pour vérifier un token d'activation staff (nécessaire quand on clique sur le lien)
app.get('/api/staff/check-token/:token', (req, res) => {
    db.get('SELECT nom, prenom, email FROM staff WHERE activationToken = ? AND activated = 0', 
        [req.params.token], 
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Token invalide ou compte déjà activé' });
            res.json(row);
        }
    );
});

// Route pour activer un compte staff (définition du mot de passe)
app.post('/api/staff/activate', (req, res) => {
    const { token, password } = req.body;
    
    db.get('SELECT * FROM staff WHERE activationToken = ? AND activated = 0', [token], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Token invalide ou compte déjà activé' });
        
        db.run('UPDATE staff SET password = ?, activated = 1, activationToken = NULL WHERE id = ?',
            [password, row.id],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ 
                    message: 'Compte activé avec succès! Vous pouvez maintenant vous connecter.',
                    email: row.email
                });
            }
        );
    });
});

// Route principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Fonction pour obtenir l'adresse IP locale
function getLocalIpAddress() {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // IPv4, pas d'adresse interne (127.0.0.1)
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

// ==================== CONFIGURATION EMAIL ====================

// Configuration du transporteur d'email
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'no.reply.eveil.et.ihsan@gmail.com',
        pass: process.env.EMAIL_PASSWORD || '' // À configurer via variable d'environnement
    }
});

// Route pour envoyer l'email d'activation
app.post('/api/send-activation-email', checkPermission('create'), async (req, res) => {
    const { userId, email, type } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email non fourni' });
    }
    
    try {
        // CORRECTION ICI : Gestion correcte des 3 tables
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

        // Récupérer le token d'activation
        db.get(`SELECT activationToken, nom, prenom FROM ${table} WHERE id = ?`, [userId], async (err, user) => {
            if (err || !user) {
                return res.status(404).json({ error: 'Utilisateur non trouvé' });
            }
            
            const activationLink = `http://${req.headers.host}/activation.html?token=${user.activationToken}${queryParams}`;
            
            // Préparer l'email
            const mailOptions = {
                from: 'Eveil et Ihsan <no.reply.eveil.et.ihsan@gmail.com>',
                to: email,
                subject: 'Activation de votre compte - Eveil et Ihsan',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="color: white; margin: 0;">Eveil et Ihsan</h1>
                        </div>
                        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                            <h2 style="color: #1e3a5f;">Salam Aleykoum ${user.prenom} ${user.nom},</h2>
                            <p style="color: #666; line-height: 1.6;">
                                Votre compte a été créé avec succès. Pour activer votre compte et créer votre mot de passe, 
                                veuillez cliquer sur le bouton ci-dessous :
                            </p>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${activationLink}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: 600; display: inline-block;">
                                    Activer mon compte
                                </a>
                            </div>
                            <p style="color: #999; font-size: 0.9em; line-height: 1.6;">
                                Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br>
                                <span style="color: #667eea; word-break: break-all;">${activationLink}</span>
                            </p>
                            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
                            <p style="color: #999; font-size: 0.85em; text-align: center;">
                                Cet email a été envoyé automatiquement, merci de ne pas y répondre.
                            </p>
                        </div>
                    </div>
                `
            };
            
            // Envoyer l'email
            try {
                await transporter.sendMail(mailOptions);
                res.json({ success: true, message: 'Email envoyé avec succès' });
            } catch (emailError) {
                console.error('Erreur lors de l\'envoi de l\'email:', emailError);
                res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email. Vérifiez la configuration du service email.' });
            }
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==================== ROUTES RÉINITIALISATION MOT DE PASSE ====================

// Route pour demander la réinitialisation du mot de passe
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email requis' });
    }
    
    try {
        const crypto = require('crypto');
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = Date.now() + 3600000; // 1 heure
        
        // Chercher dans les trois tables
        let userFound = false;
        let userName = '';
        let userType = '';
        
        // Vérifier élèves
        await new Promise((resolve) => {
            db.get('SELECT * FROM eleves WHERE email = ?', [email], (err, row) => {
                if (row && row.activated) {
                    db.run('UPDATE eleves SET resetToken = ?, resetExpires = ? WHERE id = ?', 
                        [resetToken, resetExpires, row.id]);
                    userName = `${row.prenom} ${row.nom}`;
                    userType = 'eleve';
                    userFound = true;
                }
                resolve();
            });
        });
        
        // Vérifier professeurs si pas trouvé
        if (!userFound) {
            await new Promise((resolve) => {
                db.get('SELECT * FROM professeurs WHERE email = ?', [email], (err, row) => {
                    if (row && row.activated) {
                        db.run('UPDATE professeurs SET resetToken = ?, resetExpires = ? WHERE id = ?', 
                            [resetToken, resetExpires, row.id]);
                        userName = `${row.prenom} ${row.nom}`;
                        userType = 'professeur';
                        userFound = true;
                    }
                    resolve();
                });
            });
        }
        
        // Vérifier staff (admin, directeur, secretariat)
        if (!userFound) {
            const staffAccount = DEMO_ACCOUNTS.staff.find(s => s.email === email);
            if (staffAccount) {
                // Pour le staff, on stocke temporairement le token en mémoire
                if (!global.staffResetTokens) global.staffResetTokens = {};
                global.staffResetTokens[email] = {
                    token: resetToken,
                    expires: resetExpires,
                    id: staffAccount.id
                };
                userName = staffAccount.role;
                userType = 'staff';
                userFound = true;
            }
        }
        
        if (!userFound) {
            // Ne pas révéler si l'email existe ou non pour des raisons de sécurité
            return res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' });
        }
        
        // Envoyer l'email
        const resetLink = `http://${req.headers.host}/reset-password.html?token=${resetToken}`;
        
        const mailOptions = {
            from: 'Eveil et Ihsan <no.reply.eveil.et.ihsan@gmail.com>',
            to: email,
            subject: 'Réinitialisation de votre mot de passe - Eveil et Ihsan',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="color: white; margin: 0;">Eveil et Ihsan</h1>
                    </div>
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #1e3a5f;">Bonjour ${userName},</h2>
                        <p style="color: #666; line-height: 1.6;">
                            Vous avez demandé la réinitialisation de votre mot de passe. 
                            Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :
                        </p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetLink}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: 600; display: inline-block;">
                                Réinitialiser mon mot de passe
                            </a>
                        </div>
                        <p style="color: #999; font-size: 0.9em; line-height: 1.6;">
                            Ce lien est valable pendant 1 heure.<br>
                            Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
                        </p>
                        <p style="color: #999; font-size: 0.9em; line-height: 1.6;">
                            Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br>
                            <span style="color: #667eea; word-break: break-all;">${resetLink}</span>
                        </p>
                        <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
                        <p style="color: #999; font-size: 0.85em; text-align: center;">
                            Cet email a été envoyé automatiquement, merci de ne pas y répondre.
                        </p>
                    </div>
                </div>
            `
        };
        
        try {
            await transporter.sendMail(mailOptions);
            res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' });
        } catch (emailError) {
            console.error('Erreur lors de l\'envoi de l\'email:', emailError);
            res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email.' });
        }
        
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route pour vérifier le token de réinitialisation
app.get('/api/auth/check-reset-token/:token', (req, res) => {
    const { token } = req.params;
    
    // Vérifier dans les élèves
    db.get('SELECT id, email FROM eleves WHERE resetToken = ? AND resetExpires > ?', 
        [token, Date.now()], (err, eleve) => {
        if (eleve) {
            return res.json({ valid: true, type: 'eleve' });
        }
        
        // Vérifier dans les professeurs
        db.get('SELECT id, email FROM professeurs WHERE resetToken = ? AND resetExpires > ?', 
            [token, Date.now()], (err, prof) => {
            if (prof) {
                return res.json({ valid: true, type: 'professeur' });
            }
            
            // Vérifier dans le staff
            if (global.staffResetTokens) {
                const staffEntry = Object.entries(global.staffResetTokens)
                    .find(([email, data]) => data.token === token && data.expires > Date.now());
                if (staffEntry) {
                    return res.json({ valid: true, type: 'staff' });
                }
            }
            
            res.status(400).json({ valid: false, message: 'Token invalide ou expiré' });
        });
    });
});

// Route pour réinitialiser le mot de passe
app.post('/api/auth/reset-password', async (req, res) => {
    const { token, password } = req.body;
    
    if (!token || !password) {
        return res.status(400).json({ error: 'Token et mot de passe requis' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }
    
    try {
        let updated = false;
        
        // Vérifier et mettre à jour élèves
        await new Promise((resolve) => {
            db.run('UPDATE eleves SET password = ?, resetToken = NULL, resetExpires = NULL WHERE resetToken = ? AND resetExpires > ?',
                [password, token, Date.now()],
                function(err) {
                    if (this.changes > 0) updated = true;
                    resolve();
                }
            );
        });
        
        // Vérifier et mettre à jour professeurs
        if (!updated) {
            await new Promise((resolve) => {
                db.run('UPDATE professeurs SET password = ?, resetToken = NULL, resetExpires = NULL WHERE resetToken = ? AND resetExpires > ?',
                    [password, token, Date.now()],
                    function(err) {
                        if (this.changes > 0) updated = true;
                        resolve();
                    }
                );
            });
        }
        
        // Vérifier et mettre à jour staff
        if (!updated && global.staffResetTokens) {
            const staffEntry = Object.entries(global.staffResetTokens)
                .find(([email, data]) => data.token === token && data.expires > Date.now());
            if (staffEntry) {
                const [email, data] = staffEntry;
                const staffAccount = DEMO_ACCOUNTS.staff.find(s => s.id === data.id);
                if (staffAccount) {
                    staffAccount.password = password;
                    delete global.staffResetTokens[email];
                    updated = true;
                }
            }
        }
        
        if (updated) {
            res.json({ success: true, message: 'Mot de passe réinitialisé avec succès' });
        } else {
            res.status(400).json({ error: 'Token invalide ou expiré' });
        }
        
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Démarrer le serveur HTTP
app.listen(PORT, '0.0.0.0', () => {
    const localIp = getLocalIpAddress();
    console.log('\n🚀 Serveur démarré avec succès!');
    console.log('💾 Base de données: SQLite (ecole.db)');
    console.log('\n🌐 Adresses disponibles:');
    console.log(`   - Local:   http://localhost:${PORT}`);
    console.log(`   - Réseau:  http://${localIp}:${PORT}`);
    console.log('\n📱 Pour accéder depuis votre iPhone:');
    console.log(`   Utilisez: http://${localIp}:${PORT}`);
    console.log('\n✅ Le serveur est maintenant accessible sur votre réseau local\n');
});

// Fermeture propre de la base de données
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Erreur lors de la fermeture de la base de données:', err);
        } else {
            console.log('\n✅ Base de données fermée proprement');
        }
        process.exit(0);
    });
});
