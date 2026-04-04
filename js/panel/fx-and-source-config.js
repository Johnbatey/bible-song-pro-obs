    function _fxLabel(type) {
      const found = SOURCE_AUDIO_FX_LIBRARY.find((x) => x.type === type) || SOURCE_VIDEO_FX_LIBRARY.find((x) => x.type === type);
      return found ? found.label : type;
    }

    function _sourceHasActiveFx(src) {
      if (!src || !src.config) return false;

      // Active audio FX: chain has at least one enabled fx and master is not disabled/bypassed.
      let audioActive = false;
      if (_isAudioCapableSourceType(src.type)) {
        _ensureSourceAudioFxDefaults(src);
        const masterEnabled = src.config.fxMasterEnabled !== false;
        const bypass = src.config.fxBypass === true;
        const chain = _normalizeAudioFxStack(src.config.audioFx || []);
        src.config.audioFx = chain;
        audioActive = masterEnabled && !bypass && chain.some((fx) => fx && fx.enabled !== false);
      }

      // Video/other FX compatibility: show badge when common effect arrays contain enabled entries.
      const maybeFxLists = [
        src.config.videoFx,
        src.config.videoEffects,
        src.config.effects,
        src.config.filters
      ];
      const videoActive = maybeFxLists.some((list) => {
        if (!Array.isArray(list) || !list.length) return false;
        return list.some((fx) => {
          if (fx == null) return false;
          if (typeof fx === 'boolean') return fx;
          if (typeof fx === 'string') return fx.trim().length > 0;
          if (typeof fx === 'object') {
            if (Object.prototype.hasOwnProperty.call(fx, 'enabled')) return fx.enabled !== false;
            return true;
          }
          return false;
        });
      });

      return audioActive || videoActive;
    }

    function _sourceFxBadgeHtml(src) {
      return _sourceHasActiveFx(src)
        ? '<span class="sli-fx-state" title="FX enabled">FX</span>'
        : '';
    }

    function _updateSourceListFxLabel(sourceId) {
      const row = document.querySelector(`.source-list-item[data-source-id="${sourceId}"]`);
      if (!row) return;
      const src = _getSourceById(sourceId);
      const active = _sourceHasActiveFx(src);
      const existing = row.querySelector('.sli-fx-state');
      if (active && !existing) {
        const eye = row.querySelector('.sli-eye');
        const badge = document.createElement('span');
        badge.className = 'sli-fx-state';
        badge.title = 'FX enabled';
        badge.textContent = 'FX';
        if (eye) row.insertBefore(badge, eye);
        else row.appendChild(badge);
      } else if (!active && existing) {
        existing.remove();
      }
    }

    function _updateSourceListColorLabel(sourceId) {
      const row = document.querySelector(`.source-list-item[data-source-id="${sourceId}"]`);
      if (!row) return;
      const src = _getSourceById(sourceId);
      if (!src) return;
      const icon = row.querySelector('.sli-icon');
      let dot = row.querySelector('.sli-color-dot');
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'sli-color-dot default';
        if (icon && icon.nextSibling) row.insertBefore(dot, icon.nextSibling);
        else row.insertBefore(dot, row.firstChild);
      }
      const color = _getSourceColorLabel(src);
      if (color) {
        dot.className = 'sli-color-dot';
        dot.style.setProperty('--sli-color', color);
        dot.title = `Layer color: ${color}`;
      } else {
        dot.className = 'sli-color-dot default';
        dot.style.removeProperty('--sli-color');
        dot.title = 'Layer color: Default';
      }
    }

    function _populateFxTypeSelect() {
      const sel = document.getElementById('source-fx-add-type');
      if (!sel) return;
      sel.innerHTML = SOURCE_AUDIO_FX_LIBRARY.map((fx) => `<option value="${fx.type}">${fx.label}</option>`).join('');
    }

    function sourceSetFxMode(mode) {
      _sourceFxMode = mode === 'video' ? 'video' : 'audio';
      closeSourceFxAddPicker();
      // Toggle footer tab active states
      document.querySelectorAll('#source-fx-overlay .source-fx-footer-tab').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-fx-mode') === _sourceFxMode);
      });
      // Toggle body panels
      document.getElementById('source-fx-mode-panel-audio')?.classList.toggle('active', _sourceFxMode === 'audio');
      document.getElementById('source-fx-mode-panel-video')?.classList.toggle('active', _sourceFxMode === 'video');
      // Toggle menu grids
      const audioGrid = document.getElementById('source-fx-menu-grid-audio');
      const videoGrid = document.getElementById('source-fx-menu-grid-video');
      if (audioGrid) audioGrid.style.display = _sourceFxMode === 'audio' ? '' : 'none';
      if (videoGrid) videoGrid.style.display = _sourceFxMode === 'video' ? '' : 'none';
      // Update footer label
      const footerLabel = document.getElementById('source-fx-footer-label');
      if (footerLabel) footerLabel.textContent = _sourceFxMode === 'video' ? 'Video Effects' : 'Audio Effects';
      // Update add button state
      renderSourceFxFooterControls();
      // Render the appropriate panel
      if (_sourceFxMode === 'video') {
        renderVideoFxList();
        renderVideoFxMasterControls();
      } else {
        renderSourceFxList();
        renderSourceFxMasterControls();
      }
    }

    /* ── Video FX menu bar handlers ── */
    function toggleCurrentVideoFxMaster() {
      if (!_editingFxSourceId) return;
      const src = _getSourceById(_editingFxSourceId);
      if (!src || !src.config) return;
      _ensureSourceVideoFxDefaults(src);
      const enableFx = src.config.videoFxMasterEnabled === false;
      if (enableFx) {
        const snap = src.config.videoFxEnabledSnapshot && typeof src.config.videoFxEnabledSnapshot === 'object'
          ? src.config.videoFxEnabledSnapshot : null;
        (src.config.videoFx || []).forEach(fx => {
          if (!fx) return;
          if (snap && Object.prototype.hasOwnProperty.call(snap, fx.id)) fx.enabled = snap[fx.id] !== false;
        });
        delete src.config.videoFxEnabledSnapshot;
        src.config.videoFxMasterEnabled = true;
      } else {
        const snapshot = {};
        (src.config.videoFx || []).forEach(fx => {
          if (!fx) return;
          snapshot[fx.id] = fx.enabled !== false;
          fx.enabled = false;
        });
        src.config.videoFxEnabledSnapshot = snapshot;
        src.config.videoFxMasterEnabled = false;
      }
      renderVideoFxList();
      renderVideoFxMasterControls();
      _applyVideoFxToAllLayers();
      schedulePersistAppState();
    }
    function toggleVideoFxPresetMenu(ev) {
      if (ev) { ev.stopPropagation(); ev.preventDefault(); }
      const src = _getSourceById(_editingFxSourceId);
      if (!src) return;
      // Toggle between FX view and presets view
      const fxPanel = document.getElementById('source-fx-panel-video-fx');
      const presetsPanel = document.getElementById('source-fx-panel-video-presets');
      if (!fxPanel || !presetsPanel) return;
      const showPresets = !presetsPanel.classList.contains('active');
      fxPanel.classList.toggle('active', !showPresets);
      presetsPanel.classList.toggle('active', showPresets);
      if (showPresets) renderVideoFxPresetsList();
    }
    function videoFxPresetNav(dir) {
      const src = _getSourceById(_editingFxSourceId);
      if (!src) return;
      const presets = _allSourceVideoFxPresets();
      if (!presets.length) return;
      // Find current preset index by matching stack types
      const currentTypes = (src.config.videoFx || []).map(fx => fx.type).join(',');
      let curIdx = presets.findIndex(p => (p.stack || []).map(f => f.type).join(',') === currentTypes);
      let nextIdx = curIdx + (dir > 0 ? 1 : -1);
      if (nextIdx < 0) nextIdx = presets.length - 1;
      if (nextIdx >= presets.length) nextIdx = 0;
      loadVideoFxPreset(nextIdx);
      const triggerText = document.getElementById('video-fx-preset-trigger-text');
      if (triggerText) triggerText.textContent = presets[nextIdx].name;
    }

    function setSourceFxTab(tab) {
      const fxActive = tab !== 'presets';
      const src = _getSourceById(_editingFxSourceId);
      if (src && src.config) src.config.fxTab = fxActive ? 'fx' : 'presets';
      document.getElementById('source-fx-tab-btn-fx')?.classList.toggle('active', fxActive);
      document.getElementById('source-fx-tab-btn-presets')?.classList.toggle('active', !fxActive);
      document.getElementById('source-fx-panel-fx')?.classList.toggle('active', fxActive);
      document.getElementById('source-fx-panel-presets')?.classList.toggle('active', !fxActive);
      if (!fxActive) renderSourceFxPresetsList();
    }

    function _pluginFormatShort(fmt) {
      const n = String(fmt || '').toLowerCase();
      if (n === 'vst2') return 'VST2';
      if (n === 'vst3') return 'VST3';
      return String(fmt || 'PLUGIN').toUpperCase();
    }

    function _refreshFxPluginSelect() {
      const sel = document.getElementById('source-fx-add-plugin');
      if (!sel) return;
      const list = (Array.isArray(_systemAudioPluginsCache) ? _systemAudioPluginsCache : [])
        .filter((p) => {
          const f = String(p?.format || '').toLowerCase();
          return f === 'vst3' || f === 'vst2';
        })
        .sort((a, b) => {
          const pa = String(a?.format || '').toLowerCase() === 'vst3' ? 0 : 1;
          const pb = String(b?.format || '').toLowerCase() === 'vst3' ? 0 : 1;
          if (pa !== pb) return pa - pb;
          return String(a?.name || '').localeCompare(String(b?.name || ''));
        });
      if (!list.length) {
        sel.innerHTML = '<option value="">No plugins found</option>';
        return;
      }
      sel.innerHTML = list.map((p) => {
        const id = esc(String(p.id || ''));
        const fmt = _pluginFormatShort(p.format);
        const preferred = String(p?.format || '').toLowerCase() === 'vst3' ? ' (Preferred)' : '';
        const label = esc(`[${fmt}] ${p.name || 'Plugin'}${preferred}`);
        return `<option value="${id}">${label}</option>`;
      }).join('');
    }

    async function refreshAudioPluginHostStatus() {
      try {
        if (window.BSPDesktop && typeof window.BSPDesktop.getAudioPluginHostStatus === 'function') {
          const resp = await window.BSPDesktop.getAudioPluginHostStatus();
          if (resp && resp.ok && resp.host) {
            _audioPluginHostStatus = {
              available: !!resp.host.available,
              executable: String(resp.host.executable || ''),
              reason: String(resp.host.reason || '')
            };
            return;
          }
        }
      } catch (_) {}
      _audioPluginHostStatus = { available: false, executable: '', reason: 'Plugin host status unavailable.' };
    }

    function _pluginFormatLabel(fmt) {
      const f = String(fmt || '').toLowerCase();
      if (f === 'vst2') return 'VST2';
      if (f === 'vst3') return 'VST3';
      return f.toUpperCase();
    }

    function renderSourcePluginFolders() {
      const host = document.getElementById('source-fx-folder-list');
      if (!host) return;
      const rows = [];
      ['vst3', 'vst2'].forEach((fmt) => {
        const items = Array.isArray(_sourcePluginFolders?.[fmt]) ? _sourcePluginFolders[fmt] : [];
        items.forEach((folderPath) => {
          rows.push(`
            <div class="source-fx-folder-row" title="${esc(folderPath)}">
              <span class="source-fx-folder-tag">${_pluginFormatLabel(fmt)}</span>
              <span class="source-fx-folder-path">${esc(folderPath)}</span>
              <button class="source-fx-folder-remove" title="Remove folder" onclick="removeAudioPluginFolder('${fmt}','${esc(folderPath)}')">✕</button>
            </div>
          `);
        });
      });
      if (!rows.length) {
        host.innerHTML = '<div class="source-fx-empty" style="padding:10px 8px;">No custom plugin folders. Add VST3/VST2 folders.</div>';
        return;
      }
      host.innerHTML = rows.join('');
    }

    async function refreshAudioPluginFolders() {
      try {
        if (window.BSPDesktop && typeof window.BSPDesktop.getPluginFolders === 'function') {
          const resp = await window.BSPDesktop.getPluginFolders();
          if (resp && resp.ok && resp.folders) {
            _sourcePluginFolders = {
              vst2: Array.isArray(resp.folders.vst2) ? resp.folders.vst2 : [],
              vst3: Array.isArray(resp.folders.vst3) ? resp.folders.vst3 : []
            };
          }
        }
      } catch (_) {}
      renderSourcePluginFolders();
    }

    async function addAudioPluginFolder(format) {
      try {
        if (!(window.BSPDesktop && typeof window.BSPDesktop.addPluginFolder === 'function')) {
          showToast('Plugin folder management is unavailable in this build.');
          return;
        }
        const resp = await window.BSPDesktop.addPluginFolder({ format: String(format || '').toLowerCase() });
        if (!resp || resp.canceled) return;
        if (!resp.ok) {
          showToast(resp.error || 'Could not add plugin folder.');
          return;
        }
        if (resp.folders) {
          _sourcePluginFolders = {
            vst2: Array.isArray(resp.folders.vst2) ? resp.folders.vst2 : [],
            vst3: Array.isArray(resp.folders.vst3) ? resp.folders.vst3 : []
          };
        }
        if (Array.isArray(resp.plugins)) {
          _systemAudioPluginsCache = resp.plugins.map((p) => ({
            id: String(p.id || ''),
            name: String(p.name || 'Plugin'),
            format: String(p.format || ''),
            path: String(p.path || '')
          }));
          _systemAudioPluginsLoaded = true;
          _systemAudioPluginsLastLoadedAt = Date.now();
          if (resp.host) {
            _audioPluginHostStatus = {
              available: !!resp.host.available,
              executable: String(resp.host.executable || ''),
              reason: String(resp.host.reason || '')
            };
          }
          _refreshFxPluginSelect();
        } else {
          await refreshSystemAudioPlugins();
        }
        renderSourcePluginFolders();
        showToast(`${_pluginFormatLabel(format)} folder added`);
      } catch (e) {
        showToast((e && e.message) ? e.message : 'Could not add plugin folder.');
      }
    }

    async function removeAudioPluginFolder(format, folderPath) {
      try {
        if (!(window.BSPDesktop && typeof window.BSPDesktop.removePluginFolder === 'function')) {
          showToast('Plugin folder management is unavailable in this build.');
          return;
        }
        const resp = await window.BSPDesktop.removePluginFolder({
          format: String(format || '').toLowerCase(),
          folderPath: String(folderPath || '')
        });
        if (!resp || !resp.ok) {
          showToast((resp && resp.error) ? resp.error : 'Could not remove plugin folder.');
          return;
        }
        if (resp.folders) {
          _sourcePluginFolders = {
            vst2: Array.isArray(resp.folders.vst2) ? resp.folders.vst2 : [],
            vst3: Array.isArray(resp.folders.vst3) ? resp.folders.vst3 : []
          };
        }
        if (Array.isArray(resp.plugins)) {
          _systemAudioPluginsCache = resp.plugins.map((p) => ({
            id: String(p.id || ''),
            name: String(p.name || 'Plugin'),
            format: String(p.format || ''),
            path: String(p.path || '')
          }));
          _systemAudioPluginsLoaded = true;
          _systemAudioPluginsLastLoadedAt = Date.now();
          _refreshFxPluginSelect();
        } else {
          await refreshSystemAudioPlugins();
        }
        renderSourcePluginFolders();
      } catch (e) {
        showToast((e && e.message) ? e.message : 'Could not remove plugin folder.');
      }
    }

    function onSourceFxAddTypeChange() {
      const typeSel = document.getElementById('source-fx-add-type');
      const pluginSel = document.getElementById('source-fx-add-plugin');
      if (!typeSel || !pluginSel) return;
      const isPlugin = String(typeSel.value || '') === 'plugin-host';
      pluginSel.style.display = isPlugin ? '' : 'none';
      if (isPlugin && !_systemAudioPluginsLoaded) {
        refreshSystemAudioPlugins();
      }
    }

    async function refreshSystemAudioPlugins() {
      const now = Date.now();
      if (_systemAudioPluginsLoading) return _systemAudioPluginsLoading;
      if (_systemAudioPluginsLoaded && (now - _systemAudioPluginsLastLoadedAt) < 30000) {
        _refreshFxPluginSelect();
        return;
      }
      const pluginSel = document.getElementById('source-fx-add-plugin');
      if (pluginSel) pluginSel.innerHTML = '<option value="">Loading plugins...</option>';
      _systemAudioPluginsLoaded = true;
      _systemAudioPluginsLoading = (async () => {
        try {
        if (window.BSPDesktop && typeof window.BSPDesktop.listAudioPlugins === 'function') {
          const resp = await window.BSPDesktop.listAudioPlugins();
          if (resp && resp.ok && Array.isArray(resp.plugins)) {
            _systemAudioPluginsCache = resp.plugins.map((p) => ({
              id: String(p.id || ''),
                name: String(p.name || 'Plugin'),
                format: String(p.format || ''),
              path: String(p.path || '')
            }));
            if (resp.host) {
              _audioPluginHostStatus = {
                available: !!resp.host.available,
                executable: String(resp.host.executable || ''),
                reason: String(resp.host.reason || '')
              };
            }
            if (resp.folders) {
              _sourcePluginFolders = {
                vst2: Array.isArray(resp.folders.vst2) ? resp.folders.vst2 : [],
                vst3: Array.isArray(resp.folders.vst3) ? resp.folders.vst3 : []
              };
              renderSourcePluginFolders();
            }
          } else {
            _systemAudioPluginsCache = [];
          }
          } else {
            _systemAudioPluginsCache = [];
          }
        } catch (_) {
          _systemAudioPluginsCache = [];
        }
        _systemAudioPluginsLastLoadedAt = Date.now();
        _refreshFxPluginSelect();
      })();
      try {
        await _systemAudioPluginsLoading;
      } finally {
        _systemAudioPluginsLoading = null;
      }
    }

    function applySourceFxPopupPosition() {
      const popup = document.querySelector('#source-fx-overlay .rec-fx-popup');
      if (!popup) return;
      popup.style.setProperty('--source-fx-offset-x', `${Math.round(_sourceFxPopupOffset.x)}px`);
      popup.style.setProperty('--source-fx-offset-y', `${Math.round(_sourceFxPopupOffset.y)}px`);
    }

    function resetSourceFxPopupPosition() {
      _sourceFxPopupOffset.x = 0;
      _sourceFxPopupOffset.y = 0;
      applySourceFxPopupPosition();
    }

    function clampSourceFxPopupOffset(x, y) {
      const popup = document.querySelector('#source-fx-overlay .rec-fx-popup');
      if (!popup) return { x, y };
      const margin = 14;
      const rect = popup.getBoundingClientRect();
      const maxX = Math.max(0, (window.innerWidth - rect.width) / 2 - margin);
      const maxY = Math.max(0, (window.innerHeight - rect.height) / 2 - margin);
      return {
        x: Math.max(-maxX, Math.min(maxX, x)),
        y: Math.max(-maxY, Math.min(maxY, y))
      };
    }

    function bindSourceFxPopupDrag() {
      if (_sourceFxPopupDragBound) return;
      const header = document.querySelector('#source-fx-overlay .rec-fx-header');
      if (!header) return;
      _sourceFxPopupDragBound = true;
      header.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 0) return;
        if (ev.target && ev.target.closest('button,input,select,textarea,a,label')) return;
        const popup = document.querySelector('#source-fx-overlay .rec-fx-popup');
        const overlay = document.getElementById('source-fx-overlay');
        if (!popup || !overlay || !overlay.classList.contains('open')) return;
        _sourceFxPopupDrag.active = true;
        _sourceFxPopupDrag.pointerId = ev.pointerId;
        _sourceFxPopupDrag.startX = ev.clientX;
        _sourceFxPopupDrag.startY = ev.clientY;
        _sourceFxPopupDrag.baseX = _sourceFxPopupOffset.x;
        _sourceFxPopupDrag.baseY = _sourceFxPopupOffset.y;
        try { header.setPointerCapture(ev.pointerId); } catch (_) {}
        ev.preventDefault();
      });
      header.addEventListener('pointermove', (ev) => {
        if (!_sourceFxPopupDrag.active || ev.pointerId !== _sourceFxPopupDrag.pointerId) return;
        const nextX = _sourceFxPopupDrag.baseX + (ev.clientX - _sourceFxPopupDrag.startX);
        const nextY = _sourceFxPopupDrag.baseY + (ev.clientY - _sourceFxPopupDrag.startY);
        const clamped = clampSourceFxPopupOffset(nextX, nextY);
        _sourceFxPopupOffset.x = clamped.x;
        _sourceFxPopupOffset.y = clamped.y;
        applySourceFxPopupPosition();
      });
      const finishDrag = (ev) => {
        if (!_sourceFxPopupDrag.active) return;
        if (ev && _sourceFxPopupDrag.pointerId != null && ev.pointerId !== _sourceFxPopupDrag.pointerId) return;
        try { header.releasePointerCapture(_sourceFxPopupDrag.pointerId); } catch (_) {}
        _sourceFxPopupDrag.active = false;
        _sourceFxPopupDrag.pointerId = null;
      };
      header.addEventListener('pointerup', finishDrag);
      header.addEventListener('pointercancel', finishDrag);
    }

    function openSourceFxPopup(sourceId, ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      const src = _getSourceById(sourceId);
      if (!src) return;
      const isAudioCapable = _isAudioCapableSourceType(src.type);
      if (isAudioCapable) _ensureSourceAudioFxDefaults(src);
      _ensureSourceVideoFxDefaults(src);
      _loadSourceFxUserPresets();
      _loadVideoFxUserPresets();
      _editingFxSourceId = sourceId;
      const sid = String(sourceId || '');
      if (sid && _sourceFxRefreshTimers[sid]) {
        clearTimeout(_sourceFxRefreshTimers[sid]);
        delete _sourceFxRefreshTimers[sid];
      }

      _populateFxTypeSelect();
      // Pure audio sources (audio-input) default to Audio FX tab;
      // video-capable sources (camera, NDI, media, etc.) default to Video FX tab
      const startMode = src.type === 'audio-input' ? 'audio' : 'video';
      sourceSetFxMode(startMode);
      if (isAudioCapable) {
        setSourceFxTab(src.config.fxTab || 'fx');
        renderSourceFxList();
        renderSourceFxPresetsList();
      }
      const overlay = document.getElementById('source-fx-overlay');
      if (overlay) overlay.classList.add('open');
      bindSourceFxPopupDrag();
      resetSourceFxPopupPosition();
      // Defer plugin scan until plugin-host is actually selected to keep FX popup snappy.
      schedulePersistAppState();
    }

    function closeSourceFxPopup() {
      const overlay = document.getElementById('source-fx-overlay');
      if (overlay) overlay.classList.remove('open');
      _editingFxSourceId = '';
      const saveName = document.getElementById('source-fx-save-name');
      if (saveName) saveName.value = '';
      closeSourceFxPresetMenu();
      sourceSetFxMode('audio');
      resetSourceFxPopupPosition();
    }

    function renderSourceFxMasterControls() {
      const masterBtn = document.getElementById('source-fx-master-toggle');
      const bypassBtn = document.getElementById('source-fx-bypass-toggle');
      const powerBtn = document.getElementById('source-fx-power-btn');
      const src = _getSourceById(_editingFxSourceId);
      if (!src || !_isAudioCapableSourceType(src.type)) {
        if (masterBtn) { masterBtn.textContent = 'Disable FX'; masterBtn.classList.remove('active'); }
        if (bypassBtn) bypassBtn.classList.remove('active');
        if (powerBtn) powerBtn.classList.remove('off');
        return;
      }
      _ensureSourceAudioFxDefaults(src);
      const masterEnabled = src.config.fxMasterEnabled !== false;
      if (masterBtn) {
        masterBtn.textContent = masterEnabled ? 'Disable FX' : 'Enable FX';
        masterBtn.classList.toggle('active', !masterEnabled);
      }
      if (powerBtn) powerBtn.classList.toggle('off', !masterEnabled);
      const bypass = src.config.fxBypass === true;
      if (bypassBtn) {
        bypassBtn.classList.toggle('active', bypass);
        bypassBtn.textContent = bypass ? 'Bypass On' : 'Bypass';
      }
    }

    function renderSourceFxFooterControls() {
      const addBtn = document.getElementById('source-fx-footer-add-btn');
      const src = _getSourceById(_editingFxSourceId);
      if (_sourceFxMode === 'video') {
        // Video FX available for any visual source
        if (addBtn) addBtn.disabled = !src;
      } else {
        const isAudioSrc = !!(src && _isAudioCapableSourceType(src.type));
        if (addBtn) addBtn.disabled = !isAudioSrc;
      }
    }

    function renderSourceFxList() {
      const host = document.getElementById('source-fx-list');
      if (!host) return;
      const src = _getSourceById(_editingFxSourceId);
      renderSourceFxMasterControls();
      renderSourceFxFooterControls();
      if (!src || !_isAudioCapableSourceType(src.type)) {
        host.innerHTML = '<div class="source-fx-empty">No audio source selected.</div>';
        const editor = document.getElementById('source-fx-editor');
        if (editor) editor.innerHTML = '<div class="source-fx-empty">Select an audio source first.</div>';
        return;
      }
      const chain = _normalizeAudioFxStack(src.config && src.config.audioFx ? src.config.audioFx : []);
      src.config.audioFx = chain;
      if (!chain.length) {
        host.innerHTML = '<div class="source-fx-empty">No effects in this layer. Add one above.</div>';
        const editor = document.getElementById('source-fx-editor');
        if (editor) editor.innerHTML = '<div class="source-fx-empty">Select an effect to edit parameters.</div>';
        return;
      }
      if (!src.config.fxSelectedId && chain[0]) src.config.fxSelectedId = chain[0].id;
      if (src.config.fxSelectedId && !chain.find((x) => x.id === src.config.fxSelectedId)) src.config.fxSelectedId = chain[0]?.id || '';
      host.innerHTML = chain.map((fx, idx) => `
        <div class="rec-fx-item ${src.config.fxSelectedId === fx.id ? 'active' : ''}" data-fx-id="${fx.id}" data-fx-idx="${idx}" onclick="sourceSelectEffect('${src.id}','${fx.id}')" onpointerdown="_srcFxPointerDown(event)">
          ${sourceFxEnabledEyeSvg(src.id, fx.id, fx.enabled !== false)}
          <div class="rec-fx-item-title">${esc(_fxLabel(fx.type))}</div>
        </div>
      `).join('');
      renderSourceFxFooterControls();
      renderSourceFxEditor();
      /* Sync Pro Mixer if open */
      if (_promixOpen) renderProMixer();
    }

    function sourceFxEnabledEyeSvg(sourceId, fxId, enabled) {
      const isHidden = enabled === false;
      const eyeClass = isHidden ? 'sli-eye hidden' : 'sli-eye';
      const hiddenFlag = isHidden ? '1' : '0';
      const eyeOpacity = isHidden ? 0.52 : 0.82;
      return `<svg class="${eyeClass}" data-hidden="${hiddenFlag}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" onclick="event.stopPropagation();toggleEffectEnabled('${sourceId}','${fxId}')" style="opacity:${eyeOpacity}"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line class="eye-slash" x1="3" y1="21" x2="21" y2="3"/></svg>`;
    }

    function sourceSelectEffect(sourceId, fxId) {
      const src = _getSourceById(sourceId);
      if (!src || !src.config) return;
      src.config.fxSelectedId = String(fxId || '');
      renderSourceFxList();
    }

    let _srcFxDragIdx = -1;
    let _srcFxDragActive = false;
    let _srcFxDragStartY = 0;
    let _srcFxDragCurrentIdx = -1;
    let _srcFxDragItems = [];
    let _srcFxDragItemH = 0;
    let _srcFxDragSuppressClick = false;

    function _srcFxPointerDown(e) {
      if (e.target.closest('.sli-eye')) return;
      const item = e.currentTarget;
      const host = document.getElementById('source-fx-list');
      if (!host) return;
      const idx = parseInt(item.dataset.fxIdx, 10);
      _srcFxDragIdx = idx;
      _srcFxDragCurrentIdx = idx;
      _srcFxDragActive = false;
      _srcFxDragSuppressClick = false;
      _srcFxDragStartY = e.clientY;
      _srcFxDragItems = Array.from(host.querySelectorAll('.rec-fx-item'));
      if (_srcFxDragItems.length > 0) {
        const r = _srcFxDragItems[0].getBoundingClientRect();
        const gap = _srcFxDragItems.length > 1
          ? _srcFxDragItems[1].getBoundingClientRect().top - r.bottom
          : 0;
        _srcFxDragItemH = r.height + gap;
      }
      item.setPointerCapture(e.pointerId);
      item.addEventListener('pointermove', _srcFxPointerMove);
      item.addEventListener('pointerup', _srcFxPointerUp);
      item.addEventListener('pointercancel', _srcFxPointerUp);
    }

    function _srcFxPointerMove(e) {
      const dy = e.clientY - _srcFxDragStartY;
      if (!_srcFxDragActive && Math.abs(dy) < 4) return;
      if (!_srcFxDragActive) {
        _srcFxDragActive = true;
        _srcFxDragSuppressClick = true;
        _srcFxDragItems[_srcFxDragIdx]?.classList.add('sortable-ghost');
      }
      const dragEl = _srcFxDragItems[_srcFxDragIdx];
      if (dragEl) dragEl.style.transform = `translateY(${dy}px)`;
      const items = _srcFxDragItems;
      const fromIdx = _srcFxDragIdx;
      const shift = Math.round(dy / _srcFxDragItemH);
      let toIdx = Math.max(0, Math.min(items.length - 1, fromIdx + shift));
      _srcFxDragCurrentIdx = toIdx;
      items.forEach((el, i) => {
        el.classList.remove('sortable-shift-down', 'sortable-shift-up');
        el.style.setProperty('--sortable-shift', _srcFxDragItemH + 'px');
        if (i === fromIdx) return;
        if (fromIdx < toIdx && i > fromIdx && i <= toIdx) {
          el.classList.add('sortable-shift-up');
        } else if (fromIdx > toIdx && i >= toIdx && i < fromIdx) {
          el.classList.add('sortable-shift-down');
        }
      });
    }

    function _srcFxPointerUp(e) {
      const item = e.currentTarget;
      item.removeEventListener('pointermove', _srcFxPointerMove);
      item.removeEventListener('pointerup', _srcFxPointerUp);
      item.removeEventListener('pointercancel', _srcFxPointerUp);
      const fromIdx = _srcFxDragIdx;
      const toIdx = _srcFxDragCurrentIdx;
      _srcFxDragItems.forEach(el => {
        el.classList.remove('sortable-ghost', 'sortable-shift-down', 'sortable-shift-up');
        el.style.transform = '';
      });
      if (_srcFxDragActive && fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
        const src = _getSourceById(_editingFxSourceId);
        if (src && src.config && Array.isArray(src.config.audioFx)) {
          const arr = src.config.audioFx;
          const [moved] = arr.splice(fromIdx, 1);
          arr.splice(toIdx, 0, moved);
          renderSourceFxList();
          _refreshSourceFxAudio(src.id);
        }
      }
      if (_srcFxDragSuppressClick) {
        item.addEventListener('click', function suppress(ev) {
          ev.stopImmediatePropagation();
          item.removeEventListener('click', suppress, true);
        }, true);
      }
      _srcFxDragIdx = -1;
      _srcFxDragCurrentIdx = -1;
      _srcFxDragActive = false;
      _srcFxDragItems = [];
    }

    function sourceFormatFxParamValue(type, key, value, suffix, transform) {
      const n = Number(value);
      if (!Number.isFinite(n)) return `${value}${suffix || ''}`;
      if (typeof transform === 'function') return String(transform(n));
      if (type === 'pro-denoiser') {
        if (key === 'reduction' || key === 'sensitivity' || key === 'preserve' || key === 'dryMix') return `${Math.round(n)}%`;
        if (key === 'attack' || key === 'release') return `${Math.round(n)}ms`;
        if (key === 'hpf' || key === 'lpf') return `${Math.round(n)}Hz`;
      }
      if ((type === 'compressor' || type === 'pro-compressor' || type === 'limiter' || type === 'expander' || type === 'de-esser') && key === 'ratio') return `${n.toFixed(1)}:1`;
      if (type === 'gain' && key === 'gain') return `${n.toFixed(2)}x`;
      if ((type === 'highpass' || type === 'lowpass' || type === 'lowshelf' || type === 'presence' || type === 'air' || type === 'parametric-eq') && key === 'q') return n.toFixed(2);
      if (key === 'frequency' || key === 'tone' || key === 'damping' || key === 'brightness') return `${Math.round(n)}Hz`;
      if (key === 'mix' || key === 'amount' || key === 'depth' || key === 'width' || key === 'feedback' || key === 'size' || key === 'moddepth') return `${Math.round(n)}%`;
      if (key === 'predelay' || key === 'lookahead') return `${n.toFixed(1)}ms`;
      if (key === 'modrate') return `${n.toFixed(2)}Hz`;
      if (key === 'threshold' || key === 'gain' || key === 'makeup' || key === 'range' || key === 'hysteresis') return `${n.toFixed(1)}dB`;
      if (key === 'attack' || key === 'release' || key === 'decay' || key === 'hold') return `${n.toFixed(3).replace(/0+$/,'').replace(/\.$/,'')}s`;
      if (key === 'time') return `${(n * 1000).toFixed(0)}ms`;
      if (key === 'rate') return `${n.toFixed(1)}Hz`;
      if (key === 'semitones') return `${n > 0 ? '+' : ''}${n.toFixed(0)}st`;
      if (key === 'drive') return `${n.toFixed(1)}dB`;
      if (key === 'stages') return `${Math.round(n)}`;
      if (key === 'shape') return n <= 0.33 ? 'Sine' : n <= 0.66 ? 'Triangle' : 'Square';
      if (key === 'hp_slope' || key === 'lp_slope') return `${Math.round(n)}dB/oct`;
      if (key === 'output_gain') return `${n > 0 ? '+' : ''}${n.toFixed(1)}dB`;
      if (key.endsWith('_on')) return n ? 'On' : 'Off';
      if (key.endsWith('_freq')) return `${Math.round(n)}Hz`;
      if (key.endsWith('_gain')) return `${n > 0 ? '+' : ''}${n.toFixed(1)}dB`;
      if (key.endsWith('_q')) return n.toFixed(2);
      return `${n}${suffix || ''}`;
    }

    function renderSourceFxEditor() {
      const host = document.getElementById('source-fx-editor');
      if (!host) return;
      const src = _getSourceById(_editingFxSourceId);
      if (!src || !src.config || !Array.isArray(src.config.audioFx)) {
        host.innerHTML = '<div class="source-fx-empty">Select an audio source first.</div>';
        return;
      }
      const fx = src.config.audioFx.find((x) => x && x.id === src.config.fxSelectedId);
      if (!fx) {
        host.innerHTML = '<div class="source-fx-empty">Select an effect to edit parameters.</div>';
        return;
      }
      const rows = [];
      const addParam = (key, label, min, max, step, suffix, transform) => {
        const val = Number(fx.params?.[key] ?? min);
        const shown = sourceFormatFxParamValue(fx.type, key, val, suffix, transform);
        rows.push(`
          <div class="rec-fx-param">
            <label>${label}</label>
            <input type="range" min="${min}" max="${max}" step="${step}" value="${val}" oninput="_paintSourceFxSlider(this);setSourceEffectParam('${src.id}','${fx.id}','${key}',this.value)">
            <span id="source-fx-param-val-${fx.id}-${key}">${shown}</span>
          </div>
        `);
      };
      if (fx.type === 'reverb') {
        addParam('mix', 'Mix', 0, 100, 1, '%');
        addParam('decay', 'Decay', 0.2, 6, 0.1, 's');
        addParam('tone', 'Tone', 1200, 12000, 100, 'Hz');
      } else if (fx.type === 'pro-reverb') {
        addParam('mix', 'Mix', 0, 100, 1, '%');
        addParam('decay', 'Decay', 0.3, 12, 0.1, 's');
        addParam('size', 'Size', 5, 100, 1, '%');
        addParam('predelay', 'Pre-Delay', 0, 120, 1, 'ms');
        addParam('damping', 'Damping', 800, 16000, 100, 'Hz');
        addParam('brightness', 'Brightness', 1000, 18000, 100, 'Hz');
        addParam('width', 'Width', 0, 100, 1, '%');
        addParam('modrate', 'Mod Rate', 0.05, 4, 0.05, 'Hz');
        addParam('moddepth', 'Mod Depth', 0, 60, 1, '%');
      } else if (fx.type === 'denoiser') {
        addParam('amount', 'Amount', 0, 100, 1, '%');
      } else if (fx.type === 'pro-denoiser') {
        addParam('reduction', 'Reduce', 0, 100, 1, '%');
        addParam('sensitivity', 'Sensitivity', 0, 100, 1, '%');
        addParam('preserve', 'Voice Keep', 0, 100, 1, '%');
        addParam('attack', 'Attack', 1, 50, 1, 'ms');
        addParam('release', 'Release', 5, 200, 1, 'ms');
        addParam('hpf', 'HP Filter', 20, 500, 1, 'Hz');
        addParam('lpf', 'LP Filter', 4000, 22000, 100, 'Hz');
        addParam('dryMix', 'Dry Mix', 0, 50, 1, '%');
      } else if (fx.type === 'gain') {
        addParam('gain', 'Gain', 0, 2.5, 0.01, 'x');
      } else if (fx.type === 'highpass') {
        addParam('frequency', 'Freq', 20, 600, 1, 'Hz');
        addParam('q', 'Q', 0.2, 2.5, 0.01, '');
      } else if (fx.type === 'lowshelf' || fx.type === 'presence' || fx.type === 'air') {
        addParam('frequency', 'Freq', 60, 12000, 1, 'Hz');
        addParam('gain', 'Gain', -12, 12, 0.1, 'dB');
        addParam('q', 'Q', 0.2, 3.0, 0.01, '');
      } else if (fx.type === 'compressor' || fx.type === 'limiter') {
        addParam('threshold', 'Thresh', -60, 0, 0.1, 'dB');
        addParam('ratio', 'Ratio', 1, 20, 0.1, ':1');
        addParam('attack', 'Attack', 0.001, 0.1, 0.001, 's');
        addParam('release', 'Release', 0.02, 0.5, 0.01, 's');
      } else if (fx.type === 'pro-compressor') {
        addParam('threshold', 'Thresh', -60, 0, 0.1, 'dB');
        addParam('ratio', 'Ratio', 1, 20, 0.1, ':1');
        addParam('attack', 'Attack', 0.001, 0.1, 0.001, 's');
        addParam('release', 'Release', 0.02, 0.8, 0.01, 's');
        addParam('knee', 'Knee', 0, 40, 0.1, 'dB');
        addParam('makeup', 'Makeup', -12, 18, 0.1, 'dB');
        addParam('mix', 'Mix', 0, 100, 0.1, '%');
      } else if (fx.type === 'lowpass') {
        addParam('frequency', 'Freq', 200, 20000, 1, 'Hz');
        addParam('q', 'Q', 0.2, 2.5, 0.01, '');
      } else if (fx.type === 'parametric-eq') {
        addParam('frequency', 'Freq', 20, 20000, 1, 'Hz');
        addParam('gain', 'Gain', -18, 18, 0.1, 'dB');
        addParam('q', 'Q', 0.1, 12, 0.01, '');
      } else if (fx.type === 'de-esser') {
        addParam('frequency', 'Freq', 3000, 12000, 100, 'Hz');
        addParam('threshold', 'Thresh', -50, 0, 0.5, 'dB');
        addParam('ratio', 'Ratio', 1, 20, 0.1, ':1');
        addParam('range', 'Range', 0, 24, 0.5, 'dB');
      } else if (fx.type === 'noise-gate') {
        addParam('threshold', 'Thresh', -80, 0, 0.5, 'dB');
        addParam('range', 'Range', 0, 80, 1, 'dB');
        addParam('attack', 'Attack', 0.0001, 0.05, 0.0001, 's');
        addParam('hold', 'Hold', 0, 0.5, 0.001, 's');
        addParam('release', 'Release', 0.005, 0.5, 0.005, 's');
        addParam('hysteresis', 'Hysteresis', 0, 12, 0.5, 'dB');
        addParam('lookahead', 'Lookahead', 0, 10, 0.1, 'ms');
      } else if (fx.type === 'delay') {
        addParam('time', 'Time', 0.01, 2, 0.01, 'ms');
        addParam('feedback', 'Feedback', 0, 90, 1, '%');
        addParam('mix', 'Mix', 0, 100, 1, '%');
        addParam('tone', 'Tone', 500, 16000, 100, 'Hz');
      } else if (fx.type === 'chorus') {
        addParam('rate', 'Rate', 0.1, 10, 0.1, 'Hz');
        addParam('depth', 'Depth', 0, 20, 0.1, '%');
        addParam('mix', 'Mix', 0, 100, 1, '%');
      } else if (fx.type === 'exciter') {
        addParam('frequency', 'Freq', 1000, 10000, 100, 'Hz');
        addParam('drive', 'Drive', 0, 24, 0.5, 'dB');
        addParam('mix', 'Mix', 0, 100, 1, '%');
      } else if (fx.type === 'stereo-widener') {
        addParam('width', 'Width', 0, 100, 1, '%');
      } else if (fx.type === 'pitch-shifter') {
        addParam('semitones', 'Semitones', -12, 12, 1, 'st');
        addParam('mix', 'Mix', 0, 100, 1, '%');
      } else if (fx.type === 'phaser') {
        addParam('rate', 'Rate', 0.05, 5, 0.05, 'Hz');
        addParam('depth', 'Depth', 0, 100, 1, '%');
        addParam('stages', 'Stages', 2, 12, 2, '');
        addParam('feedback', 'Feedback', 0, 90, 1, '%');
        addParam('mix', 'Mix', 0, 100, 1, '%');
      } else if (fx.type === 'flanger') {
        addParam('rate', 'Rate', 0.05, 5, 0.05, 'Hz');
        addParam('depth', 'Depth', 0, 10, 0.1, '%');
        addParam('feedback', 'Feedback', 0, 95, 1, '%');
        addParam('mix', 'Mix', 0, 100, 1, '%');
      } else if (fx.type === 'tremolo') {
        addParam('rate', 'Rate', 0.5, 20, 0.1, 'Hz');
        addParam('depth', 'Depth', 0, 100, 1, '%');
        addParam('shape', 'Shape', 0, 1, 0.01, '');
      } else if (fx.type === 'distortion') {
        addParam('drive', 'Drive', 0, 40, 0.5, 'dB');
        addParam('tone', 'Tone', 500, 16000, 100, 'Hz');
        addParam('mix', 'Mix', 0, 100, 1, '%');
      } else if (fx.type === 'expander') {
        addParam('threshold', 'Thresh', -80, 0, 0.5, 'dB');
        addParam('ratio', 'Ratio', 1, 10, 0.1, ':1');
        addParam('attack', 'Attack', 0.001, 0.1, 0.001, 's');
        addParam('release', 'Release', 0.02, 0.5, 0.01, 's');
      } else if (fx.type === 'ducking') {
        addParam('threshold', 'Thresh', -60, 0, 0.5, 'dB');
        addParam('amount', 'Amount', 0, 40, 0.5, 'dB');
        addParam('attack', 'Attack', 0.001, 0.1, 0.001, 's');
        addParam('release', 'Release', 0.02, 1.0, 0.01, 's');
      } else if (fx.type === 'channel-eq') {
        addParam('hp_freq', 'HP Freq', 20, 800, 1, 'Hz');
        addParam('hp_slope', 'HP Slope', 6, 48, 6, 'dB/oct');
        addParam('ls_freq', 'Low Freq', 30, 600, 1, 'Hz');
        addParam('ls_gain', 'Low Gain', -24, 24, 0.1, 'dB');
        addParam('lm_freq', 'Lo-Mid Freq', 100, 2000, 1, 'Hz');
        addParam('lm_gain', 'Lo-Mid Gain', -24, 24, 0.1, 'dB');
        addParam('lm_q', 'Lo-Mid Q', 0.1, 12, 0.01, '');
        addParam('m_freq', 'Mid Freq', 400, 6000, 1, 'Hz');
        addParam('m_gain', 'Mid Gain', -24, 24, 0.1, 'dB');
        addParam('m_q', 'Mid Q', 0.1, 12, 0.01, '');
        addParam('hm_freq', 'Hi-Mid Freq', 1000, 12000, 1, 'Hz');
        addParam('hm_gain', 'Hi-Mid Gain', -24, 24, 0.1, 'dB');
        addParam('hm_q', 'Hi-Mid Q', 0.1, 12, 0.01, '');
        addParam('hs_freq', 'High Freq', 2000, 20000, 1, 'Hz');
        addParam('hs_gain', 'High Gain', -24, 24, 0.1, 'dB');
        addParam('lp_freq', 'LP Freq', 1000, 22000, 1, 'Hz');
        addParam('lp_slope', 'LP Slope', 6, 48, 6, 'dB/oct');
        addParam('output_gain', 'Output', -24, 24, 0.1, 'dB');
      }
      host.innerHTML = `<div class="rec-fx-editor-title">${esc(_fxLabel(fx.type))}</div>${rows.join('')}`;
      host.querySelectorAll('input[type="range"]').forEach(s => _paintSourceFxSlider(s));
    }

    function setSourceEffectParam(sourceId, fxId, key, val) {
      const src = _getSourceById(sourceId);
      if (!src || !src.config || !Array.isArray(src.config.audioFx)) return;
      const fx = src.config.audioFx.find((x) => x && x.id === fxId);
      if (!fx) return;
      const num = Number(val);
      const nextVal = Number.isFinite(num) ? num : val;
      fx.params[key] = nextVal;
      const valueEl = document.getElementById(`source-fx-param-val-${fx.id}-${key}`);
      if (valueEl) valueEl.textContent = sourceFormatFxParamValue(fx.type, key, nextVal);
      if (_applySourceFxParamInPlace(sourceId, fx, key, nextVal)) {
        schedulePersistAppState();
        return;
      }
      _scheduleSourceFxRefresh(sourceId);
    }

    function _applySourceFxParamInPlace(sourceId, fx, key, value) {
      const entry = _pgmSources[sourceId];
      if (!entry || !entry.fxRuntime) return false;
      const runtimeNode = entry.fxRuntime[fx.id];
      if (!runtimeNode) return false;
      const ctx = (entry.node && entry.node.context) ? entry.node.context : _pgmAudioCtx;
      return _applyFxParamInPlace(runtimeNode, fx.type, key, value, ctx);
    }

    function _scheduleSourceFxRefresh(sourceId, delayMs = 140) {
      const sid = String(sourceId || '');
      if (!sid) return;
      if (_sourceFxRefreshTimers[sid]) clearTimeout(_sourceFxRefreshTimers[sid]);
      const delay = Math.max(0, Number(delayMs) || 0);
      _sourceFxRefreshTimers[sid] = setTimeout(() => {
        delete _sourceFxRefreshTimers[sid];
        _refreshSourceFxAudio(sid);
      }, delay);
    }

    function _paintSourceFxSlider(el) {
      const min = Number.isFinite(parseFloat(el.min)) ? parseFloat(el.min) : 0;
      const max = Number.isFinite(parseFloat(el.max)) ? parseFloat(el.max) : 100;
      const val = Number.isFinite(parseFloat(el.value)) ? parseFloat(el.value) : 0;
      const pct = max !== min ? ((val - min) / (max - min)) * 100 : 0;
      const thumbW = 18;
      const offset = thumbW / 2 - (pct / 100) * thumbW;
      el.style.background = `linear-gradient(90deg, #0a84ff calc(${pct}% + ${offset}px), rgba(255,255,255,0.12) calc(${pct}% + ${offset}px))`;
    }

    function renderSourceFxPresetsList() {
      const host = document.getElementById('source-fx-presets-list');
      if (!host) return;
      const src = _getSourceById(_editingFxSourceId);
      if (!src || !_isAudioCapableSourceType(src.type)) {
        host.innerHTML = '<div class="source-fx-empty">No audio source selected.</div>';
        return;
      }
      const presets = _allSourceFxPresets();
      if (!presets.length) {
        host.innerHTML = '<div class="source-fx-empty">No presets available.</div>';
        return;
      }
      host.innerHTML = presets.map((p) => `
        <div class="source-fx-preset-row">
          <div class="source-fx-preset-title" title="${esc(p.name)}">${esc(p.name)}</div>
          <span class="source-fx-preset-tag">${p.builtin ? 'Built-in' : 'Custom'}</span>
          <div class="source-fx-preset-actions">
            <button onclick="applySourceFxPreset('${esc(p.id)}')">Load</button>
            ${p.builtin ? '' : `<button onclick="deleteSourceFxPreset('${esc(p.id)}')">Delete</button>`}
          </div>
        </div>
      `).join('');
    }

    function _refreshSourceFxAudio(sourceId) {
      const sid = String(sourceId || '');
      if (!sid) return;
      const srcCfg = _getSourceById(sid)?.config;
      const chain = Array.isArray(srcCfg && srcCfg.audioFx) ? srcCfg.audioFx : [];
      // Ultra-fast swap: minimal anti-click ramp to avoid pops
      const fadeOutTc = 0.002;   // 2ms time-constant — imperceptible
      const swapDelayMs = 5;     // 5ms total swap window
      if (_sourceFxSwapTimers[sid]) {
        clearTimeout(_sourceFxSwapTimers[sid]);
        delete _sourceFxSwapTimers[sid];
      }
      const applySwap = () => {
        _pgmDisconnectSource(sid);
        const stream = _activeStreams[sid];
        if (stream && stream.active && stream.getAudioTracks().length) {
          _pgmConnectSource(sid, stream, { rampIn: true });
        }
        _updateSourceListFxLabel(sid);
        renderControlsPanel();
        _pgmSyncSources();
        schedulePersistAppState();
      };
      const entry = _pgmSources[sid];
      const ctx = (entry && entry.node && entry.node.context) ? entry.node.context : _pgmAudioCtx;
      if (entry && entry.gain && entry.gain.gain && ctx) {
        try {
          const now = ctx.currentTime || 0;
          entry.gain.gain.cancelScheduledValues(now);
          entry.gain.gain.setTargetAtTime(0.0001, now, fadeOutTc);
          _sourceFxSwapTimers[sid] = setTimeout(() => {
            delete _sourceFxSwapTimers[sid];
            applySwap();
          }, swapDelayMs);
          return;
        } catch (_) {}
      }
      applySwap();
    }

    function addEffectToCurrentSource(fxType) {
      const src = _getSourceById(_editingFxSourceId);
      if (!src) return;
      if (!src.config) src.config = {};
      if (!Array.isArray(src.config.audioFx)) src.config.audioFx = [];
      const chosenType = String(fxType || 'compressor');
      src.config.audioFx.push(_makeSourceFxByType(chosenType));
      src.config.fxSelectedId = src.config.audioFx[src.config.audioFx.length - 1]?.id || src.config.fxSelectedId || '';
      renderSourceFxList();
      _refreshSourceFxAudio(src.id);
    }

    function addVideoEffectToCurrentSource(fxType) {
      const src = _getSourceById(_editingFxSourceId);
      if (!src) return;
      if (!src.config) src.config = {};
      if (!Array.isArray(src.config.videoFx)) src.config.videoFx = [];
      const chosenType = String(fxType || 'brightness-contrast');
      const newFx = _makeSourceFxByType(chosenType);
      src.config.videoFx.push(newFx);
      src.config.videoFxSelectedId = newFx.id;
      renderVideoFxList();
      _updateSourceListFxLabel(src.id);
      _applyVideoFxToAllLayers();
      schedulePersistAppState();
      if (typeof showToast === 'function') showToast('Video effect added.');
    }

    /* ── FX Add Picker (popup above + button) ── */
    function toggleSourceFxAddPicker(ev) {
      if (ev) { ev.stopPropagation(); ev.preventDefault(); }
      const picker = document.getElementById('source-fx-add-picker');
      if (!picker) return;
      if (picker.classList.contains('open')) { closeSourceFxAddPicker(); return; }
      const isVideoMode = _sourceFxMode === 'video';
      const fxLibrary = isVideoMode ? SOURCE_VIDEO_FX_LIBRARY : SOURCE_AUDIO_FX_LIBRARY;
      const addHandler = isVideoMode ? 'addVideoEffectToCurrentSource' : 'addEffectToCurrentSource';
      const placeholder = isVideoMode ? 'Search video effects' : 'Search audio effects';
      // Build search bar + list
      let html = `<div class="sfx-add-search-wrap">
        <div class="sfx-add-search-inner">
          <svg class="sfx-add-search-icon" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path d="M8.5 3a5.5 5.5 0 014.383 8.823l4.147 4.147a.75.75 0 01-1.06 1.06l-4.147-4.147A5.5 5.5 0 118.5 3zm0 1.5a4 4 0 100 8 4 4 0 000-8z" fill="currentColor"/>
          </svg>
          <input class="sfx-add-search-input" id="sfx-add-search-input" type="text" placeholder="${esc(placeholder)}" autocomplete="off" spellcheck="false" oninput="_filterSourceFxAddPicker(this.value)">
        </div>
      </div>`;
      html += '<div class="sfx-add-list" id="sfx-add-list">';
      fxLibrary.forEach(fx => {
        html += `<div class="sfx-add-item" data-fxlabel="${esc(fx.label.toLowerCase())}" onclick="${addHandler}('${fx.type}');closeSourceFxAddPicker()">${esc(fx.label)}</div>`;
      });
      html += '</div>';
      picker.innerHTML = html;
      picker.classList.add('open');
      // Focus search input
      setTimeout(() => {
        const inp = document.getElementById('sfx-add-search-input');
        if (inp) inp.focus();
        document.addEventListener('click', _onClickOutsideAddPicker, true);
      }, 0);
    }
    function _filterSourceFxAddPicker(query) {
      const list = document.getElementById('sfx-add-list');
      if (!list) return;
      const q = (query || '').toLowerCase().trim();
      const items = list.querySelectorAll('.sfx-add-item');
      let visible = 0;
      items.forEach(item => {
        const label = item.getAttribute('data-fxlabel') || '';
        const match = !q || label.includes(q);
        item.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      // Show/hide no-results message
      let noRes = list.querySelector('.sfx-add-no-results');
      if (visible === 0) {
        if (!noRes) {
          noRes = document.createElement('div');
          noRes.className = 'sfx-add-no-results';
          list.appendChild(noRes);
        }
        noRes.textContent = 'No effects found';
        noRes.style.display = '';
      } else if (noRes) {
        noRes.style.display = 'none';
      }
    }
    function closeSourceFxAddPicker() {
      const picker = document.getElementById('source-fx-add-picker');
      if (picker) picker.classList.remove('open');
      document.removeEventListener('click', _onClickOutsideAddPicker, true);
    }
    function _onClickOutsideAddPicker(ev) {
      const picker = document.getElementById('source-fx-add-picker');
      if (picker && !picker.contains(ev.target)) {
        closeSourceFxAddPicker();
      }
    }

    /* ═══════════════════════════════════════════════════════════════════════
       VIDEO FX SYSTEM — Rendering, Editing, CSS Filter Pipeline
       ═══════════════════════════════════════════════════════════════════════ */

    /* ── Video FX Master Controls ── */
    function renderVideoFxMasterControls() {
      const powerBtn = document.getElementById('video-fx-power-btn');
      const src = _getSourceById(_editingFxSourceId);
      if (!src) {
        if (powerBtn) powerBtn.classList.remove('off');
        return;
      }
      _ensureSourceVideoFxDefaults(src);
      const masterEnabled = src.config.videoFxMasterEnabled !== false;
      if (powerBtn) powerBtn.classList.toggle('off', !masterEnabled);
    }

    /* ── Video FX List Rendering ── */
    function renderVideoFxList() {
      const host = document.getElementById('video-fx-list');
      if (!host) return;
      const src = _getSourceById(_editingFxSourceId);
      renderVideoFxMasterControls();
      renderSourceFxFooterControls();
      if (!src) {
        host.innerHTML = '<div class="source-fx-empty">No source selected.</div>';
        const editor = document.getElementById('video-fx-editor');
        if (editor) editor.innerHTML = '<div class="source-fx-empty">Select a source first.</div>';
        return;
      }
      _ensureSourceVideoFxDefaults(src);
      const chain = _normalizeVideoFxStack(src.config.videoFx || []);
      src.config.videoFx = chain;
      if (!chain.length) {
        host.innerHTML = '<div class="source-fx-empty">No video effects. Add one below.</div>';
        const editor = document.getElementById('video-fx-editor');
        if (editor) editor.innerHTML = '<div class="source-fx-empty">Select an effect to edit parameters.</div>';
        return;
      }
      if (!src.config.videoFxSelectedId && chain[0]) src.config.videoFxSelectedId = chain[0].id;
      if (src.config.videoFxSelectedId && !chain.find(x => x.id === src.config.videoFxSelectedId)) src.config.videoFxSelectedId = chain[0]?.id || '';
      host.innerHTML = chain.map((fx, idx) => `
        <div class="rec-fx-item ${src.config.videoFxSelectedId === fx.id ? 'active' : ''}" data-fx-id="${fx.id}" data-fx-idx="${idx}" onclick="videoSelectEffect('${src.id}','${fx.id}')" onpointerdown="_videoFxPointerDown(event)">
          ${videoFxEnabledEyeSvg(src.id, fx.id, fx.enabled !== false)}
          <div class="rec-fx-item-title">${esc(_fxLabel(fx.type))}</div>
        </div>
      `).join('');
      renderVideoFxEditor();
    }

    function videoFxEnabledEyeSvg(sourceId, fxId, enabled) {
      const isHidden = enabled === false;
      const eyeClass = isHidden ? 'sli-eye hidden' : 'sli-eye';
      const hiddenFlag = isHidden ? '1' : '0';
      const eyeOpacity = isHidden ? 0.52 : 0.82;
      return `<svg class="${eyeClass}" data-hidden="${hiddenFlag}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" onclick="event.stopPropagation();toggleVideoEffectEnabled('${sourceId}','${fxId}')" style="opacity:${eyeOpacity}"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line class="eye-slash" x1="3" y1="21" x2="21" y2="3"/></svg>`;
    }

    function videoSelectEffect(sourceId, fxId) {
      const src = _getSourceById(sourceId);
      if (!src || !src.config) return;
      src.config.videoFxSelectedId = String(fxId || '');
      renderVideoFxList();
    }

    function toggleVideoEffectEnabled(sourceId, fxId) {
      const src = _getSourceById(sourceId);
      if (!src || !src.config || !Array.isArray(src.config.videoFx)) return;
      const fx = src.config.videoFx.find(x => x && x.id === fxId);
      if (!fx) return;
      fx.enabled = fx.enabled === false;
      _setSourceFxEyeUi(sourceId, fxId, fx.enabled !== false);
      _updateSourceListFxLabel(sourceId);
      _applyVideoFxToAllLayers();
      schedulePersistAppState();
    }

    function removeVideoEffectFromSource(sourceId, fxId) {
      const src = _getSourceById(sourceId);
      if (!src || !src.config || !Array.isArray(src.config.videoFx)) return;
      src.config.videoFx = src.config.videoFx.filter(x => x && x.id !== fxId);
      if (src.config.videoFxSelectedId === fxId) {
        src.config.videoFxSelectedId = src.config.videoFx[0]?.id || '';
      }
      saveState('Delete Video FX');
      renderVideoFxList();
      _updateSourceListFxLabel(sourceId);
      _applyVideoFxToAllLayers();
      schedulePersistAppState();
    }

    /* ── Video FX Drag Reorder ── */
    let _videoFxDragIdx = -1;
    let _videoFxDragActive = false;
    let _videoFxDragStartY = 0;
    let _videoFxDragCurrentIdx = -1;
    let _videoFxDragItems = [];
    let _videoFxDragItemH = 0;
    let _videoFxDragSuppressClick = false;

    function _videoFxPointerDown(e) {
      if (e.target.closest('.sli-eye')) return;
      const item = e.currentTarget;
      const host = document.getElementById('video-fx-list');
      if (!host) return;
      const idx = parseInt(item.dataset.fxIdx, 10);
      _videoFxDragIdx = idx;
      _videoFxDragCurrentIdx = idx;
      _videoFxDragActive = false;
      _videoFxDragSuppressClick = false;
      _videoFxDragStartY = e.clientY;
      _videoFxDragItems = Array.from(host.querySelectorAll('.rec-fx-item'));
      if (_videoFxDragItems.length > 0) {
        const r = _videoFxDragItems[0].getBoundingClientRect();
        const gap = _videoFxDragItems.length > 1
          ? _videoFxDragItems[1].getBoundingClientRect().top - r.bottom : 0;
        _videoFxDragItemH = r.height + gap;
      }
      item.setPointerCapture(e.pointerId);
      item.addEventListener('pointermove', _videoFxPointerMove);
      item.addEventListener('pointerup', _videoFxPointerUp);
      item.addEventListener('pointercancel', _videoFxPointerUp);
    }

    function _videoFxPointerMove(e) {
      const dy = e.clientY - _videoFxDragStartY;
      if (!_videoFxDragActive && Math.abs(dy) < 4) return;
      if (!_videoFxDragActive) {
        _videoFxDragActive = true;
        _videoFxDragSuppressClick = true;
        _videoFxDragItems[_videoFxDragIdx]?.classList.add('sortable-ghost');
      }
      const dragEl = _videoFxDragItems[_videoFxDragIdx];
      if (dragEl) dragEl.style.transform = `translateY(${dy}px)`;
      const items = _videoFxDragItems;
      const fromIdx = _videoFxDragIdx;
      const shift = Math.round(dy / _videoFxDragItemH);
      let toIdx = Math.max(0, Math.min(items.length - 1, fromIdx + shift));
      _videoFxDragCurrentIdx = toIdx;
      items.forEach((el, i) => {
        el.classList.remove('sortable-shift-down', 'sortable-shift-up');
        el.style.setProperty('--sortable-shift', _videoFxDragItemH + 'px');
        if (i === fromIdx) return;
        if (fromIdx < toIdx && i > fromIdx && i <= toIdx) el.classList.add('sortable-shift-up');
        else if (fromIdx > toIdx && i >= toIdx && i < fromIdx) el.classList.add('sortable-shift-down');
      });
    }

    function _videoFxPointerUp(e) {
      const item = e.currentTarget;
      item.removeEventListener('pointermove', _videoFxPointerMove);
      item.removeEventListener('pointerup', _videoFxPointerUp);
      item.removeEventListener('pointercancel', _videoFxPointerUp);
      const fromIdx = _videoFxDragIdx;
      const toIdx = _videoFxDragCurrentIdx;
      _videoFxDragItems.forEach(el => {
        el.classList.remove('sortable-ghost', 'sortable-shift-down', 'sortable-shift-up');
        el.style.transform = '';
      });
      if (_videoFxDragActive && fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
        const src = _getSourceById(_editingFxSourceId);
        if (src && src.config && Array.isArray(src.config.videoFx)) {
          const arr = src.config.videoFx;
          const [moved] = arr.splice(fromIdx, 1);
          arr.splice(toIdx, 0, moved);
          renderVideoFxList();
          _applyVideoFxToAllLayers();
        }
      }
      if (_videoFxDragSuppressClick) {
        item.addEventListener('click', function suppress(ev) {
          ev.stopImmediatePropagation();
          item.removeEventListener('click', suppress, true);
        }, true);
      }
      _videoFxDragIdx = -1;
      _videoFxDragCurrentIdx = -1;
      _videoFxDragActive = false;
      _videoFxDragItems = [];
    }

    /* ── Video FX Editor ── */
    function videoFormatFxParamValue(type, key, value) {
      const _LUT_PRESET_LABELS = {
        'none': 'None',
        'vintage': 'Vintage',
        'teal-orange': 'Teal & Orange',
        'faded-film': 'Faded Film',
        'high-contrast': 'High Contrast',
        'muted': 'Muted',
        'custom': 'Custom LUT'
      };
      const _normalizeLutPresetKey = (v) => {
        const map = ['none', 'vintage', 'teal-orange', 'faded-film', 'high-contrast', 'muted'];
        if (typeof v === 'number' && Number.isFinite(v)) return map[Math.round(v)] || 'none';
        const s = String(v ?? '').trim().toLowerCase();
        if (!s) return 'none';
        if (/^-?\d+$/.test(s)) return map[Math.round(Number(s))] || 'none';
        if (_LUT_PRESET_LABELS[s]) return s;
        return 'none';
      };
      if (key === 'preset') {
        const k = _normalizeLutPresetKey(value);
        return _LUT_PRESET_LABELS[k] || String(value);
      }
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value);
      if (key === 'brightness' || key === 'contrast' || key === 'temperature' || key === 'tint') return `${n > 0 ? '+' : ''}${Math.round(n)}`;
      if (key === 'saturation') return `${Math.round(n)}%`;
      if (key === 'hue') return `${n > 0 ? '+' : ''}${Math.round(n)}°`;
      if (key === 'amount' || key === 'strength' || key === 'intensity' || key === 'size' || key === 'roundness') return `${Math.round(n)}%`;
      if (key === 'gamma') return n.toFixed(2);
      if (key === 'radius') return `${n.toFixed(1)}px`;
      return String(n);
    }

    function renderVideoFxEditor() {
      const host = document.getElementById('video-fx-editor');
      if (!host) return;
      const src = _getSourceById(_editingFxSourceId);
      if (!src || !src.config || !Array.isArray(src.config.videoFx)) {
        host.innerHTML = '<div class="source-fx-empty">Select a source first.</div>';
        return;
      }
      const fx = src.config.videoFx.find(x => x && x.id === src.config.videoFxSelectedId);
      if (!fx) {
        host.innerHTML = '<div class="source-fx-empty">Select an effect to edit parameters.</div>';
        return;
      }
      const rows = [];
      const addParam = (key, label, min, max, step) => {
        const val = Number(fx.params?.[key] ?? min);
        const shown = videoFormatFxParamValue(fx.type, key, val);
        rows.push(`
          <div class="rec-fx-param">
            <label>${label}</label>
            <input type="range" min="${min}" max="${max}" step="${step}" value="${val}" oninput="_paintSourceFxSlider(this);setVideoEffectParam('${src.id}','${fx.id}','${key}',this.value)">
            <span id="video-fx-param-val-${fx.id}-${key}">${shown}</span>
          </div>
        `);
      };
      if (fx.type === 'brightness-contrast') {
        addParam('brightness', 'Brightness', -100, 100, 1);
        addParam('contrast', 'Contrast', -100, 100, 1);
      } else if (fx.type === 'saturation') {
        addParam('saturation', 'Saturation', 0, 200, 1);
      } else if (fx.type === 'hue-shift') {
        addParam('hue', 'Hue', -180, 180, 1);
      } else if (fx.type === 'temperature') {
        addParam('temperature', 'Temperature', -100, 100, 1);
        addParam('tint', 'Tint', -100, 100, 1);
      } else if (fx.type === 'sharpness') {
        addParam('amount', 'Amount', 0, 100, 1);
        addParam('radius', 'Radius', 0.1, 3.0, 0.1);
      } else if (fx.type === 'denoise-video') {
        addParam('strength', 'Strength', 0, 100, 1);
      } else if (fx.type === 'gamma') {
        addParam('gamma', 'Gamma', 0.2, 3.0, 0.01);
      } else if (fx.type === 'vignette') {
        addParam('amount', 'Amount', 0, 100, 1);
        addParam('size', 'Size', 0, 100, 1);
        addParam('roundness', 'Roundness', 0, 100, 1);
      } else if (fx.type === 'blur') {
        addParam('radius', 'Radius', 0, 50, 0.1);
      } else if (fx.type === 'lut') {
        const LUT_PRESETS = [
          { value: 'none', label: 'None' },
          { value: 'vintage', label: 'Vintage' },
          { value: 'teal-orange', label: 'Teal & Orange' },
          { value: 'faded-film', label: 'Faded Film' },
          { value: 'high-contrast', label: 'High Contrast' },
          { value: 'muted', label: 'Muted' },
          { value: 'custom', label: 'Custom LUT' }
        ];
        const normalizeLutPresetKey = (v) => {
          const map = ['none', 'vintage', 'teal-orange', 'faded-film', 'high-contrast', 'muted'];
          if (typeof v === 'number' && Number.isFinite(v)) return map[Math.round(v)] || 'none';
          const s = String(v ?? '').trim().toLowerCase();
          if (!s) return 'none';
          if (/^-?\d+$/.test(s)) return map[Math.round(Number(s))] || 'none';
          return LUT_PRESETS.some((x) => x.value === s) ? s : 'none';
        };
        const presetKey = normalizeLutPresetKey(fx.params?.preset);
        rows.push(`
          <div class="rec-fx-param">
            <label>Preset</label>
            <select class="rec-fx-select" onchange="setVideoEffectParam('${src.id}','${fx.id}','preset',this.value)">
              ${LUT_PRESETS.map(p => `<option value="${p.value}" ${p.value === presetKey ? 'selected' : ''}>${p.label}</option>`).join('')}
            </select>
            <span id="video-fx-param-val-${fx.id}-preset">${LUT_PRESETS.find(p => p.value === presetKey)?.label || 'None'}</span>
          </div>
        `);
        if (presetKey === 'custom') {
          const customName = String(fx.params?.customLutName || '').trim();
          rows.push(`
            <div class="rec-fx-param">
              <label>Custom LUT File</label>
              <div style="display:flex;gap:8px;align-items:center">
                <button type="button" class="rec-fx-btn secondary" onclick="triggerVideoFxLutFilePicker('${src.id}','${fx.id}')">Import LUT from Storage</button>
                <input type="file" id="video-fx-lut-file-${fx.id}" accept=".cube,.3dl,.look,.lut,text/plain,application/octet-stream" style="display:none" onchange="handleVideoFxLutFileSelected('${src.id}','${fx.id}',this)">
                <span style="font-size:11px;color:var(--text-secondary)">${customName ? esc(customName) : 'No file selected'}</span>
              </div>
            </div>
          `);
        }
        addParam('intensity', 'Intensity', 0, 100, 1);
      }
      host.innerHTML = `<div class="rec-fx-editor-title">${esc(_fxLabel(fx.type))}<span class="video-fx-delete-btn" onclick="removeVideoEffectFromSource('${src.id}','${fx.id}')" title="Remove effect">✕</span></div>${rows.join('')}`;
      host.querySelectorAll('input[type="range"]').forEach(s => _paintSourceFxSlider(s));
    }

    function setVideoEffectParam(sourceId, fxId, key, val) {
      const src = _getSourceById(sourceId);
      if (!src || !src.config || !Array.isArray(src.config.videoFx)) return;
      const fx = src.config.videoFx.find(x => x && x.id === fxId);
      if (!fx) return;
      let nextVal = val;
      if (!(fx.type === 'lut' && key === 'preset')) {
        const num = Number(val);
        nextVal = Number.isFinite(num) ? num : val;
      }
      fx.params[key] = nextVal;
      const valueEl = document.getElementById(`video-fx-param-val-${fx.id}-${key}`);
      if (valueEl) valueEl.textContent = videoFormatFxParamValue(fx.type, key, nextVal);
      if (fx.type === 'lut' && key === 'preset') {
        if (String(nextVal) !== 'custom') {
          delete fx.params.customLutName;
          delete fx.params.customLutData;
          delete fx.params.customLutMime;
        }
        renderVideoFxEditor();
      }
      _applyVideoFxToAllLayers();
      schedulePersistAppState();
    }

    function triggerVideoFxLutFilePicker(sourceId, fxId) {
      const input = document.getElementById(`video-fx-lut-file-${fxId}`);
      if (input && typeof input.click === 'function') input.click();
    }

    function handleVideoFxLutFileSelected(sourceId, fxId, inputEl) {
      const src = _getSourceById(sourceId);
      if (!src || !src.config || !Array.isArray(src.config.videoFx)) return;
      const fx = src.config.videoFx.find(x => x && x.id === fxId);
      if (!fx || fx.type !== 'lut') return;
      const file = inputEl && inputEl.files && inputEl.files[0] ? inputEl.files[0] : null;
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const lutText = _decodeLutDataUrl(String(reader.result || ''));
        const parsed = _parseCustomLutText(lutText, file.name || '');
        if (!parsed) {
          if (typeof showToast === 'function') showToast('Unsupported or invalid LUT file.');
          return;
        }
        fx.params = fx.params || {};
        fx.params.preset = 'custom';
        fx.params.customLutName = file.name || 'custom.lut';
        fx.params.customLutData = String(reader.result || '');
        fx.params.customLutMime = file.type || 'application/octet-stream';
        renderVideoFxEditor();
        _applyVideoFxToAllLayers();
        schedulePersistAppState();
        if (typeof showToast === 'function') showToast('Custom LUT imported.');
      };
      reader.onerror = () => {
        if (typeof showToast === 'function') showToast('Failed to import LUT file.');
      };
      reader.readAsDataURL(file);
    }

    /* ── SVG Sharpen Filter Helpers ── */
    /** Ensure hidden SVG container for sharpen filter defs exists in the DOM */
    function _ensureSharpenSvgContainer() {
      let svg = document.getElementById('bsp-sharpen-svg');
      if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'bsp-sharpen-svg';
        svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none');
        svg.setAttribute('aria-hidden', 'true');
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svg.appendChild(defs);
        document.body.appendChild(svg);
      }
      return svg.querySelector('defs') || svg;
    }

    /**
     * Create or update an SVG <filter> using a true Unsharp Mask (USM).
     *
     * USM formula:  output = (1 + strength) * original − strength * blurred
     *   where strength = amount / 100
     *         radius   = Gaussian blur stdDeviation (controls detail grain)
     *
     * This is implemented via:
     *   feGaussianBlur → blurred copy
     *   feComposite arithmetic k1=0 k2=(1+s) k3=(-s) k4=0
     *     → k2·original + k3·blurred = original + s·(original − blurred)
     */
    function _ensureSharpenFilter(filterId, amount, radius) {
      const defs = _ensureSharpenSvgContainer();
      const s = Math.max(0, Math.min(3, amount / 100));
      const r = Math.max(0.1, Math.min(5, radius || 1.0));
      const k2 = (1 + s).toFixed(4);
      const k3 = (-s).toFixed(4);
      let filterEl = document.getElementById(filterId);
      if (!filterEl) {
        filterEl = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filterEl.id = filterId;
        filterEl.setAttribute('color-interpolation-filters', 'sRGB');
        const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
        blur.setAttribute('in', 'SourceGraphic');
        blur.setAttribute('stdDeviation', r.toFixed(2));
        blur.setAttribute('result', 'blur');
        filterEl.appendChild(blur);
        const comp = document.createElementNS('http://www.w3.org/2000/svg', 'feComposite');
        comp.setAttribute('in', 'SourceGraphic');
        comp.setAttribute('in2', 'blur');
        comp.setAttribute('operator', 'arithmetic');
        comp.setAttribute('k1', '0');
        comp.setAttribute('k2', k2);
        comp.setAttribute('k3', k3);
        comp.setAttribute('k4', '0');
        filterEl.appendChild(comp);
        defs.appendChild(filterEl);
      } else {
        const blur = filterEl.querySelector('feGaussianBlur');
        if (blur) blur.setAttribute('stdDeviation', r.toFixed(2));
        const comp = filterEl.querySelector('feComposite');
        if (comp) {
          comp.setAttribute('k2', k2);
          comp.setAttribute('k3', k3);
        }
      }
      return filterId;
    }

    /** Remove sharpen filters no longer referenced */
    function _cleanupSharpenFilters(activeIds) {
      const defs = document.getElementById('bsp-sharpen-svg');
      if (!defs) return;
      const allFilters = defs.querySelectorAll('filter[id^="bsp-sharpen-"]');
      allFilters.forEach(f => {
        if (!activeIds.has(f.id)) f.remove();
      });
    }

    /* ── Custom LUT (.cube/.3dl) Parsing & SVG Filter ── */
    function _clamp01(v) {
      return Math.max(0, Math.min(1, Number(v) || 0));
    }

    function _normalizeLutData(data) {
      if (!Array.isArray(data) || !data.length) return data;
      let min = Infinity;
      let max = -Infinity;
      data.forEach((row) => {
        if (!Array.isArray(row) || row.length < 3) return;
        const r = Number(row[0]);
        const g = Number(row[1]);
        const b = Number(row[2]);
        if (Number.isFinite(r)) { min = Math.min(min, r); max = Math.max(max, r); }
        if (Number.isFinite(g)) { min = Math.min(min, g); max = Math.max(max, g); }
        if (Number.isFinite(b)) { min = Math.min(min, b); max = Math.max(max, b); }
      });
      if (!Number.isFinite(min) || !Number.isFinite(max)) return data;
      if (min >= 0 && max <= 1) return data.map((row) => [_clamp01(row[0]), _clamp01(row[1]), _clamp01(row[2])]);
      if (max <= min) return data.map(() => [0, 0, 0]);
      const scale = 1 / (max - min);
      return data.map((row) => [
        _clamp01((Number(row[0]) - min) * scale),
        _clamp01((Number(row[1]) - min) * scale),
        _clamp01((Number(row[2]) - min) * scale)
      ]);
    }

    function _parseCubeLutText(text) {
      if (!text || typeof text !== 'string') return null;
      const lines = text.split(/\r?\n/);
      let size = 0;
      let is3D = false;
      const data = [];
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const upper = line.toUpperCase();
        if (upper.startsWith('TITLE') || upper.startsWith('DOMAIN_MIN') || upper.startsWith('DOMAIN_MAX')) continue;
        if (upper.startsWith('LUT_3D_SIZE')) {
          size = parseInt(line.split(/\s+/)[1], 10) || 0;
          is3D = true;
          continue;
        }
        if (upper.startsWith('LUT_1D_SIZE')) {
          size = parseInt(line.split(/\s+/)[1], 10) || 0;
          is3D = false;
          continue;
        }
        const parts = line.split(/\s+/).map(Number).filter(Number.isFinite);
        if (parts.length >= 3) data.push([parts[0], parts[1], parts[2]]);
      }
      if (!size || !data.length) return null;
      const expected = is3D ? (size * size * size) : size;
      if (data.length < expected) return null;
      return { size, is3D, data: _normalizeLutData(data.slice(0, expected)) };
    }

    function _parse3dlLutText(text) {
      if (!text || typeof text !== 'string') return null;
      const lines = text.split(/\r?\n/);
      let size = 0;
      const data = [];
      let consumedGridHeader = false;
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#') || line.startsWith('//') || line.startsWith(';')) continue;
        const parts = line.split(/\s+/).map(Number).filter(Number.isFinite);
        if (!parts.length) continue;
        if (!consumedGridHeader && parts.length > 3) {
          size = parts.length;
          consumedGridHeader = true;
          continue;
        }
        if (parts.length >= 3) {
          consumedGridHeader = true;
          data.push([parts[0], parts[1], parts[2]]);
        }
      }
      if (!data.length) return null;
      if (!size) {
        const inferred = Math.round(Math.cbrt(data.length));
        if (inferred > 1 && inferred * inferred * inferred === data.length) size = inferred;
      }
      if (!size) return null;
      const expected = size * size * size;
      if (data.length < expected) return null;
      return { size, is3D: true, data: _normalizeLutData(data.slice(0, expected)) };
    }

    function _parseCustomLutText(text, fileName) {
      const name = String(fileName || '').trim().toLowerCase();
      if (name.endsWith('.3dl')) return _parse3dlLutText(text) || _parseCubeLutText(text);
      return _parseCubeLutText(text) || _parse3dlLutText(text);
    }

    /**
     * Decode DataURL to text for .cube file parsing.
     */
    function _decodeLutDataUrl(dataUrl) {
      if (!dataUrl || typeof dataUrl !== 'string') return '';
      try {
        if (dataUrl.startsWith('data:')) {
          const commaIdx = dataUrl.indexOf(',');
          if (commaIdx < 0) return '';
          const meta = dataUrl.substring(0, commaIdx);
          const payload = dataUrl.substring(commaIdx + 1);
          if (meta.includes(';base64')) return atob(payload);
          return decodeURIComponent(payload);
        }
        return dataUrl;
      } catch (e) { return ''; }
    }

    /**
     * Sample a 3D LUT at a given (r,g,b) input (0-1 range) using trilinear interpolation.
     */
    function _sampleLut3D(lut, r, g, b) {
      const n = lut.size;
      const d = lut.data;
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      const maxIdx = n - 1;
      const rIdx = clamp(r * maxIdx, 0, maxIdx);
      const gIdx = clamp(g * maxIdx, 0, maxIdx);
      const bIdx = clamp(b * maxIdx, 0, maxIdx);
      const r0 = Math.floor(rIdx), r1 = Math.min(r0 + 1, maxIdx), rf = rIdx - r0;
      const g0 = Math.floor(gIdx), g1 = Math.min(g0 + 1, maxIdx), gf = gIdx - g0;
      const b0 = Math.floor(bIdx), b1 = Math.min(b0 + 1, maxIdx), bf = bIdx - b0;
      const idx = (ri, gi, bi) => ri + gi * n + bi * n * n;
      const lerp = (a, b, t) => [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
      const c000 = d[idx(r0, g0, b0)] || [0,0,0];
      const c100 = d[idx(r1, g0, b0)] || [0,0,0];
      const c010 = d[idx(r0, g1, b0)] || [0,0,0];
      const c110 = d[idx(r1, g1, b0)] || [0,0,0];
      const c001 = d[idx(r0, g0, b1)] || [0,0,0];
      const c101 = d[idx(r1, g0, b1)] || [0,0,0];
      const c011 = d[idx(r0, g1, b1)] || [0,0,0];
      const c111 = d[idx(r1, g1, b1)] || [0,0,0];
      const c00 = lerp(c000, c100, rf);
      const c10 = lerp(c010, c110, rf);
      const c01 = lerp(c001, c101, rf);
      const c11 = lerp(c011, c111, rf);
      const c0 = lerp(c00, c10, gf);
      const c1 = lerp(c01, c11, gf);
      return lerp(c0, c1, bf);
    }

    /**
     * Build an feColorMatrix from a parsed .cube LUT by sampling identity colors.
     * This is an approximation — it derives a linear color matrix from how the
     * LUT transforms the primary colors and neutral axis.
     */
    function _lutToColorMatrix(lut, intensity) {
      if (!lut || !lut.data || !lut.data.length) return null;
      const sample = lut.is3D
        ? (r, g, b) => _sampleLut3D(lut, r, g, b)
        : (r, g, b) => {
            const n = lut.size;
            const d = lut.data;
            const ri = Math.min(Math.round(r * (n - 1)), n - 1);
            const gi = Math.min(Math.round(g * (n - 1)), n - 1);
            const bi = Math.min(Math.round(b * (n - 1)), n - 1);
            return [d[ri][0], d[gi][1], d[bi][2]];
          };
      const fitAffine = (ch) => {
        const points = [
          [0,0,0], [1,0,0], [0,1,0], [0,0,1],
          [1,1,0], [1,0,1], [0,1,1], [1,1,1],
          [0.5,0,0], [0,0.5,0], [0,0,0.5], [0.5,0.5,0.5]
        ];
        const m = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
        const v = [0,0,0,0];
        points.forEach((p) => {
          const x = [p[0], p[1], p[2], 1];
          const y = _clamp01(sample(p[0], p[1], p[2])[ch]);
          for (let i = 0; i < 4; i += 1) {
            v[i] += x[i] * y;
            for (let j = 0; j < 4; j += 1) m[i][j] += x[i] * x[j];
          }
        });
        /* Solve 4x4 system with Gauss-Jordan elimination. */
        const a = m.map((row, i) => [row[0], row[1], row[2], row[3], v[i]]);
        for (let col = 0; col < 4; col += 1) {
          let pivot = col;
          for (let r = col + 1; r < 4; r += 1) {
            if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
          }
          if (Math.abs(a[pivot][col]) < 1e-9) return [0, 0, 0, 0];
          if (pivot !== col) {
            const tmp = a[col];
            a[col] = a[pivot];
            a[pivot] = tmp;
          }
          const d = a[col][col];
          for (let k = col; k < 5; k += 1) a[col][k] /= d;
          for (let r = 0; r < 4; r += 1) {
            if (r === col) continue;
            const f = a[r][col];
            for (let k = col; k < 5; k += 1) a[r][k] -= f * a[col][k];
          }
        }
        return [a[0][4], a[1][4], a[2][4], a[3][4]];
      };
      const rr = fitAffine(0);
      const gg = fitAffine(1);
      const bb = fitAffine(2);
      const t = Math.max(0, Math.min(1, intensity));
      const mix = (lutVal, identityVal) => identityVal + (lutVal - identityVal) * t;
      /* Build 4x5 matrix: [Rr Rg Rb Ra Ro   Gr Gg Gb Ga Go   Br Bg Bb Ba Bo   Ar Ag Ab Aa Ao] */
      const m = [
        mix(rr[0], 1), mix(rr[1], 0), mix(rr[2], 0), 0, mix(rr[3], 0),
        mix(gg[0], 0), mix(gg[1], 1), mix(gg[2], 0), 0, mix(gg[3], 0),
        mix(bb[0], 0), mix(bb[1], 0), mix(bb[2], 1), 0, mix(bb[3], 0),
        0, 0, 0, 1, 0
      ];
      return m.map(v => v.toFixed(4)).join(' ');
    }

    /** Cache for parsed LUT data to avoid re-parsing on every render */
    const _lutParseCache = new Map();

    /**
     * Ensure an SVG <filter> element exists for a custom LUT and return its ID.
     */
    function _ensureCustomLutFilter(fxId, lutDataUrl, intensity, lutName) {
      const filterId = 'bsp-lut-' + fxId;
      /* Check cache */
      const cacheKey = String(lutName || '') + '::' + String(lutDataUrl || '');
      let lut = _lutParseCache.get(cacheKey);
      if (!lut) {
        const text = _decodeLutDataUrl(lutDataUrl);
        lut = _parseCustomLutText(text, lutName);
        if (lut) _lutParseCache.set(cacheKey, lut);
      }
      if (!lut) return null;
      const matrix = _lutToColorMatrix(lut, intensity);
      if (!matrix) return null;
      const defs = _ensureSharpenSvgContainer();
      let filterEl = document.getElementById(filterId);
      if (!filterEl) {
        filterEl = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filterEl.id = filterId;
        filterEl.setAttribute('color-interpolation-filters', 'sRGB');
        const cm = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
        cm.setAttribute('type', 'matrix');
        cm.setAttribute('values', matrix);
        filterEl.appendChild(cm);
        defs.appendChild(filterEl);
      } else {
        const cm = filterEl.querySelector('feColorMatrix');
        if (cm) cm.setAttribute('values', matrix);
      }
      return filterId;
    }

    /* ── CSS Filter Builder ── */
    function _buildVideoFxCssFilter(videoFxChain, masterEnabled, bypass) {
      if (!Array.isArray(videoFxChain) || masterEnabled === false || bypass === true) return { filter: '', vignette: null, sharpenDefs: [] };
      const parts = [];
      let vignetteData = null;
      const sharpenDefs = [];
      videoFxChain.forEach(fx => {
        if (!fx || fx.enabled === false) return;
        const p = fx.params || {};
        switch (fx.type) {
          case 'brightness-contrast': {
            const b = Number(p.brightness || 0);
            const c = Number(p.contrast || 0);
            if (b !== 0) parts.push('brightness(' + (1 + b / 100) + ')');
            if (c !== 0) parts.push('contrast(' + (1 + c / 100) + ')');
            break;
          }
          case 'saturation': {
            const s = Number(p.saturation ?? 100);
            if (s !== 100) parts.push('saturate(' + (s / 100) + ')');
            break;
          }
          case 'hue-shift': {
            const h = Number(p.hue || 0);
            if (h !== 0) parts.push('hue-rotate(' + h + 'deg)');
            break;
          }
          case 'temperature': {
            const t = Number(p.temperature || 0);
            const tint = Number(p.tint || 0);
            if (t > 0) {
              parts.push('sepia(' + (t / 100 * 0.3).toFixed(3) + ')');
              parts.push('brightness(' + (1 + t / 500).toFixed(3) + ')');
            } else if (t < 0) {
              parts.push('hue-rotate(' + (t / 100 * 20).toFixed(1) + 'deg)');
              parts.push('saturate(' + (1 + Math.abs(t) / 200).toFixed(3) + ')');
            }
            if (tint !== 0) parts.push('hue-rotate(' + (tint / 100 * 12).toFixed(1) + 'deg)');
            break;
          }
          case 'sharpness': {
            const a = Number(p.amount || 0);
            if (a > 0 && fx.id) {
              const filterId = 'bsp-sharpen-' + fx.id;
              const r = Number(p.radius) || 1.0;
              sharpenDefs.push({ filterId: filterId, amount: a, radius: r });
              parts.push('url(#' + filterId + ')');
            }
            break;
          }
          case 'denoise-video': {
            const s = Number(p.strength || 0);
            if (s > 0) parts.push('blur(' + (s * 0.04).toFixed(2) + 'px)');
            break;
          }
          case 'gamma': {
            const g = Number(p.gamma ?? 1);
            if (g !== 1 && g > 0) parts.push('brightness(' + Math.pow(g, 0.45).toFixed(3) + ')');
            break;
          }
          case 'blur': {
            const r = Number(p.radius || 0);
            if (r > 0) parts.push('blur(' + r.toFixed(1) + 'px)');
            break;
          }
          case 'lut': {
            const map = ['none', 'vintage', 'teal-orange', 'faded-film', 'high-contrast', 'muted'];
            let preset = p.preset;
            if (typeof preset === 'number' && Number.isFinite(preset)) preset = map[Math.round(preset)] || 'none';
            const presetKeyRaw = String(preset ?? '').trim().toLowerCase();
            const presetKey = /^-?\d+$/.test(presetKeyRaw) ? (map[Math.round(Number(presetKeyRaw))] || 'none') : presetKeyRaw;
            const intensity = Math.max(0, Math.min(100, Number(p.intensity ?? 100))) / 100;
            if (presetKey === 'vintage' && intensity > 0) {
              parts.push('sepia(' + (0.35 * intensity).toFixed(3) + ')');
              parts.push('contrast(' + (1 + 0.1 * intensity).toFixed(3) + ')');
            } else if (presetKey === 'teal-orange' && intensity > 0) {
              parts.push('sepia(' + (0.15 * intensity).toFixed(3) + ')');
              parts.push('hue-rotate(-10deg)');
              parts.push('saturate(' + (1 + 0.3 * intensity).toFixed(3) + ')');
            } else if (presetKey === 'faded-film' && intensity > 0) {
              parts.push('contrast(' + (1 - 0.15 * intensity).toFixed(3) + ')');
              parts.push('brightness(' + (1 + 0.05 * intensity).toFixed(3) + ')');
              parts.push('saturate(' + (1 - 0.2 * intensity).toFixed(3) + ')');
            } else if (presetKey === 'high-contrast' && intensity > 0) {
              parts.push('contrast(' + (1 + 0.4 * intensity).toFixed(3) + ')');
              parts.push('brightness(' + (1 - 0.05 * intensity).toFixed(3) + ')');
            } else if (presetKey === 'muted' && intensity > 0) {
              parts.push('saturate(' + (1 - 0.4 * intensity).toFixed(3) + ')');
              parts.push('brightness(' + (1 + 0.03 * intensity).toFixed(3) + ')');
            } else if (presetKey === 'custom' && intensity > 0 && p.customLutData && fx.id) {
              const lutFilterId = _ensureCustomLutFilter(fx.id, p.customLutData, intensity, p.customLutName);
              if (lutFilterId) parts.push('url(#' + lutFilterId + ')');
            }
            break;
          }
          case 'vignette': {
            const amt = Number(p.amount ?? 50);
            if (amt > 0) vignetteData = { amount: amt, size: Number(p.size ?? 50), roundness: Number(p.roundness ?? 50) };
            break;
          }
        }
      });
      return { filter: parts.join(' '), vignette: vignetteData, sharpenDefs: sharpenDefs };
    }

    function _buildVignetteBoxShadow(v) {
      if (!v) return '';
      const spread = Math.round(20 + (100 - v.size) * 1.5);
      const blur = Math.round(30 + v.amount * 1.2);
      const opacity = (v.amount / 100 * 0.85).toFixed(2);
      return 'inset 0 0 ' + blur + 'px ' + spread + 'px rgba(0,0,0,' + opacity + ')';
    }

    /* ── Apply Video FX to control panel compositor layers ── */
    function _applyVideoFxToAllLayers() {
      const scene = _activeScene();
      if (!scene || !Array.isArray(scene.sources)) return;
      const comp = document.getElementById('source-compositor');
      if (!comp) return;
      scene.sources.forEach(src => {
        if (!src || src.visible === false) return;
        const layerEl = comp.querySelector('.src-layer[data-src-id="' + src.id + '"]');
        if (!layerEl) return;
        _applyVideoFxToLayer(layerEl, src);
      });
      queueStandaloneSyncBurst();
    }

    function _applyVideoFxToLayer(layerEl, src) {
      if (!layerEl || !src) return;
      const chain = (src.config && Array.isArray(src.config.videoFx)) ? src.config.videoFx : [];
      const masterEnabled = src.config ? src.config.videoFxMasterEnabled !== false : true;
      const bypass = src.config ? src.config.videoFxBypass === true : false;
      const result = _buildVideoFxCssFilter(chain, masterEnabled, bypass);
      /* Create / update SVG sharpen filters referenced by the CSS filter string */
      const activeIds = new Set();
      if (result.sharpenDefs && result.sharpenDefs.length) {
        result.sharpenDefs.forEach(d => {
          _ensureSharpenFilter(d.filterId, d.amount, d.radius);
          activeIds.add(d.filterId);
        });
      }
      layerEl.style.filter = result.filter || '';
      layerEl.style.boxShadow = result.vignette ? _buildVignetteBoxShadow(result.vignette) : '';
    }

    /* ── Video FX Preset Rendering ── */
    function renderVideoFxPresetsList() {
      const host = document.getElementById('video-fx-presets-list');
      if (!host) return;
      const src = _getSourceById(_editingFxSourceId);
      if (!src) {
        host.innerHTML = '<div class="source-fx-empty">No source selected.</div>';
        return;
      }
      const presets = _allSourceVideoFxPresets();
      if (!presets.length) {
        host.innerHTML = '<div class="source-fx-empty">No presets available.</div>';
        return;
      }
      host.innerHTML = presets.map((p, i) => `
        <div class="source-fx-preset-row">
          <div class="source-fx-preset-title" title="${esc(p.name)}">${esc(p.name)}</div>
          <span class="source-fx-preset-tag">${p.builtin ? 'Built-in' : 'Custom'}</span>
          <div class="source-fx-preset-actions">
            <button onclick="loadVideoFxPreset(${i})">Load</button>
            ${p.builtin ? '' : '<button onclick="deleteVideoFxPreset(' + i + ')">Delete</button>'}
          </div>
        </div>
      `).join('');
    }

    function loadVideoFxPreset(idx) {
      const src = _getSourceById(_editingFxSourceId);
      if (!src) return;
      const presets = _allSourceVideoFxPresets();
      const p = presets[idx];
      if (!p || !Array.isArray(p.stack)) return;
      if (!src.config) src.config = {};
      src.config.videoFx = p.stack.map(item => {
        const fx = _makeSourceFxByType(item.type);
        if (item.params) fx.params = { ...fx.params, ...item.params };
        fx.enabled = item.enabled !== false;
        return fx;
      });
      src.config.videoFxSelectedId = src.config.videoFx[0]?.id || '';
      // Switch to FX view
      const fxPanel = document.getElementById('source-fx-panel-video-fx');
      const presetsPanel = document.getElementById('source-fx-panel-video-presets');
      if (fxPanel) fxPanel.classList.add('active');
      if (presetsPanel) presetsPanel.classList.remove('active');
      renderVideoFxList();
      _applyVideoFxToAllLayers();
      schedulePersistAppState();
      showToast(t('video_preset_loaded_named').replace('{name}', p.name));
    }

    function saveCurrentVideoFxAsPreset() {
      const src = _getSourceById(_editingFxSourceId);
      if (!src || !src.config || !Array.isArray(src.config.videoFx) || !src.config.videoFx.length) {
        showToast(t('video_fx_no_effects_to_save'));
        return;
      }
      const nameInput = document.getElementById('video-fx-save-name');
      const name = (nameInput ? nameInput.value : '').trim() || 'My Video Preset';
      const stack = src.config.videoFx.map(fx => ({
        type: fx.type, enabled: fx.enabled !== false, params: { ...fx.params }
      }));
      _sourceVideoFxUserPresets.push({ name, builtin: false, stack });
      _saveVideoFxUserPresets();
      renderVideoFxPresetsList();
      if (nameInput) nameInput.value = '';
      showToast(t('video_fx_preset_saved_named').replace('{name}', name));
    }

    function deleteVideoFxPreset(idx) {
      const builtins = _builtinVideoFxPresets().length;
      const userIdx = idx - builtins;
      if (userIdx < 0 || userIdx >= _sourceVideoFxUserPresets.length) return;
      _sourceVideoFxUserPresets.splice(userIdx, 1);
      _saveVideoFxUserPresets();
      renderVideoFxPresetsList();
      showToast(t('preset_deleted'));
    }

    function applySourceFxPreset(presetId) {
      const src = _getSourceById(_editingFxSourceId);
      if (!src) return;
      const preset = _allSourceFxPresets().find((p) => String(p.id) === String(presetId));
      if (!preset || !Array.isArray(preset.stack) || !preset.stack.length) return;
      if (!src.config) src.config = {};
      src.config.audioFx = _cloneFxStackForSource(preset.stack);
      src.config.fxSelectedId = src.config.audioFx[0]?.id || '';
      src.config.fxTab = 'fx';
      /* Track the active preset so "Save" can update it in-place */
      window._activeSourceFxPresetId = preset.builtin ? null : preset.id;
      setSourceFxTab('fx');
      renderSourceFxList();
      _refreshSourceFxAudio(src.id);
      const label = document.getElementById('source-fx-preset-trigger-text');
      if (label) label.textContent = preset.name;
      showToast(t('preset_loaded_named').replace('{name}', preset.name));
    }

    function saveCurrentFxAsPreset(optName) {
      const src = _getSourceById(_editingFxSourceId);
      if (!src) return;
      const input = document.getElementById('source-fx-save-name');
      const name = String(optName || (input ? input.value : '') || '').trim();
      if (!name) {
        showToast(t('preset_name_required'));
        return;
      }
      const chain = _normalizeAudioFxStack(src.config && src.config.audioFx ? src.config.audioFx : []);
      if (!chain.length) {
        showToast(t('fx_no_effects_to_save'));
        return;
      }
      const exists = _sourceFxUserPresets.find((p) => String(p.name).toLowerCase() === name.toLowerCase());
      const payload = {
        id: exists ? exists.id : ('user-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)),
        name,
        builtin: false,
        stack: chain.map((fx) => ({ type: fx.type, enabled: fx.enabled !== false, params: { ...(fx.params || {}) } }))
      };
      if (exists) {
        Object.assign(exists, payload);
      } else {
        _sourceFxUserPresets.push(payload);
      }
      _saveSourceFxUserPresets();
      /* Track newly saved/updated preset as active */
      window._activeSourceFxPresetId = payload.id;
      const label = document.getElementById('source-fx-preset-trigger-text');
      if (label) label.textContent = payload.name;
      if (input) input.value = '';
      renderSourceFxPresetsList();
      showToast(t('preset_saved'));
    }

    function deleteSourceFxPreset(presetId) {
      const idx = _sourceFxUserPresets.findIndex((p) => String(p.id) === String(presetId));
      if (idx < 0) return;
      _sourceFxUserPresets.splice(idx, 1);
      _saveSourceFxUserPresets();
      renderSourceFxPresetsList();
      // Rebuild dropdown menu if open
      const dd = document.getElementById('source-fx-preset-dropdown');
      if (dd && dd.classList.contains('open')) _buildSourceFxPresetMenu(dd);
      showToast(t('preset_deleted'));
    }

    function _setSourceFxEyeUi(sourceId, fxId, enabled) {
      const row = document.querySelector(`#source-fx-list .rec-fx-item[data-fx-id="${fxId}"]`)
        || document.querySelector(`#video-fx-list .rec-fx-item[data-fx-id="${fxId}"]`);
      if (!row) return;
      const eye = row.querySelector('.sli-eye');
      if (!eye) return;
      const hidden = enabled === false;
      eye.classList.toggle('hidden', hidden);
      eye.dataset.hidden = hidden ? '1' : '0';
      eye.style.opacity = hidden ? '0.52' : '0.82';
    }

    function toggleEffectEnabled(sourceId, fxId) {
      const src = _getSourceById(sourceId);
      if (!src || !src.config || !Array.isArray(src.config.audioFx)) return;
      const fx = src.config.audioFx.find((x) => x && x.id === fxId);
      if (!fx) return;
      fx.enabled = fx.enabled === false;
      _setSourceFxEyeUi(sourceId, fxId, fx.enabled !== false);
      _updateSourceListFxLabel(sourceId);
      _scheduleSourceFxRefresh(sourceId, 0);
    }

    function toggleCurrentSourceFxMaster() {
      if (!_editingFxSourceId) return;
      const src = _getSourceById(_editingFxSourceId);
      if (!src || !src.config || !Array.isArray(src.config.audioFx)) return;
      _ensureSourceAudioFxDefaults(src);
      const enableFx = src.config.fxMasterEnabled === false;
      if (enableFx) {
        const snap = src.config.fxEnabledSnapshot && typeof src.config.fxEnabledSnapshot === 'object'
          ? src.config.fxEnabledSnapshot
          : null;
        src.config.audioFx.forEach((fx) => {
          if (!fx) return;
          if (snap && Object.prototype.hasOwnProperty.call(snap, fx.id)) {
            fx.enabled = snap[fx.id] !== false;
          }
        });
        delete src.config.fxEnabledSnapshot;
        src.config.fxMasterEnabled = true;
      } else {
        const snapshot = {};
        src.config.audioFx.forEach((fx) => {
          if (!fx) return;
          snapshot[fx.id] = fx.enabled !== false;
          fx.enabled = false;
        });
        src.config.fxEnabledSnapshot = snapshot;
        src.config.fxMasterEnabled = false;
      }
      renderSourceFxList();
      renderSourceFxMasterControls();
      _refreshSourceFxAudio(src.id);
    }

    function toggleCurrentSourceFxBypass() {
      if (!_editingFxSourceId) return;
      const src = _getSourceById(_editingFxSourceId);
      if (!src || !src.config) return;
      _ensureSourceAudioFxDefaults(src);
      src.config.fxBypass = !(src.config.fxBypass === true);
      renderSourceFxMasterControls();
      _refreshSourceFxAudio(src.id);
    }

    function moveEffectInChain(sourceId, fxId, delta) {
      const src = _getSourceById(sourceId);
      if (!src || !src.config || !Array.isArray(src.config.audioFx)) return;
      const chain = src.config.audioFx;
      const idx = chain.findIndex((x) => x && x.id === fxId);
      if (idx < 0) return;
      const next = idx + (delta < 0 ? -1 : 1);
      if (next < 0 || next >= chain.length) return;
      const [fx] = chain.splice(idx, 1);
      chain.splice(next, 0, fx);
      renderSourceFxList();
      _refreshSourceFxAudio(sourceId);
    }

    function deleteEffectFromChain(sourceId, fxId) {
      const src = _getSourceById(sourceId);
      if (!src || !src.config || !Array.isArray(src.config.audioFx)) return false;
      const beforeLen = src.config.audioFx.length;
      src.config.audioFx = src.config.audioFx.filter((x) => x && x.id !== fxId);
      if (src.config.audioFx.length === beforeLen) return false;
      if (src.config.fxSelectedId === fxId) src.config.fxSelectedId = src.config.audioFx[0]?.id || '';
      saveState('Delete Audio FX');
      renderSourceFxList();
      _refreshSourceFxAudio(sourceId);
      return true;
    }

    function removeSelectedEffectFromCurrentSource() {
      const src = _getSourceById(_editingFxSourceId);
      if (!src || !src.config || !Array.isArray(src.config.audioFx)) return false;
      const selectedId = String(src.config.fxSelectedId || '');
      if (!selectedId) return false;
      return deleteEffectFromChain(src.id, selectedId);
    }

    function handleSourceFxDeleteKey(event) {
      if (!event || event.defaultPrevented || (event.key !== 'Delete' && event.key !== 'Backspace')) return;
      const overlay = document.getElementById('source-fx-overlay');
      if (!(overlay && overlay.classList.contains('open'))) return;
      const target = event.target;
      if (target instanceof Element && target.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (removeSelectedEffectFromCurrentSource()) event.preventDefault();
    }

    document.addEventListener('keydown', handleSourceFxDeleteKey);

    function recDeleteSelectedEffectFromOpenFxPopup() {
      if (!(typeof _recInstances !== 'undefined' && _recInstances && typeof _recInstances.keys === 'function')) return false;
      for (const iid of _recInstances.keys()) {
        const overlay = _re(iid, 'rec-fx-overlay');
        if (!(overlay && overlay.classList.contains('open'))) continue;
        const st = _ri(iid);
        const selectedId = String(st && st.fxSelectedId ? st.fxSelectedId : '');
        if (!selectedId) return false;
        recDeleteEffect(iid, selectedId);
        return true;
      }
      return false;
    }

    function _isRecFxTextEntryTarget(target) {
      if (!(target instanceof Element)) return false;
      const input = target.closest('input');
      if (input) {
        const t = String(input.type || '').toLowerCase();
        if (t === 'text' || t === 'search' || t === 'number' || t === 'email' || t === 'url' || t === 'password') return true;
      }
      if (target.closest('textarea,select,[contenteditable="true"]')) return true;
      return false;
    }

    function handleRecFxDeleteKey(event) {
      if (!event || event.defaultPrevented) return;
      const key = String(event.key || '');
      if (key !== 'Delete' && key !== 'Backspace') return;
      if (_isRecFxTextEntryTarget(event.target)) return;
      if (recDeleteSelectedEffectFromOpenFxPopup()) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    document.addEventListener('keydown', handleRecFxDeleteKey);

    function _isDeleteTypingTarget(target) {
      return !!(target instanceof Element && target.closest('input,textarea,select,[contenteditable="true"]'));
    }

    /**
     * Returns true when any modal, overlay, or floating panel is visible
     * on top of the main workspace — delete / backspace should NOT
     * fall through to scene / source layer / clip deletion in that case.
     */
    function _isBlockingOverlayOpen() {
      // Any modal-overlay that is displayed (settings, confirm, style editor, etc.)
      const modals = document.querySelectorAll('.modal-overlay');
      for (const m of modals) {
        if (m.style.display && m.style.display !== 'none') return true;
      }
      // Pro Mixer floating panel
      if (typeof _promixOpen !== 'undefined' && _promixOpen) return true;
      // Source FX overlay
      const srcFx = document.getElementById('source-fx-overlay');
      if (srcFx && srcFx.classList.contains('open')) return true;
      // Pro Mixer FX param popover
      const paramPop = document.getElementById('promix-fx-param-pop');
      if (paramPop && paramPop.classList.contains('open')) return true;
      // Any open rec-fx overlay
      if (typeof _recInstances !== 'undefined' && _recInstances && typeof _recInstances.keys === 'function') {
        for (const iid of _recInstances.keys()) {
          const ov = typeof _re === 'function' ? _re(iid, 'rec-fx-overlay') : null;
          if (ov && ov.classList.contains('open')) return true;
        }
      }
      return false;
    }

    function handleGlobalLayerAndFxDeleteKey(event) {
      if (!event || event.defaultPrevented) return;
      const key = String(event.key || '');
      if (key !== 'Delete' && key !== 'Backspace') return;
      if (_isDeleteTypingTarget(event.target)) return;

      // Priority 0: delete selected FX in Pro Mixer
      if (_promixOpen && _promixSelectedFx) {
        _promixDeleteFx(_promixSelectedFx.sourceId, _promixSelectedFx.fxId);
        event.preventDefault();
        return;
      }

      // Priority 1: delete selected effect in an open Record FX popup
      if (recDeleteSelectedEffectFromOpenFxPopup()) {
        event.preventDefault();
        return;
      }

      // Priority 2: delete selected effect in open Source FX popup
      const srcFxOverlay = document.getElementById('source-fx-overlay');
      if (srcFxOverlay && srcFxOverlay.classList.contains('open')) {
        if (removeSelectedEffectFromCurrentSource()) {
          event.preventDefault();
          return;
        }
      }

      // ── Guard: do NOT delete underlying scene/source when any overlay is open ──
      if (_isBlockingOverlayOpen()) return;

      // Scene/source layer delete keyboard action is scoped to Projection page.
      if (typeof currentAppPage === 'string' && currentAppPage !== 'projection') return;

      // Priority 3: delete selected source layer
      if (_selectedSourceEl) {
        removeSelectedSource();
        event.preventDefault();
        return;
      }

      // Priority 4: delete selected scene
      if (_selectedSceneEl) {
        removeSelectedScene();
        event.preventDefault();
      }
    }

    document.addEventListener('keydown', handleGlobalLayerAndFxDeleteKey);

    /* ═══════ Global Undo / Redo Keyboard Shortcuts ═══════ */
    document.addEventListener('keydown', function _handleUndoRedoKey(e) {
      if (!e || e.defaultPrevented) return;
      const isMeta = e.metaKey || e.ctrlKey;
      if (!isMeta) return;
      const key = (e.key || '').toLowerCase();
      if (key !== 'z') return;
      // Don't intercept when typing in text fields (they have native undo)
      if (e.target instanceof Element && e.target.closest('input,textarea,select,[contenteditable="true"]')) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) {
        redoAction();
      } else {
        undoAction();
      }
    });

    async function openSourcePluginEditor(sourceId, fxId) {
      const src = _getSourceById(sourceId);
      if (!src || !src.config || !Array.isArray(src.config.audioFx)) return;
      const fx = src.config.audioFx.find((x) => x && x.id === fxId && x.type === 'plugin-host');
      if (!fx) return;
      const params = fx.params || {};
      if (!_audioPluginHostStatus.available) {
        await refreshAudioPluginHostStatus();
        if (!_audioPluginHostStatus.available) {
          showToast(_audioPluginHostStatus.reason || 'Plugin host is unavailable. Install bsp-plugin-host to open AU/VST UI.');
          return;
        }
      }
      if (!(window.BSPDesktop && typeof window.BSPDesktop.openAudioPluginEditor === 'function')) {
        showToast('Plugin bridge unavailable. Restart app to load latest desktop APIs.');
        return;
      }
      try {
        const resp = await window.BSPDesktop.openAudioPluginEditor({
          pluginId: params.pluginId || '',
          pluginPath: params.pluginPath || '',
          pluginFormat: params.pluginFormat || '',
          pluginLabel: params.pluginLabel || ''
        });
        if (!resp) {
          showToast('Plugin UI request failed: empty response from desktop host.');
          return;
        }
        if (!resp.ok) {
          const msg = String(resp.error || '').trim();
          if (resp.code === 'EACCES' || resp.code === 'EPERM') {
            showToast(`${msg || 'Plugin host blocked by system.'} Check executable permission and macOS security settings.`);
            return;
          }
          showToast(msg || 'Plugin UI request failed. Restart app and try again.');
        }
      } catch (e) {
        const msg = (e && e.message) ? String(e.message) : 'unknown error';
        if (/No handler registered/i.test(msg)) {
          showToast('Plugin UI handler not loaded. Restart app to apply backend updates.');
        } else {
          showToast(`Plugin UI failed: ${msg}`);
        }
      }
    }

    function sourceFxDragStart(ev, sourceId, fxId) {
      _fxDragSourceId = sourceId || '';
      _fxDragFxId = fxId || '';
      const row = ev && ev.currentTarget;
      if (row && row.classList) row.classList.add('dragging');
      try {
        ev.dataTransfer.effectAllowed = 'move';
        ev.dataTransfer.setData('text/plain', fxId || '');
      } catch (_) {}
    }

    function sourceFxDragOver(ev) {
      if (!ev) return;
      ev.preventDefault();
      try { ev.dataTransfer.dropEffect = 'move'; } catch (_) {}
      const row = ev.currentTarget;
      if (row && row.classList) row.classList.add('drop-target');
    }

    function sourceFxDragLeave(ev) {
      const row = ev && ev.currentTarget;
      if (row && row.classList) row.classList.remove('drop-target');
    }

    function sourceFxDrop(ev, sourceId, targetFxId) {
      if (ev) ev.preventDefault();
      const row = ev && ev.currentTarget;
      if (row && row.classList) row.classList.remove('drop-target');
      const src = _getSourceById(sourceId);
      if (!src || !src.config || !Array.isArray(src.config.audioFx)) return;
      if (!(_fxDragSourceId && _fxDragSourceId === sourceId && _fxDragFxId)) return;
      if (_fxDragFxId === targetFxId) return;
      const chain = src.config.audioFx;
      const from = chain.findIndex((x) => x && x.id === _fxDragFxId);
      const to = chain.findIndex((x) => x && x.id === targetFxId);
      if (from < 0 || to < 0) return;
      const [moved] = chain.splice(from, 1);
      chain.splice(to, 0, moved);
      renderSourceFxList();
      _refreshSourceFxAudio(sourceId);
    }

    function sourceFxDragEnd(ev) {
      const row = ev && ev.currentTarget;
      if (row && row.classList) row.classList.remove('dragging');
      document.querySelectorAll('.source-fx-row.drop-target').forEach((el) => el.classList.remove('drop-target'));
      _fxDragSourceId = '';
      _fxDragFxId = '';
    }

    function openAddSourcePopup() {
      if (!_activeSceneId || _scenes.length === 0) {
        alert('Please create a scene first before adding sources.');
        return;
      }
      document.getElementById('add-source-overlay').classList.add('open');
    }
    function closeAddSourcePopup() {
      const overlay = document.getElementById('add-source-overlay');
      overlay.classList.remove('open');
      _resetModalPosition(overlay);
    }
    function openSourceConfig(type) {
      closeAddSourcePopup();
      _pendingSourceType = type;
      const title = document.getElementById('source-config-title');
      const body = document.getElementById('source-config-body');
      const label = SOURCE_TYPE_LABELS[type] || type;
      title.textContent = 'Add ' + label;
      body.innerHTML = buildSourceConfigFields(type) + _buildExistingSourceChooser(type);
      document.getElementById('source-config-overlay').classList.add('open');
      _syncExistingSourceChooserUi();
      const firstInput = body.querySelector('input,select');
      if (firstInput) setTimeout(() => firstInput.focus(), 60);
      if (type === 'camera' || type === 'audio-input') {
        const kind = type === 'camera' ? 'videoinput' : 'audioinput';
        _primeMediaDeviceSelect(kind);
        enumerateMediaDevices(kind, { requestPermission: false });
      }
      if (type === 'ndi') {
        enumerateNdiSources();
        // Also populate NDI audio devices
        setTimeout(() => _enumerateNdiAudioDevices(), 200);
      }
      if (type === 'window-capture') {
        enumerateDesktopSources();
      }
    }

    function _buildExistingSourceChooser(type) {
      // Show only while adding (not editing properties).
      if (_editingSourceEl) return '';
      const activeSceneId = String(_activeSceneId || '');
      const sameType = [];
      _scenes.forEach((scene) => {
        if (!scene || !Array.isArray(scene.sources)) return;
        scene.sources.forEach((s) => {
          if (!s || s.type !== type) return;
          sameType.push({
            id: String(s.id || ''),
            name: String(s.name || s.id || ''),
            sceneId: String(scene.id || ''),
            sceneName: String(scene.name || 'Scene')
          });
        });
      });
      const options = sameType.map((s) => {
        const inCurrent = s.sceneId === activeSceneId;
        const where = inCurrent ? 'Current scene' : s.sceneName;
        return `<option value="${esc(s.id)}">${esc(s.name)} \u2022 ${esc(where)}</option>`;
      }).join('');
      return `
        <div id="src-existing-wrap" style="margin:12px;border:1px solid rgba(120,136,160,0.28);border-radius:8px;padding:10px 10px 8px;background:rgba(20,28,40,0.35)">
          <div style="font-size:11px;color:#9fb2c9;margin-bottom:8px">Existing ${esc(SOURCE_TYPE_LABELS[type] || type)} layers (all scenes)</div>
          <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#d9e5f5;margin:0 0 8px 0;cursor:pointer">
            <input type="radio" name="src-existing-mode" value="new" checked onchange="_syncExistingSourceChooserUi()">
            <span>Create new layer</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#d9e5f5;margin:0;cursor:pointer">
            <input type="radio" name="src-existing-mode" value="existing" onchange="_syncExistingSourceChooserUi()" ${sameType.length ? '' : 'disabled'}>
            <span>Use existing layer</span>
          </label>
          <select class="sp-input" id="src-cfg-existing-id" ${sameType.length ? '' : 'disabled'} style="margin:8px 0 0 0;${sameType.length ? '' : 'opacity:0.55'}">
            ${options || '<option value="">No existing layer of this type</option>'}
          </select>
        </div>`;
    }

    function _findSourceWithSceneById(sourceId) {
      const sid = String(sourceId || '');
      if (!sid) return null;
      for (let i = 0; i < _scenes.length; i++) {
        const scene = _scenes[i];
        if (!scene || !Array.isArray(scene.sources)) continue;
        const src = scene.sources.find((s) => s && String(s.id || '') === sid);
        if (src) return { scene, src };
      }
      return null;
    }

    function _cloneSourceForScene(src) {
      if (!src) return null;
      const cloneConfig = (src.config && typeof src.config === 'object')
        ? JSON.parse(JSON.stringify(src.config))
        : {};
      const clone = {
        id: _genSourceId(),
        type: src.type,
        name: src.name || (SOURCE_TYPE_LABELS[src.type] || 'Source'),
        visible: src.visible !== false,
        transformLocked: src.transformLocked === true,
        config: cloneConfig
      };
      if (src.transform && typeof src.transform === 'object') {
        clone.transform = JSON.parse(JSON.stringify(src.transform));
      }
      return clone;
    }

    function _makeUniqueSourceNameInScene(scene, baseName) {
      const base = String(baseName || 'Source').trim() || 'Source';
      if (!_findDuplicateSourceNameInScene(scene, base, '')) return base;
      let i = 2;
      while (i < 10000) {
        const candidate = `${base} ${i}`;
        if (!_findDuplicateSourceNameInScene(scene, candidate, '')) return candidate;
        i++;
      }
      return `${base} ${Date.now()}`;
    }

    function _syncExistingSourceChooserUi() {
      const wrap = document.getElementById('src-existing-wrap');
      if (!wrap) return;
      const mode = document.querySelector('input[name="src-existing-mode"]:checked')?.value || 'new';
      const pick = document.getElementById('src-cfg-existing-id');
      if (pick) {
        const useExisting = mode === 'existing';
        const hasOptions = !!(pick.options && pick.options.length && pick.options[0].value);
        pick.disabled = !useExisting || !hasOptions;
        pick.style.opacity = pick.disabled ? '0.55' : '1';
      }
    }

    function _findDuplicateSourceNameInScene(scene, name, exceptSourceId) {
      if (!scene || !Array.isArray(scene.sources)) return null;
      const target = String(name || '').trim().toLowerCase();
      if (!target) return null;
      return scene.sources.find((s) => {
        if (!s || s.id === exceptSourceId) return false;
        return String(s.name || '').trim().toLowerCase() === target;
      }) || null;
    }
    function closeSourceConfig() {
      _stopSourcePreview();
      document.getElementById('source-config-overlay').classList.remove('open');
      _pendingSourceType = null;
      _editingSourceEl = null;
    }

    /* ── Source config preview stream ── */
    let _srcPreviewStream = null;
    const _mediaDeviceCache = {
      videoinput: { ts: 0, devices: [] },
      audioinput: { ts: 0, devices: [] }
    };
    const _mediaDeviceInFlight = {
      videoinput: null,
      audioinput: null
    };
    const _mediaDevicePermissionReady = {
      videoinput: false,
      audioinput: false
    };

    function _sourceDeviceLabel(kind) {
      return kind === 'videoinput' ? 'camera' : 'audio input';
    }

    function _sanitizeSourceDisplayLabel(raw, fallback = '') {
      let label = String(raw || '').trim();
      if (!label) return String(fallback || '').trim();
      // Remove noisy transport/vendor tags like "(local)" and USB VID:PID blocks.
      label = label
        .replace(/\s*\(\s*local\.?\s*\)\s*/ig, ' ')
        .replace(/\s*\((?=[^)]*\b0x?[0-9a-f]{2,6}\s*:\s*0x?[0-9a-f]{2,6}\b)[^)]*\)\s*/ig, ' ')
        .replace(/\s*\(\s*\)\s*/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      return label || String(fallback || '').trim();
    }

    function _isDeviceNamedSourceType(type) {
      return type === 'camera' || type === 'audio-input' || type === 'ndi';
    }

    function _sanitizeSourceNameForType(name, type) {
      const raw = String(name || '').trim();
      if (!raw) return raw;
      if (!_isDeviceNamedSourceType(type)) return raw;
      return _sanitizeSourceDisplayLabel(raw, raw);
    }

    function _getCachedMediaDevices(kind, maxAgeMs = 12000) {
      const entry = _mediaDeviceCache[kind];
      if (!entry || !Array.isArray(entry.devices) || !entry.devices.length) return null;
      if ((Date.now() - (entry.ts || 0)) > maxAgeMs) return null;
      return entry.devices.slice();
    }

    function _setSourceDeviceSelectMessage(kind, message) {
      const sel = document.getElementById('src-cfg-device');
      if (!sel) return;
      sel.innerHTML = `<option value="">${message}</option>`;
    }

    function _renderSourceDeviceSelect(kind, devices, opts = {}) {
      const sel = document.getElementById('src-cfg-device');
      if (!sel) return false;
      const before = _cameraPreselectValue || sel.value || '';
      sel.innerHTML = '';
      if (!devices || !devices.length) {
        sel.innerHTML = `<option value="">No ${_sourceDeviceLabel(kind)}s found</option>`;
        return true;
      }
      devices.forEach((d, i) => {
        const opt = document.createElement('option');
        opt.value = d.deviceId;
        opt.textContent = _sanitizeSourceDisplayLabel(
          d.label,
          `${kind === 'videoinput' ? 'Camera' : 'Microphone'} ${i + 1}`
        );
        sel.appendChild(opt);
      });
      if (before && devices.some(d => d.deviceId === before)) {
        sel.value = before;
      } else if (opts.preferFirst !== false && sel.options.length) {
        sel.selectedIndex = 0;
      }
      if (_cameraPreselectValue && sel.value === _cameraPreselectValue) _cameraPreselectValue = null;
      return true;
    }

    async function _refreshMediaDeviceCache(kind, opts = {}) {
      const forceRefresh = !!opts.forceRefresh;
      const requestPermission = !!opts.requestPermission;
      const cached = _getCachedMediaDevices(kind, 8000);
      if (cached && !forceRefresh) return cached;
      if (_mediaDeviceInFlight[kind]) return _mediaDeviceInFlight[kind];
      _mediaDeviceInFlight[kind] = (async () => {
        try {
          if (requestPermission && !_mediaDevicePermissionReady[kind]) {
            try {
              const temp = await navigator.mediaDevices.getUserMedia(kind === 'videoinput' ? { video: true } : { audio: true });
              temp.getTracks().forEach(t => t.stop());
              _mediaDevicePermissionReady[kind] = true;
            } catch (e) { /* ignore permission failure for fast UI path */ }
          }
          const devices = await navigator.mediaDevices.enumerateDevices();
          const filtered = devices.filter(d => d.kind === kind);
          _mediaDeviceCache[kind] = { ts: Date.now(), devices: filtered };
          return filtered.slice();
        } catch (e) {
          return [];
        } finally {
          _mediaDeviceInFlight[kind] = null;
        }
      })();
      return _mediaDeviceInFlight[kind];
    }

    function _primeMediaDeviceSelect(kind) {
      const cached = _getCachedMediaDevices(kind, 60000);
      if (cached && cached.length) return _renderSourceDeviceSelect(kind, cached, { preferFirst: true });
      _setSourceDeviceSelectMessage(kind, `Select ${_sourceDeviceLabel(kind)}`);
      return false;
    }

    async function _updateSourcePreview() {
      const sel = document.getElementById('src-cfg-device');
      const container = document.getElementById('src-cfg-preview');
      if (!sel || !container) return;
      const deviceId = sel.value;
      // Stop previous preview stream
      _stopSourcePreview();
      if (!deviceId || deviceId.startsWith('No ') || deviceId.startsWith('Permission')) {
        container.innerHTML = '<div class="preview-placeholder">Select a camera to preview</div>';
        return;
      }
      container.innerHTML = '<div class="preview-placeholder">Starting preview...</div>';
      try {
        const resolution = _segVal('src-cfg-resolution') || 'auto';
        const fps = _segVal('src-cfg-fps') || 'auto';
        const videoConstraints = _buildVideoConstraintsFromPrefs(
          { deviceId: deviceId ? { exact: deviceId } : undefined },
          resolution,
          fps
        );
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints
        });
        _srcPreviewStream = stream;
        const vid = document.createElement('video');
        vid.autoplay = true; vid.muted = true; vid.playsInline = true;
        vid.srcObject = stream;
        _applyVisualFitMode(vid, _segVal('src-cfg-fitmode') || 'contain', { mirror: _togVal('src-cfg-mirror') });
        container.innerHTML = '';
        container.appendChild(vid);
        const lbl = document.createElement('span');
        lbl.className = 'preview-label';
        lbl.textContent = 'PREVIEW';
        container.appendChild(lbl);
        vid.play().catch(() => {});
      } catch (e) {
        container.innerHTML = '<div class="preview-placeholder">Cannot access camera</div>';
      }
    }

    function _stopSourcePreview() {
      if (_srcPreviewStream) {
        _srcPreviewStream.getTracks().forEach(t => t.stop());
        _srcPreviewStream = null;
      }
      const container = document.getElementById('src-cfg-preview');
      if (container) container.innerHTML = '';
    }

    let _cameraPreselectValue = null;

    async function enumerateMediaDevices(kind, opts = {}) {
      const sel = document.getElementById('src-cfg-device');
      if (!sel) return;
      const forceRefresh = !!opts.forceRefresh;
      const requestPermission = !!opts.requestPermission;
      _primeMediaDeviceSelect(kind);
      try {
        const filtered = await _refreshMediaDeviceCache(kind, { forceRefresh, requestPermission });
        _renderSourceDeviceSelect(kind, filtered, { preferFirst: true });
        if (kind === 'videoinput') _updateSourcePreview();
      } catch (e) {
        _setSourceDeviceSelectMessage(kind, 'Unavailable');
      }
    }

    function prewarmSourceDeviceCaches() {
      _refreshMediaDeviceCache('videoinput', { forceRefresh: false, requestPermission: false }).catch(() => {});
      _refreshMediaDeviceCache('audioinput', { forceRefresh: false, requestPermission: false }).catch(() => {});
    }

    if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === 'function') {
      navigator.mediaDevices.addEventListener('devicechange', () => {
        _refreshMediaDeviceCache('videoinput', { forceRefresh: true, requestPermission: false }).catch(() => {});
        _refreshMediaDeviceCache('audioinput', { forceRefresh: true, requestPermission: false }).catch(() => {});
        _scheduleCameraReconnectSweep();
        _scheduleAudioInputReconnectSweep();
      });
    }

    let _ndiDiscoveryPromise = null;
    let _ndiPreselectValue = null; // When editing, pre-select this value after discovery
    async function enumerateNdiSources() {
      const sel = document.getElementById('src-cfg-ndi');
      if (!sel) return;
      // If we have a preselect value, show it immediately instead of "Searching..."
      if (_ndiPreselectValue) {
        sel.innerHTML = '';
        const savedOpt = document.createElement('option');
        savedOpt.value = _ndiPreselectValue;
        savedOpt.textContent = _sanitizeSourceDisplayLabel(_ndiPreselectValue, _ndiPreselectValue) + ' (saved)';
        sel.appendChild(savedOpt);
        sel.value = _ndiPreselectValue;
        // Add a searching indicator below
        const searchNote = document.createElement('div');
        searchNote.id = 'ndi-search-note';
        searchNote.style.cssText = 'margin:4px 12px;color:#8899aa;font-size:10px;';
        searchNote.textContent = 'Refreshing NDI sources...';
        sel.insertAdjacentElement('afterend', searchNote);
      } else {
        sel.innerHTML = '<option value="">Searching for NDI sources...</option>';
      }
      const preselect = _ndiPreselectValue; // capture for closure
      const p = (async () => {
        try {
          if (window.BSPDesktop && typeof window.BSPDesktop.discoverNdiSources === 'function') {
            const result = await window.BSPDesktop.discoverNdiSources();
            const s = document.getElementById('src-cfg-ndi');
            if (!s) return;
            s.innerHTML = '';
            if (result && result.ok && result.sources && result.sources.length > 0) {
              result.sources.forEach(src => {
                const opt = document.createElement('option');
                opt.value = src.name;
                const domainRaw = String(src.domain || 'local').replace(/\.$/, '');
                const domainKey = domainRaw.toLowerCase();
                opt.dataset.domain = domainRaw;
                const cleanName = _sanitizeSourceDisplayLabel(src.name, src.name);
                opt.textContent = cleanName + ((domainRaw && domainKey !== 'local') ? ` (${domainRaw})` : '');
                s.appendChild(opt);
              });
              // Re-select preselected value if it exists in results
              if (preselect) {
                const match = [...s.options].find(o => o.value === preselect);
                if (match) {
                  s.value = preselect;
                } else {
                  // Saved source not found — add it as offline option
                  const offlineOpt = document.createElement('option');
                  offlineOpt.value = preselect;
                  offlineOpt.textContent = _sanitizeSourceDisplayLabel(preselect, preselect) + ' (offline)';
                  s.prepend(offlineOpt);
                  s.value = preselect;
                }
              }
            } else {
              if (preselect) {
                const offlineOpt = document.createElement('option');
                offlineOpt.value = preselect;
                offlineOpt.textContent = _sanitizeSourceDisplayLabel(preselect, preselect) + ' (offline)';
                s.appendChild(offlineOpt);
                s.value = preselect;
              }
              const noOpt = document.createElement('option');
              noOpt.value = '';
              noOpt.textContent = 'No other NDI sources found';
              s.appendChild(noOpt);
            }
          } else {
            sel.innerHTML = '<option value="">NDI discovery requires desktop app</option>';
          }
        } catch (e) {
          console.warn('NDI discovery error:', e);
          const s = document.getElementById('src-cfg-ndi');
          if (s) {
            if (preselect) {
              s.innerHTML = '';
              const offlineOpt = document.createElement('option');
              offlineOpt.value = preselect;
              offlineOpt.textContent = _sanitizeSourceDisplayLabel(preselect, preselect);
              s.appendChild(offlineOpt);
              s.value = preselect;
            } else {
              s.innerHTML = '<option value="">No NDI sources found</option>';
            }
          }
        }
      })();
      _ndiDiscoveryPromise = p;
      await p;
      _ndiPreselectValue = null; // clear after use
      // Remove searching note
      const note = document.getElementById('ndi-search-note');
      if (note) note.remove();
      // Auto-update source name when selecting an NDI source
      const selNow = document.getElementById('src-cfg-ndi');
      if (selNow) {
        selNow.onchange = () => {
          const nameInp = document.getElementById('src-cfg-name');
          if (nameInp && selNow.value) {
            const opt = selNow.options && selNow.selectedIndex >= 0 ? selNow.options[selNow.selectedIndex] : null;
            nameInp.value = _sanitizeSourceDisplayLabel(opt ? opt.textContent : selNow.value, selNow.value);
          }
        };
        // Auto-fill name for NEW sources only (name = default label 'NDI')
        if (!preselect && selNow.value) {
          const nameInp = document.getElementById('src-cfg-name');
          if (nameInp && (nameInp.value === 'NDI' || nameInp.value === '')) {
            const opt = selNow.options && selNow.selectedIndex >= 0 ? selNow.options[selNow.selectedIndex] : null;
            nameInp.value = _sanitizeSourceDisplayLabel(opt ? opt.textContent : selNow.value, selNow.value);
          }
        }
      }
      // Add refresh button
      const selParent = document.getElementById('src-cfg-ndi')?.parentElement;
      if (selParent) {
        const existing = selParent.querySelector('.ndi-refresh-btn');
        if (existing) existing.remove();
      }
      const refreshBtn = document.createElement('button');
      refreshBtn.className = 'sp-btn-secondary ndi-refresh-btn';
      refreshBtn.textContent = 'Refresh';
      refreshBtn.style.cssText = 'margin:8px 12px 0;padding:4px 12px;font-size:11px;cursor:pointer;';
      refreshBtn.onclick = (e) => { e.preventDefault(); enumerateNdiSources(); };
      const selFinal = document.getElementById('src-cfg-ndi');
      if (selFinal) selFinal.insertAdjacentElement('afterend', refreshBtn);
    }

    /* ---- NDI Audio Device Enumeration & Helpers ---- */

    /** Toggle handler for the "Enable Audio" switch in NDI config */
    function _onNdiAudioToggled(preselectId) {
      const enabled = _togVal('src-cfg-ndi-audio');
      const audioSection = document.getElementById('src-cfg-ndi-audio-device');
      const volumeEl = document.getElementById('src-cfg-ndi-volume');
      const monitorEl = document.getElementById('src-cfg-ndi-monitor');
      const statusEl = document.getElementById('src-cfg-ndi-audio-status');
      const opacity = enabled ? '1' : '0.45';
      [audioSection, volumeEl, monitorEl].forEach(el => {
        if (el) {
          const group = el.closest('.src-cfg-group') || el.closest('.src-cfg-toggle-row');
          if (group) group.style.opacity = opacity;
          el.disabled = !enabled;
        }
      });
      if (statusEl) {
        statusEl.textContent = enabled ? '' : 'Audio disabled';
        statusEl.style.color = enabled ? '#34d399' : '#8899aa';
      }
      if (enabled) _enumerateNdiAudioDevices(preselectId);
    }

    /** Enumerate audio input devices and populate the NDI audio device dropdown */
    async function _enumerateNdiAudioDevices(preselectId) {
      const sel = document.getElementById('src-cfg-ndi-audio-device');
      if (!sel) return;
      const statusEl = document.getElementById('src-cfg-ndi-audio-status');

      sel.innerHTML = '<option value="auto">Auto-detect NDI audio</option>';

      try {
        const devices = await _refreshMediaDeviceCache('audioinput', { forceRefresh: true, requestPermission: true });
        if (!devices || !devices.length) {
          if (statusEl) statusEl.textContent = 'No audio inputs found';
          return;
        }

        // Separate NDI-related devices and other devices
        const ndiDevices = [];
        const otherDevices = [];
        devices.forEach((d, i) => {
          const label = String(d.label || '').toLowerCase();
          const isNdi = label.includes('ndi') || label.includes('newtek');
          const entry = { device: d, index: i, isNdi };
          if (isNdi) ndiDevices.push(entry);
          else otherDevices.push(entry);
        });

        // Add NDI devices first with a visual indicator
        if (ndiDevices.length) {
          const grp = document.createElement('optgroup');
          grp.label = 'NDI Audio Devices';
          ndiDevices.forEach(({ device, index }) => {
            const opt = document.createElement('option');
            opt.value = device.deviceId;
            opt.textContent = _sanitizeSourceDisplayLabel(device.label, 'NDI Audio ' + (index + 1));
            grp.appendChild(opt);
          });
          sel.appendChild(grp);
        }

        // Add other audio devices
        if (otherDevices.length) {
          const grp = document.createElement('optgroup');
          grp.label = 'Other Audio Inputs';
          otherDevices.forEach(({ device, index }) => {
            const opt = document.createElement('option');
            opt.value = device.deviceId;
            opt.textContent = _sanitizeSourceDisplayLabel(device.label, 'Microphone ' + (index + 1));
            grp.appendChild(opt);
          });
          sel.appendChild(grp);
        }

        // Restore saved selection
        if (preselectId && preselectId !== 'auto') {
          const match = [...sel.options].find(o => o.value === preselectId);
          if (match) sel.value = preselectId;
        }

        if (statusEl) {
          if (ndiDevices.length) {
            statusEl.textContent = '\u25cf ' + ndiDevices.length + ' NDI audio device' + (ndiDevices.length > 1 ? 's' : '') + ' found';
            statusEl.style.color = '#34d399';
          } else {
            statusEl.textContent = '\u25cb No NDI-specific audio device detected — select manually or use Auto-detect';
            statusEl.style.color = '#fb923c';
          }
        }
      } catch (e) {
        if (statusEl) { statusEl.textContent = 'Error enumerating audio devices'; statusEl.style.color = '#f87171'; }
      }
    }

    /**
     * Find the best NDI audio input device — mirrors _findNdiCameraDevice logic.
     * Returns { device, matchType } or null.
     */
    async function _findNdiAudioDevice(srcConfig) {
      const audioDevices = await _refreshMediaDeviceCache('audioinput', { forceRefresh: false, requestPermission: true });
      if (!Array.isArray(audioDevices) || !audioDevices.length) return null;

      const savedId = srcConfig && srcConfig.ndiAudioDeviceId;

      // Strategy 1: User explicitly selected a device (not 'auto')
      if (savedId && savedId !== 'auto') {
        const found = audioDevices.find(d => d.deviceId === savedId);
        if (found) return { device: found, matchType: 'saved' };
      }

      // Strategy 2: Auto-detect — score by NDI-related keywords
      const ndiNameLower = String(srcConfig && srcConfig.ndiSourceName || '').toLowerCase();
      const skipWords = new Set(['stream', 'a', 'b', 'input', 'output', 'local', 'the', 'ndi']);
      const keywords = ndiNameLower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
        .filter(w => w.length >= 3 && !skipWords.has(w));

      const scored = audioDevices.map((d) => {
        const label = String(d.label || '').toLowerCase();
        let score = 0;
        if (label.includes('ndi audio')) score += 120;
        if (label.includes('ndi virtual')) score += 110;
        if (label.includes('newtek ndi')) score += 100;
        if (label.includes('ndi')) score += 80;
        if (label.includes('virtual audio')) score += 30;
        if (keywords.length) keywords.forEach((kw) => { if (label.includes(kw)) score += 25; });
        return { device: d, score };
      }).sort((a, b) => b.score - a.score);

      if (scored.length && scored[0].score > 0) {
        const kind = scored[0].score >= 80 ? 'ndi-audio' : 'keyword';
        return { device: scored[0].device, matchType: kind };
      }

      return null;
    }

    /**
     * Start NDI audio input stream for a given NDI source.
     * Uses the configured or auto-detected NDI audio device.
     */
    const _ndiAudioStreams = {}; // sourceId -> MediaStream
    const _ndiAudioRetryTimers = {}; // sourceId -> timer

    function _stopNdiAudioStream(sourceId) {
      const stream = _ndiAudioStreams[sourceId];
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        delete _ndiAudioStreams[sourceId];
      }
      if (_ndiAudioRetryTimers[sourceId]) {
        clearTimeout(_ndiAudioRetryTimers[sourceId]);
        delete _ndiAudioRetryTimers[sourceId];
      }
      _ctrlStopMeter(sourceId);
      _pgmDisconnectSource(sourceId);
    }

    /**
     * Suspend NDI audio: disable tracks and disconnect from mixer,
     * but keep the stream alive for instant resume.
     */
    function _suspendNdiAudioStream(sourceId) {
      const stream = _ndiAudioStreams[sourceId];
      if (stream && stream.active) {
        stream.getAudioTracks().forEach(t => { try { t.enabled = false; } catch (_) {} });
      }
      _ctrlStopMeter(sourceId);
      _pgmDisconnectSource(sourceId);
    }

    /**
     * Resume a previously suspended NDI audio stream.
     * Returns true if the stream was reused, false if a new stream is needed.
     */
    function _resumeNdiAudioStream(sourceId, srcConfig) {
      const stream = _ndiAudioStreams[sourceId];
      if (stream && stream.active && stream.getAudioTracks().length) {
        stream.getAudioTracks().forEach(t => { try { t.enabled = true; } catch (_) {} });
        _ctrlHydrateSourceState(sourceId);
        _ctrlApplyMuteToStream(sourceId, stream);
        renderControlsPanel();
        _pgmSyncSources();
        return true;
      }
      return false;
    }

    async function _startNdiAudioStream(sourceId, srcConfig) {
      if (!srcConfig || !srcConfig.ndiAudioEnabled) return null;

      // Find the NDI audio device
      const result = await _findNdiAudioDevice(srcConfig);
      let deviceId = null;

      if (result && result.device) {
        deviceId = result.device.deviceId;
        // Save for next time if auto-detected
        if (srcConfig.ndiAudioDeviceId === 'auto' || !srcConfig.ndiAudioDeviceId) {
          srcConfig._detectedAudioDeviceId = deviceId;
          srcConfig._detectedAudioDeviceLabel = result.device.label || '';
        }
      } else if (srcConfig.ndiAudioDeviceId && srcConfig.ndiAudioDeviceId !== 'auto') {
        deviceId = srcConfig.ndiAudioDeviceId;
      }

      if (!deviceId) {
        console.warn('[ndi-audio] No NDI audio device found for source:', sourceId);
        // Schedule retry
        _ndiAudioRetryTimers[sourceId] = setTimeout(() => {
          delete _ndiAudioRetryTimers[sourceId];
          _startNdiAudioStream(sourceId, srcConfig);
        }, 8000);
        return null;
      }

      // Stop existing stream first
      _stopNdiAudioStream(sourceId);

      try {
        const constraints = {
          audio: {
            deviceId: { exact: deviceId },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: { ideal: 48000 },
            channelCount: { ideal: 2 }
          },
          video: false
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const track = stream.getAudioTracks()[0];
        if (track) {
          track.onended = () => {
            if (_ndiAudioStreams[sourceId] === stream) {
              delete _ndiAudioStreams[sourceId];
              _ctrlStopMeter(sourceId);
              _pgmDisconnectSource(sourceId);
              renderControlsPanel();
              _pgmSyncSources();
              // Auto-reconnect
              _ndiAudioRetryTimers[sourceId] = setTimeout(() => {
                delete _ndiAudioRetryTimers[sourceId];
                _startNdiAudioStream(sourceId, srcConfig);
              }, 2000);
            }
          };
        }
        _ndiAudioStreams[sourceId] = stream;
        // Do NOT overwrite _activeStreams[sourceId] — it may hold the NDI
        // video (camera) stream.  Overwriting it with the audio-only stream
        // causes the video feed to disappear on the next compositor render.
        // The audio mixer picks up NDI audio through _ndiAudioStreams instead.
        _ctrlHydrateSourceState(sourceId);
        _ctrlApplyMuteToStream(sourceId, stream);
        // Apply volume
        const vol = (srcConfig.ndiAudioVolume != null ? srcConfig.ndiAudioVolume : 100) / 100;
        _ctrlVolumes[sourceId] = Math.min(2, vol);

        renderControlsPanel();
        _pgmSyncSources();
        console.log('[ndi-audio] Audio stream started for source:', sourceId, '| device:', track?.label);
        return stream;
      } catch (e) {
        console.warn('[ndi-audio] Failed to start audio stream:', e.message);
        // Schedule retry
        _ndiAudioRetryTimers[sourceId] = setTimeout(() => {
          delete _ndiAudioRetryTimers[sourceId];
          _startNdiAudioStream(sourceId, srcConfig);
        }, 5000);
        return null;
      }
    }

    /* ---- Window / Screen Capture Enumeration ---- */
    let _desktopSourcesCache = [];
    let _windowCapturePreselectId = null;

    async function enumerateDesktopSources() {
      const sel = document.getElementById('src-cfg-window');
      if (!sel) return;
      sel.innerHTML = '<option value="">Enumerating windows…</option>';
      try {
        if (window.BSPDesktop && typeof window.BSPDesktop.getDesktopSources === 'function') {
          const result = await window.BSPDesktop.getDesktopSources({ types: ['window', 'screen'] });
          if (!result || !result.ok || !result.sources || !result.sources.length) {
            sel.innerHTML = '<option value="">No windows found</option>';
            _desktopSourcesCache = [];
            return;
          }
          _desktopSourcesCache = result.sources;
          sel.innerHTML = '<option value="">Select a window or screen…</option>';
          // Add screens first
          const screens = result.sources.filter(s => s.id && s.id.startsWith('screen:'));
          const windows = result.sources.filter(s => s.id && s.id.startsWith('window:'));
          if (screens.length) {
            const grp = document.createElement('optgroup');
            grp.label = 'Screens';
            screens.forEach(s => {
              const opt = document.createElement('option');
              opt.value = s.id;
              opt.textContent = s.name || 'Screen';
              grp.appendChild(opt);
            });
            sel.appendChild(grp);
          }
          if (windows.length) {
            const grp = document.createElement('optgroup');
            grp.label = 'Application Windows';
            windows.forEach(s => {
              const opt = document.createElement('option');
              opt.value = s.id;
              opt.textContent = s.name || 'Window';
              grp.appendChild(opt);
            });
            sel.appendChild(grp);
          }
          // Restore saved selection
          if (_windowCapturePreselectId) {
            const match = [...sel.options].find(o => o.value === _windowCapturePreselectId);
            if (match) sel.value = _windowCapturePreselectId;
            _windowCapturePreselectId = null;
          }
          // Auto-fill name from window selection
          sel.onchange = () => {
            const nameInp = document.getElementById('src-cfg-name');
            const selected = sel.options[sel.selectedIndex];
            if (nameInp && selected && selected.value) {
              const defaultName = SOURCE_TYPE_LABELS['window-capture'] || 'Window Capture';
              if (nameInp.value === defaultName || nameInp.value === '') {
                nameInp.value = selected.textContent;
              }
            }
            // Show thumbnail preview
            const cached = _desktopSourcesCache.find(s => s.id === sel.value);
            _updateWindowCapturePreview(cached);
          };
        } else {
          // Fallback: use getDisplayMedia prompt (no enumeration)
          sel.innerHTML = '<option value="prompt">System picker (screen share dialog)</option>';
        }
      } catch (e) {
        console.warn('[window-capture] enumeration error:', e);
        sel.innerHTML = '<option value="prompt">System picker (screen share dialog)</option>';
      }
      // Add refresh button
      const parent = sel.closest('.src-cfg-group');
      if (parent && !parent.querySelector('.window-refresh-btn')) {
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'sp-btn-secondary window-refresh-btn';
        refreshBtn.textContent = 'Refresh';
        refreshBtn.style.cssText = 'margin-top:6px;padding:4px 12px;font-size:11px;cursor:pointer;';
        refreshBtn.onclick = (e) => { e.preventDefault(); enumerateDesktopSources(); };
        sel.insertAdjacentElement('afterend', refreshBtn);
      }
    }

    function _updateWindowCapturePreview(source) {
      let container = document.getElementById('src-cfg-window-preview');
      if (!container) {
        const body = document.getElementById('source-config-body');
        if (!body) return;
        container = document.createElement('div');
        container.id = 'src-cfg-window-preview';
        container.style.cssText = 'margin:8px 0 0;border-radius:8px;overflow:hidden;background:#000;aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;';
        // Insert after the window select group
        const winGroup = document.getElementById('src-cfg-window')?.closest('.src-cfg-group');
        if (winGroup) winGroup.appendChild(container);
        else body.appendChild(container);
      }
      if (source && source.thumbnail) {
        container.innerHTML = `<img src="${source.thumbnail}" style="width:100%;height:100%;object-fit:contain">`;
      } else {
        container.innerHTML = '<span style="color:rgba(255,255,255,.3);font-size:11px">No preview</span>';
      }
    }

    /* ---- Window Capture Stream Management ---- */
    const _windowCaptureStreams = {}; // sourceId → MediaStream

    async function _startWindowCapture(sourceId, windowId, opts = {}) {
      _stopWindowCapture(sourceId);
      try {
        // Electron's desktopCapturer provides source IDs that can be used
        // with getUserMedia's chromeMediaSource constraint
        const constraints = {
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: windowId
            }
          }
        };
        if (opts.captureCursor === false) {
          constraints.video.mandatory.cursor = 'never';
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        _windowCaptureStreams[sourceId] = stream;
        // Monitor track end
        const track = stream.getVideoTracks()[0];
        if (track) {
          track.onended = () => {
            delete _windowCaptureStreams[sourceId];
            renderProgramDisplay();
          };
        }
        // Attach to video element if it exists
        const vid = document.querySelector(`#source-compositor .src-layer[data-src-id="${sourceId}"] video`);
        if (vid) {
          vid.srcObject = stream;
          vid.play().catch(() => {});
        }
        return stream;
      } catch (e) {
        console.warn('[window-capture] Stream failed:', e.message);
        // Fallback: offer getDisplayMedia system picker
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: opts.captureCursor !== false ? 'always' : 'never' },
            audio: false
          });
          _windowCaptureStreams[sourceId] = stream;
          const track = stream.getVideoTracks()[0];
          if (track) {
            track.onended = () => {
              delete _windowCaptureStreams[sourceId];
              renderProgramDisplay();
            };
          }
          const vid = document.querySelector(`#source-compositor .src-layer[data-src-id="${sourceId}"] video`);
          if (vid) {
            vid.srcObject = stream;
            vid.play().catch(() => {});
          }
          return stream;
        } catch (e2) {
          console.warn('[window-capture] Fallback getDisplayMedia also failed:', e2.message);
          return null;
        }
      }
    }

    function _stopWindowCapture(sourceId) {
      const stream = _windowCaptureStreams[sourceId];
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        delete _windowCaptureStreams[sourceId];
      }
    }

