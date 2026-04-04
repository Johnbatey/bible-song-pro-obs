    function getHostMode() {
      return [HOST_MODE_OBS, HOST_MODE_VMIX, HOST_MODE_STANDALONE].includes(hostMode) ? hostMode : HOST_MODE_OBS;
    }

    function isObsMode() {
      return getHostMode() === HOST_MODE_OBS;
    }

    function isVmixMode() {
      return getHostMode() === HOST_MODE_VMIX;
    }

    function isStandaloneMode() {
      return getHostMode() === HOST_MODE_STANDALONE;
    }

    function getVmixSettings() {
      return { ...vmixState };
    }

    function isVmixAdvancedMode() {
      return vmixState.outputMode !== VMIX_OUTPUT_MODE_DEDICATED ||
        !!vmixState.autoShowOnProject ||
        !!vmixState.autoHideOnClear;
    }

    function updateVmixStatusUi() {
      const panel = document.getElementById('vmix-status-panel');
      const bodyEl = document.getElementById('vmix-status-body');
      const summaryEl = document.getElementById('vmix-status-summary');
      const connectionEl = document.getElementById('vmix-connection-label');
      const outputEl = document.getElementById('vmix-output-label');
      const modeEl = document.getElementById('vmix-mode-label');
      const showBtn = document.getElementById('btn-vmix-show');
      const hideBtn = document.getElementById('btn-vmix-hide');
      const urlEl = document.getElementById('vmix-display-url');
      const toggleEl = document.getElementById('btn-vmix-panel-toggle');
      if (panel) panel.style.display = isVmixMode() ? '' : 'none';
      if (bodyEl) bodyEl.style.display = panel?.classList.contains('is-collapsed') ? 'none' : 'flex';
      if (toggleEl) toggleEl.textContent = panel?.classList.contains('is-collapsed') ? '>' : 'v';
      if (connectionEl) {
        if (!vmixState.enabled) connectionEl.textContent = 'vMix disabled';
        else if (vmixConnectionState === 'connected') connectionEl.textContent = 'vMix connected';
        else if (vmixConnectionState === 'connecting') connectionEl.textContent = 'Connecting to vMix...';
        else if (vmixConnectionState === 'error') connectionEl.textContent = `vMix error: ${vmixLastError || 'Unknown error'}`;
        else connectionEl.textContent = 'vMix disconnected';
      }
      if (summaryEl) summaryEl.textContent = connectionEl ? connectionEl.textContent : 'vMix disconnected';
      if (outputEl) {
        outputEl.textContent = vmixResolvedInput?.title
          ? `Output: ${vmixResolvedInput.title}`
          : `Output not found: ${vmixState.outputInputName || 'Not configured'}`;
      }
      if (modeEl) {
        modeEl.textContent = isVmixAdvancedMode() ? 'Advanced routing' : 'Basic routing';
      }
      if (urlEl) {
        urlEl.value = getVmixDisplayUrl();
      }
      if (showBtn) showBtn.style.display = isVmixAdvancedMode() ? '' : 'none';
      if (hideBtn) hideBtn.style.display = isVmixAdvancedMode() ? '' : 'none';
    }

    function toggleVmixStatusPanel() {
      const panel = document.getElementById('vmix-status-panel');
      if (!panel) return;
      panel.classList.toggle('is-collapsed');
      updateVmixStatusUi();
    }

    async function refreshLocalServerInfo() {
      if (!(window.BSPDesktop && typeof window.BSPDesktop.getLocalServerInfo === 'function')) return null;
      try {
        localServerInfo = await window.BSPDesktop.getLocalServerInfo();
      } catch (error) {
        localServerInfo = null;
      }
      updateVmixStatusUi();
      return localServerInfo;
    }

    function getVmixDisplayUrl() {
      if (localServerInfo) {
        const selectedHost = String(vmixState.displayHost || '').trim() || localServerInfo.preferredHost || '127.0.0.1';
        return `http://${selectedHost}:${localServerInfo.httpPort}/BSP_display.html?hostMode=vmix&relay=ws://${selectedHost}:${localServerInfo.relayPort}`;
      }
      const relayHost = String(vmixState.displayHost || '').trim() || resolveRelayHost() || '127.0.0.1';
      const relayPort = getRelayPort();
      const httpPort = getHttpPort();
      return `http://${relayHost}:${httpPort}/BSP_display.html?hostMode=vmix&relay=ws://${relayHost}:${relayPort}`;
    }

    async function copyVmixDisplayUrl() {
      const url = getVmixDisplayUrl();
      if (!url) return;
      try {
        if (window.BSPDesktop && typeof window.BSPDesktop.copyText === 'function') {
          await window.BSPDesktop.copyText(url);
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
        }
        showToast('vMix display URL copied');
      } catch (error) {
        showToast('Unable to copy vMix display URL');
      }
    }

    function buildVmixBaseUrl() {
      const host = String(vmixState.host || '').trim() || '127.0.0.1';
      const port = String(vmixState.port || '').trim() || '8088';
      return `http://${host}:${port}`;
    }

    function buildVmixApiUrl(extraParams = {}) {
      const params = new URLSearchParams();
      Object.entries(extraParams || {}).forEach(([key, value]) => {
        if (value == null || value === '') return;
        params.set(key, String(value));
      });
      if (vmixState.password) {
        params.set('Password', vmixState.password);
      }
      const qs = params.toString();
      return `${buildVmixBaseUrl()}/api/${qs ? `?${qs}` : ''}`;
    }

    async function vmixFetchText(extraParams = {}) {
      const response = await fetch(buildVmixApiUrl(extraParams), {
        method: 'GET',
        cache: 'no-store'
      });
      if (!response.ok) {
        throw new Error(`vMix API returned ${response.status}`);
      }
      return await response.text();
    }

    async function vmixFetchXml() {
      const text = await vmixFetchText();
      vmixLastXml = text;
      return text;
    }

    function vmixParseInputs(xmlText) {
      if (!xmlText) return [];
      const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
      return Array.from(doc.querySelectorAll('vmix > inputs > input')).map((node) => ({
        key: node.getAttribute('key') || '',
        number: node.getAttribute('number') || '',
        title: node.getAttribute('title') || '',
        shortTitle: node.getAttribute('shortTitle') || '',
        type: node.getAttribute('type') || ''
      }));
    }

    function vmixFindInputByName(name, inputs = []) {
      const wanted = String(name || '').trim().toLowerCase();
      if (!wanted) return null;
      return inputs.find((input) => {
        const title = String(input.title || '').trim().toLowerCase();
        const shortTitle = String(input.shortTitle || '').trim().toLowerCase();
        return title === wanted || shortTitle === wanted;
      }) || null;
    }

    function vmixResolveConfiguredOutputInput(inputs = []) {
      const byKey = vmixState.outputInputKey
        ? inputs.find((input) => String(input.key || '') === String(vmixState.outputInputKey || ''))
        : null;
      return byKey || vmixFindInputByName(vmixState.outputInputName, inputs);
    }

    async function vmixConnect() {
      if (!isVmixMode()) {
        vmixConnectionState = 'disconnected';
        vmixLastError = '';
        updateVmixStatusUi();
        return false;
      }
      if (!vmixState.enabled) {
        vmixConnectionState = 'error';
        vmixLastError = 'Enable vMix Integration first';
        updateVmixStatusUi();
        return false;
      }
      if (!String(vmixState.host || '').trim() || !String(vmixState.port || '').trim()) {
        vmixConnectionState = 'error';
        vmixLastError = 'Host or port missing';
        updateVmixStatusUi();
        return false;
      }
      vmixConnectionState = 'connecting';
      vmixLastError = '';
      updateVmixStatusUi();
      try {
        const xml = await vmixFetchXml();
        const inputs = vmixParseInputs(xml);
        vmixResolvedInput = vmixResolveConfiguredOutputInput(inputs);
        if (vmixResolvedInput?.key && vmixResolvedInput.key !== vmixState.outputInputKey) {
          updateVmixSettings({ outputInputKey: vmixResolvedInput.key }, { silent: true });
        }
        vmixConnectionState = 'connected';
        vmixLastUpdateAt = Date.now();
        if (!vmixResolvedInput) {
          vmixLastError = `Create or rename a vMix input to "${vmixState.outputInputName}"`;
        }
        updateVmixStatusUi();
        return true;
      } catch (error) {
        vmixConnectionState = 'error';
        vmixResolvedInput = null;
        vmixLastError = error && error.message ? error.message : 'Unable to reach vMix API';
        updateVmixStatusUi();
        return false;
      }
    }

    async function vmixReconnect() {
      vmixResolvedInput = null;
      vmixConnectionState = 'connecting';
      updateVmixStatusUi();
      return await vmixConnect();
    }

    async function vmixEnsureOutputInput() {
      if (vmixResolvedInput?.key || vmixResolvedInput?.title) return vmixResolvedInput;
      const ok = await vmixConnect();
      return ok ? vmixResolvedInput : null;
    }

    async function vmixCallFunction(functionName, extraParams = {}) {
      await vmixFetchText({
        Function: functionName,
        ...extraParams
      });
      vmixLastUpdateAt = Date.now();
      updateVmixStatusUi();
      return true;
    }

    async function vmixShowOutput() {
      if (!isVmixMode() || !vmixState.enabled) return false;
      const input = await vmixEnsureOutputInput();
      if (!input) {
        showToast(`vMix input "${vmixState.outputInputName}" not found`);
        return false;
      }
      if (vmixState.outputMode === VMIX_OUTPUT_MODE_OVERLAY) {
        await vmixCallFunction('OverlayInputIn', {
          Input: input.key || input.number || input.title,
          Value: vmixState.overlayChannel || '1'
        });
        showToast(`Sent to Overlay ${vmixState.overlayChannel || '1'}`);
        return true;
      }
      if (vmixState.outputMode === VMIX_OUTPUT_MODE_DEDICATED) {
        const transition = String(vmixState.transition || 'Cut');
        if (transition.toLowerCase() === 'fade') {
          await vmixCallFunction('Fade', {
            Input: input.key || input.number || input.title,
            Duration: 500
          });
          showToast('Sent output live with Fade');
        } else {
          await vmixCallFunction('CutDirect', {
            Input: input.key || input.number || input.title
          });
          showToast('Sent output live with Cut');
        }
        return true;
      }
      showToast('Manual mode leaves show/hide control to the vMix operator');
      return true;
    }

    async function vmixHideOutput() {
      if (!isVmixMode() || !vmixState.enabled) return false;
      if (vmixState.outputMode === VMIX_OUTPUT_MODE_OVERLAY) {
        await vmixCallFunction('OverlayInputOut', {
          Value: vmixState.overlayChannel || '1'
        });
        showToast(`Removed from Overlay ${vmixState.overlayChannel || '1'}`);
        return true;
      }
      if (vmixState.outputMode === VMIX_OUTPUT_MODE_DEDICATED) {
        showToast('Dedicated input mode does not auto-hide because vMix may already be on another shot');
        return true;
      }
      showToast('Manual mode leaves show/hide control to the vMix operator');
      return true;
    }

    async function handleVmixShowAction() {
      try {
        await vmixShowOutput();
      } catch (error) {
        showToast(error && error.message ? error.message : 'Unable to show in vMix');
      }
    }

    async function handleVmixHideAction() {
      try {
        await vmixHideOutput();
      } catch (error) {
        showToast(error && error.message ? error.message : 'Unable to hide in vMix');
      }
    }

    async function vmixAfterProjectLive() {
      if (!isVmixMode() || !vmixState.enabled) return;
      await vmixEnsureOutputInput();
      vmixLastUpdateAt = Date.now();
      updateVmixStatusUi();
      if (vmixState.autoShowOnProject) {
        await vmixShowOutput();
      }
    }

    async function vmixAfterClear() {
      if (!isVmixMode() || !vmixState.enabled) return;
      vmixLastUpdateAt = Date.now();
      updateVmixStatusUi();
      if (vmixState.autoHideOnClear) {
        await vmixHideOutput();
      }
    }

    function applyHostModeUi() {
      document.body.classList.toggle('obs-isolated', isObsMode());
      document.body.classList.toggle('vmix-mode', isVmixMode());
      document.body.classList.toggle('standalone-mode', isStandaloneMode());
      updateVmixStatusUi();
    }

    function setHostMode(mode, opts = {}) {
      hostMode = [HOST_MODE_OBS, HOST_MODE_VMIX, HOST_MODE_STANDALONE].includes(mode) ? mode : HOST_MODE_OBS;
      applyHostModeUi();
      if (!opts.silent) saveToStorageDebounced();
    }

    function updateVmixSettings(patch = {}, opts = {}) {
      vmixState = { ...vmixState, ...patch };
      updateVmixStatusUi();
      if (!opts.silent) saveToStorageDebounced();
    }

    function restoreVmixSettingsUi() {
      const hostModeEl = document.getElementById('host-mode-select');
      const enableEl = document.getElementById('vmix-enable');
      const hostEl = document.getElementById('vmix-host');
      const portEl = document.getElementById('vmix-port');
      const passwordEl = document.getElementById('vmix-password');
      const displayHostEl = document.getElementById('vmix-display-host');
      const outputNameEl = document.getElementById('vmix-output-input-name');
      const outputModeEl = document.getElementById('vmix-output-mode');
      const overlayEl = document.getElementById('vmix-overlay-channel');
      const autoShowEl = document.getElementById('vmix-auto-show');
      const autoHideEl = document.getElementById('vmix-auto-hide');
      const transitionEl = document.getElementById('vmix-transition');
      const reconnectEl = document.getElementById('vmix-reconnect-startup');
      if (hostModeEl) hostModeEl.value = getHostMode();
      if (enableEl) enableEl.checked = !!vmixState.enabled;
      if (hostEl) hostEl.value = vmixState.host || '';
      if (portEl) portEl.value = vmixState.port || '';
      if (passwordEl) passwordEl.value = vmixState.password || '';
      if (displayHostEl) {
        const hosts = localServerInfo?.availableHosts || ['127.0.0.1'];
        displayHostEl.innerHTML = '';
        hosts.forEach((host) => {
          const option = document.createElement('option');
          option.value = host;
          option.textContent = host;
          displayHostEl.appendChild(option);
        });
        if (!hosts.includes(vmixState.displayHost) && vmixState.displayHost) {
          const extra = document.createElement('option');
          extra.value = vmixState.displayHost;
          extra.textContent = vmixState.displayHost;
          displayHostEl.appendChild(extra);
        }
        displayHostEl.value = vmixState.displayHost || localServerInfo?.preferredHost || hosts[0] || '127.0.0.1';
      }
      if (outputNameEl) outputNameEl.value = vmixState.outputInputName || '';
      if (outputModeEl) outputModeEl.value = vmixState.outputMode || VMIX_OUTPUT_MODE_DEDICATED;
      if (overlayEl) overlayEl.value = vmixState.overlayChannel || '1';
      if (autoShowEl) autoShowEl.checked = !!vmixState.autoShowOnProject;
      if (autoHideEl) autoHideEl.checked = !!vmixState.autoHideOnClear;
      if (transitionEl) transitionEl.value = vmixState.transition || 'Cut';
      if (reconnectEl) reconnectEl.checked = vmixState.reconnectOnStartup !== false;
      updateVmixStatusUi();
    }

    function bindVmixSettingsInputs() {
      const hostModeEl = document.getElementById('host-mode-select');
      if (hostModeEl && !hostModeEl.dataset.bound) {
        hostModeEl.dataset.bound = '1';
        hostModeEl.addEventListener('change', () => setHostMode(hostModeEl.value));
      }
      const bindings = [
        ['vmix-enable', (el) => ({ enabled: el.checked })],
        ['vmix-host', (el) => ({ host: el.value.trim() })],
        ['vmix-port', (el) => ({ port: el.value.trim() })],
        ['vmix-password', (el) => ({ password: el.value })],
        ['vmix-display-host', (el) => ({ displayHost: el.value.trim() })],
        ['vmix-output-input-name', (el) => ({ outputInputName: el.value.trim() })],
        ['vmix-output-mode', (el) => ({ outputMode: el.value })],
        ['vmix-overlay-channel', (el) => ({ overlayChannel: el.value })],
        ['vmix-auto-show', (el) => ({ autoShowOnProject: el.checked })],
        ['vmix-auto-hide', (el) => ({ autoHideOnClear: el.checked })],
        ['vmix-transition', (el) => ({ transition: el.value })],
        ['vmix-reconnect-startup', (el) => ({ reconnectOnStartup: el.checked })]
      ];
      bindings.forEach(([id, buildPatch]) => {
        const el = document.getElementById(id);
        if (!el || el.dataset.bound) return;
        el.dataset.bound = '1';
        const eventName = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
        el.addEventListener(eventName, () => updateVmixSettings(buildPatch(el)));
      });
    }


    function getSongBilingualSettings() {
      const ui = appState?.settings || getUiSnapshot();
      return {
        bilingualEnabled: !!ui.songBilingualEnabled,
        displayMode: ['primary', 'stacked', 'translated-only'].includes(ui.songDisplayMode) ? ui.songDisplayMode : DEFAULT_SONG_BILINGUAL_SETTINGS.displayMode,
        translationMode: ['free', 'premium', 'manual'].includes(ui.songTranslationMode) ? ui.songTranslationMode : DEFAULT_SONG_BILINGUAL_SETTINGS.translationMode,
        autoTranslateOnImport: ui.songAutoTranslateOnImport !== false,
        autoTranslateOnOpen: ui.songAutoTranslateOnOpen !== false,
        targetLanguage: String(ui.songTargetLanguage || DEFAULT_SONG_BILINGUAL_SETTINGS.targetLanguage).trim() || DEFAULT_SONG_BILINGUAL_SETTINGS.targetLanguage,
        sourceLanguage: String(ui.songSourceLanguage || DEFAULT_SONG_BILINGUAL_SETTINGS.sourceLanguage).trim() || DEFAULT_SONG_BILINGUAL_SETTINGS.sourceLanguage,
        secondaryFontScale: Math.max(0.4, Math.min(1, parseFloat(ui.songSecondaryFontScale) || DEFAULT_SONG_BILINGUAL_SETTINGS.secondaryFontScale)),
        cacheTranslationsLocally: ui.songCacheTranslationsLocally !== false,
        freeTranslationApiUrl: String(ui.songFreeTranslationApiUrl || DEFAULT_SONG_BILINGUAL_SETTINGS.freeTranslationApiUrl).trim() || DEFAULT_SONG_BILINGUAL_SETTINGS.freeTranslationApiUrl,
        translationApiUrl: String(ui.songTranslationApiUrl || DEFAULT_SONG_BILINGUAL_SETTINGS.translationApiUrl).trim(),
        translationApiKey: String(ui.songTranslationApiKey || DEFAULT_SONG_BILINGUAL_SETTINGS.translationApiKey)
      };
    }

    function populateSongTranslationLanguageOptions() {
      const targetSelect = document.getElementById('song-translation-language');
      const sourceSelect = document.getElementById('song-translation-source-language');
      if (targetSelect && !targetSelect.dataset.populated) {
        const targetOptions = SONG_TRANSLATION_LANGUAGES.filter(lang => lang.code !== 'auto')
          .map(lang => `<option value="${lang.code}">${lang.label}</option>`)
          .join('');
        targetSelect.innerHTML = targetOptions;
        targetSelect.dataset.populated = '1';
      }
      if (sourceSelect && !sourceSelect.dataset.populated) {
        sourceSelect.innerHTML = SONG_TRANSLATION_LANGUAGES
          .map(lang => `<option value="${lang.code}">${lang.label}</option>`)
          .join('');
        sourceSelect.dataset.populated = '1';
      }
    }

    function updateSongTranslationModeUi() {
      const mode = document.getElementById('song-translation-mode')?.value || DEFAULT_SONG_BILINGUAL_SETTINGS.translationMode;
      const freeFields = document.getElementById('song-translation-free-fields');
      const premiumFields = document.getElementById('song-translation-premium-fields');
      if (freeFields) freeFields.style.display = mode === 'free' ? 'flex' : 'none';
      if (premiumFields) premiumFields.style.display = mode === 'premium' ? 'flex' : 'none';
    }

    function handleSongTranslationModeChange() {
      updateSongTranslationModeUi();
      onAnyControlChange();
    }

    function handleSongDisplayModeChange() {
      onAnyControlChange();
      if (isLive && livePointer && livePointer.kind === 'songs') pushLiveUpdate();
    }

    function handleSongSecondaryFontScaleInput() {
      const input = document.getElementById('song-secondary-font-scale');
      if (!input) return;
      const raw = parseFloat(input.value);
      const normalized = Math.max(0.4, Math.min(1, Number.isFinite(raw) ? raw : DEFAULT_SONG_BILINGUAL_SETTINGS.secondaryFontScale));
      if (document.activeElement !== input || input.value === '') {
        input.value = normalized.toFixed(2).replace(/0+$/,'').replace(/\.$/, '');
      }
      if (!appState) appState = buildDefaultAppState();
      if (!appState.settings) appState.settings = getUiSnapshot();
      appState.settings.songSecondaryFontScale = String(normalized);
      saveToStorageDebounced();
      schedulePersistTypography();
      if (isLive && livePointer && livePointer.kind === 'songs') {
        pushLiveUpdate();
      }
    }


    function computeTranslationHash(text, lang) {
      return `${String(lang || '').trim().toLowerCase()}::${normalizeSongLyricsLineBreaks(text || '').trim()}`;
    }

    function normalizeSongTranslationState(song) {
      if (!song || getIsBibleItem(song)) return song;
      const settings = getSongBilingualSettings();
      if (typeof song.translatedLyrics !== 'string') song.translatedLyrics = '';
      if (typeof song.translationLanguage !== 'string' || !song.translationLanguage) {
        song.translationLanguage = settings.targetLanguage;
      }
      if (typeof song.translationStatus !== 'string' || !song.translationStatus) {
        song.translationStatus = 'idle';
      }
      song.translationLocked = !!song.translationLocked;
      song.translatedAt = Number(song.translatedAt || 0);
      const content = String(song.content || song.text || '');
      if (typeof song.translationHash !== 'string' || !song.translationHash) {
        song.translationHash = computeTranslationHash(content, song.translationLanguage);
      }
      return song;
    }

    function markSongTranslationStale(song) {
      if (!song || getIsBibleItem(song)) return;
      if (song.translationLocked) return;
      song.translationStatus = song.translatedLyrics.trim() ? 'stale' : 'idle';
    }

    function songNeedsTranslation(song, lang) {
      if (!song || getIsBibleItem(song)) return false;
      const targetLanguage = String(lang || '').trim() || getSongBilingualSettings().targetLanguage;
      const nextHash = computeTranslationHash(song.content || song.text || '', targetLanguage);
      if (!song.translatedLyrics) return true;
      if ((song.translationLanguage || '') !== targetLanguage) return true;
      return (song.translationHash || '') !== nextHash;
    }

    function getSongTranslationStatusLabel(song) {
      if (!song) return 'Idle';
      const status = String(song.translationStatus || 'idle').toLowerCase();
      if (status === 'ready') return `Ready${song.translationLanguage ? ` (${song.translationLanguage})` : ''}`;
      if (status === 'stale') return 'Translation stale';
      if (status === 'translating') return 'Translating...';
      if (status === 'failed') return 'Translation failed';
      return 'Idle';
    }

    function setSongTranslationProviderStatus(message, tone = 'muted') {
      const el = document.getElementById('song-translation-provider-status');
      if (!el) return;
      el.textContent = String(message || '').trim() || 'Not tested';
      if (tone === 'success') el.style.color = 'var(--success)';
      else if (tone === 'error') el.style.color = 'var(--danger)';
      else if (tone === 'warning') el.style.color = 'var(--warning, #f5c451)';
      else el.style.color = 'var(--text-secondary)';
    }

    function resolveSongTranslationProviderConfig(opts = {}) {
      const settings = getSongBilingualSettings();
      const mode = ['free', 'premium', 'manual'].includes(opts.translationMode)
        ? opts.translationMode
        : settings.translationMode;
      if (mode === 'manual') {
        return {
          mode,
          available: false,
          url: '',
          apiKey: '',
          sourceLanguage: String(opts.sourceLanguage || settings.sourceLanguage || 'auto').trim() || 'auto',
          targetLanguage: String(opts.targetLanguage || settings.targetLanguage || 'fr').trim() || 'fr',
          reason: 'Manual mode does not use a translation provider'
        };
      }
      const url = mode === 'free'
        ? String(opts.translationApiUrl || settings.freeTranslationApiUrl || '').trim()
        : String(opts.translationApiUrl || settings.translationApiUrl || '').trim();
      return {
        mode,
        available: !!url,
        url,
        apiKey: mode === 'premium' ? String(opts.translationApiKey || settings.translationApiKey || '').trim() : '',
        sourceLanguage: String(opts.sourceLanguage || settings.sourceLanguage || 'auto').trim() || 'auto',
        targetLanguage: String(opts.targetLanguage || settings.targetLanguage || 'fr').trim() || 'fr',
        reason: mode === 'free' ? 'Free translation URL is not configured' : 'Premium Translation API URL is not configured'
      };
    }

    function refreshSongTranslationPanel(song = currentItem) {
      const panel = document.getElementById('song-translation-panel');
      const statusEl = document.getElementById('song-translation-status');
      const textarea = document.getElementById('song-translation-editor');
      const bilingualToggle = document.getElementById('song-bilingual-item-enabled');
      const lockToggle = document.getElementById('song-translation-lock');
      if (!panel || !statusEl || !textarea || !bilingualToggle || !lockToggle) return;
      const isSong = !!(song && !getIsBibleItem(song));
      panel.style.display = (isSong && editorMode === 'text') ? 'flex' : 'none';
      if (!isSong) return;
      normalizeSongTranslationState(song);
      statusEl.textContent = getSongTranslationStatusLabel(song);
      textarea.value = song.translatedLyrics || '';
      bilingualToggle.checked = !!getSongBilingualSettings().bilingualEnabled;
      lockToggle.checked = !!song.translationLocked;
    }

    function setGlobalSongBilingualEnabled(enabled) {
      const nextEnabled = !!enabled;
      if (!appState) appState = buildDefaultAppState();
      if (!appState.settings) appState.settings = getUiSnapshot();
      appState.settings.songBilingualEnabled = nextEnabled;
      const settingsToggle = document.getElementById('song-bilingual-enabled');
      if (settingsToggle) settingsToggle.checked = nextEnabled;
      const editorToggle = document.getElementById('song-bilingual-item-enabled');
      if (editorToggle) editorToggle.checked = nextEnabled;
      saveState();
      saveToStorageDebounced();
      refreshSongTranslationPanel(currentItem);
      if (isLive && livePointer && livePointer.kind === 'songs') scheduleLiveUpdate();
      scheduleSidebarQuickActionsRender();
    }

    function setGlobalSongDisplayMode(mode) {
      const nextMode = ['primary', 'stacked', 'translated-only'].includes(mode) ? mode : DEFAULT_SONG_BILINGUAL_SETTINGS.displayMode;
      if (!appState) appState = buildDefaultAppState();
      if (!appState.settings) appState.settings = getUiSnapshot();
      appState.settings.songDisplayMode = nextMode;
      const settingsSelect = document.getElementById('song-display-mode');
      if (settingsSelect) settingsSelect.value = nextMode;
      saveState();
      saveToStorageDebounced();
      if (isLive && livePointer && livePointer.kind === 'songs') scheduleLiveUpdate();
      scheduleSidebarQuickActionsRender();
    }

    function handleSongSecondaryLyricsInput() {
      if (!currentItem || getIsBibleItem(currentItem)) return;
      normalizeSongTranslationState(currentItem);
      currentItem.translatedLyrics = document.getElementById('song-translation-editor')?.value || '';
      currentItem.translationLanguage = getSongBilingualSettings().targetLanguage;
      currentItem.translationHash = computeTranslationHash(currentItem.content || currentItem.text || '', currentItem.translationLanguage);
      currentItem.translationStatus = currentItem.translatedLyrics.trim() ? 'ready' : 'idle';
      currentItem.translatedAt = currentItem.translatedLyrics.trim() ? Date.now() : 0;
      scheduleSongPersist(currentItem);
      saveState();
      saveToStorageDebounced();
      refreshSongTranslationPanel(currentItem);
      if (isLive && livePointer && livePointer.kind === 'songs') pushLiveUpdate();
    }

    function handleSongBilingualToggleChange() {
      setGlobalSongBilingualEnabled(!!document.getElementById('song-bilingual-item-enabled')?.checked);
    }

    function handleSongBilingualSettingsToggle() {
      setGlobalSongBilingualEnabled(!!document.getElementById('song-bilingual-enabled')?.checked);
    }

    function handleSongTranslationLockChange() {
      if (!currentItem || getIsBibleItem(currentItem)) return;
      currentItem.translationLocked = !!document.getElementById('song-translation-lock')?.checked;
      scheduleSongPersist(currentItem);
      saveState();
      saveToStorageDebounced();
      refreshSongTranslationPanel(currentItem);
    }

    function getSongById(songId) {
      return songs.find(song => song && song.id === songId) || null;
    }

    function maskSongTranslationMarkers(text) {
      const markers = [];
      const maskedText = normalizeSongLyricsLineBreaks(text || '').replace(/^(\[[^\]\n]+\]|category\s*:.*)$/gmi, (match) => {
        const token = `__BSP_KEEP_${markers.length}__`;
        markers.push({ token, value: match });
        return token;
      });
      return { maskedText, markers };
    }

    function restoreSongTranslationMarkers(text, markers) {
      let out = String(text || '');
      (Array.isArray(markers) ? markers : []).forEach((marker) => {
        if (!marker || !marker.token) return;
        out = out.split(marker.token).join(marker.value || '');
      });
      return out;
    }

    function splitSongTranslationLines(text) {
      return normalizeSongLyricsLineBreaks(text || '').split('\n');
    }

    function parseGoogleTranslateText(data) {
      if (!Array.isArray(data) || !Array.isArray(data[0])) return '';
      return data[0]
        .map((entry) => (Array.isArray(entry) ? String(entry[0] || '') : ''))
        .join('')
        .trim();
    }

    async function translateTextBlocksFree(text, provider) {
      const { maskedText, markers } = maskSongTranslationMarkers(text);
      const lines = splitSongTranslationLines(maskedText);
      const separator = ' [-] ';
      const query = new URLSearchParams({
        client: 'gtx',
        sl: provider.sourceLanguage || 'auto',
        tl: provider.targetLanguage || 'fr',
        dt: 't',
        q: lines.join(separator)
      });
      const response = await fetch(`${provider.url}?${query.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || `Translation request failed (${response.status})`);
      }
      const data = await response.json();
      const translatedJoined = parseGoogleTranslateText(data);
      if (!translatedJoined) throw new Error('Free translation returned no translated text');
      const translatedLines = translatedJoined.split(/\s\[-\]\s/g);
      const normalized = lines.map((_, index) => translatedLines[index] != null ? translatedLines[index] : '').join('\n');
      return restoreSongTranslationMarkers(normalizeSongLyricsLineBreaks(normalized), markers);
    }

    async function translateTextBlocksPremium(text, provider) {
      const { maskedText, markers } = maskSongTranslationMarkers(text);
      const payload = {
        q: maskedText,
        source: provider.sourceLanguage,
        target: provider.targetLanguage,
        format: 'text'
      };
      const apiKey = provider.apiKey;
      if (apiKey) payload.api_key = apiKey;
      const response = await fetch(provider.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || `Translation request failed (${response.status})`);
      }
      const data = await response.json();
      const translatedText = Array.isArray(data?.translatedText)
        ? data.translatedText.join('\n')
        : String(data?.translatedText || '').trim();
      if (!translatedText) throw new Error('Translation API returned no translated text');
      return restoreSongTranslationMarkers(normalizeSongLyricsLineBreaks(translatedText), markers);
    }

    async function translateTextBlocks(text, targetLanguage, opts = {}) {
      const provider = resolveSongTranslationProviderConfig({ ...opts, targetLanguage });
      if (!provider.available) throw new Error(provider.reason);
      if (provider.mode === 'free') {
        return await translateTextBlocksFree(text, provider);
      }
      return await translateTextBlocksPremium(text, provider);
    }

    async function testSongTranslationProvider() {
      const settings = getSongBilingualSettings();
      const provider = resolveSongTranslationProviderConfig();
      if (provider.mode === 'manual') {
        setSongTranslationProviderStatus('Manual mode selected', 'warning');
        showToast('Manual mode selected');
        return false;
      }
      if (!provider.available) {
        setSongTranslationProviderStatus(provider.reason, 'error');
        showToast(provider.reason);
        return false;
      }
      setSongTranslationProviderStatus('Testing...', 'muted');
      try {
        const sample = await translateTextBlocks('Hello world', settings.targetLanguage, {
          translationMode: provider.mode,
          sourceLanguage: provider.sourceLanguage,
          targetLanguage: provider.targetLanguage,
          translationApiUrl: provider.url,
          translationApiKey: provider.apiKey
        });
        if (!String(sample || '').trim()) {
          throw new Error('Provider returned empty translation');
        }
        setSongTranslationProviderStatus(`${provider.mode === 'free' ? 'Free' : 'Premium'} connected: ${sample}`, 'success');
        showToast(`${provider.mode === 'free' ? 'Free' : 'Premium'} translation provider connected`);
        return true;
      } catch (error) {
        const message = error && error.message ? error.message : 'Connection test failed';
        setSongTranslationProviderStatus(message, 'error');
        showToast(message);
        return false;
      }
    }

    async function translateSong(song, opts = {}) {
      if (!song || getIsBibleItem(song)) return false;
      normalizeSongTranslationState(song);
      const settings = getSongBilingualSettings();
      const lang = String(opts.targetLanguage || settings.targetLanguage || 'fr').trim();
      const userInitiated = !!opts.userInitiated;
      if (song.translationLocked && !opts.force) return false;
      if (!settings.bilingualEnabled && !userInitiated) return false;
      if (settings.translationMode === 'manual' && !userInitiated) return false;
      if (!songNeedsTranslation(song, lang) && !opts.force) {
        song.translationStatus = song.translatedLyrics.trim() ? 'ready' : 'idle';
        refreshSongTranslationPanel(song);
        return true;
      }
      const provider = resolveSongTranslationProviderConfig({ ...opts, targetLanguage: lang });
      if (!provider.available) {
        if (userInitiated || settings.translationMode !== 'manual') {
          song.translationStatus = 'failed';
          refreshSongTranslationPanel(song);
          if (userInitiated) showToast(provider.reason);
        }
        return false;
      }
      song.translationLanguage = lang;
      song.translationStatus = 'translating';
      refreshSongTranslationPanel(song);
      try {
        const translatedLyrics = await translateTextBlocks(song.content || song.text || '', lang, {
          ...opts,
          translationMode: provider.mode,
          translationApiUrl: provider.url,
          translationApiKey: provider.apiKey,
          sourceLanguage: provider.sourceLanguage,
          targetLanguage: provider.targetLanguage
        });
        song.translatedLyrics = translatedLyrics;
        song.translationHash = computeTranslationHash(song.content || song.text || '', lang);
        song.translationStatus = translatedLyrics.trim() ? 'ready' : 'failed';
        song.translatedAt = translatedLyrics.trim() ? Date.now() : 0;
        scheduleSongPersist(song);
        saveState();
        saveToStorageDebounced();
        refreshSongTranslationPanel(song);
        if (isLive && livePointer && livePointer.kind === 'songs') pushLiveUpdate();
        return !!translatedLyrics.trim();
      } catch (error) {
        song.translationStatus = 'failed';
        refreshSongTranslationPanel(song);
        if (userInitiated) {
          showToast(error && error.message ? error.message : 'Translation failed');
        }
        return false;
      }
    }

    function queueSongTranslation(songId, opts = {}) {
      const key = String(songId || '').trim();
      if (!key) return Promise.resolve(false);
      if (songTranslationJobs.has(key)) return songTranslationJobs.get(key);
      const job = Promise.resolve().then(async () => {
        const song = getSongById(key);
        if (!song) return false;
        return await translateSong(song, opts);
      }).finally(() => {
        songTranslationJobs.delete(key);
      });
      songTranslationJobs.set(key, job);
      return job;
    }

    function scheduleSongTranslation(songId, delayMs = 900, opts = {}) {
      const key = String(songId || '').trim();
      if (!key) return;
      const existing = songTranslationTimers.get(key);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        songTranslationTimers.delete(key);
        queueSongTranslation(key, opts);
      }, Math.max(0, Number(delayMs) || 0));
      songTranslationTimers.set(key, timer);
    }

    function handleTranslateCurrentSong() {
      if (!currentItem || getIsBibleItem(currentItem)) return;
      const settings = getSongBilingualSettings();
      if (settings.translationMode === 'manual') {
        setSongTranslationProviderStatus('Manual mode selected', 'warning');
        showToast('Manual mode selected. Enter translated lyrics below.');
        refreshSongTranslationPanel(currentItem);
        return;
      }
      queueSongTranslation(currentItem.id, { userInitiated: true, force: true });
    }

    function refreshCurrentSongTranslation() {
      if (!currentItem || getIsBibleItem(currentItem)) return;
      currentItem.translationStatus = currentItem.translatedLyrics.trim() ? 'stale' : 'idle';
      currentItem.translationHash = '';
      refreshSongTranslationPanel(currentItem);
      queueSongTranslation(currentItem.id, { userInitiated: true, force: true });
    }

    function removeCurrentSongTranslation() {
      if (!currentItem || getIsBibleItem(currentItem)) return;
      normalizeSongTranslationState(currentItem);
      currentItem.translatedLyrics = '';
      currentItem.translationStatus = 'idle';
      currentItem.translatedAt = 0;
      currentItem.translationHash = '';
      scheduleSongPersist(currentItem);
      saveState();
      saveToStorageDebounced();
      refreshSongTranslationPanel(currentItem);
      if (isLive && livePointer && livePointer.kind === 'songs') pushLiveUpdate();
      showToast('Translation removed');
    }

    function maybeTranslateCurrentSongOnOpen() {
      if (!currentItem || getIsBibleItem(currentItem)) return;
      const settings = getSongBilingualSettings();
      if (!settings.bilingualEnabled || !settings.autoTranslateOnOpen) return;
      normalizeSongTranslationState(currentItem);
      if (!currentItem.translationLocked && songNeedsTranslation(currentItem, settings.targetLanguage)) {
        currentItem.translationLanguage = settings.targetLanguage;
        currentItem.translationStatus = currentItem.translatedLyrics.trim() ? 'stale' : 'idle';
        refreshSongTranslationPanel(currentItem);
        queueSongTranslation(currentItem.id);
      }
    }

    function maybeTranslateImportedSong(song) {
      if (!song || getIsBibleItem(song)) return;
      const settings = getSongBilingualSettings();
      if (!settings.bilingualEnabled || !settings.autoTranslateOnImport) return;
      normalizeSongTranslationState(song);
      if (!song.translationLocked && songNeedsTranslation(song, settings.targetLanguage)) {
        queueSongTranslation(song.id);
      }
    }
