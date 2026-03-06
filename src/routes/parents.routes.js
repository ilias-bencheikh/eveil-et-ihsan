const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { checkPermission, requireAuth } = require('../middleware/auth');
const { generateToken, generateId, dbGet, dbRun, dbAll, isValidEmail } = require('../utils/helpers');
const { sendEmail } = require('../config/email');
const { hashPassword } = require('../utils/password');
const { validatePassword, activationLimiter } = require('../middleware/security');

// ====================================================================
//  ROUTES SPÉCIFIQUES (AVANT /:id pour éviter les conflits de routing)
// ====================================================================

// ================== PROFIL PARENT (connecté) ==================

// Obtenir le profil du parent connecté
router.get('/profil/me', requireAuth, async (req, res) => {
    if (req.userRole !== 'parent') {
        return res.status(403).json({ error: 'Accès réservé aux parents' });
    }
    
    try {
        const parent = await dbGet(db, 'SELECT id, nom, prenom, email, tel, adresse, profession FROM parents WHERE id = ?', [req.userId]);
        
        if (!parent) {
            return res.status(404).json({ error: 'Parent non trouvé' });
        }
        
        // Récupérer les enfants
        const enfants = await dbAll(db, `
            SELECT e.id, e.nom, e.prenom, e.dateNaissance, e.classe, e.photo, e.status, 
                   e.fraisInscription, e.nbPaiements, e.fraisValide, e.paiementsEffectues, e.montantPaye,
                   ep.relation, ep.isPrimary
            FROM eleves e
            INNER JOIN eleve_parent ep ON e.id = ep.eleveId
            WHERE ep.parentId = ?
        `, [req.userId]);
        
        res.json({ ...parent, enfants });
    } catch (err) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Mettre à jour le profil du parent connecté
router.put('/profil/me', requireAuth, async (req, res) => {
    if (req.userRole !== 'parent') {
        return res.status(403).json({ error: 'Accès réservé aux parents' });
    }
    
    const { tel, adresse } = req.body;
    
    try {
        await dbRun(db, 'UPDATE parents SET tel = ?, adresse = ? WHERE id = ?', [tel || null, adresse || null, req.userId]);
        
        const parent = await dbGet(db, 'SELECT id, nom, prenom, email, tel, adresse, profession FROM parents WHERE id = ?', [req.userId]);
        res.json({ message: 'Profil mis à jour', parent });
    } catch (err) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Obtenir les enfants du parent connecté
router.get('/enfants', requireAuth, async (req, res) => {
    if (req.userRole !== 'parent') {
        return res.status(403).json({ error: 'Accès réservé aux parents' });
    }
    
    try {
        const enfants = await dbAll(db, `
            SELECT e.*, ep.relation, ep.isPrimary
            FROM eleves e
            INNER JOIN eleve_parent ep ON e.id = ep.eleveId
            WHERE ep.parentId = ?
        `, [req.userId]);
        
        res.json(enfants);
    } catch (err) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// ================== ADMIN UTILITAIRES ==================

// Récupérer tous les parents (avec enfants) - accessible uniquement aux admins
router.get('/all', requireAuth, async (req, res) => {
    if (req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }
    try {
        const rows = await dbAll(db, `
            SELECT p.id, p.nom, p.prenom, p.email, p.tel, p.adresse, p.profession, p.activated,
                   e.id AS eleveId, e.nom AS eleveNom, e.prenom AS elevePrenom, e.classe AS eleveClasse
            FROM parents p
            LEFT JOIN eleve_parent ep ON ep.parentId = p.id
            LEFT JOIN eleves e ON e.id = ep.eleveId
            ORDER BY p.nom, p.prenom
        `);
        const parents = {};
        rows.forEach(r => {
            if (!parents[r.id]) {
                parents[r.id] = { id: r.id, nom: r.nom, prenom: r.prenom, email: r.email, tel: r.tel, adresse: r.adresse, profession: r.profession, activated: r.activated, enfants: [] };
            }
            if (r.eleveId) {
                parents[r.id].enfants.push({ id: r.eleveId, nom: r.eleveNom, prenom: r.elevePrenom, classe: r.eleveClasse });
            }
        });
        res.json(Object.values(parents));
    } catch (err) {
        console.error('Erreur récupération parents admin:', err);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Mettre à jour un parent par l'administrateur
router.put('/:id', requireAuth, async (req, res) => {
    if (req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }
    const { id } = req.params;
    const { nom, prenom, email, tel, adresse, profession } = req.body;
    try {
        await dbRun(db, 'UPDATE parents SET nom = ?, prenom = ?, email = ?, tel = ?, adresse = ?, profession = ? WHERE id = ?', [nom || null, prenom || null, email || null, tel || null, adresse || null, profession || null, id]);
        const parent = await dbGet(db, 'SELECT id, nom, prenom, email, tel, adresse, profession, activated FROM parents WHERE id = ?', [id]);
        if (!parent) return res.status(404).json({ error: 'Parent non trouvé' });
        res.json({ message: 'Parent mis à jour', parent });
    } catch (err) {
        console.error('Erreur mise à jour parent admin:', err);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Supprimer un parent (et éventuellement liaisons) par l'administrateur
router.delete('/:id', requireAuth, async (req, res) => {
    if (req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }
    const { id } = req.params;
    try {
        // Supprimer liaisons
        await dbRun(db, 'DELETE FROM eleve_parent WHERE parentId = ?', [id]);
        // Supprimer sessions
        await dbRun(db, 'DELETE FROM sessions WHERE userId = ?', [id]).catch(() => {});
        // Supprimer le parent
        await dbRun(db, 'DELETE FROM parents WHERE id = ?', [id]);
        res.json({ message: 'Parent supprimé' });
    } catch (err) {
        console.error('Erreur suppression parent admin:', err);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// ================== ACTIVATION PARENT ==================

// Vérifier un token d'activation parent
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
    } catch (err) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Activer un compte parent (avec hashage bcrypt et rate limiting)
router.post('/activate', activationLimiter, async (req, res) => {
    const { token, password } = req.body;
    
    if (!token || !password) {
        return res.status(400).json({ error: 'Token et mot de passe requis' });
    }
    
    // Validation du mot de passe avec règles de complexité
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
        return res.status(400).json({ error: passwordCheck.message });
    }
    
    try {
        const parent = await dbGet(db, 'SELECT * FROM parents WHERE activationToken = ? AND activated = 0', [token]);
        
        if (!parent) {
            return res.status(404).json({ error: 'Token invalide ou compte déjà activé' });
        }
        
        // Hasher le mot de passe avec bcrypt
        const hashedPassword = await hashPassword(password);
        
        await dbRun(db, 
            'UPDATE parents SET password = ?, activated = 1, activationToken = NULL WHERE id = ?',
            [hashedPassword, parent.id]
        );
        
        res.json({ 
            message: 'Compte activé avec succès! Vous pouvez maintenant vous connecter.',
            email: parent.email
        });
    } catch (err) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// ================== INSCRIPTION PARENT (publique) ==================

// Inscription d'enfants avec 0, 1 ou 2 parents
router.post('/inscription', async (req, res) => {
    const { 
        parent1, // { nom, prenom, email, tel, adresse, profession } - optionnel
        parent2, // { nom, prenom, email, tel, adresse, profession } - optionnel
        enfants, // [{ nom, prenom, dateNaissance, classe, fraisInscription, nbPaiements, email, anneeScolaire }]
        anneeScolaire // année scolaire globale (ex: "2026-2027")
    } = req.body;
    
    // parent1 peut être null/vide (0 parent)
    const hasParent1 = parent1 && parent1.email && parent1.nom && parent1.prenom;
    const hasParent2 = parent2 && parent2.email && parent2.nom && parent2.prenom;
    
    if (!enfants || enfants.length === 0) {
        return res.status(400).json({ error: 'Au moins un enfant requis' });
    }
    
    // Si aucun parent, chaque enfant doit avoir un email pour créer son propre compte
    if (!hasParent1 && !hasParent2) {
        for (let i = 0; i < enfants.length; i++) {
            if (!enfants[i].email || !enfants[i].email.trim()) {
                return res.status(400).json({ error: `L'email est obligatoire pour l'élève ${enfants[i].prenom || (i+1)} car aucun parent n'est renseigné` });
            }
        }
    }
    
    try {
        // Vérifier que les emails des parents ne sont pas déjà utilisés
        const parentsToCheck = [parent1, parent2].filter(p => p && p.email && p.nom && p.prenom);
        for (const parentData of parentsToCheck) {
            const existingParent = await dbGet(db, 'SELECT id FROM parents WHERE email = ?', [parentData.email]);
            if (existingParent) {
                return res.status(400).json({ error: `L'email ${parentData.email} est déjà utilisé par un parent` });
            }
            
            const existingEleve = await dbGet(db, 'SELECT id FROM eleves WHERE email = ?', [parentData.email]);
            if (existingEleve) {
                return res.status(400).json({ error: `L'email ${parentData.email} est déjà utilisé` });
            }
            
            const existingProf = await dbGet(db, 'SELECT id FROM professeurs WHERE email = ?', [parentData.email]);
            if (existingProf) {
                return res.status(400).json({ error: `L'email ${parentData.email} est déjà utilisé` });
            }
            
            const existingStaff = await dbGet(db, 'SELECT id FROM staff WHERE email = ?', [parentData.email]);
            if (existingStaff) {
                return res.status(400).json({ error: `L'email ${parentData.email} est déjà utilisé` });
            }
        }
        
        // Vérifier les emails des enfants (surtout si 0 parent)
        for (const enfant of enfants) {
            if (enfant.email && enfant.email.trim()) {
                const emailToCheck = enfant.email.trim();
                const existingEleve = await dbGet(db, 'SELECT id FROM eleves WHERE email = ?', [emailToCheck]);
                if (existingEleve) return res.status(400).json({ error: `L'email ${emailToCheck} est déjà utilisé par un élève` });
                const existingParent = await dbGet(db, 'SELECT id FROM parents WHERE email = ?', [emailToCheck]);
                if (existingParent) return res.status(400).json({ error: `L'email ${emailToCheck} est déjà utilisé` });
                const existingProf = await dbGet(db, 'SELECT id FROM professeurs WHERE email = ?', [emailToCheck]);
                if (existingProf) return res.status(400).json({ error: `L'email ${emailToCheck} est déjà utilisé` });
                const existingStaff = await dbGet(db, 'SELECT id FROM staff WHERE email = ?', [emailToCheck]);
                if (existingStaff) return res.status(400).json({ error: `L'email ${emailToCheck} est déjà utilisé` });
            }
        }
        
        // Vérifier que parent1 et parent2 n'ont pas le même email
        if (hasParent1 && hasParent2 && parent1.email === parent2.email) {
            return res.status(400).json({ error: 'Les deux parents doivent avoir des emails différents' });
        }
        
        const createdParents = [];
        const createdEnfants = [];
        
        // Créer le premier parent si fourni
        let parent1Id = null;
        if (hasParent1) {
            parent1Id = generateId('parent');
            const activationToken1 = generateToken();
            await dbRun(db, `
                INSERT INTO parents (id, nom, prenom, email, tel, adresse, profession, activationToken, activated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
            `, [parent1Id, parent1.nom, parent1.prenom, parent1.email, parent1.tel || null, parent1.adresse || null, parent1.profession || null, activationToken1]);
            createdParents.push({ id: parent1Id, ...parent1, isPrimary: true, activationToken: activationToken1 });
        }
        
        // Créer le second parent si fourni
        let parent2Id = null;
        if (hasParent2) {
            parent2Id = generateId('parent');
            const activationToken2 = generateToken();
            await dbRun(db, `
                INSERT INTO parents (id, nom, prenom, email, tel, adresse, profession, activationToken, activated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
            `, [parent2Id, parent2.nom, parent2.prenom, parent2.email, parent2.tel || null, parent2.adresse || null, parent2.profession || null, activationToken2]);
            createdParents.push({ id: parent2Id, ...parent2, isPrimary: false, activationToken: activationToken2 });
        }
        
        // Générer un ID de famille si plusieurs enfants
        const familleLienId = enfants.length > 1 ? `FAM_${Date.now()}` : null;
        
        // Créer les enfants et les liaisons
        for (const enfant of enfants) {
            const eleveId = generateId('eleve');
            const frais = parseFloat(enfant.fraisInscription || 0) || 0;
            const nbPaiements = parseInt(enfant.nbPaiements || 1, 10) || 1;
            
            // Email de l'élève (obligatoire si 0 parent, optionnel sinon)
            let eleveEmail = null;
            let eleveActivationToken = null;
            if (enfant.email && enfant.email.trim()) {
                eleveEmail = enfant.email.trim();
                eleveActivationToken = generateToken();
            }
            
            await dbRun(db, `
                INSERT INTO eleves (id, nom, prenom, dateNaissance, classe, email, password, activationToken, activated, enFamille, nombreFamille, familleLienId, fraisInscription, nbPaiements, fraisValide, paiementsEffectues, anneeScolaire, adresse)
                VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 0, ?, ?, ?, ?, ?, 0, 0, ?, ?)
            `, [eleveId, enfant.nom, enfant.prenom, enfant.dateNaissance || null, enfant.classe || null, eleveEmail, eleveActivationToken, enfants.length > 1 ? 1 : 0, enfants.length, familleLienId, frais, nbPaiements, enfant.anneeScolaire || anneeScolaire || null, enfant.adresse || null]);
            
            createdEnfants.push({ id: eleveId, nom: enfant.nom, prenom: enfant.prenom, email: eleveEmail, activationToken: eleveActivationToken });
            
            // Lier l'enfant au premier parent si présent
            if (parent1Id) {
                await dbRun(db, `
                    INSERT INTO eleve_parent (id, eleveId, parentId, relation, isPrimary)
                    VALUES (?, ?, ?, 'parent', 1)
                `, [generateId('ep'), eleveId, parent1Id]);
            }
            
            // Lier l'enfant au second parent si présent
            if (parent2Id) {
                await dbRun(db, `
                    INSERT INTO eleve_parent (id, eleveId, parentId, relation, isPrimary)
                    VALUES (?, ?, ?, 'parent', 0)
                `, [generateId('ep'), eleveId, parent2Id]);
            }
        }
        
        // ---- Envoi automatique des emails d'activation ----
        const host = req.headers.host;
        // Emails aux parents créés
        for (const parent of createdParents) {
            if (parent.activationToken && parent.email) {
                const activationLink = `http://${host}/activation.html?token=${parent.activationToken}&type=parent`;
                sendEmail(parent.email, 'activation', `${parent.prenom} ${parent.nom}`, activationLink)
                    .catch(e => console.error(`Erreur email parent ${parent.email}:`, e));
            }
        }
        // Emails aux enfants qui ont un compte
        for (const enfant of createdEnfants) {
            if (enfant.activationToken && enfant.email) {
                const activationLink = `http://${host}/activation.html?token=${enfant.activationToken}`;
                sendEmail(enfant.email, 'activation', `${enfant.prenom} ${enfant.nom}`, activationLink)
                    .catch(e => console.error(`Erreur email enfant ${enfant.email}:`, e));
            }
        }

        res.status(201).json({
            success: true,
            message: `Inscription réussie. ${createdParents.length} parent(s) et ${createdEnfants.length} enfant(s) créé(s). Les emails d'activation ont été envoyés.`,
            parents: createdParents.map(p => ({ id: p.id, nom: p.nom, prenom: p.prenom, email: p.email })),
            enfants: createdEnfants.map(e => ({ id: e.id, nom: e.nom, prenom: e.prenom, email: e.email }))
        });
        
    } catch (err) {
        console.error('Erreur inscription parent:', err);
        res.status(500).json({ error: 'Erreur lors de l\'inscription' });
    }
});

// Ajouter des enfants à une famille existante
router.post('/inscription/famille-existante', checkPermission('update'), async (req, res) => {
    const { parentId, enfants } = req.body;

    if (!parentId) {
        return res.status(400).json({ error: 'Parent ID requis' });
    }
    if (!enfants || enfants.length === 0) {
        return res.status(400).json({ error: 'Au moins un enfant requis' });
    }

    try {
        // Vérifier que le parent existe
        const parent = await dbGet(db, 'SELECT id, nom, prenom, email FROM parents WHERE id = ?', [parentId]);
        if (!parent) {
            return res.status(404).json({ error: 'Parent non trouvé' });
        }

        // Récupérer les enfants existants de ce parent pour le familleLienId
        const existingChildren = await dbAll(db, `
            SELECT e.id, e.familleLienId FROM eleves e
            INNER JOIN eleve_parent ep ON e.id = ep.eleveId
            WHERE ep.parentId = ?
        `, [parentId]);

        // Déterminer le familleLienId existant ou en créer un nouveau
        let familleLienId = existingChildren.find(c => c.familleLienId)?.familleLienId || `FAM_${Date.now()}`;
        const totalChildren = existingChildren.length + enfants.length;

        // Vérifier les emails des nouveaux enfants
        for (const enfant of enfants) {
            if (enfant.email && enfant.email.trim()) {
                const emailToCheck = enfant.email.trim();
                const existingEleve = await dbGet(db, 'SELECT id FROM eleves WHERE email = ?', [emailToCheck]);
                if (existingEleve) return res.status(400).json({ error: `L'email ${emailToCheck} est déjà utilisé par un élève` });
                const existingParent = await dbGet(db, 'SELECT id FROM parents WHERE email = ?', [emailToCheck]);
                if (existingParent) return res.status(400).json({ error: `L'email ${emailToCheck} est déjà utilisé` });
            }
        }

        // Récupérer tous les parents liés à ces enfants pour les lier aussi aux nouveaux
        const parentIds = await dbAll(db, `
            SELECT DISTINCT parentId FROM eleve_parent WHERE eleveId IN (${existingChildren.map(() => '?').join(',')})
        `, existingChildren.map(c => c.id));

        const createdEnfants = [];

        for (const enfant of enfants) {
            const eleveId = generateId('eleve');
            const frais = parseFloat(enfant.fraisInscription || 0) || 0;
            const nbPaiements = parseInt(enfant.nbPaiements || 1, 10) || 1;

            let eleveEmail = null;
            let eleveActivationToken = null;
            if (enfant.email && enfant.email.trim()) {
                eleveEmail = enfant.email.trim();
                eleveActivationToken = generateToken();
            }

            await dbRun(db, `
                INSERT INTO eleves (id, nom, prenom, dateNaissance, classe, email, password, activationToken, activated, enFamille, nombreFamille, familleLienId, fraisInscription, nbPaiements, fraisValide, paiementsEffectues, anneeScolaire)
                VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 0, 1, ?, ?, ?, ?, 0, 0, ?)
            `, [eleveId, enfant.nom, enfant.prenom, enfant.dateNaissance || null, enfant.classe || null, eleveEmail, eleveActivationToken, totalChildren, familleLienId, frais, nbPaiements, enfant.anneeScolaire || null]);

            createdEnfants.push({ id: eleveId, nom: enfant.nom, prenom: enfant.prenom, email: eleveEmail });

            // Lier le nouvel enfant à tous les parents existants de la famille
            for (const p of parentIds) {
                const isPrimary = p.parentId === parentId ? 1 : 0;
                await dbRun(db, `
                    INSERT INTO eleve_parent (id, eleveId, parentId, relation, isPrimary)
                    VALUES (?, ?, ?, 'parent', ?)
                `, [generateId('ep'), eleveId, p.parentId, isPrimary]);
            }
            // Si le parent sélectionné n'était pas dans la liste (pas d'enfants existants), le lier directement
            if (existingChildren.length === 0) {
                await dbRun(db, `
                    INSERT INTO eleve_parent (id, eleveId, parentId, relation, isPrimary)
                    VALUES (?, ?, ?, 'parent', 1)
                `, [generateId('ep'), eleveId, parentId]);
            }
        }

        // Mettre à jour enFamille et nombreFamille pour les enfants existants
        for (const child of existingChildren) {
            await dbRun(db, `
                UPDATE eleves SET enFamille = 1, nombreFamille = ?, familleLienId = ? WHERE id = ?
            `, [totalChildren, familleLienId, child.id]);
        }

        res.status(201).json({
            success: true,
            message: `${createdEnfants.length} enfant(s) ajouté(s) à la famille de ${parent.prenom} ${parent.nom}.`,
            enfants: createdEnfants
        });

    } catch (err) {
        console.error('Erreur ajout famille existante:', err);
        res.status(500).json({ error: 'Erreur lors de l\'ajout à la famille existante' });
    }
});

// ================== LIAISONS ÉLÈVE-PARENT ==================

// Lier un élève à un parent
router.post('/link', checkPermission('update'), async (req, res) => {
    const { eleveId, parentId, relation, isPrimary } = req.body;
    
    if (!eleveId || !parentId) {
        return res.status(400).json({ error: 'eleveId et parentId requis' });
    }
    
    try {
        // Vérifier que l'élève existe
        const eleve = await dbGet(db, 'SELECT id, status FROM eleves WHERE id = ?', [eleveId]);
        if (!eleve) {
            return res.status(404).json({ error: 'Élève non trouvé' });
        }
        
        // Vérifier que le parent existe
        const parent = await dbGet(db, 'SELECT id FROM parents WHERE id = ?', [parentId]);
        if (!parent) {
            return res.status(404).json({ error: 'Parent non trouvé' });
        }
        
        // Vérifier que l'élève n'a pas déjà 2 parents
        const existingLinks = await dbAll(db, 'SELECT id FROM eleve_parent WHERE eleveId = ?', [eleveId]);
        if (existingLinks.length >= 2) {
            return res.status(400).json({ error: 'Cet élève a déjà 2 parents liés. Supprimez une liaison d\'abord.' });
        }
        
        // Vérifier que ce lien n'existe pas déjà
        const existingLink = await dbGet(db, 'SELECT id FROM eleve_parent WHERE eleveId = ? AND parentId = ?', [eleveId, parentId]);
        if (existingLink) {
            return res.status(400).json({ error: 'Ce parent est déjà lié à cet élève' });
        }
        
        const id = generateId('ep');
        await dbRun(db, `
            INSERT INTO eleve_parent (id, eleveId, parentId, relation, isPrimary)
            VALUES (?, ?, ?, ?, ?)
        `, [id, eleveId, parentId, relation || 'parent', isPrimary ? 1 : 0]);
        
        // Note: L'élève garde son propre compte même s'il a des parents
        
        res.status(201).json({ id, eleveId, parentId, relation, isPrimary, message: 'Liaison créée' });
    } catch (err) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Supprimer une liaison élève-parent
router.delete('/link/:linkId', checkPermission('delete'), async (req, res) => {
    const { linkId } = req.params;
    
    try {
        // Récupérer le parentId avant suppression du lien
        const link = await dbGet(db, 'SELECT parentId FROM eleve_parent WHERE id = ?', [linkId]);
        if (!link) {
            return res.status(404).json({ error: 'Liaison non trouvée' });
        }

        await dbRun(db, 'DELETE FROM eleve_parent WHERE id = ?', [linkId]);

        // Vérifier si le parent a encore des enfants
        let parentDeleted = false;
        const remaining = await dbGet(db, 'SELECT COUNT(*) as count FROM eleve_parent WHERE parentId = ?', [link.parentId]);
        if (remaining && remaining.count === 0) {
            // Supprimer les sessions du parent
            await dbRun(db, 'DELETE FROM sessions WHERE userId = ?', [link.parentId]).catch(() => {});
            // Supprimer le compte parent orphelin
            await dbRun(db, 'DELETE FROM parents WHERE id = ?', [link.parentId]);
            parentDeleted = true;
            console.log(`Parent orphelin supprimé automatiquement: ${link.parentId}`);
        }
        
        res.json({ 
            message: parentDeleted 
                ? 'Liaison supprimée et compte parent supprimé (plus aucun enfant lié)' 
                : 'Liaison supprimée',
            parentDeleted
        });
    } catch (err) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Obtenir les parents d'un élève
router.get('/eleve/:eleveId', requireAuth, async (req, res) => {
    const { eleveId } = req.params;
    
    try {
        const parents = await dbAll(db, `
            SELECT p.id, p.nom, p.prenom, p.email, p.tel, p.adresse, p.profession, ep.relation, ep.isPrimary, ep.id as linkId
            FROM parents p
            INNER JOIN eleve_parent ep ON p.id = ep.parentId
            WHERE ep.eleveId = ?
        `, [eleveId]);
        
        res.json(parents);
    } catch (err) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// ====================================================================
//  ROUTES ADMIN (avec paramètre :id)
// ====================================================================

// Recherche de familles par nom/prénom de parent ou d'enfant
router.get('/search-familles', requireAuth, async (req, res) => {
    const userRole = req.userRole;
    if (!['admin', 'secretaire', 'secretariat', 'directeur'].includes(userRole)) {
        return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const q = (req.query.q || '').trim().toLowerCase();
    if (q.length < 2) {
        return res.json([]);
    }

    try {
        // Rechercher les parents dont nom/prénom/email matchent OU qui ont un enfant qui matche
        const parents = await dbAll(db, `
            SELECT DISTINCT p.id, p.nom, p.prenom, p.email, p.tel, p.activated
            FROM parents p
            LEFT JOIN eleve_parent ep ON p.id = ep.parentId
            LEFT JOIN eleves e ON ep.eleveId = e.id
            WHERE LOWER(p.nom) LIKE ? OR LOWER(p.prenom) LIKE ? OR LOWER(p.email) LIKE ?
               OR LOWER(e.nom) LIKE ? OR LOWER(e.prenom) LIKE ?
        `, [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`]);

        // Pour chaque parent, récupérer ses enfants
        for (const parent of parents) {
            parent.enfants = await dbAll(db, `
                SELECT e.id, e.nom, e.prenom, e.classe, e.fraisInscription, e.montantPaye, e.fraisValide
                FROM eleves e
                INNER JOIN eleve_parent ep ON e.id = ep.eleveId
                WHERE ep.parentId = ?
            `, [parent.id]);
            parent.nbEnfants = parent.enfants.length;
        }

        res.json(parents);
    } catch (err) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Obtenir tous les parents
router.get('/', requireAuth, async (req, res) => {
    const userRole = req.userRole;
    
    if (!['admin', 'secretaire', 'secretariat', 'directeur'].includes(userRole)) {
        return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    try {
        const parents = await dbAll(db, 'SELECT id, nom, prenom, email, tel, adresse, profession, activated, createdAt FROM parents', []);
        
        // Pour chaque parent, récupérer le nombre d'enfants
        for (const parent of parents) {
            const enfants = await dbAll(db, `
                SELECT e.id, e.nom, e.prenom, e.classe
                FROM eleves e
                INNER JOIN eleve_parent ep ON e.id = ep.eleveId
                WHERE ep.parentId = ?
            `, [parent.id]);
            parent.enfants = enfants;
            parent.nbEnfants = enfants.length;
        }
        
        res.json(parents);
    } catch (err) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Obtenir un parent par ID avec ses enfants
router.get('/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    
    try {
        const parent = await dbGet(db, 'SELECT id, nom, prenom, email, tel, adresse, profession, activated FROM parents WHERE id = ?', [id]);
        
        if (!parent) {
            return res.status(404).json({ error: 'Parent non trouvé' });
        }
        
        // Récupérer les enfants liés à ce parent
        const enfants = await dbAll(db, `
            SELECT e.id, e.nom, e.prenom, e.dateNaissance, e.classe, e.photo, e.status, ep.relation, ep.isPrimary, ep.id as linkId
            FROM eleves e
            INNER JOIN eleve_parent ep ON e.id = ep.eleveId
            WHERE ep.parentId = ?
        `, [id]);
        
        res.json({ ...parent, enfants });
    } catch (err) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Créer un parent (admin/secretariat)
router.post('/', checkPermission('create'), async (req, res) => {
    const { nom, prenom, email, tel, adresse, profession } = req.body;
    
    if (!nom || !prenom || !email) {
        return res.status(400).json({ error: 'Nom, prénom et email requis' });
    }
    
    try {
        // Vérifier que l'email n'est pas déjà utilisé
        const existingParent = await dbGet(db, 'SELECT id FROM parents WHERE email = ?', [email]);
        if (existingParent) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé par un parent' });
        }
        
        const existingEleve = await dbGet(db, 'SELECT id FROM eleves WHERE email = ?', [email]);
        if (existingEleve) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé par un élève' });
        }
        
        const existingProf = await dbGet(db, 'SELECT id FROM professeurs WHERE email = ?', [email]);
        if (existingProf) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé par un professeur' });
        }
        
        const existingStaff = await dbGet(db, 'SELECT id FROM staff WHERE email = ?', [email]);
        if (existingStaff) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé par un membre du personnel' });
        }
        
        const id = generateId('parent');
        const activationToken = generateToken();
        
        await dbRun(db, `
            INSERT INTO parents (id, nom, prenom, email, tel, adresse, profession, activationToken, activated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
        `, [id, nom, prenom, email, tel || null, adresse || null, profession || null, activationToken]);
        
        const activationLink = `http://${req.headers.host}/activation.html?token=${activationToken}&type=parent`;
        
        res.status(201).json({
            id, nom, prenom, email, tel, adresse, profession,
            activationLink,
            message: 'Parent créé. Envoyez le lien d\'activation au parent.'
        });
    } catch (err) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Mettre à jour un parent
router.put('/:id', checkPermission('update'), async (req, res) => {
    const { id } = req.params;
    const { nom, prenom, email, tel, adresse, profession } = req.body;
    
    try {
        // Vérifier que le parent existe
        const existingParentById = await dbGet(db, 'SELECT id FROM parents WHERE id = ?', [id]);
        if (!existingParentById) {
            return res.status(404).json({ error: 'Parent non trouvé' });
        }
        
        // Vérifier que l'email n'est pas déjà utilisé par un autre
        if (email) {
            const existingParent = await dbGet(db, 'SELECT id FROM parents WHERE email = ? AND id != ?', [email, id]);
            if (existingParent) {
                return res.status(400).json({ error: 'Cet email est déjà utilisé par un autre parent' });
            }
            
            const existingEleve = await dbGet(db, 'SELECT id FROM eleves WHERE email = ?', [email]);
            if (existingEleve) {
                return res.status(400).json({ error: 'Cet email est déjà utilisé par un élève' });
            }
            
            const existingProf = await dbGet(db, 'SELECT id FROM professeurs WHERE email = ?', [email]);
            if (existingProf) {
                return res.status(400).json({ error: 'Cet email est déjà utilisé par un professeur' });
            }
            
            const existingStaff = await dbGet(db, 'SELECT id FROM staff WHERE email = ?', [email]);
            if (existingStaff) {
                return res.status(400).json({ error: 'Cet email est déjà utilisé par un membre du personnel' });
            }
        }
        
        await dbRun(db, `
            UPDATE parents SET nom = ?, prenom = ?, email = ?, tel = ?, adresse = ?, profession = ?
            WHERE id = ?
        `, [nom, prenom, email, tel || null, adresse || null, profession || null, id]);
        
        res.json({ id, nom, prenom, email, tel, adresse, profession });
    } catch (err) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Supprimer un parent
router.delete('/:id', checkPermission('delete'), async (req, res) => {
    const { id } = req.params;
    
    try {
        // Vérifier que le parent existe
        const parent = await dbGet(db, 'SELECT id FROM parents WHERE id = ?', [id]);
        if (!parent) {
            return res.status(404).json({ error: 'Parent non trouvé' });
        }
        
        // Supprimer les liaisons élève-parent
        await dbRun(db, 'DELETE FROM eleve_parent WHERE parentId = ?', [id]);
        
        // Supprimer le parent
        await dbRun(db, 'DELETE FROM parents WHERE id = ?', [id]);
        
        res.json({ message: 'Parent supprimé' });
    } catch (err) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Envoyer le lien d'activation à un parent
router.post('/:id/send-activation', checkPermission('update'), async (req, res) => {
    const { id } = req.params;
    
    try {
        const parent = await dbGet(db, 'SELECT * FROM parents WHERE id = ?', [id]);
        
        if (!parent) {
            return res.status(404).json({ error: 'Parent non trouvé' });
        }
        
        if (parent.activated) {
            return res.status(400).json({ error: 'Ce compte est déjà activé' });
        }
        
        // Générer un nouveau token si nécessaire
        let token = parent.activationToken;
        if (!token) {
            token = generateToken();
            await dbRun(db, 'UPDATE parents SET activationToken = ? WHERE id = ?', [token, id]);
        }
        
        const activationLink = `http://${req.headers.host}/activation.html?token=${token}&type=parent`;
        
        try {
            await sendEmail(parent.email, 'activation', `${parent.prenom} ${parent.nom}`, activationLink);
            res.json({ message: 'Email d\'activation envoyé', activationLink });
        } catch (emailError) {
            console.error('Erreur envoi email:', emailError);
            res.json({ message: 'Erreur envoi email, mais voici le lien:', activationLink });
        }
        
    } catch (err) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

module.exports = router;
