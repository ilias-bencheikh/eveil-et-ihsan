import json
files = ['public/index.html', 'public/parent-dashboard.html', 'public/eleve-dashboard.html']

script_to_inject = """<script>
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
                html += `<button class="media-lightbox-nav media-lightbox-prev" onclick="event.stopPropagation(); navigateLightbox(-1)">
                            <span class="material-icons">chevron_left</span>
                         </button>`;
            }
            
            if (isVideo) {
                html += `<video src="${media.url}" controls autoplay preload="metadata" onclick="event.stopPropagation()"></video>`;
            } else {
                html += `<img src="${media.url}" alt="${media.nom || ''}" onclick="event.stopPropagation()">`;
            }
            
            if (currentLightboxMedia.length > 1) {
                html += `<button class="media-lightbox-nav media-lightbox-next" onclick="event.stopPropagation(); navigateLightbox(1)">
                            <span class="material-icons">chevron_right</span>
                         </button>`;
                html += `<div class="media-lightbox-counter">${currentLightboxIndex + 1} / ${currentLightboxMedia.length}</div>`;
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
</body>"""

for path in files:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'openMediaLightbox(' not in content:
        content = content.replace('</body>', script_to_inject)
        
        # Replace 1: Single image
        s1_old = """                                    } else {
                                        mediaHtml = `<div class="fb-post-media single">
                            <a href="${m.url}" target="_blank" onclick="event.stopPropagation();">
                                <img src="${m.url}" alt="${m.nom || ""}" loading="lazy">
                            </a>
                        </div>`;
                                    }"""
        s1_new = """                                    } else {
                                        const singleMediaJsonStr = encodeURIComponent(JSON.stringify(allMedia));
                                        mediaHtml = `<div class="fb-post-media single">
                            <a href="javascript:void(0)" onclick="event.stopPropagation(); openMediaLightbox('${singleMediaJsonStr}', 0);">
                                <img src="${m.url}" alt="${m.nom || ""}" loading="lazy">
                            </a>
                        </div>`;
                                    }"""
        content = content.replace(s1_old, s1_new)
        
        # Replace 2: Grid media
        s2_old = """                                  const remaining = allMedia.length - 4;
                                  mediaHtml = `<div class="fb-post-media">
                        <div class="fb-post-media-grid ${gridClass}">
                            ${displayMedia
                                .map((m, i) => {
                                    const isVideo = m.type.startsWith("video/");
                                    const isLast = i === 3 && remaining > 0;
                                    const content = isVideo
                                        ? `<video src="${m.url}" muted preload="metadata"></video><div class="fb-video-badge"><span class="material-icons">play_arrow</span></div>`
                                        : `<img src="${m.url}" alt="${m.nom || ""}" loading="lazy">`;

                                    return `<div class="media-item">
                                    <a href="${m.url}" target="_blank" onclick="event.stopPropagation();" style="display:block;width:100%;height:100%;">
                                        ${content}
                                    </a>
                                    ${isLast ? `<div class="fb-post-media-more">+${remaining}</div>` : ""}
                                </div>`;
                                })
                                .join("")}
                        </div>
                    </div>`;"""
        s2_new = """                                  const remaining = allMedia.length - 4;
                                  const mediaJsonStr = encodeURIComponent(JSON.stringify(allMedia));
                                  mediaHtml = `<div class="fb-post-media">
                        <div class="fb-post-media-grid ${gridClass}">
                            ${displayMedia
                                .map((m, i) => {
                                    const isVideo = m.type.startsWith("video/");
                                    const isLast = i === 3 && remaining > 0;
                                    const content = isVideo
                                        ? `<video src="${m.url}" muted preload="metadata"></video><div class="fb-video-badge"><span class="material-icons">play_arrow</span></div>`
                                        : `<img src="${m.url}" alt="${m.nom || ""}" loading="lazy">`;

                                    return `<div class="media-item">
                                    <a href="javascript:void(0)" onclick="event.stopPropagation(); openMediaLightbox('${mediaJsonStr}', ${i});" style="display:block;width:100%;height:100%;">
                                        ${content}
                                    </a>
                                    ${isLast ? `<div class="fb-post-media-more">+${remaining}</div>` : ""}
                                </div>`;
                                })
                                .join("")}
                        </div>
                    </div>`;"""
        content = content.replace(s2_old, s2_new)
        
        # Replace 3: Modal Gallery Map
        s3_old = """${images.map((f) => `<div class="actu-modal-img-thumb"><a href="${f.url}" target="_blank"><img src="${f.url}" alt="${f.nom || ""}" loading="lazy"></a></div>`).join("")}"""
        s3_new = """${images.map((f, idx) => `<div class="actu-modal-img-thumb"><a href="javascript:void(0)" onclick="openMediaLightbox('${encodeURIComponent(JSON.stringify(images))}', ${idx})"><img src="${f.url}" alt="${f.nom || ""}" loading="lazy"></a></div>`).join("")}"""
        content = content.replace(s3_old, s3_new)
        
        with open(path, 'wb') as out:
            out.write(content.encode('utf-8'))
        pass
