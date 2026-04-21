const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db } = require('../config/database');
const { generateId, formatDate } = require('../utils/helpers');
const { sendEmail } = require('../config/email');
const { sendPushNotification } = require('../utils/push');

function notifyMessageReceived(destinataireId, expediteurId, contenu, host) {
    // 1. Envoyer la notification Push PWA
    sendPushNotification(destinataireId, {
        title: 'Nouveau message reçu',
        body: 'Vous avez reçu un nouveau message sur le portail',
        url: '/'
    });

    // 2. Continuer avec l'envoi d'Email classique
    const getUserInfoQuery = `
        SELECT nom, prenom, email, notifEmailMessage FROM eleves WHERE id = ?
        UNION
        SELECT nom, prenom, email, notifEmailMessage FROM parents WHERE id = ?
        UNION
        SELECT nom, prenom, email, notifEmailMessage FROM professeurs WHERE id = ?
        UNION
        SELECT nom, prenom, email, notifEmailMessage FROM staff WHERE id = ?
    `;

    db.get(getUserInfoQuery, [destinataireId, destinataireId, destinataireId, destinataireId], (err, receiver) => {
        if (err || !receiver || !receiver.email || receiver.notifEmailMessage !== 1) return;

        db.get(getUserInfoQuery, [expediteurId, expediteurId, expediteurId, expediteurId], (err, sender) => {
            if (err || !sender) return;

            const senderName = `${sender.prenom || ''} ${sender.nom}`.trim();
            const loginLink = `http://${host}/login`;
            
            sendEmail(
                receiver.email,
                'newMessage',
                receiver.prenom || receiver.nom,
                senderName,
                contenu,
                loginLink
            ).catch(e => console.error('Erreur expédition email notif message', e));
        });
    });
}

