import sys
import re
import os
from pathlib import Path

files = [
    os.path.join(os.getcwd(), 'public', 'css', 'eleve-modern.css'),
    os.path.join(os.getcwd(), 'public', 'index.html'),
    os.path.join(os.getcwd(), 'public', 'parent-dashboard.html'),
    os.path.join(os.getcwd(), 'public', 'eleve-dashboard.html')
]

for file in files:
    p = Path(file)
    b = p.read_bytes()
    content = b.decode('utf-8')

    content = re.sub(r'height:\s*420px;\n*', '', content)
    content = re.sub(r'height:\s*380px;\n*', '', content)
    content = re.sub(r'flex-direction:\s*column;\n*', '', content)
    content = re.sub(r'display:\s*flex;\n*', '', content)
    
    content = re.sub(r'\.fb-post-body-wrapper\s*\{[^}]*\}\n*', '', content)
    content = re.sub(r'\.fb-post-fade-overlay\s*\{[^}]*\}\n*', '', content)
    content = re.sub(r'\.fb-post-fade-overlay\s*span\s*\{[^}]*\}\n*', '', content)
    content = re.sub(r'\.fb-post:hover\s*\.fb-post-fade-overlay\s*span\s*\{[^}]*\}\n*', '', content)

    content = re.sub(r'<div class="fb-post-body-wrapper">\n*', '', content)
    content = re.sub(r'<div class="fb-post-fade-overlay">\s*<span>.*?</span>\s*</div>\n*', '', content, flags=re.DOTALL)
    content = re.sub(r'</div>\s*</article>', '</article>', content)
    
    out_b = content.encode('utf-8')
    p.write_bytes(out_b)

print("Successfully reverted fixed heights and overlays!")