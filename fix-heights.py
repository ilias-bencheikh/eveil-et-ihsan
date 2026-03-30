import re
import os

files = [
    'public/css/eleve-modern.css',
    'public/index.html',
    'public/parent-dashboard.html',
    'public/eleve-dashboard.html'
]

for file in files:
    with open(file, 'rb') as f:
        content = f.read().decode('utf-8')
    
    # Remove fixed heights for .fb-post
    content = re.sub(r'height:\s*420px;', '', content)
    content = re.sub(r'height:\s*380px;', '', content)
    
    # Remove fade overlay html from js
    content = re.sub(r'<div class="fb-post-fade-overlay">\s*<span>.*?</span>\s*</div>', '', content, flags=re.DOTALL)
    
    # Remove the CSS class .fb-post-fade-overlay entirely
    content = re.sub(r'\.fb-post-fade-overlay\s*\{[^}]+\}', '', content)
    content = re.sub(r'\.fb-post-fade-overlay\s*span\s*\{[^}]+\}', '', content)
    content = re.sub(r'\.fb-post:hover\s*\.fb-post-fade-overlay\s*span\s*\{[^}]+\}', '', content)
    
    # Remove .fb-post-body-wrapper styles that might hide overflow
    content = re.sub(r'\.fb-post-body-wrapper\s*\{[^}]+\}', '', content)

    # remove <div class="fb-post-body-wrapper"> wrapper and </div>
    content = re.sub(r'<div class="fb-post-body-wrapper">', '', content)
    
    with open(file, 'wb') as f2:
        f2.write(content.encode('utf-8'))

print('Done!')
