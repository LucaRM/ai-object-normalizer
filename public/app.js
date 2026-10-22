document.addEventListener('DOMContentLoaded', () => {
  // -------------------------------------------------------------------------
  // 1. Navigation & Theme Switcher
  // -------------------------------------------------------------------------
  const navTabBtns = document.querySelectorAll('.nav-tab-btn');
  const viewPanels = document.querySelectorAll('.view-panel');
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  const themeText = document.getElementById('theme-text');
  const serviceStatus = document.getElementById('service-status');
  const navActiveCount = document.getElementById('nav-active-count');

  // Theme Init
  const savedTheme = localStorage.getItem('object_normalizer_theme') || 'dark';
  applyTheme(savedTheme);

  btnThemeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('object_normalizer_theme', theme);
    if (theme === 'dark') {
      themeIcon.textContent = '🌙';
      themeText.textContent = 'Dark';
    } else {
      themeIcon.textContent = '☀️';
      themeText.textContent = 'Light';
    }
  }

  // View Navigation
  navTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetViewId = btn.getAttribute('data-view');
      navTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      viewPanels.forEach(panel => {
        if (panel.id === targetViewId) {
          panel.style.display = targetViewId === 'view-playground' ? 'grid' : 'flex';
        } else {
          panel.style.display = 'none';
        }
      });

      if (targetViewId === 'view-providers') {
        loadProvidersHub();
      }
    });
  });

  // -------------------------------------------------------------------------
  // 2. Toast Notifications
  // -------------------------------------------------------------------------
  let toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  function showToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ');
    toast.innerHTML = `<span style="font-weight:700;">${icon}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // -------------------------------------------------------------------------
  // 3. Provider Favicons & SVGs
  // -------------------------------------------------------------------------
  const PROVIDER_FAVICONS = {
    groq: {
      bg: '#ff4d00',
      color: '#fff',
      icon: '⚡',
      svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`
    },
    gemini: {
      bg: 'linear-gradient(135deg, #1a73e8, #8ab4f8)',
      color: '#fff',
      icon: '✦',
      svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2z"/></svg>`
    },
    sambanova: {
      bg: '#ff5722',
      color: '#fff',
      icon: '🔥',
      svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M15 9h.01"/><path d="M9 15h6"/></svg>`
    },
    cerebras: {
      bg: '#00d2c4',
      color: '#000',
      icon: '💎',
      svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`
    },
    github: {
      bg: '#24292e',
      color: '#fff',
      icon: '🐙',
      svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>`
    },
    mistral: {
      bg: '#f97316',
      color: '#fff',
      icon: '🌪️',
      svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M4 4h3.5v7.5H4zM16.5 4H20v7.5h-3.5zM10.25 8.5h3.5V16h-3.5zM4 16h3.5v4H4zM16.5 16H20v4h-3.5z"/></svg>`
    },
    deepseek: {
      bg: '#0284c7',
      color: '#fff',
      icon: '🐋',
      svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10a10 10 0 0 1-10-10A10 10 0 0 1 12 2z"/><path d="M12 6v6l4 2"/></svg>`
    },
    openrouter: {
      bg: 'linear-gradient(135deg, #6366f1, #a855f7)',
      color: '#fff',
      icon: '🌐',
      svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`
    },
    cohere: {
      bg: '#d97706',
      color: '#fff',
      icon: '🌿',
      svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`
    },
    huggingface: {
      bg: '#ffcc00',
      color: '#000',
      icon: '🤗',
      svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="12" cy="12" r="10"/><circle cx="8" cy="10" r="1.5"/><circle cx="16" cy="10" r="1.5"/><path d="M7 14s2 3 5 3 5-3 5-3" stroke="#000" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`
    },
    openai: {
      bg: '#10a37f',
      color: '#fff',
      icon: '🟢',
      svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.259 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7466-7.0729z"/></svg>`
    },
    anthropic: {
      bg: '#d97706',
      color: '#fff',
      icon: '✨',
      svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14"/></svg>`
    },
    pollinations: {
      bg: '#a855f7',
      color: '#fff',
      icon: '🌸',
      svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2a4 4 0 0 0-4 4 4 4 0 0 0 4 4 4 4 0 0 0 4-4 4 4 0 0 0-4-4z"/><path d="M12 14a4 4 0 0 0-4 4 4 4 0 0 0 4 4 4 4 0 0 0 4-4 4 4 0 0 0-4-4z"/><path d="M2 12a4 4 0 0 0 4 4 4 4 0 0 0 4-4 4 4 0 0 0-4-4 4 4 0 0 0-4 4z"/><path d="M14 12a4 4 0 0 0 4 4 4 4 0 0 0 4-4 4 4 0 0 0-4-4 4 4 0 0 0-4 4z"/></svg>`
    },
    ovh: {
      bg: '#2563eb',
      color: '#fff',
      icon: '☁️',
      svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`
    },
    ollama: {
      bg: '#ec4899',
      color: '#fff',
      icon: '🦙',
      svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6-6 6v10z"/></svg>`
    },
    mock: {
      bg: '#6366f1',
      color: '#fff',
      icon: '⚙️',
      svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
    }
  };

  function getProviderFavicon(id) {
    const key = (id || '').toLowerCase();
    for (const k of Object.keys(PROVIDER_FAVICONS)) {
      if (key.includes(k)) {
        return PROVIDER_FAVICONS[k];
      }
    }
    return {
      bg: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
      color: '#fff',
      icon: '🤖',
      svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>`
    };
  }

  // -------------------------------------------------------------------------
  // 4. Providers Hub - Live Monitoring & Management
  // -------------------------------------------------------------------------
  const providersContainer = document.getElementById('providers-container');
  const statTotalCount = document.getElementById('stat-total-count');
  const statOkCount = document.getElementById('stat-ok-count');
  const statWaitingCount = document.getElementById('stat-waiting-count');
  const statOffCount = document.getElementById('stat-off-count');
  const statDbBadge = document.getElementById('stat-db-badge');
  const statDbStatusDesc = document.getElementById('stat-db-status-desc');

  const filterSearch = document.getElementById('filter-search');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const filterCountAll = document.getElementById('filter-count-all');
  const filterCountGreen = document.getElementById('filter-count-green');
  const filterCountYellow = document.getElementById('filter-count-yellow');
  const filterCountRed = document.getElementById('filter-count-red');

  const btnAddProviderModal = document.getElementById('btn-add-provider-modal');
  const btnSyncDatabase = document.getElementById('btn-sync-database');
  const btnResetAll = document.getElementById('btn-reset-all');

  const modalAddProvider = document.getElementById('modal-add-provider');
  const closeAddModalBtn = document.getElementById('close-add-modal-btn');
  const btnCancelAdd = document.getElementById('btn-cancel-add');
  const formNewProvider = document.getElementById('form-new-provider');

  const modalCooldownPicker = document.getElementById('modal-cooldown-picker');
  const closeCooldownModalBtn = document.getElementById('close-cooldown-modal-btn');
  const cdModalProvName = document.getElementById('cd-modal-prov-name');
  const cdPresetBtns = document.querySelectorAll('.cd-preset-btn');
  const inputCustomSeconds = document.getElementById('input-custom-seconds');
  const btnApplyCustomCd = document.getElementById('btn-apply-custom-cd');

  let activeProvidersData = [];
  let currentFilter = 'all';
  let activeCooldownTargetId = null;
  let countdownTimerInterval = null;

  // Load database status & providers
  async function loadProvidersHub() {
    try {
      // 1. Fetch DB Status
      const statusRes = await fetch('/database/status');
      if (statusRes.ok) {
        const { status } = await statusRes.json();
        if (status.engine === 'mongodb') {
          statDbBadge.textContent = '🍃 MongoDB';
          statDbBadge.style.color = '#10b981';
          statDbBadge.style.background = 'rgba(16, 185, 129, 0.15)';
          statDbStatusDesc.textContent = `Connected (${status.uri || 'mongodb://127.0.0.1:27017'})`;
        } else if (status.engine === 'file') {
          statDbBadge.textContent = '📂 Local JSON';
          statDbBadge.style.color = '#f59e0b';
          statDbBadge.style.background = 'rgba(245, 158, 11, 0.15)';
          statDbStatusDesc.textContent = 'Zero-dependency JSON store (./data/providers-db.json)';
        } else {
          statDbBadge.textContent = 'Disabled';
          statDbStatusDesc.textContent = 'In-memory ephemeral mode';
        }
      }

      // 2. Fetch Providers List
      const res = await fetch('/database/providers');
      if (!res.ok) throw new Error('Failed to load providers list');
      const data = await res.json();
      activeProvidersData = data.providers || [];

      // Update counters
      const total = activeProvidersData.length;
      const greenCount = activeProvidersData.filter(p => p.statusColor === 'green').length;
      const yellowCount = activeProvidersData.filter(p => p.statusColor === 'yellow').length;
      const redCount = activeProvidersData.filter(p => p.statusColor === 'red').length;

      statTotalCount.textContent = total;
      statOkCount.textContent = greenCount;
      statWaitingCount.textContent = yellowCount;
      statOffCount.textContent = redCount;

      filterCountAll.textContent = total;
      filterCountGreen.textContent = greenCount;
      filterCountYellow.textContent = yellowCount;
      filterCountRed.textContent = redCount;

      navActiveCount.textContent = `${greenCount}/${total}`;

      // Update provider select in playground
      updatePlaygroundProviderSelect(activeProvidersData);

      // Render cards
      renderProviderCards();

      // Start/restart countdown interval
      if (countdownTimerInterval) clearInterval(countdownTimerInterval);
      countdownTimerInterval = setInterval(updateLiveCountdowns, 1000);
    } catch (err) {
      console.error('Error loading providers hub:', err);
      providersContainer.innerHTML = `
        <div class="loading-state" style="color: var(--error);">
          <p>⚠️ Failed to load providers: ${err.message}</p>
          <button class="btn-sm btn-secondary" onclick="loadProvidersHub()">Retry</button>
        </div>
      `;
    }
  }

  function updatePlaygroundProviderSelect(providers) {
    const sel = document.getElementById('provider-select');
    if (!sel) return;
    const currentVal = sel.value;

    let html = `<option value="cascade">⚡ Automatic Priority Cascade (Healthy Providers First)</option>`;
    providers.forEach(p => {
      const isHealthy = p.statusColor === 'green';
      const statusIcon = isHealthy ? '🟢' : (p.statusColor === 'yellow' ? '🟡' : '🔴');
      html += `<option value="${p.id}" ${p.id === currentVal ? 'selected' : ''}>${statusIcon} ${p.name} (${p.model || 'default'})</option>`;
    });
    sel.innerHTML = html;
  }

  function renderProviderCards() {
    const query = (filterSearch.value || '').toLowerCase().trim();
    const filtered = activeProvidersData.filter(p => {
      if (currentFilter !== 'all' && p.statusColor !== currentFilter) {
        return false;
      }
      if (query) {
        const matchName = (p.name || '').toLowerCase().includes(query);
        const matchModel = (p.model || '').toLowerCase().includes(query);
        const matchType = (p.providerType || '').toLowerCase().includes(query);
        const matchId = (p.id || '').toLowerCase().includes(query);
        return matchName || matchModel || matchType || matchId;
      }
      return true;
    });

    if (filtered.length === 0) {
      providersContainer.innerHTML = `
        <div class="loading-state">
          <p>No providers match the current filter or search query.</p>
        </div>
      `;
      return;
    }

    providersContainer.innerHTML = filtered.map(p => {
      const favicon = getProviderFavicon(p.id);
      const isChecked = !p.isManuallyOff;

      // Status Badge details
      const statusClass = p.statusColor || 'green';
      const statusLabel = p.statusLabel || 'Operational';

      // Has active callout (error, cooldown, or manually disabled)
      const hasCallout = p.isManuallyOff || p.inCooldown || !p.isValid || p.lastErrorMessage;
      const calloutClass = p.statusColor === 'yellow' ? 'yellow' : 'red';

      const calloutTitle = p.isManuallyOff
        ? '⏸️ Model Manually Turned Off'
        : (p.inCooldown
          ? (p.statusColor === 'red' ? '📅 Long-term / Monthly Cooldown' : '⏳ Waiting in Cooldown')
          : (!p.isValid ? '⛔ Authentication / Invalid Key' : '⚠️ Last Encountered Error'));

      const calloutMessage = p.isManuallyOff
        ? 'This model was manually ticked off. It will remain off across restarts until you turn it back on.'
        : (p.lastErrorMessage || p.cooldownReason || (!p.isValid ? (p.validationError || 'Invalid credentials') : ''));

      return `
        <div class="provider-card status-${statusClass}" data-id="${p.id}">
          <!-- Card Header -->
          <div class="provider-card-header">
            <div class="provider-brand-info">
              <div class="provider-favicon" style="background: ${favicon.bg}; color: ${favicon.color};">
                ${favicon.svg || favicon.icon}
              </div>
              <div class="provider-title-group">
                <h3>
                  <span>${escapeHtml(p.name)}</span>
                </h3>
                <div class="provider-meta-tags">
                  <span class="model-pill" title="Model">${escapeHtml(p.model || 'default')}</span>
                  <span class="type-pill">${escapeHtml(p.providerType || 'custom')}</span>
                </div>
              </div>
            </div>

            <!-- Lightning Status & Toggle Switch -->
            <div class="header-actions-col">
              <div class="lightning-badge ${statusClass}" title="${statusLabel}">
                <span class="lightning-icon">⚡</span>
                <span class="lightning-label">${statusLabel}</span>
              </div>

              <!-- On / Off Toggle Switch -->
              <div class="toggle-switch-wrapper" title="Tick model on or off (stays off if manually turned off)">
                <span class="toggle-label-text">${isChecked ? 'ON' : 'OFF'}</span>
                <label class="toggle-switch">
                  <input type="checkbox" class="provider-toggle-chk" data-id="${p.id}" ${isChecked ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          <!-- Metadata Rows -->
          <div class="provider-details-list">
            <div class="detail-row">
              <span class="detail-label">API Key:</span>
              <span class="detail-value">${p.hasApiKey ? (p.apiKey || 'Configured (••••••)') : 'Keyless / None'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Rate Limit:</span>
              <span class="detail-value">${p.rateLimitType ? p.rateLimitType.toUpperCase() : 'Standard'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Architecture:</span>
              <span class="detail-value">${escapeHtml(p.providerType || 'openai-compatible')}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Last Checked:</span>
              <span class="detail-value">${p.lastCheckedAt ? formatTimeAgo(p.lastCheckedAt) : 'Just now'}</span>
            </div>
          </div>

          <!-- Error / Cooldown Callout Drawer -->
          ${hasCallout ? `
            <div class="provider-callout-drawer ${calloutClass}">
              <div class="callout-header">
                <span class="callout-title">${calloutTitle}</span>
                ${p.lastErrorAt ? `<span class="callout-time">${formatTimeAgo(p.lastErrorAt)}</span>` : ''}
              </div>
              <div class="callout-message">${escapeHtml(calloutMessage)}</div>

              ${p.inCooldown && p.cooldownUntil ? `
                <div class="cooldown-countdown-row">
                  <span>⏳ Resumes in:</span>
                  <span class="countdown-strong countdown-timer" data-until="${p.cooldownUntil}">${formatSeconds(p.cooldownRemainingSeconds)}</span>
                  <span style="color: var(--text-dim);">(${new Date(p.cooldownUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })})</span>
                </div>
              ` : ''}
            </div>
          ` : ''}

          <!-- Card Actions Footer -->
          <div class="provider-card-footer">
            <div class="card-btn-group">
              ${p.inCooldown ? `
                <button type="button" class="btn-card-action btn-clear-cd" data-id="${p.id}" title="Clear active cooldown immediately">
                  🔄 Clear Cooldown
                </button>
              ` : ''}
              <button type="button" class="btn-card-action btn-set-cd" data-id="${p.id}" data-name="${escapeHtml(p.name)}" title="Set custom cooldown timeframe">
                ⏱️ Set Cooldown
              </button>
              <button type="button" class="btn-card-action btn-ping-test" data-id="${p.id}" data-name="${escapeHtml(p.name)}" title="Test connection latency">
                ⚡ Test Ping
              </button>
            </div>
            ${p.id !== 'gemini' && p.id !== 'groq' && p.id !== 'pollinations' && p.id !== 'mock' ? `
              <button type="button" class="btn-card-action btn-danger btn-delete-prov" data-id="${p.id}" title="Delete custom provider">
                🗑️
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Attach card event listeners
    attachCardListeners();
  }

  function attachCardListeners() {
    // 1. Toggle switch (on/off)
    document.querySelectorAll('.provider-toggle-chk').forEach(chk => {
      chk.addEventListener('change', async (e) => {
        const id = chk.getAttribute('data-id');
        const enabled = chk.checked;
        try {
          const res = await fetch(`/database/providers/${id}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled })
          });
          if (!res.ok) throw new Error('Toggle request failed');
          const data = await res.json();
          showToast(data.message || `Provider ${enabled ? 'enabled' : 'disabled'}`, enabled ? 'success' : 'info');
          loadProvidersHub();
        } catch (err) {
          showToast(`Error updating provider: ${err.message}`, 'error');
          chk.checked = !enabled; // Revert
        }
      });
    });

    // 2. Clear cooldown
    document.querySelectorAll('.btn-clear-cd').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        try {
          btn.textContent = 'Clearing...';
          const res = await fetch(`/database/providers/${id}/reset`, { method: 'POST' });
          if (!res.ok) throw new Error('Clear cooldown failed');
          showToast(`Cooldown cleared for ${id}`, 'success');
          loadProvidersHub();
        } catch (err) {
          showToast(`Error: ${err.message}`, 'error');
        }
      });
    });

    // 3. Set Cooldown Picker Modal
    document.querySelectorAll('.btn-set-cd').forEach(btn => {
      btn.addEventListener('click', () => {
        activeCooldownTargetId = btn.getAttribute('data-id');
        cdModalProvName.textContent = btn.getAttribute('data-name') || activeCooldownTargetId;
        inputCustomSeconds.value = '';
        modalCooldownPicker.style.display = 'flex';
      });
    });

    // 4. Test Ping
    document.querySelectorAll('.btn-ping-test').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        const originalText = btn.innerHTML;
        btn.innerHTML = 'Testing...';
        btn.disabled = true;

        try {
          const res = await fetch(`/database/providers/${id}/test`, { method: 'POST' });
          const data = await res.json();
          if (res.ok && data.success) {
            showToast(`✓ ${name} ping succeeded: ${data.latencyMs}ms latency!`, 'success');
          } else {
            showToast(`✕ ${name} ping failed: ${data.error || 'Connection failed'}`, 'error');
          }
          loadProvidersHub();
        } catch (err) {
          showToast(`✕ Test error: ${err.message}`, 'error');
        } finally {
          btn.innerHTML = originalText;
          btn.disabled = false;
        }
      });
    });

    // 5. Delete Provider
    document.querySelectorAll('.btn-delete-prov').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!confirm(`Are you sure you want to delete custom provider "${id}"?`)) return;

        try {
          const res = await fetch(`/database/providers/${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Delete failed');
          showToast(`Provider "${id}" deleted`, 'info');
          loadProvidersHub();
        } catch (err) {
          showToast(`Error deleting: ${err.message}`, 'error');
        }
      });
    });
  }

  // Live countdown ticker
  function updateLiveCountdowns() {
    const timers = document.querySelectorAll('.countdown-timer');
    timers.forEach(timer => {
      const untilStr = timer.getAttribute('data-until');
      if (!untilStr) return;
      const untilMs = new Date(untilStr).getTime();
      const remainingSec = Math.max(0, Math.ceil((untilMs - Date.now()) / 1000));
      timer.textContent = formatSeconds(remainingSec);
      if (remainingSec === 0) {
        // Cooldown finished: reload hub
        loadProvidersHub();
      }
    });
  }

  // Filter Buttons
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter');
      renderProviderCards();
    });
  });

  filterSearch.addEventListener('input', () => {
    renderProviderCards();
  });

  // Re-sync from .env
  btnSyncDatabase.addEventListener('click', async () => {
    btnSyncDatabase.innerHTML = '<span>Syncing...</span>';
    try {
      const res = await fetch('/database/sync', { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      const data = await res.json();
      showToast(`Database synced: ${data.syncResult.synced} tracked (${data.syncResult.added} added)`, 'success');
      loadProvidersHub();
    } catch (err) {
      showToast(`Sync error: ${err.message}`, 'error');
    } finally {
      btnSyncDatabase.innerHTML = '<span>🔄 Sync from .env</span>';
    }
  });

  // Reset all cooldowns
  btnResetAll.addEventListener('click', async () => {
    if (!confirm('Clear cooldowns for all providers?')) return;
    try {
      const res = await fetch('/providers/reset', { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed');
      showToast('All provider cooldowns reset successfully', 'success');
      loadProvidersHub();
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  });

  // Add Provider Modal
  btnAddProviderModal.addEventListener('click', () => {
    formNewProvider.reset();
    modalAddProvider.style.display = 'flex';
  });

  closeAddModalBtn.addEventListener('click', () => modalAddProvider.style.display = 'none');
  btnCancelAdd.addEventListener('click', () => modalAddProvider.style.display = 'none');

  formNewProvider.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('input-new-id').value.trim().toLowerCase();
    const name = document.getElementById('input-new-name').value.trim();
    const providerType = document.getElementById('input-new-type').value;
    const model = document.getElementById('input-new-model').value.trim();
    const apiKey = document.getElementById('input-new-key').value.trim();
    const baseUrl = document.getElementById('input-new-url').value.trim();
    const isAvailable = document.getElementById('input-new-enabled').checked;

    if (!id || !name || !model) {
      showToast('Please fill in required fields (ID, Name, Model)', 'error');
      return;
    }

    try {
      const res = await fetch('/database/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name,
          providerType,
          model,
          apiKey: apiKey || undefined,
          baseUrl: baseUrl || undefined,
          isAvailable,
          isValid: true
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save provider');
      }

      showToast(`Provider "${name}" saved and registered!`, 'success');
      modalAddProvider.style.display = 'none';
      loadProvidersHub();
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  });

  // Cooldown Modal Actions
  closeCooldownModalBtn.addEventListener('click', () => modalCooldownPicker.style.display = 'none');

  cdPresetBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!activeCooldownTargetId) return;
      const seconds = btn.getAttribute('data-cd');
      const rateLimitType = btn.getAttribute('data-type');
      await applyCooldown(activeCooldownTargetId, {
        seconds: seconds ? Number(seconds) : undefined,
        rateLimitType: rateLimitType || undefined,
        reason: rateLimitType === 'month' ? 'Monthly token quota exhausted' : 'Manual cooldown applied'
      });
    });
  });

  btnApplyCustomCd.addEventListener('click', async () => {
    if (!activeCooldownTargetId) return;
    const sec = Number(inputCustomSeconds.value);
    if (!sec || sec <= 0) {
      showToast('Please enter a valid positive number of seconds', 'error');
      return;
    }
    await applyCooldown(activeCooldownTargetId, { seconds: sec, reason: 'Custom cooldown applied' });
  });

  async function applyCooldown(id, payload) {
    try {
      const res = await fetch(`/database/providers/${id}/cooldown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to set cooldown');
      const data = await res.json();
      showToast(data.message || 'Cooldown set successfully', 'success');
      modalCooldownPicker.style.display = 'none';
      loadProvidersHub();
    } catch (err) {
      showToast(`Error setting cooldown: ${err.message}`, 'error');
    }
  }

  // -------------------------------------------------------------------------
  // 5. Existing Normalizer Playground Logic
  // -------------------------------------------------------------------------
  const templateSelect = document.getElementById('template-select');
  const customSchemaGroup = document.getElementById('custom-schema-group');
  const customSchemaInput = document.getElementById('custom-schema-input');
  const rawTextInput = document.getElementById('raw-text-input');
  const rawCharCount = document.getElementById('raw-char-count');
  const targetLocale = document.getElementById('target-locale');
  const providerSelect = document.getElementById('provider-select');
  const bookIdInput = document.getElementById('book-id-input');
  const outputFormat = document.getElementById('output-format');
  const schemaTypeHint = document.getElementById('schema-type-hint');

  const btnNormalize = document.getElementById('btn-normalize');
  const btnValidateOnly = document.getElementById('btn-validate-only');
  const btnCleanNoise = document.getElementById('btn-clean-noise');
  const btnPreviewSplit = document.getElementById('btn-preview-split');
  const chkAutoSplit = document.getElementById('chk-auto-split');
  const chkChunked = document.getElementById('chk-chunked');

  const multiEntitySelector = document.getElementById('multi-entity-selector');
  const multiEntityCount = document.getElementById('multi-entity-count');
  const entityPillsContainer = document.getElementById('entity-pills-container');
  const relCount = document.getElementById('rel-count');

  const executionMeta = document.getElementById('execution-meta');
  const metaProvider = document.getElementById('meta-provider');
  const metaLatency = document.getElementById('meta-latency');

  const badgeValidity = document.getElementById('badge-validity');
  const validityLabel = document.getElementById('validity-label');
  const metricChecks = document.getElementById('metric-checks');
  const metricCoerced = document.getElementById('metric-coerced');
  const diagnosticsDrawer = document.getElementById('diagnostics-drawer');
  const coercedGroup = document.getElementById('coerced-group');
  const warningsGroup = document.getElementById('warnings-group');

  const tabButtons = document.querySelectorAll('.tab-btn');
  const outputDisplay = document.getElementById('output-display');
  const btnCopy = document.getElementById('btn-copy');
  const btnDownload = document.getElementById('btn-download');

  let currentResult = null;
  let multiSplitData = null;
  let currentActiveTab = 'tab-mongo-shell';
  let cachedTemplates = {};

  // Character counter
  rawTextInput.addEventListener('input', () => {
    rawCharCount.textContent = `${rawTextInput.value.length} chars`;
  });

  // Template change
  templateSelect.addEventListener('change', () => {
    const val = templateSelect.value;
    if (val === 'custom') {
      customSchemaGroup.style.display = 'block';
      schemaTypeHint.textContent = 'Custom Target Schema';
    } else {
      customSchemaGroup.style.display = 'none';
      schemaTypeHint.textContent = `${val.charAt(0).toUpperCase() + val.slice(1)} Schema`;
      loadTemplateSample(val);
    }
  });

  // Presets
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const preset = btn.getAttribute('data-preset');
      templateSelect.value = preset;
      customSchemaGroup.style.display = 'none';
      schemaTypeHint.textContent = `${preset.charAt(0).toUpperCase() + preset.slice(1)} Schema`;
      loadTemplateSample(preset);
    });
  });

  // Clean Noise
  btnCleanNoise.addEventListener('click', () => {
    let text = rawTextInput.value;
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    text = text.replace(/`([^`]+)`/g, '$1');
    rawTextInput.value = text;
    rawCharCount.textContent = `${text.length} chars`;
    showToast('Markdown URLs & code blocks cleaned', 'info');
  });

  // Tabs
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentActiveTab = btn.getAttribute('data-tab');
      renderOutputDisplay();
    });
  });

  // Copy
  btnCopy.addEventListener('click', () => {
    const text = outputDisplay.textContent;
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard!', 'success');
    });
  });

  // Download
  btnDownload.addEventListener('click', () => {
    if (!currentResult && !multiSplitData) return;
    const content = outputDisplay.textContent;
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `normalized-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Normalize execution
  btnNormalize.addEventListener('click', executeNormalization);
  btnValidateOnly.addEventListener('click', executeValidateOnly);

  async function executeNormalization() {
    const text = rawTextInput.value.trim();
    if (!text) {
      showToast('Please paste raw text to normalize', 'error');
      return;
    }

    btnNormalize.classList.add('loading');
    btnNormalize.disabled = true;

    try {
      const template = templateSelect.value;
      const options = {
        targetLocale: targetLocale.value,
        autoSplit: chkAutoSplit.checked,
        chunked: chkChunked.checked,
        bookId: bookIdInput.value.trim() || undefined
      };

      if (providerSelect.value !== 'cascade') {
        options.specificProvider = providerSelect.value;
      }

      let payload = { text, options };
      if (template === 'custom') {
        try {
          payload.schema = JSON.parse(customSchemaInput.value);
        } catch (e) {
          throw new Error('Invalid custom schema JSON: ' + e.message);
        }
      } else {
        payload.template = template;
      }

      const res = await fetch('/normalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Normalization failed');

      if (data.autoSplit) {
        multiSplitData = data;
        renderMultiEntitySelector(data);
      } else {
        multiSplitData = null;
        multiEntitySelector.style.display = 'none';
        currentResult = data;
        displaySingleResult(data);
      }

      showToast('Normalization complete!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
      outputDisplay.textContent = `❌ Normalization Error:\n${err.message}`;
    } finally {
      btnNormalize.classList.remove('loading');
      btnNormalize.disabled = false;
    }
  }

  function displaySingleResult(res) {
    currentResult = res;
    executionMeta.style.display = 'flex';
    metaProvider.textContent = res.provider || 'AI';
    metaLatency.textContent = `${res.latencyMs || 0}ms`;

    const val = res.validation || {};
    metricChecks.textContent = `${val.checksRun || 0} Checks Run`;
    metricCoerced.textContent = `${val.coercedFields?.length || 0} Coerced`;

    badgeValidity.className = `badge-status ${val.isValid ? 'valid' : 'invalid'}`;
    badgeValidity.innerHTML = val.isValid ? '✓ Schema Compliant' : '⚠ Validation Warnings';

    renderOutputDisplay();
  }

  function renderMultiEntitySelector(data) {
    multiEntitySelector.style.display = 'flex';
    multiEntityCount.textContent = data.count || data.entities?.length || 0;
    entityPillsContainer.innerHTML = '';

    (data.results || []).forEach((res, idx) => {
      const name = res.data?.name || `Entity ${idx + 1}`;
      const pill = document.createElement('button');
      pill.className = `entity-pill ${idx === 0 ? 'active' : ''}`;
      pill.textContent = name;
      pill.addEventListener('click', () => {
        document.querySelectorAll('.entity-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        displaySingleResult(res);
      });
      entityPillsContainer.appendChild(pill);
    });

    if (data.results && data.results.length > 0) {
      displaySingleResult(data.results[0]);
    }
  }

  function renderOutputDisplay() {
    if (!currentResult) return;

    if (currentActiveTab === 'tab-mongo-shell') {
      outputDisplay.textContent = currentResult.mongoShell || JSON.stringify(currentResult.data, null, 2);
    } else if (currentActiveTab === 'tab-json') {
      outputDisplay.textContent = JSON.stringify(currentResult.data, null, 2);
    } else if (currentActiveTab === 'tab-extended') {
      outputDisplay.textContent = JSON.stringify(currentResult.mongoExtended || currentResult.data, null, 2);
    } else if (currentActiveTab === 'tab-relations') {
      outputDisplay.textContent = JSON.stringify(currentResult.relations || [], null, 2);
    } else if (currentActiveTab === 'tab-schema') {
      const tmpl = templateSelect.value;
      outputDisplay.textContent = JSON.stringify(cachedTemplates[tmpl] || {}, null, 2);
    }
  }

  async function executeValidateOnly() {
    try {
      let parsed = null;
      try {
        parsed = JSON.parse(outputDisplay.textContent);
      } catch (e) {
        throw new Error('Output is not valid JSON to validate');
      }

      const res = await fetch('/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: parsed,
          template: templateSelect.value !== 'custom' ? templateSelect.value : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Validation failed');
      displaySingleResult(data);
      showToast('Validation checks updated', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function loadTemplateSample(tmplName) {
    try {
      const res = await fetch(`/templates/${tmplName}`);
      if (res.ok) {
        const data = await res.json();
        cachedTemplates[tmplName] = data.schema;
        if (data.sampleText) {
          rawTextInput.value = data.sampleText;
          rawCharCount.textContent = `${data.sampleText.length} chars`;
        }
      }
    } catch (e) {
      console.warn('Could not load template sample', e);
    }
  }

  // -------------------------------------------------------------------------
  // Helper Utilities
  // -------------------------------------------------------------------------
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatSeconds(sec) {
    if (!sec || sec <= 0) return '0s';
    if (sec >= 86400) return `${(sec / 86400).toFixed(1)}d`;
    if (sec >= 3600) {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      return `${h}h ${m}m`;
    }
    if (sec >= 60) {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}m ${s}s`;
    }
    return `${sec}s`;
  }

  function formatTimeAgo(isoStr) {
    if (!isoStr) return '';
    const diff = Math.max(0, Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000));
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  // Initial load
  loadProvidersHub();
  loadTemplateSample('monster');
});
