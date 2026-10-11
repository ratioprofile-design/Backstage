// Backstage Casting Companion - Popup Logic
document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');
  const profileContainer = document.getElementById('profile-container');
  const chipsContainer = document.getElementById('chips-container');
  const syncBtn = document.getElementById('sync-btn');
  const manualInput = document.getElementById('manual-handle');
  const manualBtn = document.getElementById('manual-btn');

  let currentProfileData = null;
  let activeTabId = null;

  // 1. Check local Backstage server status
  try {
    const res = await fetch('http://localhost:3000/api/talent/sync');
    if (res.ok) {
      statusEl.innerHTML = '<span style="color:#10b981;">● Connected to Backstage (port 3000)</span>';
    } else {
      statusEl.innerHTML = '<span style="color:#f59e0b;">● Backstage offline (run `npm run dev`)</span>';
    }
  } catch (e) {
    statusEl.innerHTML = '<span style="color:#f59e0b;">● Backstage offline (run `npm run dev`)</span>';
  }

  // 2. Query active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabId = tab?.id;
  const isIg = tab?.url && (tab.url.includes('instagram.com'));

  if (!isIg) {
    profileContainer.innerHTML = '<div style="color:#94a3b8;font-size:11px;padding:8px 0;">Navigate to Instagram or paste a handle below.</div>';
    syncBtn.style.display = 'none';
    setupManualHandler();
    return;
  }

  // 3. Ensure content script is injected (even on tabs opened before extension installed!)
  async function ensureScriptInjected() {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        files: ['content.js']
      });
      await chrome.scripting.insertCSS({
        target: { tabId: activeTabId },
        files: ['content.css']
      });
    } catch (e) {
      // If already injected or restricted tab, proceed
    }
  }

  await ensureScriptInjected();

  // 4. Extract data from page
  function loadProfileData(targetHandle = null) {
    chrome.tabs.sendMessage(activeTabId, { action: 'extract', handle: targetHandle }, (data) => {
      if (chrome.runtime.lastError || !data || !data.handle) {
        // Fallback: Try regex matching tab URL or show ready state
        const urlMatch = tab.url.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
        const fallbackHandle = urlMatch && !['p', 'reel', 'stories', 'explore', 'direct'].includes(urlMatch[1]) ? `@${urlMatch[1]}` : '';

        if (fallbackHandle) {
          renderData({
            handle: fallbackHandle,
            name: fallbackHandle.slice(1).replace(/[._]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            photoUrl: '',
            url: tab.url,
            allHandles: [fallbackHandle]
          });
        } else {
          profileContainer.innerHTML = `
            <div style="font-size:11px;color:#94a3b8;padding:8px 0;">
              No actor profile detected on current view. Click on any post/profile or type below.
            </div>
          `;
          syncBtn.innerText = '🎬 Send Active Tab URL';
          syncBtn.onclick = () => sendToBackstage({ handle: '@instagram_actor', url: tab.url, name: 'Instagram Actor' });
        }
        return;
      }

      renderData(data);
    });
  }

  function renderData(data) {
    currentProfileData = data;

    const avatarHtml = data.photoUrl 
      ? `<img src="${data.photoUrl}" class="profile-avatar" onerror="this.style.display='none'" />` 
      : `<div class="profile-avatar" style="display:flex;align-items:center;justify-content:center;font-size:18px;">👤</div>`;

    profileContainer.innerHTML = `
      <div class="profile-card">
        ${avatarHtml}
        <div class="profile-details">
          <div class="profile-name">${data.name || data.handle}</div>
          <div class="profile-handle">${data.handle}</div>
          ${data.followerCount ? `<div class="profile-sub">${data.followerCount} followers</div>` : ''}
        </div>
      </div>
    `;

    // Multi-handle chips (e.g. co-authors)
    if (data.allHandles && data.allHandles.length > 1) {
      chipsContainer.style.display = 'flex';
      chipsContainer.innerHTML = data.allHandles.map(h => `
        <span class="chip ${h === data.handle ? 'active' : ''}" data-handle="${h}">${h}</span>
      `).join('');

      chipsContainer.querySelectorAll('.chip').forEach(chip => {
        chip.onclick = () => {
          loadProfileData(chip.dataset.handle);
        };
      });
    } else {
      chipsContainer.style.display = 'none';
    }

    syncBtn.style.display = 'flex';
    syncBtn.disabled = false;
    syncBtn.innerText = `🎬 Send ${data.handle} to Backstage`;
    syncBtn.onclick = () => sendToBackstage(currentProfileData);
  }

  async function sendToBackstage(data) {
    if (!data || !data.handle) return;
    syncBtn.disabled = true;
    syncBtn.innerText = '⏳ Syncing to Backstage...';

    try {
      const res = await fetch('http://localhost:3000/api/talent/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        syncBtn.style.background = '#10b981';
        syncBtn.innerText = `✓ Synced ${data.handle}!`;
        setTimeout(() => window.close(), 1200);
        return;
      }
    } catch (err) {}

    // Fallback: clipboard
    try {
      await navigator.clipboard.writeText(JSON.stringify(data));
      syncBtn.innerText = '✓ Copied to Clipboard!';
      setTimeout(() => window.close(), 1200);
    } catch (e) {
      syncBtn.innerText = '⚠️ Sync error';
    }
  }

  function setupManualHandler() {
    manualBtn.onclick = () => {
      const val = manualInput.value.trim();
      if (!val) return;
      let clean = val.replace(/^@/, '').replace(/https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '').trim();
      if (!clean) return;

      const data = {
        handle: `@${clean}`,
        name: clean.replace(/[._]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        url: `https://www.instagram.com/${clean}/`,
        source: 'manual_popup',
        timestamp: Date.now()
      };
      sendToBackstage(data);
    };

    manualInput.onkeydown = (e) => {
      if (e.key === 'Enter') manualBtn.click();
    };
  }

  setupManualHandler();
  loadProfileData();
});
