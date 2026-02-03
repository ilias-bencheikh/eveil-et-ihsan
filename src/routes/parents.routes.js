const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { checkPermission, requireAuth } = require('../middleware/auth');
const { generateToken, generateId, dbGet, dbRun, dbAll } = require('../utils/helpers');

// ==================== GESTION DES COMPTES PARENTS ====================

// Obtenir tous les parents
router.get('/', requireAuth, checkPermission('read'), async (req, res) => {
    try {
        const parents = await dbAll(db, `
            SELECT p.*, 
                   COUNT(DISTINCT CASE WHEN e.parent1Id = p.id THEN e.id END) +
                   COUNT(DISTINCT CASE WHEN e.parent2Id = p.id THEN e.id END) as nbEnfants
            FROM parents p
            LEFT JOIN eleves e ON e.parent1Id = p.id OR e.parent2Id = p.id
            GROUP BY p.id
            ORDER BY p.nom, p.prenom
        `);
        res.json(parents || []);
    } catch (error) {
        console.error('Erreur chargement parents:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== ROUTES SPECIFIQUES (avant les routes avec :id) ====================

// Obtenir mes enfants (pour le parent connecté)
router.get('/mes-enfants', requireAuth, async (req, res) => {
    try {
        // Vérifier que l'utilisateur est bien un parent
        if (req.userRole !== 'parent') {
            return res.status(403).json({ error: 'Accès réservé aux parents' });
        }
        
        const enfants = await dbAll(db, `
            SELECT e.id, e.nom, e.prenom, e.dateNaissance, e.classe, e.photo,
                   e.fraisInscription, e.nbPaiements, e.fraisValide, e.paiementsEffectues,
                   e.totalPaye, e.status, e.email
            FROM eleves e
            WHERE e.parent1Id = ? OR e.parent2Id = ?
            ORDER BY e.nom, e.prenom
        `, [req.userId, req.userId]);
        
        res.json(enfants || []);
    } catch (error) {
        console.error('Erreur chargement mes enfants:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtenir le profil du parent connecté
router.get('/profil', requireAuth, async (req, res) => {
    try {
        if (req.userRole !== 'parent') {
            return res.status(403).json({ error: 'Accès réservé aux parents' });
        }
        
        const parent = await dbGet(db, 'SELECT id, nom, prenom, email, tel, adresse FROM parents WHERE id = ?', [req.userId]);
        if (!parent) {
            return res.status(404).json({ error: 'Parent non trouvé' });
        }
        
        // Récupérer également les enfants
        const enfants = await dbAll(db, `
            SELECT e.id, e.nom, e.prenom, e.dateNaissance, e.classe, e.photo,
                   e.fraisInscription, e.nbPaiements, e.fraisValide, e.paiementsEffectues,
                   e.totalPaye, e.status
            FROM eleves e
            WHERE e.parent1Id = ? OR e.parent2Id = ?
            ORDER BY e.nom, e.prenom
        `, [req.userId, req.userId]);
        
        res.json({ parent, enfants: enfants || [] });
    } catch (error) {
        console.error('Erreur chargement profil parent:', error);
        res.status(500).json({ error: error.message });
    }
});

// Activer un compte parent (route publique)
router.post('/activate', async (req, res) => {
    const { token, password } = req.body;
    
    if (!token || !password) {
        return res.status(400).json({ error: 'Token et mot de passe requis' });
    }
    
    try {
        const parent = await dbGet(db, 
            'SELECT * FROM parents WHERE activationToken = ? AND activated = 0', 
            [token]
        );
        
        if (!parent) {
            return res.status(404).json({ error: 'Token invalide ou compte déjà activé' });
        }
        
        await dbRun(db, 
            'UPDATE parents SET password = ?, activated = 1, activationToken = NULL WHERE id = ?',
            [password, parent.id]
        );
        
        res.json({
            message: 'Compte parent activé avec succès! Vous pouvez maintenant vous connecter.',
            email: parent.email
        });
    } catch (error) {
        console.error('Erreur activation parent:', error);
        res.status(500).json({ error: error.message });
    }
});

// Vérifier un token d'activation
router.get('/check-token/:token', async (req, res) => {
    try {
        const parent = await dbGet(db, 
            'SELECT nom, prenom, email FROM parents WHERE activationToken = ? AND activated = 0', 
            [req.params.token]
        );
        
        if (!parent) {
            return res.status(404).json({ error: 'Token invalide ou compte déjà activé' });
        }
        
        res.json(parent);
    } catch (error) {
        console.error('Erreur vérification token:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rechercher des parents
router.get('/search/:query', requireAuth, async (req, res) => {
    const query = `%${req.params.query}%`;
    
    try {
        const parents = await dbAll(db, `
            SELECT * FROM parents 
            WHERE nom LIKE ? OR prenom LIKE ? OR email LIKE ?
            ORDER BY nom, prenom
            LIMIT 20
        `, [query, query, query]);
        
        res.json(parents || []);
    } catch (error) {
        console.error('Erreur recherche parents:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== ROUTES AVEC :id ====================

// Obtenir un parent par ID
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const parent = await dbGet(db, 'SELECT * FROM parents WHERE id = ?', [req.params.id]);
        if (!parent) {
            return res.status(404).json({ error: 'Parent non trouvé' });
        }
        
        // Récupérer les enfants de ce parent
        const enfants = await dbAll(db, `
            SELECT * FROM eleves 
            WHERE parent1Id = ? OR parent2Id = ?
            ORDER BY nom, prenom
        `, [req.params.id, req.params.id]);
        
        res.json({ parent, enfants: enfants || [] });
    } catch (error) {
        console.error('Erreur chargement parent:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtenir les enfants d'un parent
router.get('/:id/enfants', requireAuth, async (req, res) => {
    try {
        const enfants = await dbAll(db, `
            SELECT e.*, 
                   p1.nom as parent1Nom, p1.prenom as parent1Prenom,
                   p2.nom as parent2Nom, p2.prenom as parent2Prenom
            FROM eleves e
            LEFT JOIN parents p1 ON e.parent1Id = p1.id
            LEFT JOIN parents p2 ON e.parent2Id = p2.id
            WHERE e.parent1Id = ? OR e.parent2Id = ?
            ORDER BY e.nom, e.prenom
        `, [req.params.id, req.params.id]);
        
        res.json(enfants || []);
    } catch (error) {
        console.error('Erreur chargement enfants:', error);
        res.status(500).json({ error: error.message });
    }
});

// Créer un parent
router.post('/', checkPermission('create'), async (req, res) => {
    const { nom, prenom, email, tel, adresse } = req.body;
    
    if (!nom || !prenom) {
        return res.status(400).json({ error: 'Nom et prénom sont requis' });
    }
    
    try {
        // Vérifier si l'email existe déjà
        if (email) {
            const existing = await dbGet(db, 'SELECT id FROM parents WHERE email = ?', [email]);
            if (existing) {
                return res.status(400).json({ error: 'Cet email est déjà utilisé' });
            }
        }
        
        const id = generateId('PAR');
        const activationToken = email ? generateToken() : null;
        
        await dbRun(db, `
            INSERT INTO parents (id, nom, prenom, email, tel, adresse, activationToken, activated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, nom, prenom, email || null, tel || null, adresse || null, activationToken, email ? 0 : 1]);
        
        const activationLink = email ? `http://${req.headers.host}/activation.html?token=${activationToken}&type=parent` : null;
        
        res.status(201).json({
            id,
            nom,
            prenom,
            email,
            tel,
            adresse,
            activationLink,
            message: email ? 'Parent créé. Envoyez le lien d\'activation.' : 'Parent créé avec succès.'
        });
    } catch (error) {
        console.error('Erreur création parent:', error);
        res.status(500).json({ error: error.message });
    }
});

// Mettre à jour un parent
router.put('/:id', checkPermission('update'), async (req, res) => {
    const { nom, prenom, email, tel, adresse } = req.body;
    
    try {
        // Vérifier si l'email existe déjà pour un autre parent
        if (email) {
            const existing = await dbGet(db, 'SELECT id FROM parents WHERE email = ? AND id != ?', [email, req.params.id]);
            if (existing) {
                return res.status(400).json({ error: 'Cet email est déjà utilisé par un autre parent' });
            }
        }
        
        const result = await dbRun(db, `
            UPDATE parents SET nom = ?, prenom = ?, email = ?, tel = ?, adresse = ?
            WHERE id = ?
        `, [nom, prenom, email || null, tel || null, adresse || null, req.params.id]);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Parent non trouvé' });
        }
        
        res.json({ message: 'Parent mis à jour avec succès', id: req.params.id });
    } catch (error) {
        console.error('Erreur mise à jour parent:', error);
        res.status(500).json({ error: error.message });
    }
});

// Supprimer un parent
router.delete('/:id', checkPermission('delete'), async (req, res) => {
    try {
        // Vérifier si le parent a des enfants
        const enfants = await dbAll(db, `
            SELECT id FROM eleves WHERE parent1Id = ? OR parent2Id = ?
        `, [req.params.id, req.params.id]);
        
        if (enfants && enfants.length > 0) {
            // Ne pas supprimer, mais dissocier
            await dbRun(db, 'UPDATE eleves SET parent1Id = NULL WHERE parent1Id = ?', [req.params.id]);
            await dbRun(db, 'UPDATE eleves SET parent2Id = NULL WHERE parent2Id = ?', [req.params.id]);
        }
        
        const result = await dbRun(db, 'DELETE FROM parents WHERE id = ?', [req.params.id]);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Parent non trouvé' });
        }
        
        res.json({ message: 'Parent supprimé avec succès' });
    } catch (error) {
        console.error('Erreur suppression parent:', error);
        res.status(500).json({ error: error.message });
    }
});

// Lier un enfant à un parent
router.post('/:parentId/enfant/:eleveId', checkPermission('update'), async (req, res) => {
    const { parentId, eleveId } = req.params;
    const { position } = req.body; // 'parent1' ou 'parent2'
    
    try {
        const parent = await dbGet(db, 'SELECT id FROM parents WHERE id = ?', [parentId]);
        if (!parent) {
            return res.status(404).json({ error: 'Parent non trouvé' });
        }
        
        const eleve = await dbGet(db, 'SELECT * FROM eleves WHERE id = ?', [eleveId]);
        if (!eleve) {
            return res.status(404).json({ error: 'Élève non trouvé' });
        }
        
        const field = position === 'parent2' ? 'parent2Id' : 'parent1Id';
        
        await dbRun(db, `UPDATE eleves SET ${field} = ? WHERE id = ?`, [parentId, eleveId]);
        
        res.json({ message: `Parent lié à l'enfant en tant que ${position || 'parent1'}` });
    } catch (error) {
        console.error('Erreur liaison parent-enfant:', error);
        res.status(500).json({ error: error.message });
    }
});

// Délier un enfant d'un parent
router.delete('/:parentId/enfant/:eleveId', checkPermission('update'), async (req, res) => {
    const { parentId, eleveId } = req.params;
    
    try {
        const eleve = await dbGet(db, 'SELECT * FROM eleves WHERE id = ?', [eleveId]);
        if (!eleve) {
            return res.status(404).json({ error: 'Élève non trouvé' });
        }
        
        // Délier le parent de l'enfant (pour les deux positions possibles)
        if (eleve.parent1Id === parentId) {
            await dbRun(db, 'UPDATE eleves SET parent1Id = NULL WHERE id = ?', [eleveId]);
        }
        if (eleve.parent2Id === parentId) {
            await dbRun(db, 'UPDATE eleves SET parent2Id = NULL WHERE id = ?', [eleveId]);
        }
        
        res.json({ message: 'Parent délié de l\'enfant' });
    } catch (error) {
        console.error('Erreur déliaison parent-enfant:', error);
        res.status(500).json({ error: error.message });
    }
});

// Activer manuellement un compte parent (admin seulement)
router.put('/:id/activate', checkPermission('update'), async (req, res) => {
    try {
        const parent = await dbGet(db, 'SELECT * FROM parents WHERE id = ?', [req.params.id]);
        if (!parent) {
            return res.status(404).json({ error: 'Parent non trouvé' });
        }
        
        if (parent.activated) {
            return res.status(400).json({ error: 'Le compte est déjà activé' });
        }
        
        await dbRun(db, 
            'UPDATE parents SET activated = 1, activationToken = NULL WHERE id = ?',
            [req.params.id]
        );
        
        res.json({ message: 'Compte parent activé avec succès' });
    } catch (error) {
        console.error('Erreur activation parent:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
