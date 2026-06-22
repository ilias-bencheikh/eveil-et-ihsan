/**
 * Composants UI - Modals personnalisées
 */

// Afficher une alerte personnalisée
function showAlert(message, type = 'info') {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
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
        <div class="modal-content" style="background: white; padding: 30px; border-radius: 10px; max-width: 400px; width: 90%; text-align: center;">
            <div class="modal-icon" style="font-size: 3em; margin-bottom: 15px;">${icons[type] || icons.info}</div>
            <p class="modal-message" style="color: #333; font-size: 1.1em; line-height: 1.5; margin-bottom: 20px;">${message}</p>
            <button class="modal-btn" onclick="this.closest('.modal-overlay').remove()" style="padding: 12px 30px; background: ${colors[type] || colors.info}; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600; font-size: 1em;">
                OK
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    return modal;
}

// Afficher une confirmation personnalisée
function showConfirm(message, onConfirm, onCancel) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
    
    modal.innerHTML = `
        <div class="modal-content" style="background: white; padding: 30px; border-radius: 10px; max-width: 400px; width: 90%; text-align: center;">
            <div class="modal-icon" style="font-size: 3em; margin-bottom: 15px;">❓</div>
            <p class="modal-message" style="color: #333; font-size: 1.1em; line-height: 1.5; margin-bottom: 25px;">${message}</p>
            <div class="modal-actions" style="display: flex; gap: 10px; justify-content: center;">
                <button class="modal-btn cancel" style="flex: 1; padding: 12px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
                    Annuler
                </button>
                <button class="modal-btn confirm" style="flex: 1; padding: 12px 20px; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
                    Confirmer
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.confirm').addEventListener('click', () => {
        modal.remove();
        if (onConfirm) onConfirm();
    });
    
    modal.querySelector('.cancel').addEventListener('click', () => {
        modal.remove();
        if (onCancel) onCancel();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
            if (onCancel) onCancel();
        }
    });
    
    return modal;
}

// Afficher un prompt personnalisé
function showPrompt(message, defaultValue = '', onSubmit, onCancel) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
    
    modal.innerHTML = `
        <div class="modal-content" style="background: white; padding: 30px; border-radius: 10px; max-width: 400px; width: 90%;">
            <p class="modal-message" style="color: #333; font-size: 1.1em; line-height: 1.5; margin-bottom: 20px;">${message}</p>
            <input type="text" class="modal-input" value="${defaultValue}" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 5px; font-size: 1em; margin-bottom: 20px; box-sizing: border-box;">
            <div class="modal-actions" style="display: flex; gap: 10px;">
                <button class="modal-btn cancel" style="flex: 1; padding: 12px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
                    Annuler
                </button>
                <button class="modal-btn submit" style="flex: 1; padding: 12px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
                    OK
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const input = modal.querySelector('.modal-input');
    input.focus();
    input.select();
    
    const submit = () => {
        const value = input.value;
        modal.remove();
        if (onSubmit) onSubmit(value);
    };
    
    modal.querySelector('.submit').addEventListener('click', submit);
    modal.querySelector('.cancel').addEventListener('click', () => {
        modal.remove();
        if (onCancel) onCancel();
    });
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submit();
    });
    
    return modal;
}

