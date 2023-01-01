// ==================== MODALS PERSONNALISÉES GLOBALES ====================

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
        <div style="background: white; padding: 30px; border-radius: 10px; max-width: 400px; width: 90%; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
            <div style="font-size: 3em; margin-bottom: 15px;">${icons[type] || icons.info}</div>
            <p style="color: #333; font-size: 1.1em; line-height: 1.5; margin-bottom: 20px; white-space: pre-line;">${message}</p>
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
    
    // Fermer avec Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
    
    return modal;
}

// Fonction pour afficher une confirmation personnalisée
function showCustomConfirm(message, onConfirm, onCancel) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; max-width: 400px; width: 90%; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
            <div style="font-size: 3em; margin-bottom: 15px;">❓</div>
            <p style="color: #333; font-size: 1.1em; line-height: 1.5; margin-bottom: 25px; white-space: pre-line;">${message}</p>
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
    
    // Fermer avec Escape (compte comme annuler)
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            if (onCancel) onCancel();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
    
    return modal;
}

// Fonction pour afficher un prompt personnalisé
function showCustomPrompt(message, defaultValue = '', onSubmit, onCancel, inputType = 'text') {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; max-width: 400px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
            <p style="color: #333; font-size: 1.1em; line-height: 1.5; margin-bottom: 20px;">${message}</p>
            <input type="${inputType}" id="promptInput" value="${defaultValue}" placeholder="Entrez votre réponse..." style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 5px; font-size: 1em; margin-bottom: 20px;">
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
    
    // Fermer avec Escape (compte comme annuler)
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            if (onCancel) onCancel();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
    
    return modal;
}