// Configuration de multer pour les pièces jointes des messages
const uploadDir = path.join(__dirname, '../../public/uploads/messagerie');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        // Conserver l'extension d'origine
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 Mo max par fichier (pour supporter les vidéos)
    fileFilter: (req, file, cb) => {
        const allowedExts = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|gif|webp|txt|zip|rar|csv|mp4|webm|mov|avi|mkv|m4v)$/i;
        if (allowedExts.test(path.extname(file.originalname))) {
            cb(null, true);
        } else {
            cb(new Error('Type de fichier non autorisé'));
        }
    }
});

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
            const staffs = await dbAll('SELECT id, nom, prenom, role FROM staff WHERE lower(role) IN (?, ?, ?)', ['secretariat', 'directeur', 'directeur_adjoint', 'admin']);

            res.json([
                ...profs.map(p => ({ id: p.id, nom: `${p.prenom} ${p.nom}`, role: 'Professeur', type: 'user' })),
                ...staffs.map(s => ({ id: s.id, nom: `${s.prenom} ${s.nom}`.trim(), role: s.role, type: 'user' }))
            ]);

        } else if (userRole === 'parent') {
            // Parents peuvent envoyer aux profs de leurs enfants + tout le staff du bureau
            const enfants = await dbAll(`
                SELECT e.id, e.nom, e.prenom, e.classe FROM eleves e
                INNER JOIN eleve_parent ep ON e.id = ep.eleveId
                WHERE ep.parentId = ?
            `, [userId]);

            const classeNames = [...new Set(enfants.map(e => e.classe).filter(Boolean))];

            // Professeurs (table professeurs) des classes de leurs enfants, avec le nom de l'enfant
            let profsRaw = [];
            if (classeNames.length > 0) {
                const placeholders = classeNames.map(() => '?').join(',');
                const profsFromTable = await dbAll(`
                    SELECT p.id, p.nom, p.prenom, e.prenom as enfantPrenom, e.nom as enfantNom
                    FROM professeurs p
                    INNER JOIN classes c ON c.professeurId = p.id
                    INNER JOIN eleves e ON e.classe = c.nom
                    INNER JOIN eleve_parent ep ON e.id = ep.eleveId
                    WHERE ep.parentId = ? AND c.nom IN (${placeholders})
                `, [userId, ...classeNames]);

                // Membres du bureau ayant le rôle "professeur" et enseignant les classes des enfants
                const staffProfs = await dbAll(`
                    SELECT s.id, s.nom, s.prenom, e.prenom as enfantPrenom, e.nom as enfantNom
                    FROM staff s
                    INNER JOIN classes c ON c.professeurId = s.id
                    INNER JOIN eleves e ON e.classe = c.nom
                    INNER JOIN eleve_parent ep ON e.id = ep.eleveId
                    WHERE LOWER(s.role) = 'professeur' AND ep.parentId = ? AND c.nom IN (${placeholders})
                `, [userId, ...classeNames]);

                profsRaw = [...profsFromTable, ...staffProfs];
            }

            // Grouper par id de prof pour agréger les noms d'enfants (ex: prof commun à des frères/sœurs)
            const profsMap = {};
            profsRaw.forEach(row => {
                if (!profsMap[row.id]) {
                    profsMap[row.id] = { id: row.id, nom: row.nom, prenom: row.prenom, enfants: [] };
                }
                const enfantName = `${row.enfantPrenom} ${row.enfantNom}`;
                if (!profsMap[row.id].enfants.includes(enfantName)) {
                    profsMap[row.id].enfants.push(enfantName);
                }
            });

            // Tout le staff (directeur, secrétariat, admin) — exclure ceux déjà listés comme profs
            const staffs = await dbAll('SELECT id, nom, prenom, role FROM staff');
            const profStaffIds = new Set(Object.keys(profsMap));
            const staffFiltered = staffs.filter(s => !profStaffIds.has(s.id));

            res.json([
                ...Object.values(profsMap).map(p => ({
                    id: p.id,
                    nom: `${p.prenom} ${p.nom} (Prof de ${p.enfants.join(', ')})`,
                    role: 'Professeur',
                    type: 'user'
                })),
                ...staffFiltered.map(s => ({ id: s.id, nom: `${s.prenom} ${s.nom}`.trim(), role: s.role, type: 'user' }))
            ]);

        } else if (userRole === 'professeur') {
            // Professeurs peuvent envoyer à élèves de leurs classes, autres profs, staff, classes, ET parents de leurs élèves
            // Seuls les élèves avec un compte activé apparaissent
            const eleves = await dbAll(`
                SELECT DISTINCT e.id, e.nom, e.prenom FROM eleves e
                INNER JOIN classes c ON e.classe = c.nom
                WHERE c.professeurId = ? AND e.activated = 1
            `, [userId]);

            const profs = await dbAll(`
                SELECT p.id, p.nom, p.prenom, GROUP_CONCAT(c.nom, ', ') as classes
                FROM (
                    SELECT id, nom, prenom FROM professeurs WHERE id != ?
                    UNION
                    SELECT id, nom, prenom FROM staff WHERE lower(role) = 'professeur' AND id != ?
                ) p
                LEFT JOIN classes c ON c.professeurId = p.id
                GROUP BY p.id
            `, [userId, userId]);
            const staffs = await dbAll('SELECT id, nom, prenom, role FROM staff WHERE lower(role) != \'professeur\'');
            const classes = await dbAll(`
                SELECT c.nom, c.niveau, GROUP_CONCAT(DISTINCT e.periode) as horaires
                FROM classes c
                LEFT JOIN emplois_du_temps e ON c.id = e.classeId
                WHERE c.professeurId = ?
                GROUP BY c.id
            `, [userId]);

            // Parents des élèves de ses classes regroupés par enfant
            const getParents = await dbAll(`
                SELECT DISTINCT e.id as eleveId, e.prenom as enfantPrenom, e.nom as enfantNom
                FROM eleves e
                INNER JOIN eleve_parent ep ON ep.eleveId = e.id
                INNER JOIN classes c ON e.classe = c.nom
                WHERE c.professeurId = ?
            `, [userId]);

            res.json([
                ...profs.map(p => ({ id: p.id, nom: p.classes ? `${p.prenom} ${p.nom} (Prof de ${p.classes})` : `${p.prenom} ${p.nom}`, role: 'Professeur', type: 'user' })),
                ...staffs.map(s => ({ id: s.id, nom: `${s.prenom} ${s.nom}`.trim(), role: s.role, type: 'user' })),
                ...getParents.map(e => ({ id: `parents_${e.eleveId}`, nom: `Parents de ${e.enfantPrenom} ${e.enfantNom}`, role: 'Parents', type: 'parents' })),
                ...eleves.map(e => ({ id: e.id, nom: `${e.prenom} ${e.nom}`, role: 'Élève', type: 'user' })),
                ...classes.map(c => ({ id: `class_${c.nom}`, nom: `Classe ${c.nom}`, role: 'Classe', type: 'class', niveau: c.niveau, horaires: c.horaires }))
            ]);

        } else if (userRole && ['directeur', 'directeur_adjoint', 'secretariat', 'admin'].includes(userRole.toLowerCase())) {
            // Staff peut envoyer à tous (y compris parents)
            // Seuls les élèves avec un compte activé apparaissent
            const eleves = await dbAll('SELECT id, nom, prenom FROM eleves WHERE activated = 1');
            const profs = await dbAll(`
                SELECT p.id, p.nom, p.prenom, GROUP_CONCAT(c.nom, ', ') as classes
                FROM professeurs p
                LEFT JOIN classes c ON c.professeurId = p.id
                GROUP BY p.id
            `);
            const staffs = await dbAll(`
                SELECT s.id, s.nom, s.prenom, s.role, GROUP_CONCAT(c.nom, ', ') as classes
                FROM staff s
                LEFT JOIN classes c ON c.professeurId = s.id
                WHERE s.id != ?
                GROUP BY s.id
            `, [userId]);
            const classes = await dbAll(`
                SELECT c.nom, c.niveau, GROUP_CONCAT(DISTINCT e.periode) as horaires
                FROM classes c
                LEFT JOIN emplois_du_temps e ON c.id = e.classeId
                GROUP BY c.id
            `);
            const getParents = await dbAll(`
                SELECT DISTINCT e.id as eleveId, e.prenom as enfantPrenom, e.nom as enfantNom
                FROM eleves e
                INNER JOIN eleve_parent ep ON ep.eleveId = e.id
            `);

            res.json([
                ...eleves.map(e => ({ id: e.id, nom: `${e.prenom} ${e.nom}`, role: 'Élève', type: 'user' })),
                ...profs.map(p => ({ id: p.id, nom: p.classes ? `${p.prenom} ${p.nom} (Prof de ${p.classes})` : `${p.prenom} ${p.nom}`, role: 'Professeur', type: 'user' })),
                ...staffs.map(s => ({ id: s.id, nom: (s.classes && s.role && s.role.toLowerCase() === 'professeur') ? `${s.prenom} ${s.nom} (Prof de ${s.classes})`.trim() : `${s.prenom} ${s.nom}`.trim(), role: s.role, type: 'user' })),
                ...getParents.map(e => ({ id: `parents_${e.eleveId}`, nom: `Parents de ${e.enfantPrenom} ${e.enfantNom}`, role: 'Parents', type: 'parents' })),
                ...classes.map(c => ({ id: `class_${c.nom}`, nom: `Classe ${c.nom}`, role: 'Classe', type: 'class', niveau: c.niveau, horaires: c.horaires }))
            ]);

        } else {
            res.status(403).json({ error: 'Rôle non autorisé' });
        }
    } catch (err) {
        console.error('Erreur destinataires:', err);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Obtenir les messages de l'utilisateur
router.get('/', (req, res) => {
    const userId = req.headers['x-user-id'];

    // Récupérer tous les messages de la boîte de l'utilisateur (non supprimés de son côté)
    db.all(`
        SELECT m.*,
               e.prenom as expPrenom, e.nom as expNomEleve,
               p.prenom as expPrenomProf, p.nom as expNomProf,
               es.prenom as expPrenomStaff, es.nom as expNomStaff,
               ep.prenom as expPrenomParent, ep.nom as expNomParent,
               de.prenom as destPrenom, de.nom as destNomEleve,
               dp.prenom as destPrenomProf, dp.nom as destNomProf,
               ds.prenom as destPrenomStaff, ds.nom as destNomStaff,
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
        WHERE (m.destinataireId = ? AND m.deleted_by_receiver = 0)
           OR (m.expediteurId = ? AND m.deleted_by_sender = 0)
        ORDER BY m.date DESC
    `, [userId, userId], (err, messages) => {
        if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });

        const enrichedMessages = messages.map(m => {
            let expediteurNom = 'Inconnu';
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
                expediteurNom = `${m.expPrenomStaff || ''} ${m.expNomStaff}`.trim();
            }

            let destinataireNom = 'Inconnu';
            if (m.destinataireId.startsWith('class_')) {
                destinataireNom = `Classe ${m.destinataireId.replace('class_', '')}`;
            } else if (m.destPrenomParent && m.destNomParent) {
                destinataireNom = `${m.destPrenomParent} ${m.destNomParent}`;
            } else if (m.destPrenom && m.destNomEleve) {
                destinataireNom = `${m.destPrenom} ${m.destNomEleve}`;
            } else if (m.destPrenomProf && m.destNomProf) {
                destinataireNom = `${m.destPrenomProf} ${m.destNomProf}`;
            } else if (m.destNomStaff) {
                destinataireNom = `${m.destPrenomStaff || ''} ${m.destNomStaff}`.trim();
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
                enfantId: m.enfantId || null,
                piecesJointes: m.piecesJointes ? JSON.parse(m.piecesJointes) : []
            };
        });

        res.json(enrichedMessages);
    });
});

