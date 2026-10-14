document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
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

  const docsBtn = document.getElementById('docs-btn');
  const docsModal = document.getElementById('docs-modal');
  const closeDocsBtn = document.getElementById('close-docs-btn');
  const activeProvidersCount = document.getElementById('active-providers-count');

  let currentResult = null;
  let multiSplitData = null;
  let currentActiveTab = 'tab-mongo-shell';
  let cachedTemplates = {};

  // Initialize
  fetchProviders();
  loadTemplates();

  // Character counter
  rawTextInput.addEventListener('input', () => {
    rawCharCount.textContent = `${rawTextInput.value.length} chars`;
  });

  // Template change
  templateSelect.addEventListener('change', () => {
    const val = templateSelect.value;
    if (val === 'custom') {
      customSchemaGroup.style.display = 'block';
      schemaTypeHint.textContent = 'Custom Object Schema';
    } else {
      customSchemaGroup.style.display = 'none';
      const tmpl = cachedTemplates[val];
      if (tmpl) {
        schemaTypeHint.textContent = `${tmpl.category || '5e'} Model`;
        rawTextInput.value = tmpl.exampleParagraph || '';
        rawCharCount.textContent = `${rawTextInput.value.length} chars`;
      }
    }

    // Highlight matching preset button if one exists
    document.querySelectorAll('.preset-btn').forEach(b => {
      if (b.getAttribute('data-preset') === val) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
  });

  // Presets
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const presetName = btn.getAttribute('data-preset');
      if (presetName) {
        templateSelect.value = presetName;
        templateSelect.dispatchEvent(new Event('change'));
      }
    });
  });

  // Clean noise and markdown links button
  btnCleanNoise.addEventListener('click', () => {
    let text = rawTextInput.value;
    if (!text.trim()) return;
    // Flatten markdown links: [Text](url) -> Text
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    // Strip quote attribution lines
    text = text.replace(/^[—–-]\s*[A-Z][a-zA-Z\s,]+$/gm, '');
    rawTextInput.value = text;
    rawCharCount.textContent = `${text.length} chars`;
    btnCleanNoise.textContent = '✓ Cleaned!';
    setTimeout(() => (btnCleanNoise.textContent = '🧹 Clean Links'), 1500);
  });

  // Preview / Detect Entities button
  btnPreviewSplit.addEventListener('click', async () => {
    const text = rawTextInput.value.trim();
    if (!text) {
      alert('Please paste some text first.');
      return;
    }
    try {
      const res = await fetch('/preprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (data.count > 1) {
        const names = data.entities.map((e, i) => `${i + 1}. ${e.name} (${e.type || 'Entity'})`).join('\n');
        alert(`Detected ${data.count} distinct entities in text:\n\n${names}`);
      } else {
        alert(`Detected 1 entity: ${data.entities[0]?.name || 'Single entity'}`);
      }
    } catch (err) {
      alert(`Preview failed: ${err.message}`);
    }
  });

  // Tabs
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentActiveTab = btn.getAttribute('data-tab');
      renderCurrentTab();
    });
  });

  // Normalize action
  btnNormalize.addEventListener('click', async () => {
    const text = rawTextInput.value.trim();
    if (!text) {
      alert('Please enter or paste a paragraph of raw text first.');
      return;
    }

    setLoading(true);

    try {
      const templateVal = templateSelect.value;
      const shouldAutoSplit = chkAutoSplit ? chkAutoSplit.checked : true;
      const shouldChunk = chkChunked ? chkChunked.checked : true;
      const payload = {
        text,
        template: templateVal !== 'custom' ? templateVal : undefined,
        schema: templateVal === 'custom' && customSchemaInput.value.trim() ? JSON.parse(customSchemaInput.value) : undefined,
        autoSplit: shouldAutoSplit,
        chunked: shouldChunk,
        options: {
          targetLocale: targetLocale.value !== 'none' ? targetLocale.value : undefined,
          specificProvider: providerSelect.value !== 'cascade' ? providerSelect.value : undefined,
          autoSplit: shouldAutoSplit,
          chunked: shouldChunk,
          defaults: {
            books: bookIdInput.value.trim() ? [bookIdInput.value.trim()] : undefined
          },
          format: 'all'
        }
      };

      const res = await fetch('/normalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Normalization failed');
      }

      if (data.autoSplit && data.count > 1) {
        multiSplitData = data;
        multiEntitySelector.style.display = 'flex';
        multiEntityCount.textContent = data.count;
        renderEntityPills(data);
        currentResult = data.results[0];
        displayResult(currentResult);
      } else {
        multiSplitData = null;
        multiEntitySelector.style.display = 'none';
        currentResult = data;
        displayResult(data);
      }
    } catch (err) {
      alert(`Error during normalization: ${err.message}`);
      badgeValidity.className = 'badge-status';
      badgeValidity.style.color = '#ef4444';
      validityLabel.textContent = `Failed: ${err.message}`;
    } finally {
      setLoading(false);
    }
  });

  function renderEntityPills(multiData) {
    entityPillsContainer.innerHTML = '';
    multiData.results.forEach((res, idx) => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `entity-pill ${idx === 0 ? 'active' : ''}`;
      pill.textContent = `${idx + 1}. ${res.data.name || `Entity ${idx + 1}`}`;
      pill.addEventListener('click', () => {
        document.querySelectorAll('.entity-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentResult = res;
        displayResult(res);
      });
      entityPillsContainer.appendChild(pill);
    });
  }

  // Verify only action
  btnValidateOnly.addEventListener('click', async () => {
    if (!currentResult || !currentResult.data) {
      alert('No normalized object available to verify yet. Run "Normalize Object" first.');
      return;
    }

    try {
      const res = await fetch('/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: currentResult.data,
          template: templateSelect.value !== 'custom' ? templateSelect.value : undefined,
          schema: templateSelect.value === 'custom' && customSchemaInput.value.trim() ? JSON.parse(customSchemaInput.value) : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      currentResult = { ...currentResult, ...data };
      displayResult(currentResult);
      alert('Property checks completed successfully! See diagnostics panel.');
    } catch (err) {
      alert(`Validation error: ${err.message}`);
    }
  });

  function displayResult(result) {
    executionMeta.style.display = 'flex';
    let providerLabel = result.provider ? `Provider: ${result.provider}` : 'Done';
    if (result.cached) providerLabel += ' ⚡ (Cached)';
    if (result.chunked) providerLabel += ` 🧩 (Chunked: ${result.chunksProcessed ? result.chunksProcessed.join(', ') : 'multi-part'})`;

    metaProvider.textContent = providerLabel;
    metaLatency.textContent = `${result.latencyMs || 0}ms`;

    const val = result.validation || { isValid: true, checksRun: 0, coercedFields: [], warnings: [] };

    badgeValidity.className = `badge-status ${val.isValid ? 'valid' : 'warning'}`;
    validityLabel.textContent = val.isValid ? 'Schema Valid & Normalized' : 'Passed with Warnings';
    metricChecks.textContent = `${val.checksRun} Checks Run`;
    metricCoerced.textContent = `${val.coercedFields ? val.coercedFields.length : 0} Coerced`;
    relCount.textContent = result.relations ? result.relations.length : 0;

    // Render diagnostics
    coercedGroup.innerHTML = '';
    warningsGroup.innerHTML = '';

    if (val.coercedFields && val.coercedFields.length > 0) {
      diagnosticsDrawer.style.display = 'flex';
      val.coercedFields.forEach(c => {
        const div = document.createElement('div');
        div.className = 'diagnostic-item';
        div.innerHTML = `<span class="diag-pill coerced">Coerced</span> <code>${c.path}</code>: ${c.reason} (${JSON.stringify(c.original)} → ${JSON.stringify(c.coerced)})`;
        coercedGroup.appendChild(div);
      });
    }

    if (val.warnings && val.warnings.length > 0) {
      diagnosticsDrawer.style.display = 'flex';
      val.warnings.forEach(w => {
        const div = document.createElement('div');
        div.className = 'diagnostic-item';
        div.innerHTML = `<span class="diag-pill warning">Warning</span> ${w}`;
        warningsGroup.appendChild(div);
      });
    }

    if ((!val.coercedFields || val.coercedFields.length === 0) && (!val.warnings || val.warnings.length === 0)) {
      diagnosticsDrawer.style.display = 'none';
    }

    renderCurrentTab();
  }

  function renderCurrentTab() {
    if (!currentResult) return;

    if (currentActiveTab === 'tab-mongo-shell') {
      outputDisplay.textContent = currentResult.mongoShell || JSON.stringify(currentResult.data, null, 2);
    } else if (currentActiveTab === 'tab-json') {
      outputDisplay.textContent = JSON.stringify(currentResult.data, null, 2);
    } else if (currentActiveTab === 'tab-extended') {
      outputDisplay.textContent = JSON.stringify(currentResult.mongoExtended || currentResult.data, null, 2);
    } else if (currentActiveTab === 'tab-relations') {
      if (currentResult.relations && currentResult.relations.length > 0) {
        outputDisplay.textContent = JSON.stringify(currentResult.relations, null, 2);
      } else {
        outputDisplay.textContent = '// No foreign entity relationships detected in this model.';
      }
    } else if (currentActiveTab === 'tab-schema') {
      const tmpl = cachedTemplates[templateSelect.value];
      outputDisplay.textContent = tmpl ? JSON.stringify(tmpl.schema, null, 2) : '// Custom Schema';
    }
  }

  // Copy to clipboard
  btnCopy.addEventListener('click', () => {
    const text = outputDisplay.textContent;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      const orig = btnCopy.textContent;
      btnCopy.textContent = '✓ Copied!';
      setTimeout(() => (btnCopy.textContent = orig), 1800);
    });
  });

  // Download JSON
  btnDownload.addEventListener('click', () => {
    if (!currentResult || !currentResult.data) return;
    const blob = new Blob([JSON.stringify(currentResult.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentResult.data.name || 'entity'}_normalized.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Modal docs
  docsBtn.addEventListener('click', e => {
    e.preventDefault();
    docsModal.style.display = 'flex';
  });
  closeDocsBtn.addEventListener('click', () => {
    docsModal.style.display = 'none';
  });
  docsModal.addEventListener('click', e => {
    if (e.target === docsModal) docsModal.style.display = 'none';
  });

  function setLoading(loading) {
    btnNormalize.disabled = loading;
    const btnText = btnNormalize.querySelector('.btn-text');
    if (loading) {
      btnText.textContent = 'Normalizing & Checking Properties...';
      btnNormalize.style.opacity = '0.7';
    } else {
      btnText.textContent = 'Normalize Object';
      btnNormalize.style.opacity = '1';
    }
  }

  async function fetchProviders() {
    try {
      const res = await fetch('/providers/all');
      const data = await res.json();
      if (data && data.providers) {
        const available = data.providers.filter(p => p.available).map(p => p.name);
        activeProvidersCount.textContent = `${available.length} Available (${available.join(', ')})`;
      }
    } catch {
      activeProvidersCount.textContent = 'Standalone Mode';
    }
  }

  async function loadTemplates() {
    try {
      const res = await fetch('/templates');
      const data = await res.json();
      if (data && data.templates) {
        data.templates.forEach(t => {
          cachedTemplates[t.name] = t;
        });

        // Load Tiger preset by default
        if (cachedTemplates.monster) {
          rawTextInput.value = cachedTemplates.monster.exampleParagraph;
          rawCharCount.textContent = `${rawTextInput.value.length} chars`;
        }
      }
    } catch (err) {
      console.warn('Could not pre-fetch templates:', err);
    }
  }
});
