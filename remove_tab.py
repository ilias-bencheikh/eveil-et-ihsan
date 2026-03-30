import sys

try:
    with open('public/index.html', 'rb') as f:
        content = f.read().decode('utf-8')

    start = content.find('<!-- ========== APPEL TAB ========== -->')
    end = content.find('<!-- ========== ABSENCES TAB ========== -->')

    if start > 0 and end > start:
        with open('public/index.html', 'wb') as f:
            f.write((content[:start] + content[end:]).encode('utf-8'))
        print("Deleted successfully")
    else:
        print("Not found")
except Exception as e:
    print(e)
