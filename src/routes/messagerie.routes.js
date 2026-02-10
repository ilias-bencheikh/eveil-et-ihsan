const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { generateId, formatDate } = require('../utils/helpers');

// Helper promisifié
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
});

// Obtenir les destinataires possibles selon les droits de l'utilisateur
router.get('/destinataires', async (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    try {
        if (userRole === 'eleve') {
            // Élèves peuvent envoyer à leurs professeurs et au secrétariat
            const profs = await dbAll(`
                SELECT id, nom, prenom FROM professeurs
                UNION
                SELECT id, nom, prenom FROM staff WHERE lower(role) = 'professeur'
            `);
            const staffs = await dbAll('SELECT id, nom, prenom, role FROM staff WHERE lower(role) = ?', ['secretariat']);

            res.json([
                ...profs.map(p => ({ id: p.id, nom: `${p.prenom} ${p.nom}`, role: 'Professeur', type: 'user' })),
                ...staffs.map(s => ({ id: s.id, nom: `${s.prenom} ${s.nom}`.trim(), role: 'Secrétariat', type: 'user' }))
            ]);

        } else if (userRole === 'parent') {
            // Parents peuvent envoyer aux profs de leurs enfants + tout le staff du bureau
            const enfants = await dbAll(`
                SELECT e.id, e.nom, e.prenom, e.classe FROM eleves e
                INNER JOIN eleve_parent ep ON e.id = ep.eleveId
                WHERE ep.parentId = ?
            `, [userId]);

            const classeNames = [...new Set(enfants.map(e => e.classe).filter(Boolean))];

            // Professeurs des classes de leurs enfants
            let profs = [];
            if (classeNames.length > 0) {
                const placeholders = classeNames.map(() => '?').join(',');
                profs = await dbAll(`
                    SELECT DISTINCT p.id, p.nom, p.prenom FROM professeurs p
                    INNER JOIN classes c ON c.professeurId = p.id
                    WHERE c.nom IN (${placeholders})
                `, classeNames);
            }

            // Tout le staff (directeur, secretariat, admin)
            const staffs = await dbAll('SELECT id, nom, prenom, role FROM staff');

            res.json([
                ...profs.map(p => ({ id: p.id, nom: `${p.prenom} ${p.nom}`, role: 'Professeur', type: 'user' })),
                ...staffs.map(s => ({ id: s.id, nom: `${s.prenom} ${s.nom}`.trim(), role: s.role, type: 'user' }))
            ]);

        } else if (userRole === 'professeur') {
            // Professeurs peuvent envoyer à élèves de leurs classes, autres profs, staff, classes, ET parents de leurs élèves
            const eleves = await dbAll(`
                SELECT DISTINCT e.id, e.nom, e.prenom FROM eleves e
                INNER JOIN classes c ON e.classe = c.nom
                WHERE c.professeurId = ?
            `, [userId]);

            const profs = await dbAll('SELECT id, nom, prenom FROM professeurs WHERE id != ?', [userId]);
            const staffs = await dbAll('SELECT id, nom, role FROM staff');
            const classes = await dbAll('SELECT nom FROM classes');

            // Parents des élèves de ses classes
            const parents = await dbAll(`
                SELECT DISTINCT pa.id, pa.nom, pa.prenom, e.prenom as enfantPrenom, e.nom as enfantNom
                FROM parents pa
                INNER JOIN eleve_parent ep ON pa.id = ep.parentId
                INNER JOIN eleves e ON ep.eleveId = e.id
                INNER JOIN classes c ON e.classe = c.nom
                WHERE c.professeurId = ?
            `, [userId]);

            res.json([
                ...profs.map(p => ({ id: p.id, nom: `${p.prenom} ${p.nom}`, role: 'Professeur', type: 'user' })),
                ...staffs.map(s => ({ id: s.id, nom: s.nom, role: s.role, type: 'user' })),
                ...parents.map(p => ({ id: p.id, nom: `${p.prenom} ${p.nom} (parent de ${p.enfantPrenom} ${p.enfantNom})`, role: 'Parent', type: 'user' })),
                ...eleves.map(e => ({ id: e.id, nom: `${e.prenom} ${e.nom}`, role: 'Élève', type: 'user' })),
                ...classes.map(c => ({ id: `class_${c.nom}`, nom: `Classe ${c.nom}`, role: 'Classe', type: 'class' }))
            ]);

        } else if (userRole && ['directeur', 'secretariat', 'admin'].includes(userRole.toLowerCase())) {
            // Staff peut envoyer à tous (y compris parents)
            const eleves = await dbAll('SELECT id, nom, prenom FROM eleves');
            const profs = await dbAll('SELECT id, nom, prenom FROM professeurs');
            const staffs = await dbAll('SELECT id, nom, role FROM staff WHERE id != ?', [userId]);
            const classes = await dbAll('SELECT nom FROM classes');
            const parents = await dbAll(`
                SELECT DISTINCT pa.id, pa.nom, pa.prenom,
                    GROUP_CONCAT(e.prenom || ' ' || e.nom, ', ') as enfantsNoms
                FROM parents pa
                INNER JOIN eleve_parent ep ON pa.id = ep.parentId
                INNER JOIN eleves e ON ep.eleveId = e.id
                GROUP BY pa.id
            `);

            res.json([
                ...eleves.map(e => ({ id: e.id, nom: `${e.prenom} ${e.nom}`, role: 'Élève', type: 'user' })),
                ...profs.map(p => ({ id: p.id, nom: `${p.prenom} ${p.nom}`, role: 'Professeur', type: 'user' })),
                ...staffs.map(s => ({ id: s.id, nom: s.nom, role: s.role, type: 'user' })),
                ...parents.map(p => ({ id: p.id, nom: `${p.prenom} ${p.nom} (parent de ${p.enfantsNoms})`, role: 'Parent', type: 'user' })),
                ...classes.map(c => ({ id: `class_${c.nom}`, nom: `Classe ${c.nom}`, role: 'Classe', type: 'class' }))
            ]);

        } else {
            res.status(403).json({ error: 'Rôle non autorisé' });
        }
    } catch (err) {
        console.error('Erreur destinataires:', err);
        res.status(500).json({ error: err.message });
    }
});

