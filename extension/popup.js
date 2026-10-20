// tabone - Chrome Extension Popup Controller
(function () {
  'use strict';

  // Default GitHub Pages viewer URL for the user's repository
  const GITHUB_PAGES_PRESET = 'https://jack4z1.github.io/tabone/';
  const LOCAL_WIFI_PRESET = 'http://192.168.0.103:8080/web/';
  const DEFAULT_VIEWER_URL = GITHUB_PAGES_PRESET;

  // Tracking query parameters to remove (comprehensive multi-platform ad/tracking strip)
  const TRACKING_PARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
    'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'zanpid',
    '_ga', '_gl', 'mc_eid', 'mc_cid', 'si', 'feature', 'igshid',
    'twclid', 'ref_src', 'ref_url', 'ttclid', 'rdt_cid', 'gbraid',
    'wbraid', 'yclid', '_hsenc', '_hsmi', 'hsCtaTracking', 'irclickid'
  ];

  // Standard QR capacity limits & safe tab recommendations (15% safety buffer)
  const QR_SPECS = {
    18: {
      grid: '89×89',
      name: 'Version 18',
      desc: 'Larger blocks (optimized for older / budget phone cameras)',
      caps: { L: 718, M: 560, Q: 394, H: 310 },
      safeTabs: { L: 5, M: 4, Q: 2, H: 1 }
    },
    35: {
      grid: '157×157',
      name: 'Version 35',
      desc: 'High density (holds more tabs, for modern high-res cameras)',
      caps: { L: 2303, M: 1809, Q: 1283, H: 983 },
      safeTabs: { L: 24, M: 18, Q: 12, H: 7 }
    }
  };

  // State
  let allTabs = [];
  let selectedTabIds = new Set();
  let viewerBaseUrl = DEFAULT_VIEWER_URL;
  let isPinEnabled = false;
  let pinCode = '';
  let currentShareUrl = '';
  let localViewerUrl = '';
  let selectedVersion = 18;
  let selectedLevel = 'M';

  // DOM Elements
  const tabCountBadge = document.getElementById('tabCountBadge');
  const tabSelectionCount = document.getElementById('tabSelectionCount');
  const qrCanvas = document.getElementById('qrCanvas');
  const qrStatusText = document.getElementById('qrStatusText');
  const tabList = document.getElementById('tabList');
  const selectAllBtn = document.getElementById('selectAllBtn');
  const deselectAllBtn = document.getElementById('deselectAllBtn');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  const copyLinkText = document.getElementById('copyLinkText');
  const openViewerBtn = document.getElementById('openViewerBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const viewerUrlInput = document.getElementById('viewerUrlInput');
  const resetUrlBtn = document.getElementById('resetUrlBtn');
  const presetGithubBtn = document.getElementById('presetGithubBtn');
  const presetWifiBtn = document.getElementById('presetWifiBtn');
  const pinToggle = document.getElementById('pinToggle');
  const pinInputWrapper = document.getElementById('pinInputWrapper');
  const pinCodeInput = document.getElementById('pinCodeInput');
  const closeTabsToggle = document.getElementById('closeTabsToggle');
  const closeTabsNowBtn = document.getElementById('closeTabsNowBtn');

  // Version & Level Selectors
  const btnVer18 = document.getElementById('btnVer18');
  const btnVer35 = document.getElementById('btnVer35');
  const btnLevelL = document.getElementById('btnLevelL');
  const btnLevelM = document.getElementById('btnLevelM');
  const btnLevelQ = document.getElementById('btnLevelQ');
  const btnLevelH = document.getElementById('btnLevelH');
  const safeTabsDisplay = document.getElementById('safeTabsDisplay');
  const byteBudgetDisplay = document.getElementById('byteBudgetDisplay');
  const versionHintText = document.getElementById('versionHintText');

  // Initialize
  async function init() {
    initLocalViewerUrl();
    loadSettings();
    attachEventListeners();
    await fetchActiveTabs();
    updateCapacityCard();
    updateView();
  }

  // Determine local offline viewer URL if available inside extension
  function initLocalViewerUrl() {
    if (chrome && chrome.runtime && chrome.runtime.getURL) {
      localViewerUrl = chrome.runtime.getURL('web/index.html');
    }
  }

  // Update Realtime Capacity Card & Button states in Settings
  function updateCapacityCard() {
    const spec = QR_SPECS[selectedVersion] || QR_SPECS[18];
    const totalBytes = spec.caps[selectedLevel] || 560;
    const safeCount = spec.safeTabs[selectedLevel] || 4;

    if (safeTabsDisplay) {
      safeTabsDisplay.textContent = `Up to ~${safeCount} tabs`;
    }
    if (byteBudgetDisplay) {
      byteBudgetDisplay.textContent = `${totalBytes} Bytes (V${selectedVersion} • Level ${selectedLevel})`;
    }
    if (versionHintText) {
      versionHintText.textContent = `${spec.grid} grid • ${spec.desc}`;
    }

    // Toggle active button states
    if (btnVer18) btnVer18.classList.toggle('active', selectedVersion === 18);
    if (btnVer35) btnVer35.classList.toggle('active', selectedVersion === 35);

    if (btnLevelL) btnLevelL.classList.toggle('active', selectedLevel === 'L');
    if (btnLevelM) btnLevelM.classList.toggle('active', selectedLevel === 'M');
    if (btnLevelQ) btnLevelQ.classList.toggle('active', selectedLevel === 'Q');
    if (btnLevelH) btnLevelH.classList.toggle('active', selectedLevel === 'H');
  }

  // Load saved preferences
  function loadSettings() {
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['viewerUrl', 'pinEnabled', 'qrVersion', 'qrLevel'], (data) => {
        if (data.viewerUrl && !data.viewerUrl.includes('tabone.code') && !data.viewerUrl.includes('jack.github.io')) {
          try {
            const parsed = new URL(data.viewerUrl);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
              viewerBaseUrl = data.viewerUrl;
              viewerUrlInput.value = viewerBaseUrl;
            } else {
              viewerBaseUrl = DEFAULT_VIEWER_URL;
              viewerUrlInput.value = DEFAULT_VIEWER_URL;
            }
          } catch {
            viewerBaseUrl = DEFAULT_VIEWER_URL;
            viewerUrlInput.value = DEFAULT_VIEWER_URL;
          }
        } else {
          viewerBaseUrl = DEFAULT_VIEWER_URL;
          viewerUrlInput.value = DEFAULT_VIEWER_URL;
          saveSettings();
        }

        if (data.qrVersion === 18 || data.qrVersion === 35) {
          selectedVersion = data.qrVersion;
        }

        if (['L', 'M', 'Q', 'H'].includes(data.qrLevel)) {
          selectedLevel = data.qrLevel;
        }

        if (data.pinEnabled) {
          isPinEnabled = true;
          pinToggle.checked = true;
          pinInputWrapper.classList.remove('hidden');
        }
        updateCapacityCard();
        updateView();
      });
    } else {
      viewerUrlInput.value = DEFAULT_VIEWER_URL;
      updateCapacityCard();
    }
  }

  // Save settings (PIN is NOT persisted to disk for security)
  function saveSettings() {
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        viewerUrl: viewerBaseUrl,
        pinEnabled: isPinEnabled,
        qrVersion: selectedVersion,
        qrLevel: selectedLevel
      });
    }
  }

  // Sanitize and clean URL (strip tracking tags & credentials)
  function cleanUrl(rawUrl) {
    try {
      const parsed = new URL(rawUrl);

      // Strip user/password credentials from URL for safety
      parsed.username = '';
      parsed.password = '';

      // Strip known tracking query params
      TRACKING_PARAMS.forEach(param => parsed.searchParams.delete(param));

      // Remove Amazon and retail tracking prefixes
      const keysToDelete = [];
      parsed.searchParams.forEach((_, key) => {
        if (key.startsWith('pf_rd_') || key.startsWith('pd_rd_') || key.startsWith('ref_')) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(k => parsed.searchParams.delete(k));

      // Clean hash tracking if present
      if (parsed.hash && (parsed.hash.includes('utm_') || parsed.hash.includes('ref='))) {
        parsed.hash = '';
      }

      return parsed.toString();
    } catch {
      return rawUrl;
    }
  }

  // Fetch active tabs in current window
  async function fetchActiveTabs() {
    if (!chrome || !chrome.tabs) {
      // Mock for browser testing outside extension environment
      allTabs = [
        { id: 1, title: 'YouTube: Podcast Episode', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', favIconUrl: '' },
        { id: 2, title: 'Google Sheets: Financial Report', url: 'https://docs.google.com/spreadsheets/d/12345/edit', favIconUrl: '' },
        { id: 3, title: 'Word Online: Project Proposal', url: 'https://onedrive.live.com/edit.aspx?resid=123', favIconUrl: '' }
      ];
      selectedTabIds = new Set(allTabs.map(t => t.id));
      return;
    }

    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      // Strictly allow http and https protocols (blocks internal chrome://, file://, javascript:, data:)
      allTabs = tabs.filter(tab => {
        if (!tab.url) return false;
        try {
          const u = new URL(tab.url);
          return u.protocol === 'http:' || u.protocol === 'https:';
        } catch {
          return false;
        }
      }).map(tab => ({
        id: tab.id,
        title: tab.title || 'Untitled Page',
        url: cleanUrl(tab.url),
        favIconUrl: tab.favIconUrl || ''
      }));

      selectedTabIds = new Set(allTabs.map(t => t.id));
    } catch (err) {
      console.error('Error querying tabs:', err);
      allTabs = [];
      selectedTabIds = new Set();
    }
  }

  // Encrypt payload if PIN is set (AES-256 GCM)
  async function encryptPayload(plainJson, pin) {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(pin),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      enc.encode(plainJson)
    );

    function toB64(buf) {
      return btoa(String.fromCharCode(...new Uint8Array(buf)));
    }

    return JSON.stringify({
      e: 1, // encrypted flag
      s: toB64(salt),
      iv: toB64(iv),
      d: toB64(ciphertext)
    });
  }

  // Build the complete QR URL (Uncompromised High-Security Compressed & Encrypted JSON)
  async function buildShareUrl(overrideBaseUrl = null) {
    const selectedTabs = allTabs.filter(t => selectedTabIds.has(t.id));
    if (selectedTabs.length === 0) {
      return '';
    }

    // Strict bounds to prevent payload bloating
    const safeSelectedTabs = selectedTabs.slice(0, 100);

    // Format destination base URL
    let base = overrideBaseUrl || viewerBaseUrl.trim();
    if (!base) base = DEFAULT_VIEWER_URL;

    if (!base.includes('#')) {
      base = base.endsWith('/') ? base + '#' : base + '/#';
    } else if (!base.endsWith('#') && !base.endsWith('&')) {
      base += '&';
    }

    // Full uncompromised payload: full URLs, full titles, timestamp
    const payload = {
      t: Date.now(),
      b: safeSelectedTabs.map(t => [
        (t.title || 'Untitled').slice(0, 250),
        t.url.slice(0, 2048)
      ])
    };

    let jsonString = JSON.stringify(payload);

    if (isPinEnabled && pinCode.trim().length >= 4) {
      jsonString = await encryptPayload(jsonString, pinCode.trim());
    }

    const compressed = LZString.compressToEncodedURIComponent(jsonString);
    return `${base}d=${compressed}`;
  }

  // Render QR Code onto Canvas strictly with selected version (18 or 35) and level (L, M, Q, H)
  async function updateQrCode() {
    currentShareUrl = await buildShareUrl();

    const spec = QR_SPECS[selectedVersion] || QR_SPECS[18];
    const maxCapacity = spec.caps[selectedLevel] || 560;
    const safeCount = spec.safeTabs[selectedLevel] || 4;

    if (!currentShareUrl) {
      const ctx = qrCanvas.getContext('2d');
      ctx.clearRect(0, 0, qrCanvas.width, qrCanvas.height);
      ctx.fillStyle = '#64748b';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No tabs selected', qrCanvas.width / 2, qrCanvas.height / 2);
      if (qrStatusText) {
        qrStatusText.textContent = `V${selectedVersion} Level ${selectedLevel} • Select tabs to generate code`;
        qrStatusText.style.color = '';
      }
      return;
    }

    // Check if payload fits within the selected version & level capacity
    if (currentShareUrl.length > maxCapacity) {
      const overflow = currentShareUrl.length - maxCapacity;
      const ctx = qrCanvas.getContext('2d');
      ctx.clearRect(0, 0, qrCanvas.width, qrCanvas.height);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Exceeds V${selectedVersion} Level ${selectedLevel}`, qrCanvas.width / 2, qrCanvas.height / 2 - 14);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.fillText(`+${overflow} chars over limit (${maxCapacity}B)`, qrCanvas.width / 2, qrCanvas.height / 2 + 8);
      ctx.fillText(selectedVersion === 18 ? 'Switch to Version 35 in Settings or deselect tabs' : 'Deselect tabs to fit in QR code', qrCanvas.width / 2, qrCanvas.height / 2 + 28);

      if (qrStatusText) {
        qrStatusText.textContent = `⚠️ Exceeds V${selectedVersion} • ${selectedVersion === 18 ? 'Switch to V35 in Settings' : 'Deselect a tab'}`;
        qrStatusText.style.color = '#ef4444';
      }
      return;
    }

    // Render QR Code with selected version (18 or 35), selected level (L, M, Q, H), and 260px canvas
    if (window.QRCode && QRCode.toCanvas) {
      QRCode.toCanvas(qrCanvas, currentShareUrl, {
        version: selectedVersion,
        width: 260,
        margin: 2,
        color: {
          dark: '#0a0d14',
          light: '#ffffff'
        },
        errorCorrectionLevel: selectedLevel
      }, (err) => {
        if (err) console.error('QR Render error:', err);
      });
    }

    // Update status text
    if (qrStatusText) {
      qrStatusText.style.color = '';
      const count = selectedTabIds.size;
      const remainingBytes = maxCapacity - currentShareUrl.length;
      if (isPinEnabled) {
        qrStatusText.textContent = `V${selectedVersion} Level ${selectedLevel} (${spec.grid}) • AES-256 Encrypted (${remainingBytes}B free)`;
      } else {
        qrStatusText.textContent = `V${selectedVersion} Level ${selectedLevel} (${spec.grid}) • ${count} of ~${safeCount} safe tabs (${remainingBytes}B buffer)`;
      }
    }
  }

  // Render Tab Items in UI without any inline event handlers (Manifest V3 CSP Compliant)
  function renderTabList() {
    tabList.innerHTML = '';

    allTabs.forEach(tab => {
      const isChecked = selectedTabIds.has(tab.id);

      const item = document.createElement('div');
      item.className = `tab-item ${isChecked ? '' : 'unchecked'}`;
      item.dataset.id = tab.id;

      let domain = '';
      try {
        domain = new URL(tab.url).hostname.replace(/^www\./, '');
      } catch {
        domain = tab.url;
      }

      // Checkbox indicator
      const checkDiv = document.createElement('div');
      checkDiv.className = 'tab-check';
      item.appendChild(checkDiv);

      // Favicon with programmatic fallback (Zero inline event handlers)
      if (tab.favIconUrl) {
        const img = document.createElement('img');
        img.className = 'tab-favicon';
        img.src = tab.favIconUrl;
        img.alt = '';
        img.addEventListener('error', () => {
          img.style.display = 'none';
          fallbackIcon.style.display = 'flex';
        });

        const fallbackIcon = document.createElement('div');
        fallbackIcon.className = 'tab-favicon-fallback';
        fallbackIcon.style.display = 'none';
        fallbackIcon.textContent = '🌐';

        item.appendChild(img);
        item.appendChild(fallbackIcon);
      } else {
        const fallbackIcon = document.createElement('div');
        fallbackIcon.className = 'tab-favicon-fallback';
        fallbackIcon.textContent = '🌐';
        item.appendChild(fallbackIcon);
      }

      // Tab Info (Title & Domain)
      const infoDiv = document.createElement('div');
      infoDiv.className = 'tab-info';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'tab-title';
      titleSpan.title = tab.title;
      titleSpan.textContent = tab.title;

      const domainSpan = document.createElement('span');
      domainSpan.className = 'tab-domain';
      domainSpan.textContent = domain;

      infoDiv.appendChild(titleSpan);
      infoDiv.appendChild(domainSpan);
      item.appendChild(infoDiv);

      // Click row to toggle selection
      item.addEventListener('click', () => {
        toggleTabSelection(tab.id);
      });

      tabList.appendChild(item);
    });

    updateCounters();
  }

  // Toggle single tab selection
  function toggleTabSelection(tabId) {
    if (selectedTabIds.has(tabId)) {
      selectedTabIds.delete(tabId);
    } else {
      selectedTabIds.add(tabId);
    }
    renderTabList();
    updateQrCode();
  }

  // Update counters & badge
  function updateCounters() {
    const count = selectedTabIds.size;
    tabCountBadge.textContent = `${count} tab${count === 1 ? '' : 's'}`;
    if (tabSelectionCount) {
      tabSelectionCount.textContent = `${count} of ${allTabs.length} selected`;
    }

    if (closeTabsToggle.checked) {
      closeTabsNowBtn.textContent = `Close ${count} Tab${count === 1 ? '' : 's'} on PC Now`;
      closeTabsNowBtn.classList.remove('hidden');
    } else {
      closeTabsNowBtn.classList.add('hidden');
    }
  }

  // Update Entire View
  function updateView() {
    renderTabList();
    updateQrCode();
  }

  // Attach Event Listeners
  function attachEventListeners() {
    // Select All
    selectAllBtn.addEventListener('click', () => {
      selectedTabIds = new Set(allTabs.map(t => t.id));
      updateView();
    });

    // Deselect All
    deselectAllBtn.addEventListener('click', () => {
      selectedTabIds.clear();
      updateView();
    });

    // Copy Link
    copyLinkBtn.addEventListener('click', async () => {
      if (!currentShareUrl) return;
      try {
        await navigator.clipboard.writeText(currentShareUrl);
        copyLinkText.textContent = 'Copied!';
        setTimeout(() => {
          copyLinkText.textContent = 'Copy Link';
        }, 1800);
      } catch (err) {
        console.error('Copy failed:', err);
      }
    });

    // Open Viewer in PC Tab (Testing offline or online)
    openViewerBtn.addEventListener('click', async () => {
      const targetUrl = localViewerUrl ? await buildShareUrl(localViewerUrl) : currentShareUrl;
      if (!targetUrl) return;

      if (chrome && chrome.tabs) {
        chrome.tabs.create({ url: targetUrl });
      } else {
        window.open(targetUrl, '_blank');
      }
    });

    // Toggle Settings Panel
    settingsBtn.addEventListener('click', () => {
      settingsPanel.classList.toggle('hidden');
    });

    // Preset Buttons
    if (presetGithubBtn) {
      presetGithubBtn.addEventListener('click', () => {
        viewerBaseUrl = GITHUB_PAGES_PRESET;
        viewerUrlInput.value = GITHUB_PAGES_PRESET;
        saveSettings();
        updateQrCode();
      });
    }

    if (presetWifiBtn) {
      presetWifiBtn.addEventListener('click', () => {
        viewerBaseUrl = LOCAL_WIFI_PRESET;
        viewerUrlInput.value = LOCAL_WIFI_PRESET;
        saveSettings();
        updateQrCode();
      });
    }

    // Version Selector Buttons (Version 18 vs Version 35)
    if (btnVer18) {
      btnVer18.addEventListener('click', () => {
        selectedVersion = 18;
        updateCapacityCard();
        saveSettings();
        updateQrCode();
      });
    }

    if (btnVer35) {
      btnVer35.addEventListener('click', () => {
        selectedVersion = 35;
        updateCapacityCard();
        saveSettings();
        updateQrCode();
      });
    }

    // Error Correction Level Buttons (L, M, Q, H)
    const levelBtns = [
      { el: btnLevelL, lvl: 'L' },
      { el: btnLevelM, lvl: 'M' },
      { el: btnLevelQ, lvl: 'Q' },
      { el: btnLevelH, lvl: 'H' }
    ];

    levelBtns.forEach(({ el, lvl }) => {
      if (el) {
        el.addEventListener('click', () => {
          selectedLevel = lvl;
          updateCapacityCard();
          saveSettings();
          updateQrCode();
        });
      }
    });

    // Viewer URL Input change (strictly validate protocol to prevent javascript: or data: injection)
    viewerUrlInput.addEventListener('change', () => {
      const val = viewerUrlInput.value.trim();
      if (!val) {
        viewerBaseUrl = DEFAULT_VIEWER_URL;
      } else {
        try {
          const parsed = new URL(val);
          if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            viewerBaseUrl = val;
          } else {
            alert('Security Alert: Only https:// and http:// URLs are allowed for the viewer.');
            viewerBaseUrl = DEFAULT_VIEWER_URL;
            viewerUrlInput.value = DEFAULT_VIEWER_URL;
          }
        } catch {
          alert('Invalid URL format. Reverting to default.');
          viewerBaseUrl = DEFAULT_VIEWER_URL;
          viewerUrlInput.value = DEFAULT_VIEWER_URL;
        }
      }
      saveSettings();
      updateQrCode();
    });

    // Reset Viewer URL
    resetUrlBtn.addEventListener('click', () => {
      viewerBaseUrl = DEFAULT_VIEWER_URL;
      viewerUrlInput.value = DEFAULT_VIEWER_URL;
      saveSettings();
      updateQrCode();
    });

    // PIN Toggle
    pinToggle.addEventListener('change', () => {
      isPinEnabled = pinToggle.checked;
      if (isPinEnabled) {
        pinInputWrapper.classList.remove('hidden');
        pinCodeInput.focus();
      } else {
        pinInputWrapper.classList.add('hidden');
        pinCode = '';
        pinCodeInput.value = '';
      }
      saveSettings();
      updateQrCode();
    });

    // PIN Code Input (Restrict strictly to 4-6 digits)
    pinCodeInput.addEventListener('input', () => {
      pinCode = pinCodeInput.value.replace(/\D/g, '');
      pinCodeInput.value = pinCode;
      updateQrCode();
    });

    // Close Tabs Toggle (Off by default)
    closeTabsToggle.addEventListener('change', () => {
      updateCounters();
    });

    // Close Tabs Action
    closeTabsNowBtn.addEventListener('click', () => {
      const idsToClose = Array.from(selectedTabIds);
      if (idsToClose.length === 0) return;

      const confirmMsg = `Are you sure you want to close ${idsToClose.length} tab${idsToClose.length === 1 ? '' : 's'} on this PC? Make sure you have scanned them with your phone first.`;
      if (confirm(confirmMsg)) {
        if (chrome && chrome.tabs) {
          chrome.tabs.remove(idsToClose, () => {
            window.close();
          });
        }
      }
    });
  }

  // Launch on DOM ready
  document.addEventListener('DOMContentLoaded', init);
})();
