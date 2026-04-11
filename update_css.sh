sed -i '/\/\* EDT Chips styles \*\//,$d' public/css/main.css
cat << 'INNER_EOF' >> public/css/main.css
/* EDT Weekly Grid styles */
.edt-weekly-grid {
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: 12px;
    background: var(--md-sys-color-surface);
    overflow: hidden;
    margin-bottom: 16px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}
.edt-grid-header {
    display: grid;
    grid-template-columns: 120px 1fr 1fr;
    background: var(--md-sys-color-surface-container-high);
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
}
.edt-grid-header > div {
    padding: 12px;
    font-weight: 600;
    font-size: 13px;
    color: var(--md-sys-color-on-surface);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-right: 1px solid var(--md-sys-color-outline-variant);
}
.edt-grid-header > div:last-child { border-right: none; }
.edt-grid-header > div:first-child { justify-content: flex-start; padding-left: 16px; }

.edt-grid-row {
    display: grid;
    grid-template-columns: 120px 1fr 1fr;
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
    transition: background 0.2s;
}
.edt-grid-row:hover {
    background: var(--md-sys-color-surface-container-lowest);
}
.edt-grid-row:last-child {
    border-bottom: none;
}
.edt-grid-day {
    padding: 12px 16px;
    font-weight: 500;
    font-size: 14px;
    display: flex;
    align-items: center;
    color: var(--md-sys-color-on-surface);
    border-right: 1px solid var(--md-sys-color-outline-variant);
}
.edt-grid-cell {
    position: relative;
    cursor: pointer;
    border-right: 1px solid var(--md-sys-color-outline-variant);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    margin: 0;
}
.edt-grid-cell:last-child {
    border-right: none;
}
.edt-grid-checkbox {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    height: 0;
    width: 0;
}
.edt-grid-visual {
    width: 100%;
    height: 100%;
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    transition: all 0.2s ease;
    color: transparent;
}
.edt-grid-checkbox:checked ~ .edt-grid-visual {
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-primary);
}
.edt-grid-cell:hover .edt-grid-visual {
    background: var(--md-sys-color-surface-variant);
}
.edt-grid-checkbox:checked:hover ~ .edt-grid-visual {
    background: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
}

@media (max-width: 500px) {
    .edt-grid-header, .edt-grid-row {
        grid-template-columns: 80px 1fr 1fr;
    }
    .edt-grid-day { font-size: 12px; padding: 8px; }
    .edt-grid-header > div { font-size: 11px; padding: 8px; flex-direction: column; gap: 2px; }
    .edt-grid-header .material-icons { font-size: 16px; }
}
INNER_EOF
bash update_css.sh
