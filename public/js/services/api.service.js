/**
 * Service API - Communication avec le backend
 */

const API_URL = `http://${window.location.hostname}:3000/api`;

// Fonction utilitaire pour les requêtes
async function apiRequest(endpoint, options = {}) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    const defaultHeaders = {
        'Content-Type': 'application/json',
        'x-user-role': user.role || '',
        'x-user-id': user.id || ''
    };
    
    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    };
    
    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || data.error || 'Erreur serveur');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Service d'authentification
const AuthService = {
    async login(email, password) {
        return apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    },
    
    async forgotPassword(email) {
        return apiRequest('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    },
    
    async checkResetToken(token) {
        return apiRequest(`/auth/check-reset-token/${token}`);
    },
    
    async resetPassword(token, password) {
        return apiRequest('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, password })
        });
    },
    
    logout() {
        localStorage.clear();
        window.location.href = 'login.html';
    },
    
    getCurrentUser() {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    },
    
    isAuthenticated() {
        return !!this.getCurrentUser();
    }
};

// Service des élèves
const ElevesService = {
    async getAll() {
        return apiRequest('/eleves');
    },
    
    async getById(id) {
        return apiRequest(`/eleves/${id}`);
    },
    
    async getFamille(id) {
        return apiRequest(`/eleves/${id}/famille`);
    },
    
    async create(eleve) {
        return apiRequest('/eleves', {
            method: 'POST',
            body: JSON.stringify(eleve)
        });
    },
    
    async update(id, eleve) {
        return apiRequest(`/eleves/${id}`, {
            method: 'PUT',
            body: JSON.stringify(eleve)
        });
    },
    
    async delete(id) {
        return apiRequest(`/eleves/${id}`, {
            method: 'DELETE'
        });
    },
    
    async activate(token, password) {
        return apiRequest('/eleves/activate', {
            method: 'POST',
            body: JSON.stringify({ token, password })
        });
    },
    
    async checkToken(token) {
        return apiRequest(`/eleves/check-token/${token}`);
    }
};

// Service des professeurs
const ProfesseursService = {
    async getAll() {
        return apiRequest('/professeurs');
    },
    
    async create(professeur) {
        return apiRequest('/professeurs', {
            method: 'POST',
            body: JSON.stringify(professeur)
        });
    },
    
    async update(id, professeur) {
        return apiRequest(`/professeurs/${id}`, {
            method: 'PUT',
            body: JSON.stringify(professeur)
        });
    },
    
    async delete(id) {
        return apiRequest(`/professeurs/${id}`, {
            method: 'DELETE'
        });
    },
    
    async activate(token, password) {
        return apiRequest('/professeurs/activate', {
            method: 'POST',
            body: JSON.stringify({ token, password })
        });
    },
    
    async checkToken(token) {
        return apiRequest(`/professeurs/check-token/${token}`);
    }
};

// Service des classes
const ClassesService = {
    async getAll() {
        return apiRequest('/classes');
    },
    
    async create(classe) {
        return apiRequest('/classes', {
            method: 'POST',
            body: JSON.stringify(classe)
        });
    },
    
    async update(id, classe) {
        return apiRequest(`/classes/${id}`, {
            method: 'PUT',
            body: JSON.stringify(classe)
        });
    },
    
    async delete(id) {
        return apiRequest(`/classes/${id}`, {
            method: 'DELETE'
        });
    }
};

// Service des absences
const AbsencesService = {
    async getAll() {
        return apiRequest('/absences');
    },
    
    async getByEleve(eleveId) {
        return apiRequest(`/absences/eleve/${eleveId}`);
    },
    
    async create(absence) {
        return apiRequest('/absences', {
            method: 'POST',
            body: JSON.stringify(absence)
        });
    },
    
    async update(id, absence) {
        return apiRequest(`/absences/${id}`, {
            method: 'PUT',
            body: JSON.stringify(absence)
        });
    },
    
    async delete(id) {
        return apiRequest(`/absences/${id}`, {
            method: 'DELETE'
        });
    }
};

// Service des appréciations
const AppreciationsService = {
    async getAll() {
        return apiRequest('/appreciations');
    },
    
    async getByEleve(eleveId) {
        return apiRequest(`/appreciations/eleve/${eleveId}`);
    },
    
    async create(appreciation) {
        return apiRequest('/appreciations', {
            method: 'POST',
            body: JSON.stringify(appreciation)
        });
    },
    
    async update(id, appreciation) {
        return apiRequest(`/appreciations/${id}`, {
            method: 'PUT',
            body: JSON.stringify(appreciation)
        });
    },
    
    async delete(id) {
        return apiRequest(`/appreciations/${id}`, {
            method: 'DELETE'
        });
    },
    
    // Nouvelles méthodes pour la gestion par classe
    async getClasses() {
        return apiRequest('/appreciations/classes');
    },
    
    async getElevesByClasse(nomClasse) {
        return apiRequest(`/appreciations/eleves/classe/${encodeURIComponent(nomClasse)}`);
    },
    
    async createBulk(appreciations) {
        return apiRequest('/appreciations/bulk', {
            method: 'POST',
            body: JSON.stringify({ appreciations })
        });
    },
    
    async getHistoriqueByClasse(nomClasse) {
        return apiRequest(`/appreciations/historique/classe/${encodeURIComponent(nomClasse)}`);
    },
    
    async updateBatch(batchId, appreciations) {
        return apiRequest(`/appreciations/batch/${batchId}`, {
            method: 'PUT',
            body: JSON.stringify({ appreciations })
        });
    },
    
    async deleteBatch(batchId) {
        return apiRequest(`/appreciations/batch/${batchId}`, {
            method: 'DELETE'
        });
    }
};

// Service de messagerie
const MessagerieService = {
    async getDestinataires() {
        return apiRequest('/messagerie/destinataires');
    },
    
    async getMessages() {
        return apiRequest('/messagerie');
    },
    
    async send(message) {
        return apiRequest('/messagerie', {
            method: 'POST',
            body: JSON.stringify(message)
        });
    },
    
    async markAsRead(id) {
        return apiRequest(`/messagerie/${id}/lu`, {
            method: 'PUT'
        });
    }
};

// Service du staff
const StaffService = {
    async getAll() {
        return apiRequest('/staff');
    },
    
    async getById(id) {
        return apiRequest(`/staff/${id}`);
    },
    
    async create(membre) {
        return apiRequest('/staff', {
            method: 'POST',
            body: JSON.stringify(membre)
        });
    },
    
    async update(id, membre) {
        return apiRequest(`/staff/${id}`, {
            method: 'PUT',
            body: JSON.stringify(membre)
        });
    },
    
    async delete(id) {
        return apiRequest(`/staff/${id}`, {
            method: 'DELETE'
        });
    },
    
    async activate(token, password) {
        return apiRequest('/staff/activate', {
            method: 'POST',
            body: JSON.stringify({ token, password })
        });
    },
    
    async checkToken(token) {
        return apiRequest(`/staff/check-token/${token}`);
    }
};

// Service email
const EmailService = {
    async sendActivation(userId, email, type) {
        return apiRequest('/send-activation-email', {
            method: 'POST',
            body: JSON.stringify({ userId, email, type })
        });
    }
};

// Export global
window.API = {
    Auth: AuthService,
    Eleves: ElevesService,
    Professeurs: ProfesseursService,
    Classes: ClassesService,
    Absences: AbsencesService,
    Appreciations: AppreciationsService,
    Messagerie: MessagerieService,
    Staff: StaffService,
    Email: EmailService
};
