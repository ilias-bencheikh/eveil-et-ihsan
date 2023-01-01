// URL de base de l'API - Détection automatique du protocole et de l'hôte
// Pour iPhone/mobile : utiliser HTTP car les certificats auto-signés sont difficiles à accepter
const API_URL = `http://${window.location.hostname}:3000/api`;

// État global
let eleves = [];
let professeurs = [];
let classes = [];
let absences = [];
let appreciations = [];
let currentUser = null;

// ==================== MODALS PERSONNALISÉES ====================

// Fonction pour afficher une alerte personnalisée
function showCustomAlert(message, type = 'info') {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
    
    const icons = {
        'success': '✅',
        'error': '❌',
        'warning': '⚠️',
        'info': 'ℹ️'
    };
    
    const colors = {
        'success': '#28a745',
        'error': '#dc3545',
        'warning': '#ffc107',
        'info': '#17a2b8'
    };
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; max-width: 400px; width: 90%; text-align: center;">
            <div style="font-size: 3em; margin-bottom: 15px;">${icons[type] || icons.info}</div>
            <p style="color: #333; font-size: 1.1em; line-height: 1.5; margin-bottom: 20px;">${message}</p>
            <button onclick="this.closest('div[style*=fixed]').remove()" style="padding: 12px 30px; background: ${colors[type] || colors.info}; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600; font-size: 1em;">
                OK
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Fermer en cliquant en dehors
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    return modal;
}

// Fonction pour afficher une confirmation personnalisée
function showCustomConfirm(message, onConfirm, onCancel) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; max-width: 400px; width: 90%; text-align: center;">
            <div style="font-size: 3em; margin-bottom: 15px;">❓</div>
            <p style="color: #333; font-size: 1.1em; line-height: 1.5; margin-bottom: 25px;">${message}</p>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="cancelBtn" style="flex: 1; padding: 12px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
                    Annuler
                </button>
                <button id="confirmBtn" style="flex: 1; padding: 12px 20px; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
                    Confirmer
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#confirmBtn').addEventListener('click', () => {
        modal.remove();
        if (onConfirm) onConfirm();
    });
    
    modal.querySelector('#cancelBtn').addEventListener('click', () => {
        modal.remove();
        if (onCancel) onCancel();
    });
    
    // Fermer en cliquant en dehors (compte comme annuler)
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
            if (onCancel) onCancel();
        }
    });
    
    return modal;
}

// Fonction pour afficher un prompt personnalisé
function showCustomPrompt(message, defaultValue = '', onSubmit, onCancel) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; max-width: 400px; width: 90%;">
            <p style="color: #333; font-size: 1.1em; line-height: 1.5; margin-bottom: 20px;">${message}</p>
            <input type="text" id="promptInput" value="${defaultValue}" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 5px; font-size: 1em; margin-bottom: 20px;">
            <div style="display: flex; gap: 10px;">
                <button id="cancelBtn" style="flex: 1; padding: 12px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
                    Annuler
                </button>
                <button id="submitBtn" style="flex: 1; padding: 12px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
                    OK
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const input = modal.querySelector('#promptInput');
    input.focus();
    input.select();
    
    const submit = () => {
        const value = input.value;
        modal.remove();
        if (onSubmit) onSubmit(value);
    };
    
    modal.querySelector('#submitBtn').addEventListener('click', submit);
    modal.querySelector('#cancelBtn').addEventListener('click', () => {
        modal.remove();
        if (onCancel) onCancel();
    });
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submit();
    });
    
    return modal;
}

// Configuration de la session (10 minutes d'inactivité)
const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes en millisecondes
let inactivityTimer = null;

// Mettre à jour le timestamp de la dernière activité
function updateActivity() {
    localStorage.setItem('lastActivity', Date.now().toString());
    resetInactivityTimer();
}

// Réinitialiser le timer d'inactivité
function resetInactivityTimer() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    inactivityTimer = setTimeout(() => {
        localStorage.clear();
        showCustomAlert('Votre session a expiré après 10 minutes d\'inactivité.', 'warning');
        setTimeout(() => window.location.href = 'login.html', 1500);
    }, SESSION_TIMEOUT);
}

// Détecter l'activité de l'utilisateur
document.addEventListener('mousemove', updateActivity);
document.addEventListener('keypress', updateActivity);
document.addEventListener('click', updateActivity);
document.addEventListener('scroll', updateActivity);

// Vérifier l'authentification au chargement
function checkAuth() {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
        window.location.href = 'login.html';
        return;
    }
    
    // Vérifier si la session a expiré
    const lastActivity = localStorage.getItem('lastActivity');
    if (lastActivity) {
        const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
        if (timeSinceLastActivity > SESSION_TIMEOUT) {
            localStorage.clear();
            showCustomAlert('Votre session a expiré après 10 minutes d\'inactivité.', 'warning');
            setTimeout(() => window.location.href = 'login.html', 1500);
            return;
        }
    }
    
    // Mettre à jour le timestamp d'activité
    updateActivity();
    
    currentUser = JSON.parse(userStr);
    
    // Si c'est un élève, rediriger vers son dashboard
    if (currentUser.role === 'eleve') {
        window.location.href = 'eleve-dashboard.html';
        return;
    }
    
    // Afficher les infos utilisateur avec badge de rôle
    const roleLabels = {
        'admin': '👑 Administrateur',
        'directeur': '🎯 Directeur',
        'secretariat': '📋 Secrétariat',
        'professeur': '👨‍🏫 Professeur'
    };
    
    document.getElementById('user-info').textContent = `${roleLabels[currentUser.role] || currentUser.role}`;
    
    // Afficher le message pour les professeurs
    if (currentUser.role === 'professeur') {
        const profInfo = document.getElementById('prof-info');
        if (profInfo) profInfo.style.display = 'block';
        
        // Masquer la rubrique Professeurs
        const navProfs = document.getElementById('nav-professeurs');
        if (navProfs) navProfs.style.display = 'none';
    }
    
    // Afficher la rubrique Appel pour professeur, secretariat et directeur
    if (['professeur', 'secretariat', 'directeur', 'admin'].includes(currentUser.role)) {
        const navAppel = document.getElementById('nav-appel');
        if (navAppel) navAppel.style.display = 'flex';
    }
    
    // Afficher la rubrique Inscriptions pour admin, directeur et secrétariat
    showInscriptionsTab();
    
    // Afficher la rubrique Bureau pour admin et directeur
    showBureauTab();
    
    // Gérer les permissions d'affichage
    applyPermissions();
}

// Fonction pour vérifier les permissions
function hasPermission(action) {
    const permissions = {
        admin: ['create_class', 'delete_class', 'create_eleve', 'delete_eleve', 'create_prof', 'delete_prof', 'create_absence', 'create_appreciation', 'manage_inscriptions', 'manage_bureau'],
        directeur: ['create_class', 'delete_class', 'create_eleve', 'delete_eleve', 'create_prof', 'delete_prof', 'create_absence', 'create_appreciation', 'manage_inscriptions', 'manage_bureau'],
        secretariat: ['create_class', 'delete_class', 'create_eleve', 'delete_eleve', 'create_absence', 'manage_inscriptions'],
        professeur: ['create_absence', 'create_appreciation'],
        eleve: []
    };
    
    return permissions[currentUser.role] && permissions[currentUser.role].includes(action);
}

// Appliquer les permissions à l'interface
function applyPermissions() {
    // Masquer les boutons selon les permissions
    if (!hasPermission('create_eleve')) {
        const addEleveBtn = document.querySelector('[onclick="showAddEleveForm()"]');
        if (addEleveBtn) {
            addEleveBtn.style.display = 'none';
        }
    }
    
    if (!hasPermission('create_class')) {
        const addClasseBtn = document.querySelector('[onclick="showAddClasseForm()"]');
        if (addClasseBtn) {
            addClasseBtn.style.display = 'none';
        }
    }
    
    if (!hasPermission('create_prof')) {
        const addProfBtn = document.querySelector('[onclick="showAddProfForm()"]');
        if (addProfBtn) {
            addProfBtn.style.display = 'none';
        }
    }
    
    // Masquer la rubrique professeurs pour les professeurs
    if (currentUser.role === 'professeur') {
        const profNavItem = document.querySelector('.nav-item[data-tab="professeurs"]');
        if (profNavItem) {
            profNavItem.style.display = 'none';
        }
    }
}

// Fonction de déconnexion
function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

// Vérifier l'authentification au chargement de la page
checkAuth();

// S'assurer que la modal est bien cachée au démarrage
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('new-conversation-modal');
    if (modal) {
        modal.style.display = 'none';
    }
});

// ==================== GESTION DES ONGLETS ====================
const pageInfo = {
    eleves: { title: 'Gestion des Élèves', desc: 'Consulter et gérer les élèves de l’établissement' },
    bureau: { title: 'Gestion du Bureau', desc: 'Créer et gérer les utilisateurs (directeur, secrétariat, professeur)' },
    classes: { title: 'Gestion des Classes', desc: 'Organiser les classes par niveau' },
    inscriptions: { title: 'Dossier d\'inscription', desc: 'Inscrire des élèves en solo ou en famille' },
    appel: { title: 'Faire l\'appel', desc: 'Enregistrer les présences et absences par classe' },
    absences: { title: 'Gestion des Absences', desc: 'Suivre les absences et retards' },
    appreciations: { title: 'Gestion des Appréciations', desc: 'Notes et commentaires par matière' }
};

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const tabName = item.dataset.tab;
        
        // Désactiver tous les onglets et contenus
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        // Activer l'onglet cliqué
        item.classList.add('active');
        document.getElementById(tabName).classList.add('active');
        
        // Mettre à jour le titre de la page
        if (pageInfo[tabName]) {
            document.getElementById('page-title').textContent = pageInfo[tabName].title;
            document.getElementById('page-description').textContent = pageInfo[tabName].desc;
        }
        
        // Charger les données appropriées
        switch(tabName) {
            case 'eleves':
                loadEleves();
                break;
            case 'classes':
                loadClasses();
                break;
            case 'bureau':
                loadStaff();
                break;
            case 'inscriptions':
                loadInscriptions();
                break;
            case 'appel':
                loadAppelInterface();
                break;
            case 'appreciations':
                loadAppreciations();
                break;
            case 'messagerie':
                loadConversations();
                break;
        }
    });
});

// ==================== FONCTIONS ÉLÈVES ====================

async function loadEleves() {
    try {
        const response = await fetch(`${API_URL}/eleves`, {
            headers: {
                'x-user-role': currentUser.role,
                'x-user-id': currentUser.id
            }
        });
        eleves = await response.json();
        displayEleves();
    } catch (error) {
        console.error('Erreur lors du chargement des élèves:', error);
    }
}

