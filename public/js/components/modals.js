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
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: rgba(0,0,0,0.45);
        backdrop-filter: blur(6px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
        box-sizing: border-box;
    `;

    const th = (label, bg = '#e8f0fe') => `
        <th style="
            padding: 11px 16px;
            background: ${bg};
            color: #1e5aa8;
            font-size: 13px;
            font-weight: 700;
            text-align: left;
            border-right: 1px solid #c5d3e8;
            border-bottom: 2px solid #c5d3e8;
            position: sticky;
            top: 0;
            z-index: 2;
            white-space: nowrap;
        ">${label}</th>`;

    const cell = (value, type) => {
        const styles = {
            idx:     'background:#f8f9ff; color:#666; text-align:center; font-weight:700; width:36px;',
            name:    'background:#fff; color:#191c20; font-weight:600;',
            classe:  'background:#fff; color:#43474e; text-align:center;',
            ok:      'background:#f0faf4; color:#146b3a; font-weight:500;',
            missing: 'background:#fff4f4; color:#ba1a1a; font-weight:600;',
            alt_ok:  'background:#e8f4f0; color:#146b3a; font-weight:500;',
            alt_miss:'background:#ffecec; color:#ba1a1a; font-weight:600;',
            empty:   'background:#fafafa; color:#aaa;',
        };
        return `<td style="padding:10px 16px; border-right:1px solid #e0e4ee; border-bottom:1px solid #e0e4ee; font-size:13px; white-space:nowrap; ${styles[type] || ''}">${value}</td>`;
    };

    const rows = incompleteContacts.map((student, i) => {
        const p1 = student.parents[0] || {};
        const p2 = student.parents[1] || null;
        const even = i % 2 === 0;

        const p1Email = p1.email && p1.email.trim() ? p1.email : null;
        const p1Tel   = p1.tel   && p1.tel.trim()   ? p1.tel   : null;
        const p2Email = p2 && p2.email && p2.email.trim() ? p2.email : null;
        const p2Tel   = p2 && p2.tel   && p2.tel.trim()   ? p2.tel   : null;

        return `<tr>
            ${cell(i + 1, 'idx')}
            ${cell(`${student.eleveNom} ${student.elevePrenom}`, 'name')}
            ${cell(student.classe || '—', 'classe')}
            ${cell(p1Email ? `✓ ${p1Email}` : '✗ Manquant', p1Email ? 'ok' : 'missing')}
            ${cell(p1Tel   ? `✓ ${p1Tel}`   : '✗ Manquant', p1Tel   ? 'ok' : 'missing')}
            ${p2 !== null
                ? cell(p2Email ? `✓ ${p2Email}` : '✗ Manquant', p2Email ? 'alt_ok' : 'alt_miss') + cell(p2Tel ? `✓ ${p2Tel}` : '✗ Manquant', p2Tel ? 'alt_ok' : 'alt_miss')
                : cell('—', 'empty') + cell('—', 'empty')
            }
        </tr>`;
    }).join('');

    modal.innerHTML = `
        <div style="
            background: var(--md-sys-color-surface-container-low);
            border-radius: 20px;
            max-width: 900px;
            width: 100%;
            max-height: 88vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 8px 32px rgba(0,0,0,0.22);
            animation: ic-slideUp 0.25s cubic-bezier(0.05,0.7,0.1,1);
        ">
            <!-- Header -->
            <div style="display:flex;align-items:center;gap:14px;padding:20px 24px;background:var(--md-sys-color-surface-container);border-bottom:1px solid #e0e4ee;flex-shrink:0;">
                <div style="width:44px;height:44px;border-radius:50%;background:#ffdea6;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">⚠️</div>
                <div style="flex:1;">
                    <div style="font-size:17px;font-weight:700;color:var(--md-sys-color-on-surface);">Contacts incomplets — ${incompleteContacts.length} famille(s)</div>
                    <div style="font-size:13px;color:var(--md-sys-color-on-surface-variant);margin-top:2px;">Aucun parent n'a à la fois un email et un téléphone</div>
                </div>
                <button class="ic-close" style="background:none;border:none;width:36px;height:36px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#666;font-size:18px;transition:background 0.2s;" onmouseover="this.style.background='#eee'" onmouseout="this.style.background='none'">
                    <span class="material-icons">close</span>
                </button>
            </div>

            <!-- Tableau scrollable -->
            <div style="flex:1;overflow:auto;min-height:0;">
                <table style="width:100%;border-collapse:collapse;border-left:1px solid #e0e4ee;border-top:1px solid #e0e4ee;font-family:'Roboto',sans-serif;">
                    <thead>
                        <tr>
                            ${th('#', '#eef1f8')}
                            ${th('Élève', '#eef1f8')}
                            ${th('Classe', '#eef1f8')}
                            ${th('Email Parent 1', '#dce8ff')}
                            ${th('Téléphone Parent 1', '#dce8ff')}
                            ${th('Email Parent 2', '#e2f0ea')}
                            ${th('Téléphone Parent 2', '#e2f0ea')}
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>

            <!-- Légende + Footer -->
            <div style="padding:14px 24px;border-top:1px solid #e0e4ee;background:var(--md-sys-color-surface-container);flex-shrink:0;">
                <div style="display:flex;align-items:center;gap:20px;margin-bottom:12px;flex-wrap:wrap;">
                    <span style="font-size:12px;color:#666;">Légende :</span>
                    <span style="font-size:12px;padding:2px 10px;background:#f0faf4;color:#146b3a;border-radius:99px;font-weight:600;">✓ Information présente</span>
                    <span style="font-size:12px;padding:2px 10px;background:#fff4f4;color:#ba1a1a;border-radius:99px;font-weight:600;">✗ Information manquante</span>
                </div>
                <div style="display:flex;gap:10px;justify-content:flex-end;">
                    <button class="ic-download" style="display:flex;align-items:center;gap:7px;padding:9px 20px;background:#146b3a;color:#fff;border:none;border-radius:99px;cursor:pointer;font-weight:600;font-size:13px;transition:filter 0.2s;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='none'">
                        <span class="material-icons" style="font-size:17px;">download</span> Télécharger Excel
                    </button>
                    <button class="ic-close" style="padding:9px 20px;background:#1e5aa8;color:#fff;border:none;border-radius:99px;cursor:pointer;font-weight:600;font-size:13px;transition:filter 0.2s;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='none'">
                        Fermer
                    </button>
                </div>
            </div>
        </div>
        <style>@keyframes ic-slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }</style>
    `;

    document.body.appendChild(modal);
    const closeModal = () => modal.remove();
    modal.querySelectorAll('.ic-close').forEach(b => b.addEventListener('click', closeModal));
    modal.querySelector('.ic-download').addEventListener('click', () => downloadIncompleteContactsExcel(incompleteContacts));
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
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