// Envoyer un message (supporte multipart/form-data pour les pièces jointes)
router.post('/', (req, res, next) => {
    upload.array('piecesJointes', 5)(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'Fichier trop volumineux (max 10 Mo par fichier)' });
            }
            return res.status(400).json({ error: 'Erreur lors de l\'upload du fichier' });
        }
        next();
    });
}, (req, res) => {
    const { expediteurId, contenu, enfantId } = req.body;
    const userRole = req.headers['x-user-role'];

    // destinataires peut arriver en JSON string (multipart) ou objet (JSON body)
    let destinataires;
    try {
        destinataires = typeof req.body.destinataires === 'string'
            ? JSON.parse(req.body.destinataires)
            : req.body.destinataires;
    } catch (e) {
        return res.status(400).json({ error: 'Format des destinataires invalide' });
    }

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

    // Construire les métadonnées des pièces jointes
    const piecesJointesMeta = req.files && req.files.length > 0
        ? req.files.map(f => ({
            filename: f.filename,
            originalname: f.originalname,
            size: f.size,
            mimetype: f.mimetype
          }))
        : [];

    const piecesJointesJson = piecesJointesMeta.length > 0
        ? JSON.stringify(piecesJointesMeta)
        : null;

    const date = formatDate();
    const sentMessages = [];
    let completed = 0;
    const total = destinataires.length;
    const msgEnfantId = (userRole === 'parent' && enfantId) ? enfantId : null;

    destinataires.forEach(dest => {
        if (dest.type === 'parents') {
            // Envoyer aux deux parents de cet élève
            const eleveId = dest.id.replace('parents_', '');
            db.all('SELECT parentId FROM eleve_parent WHERE eleveId = ?', [eleveId], (err, rows) => {
                if (err) {
                    completed++;
                    if (completed === total) res.status(500).json({ error: 'Erreur interne du serveur' });
                    return;
                }
                if (rows.length === 0) {
                    completed++;
                    if (completed === total) res.status(201).json(sentMessages);
                    return;
                }
                const parentIds = rows.map(r => r.parentId);
                const parentsTotal = parentIds.length;
                let parentsCompleted = 0;

                parentIds.forEach(parentId => {
                    const msgId = generateId();
                    db.run('INSERT INTO messages (id, expediteurId, destinataireId, contenu, date, lu, enfantId, piecesJointes) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
                        [msgId, expediteurId, parentId, contenu, date, msgEnfantId, piecesJointesJson],
                        function(err) {
                            if (err) {
                                console.error('Erreur insertion message parents:', err);
                            } else {
                                sentMessages.push({
                                    id: msgId,
                                    expediteurId,
                                    destinataireId: parentId,
                                    contenu,
                                    date,
                                    lu: false,
                                    piecesJointes: piecesJointesMeta
                                });
                                // Envoi de l'email de notification
                                notifyMessageReceived(parentId, expediteurId, contenu, req.headers.host);
                            }
                            parentsCompleted++;
                            if (parentsCompleted === parentsTotal) {
                                completed++;
                                if (completed === total) res.status(201).json(sentMessages);
                            }
                        }
                    );
                });
            });
        } else if (dest.type === 'class') {
            // Envoyer à tous les élèves ET à leurs parents
            const className = dest.id.replace('class_', '');

            // Récupérer les élèves ET les parents distincts de cette classe
            db.all(`
                SELECT e.id as eleveId, pa.id as parentId
                FROM eleves e
                LEFT JOIN eleve_parent ep ON ep.eleveId = e.id
                LEFT JOIN parents pa ON pa.id = ep.parentId
                WHERE e.classe = ?
            `, [className], (err, rows) => {
                if (err) {
                    completed++;
                    if (completed === total) res.status(500).json({ error: 'Erreur interne du serveur' });
                    return;
                }

                if (rows.length === 0) {
                    completed++;
                    if (completed === total) res.status(201).json(sentMessages);
                    return;
                }

                // Construire la liste dédupliquée des destinataires (élèves + parents)
                const destIds = new Set();
                rows.forEach(r => {
                    destIds.add(r.eleveId);
                    if (r.parentId) destIds.add(r.parentId);
                });
                const classDestIds = [...destIds];
                const classTotal = classDestIds.length;
                let classCompleted = 0;

                classDestIds.forEach(destId => {
                    const msgId = generateId();
                    db.run('INSERT INTO messages (id, expediteurId, destinataireId, contenu, date, lu, enfantId, piecesJointes) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
                        [msgId, expediteurId, destId, contenu, date, msgEnfantId, piecesJointesJson],
                        function(err) {
                            if (err) {
                                console.error('Erreur insertion message classe:', err);
                            } else {
                                sentMessages.push({
                                    id: msgId,
                                    expediteurId,
                                    destinataireId: destId,
                                    contenu,
                                    date,
                                    lu: false,
                                    piecesJointes: piecesJointesMeta
                                });
                                // Envoi de l'email de notification
                                notifyMessageReceived(destId, expediteurId, contenu, req.headers.host);
                            }
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
            db.run('INSERT INTO messages (id, expediteurId, destinataireId, contenu, date, lu, enfantId, piecesJointes) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
                [msgId, expediteurId, dest.id, contenu, date, msgEnfantId, piecesJointesJson],
                function(err) {
                    if (err) {
                        console.error('Erreur insertion message:', err);
                        completed++;
                        if (completed === total) res.status(500).json({ error: 'Erreur interne du serveur' });
                        return;
                    }
                    sentMessages.push({
                        id: msgId,
                        expediteurId,
                        destinataireId: dest.id,
                        contenu,
                        date,
                        lu: false,
                        piecesJointes: piecesJointesMeta
                    });
                    // Envoi de l'email de notification
                    notifyMessageReceived(dest.id, expediteurId, contenu, req.headers.host);
                    
                    completed++;
                    if (completed === total) res.status(201).json(sentMessages);
                }
            );
        }
    });
}); // fin router.post '/'

// Vérifier si l'utilisateur peut envoyer aux destinataires spécifiés
function canSendToDestinataires(userRole, destinataires) {
    if (userRole && ['directeur', 'directeur_adjoint', 'secretariat', 'admin'].includes(userRole.toLowerCase())) {
        return true; // Staff peut envoyer à tous
    }

    if (userRole === 'professeur') {
        return destinataires.every(dest => {
            if (dest.type === 'class') return true;
            if (dest.type === 'parents') return true;
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
        if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
        if (this.changes === 0) return res.status(404).json({ message: 'Message non trouvé ou non autorisé' });
        res.json({ message: 'Message marqué comme lu' });
    });
});

// Supprimer un message (soft-delete, puis hard-delete si les deux parties ont supprimé)
router.delete('/:id', (req, res) => {
    const userId = req.headers['x-user-id'];
    const messageId = req.params.id;

    // Récupérer le message pour vérifier les droits
    db.get('SELECT * FROM messages WHERE id = ?', [messageId], (err, message) => {
        if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
        if (!message) return res.status(404).json({ error: 'Message non trouvé' });

        const isExpéditeur = message.expediteurId === userId;
        const isDestinataire = message.destinataireId === userId;

        if (!isExpéditeur && !isDestinataire) {
            return res.status(403).json({ error: 'Non autorisé à supprimer ce message' });
        }

        // Colonne à mettre à jour selon le rôle
        const column = isExpéditeur ? 'deleted_by_sender' : 'deleted_by_receiver';

        db.run(`UPDATE messages SET ${column} = 1 WHERE id = ?`, [messageId], function(updateErr) {
            if (updateErr) return res.status(500).json({ error: 'Erreur interne du serveur' });

            // Recharger pour voir si les deux côtés ont supprimé
            db.get('SELECT * FROM messages WHERE id = ?', [messageId], (err2, updated) => {
                if (err2) return res.status(500).json({ error: 'Erreur interne du serveur' });
                if (!updated) return res.json({ deleted: true, purged: false }); // déjà supprimé

                const bothDeleted = updated.deleted_by_sender === 1 && updated.deleted_by_receiver === 1;

                if (bothDeleted) {
                    // Supprimer les fichiers physiques attachés
                    if (updated.piecesJointes) {
                        try {
                            const pieces = JSON.parse(updated.piecesJointes);
                            if (Array.isArray(pieces)) {
                                pieces.forEach(pj => {
                                    const filePath = path.join(uploadDir, pj.filename);
                                    if (fs.existsSync(filePath)) {
                                        fs.unlinkSync(filePath);
                                        console.log(`[Messagerie] Fichier supprimé : ${pj.filename}`);
                                    }
                                });
                            }
                        } catch (parseErr) {
                            console.error('[Messagerie] Erreur parsing piecesJointes pour suppression:', parseErr);
                        }
                    }

                    // Supprimer la ligne en base
                    db.run('DELETE FROM messages WHERE id = ?', [messageId], (delErr) => {
                        if (delErr) return res.status(500).json({ error: 'Erreur interne du serveur' });
                        res.json({ deleted: true, purged: true, message: 'Message supprimé définitivement' });
                    });
                } else {
                    // Soft-delete seulement de ce côté
                    res.json({ deleted: true, purged: false, message: 'Message masqué de votre côté' });
                }
            });
        });
    });
});

// Servir une pièce jointe de la messagerie
router.get('/pieces-jointes/:filename', (req, res) => {
    const filePath = path.join(uploadDir, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'Fichier non trouvé' });
    }
});

module.exports = router;
