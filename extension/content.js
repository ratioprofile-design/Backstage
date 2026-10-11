// Backstage Casting Companion - Content Script
(function () {
  'use strict';

  console.log('🎬 [Backstage Casting Companion] Active on:', window.location.href);

  const RESERVED_WORDS = new Set([
    'explore', 'direct', 'accounts', 'emails', 'developer', 'about', 'legal',
    'privacy', 'terms', 'help', 'api', 'directory', 'topics', 'archive',
    'settings', 'challenge', 'your_activity', 'saved', 'reels', 'stories'
  ]);

  function cleanHandle(raw) {
    if (!raw) return '';
    const clean = raw.trim().replace(/^@/, '').replace(/^\/|\/$/g, '').split('/')[0].split('?')[0].toLowerCase();
    if (clean && !RESERVED_WORDS.has(clean) && /^[a-zA-Z0-9._]+$/.test(clean)) {
      return `@${clean}`;
    }
    return '';
  }

  // Find the primary post container (dialog or active article)
  function getActivePostContainer() {
    const dialog = document.querySelector('div[role="dialog"]');
    if (dialog && dialog.querySelector('article, header, img')) {
      return dialog;
    }

    const articles = document.querySelectorAll('article');
    if (articles.length === 1) return articles[0];
    if (articles.length > 1) {
      const viewportCenter = window.innerHeight / 2;
      let closest = null;
      let minDistance = Infinity;
      for (const art of articles) {
        const rect = art.getBoundingClientRect();
        if (rect.bottom > 50 && rect.top < window.innerHeight - 50) {
          const artCenter = (rect.top + rect.bottom) / 2;
          const dist = Math.abs(artCenter - viewportCenter);
          if (dist < minDistance) {
            minDistance = dist;
            closest = art;
          }
        }
      }
      if (closest) return closest;
    }

    return null;
  }

  // Detect actor handles from URL, header, captions, or alt tags
  function detectActorHandles() {
    const handles = new Set();

    // 1. From URL
    const path = window.location.pathname.replace(/^\/|\/$/g, '');
    if (path) {
      const parts = path.split('/');
      const first = parts[0].toLowerCase();
      if (first === 'stories' && parts[1]) {
        const h = cleanHandle(parts[1]);
        if (h) handles.add(h);
      } else if (!RESERVED_WORDS.has(first) && first !== 'p' && first !== 'reel' && first !== 'tv') {
        const h = cleanHandle(first);
        if (h) handles.add(h);
      }
    }

    // 2. From Active Post Container
    const container = getActivePostContainer() || document;

    const headerLinks = container.querySelectorAll('header a, article header a, div[role="dialog"] header a');
    for (const a of headerLinks) {
      const hrefHandle = cleanHandle(a.getAttribute('href'));
      if (hrefHandle) handles.add(hrefHandle);
      const textHandle = cleanHandle(a.innerText);
      if (textHandle) handles.add(textHandle);
    }

    const pfpImgs = container.querySelectorAll('img[alt*="profile picture"]');
    for (const img of pfpImgs) {
      const match = img.alt?.match(/^([a-zA-Z0-9._]+)'s profile picture/i);
      if (match && match[1]) {
        const h = cleanHandle(match[1]);
        if (h) handles.add(h);
      }
    }

    const textMatch = (container.innerText || document.body?.innerText || '').match(/(?:More posts from|View more from)\s+([a-zA-Z0-9._]+)/i);
    if (textMatch && textMatch[1]) {
      const h = cleanHandle(textMatch[1]);
      if (h) handles.add(h);
    }

    const profileHeading = document.querySelector('header section h2, header h2, header h1');
    if (profileHeading) {
      const h = cleanHandle(profileHeading.innerText);
      if (h) handles.add(h);
    }

    return Array.from(handles);
  }

  // Extract all photos and current visible photo from active container
  function extractPhotos(container) {
    const photos = new Set();
    let currentPhoto = '';

    if (!container) return { currentPhoto: '', allPhotos: [] };

    // Find all post images in the container
    const imgs = Array.from(container.querySelectorAll('article img, div[role="dialog"] img, img[style*="object-fit"]'));
    const candidateImgs = imgs.filter(img => {
      const src = img.src || '';
      return src && 
             !src.includes('data:') && 
             !src.includes('profile_pic') && 
             !src.includes('s150x150') &&
             !img.alt?.toLowerCase().includes('profile picture') &&
             (img.naturalWidth > 200 || img.width > 200 || !img.naturalWidth);
    });

    for (const img of candidateImgs) {
      photos.add(img.src);
    }

    // Determine currently visible image (e.g. in active carousel slide)
    for (const img of candidateImgs) {
      const rect = img.getBoundingClientRect();
      if (rect.width > 150 && rect.height > 150 && rect.left >= 0 && rect.right <= window.innerWidth + 50) {
        currentPhoto = img.src;
        break;
      }
    }

    if (!currentPhoto && candidateImgs.length > 0) {
      currentPhoto = candidateImgs[0].src;
    }

    // Fallback: check og:image meta tag
    if (!currentPhoto) {
      const ogImg = document.querySelector('meta[property="og:image"]');
      if (ogImg && ogImg.content && !ogImg.content.includes('static')) {
        currentPhoto = ogImg.content;
        photos.add(currentPhoto);
      }
    }

    return {
      currentPhoto,
      allPhotos: Array.from(photos)
    };
  }

  function extractProfileData(targetHandle = null, specificPhotoUrl = null) {
    const handles = detectActorHandles();
    const handle = targetHandle ? cleanHandle(targetHandle) : (handles[0] || '');
    if (!handle) return null;

    const container = getActivePostContainer() || document;
    const { currentPhoto, allPhotos } = extractPhotos(container);

    const chosenPhoto = specificPhotoUrl || currentPhoto;

    // Display Name
    let name = '';
    const nameEl = document.querySelector('header section span, header h1, header h2');
    if (nameEl) {
      const txt = nameEl.innerText.trim();
      if (txt && !txt.includes('\n') && txt.length < 40 && !txt.includes('followers')) {
        name = txt;
      }
    }
    if (!name || name.toLowerCase() === handle.slice(1)) {
      name = handle.slice(1).replace(/[._]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // Bio / Caption
    let bio = '';
    const captionEl = container.querySelector('article h1, article div[role="button"] + span, header section div:nth-child(3)');
    if (captionEl && captionEl.innerText) {
      bio = captionEl.innerText.trim().slice(0, 300);
    }

    let followerCount = '';
    const followerEl = document.querySelector('header ul li:nth-child(2)');
    if (followerEl) {
      followerCount = followerEl.innerText.replace(/followers/i, '').trim();
    }

    return {
      handle,
      name,
      photoUrl: chosenPhoto,
      photos: allPhotos,
      bio,
      followerCount,
      allHandles: handles,
      url: window.location.href,
      source: 'backstage_extension',
      timestamp: Date.now()
    };
  }

  function showToast(message, isError = false) {
    const existing = document.querySelector('.backstage-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `backstage-toast ${isError ? 'error' : 'success'}`;
    toast.innerHTML = `
      <span style="font-size:16px;">${isError ? '⚠️' : '🎬'}</span>
      <span>${message}</span>
    `;
    (document.body || document.documentElement).appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  async function syncToBackstage(targetHandle = null, specificPhoto = null, triggerEl = null) {
    const data = extractProfileData(targetHandle, specificPhoto);
    if (!data || !data.handle) {
      showToast('Could not detect actor handle on this post.', true);
      return;
    }

    if (triggerEl) {
      triggerEl.classList.add('backstage-loading');
      const label = triggerEl.querySelector('.backstage-badge-label');
      if (label) label.innerText = 'Saving...';
    }

    try {
      const res = await fetch('http://localhost:3000/api/talent/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        showToast(`Saved photo of ${data.name} (${data.handle}) to Backstage!`);
        if (triggerEl) {
          triggerEl.classList.remove('backstage-loading');
          triggerEl.classList.add('backstage-saved');
          const label = triggerEl.querySelector('.backstage-badge-label');
          if (label) label.innerText = '✓ Saved!';
          setTimeout(() => {
            triggerEl.classList.remove('backstage-saved');
            if (label) label.innerText = 'Backstage';
          }, 2500);
        }
        return;
      }
    } catch (err) {
      console.warn('[Backstage] Direct sync failed:', err);
    }

    // Fallback: clipboard
    try {
      await navigator.clipboard.writeText(JSON.stringify(data));
      showToast(`Copied ${data.handle} to clipboard for Backstage!`);
      if (triggerEl) {
        triggerEl.classList.remove('backstage-loading');
        triggerEl.classList.add('backstage-saved');
        const label = triggerEl.querySelector('.backstage-badge-label');
        if (label) label.innerText = '✓ Copied!';
      }
    } catch (e) {
      showToast(`Sync failed: ${e.message}`, true);
    }
  }

  // Inject subtle icon badge at top-right of the photo container
  function injectPhotoBadges() {
    const container = getActivePostContainer();
    if (!container) return;

    const handles = detectActorHandles();
    if (handles.length === 0) return;

    // Find the media container (the image side of the post)
    // In Instagram, this is typically the first child of the article or div containing the main image
    let mediaBox = container.querySelector('article > div > div:first-child, div._aagu, div[role="button"][tabindex="0"]');
    if (!mediaBox) {
      // Find the element wrapping the largest image
      const imgs = container.querySelectorAll('article img, div[role="dialog"] img');
      for (const img of imgs) {
        if (img.width > 250 || img.naturalWidth > 250) {
          mediaBox = img.parentElement;
          while (mediaBox && mediaBox !== container && mediaBox.offsetHeight < 200) {
            mediaBox = mediaBox.parentElement;
          }
          break;
        }
      }
    }

    if (!mediaBox) return;

    // Make sure mediaBox has position relative so absolute positioning works
    const computedPos = window.getComputedStyle(mediaBox).position;
    if (computedPos === 'static') {
      mediaBox.style.position = 'relative';
    }

    if (mediaBox.querySelector('.backstage-photo-badge')) return;

    const badge = document.createElement('button');
    badge.className = 'backstage-photo-badge';
    badge.title = `Send this photo of ${handles[0]} to Backstage`;
    badge.innerHTML = `
      <span class="backstage-badge-icon">🎬</span>
      <span class="backstage-badge-label">Backstage</span>
    `;

    badge.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Extract the photo currently in this media box
      const activeImg = mediaBox.querySelector('img[style*="object-fit"], img');
      const photoSrc = activeImg ? activeImg.src : null;
      syncToBackstage(handles[0], photoSrc, badge);
    };

    mediaBox.appendChild(badge);
  }

  // Remove the old clunky bottom-right floating button that covered the comment box
  function removeClunkyFloatingButton() {
    const oldRoot = document.getElementById('backstage-grabber-root');
    if (oldRoot) {
      oldRoot.remove();
    }
  }

  function updateUI() {
    try {
      removeClunkyFloatingButton();
      injectPhotoBadges();
    } catch (e) {
      console.warn('[Backstage] UI error:', e);
    }
  }

  let debounceTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(updateUI, 150);
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  window.addEventListener('scroll', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(updateUI, 250);
  }, { passive: true });

  updateUI();
  setInterval(updateUI, 1000);

  // Communication with popup
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
      if (req.action === 'extract') {
        const data = extractProfileData(req.handle);
        sendResponse(data);
      } else if (req.action === 'sync') {
        syncToBackstage(req.handle, req.photoUrl).then(() => sendResponse({ success: true }));
        return true;
      }
    });
  }
})();
