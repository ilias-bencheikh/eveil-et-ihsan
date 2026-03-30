import sys
import re
from pathlib import Path

files = ['public/eleve-dashboard.html', 'public/parent-dashboard.html', 'public/index.html']
for file in files:
    p = Path(file)
    content = p.read_text(encoding='utf-8')
    
    # Remove the wrapper
    content = re.sub(r'<div class="fb-post-body-wrapper">', '', content)
    # Remove the fade overlay
    content = re.sub(r'<div class="fb-post-fade-overlay">.*?</div>', '', content, flags=re.DOTALL)
    
    # To fix the unclosed </div>
    content = re.sub(r'</div>\s*</article>', '</article>', content)
    
    p2 = Path(file + ".tmp")
    p2.write_text(content, encoding='utf-8')
