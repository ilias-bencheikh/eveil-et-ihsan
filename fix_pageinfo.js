const fs = require('fs');

let content = fs.readFileSync('./public/app.js', 'utf8');

// Trouver et remplacer pageInfo
const oldPageInfo = `const pageInfo = {
    eleves: { title: 'Gestion des Élèves', desc: 'Consulter et gérer les élèves de l'établissement' },
    professeurs: { title: 'Gestion des Professeurs', desc: 'Consulter et gérer le corps enseignant' },
    classes: { title: 'Gestion des Classes', desc: 'Organiser les classes par niveau' },
    appel: { title: 'Faire l'appel', desc: 'Enregistrer les présences et absences par classe' },
    absences: { title: 'Gestion des Absences', desc: 'Suivre les absences et retards' },
    appreciations: { title: 'Gestion des Appréciations', desc: 'Notes et commentaires par matière' }
};`;

const newPageInfo = `const pageInfo = {
    eleves: { title: 'Gestion des Élèves', desc: 'Consulter et gérer les élèves de l'établissement' },
    professeurs: { title: 'Gestion des Professeurs', desc: 'Consulter et gérer le corps enseignant' },
    classes: { title: 'Gestion des Classes', desc: 'Organiser les classes par niveau' },
    bureau: { title: 'Gestion du Bureau', desc: 'Gérer les membres du bureau (directeur, secrétariat)' },
    appel: { title: 'Faire l\'appel', desc: 'Enregistrer les présences et absences par classe' },
    absences: { title: 'Gestion des Absences', desc: 'Suivre les absences et retards' },
    appreciations: { title: 'Gestion des Appréciations', desc: 'Notes et commentaires par matière' }
};`;

if (content.includes(oldPageInfo)) {
    content = content.replace(oldPageInfo, newPageInfo);
    fs.writeFileSync('./public/app.js', content, 'utf8');
    console.log('✅ pageInfo mis à jour avec succès!');
} else {
    console.log('⚠️ oldPageInfo non trouvé - peut-être déjà mis à jour?');
}
