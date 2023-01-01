# projet_badr_eveil_ihsan



## Getting started

To make it easy for you to get started with GitLab, here's a list of recommended next steps.

Already a pro? Just edit this # 🎓 Système de Gestion Scolaire - Badr Eveil Ihsan

Application web complète pour la gestion des élèves, professeurs, classes, absences et appréciations.

## 📋 Fonctionnalités

- **Gestion des Élèves** : Ajouter, modifier, supprimer et consulter les élèves
- **Gestion des Professeurs** : Gérer les informations des enseignants
- **Gestion des Classes** : Créer et organiser les classes par niveau
- **Gestion des Absences** : Enregistrer et suivre les absences (justifiées, non justifiées, retards)
- **Gestion des Appréciations** : Ajouter des notes et commentaires par matière et par période

## 🚀 Installation

1. Installer les dépendances :
```bash
npm install
```

2. Démarrer le serveur :
```bash
npm start
```

Ou en mode développement avec rechargement automatique :
```bash
npm run dev
```

3. Ouvrir dans le navigateur :
```
http://localhost:3000
```

## 🛠️ Technologies utilisées

- **Backend** : Node.js, Express
- **Frontend** : HTML5, CSS3, JavaScript vanilla
- **Stockage** : Fichiers JSON (peut être remplacé par une base de données)

## 📁 Structure du projet

```
projet_badr_eveil_ihsan/
├── server.js              # Serveur Express avec toutes les routes API
├── package.json           # Dépendances et scripts
├── public/                # Fichiers frontend
│   ├── index.html        # Interface principale
│   ├── styles.css        # Styles de l'application
│   └── app.js            # Logique frontend
├── data/                  # Stockage des données (créé automatiquement)
│   ├── eleves.json
│   ├── professeurs.json
│   ├── classes.json
│   ├── absences.json
│   └── appreciations.json
└── README.md
```

## 🔧 API Endpoints

### Élèves
- `GET /api/eleves` - Liste tous les élèves
- `POST /api/eleves` - Ajouter un élève
- `PUT /api/eleves/:id` - Modifier un élève
- `DELETE /api/eleves/:id` - Supprimer un élève

### Professeurs
- `GET /api/professeurs` - Liste tous les professeurs
- `POST /api/professeurs` - Ajouter un professeur
- `PUT /api/professeurs/:id` - Modifier un professeur
- `DELETE /api/professeurs/:id` - Supprimer un professeur

### Classes
- `GET /api/classes` - Liste toutes les classes
- `POST /api/classes` - Ajouter une classe

### Absences
- `GET /api/absences` - Liste toutes les absences
- `GET /api/absences/eleve/:eleveId` - Absences d'un élève
- `POST /api/absences` - Enregistrer une absence

### Appréciations
- `GET /api/appreciations` - Liste toutes les appréciations
- `GET /api/appreciations/eleve/:eleveId` - Appréciations d'un élève
- `POST /api/appreciations` - Ajouter une appréciation

## 📝 Améliorations possibles

- Ajouter une authentification (login professeurs/admin)
- Intégrer une vraie base de données (MongoDB, PostgreSQL)
- Ajouter des statistiques et graphiques
- Système d'export PDF des bulletins
- Notifications par email aux parents
- Application mobile
- Gestion des emplois du temps
- Module de messagerie interne

## 👨‍💻 Développement

