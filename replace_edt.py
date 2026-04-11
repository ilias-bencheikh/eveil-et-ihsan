import re

with open('public/index.html', 'r') as f:
    content = f.read()

regex1 = r'<div style="display:flex;flex-direction:column;gap:12px;">\s*\$\{jours[\s\S]*?\.join\(""\)[\s\S]*?<\/div>'
newBlock1 = '''<div class="edt-weekly-grid">
                            <div class="edt-grid-header">
                                <div>Jour</div>
                                <div><span class="material-icons" style="font-size:18px;">wb_sunny</span> Matin</div>
                                <div><span class="material-icons" style="font-size:18px;">wb_twilight</span> Après-midi</div>
                            </div>
                            ${jours.map(jour => `
                            <div class="edt-grid-row">
                                <div class="edt-grid-day">${joursLabels[jour]}</div>
                                <label class="edt-grid-cell" title="Matin - ${joursLabels[jour]}">
                                    <input class="edt-grid-checkbox" type="checkbox" id="edt_${jour}_matin"
                                           ${window._edtCreneaux.some((c) => c.jour === jour && c.periode === "matin") ? "checked" : ""}
                                           onchange="updateEdtCheckbox(this, '${jour}', 'matin')">
                                    <div class="edt-grid-visual"><span class="material-icons">check</span></div>
                                </label>
                                <label class="edt-grid-cell" title="Après-midi - ${joursLabels[jour]}">
                                    <input class="edt-grid-checkbox" type="checkbox" id="edt_${jour}_apm"
                                           ${window._edtCreneaux.some((c) => c.jour === jour && c.periode === "apres-midi") ? "checked" : ""}
                                           onchange="updateEdtCheckbox(this, '${jour}', 'apres-midi')">
                                    <div class="edt-grid-visual"><span class="material-icons">check</span></div>
                                </label>
                            </div>`).join("")}
                        </div>'''

if re.search(regex1, content):
    content = re.sub(regex1, newBlock1, content, count=1)
    print('Block 1 replaced')
else:
    print('Block 1 NOT found')

regex2 = r'<div style="display:grid;grid-template-columns:repeat\(auto-fill,minmax\(280px,1fr\)\);gap:12px;">\s*\$\{jours[\s\S]*?\.join\(""\)[\s\S]*?<\/div>'
newBlock2 = '''<div class="edt-weekly-grid">
                            <div class="edt-grid-header">
                                <div>Jour</div>
                                <div><span class="material-icons" style="font-size:18px;">wb_sunny</span> Matin</div>
                                <div><span class="material-icons" style="font-size:18px;">wb_twilight</span> Après-midi</div>
                            </div>
                            ${jours.map(jour => `
                            <div class="edt-grid-row">
                                <div class="edt-grid-day">${joursLabels[jour]}</div>
                                <label class="edt-grid-cell" title="Matin - ${joursLabels[jour]}">
                                    <input class="edt-grid-checkbox" type="checkbox" id="create_edt_${jour}_matin"
                                           onchange="updateCreateClasseEdt('${jour}', 'matin', this.checked)">
                                    <div class="edt-grid-visual"><span class="material-icons">check</span></div>
                                </label>
                                <label class="edt-grid-cell" title="Après-midi - ${joursLabels[jour]}">
                                    <input class="edt-grid-checkbox" type="checkbox" id="create_edt_${jour}_apm"
                                           onchange="updateCreateClasseEdt('${jour}', 'apres-midi', this.checked)">
                                    <div class="edt-grid-visual"><span class="material-icons">check</span></div>
                                </label>
                            </div>`).join("")}
                        </div>'''

if re.search(regex2, content):
    content = re.sub(regex2, newBlock2, content, count=1)
    print('Block 2 replaced')
else:
    print('Block 2 NOT found')

with open('public/index.html', 'w') as f:
    f.write(content)