// Obtenir les messages de l'utilisateur
router.get('/', (req, res) => {
    const userId = req.headers['x-user-id'];

    // Récupérer tous les messages où l'utilisateur est expéditeur ou destinataire
    db.all(`
        SELECT m.*,
               e.prenom as expPrenom, e.nom as expNomEleve,
               p.prenom as expPrenomProf, p.nom as expNomProf,
               es.nom as expNomStaff,
               ep.prenom as expPrenomParent, ep.nom as expNomParent,
               de.prenom as destPrenom, de.nom as destNomEleve,
               dp.prenom as destPrenomProf, dp.nom as destNomProf,
               ds.nom as destNomStaff,
               dpa.prenom as destPrenomParent, dpa.nom as destNomParent,
               enf.prenom as enfantPrenom, enf.nom as enfantNom
        FROM messages m
        LEFT JOIN eleves e ON m.expediteurId = e.id
        LEFT JOIN professeurs p ON m.expediteurId = p.id
        LEFT JOIN staff es ON m.expediteurId = es.id
        LEFT JOIN parents ep ON m.expediteurId = ep.id
        LEFT JOIN eleves de ON m.destinataireId = de.id
        LEFT JOIN professeurs dp ON m.destinataireId = dp.id
        LEFT JOIN staff ds ON m.destinataireId = ds.id
        LEFT JOIN parents dpa ON m.destinataireId = dpa.id
        LEFT JOIN eleves enf ON m.enfantId = enf.id
        WHERE m.destinataireId = ? OR m.expediteurId = ?
        ORDER BY m.date DESC
    `, [userId, userId], (err, messages) => {
        if (err) return res.status(500).json({ error: err.message });

        const enrichedMessages = messages.map(m => {
            let expediteurNom = 'Système';
            if (m.expPrenomParent && m.expNomParent) {
                // Parent : afficher "Parent de (enfant)" si enfantId présent
                if (m.enfantPrenom && m.enfantNom) {
                    expediteurNom = `Parent de ${m.enfantPrenom} ${m.enfantNom}`;
                } else {
                    expediteurNom = `${m.expPrenomParent} ${m.expNomParent}`;
                }
            } else if (m.expPrenom && m.expNomEleve) {
                expediteurNom = `${m.expPrenom} ${m.expNomEleve}`;
            } else if (m.expPrenomProf && m.expNomProf) {
                expediteurNom = `${m.expPrenomProf} ${m.expNomProf}`;
            } else if (m.expNomStaff) {
                expediteurNom = m.expNomStaff;
            }

            let destinataireNom = 'Utilisateur';
            if (m.destinataireId.startsWith('class_')) {
                destinataireNom = `Classe ${m.destinataireId.replace('class_', '')}`;
            } else if (m.destPrenomParent && m.destNomParent) {
                destinataireNom = `${m.destPrenomParent} ${m.destNomParent}`;
            } else if (m.destPrenom && m.destNomEleve) {
                destinataireNom = `${m.destPrenom} ${m.destNomEleve}`;
            } else if (m.destPrenomProf && m.destNomProf) {
                destinataireNom = `${m.destPrenomProf} ${m.destNomProf}`;
            } else if (m.destNomStaff) {
                destinataireNom = m.destNomStaff;
            }

            return {
                id: m.id,
                expediteurId: m.expediteurId,
                destinataireId: m.destinataireId,
                contenu: m.contenu,
                date: m.date,
                lu: m.lu === 1,
                expediteurNom: expediteurNom,
                destinataireNom: destinataireNom,
                enfantId: m.enfantId || null
            };
        });

        res.json(enrichedMessages);
    });
});

