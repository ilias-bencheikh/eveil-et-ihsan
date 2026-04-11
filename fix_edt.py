import re

with open('public/index.html', 'r') as f:
    content = f.read()

# Add the CSS styles into the <head> if not exists
css_styles = """
    <style>
        .edt-container {
            border: 1px solid var(--md-sys-color-outline-variant);
            border-radius: 16px;
            background: var(--md-sys-color-surface);
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        .edt-day-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 20px;
            border-bottom: 1px solid var(--md-sys-color-outline-variant);
            transition: background-color 0.2s;
        }
        .edt-day-row:last-child {
            border-bottom: none;
        }
        .edt-day-row:hover {
            background-color: var(--md-sys-color-surface-container-lowest);
        }
        .edt-day-name {
            font-weight: 600;
            font-size: 15px;
            color: var(--md-sys-color-on-surface);
            display: flex;
            align-items: center;
            gap: 12px;
            width: 150px;
        }
        .edt-day-toggles {
            display: flex;
            gap: 12px;
            flex: 1;
            justify-content: flex-end;
            flex-wrap: wrap;
        }
        .edt-toggle-label {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            border-radius: 8px;
            border: 1px solid var(--md-sys-color-outline);
            background: var(--md-sys-color-surface);
            color: var(--md-sys-color-on-surface-variant);
            cursor: pointer;
            transition: all 0.2s;
            user-select: none;
            font-size: 14px;
            font-weight: 500;
            min-width: 130px;
            justify-content: center;
        }
        .edt-toggle-label:hover {
            background: var(--md-sys-color-surface-container-highest);
            border-color: var(--md-sys-color-outline-variant);
        }
        .edt-toggle-input {
            display: none;
        }
        .edt-toggle-input:checked + .edt-toggle-label {
            background: var(--md-sys-color-primary-container);
            border-color: var(--md-sys-color-primary);
            color: var(--md-sys-color-on-primary-container);
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .edt-toggle-input:checked + .edt-toggle-label .material-icons {
            color: var(--md-sys-color-primary);
        }
        @media (max-width: 600px) {
            .edt-day-row {
                flex-direction: column;
                align-items: flex-start;
                gap: 16px;
                padding: 16px;
            }
            .edt-day-toggles {
                width: 100%;
                justify-content: space-between;
            }
            .edt-toggle-label {
                flex: 1;
                min-width: auto;
                padding: 10px 8px;
            }
        }
    </style>
"""

if "edt-day-row" not in content:
    content = content.replace("</head>", css_styles + "</head>")

# Block 1: Edit Modal
regex1 = r'<div class="edt-weekly-grid">[\s\S]*?updateEdtCheckbox[\s\S]*?<\/div>'

newBlock1 = '''<div class="edt-container">
                            ${jours.map(jour => `
                            <div class="edt-day-row">
                                <div class="edt-day-name">
                                    <span class="material-icons" style="color:var(--md-sys-color-tertiary); font-size: 20px;">today</span>
                                    ${joursLabels[jour]}
                                </div>
                                <div class="edt-day-toggles">
                                    <input class="edt-toggle-input" type="checkbox" id="edt_${jour}_matin"
                                           ${window._edtCreneaux.some((c) => c.jour === jour && c.periode === "matin") ? "checked" : ""}
                                           onchange="updateEdtCheckbox(this, '${jour}', 'matin')">
                                    <label class="edt-toggle-label" for="edt_${jour}_matin" title="Matin - ${joursLabels[jour]}">
                                        <span class="material-icons" style="font-size: 18px;">wb_sunny</span> Matin
                                    </label>

                                    <input class="edt-toggle-input" type="checkbox" id="edt_${jour}_apm"
                                           ${window._edtCreneaux.some((c) => c.jour === jour && c.periode === "apres-midi") ? "checked" : ""}
                                           onchange="updateEdtCheckbox(this, '${jour}', 'apres-midi')">
                                    <label class="edt-toggle-label" for="edt_${jour}_apm" title="Après-midi - ${joursLabels[jour]}">
                                        <span class="material-icons" style="font-size: 18px;">wb_twilight</span> Après-midi
                                    </label>
                                </div>
                            </div>`).join("")}
                        </div>'''

if re.search(regex1, content):
    content = re.sub(regex1, newBlock1, content, count=1)
    print('Block 1 replaced')
else:
    print('Block 1 NOT found')

# Block 2: Create Form
regex2 = r'<div class="edt-weekly-grid">[\s\S]*?updateCreateClasseEdt[\s\S]*?<\/div>'

newBlock2 = '''<div class="edt-container">
                            ${jours.map(jour => `
                            <div class="edt-day-row">
                                <div class="edt-day-name">
                                    <span class="material-icons" style="color:var(--md-sys-color-tertiary); font-size: 20px;">today</span>
                                    ${joursLabels[jour]}
                                </div>
                                <div class="edt-day-toggles">
                                    <input class="edt-toggle-input" type="checkbox" id="create_edt_${jour}_matin"
                                           onchange="updateCreateClasseEdt('${jour}', 'matin', this.checked)">
                                    <label class="edt-toggle-label" for="create_edt_${jour}_matin" title="Matin - ${joursLabels[jour]}">
                                        <span class="material-icons" style="font-size: 18px;">wb_sunny</span> Matin
                                    </label>

                                    <input class="edt-toggle-input" type="checkbox" id="create_edt_${jour}_apm"
                                           onchange="updateCreateClasseEdt('${jour}', 'apres-midi', this.checked)">
                                    <label class="edt-toggle-label" for="create_edt_${jour}_apm" title="Après-midi - ${joursLabels[jour]}">
                                        <span class="material-icons" style="font-size: 18px;">wb_twilight</span> Après-midi
                                    </label>
                                </div>
                            </div>`).join("")}
                        </div>'''

if re.search(regex2, content):
    content = re.sub(regex2, newBlock2, content, count=1)
    print('Block 2 replaced')
else:
    print('Block 2 NOT found')

with open('public/index.html', 'w') as f:
    f.write(content)