Pour contribuer au projet :
1. Cloner le dépôt
2. Créer une branche (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Committer les changements (`git commit -m 'Ajout nouvelle fonctionnalité'`)
4. Pousser vers la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Ouvrir une Pull Request and make it your own. Want to make it easy? [Use the template at the bottom](#editing-this-readme)!

## Add your files

- [ ] [Create](https://docs.gitlab.com/ee/user/project/repository/web_editor.html#create-a-file) or [upload](https://docs.gitlab.com/ee/user/project/repository/web_editor.html#upload-a-file) files
- [ ] [Add files using the command line](https://docs.gitlab.com/topics/git/add_files/#add-files-to-a-git-repository) or push an existing Git repository with the following command:

```
cd existing_repo
git remote add origin https://moule.informatique.univ-paris-diderot.fr/bencheik/projet_badr_eveil_ihsan.git
git branch -M main
git push -uf origin main
```

## Integrate with your tools

- [ ] [Set up project integrations](https://moule.informatique.univ-paris-diderot.fr/bencheik/projet_badr_eveil_ihsan/-/settings/integrations)

## Collaborate with your team

- [ ] [Invite team members and collaborators](https://docs.gitlab.com/ee/user/project/members/)
- [ ] [Create a new merge request](https://docs.gitlab.com/ee/user/project/merge_requests/creating_merge_requests.html)
- [ ] [Automatically close issues from merge requests](https://docs.gitlab.com/ee/user/project/issues/managing_issues.html#closing-issues-automatically)
- [ ] [Enable merge request approvals](https://docs.gitlab.com/ee/user/project/merge_requests/approvals/)
- [ ] [Set auto-merge](https://docs.gitlab.com/user/project/merge_requests/auto_merge/)

## Test and Deploy

Use the built-in continuous integration in GitLab.

- [ ] [Get started with GitLab CI/CD](https://docs.gitlab.com/ee/ci/quick_start/)
- [ ] [Analyze your code for known vulnerabilities with Static Application Security Testing (SAST)](https://docs.gitlab.com/ee/user/application_security/sast/)
- [ ] [Deploy to Kubernetes, Amazon EC2, or Amazon ECS using Auto Deploy](https://docs.gitlab.com/ee/topics/autodevops/requirements.html)
- [ ] [Use pull-based deployments for improved Kubernetes management](https://docs.gitlab.com/ee/user/clusters/agent/)
- [ ] [Set up protected environments](https://docs.gitlab.com/ee/ci/environments/protected_environments.html)

***

# Editing this README

When you're ready to make this README your own, just edit this file and use the handy template below (or feel free to structure it however you want - this is just a starting point!). Thanks to [makeareadme.com](https://www.makeareadme.com/) for this template.

## Suggestions for a good README

Every project is different, so consider which of these sections apply to yours. The sections used in the template are suggestions for most open source projects. Also keep in mind that while a README can be too long and detailed, too long is better than too short. If you think your README is too long, consider utilizing another form of documentation rather than cutting out information.

## Name
Choose a self-explaining name for your project.

## Description
Let people know what your project can do specifically. Provide context and add a link to any reference visitors might be unfamiliar with. A list of Features or a Background subsection can also be added here. If there are alternatives to your project, this is a good place to list differentiating factors.

## Badges
On some READMEs, you may see small images that convey metadata, such as whether or not all the tests are passing for the project. You can use Shields to add some to your README. Many services also have instructions for adding a badge.

## Visuals
Depending on what you are making, it can be a good idea to include screenshots or even a video (you'll frequently see GIFs rather than actual videos). Tools like ttygif can help, but check out Asciinema for a more sophisticated method.

## Installation
Within a particular ecosystem, there may be a common way of installing things, such as using Yarn, NuGet, or Homebrew. However, consider the possibility that whoever is reading your README is a novice and would like more guidance. Listing specific steps helps remove ambiguity and gets people to using your project as quickly as possible. If it only runs in a specific context like a particular programming language version or operating system or has dependencies that have to be installed manually, also add a Requirements subsection.

## Usage
Use examples liberally, and show the expected output if you can. It's helpful to have inline the smallest example of usage that you can demonstrate, while providing links to more sophisticated examples if they are too long to reasonably include in the README.

## Support
Tell people where they can go to for help. It can be any combination of an issue tracker, a chat room, an email address, etc.

## Roadmap
If you have ideas for releases in the future, it is a good idea to list them in the README.

## Contributing
State if you are open to contributions and what your requirements are for accepting them.

For people who want to make changes to your project, it's helpful to have some documentation on how to get started. Perhaps there is a script that they should run or some environment variables that they need to set. Make these steps explicit. These instructions could also be useful to your future self.

You can also document commands to lint the code or run tests. These steps help to ensure high code quality and reduce the likelihood that the changes inadvertently break something. Having instructions for running tests is especially helpful if it requires external setup, such as starting a Selenium server for testing in a browser.

## Authors and acknowledgment
Show your appreciation to those who have contributed to the project.

## License
For open source projects, say how it is licensed.

## Project status
If you have run out of energy or time for your project, put a note at the top of the README saying that development has slowed down or stopped completely. Someone may choose to fork your project or volunteer to step in as a maintainer or owner, allowing your project to keep going. You can also make an explicit request for maintainers.
