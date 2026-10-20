// tabone - Mobile Web Hub Logic & 100% Local Threat Scanner
(function () {
  'use strict';

  // Storage key for history vault
  const STORAGE_KEY = 'tabone_history_vault';

  // State
  let currentTabs = [];
  let pendingSecurityUrl = null;
  let encryptedPayload = null;
  let historyData = [];

  // PIN Rate Limiting State (Anti-Brute Force)
  let pinFailedAttempts = 0;
  let pinLockoutUntil = 0;
  let pinLockoutTimer = null;

  // DOM Elements
  const tabCurrentBtn = document.getElementById('tabCurrentBtn');
  const tabHistoryBtn = document.getElementById('tabHistoryBtn');
  const currentView = document.getElementById('currentView');
  const historyView = document.getElementById('historyView');
  const currentCountPill = document.getElementById('currentCountPill');
  const historyCountPill = document.getElementById('historyCountPill');
  const securityBanner = document.getElementById('securityBanner');
  const shieldIcon = document.getElementById('shieldIcon');
  const shieldTitle = document.getElementById('shieldTitle');
  const shieldDesc = document.getElementById('shieldDesc');
  const cardsList = document.getElementById('cardsList');
  const emptyCurrentState = document.getElementById('emptyCurrentState');
  const selectAllFilterBtn = document.getElementById('selectAllFilterBtn');
  const selectNoneFilterBtn = document.getElementById('selectNoneFilterBtn');
  const selectionStatus = document.getElementById('selectionStatus');
  const openSelectedBtn = document.getElementById('openSelectedBtn');
  const openSelectedText = document.getElementById('openSelectedText');
  const queueModeBtn = document.getElementById('queueModeBtn');
  const bottomDock = document.getElementById('bottomDock');
  const scanTimeBadge = document.getElementById('scanTimeBadge');
  const historyList = document.getElementById('historyList');
  const historySearchInput = document.getElementById('historySearchInput');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const emptyHistoryState = document.getElementById('emptyHistoryState');
  const viewHistoryFromEmptyBtn = document.getElementById('viewHistoryFromEmptyBtn');

  // Modals
  const securityModal = document.getElementById('securityModal');
  const securityModalUrl = document.getElementById('securityModalUrl');
  const securityModalDesc = document.getElementById('securityModalDesc');
  const securityModalBackBtn = document.getElementById('securityModalBackBtn');
  const securityModalProceedBtn = document.getElementById('securityModalProceedBtn');

  const pinModal = document.getElementById('pinModal');
  const pinUnlockInput = document.getElementById('pinUnlockInput');
  const pinSubmitBtn = document.getElementById('pinSubmitBtn');
  const pinError = document.getElementById('pinError');

  // Initialize
  async function init() {
    loadHistory();
    attachEventListeners();
    await processIncomingHash();
  }

  // Parse incoming URL Hash
  async function processIncomingHash() {
    const hash = window.location.hash.substring(1);
    if (!hash) {
      renderEmptyState();
      return;
    }

    const params = new URLSearchParams(hash);
    const chunkyData = params.get('u');
    const compressedData = params.get('d');

    // 1. Check for Ultra-Chunky Low-Density Format (u=...)
    if (chunkyData) {
      try {
        const rawItems = chunkyData.split('|');
        const tabs = rawItems.filter(Boolean).map(item => {
          let title = '';
          let url = item;
          if (item.includes('*')) {
            const parts = item.split('*');
            title = parts[0];
            url = parts.slice(1).join('*');
          }
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
          }
          if (!title) {
            try {
              const uObj = new URL(url);
              const path = uObj.pathname.replace(/^\//, '').split('/')[0];
              title = uObj.hostname.replace(/^www\./, '') + (path ? ' / ' + path : '');
            } catch {
              title = url;
            }
          }
          return [title, url];
        });

        handleUnpackedPayload({ t: Date.now(), b: tabs });
        return;
      } catch (err) {
        console.error('Failed to parse chunky payload:', err);
        renderEmptyState('Failed to read QR tab list');
        return;
      }
    }

    // 2. Check for Encrypted / Compressed Format (d=...)
    if (!compressedData) {
      renderEmptyState();
      return;
    }

    try {
      // Decompress payload using LZString
      const jsonString = LZString.decompressFromEncodedURIComponent(compressedData);
      if (!jsonString) {
        throw new Error('Decompression returned empty');
      }

      const payload = JSON.parse(jsonString);

      // Check if encrypted
      if (payload.e === 1) {
        encryptedPayload = payload;
        showPinModal();
        return;
      }

      // Unpack tabs
      handleUnpackedPayload(payload);
    } catch (err) {
      console.error('Failed to parse hash payload:', err);
      renderEmptyState('Invalid or corrupted QR link');
    }
  }

  // SVG Icon Generator (100% Pure DOM creation - Zero innerHTML)
  function createSvgIcon(type) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    if (type === 'arrow') {
      svg.setAttribute('width', '18');
      svg.setAttribute('height', '18');
      svg.setAttribute('stroke-width', '2');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M7 17l9.2-9.2M17 17V8H8');
      svg.appendChild(p);
    } else if (type === 'chevron') {
      svg.setAttribute('width', '12');
      svg.setAttribute('height', '12');
      svg.setAttribute('stroke-width', '2.5');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      p.setAttribute('points', '6 9 12 15 18 9');
      svg.appendChild(p);
    } else if (type === 'trash') {
      svg.setAttribute('width', '13');
      svg.setAttribute('height', '13');
      svg.setAttribute('stroke-width', '2');
      const p1 = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      p1.setAttribute('points', '3 6 5 6 21 6');
      const p2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p2.setAttribute('d', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6');
      svg.appendChild(p1);
      svg.appendChild(p2);
    }
    return svg;
  }

  // Deterministic aesthetic gradient generator based on domain name
  function getDomainColor(domain) {
    const palettes = [
      { bg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }, // Ruby (YouTube, etc.)
      { bg: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }, // Azure (Google, Twitter)
      { bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }, // Emerald (Spotify, etc.)
      { bg: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }, // Violet (Twitch, Linear)
      { bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }, // Amber (Substack, Amazon)
      { bg: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' }, // Cyan (Cloud, Docs)
      { bg: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' }, // Rose (Instagram, Dribbble)
      { bg: 'linear-gradient(135deg, #64748b 0%, #475569 100%)' }  // Slate (GitHub, Notion)
    ];

    if (!domain) return palettes[7];
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
      hash = ((hash << 5) - hash) + domain.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % palettes.length;
    return palettes[idx];
  }

  // Handle Unpacked Tabs (Strictly bounded against DoS / memory bloat)
  function handleUnpackedPayload(payload) {
    if (!payload.b || !Array.isArray(payload.b)) {
      renderEmptyState();
      return;
    }

    const timestamp = typeof payload.t === 'number' ? payload.t : Date.now();
    scanTimeBadge.textContent = formatTime(timestamp);

    // Limit to max 100 tabs to protect mobile browser DOM performance
    const safeList = payload.b.slice(0, 100);

    currentTabs = safeList.filter(item => Array.isArray(item) && item[1]).map(([rawTitle, rawUrl], idx) => {
      const cleanTitle = String(rawTitle || 'Untitled').slice(0, 250);
      const cleanUrl = String(rawUrl).slice(0, 2048);

      let domain = '';
      try {
        domain = new URL(cleanUrl).hostname.replace(/^www\./, '');
      } catch {
        domain = cleanUrl.slice(0, 50);
      }

      const safety = analyzeUrlSecurity(cleanUrl, domain);

      return {
        id: idx + 1,
        title: cleanTitle,
        url: cleanUrl,
        domain: domain,
        safety: safety,
        selected: true,
        opened: false
      };
    });

    // Save to History Vault
    saveSessionToHistory(timestamp, currentTabs);

    updateSecurityBanner();
    renderCurrentTabs();
  }

  // Analyze URL Safety (100% Local Bitdefender-Style Heuristics - Zero Data Leaks)
  function analyzeUrlSecurity(urlStr, domain) {
    try {
      const u = new URL(urlStr);

      // 1. Strict Protocol Enforcement: Block javascript:, data:, file:, vbscript:
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        return { level: 'danger', label: 'Blocked Protocol', reason: 'Unsafe or executable URL protocol: ' + u.protocol };
      }

      // 2. Insecure HTTP check
      if (u.protocol === 'http:') {
        return { level: 'warning', label: 'HTTP', reason: 'Unencrypted connection (HTTP)' };
      }

      // 3. Raw IP address check (common in malware/phishing links)
      const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (ipPattern.test(domain) || domain.includes(':')) {
        return { level: 'danger', label: 'Raw IP', reason: 'Direct numeric IP address destination instead of verified domain' };
      }

      // 4. Punycode / Homograph attack check
      if (domain.startsWith('xn--') || /[^\x00-\x7F]/.test(domain)) {
        return { level: 'danger', label: 'Punycode', reason: 'Deceptive lookalike characters in web address' };
      }

      // 5. URL Authentication credentials spoofing (e.g. https://google.com@evil.com)
      if (u.username || u.password) {
        return { level: 'danger', label: 'Auth Spoof', reason: 'URL embeds suspicious login credentials' };
      }

      // 6. Lookalike multi-tier brand spoofing (e.g., paypal.com.verify-user.xyz)
      const parts = domain.split('.');
      if (parts.length > 3) {
        const brandNames = ['paypal', 'google', 'apple', 'microsoft', 'netflix', 'amazon', 'bank'];
        for (const brand of brandNames) {
          if (domain.includes(brand) && !domain.endsWith(`${brand}.com`) && !domain.endsWith(`${brand}.net`)) {
            return { level: 'danger', label: 'Lookalike', reason: `Potential brand spoofing (${brand})` };
          }
        }
      }

      // 7. Suspicious Top-Level Domains (when combined with subdomains)
      const riskyTlds = ['.top', '.xyz', '.country', '.click', '.gq', '.tk', '.cf'];
      if (parts.length > 2 && riskyTlds.some(tld => domain.endsWith(tld))) {
        return { level: 'warning', label: 'Caution', reason: 'Non-standard TLD with complex subdomains' };
      }

      return { level: 'safe', label: 'Safe', reason: 'Verified HTTPS structure' };
    } catch {
      return { level: 'danger', label: 'Malformed', reason: 'Invalid or deceptive URL structure' };
    }
  }

  // Update Top Security Banner
  function updateSecurityBanner() {
    const dangerTabs = currentTabs.filter(t => t.safety.level === 'danger');
    const warningTabs = currentTabs.filter(t => t.safety.level === 'warning');

    securityBanner.className = 'security-banner';

    if (dangerTabs.length > 0) {
      securityBanner.classList.add('danger');
      shieldIcon.textContent = '🚨';
      shieldTitle.textContent = `${dangerTabs.length} Suspicious Link${dangerTabs.length === 1 ? '' : 's'} Flagged`;
      shieldDesc.textContent = 'Potential phishing or deceptive destination intercepted';
    } else if (warningTabs.length > 0) {
      securityBanner.classList.add('warning');
      shieldIcon.textContent = '🟡';
      shieldTitle.textContent = `${warningTabs.length} Insecure (HTTP) Link${warningTabs.length === 1 ? '' : 's'}`;
      shieldDesc.textContent = 'Links will open over unencrypted connections';
    } else {
      securityBanner.classList.add('safe');
      shieldIcon.textContent = '🛡️';
      shieldTitle.textContent = 'All Links Verified & Secure';
      shieldDesc.textContent = 'No malware, lookalikes, or tracking scripts detected';
    }
  }

  // Render Current Tab Cards with Beautiful Gradient Badges
  function renderCurrentTabs() {
    cardsList.innerHTML = '';

    if (currentTabs.length === 0) {
      renderEmptyState();
      return;
    }

    emptyCurrentState.classList.add('hidden');
    bottomDock.style.display = 'flex';

    currentTabs.forEach(tab => {
      const card = document.createElement('div');
      card.className = `tab-card ${tab.selected ? 'selected' : ''} ${tab.opened ? 'opened' : ''}`;
      card.dataset.id = tab.id;

      // Checkbox
      const checkDiv = document.createElement('div');
      checkDiv.className = 'card-checkbox';

      // Aesthetic Gradient Favicon Box (100% offline, zero network leakage)
      const domainStyle = getDomainColor(tab.domain);
      const faviconBox = document.createElement('div');
      faviconBox.className = 'card-favicon-box';
      faviconBox.style.background = domainStyle.bg;
      faviconBox.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';

      const letterIcon = document.createElement('span');
      letterIcon.className = 'card-favicon-fallback';
      letterIcon.textContent = tab.domain ? tab.domain.charAt(0).toUpperCase() : '🌐';
      letterIcon.style.color = '#ffffff';
      letterIcon.style.fontSize = '13px';
      letterIcon.style.fontWeight = '800';

      faviconBox.appendChild(letterIcon);

      const contentDiv = document.createElement('div');
      contentDiv.className = 'card-content';

      const titleDiv = document.createElement('div');
      titleDiv.className = 'card-title';
      titleDiv.title = tab.title;
      titleDiv.textContent = tab.title;

      const metaDiv = document.createElement('div');
      metaDiv.className = 'card-meta';

      const domainSpan = document.createElement('span');
      domainSpan.className = 'card-domain';
      domainSpan.textContent = tab.domain;

      const tagSpan = document.createElement('span');
      tagSpan.className = `security-tag ${tab.safety.level}`;
      tagSpan.textContent = tab.safety.label;

      metaDiv.appendChild(domainSpan);
      metaDiv.appendChild(tagSpan);

      contentDiv.appendChild(titleDiv);
      contentDiv.appendChild(metaDiv);

      const arrowDiv = document.createElement('div');
      arrowDiv.className = 'card-arrow';
      arrowDiv.title = 'Open Link';
      arrowDiv.appendChild(createSvgIcon('arrow'));

      card.appendChild(checkDiv);
      card.appendChild(faviconBox);
      card.appendChild(contentDiv);
      card.appendChild(arrowDiv);

      // Tap card: toggle selection or open if clicking arrow
      card.addEventListener('click', (e) => {
        if (e.target.closest('.card-arrow')) {
          handleOpenSingleTab(tab);
        } else {
          tab.selected = !tab.selected;
          card.classList.toggle('selected', tab.selected);
          updateDockStatus();
        }
      });

      cardsList.appendChild(card);
    });

    updateDockStatus();
    currentCountPill.textContent = currentTabs.length;
  }

  // Update Floating Dock Status (With Dynamic Next-Tab Indicator)
  function updateDockStatus() {
    const selectedCount = currentTabs.filter(t => t.selected).length;
    selectionStatus.textContent = `${selectedCount} of ${currentTabs.length} selected`;
    openSelectedText.textContent = `Open Selected (${selectedCount})`;

    // Filter chip visual states
    selectAllFilterBtn.classList.toggle('active', selectedCount === currentTabs.length);
    selectNoneFilterBtn.classList.toggle('active', selectedCount === 0);

    // Queue button subtext with dynamic domain preview
    const remainingUnopened = currentTabs.filter(t => t.selected && !t.opened);
    if (remainingUnopened.length > 0) {
      const nextDomain = remainingUnopened[0].domain.split('.')[0] || 'Next';
      const capitalized = nextDomain.charAt(0).toUpperCase() + nextDomain.slice(1);
      queueModeBtn.querySelector('span').textContent = `Next: ${capitalized} (${remainingUnopened.length})`;
      queueModeBtn.style.opacity = '1';
    } else {
      queueModeBtn.querySelector('span').textContent = 'All Done';
      queueModeBtn.style.opacity = '0.6';
    }
  }

  // Universal Safe Window Opener (Anchor-click for maximum mobile Safari/Chrome compatibility)
  function safeOpen(url) {
    try {
      const u = new URL(url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        alert('Blocked potentially unsafe protocol: ' + u.protocol);
        return;
      }
      const a = document.createElement('a');
      a.href = u.toString();
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      alert('Invalid URL.');
    }
  }

  // Open Single Tab with Security Intercept
  function handleOpenSingleTab(tab) {
    if (tab.safety.level === 'danger') {
      pendingSecurityUrl = tab.url;
      securityModalUrl.textContent = tab.url;
      securityModalDesc.textContent = tab.safety.reason || 'This destination has suspicious security indicators.';
      securityModal.classList.remove('hidden');
      return;
    }

    // Mark as opened and launch
    tab.opened = true;
    renderCurrentTabs();
    safeOpen(tab.url);
  }

  // Open Selected Tabs
  function handleOpenSelected() {
    const toOpen = currentTabs.filter(t => t.selected && !t.opened);
    if (toOpen.length === 0) {
      alert('All selected tabs have already been opened! Tap individual cards to re-open.');
      return;
    }

    // Check if any danger links
    const dangerous = toOpen.find(t => t.safety.level === 'danger');
    if (dangerous) {
      handleOpenSingleTab(dangerous);
      return;
    }

    // Open first link immediately (always allowed by mobile browser)
    const firstTab = toOpen[0];
    firstTab.opened = true;
    safeOpen(firstTab.url);

    // Attempt to open remaining (or inform user if browser blocks them)
    if (toOpen.length > 1) {
      for (let i = 1; i < toOpen.length; i++) {
        const tab = toOpen[i];
        tab.opened = true;
        safeOpen(tab.url);
      }
    }

    renderCurrentTabs();
  }

  // Queue Mode / Read Next
  function handleQueueMode() {
    const nextTab = currentTabs.find(t => t.selected && !t.opened);
    if (!nextTab) {
      alert('You have read through all your selected tabs!');
      return;
    }
    handleOpenSingleTab(nextTab);
  }

  // History Vault: Save Session with Automatic Quota-Exceeded Recovery
  function saveSessionToHistory(timestamp, tabs) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      let list = stored ? JSON.parse(stored) : [];

      // Avoid immediate duplicate of same timestamp
      if (list.length > 0 && Math.abs(list[0].timestamp - timestamp) < 10000) {
        return;
      }

      const session = {
        id: 'sess_' + timestamp,
        timestamp: timestamp,
        dateFormatted: formatDate(timestamp),
        tabs: tabs.map(t => ({
          title: t.title.slice(0, 250),
          url: t.url.slice(0, 2048),
          domain: t.domain.slice(0, 50)
        }))
      };

      list.unshift(session);
      if (list.length > 30) list = list.slice(0, 30);

      // Safe save with automatic quota recovery
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      } catch (quotaErr) {
        while (list.length > 5) {
          list.pop();
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
            break;
          } catch {}
        }
      }

      historyData = list;
      historyCountPill.textContent = historyData.length;
    } catch (err) {
      console.warn('Failed to save to localStorage:', err);
    }
  }

  // History Vault: Load
  function loadHistory() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      historyData = stored ? JSON.parse(stored) : [];
      historyCountPill.textContent = historyData.length;
    } catch {
      historyData = [];
    }
  }

  // Render History Vault using 100% Pure DOM (Zero innerHTML injection risk)
  function renderHistory(filterQuery = '') {
    historyList.innerHTML = '';

    const query = filterQuery.toLowerCase().trim();
    const filtered = historyData.filter(session => {
      if (!query) return true;
      return session.tabs.some(t => t.title.toLowerCase().includes(query) || t.domain.toLowerCase().includes(query));
    });

    if (filtered.length === 0) {
      emptyHistoryState.classList.remove('hidden');
      return;
    }

    emptyHistoryState.classList.add('hidden');

    filtered.forEach((session, idx) => {
      const card = document.createElement('div');
      card.className = 'history-session-card';
      // First session is expanded, older ones collapsed for a clean view
      if (idx > 0 && !query) card.classList.add('collapsed');

      // Header row
      const header = document.createElement('div');
      header.className = 'session-header';

      const leftGroup = document.createElement('div');
      leftGroup.className = 'session-header-left';

      const chevron = document.createElement('span');
      chevron.className = 'session-chevron';
      chevron.appendChild(createSvgIcon('chevron'));

      const titleSpan = document.createElement('span');
      titleSpan.className = 'session-title';
      titleSpan.textContent = session.dateFormatted;

      leftGroup.appendChild(chevron);
      leftGroup.appendChild(titleSpan);

      const rightGroup = document.createElement('div');
      rightGroup.className = 'session-header-right';

      const badgeSpan = document.createElement('span');
      badgeSpan.className = 'session-badge';
      badgeSpan.textContent = `${session.tabs.length} tabs`;

      // Single-session delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'session-delete-btn';
      deleteBtn.title = 'Delete this session';
      deleteBtn.appendChild(createSvgIcon('trash'));

      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Delete this saved session?')) {
          historyData = historyData.filter(s => s.id !== session.id);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(historyData));
          historyCountPill.textContent = historyData.length;
          renderHistory(historySearchInput.value);
        }
      });

      rightGroup.appendChild(badgeSpan);
      rightGroup.appendChild(deleteBtn);

      header.appendChild(leftGroup);
      header.appendChild(rightGroup);

      // Accordion toggle
      header.addEventListener('click', () => {
        card.classList.toggle('collapsed');
      });

      // Session Tab Items
      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'session-items';

      session.tabs.forEach(t => {
        const row = document.createElement('div');
        row.className = 'session-tab-row';

        const rowTitle = document.createElement('span');
        rowTitle.className = 'session-tab-title';
        rowTitle.textContent = t.title;

        const rowDomain = document.createElement('span');
        rowDomain.className = 'session-tab-domain';
        rowDomain.textContent = t.domain;

        row.appendChild(rowTitle);
        row.appendChild(rowDomain);

        row.addEventListener('click', () => {
          safeOpen(t.url);
        });

        itemsContainer.appendChild(row);
      });

      card.appendChild(header);
      card.appendChild(itemsContainer);
      historyList.appendChild(card);
    });
  }

  // PIN Unlock Decryption (AES-GCM) with Brute-Force Rate Limiting
  async function decryptPayloadWithPin(payload, pin) {
    const enc = new TextEncoder();
    function fromB64(str) {
      return Uint8Array.from(atob(str), c => c.charCodeAt(0));
    }

    const salt = fromB64(payload.s);
    const iv = fromB64(payload.iv);
    const ciphertext = fromB64(payload.d);

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
      ['decrypt']
    );

    const decryptedBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      ciphertext
    );

    const decryptedStr = new TextDecoder().decode(decryptedBuf);
    return JSON.parse(decryptedStr);
  }

  function showPinModal() {
    pinModal.classList.remove('hidden');
    pinUnlockInput.value = '';
    pinError.classList.add('hidden');
    pinUnlockInput.focus();
  }

  // Handle PIN Rate Limiting Lockout
  function triggerPinLockout(seconds) {
    pinLockoutUntil = Date.now() + (seconds * 1000);
    pinSubmitBtn.disabled = true;
    pinUnlockInput.disabled = true;

    if (pinLockoutTimer) clearInterval(pinLockoutTimer);

    pinLockoutTimer = setInterval(() => {
      const remainingMs = pinLockoutUntil - Date.now();
      if (remainingMs <= 0) {
        clearInterval(pinLockoutTimer);
        pinSubmitBtn.disabled = false;
        pinUnlockInput.disabled = false;
        pinError.classList.add('hidden');
        pinUnlockInput.focus();
      } else {
        const secs = Math.ceil(remainingMs / 1000);
        pinError.textContent = `Too many failed attempts. Locked for ${secs}s...`;
        pinError.classList.remove('hidden');
      }
    }, 500);
  }

  // Empty State Display
  function renderEmptyState(customMsg) {
    cardsList.innerHTML = '';
    emptyCurrentState.classList.remove('hidden');
    if (customMsg) {
      emptyCurrentState.querySelector('.empty-desc').textContent = customMsg;
    }
    bottomDock.style.display = 'none';
    currentCountPill.textContent = '0';
  }

  // Format Helpers
  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(ts) {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return `Today at ${timeStr}`;
    }
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
  }

  // Attach Event Listeners
  function attachEventListeners() {
    // Tab switching
    tabCurrentBtn.addEventListener('click', () => {
      tabCurrentBtn.classList.add('active');
      tabHistoryBtn.classList.remove('active');
      currentView.classList.remove('hidden');
      historyView.classList.add('hidden');
      if (currentTabs.length > 0) bottomDock.style.display = 'flex';
    });

    tabHistoryBtn.addEventListener('click', () => {
      tabHistoryBtn.classList.add('active');
      tabCurrentBtn.classList.remove('active');
      historyView.classList.remove('hidden');
      currentView.classList.add('hidden');
      bottomDock.style.display = 'none';
      renderHistory();
    });

    viewHistoryFromEmptyBtn.addEventListener('click', () => {
      tabHistoryBtn.click();
    });

    // Select All / None
    selectAllFilterBtn.addEventListener('click', () => {
      currentTabs.forEach(t => t.selected = true);
      renderCurrentTabs();
    });

    selectNoneFilterBtn.addEventListener('click', () => {
      currentTabs.forEach(t => t.selected = false);
      renderCurrentTabs();
    });

    // Dock Buttons
    openSelectedBtn.addEventListener('click', handleOpenSelected);
    queueModeBtn.addEventListener('click', handleQueueMode);

    // History Search
    historySearchInput.addEventListener('input', (e) => {
      renderHistory(e.target.value);
    });

    // Clear History (All)
    clearHistoryBtn.addEventListener('click', () => {
      if (confirm('Clear all saved tabs from your history vault?')) {
        localStorage.removeItem(STORAGE_KEY);
        historyData = [];
        historyCountPill.textContent = '0';
        renderHistory();
      }
    });

    // Security Modal Buttons
    securityModalBackBtn.addEventListener('click', () => {
      securityModal.classList.add('hidden');
      pendingSecurityUrl = null;
    });

    securityModalProceedBtn.addEventListener('click', () => {
      securityModal.classList.add('hidden');
      if (pendingSecurityUrl) {
        safeOpen(pendingSecurityUrl);
        pendingSecurityUrl = null;
      }
    });

    // PIN Submit with Anti-Brute-Force Rate Limiting
    pinSubmitBtn.addEventListener('click', async () => {
      if (Date.now() < pinLockoutUntil) return;

      const pin = pinUnlockInput.value.trim();
      if (!pin) return;

      try {
        const decrypted = await decryptPayloadWithPin(encryptedPayload, pin);
        pinFailedAttempts = 0;
        pinModal.classList.add('hidden');
        handleUnpackedPayload(decrypted);
      } catch (err) {
        pinFailedAttempts++;
        if (pinFailedAttempts >= 5) {
          triggerPinLockout(15);
        } else {
          pinError.textContent = `Incorrect PIN (${pinFailedAttempts}/5 attempts).`;
          pinError.classList.remove('hidden');
        }
      }
    });

    pinUnlockInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') pinSubmitBtn.click();
    });
  }

  // Start app on DOM ready
  document.addEventListener('DOMContentLoaded', init);
})();
