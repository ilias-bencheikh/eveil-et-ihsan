const fs = require('fs');

const lightboxScript = `
<script>
        let currentLightboxMedia = [];
        let currentLightboxIndex = 0;

        function openMediaLightbox(mediaJson, startIndex) {
            try {
                currentLightboxMedia = typeof mediaJson === 'string' ? JSON.parse(decodeURIComponent(mediaJson)) : mediaJson;
            } catch(e) {
                console.error("Error parsing media for lightbox", e);
                return;
            }
            if(!currentLightboxMedia || currentLightboxMedia.length === 0) return;
            
            currentLightboxIndex = startIndex || 0;
            renderLightboxContent();
            
            document.getElementById('mediaLightbox').classList.add('open');
            document.body.style.overflow = 'hidden';
            
            document.addEventListener('keydown', handleLightboxKeydown);
        }

        function closeMediaLightbox() {
            document.getElementById('mediaLightbox').classList.remove('open');
            document.body.style.overflow = '';
            
            const container = document.getElementById('mediaLightboxContainer');
            if(container) {
                const vid = container.querySelector('video');
                if(vid) vid.pause();
                container.innerHTML = '';
            }
            
            document.removeEventListener('keydown', handleLightboxKeydown);
        }

        function renderLightboxContent() {
            const container = document.getElementById('mediaLightboxContainer');
            if(!container) return;
            
            const media = currentLightboxMedia[currentLightboxIndex];
            if(!media) return;
            
            const isVideo = media.type && media.type.startsWith('video/');
            
            let html = '';
            
            if (currentLightboxMedia.length > 1) {
                html += \`<button class="media-lightbox-nav media-lightbox-prev" onclick="event.stopPropagation(); navigateLightbox(-1)">
                            <span class="material-icons">chevron_left</span>
                         </button>\`;
            }
            
            if (isVideo) {
                html += \`<video src="\${media.url}" controls autoplay preload="metadata" onclick="event.stopPropagation()"></video>\`;
            } else {
                html += \`<img src="\${media.url}" alt="\${media.nom || ''}" onclick="event.stopPropagation()">\`;
            }
            
            if (currentLightboxMedia.length > 1) {
                html += \`<button class="media-lightbox-nav media-lightbox-next" onclick="event.stopPropagation(); navigateLightbox(1)">
                            <span class="material-icons">chevron_right</span>
                         </button>\`;
                html += \`<div class="media-lightbox-counter">\${currentLightboxIndex + 1} / \${currentLightboxMedia.length}</div>\`;
            }
            
            container.innerHTML = html;
        }

        function navigateLightbox(direction) {
            currentLightboxIndex += direction;
            if (currentLightboxIndex < 0) currentLightboxIndex = currentLightboxMedia.length - 1;
            if (currentLightboxIndex >= currentLightboxMedia.length) currentLightboxIndex = 0;
            renderLightboxContent();
        }

        function handleLightboxKeydown(e) {
            if (e.key === 'Escape') closeMediaLightbox();
            else if (e.key === 'ArrowLeft') navigateLightbox(-1);
            else if (e.key === 'ArrowRight') navigateLightbox(1);
        }
</script>
`;

['public/index.html', 'public/parent-dashboard.html', 'public/eleve-dashboard.html'].forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    if (!content.includes('openMediaLightbox(')) {
        content = content.replace('</body>', lightboxScript + '\n</body>');
        
        // Fix feed grid mapping
        content = content.replace(/const remaining = allMedia\.length - 4;/g, 'const remaining = allMedia.length - 4;\n                                    const mediaJsonStr = encodeURIComponent(JSON.stringify(allMedia));');
        
        content = content.replace(/<a href="\$\{m\.url\}" target="_blank" onclick="event\.stopPropagation\(\);"([\s\S]*?)>([\s\S]*?)<\/a>/g, 
            '<a href="javascript:void(0)" onclick="event.stopPropagation(); openMediaLightbox(\'${mediaJsonStr}\', ${i});"$1>$2</a>');
            
        // Fix feed single media
        content = content.replace(/const m = allMedia\[0\];/g, 'const m = allMedia[0];\n                                    const singleMediaJsonStr = encodeURIComponent(JSON.stringify(allMedia));');
        
        content = content.replace(/<a href="\$\{m\.url\}" target="_blank" onclick="event\.stopPropagation\(\);">\s*<img src="\$\{m\.url\}"/g, 
            '<a href="javascript:void(0)" onclick="event.stopPropagation(); openMediaLightbox(\'${singleMediaJsonStr}\', 0);">\n                                  <img src="${m.url}"');
            
        // Fix actu modal gallery images
        content = content.replace(/\$\{images\.map\(\(f\) => `<div class="actu-modal-img-thumb"><a href="\$\{f\.url\}" target="_blank"><img src="\$\{f\.url\}" alt="\$\{f\.nom \|\| ""\}" loading="lazy"><\/a><\/div>`\)\.join\(""\)\}/g, 
            '${images.map((f, idx) => `<div class="actu-modal-img-thumb"><a href="javascript:void(0)" onclick="openMediaLightbox(\\'${encodeURIComponent(JSON.stringify(images))}\\', ${idx})"><img src="${f.url}" alt="${f.nom || \\"\\"}" loading="lazy"></a></div>`).join("")}');
        
        fs.writeFileSync(file, content);
        console.log('Processed ' + file);
    }
});