// Afficher un loader
function showLoader(message = 'Chargement...') {
    const loader = document.createElement('div');
    loader.id = 'global-loader';
    loader.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.9); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10001;';
    
    loader.innerHTML = `
        <div class="spinner" style="width: 50px; height: 50px; border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <p style="margin-top: 20px; color: #333; font-size: 1.1em;">${message}</p>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    
    document.body.appendChild(loader);
    return loader;
}

// Masquer le loader
function hideLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.remove();
    }
}

// Toast notification
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const colors = {
        'success': '#28a745',
        'error': '#dc3545',
        'warning': '#ffc107',
        'info': '#17a2b8'
    };
    
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10002;
        animation: slideIn 0.3s ease;
    `;
    
    toast.innerHTML = `
        <span>${message}</span>
        <style>
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        </style>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
    
    return toast;
}

// Export pour compatibilité avec l'ancien code
window.showCustomAlert = showAlert;
window.showCustomConfirm = showConfirm;
window.showCustomPrompt = showPrompt;

// Modal pour afficher les contacts incomplets
function showIncompleteContactsModal(incompleteContacts) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
        animation: fadeIn 0.2s ease;
    `;

    let tableRows = '';
    incompleteContacts.forEach((student, index) => {
        let parentsInfo = '';

        if (student.parents && student.parents.length > 0) {
            parentsInfo = student.parents.map((p, idx) => {
                const parts = [];
                const parentLabel = `Parent ${idx + 1}`;

                if (p.nom || p.prenom) {
                    parts.push(`<strong>${parentLabel}:</strong> ${p.nom} ${p.prenom}`.trim());
                } else {
                    parts.push(`<strong>${parentLabel}:</strong>`);
                }

                const info = [];
                if (p.email) {
                    info.push(`📧 ${p.email}`);
                } else {
                    info.push(`<span style="color: var(--md-sys-color-error);">📧 Email manquant</span>`);
                }

                if (p.tel) {
                    info.push(`📞 ${p.tel}`);
                } else {
                    info.push(`<span style="color: var(--md-sys-color-error);">📞 Tél manquant</span>`);
                }

                parts.push('<div style="margin-left: 20px; font-size: 0.95em;">' + info.join(' • ') + '</div>');
                return parts.join('<br>');
            }).join('<br><br>');
        } else {
            parentsInfo = '<span style="color: var(--md-sys-color-error); font-weight: 500;">⚠️ Aucun parent enregistré</span>';
        }

        tableRows += `
            <tr style="border-bottom: 1px solid var(--md-sys-color-outline-variant); transition: background 0.2s;">
                <td style="padding: 16px; font-weight: 500; color: var(--md-sys-color-on-surface);">${student.eleveNom} ${student.elevePrenom}</td>
                <td style="padding: 16px; color: var(--md-sys-color-on-surface-variant);">${student.classe || '-'}</td>
                <td style="padding: 16px; color: var(--md-sys-color-on-surface-variant); line-height: 1.8;">${parentsInfo}</td>
            </tr>
        `;
    });

    modal.innerHTML = `
        <div class="modal-content" style="
            background: var(--md-sys-color-surface-container-low);
            border-radius: var(--md-sys-shape-corner-extra-large);
            max-width: 1000px;
            width: 95%;
            max-height: 85vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: var(--md-sys-elevation-5);
            animation: slideUp 0.3s var(--md-sys-motion-easing-emphasized-decelerate);
        ">
            <div style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 24px 32px;
                border-bottom: 1px solid var(--md-sys-color-outline-variant);
                background: var(--md-sys-color-surface-container);
            ">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <div style="
                        width: 48px;
                        height: 48px;
                        border-radius: var(--md-sys-shape-corner-full);
                        background: var(--md-sys-color-warning-container);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 24px;
                    ">⚠️</div>
                    <div>
                        <h2 style="
                            margin: 0;
                            font: var(--md-sys-typescale-headline-small);
                            color: var(--md-sys-color-on-surface);
                        ">Contacts Incomplets Détectés</h2>
                        <p style="
                            margin: 4px 0 0 0;
                            font: var(--md-sys-typescale-body-medium);
                            color: var(--md-sys-color-on-surface-variant);
                        ">${incompleteContacts.length} famille(s) à compléter</p>
                    </div>
                </div>
                <button class="close-btn" style="
                    background: transparent;
                    border: none;
                    width: 40px;
                    height: 40px;
                    border-radius: var(--md-sys-shape-corner-full);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--md-sys-color-on-surface-variant);
                    font-size: 24px;
                    transition: all 0.2s;
                " onmouseover="this.style.background='var(--md-sys-color-surface-container-highest)'" onmouseout="this.style.background='transparent'">✕</button>
            </div>

            <div style="
                padding: 24px 32px;
                background: var(--md-sys-color-warning-container);
                border-left: 4px solid var(--md-sys-color-warning);
            ">
                <p style="
                    margin: 0;
                    font: var(--md-sys-typescale-body-medium);
                    color: var(--md-sys-color-on-warning-container);
                    line-height: 1.6;
                ">
                    <strong>Important :</strong> Les élèves suivants n'ont pas au moins un parent avec <strong>à la fois</strong> une adresse email et un numéro de téléphone.
                    Veuillez compléter ces informations pour permettre la communication avec les familles.
                </p>
            </div>

            <div style="
                flex: 1;
                overflow-y: auto;
                padding: 8px;
            ">
                <table style="
                    width: 100%;
                    border-collapse: collapse;
                    background: var(--md-sys-color-surface-container-lowest);
                    border-radius: var(--md-sys-shape-corner-large);
                    overflow: hidden;
                ">
                    <thead>
                        <tr style="
                            background: var(--md-sys-color-surface-container-high);
                            position: sticky;
                            top: 0;
                            z-index: 1;
                        ">
                            <th style="
                                padding: 16px;
                                text-align: left;
                                font: var(--md-sys-typescale-title-medium);
                                color: var(--md-sys-color-on-surface);
                                border-bottom: 2px solid var(--md-sys-color-outline);
                            ">Élève</th>
                            <th style="
                                padding: 16px;
                                text-align: left;
                                font: var(--md-sys-typescale-title-medium);
                                color: var(--md-sys-color-on-surface);
                                border-bottom: 2px solid var(--md-sys-color-outline);
                            ">Classe</th>
                            <th style="
                                padding: 16px;
                                text-align: left;
                                font: var(--md-sys-typescale-title-medium);
                                color: var(--md-sys-color-on-surface);
                                border-bottom: 2px solid var(--md-sys-color-outline);
                            ">Informations Parents</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>

            <div style="
                display: flex;
                gap: 12px;
                justify-content: flex-end;
                padding: 24px 32px;
                border-top: 1px solid var(--md-sys-color-outline-variant);
                background: var(--md-sys-color-surface-container);
            ">
                <button class="download-btn" style="
                    padding: 12px 24px;
                    background: var(--md-sys-color-success);
                    color: var(--md-sys-color-on-success);
                    border: none;
                    border-radius: var(--md-sys-shape-corner-full);
                    cursor: pointer;
                    font: var(--md-sys-typescale-label-large);
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.2s;
                    box-shadow: var(--md-sys-elevation-2);
                " onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='var(--md-sys-elevation-3)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='var(--md-sys-elevation-2)'">
                    <span>📥</span> Télécharger Excel
                </button>
                <button class="close-modal-btn" style="
                    padding: 12px 24px;
                    background: var(--md-sys-color-primary);
                    color: var(--md-sys-color-on-primary);
                    border: none;
                    border-radius: var(--md-sys-shape-corner-full);
                    cursor: pointer;
                    font: var(--md-sys-typescale-label-large);
                    font-weight: 600;
                    transition: all 0.2s;
                    box-shadow: var(--md-sys-elevation-2);
                " onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='var(--md-sys-elevation-3)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='var(--md-sys-elevation-2)'">
                    Fermer
                </button>
            </div>
        </div>
        <style>
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            tbody tr:hover {
                background: var(--md-sys-color-surface-container) !important;
            }
        </style>
    `;

    document.body.appendChild(modal);

    const closeModal = () => {
        modal.style.animation = 'fadeOut 0.2s ease';
        setTimeout(() => modal.remove(), 200);
    };

    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    modal.querySelector('.close-btn').addEventListener('click', closeModal);
    modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);

    modal.querySelector('.download-btn').addEventListener('click', () => {
        downloadIncompleteContactsExcel(incompleteContacts);
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    return modal;
}

// Télécharger la liste des contacts incomplets en Excel
function downloadIncompleteContactsExcel(incompleteContacts) {
    const data = [
        ['Nom Élève', 'Prénom Élève', 'Classe', 'Parent 1 Nom', 'Parent 1 Prénom', 'Parent 1 Email', 'Parent 1 Tel', 'Parent 2 Nom', 'Parent 2 Prénom', 'Parent 2 Email', 'Parent 2 Tel']
    ];

    incompleteContacts.forEach(student => {
        const parent1 = student.parents[0] || {};
        const parent2 = student.parents[1] || {};

        data.push([
            student.eleveNom || '',
            student.elevePrenom || '',
            student.classe || '',
            parent1.nom || '',
            parent1.prenom || '',
            parent1.email || '',
            parent1.tel || '',
            parent2.nom || '',
            parent2.prenom || '',
            parent2.email || '',
            parent2.tel || ''
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);

    const colWidths = [
        { wch: 15 }, { wch: 15 }, { wch: 10 },
        { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 15 }
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts Incomplets');

    const timestamp = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `contacts_incomplets_${timestamp}.xlsx`);
}

// Export global
window.UI = {
    showAlert,
    showConfirm,
    showPrompt,
    showLoader,
    hideLoader,
    showToast,
    showIncompleteContactsModal
};