// Fonction pour filtrer les élèves
function filterEleves() {
    const searchInput = document.getElementById('search-eleve');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase();
    const filteredEleves = eleves.filter(eleve => 
        eleve.nom.toLowerCase().includes(searchTerm) ||
        eleve.prenom.toLowerCase().includes(searchTerm) ||
        (eleve.classe && eleve.classe.toLowerCase().includes(searchTerm))
    );
    displayEleves(filteredEleves);
}

function displayEleves(elevesToDisplay = null) {
    const grid = document.getElementById('eleves-grid');
    if (!grid) {
        console.error('Élément eleves-grid non trouvé');
        return;
    }
    
    const displayList = elevesToDisplay || eleves;
    
    if (displayList.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">Aucun élève trouvé</p>';
        return;
    }
    
    grid.innerHTML = displayList.map(eleve => {
        // Déterminer l'affichage de la photo
        let photoContent;
        if (eleve.photo) {
            photoContent = `<img src="${eleve.photo}" alt="${eleve.prenom} ${eleve.nom}">`;
        } else {
            // Initiales si pas de photo
            const initiales = `${eleve.prenom.charAt(0)}${eleve.nom.charAt(0)}`.toUpperCase();
            photoContent = initiales;
        }
        
        return `
            <div class="eleve-card">
                <div class="photo-container" onclick="showEleveDetails('${eleve.id}')">
                    ${photoContent}
                </div>
                <h3>${eleve.prenom} ${eleve.nom}</h3>
                ${eleve.classe ? `<span class="classe-badge">${eleve.classe}</span>` : '<span class="classe-badge" style="background: #999;">Non assigné</span>'}
                <div class="info">📅 ${new Date(eleve.dateNaissance).toLocaleDateString('fr-FR')}</div>
                ${eleve.telephone ? `<div class="info">📞 ${eleve.telephone}</div>` : ''}
                ${eleve.email ? `<div class="info">✉️ ${eleve.email}</div>` : ''}
                <div class="actions">
                    <button class="btn-icon edit" onclick="editEleve('${eleve.id}')" title="Modifier">✏️</button>
                    <button class="btn-icon delete" onclick="deleteEleve('${eleve.id}')" title="Supprimer">🗑️</button>
                    ${eleve.email && !eleve.activated ? `<button class="btn-icon email" onclick="sendActivationEmail('${eleve.id}', '${eleve.email}', 'eleve')" title="Renvoyer l'email d'activation">📧</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Afficher les détails d'un élève avec ses absences
async function showEleveDetails(eleveId) {
    const eleve = eleves.find(e => e.id === eleveId);
    if (!eleve) return;
    
    // Charger les absences depuis l'API
    let elevesAbsences = [];
    try {
        const response = await fetch(`${API_URL}/absences`, {
            headers: {
                'x-user-role': currentUser.role,
                'x-user-id': currentUser.id
            }
        });
        const allAbsences = await response.json();
        // Filtrer les absences de cet élève
        elevesAbsences = allAbsences.filter(a => a.eleveId === eleveId);
    } catch (error) {
        console.error('Erreur lors du chargement des absences:', error);
    }
    
    // Créer la liste des absences
    let absencesHTML = '';
    if (elevesAbsences.length === 0) {
        absencesHTML = '<p style="color: #28a745; font-weight: 600; text-align: center; padding: 20px;">✅ Aucune absence enregistrée</p>';
    } else {
        absencesHTML = `
            <div style="max-height: 300px; overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead style="background: #f8f9fa; position: sticky; top: 0;">
                        <tr>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Date</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Type</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Motif</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${elevesAbsences.map(absence => `
                            <tr style="border-bottom: 1px solid #dee2e6;">
                                <td style="padding: 10px;">${new Date(absence.date).toLocaleDateString('fr-FR')}</td>
                                <td style="padding: 10px;"><span style="background: #ffc107; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 0.85em;">${absence.type}</span></td>
                                <td style="padding: 10px;">${absence.motif || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    // Créer la modal
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; overflow-y: auto; padding: 20px;';
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; max-width: 700px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <h2 style="color: #1e3a5f; margin-bottom: 25px; display: flex; align-items: center; gap: 10px;">
                <span>👤</span> Fiche élève
            </h2>
            
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; margin-bottom: 25px; color: white;">
                <h3 style="margin: 0 0 15px 0; font-size: 1.5em;">${eleve.prenom} ${eleve.nom}</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    <div>
                        <div style="opacity: 0.9; font-size: 0.9em; margin-bottom: 5px;">📅 Date de naissance</div>
                        <div style="font-weight: 600;">${new Date(eleve.dateNaissance).toLocaleDateString('fr-FR')}</div>
                    </div>
                    <div>
                        <div style="opacity: 0.9; font-size: 0.9em; margin-bottom: 5px;">🎓 Classe</div>
                        <div style="font-weight: 600;">${eleve.classe || 'Non assigné'}</div>
                    </div>
                    <div>
                        <div style="opacity: 0.9; font-size: 0.9em; margin-bottom: 5px;">📧 Email</div>
                        <div style="font-weight: 600;">${eleve.email || 'Non renseigné'}</div>
                    </div>
                    <div>
                        <div style="opacity: 0.9; font-size: 0.9em; margin-bottom: 5px;">📱 Téléphone</div>
                        <div style="font-weight: 600;">${eleve.telephone || 'Non renseigné'}</div>
                    </div>
                </div>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="color: #1e3a5f; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                    <span>📊</span> Absences
                    <span style="background: ${elevesAbsences.length > 0 ? '#dc3545' : '#28a745'}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.9em; margin-left: auto;">
                        ${elevesAbsences.length} absence${elevesAbsences.length > 1 ? 's' : ''}
                    </span>
                </h3>
                ${absencesHTML}
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                ${hasPermission('create_eleve') ? `
                <button onclick="this.closest('div[style*=fixed]').remove(); editEleve('${eleveId}')" style="padding: 12px 24px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600; font-size: 1em;">
                    ✏️ Modifier
                </button>
                ` : ''}
                ${hasPermission('delete_eleve') ? `
                <button onclick="this.closest('div[style*=fixed]').remove(); deleteEleve('${eleveId}')" style="padding: 12px 24px; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600; font-size: 1em;">
                    🗑️ Supprimer
                </button>
                ` : ''}
                <button onclick="this.closest('div[style*=fixed]').remove()" style="padding: 12px 24px; background: #1e3a5f; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600; font-size: 1em;">
                    Fermer
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Fermer en cliquant en dehors
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function showAddEleveForm() {
    document.getElementById('add-eleve-form').style.display = 'block';
    document.getElementById('eleveForm').reset();
    const formTitle = document.getElementById('add-eleve-form').querySelector('h3');
    if (formTitle) formTitle.textContent = 'Nouvel Élève';
    loadClassesInSelect('eleve-classe');
}

function hideAddEleveForm() {
    document.getElementById('add-eleve-form').style.display = 'none';
    document.getElementById('eleveForm').reset();
    // Réinitialiser le preview de photo
    const preview = document.getElementById('photo-preview');
    if (preview) preview.style.display = 'none';
}

async function editEleve(eleveId) {
    const eleve = eleves.find(e => e.id === eleveId);
    if (!eleve) return;
    
    // Charger les classes pour le select
    let classesOptions = '<option value="">Sélectionner une classe</option>';
    classes.forEach(classe => {
        const selected = classe.nom === eleve.classe ? 'selected' : '';
        classesOptions += `<option value="${classe.nom}" ${selected}>${classe.nom}</option>`;
    });
    
    // Créer la modal
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; overflow-y: auto; padding: 20px;';
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <h2 style="color: #1e3a5f; margin-bottom: 25px; display: flex; align-items: center; gap: 10px;">
                <span>✏️</span> Modifier l'élève
            </h2>
            
            <form id="editEleveModalForm" style="display: flex; flex-direction: column; gap: 15px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                        <label style="display: block; margin-bottom: 5px; color: #1e3a5f; font-weight: 600;">Nom *</label>
                        <input type="text" id="edit-eleve-nom" value="${eleve.nom}" required style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 5px; font-size: 1em;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 5px; color: #1e3a5f; font-weight: 600;">Prénom *</label>
                        <input type="text" id="edit-eleve-prenom" value="${eleve.prenom}" required style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 5px; font-size: 1em;">
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                        <label style="display: block; margin-bottom: 5px; color: #1e3a5f; font-weight: 600;">Date de naissance *</label>
                        <input type="date" id="edit-eleve-dateNaissance" value="${eleve.dateNaissance}" required style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 5px; font-size: 1em;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 5px; color: #1e3a5f; font-weight: 600;">Classe</label>
                        <select id="edit-eleve-classe" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 5px; font-size: 1em;">
                            ${classesOptions}
                        </select>
                    </div>
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 5px; color: #1e3a5f; font-weight: 600;">Téléphone parent</label>
                    <input type="tel" id="edit-eleve-telephone" value="${eleve.telephone || ''}" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 5px; font-size: 1em;">
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 5px; color: #1e3a5f; font-weight: 600;">Email parent</label>
                    <input type="email" id="edit-eleve-email" value="${eleve.email || ''}" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 5px; font-size: 1em;">
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 5px; color: #1e3a5f; font-weight: 600;">Photo de profil</label>
                    ${eleve.photo ? `<div style="margin-bottom: 10px;"><img src="${eleve.photo}" style="max-width: 120px; max-height: 120px; border-radius: 8px; border: 2px solid #e0e0e0;"></div>` : ''}
                    <input type="file" id="edit-eleve-photo" accept="image/*" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 5px; font-size: 0.95em;" onchange="previewEditElevePhoto(this)">
                    <div id="edit-photo-preview" style="margin-top: 10px; display: none;">
                        <img id="edit-preview-img" style="max-width: 120px; max-height: 120px; border-radius: 8px; border: 2px solid #e0e0e0;">
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                    <button type="button" onclick="this.closest('div[style*=fixed]').remove()" style="padding: 12px 24px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600; font-size: 1em;">
                        Annuler
                    </button>
                    <button type="submit" style="padding: 12px 24px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600; font-size: 1em;">
                        💾 Enregistrer
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Gestionnaire de soumission du formulaire
    document.getElementById('editEleveModalForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Gérer l'upload de la photo
        const photoInput = document.getElementById('edit-eleve-photo');
        let photoBase64 = eleve.photo; // Garder la photo existante par défaut
        
        if (photoInput.files && photoInput.files[0]) {
            const file = photoInput.files[0];
            // Vérifier la taille (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                showCustomAlert('L\'image ne doit pas dépasser 2MB', 'error');
                return;
            }
            
            // Convertir en base64
            photoBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
        }
        
        const eleveData = {
            nom: document.getElementById('edit-eleve-nom').value,
            prenom: document.getElementById('edit-eleve-prenom').value,
            dateNaissance: document.getElementById('edit-eleve-dateNaissance').value,
            classe: document.getElementById('edit-eleve-classe').value,
            telephone: document.getElementById('edit-eleve-telephone').value,
            email: document.getElementById('edit-eleve-email').value,
            photo: photoBase64
        };
        
        try {
            const response = await fetch(`${API_URL}/eleves/${eleveId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-role': currentUser.role,
                    'x-user-id': currentUser.id
                },
                body: JSON.stringify(eleveData)
            });
            
            if (response.ok) {
                showCustomAlert('Élève modifié avec succès!', 'success');
                modal.remove();
                loadEleves();
            } else {
                showCustomAlert('Erreur lors de la modification', 'error');
            }
        } catch (error) {
            console.error('Erreur:', error);
            showCustomAlert('Erreur lors de la modification', 'error');
        }
    });
    
    // Fermer en cliquant en dehors
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Fonction pour prévisualiser la photo de l'élève
function previewElevePhoto(input) {
    const preview = document.getElementById('photo-preview');
    const previewImg = document.getElementById('preview-img');
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImg.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        preview.style.display = 'none';
    }
}

// Fonction pour prévisualiser la photo lors de l'édition
function previewEditElevePhoto(input) {
    const preview = document.getElementById('edit-photo-preview');
    const previewImg = document.getElementById('edit-preview-img');
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImg.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        preview.style.display = 'none';
    }
}

const eleveForm = document.getElementById('eleveForm');
if (eleveForm) {
    eleveForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Gérer l'upload de la photo
        const photoInput = document.getElementById('eleve-photo');
        let photoBase64 = null;
        
        if (photoInput.files && photoInput.files[0]) {
            const file = photoInput.files[0];
            // Vérifier la taille (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                showCustomAlert('L\'image ne doit pas dépasser 2MB', 'error');
                return;
            }
            
            // Convertir en base64
            photoBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
        }
        
        const eleveData = {
            nom: document.getElementById('eleve-nom').value,
            prenom: document.getElementById('eleve-prenom').value,
            dateNaissance: document.getElementById('eleve-dateNaissance').value,
            classe: document.getElementById('eleve-classe').value,
            telephone: document.getElementById('eleve-telephone').value,
            email: document.getElementById('eleve-email').value,
            photo: photoBase64
        };
        
        try {
            const response = await fetch(`${API_URL}/eleves`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-role': currentUser.role,
                    'x-user-id': currentUser.id
                },
                body: JSON.stringify(eleveData)
            });
        
        if (response.ok) {
            const data = await response.json();
            
            // Créer une modal pour afficher le lien d'activation
            const modal = document.createElement('div');
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
            modal.innerHTML = `
                <div style="background: white; padding: 30px; border-radius: 10px; max-width: 600px; width: 90%;">
                    <h3 style="color: #1e3a5f; margin-bottom: 15px;">✅ Élève créé avec succès!</h3>
                    <p style="margin-bottom: 20px; color: #666;">Envoyez ce lien d'activation à l'élève pour qu'il puisse créer son mot de passe:</p>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; word-break: break-all; border: 2px solid #667eea;">
                        <strong style="color: #1e3a5f;">${data.activationLink}</strong>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <button id="sendEmailBtn-${data.id}" onclick="sendActivationEmail('${data.id}', '${data.email}', 'eleve', this)" style="width: 100%; padding: 12px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600; font-size: 1em;">
                            📧 Envoyer par email
                        </button>
                        <div style="display: flex; gap: 10px;">
                            <button onclick="navigator.clipboard.writeText('${data.activationLink}').then(() => showCustomAlert('Lien copié!', 'success'))" style="flex: 1; padding: 10px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
                                📋 Copier le lien
                            </button>
                            <button onclick="this.closest('div[style*=fixed]').remove()" style="flex: 1; padding: 10px; background: #1e3a5f; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            hideAddEleveForm();
            loadEleves();
        }
        } catch (error) {
            console.error('Erreur lors de l\'ajout de l\'élève:', error);
            showCustomAlert('Erreur lors de l\'ajout de l\'élève', 'error');
        }
    });
}

async function deleteEleve(id) {
    showCustomConfirm('Êtes-vous sûr de vouloir supprimer cet élève?', async () => {
        try {
            await fetch(`${API_URL}/eleves/${id}`, { 
                method: 'DELETE',
                headers: {
                    'x-user-role': currentUser.role,
                    'x-user-id': currentUser.id
                }
            });
            loadEleves();
            showCustomAlert('Élève supprimé avec succès', 'success');
        } catch (error) {
            console.error('Erreur lors de la suppression:', error);
            showCustomAlert('Erreur lors de la suppression', 'error');
        }
    });
}

// ==================== FONCTIONS PROFESSEURS ====================

async function loadProfesseurs() {
    try {
        const response = await fetch(`${API_URL}/professeurs`);
        professeurs = await response.json();
        displayProfesseurs();
    } catch (error) {
        console.error('Erreur lors du chargement des professeurs:', error);
    }
}

function displayProfesseurs() {
    const tbody = document.getElementById('profs-tbody');
    if (!tbody) {
        console.warn('Élément profs-tbody non trouvé');
        return;
    }
    tbody.innerHTML = '';
    
    professeurs.forEach(prof => {
        const deleteBtn = hasPermission('delete_prof') 
            ? `<button class="btn btn-danger" onclick="deleteProf('${prof.id}')">Supprimer</button>`
            : '';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${prof.nom}</td>
            <td>${prof.prenom}</td>
            <td>${prof.matiere}</td>
            <td>${prof.telephone || '-'}</td>
            <td>${prof.email}</td>
            <td class="actions">
                ${deleteBtn}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function showAddProfForm() {
    document.getElementById('add-prof-form').style.display = 'block';
}

function hideAddProfForm() {
    document.getElementById('add-prof-form').style.display = 'none';
    document.getElementById('profForm').reset();
}

const profForm = document.getElementById('profForm');
if (profForm) {
    profForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nouveauProf = {
            nom: document.getElementById('prof-nom').value,
            prenom: document.getElementById('prof-prenom').value,
            matiere: document.getElementById('prof-matiere').value,
            telephone: document.getElementById('prof-telephone').value,
            email: document.getElementById('prof-email').value
        };
    
    try {
        const response = await fetch(`${API_URL}/professeurs`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-user-role': currentUser.role,
                'x-user-id': currentUser.id
            },
            body: JSON.stringify(nouveauProf)
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Créer une modal pour afficher le lien d'activation
            const modal = document.createElement('div');
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
            modal.innerHTML = `
                <div style="background: white; padding: 30px; border-radius: 10px; max-width: 600px; width: 90%;">
                    <h3 style="color: #1e3a5f; margin-bottom: 15px;">✅ Professeur créé avec succès!</h3>
                    <p style="margin-bottom: 20px; color: #666;">Envoyez ce lien d'activation au professeur pour qu'il puisse créer son mot de passe:</p>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; word-break: break-all; border: 2px solid #667eea;">
                        <strong style="color: #1e3a5f;">${data.activationLink}</strong>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <button id="sendEmailBtn-${data.id}" onclick="sendActivationEmail('${data.id}', '${data.email}', 'professeur', this)" style="width: 100%; padding: 12px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600; font-size: 1em;">
                            📧 Envoyer par email
                        </button>
                        <div style="display: flex; gap: 10px;">
                            <button onclick="navigator.clipboard.writeText('${data.activationLink}').then(() => showCustomAlert('Lien copié!', 'success'))" style="flex: 1; padding: 10px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
                                📋 Copier le lien
                            </button>
                            <button onclick="this.closest('div[style*=fixed]').remove()" style="flex: 1; padding: 10px; background: #1e3a5f; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            hideAddProfForm();
            loadProfesseurs();
        }
    } catch (error) {
        console.error('Erreur lors de l\'ajout du professeur:', error);
        showCustomAlert('Erreur lors de l\'ajout du professeur', 'error');
    }
    });
}

async function deleteProf(id) {
    showCustomConfirm('Êtes-vous sûr de vouloir supprimer ce professeur?', async () => {
        try {
            await fetch(`${API_URL}/professeurs/${id}`, {
                method: 'DELETE',
                headers: {
                    'x-user-role': currentUser.role,
                    'x-user-id': currentUser.id
                }
            });
            loadProfesseurs();
            showCustomAlert('Professeur supprimé avec succès', 'success');
        } catch (error) {
            console.error('Erreur lors de la suppression:', error);
            showCustomAlert('Erreur lors de la suppression', 'error');
        }
    });
}
// ==================== FONCTIONS CLASSES ====================

async function loadClasses() {
    try {
        const response = await fetch(`${API_URL}/classes`, {
            headers: {
                'x-user-role': currentUser.role,
                'x-user-id': currentUser.id
            }
        });
        classes = await response.json();
        displayClasses();
    } catch (error) {
        console.error('Erreur lors du chargement des classes:', error);
    }
}

function displayClasses() {
    const container = document.getElementById('classes-list');
    container.innerHTML = '';
    
    classes.forEach(classe => {
        const prof = professeurs.find(p => p.id === classe.professeurId);
        const profName = prof ? `${prof.nom} ${prof.prenom}` : 'Non assigné';
        
        const editBtn = hasPermission('create_class') 
            ? `<button class="btn btn-primary" onclick="event.stopPropagation(); editClasse('${classe.id}')" style="margin-right: 5px;">✏️ Modifier</button>`
            : '';
        
        const deleteBtn = hasPermission('delete_class') 
            ? `<button class="btn btn-danger" onclick="event.stopPropagation(); deleteClasse('${classe.id}')">Supprimer</button>`
            : '';
        
        const card = document.createElement('div');
        card.className = 'classe-card';
        card.style.cursor = 'pointer';
        card.innerHTML = `
            <h3>${classe.nom}</h3>
            <p><strong>Niveau:</strong> ${classe.niveau}</p>
            <p><strong>Professeur:</strong> ${profName}</p>
            <div class="actions">
                ${editBtn}
                ${deleteBtn}
            </div>
        `;
        
        // Ajouter l'événement de clic sur la carte
        card.addEventListener('click', () => showClasseDetails(classe.id));
        
        container.appendChild(card);
    });
}

// Modifier une classe existante
function editClasse(classeId) {
    const classe = classes.find(c => c.id === classeId);
    if (!classe) return;
    
    // Pré-remplir le formulaire avec les données existantes
    document.getElementById('classe-nom').value = classe.nom;
    document.getElementById('classe-niveau').value = classe.niveau;
    
    // Charger les professeurs et sélectionner le professeur actuel
    loadProfsInSelect('classe-professeur').then(() => {
        document.getElementById('classe-professeur').value = classe.professeurId || '';
    });
    
    // Modifier le titre et le bouton du formulaire
    document.querySelector('#add-classe-form h3').textContent = 'Modifier la classe';
    
    // Stocker l'ID de la classe en cours d'édition
    document.getElementById('classeForm').dataset.editId = classeId;
    
    // Afficher le formulaire
    document.getElementById('add-classe-form').style.display = 'block';
}

// Afficher les détails d'une classe avec ses élèves
async function showClasseDetails(classeId) {
    const classe = classes.find(c => c.id === classeId);
    if (!classe) return;
    
    const prof = professeurs.find(p => p.id === classe.professeurId);
    const profName = prof ? `${prof.nom} ${prof.prenom}` : 'Non assigné';
    
    // Récupérer les élèves de cette classe
    const classeEleves = eleves.filter(e => e.classe === classe.nom);
    
    // Créer la liste des élèves
    let elevesHTML = '';
    if (classeEleves.length === 0) {
        elevesHTML = '<p style="color: #666; text-align: center; padding: 20px; font-style: italic;">👥 Aucun élève dans cette classe</p>';
    } else {
        elevesHTML = `
            <div style="max-height: 400px; overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead style="background: #f8f9fa; position: sticky; top: 0;">
                        <tr>
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">👤 Nom</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">👤 Prénom</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">📅 Date de naissance</th>
                            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #dee2e6;">📊 Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${classeEleves.map(eleve => `
                            <tr style="border-bottom: 1px solid #dee2e6; transition: background 0.2s;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='white'">
                                <td style="padding: 12px;">${eleve.nom}</td>
                                <td style="padding: 12px;">${eleve.prenom}</td>
                                <td style="padding: 12px;">${new Date(eleve.dateNaissance).toLocaleDateString('fr-FR')}</td>
                                <td style="padding: 12px; text-align: center;">
                                    <button onclick="event.stopPropagation(); document.querySelector('div[style*=fixed]').remove(); showEleveDetails('${eleve.id}')" style="padding: 6px 12px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em;">
                                        👁️ Voir détails
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    // Créer la modal
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; overflow-y: auto; padding: 20px;';
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; max-width: 900px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <h2 style="color: #1e3a5f; margin-bottom: 25px; display: flex; align-items: center; gap: 10px;">
                <span>🎓</span> Détails de la classe
            </h2>
            
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; margin-bottom: 25px; color: white;">
                <h3 style="margin: 0 0 15px 0; font-size: 1.5em;">${classe.nom}</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    <div>
                        <div style="opacity: 0.9; font-size: 0.9em; margin-bottom: 5px;">📚 Niveau</div>
                        <div style="font-weight: 600;">${classe.niveau}</div>
                    </div>
                    <div>
                        <div style="opacity: 0.9; font-size: 0.9em; margin-bottom: 5px;">👨‍🏫 Professeur</div>
                        <div style="font-weight: 600;">${profName}</div>
                    </div>
                    <div>
                        <div style="opacity: 0.9; font-size: 0.9em; margin-bottom: 5px;">👥 Nombre d'élèves</div>
                        <div style="font-weight: 600;">${classeEleves.length} élève${classeEleves.length > 1 ? 's' : ''}</div>
                    </div>
                </div>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="color: #1e3a5f; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                    <span>👥</span> Liste des élèves
                </h3>
                ${elevesHTML}
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="this.closest('div[style*=fixed]').remove()" style="padding: 12px 24px; background: #1e3a5f; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600; font-size: 1em;">
                    Fermer
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Fermer en cliquant en dehors
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function showAddClasseForm() {
    document.getElementById('add-classe-form').style.display = 'block';
    document.querySelector('#add-classe-form h3').textContent = 'Nouvelle Classe';
    document.getElementById('classeForm').removeAttribute('data-edit-id');
    loadProfsInSelect('classe-professeur');
}

function hideAddClasseForm() {
    document.getElementById('add-classe-form').style.display = 'none';
    document.getElementById('classeForm').reset();
    document.getElementById('classeForm').removeAttribute('data-edit-id');
    document.querySelector('#add-classe-form h3').textContent = 'Nouvelle Classe';
}

const classeForm = document.getElementById('classeForm');
if (classeForm) {
    classeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const classeData = {
            nom: document.getElementById('classe-nom').value,
            niveau: document.getElementById('classe-niveau').value,
            professeurId: document.getElementById('classe-professeur').value
        };
    
    const editId = e.target.dataset.editId;
    
    try {
        let response;
        if (editId) {
            // Mode édition
            response = await fetch(`${API_URL}/classes/${editId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-role': currentUser.role,
                    'x-user-id': currentUser.id
                },
                body: JSON.stringify(classeData)
            });
            
            if (response.ok) {
                showCustomAlert('Classe modifiée avec succès!', 'success');
                hideAddClasseForm();
                loadClasses();
            }
        } else {
            // Mode création
            response = await fetch(`${API_URL}/classes`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-role': currentUser.role,
                    'x-user-id': currentUser.id
                },
                body: JSON.stringify(classeData)
            });
            
            if (response.ok) {
                showCustomAlert('Classe ajoutée avec succès!', 'success');
                hideAddClasseForm();
                loadClasses();
            }
        }
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de la classe:', error);
        showCustomAlert('Erreur lors de la sauvegarde de la classe', 'error');
    }
    });
}

async function deleteClasse(id) {
    showCustomConfirm('Êtes-vous sûr de vouloir supprimer cette classe?', async () => {
        try {
            await fetch(`${API_URL}/classes/${id}`, {
                method: 'DELETE',
                headers: {
                    'x-user-role': currentUser.role,
                    'x-user-id': currentUser.id
                }
            });
            loadClasses();
            showCustomAlert('Classe supprimée avec succès', 'success');
        } catch (error) {
            console.error('Erreur lors de la suppression:', error);
            showCustomAlert('Erreur lors de la suppression', 'error');
        }
    });
}

// ==================== FONCTIONS APPRÉCIATIONS ====================

let appreciationEleves = [];

async function loadAppreciations() {
    // Charger les classes dans le select
    const select = document.getElementById('appreciation-classe-select');
    select.innerHTML = '<option value="">— Choisir une classe —</option>';
    
    classes.forEach(classe => {
        const option = document.createElement('option');
        option.value = classe.nom;
        option.textContent = classe.nom;
        select.appendChild(option);
    });
    
    // Charger et afficher les appréciations existantes
    try {
        const response = await fetch(`${API_URL}/appreciations`, {
            headers: {
                'x-user-role': currentUser.role,
                'x-user-id': currentUser.id
            }
        });
        appreciations = await response.json();
        displayAppreciations();
    } catch (error) {
        console.error('Erreur lors du chargement des appréciations:', error);
    }
}

function displayAppreciations() {
    const tbody = document.getElementById('appreciations-tbody');
    tbody.innerHTML = '';
    
    const roleLabels = {
        'admin': '👑 Administrateur',
        'directeur': '🎯 Directeur',
        'secretariat': '📋 Secrétariat',
        'professeur': '👨‍🏫 Professeur'
    };
    
    appreciations.forEach(appreciation => {
        const eleve = eleves.find(e => e.id === appreciation.eleveId);
        
        // Rechercher le professeur
        const prof = professeurs.find(p => p.id === appreciation.professeurId);
        let createdBy = '';
        
        if (prof) {
            // C'est un professeur
            createdBy = `👨‍🏫 ${prof.nom} ${prof.prenom}`;
        } else {
            // Ce n'est pas un professeur, afficher le rôle
            // On recherche dans les comptes staff (admin, directeur, secretariat)
            if (appreciation.professeurId === currentUser.id) {
                createdBy = roleLabels[currentUser.role] || currentUser.role;
            } else {
                // Essayer de déterminer le rôle depuis l'ID
                createdBy = '👤 Staff';
            }
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${eleve ? `${eleve.nom} ${eleve.prenom}` : 'Élève inconnu'}</td>
            <td>${eleve ? eleve.classe : '-'}</td>
            <td>${appreciation.matiere}</td>
            <td>${appreciation.periode}</td>
            <td>${appreciation.note || '-'}</td>
            <td>${createdBy}</td>
            <td>${appreciation.commentaire}</td>
            <td class="actions">
                <button class="btn btn-danger" onclick="deleteAppreciation('${appreciation.id}')">Supprimer</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function loadElevesForAppreciation() {
    const classeNom = document.getElementById('appreciation-classe-select').value;
    const matiere = document.getElementById('appreciation-matiere-input').value;
    
    if (!classeNom) {
        document.getElementById('appreciation-eleves-list').style.display = 'none';
        return;
    }
    
    if (!matiere) {
        showCustomAlert('Veuillez saisir une matière', 'warning');
        return;
    }
    
    // Charger les élèves de la classe
    appreciationEleves = eleves.filter(e => e.classe === classeNom);
    
    if (appreciationEleves.length === 0) {
        showCustomAlert('Aucun élève dans cette classe');
        return;
    }
    
    // Afficher la liste
    document.getElementById('appreciation-classe-nom').textContent = `Classe: ${classeNom} - Matière: ${matiere}`;
    document.getElementById('appreciation-eleves-list').style.display = 'block';
    
    const tbody = document.getElementById('appreciation-eleves-tbody');
    tbody.innerHTML = '';
    
    appreciationEleves.forEach(eleve => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                ${eleve.nom} ${eleve.prenom}
                <input type="hidden" class="eleve-id" value="${eleve.id}">
            </td>
            <td>
                <input type="number" class="eleve-note" min="0" max="20" step="0.5" 
                       placeholder="Note" style="width: 80px; padding: 5px;">
            </td>
            <td>
                <textarea class="eleve-commentaire" rows="2" 
                          placeholder="Commentaire..." style="width: 100%; padding: 5px;"></textarea>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function hideAppreciationsList() {
    document.getElementById('appreciation-eleves-list').style.display = 'none';
    document.getElementById('appreciation-classe-select').value = '';
    document.getElementById('appreciation-matiere-input').value = '';
}

// Gestionnaire du formulaire d'appréciations en masse
document.getElementById('appreciationsBulkForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const periode = document.getElementById('appreciation-periode-select').value;
    const matiere = document.getElementById('appreciation-matiere-input').value;
    const tbody = document.getElementById('appreciation-eleves-tbody');
    const rows = tbody.querySelectorAll('tr');
    
    const appreciationsToSave = [];
    
    rows.forEach(row => {
        const eleveId = row.querySelector('.eleve-id').value;
        const note = row.querySelector('.eleve-note').value;
        const commentaire = row.querySelector('.eleve-commentaire').value;
        
        // Sauvegarder seulement si un commentaire ou une note est renseigné
        if (commentaire.trim() || note) {
            appreciationsToSave.push({
                eleveId,
                professeurId: currentUser.id,
                createdByRole: currentUser.role,
                matiere,
                periode,
                note: note || null,
                commentaire: commentaire.trim() || 'Aucun commentaire'
            });
        }
    });
    
    if (appreciationsToSave.length === 0) {
        showCustomAlert('Veuillez renseigner au moins une appréciation (note ou commentaire)', 'warning');
        return;
    }
    
    // Enregistrer toutes les appréciations
    try {
        let successCount = 0;
        for (const appreciation of appreciationsToSave) {
            const response = await fetch(`${API_URL}/appreciations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(appreciation)
            });
            if (response.ok) successCount++;
        }
        
        showCustomAlert(`${successCount} appréciation(s) enregistrée(s) avec succès!`, 'success');
        hideAppreciationsList();
        loadAppreciations();
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement des appréciations:', error);
        showCustomAlert('Erreur lors de l\'enregistrement', 'error');
    }
});

async function deleteAppreciation(id) {
    showCustomConfirm('Êtes-vous sûr de vouloir supprimer cette appréciation?', async () => {
        try {
            await fetch(`${API_URL}/appreciations/${id}`, { method: 'DELETE' });
            loadAppreciations();
        } catch (error) {
            console.error('Erreur lors de la suppression:', error);
        }
    });
}

// ==================== FONCTIONS UTILITAIRES ====================

async function loadClassesInSelect(selectId) {
    if (classes.length === 0) {
        await loadClasses();
    }
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Sélectionner une classe</option>';
    classes.forEach(classe => {
        const option = document.createElement('option');
        option.value = classe.nom;
        option.textContent = classe.nom;
        select.appendChild(option);
    });
}

async function loadElevesInSelect(selectId) {
    if (eleves.length === 0) {
        await loadEleves();
    }
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Sélectionner un élève</option>';
    eleves.forEach(eleve => {
        const option = document.createElement('option');
        option.value = eleve.id;
        option.textContent = `${eleve.nom} ${eleve.prenom}`;
        select.appendChild(option);
    });
}

async function loadProfsInSelect(selectId) {
    if (professeurs.length === 0) {
        await loadProfesseurs();
    }
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Sélectionner un professeur</option>';
    professeurs.forEach(prof => {
        const option = document.createElement('option');
        option.value = prof.id;
        option.textContent = `${prof.nom} ${prof.prenom}`;
        select.appendChild(option);
    });
}

// ==================== FONCTIONS APPEL (ANCIEN - DÉSACTIVÉ) ====================

function loadAppelInterface() {
    // Charger les classes dans le select
    const select = document.getElementById('appel-classe-select');
    select.innerHTML = '<option value="">-- Choisir une classe --</option>';
    
    // Pour admin, directeur et secretariat: afficher toutes les classes
    // Pour professeur: afficher uniquement leurs classes
    let classesToDisplay = classes;
    if (currentUser.role === 'professeur') {
        classesToDisplay = classes.filter(c => c.professeurId === currentUser.id);
    }
    
    classesToDisplay.forEach(classe => {
        const option = document.createElement('option');
        option.value = classe.nom;
        option.textContent = classe.nom;
        select.appendChild(option);
    });
    
    // Définir la date du jour par défaut
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('appel-date').value = today;
}

async function loadClasseAppel() {
    const classeNom = document.getElementById('appel-classe-select').value;
    
    if (!classeNom) {
        document.getElementById('appel-liste').style.display = 'none';
        return;
    }
    
    // Charger les élèves de la classe
    appelEleves = eleves.filter(e => e.classe === classeNom);
    appelData = {};
    
    // Afficher la liste
    document.getElementById('appel-classe-nom').textContent = `Classe: ${classeNom}`;
    document.getElementById('appel-liste').style.display = 'block';
    
    const tbody = document.getElementById('appel-tbody');
    tbody.innerHTML = '';
    
    appelEleves.sort((a, b) => a.nom.localeCompare(b.nom));
    
    appelEleves.forEach(eleve => {
        // Initialiser comme présent par défaut
        appelData[eleve.id] = 'present';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${eleve.nom} ${eleve.prenom}</strong></td>
            <td style="text-align: center;">
                <input type="radio" name="statut-${eleve.id}" value="present" checked 
                       onchange="updateAppelStatut('${eleve.id}', 'present')"
                       style="width: 20px; height: 20px; cursor: pointer;">
            </td>
            <td style="text-align: center;">
                <input type="radio" name="statut-${eleve.id}" value="absent"
                       onchange="updateAppelStatut('${eleve.id}', 'absent')"
                       style="width: 20px; height: 20px; cursor: pointer;">
            </td>
            <td style="text-align: center;">
                <input type="radio" name="statut-${eleve.id}" value="retard"
                       onchange="updateAppelStatut('${eleve.id}', 'retard')"
                       style="width: 20px; height: 20px; cursor: pointer;">
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateAppelStatut(eleveId, statut) {
    appelData[eleveId] = statut;
}

async function enregistrerAppel() {
    const date = document.getElementById('appel-date').value;
    const classeNom = document.getElementById('appel-classe-select').value;
    
    if (!date || !classeNom) {
        showCustomAlert('Veuillez sélectionner une classe et une date', 'warning');
        return;
    }
    
    // Créer les absences seulement pour les élèves absents ou en retard
    const absencesACreer = [];
    
    for (const eleveId in appelData) {
        const statut = appelData[eleveId];
        
        if (statut === 'absent' || statut === 'retard') {
            absencesACreer.push({
                eleveId: eleveId,
                date: date,
                type: statut === 'absent' ? 'Non justifiée' : 'Retard',
                motif: `Appel du ${new Date(date).toLocaleDateString('fr-FR')} - Classe ${classeNom}`
            });
        }
    }
    
    if (absencesACreer.length === 0) {
        showCustomAlert(`✓ Tous les élèves sont présents !`, 'success');
        return;
    }
    
    // Enregistrer toutes les absences
    try {
        let compteur = 0;
        for (const absence of absencesACreer) {
            const response = await fetch(`${API_URL}/absences`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-role': currentUser.role,
                    'x-user-id': currentUser.id
                },
                body: JSON.stringify(absence)
            });
            
            if (response.ok) {
                compteur++;
            }
        }
        
        showCustomAlert(`✓ Appel enregistré avec succès!\n${compteur} absence(s) enregistrée(s)`, 'success');
        
        // Réinitialiser l'interface
        document.getElementById('appel-classe-select').value = '';
        document.getElementById('appel-liste').style.display = 'none';
        
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement de l\'appel:', error);
        showCustomAlert('Erreur lors de l\'enregistrement de l\'appel', 'error');
    }
}

// Fonction de déconnexion
function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

// Charger les données initiales pour tous les utilisateurs authentifiés
if (currentUser) {
    loadEleves();
    loadProfesseurs();
    loadClasses();
}

// ==================== FONCTIONS APPEL ====================

let appelData = [];

async function loadElevesForAppel() {
    const classeSelect = document.getElementById('appel-classe');
    const classe = classeSelect.value;
    
    if (!classe) {
        document.getElementById('appel-list').style.display = 'none';
        return;
    }
    
    const elevesClasse = eleves.filter(e => e.classe === classe);
    appelData = elevesClasse.map(e => ({ ...e, statut: null }));
    
    displayAppel();
    document.getElementById('appel-list').style.display = 'block';
}

function displayAppel() {
    const tbody = document.getElementById('appel-tbody');
    tbody.innerHTML = '';
    
    appelData.forEach((eleve, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${eleve.nom}</td>
            <td>${eleve.prenom}</td>
            <td class="appel-row">
                <button class="appel-btn ${eleve.statut === 'present' ? 'present' : 'inactive'}" 
                        onclick="setStatut(${index}, 'present')">✓ Présent</button>
                <button class="appel-btn ${eleve.statut === 'absent' ? 'absent' : 'inactive'}" 
                        onclick="setStatut(${index}, 'absent')">✗ Absent</button>
                <button class="appel-btn ${eleve.statut === 'retard' ? 'retard' : 'inactive'}" 
                        onclick="setStatut(${index}, 'retard')">⌛ Retard</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function setStatut(index, statut) {
    appelData[index].statut = statut;
    displayAppel();
}

async function saveAppel() {
    const absents = appelData.filter(e => e.statut === 'absent' || e.statut === 'retard');
    
    if (absents.length === 0) {
        showCustomAlert('Aucune absence ou retard à enregistrer', 'info');
        return;
    }
    
    try {
        for (const eleve of absents) {
            const absence = {
                eleveId: eleve.id,
                date: new Date().toISOString().split('T')[0],
                type: eleve.statut === 'absent' ? 'Non justifiée' : 'Retard',
                motif: 'Enregistré lors de l\'appel'
            };
            
            await fetch(`${API_URL}/absences`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-role': currentUser.role,
                    'x-user-id': currentUser.id
                },
                body: JSON.stringify(absence)
            });
        }
        
        showCustomAlert(`${absents.length} absence(s) enregistrée(s) avec succès!`, 'success');
        document.getElementById('appel-classe').value = '';
        document.getElementById('appel-list').style.display = 'none';
        appelData = [];
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement:', error);
        showCustomAlert('Erreur lors de l\'enregistrement de l\'appel', 'error');
    }
}

// ==================== FONCTIONS MESSAGERIE (STYLE WHATSAPP) ====================

let conversations = [];
let currentChatId = null;
let allContacts = [];
let messagePollingInterval = null;

// Charger les contacts disponibles
async function loadContacts() {
    try {
        const response = await fetch(`${API_URL}/messagerie/destinataires`, {
            headers: {
                'x-user-role': currentUser.role,
                'x-user-id': currentUser.id
            }
        });
        allContacts = await response.json();
    } catch (error) {
        console.error('Erreur lors du chargement des contacts:', error);
    }
}

// Charger toutes les conversations
async function loadConversations() {
    try {
        const response = await fetch(`${API_URL}/messagerie`, {
            headers: {
                'x-user-role': currentUser.role,
                'x-user-id': currentUser.id
            }
        });
        const messages = await response.json();
        
        // Grouper les messages par conversation
        const conversationsMap = new Map();
        
        messages.forEach(msg => {
            const otherId = msg.expediteurId === currentUser.id ? msg.destinataireId : msg.expediteurId;
            const otherName = msg.expediteurId === currentUser.id ? msg.destinataireNom : msg.expediteurNom;
            
            if (!conversationsMap.has(otherId)) {
                conversationsMap.set(otherId, {
                    userId: otherId,
                    userName: otherName,
                    messages: [],
                    unreadCount: 0,
                    lastMessage: null,
                    lastTime: null
                });
            }
            
            const conv = conversationsMap.get(otherId);
            conv.messages.push(msg);
            
            // Compter les non lus (messages reçus)
            if (msg.destinataireId === currentUser.id && !msg.lu) {
                conv.unreadCount++;
            }
            
            // Dernier message
            if (!conv.lastTime || new Date(msg.date) > new Date(conv.lastTime)) {
                conv.lastTime = msg.date;
                conv.lastMessage = msg.contenu;
            }
        });
        
        conversations = Array.from(conversationsMap.values());
        conversations.sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
        
        displayConversations();
    } catch (error) {
        console.error('Erreur lors du chargement des conversations:', error);
    }
}

// Afficher la liste des conversations
function displayConversations() {
    const container = document.getElementById('conversations-list');
    
    if (conversations.length === 0) {
        container.innerHTML = '<div style=\"padding: 20px; text-align: center; color: #999;\">Aucune conversation</div>';
        return;
    }
    
    container.innerHTML = '';
    
    conversations.forEach(conv => {
        const div = document.createElement('div');
        div.className = `conversation-item ${currentChatId === conv.userId ? 'active' : ''} ${conv.unreadCount > 0 ? 'unread' : ''}`;
        div.onclick = () => openChat(conv.userId, conv.userName);
        
        const initials = conv.userName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        
        div.innerHTML = `
            <div class="conversation-avatar">${initials}</div>
            <div class="conversation-info">
                <div class="conversation-header-row">
                    <span class="conversation-name">${conv.userName}</span>
                    <span class="conversation-time">${formatMessageTime(conv.lastTime)}</span>
                </div>
                <div class="conversation-preview">${conv.lastMessage || 'Aucun message'}</div>
            </div>
            ${conv.unreadCount > 0 ? `<div class="conversation-unread-badge">${conv.unreadCount}</div>` : ''}
        `;
        
        container.appendChild(div);
    });
}

// Ouvrir une conversation
async function openChat(userId, userName) {
    currentChatId = userId;
    
    // Marquer tous les messages de cette conversation comme lus
    const conv = conversations.find(c => c.userId === userId);
    if (conv) {
        for (const msg of conv.messages) {
            if (msg.destinataireId === currentUser.id && !msg.lu) {
                await fetch(`${API_URL}/messagerie/${msg.id}/lu`, {
                    method: 'PUT',
                    headers: {
                        'x-user-role': currentUser.role,
                        'x-user-id': currentUser.id
                    }
                });
                msg.lu = true;
            }
        }
        conv.unreadCount = 0;
    }
    
    // Afficher le chat
    document.getElementById('chat-empty').style.display = 'none';
    document.getElementById('chat-active').style.display = 'flex';
    
    const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    document.getElementById('chat-name').textContent = userName;
    document.querySelector('.chat-avatar').textContent = initials;
    
    displayChatMessages(userId);
    displayConversations();
    
    // Focus sur l'input
    document.getElementById('chat-input').focus();
    
    // Polling pour les nouveaux messages
    if (messagePollingInterval) clearInterval(messagePollingInterval);
    messagePollingInterval = setInterval(() => loadConversations(), 5000);
}

// Afficher les messages d'une conversation
function displayChatMessages(userId) {
    const container = document.getElementById('chat-messages');
    const conv = conversations.find(c => c.userId === userId);
    
    if (!conv) return;
    
    container.innerHTML = '';
    
    conv.messages.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    conv.messages.forEach(msg => {
        const div = document.createElement('div');
        const isSent = msg.expediteurId === currentUser.id;
        div.className = `message-bubble ${isSent ? 'message-sent' : 'message-received'}`;
        
        div.innerHTML = `
            <div class="message-content">${msg.contenu}</div>
            <div class="message-time">${formatMessageTime(msg.date)} ${isSent ? '✓' : ''}</div>
        `;
        
        container.appendChild(div);
    });
    
    // Scroll vers le bas
    container.scrollTop = container.scrollHeight;
}

// Envoyer un message
async function sendMessage(event) {
    event.preventDefault();
    
    const input = document.getElementById('chat-input');
    const contenu = input.value.trim();
    
    if (!contenu || !currentChatId) return;
    
    try {
        const response = await fetch(`${API_URL}/messagerie`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-user-role': currentUser.role,
                'x-user-id': currentUser.id
            },
            body: JSON.stringify({
                expediteurId: currentUser.id,
                destinataireId: currentChatId,
                contenu: contenu
            })
        });
        
        if (response.ok) {
            input.value = '';
            await loadConversations();
            displayChatMessages(currentChatId);
        }
    } catch (error) {
        console.error('Erreur lors de l\'envoi:', error);
        showCustomAlert('Erreur lors de l\'envoi du message', 'error');
    }
}

// Fermer le chat
function closeChat() {
    currentChatId = null;
    document.getElementById('chat-empty').style.display = 'flex';
    document.getElementById('chat-active').style.display = 'none';
    displayConversations();
    
    if (messagePollingInterval) {
        clearInterval(messagePollingInterval);
        messagePollingInterval = null;
    }
}

// Afficher le modal nouvelle conversation
function showNewConversationModal() {
    loadContactsInModal();
    document.getElementById('new-conversation-modal').style.display = 'flex';
}

// Fermer le modal
function closeNewConversationModal() {
    document.getElementById('new-conversation-modal').style.display = 'none';
}

// Charger les contacts dans le modal
async function loadContactsInModal() {
    await loadContacts();
    
    const container = document.getElementById('contacts-list');
    container.innerHTML = '';
    
    allContacts.forEach(contact => {
        const div = document.createElement('div');
        div.className = 'contact-item';
        div.onclick = () => startNewConversation(contact.id, contact.nom);
        
        const initials = contact.nom.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        
        div.innerHTML = `
            <div class="contact-avatar">${initials}</div>
            <div class="contact-info">
                <div class="contact-name">${contact.nom}</div>
                <div class="contact-role">${contact.role}</div>
            </div>
        `;
        
        container.appendChild(div);
    });
}

// Démarrer une nouvelle conversation
function startNewConversation(userId, userName) {
    closeNewConversationModal();
    
    // Vérifier si la conversation existe déjà
    const existingConv = conversations.find(c => c.userId === userId);
    
    if (existingConv) {
        openChat(userId, userName);
    } else {
        // Créer une nouvelle conversation vide
        conversations.unshift({
            userId: userId,
            userName: userName,
            messages: [],
            unreadCount: 0,
            lastMessage: null,
            lastTime: new Date().toISOString()
        });
        displayConversations();
        openChat(userId, userName);
    }
}

// Filtrer les conversations
function filterConversations() {
    const search = document.getElementById('search-conversations').value.toLowerCase();
    const items = document.querySelectorAll('.conversation-item');
    
    items.forEach(item => {
        const name = item.querySelector('.conversation-name').textContent.toLowerCase();
        item.style.display = name.includes(search) ? 'flex' : 'none';
    });
}

// Filtrer les contacts
function filterContacts() {
    const search = document.getElementById('search-contacts').value.toLowerCase();
    const items = document.querySelectorAll('.contact-item');
    
    items.forEach(item => {
        const name = item.querySelector('.contact-name').textContent.toLowerCase();
        item.style.display = name.includes(search) ? 'flex' : 'none';
    });
}

// Formater l'heure du message
function formatMessageTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    // Moins de 24h : afficher l'heure
    if (diff < 24 * 60 * 60 * 1000) {
        return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    
    // Moins d'une semaine : afficher le jour
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        return days[date.getDay()];
    }
    
    // Plus ancien : afficher la date
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

async function loadMessages() {
    try {
        const response = await fetch(`${API_URL}/messagerie`, {
            headers: {
                'x-user-role': currentUser.role,
                'x-user-id': currentUser.id
            }
        });
        messages = await response.json();
        displayMessages();
    } catch (error) {
        console.error('Erreur lors du chargement des messages:', error);
    }
}

function displayMessages() {
    const container = document.getElementById('messages-list');
    const filteredMessages = currentMessageTab === 'received' 
        ? messages.filter(m => m.destinataireId === currentUser.id)
        : messages.filter(m => m.expediteurId === currentUser.id);
    
    if (filteredMessages.length === 0) {
        container.innerHTML = `
            <div class="empty-messages">
                <div class="empty-messages-icon">📩</div>
                <div class="empty-messages-text">Aucun message</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    filteredMessages.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    filteredMessages.forEach(message => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-item ${!message.lu && currentMessageTab === 'received' ? 'unread' : ''}`;
        messageDiv.onclick = () => showMessageDetail(message.id);
        
        const fromName = currentMessageTab === 'received' ? message.expediteurNom : message.destinataireNom;
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-from">${fromName}</span>
                <span class="message-date">${new Date(message.date).toLocaleDateString('fr-FR', { 
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
                })}</span>
            </div>
            <div class="message-subject">${message.objet}</div>
            <div class="message-preview">${message.contenu}</div>
        `;
        container.appendChild(messageDiv);
    });
}

async function showMessageDetail(messageId) {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    // Marquer comme lu
    if (!message.lu && message.destinataireId === currentUser.id) {
        await fetch(`${API_URL}/messagerie/${messageId}/lu`, {
            method: 'PUT',
            headers: {
                'x-user-role': currentUser.role,
                'x-user-id': currentUser.id
            }
        });
        message.lu = true;
    }
    
    const container = document.getElementById('messages-list');
    container.innerHTML = `
        <div class="message-detail">
            <button class="btn btn-secondary" onclick="loadMessages()" style="margin-bottom: 20px;">← Retour</button>
            <div class="message-detail-header">
                <div class="message-detail-subject">${message.objet}</div>
                <div class="message-detail-meta">
                    <span><strong>De:</strong> ${message.expediteurNom}</span>
                    <span><strong>À:</strong> ${message.destinataireNom}</span>
                    <span><strong>Date:</strong> ${new Date(message.date).toLocaleString('fr-FR')}</span>
                </div>
            </div>
            <div class="message-detail-content">${message.contenu.replace(/\n/g, '<br>')}</div>
        </div>
    `;
}

// ==================== FONCTION ENVOI D'EMAIL D'ACTIVATION ====================

async function sendActivationEmail(userId, email, type, button) {
    // Désactiver le bouton pendant l'envoi
    if (button) {
        button.disabled = true;
        button.textContent = '⏳ Envoi en cours...';
    }
    
    try {
        const response = await fetch(`${API_URL}/send-activation-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-role': currentUser.role,
                'x-user-id': currentUser.id
            },
            body: JSON.stringify({ userId, email, type })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            if (button) {
                button.textContent = '✅ Email envoyé!';
                button.style.background = '#28a745';
            }
            showCustomAlert(`Email envoyé avec succès à ${email}`, 'success');
        } else {
            if (button) {
                button.textContent = '❌ Échec de l\'envoi';
                button.style.background = '#dc3545';
            }
            showCustomAlert(result.error || 'Erreur lors de l\'envoi de l\'email', 'error');
            // Réactiver après 2 secondes
            if (button) {
                setTimeout(() => {
                    button.disabled = false;
                    button.textContent = '📧 Envoyer par email';
                    button.style.background = '#28a745';
                }, 2000);
            }
        }
    } catch (error) {
        console.error('Erreur lors de l\'envoi de l\'email:', error);
        if (button) {
            button.textContent = '❌ Échec de l\'envoi';
            button.style.background = '#dc3545';
        }
        showCustomAlert('Erreur lors de l\'envoi de l\'email', 'error');
        // Réactiver après 2 secondes
        if (button) {
            setTimeout(() => {
                button.disabled = false;
                button.textContent = '📧 Envoyer par email';
                button.style.background = '#28a745';
            }, 2000);
        }
    }
}

// Modal d'activation générique pour élèves
function showActivationModal(data, type) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; max-width: 600px; width: 90%;">
            <h3 style="color: #1e3a5f; margin-bottom: 15px;">✅ ${type === 'eleve' ? 'Élève' : 'Professeur'} créé avec succès!</h3>
            <p style="margin-bottom: 20px; color: #666;">Envoyez ce lien d'activation pour créer un mot de passe:</p>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; word-break: break-all; border: 2px solid #667eea;">
                <strong style="color: #1e3a5f;">${data.activationLink}</strong>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button id="sendEmailBtn-${data.id}" onclick="sendActivationEmail('${data.id}', '${data.email}', '${type}', this)" style="width: 100%; padding: 12px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600; font-size: 1em;">
                    📧 Envoyer par email
                </button>
                <div style="display: flex; gap: 10px;">
                    <button onclick="navigator.clipboard.writeText('${data.activationLink}').then(() => showCustomAlert('Lien copié!', 'success'))" style="flex: 1; padding: 10px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
                        📋 Copier le lien
                    </button>
                    <button onclick="this.closest('div[style*=fixed]').remove()" style="flex: 1; padding: 10px; background: #1e3a5f; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// ==================== FONCTIONS DOSSIER D'INSCRIPTION ====================

// Afficher formulaire inscription solo
function showInscriptionSolo() {
    hideInscriptionFamille();
    const form = document.getElementById('inscription-solo-form');
    form.style.display = 'block';
    loadClassesInSelect('inscrip-solo-classe');
}

function hideInscriptionSolo() {
    const form = document.getElementById('inscription-solo-form');
    form.style.display = 'none';
    document.getElementById('inscriptionSoloForm').reset();
}

// Afficher formulaire inscription famille
function showInscriptionFamille() {
    hideInscriptionSolo();
    const form = document.getElementById('inscription-famille-form');
    form.style.display = 'block';
    generateFamilleFields();
}

function hideInscriptionFamille() {
    const form = document.getElementById('inscription-famille-form');
    form.style.display = 'none';
    document.getElementById('nombre-eleves-famille').value = 2;
}

// Générer les champs dynamiques pour la famille
function generateFamilleFields() {
    const nombre = parseInt(document.getElementById('nombre-eleves-famille').value) || 2;
    const container = document.getElementById('famille-fields-container');
    container.innerHTML = '';
    
    for (let i = 1; i <= nombre; i++) {
        const eleveDiv = document.createElement('div');
        eleveDiv.className = 'form-container';
        eleveDiv.style.marginBottom = '20px';
        eleveDiv.style.borderLeft = '4px solid #667eea';
        eleveDiv.innerHTML = `
            <h4 style="color: #667eea;">Élève ${i}</h4>
            <div class="form-row">
                <div class="form-group">
                    <label>Nom:</label>
                    <input type="text" id="famille-nom-${i}" required>
                </div>
                <div class="form-group">
                    <label>Prénom:</label>
                    <input type="text" id="famille-prenom-${i}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Date de naissance:</label>
                    <input type="date" id="famille-dateNaissance-${i}" required>
                </div>
                <div class="form-group">
                    <label>Classe:</label>
                    <select id="famille-classe-${i}">
                        <option value="">Sélectionner une classe</option>
                    </select>
                </div>
            </div>
        `;
        container.appendChild(eleveDiv);
        
        // Charger les classes dans le select
        loadClassesInSelect(`famille-classe-${i}`);
    }
}

// Soumettre inscription solo
const inscriptionSoloForm = document.getElementById('inscriptionSoloForm');
if (inscriptionSoloForm) {
    inscriptionSoloForm.addEventListener('submit', async (e) => {
        e.preventDefault();
    
    const eleveData = {
        id: `eleve_${Date.now()}`,
        nom: document.getElementById('inscrip-solo-nom').value,
        prenom: document.getElementById('inscrip-solo-prenom').value,
        dateNaissance: document.getElementById('inscrip-solo-dateNaissance').value,
        classe: document.getElementById('inscrip-solo-classe').value || null,
        telephone: document.getElementById('inscrip-solo-telephone').value,
        email: document.getElementById('inscrip-solo-email').value,
        enFamille: 0,
        nombreFamille: 1,
        familleLienId: null,
        photo: null
    };
    
    try {
        const response = await fetch(`${API_URL}/eleves`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-user-role': currentUser.role,
                'x-user-id': currentUser.id
            },
            body: JSON.stringify(eleveData)
        });
        
        if (response.ok) {
            const data = await response.json();
            showCustomAlert('Élève inscrit avec succès!', 'success');
            hideInscriptionSolo();
            loadInscriptions();
            loadEleves(); // Recharger la liste des élèves
            
            // Afficher modal avec lien d'activation
            if (data.activationLink) {
                showActivationModal(data, 'eleve');
            }
        } else {
            showCustomAlert('Erreur lors de l\'inscription', 'error');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showCustomAlert('Erreur lors de l\'inscription', 'error');
    }
    });
}

// Soumettre inscription famille
async function submitInscriptionFamille() {
    const nombre = parseInt(document.getElementById('nombre-eleves-famille').value);
    const telephone = document.getElementById('inscrip-famille-telephone').value;
    const email = document.getElementById('inscrip-famille-email').value;
    const familleLienId = `famille_${Date.now()}`;
    
    const eleves = [];
    
    // Valider et collecter les données de tous les élèves
    for (let i = 1; i <= nombre; i++) {
        const nom = document.getElementById(`famille-nom-${i}`).value;
        const prenom = document.getElementById(`famille-prenom-${i}`).value;
        const dateNaissance = document.getElementById(`famille-dateNaissance-${i}`).value;
        const classe = document.getElementById(`famille-classe-${i}`).value || null;
        
        if (!nom || !prenom || !dateNaissance) {
            showCustomAlert(`Veuillez remplir tous les champs pour l'élève ${i}`, 'warning');
            return;
        }
        
        eleves.push({
            id: `eleve_${Date.now()}_${i}`,
            nom,
            prenom,
            dateNaissance,
            classe,
            telephone,
            email,
            enFamille: 1,
            nombreFamille: nombre,
            familleLienId,
            photo: null
        });
    }
    
    try {
        let successCount = 0;
        const activationLinks = [];
        
        for (const eleve of eleves) {
            const response = await fetch(`${API_URL}/eleves`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-role': currentUser.role,
                    'x-user-id': currentUser.id
                },
                body: JSON.stringify(eleve)
            });
            
            if (response.ok) {
                successCount++;
                const data = await response.json();
                if (data.activationLink) {
                    activationLinks.push({ nom: eleve.nom, prenom: eleve.prenom, link: data.activationLink, id: data.id, email: eleve.email });
                }
            }
        }
        
        if (successCount === eleves.length) {
            showCustomAlert(`✅ Famille inscrite avec succès! ${successCount} élève(s) enregistré(s)`, 'success');
            hideInscriptionFamille();
            loadInscriptions();
            loadEleves(); // Recharger la liste des élèves
            
            // Afficher les liens d'activation pour toute la famille
            if (activationLinks.length > 0) {
                showFamilleActivationModal(activationLinks, email);
            }
        } else {
            showCustomAlert(`${successCount}/${eleves.length} élève(s) inscrit(s)`, 'warning');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showCustomAlert('Erreur lors de l\'inscription de la famille', 'error');
    }
}

// Modal d'activation pour une famille
function showFamilleActivationModal(activationLinks, email) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';
    
    let linksHtml = '';
    activationLinks.forEach(link => {
        linksHtml += `
            <div style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #667eea;">
                <strong style="color: #667eea;">${link.prenom} ${link.nom}</strong>
                <div style="margin-top: 8px; font-size: 0.9em; word-break: break-all; color: #666;">${link.link}</div>
                <button onclick="navigator.clipboard.writeText('${link.link}').then(() => showCustomAlert('Lien copié pour ${link.prenom}!', 'success'))" 
                    style="margin-top: 8px; padding: 8px 15px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 0.9em;">
                    📋 Copier
                </button>
            </div>
        `;
    });
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
            <h3 style="color: #667eea; margin-bottom: 20px;">👨‍👩‍👧‍👦 Liens d'activation de la famille</h3>
            <p style="color: #666; margin-bottom: 20px;">Voici les liens d'activation pour chaque membre de la famille:</p>
            ${linksHtml}
            <div style="margin-top: 25px; padding-top: 20px; border-top: 2px solid #e0e0e0;">
                <button id="sendAllEmailsBtn" onclick="sendAllFamilleEmails(${JSON.stringify(activationLinks).replace(/"/g, '&quot;')}, '${email}', this)" 
                    style="width: 100%; padding: 12px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600; font-size: 1em; margin-bottom: 10px;">
                    📧 Envoyer tous les liens par email
                </button>
                <button onclick="this.closest('div[style*=fixed]').remove()" 
                    style="width: 100%; padding: 12px; background: #1e3a5f; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
                    Fermer
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Envoyer tous les emails d'activation pour une famille
async function sendAllFamilleEmails(links, email, button) {
    button.disabled = true;
    button.textContent = '⏳ Envoi en cours...';
    
    try {
        let successCount = 0;
        
        for (const link of links) {
            const response = await fetch(`${API_URL}/send-activation-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: link.id,
                    email: email,
                    type: 'eleve',
                    activationLink: link.link,
                    nom: link.nom,
                    prenom: link.prenom
                })
            });
            
            if (response.ok) successCount++;
        }
        
        if (successCount === links.length) {
            button.textContent = '✅ Tous les emails envoyés!';
            button.style.background = '#28a745';
            showCustomAlert(`${successCount} email(s) envoyé(s) avec succès à ${email}`, 'success');
        } else {
            button.textContent = `⚠️ ${successCount}/${links.length} envoyés`;
            button.style.background = '#ffc107';
            showCustomAlert(`${successCount}/${links.length} email(s) envoyé(s)`, 'warning');
        }
    } catch (error) {
        console.error('Erreur:', error);
        button.textContent = '❌ Échec';
        button.style.background = '#dc3545';
        showCustomAlert('Erreur lors de l\'envoi des emails', 'error');
    }
}

// Charger la liste des inscriptions
async function loadInscriptions() {
    try {
        const response = await fetch(`${API_URL}/eleves`, {
            headers: {
                'x-user-role': currentUser.role,
                'x-user-id': currentUser.id
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayInscriptions(data);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des inscriptions:', error);
    }
}

function displayInscriptions(inscriptions) {
    const tbody = document.getElementById('inscriptions-tbody');
    tbody.innerHTML = '';
    
    inscriptions.forEach(eleve => {
        const tr = document.createElement('tr');
        
        const typeInscription = eleve.enFamille ? '👨‍👩‍👧‍👦 Famille' : '📋 Solo';
        const familleInfo = eleve.enFamille ? `${eleve.nombreFamille} membres` : '-';
        
        tr.innerHTML = `
            <td>${eleve.nom}</td>
            <td>${eleve.prenom}</td>
            <td>${eleve.classe || 'Non assigné'}</td>
            <td><span style="background: ${eleve.enFamille ? '#667eea' : '#28a745'}; color: white; padding: 5px 10px; border-radius: 15px; font-size: 0.85em;">${typeInscription}</span></td>
            <td>${familleInfo}</td>
            <td>${eleve.telephone || '-'}</td>
            <td>
                <button class="btn btn-small" onclick="showEleveDetails('${eleve.id}')" style="background: #667eea;">
                    👁️ Détails
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Afficher la rubrique inscriptions selon les permissions
function showInscriptionsTab() {
    const navInscriptions = document.getElementById('nav-inscriptions');
    if (['admin', 'directeur', 'secretariat'].includes(currentUser.role)) {
        if (navInscriptions) navInscriptions.style.display = 'flex';
    }
}

// Afficher la rubrique bureau selon les permissions
function showBureauTab() {
    const navBureau = document.getElementById('nav-bureau');
    if (['admin', 'directeur'].includes(currentUser.role)) {
        if (navBureau) navBureau.style.display = 'flex';
        
        // Masquer l'option directeur si l'utilisateur est directeur
        if (currentUser.role === 'directeur') {
            const roleDirecteurOption = document.getElementById('role-directeur');
            if (roleDirecteurOption) roleDirecteurOption.style.display = 'none';
        }
    }
}

// ==================== FONCTIONS GESTION DU BUREAU ====================

// Afficher formulaire ajout staff
function showAddStaffForm() {
    const form = document.getElementById('add-staff-form');
    form.style.display = 'block';
}

function hideAddStaffForm() {
    const form = document.getElementById('add-staff-form');
    form.style.display = 'none';
    document.getElementById('staffForm').reset();
}

// Script pour afficher/masquer le champ matière selon le rôle
document.getElementById('staff-role').addEventListener('change', function() {
    const matiereGroup = document.getElementById('matiere-group');
    const matiereInput = document.getElementById('staff-matiere');
    
    if (this.value === 'professeur') {
        matiereGroup.style.display = 'block';
        matiereInput.required = true;
    } else {
        matiereGroup.style.display = 'none';
        matiereInput.required = false;
        matiereInput.value = '';
    }
});

// Soumettre formulaire staff
const staffForm = document.getElementById('staffForm');
if (staffForm) {
    staffForm.addEventListener('submit', async (e) => {
        e.preventDefault();
    
    const staffData = {
        nom: document.getElementById('staff-nom').value,
        prenom: document.getElementById('staff-prenom').value,
        email: document.getElementById('staff-email').value,
        role: document.getElementById('staff-role').value,
        matiere: document.getElementById('staff-matiere').value || null
    };
    
    try {
        const response = await fetch(`${API_URL}/staff`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-user-role': currentUser.role,
                'x-user-id': currentUser.id
            },
            body: JSON.stringify(staffData)
        });
        
        if (response.ok) {
            const data = await response.json();
            showCustomAlert('Membre du bureau créé avec succès!', 'success');
            hideAddStaffForm();
            loadStaff();
            
            // Afficher modal avec lien d'activation
            if (data.activationLink) {
                showActivationModalStaff(data);
            }
        } else {
            const error = await response.json();
            showCustomAlert(error.error || 'Erreur lors de la création', 'error');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showCustomAlert('Erreur lors de la création', 'error');
    }
    });
}

// Modal d'activation pour staff
function showActivationModalStaff(data) {
    let roleName = '';
    if (data.role === 'directeur') roleName = 'Directeur';
    else if (data.role === 'secretariat') roleName = 'Secrétariat';
    else if (data.role === 'professeur') roleName = 'Professeur';
    
    const matiereInfo = data.role === 'professeur' && data.matiere ? ` - Matière: ${data.matiere}` : '';
    
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; width: 90%;">
            <h3 style="color: #667eea; margin-bottom: 20px;">🏢 Membre du bureau créé!</h3>
            <p style="color: #666; margin-bottom: 15px;"><strong>${data.prenom} ${data.nom}</strong> a été ajouté en tant que <strong>${roleName}</strong>${matiereInfo}</p>
            <p style="color: #666; margin-bottom: 20px;">Envoyez ce lien d'activation à l'adresse email: <strong>${data.email}</strong></p>
            <div style="background: #f0f2f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; word-break: break-all; font-size: 0.9em;">
                ${data.activationLink}
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button id="sendEmailBtn-${data.id}" onclick="sendActivationEmail('${data.id}', '${data.email}', 'staff', this)" style="width: 100%; padding: 12px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600; font-size: 1em;">
                    📧 Envoyer par email
                </button>
                <div style="display: flex; gap: 10px;">
                    <button onclick="navigator.clipboard.writeText('${data.activationLink}').then(() => showCustomAlert('Lien copié!', 'success'))" style="flex: 1; padding: 10px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
                        📋 Copier le lien
                    </button>
                    <button onclick="this.closest('div[style*=fixed]').remove()" style="flex: 1; padding: 10px; background: #1e3a5f; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Charger la liste des membres du bureau
async function loadStaff() {
    try {
        const response = await fetch(`${API_URL}/staff`, {
            headers: {
                'x-user-role': currentUser.role,
                'x-user-id': currentUser.id
            }
        });
        
        if (response.ok) {
            const staff = await response.json();
            displayStaff(staff);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des membres:', error);
    }
}

function displayStaff(staff) {
    const tbody = document.getElementById('staff-tbody');
    tbody.innerHTML = '';
    
    if (staff.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #999;">Aucun membre enregistré</td></tr>';
        return;
    }
    
    staff.forEach(membre => {
        const tr = document.createElement('tr');
        
        let roleLabel = '';
        if (membre.role === 'directeur') roleLabel = '🎯 Directeur';
        else if (membre.role === 'secretariat') roleLabel = '📋 Secrétariat';
        else if (membre.role === 'professeur') roleLabel = '👨‍🏫 Professeur';
        
        const statusBadge = membre.activated ? 
            '<span style="background: #28a745; color: white; padding: 5px 10px; border-radius: 15px; font-size: 0.85em;">Activé</span>' : 
            '<span style="background: #ffc107; color: #333; padding: 5px 10px; border-radius: 15px; font-size: 0.85em;">En attente</span>';
        
        const canModify = currentUser.role === 'admin' || (currentUser.role === 'directeur' && membre.role !== 'directeur');
        
        tr.innerHTML = `
            <td>${membre.nom}</td>
            <td>${membre.prenom}</td>
            <td>${membre.email || '-'}</td>
            <td><span style="background: #667eea; color: white; padding: 5px 10px; border-radius: 15px; font-size: 0.85em;">${roleLabel}</span></td>
            <td>${membre.matiere || '-'}</td>
            <td>${statusBadge}</td>
            <td>
                ${canModify ? `
                    <button class="btn btn-small" onclick="showStaffDetails('${membre.id}')" style="background: #667eea; margin-right: 5px;">
                        👁️ Détails
                    </button>
                    <button class="btn btn-small btn-danger" onclick="deleteStaff('${membre.id}', '${membre.prenom} ${membre.nom}')">
                        🗑️
                    </button>
                ` : '<span style="color: #999;">-</span>'}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Afficher les détails d'un membre
async function showStaffDetails(staffId) {
    try {
        const response = await fetch(`${API_URL}/staff/${staffId}`);
        const membre = await response.json();
        
        let roleLabel = '';
        if (membre.role === 'directeur') roleLabel = 'Directeur';
        else if (membre.role === 'secretariat') roleLabel = 'Secrétariat';
        else if (membre.role === 'professeur') roleLabel = 'Professeur';
        
        const statusText = membre.activated ? 'Compte activé' : 'En attente d\'activation';
        
        const matiereDisplay = membre.role === 'professeur' && membre.matiere ? 
            `<p style="margin-bottom: 10px;"><strong>Matière:</strong> ${membre.matiere}</p>` : '';
        
        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';
        
        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; width: 90%;">
                <h3 style="color: #667eea; margin-bottom: 20px;">🏢 Détails du membre</h3>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                    <p style="margin-bottom: 10px;"><strong>Nom:</strong> ${membre.nom}</p>
                    <p style="margin-bottom: 10px;"><strong>Prénom:</strong> ${membre.prenom}</p>
                    <p style="margin-bottom: 10px;"><strong>Email:</strong> ${membre.email || 'Non renseigné'}</p>
                    <p style="margin-bottom: 10px;"><strong>Rôle:</strong> <span style="background: #667eea; color: white; padding: 3px 8px; border-radius: 5px;">${roleLabel}</span></p>
                    ${matiereDisplay}
                    <p style="margin-bottom: 0;"><strong>Statut:</strong> ${statusText}</p>
                </div>
                <button onclick="this.closest('div[style*=fixed]').remove()" style="width: 100%; padding: 12px; background: #1e3a5f; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
                    Fermer
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
    } catch (error) {
        console.error('Erreur:', error);
        showCustomAlert('Erreur lors du chargement des détails', 'error');
    }
}

// Supprimer un membre
async function deleteStaff(staffId, staffName) {
    showCustomConfirm(`Êtes-vous sûr de vouloir supprimer ${staffName} ?`, async () => {
        try {
            const response = await fetch(`${API_URL}/staff/${staffId}`, {
                method: 'DELETE',
                headers: {
                    'x-user-role': currentUser.role,
                    'x-user-id': currentUser.id
                }
            });
            
            if (response.ok) {
                showCustomAlert('Membre supprimé avec succès', 'success');
                loadStaff();
            } else {
                const error = await response.json();
                showCustomAlert(error.error || 'Erreur lors de la suppression', 'error');
            }
        } catch (error) {
            console.error('Erreur:', error);
            showCustomAlert('Erreur lors de la suppression', 'error');
        }
    });
}