// Envoyer un message
router.post('/', (req, res) => {
    const { expediteurId, destinataires, contenu, enfantId } = req.body;
    const userRole = req.headers['x-user-role'];

    if (!contenu || !contenu.trim()) {
        return res.status(400).json({ error: 'Le contenu du message est requis' });
    }

    if (!Array.isArray(destinataires) || destinataires.length === 0) {
        return res.status(400).json({ error: 'Au moins un destinataire est requis' });
    }

    // Vérifier les droits selon le rôle
    if (!canSendToDestinataires(userRole, destinataires)) {
        return res.status(403).json({ error: 'Vous n\'avez pas les droits pour envoyer à ces destinataires' });
    }

    const date = formatDate();
    const sentMessages = [];
    let completed = 0;
    const total = destinataires.length;
    // enfantId est utilisé uniquement pour les parents (contexte "Parent de enfant")
    const msgEnfantId = (userRole === 'parent' && enfantId) ? enfantId : null;

    destinataires.forEach(dest => {
        if (dest.type === 'class') {
            // Envoyer à tous les élèves de la classe
            const className = dest.id.replace('class_', '');
            db.all('SELECT id FROM eleves WHERE classe = ?', [className], (err, eleves) => {
                if (err) {
                    completed++;
                    if (completed === total) res.status(500).json({ error: err.message });
                    return;
                }

                let classCompleted = 0;
                const classTotal = eleves.length;
                if (classTotal === 0) {
                    completed++;
                    if (completed === total) res.status(201).json(sentMessages);
                    return;
                }

                eleves.forEach(eleve => {
                    const msgId = generateId();
                    db.run('INSERT INTO messages (id, expediteurId, destinataireId, contenu, date, lu, enfantId) VALUES (?, ?, ?, ?, ?, 0, ?)',
                        [msgId, expediteurId, eleve.id, contenu, date, msgEnfantId],
                        function(err) {
                            if (err) {
                                console.error('Erreur insertion message:', err);
                                classCompleted++;
                                if (classCompleted === classTotal) {
                                    completed++;
                                    if (completed === total) res.status(201).json(sentMessages);
                                }
                                return;
                            }
                            sentMessages.push({
                                id: msgId,
                                expediteurId,
                                destinataireId: eleve.id,
                                contenu,
                                date,
                                lu: false
                            });
                            classCompleted++;
                            if (classCompleted === classTotal) {
                                completed++;
                                if (completed === total) res.status(201).json(sentMessages);
                            }
                        }
                    );
                });
            });
        } else {
            // Message individuel
            const msgId = generateId();
            db.run('INSERT INTO messages (id, expediteurId, destinataireId, contenu, date, lu, enfantId) VALUES (?, ?, ?, ?, ?, 0, ?)',
                [msgId, expediteurId, dest.id, contenu, date, msgEnfantId],
                function(err) {
                    if (err) {
                        console.error('Erreur insertion message:', err);
                        completed++;
                        if (completed === total) res.status(500).json({ error: err.message });
                        return;
                    }
                    sentMessages.push({
                        id: msgId,
                        expediteurId,
                        destinataireId: dest.id,
                        contenu,
                        date,
                        lu: false
                    });
                    completed++;
                    if (completed === total) res.status(201).json(sentMessages);
                }
            );
        }
    });
});

// Vérifier si l'utilisateur peut envoyer aux destinataires spécifiés
function canSendToDestinataires(userRole, destinataires) {
    if (userRole && ['directeur', 'secretariat', 'admin'].includes(userRole.toLowerCase())) {
        return true; // Staff peut envoyer à tous
    }

    if (userRole === 'professeur') {
        return destinataires.every(dest => {
            if (dest.type === 'class') return true;
            return dest.type === 'user';
        });
    }

    if (userRole === 'eleve') {
        return destinataires.every(dest => {
            return dest.type === 'user' && (dest.role === 'Professeur' || dest.role === 'Secrétariat');
        });
    }

    if (userRole === 'parent') {
        // Parents peuvent envoyer aux professeurs et au staff
        return destinataires.every(dest => {
            return dest.type === 'user';
        });
    }

    return false;
}

// Marquer un message comme lu
router.put('/:id/lu', (req, res) => {
    const userId = req.headers['x-user-id'];

    db.run('UPDATE messages SET lu = 1 WHERE id = ? AND destinataireId = ?', [req.params.id, userId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Message non trouvé ou non autorisé' });
        res.json({ message: 'Message marqué comme lu' });
    });
});

// Supprimer un message
router.delete('/:id', (req, res) => {
    const userId = req.headers['x-user-id'];

    db.run('DELETE FROM messages WHERE id = ? AND (expediteurId = ? OR destinataireId = ?)',
        [req.params.id, userId, userId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Message non trouvé ou non autorisé' });
        res.json({ message: 'Message supprimé' });
    });
});

module.exports = router;
