    function buildSourceConfigFields(type) {
      const _g = (label, id, inner, hint) =>
        `<div class="src-cfg-group">`
        + `<label class="src-cfg-label" for="${id}">${label}</label>`
        + inner
        + (hint ? `<span class="src-cfg-hint">${hint}</span>` : '')
        + `</div>`;

      const nameField = _g('Name', 'src-cfg-name',
        `<input class="sp-input" id="src-cfg-name" placeholder="${SOURCE_TYPE_LABELS[type] || type}" value="${SOURCE_TYPE_LABELS[type] || type}">`);
      const inputModeField = _g('Input', 'src-cfg-input-mode',
        `<div class="src-cfg-inline-select" id="src-cfg-input-mode">`
        + `<button type="button" class="seg-opt" data-v="mono">Mono</button>`
        + `<button type="button" class="seg-opt active" data-v="stereo">Stereo</button>`
        + `</div>`,
        'Set channel format before FX and sends');

      switch (type) {
        /* ───────── Camera ───────── */
        case 'camera':
          return nameField
            + inputModeField
            + _g('Device', 'src-cfg-device',
                `<select class="sp-input" id="src-cfg-device" onchange="_updateSourcePreview()"><option value="">Select camera</option></select>`)
            + `<div class="src-cfg-row">`
            +   _g('Resolution', 'src-cfg-resolution',
                  `<div class="src-cfg-inline-select" id="src-cfg-resolution">`
                  + `<button type="button" class="seg-opt active" data-v="auto">Auto</button>`
                  + `<button type="button" class="seg-opt" data-v="720">720p</button>`
                  + `<button type="button" class="seg-opt" data-v="1080">1080p</button>`
                  + `<button type="button" class="seg-opt" data-v="2160">4K</button>`
                  + `</div>`)
            +   _g('Frame Rate', 'src-cfg-fps',
                  `<div class="src-cfg-inline-select" id="src-cfg-fps">`
                  + `<button type="button" class="seg-opt active" data-v="auto">Auto</button>`
                  + `<button type="button" class="seg-opt" data-v="24">24</button>`
                  + `<button type="button" class="seg-opt" data-v="30">30</button>`
                  + `<button type="button" class="seg-opt" data-v="60">60</button>`
                  + `<button type="button" class="seg-opt" data-v="120">120</button>`
                  + `</div>`)
            + `</div>`
            + `<div class="src-cfg-toggle-row">`
            +   `<span class="src-cfg-label" style="margin:0">Mirror Horizontally</span>`
            +   `<span class="src-cfg-mini-toggle" id="src-cfg-mirror" onclick="this.classList.toggle('on')"></span>`
            + `</div>`
            + `<div id="src-cfg-preview"><div class="preview-placeholder">Select a camera to preview</div></div>`;

        /* ───────── Audio Input ───────── */
        case 'audio-input':
          return nameField
            + inputModeField
            + _g('Device', 'src-cfg-device',
                `<select class="sp-input" id="src-cfg-device" onchange="onSourceConfigAudioInputChanged()"><option value="">Select audio input</option></select>`)
            + `<div class="src-cfg-toggle-row">`
            +   `<span class="src-cfg-label" style="margin:0">Monitor Audio</span>`
            +   `<span class="src-cfg-mini-toggle" id="src-cfg-monitor" onclick="this.classList.toggle('on')"></span>`
            + `</div>`
            + _g('Gain', 'src-cfg-gain',
                `<input class="sp-input" id="src-cfg-gain" type="range" min="0" max="200" value="100" style="width:100%;accent-color:var(--accent,#0a84ff)">`,
                '100 %');

        /* ───────── Image ───────── */
        case 'image':
          return nameField
            + _g('File', 'src-cfg-file',
                `<input class="sp-input" id="src-cfg-file" type="file" accept="image/*">`)
            + _g('Opacity', 'src-cfg-opacity',
                `<input class="sp-input" id="src-cfg-opacity" type="range" min="0" max="100" value="100" style="width:100%;accent-color:var(--accent,#0a84ff)">`,
                '100 %');

        /* ───────── Text (GFX) ───────── */
        case 'text':
          return nameField
            + _g('Text Content', 'src-cfg-text',
                `<textarea class="sp-input" id="src-cfg-text" rows="3" placeholder="${esc(t('source_config_enter_text'))}" style="resize:vertical;min-height:60px"></textarea>`)
            + `<div class="src-cfg-row">`
            +   _g('Font Family', 'src-cfg-font',
                  `<select class="sp-input" id="src-cfg-font">`
                  + `<option value="SF Pro Display, -apple-system, sans-serif">SF Pro Display</option>`
                  + `<option value="Helvetica Neue, Helvetica, sans-serif">Helvetica Neue</option>`
                  + `<option value="Arial, sans-serif">Arial</option>`
                  + `<option value="Georgia, serif">Georgia</option>`
                  + `<option value="Courier New, monospace">Courier New</option>`
                  + `<option value="Impact, sans-serif">Impact</option>`
                  + `</select>`)
            +   _g('Size', 'src-cfg-fontsize',
                  `<input class="sp-input" id="src-cfg-fontsize" type="number" min="8" max="400" value="48" step="1" style="width:100%">`)
            + `</div>`
            + `<div class="src-cfg-row">`
            +   _g('Font Color', 'src-cfg-color',
                  `<input id="src-cfg-color" type="color" value="#ffffff" style="width:100%;height:32px;border:none;border-radius:6px;cursor:pointer;background:transparent">`)
            +   _g('Background', 'src-cfg-bgcolor',
                  `<input id="src-cfg-bgcolor" type="color" value="#000000" style="width:100%;height:32px;border:none;border-radius:6px;cursor:pointer;background:transparent">`)
            + `</div>`
            + _g('Alignment', 'src-cfg-align',
                `<div class="src-cfg-inline-select" id="src-cfg-align">`
                + `<span class="seg-opt" data-v="left">Left</span>`
                + `<span class="seg-opt active" data-v="center">Center</span>`
                + `<span class="seg-opt" data-v="right">Right</span>`
                + `</div>`)
            + `<div class="src-cfg-toggle-row">`
            +   `<span class="src-cfg-label" style="margin:0">Word Wrap</span>`
            +   `<span class="src-cfg-mini-toggle on" id="src-cfg-wordwrap" onclick="this.classList.toggle('on')"></span>`
            + `</div>`
            + `<div class="src-cfg-toggle-row">`
            +   `<span class="src-cfg-label" style="margin:0">Show Background</span>`
            +   `<span class="src-cfg-mini-toggle" id="src-cfg-showbg" onclick="this.classList.toggle('on')"></span>`
            + `</div>`;

        /* ───────── Media Source ───────── */
        case 'media-source':
          return nameField
            + inputModeField
            + `<div class="src-cfg-group">`
            +   `<label class="src-cfg-label">File</label>`
            +   `<div style="display:flex;gap:8px;align-items:center">`
            +     `<input class="sp-input" id="src-cfg-file-path" type="text" readonly placeholder="${esc(t('source_config_select_media_browse'))}" onclick="triggerSourceMediaFilePicker(event)" style="margin:0;flex:1;cursor:pointer">`
            +     `<button type="button" class="sp-btn-secondary" onclick="triggerSourceMediaFilePicker(event)">Browse…</button>`
            +   `</div>`
            +   `<input class="sp-input" id="src-cfg-file" type="file" accept="video/*,audio/*" onchange="onSourceConfigMediaFileChosen()" style="display:none">`
            +   `<span class="src-cfg-hint" id="src-cfg-file-hint">${esc(t('common_no_file_selected'))}</span>`
            + `</div>`
            + `<div class="src-cfg-toggle-row">`
            +   `<span class="src-cfg-label" style="margin:0">Loop Playback</span>`
            +   `<span class="src-cfg-mini-toggle on" id="src-cfg-loop" onclick="this.classList.toggle('on')"></span>`
            + `</div>`
            + `<div class="src-cfg-toggle-row">`
            +   `<span class="src-cfg-label" style="margin:0">Auto-play when Live</span>`
            +   `<span class="src-cfg-mini-toggle on" id="src-cfg-autoplay" onclick="this.classList.toggle('on')"></span>`
            + `</div>`
            + _g('Volume', 'src-cfg-volume',
                `<input class="sp-input" id="src-cfg-volume" type="range" min="0" max="100" value="100" style="width:100%;accent-color:var(--accent,#0a84ff)">`,
                '100 %');

        /* ───────── NDI® ───────── */
        case 'ndi':
          return nameField
            + inputModeField
            + _g('NDI Source', 'src-cfg-ndi',
                `<select class="sp-input" id="src-cfg-ndi"><option>Searching…</option></select>`,
                'Discovers cameras and devices on your local network via NDI\u00ae')
            + `<div class="src-cfg-row">`
            +   _g('Resolution', 'src-cfg-resolution',
                  `<div class="src-cfg-inline-select" id="src-cfg-resolution">`
                  + `<button type="button" class="seg-opt active" data-v="auto">Auto</button>`
                  + `<button type="button" class="seg-opt" data-v="720">720p</button>`
                  + `<button type="button" class="seg-opt" data-v="1080">1080p</button>`
                  + `<button type="button" class="seg-opt" data-v="2160">4K</button>`
                  + `</div>`)
            +   _g('Frame Rate', 'src-cfg-fps',
                  `<div class="src-cfg-inline-select" id="src-cfg-fps">`
                  + `<button type="button" class="seg-opt active" data-v="auto">Auto</button>`
                  + `<button type="button" class="seg-opt" data-v="24">24</button>`
                  + `<button type="button" class="seg-opt" data-v="30">30</button>`
                  + `<button type="button" class="seg-opt" data-v="60">60</button>`
                  + `<button type="button" class="seg-opt" data-v="120">120</button>`
                  + `</div>`)
            + `</div>`
            + `<div class="src-cfg-toggle-row">`
            +   `<span class="src-cfg-label" style="margin:0">Low-Bandwidth Mode</span>`
            +   `<span class="src-cfg-mini-toggle" id="src-cfg-ndi-lowbw" onclick="this.classList.toggle('on')"></span>`
            + `</div>`
            + `<div style="margin:14px 0 6px;padding:10px 12px;border-radius:8px;background:rgba(167,139,250,.08);border:1px solid rgba(167,139,250,.18)">`
            +   `<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">`
            +     `<svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;flex-shrink:0"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`
            +     `<span style="font-size:12px;font-weight:600;color:#c4b5fd">NDI Audio</span>`
            +   `</div>`
            +   `<div class="src-cfg-toggle-row" style="margin:0 0 8px 0">`
            +     `<span class="src-cfg-label" style="margin:0;font-size:12px">Enable Audio</span>`
            +     `<span class="src-cfg-mini-toggle on" id="src-cfg-ndi-audio" onclick="this.classList.toggle('on');_onNdiAudioToggled()"></span>`
            +   `</div>`
            +   _g('Audio Device', 'src-cfg-ndi-audio-device',
                  `<select class="sp-input" id="src-cfg-ndi-audio-device" style="font-size:12px"><option value="auto">Auto-detect NDI audio</option></select>`,
                  'Select the NDI audio input device, or leave on Auto-detect')
            +   `<div class="src-cfg-toggle-row" style="margin:4px 0 6px 0">`
            +     `<span class="src-cfg-label" style="margin:0;font-size:12px">Monitor Audio</span>`
            +     `<span class="src-cfg-mini-toggle" id="src-cfg-ndi-monitor" onclick="this.classList.toggle('on')"></span>`
            +   `</div>`
            +   _g('Volume', 'src-cfg-ndi-volume',
                  `<input class="sp-input" id="src-cfg-ndi-volume" type="range" min="0" max="200" value="100" style="width:100%;accent-color:#a78bfa">`,
                  '100 %')
            +   `<div id="src-cfg-ndi-audio-status" style="font-size:10px;color:#8899aa;margin-top:4px"></div>`
            + `</div>`
            + `<div class="src-cfg-info">`
            +   `<strong style="color:var(--accent,#0a84ff)">NDI\u00ae Network Source</strong><br>`
            +   `Discovers NDI-enabled cameras, capture cards and software sources on your local network using Bonjour/mDNS. `
            +   `The sender device must have NDI\u00ae enabled and be on the same network/subnet.`
            +   `<br><span style="opacity:.55">NDI carries both video and audio. Enable audio above to receive the embedded audio signal.</span>`
            + `</div>`;

        /* ───────── Scene ───────── */
        case 'scene':
          return nameField
            + _g('Scene', 'src-cfg-scene',
                `<select class="sp-input" id="src-cfg-scene">${_scenes.map(s => `<option>${esc(s.name)}</option>`).join('') || '<option>No scenes available</option>'}</select>`);

        /* ───────── Window Capture ───────── */
        case 'window-capture':
          return nameField
            + _g('Window', 'src-cfg-window',
                `<select class="sp-input" id="src-cfg-window"><option>Select a window…</option></select>`)
            + `<div class="src-cfg-toggle-row">`
            +   `<span class="src-cfg-label" style="margin:0">Capture Cursor</span>`
            +   `<span class="src-cfg-mini-toggle on" id="src-cfg-cursor" onclick="this.classList.toggle('on')"></span>`
            + `</div>`;

        default:
          return nameField;
      }
    }

    /* Wire up segmented-control clicks inside source config */
    document.addEventListener('click', function(e) {
      const seg = e.target.closest('.src-cfg-inline-select .seg-opt');
      if (!seg) return;
      const parent = seg.parentElement;
      parent.querySelectorAll('.seg-opt').forEach(s => s.classList.remove('active'));
      seg.classList.add('active');
      /* Update range hint labels that display current % */
      const id = parent.id;
      if (id === 'src-cfg-resolution' || id === 'src-cfg-fps' || id === 'src-cfg-fitmode') _updateSourcePreview();
      if (id === 'src-cfg-fitmode') {
        const group = parent.closest('.src-cfg-group');
        const hint = group ? group.querySelector('.src-cfg-hint') : null;
        if (hint) hint.textContent = _sourceFitModeHintText(_segVal('src-cfg-fitmode') || 'contain');
      }
    });
    /* Live-update range slider hints */
    document.addEventListener('input', function(e) {
      if (e.target.type !== 'range') return;
      const group = e.target.closest('.src-cfg-group');
      if (!group) return;
      const hint = group.querySelector('.src-cfg-hint');
      if (!hint) return;
      const id = String(e.target.id || '');
      const valueNum = Number(e.target.value);
      if (id === 'src-cfg-pan') {
        const pan = _normalizeSourcePan(valueNum);
        hint.textContent = pan === 0 ? 'C' : (pan < 0 ? `L${Math.abs(pan)}` : `R${pan}`);
      } else if (id === 'src-cfg-width') {
        hint.textContent = `${_normalizeSourceWidth(valueNum)} %`;
      } else {
        hint.textContent = e.target.value + ' %';
      }
    });

    function onSourceConfigAudioInputChanged() {
      const sourceType = _pendingSourceType || (_editingSourceEl ? _editingSourceEl.dataset.sourceType : '');
      if (sourceType !== 'audio-input' || !_editingSourceEl) return;
      const sel = document.getElementById('src-cfg-device');
      if (!sel) return;
      const scene = _activeScene();
      if (!scene) return;
      const srcId = _editingSourceEl.dataset.sourceId;
      const srcData = scene.sources.find((s) => s.id === srcId);
      if (!srcData) return;
      if (!srcData.config) srcData.config = {};
      srcData.config.deviceId = sel.value || '';
      srcData.config.deviceLabel = sel.options[sel.selectedIndex]?.text || '';
      _startAudioInputStream(srcId, srcData.config.deviceId).then(() => {
        _refreshSourceFxAudio(srcId);
      });
      schedulePersistAppState();
    }

    function _sourceFilePathFromSelection(fileInput, file) {
      // Electron exposes file.path with the real filesystem path
      if (file && typeof file.path === 'string' && file.path.trim()) return file.path.trim();
      // Fallback to just the file name — never show the browser's C:\fakepath\ value
      if (file && file.name) return file.name;
      return '';
    }

    let _desktopMediaPickerAvailable = true;

    async function triggerSourceMediaFilePicker(ev) {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      if (_desktopMediaPickerAvailable && window.BSPDesktop && typeof window.BSPDesktop.pickMediaFile === 'function') {
        try {
          const result = await window.BSPDesktop.pickMediaFile();
          if (!result || !result.ok) return;
          // Store result on a temp object so gatherSourceConfig can use it
          _pendingMediaPickResult = result;
          const pathInput = document.getElementById('src-cfg-file-path');
          const hint = document.getElementById('src-cfg-file-hint');
          if (pathInput) pathInput.value = result.path || result.fileName || '';
          if (hint) hint.textContent = t('source_config_selected_file').replace('{file}', result.path || result.fileName || 'file');
          return;
        } catch (e) {
          const msg = String(e && e.message || '');
          if (/No handler registered/i.test(msg)) {
            _desktopMediaPickerAvailable = false;
          }
        }
      }
      // Fallback to HTML file input
      const fileInput = document.getElementById('src-cfg-file');
      if (fileInput && typeof fileInput.click === 'function') fileInput.click();
    }
    let _pendingMediaPickResult = null;

    function onSourceConfigMediaFileChosen() {
      const fileInput = document.getElementById('src-cfg-file');
      const pathInput = document.getElementById('src-cfg-file-path');
      const hint = document.getElementById('src-cfg-file-hint');
      const file = (fileInput && fileInput.files && fileInput.files[0]) ? fileInput.files[0] : null;
      const filePath = _sourceFilePathFromSelection(fileInput, file);
      if (pathInput) pathInput.value = filePath || '';
      if (hint) {
        if (file) hint.textContent = t('source_config_selected_file').replace('{file}', filePath || file.name || 'file');
        else hint.textContent = t('common_no_file_selected');
      }
    }

    function confirmAddSource() {
      const nameInput = document.getElementById('src-cfg-name');
      const sourceType = _pendingSourceType || (_editingSourceEl ? _editingSourceEl.dataset.sourceType : '');
      const rawName = nameInput ? nameInput.value.trim() : (sourceType || 'Source');
      const name = _sanitizeSourceNameForType(rawName, sourceType) || rawName;
      if (nameInput && nameInput.value !== name) nameInput.value = name;
      if (!name) return;
      const isEditMode = !!_editingSourceEl;
      // Gather config from dialog fields
      const existingMode = document.querySelector('input[name="src-existing-mode"]:checked')?.value || 'new';
      const existingId = document.getElementById('src-cfg-existing-id')?.value || '';
      if (!_editingSourceEl && existingMode === 'existing' && existingId) {
        const activeScene = _activeScene();
        const found = _findSourceWithSceneById(existingId);
        if (!activeScene || !found || !found.src) return;

        const existingEl = document.querySelector(`.source-list-item[data-source-id="${existingId}"]`);
        if (found.scene && String(found.scene.id || '') === String(activeScene.id || '') && existingEl) {
          selectSourceItem(existingEl);
          closeSourceConfig();
          if (typeof showToast === 'function') showToast(t('source_config_using_existing_layer'));
          return;
        }

        const copied = _cloneSourceForScene(found.src);
        if (!copied) return;
        copied.name = _makeUniqueSourceNameInScene(activeScene, copied.name);
        _ensureSourceAudioFxDefaults(copied);
        activeScene.sources.push(copied);
        renderSourceItem(copied);
        const newEl = document.querySelector(`.source-list-item[data-source-id="${copied.id}"]`) || document.getElementById('sources-list')?.lastElementChild;
        if (newEl) selectSourceItem(newEl);
        closeSourceConfig();
        renderProgramDisplay();
        schedulePersistAppState();
        if (typeof showToast === 'function') showToast(t('source_config_added_existing_layer_from').replace('{scene}', found.scene?.name || 'another scene'));
        return;
      }
      const activeScene = _activeScene();
      const exceptSourceId = _editingSourceEl ? _editingSourceEl.dataset.sourceId : '';
      const dup = _findDuplicateSourceNameInScene(activeScene, name, exceptSourceId);
      if (dup) {
        if (typeof showToast === 'function') showToast(t('source_config_layer_name_exists').replace('{name}', name));
        if (nameInput) {
          nameInput.focus();
          nameInput.select();
        }
        return;
      }
      const config = gatherSourceConfig(sourceType);
      const src_type_for_resolve = sourceType; // capture for async use
      if (_editingSourceEl) {
        // Editing existing source — update name & config in DOM and data model
        _editingSourceEl.querySelector('.sli-label').textContent = name;
        const scene = _activeScene();
        const editSrcId = _editingSourceEl.dataset.sourceId;
        let prevDeviceId = '';
        let prevInputMode = 'stereo';
        let prevPan = 0;
        let prevWidth = 100;
        let prevMediaSignature = '';
        let nextMediaSignature = '';
        let prevNdiSourceName = '';
        let nextNdiSourceName = '';
        let prevNdiCameraDeviceId = '';
        let nextNdiCameraDeviceId = '';
        let prevNdiResolution = 'auto';
        let nextNdiResolution = 'auto';
        let prevNdiFps = 'auto';
        let nextNdiFps = 'auto';
        if (scene) {
          const srcData = scene.sources.find(s => s.id === editSrcId);
          if (srcData) {
            prevDeviceId = String(srcData.config && srcData.config.deviceId || '');
            prevInputMode = _normalizeSourceInputMode(srcData.config && srcData.config.inputMode);
            prevPan = _normalizeSourcePan(srcData.config && srcData.config.pan);
            prevWidth = _normalizeSourceWidth(srcData.config && srcData.config.width);
            if (sourceType === 'ndi') {
              prevNdiSourceName = String((srcData.config && srcData.config.ndiSourceName) || '');
              prevNdiCameraDeviceId = String((srcData.config && srcData.config.cameraDeviceId) || '');
              prevNdiResolution = String((srcData.config && srcData.config.resolution) || 'auto');
              prevNdiFps = String((srcData.config && srcData.config.fps) || 'auto');
            }
            if (sourceType === 'media-source') {
              prevMediaSignature = String((srcData.config && (srcData.config.dataUrl || srcData.config.filePath || srcData.config.fileName)) || '');
            }
            srcData.name = name;
            Object.assign(srcData.config || (srcData.config = {}), config);
            if (sourceType === 'ndi') {
              nextNdiSourceName = String((srcData.config && srcData.config.ndiSourceName) || '');
              nextNdiCameraDeviceId = String((srcData.config && srcData.config.cameraDeviceId) || '');
              nextNdiResolution = String((srcData.config && srcData.config.resolution) || 'auto');
              nextNdiFps = String((srcData.config && srcData.config.fps) || 'auto');
            }
            if (sourceType === 'media-source') {
              nextMediaSignature = String((srcData.config && (srcData.config.dataUrl || srcData.config.filePath || srcData.config.fileName)) || '');
            }
            _ensureSourceAudioFxDefaults(srcData);
          }
        }
        // Stop existing stream so the compositor picks up the new device
        if (sourceType === 'camera') {
          _stopStream(editSrcId);
        }
        if (sourceType === 'media-source') {
          // Recreate video element only if media changed; otherwise keep playback state.
          if (prevMediaSignature !== nextMediaSignature) {
            _disposeMediaSourceVideo(editSrcId, true);
          }
        }
        if (sourceType === 'audio-input') {
          const nextDeviceId = String(config.deviceId || '');
          if (nextDeviceId !== prevDeviceId || !_activeStreams[editSrcId]) {
            _startAudioInputStream(editSrcId, nextDeviceId).then(() => _refreshSourceFxAudio(editSrcId));
          }
        }
        if (_isAudioCapableSourceType(sourceType)) {
          const nextInputMode = _normalizeSourceInputMode(config.inputMode);
          const nextPan = _normalizeSourcePan(config.pan);
          const nextWidth = _normalizeSourceWidth(config.width);
          if (nextInputMode !== prevInputMode || nextPan !== prevPan || nextWidth !== prevWidth) _pgmSyncSources();
        }
        // If camera device changed on an NDI source, reset attempt cache so it retries
        if (sourceType === 'ndi') {
          const ndiChanged =
            prevNdiSourceName !== nextNdiSourceName
            || prevNdiCameraDeviceId !== nextNdiCameraDeviceId
            || prevNdiResolution !== nextNdiResolution
            || prevNdiFps !== nextNdiFps;
          if (ndiChanged) {
            // Hard reset old stream/bridge so new source takes effect immediately.
            const prevBridge = _ndiBridgeState[editSrcId];
            if (prevBridge && prevBridge.renderer) {
              try { prevBridge.renderer.stop(); } catch (_) {}
              prevBridge.renderer = null;
            }
            _stopNdiRetry(editSrcId);
            _stopNdiAudioStream(editSrcId);
            _stopStream(editSrcId);
            delete _ndiCameraAttempted[editSrcId];
          }
          // Clear old NDI state for re-resolve
          const srcData = scene ? scene.sources.find(s => s.id === editSrcId) : null;
          if (srcData && srcData.config) {
            delete srcData.config._resolving;
            delete srcData.config.ndiHost;
            delete srcData.config.ndiPort;
          }
        }
        // Window capture: stop old stream so new window selection takes effect
        if (sourceType === 'window-capture') {
          _stopWindowCapture(editSrcId);
        }
        _editingSourceEl = null;
      } else {
        // Adding new source to active scene
        const scene = _activeScene();
        if (!scene) return;
        const src = { id: _genSourceId(), type: _pendingSourceType, name, visible: true, transformLocked: false, config };
        _ensureSourceAudioFxDefaults(src);
        scene.sources.push(src);
        renderSourceItem(src);
        // Select the new item
        const lastEl = document.getElementById('sources-list').lastElementChild;
        if (lastEl) selectSourceItem(lastEl);
      }
      closeSourceConfig();
      renderProgramDisplay();
      saveState(isEditMode ? 'Edit Source' : ('Add Source: ' + name));
      schedulePersistAppState();
      // For NDI sources, resolve host/port in background
      if ((src_type_for_resolve === 'ndi') && config.ndiSourceName) {
        _resolveNdiSourceConfig(config.ndiSourceName).then(resolved => {
          if (resolved && resolved.ok) {
            // Find and update the source config in data model
            const sc = _activeScene();
            if (sc) {
              const s = sc.sources.find(x => x.config && x.config.ndiSourceName === config.ndiSourceName);
              if (s) {
                s.config.ndiHost = resolved.host;
                s.config.ndiPort = resolved.port;
                renderProgramDisplay();
                schedulePersistAppState();
              }
            }
          }
        });
      }
    }

    async function _resolveNdiSourceConfig(ndiSourceName, domain) {
      if (window.BSPDesktop && typeof window.BSPDesktop.resolveNdiSource === 'function') {
        try {
          return await window.BSPDesktop.resolveNdiSource({ name: ndiSourceName, domain: domain || 'local' });
        } catch (e) {
          console.warn('NDI resolve error:', e);
          return { ok: false };
        }
      }
      return { ok: false };
    }

    /** Collect config values from the currently open source config dialog */
    /** Helper: read active value from a segmented control */
    function _segVal(id) {
      const el = document.getElementById(id);
      if (!el) return '';
      const active = el.querySelector('.seg-opt.active');
      return active ? (active.dataset.v || active.textContent.trim()) : '';
    }
    /** Helper: read mini-toggle on/off state */
    function _togVal(id) {
      const el = document.getElementById(id);
      return el ? el.classList.contains('on') : false;
    }

    function gatherSourceConfig(type) {
      const cfg = {};
      switch (type) {
        case 'camera': {
          cfg.inputMode = _normalizeSourceInputMode(_segVal('src-cfg-input-mode'));
          const sel = document.getElementById('src-cfg-device');
          if (sel) { cfg.deviceId = sel.value; cfg.deviceLabel = sel.options[sel.selectedIndex]?.text || ''; }
          cfg.resolution = _segVal('src-cfg-resolution') || 'auto';
          cfg.fps = _segVal('src-cfg-fps') || 'auto';
          cfg.mirror = _togVal('src-cfg-mirror');
          break;
        }
        case 'audio-input': {
          cfg.inputMode = _normalizeSourceInputMode(_segVal('src-cfg-input-mode'));
          const sel = document.getElementById('src-cfg-device');
          if (sel) { cfg.deviceId = sel.value; cfg.deviceLabel = sel.options[sel.selectedIndex]?.text || ''; }
          cfg.monitor = _togVal('src-cfg-monitor');
          const gainEl = document.getElementById('src-cfg-gain');
          cfg.gain = gainEl ? parseInt(gainEl.value, 10) : 100;
          break;
        }
        case 'image': {
          const fileInput = document.getElementById('src-cfg-file');
          if (fileInput && fileInput.files && fileInput.files[0]) {
            cfg._file = fileInput.files[0];
            cfg.fileName = fileInput.files[0].name;
          }
          const opEl = document.getElementById('src-cfg-opacity');
          cfg.opacity = opEl ? parseInt(opEl.value, 10) : 100;
          break;
        }
        case 'media-source': {
          cfg.inputMode = _normalizeSourceInputMode(_segVal('src-cfg-input-mode'));
          const fileInput = document.getElementById('src-cfg-file');
          const pathInput = document.getElementById('src-cfg-file-path');
          const typedPath = pathInput ? String(pathInput.value || '').trim() : '';
          if (_pendingMediaPickResult && _pendingMediaPickResult.ok) {
            cfg.fileName = _pendingMediaPickResult.fileName || '';
            cfg.filePath = _pendingMediaPickResult.path || _pendingMediaPickResult.fileName || '';
            cfg.dataUrl = 'media-file://media' + encodeURI(cfg.filePath);
            _pendingMediaPickResult = null;
          } else if (fileInput && fileInput.files && fileInput.files[0]) {
            const picked = fileInput.files[0];
            cfg._file = picked;
            cfg.fileName = picked.name;
            cfg.filePath = _sourceFilePathFromSelection(fileInput, picked) || typedPath || picked.name;
          } else if (typedPath) {
            cfg.filePath = typedPath;
          }
          cfg.loop = _togVal('src-cfg-loop');
          cfg.autoplay = _togVal('src-cfg-autoplay');
          const volEl = document.getElementById('src-cfg-volume');
          cfg.volume = volEl ? parseInt(volEl.value, 10) : 100;
          break;
        }
        case 'text': {
          const inp = document.getElementById('src-cfg-text');
          if (inp) cfg.text = inp.value;
          const fontSel = document.getElementById('src-cfg-font');
          if (fontSel) cfg.fontFamily = fontSel.value;
          const sizeInp = document.getElementById('src-cfg-fontsize');
          cfg.fontSize = sizeInp ? parseInt(sizeInp.value, 10) || 48 : 48;
          const colorInp = document.getElementById('src-cfg-color');
          cfg.color = colorInp ? colorInp.value : '#ffffff';
          const bgColorInp = document.getElementById('src-cfg-bgcolor');
          cfg.bgColor = bgColorInp ? bgColorInp.value : '#000000';
          cfg.align = _segVal('src-cfg-align') || 'center';
          cfg.wordWrap = _togVal('src-cfg-wordwrap');
          cfg.showBg = _togVal('src-cfg-showbg');
          break;
        }
        case 'scene': {
          const sel = document.getElementById('src-cfg-scene');
          if (sel) cfg.sceneName = sel.value;
          break;
        }
        case 'ndi': {
          cfg.inputMode = _normalizeSourceInputMode(_segVal('src-cfg-input-mode'));
          const sel = document.getElementById('src-cfg-ndi');
          if (sel && sel.value) {
            cfg.ndiSourceName = sel.value;
            cfg.ndiDisplayLabel = sel.options[sel.selectedIndex]?.text || sel.value;
            cfg.ndiDomain = sel.options[sel.selectedIndex]?.dataset?.domain || 'local';
          }
          cfg.resolution = _segVal('src-cfg-resolution') || 'auto';
          cfg.fps = _segVal('src-cfg-fps') || 'auto';
          cfg.lowBandwidth = _togVal('src-cfg-ndi-lowbw');
          // NDI Audio settings
          cfg.ndiAudioEnabled = _togVal('src-cfg-ndi-audio');
          const audioDevSel = document.getElementById('src-cfg-ndi-audio-device');
          if (audioDevSel) {
            cfg.ndiAudioDeviceId = audioDevSel.value || 'auto';
            cfg.ndiAudioDeviceLabel = audioDevSel.options[audioDevSel.selectedIndex]?.text || '';
          }
          cfg.ndiMonitorAudio = _togVal('src-cfg-ndi-monitor');
          const ndiVolEl = document.getElementById('src-cfg-ndi-volume');
          cfg.ndiAudioVolume = ndiVolEl ? parseInt(ndiVolEl.value, 10) : 100;
          break;
        }
        case 'window-capture': {
          const winSel = document.getElementById('src-cfg-window');
          if (winSel && winSel.value) {
            cfg.windowId = winSel.value;
            cfg.windowName = winSel.options[winSel.selectedIndex]?.text || '';
          }
          cfg.captureCursor = _togVal('src-cfg-cursor');
          break;
        }
      }
      // Convert image/media file to data URL asynchronously
      if (cfg._file) {
        const file = cfg._file;
        delete cfg._file;
        const reader = new FileReader();
        reader.onload = () => {
          cfg.dataUrl = reader.result;
          renderProgramDisplay();
        };
        reader.readAsDataURL(file);
      }
      return cfg;
    }

    /* ---- Program Display Source Compositor ---- */
    const _activeStreams = {};  // sourceId → MediaStream
    const _cameraReconnectState = {}; // sourceId -> { timer, attempts, inFlight }
    const _audioInputReconnectState = {}; // sourceId -> { timer, attempts, inFlight }
    const _sharedAudioInputPools = {}; // key -> { key, stream, refs:Set<sourceId>, deviceId }
    const _audioInputSourceToSharedKey = {}; // sourceId -> pool key

    function _audioInputSharedKey(deviceId) {
      const raw = String(deviceId || '').trim();
      return `audio-input:${raw || 'default'}`;
    }

    function _isSourceUsingSharedAudioInput(sourceId) {
      return !!_audioInputSourceToSharedKey[String(sourceId || '')];
    }

    function _findSharedAudioPoolByStream(stream) {
      if (!stream) return null;
      for (const pool of Object.values(_sharedAudioInputPools)) {
        if (pool && pool.stream === stream) return pool;
      }
      return null;
    }

    function _detachSourceFromSharedAudioInput(sourceId, { stopIfUnused = true } = {}) {
      const sid = String(sourceId || '');
      if (!sid) return;
      const key = _audioInputSourceToSharedKey[sid];
      if (!key) return;
      const pool = _sharedAudioInputPools[key];
      delete _audioInputSourceToSharedKey[sid];
      if (!pool) return;
      if (pool.refs && typeof pool.refs.delete === 'function') pool.refs.delete(sid);
      if (!stopIfUnused) return;
      if (pool.refs && pool.refs.size > 0) return;
      try { pool.stream?.getTracks?.().forEach((t) => t.stop()); } catch (_) {}
      delete _sharedAudioInputPools[key];
    }

    function _attachSourceToSharedAudioInput(sourceId, key, pool) {
      const sid = String(sourceId || '');
      if (!sid || !key || !pool || !pool.stream) return;
      const prev = _audioInputSourceToSharedKey[sid];
      if (prev && prev !== key) _detachSourceFromSharedAudioInput(sid, { stopIfUnused: true });
      if (!pool.refs) pool.refs = new Set();
      pool.refs.add(sid);
      _audioInputSourceToSharedKey[sid] = key;
      _activeStreams[sid] = pool.stream;
    }

    function _clearCameraReconnect(sourceId) {
      const st = _cameraReconnectState[sourceId];
      if (!st) return;
      if (st.timer) clearTimeout(st.timer);
      delete _cameraReconnectState[sourceId];
    }

    function _ensureCameraReconnectState(sourceId) {
      if (!_cameraReconnectState[sourceId]) {
        _cameraReconnectState[sourceId] = { timer: 0, attempts: 0, inFlight: false };
      }
      return _cameraReconnectState[sourceId];
    }

    function _isLiveVideoStream(stream) {
      if (!stream || !stream.active) return false;
      const tracks = stream.getVideoTracks ? stream.getVideoTracks() : [];
      if (!tracks.length) return false;
      return tracks.some((t) => t && t.readyState === 'live');
    }

    function _scheduleCameraReconnect(sourceId, delayMs) {
      const scene = _activeScene();
      if (!scene) return;
      const src = scene.sources.find((s) => s && s.id === sourceId);
      if (!src || src.type !== 'camera' || src.visible === false) {
        _clearCameraReconnect(sourceId);
        return;
      }
      const existing = _activeStreams[sourceId];
      if (_isLiveVideoStream(existing)) {
        _clearCameraReconnect(sourceId);
        return;
      }
      const st = _ensureCameraReconnectState(sourceId);
      if (st.timer) return;
      const wait = Math.max(80, Number(delayMs) || 0);
      st.timer = setTimeout(async () => {
        st.timer = 0;
        if (st.inFlight) return;
        const liveScene = _activeScene();
        const liveSrc = liveScene ? liveScene.sources.find((s) => s && s.id === sourceId) : null;
        if (!liveSrc || liveSrc.type !== 'camera' || liveSrc.visible === false) {
          _clearCameraReconnect(sourceId);
          return;
        }
        st.inFlight = true;
        try {
          const stream = await _startCameraStream(sourceId, liveSrc.config?.deviceId, liveSrc.config);
          if (_isLiveVideoStream(stream)) {
            st.attempts = 0;
            renderProgramDisplay();
            return;
          }
        } catch (_) {}
        finally {
          st.inFlight = false;
        }
        st.attempts = Math.min(12, (st.attempts || 0) + 1);
        const nextDelay = Math.min(10000, 350 * Math.pow(1.5, st.attempts));
        _scheduleCameraReconnect(sourceId, nextDelay);
      }, wait);
    }

    function _scheduleCameraReconnectSweep() {
      const scene = _activeScene();
      if (!scene || !Array.isArray(scene.sources)) return;
      scene.sources.forEach((src) => {
        if (!src || src.type !== 'camera' || src.visible === false) return;
        const stream = _activeStreams[src.id];
        if (!_isLiveVideoStream(stream)) _scheduleCameraReconnect(src.id, 100);
      });
    }

    function _clearAudioInputReconnect(sourceId) {
      const st = _audioInputReconnectState[sourceId];
      if (!st) return;
      if (st.timer) clearTimeout(st.timer);
      delete _audioInputReconnectState[sourceId];
    }

    function _ensureAudioInputReconnectState(sourceId) {
      if (!_audioInputReconnectState[sourceId]) {
        _audioInputReconnectState[sourceId] = { timer: 0, attempts: 0, inFlight: false };
      }
      return _audioInputReconnectState[sourceId];
    }

    function _isLiveAudioStream(stream) {
      if (!stream || !stream.active) return false;
      const tracks = stream.getAudioTracks ? stream.getAudioTracks() : [];
      if (!tracks.length) return false;
      return tracks.some((t) => t && t.readyState === 'live');
    }

    function _scheduleAudioInputReconnect(sourceId, delayMs) {
      const scene = _activeScene();
      if (!scene) return;
      const src = scene.sources.find((s) => s && s.id === sourceId);
      if (!src || src.type !== 'audio-input' || src.visible === false) {
        _clearAudioInputReconnect(sourceId);
        return;
      }
      const existing = _activeStreams[sourceId];
      if (_isLiveAudioStream(existing)) {
        _clearAudioInputReconnect(sourceId);
        return;
      }
      const st = _ensureAudioInputReconnectState(sourceId);
      if (st.timer) return;
      const wait = Math.max(80, Number(delayMs) || 0);
      st.timer = setTimeout(async () => {
        st.timer = 0;
        if (st.inFlight) return;
        const liveScene = _activeScene();
        const liveSrc = liveScene ? liveScene.sources.find((s) => s && s.id === sourceId) : null;
        if (!liveSrc || liveSrc.type !== 'audio-input' || liveSrc.visible === false) {
          _clearAudioInputReconnect(sourceId);
          return;
        }
        st.inFlight = true;
        try {
          const stream = await _startAudioInputStream(sourceId, liveSrc.config?.deviceId);
          if (_isLiveAudioStream(stream)) {
            st.attempts = 0;
            _refreshSourceFxAudio(sourceId);
            renderProgramDisplay();
            return;
          }
        } catch (_) {}
        finally {
          st.inFlight = false;
        }
        st.attempts = Math.min(12, (st.attempts || 0) + 1);
        const nextDelay = Math.min(10000, 350 * Math.pow(1.5, st.attempts));
        _scheduleAudioInputReconnect(sourceId, nextDelay);
      }, wait);
    }

    function _scheduleAudioInputReconnectSweep() {
      const scene = _activeScene();
      if (!scene || !Array.isArray(scene.sources)) return;
      scene.sources.forEach((src) => {
        if (!src || src.type !== 'audio-input' || src.visible === false) return;
        const stream = _activeStreams[src.id];
        if (!_isLiveAudioStream(stream)) _scheduleAudioInputReconnect(src.id, 100);
      });
    }

    function _buildHighQualityAudioConstraints(deviceId) {
      const c = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: { ideal: 2, min: 1 },
        sampleRate: { ideal: 48000 },
        // Request lowest possible hardware buffer / latency.
        // On macOS CoreAudio this maps to ~64-128 sample I/O buffer (~1.3-2.7ms).
        // Browsers that don't support latency constraint will silently ignore it.
        latency: { ideal: 0.0, max: 0.01 },
        // Chrome-specific low-latency hints (ignored where unsupported).
        googEchoCancellation: false,
        googAutoGainControl: false,
        googNoiseSuppression: false,
        googHighpassFilter: false
      };
      if (deviceId) c.deviceId = { exact: deviceId };
      return c;
    }

    function _buildVideoConstraintsFromPrefs(baseConstraints, resolution, fps) {
      const c = Object.assign({}, baseConstraints || {});
      // Bias camera negotiation toward production-standard 16:9 framing.
      // Use ideal values (not exact) so unsupported devices still succeed.
      c.aspectRatio = { ideal: 16 / 9 };
      // Hint browsers to avoid extra processing/scaling that can add capture latency.
      c.resizeMode = 'none';
      c.latency = { ideal: 0.0, max: 0.03 };
      const res = String(resolution || 'auto');
      if (res !== 'auto') {
        const h = parseInt(res, 10);
        if (h === 720) { c.width = { ideal: 1280 }; c.height = { ideal: 720 }; }
        else if (h === 1080) { c.width = { ideal: 1920 }; c.height = { ideal: 1080 }; }
        else if (h === 2160) { c.width = { ideal: 3840 }; c.height = { ideal: 2160 }; }
      } else {
        // "Auto" still prefers a sane 16:9 baseline for webcams that default to 4:3.
        if (!c.width) c.width = { ideal: 1280 };
        if (!c.height) c.height = { ideal: 720 };
      }
      const fpsRaw = String(fps || 'auto');
      if (fpsRaw !== 'auto') {
        const fpsVal = parseInt(fpsRaw, 10);
        if (fpsVal > 0) c.frameRate = { ideal: fpsVal };
      } else if (!c.frameRate) {
        // Default to broadcast-friendly cadence for HDMI capture cards.
        c.frameRate = { ideal: 60, min: 24 };
      }
      return c;
    }

    function _buildCameraConstraintCandidates(deviceId, cfgOpts) {
      const did = deviceId ? { exact: deviceId } : undefined;
      const preferred = _buildVideoConstraintsFromPrefs(
        { deviceId: did },
        cfgOpts && cfgOpts.resolution,
        cfgOpts && cfgOpts.fps
      );
      const candidates = [preferred];
      // More explicit low-latency presets for USB/HDMI capture cards.
      candidates.push({ ...preferred, frameRate: { ideal: 60, min: 30 } });
      candidates.push({ ...preferred, frameRate: { ideal: 30, min: 24 } });
      if (did) candidates.push({ deviceId: did, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60, min: 30 } });
      if (did) candidates.push({ deviceId: did, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60, min: 30 } });
      if (did) candidates.push({ deviceId: did });
      else candidates.push({ video: true });

      // Deduplicate structurally equivalent entries to keep retries cheap.
      const uniq = [];
      const seen = new Set();
      candidates.forEach((c) => {
        const key = JSON.stringify(c);
        if (seen.has(key)) return;
        seen.add(key);
        uniq.push(c);
      });
      return uniq;
    }

    async function _startCameraStream(sourceId, deviceId, cfgOpts) {
      // Stop existing stream for this source if any
      _stopStream(sourceId);
      try {
        const candidates = _buildCameraConstraintCandidates(deviceId, cfgOpts);
        let stream = null;
        let lastError = null;
        for (const videoConstraints of candidates) {
          try {
            if (videoConstraints && videoConstraints.video === true) stream = await navigator.mediaDevices.getUserMedia(videoConstraints);
            else stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
            if (stream && stream.active && stream.getVideoTracks && stream.getVideoTracks().length) break;
          } catch (e) {
            lastError = e;
            stream = null;
          }
        }
        if (!stream) throw (lastError || new Error('camera-open-failed'));

        const track = stream.getVideoTracks ? stream.getVideoTracks()[0] : null;
        if (track) {
          try { track.contentHint = 'motion'; } catch (_) {}
          track.onended = () => {
            // Camera unplugged or stream ended: clean up and auto-recover.
            const active = _activeStreams[sourceId];
            if (active === stream) delete _activeStreams[sourceId];
            renderProgramDisplay();
            _scheduleCameraReconnect(sourceId, 200);
          };
        }
        _activeStreams[sourceId] = stream;
        _ctrlHydrateSourceState(sourceId);
        _ctrlApplyMuteToStream(sourceId, stream);
        _clearCameraReconnect(sourceId);
        // Attach to the video element if it exists
        const vid = document.querySelector(`#source-compositor .src-layer[data-src-id="${sourceId}"] video`);
        if (vid) { vid.srcObject = stream; vid.play().catch(() => {}); }
        // Refresh Audio Mixer panel so meter activates immediately
        renderControlsPanel();
        _pgmSyncSources();
        return stream;
      } catch (e) {
        console.warn('Camera stream failed:', e);
        _scheduleCameraReconnect(sourceId, 600);
        return null;
      }
    }

    async function _startAudioInputStream(sourceId, deviceId) {
      _stopStream(sourceId);
      try {
        const sharedKey = _audioInputSharedKey(deviceId);
        let pool = _sharedAudioInputPools[sharedKey];
        if (!(pool && pool.stream && pool.stream.active && pool.stream.getAudioTracks().length)) {
          let stream = null;
          const strictConstraints = { audio: _buildHighQualityAudioConstraints(deviceId), video: false };
          try {
            stream = await navigator.mediaDevices.getUserMedia(strictConstraints);
          } catch (_) {
            const fallbackAudio = deviceId
              ? { deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
              : { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
            stream = await navigator.mediaDevices.getUserMedia({ audio: fallbackAudio, video: false });
          }
          const track = stream.getAudioTracks()[0];
          if (track && typeof track.applyConstraints === 'function') {
            try {
              await track.applyConstraints({
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
              });
            } catch (_) {}
          }
          pool = {
            key: sharedKey,
            stream,
            refs: new Set(),
            deviceId: deviceId || ''
          };
          _sharedAudioInputPools[sharedKey] = pool;
          if (track) {
            track.onended = () => {
              const deadPool = _sharedAudioInputPools[sharedKey];
              if (!deadPool || deadPool.stream !== stream) return;
              const affected = Array.from(deadPool.refs || []);
              delete _sharedAudioInputPools[sharedKey];
              affected.forEach((sid) => {
                if (_activeStreams[sid] === stream) delete _activeStreams[sid];
                delete _audioInputSourceToSharedKey[sid];
                _ctrlStopMeter(sid);
                _pgmDisconnectSource(sid);
                _scheduleAudioInputReconnect(sid, 200);
              });
              renderControlsPanel();
              _pgmSyncSources();
            };
          }
        }
        _attachSourceToSharedAudioInput(sourceId, sharedKey, pool);
        _ctrlHydrateSourceState(sourceId);
        _ctrlApplyMuteToStream(sourceId, pool.stream);
        _clearAudioInputReconnect(sourceId);
        // Immediately refresh Audio Mixer panel so the meter appears
        renderControlsPanel();
        _pgmSyncSources();
        return pool.stream;
      } catch (e) {
        console.warn('Audio input stream failed:', e);
        _scheduleAudioInputReconnect(sourceId, 600);
        return null;
      }
    }

    /* ---- Audio Mixer Panel: per-layer audio meters ---- */
    const _ctrlMeters = {};      // sourceId → { source, splitter, analyserL, analyserR, dataL, dataR }
    let _ctrlAudioCtx = null;
    const _ctrlMutedSources = new Set();
    const _ctrlVolumes = {};     // sourceId → volume (0..1)
    const _ctrlMeterState = {};  // sourceId → { l, r, pl, pr }
    const _meterBallistics = {
      attack: 0.34,   // rise speed
      release: 0.10,  // fall speed
      peakFall: 0.010 // peak-hold decay per frame
    };

    function _ctrlGetPersistedSourceRef(sourceId) {
      return _findSourceInAnyScene(sourceId) || _getSourceById(sourceId) || null;
    }

    function _ctrlHydrateSourceState(sourceId) {
      if (!sourceId) return;
      const src = _ctrlGetPersistedSourceRef(sourceId);
      const cfg = src && src.config ? src.config : null;
      if (!(sourceId in _ctrlVolumes)) {
        const rawVol = Number(cfg && cfg.mixerVolume);
        _ctrlVolumes[sourceId] = Number.isFinite(rawVol)
          ? Math.max(0, Math.min(1.5, rawVol))
          : 1;
      }
      if (!_ctrlMutedSources.has(sourceId) && cfg && cfg.mixerMuted === true) {
        _ctrlMutedSources.add(sourceId);
      }
      if (src) {
        src.config = src.config || {};
        src.config.mixerVolume = _ctrlVolumes[sourceId];
        src.config.mixerMuted = _ctrlMutedSources.has(sourceId);
      }
    }

    function _ctrlApplyMuteToStream(sourceId, stream) {
      if (!stream || !stream.active || typeof stream.getAudioTracks !== 'function') return;
      if (_isSourceUsingSharedAudioInput(sourceId) || _findSharedAudioPoolByStream(stream)) {
        // Shared audio-input capture must remain track-enabled; per-strip mute is handled by gain.
        return;
      }
      const enabled = !_ctrlMutedSources.has(sourceId);
      stream.getAudioTracks().forEach((t) => {
        try { t.enabled = enabled; } catch (_) {}
      });
    }

    function _ctrlGetEffectiveMixGain(sourceId) {
      if (_promixSoloId && String(sourceId || '') !== String(_promixSoloId)) return 0;
      const raw = Number(_ctrlVolumes[sourceId] ?? 1);
      const base = Math.max(0, Math.min(1.5, Number.isFinite(raw) ? raw : 1));
      return _ctrlMutedSources.has(sourceId) ? 0 : base;
    }

    function _ctrlApplyMixGainToProgramSource(sourceId, ramp = false) {
      const target = _ctrlGetEffectiveMixGain(sourceId);
      // For media sources using captureStream, set vid.volume directly.
      // The captured stream inherits the element's volume, so the
      // program bus gain is set to 1 (don't double-apply).
      // For gain > 1.0 (boost), vid.volume caps at 1 and the program
      // bus gain handles the extra boost.
      _ctrlApplyMixGainToMediaElement(sourceId, target);
      const entry = _pgmSources[sourceId];
      if (!entry || !entry.gain) return;
      const gainNode = entry.gain;
      const isMedia = entry.isMediaSource;
      // For media sources: vid.volume carries the signal level (0-1 range).
      // If user wants > 1.0 boost, the overflow is applied here.
      const pgmTarget = isMedia ? Math.max(1, target) : target;
      if (ramp) {
        try {
          const now = (_pgmAudioCtx && _pgmAudioCtx.currentTime) || 0;
          gainNode.gain.cancelScheduledValues(now);
          // 5ms ramp — fast enough to be imperceptible, prevents clicks
          gainNode.gain.setTargetAtTime(pgmTarget, now, 0.005);
          if (entry.monitorTapGain && entry.monitorTapGain.gain) {
            entry.monitorTapGain.gain.cancelScheduledValues(now);
            entry.monitorTapGain.gain.setTargetAtTime(target, now, 0.005);
          }
          return;
        } catch (_) {}
      }
      gainNode.gain.value = pgmTarget;
      if (entry.monitorTapGain && entry.monitorTapGain.gain) {
        entry.monitorTapGain.gain.value = target;
      }
    }

    /** Set the <video> element's volume property for media sources. */
    function _ctrlApplyMixGainToMediaElement(sourceId, targetGain) {
      const sid = String(sourceId || '');
      if (!sid) return;
      const vid = _mediaSourceVideoEls[sid];
      if (!vid) return;
      const target = Number.isFinite(targetGain) ? targetGain : _ctrlGetEffectiveMixGain(sid);
      // HTMLMediaElement.volume is clamped to 0–1 by the browser.
      vid.volume = Math.max(0, Math.min(1, target));
    }

    // Legacy compat shim — redirects to new element-based volume.
    function _ctrlApplyMixGainToMediaBridge(sourceId, targetGain, ramp) {
      _ctrlApplyMixGainToMediaElement(sourceId, targetGain);
    }

    function _ctrlPersistSourceState(sourceId) {
      if (!sourceId) return;
      const src = _ctrlGetPersistedSourceRef(sourceId);
      if (!src) return;
      src.config = src.config || {};
      src.config.mixerVolume = Math.max(0, Math.min(1.5, Number(_ctrlVolumes[sourceId] ?? 1) || 1));
      src.config.mixerMuted = _ctrlMutedSources.has(sourceId);
      if (typeof saveToStorageDebounced === 'function') saveToStorageDebounced();
    }

    function _meterSmooth(prev, next) {
      const p = Number(prev) || 0;
      const n = Number(next) || 0;
      const k = n > p ? _meterBallistics.attack : _meterBallistics.release;
      return p + (n - p) * k;
    }

    function _getCtrlAudioCtx() {
      if (!_ctrlAudioCtx || _ctrlAudioCtx.state === 'closed') {
        // Use 'interactive' latencyHint for lowest possible audio I/O buffer.
        // This context drives analysers and gain nodes for metering — fast callbacks
        // mean snappier meter response. On macOS CoreAudio 'interactive' maps to
        // ~128 sample (2.7ms) buffer which is ideal for real-time monitoring meters.
        try {
          _ctrlAudioCtx = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive',
            sampleRate: 48000
          });
        } catch (_) {
          _ctrlAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
      }
      if (_ctrlAudioCtx.state === 'suspended') _ctrlAudioCtx.resume().catch(() => {});
      return _ctrlAudioCtx;
    }

    function _ctrlStartMeter(sourceId, stream) {
      _ctrlStopMeter(sourceId);
      if (!stream || !stream.active) return;
      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) return;
      try {
        _ctrlHydrateSourceState(sourceId);
        // IMPORTANT: Use the same AudioContext as the program bus.
        // Creating a second createMediaStreamSource on a different
        // AudioContext causes Chromium to double-consume the stream,
        // producing robotic / metallic audio artifacts.
        const ctx = _getPgmAudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const gain = ctx.createGain();
        gain.gain.value = _ctrlVolumes[sourceId] ?? 1;
        const splitter = ctx.createChannelSplitter(2);
        const analyserL = ctx.createAnalyser();
        const analyserR = ctx.createAnalyser();
        analyserL.fftSize = 128;
        analyserR.fftSize = 128;
        analyserL.smoothingTimeConstant = 0.4;
        analyserR.smoothingTimeConstant = 0.4;
        source.connect(gain);
        gain.connect(splitter);
        splitter.connect(analyserL, 0);
        splitter.connect(analyserR, 1);
        _ctrlMeters[sourceId] = {
          source, gain, splitter, analyserL, analyserR,
          dataL: new Float32Array(analyserL.frequencyBinCount),
          dataR: new Float32Array(analyserR.frequencyBinCount)
        };
      } catch (e) {
        console.warn('Controls meter setup failed for', sourceId, e);
      }
    }

    function _ctrlStopMeter(sourceId) {
      const m = _ctrlMeters[sourceId];
      if (m) {
        try { m.source.disconnect(); } catch (e) {}
        try { if (m.gain) m.gain.disconnect(); } catch (e) {}
        try { m.splitter.disconnect(); } catch (e) {}
        delete _ctrlMeters[sourceId];
      }
      delete _ctrlMeterState[sourceId];
    }

    function _ctrlStopAllMeters() {
      Object.keys(_ctrlMeters).forEach(id => _ctrlStopMeter(id));
    }

    function _ctrlGetLevelStereo(sourceId) {
      const m = _ctrlMeters[sourceId];
      if (!m || !m.analyserL) return { l: -60, r: -60 };
      m.analyserL.getFloatTimeDomainData(m.dataL);
      m.analyserR.getFloatTimeDomainData(m.dataR);
      let sumL = 0, sumR = 0;
      for (let i = 0; i < m.dataL.length; i++) {
        sumL += m.dataL[i] * m.dataL[i];
        sumR += m.dataR[i] * m.dataR[i];
      }
      let dbL = Math.max(-60, 20 * Math.log10(Math.max(1e-6, Math.sqrt(sumL / m.dataL.length))));
      let dbR = Math.max(-60, 20 * Math.log10(Math.max(1e-6, Math.sqrt(sumR / m.dataR.length))));
      // Mirror L to R if mono source
      if (dbR < -58 && dbL > -55) dbR = dbL;
      return { l: dbL, r: dbR };
    }

    function _ctrlDbToPercent(db) {
      return Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
    }

    let _ctrlRafId = 0;
    const _ctrlMeterElCache = {}; // Cache DOM refs for meter elements
    function _ctrlAnimateMeters() {
      const scene = _activeScene();
      if (!scene) { _ctrlRafId = 0; return; }
      scene.sources.forEach(src => {
        let cached = _ctrlMeterElCache[src.id];
        if (!cached || !cached.fillL || !cached.fillL.isConnected) {
          cached = {
            fillL: document.getElementById('ctrl-fill-l-' + src.id),
            fillR: document.getElementById('ctrl-fill-r-' + src.id),
            peakL: document.getElementById('ctrl-peak-l-' + src.id),
            peakR: document.getElementById('ctrl-peak-r-' + src.id),
            dbEl:  document.getElementById('ctrl-db-' + src.id)
          };
          _ctrlMeterElCache[src.id] = cached;
        }
        const { fillL, fillR, peakL, peakR, dbEl } = cached;
        if (!fillL || !fillR || !dbEl) return;
        const effectiveGain = _ctrlGetEffectiveMixGain(src.id);
        if (effectiveGain <= 0.0001) {
          fillL.style.transform = 'scaleX(0)';
          fillR.style.transform = 'scaleX(0)';
          if (peakL) peakL.style.left = '0%';
          if (peakR) peakR.style.left = '0%';
          _ctrlMeterState[src.id] = { l: 0, r: 0, pl: 0, pr: 0 };
          dbEl.textContent = '-∞';
          return;
        }
        let stream = _activeStreams[src.id];
        // For NDI sources, audio may live in a separate stream
        if (src.type === 'ndi') {
          const ndiAudio = _ndiAudioStreams[src.id];
          if (ndiAudio && ndiAudio.active && ndiAudio.getAudioTracks().length) {
            stream = ndiAudio;
          }
        }
        if (!stream || !stream.active || !_ctrlMeters[src.id]) {
          fillL.style.transform = 'scaleX(0)';
          fillR.style.transform = 'scaleX(0)';
          if (peakL) peakL.style.left = '0%';
          if (peakR) peakR.style.left = '0%';
          _ctrlMeterState[src.id] = { l: 0, r: 0, pl: 0, pr: 0 };
          dbEl.textContent = '—';
          return;
        }
        const { l: dbL, r: dbR } = _ctrlGetLevelStereo(src.id);
        const targetL = _ctrlDbToPercent(dbL) / 100;
        const targetR = _ctrlDbToPercent(dbR) / 100;
        const prev = _ctrlMeterState[src.id] || { l: 0, r: 0, pl: 0, pr: 0 };
        const next = {
          l: _meterSmooth(prev.l, targetL),
          r: _meterSmooth(prev.r, targetR),
          pl: 0,
          pr: 0
        };
        next.pl = Math.max(next.l, (prev.pl || 0) - _meterBallistics.peakFall);
        next.pr = Math.max(next.r, (prev.pr || 0) - _meterBallistics.peakFall);
        _ctrlMeterState[src.id] = next;
        fillL.style.transform = 'scaleX(' + next.l + ')';
        fillR.style.transform = 'scaleX(' + next.r + ')';
        if (peakL) peakL.style.left = Math.round(next.pl * 100) + '%';
        if (peakR) peakR.style.left = Math.round(next.pr * 100) + '%';
        const maxDb = Math.max(dbL, dbR);
        dbEl.textContent = maxDb > -59 ? maxDb.toFixed(0) + ' dB' : '-∞';
      });
      _ctrlRafId = requestAnimationFrame(_ctrlAnimateMeters);
    }

    function _ctrlToggleMute(sourceId) {
      _ctrlHydrateSourceState(sourceId);
      const stream = _activeStreams[sourceId];
      const isMuted = _ctrlMutedSources.has(sourceId);
      if (isMuted) {
        _ctrlMutedSources.delete(sourceId);
      } else {
        _ctrlMutedSources.add(sourceId);
      }
      _ctrlApplyMuteToStream(sourceId, stream);
      // For NDI sources the audio lives in a separate stream
      const ndiAudio = _ndiAudioStreams[sourceId];
      if (ndiAudio && ndiAudio !== stream) _ctrlApplyMuteToStream(sourceId, ndiAudio);
      _ctrlApplyMixGainToProgramSource(sourceId, true);
      _pgmRenderMixDebugPanel(true);
      _ctrlPersistSourceState(sourceId);
      renderControlsPanel();
      _pgmSyncSources();
    }

    function _ctrlToggleSolo(sourceId) {
      _promixToggleSolo(sourceId);
    }

    function _ctrlSetVolume(sourceId, vol) {
      vol = Math.max(0, Math.min(1, Number(vol) || 0));
      _ctrlVolumes[sourceId] = vol;
      _ctrlUpdateKnob(sourceId, vol);
      // Apply to program output gain node — use smooth ramp to avoid clicks
      _ctrlApplyMixGainToProgramSource(sourceId, true);
      // Apply to controls meter gain node so meter reflects volume (smooth)
      const meter = _ctrlMeters[sourceId];
      if (meter && meter.gain) {
        try {
          const ctx = _pgmAudioCtx;
          const now = (ctx && ctx.currentTime) || 0;
          meter.gain.gain.cancelScheduledValues(now);
          meter.gain.gain.setTargetAtTime(vol, now, 0.012);
        } catch (_) {
          meter.gain.gain.value = vol;
        }
      }
      _pgmRenderMixDebugPanel(true);
      _ctrlPersistSourceState(sourceId);
    }

    function _ctrlUpdateKnob(sourceId, vol) {
      const val = document.getElementById('ctrl-knob-val-' + sourceId);
      const slider = document.getElementById('ctrl-vol-' + sourceId);
      const clamped = Math.max(0, Math.min(1, Number(vol) || 0));
      if (slider) {
        slider.value = Math.round(clamped * 100);
      }
      if (val) {
        if (clamped <= 0.0001) {
          val.textContent = '-inf';
        } else {
          const db = 20 * Math.log10(clamped);
          val.textContent = (Math.max(-60, Math.min(12, db))).toFixed(1);
        }
      }
    }

    function _ctrlSyncRowFromSource(sourceId) {
      if (!sourceId) return;
      const src = _ctrlGetPersistedSourceRef(sourceId) || _getSourceById(sourceId);
      if (!src || !_isAudioCapableSourceType(src.type)) return;
      const row = document.querySelector(`.ctrl-meter-row[data-src-id="${sourceId}"]`);
      if (!row) return;
      const mode = _getSourceInputMode(src);
      const pan = _getSourcePan(src);
      const width = _getSourceWidth(src);
      row.classList.toggle('mono', mode === 'mono');
      const toggleBtn = row.querySelector('.ctrl-input-mode-btn');
      if (toggleBtn) {
        const svg = toggleBtn.querySelector('svg');
        if (svg) svg.innerHTML = _sourceInputModeIconSvg(mode);
        const modeLabel = _sourceInputModeLabel(mode);
        toggleBtn.setAttribute('data-ctrl-input-mode', mode);
        toggleBtn.classList.toggle('active', mode === 'mono');
        toggleBtn.setAttribute('aria-pressed', mode === 'mono' ? 'true' : 'false');
        toggleBtn.setAttribute('aria-label', `Input mode: ${modeLabel}. Activate to switch to ${_sourceInputModeLabel(_sourceToggleInputMode(mode))}.`);
        toggleBtn.title = `Input mode: ${modeLabel} (click to switch to ${_sourceInputModeLabel(_sourceToggleInputMode(mode))})`;
      }
      _promixUpdateSpatialUi(sourceId, 'pan', pan, 'ctrl');
      _promixUpdateSpatialUi(sourceId, 'width', width, 'ctrl');
    }

    function _ctrlToggleInputMode(sourceId) {
      const src = _ctrlGetPersistedSourceRef(sourceId) || _getSourceById(sourceId);
      if (!src) return;
      const next = _sourceToggleInputMode(_getSourceInputMode(src));
      _ctrlSetInputMode(sourceId, next);
    }

    function _ctrlInputModeKey(ev, sourceId) {
      if (!ev) return;
      const key = String(ev.key || '');
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        ev.preventDefault();
        _ctrlSetInputMode(sourceId, key === 'ArrowLeft' ? 'mono' : 'stereo');
        return;
      }
      if (key === ' ' || key === 'Enter') {
        ev.preventDefault();
        _ctrlToggleInputMode(sourceId);
      }
    }

    function _ctrlSetInputMode(sourceId, mode) {
      const src = _ctrlGetPersistedSourceRef(sourceId) || _getSourceById(sourceId);
      if (!src) return;
      _setSourceInputMode(src, mode, { persist: true, renderControls: false });
      _ctrlSyncRowFromSource(sourceId);
    }

    function _ctrlSetPan(sourceId, value) {
      const src = _ctrlGetPersistedSourceRef(sourceId) || _getSourceById(sourceId);
      if (!src) return;
      _setSourcePanWidth(src, _normalizeSourcePan(value), null, { persist: true, render: false, renderControls: false });
      _ctrlSyncRowFromSource(sourceId);
    }

    function _ctrlSetWidth(sourceId, value) {
      const src = _ctrlGetPersistedSourceRef(sourceId) || _getSourceById(sourceId);
      if (!src) return;
      _setSourcePanWidth(src, null, _normalizeSourceWidth(value), { persist: true, render: false, renderControls: false });
      _ctrlSyncRowFromSource(sourceId);
    }

    function renderControlsPanel() {
      const host = document.getElementById('controls-panel-body');
      if (!host) return;
      const scene = _activeScene();
      if (!scene || !scene.sources.length) {
        host.innerHTML = '<div class="ctrl-no-layers">No layers in this scene</div>';
        _ctrlStopAllMeters();
        if (_ctrlRafId) { cancelAnimationFrame(_ctrlRafId); _ctrlRafId = 0; }
        return;
      }

      const activeSourceIds = new Set(scene.sources.map(s => s.id));
      Object.keys(_ctrlMeters).forEach(id => {
        if (!activeSourceIds.has(id)) _ctrlStopMeter(id);
      });

      const sourceColors = {
        'camera': '#60a5fa', 'audio-input': '#f472b6', 'media-source': '#fb923c',
        'ndi': '#a78bfa', 'image': '#34d399', 'text': '#38bdf8',
      };

      // Filter to only audio-capable layers (exclude cameras without audio)
      const audioSources = scene.sources.filter(s => {
        if (s.type === 'audio-input' || s.type === 'media-source' || s.type === 'ndi') return true;
        if (s.type === 'camera') {
          const stream = _activeStreams[s.id];
          return stream && stream.active && stream.getAudioTracks().length > 0;
        }
        return false;
      });
      if (!audioSources.length) {
        host.innerHTML = `<div class="ctrl-no-layers">${esc(t('ui_no_audio_layers_scene'))}</div>`;
        _ctrlStopAllMeters();
        if (_ctrlRafId) { cancelAnimationFrame(_ctrlRafId); _ctrlRafId = 0; }
        return;
      }

      let html = '';
      audioSources.forEach(src => {
        _ctrlHydrateSourceState(src.id);
        const isMuted = _ctrlMutedSources.has(src.id);
        const isSolo = _promixSoloId === src.id;
        const color = _getSourceTrackColor(src, sourceColors[src.type] || '#8899aa');
        const vol = Math.max(0, Math.min(1, Number(_ctrlVolumes[src.id] ?? 1) || 0));
        const inputMode = _getSourceInputMode(src);
        const pan = _getSourcePan(src);
        const width = _getSourceWidth(src);
        html += `<div class="ctrl-meter-row ${inputMode === 'mono' ? 'mono' : ''}" data-src-id="${src.id}" style="--track-color:${color}">
          <div class="ctrl-meter-left">
            <div class="ctrl-input-mode-toggle" role="group" aria-label="Input mode">
              <button type="button" class="ctrl-input-mode-btn${inputMode === 'mono' ? ' active' : ''}" data-ctrl-input-mode="${inputMode}" onclick="_ctrlToggleInputMode('${src.id}')" onkeydown="_ctrlInputModeKey(event,'${src.id}')" aria-pressed="${inputMode === 'mono' ? 'true' : 'false'}" aria-label="Input mode: ${_sourceInputModeLabel(inputMode)}. Activate to switch to ${_sourceInputModeLabel(_sourceToggleInputMode(inputMode))}." title="Input mode: ${_sourceInputModeLabel(inputMode)} (click to switch to ${_sourceInputModeLabel(_sourceToggleInputMode(inputMode))})"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.6">${_sourceInputModeIconSvg(inputMode)}</svg></button>
            </div>
            <div class="ctrl-meter-btns">
              <button class="ctrl-meter-btn${isMuted ? ' muted' : ''}" id="ctrl-mute-${src.id}" onclick="_ctrlToggleMute('${src.id}')" title="${isMuted ? 'Unmute' : 'Mute'}">M</button>
              <button class="ctrl-meter-btn${isSolo ? ' solo-active' : ''}" id="ctrl-solo-${src.id}" onclick="_ctrlToggleSolo('${src.id}')" title="${isSolo ? 'Clear solo' : 'Solo'}">S</button>
            </div>
          </div>
          <div class="ctrl-meter-main">
            <div class="ctrl-strip-topline">
              <div class="ctrl-meter-name" title="${esc(src.name)}">${esc(src.name)}</div>
              <div class="ctrl-spatial-group ctrl-spatial-group-inline">
                <button type="button" class="ctrl-spatial-control" title="Pan ${_fmtPanLabel(pan)} (double-click to center)" aria-label="Pan ${_fmtPanLabel(pan)}. Use arrow keys, Home to center." onkeydown="_promixSpatialKey(event,'${src.id}','pan','ctrl')" ondblclick="_promixResetSpatial('${src.id}','pan','ctrl')">
                  <span class="ctrl-spatial-stack">
                    <span class="ctrl-spatial-label">Pan</span>
                    ${_promixRenderSpatialKnob(src.id, 'pan', pan, { className: 'promix-spatial-knob ctrl-spatial-knob', ui: 'ctrl', onDown: '_promixSpatialKnobDown(event)' })}
                    <span class="ctrl-spatial-val" id="ctrl-pan-val-${src.id}">${_fmtPanLabel(pan)}</span>
                  </span>
                </button>
              </div>
              <div class="ctrl-spatial-group ctrl-spatial-group-inline">
                <button type="button" class="ctrl-spatial-control" title="Width ${width}% (double-click to reset 100%)" aria-label="Width ${width} percent. Use arrow keys, Home to reset." onkeydown="_promixSpatialKey(event,'${src.id}','width','ctrl')" ondblclick="_promixResetSpatial('${src.id}','width','ctrl')">
                  <span class="ctrl-spatial-stack">
                    <span class="ctrl-spatial-label">Width</span>
                    ${_promixRenderSpatialKnob(src.id, 'width', width, { className: 'promix-spatial-knob ctrl-spatial-knob', ui: 'ctrl', onDown: '_promixSpatialKnobDown(event)' })}
                    <span class="ctrl-spatial-val" id="ctrl-width-val-${src.id}">${width}%</span>
                  </span>
                </button>
              </div>
              <div class="ctrl-meter-db" id="ctrl-db-${src.id}">—</div>
            </div>
            <div class="ctrl-meter-stereo">
              <div class="ctrl-meter-lane">
                <div class="ctrl-meter-bar">
                  <div class="ctrl-meter-bar-fill" id="ctrl-fill-l-${src.id}"></div>
                  <div class="ctrl-meter-peak" id="ctrl-peak-l-${src.id}"></div>
                </div>
              </div>
              <div class="ctrl-meter-lane ctrl-meter-lane-r">
                <div class="ctrl-meter-bar">
                  <div class="ctrl-meter-bar-fill" id="ctrl-fill-r-${src.id}"></div>
                  <div class="ctrl-meter-peak" id="ctrl-peak-r-${src.id}"></div>
                </div>
              </div>
            </div>
            <div class="ctrl-meter-scale">
              <span>-60</span><span>-50</span><span>-40</span><span>-35</span><span>-30</span><span>-25</span><span>-20</span><span>-15</span><span>-10</span><span>-5</span><span>0</span>
            </div>
            <input type="range" class="ctrl-meter-vol" id="ctrl-vol-${src.id}" min="0" max="100" value="${Math.round(vol * 100)}" oninput="_ctrlSetVolume('${src.id}', this.value / 100)" title="Volume">
          </div>
        </div>`;

        // Start audio meter if stream is active
        if (src.visible !== false) {
          let stream = _activeStreams[src.id];
          // For NDI sources, prefer the dedicated audio stream
          if (src.type === 'ndi') {
            const ndiAudio = _ndiAudioStreams[src.id];
            if (ndiAudio && ndiAudio.active && ndiAudio.getAudioTracks().length) {
              stream = ndiAudio;
            }
          }
          if (stream && stream.active && !_ctrlMeters[src.id]) {
            _ctrlStartMeter(src.id, stream);
          }
        }
      });
      host.innerHTML = html;
      audioSources.forEach(src => _ctrlUpdateKnob(src.id, _ctrlVolumes[src.id] ?? 1));
      // Invalidate cached DOM refs since we rebuilt the meter DOM
      Object.keys(_ctrlMeterElCache).forEach(k => delete _ctrlMeterElCache[k]);

      // Start animation loop if not running
      if (!_ctrlRafId) _ctrlRafId = requestAnimationFrame(_ctrlAnimateMeters);

      // Sync Pro Mixer if it's open
      if (typeof _promixOpen !== 'undefined' && _promixOpen) renderProMixer();
    }

    /* ═══════ Pro Mixer (DAW-style Channel Strip Mixer Window) ═══════ */
    let _promixOpen = false;
    let _promixSceneId = '';
    let _promixRafId = 0;
    let _promixSelectedFx = null;   // { sourceId, fxId }
    let _promixSoloId = '';         // solo'd source id
    /* Master FX chain — stored on appState for persistence */
    let _promixMasterFx = [];       // [{id, type, enabled, params}]
    let _promixMasterFxSelectedId = '';
    let _promixMasterVolume = 1;    // 0..1
    /* Master FX audio graph runtime nodes */
    let _promixMasterFxNodes = [];    // Web Audio nodes created for master FX
    let _promixMasterFxRuntime = {};  // fxId → runtimeNode (for in-place param updates)
    let _promixMasterPreFxGain = null; // gain node before master FX chain
    let _promixMasterPostFxGain = null; // gain node after master FX chain
    let _promixUserMoved = false;       // preserve manual window placement after drag/resize

    /* ── Send / Return Bus System (DAW-style Aux Sends) ── */
    let _promixBuses = [
      { id: 'bus_1', name: 'Bus 1', fxChain: [], volume: 1, muted: false },
      { id: 'bus_2', name: 'Bus 2', fxChain: [], volume: 1, muted: false },
    ];
    /**
     * Bus audio runtime nodes — keyed by busId.
     * Each entry: { inputGain, outputGain, fxNodes[], splitter, analyserL, analyserR, analyserBufL, analyserBufR }
     */
    let _promixBusNodes = {};

    function _promixIsBusId(id) { return typeof id === 'string' && id.startsWith('bus_'); }
    function _promixGetBusById(busId) { return _promixBuses.find(b => b.id === busId) || null; }

    /** Add a new bus dynamically at runtime. */
    function _promixAddBus() {
      // Find the lowest available bus number (fills gaps from deletions)
      const usedNums = _promixBuses.map(b => { const m = b.id.match(/^bus_(\d+)$/); return m ? parseInt(m[1], 10) : 0; });
      let nextNum = 1;
      while (usedNums.includes(nextNum)) nextNum++;
      const newId = 'bus_' + nextNum;
      const newBus = { id: newId, name: 'Bus ' + nextNum, fxChain: [], volume: 1, muted: false };
      _promixBuses.push(newBus);

      // Create audio nodes for the new bus if audio context exists
      if (_pgmAudioCtx && _pgmMerger) {
        const ctx = _pgmAudioCtx;
        const inputGain = ctx.createGain();
        inputGain.gain.value = 1;
        const outputGain = ctx.createGain();
        outputGain.gain.value = newBus.muted ? 0 : newBus.volume;
        const splitter = ctx.createChannelSplitter(2);
        const analyserL = ctx.createAnalyser();
        const analyserR = ctx.createAnalyser();
        analyserL.fftSize = 256;
        analyserR.fftSize = 256;
        analyserL.smoothingTimeConstant = 0.4;
        analyserR.smoothingTimeConstant = 0.4;
        // Empty bus = no passthrough (dry signal goes direct to merger)
        outputGain.connect(_pgmMerger);
        if (_pgmMonitorMixer) outputGain.connect(_pgmMonitorMixer);
        outputGain.connect(splitter);
        splitter.connect(analyserL, 0);
        splitter.connect(analyserR, 1);
        _promixBusNodes[newId] = {
          inputGain, outputGain, fxNodes: [], splitter, analyserL, analyserR,
          analyserBufL: new Float32Array(analyserL.fftSize),
          analyserBufR: new Float32Array(analyserR.fftSize),
        };
        // Wire sends on all currently connected sources
        Object.keys(_pgmSources).forEach(sourceId => {
          const pgmEntry = _pgmSources[sourceId];
          if (!pgmEntry || !pgmEntry.gain) return;
          const sendGain = ctx.createGain();
          sendGain.gain.value = 0; // new bus starts silent
          pgmEntry.gain.connect(sendGain);
          sendGain.connect(inputGain);
          if (!pgmEntry.sendGains) pgmEntry.sendGains = {};
          pgmEntry.sendGains[newId] = sendGain;
        });
      }

      if (typeof schedulePersistAppState === 'function') schedulePersistAppState();
      if (_promixOpen) renderProMixer();
    }

    /** Remove a bus by ID. Bus 1 is permanent and cannot be removed. */
    function _promixRemoveBus(busId) {
      if (busId === 'bus_1') return; // Bus 1 is permanent
      const idx = _promixBuses.findIndex(b => b.id === busId);
      if (idx === -1) return;
      _promixBuses.splice(idx, 1);

      // Tear down audio nodes
      const nodes = _promixBusNodes[busId];
      if (nodes) {
        try { nodes.inputGain.disconnect(); } catch (_) {}
        try { nodes.outputGain.disconnect(); } catch (_) {}
        if (Array.isArray(nodes.fxNodes)) nodes.fxNodes.forEach(n => { try { n.disconnect(); } catch (_) {} });
        try { nodes.splitter.disconnect(); } catch (_) {}
        try { nodes.analyserL.disconnect(); } catch (_) {}
        try { nodes.analyserR.disconnect(); } catch (_) {}
        delete _promixBusNodes[busId];
      }

      // Disconnect send gain nodes on all connected sources
      Object.keys(_pgmSources || {}).forEach(sourceId => {
        const pgmEntry = _pgmSources[sourceId];
        if (pgmEntry && pgmEntry.sendGains && pgmEntry.sendGains[busId]) {
          try { pgmEntry.sendGains[busId].disconnect(); } catch (_) {}
          delete pgmEntry.sendGains[busId];
        }
      });

      // Clean sends data from source configs
      const allSources = _promixGetAudioSources ? _promixGetAudioSources() : [];
      allSources.forEach(src => {
        if (src.config && Array.isArray(src.config.sends)) {
          src.config.sends = src.config.sends.filter(s => s.busId !== busId);
        }
      });

      if (typeof schedulePersistAppState === 'function') schedulePersistAppState();
      if (_promixOpen) renderProMixer();
    }

    /** Get sends for a source — returns [{busId, level}]. Creates defaults if missing. */
    function _promixGetSends(sourceId) {
      const src = _ctrlGetPersistedSourceRef(sourceId) || _getSourceById(sourceId);
      if (!src) return [];
      if (!src.config) src.config = {};
      if (!Array.isArray(src.config.sends)) {
        // Initialize sends with 0 level for each bus
        src.config.sends = _promixBuses.map(b => ({ busId: b.id, level: 0 }));
      }
      // Ensure all buses are represented
      _promixBuses.forEach(b => {
        if (!src.config.sends.find(s => s.busId === b.id)) {
          src.config.sends.push({ busId: b.id, level: 0 });
        }
      });
      return src.config.sends;
    }

    /** Set send level for a specific bus on a source and apply to audio graph. */
    function _promixSetSendLevel(sourceId, busId, level) {
      const src = _ctrlGetPersistedSourceRef(sourceId) || _getSourceById(sourceId);
      if (!src) return;
      if (!src.config) src.config = {};
      const sends = _promixGetSends(sourceId);
      const send = sends.find(s => s.busId === busId);
      if (send) {
        send.level = Math.max(0, Math.min(1, level));
      } else {
        sends.push({ busId: busId, level: Math.max(0, Math.min(1, level)) });
      }
      // Apply to live audio graph
      const pgmEntry = _pgmSources[sourceId];
      if (pgmEntry && pgmEntry.sendGains) {
        const sendGain = pgmEntry.sendGains[busId];
        if (sendGain) {
          try {
            const ctx = _pgmAudioCtx;
            const now = ctx ? ctx.currentTime : 0;
            sendGain.gain.cancelScheduledValues(now);
            sendGain.gain.setTargetAtTime(send ? send.level : level, now, 0.01);
          } catch (_) {
            sendGain.gain.value = send ? send.level : level;
          }
        }
      }
      if (typeof saveToStorageDebounced === 'function') saveToStorageDebounced();
    }

    /** Render SVG rotary knob for a send. */
    function _promixRenderKnob(sourceId, busId, value) {
      const v = Math.max(0, Math.min(1, value));
      const arcLen = v * 65.97;
      const angle = -135 + v * 270;
      return `<svg class="promix-knob" viewBox="0 0 36 36" width="24" height="24"
        data-src-id="${sourceId}" data-bus-id="${busId}" data-value="${v.toFixed(3)}"
        onpointerdown="_promixKnobDown(event)">
        <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3"
          stroke-dasharray="65.97 22" transform="rotate(135 18 18)" stroke-linecap="round"/>
        <circle cx="18" cy="18" r="14" fill="none" stroke="var(--accent,#0a84ff)" stroke-width="3"
          stroke-dasharray="${arcLen.toFixed(2)} 88" transform="rotate(135 18 18)" stroke-linecap="round"/>
        <circle cx="18" cy="18" r="7" fill="#2a2d35"/>
        <line x1="18" y1="18" x2="18" y2="7" stroke="#dde" stroke-width="1.5" stroke-linecap="round"
          transform="rotate(${angle.toFixed(1)} 18 18)"/>
      </svg>`;
    }

    /** Render sends section HTML for a channel strip. */
    function _promixRenderSends(sourceId) {
      const sends = _promixGetSends(sourceId);
      let html = '<div class="promix-sends-section">';
      _promixBuses.forEach(bus => {
        const send = sends.find(s => s.busId === bus.id);
        const level = send ? send.level : 0;
        const dbTxt = level <= 0.001 ? '-\u221E' : (20 * Math.log10(level)).toFixed(1);
        html += `<div class="promix-send-row">
          <span class="promix-send-label">${esc(bus.name)}</span>
          ${_promixRenderKnob(sourceId, bus.id, level)}
          <span class="promix-send-val">${dbTxt}</span>
        </div>`;
      });
      html += '</div>';
      return html;
    }

    function _promixRenderInputModeRow(src) {
      const sourceId = src && src.id ? src.id : '';
      const m = _normalizeSourceInputMode(src && src.config ? src.config.inputMode : 'stereo');
      const currentLabel = _sourceInputModeLabel(m);
      const nextLabel = _sourceInputModeLabel(_sourceToggleInputMode(m));
      const route = _getSourceInputChannelRoute(src);
      const routeLabel = _fmtSourceInputRouteLabel(route);
      return `<div class="promix-input-row">
        <div class="promix-input-toggle" role="group" aria-label="Input mode">
          <button type="button" class="promix-input-opt${m === 'mono' ? ' active' : ''}" data-src-id="${sourceId}" data-input-mode="${m}" onclick="_promixToggleInputMode('${sourceId}')" onkeydown="_promixHandleInputModeKey(event,'${sourceId}')" aria-pressed="${m === 'mono' ? 'true' : 'false'}" aria-label="Input mode: ${currentLabel}. Activate to switch to ${nextLabel}." title="Input mode: ${currentLabel} (click to switch to ${nextLabel})"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5">${_sourceInputModeIconSvg(m)}</svg></button>
          <button type="button" class="promix-input-route-btn" data-src-id="${sourceId}" data-route-left="${route.left}" data-route-right="${route.right}" onclick="_promixToggleInputRouteMenu('${sourceId}',event)" onkeydown="_promixInputRouteKey(event,'${sourceId}')" title="Channel input routing: ${routeLabel}" aria-label="Channel input routing ${routeLabel}. Activate to change routing."><span class="promix-input-route-label">${routeLabel}</span></button>
        </div>
      </div>`;
    }

    let _promixInputRoutePopSourceId = '';

    function _promixCloseInputRoutePop() {
      const pop = document.getElementById('promix-input-route-pop');
      if (pop) pop.remove();
      _promixInputRoutePopSourceId = '';
    }

    function _promixPositionInputRoutePop(anchorEl, popEl) {
      if (!anchorEl || !popEl) return;
      const pad = 8;
      const anchorRect = anchorEl.getBoundingClientRect();
      const popRect = popEl.getBoundingClientRect();
      let left = anchorRect.left;
      if (left + popRect.width > window.innerWidth - pad) left = window.innerWidth - popRect.width - pad;
      if (left < pad) left = pad;
      let top = anchorRect.bottom + 6;
      if (top + popRect.height > window.innerHeight - pad) top = anchorRect.top - popRect.height - 6;
      if (top < pad) top = pad;
      popEl.style.left = `${Math.round(left)}px`;
      popEl.style.top = `${Math.round(top)}px`;
    }

    function _promixInputRouteOptionRows(sourceId) {
      const count = _getSourceInputChannelCount(sourceId);
      let html = '';
      for (let i = 0; i < count; i++) html += `<option value="${i}">Channel ${i + 1}</option>`;
      return html;
    }

    function _promixRenderInputRoutePop(sourceId, anchorEl) {
      const src = _ctrlGetPersistedSourceRef(sourceId) || _getSourceById(sourceId);
      if (!src || !_isAudioCapableSourceType(src.type)) {
        _promixCloseInputRoutePop();
        return;
      }
      const route = _getSourceInputChannelRoute(src);
      const options = _promixInputRouteOptionRows(sourceId);
      let pop = document.getElementById('promix-input-route-pop');
      if (!pop) {
        pop = document.createElement('div');
        pop.id = 'promix-input-route-pop';
        pop.className = 'promix-input-route-pop';
        pop.onclick = (ev) => ev.stopPropagation();
        document.body.appendChild(pop);
      }
      pop.setAttribute('data-src-id', sourceId);
      pop.innerHTML = `
        <div class="route-title">Channel Input</div>
        <div class="route-row">
          <label for="promix-route-left">L</label>
          <select id="promix-route-left" onchange="_promixHandleInputRouteSelect('${sourceId}')">${options}</select>
        </div>
        <div class="route-row">
          <label for="promix-route-right">R</label>
          <select id="promix-route-right" onchange="_promixHandleInputRouteSelect('${sourceId}')">${options}</select>
        </div>
        <div class="route-presets">
          <button type="button" onclick="_promixApplyInputRoutePreset('${sourceId}',0,0)">1 / 1</button>
          <button type="button" onclick="_promixApplyInputRoutePreset('${sourceId}',0,1)">1 / 2</button>
          <button type="button" onclick="_promixApplyInputRoutePreset('${sourceId}',1,1)">2 / 2</button>
        </div>`;
      const leftSel = pop.querySelector('#promix-route-left');
      const rightSel = pop.querySelector('#promix-route-right');
      if (leftSel) leftSel.value = String(route.left);
      if (rightSel) rightSel.value = String(route.right);
      _promixInputRoutePopSourceId = sourceId;
      _promixPositionInputRoutePop(anchorEl, pop);
    }

    function _promixToggleInputRouteMenu(sourceId, ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      const anchor = (ev && ev.currentTarget) || document.querySelector(`.promix-input-route-btn[data-src-id="${sourceId}"]`);
      if (!anchor) return;
      const pop = document.getElementById('promix-input-route-pop');
      if (pop && _promixInputRoutePopSourceId === sourceId) {
        _promixCloseInputRoutePop();
        return;
      }
      _promixRenderInputRoutePop(sourceId, anchor);
    }

    function _promixRefreshInputRoutePop(sourceId) {
      if (!_promixInputRoutePopSourceId || _promixInputRoutePopSourceId !== sourceId) return;
      const anchor = document.querySelector(`.promix-input-route-btn[data-src-id="${sourceId}"]`);
      if (!anchor) {
        _promixCloseInputRoutePop();
        return;
      }
      _promixRenderInputRoutePop(sourceId, anchor);
    }

    function _promixHandleInputRouteSelect(sourceId) {
      const pop = document.getElementById('promix-input-route-pop');
      if (!pop) return;
      const leftSel = pop.querySelector('#promix-route-left');
      const rightSel = pop.querySelector('#promix-route-right');
      if (!leftSel || !rightSel) return;
      _setSourceInputChannelRoute(
        sourceId,
        _normalizeSourceInputChannelIndex(leftSel.value, 0),
        _normalizeSourceInputChannelIndex(rightSel.value, 1),
        { persist: true, render: false, renderControls: false }
      );
    }

    function _promixApplyInputRoutePreset(sourceId, left, right) {
      const pop = document.getElementById('promix-input-route-pop');
      const count = _getSourceInputChannelCount(sourceId);
      const nextLeft = Math.max(0, Math.min(count - 1, _normalizeSourceInputChannelIndex(left, 0)));
      const nextRight = Math.max(0, Math.min(count - 1, _normalizeSourceInputChannelIndex(right, 1)));
      _setSourceInputChannelRoute(sourceId, nextLeft, nextRight, { persist: true, render: false, renderControls: false });
      if (pop) {
        const leftSel = pop.querySelector('#promix-route-left');
        const rightSel = pop.querySelector('#promix-route-right');
        if (leftSel) leftSel.value = String(nextLeft);
        if (rightSel) rightSel.value = String(nextRight);
      }
    }

    function _promixInputRouteKey(ev, sourceId) {
      if (!ev) return;
      const key = String(ev.key || '');
      if (key === ' ' || key === 'Enter') {
        ev.preventDefault();
        _promixToggleInputRouteMenu(sourceId, ev);
      }
    }

    function _promixHandleInputModeKey(ev, sourceId) {
      if (!ev) return;
      const key = String(ev.key || '');
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        ev.preventDefault();
        _promixSetInputMode(sourceId, key === 'ArrowLeft' ? 'mono' : 'stereo');
        const next = document.querySelector(`.promix-input-opt[data-src-id="${sourceId}"]`);
        if (next) next.focus();
        return;
      }
      if (key === ' ' || key === 'Enter') {
        ev.preventDefault();
        _promixToggleInputMode(sourceId);
      }
    }

    function _promixToggleInputMode(sourceId) {
      const src = _ctrlGetPersistedSourceRef(sourceId) || _getSourceById(sourceId);
      if (!src) return;
      _promixSetInputMode(sourceId, _sourceToggleInputMode(_getSourceInputMode(src)));
    }

    function _promixSetInputMode(sourceId, mode) {
      const src = _ctrlGetPersistedSourceRef(sourceId) || _getSourceById(sourceId);
      if (!src) return;
      _setSourceInputMode(src, mode, { persist: true, renderControls: true });
    }

    function _promixRenderSpatialKnob(sourceId, kind, rawValue, opts = {}) {
      const value = kind === 'width' ? _normalizeSourceWidth(rawValue) : _normalizeSourcePan(rawValue);
      const norm = kind === 'width'
        ? (value / 200)
        : ((value + 100) / 200);
      const arcLen = Math.max(0, Math.min(1, norm)) * 65.97;
      const angle = -135 + Math.max(0, Math.min(1, norm)) * 270;
      const className = String(opts.className || 'promix-spatial-knob');
      const ui = String(opts.ui || 'promix');
      const onDown = String(opts.onDown || '_promixSpatialKnobDown(event)');
      return `<svg class="${className}" viewBox="0 0 36 36" width="22" height="22"
        data-ui="${ui}"
        data-src-id="${sourceId}" data-kind="${kind}" data-value="${value}"
        onpointerdown="${onDown}">
        <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3"
          stroke-dasharray="65.97 22" transform="rotate(135 18 18)" stroke-linecap="round"/>
        <circle cx="18" cy="18" r="14" fill="none" stroke="var(--accent,#0a84ff)" stroke-width="3"
          stroke-dasharray="${arcLen.toFixed(2)} 88" transform="rotate(135 18 18)" stroke-linecap="round"/>
        <circle cx="18" cy="18" r="7" fill="#2a2d35"/>
        <line x1="18" y1="18" x2="18" y2="7" stroke="#dde" stroke-width="1.5" stroke-linecap="round"
          transform="rotate(${angle.toFixed(1)} 18 18)"/>
      </svg>`;
    }

    function _promixRenderSpatialRow(src) {
      const pan = _getSourcePan(src);
      const width = _getSourceWidth(src);
      return `<div class="promix-spatial-row">
        <div class="promix-spatial-cell">
          <button type="button" class="promix-spatial-control" title="Pan ${_fmtPanLabel(pan)} (double-click to center)" aria-label="Pan ${_fmtPanLabel(pan)}. Use arrow keys, Home to center." onkeydown="_promixSpatialKey(event,'${src.id}','pan')" ondblclick="_promixResetSpatial('${src.id}','pan')">
            <span class="promix-spatial-label">Pan</span>
            ${_promixRenderSpatialKnob(src.id, 'pan', pan)}
            <span class="promix-spatial-value" id="promix-pan-label-${src.id}">${_fmtPanLabel(pan)}</span>
          </button>
        </div>
        <div class="promix-spatial-cell">
          <button type="button" class="promix-spatial-control" title="Width ${width}% (double-click to reset 100%)" aria-label="Width ${width} percent. Use arrow keys, Home to reset." onkeydown="_promixSpatialKey(event,'${src.id}','width')" ondblclick="_promixResetSpatial('${src.id}','width')">
            <span class="promix-spatial-label">Width</span>
            ${_promixRenderSpatialKnob(src.id, 'width', width)}
            <span class="promix-spatial-value" id="promix-width-label-${src.id}">${width}%</span>
          </button>
        </div>
      </div>`;
    }

    function _promixUpdateSpatialUi(sourceId, kind, value, ui = 'promix') {
      const src = _ctrlGetPersistedSourceRef(sourceId) || _getSourceById(sourceId);
      if (!src) return;
      const pan = _getSourcePan(src);
      const width = _getSourceWidth(src);
      const isCtrl = ui === 'ctrl';
      const panLbl = document.getElementById(`${isCtrl ? 'ctrl' : 'promix'}-pan-${isCtrl ? 'val-' : 'label-'}${sourceId}`);
      const widthLbl = document.getElementById(`${isCtrl ? 'ctrl' : 'promix'}-width-${isCtrl ? 'val-' : 'label-'}${sourceId}`);
      if (panLbl) panLbl.textContent = _fmtPanLabel(pan);
      if (widthLbl) widthLbl.textContent = `${width}%`;
      const knobSelector = isCtrl ? '.ctrl-spatial-knob' : '#promix-body .promix-spatial-knob';
      const knob = document.querySelector(`${knobSelector}[data-src-id="${sourceId}"][data-kind="${kind}"]`);
      if (!knob) return;
      const v = kind === 'width' ? width : pan;
      const norm = kind === 'width' ? (v / 200) : ((v + 100) / 200);
      const clamped = Math.max(0, Math.min(1, norm));
      const arcLen = clamped * 65.97;
      const angle = -135 + clamped * 270;
      const circles = knob.querySelectorAll('circle');
      if (circles[1]) circles[1].setAttribute('stroke-dasharray', `${arcLen.toFixed(2)} 88`);
      const line = knob.querySelector('line');
      if (line) line.setAttribute('transform', `rotate(${angle.toFixed(1)} 18 18)`);
      knob.dataset.value = String(v);
    }

    function _promixSetSpatial(sourceId, kind, value, opts = {}) {
      const src = _ctrlGetPersistedSourceRef(sourceId) || _getSourceById(sourceId);
      if (!src) return false;
      const changed = kind === 'width'
        ? _setSourcePanWidth(src, null, _normalizeSourceWidth(value), {
            persist: opts.persist !== false,
            render: opts.render !== false
          })
        : _setSourcePanWidth(src, _normalizeSourcePan(value), null, {
            persist: opts.persist !== false,
            render: opts.render !== false
          });
      if (changed && opts.render === false) _promixUpdateSpatialUi(sourceId, kind, value, opts.ui || 'promix');
      return changed;
    }

    function _promixResetSpatial(sourceId, kind, ui = 'promix') {
      _promixSetSpatial(sourceId, kind, kind === 'width' ? 100 : 0, { ui });
    }

    function _promixSpatialKey(ev, sourceId, kind, ui = 'promix') {
      if (!ev) return;
      const key = String(ev.key || '');
      if (key === 'Home') {
        ev.preventDefault();
        _promixResetSpatial(sourceId, kind, ui);
        return;
      }
      if (key === 'End') {
        ev.preventDefault();
        _promixSetSpatial(sourceId, kind, kind === 'width' ? 200 : 100, { ui });
        return;
      }
      if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'ArrowUp' && key !== 'ArrowDown') return;
      ev.preventDefault();
      const src = _ctrlGetPersistedSourceRef(sourceId) || _getSourceById(sourceId);
      if (!src) return;
      const dir = (key === 'ArrowLeft' || key === 'ArrowDown') ? -1 : 1;
      const step = ev.shiftKey ? 10 : 2;
      if (kind === 'width') {
        _promixSetSpatial(sourceId, kind, _getSourceWidth(src) + (dir * step), { ui });
      } else {
        _promixSetSpatial(sourceId, kind, _getSourcePan(src) + (dir * step), { ui });
      }
    }

    function _promixRenderMeterScale() {
      return `<div class="promix-meter-scale-v">
        <span style="bottom:100%">0</span>
        <span style="bottom:84%">-6</span>
        <span style="bottom:72%">-10</span>
        <span style="bottom:56%">-20</span>
        <span style="bottom:36%">-30</span>
        <span style="bottom:18%">-40</span>
        <span style="bottom:0%">-60</span>
      </div>`;
    }

    /* ── Rotary knob drag interaction ── */
    let _promixKnobDrag = null;

    function _promixKnobDown(e) {
      e.preventDefault();
      e.stopPropagation();
      const knob = e.currentTarget;
      const srcId = knob.dataset.srcId;
      const busId = knob.dataset.busId;
      const startVal = parseFloat(knob.dataset.value) || 0;
      const startY = e.clientY;
      _promixKnobDrag = { srcId, busId, startVal, startY, knob };
      document.addEventListener('pointermove', _promixKnobMove, { passive: false });
      document.addEventListener('pointerup', _promixKnobUp);
      document.addEventListener('pointercancel', _promixKnobUp);
    }

    function _promixKnobMove(e) {
      if (!_promixKnobDrag) return;
      e.preventDefault();
      const dy = _promixKnobDrag.startY - e.clientY;
      const sensitivity = 150;
      const newVal = Math.max(0, Math.min(1, _promixKnobDrag.startVal + dy / sensitivity));
      _promixSetSendLevel(_promixKnobDrag.srcId, _promixKnobDrag.busId, newVal);
      _promixUpdateKnobSvg(_promixKnobDrag.knob, newVal);
    }

    function _promixKnobUp() {
      document.removeEventListener('pointermove', _promixKnobMove);
      document.removeEventListener('pointerup', _promixKnobUp);
      document.removeEventListener('pointercancel', _promixKnobUp);
      _promixKnobDrag = null;
    }

    function _promixUpdateKnobSvg(svg, v) {
      const arcLen = v * 65.97;
      const angle = -135 + v * 270;
      const circles = svg.querySelectorAll('circle');
      if (circles[1]) circles[1].setAttribute('stroke-dasharray', `${arcLen.toFixed(2)} 88`);
      const line = svg.querySelector('line');
      if (line) line.setAttribute('transform', `rotate(${angle.toFixed(1)} 18 18)`);
      svg.dataset.value = v.toFixed(3);
      const row = svg.closest('.promix-send-row');
      if (row) {
        const valEl = row.querySelector('.promix-send-val');
        if (valEl) valEl.textContent = v <= 0.001 ? '-\u221E' : (20 * Math.log10(v)).toFixed(1);
      }
    }

    let _promixSpatialDrag = null;
    function _promixSpatialKnobDown(e) {
      e.preventDefault();
      e.stopPropagation();
      const knob = e.currentTarget;
      const srcId = String(knob.dataset.srcId || '');
      const kind = String(knob.dataset.kind || 'pan');
      const ui = String(knob.dataset.ui || 'promix');
      const startVal = Number(knob.dataset.value || (kind === 'width' ? 100 : 0));
      _promixSpatialDrag = { srcId, kind, ui, startVal, startY: e.clientY, changed: false };
      document.addEventListener('pointermove', _promixSpatialKnobMove, { passive: false });
      document.addEventListener('pointerup', _promixSpatialKnobUp);
      document.addEventListener('pointercancel', _promixSpatialKnobUp);
    }

    function _promixSpatialKnobMove(e) {
      if (!_promixSpatialDrag) return;
      e.preventDefault();
      const dy = _promixSpatialDrag.startY - e.clientY;
      const kind = _promixSpatialDrag.kind;
      const sensitivity = kind === 'width' ? 1.2 : 0.95;
      const raw = _promixSpatialDrag.startVal + (dy / sensitivity);
      const changed = kind === 'width'
        ? _promixSetSpatial(_promixSpatialDrag.srcId, kind, raw, { persist: false, render: false, ui: _promixSpatialDrag.ui })
        : _promixSetSpatial(_promixSpatialDrag.srcId, kind, raw, { persist: false, render: false, ui: _promixSpatialDrag.ui });
      if (changed) _promixSpatialDrag.changed = true;
    }

    function _promixSpatialKnobUp() {
      document.removeEventListener('pointermove', _promixSpatialKnobMove);
      document.removeEventListener('pointerup', _promixSpatialKnobUp);
      document.removeEventListener('pointercancel', _promixSpatialKnobUp);
      if (_promixSpatialDrag && _promixSpatialDrag.changed) {
        if (typeof schedulePersistAppState === 'function') schedulePersistAppState();
        if (_promixOpen) renderProMixer();
      }
      _promixSpatialDrag = null;
    }

    /* ── Bus strip volume / mute ── */
    function _promixSetBusVolume(busId, vol) {
      const bus = _promixGetBusById(busId);
      if (!bus) return;
      bus.volume = Math.max(0, Math.min(1.5, Number(vol) || 0));
      const nodes = _promixBusNodes[busId];
      if (nodes && nodes.outputGain) {
        try {
          const ctx = _pgmAudioCtx;
          const now = ctx ? ctx.currentTime : 0;
          nodes.outputGain.gain.cancelScheduledValues(now);
          nodes.outputGain.gain.setTargetAtTime(bus.muted ? 0 : bus.volume, now, 0.01);
        } catch (_) {
          nodes.outputGain.gain.value = bus.muted ? 0 : bus.volume;
        }
      }
      const dbEl = document.getElementById('promix-db-' + busId);
      if (dbEl) {
        dbEl.textContent = bus.volume <= 0.0001 ? '-\u221E' : (20 * Math.log10(bus.volume)).toFixed(1) + ' dB';
      }
      if (typeof schedulePersistAppState === 'function') schedulePersistAppState();
    }

    function _promixToggleBusMute(busId) {
      const bus = _promixGetBusById(busId);
      if (!bus) return;
      bus.muted = !bus.muted;
      const nodes = _promixBusNodes[busId];
      if (nodes && nodes.outputGain) {
        nodes.outputGain.gain.value = bus.muted ? 0 : bus.volume;
      }
      if (typeof schedulePersistAppState === 'function') schedulePersistAppState();
      if (_promixOpen) renderProMixer();
    }

    /** Render a bus strip (has own FX chain, fader, meters). */
    function _promixRenderBusStrip(bus) {
      const vol = Math.max(0, Math.min(1.5, bus.volume || 1));
      const dbLabel = vol <= 0.0001 ? '-\u221E' : (20 * Math.log10(vol)).toFixed(1) + ' dB';
      const isMuted = !!bus.muted;
      const fxChain = bus.fxChain || [];
      let fxHtml = '';
      fxChain.forEach((fx, idx) => {
        const isActive = _promixSelectedFx && _promixSelectedFx.sourceId === bus.id && _promixSelectedFx.fxId === fx.id;
        const dis = fx.enabled === false ? ' disabled' : '';
        const powerCls = fx.enabled === false ? ' off' : '';
        fxHtml += `<div class="promix-fx-slot${isActive ? ' active' : ''}${dis}" data-src-id="${bus.id}" data-fx-id="${fx.id}" data-fx-idx="${idx}" onpointerdown="_promixFxPointerDown(event)" title="${esc(_fxLabel(fx.type))}">`
          + `<span class="promix-fx-label">${esc(_fxLabel(fx.type))}</span>`
          + `<div class="promix-fx-actions">`
          +   `<button class="promix-fx-act promix-fx-act-power${powerCls}" onclick="_promixActPower('${bus.id}','${fx.id}',event)" title="${fx.enabled === false ? 'Enable' : 'Bypass'}"><svg viewBox="0 0 24 24"><path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42A6.92 6.92 0 0 1 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.05.88-3.9 2.29-5.18L5.88 5.46A8.96 8.96 0 0 0 3 12a9 9 0 1 0 18 0c0-2.74-1.23-5.19-3.17-6.83z"/></svg></button>`
          +   `<button class="promix-fx-act promix-fx-act-edit" onclick="_promixActEdit('${bus.id}','${fx.id}',event)" title="Parameters"><svg viewBox="0 0 24 24"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg></button>`
          +   `<button class="promix-fx-act promix-fx-act-swap" onclick="_promixActSwap('${bus.id}','${fx.id}',event)" title="Replace FX"><svg viewBox="0 0 24 24"><path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z"/></svg></button>`
          + `</div></div>`;
      });
      fxHtml += `<div class="promix-fx-slot-empty" onclick="_promixAddFxToStrip('${bus.id}',event)">+ FX</div>`;
      return `<div class="promix-strip bus" data-src-id="${bus.id}">
        <div class="promix-strip-scroll">
          <div class="promix-input-row promix-row-ghost" aria-hidden="true"><span>&nbsp;</span></div>
          <div class="promix-sends-section promix-row-ghost" aria-hidden="true"><span>&nbsp;</span></div>
          <div class="promix-spatial-row promix-row-ghost" aria-hidden="true"><span>&nbsp;</span></div>
          <div class="promix-fx-slots">${fxHtml}</div>
        </div>
        <div class="promix-fader-area">
          ${_promixRenderMeterScale()}
          <div class="promix-meter-col">
            <div class="promix-meter-bar-v"><div class="promix-meter-fill-v" id="promix-fill-l-${bus.id}"></div><div class="promix-meter-peak-v" id="promix-peak-l-${bus.id}"></div></div>
          </div>
          <div class="promix-meter-col promix-meter-col-r">
            <div class="promix-meter-bar-v"><div class="promix-meter-fill-v" id="promix-fill-r-${bus.id}"></div><div class="promix-meter-peak-v" id="promix-peak-r-${bus.id}"></div></div>
          </div>
          <div class="promix-fader-wrap">
            <input type="range" class="promix-fader" min="0" max="150" value="${Math.round(vol * 100)}" oninput="_promixSetBusVolume('${bus.id}',this.value/100)">
          </div>
        </div>
        <div class="promix-strip-bottom">
          <div class="promix-db-label" id="promix-db-${bus.id}">${dbLabel}</div>
          <div class="promix-strip-btns">
            <button class="promix-btn${isMuted ? ' muted' : ''}" onclick="_promixToggleBusMute('${bus.id}')">M</button>
            <button class="promix-btn" style="opacity:0.3;cursor:default;" disabled>S</button>
          </div>
          <div class="promix-strip-name${bus.id !== 'bus_1' ? ' has-delete' : ''}" style="--promix-name-bg-top:#34d399cc;--promix-name-bg-bottom:#34d399a8;--promix-name-border:#86efac99;position:relative;" title="${esc(bus.name)}">${esc(bus.name)}${bus.id !== 'bus_1' ? `<button class="promix-bus-delete" onclick="_promixRemoveBus('${bus.id}')" title="Remove Bus">&times;</button>` : ''}</div>
        </div>
      </div>`;
    }

    /** Render the label strip (fixed left column with category names). */
    function _promixRenderLabelStrip() {
      return `<div class="promix-strip promix-label-strip">
        <div class="promix-strip-scroll">
          <div class="promix-input-row"><span class="promix-cat-label">Input</span></div>
          <div class="promix-sends-section"><span class="promix-cat-label">Sends</span></div>
          <div class="promix-spatial-row"><span class="promix-cat-label">Pan/Width</span></div>
          <div class="promix-fx-slots"><span class="promix-cat-label">Audio FX</span></div>
        </div>
        <div class="promix-fader-area"><span class="promix-cat-label">Level</span></div>
        <div class="promix-strip-bottom"><span class="promix-cat-label">Channel</span></div>
      </div>`;
    }

    function _promixGetMasterFx() {
      return _promixMasterFx;
    }
    function _promixSaveMasterFx() {
      if (typeof schedulePersistAppState === 'function') schedulePersistAppState();
    }

    /** Rebuild the master FX chain in the audio graph.
     *  Path: _pgmMerger → [preFxGain → FX1 → FX2 → … → postFxGain] → outputs
     *  When no FX are active, merger connects directly to outputs (clean pass-through).
     */
    function _promixRebuildMasterFxChain() {
      if (!_pgmMerger || !_pgmAudioCtx) return;
      const ctx = _pgmAudioCtx;
      // Disconnect old master FX nodes
      if (_promixMasterPreFxGain) {
        try { _pgmMerger.disconnect(_promixMasterPreFxGain); } catch (_) {}
        try { _promixMasterPreFxGain.disconnect(); } catch (_) {}
      }
      if (_promixMasterPostFxGain) {
        try { _promixMasterPostFxGain.disconnect(); } catch (_) {}
      }
      if (Array.isArray(_promixMasterFxNodes)) {
        _promixMasterFxNodes.forEach(n => { try { n.disconnect(); } catch (_) {} });
      }
      _promixMasterFxNodes = [];
      _promixMasterFxRuntime = {};
      // Disconnect merger from its old downstream (stream/splitter/monitor)
      try { _pgmMerger.disconnect(); } catch (_) {}
      // Build FX chain
      const activeChain = _promixMasterFx.filter(fx => fx && fx.enabled !== false);
      if (activeChain.length === 0) {
        // No active FX — clean pass-through
        _promixMasterPreFxGain = null;
        _promixMasterPostFxGain = null;
        // Re-wire merger directly to outputs
        _pgmMerger.connect(_pgmStreamGain);
        _pgmMerger.connect(_pgmSplitter);
        if (_pgmMonitorMixer) _pgmMerger.connect(_pgmHeadphoneGain);
      } else {
        // Create pre/post gain nodes for smooth crossfade
        _promixMasterPreFxGain = ctx.createGain();
        _promixMasterPreFxGain.gain.value = 1;
        _promixMasterPostFxGain = ctx.createGain();
        _promixMasterPostFxGain.gain.value = 1;
        _pgmMerger.connect(_promixMasterPreFxGain);
        let tail = _promixMasterPreFxGain;
        for (const fx of activeChain) {
          const node = typeof _pgmCreateFxNode === 'function' ? _pgmCreateFxNode(ctx, fx) : null;
          if (!node) continue;
          try {
            if (node.input && node.output) {
              tail.connect(node.input);
              tail = node.output;
              (node.nodes || []).forEach(n => _promixMasterFxNodes.push(n));
              _promixMasterFxRuntime[fx.id] = node;
            } else {
              tail.connect(node);
              tail = node;
              _promixMasterFxNodes.push(node);
              _promixMasterFxRuntime[fx.id] = node;
            }
          } catch (_) {}
        }
        tail.connect(_promixMasterPostFxGain);
        // Connect post-FX to outputs
        _promixMasterPostFxGain.connect(_pgmStreamGain);
        _promixMasterPostFxGain.connect(_pgmSplitter);
        if (_pgmHeadphoneGain) _promixMasterPostFxGain.connect(_pgmHeadphoneGain);
      }
      // Re-connect splitter to analysers
      try { _pgmSplitter.disconnect(); } catch (_) {}
      _pgmSplitter.connect(_pgmAnalyserL, 0);
      _pgmSplitter.connect(_pgmAnalyserR, 1);
    }

    /** Rebuild a bus FX chain in the audio graph (disconnect old, insert new). */
    function _promixRebuildBusFxChain(busId) {
      const nodes = _promixBusNodes[busId];
      if (!nodes) return;
      const bus = _promixGetBusById(busId);
      if (!bus) return;
      const ctx = _pgmAudioCtx;
      if (!ctx) return;
      // Disconnect old FX nodes
      try { nodes.inputGain.disconnect(); } catch (_) {}
      if (Array.isArray(nodes.fxNodes)) {
        nodes.fxNodes.forEach(n => { try { n.disconnect(); } catch (_) {} });
      }
      nodes.fxNodes = [];
      // Build new FX chain
      let tail = nodes.inputGain;
      const chain = bus.fxChain || [];
      for (const fx of chain) {
        if (!fx || fx.enabled === false) continue;
        const node = typeof _pgmCreateFxNode === 'function' ? _pgmCreateFxNode(ctx, fx) : null;
        if (!node) continue;
        try {
          if (node.input && node.output) {
            tail.connect(node.input);
            tail = node.output;
            (node.nodes || []).forEach(n => nodes.fxNodes.push(n));
          } else {
            tail.connect(node);
            tail = node;
            nodes.fxNodes.push(node);
          }
        } catch (_) {}
      }
      // Only connect to outputGain if at least one FX node was inserted.
      // An empty / all-bypassed bus should not pass signal through,
      // because the dry signal already reaches the merger directly.
      if (tail !== nodes.inputGain) {
        tail.connect(nodes.outputGain);
      }
    }

    function openProMixer() {
      const overlay = document.getElementById('promix-overlay');
      if (!overlay) return;
      _promixSceneId = String(_activeSceneId || '');
      _promixOpen = true;
      overlay.classList.add('open');
      renderProMixer();
      if (!_promixUserMoved) {
        requestAnimationFrame(() => _promixPositionNearGearButton());
      }
      _promixStartMeters();
      _promixInitDrag();
    }
    function closeProMixer() {
      const overlay = document.getElementById('promix-overlay');
      if (overlay) overlay.classList.remove('open');
      const footer = document.getElementById('promix-footer');
      if (footer) footer.remove();
      _promixOpen = false;
      _promixStopMeters();
      _promixCloseParamPop();
      _promixCloseAddPicker();
      _promixCloseInputRoutePop();
    }

    function _promixMenuAddBus() {
      _promixAddBus();
      if (typeof showToast === 'function') showToast('Bus added');
    }

    function _promixMenuOpenMasterFx() {
      if (!_promixOpen) return;
      renderProMixer();
      const masterStrip = document.querySelector('.promix-strip.master');
      if (!masterStrip) return;
      if (!_promixMasterFx.length) {
        const plus = masterStrip.querySelector('.promix-fx-slot-empty');
        if (plus) {
          _promixAddFxToStrip('__master__', {
            stopPropagation: () => {},
            currentTarget: plus
          });
        }
        return;
      }
      const fx = _promixMasterFx[0];
      if (!fx) return;
      _promixSelectedFx = { sourceId: '__master__', fxId: fx.id };
      const anchor = masterStrip.querySelector(`.promix-fx-slot[data-fx-id="${fx.id}"]`);
      if (anchor) _promixShowParamPop('__master__', fx.id, anchor);
      renderProMixer();
    }

    function _promixMenuOpenSettings() {
      if (typeof openModal === 'function') openModal('settingsModal');
    }

    function _promixMenuResetSolo() {
      if (_promixSoloId) {
        _promixToggleSolo(_promixSoloId);
        if (typeof showToast === 'function') showToast('Solo cleared');
      }
    }

    function _promixMenuMuteAll() {
      const srcs = _promixGetAudioSources();
      srcs.forEach((s) => {
        _ctrlHydrateSourceState(s.id);
        _ctrlMutedSources.add(s.id);
        if (s && s.config) s.config.mixerMuted = true;
        const liveStream = _activeStreams[s.id];
        if (liveStream) _ctrlApplyMuteToStream(s.id, liveStream);
        if (s.type === 'ndi') {
          const ndiAudio = _ndiAudioStreams[s.id];
          if (ndiAudio && ndiAudio !== liveStream) _ctrlApplyMuteToStream(s.id, ndiAudio);
        }
        _ctrlApplyMixGainToProgramSource(s.id, true);
      });
      if (_promixSoloId) _promixToggleSolo(_promixSoloId);
      _pgmSyncSources();
      _pgmRenderMixDebugPanel(true);
      renderControlsPanel();
      if (typeof schedulePersistAppState === 'function') schedulePersistAppState();
      if (_promixOpen) renderProMixer();
      if (typeof showToast === 'function') showToast('All channels muted');
    }

    function _promixMenuUnmuteAll() {
      const srcs = _promixGetAudioSources();
      srcs.forEach((s) => {
        _ctrlHydrateSourceState(s.id);
        _ctrlMutedSources.delete(s.id);
        if (s && s.config) s.config.mixerMuted = false;
        const liveStream = _activeStreams[s.id];
        if (liveStream) _ctrlApplyMuteToStream(s.id, liveStream);
        if (s.type === 'ndi') {
          const ndiAudio = _ndiAudioStreams[s.id];
          if (ndiAudio && ndiAudio !== liveStream) _ctrlApplyMuteToStream(s.id, ndiAudio);
        }
        _ctrlApplyMixGainToProgramSource(s.id, true);
      });
      _pgmSyncSources();
      _pgmRenderMixDebugPanel(true);
      renderControlsPanel();
      if (typeof schedulePersistAppState === 'function') schedulePersistAppState();
      if (_promixOpen) renderProMixer();
      if (typeof showToast === 'function') showToast('All channels unmuted');
    }

    function _promixMenuUnityGain() {
      const srcs = _promixGetAudioSources();
      srcs.forEach((s) => {
        _ctrlHydrateSourceState(s.id);
        _ctrlVolumes[s.id] = 1;
        if (s && s.config) s.config.mixerVolume = 1;
      });
      if (typeof schedulePersistAppState === 'function') schedulePersistAppState();
      if (_promixOpen) renderProMixer();
      if (typeof showToast === 'function') showToast('All channel gains set to unity');
    }

    function _promixUpdateMenuMuteButtons(audioSources) {
      const muteBtn = document.getElementById('promix-menu-mute-all');
      const unmuteBtn = document.getElementById('promix-menu-unmute-all');
      if (!muteBtn || !unmuteBtn) return;
      const srcs = Array.isArray(audioSources) ? audioSources : _promixGetAudioSources();
      const total = srcs.length;
      let mutedCount = 0;
      srcs.forEach((s) => {
        _ctrlHydrateSourceState(s.id);
        if (_ctrlMutedSources.has(s.id)) mutedCount += 1;
      });
      const allMuted = total > 0 && mutedCount === total;
      const allUnmuted = total > 0 && mutedCount === 0;
      muteBtn.classList.toggle('is-active-mute', allMuted);
      unmuteBtn.classList.toggle('is-active-unmute', allUnmuted);
    }

    /* ── Draggable window ── */
    let _promixDragInited = false;
    function _promixInitDrag() {
      if (_promixDragInited) return;
      _promixDragInited = true;
      const titlebar = document.querySelector('.promix-titlebar');
      const win = document.getElementById('promix-window');
      if (!titlebar || !win) return;
      let dragging = false, startX = 0, startY = 0, origX = 0, origY = 0;
      titlebar.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button,select,input,textarea,[data-promix-nodrag]')) return;
        dragging = true;
        startX = e.clientX; startY = e.clientY;
        const rect = win.getBoundingClientRect();
        origX = rect.left; origY = rect.top;
        titlebar.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      titlebar.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX, dy = e.clientY - startY;
        _promixUserMoved = true;
        win.style.position = 'fixed';
        win.style.left = Math.max(0, Math.min(origX + dx, window.innerWidth - 100)) + 'px';
        win.style.top = Math.max(0, Math.min(origY + dy, window.innerHeight - 60)) + 'px';
        win.style.margin = '0';
        win.style.bottom = 'auto';
      });
      const endDrag = () => { dragging = false; };
      titlebar.addEventListener('pointerup', endDrag);
      titlebar.addEventListener('pointercancel', endDrag);

      const ensureFixedPosition = () => {
        const rect = win.getBoundingClientRect();
        if (!win.style.position || win.style.position === 'absolute') {
          win.style.position = 'fixed';
          win.style.left = rect.left + 'px';
          win.style.top = rect.top + 'px';
          win.style.margin = '0';
          win.style.bottom = 'auto';
        }
        return rect;
      };

      const setupResizeHandle = (handle, axis) => {
        if (!handle) return;
        let resizing = false;
        let startX = 0, startY = 0;
        let origLeft = 0, origTop = 0, origW = 0, origH = 0;
        handle.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          resizing = true;
          startX = e.clientX;
          startY = e.clientY;
          const rect = ensureFixedPosition();
          origLeft = rect.left;
          origTop = rect.top;
          origW = rect.width;
          origH = rect.height;
          handle.setPointerCapture(e.pointerId);
        });
        handle.addEventListener('pointermove', (e) => {
          if (!resizing) return;
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          _promixUserMoved = true;
          if (axis === 'top') {
            const maxH = Math.max(160, window.innerHeight - origTop);
            const newH = Math.max(160, Math.min(maxH, origH - dy));
            const newTop = Math.max(0, origTop + (origH - newH));
            win.style.height = newH + 'px';
            win.style.top = newTop + 'px';
          } else if (axis === 'right') {
            const maxW = Math.max(420, window.innerWidth - origLeft);
            const newW = Math.max(420, Math.min(maxW, origW + dx));
            win.style.width = newW + 'px';
          } else if (axis === 'bottom') {
            const maxH = Math.max(160, window.innerHeight - origTop);
            const newH = Math.max(160, Math.min(maxH, origH + dy));
            win.style.height = newH + 'px';
          }
        });
        const endResize = () => { resizing = false; };
        handle.addEventListener('pointerup', endResize);
        handle.addEventListener('pointercancel', endResize);
      };

      setupResizeHandle(document.getElementById('promix-resize-handle'), 'top');
      setupResizeHandle(document.getElementById('promix-resize-handle-right'), 'right');
      setupResizeHandle(document.getElementById('promix-resize-handle-bottom'), 'bottom');
    }

    function _promixPositionNearGearButton() {
      const win = document.getElementById('promix-window');
      if (!win) return;
      const gearBtn =
        document.querySelector('.studio-pane-title .promix-gear-btn[onclick*="openProMixer"]')
        || document.querySelector('.promix-gear-btn[onclick*="openProMixer"]');
      if (!gearBtn) return;

      const btnRect = gearBtn.getBoundingClientRect();
      const winRect = win.getBoundingClientRect();
      const winW = winRect.width || Math.min(window.innerWidth * 0.95, 920);
      const winH = winRect.height || Math.min(window.innerHeight * 0.9, 580);
      const pad = 8;

      // Open above the gear button, anchored to its left side (window sits left of button).
      let left = btnRect.right - winW;
      let top = btnRect.top - winH - 8;
      if (top < pad) top = btnRect.bottom + 8;

      left = Math.max(pad, Math.min(left, window.innerWidth - winW - pad));
      top = Math.max(pad, Math.min(top, window.innerHeight - winH - pad));

      win.style.position = 'fixed';
      win.style.left = `${Math.round(left)}px`;
      win.style.top = `${Math.round(top)}px`;
      win.style.margin = '0';
      win.style.bottom = 'auto';
    }

    function _promixGetSceneForView() {
      const chosen = _getScene(_promixSceneId);
      if (chosen) return chosen;
      return _activeScene();
    }

    function _promixPopulateSceneSelect() {
      const sel = document.getElementById('promix-scene-select');
      if (!sel) return;
      const activeId = String(_activeSceneId || '');
      if (!_promixSceneId || !_getScene(_promixSceneId)) _promixSceneId = activeId;
      const targetId = String(_promixSceneId || activeId || '');
      let html = '';
      _scenes.forEach((scene) => {
        const id = String(scene.id || '');
        const selected = id === targetId ? ' selected' : '';
        html += `<option value="${esc(id)}"${selected}>${esc(scene.name || 'Scene')}</option>`;
      });
      sel.innerHTML = html;
      if (targetId) sel.value = targetId;
    }

    function _promixSelectScene(sceneId) {
      const id = String(sceneId || '');
      if (!id || !_getScene(id)) return;
      _promixSceneId = id;
      if (_promixOpen) renderProMixer();
    }

    function _promixGetAudioSources() {
      const scene = _promixGetSceneForView();
      if (!scene) return [];
      return scene.sources.filter(s => {
        if (s.type === 'audio-input' || s.type === 'media-source' || s.type === 'ndi') return true;
        if (s.type === 'camera') {
          if (String(scene.id || '') !== String(_activeSceneId || '')) return true;
          const stream = _activeStreams[s.id];
          return stream && stream.active && stream.getAudioTracks().length > 0;
        }
        return false;
      });
    }

    function renderProMixer() {
      const body = document.getElementById('promix-body');
      if (!body) return;
      _promixCloseInputRoutePop();
      const existingFooter = document.getElementById('promix-footer');
      if (existingFooter) existingFooter.remove();
      body.style.paddingBottom = '';
      const scene = _promixGetSceneForView();
      _promixPopulateSceneSelect();
      const sceneLbl = document.getElementById('promix-scene-label');
      if (sceneLbl) sceneLbl.textContent = 'Scene:';
      const audioSources = _promixGetAudioSources();
      _promixUpdateMenuMuteButtons(audioSources);
      const stripCountEl = document.getElementById('promix-strip-count');
      if (stripCountEl) {
        const total = audioSources.length + _promixBuses.length + 1; // channels + buses + master
        stripCountEl.textContent = `${total} strips`;
      }
      if (!audioSources.length && !_promixMasterFx.length) {
        body.innerHTML = `<div style="padding:24px;color:#556;font-size:12px;text-align:center;">${esc(t('ui_no_audio_layers_scene'))}</div>`;
        return;
      }
      const sourceColors = {
        'camera': '#60a5fa', 'audio-input': '#f472b6', 'media-source': '#fb923c',
        'ndi': '#a78bfa', 'image': '#34d399', 'text': '#38bdf8',
      };
      let html = '';
      /* Category label column (sticky left) */
      html += _promixRenderLabelStrip();
      audioSources.forEach(src => {
        _ctrlHydrateSourceState(src.id);
        html += _promixRenderStrip(src, _getSourceTrackColor(src, sourceColors[src.type] || '#8899aa'));
      });
      /* Bus strips */
      _promixBuses.forEach(bus => {
        html += _promixRenderBusStrip(bus);
      });
      /* Add-bus button strip */
      html += `<div class="promix-strip promix-add-bus-strip" onclick="_promixAddBus()" title="Add Bus">
        <div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:4px;cursor:pointer;opacity:0.5;transition:opacity 0.15s;"
             onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0.5'">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span style="font-size:9px;letter-spacing:0.5px;text-transform:uppercase;">Bus</span>
        </div>
      </div>`;
      /* Master strip */
      html += _promixRenderMasterStrip();
      body.innerHTML = html;
      // Ensure meters are started for all audio sources (including NDI)
      audioSources.forEach(src => {
        if (src.visible !== false && !_ctrlMeters[src.id]) {
          let stream = _activeStreams[src.id];
          if (src.type === 'ndi') {
            const ndiAudio = _ndiAudioStreams[src.id];
            if (ndiAudio && ndiAudio.active && ndiAudio.getAudioTracks().length) {
              stream = ndiAudio;
            }
          }
          if (stream && stream.active) {
            _ctrlStartMeter(src.id, stream);
          }
        }
      });
    }

    function _promixRenderStrip(src, color) {
      const isMuted = _ctrlMutedSources.has(src.id);
      const isSolo = _promixSoloId === src.id;
      const vol = Math.max(0, Math.min(1.5, Number(_ctrlVolumes[src.id] ?? 1)));
      const dbLabel = vol <= 0.0001 ? '-∞' : (20 * Math.log10(vol)).toFixed(1) + ' dB';
      const inputMode = _getSourceInputMode(src);
      _ensureSourceAudioFxDefaults(src);
      const fxChain = _normalizeAudioFxStack(src.config?.audioFx || []);
      src.config.audioFx = fxChain;
      /* FX slots */
      let fxHtml = '';
      fxChain.forEach((fx, idx) => {
        const isActive = _promixSelectedFx && _promixSelectedFx.sourceId === src.id && _promixSelectedFx.fxId === fx.id;
        const dis = fx.enabled === false ? ' disabled' : '';
        const powerCls = fx.enabled === false ? ' off' : '';
        fxHtml += `<div class="promix-fx-slot${isActive ? ' active' : ''}${dis}" data-src-id="${src.id}" data-fx-id="${fx.id}" data-fx-idx="${idx}" onpointerdown="_promixFxPointerDown(event)" title="${esc(_fxLabel(fx.type))}">`
          + `<span class="promix-fx-label">${esc(_fxLabel(fx.type))}</span>`
          + `<div class="promix-fx-actions">`
          +   `<button class="promix-fx-act promix-fx-act-power${powerCls}" onclick="_promixActPower('${src.id}','${fx.id}',event)" title="${fx.enabled === false ? 'Enable' : 'Bypass'}"><svg viewBox="0 0 24 24"><path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42A6.92 6.92 0 0 1 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.05.88-3.9 2.29-5.18L5.88 5.46A8.96 8.96 0 0 0 3 12a9 9 0 1 0 18 0c0-2.74-1.23-5.19-3.17-6.83z"/></svg></button>`
          +   `<button class="promix-fx-act promix-fx-act-edit" onclick="_promixActEdit('${src.id}','${fx.id}',event)" title="Parameters"><svg viewBox="0 0 24 24"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg></button>`
          +   `<button class="promix-fx-act promix-fx-act-swap" onclick="_promixActSwap('${src.id}','${fx.id}',event)" title="Replace FX"><svg viewBox="0 0 24 24"><path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z"/></svg></button>`
          + `</div></div>`;
      });
      fxHtml += `<div class="promix-fx-slot-empty" onclick="_promixAddFxToStrip('${src.id}',event)">+ FX</div>`;
      return `<div class="promix-strip ${inputMode === 'mono' ? 'promix-strip-input-mono' : ''}" data-src-id="${src.id}">
        <div class="promix-strip-scroll">
          ${_promixRenderInputModeRow(src)}
          ${_promixRenderSends(src.id)}
          ${_promixRenderSpatialRow(src)}
          <div class="promix-fx-slots">${fxHtml}</div>
        </div>
        <div class="promix-fader-area">
          ${_promixRenderMeterScale()}
          <div class="promix-meter-col">
            <div class="promix-meter-bar-v"><div class="promix-meter-fill-v" id="promix-fill-l-${src.id}"></div><div class="promix-meter-peak-v" id="promix-peak-l-${src.id}"></div></div>
          </div>
          <div class="promix-meter-col promix-meter-col-r">
            <div class="promix-meter-bar-v"><div class="promix-meter-fill-v" id="promix-fill-r-${src.id}"></div><div class="promix-meter-peak-v" id="promix-peak-r-${src.id}"></div></div>
          </div>
          <div class="promix-fader-wrap">
            <input type="range" class="promix-fader" min="0" max="150" value="${Math.round(vol * 100)}" oninput="_promixSetVolume('${src.id}',this.value/100)">
          </div>
        </div>
        <div class="promix-strip-bottom">
          <div class="promix-db-label" id="promix-db-${src.id}">${dbLabel}</div>
          <div class="promix-strip-btns">
            <button class="promix-btn${isMuted ? ' muted' : ''}" onclick="_promixToggleMute('${src.id}')">M</button>
            <button class="promix-btn${isSolo ? ' solo-active' : ''}" onclick="_promixToggleSolo('${src.id}')">S</button>
          </div>
          <div class="promix-strip-name" style="--promix-name-bg-top:${color}cc;--promix-name-bg-bottom:${color}a8;--promix-name-border:${color}99;" title="${esc(src.name)}">${esc(src.name)}</div>
        </div>
      </div>`;
    }

    function _promixRenderMasterStrip() {
      const vol = Math.max(0, Math.min(1.5, _promixMasterVolume));
      const dbLabel = vol <= 0.0001 ? '-∞' : (20 * Math.log10(vol)).toFixed(1) + ' dB';
      let fxHtml = '';
      _promixMasterFx.forEach((fx, idx) => {
        const isActive = _promixSelectedFx && _promixSelectedFx.sourceId === '__master__' && _promixSelectedFx.fxId === fx.id;
        const dis = fx.enabled === false ? ' disabled' : '';
        const powerCls = fx.enabled === false ? ' off' : '';
        fxHtml += `<div class="promix-fx-slot${isActive ? ' active' : ''}${dis}" data-src-id="__master__" data-fx-id="${fx.id}" data-fx-idx="${idx}" onpointerdown="_promixFxPointerDown(event)" title="${esc(_fxLabel(fx.type))}">`
          + `<span class="promix-fx-label">${esc(_fxLabel(fx.type))}</span>`
          + `<div class="promix-fx-actions">`
          +   `<button class="promix-fx-act promix-fx-act-power${powerCls}" onclick="_promixActPower('__master__','${fx.id}',event)" title="${fx.enabled === false ? 'Enable' : 'Bypass'}"><svg viewBox="0 0 24 24"><path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42A6.92 6.92 0 0 1 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.05.88-3.9 2.29-5.18L5.88 5.46A8.96 8.96 0 0 0 3 12a9 9 0 1 0 18 0c0-2.74-1.23-5.19-3.17-6.83z"/></svg></button>`
          +   `<button class="promix-fx-act promix-fx-act-edit" onclick="_promixActEdit('__master__','${fx.id}',event)" title="Parameters"><svg viewBox="0 0 24 24"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg></button>`
          +   `<button class="promix-fx-act promix-fx-act-swap" onclick="_promixActSwap('__master__','${fx.id}',event)" title="Replace FX"><svg viewBox="0 0 24 24"><path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z"/></svg></button>`
          + `</div></div>`;
      });
      fxHtml += `<div class="promix-fx-slot-empty" onclick="_promixAddFxToStrip('__master__',event)">+ FX</div>`;
      return `<div class="promix-strip master" data-src-id="__master__">
        <div class="promix-strip-scroll">
          <div class="promix-input-row promix-row-ghost" aria-hidden="true"><span>&nbsp;</span></div>
          <div class="promix-sends-section promix-row-ghost" aria-hidden="true"><span>&nbsp;</span></div>
          <div class="promix-spatial-row promix-row-ghost" aria-hidden="true"><span>&nbsp;</span></div>
          <div class="promix-fx-slots">${fxHtml}</div>
        </div>
        <div class="promix-fader-area">
          ${_promixRenderMeterScale()}
          <div class="promix-meter-col">
            <div class="promix-meter-bar-v"><div class="promix-meter-fill-v" id="promix-fill-master-l"></div><div class="promix-meter-peak-v" id="promix-peak-master-l"></div></div>
          </div>
          <div class="promix-meter-col promix-meter-col-r">
            <div class="promix-meter-bar-v"><div class="promix-meter-fill-v" id="promix-fill-master-r"></div><div class="promix-meter-peak-v" id="promix-peak-master-r"></div></div>
          </div>
          <div class="promix-fader-wrap">
            <input type="range" class="promix-fader" min="0" max="150" value="${Math.round(vol * 100)}" oninput="_promixSetMasterVolume(this.value/100)">
          </div>
        </div>
        <div class="promix-strip-bottom">
          <div class="promix-db-label" id="promix-db-master">${dbLabel}</div>
          <div class="promix-strip-btns">
            <button class="promix-btn" style="opacity:0.3;cursor:default;" disabled>M</button>
            <button class="promix-btn" style="opacity:0.3;cursor:default;" disabled>S</button>
          </div>
          <div class="promix-strip-name" style="--promix-name-bg-top:#fbbf24cc;--promix-name-bg-bottom:#f59e0ba8;--promix-name-border:#fde68a99;">Master</div>
        </div>
      </div>`;
    }

    /* Volume / Mute / Solo */
    function _promixSetVolume(sourceId, vol) {
      _ctrlSetVolume(sourceId, vol);
      const dbEl = document.getElementById('promix-db-' + sourceId);
      if (dbEl) {
        const v = Math.max(0, Math.min(1.5, vol));
        dbEl.textContent = v <= 0.0001 ? '-∞' : (20 * Math.log10(v)).toFixed(1) + ' dB';
      }
    }
    function _promixToggleMute(sourceId) {
      _ctrlToggleMute(sourceId);
      if (_promixOpen) renderProMixer();
    }
    function _promixToggleSolo(sourceId) {
      if (_promixSoloId === sourceId) {
        _promixSoloId = '';
        /* Un-solo: unmute all */
        const srcs = _promixGetAudioSources();
        srcs.forEach(s => {
          if (_ctrlMutedSources.has(s.id) && s._promixPreSoloMuted !== true) {
            _ctrlMutedSources.delete(s.id);
            const stream = _activeStreams[s.id];
            _ctrlApplyMuteToStream(s.id, stream);
            const ndiA = _ndiAudioStreams[s.id];
            if (ndiA && ndiA !== stream) _ctrlApplyMuteToStream(s.id, ndiA);
            _ctrlApplyMixGainToProgramSource(s.id, true);
            _ctrlPersistSourceState(s.id);
          }
          delete s._promixPreSoloMuted;
        });
      } else {
        _promixSoloId = sourceId;
        const srcs = _promixGetAudioSources();
        srcs.forEach(s => {
          s._promixPreSoloMuted = _ctrlMutedSources.has(s.id);
          if (s.id === sourceId) {
            _ctrlMutedSources.delete(s.id);
          } else {
            _ctrlMutedSources.add(s.id);
          }
          const stream = _activeStreams[s.id];
          _ctrlApplyMuteToStream(s.id, stream);
          const ndiA = _ndiAudioStreams[s.id];
          if (ndiA && ndiA !== stream) _ctrlApplyMuteToStream(s.id, ndiA);
          _ctrlApplyMixGainToProgramSource(s.id, true);
          _ctrlPersistSourceState(s.id);
        });
      }
      renderControlsPanel();
      if (_promixOpen) renderProMixer();
    }

    function _promixSetMasterVolume(vol) {
      _promixMasterVolume = Math.max(0, Math.min(1.5, Number(vol) || 0));
      if (_pgmMerger && _pgmMerger.gain) {
        const ctx = _pgmAudioCtx;
        if (ctx) {
          try {
            const now = ctx.currentTime || 0;
            _pgmMerger.gain.cancelScheduledValues(now);
            _pgmMerger.gain.setTargetAtTime(_promixMasterVolume, now, 0.012);
          } catch (_) {
            _pgmMerger.gain.value = _promixMasterVolume;
          }
        } else {
          _pgmMerger.gain.value = _promixMasterVolume;
        }
      }
      const dbEl = document.getElementById('promix-db-master');
      if (dbEl) {
        const v = _promixMasterVolume;
        dbEl.textContent = v <= 0.0001 ? '-∞' : (20 * Math.log10(v)).toFixed(1) + ' dB';
      }
      _promixSaveMasterFx();
    }

    /* ── Per-strip meters (vertical) ── */
    const _promixPeakState = {};
    function _promixStartMeters() {
      if (_promixRafId) return;
      _promixRafId = requestAnimationFrame(_promixAnimateMeters);
    }
    function _promixStopMeters() {
      if (_promixRafId) { cancelAnimationFrame(_promixRafId); _promixRafId = 0; }
    }
    function _promixGetStereoDbFromEntry(entry) {
      if (!entry || !entry.analyserL || !entry.analyserR || !entry.analyserBufL || !entry.analyserBufR) {
        return { l: -60, r: -60 };
      }
      entry.analyserL.getFloatTimeDomainData(entry.analyserBufL);
      entry.analyserR.getFloatTimeDomainData(entry.analyserBufR);
      let sumL = 0;
      let sumR = 0;
      for (let i = 0; i < entry.analyserBufL.length; i++) sumL += entry.analyserBufL[i] * entry.analyserBufL[i];
      for (let i = 0; i < entry.analyserBufR.length; i++) sumR += entry.analyserBufR[i] * entry.analyserBufR[i];
      const rmsL = Math.sqrt(sumL / entry.analyserBufL.length);
      const rmsR = Math.sqrt(sumR / entry.analyserBufR.length);
      return {
        l: Math.max(-60, _pgmDbFromRms(rmsL)),
        r: Math.max(-60, _pgmDbFromRms(rmsR))
      };
    }
    function _promixAnimateMeters() {
      if (!_promixOpen) { _promixRafId = 0; return; }
      const srcs = _promixGetAudioSources();
      srcs.forEach(src => {
        const entry = _pgmSources[src.id];
        const fl = document.getElementById('promix-fill-l-' + src.id);
        const fr = document.getElementById('promix-fill-r-' + src.id);
        const pl = document.getElementById('promix-peak-l-' + src.id);
        const pr = document.getElementById('promix-peak-r-' + src.id);
        if (!fl || !fr) return;
        if (!entry) {
          fl.style.height = '0%'; fr.style.height = '0%';
          if (pl) pl.style.bottom = '0%'; if (pr) pr.style.bottom = '0%';
          return;
        }
        const { l: rawDbL, r: rawDbR } = _promixGetStereoDbFromEntry(entry);
        const inputMode = _getSourceInputMode(src);
        const effDb = inputMode === 'mono' ? Math.max(rawDbL, rawDbR) : 0;
        const pctL = _ctrlDbToPercent(inputMode === 'mono' ? effDb : rawDbL);
        const pctR = _ctrlDbToPercent(inputMode === 'mono' ? effDb : rawDbR);
        const ps = _promixPeakState[src.id] || ((_promixPeakState[src.id] = { pl: 0, pr: 0 }));
        ps.pl = Math.max(pctL, (ps.pl || 0) - 0.5);
        ps.pr = Math.max(pctR, (ps.pr || 0) - 0.5);
        fl.style.height = pctL.toFixed(1) + '%';
        fr.style.height = pctR.toFixed(1) + '%';
        if (pl) pl.style.bottom = ps.pl.toFixed(1) + '%';
        if (pr) pr.style.bottom = ps.pr.toFixed(1) + '%';
      });
      /* Master meter */
      if (_pgmAnalyserL && _pgmAnalyserR) {
        _pgmAnalyserL.getFloatTimeDomainData(_pgmBufL);
        _pgmAnalyserR.getFloatTimeDomainData(_pgmBufR);
        let sL = 0, sR = 0;
        for (let i = 0; i < _pgmBufL.length; i++) { sL += _pgmBufL[i] * _pgmBufL[i]; sR += _pgmBufR[i] * _pgmBufR[i]; }
        const rmsL = Math.sqrt(sL / _pgmBufL.length);
        const rmsR = Math.sqrt(sR / _pgmBufR.length);
        const mDbL = Math.max(-60, _pgmDbFromRms(rmsL));
        const mDbR = Math.max(-60, _pgmDbFromRms(rmsR));
        const mpL = _ctrlDbToPercent(mDbL);
        const mpR = _ctrlDbToPercent(mDbR);
        const mps = _promixPeakState['__master__'] || ((_promixPeakState['__master__'] = { pl: 0, pr: 0 }));
        mps.pl = Math.max(mpL, (mps.pl || 0) - 0.5);
        mps.pr = Math.max(mpR, (mps.pr || 0) - 0.5);
        const mfl = document.getElementById('promix-fill-master-l');
        const mfr = document.getElementById('promix-fill-master-r');
        const mpl = document.getElementById('promix-peak-master-l');
        const mpr = document.getElementById('promix-peak-master-r');
        if (mfl) mfl.style.height = mpL.toFixed(1) + '%';
        if (mfr) mfr.style.height = mpR.toFixed(1) + '%';
        if (mpl) mpl.style.bottom = mps.pl.toFixed(1) + '%';
        if (mpr) mpr.style.bottom = mps.pr.toFixed(1) + '%';
      }
      /* Bus meters */
      _promixBuses.forEach(bus => {
        const bn = _promixBusNodes[bus.id];
        if (!bn || !bn.analyserL || !bn.analyserR) return;
        bn.analyserL.getFloatTimeDomainData(bn.analyserBufL);
        bn.analyserR.getFloatTimeDomainData(bn.analyserBufR);
        let bsL = 0, bsR = 0;
        for (let i = 0; i < bn.analyserBufL.length; i++) { bsL += bn.analyserBufL[i] * bn.analyserBufL[i]; bsR += bn.analyserBufR[i] * bn.analyserBufR[i]; }
        const brmsL = Math.sqrt(bsL / bn.analyserBufL.length);
        const brmsR = Math.sqrt(bsR / bn.analyserBufR.length);
        const bDbL = Math.max(-60, _pgmDbFromRms(brmsL));
        const bDbR = Math.max(-60, _pgmDbFromRms(brmsR));
        const bpL = _ctrlDbToPercent(bDbL);
        const bpR = _ctrlDbToPercent(bDbR);
        const bps = _promixPeakState[bus.id] || ((_promixPeakState[bus.id] = { pl: 0, pr: 0 }));
        bps.pl = Math.max(bpL, (bps.pl || 0) - 0.5);
        bps.pr = Math.max(bpR, (bps.pr || 0) - 0.5);
        const bfl = document.getElementById('promix-fill-l-' + bus.id);
        const bfr = document.getElementById('promix-fill-r-' + bus.id);
        const bpkl = document.getElementById('promix-peak-l-' + bus.id);
        const bpkr = document.getElementById('promix-peak-r-' + bus.id);
        if (bfl) bfl.style.height = bpL.toFixed(1) + '%';
        if (bfr) bfr.style.height = bpR.toFixed(1) + '%';
        if (bpkl) bpkl.style.bottom = bps.pl.toFixed(1) + '%';
        if (bpkr) bpkr.style.bottom = bps.pr.toFixed(1) + '%';
      });
      _promixRafId = requestAnimationFrame(_promixAnimateMeters);
    }

    /* ── FX Click → Parameter Popover ── */
    function _promixClickFx(sourceId, fxId, ev) {
      ev.stopPropagation();
      if (_promixSelectedFx && _promixSelectedFx.sourceId === sourceId && _promixSelectedFx.fxId === fxId) {
        /* Toggle off */
        _promixSelectedFx = null;
        _promixCloseParamPop();
        renderProMixer();
        return;
      }
      _promixSelectedFx = { sourceId, fxId };
      /* Capture anchor rect BEFORE re-render destroys the element */
      const anchorRect = ev.currentTarget.getBoundingClientRect();
      renderProMixer();
      _promixShowParamPopAtRect(sourceId, fxId, anchorRect);
    }

    /* ── FX slot hover action handlers ── */
    function _promixActPower(sourceId, fxId, ev) {
      ev.stopPropagation();
      _promixToggleFxEnabled(sourceId, fxId);
    }
    function _promixActEdit(sourceId, fxId, ev) {
      ev.stopPropagation();
      _promixClickFx(sourceId, fxId, ev);
    }
    function _promixActSwap(sourceId, fxId, ev) {
      ev.stopPropagation();
      const btn = ev.currentTarget;
      const rect = btn.getBoundingClientRect();
      _promixShowSwapPicker(sourceId, fxId, rect);
    }

    function _promixShowSwapPicker(sourceId, fxId, rect) {
      const picker = document.getElementById('promix-fx-add-picker');
      if (!picker) return;
      if (picker.classList.contains('open')) { _promixCloseAddPicker(); return; }
      const lib = typeof SOURCE_AUDIO_FX_LIBRARY !== 'undefined' ? SOURCE_AUDIO_FX_LIBRARY : [];
      let html = '';
      lib.forEach(fx => {
        if (fx.type === 'plugin-host') return;
        html += `<div class="sfx-add-item" onclick="_promixConfirmSwapFx('${sourceId}','${fxId}','${fx.type}')">${esc(fx.label)}</div>`;
      });
      picker.innerHTML = html;
      picker.style.left = Math.min(rect.left, window.innerWidth - 170) + 'px';
      picker.style.top = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 230)) + 'px';
      picker.classList.add('open');
    }

    function _promixConfirmSwapFx(sourceId, fxId, newType) {
      _promixCloseAddPicker();
      if (sourceId === '__master__') {
        const fx = _promixMasterFx.find(x => x.id === fxId);
        if (fx) {
          fx.type = newType;
          fx.params = {};
          fx.enabled = true;
        }
        _promixSaveMasterFx();
        _promixRebuildMasterFxChain();
      } else if (_promixIsBusId(sourceId)) {
        const bus = _promixGetBusById(sourceId);
        if (bus && Array.isArray(bus.fxChain)) {
          const fx = bus.fxChain.find(x => x.id === fxId);
          if (fx) { fx.type = newType; fx.params = {}; fx.enabled = true; }
          _promixRebuildBusFxChain(sourceId);
          if (typeof schedulePersistAppState === 'function') schedulePersistAppState();
        }
      } else {
        const src = _getSourceById(sourceId);
        if (src && src.config && Array.isArray(src.config.audioFx)) {
          const fx = src.config.audioFx.find(x => x.id === fxId);
          if (fx) {
            fx.type = newType;
            fx.params = {};
            fx.enabled = true;
          }
          if (typeof _refreshSourceFxAudio === 'function') _refreshSourceFxAudio(sourceId);
          if (_editingFxSourceId === sourceId && typeof renderSourceFxList === 'function') renderSourceFxList();
        }
      }
      _promixCloseParamPop();
      _promixSelectedFx = null;
      if (_promixOpen) renderProMixer();
    }

    function _promixCloseParamPop() {
      const pop = document.getElementById('promix-fx-param-pop');
      if (pop) { pop.classList.remove('open'); pop.innerHTML = ''; }
    }

    function _promixShowParamPop(sourceId, fxId, anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      _promixShowParamPopAtRect(sourceId, fxId, rect);
    }
    function _promixShowParamPopAtRect(sourceId, fxId, rect) {
      const pop = document.getElementById('promix-fx-param-pop');
      if (!pop) return;
      let fx = null;
      if (sourceId === '__master__') {
        fx = _promixMasterFx.find(x => x.id === fxId);
      } else if (_promixIsBusId(sourceId)) {
        const bus = _promixGetBusById(sourceId);
        if (bus && Array.isArray(bus.fxChain)) fx = bus.fxChain.find(x => x.id === fxId);
      } else {
        const src = _getSourceById(sourceId);
        if (src && src.config && Array.isArray(src.config.audioFx)) {
          fx = src.config.audioFx.find(x => x.id === fxId);
        }
      }
      if (!fx) { _promixCloseParamPop(); return; }
      /* Build parameter rows */
      const rows = [];
      const addParam = (key, label, min, max, step, suffix) => {
        const val = Number(fx.params?.[key] ?? min);
        const shown = typeof sourceFormatFxParamValue === 'function' ? sourceFormatFxParamValue(fx.type, key, val, suffix) : val.toFixed(2);
        rows.push(`<div class="rec-fx-param"><label>${label}</label><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" oninput="_promixSetFxParam('${sourceId}','${fxId}','${key}',this.value,this)"><span id="promix-fpv-${fxId}-${key}">${shown}</span></div>`);
      };
      _promixAddFxParams(fx.type, addParam);
      const enabledLabel = fx.enabled === false ? 'Enable' : 'Bypass';
      const header = `<div class="rec-fx-editor-title" style="display:flex;align-items:center;gap:6px;"><button style="width:12px;height:12px;border-radius:50%;background:#ff5f57;border:1px solid rgba(0,0,0,0.18);cursor:pointer;padding:0;flex-shrink:0;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 0 rgba(255,255,255,0.18);" onclick="_promixCloseParamPop();_promixSelectedFx=null;if(_promixOpen)renderProMixer();" title="Close"><svg viewBox="0 0 24 24" width="7" height="7" fill="none" stroke="#4a0000" stroke-width="4" stroke-linecap="round" style="opacity:0;" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>${esc(_fxLabel(fx.type))}<span style="flex:1"></span><button class="promix-btn" onclick="_promixToggleFxEnabled('${sourceId}','${fxId}')" style="font-size:8px;">${enabledLabel}</button><button class="promix-btn" onclick="_promixDeleteFx('${sourceId}','${fxId}')" style="font-size:8px;color:#ff7b86;">Delete</button></div>`;
      pop.innerHTML = header + rows.join('');
      /* Position near the clicked FX slot */
      const winEl = document.getElementById('promix-window');
      const winRect = winEl ? winEl.getBoundingClientRect() : { right: window.innerWidth, top: 0 };
      let popLeft = rect.right + 8;
      let popTop = rect.top;
      /* If it would overflow right, put it to the left of the slot */
      if (popLeft + 300 > window.innerWidth) popLeft = rect.left - 310;
      /* Clamp to viewport */
      popLeft = Math.max(4, Math.min(popLeft, window.innerWidth - 310));
      popTop = Math.max(4, Math.min(popTop, window.innerHeight - 360));
      pop.style.left = popLeft + 'px';
      pop.style.top = popTop + 'px';
      pop.classList.add('open');
    }

    function _promixAddFxParams(type, addParam) {
      if (type === 'reverb') { addParam('mix','Mix',0,100,1,'%'); addParam('decay','Decay',0.2,6,0.1,'s'); addParam('tone','Tone',1200,12000,100,'Hz'); }
      else if (type === 'pro-reverb') { addParam('mix','Mix',0,100,1,'%'); addParam('decay','Decay',0.3,12,0.1,'s'); addParam('size','Size',5,100,1,'%'); addParam('predelay','Pre-Delay',0,120,1,'ms'); addParam('damping','Damping',800,16000,100,'Hz'); addParam('brightness','Brightness',1000,18000,100,'Hz'); addParam('width','Width',0,100,1,'%'); addParam('modrate','Mod Rate',0.05,4,0.05,'Hz'); addParam('moddepth','Mod Depth',0,60,1,'%'); }
      else if (type === 'denoiser') { addParam('amount','Amount',0,100,1,'%'); }
      else if (type === 'pro-denoiser') { addParam('reduction','Reduce',0,100,1,'%'); addParam('sensitivity','Sensitivity',0,100,1,'%'); addParam('preserve','Voice Keep',0,100,1,'%'); addParam('attack','Attack',1,50,1,'ms'); addParam('release','Release',5,200,1,'ms'); addParam('hpf','HP Filter',20,500,1,'Hz'); addParam('lpf','LP Filter',4000,22000,100,'Hz'); addParam('dryMix','Dry Mix',0,50,1,'%'); }
      else if (type === 'gain') { addParam('gain','Gain',0,2.5,0.01,'x'); }
      else if (type === 'highpass') { addParam('frequency','Freq',20,600,1,'Hz'); addParam('q','Q',0.2,2.5,0.01,''); }
      else if (type === 'lowshelf' || type === 'presence' || type === 'air') { addParam('frequency','Freq',60,12000,1,'Hz'); addParam('gain','Gain',-12,12,0.1,'dB'); addParam('q','Q',0.2,3,0.01,''); }
      else if (type === 'compressor' || type === 'limiter') { addParam('threshold','Thresh',-60,0,0.1,'dB'); addParam('ratio','Ratio',1,20,0.1,':1'); addParam('attack','Attack',0.001,0.1,0.001,'s'); addParam('release','Release',0.02,0.5,0.01,'s'); }
      else if (type === 'pro-compressor') { addParam('threshold','Thresh',-60,0,0.1,'dB'); addParam('ratio','Ratio',1,20,0.1,':1'); addParam('attack','Attack',0.001,0.1,0.001,'s'); addParam('release','Release',0.02,0.8,0.01,'s'); addParam('knee','Knee',0,40,0.1,'dB'); addParam('makeup','Makeup',-12,18,0.1,'dB'); addParam('mix','Mix',0,100,0.1,'%'); }
      else if (type === 'lowpass') { addParam('frequency','Freq',200,20000,1,'Hz'); addParam('q','Q',0.2,2.5,0.01,''); }
      else if (type === 'parametric-eq') { addParam('frequency','Freq',20,20000,1,'Hz'); addParam('gain','Gain',-18,18,0.1,'dB'); addParam('q','Q',0.1,12,0.01,''); }
      else if (type === 'de-esser') { addParam('frequency','Freq',3000,12000,100,'Hz'); addParam('threshold','Thresh',-50,0,0.5,'dB'); addParam('ratio','Ratio',1,20,0.1,':1'); addParam('range','Range',0,24,0.5,'dB'); }
      else if (type === 'noise-gate') { addParam('threshold','Thresh',-80,0,0.5,'dB'); addParam('range','Range',0,80,1,'dB'); addParam('attack','Attack',0.0001,0.05,0.0001,'s'); addParam('hold','Hold',0,0.5,0.001,'s'); addParam('release','Release',0.005,0.5,0.005,'s'); addParam('hysteresis','Hysteresis',0,12,0.5,'dB'); addParam('lookahead','Lookahead',0,10,0.1,'ms'); }
      else if (type === 'delay') { addParam('time','Time',0.01,2,0.01,'ms'); addParam('feedback','Feedback',0,90,1,'%'); addParam('mix','Mix',0,100,1,'%'); addParam('tone','Tone',500,16000,100,'Hz'); }
      else if (type === 'chorus') { addParam('rate','Rate',0.1,10,0.1,'Hz'); addParam('depth','Depth',0,20,0.1,'%'); addParam('mix','Mix',0,100,1,'%'); }
      else if (type === 'exciter') { addParam('frequency','Freq',1000,10000,100,'Hz'); addParam('drive','Drive',0,24,0.5,'dB'); addParam('mix','Mix',0,100,1,'%'); }
      else if (type === 'stereo-widener') { addParam('width','Width',0,100,1,'%'); }
      else if (type === 'pitch-shifter') { addParam('semitones','Semitones',-12,12,1,'st'); addParam('mix','Mix',0,100,1,'%'); }
      else if (type === 'phaser') { addParam('rate','Rate',0.05,5,0.05,'Hz'); addParam('depth','Depth',0,100,1,'%'); addParam('stages','Stages',2,12,2,''); addParam('feedback','Feedback',0,90,1,'%'); addParam('mix','Mix',0,100,1,'%'); }
      else if (type === 'flanger') { addParam('rate','Rate',0.05,5,0.05,'Hz'); addParam('depth','Depth',0,10,0.1,'%'); addParam('feedback','Feedback',0,95,1,'%'); addParam('mix','Mix',0,100,1,'%'); }
      else if (type === 'tremolo') { addParam('rate','Rate',0.5,20,0.1,'Hz'); addParam('depth','Depth',0,100,1,'%'); addParam('shape','Shape',0,1,0.01,''); }
      else if (type === 'distortion') { addParam('drive','Drive',0,40,0.5,'dB'); addParam('tone','Tone',500,16000,100,'Hz'); addParam('mix','Mix',0,100,1,'%'); }
      else if (type === 'expander') { addParam('threshold','Thresh',-80,0,0.5,'dB'); addParam('ratio','Ratio',1,10,0.1,':1'); addParam('attack','Attack',0.001,0.1,0.001,'s'); addParam('release','Release',0.02,0.5,0.01,'s'); }
      else if (type === 'ducking') { addParam('threshold','Thresh',-60,0,0.5,'dB'); addParam('amount','Amount',0,40,0.5,'dB'); addParam('attack','Attack',0.001,0.1,0.001,'s'); addParam('release','Release',0.02,1,0.01,'s'); }
      else if (type === 'channel-eq') { addParam('hp_freq','HP Freq',20,800,1,'Hz'); addParam('ls_freq','Low Freq',30,600,1,'Hz'); addParam('ls_gain','Low Gain',-24,24,0.1,'dB'); addParam('lm_freq','Lo-Mid',100,2000,1,'Hz'); addParam('lm_gain','Lo-Mid Gain',-24,24,0.1,'dB'); addParam('m_freq','Mid Freq',400,6000,1,'Hz'); addParam('m_gain','Mid Gain',-24,24,0.1,'dB'); addParam('hm_freq','Hi-Mid',1000,12000,1,'Hz'); addParam('hm_gain','Hi-Mid Gain',-24,24,0.1,'dB'); addParam('hs_freq','High Freq',2000,20000,1,'Hz'); addParam('hs_gain','High Gain',-24,24,0.1,'dB'); addParam('lp_freq','LP Freq',1000,22000,1,'Hz'); addParam('output_gain','Output',-24,24,0.1,'dB'); }
    }

    /* Set FX parameter — syncs with the FX popup system */
    function _promixSetFxParam(sourceId, fxId, key, val, inputEl) {
      const num = Number(val);
      const nextVal = Number.isFinite(num) ? num : val;
      if (sourceId === '__master__') {
        const fx = _promixMasterFx.find(x => x.id === fxId);
        if (fx) {
          fx.params[key] = nextVal;
        }
        // Try in-place smooth param update first (no audio glitch)
        const runtimeNode = _promixMasterFxRuntime[fxId];
        if (runtimeNode) {
          const ctx = _pgmAudioCtx;
          const applied = _applyFxParamInPlace(runtimeNode, _promixGetFxType(sourceId, fxId), key, nextVal, ctx);
          if (applied) {
            _promixSaveMasterFx();
            // Update value label without full rebuild
            const valEl = document.getElementById('promix-fpv-' + fxId + '-' + key);
            if (valEl) {
              valEl.textContent = typeof sourceFormatFxParamValue === 'function'
                ? sourceFormatFxParamValue(_promixGetFxType(sourceId, fxId), key, nextVal)
                : nextVal.toFixed(2);
            }
            return;
          }
        }
        // Full rebuild needed (e.g. reverb decay change) — use smooth swap
        _promixSaveMasterFx();
        _promixRebuildMasterFxChain();
      } else if (_promixIsBusId(sourceId)) {
        const bus = _promixGetBusById(sourceId);
        if (bus) {
          const fx = (bus.fxChain || []).find(x => x.id === fxId);
          if (fx) { fx.params[key] = nextVal; }
          _promixRebuildBusFxChain(sourceId);
          if (typeof schedulePersistAppState === 'function') schedulePersistAppState();
        }
      } else {
        /* Delegate to existing FX system */
        if (typeof setSourceEffectParam === 'function') {
          setSourceEffectParam(sourceId, fxId, key, val);
        }
        /* If the source FX popup is open for this source, refresh it */
        if (_editingFxSourceId === sourceId) {
          renderSourceFxList();
        }
      }
      const valEl = document.getElementById('promix-fpv-' + fxId + '-' + key);
      if (valEl) {
        valEl.textContent = typeof sourceFormatFxParamValue === 'function'
          ? sourceFormatFxParamValue(_promixGetFxType(sourceId, fxId), key, nextVal)
          : nextVal.toFixed(2);
      }
    }

    function _promixGetFxType(sourceId, fxId) {
      if (sourceId === '__master__') {
        const fx = _promixMasterFx.find(x => x.id === fxId);
        return fx ? fx.type : '';
      }
      if (_promixIsBusId(sourceId)) {
        const bus = _promixGetBusById(sourceId);
        if (bus) { const fx = (bus.fxChain || []).find(x => x.id === fxId); return fx ? fx.type : ''; }
        return '';
      }
      const src = _getSourceById(sourceId);
      if (!src || !src.config || !Array.isArray(src.config.audioFx)) return '';
      const fx = src.config.audioFx.find(x => x.id === fxId);
      return fx ? fx.type : '';
    }

    function _promixToggleFxEnabled(sourceId, fxId) {
      if (sourceId === '__master__') {
        const fx = _promixMasterFx.find(x => x.id === fxId);
        if (fx) { fx.enabled = fx.enabled === false; }
        _promixSaveMasterFx();
        _promixRebuildMasterFxChain();
      } else if (_promixIsBusId(sourceId)) {
        const bus = _promixGetBusById(sourceId);
        if (bus) {
          const fx = (bus.fxChain || []).find(x => x.id === fxId);
          if (fx) { fx.enabled = fx.enabled === false; }
          _promixRebuildBusFxChain(sourceId);
          if (typeof schedulePersistAppState === 'function') schedulePersistAppState();
        }
      } else {
        if (typeof toggleEffectEnabled === 'function') toggleEffectEnabled(sourceId, fxId);
        if (_editingFxSourceId === sourceId) renderSourceFxList();
      }
      _promixCloseParamPop();
      _promixSelectedFx = null;
      if (_promixOpen) renderProMixer();
    }

    function _promixDeleteFx(sourceId, fxId) {
      _promixCloseParamPop();
      _promixSelectedFx = null;
      if (sourceId === '__master__') {
        _promixMasterFx = _promixMasterFx.filter(x => x.id !== fxId);
        _promixSaveMasterFx();
        _promixRebuildMasterFxChain();
      } else if (_promixIsBusId(sourceId)) {
        const bus = _promixGetBusById(sourceId);
        if (bus) {
          bus.fxChain = (bus.fxChain || []).filter(x => x.id !== fxId);
          _promixRebuildBusFxChain(sourceId);
          if (typeof schedulePersistAppState === 'function') schedulePersistAppState();
        }
      } else {
        if (typeof saveState === 'function') saveState('Delete Audio FX');
        if (typeof deleteEffectFromChain === 'function') deleteEffectFromChain(sourceId, fxId);
        if (_editingFxSourceId === sourceId) renderSourceFxList();
      }
      if (_promixOpen) renderProMixer();
    }

    /* ── Add FX to strip via picker ── */
    function _promixAddFxToStrip(sourceId, ev) {
      ev.stopPropagation();
      const picker = document.getElementById('promix-fx-add-picker');
      if (!picker) return;
      if (picker.classList.contains('open')) { _promixCloseAddPicker(); return; }
      /* Build picker list from SOURCE_AUDIO_FX_LIBRARY */
      const lib = typeof SOURCE_AUDIO_FX_LIBRARY !== 'undefined' ? SOURCE_AUDIO_FX_LIBRARY : [];
      let html = '';
      lib.forEach(fx => {
        if (fx.type === 'plugin-host') return; /* skip AU/VST in picker */
        html += `<div class="sfx-add-item" onclick="_promixConfirmAddFx('${sourceId}','${fx.type}')">${esc(fx.label)}</div>`;
      });
      picker.innerHTML = html;
      const rect = ev.currentTarget.getBoundingClientRect();
      picker.style.left = Math.min(rect.left, window.innerWidth - 170) + 'px';
      picker.style.top = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 230)) + 'px';
      picker.classList.add('open');
    }
    function _promixCloseAddPicker() {
      const picker = document.getElementById('promix-fx-add-picker');
      if (picker) { picker.classList.remove('open'); picker.innerHTML = ''; }
    }
    function _promixConfirmAddFx(sourceId, fxType) {
      _promixCloseAddPicker();
      if (sourceId === '__master__') {
        const newFx = typeof _makeSourceFxByType === 'function' ? _makeSourceFxByType(fxType) : { id: 'fx_' + Math.random().toString(36).slice(2,10), type: fxType, enabled: true, params: {} };
        _promixMasterFx.push(newFx);
        _promixMasterFxSelectedId = newFx.id;
        _promixSaveMasterFx();
        _promixRebuildMasterFxChain();
      } else if (_promixIsBusId(sourceId)) {
        const bus = _promixGetBusById(sourceId);
        if (bus) {
          if (!Array.isArray(bus.fxChain)) bus.fxChain = [];
          const newFx = typeof _makeSourceFxByType === 'function' ? _makeSourceFxByType(fxType) : { id: 'fx_' + Math.random().toString(36).slice(2,10), type: fxType, enabled: true, params: {} };
          bus.fxChain.push(newFx);
          _promixRebuildBusFxChain(sourceId);
          if (typeof schedulePersistAppState === 'function') schedulePersistAppState();
        }
      } else {
        /* Delegate to existing system */
        const src = _getSourceById(sourceId);
        if (!src) return;
        if (!src.config) src.config = {};
        if (!Array.isArray(src.config.audioFx)) src.config.audioFx = [];
        const newFx = typeof _makeSourceFxByType === 'function' ? _makeSourceFxByType(fxType) : { id: 'fx_' + Math.random().toString(36).slice(2,10), type: fxType, enabled: true, params: {} };
        src.config.audioFx.push(newFx);
        src.config.fxSelectedId = newFx.id;
        if (typeof _refreshSourceFxAudio === 'function') _refreshSourceFxAudio(sourceId);
        if (_editingFxSourceId === sourceId) renderSourceFxList();
      }
      if (_promixOpen) renderProMixer();
    }

    /* ── Pro Mixer FX Drag-and-Drop: Reorder within strip, Move across strips, Option+Drag to duplicate ── */
    let _pmfxDrag = {
      active: false,
      srcId: '',         // source strip ID ('__master__' or source id)
      fxId: '',          // the FX being dragged
      fxIdx: -1,         // original index in chain
      startY: 0,
      startX: 0,
      pointerId: null,
      el: null,          // the dragged DOM element
      slotsContainer: null, // the .promix-fx-slots of origin
      items: [],         // sibling fx-slot elements in origin strip
      itemH: 0,          // height + gap of one slot
      currentIdx: -1,    // current reorder index within same strip
      suppressClick: false,
      isDuplicate: false, // option key held → duplicate mode
      crossStrip: false,  // dragging over a different strip
      targetSrcId: '',    // the strip we're hovering over (when cross-strip)
      targetInsertIdx: -1,
      floatEl: null,      // floating clone for cross-strip drag
      placeholder: null,  // placeholder element in target strip
    };

    function _pmfxGetChain(sourceId) {
      if (sourceId === '__master__') return _promixMasterFx;
      if (_promixIsBusId(sourceId)) {
        const bus = _promixGetBusById(sourceId);
        return bus ? (bus.fxChain || []) : [];
      }
      const src = _getSourceById(sourceId);
      return (src && src.config && Array.isArray(src.config.audioFx)) ? src.config.audioFx : [];
    }

    function _pmfxSetChain(sourceId, chain) {
      if (sourceId === '__master__') {
        _promixMasterFx = chain;
        _promixSaveMasterFx();
      } else if (_promixIsBusId(sourceId)) {
        const bus = _promixGetBusById(sourceId);
        if (bus) {
          bus.fxChain = chain;
          _promixRebuildBusFxChain(sourceId);
          if (typeof schedulePersistAppState === 'function') schedulePersistAppState();
        }
      } else {
        const src = _getSourceById(sourceId);
        if (src && src.config) {
          src.config.audioFx = chain;
          if (typeof _refreshSourceFxAudio === 'function') _refreshSourceFxAudio(sourceId);
          if (_editingFxSourceId === sourceId && typeof renderSourceFxList === 'function') renderSourceFxList();
        }
      }
    }

    function _promixFxPointerDown(e) {
      if (e.button !== 0) return;
      if (e.target.closest('.sli-eye')) return;
      const onActionBtn = !!e.target.closest('.promix-fx-act');
      const item = e.currentTarget;
      const srcId = item.dataset.srcId;
      const fxId = item.dataset.fxId;
      const fxIdx = parseInt(item.dataset.fxIdx, 10);
      const slotsContainer = item.closest('.promix-fx-slots');
      if (!slotsContainer) return;

      const items = Array.from(slotsContainer.querySelectorAll('.promix-fx-slot'));
      let itemH = 0;
      if (items.length > 0) {
        const r0 = items[0].getBoundingClientRect();
        const gap = items.length > 1 ? items[1].getBoundingClientRect().top - r0.bottom : 1;
        itemH = r0.height + gap;
      }

      _pmfxDrag.active = false;
      _pmfxDrag.srcId = srcId;
      _pmfxDrag.fxId = fxId;
      _pmfxDrag.fxIdx = fxIdx;
      _pmfxDrag.currentIdx = fxIdx;
      _pmfxDrag.startY = e.clientY;
      _pmfxDrag.startX = e.clientX;
      _pmfxDrag.pointerId = e.pointerId;
      _pmfxDrag.el = item;
      _pmfxDrag.slotsContainer = slotsContainer;
      _pmfxDrag.items = items;
      _pmfxDrag.itemH = itemH || 28;
      _pmfxDrag.suppressClick = false;
      _pmfxDrag.isDuplicate = (e.altKey === true);
      _pmfxDrag.crossStrip = false;
      _pmfxDrag.targetSrcId = srcId;
      _pmfxDrag.targetInsertIdx = fxIdx;
      _pmfxDrag.floatEl = null;
      _pmfxDrag.placeholder = null;
      _pmfxDrag._onActionBtn = onActionBtn;

      if (onActionBtn) {
        /* Don't capture pointer so the button's onclick fires naturally.
           Track drag via document-level listeners instead. */
        document.addEventListener('pointermove', _pmfxPointerMove);
        document.addEventListener('pointerup', _pmfxPointerUp);
        document.addEventListener('pointercancel', _pmfxPointerUp);
      } else {
        item.setPointerCapture(e.pointerId);
        item.addEventListener('pointermove', _pmfxPointerMove);
        item.addEventListener('pointerup', _pmfxPointerUp);
        item.addEventListener('pointercancel', _pmfxPointerUp);
      }
    }

    function _pmfxPointerMove(e) {
      const d = _pmfxDrag;
      const dy = e.clientY - d.startY;
      const dx = e.clientX - d.startX;

      // Update duplicate mode in real time
      d.isDuplicate = (e.altKey === true);

      if (!d.active && Math.abs(dy) < 4 && Math.abs(dx) < 4) return;
      if (!d.active) {
        d.active = true;
        d.suppressClick = true;
        _promixCloseParamPop();
        _promixCloseAddPicker();
      }

      // Determine which strip we're over
      const body = document.getElementById('promix-body');
      if (!body) return;
      const strips = Array.from(body.querySelectorAll('.promix-strip'));
      let hoverStripId = d.srcId;
      let hoverSlots = d.slotsContainer;
      for (const strip of strips) {
        const sr = strip.getBoundingClientRect();
        if (e.clientX >= sr.left && e.clientX <= sr.right) {
          hoverStripId = strip.dataset.srcId;
          hoverSlots = strip.querySelector('.promix-fx-slots');
          break;
        }
      }

      const isCross = (hoverStripId !== d.srcId);

      if (isCross) {
        // Cross-strip drag
        if (!d.crossStrip) {
          // Transition to cross-strip mode
          d.crossStrip = true;
          // Reset same-strip visual state
          d.items.forEach(el => {
            el.classList.remove('promix-drag-ghost', 'promix-drag-shift-down', 'promix-drag-shift-up');
            el.style.transform = '';
          });
          d.el.style.opacity = '0.3';
          // Create floating clone
          _pmfxCreateFloat(e);
        }
        d.targetSrcId = hoverStripId;

        // Update float position
        if (d.floatEl) {
          d.floatEl.style.left = (e.clientX - 30) + 'px';
          d.floatEl.style.top = (e.clientY - 10) + 'px';
          // Show duplication indicator
          d.floatEl.style.borderColor = d.isDuplicate ? '#34d399' : 'rgba(10,132,255,0.5)';
          d.floatEl.textContent = (d.isDuplicate ? '⌥ ' : '') + d.el.title;
        }

        // Highlight target strip and compute insert index
        strips.forEach(s => {
          const sl = s.querySelector('.promix-fx-slots');
          if (sl) sl.classList.toggle('promix-drop-target', s.dataset.srcId === hoverStripId);
        });

        // Compute target insert index based on Y
        if (hoverSlots) {
          const targetFxSlots = Array.from(hoverSlots.querySelectorAll('.promix-fx-slot'));
          let insertIdx = targetFxSlots.length; // default: append
          for (let i = 0; i < targetFxSlots.length; i++) {
            const r = targetFxSlots[i].getBoundingClientRect();
            if (e.clientY < r.top + r.height / 2) {
              insertIdx = i;
              break;
            }
          }
          d.targetInsertIdx = insertIdx;

          // Show/move placeholder
          _pmfxUpdatePlaceholder(hoverSlots, insertIdx, targetFxSlots);
        }

      } else {
        // Same-strip drag (reorder)
        if (d.crossStrip) {
          // Transition back from cross-strip
          d.crossStrip = false;
          d.el.style.opacity = '';
          _pmfxRemoveFloat();
          _pmfxRemovePlaceholder();
          strips.forEach(s => {
            const sl = s.querySelector('.promix-fx-slots');
            if (sl) sl.classList.remove('promix-drop-target');
          });
        }

        // Same-strip reorder logic (like existing _srcFxPointerMove)
        d.el.classList.add('promix-drag-ghost');
        d.el.style.transform = `translateY(${dy}px)`;

        const fromIdx = d.fxIdx;
        const shift = Math.round(dy / d.itemH);
        const toIdx = Math.max(0, Math.min(d.items.length - 1, fromIdx + shift));
        d.currentIdx = toIdx;

        // Show duplication cursor style
        if (d.isDuplicate) {
          d.el.style.borderColor = '#34d399';
        } else {
          d.el.style.borderColor = '';
        }

        d.items.forEach((el, i) => {
          el.classList.remove('promix-drag-shift-down', 'promix-drag-shift-up');
          el.style.setProperty('--promix-fx-shift', d.itemH + 'px');
          if (i === fromIdx) return;
          if (fromIdx < toIdx && i > fromIdx && i <= toIdx) {
            el.classList.add('promix-drag-shift-up');
          } else if (fromIdx > toIdx && i >= toIdx && i < fromIdx) {
            el.classList.add('promix-drag-shift-down');
          }
        });
      }
    }

    function _pmfxCreateFloat(e) {
      _pmfxRemoveFloat();
      const d = _pmfxDrag;
      const fl = document.createElement('div');
      fl.className = 'promix-fx-slot';
      fl.style.cssText = 'position:fixed;z-index:9300;pointer-events:none;opacity:0.9;box-shadow:0 6px 24px rgba(0,0,0,0.6);min-width:70px;max-width:100px;font-size:10px;';
      fl.textContent = (d.isDuplicate ? '⌥ ' : '') + d.el.title;
      document.body.appendChild(fl);
      d.floatEl = fl;
    }

    function _pmfxRemoveFloat() {
      if (_pmfxDrag.floatEl) {
        _pmfxDrag.floatEl.remove();
        _pmfxDrag.floatEl = null;
      }
    }

    function _pmfxUpdatePlaceholder(slotsContainer, insertIdx, fxSlots) {
      if (!_pmfxDrag.placeholder) {
        _pmfxDrag.placeholder = document.createElement('div');
        _pmfxDrag.placeholder.className = 'promix-fx-drop-placeholder';
      }
      const ph = _pmfxDrag.placeholder;
      // Insert before the slot at insertIdx, or after the last slot
      if (insertIdx < fxSlots.length) {
        fxSlots[insertIdx].parentNode.insertBefore(ph, fxSlots[insertIdx]);
      } else {
        // Insert before the "+ FX" button
        const emptySlot = slotsContainer.querySelector('.promix-fx-slot-empty');
        if (emptySlot) {
          slotsContainer.insertBefore(ph, emptySlot);
        } else {
          slotsContainer.appendChild(ph);
        }
      }
    }

    function _pmfxRemovePlaceholder() {
      if (_pmfxDrag.placeholder) {
        _pmfxDrag.placeholder.remove();
        _pmfxDrag.placeholder = null;
      }
    }

    function _pmfxPointerUp(e) {
      const d = _pmfxDrag;
      const item = d.el || e.currentTarget;
      if (d._onActionBtn) {
        document.removeEventListener('pointermove', _pmfxPointerMove);
        document.removeEventListener('pointerup', _pmfxPointerUp);
        document.removeEventListener('pointercancel', _pmfxPointerUp);
      } else {
        item.removeEventListener('pointermove', _pmfxPointerMove);
        item.removeEventListener('pointerup', _pmfxPointerUp);
        item.removeEventListener('pointercancel', _pmfxPointerUp);
      }

      // Clean up visual state
      d.items.forEach(el => {
        el.classList.remove('promix-drag-ghost', 'promix-drag-shift-down', 'promix-drag-shift-up');
        el.style.transform = '';
        el.style.borderColor = '';
        el.style.opacity = '';
      });
      d.el.style.opacity = '';
      d.el.style.borderColor = '';
      _pmfxRemoveFloat();
      _pmfxRemovePlaceholder();

      // Remove drop-target highlights
      const body = document.getElementById('promix-body');
      if (body) {
        body.querySelectorAll('.promix-fx-slots').forEach(sl => sl.classList.remove('promix-drop-target'));
      }

      if (d.active) {
        const isDup = d.isDuplicate;
        const fromSrcId = d.srcId;
        const fromIdx = d.fxIdx;
        const fromChain = _pmfxGetChain(fromSrcId);
        const fxObj = fromChain[fromIdx];

        if (d.crossStrip) {
          // Cross-strip: move or duplicate
          const toSrcId = d.targetSrcId;
          const toIdx = d.targetInsertIdx;
          const toChain = _pmfxGetChain(toSrcId);

          if (fxObj && toChain) {
            if (isDup) {
              // Duplicate: deep clone the FX with a new ID
              const cloned = JSON.parse(JSON.stringify(fxObj));
              cloned.id = 'fx_' + Math.random().toString(36).slice(2, 10);
              toChain.splice(toIdx, 0, cloned);
              _pmfxSetChain(toSrcId, toChain);
            } else {
              // Move: remove from source, insert into target
              fromChain.splice(fromIdx, 1);
              _pmfxSetChain(fromSrcId, fromChain);
              toChain.splice(toIdx, 0, fxObj);
              _pmfxSetChain(toSrcId, toChain);
            }
            if (typeof saveState === 'function') saveState(isDup ? 'Duplicate FX across strips' : 'Move FX across strips');
          }
        } else {
          // Same-strip: reorder or duplicate
          const toIdx = d.currentIdx;
          if (isDup && fxObj) {
            // Duplicate within same strip
            const cloned = JSON.parse(JSON.stringify(fxObj));
            cloned.id = 'fx_' + Math.random().toString(36).slice(2, 10);
            fromChain.splice(toIdx + (toIdx > fromIdx ? 1 : 0), 0, cloned);
            _pmfxSetChain(fromSrcId, fromChain);
            if (typeof saveState === 'function') saveState('Duplicate FX in strip');
          } else if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx && fxObj) {
            // Reorder
            const [moved] = fromChain.splice(fromIdx, 1);
            fromChain.splice(toIdx, 0, moved);
            _pmfxSetChain(fromSrcId, fromChain);
            if (typeof saveState === 'function') saveState('Reorder FX in Pro Mixer');
          }
        }

        if (_promixOpen) renderProMixer();

        // Suppress click after drag
        if (d.suppressClick) {
          item.addEventListener('click', function suppress(ev) {
            ev.stopImmediatePropagation();
            item.removeEventListener('click', suppress, true);
          }, true);
        }
      }

      // Reset state
      d.active = false;
      d.crossStrip = false;
      d.srcId = '';
      d.fxId = '';
      d.fxIdx = -1;
      d.currentIdx = -1;
      d.el = null;
      d.slotsContainer = null;
      d.items = [];
      d.floatEl = null;
      d.placeholder = null;
    }

    /* Close popovers when clicking outside */
    document.addEventListener('click', function(e) {
      const ppop = document.getElementById('promix-fx-param-pop');
      if (ppop && ppop.classList.contains('open') && !ppop.contains(e.target) && !e.target.closest('.promix-fx-slot')) {
        _promixCloseParamPop();
        _promixSelectedFx = null;
        if (_promixOpen) renderProMixer();
      }
      const apicker = document.getElementById('promix-fx-add-picker');
      if (apicker && apicker.classList.contains('open') && !apicker.contains(e.target) && !e.target.closest('.promix-fx-slot-empty')) {
        _promixCloseAddPicker();
      }
      const routePop = document.getElementById('promix-input-route-pop');
      if (routePop && !routePop.contains(e.target) && !e.target.closest('.promix-input-route-btn')) {
        _promixCloseInputRoutePop();
      }
    });

    /* ─── Program Output Master Audio Meter ─── */
    let _pgmAudioCtx = null;
    let _pgmMerger = null;
    let _pgmAnalyserL = null;
    let _pgmAnalyserR = null;
    let _pgmSplitter = null;
    let _pgmRaf = 0;
    let _pgmDisplayL = 0;
    let _pgmDisplayR = 0;
    let _pgmPeakL = 0;
    let _pgmPeakR = 0;
    let _pgmSources = {};       // sourceId → MediaStreamAudioSourceNode
    let _pgmMutedStream = false;   // kept for API compat but no longer wired to stream gain
    let _pgmMutedMonitor = true;    // start muted — user enables via headphone button
    let _pgmMonitorVolume = 1;      // 0..1  — controls local headphone/monitor level
    let _pgmMonitoringMode = 'monitor-off'; // 'monitor-off' | 'monitor-only' | 'monitor-and-output'
    let _pgmHeadphoneDest = null; // AudioContext destination for monitor
    let _pgmHeadphoneGain = null;
    let _pgmMonitorMixer = null;  // Gain node that only carries NON-media sources → headphone monitoring.
                                  // Media sources play natively from <video> — routing them through
                                  // WebAudio headphone path too would double-audio with delay.
    let _pgmStreamGain = null;
    let _pgmStreamDest = null;   // MediaStreamAudioDestinationNode
    let _pgmStreamVolume = 1;    // legacy reference — no longer affects stream
    let _pgmHeadphoneAudioEl = null;
    let _pgmOutputDeviceId = '';
    let _pgmUltraLowLatencyEnabled = false;
    let _pgmUltraLowLatencyBuffer = '128'; // '32' | '64' | '128' | '256'
    let _pgmUltraLowLatencySampleRate = 'auto'; // 'auto' | '48000' | '44100'
    let _pgmUltraLowLatencyBypassFx = true;
    let _pgmUltraLowLatencyState = 'inactive'; // inactive | active | degraded | unsupported
    let _pgmUltraLowLatencyUnderruns = 0;
    let _pgmUltraLowLatencyLastUnderrunAt = 0;
    let _pgmAudioCtxStateListener = null;
    const _PGM_OUTPUT_DEVICE_STORAGE_KEY = 'pgm.monitor.outputDeviceId';
    const _PGM_DEV_MIX_DEBUG = true;
    const _PGM_DEV_MIX_DEBUG_PAINT_MS = 180;
    let _pgmDevMixDebugLastPaint = 0;

    function _pgmNormalizeUllBuffer(v) {
      const s = String(v || '128').trim();
      return (s === '32' || s === '64' || s === '128' || s === '256') ? s : '128';
    }

    function _pgmNormalizeUllSampleRate(v) {
      const s = String(v || 'auto').trim().toLowerCase();
      return (s === '44100' || s === '48000' || s === 'auto') ? s : 'auto';
    }

    function _pgmResolveLatencyHint() {
      if (!_pgmUltraLowLatencyEnabled) return 'interactive';
      if (_pgmUltraLowLatencyBuffer === '32' || _pgmUltraLowLatencyBuffer === '64') return 0;
      if (_pgmUltraLowLatencyBuffer === '256') return 'balanced';
      return 'interactive';
    }

    function _pgmResolveSampleRate() {
      if (!_pgmUltraLowLatencyEnabled) return 48000;
      if (_pgmUltraLowLatencySampleRate === 'auto') return 48000;
      const n = Number(_pgmUltraLowLatencySampleRate);
      return Number.isFinite(n) && n > 0 ? n : 48000;
    }

    function _pgmShouldBypassFxForMonitor(srcData) {
      const perSourceBypass = !!(srcData && srcData.config && srcData.config.monitorBypassFx === true);
      return perSourceBypass || (_pgmUltraLowLatencyEnabled && _pgmUltraLowLatencyBypassFx);
    }

    function _pgmGetUllStatusText() {
      if (!_pgmUltraLowLatencyEnabled) return 'ULL Off';
      if (_pgmUltraLowLatencyState === 'unsupported') return 'ULL Unsupported';
      if (_pgmUltraLowLatencyState === 'degraded') return `ULL Degraded (${_pgmUltraLowLatencyBuffer})`;
      return `ULL Active (${_pgmUltraLowLatencyBuffer})`;
    }

    function _pgmUpdateUllStatusUi() {
      const toggle = document.getElementById('pgm-ull-toggle');
      const bufferSel = document.getElementById('pgm-ull-buffer');
      const srSel = document.getElementById('pgm-ull-sample-rate');
      const bypass = document.getElementById('pgm-ull-bypass-fx');
      const status = document.getElementById('pgm-ull-status');
      if (toggle) toggle.checked = !!_pgmUltraLowLatencyEnabled;
      if (bufferSel) bufferSel.value = _pgmNormalizeUllBuffer(_pgmUltraLowLatencyBuffer);
      if (srSel) srSel.value = _pgmNormalizeUllSampleRate(_pgmUltraLowLatencySampleRate);
      if (bypass) bypass.checked = !!_pgmUltraLowLatencyBypassFx;
      if (status) status.textContent = `${_pgmGetUllStatusText()} · UDR ${_pgmUltraLowLatencyUnderruns}`;
    }

    function _pgmResetGraphRefsForRebuild() {
      _pgmMerger = null;
      _pgmAnalyserL = null;
      _pgmAnalyserR = null;
      _pgmSplitter = null;
      _pgmSources = {};
      _pgmHeadphoneDest = null;
      _pgmHeadphoneGain = null;
      _pgmMonitorMixer = null;
      _pgmStreamGain = null;
      _pgmStreamDest = null;
      _pgmHeadphoneAudioEl = null;
      _promixBusNodes = {};
      _pgmAudioCtxStateListener = null;
    }

    function _pgmBindAudioCtxStateListener(ctx) {
      if (!ctx || typeof ctx.addEventListener !== 'function') return;
      const listener = () => {
        const state = String(ctx.state || '');
        const mode = _pgmGetNormalizedMonitoringMode(_pgmMonitoringMode);
        const now = Date.now();
        if ((state === 'interrupted' || state === 'suspended') && mode !== 'monitor-off') {
          if ((now - _pgmUltraLowLatencyLastUnderrunAt) > 800) {
            _pgmUltraLowLatencyUnderruns += 1;
            _pgmUltraLowLatencyLastUnderrunAt = now;
            _pgmUpdateUllStatusUi();
          }
          if (_pgmUltraLowLatencyEnabled && _pgmUltraLowLatencyUnderruns >= 3) {
            _pgmUltraLowLatencyState = 'degraded';
            if (_pgmUltraLowLatencyBuffer === '32') _pgmUltraLowLatencyBuffer = '64';
            else if (_pgmUltraLowLatencyBuffer === '64') _pgmUltraLowLatencyBuffer = '128';
            else if (_pgmUltraLowLatencyBuffer === '128') _pgmUltraLowLatencyBuffer = '256';
            _pgmUltraLowLatencyUnderruns = 0;
            _pgmUpdateUllStatusUi();
            _pgmRebuildAudioGraph('ull-fallback');
          }
        }
      };
      ctx.addEventListener('statechange', listener);
      _pgmAudioCtxStateListener = listener;
    }

    function _pgmRebuildAudioGraph(reason = 'settings') {
      const currentCtx = _pgmAudioCtx;
      _pgmDisconnectAllSources();
      _pgmStopMeter();
      if (currentCtx && currentCtx.state !== 'closed') {
        try {
          if (_pgmAudioCtxStateListener && typeof currentCtx.removeEventListener === 'function') {
            currentCtx.removeEventListener('statechange', _pgmAudioCtxStateListener);
          }
        } catch (_) {}
        try { currentCtx.close(); } catch (_) {}
      }
      _pgmAudioCtx = null;
      _pgmResetGraphRefsForRebuild();
      _pgmEnsureGraph();
      _pgmSyncSources();
      if (_promixOpen) renderProMixer();
      if (typeof renderControlsPanel === 'function') renderControlsPanel();
      _pgmUpdateUllStatusUi();
      if (typeof saveToStorageDebounced === 'function') saveToStorageDebounced();
    }

    function pgmSetUltraLowLatencyEnabled(on) {
      _pgmUltraLowLatencyEnabled = !!on;
      _pgmUltraLowLatencyState = _pgmUltraLowLatencyEnabled ? 'active' : 'inactive';
      _pgmUltraLowLatencyUnderruns = 0;
      _pgmUpdateUllStatusUi();
      _pgmRebuildAudioGraph('ull-toggle');
    }

    function pgmSetUltraLowLatencyBuffer(bufferMode) {
      _pgmUltraLowLatencyBuffer = _pgmNormalizeUllBuffer(bufferMode);
      if (_pgmUltraLowLatencyEnabled) _pgmUltraLowLatencyState = 'active';
      _pgmUpdateUllStatusUi();
      _pgmRebuildAudioGraph('ull-buffer');
    }

    function pgmSetUltraLowLatencySampleRate(rateMode) {
      _pgmUltraLowLatencySampleRate = _pgmNormalizeUllSampleRate(rateMode);
      if (_pgmUltraLowLatencyEnabled) _pgmUltraLowLatencyState = 'active';
      _pgmUpdateUllStatusUi();
      _pgmRebuildAudioGraph('ull-samplerate');
    }

    function pgmSetUltraLowLatencyBypassFx(on) {
      _pgmUltraLowLatencyBypassFx = !!on;
      _pgmUpdateUllStatusUi();
      _pgmSyncSources();
      if (typeof saveToStorageDebounced === 'function') saveToStorageDebounced();
    }

    /* ── Pro Reverb: multi-stage algorithmic IR with early reflections, late diffusion, modulation, stereo spread ── */
    function _buildProReverbIR(ctx, params) {
      const rate = Math.max(22050, ctx.sampleRate || 48000);
      const decay = Math.max(0.3, Math.min(12, Number(params.decay) || 2.2));
      const size = Math.max(5, Math.min(100, Number(params.size) || 60)) / 100;
      const predelay = Math.max(0, Math.min(120, Number(params.predelay) || 18)) / 1000;
      const damping = Math.max(800, Math.min(16000, Number(params.damping) || 5500));
      const brightness = Math.max(1000, Math.min(18000, Number(params.brightness) || 8200));
      const width = Math.max(0, Math.min(100, Number(params.width) || 78)) / 100;
      const modRate = Math.max(0.05, Math.min(4, Number(params.modrate) || 0.6));
      const modDepth = Math.max(0, Math.min(60, Number(params.moddepth) || 16)) / 100;

      const totalLen = Math.floor(rate * (predelay + decay + 0.15));
      const ir = ctx.createBuffer(2, totalLen, rate);
      const predelaySamples = Math.floor(predelay * rate);

      // Early reflection tap times (ms) — models a realistic room, 16 taps
      const earlyTapsMs = [1.2, 3.8, 7.1, 11.4, 16.2, 19.7, 24.3, 28.8, 33.1, 38.9, 44.6, 51.0, 57.3, 64.8, 72.1, 80.0];
      const earlyGains = [0.85, 0.78, 0.72, 0.64, 0.58, 0.52, 0.46, 0.41, 0.36, 0.31, 0.26, 0.22, 0.19, 0.16, 0.13, 0.11];
      const earlyLen = Math.floor(0.09 * size * rate);

      // Late decay parameters
      const lateStart = predelaySamples + earlyLen;
      const lateLen = totalLen - lateStart;

      // Allpass diffusion delay times (samples) scaled by size — 6 cascaded stages
      const apDelays = [347, 521, 797, 1103, 1493, 1951].map(d => Math.max(1, Math.floor(d * size * rate / 48000)));

      // Damping filter coefficient
      const dampCoef = Math.exp(-2 * Math.PI * damping / rate);
      const brightCoef = Math.exp(-2 * Math.PI * brightness / rate);

      for (let ch = 0; ch < 2; ch++) {
        const data = ir.getChannelData(ch);
        const stereoSign = ch === 0 ? 1 : -1;
        const stereoPhase = ch * 0.37;

        // 1) Pre-delay: silence
        // (already zero)

        // 2) Early reflections: sparse taps with per-channel offset for stereo
        for (let t = 0; t < earlyTapsMs.length; t++) {
          const tapMs = earlyTapsMs[t] * (0.7 + size * 0.6);
          const tapSample = predelaySamples + Math.floor(tapMs * rate / 1000);
          if (tapSample < totalLen) {
            // Alternating stereo panning on taps
            const pan = (t % 2 === 0) ? (0.5 + width * 0.5) : (0.5 - width * 0.5);
            const chanGain = ch === 0 ? (1 - pan) * 2 : pan * 2;
            const tapGain = earlyGains[t] * Math.min(1, chanGain);
            // Short noise burst at each tap
            const burstLen = Math.min(Math.floor(rate * 0.004), totalLen - tapSample);
            for (let b = 0; b < burstLen; b++) {
              const env = 1 - (b / burstLen);
              data[tapSample + b] += (Math.random() * 2 - 1) * tapGain * env * 0.6;
            }
          }
        }

        // 3) Late diffuse tail: shaped noise with allpass diffusion, damping, modulation
        if (lateLen > 0) {
          // Generate raw noise with exponential decay
          const raw = new Float32Array(lateLen);
          for (let i = 0; i < lateLen; i++) {
            const t = i / (lateLen - 1);
            // Triple-exponential decay for more natural tail
            const env = 0.4 * Math.exp(-3.5 * t / decay) + 0.35 * Math.exp(-5.8 * t / decay) + 0.25 * Math.exp(-9 * t / decay);
            raw[i] = (Math.random() * 2 - 1) * env;
          }

          // Apply cascaded allpass diffusion (Schroeder style)
          let buf = raw;
          for (let ap = 0; ap < apDelays.length; ap++) {
            const delay = apDelays[ap] + (ch * Math.floor(apDelays[ap] * 0.08 * stereoSign));
            const g = 0.55 + (ap * 0.03); // slight increasing diffusion
            const out = new Float32Array(buf.length);
            const ring = new Float32Array(Math.max(1, delay));
            let wi = 0;
            for (let i = 0; i < buf.length; i++) {
              const ri = ((wi - delay + ring.length) % ring.length) | 0;
              const delayed = ring[ri];
              const x = buf[i] - g * delayed;
              out[i] = delayed + g * x;
              ring[wi] = x;
              wi = (wi + 1) % ring.length;
            }
            buf = out;
          }

          // Apply dual damping filters (lowpass for damping + highpass roll for warmth)
          let lpState = 0;
          let hpState = 0;
          for (let i = 0; i < buf.length; i++) {
            // Low-pass damping
            lpState = dampCoef * lpState + (1 - dampCoef) * buf[i];
            // High-frequency brightness shaping
            hpState = brightCoef * hpState + (1 - brightCoef) * lpState;
            buf[i] = hpState;
          }

          // Apply subtle pitch modulation (chorus-like shimmer)
          const modulated = new Float32Array(buf.length);
          const maxModSamples = Math.floor(rate * 0.006 * modDepth);
          for (let i = 0; i < buf.length; i++) {
            const mod = Math.sin(2 * Math.PI * modRate * i / rate + stereoPhase) * maxModSamples;
            const readPos = i - maxModSamples - mod;
            const idx0 = Math.floor(readPos);
            const frac = readPos - idx0;
            const s0 = (idx0 >= 0 && idx0 < buf.length) ? buf[idx0] : 0;
            const s1 = (idx0 + 1 >= 0 && idx0 + 1 < buf.length) ? buf[idx0 + 1] : 0;
            modulated[i] = s0 + frac * (s1 - s0);
          }

          // Apply stereo width decorrelation
          const widthFactor = 0.5 + width * 0.5;
          const monoFactor = 1 - width * 0.3;
          for (let i = 0; i < modulated.length; i++) {
            const sample = modulated[i] * (ch === 0 ? widthFactor : monoFactor);
            if (lateStart + i < totalLen) data[lateStart + i] += sample * 0.7;
          }
        }

        // 4) Final soft-clip and normalize
        let peak = 0;
        for (let i = 0; i < totalLen; i++) peak = Math.max(peak, Math.abs(data[i]));
        if (peak > 0) {
          const norm = 0.92 / peak;
          for (let i = 0; i < totalLen; i++) {
            data[i] *= norm;
            // Gentle soft-clip
            if (data[i] > 1) data[i] = 1;
            else if (data[i] < -1) data[i] = -1;
          }
        }
      }
      return ir;
    }

    function _pgmBuildReverbImpulse(ctx, decaySeconds = 1.7, toneHz = 7000) {
      const rate = Math.max(22050, ctx.sampleRate || 48000);
      const length = Math.max(1, Math.floor(rate * Math.max(0.15, Math.min(8, Number(decaySeconds) || 1.7))));
      const ir = ctx.createBuffer(2, length, rate);
      const tone = Math.max(1000, Math.min(16000, Number(toneHz) || 7000));
      const lowpassCoef = Math.exp(-2 * Math.PI * tone / rate);
      for (let ch = 0; ch < ir.numberOfChannels; ch++) {
        const data = ir.getChannelData(ch);
        let lp = 0;
        for (let i = 0; i < length; i++) {
          const t = 1 - (i / length);
          const white = (Math.random() * 2 - 1) * t * t;
          lp = (lowpassCoef * lp) + ((1 - lowpassCoef) * white);
          data[i] = lp;
        }
      }
      return ir;
    }

    const _sourceFxRefreshTimers = Object.create(null);
    const _sourceFxSwapTimers = Object.create(null);

    function _fxTanhCurve(driveDb) {
      const driveAmount = Math.pow(10, Number(driveDb || 0) / 20);
      const samples = 44100;
      const curve = new Float32Array(samples);
      for (let i = 0; i < samples; i++) {
        const x = (i * 2 / samples) - 1;
        curve[i] = Math.tanh(x * driveAmount);
      }
      return curve;
    }

    function _setAudioParamSmooth(param, value, ctx, timeConstant = 0.012) {
      if (!param || typeof param.setTargetAtTime !== 'function') return false;
      const num = Number(value);
      if (!Number.isFinite(num)) return false;
      const now = (ctx && typeof ctx.currentTime === 'number') ? ctx.currentTime : 0;
      try {
        param.cancelScheduledValues(now);
        param.setTargetAtTime(num, now, timeConstant);
        return true;
      } catch (_) {
        try {
          param.value = num;
          return true;
        } catch (__) {
          return false;
        }
      }
    }

    function _applyFxParamInPlace(runtimeNode, fxType, key, val, ctx) {
      if (!runtimeNode) return false;
      const type = String(fxType || '');
      const nodes = Array.isArray(runtimeNode.nodes) ? runtimeNode.nodes : null;
      const directNode = nodes ? null : runtimeNode;
      const num = Number(val);
      const n = Number.isFinite(num) ? num : null;

      if (directNode) {
        if (type === 'highpass' || type === 'lowpass') {
          if (key === 'frequency') return _setAudioParamSmooth(directNode.frequency, n, ctx);
          if (key === 'q') return _setAudioParamSmooth(directNode.Q, n, ctx);
          return false;
        }
        if (type === 'lowshelf' || type === 'presence' || type === 'air' || type === 'parametric-eq') {
          if (key === 'frequency') return _setAudioParamSmooth(directNode.frequency, n, ctx);
          if (key === 'gain') return _setAudioParamSmooth(directNode.gain, n, ctx);
          if (key === 'q') return _setAudioParamSmooth(directNode.Q, n, ctx);
          return false;
        }
        if (type === 'compressor' || type === 'limiter' || type === 'expander') {
          if (key === 'threshold') return _setAudioParamSmooth(directNode.threshold, n, ctx);
          if (key === 'ratio') {
            const ratioVal = (type === 'expander') ? (1 / Math.max(0.1, n)) : n;
            return _setAudioParamSmooth(directNode.ratio, ratioVal, ctx);
          }
          if (key === 'attack') return _setAudioParamSmooth(directNode.attack, n, ctx);
          if (key === 'release') return _setAudioParamSmooth(directNode.release, n, ctx);
          if (key === 'knee') return _setAudioParamSmooth(directNode.knee, n, ctx);
          return false;
        }
        if (type === 'gain') {
          if (key === 'gain') return _setAudioParamSmooth(directNode.gain, n, ctx);
          return false;
        }
      }

      if (!nodes) return false;

      if (type === 'denoiser') {
        if (key !== 'amount' || n == null) return false;
        const amount = Math.max(0, Math.min(100, n));
        const hp = nodes[0];
        const lp = nodes[1];
        const ok1 = _setAudioParamSmooth(hp && hp.frequency, 40 + (amount * 2.2), ctx);
        const ok2 = _setAudioParamSmooth(lp && lp.frequency, Math.max(1800, 18000 - (amount * 145)), ctx);
        return ok1 || ok2;
      }
      if (type === 'reverb') {
        if (key !== 'mix' || n == null) return false;
        const mix = Math.max(0, Math.min(100, n)) / 100;
        const wet = nodes[2];
        const dry = nodes[3];
        const ok1 = _setAudioParamSmooth(wet && wet.gain, mix, ctx);
        const ok2 = _setAudioParamSmooth(dry && dry.gain, 1 - mix, ctx);
        return ok1 || ok2;
      }
      if (type === 'pro-reverb') {
        // nodes: [input, preEqLow, preEqHigh, conv, wet, dry, out]
        if (key === 'mix' && n != null) {
          const mix = Math.max(0, Math.min(100, n)) / 100;
          const ok1 = _setAudioParamSmooth(nodes[4] && nodes[4].gain, mix, ctx);
          const ok2 = _setAudioParamSmooth(nodes[5] && nodes[5].gain, 1 - mix, ctx);
          return ok1 || ok2;
        }
        if (key === 'brightness') return _setAudioParamSmooth(nodes[2] && nodes[2].frequency, Math.max(1000, Math.min(18000, n)), ctx);
        // decay/size/predelay/damping/width/modrate/moddepth require IR rebuild — return false to trigger full refresh
        return false;
      }
      if (type === 'de-esser') {
        const detector = nodes[1];
        const comp = nodes[2];
        const rangeGain = nodes[3];
        if (key === 'frequency') return _setAudioParamSmooth(detector && detector.frequency, n, ctx);
        if (key === 'threshold') return _setAudioParamSmooth(comp && comp.threshold, n, ctx);
        if (key === 'ratio') return _setAudioParamSmooth(comp && comp.ratio, n, ctx);
        if (key === 'range' && n != null) return _setAudioParamSmooth(rangeGain && rangeGain.gain, Math.pow(10, Math.min(0, -n) / 40), ctx);
        return false;
      }
      if (type === 'noise-gate') {
        const gs = runtimeNode.gateState;
        if (!gs) return false;
        if (key === 'threshold' && n != null) { gs.threshold = n; return true; }
        if (key === 'attack' && n != null) { gs.attack = n; return true; }
        if (key === 'release' && n != null) { gs.release = n; return true; }
        if (key === 'hold' && n != null) { gs.hold = n; return true; }
        if (key === 'range' && n != null) { gs.range = n; return true; }
        if (key === 'hysteresis' && n != null) { gs.hysteresis = n; return true; }
        if (key === 'lookahead' && n != null) { gs.lookahead = n; return true; }
        return false;
      }
      if (type === 'pro-denoiser') {
        const ds = runtimeNode.denoiserState;
        if (!ds) return false;
        if (key === 'reduction' && n != null) { ds.reduction = n; return true; }
        if (key === 'sensitivity' && n != null) { ds.sensitivity = n; return true; }
        if (key === 'preserve' && n != null) { ds.preserve = n; return true; }
        if (key === 'attack' && n != null) { ds.attack = n; return true; }
        if (key === 'release' && n != null) { ds.release = n; return true; }
        if (key === 'hpf' && n != null) { ds.hpf = n; return true; }
        if (key === 'lpf' && n != null) { ds.lpf = n; return true; }
        if (key === 'dryMix' && n != null) { ds.dryMix = n; return true; }
        return false;
      }
      if (type === 'delay') {
        const wet = nodes[2];
        const del = nodes[3];
        const fb = nodes[4];
        const tone = nodes[5];
        if (key === 'time') return _setAudioParamSmooth(del && del.delayTime, Math.max(0.001, Math.min(2, n)), ctx);
        if (key === 'feedback') return _setAudioParamSmooth(fb && fb.gain, Math.max(0, Math.min(0.9, n / 100)), ctx);
        if (key === 'mix') return _setAudioParamSmooth(wet && wet.gain, Math.max(0, Math.min(1, n / 100)), ctx);
        if (key === 'tone') return _setAudioParamSmooth(tone && tone.frequency, n, ctx);
        return false;
      }
      if (type === 'chorus') {
        const dry = nodes[1];
        const wet = nodes[2];
        const lfo = nodes[4];
        const lfoGain = nodes[5];
        if (key === 'rate') return _setAudioParamSmooth(lfo && lfo.frequency, n, ctx);
        if (key === 'depth') return _setAudioParamSmooth(lfoGain && lfoGain.gain, (n / 1000), ctx);
        if (key === 'mix' && n != null) {
          const mix = Math.max(0, Math.min(1, n / 100));
          const ok1 = _setAudioParamSmooth(wet && wet.gain, mix, ctx);
          const ok2 = _setAudioParamSmooth(dry && dry.gain, 1 - mix * 0.5, ctx);
          return ok1 || ok2;
        }
        return false;
      }
      if (type === 'exciter') {
        const hp = nodes[1];
        const shaper = nodes[2];
        const wet = nodes[3];
        if (key === 'frequency') return _setAudioParamSmooth(hp && hp.frequency, n, ctx);
        if (key === 'drive' && shaper) { shaper.curve = _fxTanhCurve(n); return true; }
        if (key === 'mix') return _setAudioParamSmooth(wet && wet.gain, Math.max(0, Math.min(1, n / 100)), ctx);
        return false;
      }
      if (type === 'stereo-widener') {
        const del = nodes[1];
        const wet = nodes[2];
        if (key !== 'width' || n == null) return false;
        const width = Math.max(0, Math.min(100, n)) / 100;
        const ok1 = _setAudioParamSmooth(del && del.delayTime, 0.002 + (width * 0.018), ctx);
        const ok2 = _setAudioParamSmooth(wet && wet.gain, width * 0.6, ctx);
        return ok1 || ok2;
      }
      if (type === 'pitch-shifter') {
        const dry = nodes[1];
        const wet = nodes[2];
        const lfo = nodes[4];
        const lfoGain = nodes[5];
        if (key === 'mix' && n != null) {
          const mix = Math.max(0, Math.min(1, n / 100));
          const ok1 = _setAudioParamSmooth(wet && wet.gain, mix, ctx);
          const ok2 = _setAudioParamSmooth(dry && dry.gain, 1 - mix, ctx);
          return ok1 || ok2;
        }
        if (key === 'semitones' && n != null) {
          const shiftRate = Math.abs(n) * 0.5 + 0.1;
          const ok1 = _setAudioParamSmooth(lfo && lfo.frequency, shiftRate, ctx);
          const ok2 = _setAudioParamSmooth(lfoGain && lfoGain.gain, (n >= 0 ? 1 : -1) * 0.005 * Math.abs(n), ctx);
          return ok1 || ok2;
        }
        return false;
      }
      if (type === 'phaser') {
        const dry = nodes[1];
        const wet = nodes[2];
        const feedback = nodes[3];
        const lfo = nodes[4];
        if (key === 'rate') return _setAudioParamSmooth(lfo && lfo.frequency, n, ctx);
        if (key === 'feedback') return _setAudioParamSmooth(feedback && feedback.gain, Math.max(0, Math.min(0.9, n / 100)), ctx);
        if (key === 'mix' && n != null) {
          const mix = Math.max(0, Math.min(1, n / 100));
          const ok1 = _setAudioParamSmooth(wet && wet.gain, mix, ctx);
          const ok2 = _setAudioParamSmooth(dry && dry.gain, 1 - mix * 0.5, ctx);
          return ok1 || ok2;
        }
        if (key === 'depth' && n != null) {
          const depth = Math.max(0, Math.min(1, n / 100));
          let changed = false;
          for (let i = 6, stage = 0; i < nodes.length - 1; i += 2, stage += 1) {
            const lfoDepth = nodes[i];
            const baseFreq = 1000 + (stage * 400);
            if (_setAudioParamSmooth(lfoDepth && lfoDepth.gain, depth * baseFreq, ctx)) changed = true;
          }
          return changed;
        }
        return false;
      }
      if (type === 'flanger') {
        const wet = nodes[2];
        const lfo = nodes[4];
        const lfoGain = nodes[5];
        const feedback = nodes[6];
        if (key === 'rate') return _setAudioParamSmooth(lfo && lfo.frequency, n, ctx);
        if (key === 'depth') return _setAudioParamSmooth(lfoGain && lfoGain.gain, n / 1000, ctx);
        if (key === 'feedback') return _setAudioParamSmooth(feedback && feedback.gain, Math.max(-0.95, Math.min(0.95, n / 100)), ctx);
        if (key === 'mix') return _setAudioParamSmooth(wet && wet.gain, Math.max(0, Math.min(1, n / 100)), ctx);
        return false;
      }
      if (type === 'tremolo') {
        const lfo = nodes[2];
        const lfoDepth = nodes[3];
        if (key === 'rate') return _setAudioParamSmooth(lfo && lfo.frequency, n, ctx);
        if (key === 'depth') return _setAudioParamSmooth(lfoDepth && lfoDepth.gain, Math.max(0, Math.min(1, n / 100)) * 0.5, ctx);
        if (key === 'shape' && lfo) {
          lfo.type = n <= 0.33 ? 'sine' : n <= 0.66 ? 'triangle' : 'square';
          return true;
        }
        return false;
      }
      if (type === 'distortion') {
        const shaper = nodes[1];
        const tone = nodes[2];
        const wet = nodes[3];
        const dry = nodes[4];
        if (key === 'drive' && shaper) { shaper.curve = _fxTanhCurve(n); return true; }
        if (key === 'tone') return _setAudioParamSmooth(tone && tone.frequency, n, ctx);
        if (key === 'mix' && n != null) {
          const mix = Math.max(0, Math.min(1, n / 100));
          const ok1 = _setAudioParamSmooth(wet && wet.gain, mix, ctx);
          const ok2 = _setAudioParamSmooth(dry && dry.gain, 1 - mix, ctx);
          return ok1 || ok2;
        }
        return false;
      }
      if (type === 'ducking') {
        const comp = nodes[1];
        const makeup = nodes[2];
        if (key === 'threshold') return _setAudioParamSmooth(comp && comp.threshold, n, ctx);
        if (key === 'attack') return _setAudioParamSmooth(comp && comp.attack, n, ctx);
        if (key === 'release') return _setAudioParamSmooth(comp && comp.release, n, ctx);
        if (key === 'amount') return _setAudioParamSmooth(makeup && makeup.gain, Math.pow(10, -n / 20), ctx);
        return false;
      }
      if (type === 'pro-compressor') {
        const dry = nodes[1];
        const wet = nodes[2];
        const c1 = nodes[3];
        const c2 = nodes[4];
        const makeup = nodes[5];
        if (key === 'threshold' && n != null) {
          const ok1 = _setAudioParamSmooth(c1 && c1.threshold, n, ctx, 0.026);
          const ok2 = _setAudioParamSmooth(c2 && c2.threshold, Math.min(0, n + 8), ctx, 0.026);
          return ok1 || ok2;
        }
        if (key === 'ratio' && n != null) {
          const ratio = Math.max(1, Math.min(20, n));
          const ok1 = _setAudioParamSmooth(c1 && c1.ratio, ratio, ctx);
          const ok2 = _setAudioParamSmooth(c2 && c2.ratio, Math.max(1, Math.min(20, ratio * 1.35)), ctx);
          return ok1 || ok2;
        }
        if (key === 'attack' && n != null) {
          const ok1 = _setAudioParamSmooth(c1 && c1.attack, Math.max(0.001, n), ctx);
          const ok2 = _setAudioParamSmooth(c2 && c2.attack, Math.max(0.0005, n * 0.45), ctx);
          return ok1 || ok2;
        }
        if (key === 'release' && n != null) {
          const ok1 = _setAudioParamSmooth(c1 && c1.release, Math.max(0.02, n), ctx);
          const ok2 = _setAudioParamSmooth(c2 && c2.release, Math.max(0.01, n * 0.7), ctx);
          return ok1 || ok2;
        }
        if (key === 'knee' && n != null) {
          const knee = Math.max(0, Math.min(40, n));
          const ok1 = _setAudioParamSmooth(c1 && c1.knee, knee, ctx, 0.032);
          const ok2 = _setAudioParamSmooth(c2 && c2.knee, Math.max(0, knee * 0.7), ctx, 0.032);
          return ok1 || ok2;
        }
        if (key === 'makeup' && n != null) {
          return _setAudioParamSmooth(makeup && makeup.gain, Math.pow(10, n / 20), ctx, 0.042);
        }
        if (key === 'mix' && n != null) {
          const mix = Math.max(0, Math.min(1, n / 100));
          const wetGain = Math.sin(mix * Math.PI * 0.5);
          const dryGain = Math.cos(mix * Math.PI * 0.5);
          const ok1 = _setAudioParamSmooth(wet && wet.gain, wetGain, ctx, 0.03);
          const ok2 = _setAudioParamSmooth(dry && dry.gain, dryGain, ctx, 0.03);
          return ok1 || ok2;
        }
        return false;
      }

      return false;
    }

    function _pgmCreateFxNode(ctx, fx) {
      const type = String(fx && fx.type || '');
      const params = (fx && fx.params) || {};
      if (type === 'highpass') {
        const n = ctx.createBiquadFilter();
        n.type = 'highpass';
        n.frequency.value = Number(params.frequency || 80);
        n.Q.value = Number(params.q || 0.707);
        return n;
      }
      if (type === 'lowshelf') {
        const n = ctx.createBiquadFilter();
        n.type = 'lowshelf';
        n.frequency.value = Number(params.frequency || 160);
        n.gain.value = Number(params.gain || 1.8);
        n.Q.value = Number(params.q || 0.707);
        return n;
      }
      if (type === 'presence') {
        const n = ctx.createBiquadFilter();
        n.type = 'peaking';
        n.frequency.value = Number(params.frequency || 3200);
        n.Q.value = Number(params.q || 1.05);
        n.gain.value = Number(params.gain || 2.2);
        return n;
      }
      if (type === 'air') {
        const n = ctx.createBiquadFilter();
        n.type = 'highshelf';
        n.frequency.value = Number(params.frequency || 9800);
        n.gain.value = Number(params.gain || 2.2);
        n.Q.value = Number(params.q || 0.707);
        return n;
      }
      if (type === 'compressor' || type === 'limiter') {
        const n = ctx.createDynamicsCompressor();
        if (type === 'limiter') {
          n.threshold.value = Number(params.threshold || -2.5);
          n.knee.value = Number(params.knee || 0);
          n.ratio.value = Number(params.ratio || 20);
          n.attack.value = Number(params.attack || 0.001);
          n.release.value = Number(params.release || 0.08);
        } else {
          n.threshold.value = Number(params.threshold || -22);
          n.knee.value = Number(params.knee || 10);
          n.ratio.value = Number(params.ratio || 2.4);
          n.attack.value = Number(params.attack || 0.004);
          n.release.value = Number(params.release || 0.14);
        }
        return n;
      }
      if (type === 'pro-compressor') {
        const threshold = Number(params.threshold ?? -24);
        const ratio = Math.max(1, Math.min(20, Number(params.ratio ?? 3.2)));
        const attack = Math.max(0.001, Number(params.attack ?? 0.003));
        const release = Math.max(0.02, Number(params.release ?? 0.12));
        const knee = Math.max(0, Math.min(40, Number(params.knee ?? 8)));
        const makeupDb = Number(params.makeup ?? 2.0);
        const mix = Math.max(0, Math.min(1, (Number(params.mix ?? 100)) / 100));
        const targetWet = Math.sin(mix * Math.PI * 0.5);
        const targetDry = Math.cos(mix * Math.PI * 0.5);
        const input = ctx.createGain();
        const dry = ctx.createGain();
        const wet = ctx.createGain();
        const c1 = ctx.createDynamicsCompressor();
        const c2 = ctx.createDynamicsCompressor();
        const makeup = ctx.createGain();
        const out = ctx.createGain();
        dry.gain.value = 1;
        wet.gain.value = 0;
        c1.threshold.value = threshold;
        c1.ratio.value = ratio;
        c1.attack.value = attack;
        c1.release.value = release;
        c1.knee.value = knee;
        c2.threshold.value = Math.min(0, threshold + 8);
        c2.ratio.value = Math.max(1, Math.min(20, ratio * 1.35));
        c2.attack.value = Math.max(0.0005, attack * 0.45);
        c2.release.value = Math.max(0.01, release * 0.7);
        c2.knee.value = Math.max(0, knee * 0.7);
        makeup.gain.value = Math.pow(10, makeupDb / 20);
        input.connect(dry);
        input.connect(c1);
        c1.connect(c2);
        c2.connect(makeup);
        makeup.connect(wet);
        dry.connect(out);
        wet.connect(out);
        // Fast crossfade warm-up — 5ms delay, 12ms ramp. Prevents transient
        // burst while keeping latency imperceptible.
        try {
          const now = ctx.currentTime || 0;
          dry.gain.setValueAtTime(1, now);
          wet.gain.setValueAtTime(0, now);
          dry.gain.setTargetAtTime(targetDry, now + 0.005, 0.012);
          wet.gain.setTargetAtTime(targetWet, now + 0.005, 0.012);
        } catch (_) {
          dry.gain.value = targetDry;
          wet.gain.value = targetWet;
        }
        return { input, output: out, nodes: [input, dry, wet, c1, c2, makeup, out] };
      }
      if (type === 'gain') {
        const n = ctx.createGain();
        n.gain.value = Number(params.gain || 1);
        return n;
      }
      if (type === 'denoiser') {
        const amount = Math.max(0, Math.min(100, Number(params.amount) || 0));
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 40 + (amount * 2.2);
        hp.Q.value = 0.707;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = Math.max(1800, 18000 - (amount * 145));
        lp.Q.value = 0.707;
        hp.connect(lp);
        return { input: hp, output: lp, nodes: [hp, lp] };
      }
      if (type === 'pro-denoiser') {
        /* ── Pro Denoiser AI ──
           Multi-band spectral gate with FFT analysis, adaptive noise floor estimation,
           psychoacoustic voice-preservation, and smooth per-bin gain interpolation.
           Achieves studio-grade noise reduction without muffling.
        */
        const ds = {
          reduction:   Math.max(0, Math.min(100, Number(params.reduction ?? 65))),
          sensitivity: Math.max(0, Math.min(100, Number(params.sensitivity ?? 50))),
          preserve:    Math.max(0, Math.min(100, Number(params.preserve ?? 70))),
          attack:      Math.max(1, Math.min(50, Number(params.attack ?? 6))),
          release:     Math.max(5, Math.min(200, Number(params.release ?? 40))),
          hpf:         Math.max(20, Math.min(500, Number(params.hpf ?? 60))),
          lpf:         Math.max(4000, Math.min(22000, Number(params.lpf ?? 18000))),
          dryMix:      Math.max(0, Math.min(50, Number(params.dryMix ?? 0)))
        };
        const sr = ctx.sampleRate || 48000;
        const fftSize = 2048;
        const halfFFT = fftSize / 2;
        const hopSize = fftSize / 4; // 75% overlap
        const userBuf = _getAudioFxBufferSize();
        const procBuf = Math.max(hopSize, userBuf); // must be >= hopSize for correct overlap-add
        const input = ctx.createGain();
        const output = ctx.createGain();
        const dry = ctx.createGain();
        const wet = ctx.createGain();
        const processor = _createFxScriptProcessorSafe(ctx, procBuf, 2, 2);
        dry.gain.value = 1;
        wet.gain.value = 0;
        // Per-channel state
        const chState = [];
        for (let ch = 0; ch < 2; ch++) {
          const win = new Float32Array(fftSize);
          for (let i = 0; i < fftSize; i++) win[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / fftSize));
          const inRing = new Float32Array(fftSize);
          const outAcc = new Float32Array(fftSize * 2);
          const noiseFloor = new Float32Array(halfFFT + 1);
          noiseFloor.fill(-120);
          const smoothGain = new Float32Array(halfFFT + 1);
          smoothGain.fill(1);
          chState.push({ win, inRing, outAcc, noiseFloor, smoothGain, ringPos: 0, outReadPos: 0, frameCount: 0 });
        }
        const binHz = sr / fftSize;
        const voiceLoBin = Math.max(1, Math.floor(80 / binHz));
        const voiceHiBin = Math.min(halfFFT, Math.ceil(3500 / binHz));
        const presHiBin  = Math.min(halfFFT, Math.ceil(8000 / binHz));
        processor.onaudioprocess = function(e) {
          const inBuf = e.inputBuffer, outBuf = e.outputBuffer;
          const numCh = Math.min(inBuf.numberOfChannels, outBuf.numberOfChannels, 2);
          const blockLen = inBuf.length;
          const redux    = ds.reduction / 100;
          const sens     = ds.sensitivity / 100;
          const pres     = ds.preserve / 100;
          const atkCoeff = Math.exp(-1 / Math.max(1, ds.attack * 0.01 * sr / blockLen));
          const relCoeff = Math.exp(-1 / Math.max(1, ds.release * 0.01 * sr / blockLen));
          const hpfBin   = Math.max(0, Math.floor(ds.hpf / binHz));
          const lpfBin   = Math.min(halfFFT, Math.ceil(ds.lpf / binHz));
          const dryGain  = ds.dryMix / 100;
          const maxAttenDb = redux * 80;
          const nfUp = 0.02, nfDown = 0.0004;
          for (let ch = 0; ch < numCh; ch++) {
            const st = chState[ch];
            const inp = inBuf.getChannelData(ch);
            const outp = outBuf.getChannelData(ch);
            for (let i = 0; i < blockLen; i++) {
              st.inRing[st.ringPos] = inp[i];
              st.ringPos = (st.ringPos + 1) % fftSize;
            }
            const frame = new Float32Array(fftSize);
            for (let i = 0; i < fftSize; i++) frame[i] = st.inRing[(st.ringPos + i) % fftSize] * st.win[i];
            // FFT (Cooley-Tukey radix-2)
            const re = new Float32Array(fftSize);
            const im = new Float32Array(fftSize);
            for (let i = 0; i < fftSize; i++) re[i] = frame[i];
            for (let i = 1, j = 0; i < fftSize; i++) {
              let bit = fftSize >> 1;
              while (j & bit) { j ^= bit; bit >>= 1; }
              j ^= bit;
              if (i < j) { const t = re[i]; re[i] = re[j]; re[j] = t; }
            }
            for (let len = 2; len <= fftSize; len *= 2) {
              const halfLen = len / 2;
              const ang = -2 * Math.PI / len;
              const wRe = Math.cos(ang), wIm = Math.sin(ang);
              for (let i = 0; i < fftSize; i += len) {
                let curRe = 1, curIm = 0;
                for (let j = 0; j < halfLen; j++) {
                  const u = i + j, v = u + halfLen;
                  const tRe = re[v] * curRe - im[v] * curIm;
                  const tIm = re[v] * curIm + im[v] * curRe;
                  re[v] = re[u] - tRe; im[v] = im[u] - tIm;
                  re[u] += tRe; im[u] += tIm;
                  const nxtRe = curRe * wRe - curIm * wIm;
                  curIm = curRe * wIm + curIm * wRe;
                  curRe = nxtRe;
                }
              }
            }
            // Magnitude spectrum (dB)
            const mag = new Float32Array(halfFFT + 1);
            for (let b = 0; b <= halfFFT; b++) {
              mag[b] = 20 * Math.log10(Math.max(1e-10, Math.sqrt(re[b] * re[b] + im[b] * im[b]) / fftSize));
            }
            st.frameCount++;
            // Adaptive noise floor estimation
            const learning = st.frameCount <= 8;
            for (let b = 0; b <= halfFFT; b++) {
              if (learning) {
                st.noiseFloor[b] = (st.frameCount === 1) ? mag[b] : Math.max(st.noiseFloor[b], mag[b]);
              } else {
                if (mag[b] < st.noiseFloor[b] + 3) {
                  st.noiseFloor[b] += nfUp * (mag[b] - st.noiseFloor[b]);
                } else {
                  st.noiseFloor[b] -= nfDown * (st.noiseFloor[b] + 120);
                  if (st.noiseFloor[b] < -120) st.noiseFloor[b] = -120;
                }
              }
            }
            // Per-bin spectral gating with voice preservation
            const sensitivity_offset = (1 - sens) * 18 - 9;
            for (let b = 0; b <= halfFFT; b++) {
              let targetGain = 1;
              if (b < hpfBin || b > lpfBin) {
                targetGain = 0;
              } else {
                const excess = mag[b] - (st.noiseFloor[b] + sensitivity_offset);
                if (excess < 0) {
                  const gateDepth = Math.min(1, Math.abs(excess) / Math.max(1, maxAttenDb * 0.5));
                  targetGain = Math.pow(10, -maxAttenDb * gateDepth / 20);
                }
                if (pres > 0 && b >= voiceLoBin && b <= presHiBin) {
                  const voiceBoost = (b <= voiceHiBin) ? pres : pres * 0.5;
                  targetGain = targetGain + (1 - targetGain) * voiceBoost;
                }
              }
              if (targetGain > st.smoothGain[b]) {
                st.smoothGain[b] = targetGain - atkCoeff * (targetGain - st.smoothGain[b]);
              } else {
                st.smoothGain[b] = targetGain + relCoeff * (st.smoothGain[b] - targetGain);
              }
              if (st.smoothGain[b] < 0) st.smoothGain[b] = 0;
              else if (st.smoothGain[b] > 1) st.smoothGain[b] = 1;
            }
            // Apply spectral gains
            for (let b = 0; b <= halfFFT; b++) {
              const g = st.smoothGain[b];
              re[b] *= g; im[b] *= g;
              if (b > 0 && b < halfFFT) { re[fftSize - b] *= g; im[fftSize - b] *= g; }
            }
            // IFFT
            for (let i = 0; i < fftSize; i++) im[i] = -im[i];
            for (let i = 1, j = 0; i < fftSize; i++) {
              let bit = fftSize >> 1;
              while (j & bit) { j ^= bit; bit >>= 1; }
              j ^= bit;
              if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
            }
            for (let len = 2; len <= fftSize; len *= 2) {
              const halfLen = len / 2;
              const ang = -2 * Math.PI / len;
              const wRe = Math.cos(ang), wIm = Math.sin(ang);
              for (let i = 0; i < fftSize; i += len) {
                let curRe = 1, curIm = 0;
                for (let j = 0; j < halfLen; j++) {
                  const u = i + j, v = u + halfLen;
                  const tRe = re[v] * curRe - im[v] * curIm;
                  const tIm = re[v] * curIm + im[v] * curRe;
                  re[v] = re[u] - tRe; im[v] = im[u] - tIm;
                  re[u] += tRe; im[u] += tIm;
                  const nxtRe = curRe * wRe - curIm * wIm;
                  curIm = curRe * wIm + curIm * wRe;
                  curRe = nxtRe;
                }
              }
            }
            // Normalize + window + overlap-add
            const invN = 1 / fftSize;
            for (let i = 0; i < fftSize; i++) re[i] *= invN * st.win[i];
            for (let i = 0; i < fftSize; i++) {
              st.outAcc[(st.outReadPos + i) % (fftSize * 2)] += re[i];
            }
            for (let i = 0; i < blockLen; i++) {
              const idx = (st.outReadPos + i) % (fftSize * 2);
              outp[i] = st.outAcc[idx] + inp[i] * dryGain;
              st.outAcc[idx] = 0;
            }
            st.outReadPos = (st.outReadPos + blockLen) % (fftSize * 2);
          }
          for (let ch = numCh; ch < outBuf.numberOfChannels; ch++) {
            outBuf.getChannelData(ch).set(outBuf.getChannelData(Math.min(ch, numCh - 1)));
          }
        };
        input.connect(dry);
        dry.connect(output);
        input.connect(processor);
        processor.connect(wet);
        wet.connect(output);
        try {
          const now = ctx.currentTime || 0;
          dry.gain.setValueAtTime(1, now);
          wet.gain.setValueAtTime(0, now);
          dry.gain.setTargetAtTime(0, now + 0.02, 0.22);
          wet.gain.setTargetAtTime(1, now + 0.02, 0.22);
        } catch (_) {}
        return { input, output, nodes: [input, dry, processor, wet, output], denoiserState: ds };
      }
      if (type === 'reverb') {
        const mix = Math.max(0, Math.min(100, Number(params.mix) || 26)) / 100;
        const input = ctx.createGain();
        const conv = ctx.createConvolver();
        conv.buffer = _pgmBuildReverbImpulse(ctx, Number(params.decay || 1.7), Number(params.tone || 7000));
        const wet = ctx.createGain();
        const dry = ctx.createGain();
        const out = ctx.createGain();
        wet.gain.value = mix;
        dry.gain.value = 1 - mix;
        input.connect(conv);
        input.connect(dry);
        conv.connect(wet);
        wet.connect(out);
        dry.connect(out);
        return { input, output: out, nodes: [input, conv, wet, dry, out] };
      }
      if (type === 'pro-reverb') {
        const p = params;
        const mix = Math.max(0, Math.min(100, Number(p.mix) || 22)) / 100;
        const input = ctx.createGain();
        const conv = ctx.createConvolver();
        conv.buffer = _buildProReverbIR(ctx, p);
        const wet = ctx.createGain();
        const dry = ctx.createGain();
        const preEqLow = ctx.createBiquadFilter();
        preEqLow.type = 'highpass';
        preEqLow.frequency.value = 80;
        preEqLow.Q.value = 0.5;
        const preEqHigh = ctx.createBiquadFilter();
        preEqHigh.type = 'lowpass';
        preEqHigh.frequency.value = Math.max(1000, Math.min(18000, Number(p.brightness) || 8200));
        preEqHigh.Q.value = 0.707;
        const out = ctx.createGain();
        wet.gain.value = mix;
        dry.gain.value = 1 - mix;
        input.connect(preEqLow);
        preEqLow.connect(preEqHigh);
        preEqHigh.connect(conv);
        input.connect(dry);
        conv.connect(wet);
        wet.connect(out);
        dry.connect(out);
        return { input, output: out, nodes: [input, preEqLow, preEqHigh, conv, wet, dry, out] };
      }
      if (type === 'lowpass') {
        const n = ctx.createBiquadFilter();
        n.type = 'lowpass';
        n.frequency.value = Number(params.frequency || 8000);
        n.Q.value = Number(params.q || 0.707);
        return n;
      }
      if (type === 'parametric-eq') {
        const n = ctx.createBiquadFilter();
        n.type = 'peaking';
        n.frequency.value = Number(params.frequency || 1000);
        n.gain.value = Number(params.gain || 0);
        n.Q.value = Number(params.q || 1.0);
        return n;
      }
      if (type === 'de-esser') {
        // Sidechain-style: band-pass detects sibilance, compresses that band
        const input = ctx.createGain();
        const dry = ctx.createGain();
        const detector = ctx.createBiquadFilter();
        detector.type = 'bandpass';
        detector.frequency.value = Number(params.frequency || 6500);
        detector.Q.value = 3.0;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = Number(params.threshold || -20);
        comp.ratio.value = Number(params.ratio || 6);
        comp.attack.value = 0.001;
        comp.release.value = 0.05;
        comp.knee.value = 3;
        // Apply range as makeup attenuation via a gain node
        const rangeGain = ctx.createGain();
        const rangeDb = Math.min(0, -(Number(params.range || 12)));
        rangeGain.gain.value = Math.pow(10, rangeDb / 40); // subtle range control
        const out = ctx.createGain();
        input.connect(detector);
        detector.connect(comp);
        comp.connect(rangeGain);
        input.connect(dry);
        rangeGain.connect(out);
        dry.connect(out);
        return { input, output: out, nodes: [input, detector, comp, rangeGain, dry, out] };
      }
      if (type === 'noise-gate') {
        /* ── Clean Noise Gate ──
           ScriptProcessorNode with:
           • RMS detection (5ms window) for stable level tracking
           • Per-sample parameter smoothing (no clicks when tweaking knobs)
           • Soft-knee with hysteresis to prevent chatter
           • Hold timer, lookahead delay, and range control
           • Secondary gain smoother to eliminate any residual zipper noise
        */
        const gs = {
          threshold: Number(params.threshold ?? -45),
          attack:    Number(params.attack ?? 0.002),
          release:   Number(params.release ?? 0.05),
          hold:      Number(params.hold ?? 0.05),
          range:     Number(params.range ?? 60),
          hysteresis: Number(params.hysteresis ?? 4),
          lookahead: Number(params.lookahead ?? 1.5),
          // smoothed copies (internal — updated per-sample toward targets above)
          _sThresh: Number(params.threshold ?? -45),
          _sRange:  Number(params.range ?? 60),
          _sHyst:   Number(params.hysteresis ?? 4),
          // internal state
          envelope: 0,
          holdCounter: 0,
          rmsEnvelope: 0,
          gainSmooth: 0
        };
        const input = ctx.createGain();
        const output = ctx.createGain();
        const dry = ctx.createGain();
        const wet = ctx.createGain();
        const sr = ctx.sampleRate || 48000;
        const processor = _createFxScriptProcessorSafe(ctx, _getAudioFxBufferSize(), 2, 2);
        dry.gain.value = 1;
        wet.gain.value = 0;
        // Lookahead circular buffers (max 10ms)
        const maxLA = Math.ceil(sr * 0.01) || 480;
        const delBufs = [new Float32Array(maxLA), new Float32Array(maxLA)];
        let wPos = 0;
        // RMS smoothing coefficient (~5ms window for stability)
        const rmsCoeff = Math.exp(-1 / (sr * 0.005));
        // Parameter smoothing coefficient (~15ms, eliminates zipper on slider drag)
        const paramSmooth = Math.exp(-1 / (sr * 0.015));
        // Secondary output gain smoother (~2ms, catches any remaining clicks)
        const gainLPCoeff = Math.exp(-1 / (sr * 0.002));
        processor.onaudioprocess = function(e) {
          const inBuf = e.inputBuffer, outBuf = e.outputBuffer;
          const numCh = Math.min(inBuf.numberOfChannels, outBuf.numberOfChannels, 2);
          const len = inBuf.length;
          // Snapshot target params once per block
          const tgtThresh = gs.threshold;
          const tgtRange  = gs.range;
          const tgtHyst   = gs.hysteresis;
          const atkCoeff  = Math.exp(-1 / (sr * Math.max(0.0005, gs.attack)));
          const relCoeff  = Math.exp(-1 / (sr * Math.max(0.005, gs.release)));
          const holdSamp  = Math.floor(sr * Math.max(0, gs.hold));
          const laSamp    = Math.max(0, Math.min(maxLA - 1, Math.floor(sr * Math.max(0, Math.min(10, gs.lookahead)) / 1000)));
          const inD = [], outD = [];
          for (let ch = 0; ch < numCh; ch++) { inD[ch] = inBuf.getChannelData(ch); outD[ch] = outBuf.getChannelData(ch); }
          for (let ch = numCh; ch < outBuf.numberOfChannels; ch++) outBuf.getChannelData(ch).set(inBuf.getChannelData(Math.min(ch, inBuf.numberOfChannels - 1)));
          for (let s = 0; s < len; s++) {
            // Smooth parameters toward targets (eliminates clicks on slider drag)
            gs._sThresh = paramSmooth * gs._sThresh + (1 - paramSmooth) * tgtThresh;
            gs._sRange  = paramSmooth * gs._sRange  + (1 - paramSmooth) * tgtRange;
            gs._sHyst   = paramSmooth * gs._sHyst   + (1 - paramSmooth) * tgtHyst;
            const curThresh = gs._sThresh;
            const curRange  = gs._sRange;
            const closeT    = curThresh - Math.max(0, gs._sHyst);
            const rangeLin  = Math.pow(10, -Math.max(0, curRange) / 20);
            // RMS level detection across channels
            let sumSq = 0;
            for (let ch = 0; ch < numCh; ch++) { const v = inD[ch][s]; sumSq += v * v; }
            gs.rmsEnvelope = rmsCoeff * gs.rmsEnvelope + (1 - rmsCoeff) * (sumSq / Math.max(1, numCh));
            const levelDb = 10 * Math.log10(Math.max(gs.rmsEnvelope, 1e-20));
            // Gate decision with hysteresis + hold
            if (levelDb > curThresh) {
              gs.holdCounter = holdSamp;
              gs.envelope = 1 - atkCoeff * (1 - gs.envelope);
            } else if (levelDb > closeT && gs.envelope > 0.5) {
              // In hysteresis zone & gate was open — keep open, maintain hold
              gs.holdCounter = holdSamp;
              gs.envelope = 1 - atkCoeff * (1 - gs.envelope);
            } else if (gs.holdCounter > 0) {
              gs.holdCounter--;
              // Hold phase — keep envelope stable (don't ramp further, just sustain)
              gs.envelope = 1 - atkCoeff * (1 - gs.envelope);
            } else {
              gs.envelope = relCoeff * gs.envelope;
            }
            if (gs.envelope < 1e-8) gs.envelope = 0;
            else if (gs.envelope > 1 - 1e-8) gs.envelope = 1;
            // Gain: from rangeLin (closed) to 1.0 (open)
            const rawGain = rangeLin + (1 - rangeLin) * gs.envelope;
            // Secondary gain smoother — eliminates any residual zipper
            gs.gainSmooth = gainLPCoeff * gs.gainSmooth + (1 - gainLPCoeff) * rawGain;
            const gain = gs.gainSmooth;
            // Output from lookahead delay buffer
            for (let ch = 0; ch < numCh; ch++) {
              const buf = delBufs[ch];
              const rP = (wPos - laSamp + maxLA) % maxLA;
              const delayed = laSamp > 0 ? buf[rP] : inD[ch][s];
              buf[wPos] = inD[ch][s];
              outD[ch][s] = delayed * gain;
            }
            wPos = (wPos + 1) % maxLA;
          }
        };
        input.connect(dry);
        dry.connect(output);
        input.connect(processor);
        processor.connect(wet);
        wet.connect(output);
        try {
          const now = ctx.currentTime || 0;
          dry.gain.setValueAtTime(1, now);
          wet.gain.setValueAtTime(0, now);
          dry.gain.setTargetAtTime(0, now + 0.01, 0.1);
          wet.gain.setTargetAtTime(1, now + 0.01, 0.1);
        } catch (_) {}
        return { input, output, nodes: [input, dry, processor, wet, output], gateState: gs };
      }
      if (type === 'delay') {
        const delayTime = Math.max(0.001, Math.min(2, Number(params.time || 0.3)));
        const feedback = Math.max(0, Math.min(0.9, (Number(params.feedback || 30)) / 100));
        const mix = Math.max(0, Math.min(1, (Number(params.mix || 25)) / 100));
        const toneHz = Number(params.tone || 6000);
        const input = ctx.createGain();
        const dry = ctx.createGain();
        dry.gain.value = 1;
        const wet = ctx.createGain();
        wet.gain.value = mix;
        const del = ctx.createDelay(3.0);
        del.delayTime.value = delayTime;
        const fb = ctx.createGain();
        fb.gain.value = feedback;
        const tone = ctx.createBiquadFilter();
        tone.type = 'lowpass';
        tone.frequency.value = toneHz;
        const out = ctx.createGain();
        input.connect(dry);
        input.connect(del);
        del.connect(tone);
        tone.connect(fb);
        fb.connect(del);
        tone.connect(wet);
        dry.connect(out);
        wet.connect(out);
        return { input, output: out, nodes: [input, dry, wet, del, fb, tone, out] };
      }
      if (type === 'chorus') {
        const rate = Number(params.rate || 1.5);
        const depthMs = Number(params.depth || 5) / 1000;
        const mix = Math.max(0, Math.min(1, (Number(params.mix || 40)) / 100));
        const input = ctx.createGain();
        const dry = ctx.createGain();
        dry.gain.value = 1 - mix * 0.5;
        const wet = ctx.createGain();
        wet.gain.value = mix;
        const del = ctx.createDelay(0.05);
        del.delayTime.value = 0.015;
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = rate;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = depthMs;
        lfo.connect(lfoGain);
        lfoGain.connect(del.delayTime);
        lfo.start();
        const out = ctx.createGain();
        input.connect(dry);
        input.connect(del);
        del.connect(wet);
        dry.connect(out);
        wet.connect(out);
        return { input, output: out, nodes: [input, dry, wet, del, lfo, lfoGain, out] };
      }
      if (type === 'exciter') {
        const freq = Number(params.frequency || 3000);
        const driveDb = Number(params.drive || 4);
        const mix = Math.max(0, Math.min(1, (Number(params.mix || 30)) / 100));
        const input = ctx.createGain();
        const hpFilter = ctx.createBiquadFilter();
        hpFilter.type = 'highpass';
        hpFilter.frequency.value = freq;
        // WaveShaperNode for harmonic generation
        const shaper = ctx.createWaveShaper();
        const driveAmount = Math.pow(10, driveDb / 20);
        const samples = 44100;
        const curve = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
          const x = (i * 2 / samples) - 1;
          curve[i] = Math.tanh(x * driveAmount);
        }
        shaper.curve = curve;
        shaper.oversample = '2x';
        const wet = ctx.createGain();
        wet.gain.value = mix;
        const dry = ctx.createGain();
        dry.gain.value = 1;
        const out = ctx.createGain();
        input.connect(hpFilter);
        hpFilter.connect(shaper);
        shaper.connect(wet);
        input.connect(dry);
        wet.connect(out);
        dry.connect(out);
        return { input, output: out, nodes: [input, hpFilter, shaper, wet, dry, out] };
      }
      if (type === 'stereo-widener') {
        const width = Math.max(0, Math.min(100, Number(params.width || 50))) / 100;
        const input = ctx.createGain();
        // Use a subtle delay on one channel to create width perception in mono-compatible way
        const del = ctx.createDelay(0.05);
        del.delayTime.value = 0.002 + (width * 0.018); // 2ms-20ms Haas effect
        const wet = ctx.createGain();
        wet.gain.value = width * 0.6;
        const dry = ctx.createGain();
        dry.gain.value = 1;
        const out = ctx.createGain();
        input.connect(dry);
        input.connect(del);
        del.connect(wet);
        dry.connect(out);
        wet.connect(out);
        return { input, output: out, nodes: [input, del, wet, dry, out] };
      }
      if (type === 'pitch-shifter') {
        // Simple pitch shifting via playback rate detune on delay lines
        const semitones = Number(params.semitones || 0);
        const mix = Math.max(0, Math.min(1, (Number(params.mix || 100)) / 100));
        const input = ctx.createGain();
        // Use detune on a BiquadFilter as an approximation for pitch in Web Audio
        // True pitch shifting is limited; we use a creative approach with oscillator modulation
        const dry = ctx.createGain();
        dry.gain.value = 1 - mix;
        const wet = ctx.createGain();
        wet.gain.value = mix;
        const del = ctx.createDelay(0.1);
        del.delayTime.value = 0.05;
        const lfo = ctx.createOscillator();
        lfo.type = 'sawtooth';
        // Map semitones to a warble rate that simulates pitch shift
        const shiftRate = Math.abs(semitones) * 0.5 + 0.1;
        lfo.frequency.value = shiftRate;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = (semitones >= 0 ? 1 : -1) * 0.005 * Math.abs(semitones);
        lfo.connect(lfoGain);
        lfoGain.connect(del.delayTime);
        lfo.start();
        const out = ctx.createGain();
        input.connect(dry);
        input.connect(del);
        del.connect(wet);
        dry.connect(out);
        wet.connect(out);
        return { input, output: out, nodes: [input, dry, wet, del, lfo, lfoGain, out] };
      }
      if (type === 'phaser') {
        const rate = Number(params.rate || 0.5);
        const depth = Math.max(0, Math.min(1, (Number(params.depth || 50)) / 100));
        const stages = Math.max(2, Math.min(12, Math.round(Number(params.stages || 4) / 2) * 2));
        const fb = Math.max(0, Math.min(0.9, (Number(params.feedback || 30)) / 100));
        const mix = Math.max(0, Math.min(1, (Number(params.mix || 50)) / 100));
        const input = ctx.createGain();
        const dry = ctx.createGain();
        dry.gain.value = 1 - mix * 0.5;
        const wet = ctx.createGain();
        wet.gain.value = mix;
        const feedbackGain = ctx.createGain();
        feedbackGain.gain.value = fb;
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = rate;
        const allNodes = [input, dry, wet, feedbackGain, lfo];
        // Create allpass filter chain
        const allpasses = [];
        const baseFreq = 1000;
        for (let i = 0; i < stages; i++) {
          const ap = ctx.createBiquadFilter();
          ap.type = 'allpass';
          ap.frequency.value = baseFreq + (i * 400);
          ap.Q.value = 0.5;
          const lfoDepthGain = ctx.createGain();
          lfoDepthGain.gain.value = depth * (baseFreq + i * 400);
          lfo.connect(lfoDepthGain);
          lfoDepthGain.connect(ap.frequency);
          allpasses.push(ap);
          allNodes.push(ap, lfoDepthGain);
        }
        lfo.start();
        // Chain allpasses
        input.connect(allpasses[0]);
        for (let i = 0; i < allpasses.length - 1; i++) {
          allpasses[i].connect(allpasses[i + 1]);
        }
        const lastAp = allpasses[allpasses.length - 1];
        lastAp.connect(feedbackGain);
        feedbackGain.connect(allpasses[0]);
        lastAp.connect(wet);
        const out = ctx.createGain();
        input.connect(dry);
        dry.connect(out);
        wet.connect(out);
        allNodes.push(out);
        return { input, output: out, nodes: allNodes };
      }
      if (type === 'flanger') {
        const rate = Number(params.rate || 0.3);
        const depthMs = Number(params.depth || 3) / 1000;
        const fb = Math.max(-0.95, Math.min(0.95, (Number(params.feedback || 40)) / 100));
        const mix = Math.max(0, Math.min(1, (Number(params.mix || 50)) / 100));
        const input = ctx.createGain();
        const dry = ctx.createGain();
        dry.gain.value = 1;
        const wet = ctx.createGain();
        wet.gain.value = mix;
        const del = ctx.createDelay(0.02);
        del.delayTime.value = 0.005;
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = rate;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = depthMs;
        lfo.connect(lfoGain);
        lfoGain.connect(del.delayTime);
        lfo.start();
        const feedbackGain = ctx.createGain();
        feedbackGain.gain.value = fb;
        const out = ctx.createGain();
        input.connect(dry);
        input.connect(del);
        del.connect(feedbackGain);
        feedbackGain.connect(del);
        del.connect(wet);
        dry.connect(out);
        wet.connect(out);
        return { input, output: out, nodes: [input, dry, wet, del, lfo, lfoGain, feedbackGain, out] };
      }
      if (type === 'tremolo') {
        const rate = Number(params.rate || 4);
        const depth = Math.max(0, Math.min(1, (Number(params.depth || 50)) / 100));
        const shape = Number(params.shape || 0);
        const input = ctx.createGain();
        const tremGain = ctx.createGain();
        tremGain.gain.value = 1;
        const lfo = ctx.createOscillator();
        lfo.type = shape <= 0.33 ? 'sine' : shape <= 0.66 ? 'triangle' : 'square';
        lfo.frequency.value = rate;
        const lfoDepth = ctx.createGain();
        lfoDepth.gain.value = depth * 0.5; // modulate between (1-depth/2) and (1+depth/2)
        lfo.connect(lfoDepth);
        lfoDepth.connect(tremGain.gain);
        lfo.start();
        input.connect(tremGain);
        return { input, output: tremGain, nodes: [input, tremGain, lfo, lfoDepth] };
      }
      if (type === 'distortion') {
        const driveDb = Number(params.drive || 20);
        const toneHz = Number(params.tone || 4000);
        const mix = Math.max(0, Math.min(1, (Number(params.mix || 50)) / 100));
        const input = ctx.createGain();
        const shaper = ctx.createWaveShaper();
        const driveAmount = Math.pow(10, driveDb / 20);
        const samples = 44100;
        const curve = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
          const x = (i * 2 / samples) - 1;
          curve[i] = Math.tanh(x * driveAmount);
        }
        shaper.curve = curve;
        shaper.oversample = '4x';
        const toneFilter = ctx.createBiquadFilter();
        toneFilter.type = 'lowpass';
        toneFilter.frequency.value = toneHz;
        const wet = ctx.createGain();
        wet.gain.value = mix;
        const dry = ctx.createGain();
        dry.gain.value = 1 - mix;
        const out = ctx.createGain();
        input.connect(shaper);
        shaper.connect(toneFilter);
        toneFilter.connect(wet);
        input.connect(dry);
        wet.connect(out);
        dry.connect(out);
        return { input, output: out, nodes: [input, shaper, toneFilter, wet, dry, out] };
      }
      if (type === 'expander') {
        // Expander: opposite of compressor — increases dynamic range below threshold
        // Simulated via DynamicsCompressor with inverted logic (low ratio, acting on quiet signals)
        const n = ctx.createDynamicsCompressor();
        n.threshold.value = Number(params.threshold || -40);
        n.ratio.value = 1 / Math.max(0.1, Number(params.ratio || 2)); // invert ratio for expansion
        n.attack.value = Number(params.attack || 0.005);
        n.release.value = Number(params.release || 0.1);
        n.knee.value = 6;
        return n;
      }
      if (type === 'ducking') {
        // Auto-level ducking — lowers volume based on threshold/amount
        const input = ctx.createGain();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = Number(params.threshold || -30);
        comp.ratio.value = 4;
        comp.attack.value = Number(params.attack || 0.01);
        comp.release.value = Number(params.release || 0.3);
        comp.knee.value = 6;
        const amountDb = -(Number(params.amount || 12));
        const makeupGain = ctx.createGain();
        makeupGain.gain.value = Math.pow(10, amountDb / 20);
        input.connect(comp);
        comp.connect(makeupGain);
        return { input, output: makeupGain, nodes: [input, comp, makeupGain] };
      }
      if (type === 'channel-eq') {
        const input = ctx.createGain();
        const nodes = [input];
        let prevNode = input;
        const bandDefs = [
          { key: 'hp',  fType: 'highpass' },
          { key: 'ls',  fType: 'lowshelf' },
          { key: 'lm',  fType: 'peaking' },
          { key: 'm',   fType: 'peaking' },
          { key: 'hm',  fType: 'peaking' },
          { key: 'hs',  fType: 'highshelf' },
          { key: 'lp',  fType: 'lowpass' }
        ];
        for (const bd of bandDefs) {
          if (!params[bd.key + '_on']) continue;
          if (bd.fType === 'highpass') {
            const slope = Number(params.hp_slope || 12);
            const passes = Math.max(1, Math.round(slope / 12));
            for (let p = 0; p < passes; p++) {
              const f = ctx.createBiquadFilter();
              f.type = 'highpass';
              f.frequency.value = Number(params.hp_freq || 80);
              f.Q.value = 0.707;
              prevNode.connect(f);
              prevNode = f;
              nodes.push(f);
            }
          } else if (bd.fType === 'lowpass') {
            const slope = Number(params.lp_slope || 12);
            const passes = Math.max(1, Math.round(slope / 12));
            for (let p = 0; p < passes; p++) {
              const f = ctx.createBiquadFilter();
              f.type = 'lowpass';
              f.frequency.value = Number(params.lp_freq || 18000);
              f.Q.value = 0.707;
              prevNode.connect(f);
              prevNode = f;
              nodes.push(f);
            }
          } else {
            const f = ctx.createBiquadFilter();
            f.type = bd.fType;
            f.frequency.value = Number(params[bd.key + '_freq'] || 1000);
            if (bd.fType === 'peaking' || bd.fType === 'lowshelf' || bd.fType === 'highshelf') {
              f.gain.value = Number(params[bd.key + '_gain'] || 0);
            }
            if (bd.fType === 'peaking') {
              f.Q.value = Number(params[bd.key + '_q'] || 1.0);
            }
            prevNode.connect(f);
            prevNode = f;
            nodes.push(f);
          }
        }
        // Output gain
        const outGain = ctx.createGain();
        outGain.gain.value = Math.pow(10, (Number(params.output_gain || 0)) / 20);
        prevNode.connect(outGain);
        nodes.push(outGain);
        return { input, output: outGain, nodes };
      }
      if (type === 'plugin-host') {
        // Placeholder node in renderer path; actual AU/VST hosting is handled by desktop backend.
        const n = ctx.createGain();
        n.gain.value = 1;
        return n;
      }
      return null;
    }

    function _pgmBuildSourceFxChain(ctx, src, inputNode) {
      const fxNodes = [];
      const fxRuntime = {};
      let tail = inputNode;
      const bypass = !!(src && src.config && src.config.fxBypass === true);
      const masterEnabled = !(src && src.config && src.config.fxMasterEnabled === false);
      if (bypass || !masterEnabled) {
        return { tail, fxNodes, fxRuntime };
      }
      const chain = _normalizeAudioFxStack(src && src.config ? src.config.audioFx : []);
      for (const fx of chain) {
        if (!fx || fx.enabled === false) continue;
        const node = _pgmCreateFxNode(ctx, fx);
        if (!node) continue;
        try {
          if (node.input && node.output) {
            tail.connect(node.input);
            tail = node.output;
            (node.nodes || []).forEach((n) => fxNodes.push(n));
            if (fx.id) fxRuntime[fx.id] = node;
          } else {
            tail.connect(node);
            tail = node;
            fxNodes.push(node);
            if (fx.id) fxRuntime[fx.id] = node;
          }
        } catch (_) {}
      }
      return { tail, fxNodes, fxRuntime };
    }

    function _getPgmAudioCtx() {
      if (!_pgmAudioCtx || _pgmAudioCtx.state === 'closed') {
        const latencyHint = _pgmResolveLatencyHint();
        const preferredRate = _pgmResolveSampleRate();
        try {
          _pgmAudioCtx = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint,
            sampleRate: preferredRate
          });
        } catch (_) {
          try {
            _pgmAudioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: preferredRate });
          } catch (_) {
            _pgmAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            _pgmUltraLowLatencyState = _pgmUltraLowLatencyEnabled ? 'unsupported' : 'inactive';
          }
        }
        _pgmResetGraphRefsForRebuild();
        _pgmBindAudioCtxStateListener(_pgmAudioCtx);
        if (_pgmUltraLowLatencyEnabled && _pgmUltraLowLatencyState !== 'unsupported') {
          _pgmUltraLowLatencyState = 'active';
        }
        _pgmUpdateUllStatusUi();
      }
      if (_pgmAudioCtx.state === 'suspended') _pgmAudioCtx.resume().catch(() => {});
      return _pgmAudioCtx;
    }

    function _pgmGetOutputAudioEl() {
      if (_pgmHeadphoneAudioEl && _pgmHeadphoneAudioEl.isConnected) return _pgmHeadphoneAudioEl;
      let el = document.getElementById('pgm-monitor-output-audio');
      if (!el) {
        el = document.createElement('audio');
        el.id = 'pgm-monitor-output-audio';
        el.autoplay = true;
        el.playsInline = true;
        el.style.display = 'none';
        document.body.appendChild(el);
      }
      _pgmHeadphoneAudioEl = el;
      return el;
    }

    function _pgmLoadOutputDevicePreference() {
      if (_pgmOutputDeviceId) return;
      try {
        _pgmOutputDeviceId = localStorage.getItem(_PGM_OUTPUT_DEVICE_STORAGE_KEY) || '';
      } catch (e) {
        _pgmOutputDeviceId = '';
      }
    }

    function _pgmSaveOutputDevicePreference() {
      try {
        localStorage.setItem(_PGM_OUTPUT_DEVICE_STORAGE_KEY, _pgmOutputDeviceId || '');
      } catch (e) {}
    }

    function _pgmGetNormalizedMonitoringMode(mode) {
      const v = String(mode || '').trim().toLowerCase();
      if (v === 'monitor-only' || v === 'monitor-and-output' || v === 'monitor-off') return v;
      return 'monitor-off';
    }

    function _pgmSyncMonitoringModeUi() {
      const el = document.getElementById('pgm-monitor-mode-select');
      if (!el) return;
      el.value = _pgmGetNormalizedMonitoringMode(_pgmMonitoringMode);
    }

    function _pgmApplyMonitoringModeRouting() {
      const mode = _pgmGetNormalizedMonitoringMode(_pgmMonitoringMode);
      const monitorEnabled = mode !== 'monitor-off';
      const outputEnabled = mode !== 'monitor-only';
      if (_pgmStreamGain) {
        const target = outputEnabled ? 1 : 0;
        try {
          const now = _pgmAudioCtx ? _pgmAudioCtx.currentTime : 0;
          _pgmStreamGain.gain.cancelScheduledValues(now);
          // Ultra-fast 3ms ramp avoids clicks while minimising latency
          _pgmStreamGain.gain.setTargetAtTime(target, now, 0.003);
        } catch (_) {
          _pgmStreamGain.gain.value = target;
        }
      }
      if (_pgmHeadphoneGain) {
        const base = _pgmMutedMonitor ? 0 : _pgmMonitorVolume;
        const target = monitorEnabled ? base : 0;
        try {
          const now = _pgmAudioCtx ? _pgmAudioCtx.currentTime : 0;
          _pgmHeadphoneGain.gain.cancelScheduledValues(now);
          _pgmHeadphoneGain.gain.setTargetAtTime(target, now, 0.003);
        } catch (_) {
          _pgmHeadphoneGain.gain.value = target;
        }
      }
      const btn = document.getElementById('pgm-mute-monitor');
      if (btn) {
        btn.disabled = !monitorEnabled;
        btn.style.opacity = monitorEnabled ? '1' : '0.48';
        btn.title = monitorEnabled
          ? (_pgmMutedMonitor ? 'Unmute monitor output' : 'Mute monitor output')
          : 'Monitoring disabled by mode';
      }
      _pgmSyncMonitoringModeUi();
      // Route media <video> elements to the appropriate audio device
      _pgmRouteMediaSourcesToMonitorDevice();
    }

    /**
     * Route media source <video> elements to the monitoring device via setSinkId.
     *
     * In Monitor-Only mode the user wants audio ONLY from the monitoring path,
     * so we redirect media elements to the chosen monitoring device (or default
     * if none is selected).  In all other modes the video plays on the default
     * device as usual.
     */
    function _pgmRouteMediaSourcesToMonitorDevice() {
      const mode = _pgmGetNormalizedMonitoringMode(_pgmMonitoringMode);
      // Only reroute when monitoring is the sole path (monitor-only)
      const wantMonitorDevice = (mode === 'monitor-only') && !!_pgmOutputDeviceId;
      const targetDeviceId = wantMonitorDevice ? _pgmOutputDeviceId : '';
      Object.values(_mediaSourceVideoEls).forEach(vid => {
        if (vid && typeof vid.setSinkId === 'function') {
          const current = (typeof vid.sinkId === 'string') ? vid.sinkId : '';
          if (current !== targetDeviceId) {
            vid.setSinkId(targetDeviceId).catch(() => {});
          }
        }
      });
    }

    function pgmChangeMonitoringMode(mode) {
      _pgmMonitoringMode = _pgmGetNormalizedMonitoringMode(mode);
      _pgmEnsureGraph();
      _pgmApplyMonitoringModeRouting();
      if (typeof saveToStorageDebounced === 'function') saveToStorageDebounced();
    }

    async function _pgmAttachHeadphoneOutput() {
      if (!_pgmHeadphoneDest) return;
      const el = _pgmGetOutputAudioEl();
      if (!el) return;
      if (el.srcObject !== _pgmHeadphoneDest.stream) {
        el.srcObject = _pgmHeadphoneDest.stream;
      }
      _pgmLoadOutputDevicePreference();
      if (typeof el.setSinkId === 'function') {
        try {
          await el.setSinkId(_pgmOutputDeviceId || '');
        } catch (e) {
          if (_pgmOutputDeviceId) {
            _pgmOutputDeviceId = '';
            _pgmSaveOutputDevicePreference();
            try { await el.setSinkId(''); } catch (err) {}
          }
        }
      }
      el.play().catch(() => {});
    }

    async function _pgmSetAudioContextOutputDevice(deviceId = '') {
      const ctx = _pgmAudioCtx;
      if (!ctx || typeof ctx.setSinkId !== 'function') return false;
      try {
        // Use explicit "default" to reset any previously selected output device.
        await ctx.setSinkId(deviceId || 'default');
        return true;
      } catch (_) {
        return false;
      }
    }

    /**
     * Route headphone/monitor output.
     *
     * OBS-like architecture: media sources play audio natively from the
     * <video> element to the default output device (like OBS's main output).
     * The program bus (merger) carries captureStream audio for:
     *   - Metering / analysers
     *   - Streaming / recording (StreamDest)
     *   - Headphone monitoring
     *
     * Routing strategy for lowest latency:
     *
     * 1) Custom output device selected:
     *    - Preferred: AudioContext.setSinkId + direct ctx.destination (lowest latency).
     *    - Fallback: MediaStreamDest → <audio>.setSinkId (adds ~one extra buffer).
     *
     * 2) Default device, monitoring enabled → Route _pgmMonitorMixer directly to
     *    ctx.destination. This is the ZERO-EXTRA-LATENCY path — audio goes
     *    straight from the WebAudio graph to the OS audio output with no
     *    intermediate MediaStream encoding. Only non-media sources are wired
     *    through _pgmMonitorMixer, so there's no double-audio with <video>.
     *
     * 3) Monitoring off → Neither path connected.
     */
    function _pgmRouteHeadphoneOutput() {
      if (!_pgmHeadphoneGain || !_pgmAudioCtx) return;
      const ctx = _pgmAudioCtx;
      const usingCustomDevice = !!_pgmOutputDeviceId;
      const mode = _pgmGetNormalizedMonitoringMode(_pgmMonitoringMode);
      const monitorEnabled = mode !== 'monitor-off';

      // Disconnect all paths first
      try { _pgmHeadphoneGain.disconnect(ctx.destination); } catch (e) {}
      try { _pgmHeadphoneGain.disconnect(_pgmHeadphoneDest); } catch (e) {}

      if (usingCustomDevice) {
        // Lowest-latency custom-device route when supported: set sink on AudioContext.
        // Falls back to MediaStreamDest + <audio>.setSinkId where needed.
        _pgmSetAudioContextOutputDevice(_pgmOutputDeviceId).then((ok) => {
          const stillCustom = !!_pgmOutputDeviceId;
          const stillMonitorEnabled = _pgmGetNormalizedMonitoringMode(_pgmMonitoringMode) !== 'monitor-off';
          if (!stillCustom || !stillMonitorEnabled) return;
          if (ok) {
            try { _pgmHeadphoneGain.connect(ctx.destination); } catch (_) {}
            const el = document.getElementById('pgm-monitor-output-audio');
            if (el) { el.pause(); el.srcObject = null; }
            return;
          }
          _pgmHeadphoneGain.connect(_pgmHeadphoneDest);
          _pgmAttachHeadphoneOutput().catch(() => {});
        });
      } else if (monitorEnabled) {
        // ULTRA-LOW LATENCY: Route directly to AudioContext destination.
        // Only non-media sources flow through _pgmMonitorMixer → _pgmHeadphoneGain,
        // so no double audio. This eliminates the MediaStream encode/decode round-trip
        // (~10-30ms saving depending on OS buffer config).
        _pgmSetAudioContextOutputDevice('');
        _pgmHeadphoneGain.connect(ctx.destination);
        // Detach the <audio> element — not needed for direct routing
        const el = document.getElementById('pgm-monitor-output-audio');
        if (el) { el.pause(); el.srcObject = null; }
      } else {
        // Monitoring off: disconnect everything
        const el = document.getElementById('pgm-monitor-output-audio');
        if (el) { el.pause(); el.srcObject = null; }
      }
    }

    async function refreshPgmOutputDevices() {
      const sel = document.getElementById('pgm-output-device-select');
      if (!sel) return;
      _pgmLoadOutputDevicePreference();
      const outputAudioEl = _pgmGetOutputAudioEl();
      const sinkSupported = !!(outputAudioEl && typeof outputAudioEl.setSinkId === 'function');
      if (!(navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function')) {
        sel.innerHTML = '<option value="">System Default</option>';
        sel.disabled = true;
        sel.title = 'Audio output selection is not supported in this environment';
        return;
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputs = devices.filter((d) => d.kind === 'audiooutput');
        const hasSaved = !!_pgmOutputDeviceId && outputs.some((d) => d.deviceId === _pgmOutputDeviceId);
        if (!hasSaved) _pgmOutputDeviceId = '';
        let html = '<option value="">System Default</option>';
        outputs.forEach((d, idx) => {
          const label = d.label || `Output ${idx + 1}`;
          html += `<option value="${esc(d.deviceId || '')}">${esc(label)}</option>`;
        });
        sel.innerHTML = html;
        sel.value = _pgmOutputDeviceId || '';
        sel.disabled = !sinkSupported;
        sel.title = sinkSupported ? 'Select monitor output device' : 'Output switching is not supported in this environment';
      } catch (e) {
        sel.innerHTML = '<option value="">System Default</option>';
        sel.value = '';
        sel.disabled = !sinkSupported;
      }
    }

    async function pgmChangeOutputDevice() {
      const sel = document.getElementById('pgm-output-device-select');
      if (!sel) return;
      _pgmOutputDeviceId = sel.value || '';
      _pgmSaveOutputDevicePreference();
      _pgmEnsureGraph();
      _pgmRouteHeadphoneOutput();
      // Also update media element setSinkId in case we're in monitor-only mode
      _pgmRouteMediaSourcesToMonitorDevice();
    }

    function _pgmEnsureGraph() {
      const ctx = _getPgmAudioCtx();
      if (_pgmMerger) {
        _pgmRouteHeadphoneOutput();
        _pgmApplyMonitoringModeRouting();
        _pgmUpdateStreamVolLabel();
        return ctx;
      }
      // Create mix bus (gain node) → splitter → analysers
      _pgmMerger = ctx.createGain();
      _pgmMerger.gain.value = 1;
      _pgmSplitter = ctx.createChannelSplitter(2);
      _pgmAnalyserL = ctx.createAnalyser();
      _pgmAnalyserR = ctx.createAnalyser();
      _pgmAnalyserL.fftSize = 512;
      _pgmAnalyserR.fftSize = 512;
      _pgmAnalyserL.smoothingTimeConstant = 0.55;
      _pgmAnalyserR.smoothingTimeConstant = 0.55;
      // No master compressor or trim — pass audio through clean so per-source
      // FX chains and the user's own effects are the only processing applied.
      // Headphone / monitor output — volume controlled by the monitor slider
      _pgmHeadphoneGain = ctx.createGain();
      _pgmHeadphoneGain.gain.value = _pgmMutedMonitor ? 0 : _pgmMonitorVolume;
      _pgmHeadphoneDest = ctx.createMediaStreamDestination();
      // Stream output — always full volume (individual layer gains control the mix)
      _pgmStreamDest = ctx.createMediaStreamDestination();
      _pgmStreamGain = ctx.createGain();
      _pgmStreamGain.gain.value = 1;
      // Monitor mixer — only non-media sources feed into this.
      // Media source audio plays natively from the <video> element;
      // routing it through WebAudio headphones too would double-audio.
      _pgmMonitorMixer = ctx.createGain();
      _pgmMonitorMixer.gain.value = 1;
      // Clean master path: merger → stream output (no compressor/trim)
      // If master FX are configured, wire them in
      _pgmMerger.connect(_pgmStreamGain);
      // Wire: monitor bus → splitter → analysers for meter response
      _pgmMerger.connect(_pgmSplitter);
      _pgmSplitter.connect(_pgmAnalyserL, 0);
      _pgmSplitter.connect(_pgmAnalyserR, 1);
      // Headphone monitor path — from monitor mixer (non-media sources only).
      _pgmMonitorMixer.connect(_pgmHeadphoneGain);
      // Stream path gated by monitoring mode.
      _pgmStreamGain.connect(_pgmStreamDest);

      // ── Send / Return Bus System ──
      // Each bus: inputGain → [optional FX chain] → outputGain → merger
      // Source sends: source.gain → sendGain(per-bus) → bus.inputGain
      _promixBusNodes = {};
      _promixBuses.forEach(bus => {
        const inputGain = ctx.createGain();
        inputGain.gain.value = 1;
        const outputGain = ctx.createGain();
        outputGain.gain.value = bus.muted ? 0 : (bus.volume || 1);
        const splitter = ctx.createChannelSplitter(2);
        const analyserL = ctx.createAnalyser();
        const analyserR = ctx.createAnalyser();
        analyserL.fftSize = 256;
        analyserR.fftSize = 256;
        analyserL.smoothingTimeConstant = 0.4;
        analyserR.smoothingTimeConstant = 0.4;
        // Do NOT connect inputGain → outputGain by default.
        // An empty bus (no FX) should produce no output — the dry signal
        // already reaches the merger directly from the source gain node.
        // Bus output → main merger + monitor mixer
        outputGain.connect(_pgmMerger);
        if (_pgmMonitorMixer) outputGain.connect(_pgmMonitorMixer);
        // Meters: output → splitter → analysers
        outputGain.connect(splitter);
        splitter.connect(analyserL, 0);
        splitter.connect(analyserR, 1);
        _promixBusNodes[bus.id] = {
          inputGain,
          outputGain,
          fxNodes: [],
          splitter,
          analyserL,
          analyserR,
          analyserBufL: new Float32Array(analyserL.fftSize),
          analyserBufR: new Float32Array(analyserR.fftSize),
        };
        // Build FX chain if bus has effects
        if (bus.fxChain && bus.fxChain.length) {
          _promixRebuildBusFxChain(bus.id);
        }
      });

      // Build master FX chain if any are configured
      if (_promixMasterFx.length > 0) {
        _promixRebuildMasterFxChain();
      }

      _pgmRouteHeadphoneOutput();
      _pgmApplyMonitoringModeRouting();
      _pgmUpdateStreamVolLabel();
      return ctx;
    }

    function _pgmApplyMonitorGain() {
      _pgmApplyMonitoringModeRouting();
    }

    function _pgmUpdateStreamVolLabel() {
      const slider = document.getElementById('pgm-stream-volume');
      if (slider) slider.value = String(Math.round(_pgmMonitorVolume * 100));
      const label = document.getElementById('pgm-stream-vol-label');
      if (!label) return;
      if (_pgmMonitorVolume <= 0.0001) {
        label.textContent = '-inf dB';
        return;
      }
      const db = 20 * Math.log10(_pgmMonitorVolume);
      const safeDb = Math.max(-60, Math.min(12, db));
      label.textContent = `${safeDb.toFixed(1)} dB`;
    }

    function pgmSetMonitorVolumeFromUi(value) {
      const num = Math.max(0, Math.min(100, Number(value) || 0));
      _pgmMonitorVolume = num / 100;
      _pgmEnsureGraph();
      _pgmApplyMonitorGain();
      _pgmUpdateStreamVolLabel();
    }

    function _pgmBuildSourceInputRouteChain(ctx, sourceNode, srcData, stream) {
      const route = _getSourceInputChannelRoute(srcData);
      const streamChannelCount = _getStreamAudioChannelCount(stream);
      if (srcData && srcData.config && streamChannelCount > 0) {
        const prevCount = Number(srcData.config.inputChannelCount);
        if (!Number.isFinite(prevCount) || prevCount !== streamChannelCount) {
          srcData.config.inputChannelCount = streamChannelCount;
        }
      }
      const channelCount = _getSourceInputChannelCount(srcData);
      const left = Math.max(0, Math.min(channelCount - 1, route.left));
      const right = Math.max(0, Math.min(channelCount - 1, route.right));
      if (left === 0 && right === 1 && channelCount <= 2) {
        return { left, right, channelCount, tail: sourceNode, nodes: [] };
      }
      const splitOutCount = Math.max(2, channelCount, left + 1, right + 1);
      const splitter = ctx.createChannelSplitter(splitOutCount);
      const merger = ctx.createChannelMerger(2);
      sourceNode.connect(splitter);
      splitter.connect(merger, left, 0);
      splitter.connect(merger, right, 1);
      return {
        left,
        right,
        channelCount,
        tail: merger,
        nodes: [splitter, merger]
      };
    }

    function _pgmBuildSourceInputModeChain(ctx, sourceNode, srcData) {
      const mode = _getSourceInputMode(srcData);
      if (mode !== 'mono') {
        return { mode: 'stereo', tail: sourceNode, nodes: [] };
      }
      const splitter = ctx.createChannelSplitter(2);
      const monoGainL = ctx.createGain();
      const monoGainR = ctx.createGain();
      const monoSum = ctx.createGain();
      const merger = ctx.createChannelMerger(2);
      monoGainL.gain.value = 0.5;
      monoGainR.gain.value = 0.5;
      sourceNode.connect(splitter);
      splitter.connect(monoGainL, 0);
      splitter.connect(monoGainR, 1);
      monoGainL.connect(monoSum);
      monoGainR.connect(monoSum);
      monoSum.connect(merger, 0, 0);
      monoSum.connect(merger, 0, 1);
      return { mode: 'mono', tail: merger, nodes: [splitter, monoGainL, monoGainR, monoSum, merger] };
    }

    function _pgmSetParamSmooth(param, value, timeConstant = 0.012) {
      if (!param) return;
      const num = Number(value);
      if (!Number.isFinite(num)) return;
      try {
        const ctx = _pgmAudioCtx;
        const now = ctx ? ctx.currentTime : 0;
        param.cancelScheduledValues(now);
        param.setTargetAtTime(num, now, Math.max(0.004, Number(timeConstant) || 0.012));
      } catch (_) {
        try { param.value = num; } catch (_) {}
      }
    }

    function _pgmBuildSourceSpatialChain(ctx, sourceNode, srcData) {
      const pan = _getSourcePan(srcData);
      const width = _getSourceWidth(srcData);
      const panNorm = Math.max(-1, Math.min(1, pan / 100));
      const widthNorm = Math.max(0, Math.min(2, width / 100));

      // Mid/Side width then equal-power pan (balance style for stereo, pan for mono-fed stereo).
      const splitter = ctx.createChannelSplitter(2);
      const midFromL = ctx.createGain();
      const midFromR = ctx.createGain();
      const midSum = ctx.createGain();
      const sideFromL = ctx.createGain();
      const sideFromR = ctx.createGain();
      const sideSum = ctx.createGain();
      const sideWidth = ctx.createGain();
      const sideToRightInvert = ctx.createGain();
      const leftSum = ctx.createGain();
      const rightSum = ctx.createGain();
      const panL = ctx.createGain();
      const panR = ctx.createGain();
      const merger = ctx.createChannelMerger(2);

      midFromL.gain.value = 0.5;
      midFromR.gain.value = 0.5;
      sideFromL.gain.value = 0.5;
      sideFromR.gain.value = -0.5;
      sideWidth.gain.value = widthNorm;
      sideToRightInvert.gain.value = -1;
      const panPos = (panNorm + 1) * 0.5;
      panL.gain.value = Math.cos(panPos * Math.PI * 0.5);
      panR.gain.value = Math.sin(panPos * Math.PI * 0.5);

      sourceNode.connect(splitter);
      splitter.connect(midFromL, 0);
      splitter.connect(midFromR, 1);
      splitter.connect(sideFromL, 0);
      splitter.connect(sideFromR, 1);
      midFromL.connect(midSum);
      midFromR.connect(midSum);
      sideFromL.connect(sideSum);
      sideFromR.connect(sideSum);
      sideSum.connect(sideWidth);
      midSum.connect(leftSum);
      midSum.connect(rightSum);
      sideWidth.connect(leftSum);
      sideWidth.connect(sideToRightInvert);
      sideToRightInvert.connect(rightSum);
      leftSum.connect(panL);
      rightSum.connect(panR);
      panL.connect(merger, 0, 0);
      panR.connect(merger, 0, 1);

      return {
        pan,
        width,
        tail: merger,
        nodes: [splitter, midFromL, midFromR, midSum, sideFromL, sideFromR, sideSum, sideWidth, sideToRightInvert, leftSum, rightSum, panL, panR, merger],
        runtime: { sideWidth, panL, panR }
      };
    }

    function _pgmApplySourceSpatial(entry, pan, width) {
      if (!entry) return;
      const normPan = _normalizeSourcePan(pan);
      const normWidth = _normalizeSourceWidth(width);
      const runtime = entry.spatialRuntime || {};
      const widthNorm = Math.max(0, Math.min(2, normWidth / 100));
      const panNorm = Math.max(-1, Math.min(1, normPan / 100));
      const panPos = (panNorm + 1) * 0.5;
      const leftGain = Math.cos(panPos * Math.PI * 0.5);
      const rightGain = Math.sin(panPos * Math.PI * 0.5);
      _pgmSetParamSmooth(runtime.sideWidth && runtime.sideWidth.gain, widthNorm, 0.012);
      _pgmSetParamSmooth(runtime.panL && runtime.panL.gain, leftGain, 0.012);
      _pgmSetParamSmooth(runtime.panR && runtime.panR.gain, rightGain, 0.012);
      entry.pan = normPan;
      entry.width = normWidth;
    }

    function _pgmConnectSource(sourceId, stream, opts = {}) {
      _pgmDisconnectSource(sourceId);
      if (!stream || !stream.active) return;
      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) return;
      try {
        _ctrlHydrateSourceState(sourceId);
        const ctx = _pgmEnsureGraph();
        const srcData = _getSourceById(sourceId);
        const isMediaSource = !!(srcData && srcData.type === 'media-source');
        // Uniform path for all sources — OBS-like: createMediaStreamSource.
        // No bridge tap; media sources use captureStream() which provides
        // a standard MediaStream.
        const src = ctx.createMediaStreamSource(stream);
        const inputRouteChain = _pgmBuildSourceInputRouteChain(ctx, src, srcData, stream);
        const inputModeChain = _pgmBuildSourceInputModeChain(ctx, inputRouteChain.tail, srcData);
        const spatialChain = _pgmBuildSourceSpatialChain(ctx, inputModeChain.tail, srcData);
        const fxChain = _pgmBuildSourceFxChain(ctx, srcData, spatialChain.tail);
        const monitorBypassFx = _pgmShouldBypassFxForMonitor(srcData);
        const gain = ctx.createGain();
        let monitorTapGain = null;
        const splitter = ctx.createChannelSplitter(2);
        const analyserL = ctx.createAnalyser();
        const analyserR = ctx.createAnalyser();
        analyserL.fftSize = 256;
        analyserR.fftSize = 256;
        analyserL.smoothingTimeConstant = 0.4;
        analyserR.smoothingTimeConstant = 0.4;
        // For media sources, vid.volume already carries the user gain (0-1).
        // Program bus gain is 1 unless user boosts above 100%.
        // For other sources, program bus gain is the full effective gain.
        const rawGain = _ctrlGetEffectiveMixGain(sourceId);
        const targetGain = isMediaSource ? Math.max(1, rawGain) : rawGain;
        if (opts && opts.rampIn) {
          gain.gain.value = 0.0001;
          try {
            const now = ctx.currentTime || 0;
            gain.gain.cancelScheduledValues(now);
            // Ultra-fast 2ms ramp-in — minimal anti-click, near-instant
            gain.gain.setTargetAtTime(targetGain, now, 0.002);
          } catch (_) {
            gain.gain.value = targetGain;
          }
        } else {
          gain.gain.value = targetGain;
        }
        fxChain.tail.connect(gain);
        // Direct path: source gain → main merger (dry signal always goes through)
        gain.connect(_pgmMerger);
        if (!isMediaSource && _pgmMonitorMixer) {
          if (monitorBypassFx) {
            monitorTapGain = ctx.createGain();
            if (opts && opts.rampIn) {
              monitorTapGain.gain.value = 0.0001;
              try {
                const now = ctx.currentTime || 0;
                monitorTapGain.gain.cancelScheduledValues(now);
                monitorTapGain.gain.setTargetAtTime(rawGain, now, 0.002);
              } catch (_) {
                monitorTapGain.gain.value = rawGain;
              }
            } else {
              monitorTapGain.gain.value = rawGain;
            }
            spatialChain.tail.connect(monitorTapGain);
            monitorTapGain.connect(_pgmMonitorMixer);
          } else {
            gain.connect(_pgmMonitorMixer);
          }
        }
        // Send / Return: create per-bus send gain nodes
        const sendGains = {};
        const sends = _promixGetSends(sourceId);
        _promixBuses.forEach(bus => {
          const busNodes = _promixBusNodes[bus.id];
          if (!busNodes) return;
          const sendGain = ctx.createGain();
          const send = sends.find(s => s.busId === bus.id);
          sendGain.gain.value = send ? send.level : 0;
          gain.connect(sendGain);
          sendGain.connect(busNodes.inputGain);
          sendGains[bus.id] = sendGain;
        });
        gain.connect(splitter);
        splitter.connect(analyserL, 0);
        splitter.connect(analyserR, 1);
        _pgmSources[sourceId] = {
          node: src,
          isMediaSource: isMediaSource,
          inputRouteLeft: inputRouteChain.left,
          inputRouteRight: inputRouteChain.right,
          inputRouteChannelCount: inputRouteChain.channelCount,
          inputRouteNodes: inputRouteChain.nodes,
          inputMode: inputModeChain.mode,
          inputModeNodes: inputModeChain.nodes,
          pan: spatialChain.pan,
          width: spatialChain.width,
          spatialNodes: spatialChain.nodes,
          spatialRuntime: spatialChain.runtime || {},
          monitorBypassFx,
          monitorTapGain,
          gain,
          sendGains,
          splitter,
          analyserL,
          analyserR,
          analyserBufL: new Float32Array(analyserL.fftSize),
          analyserBufR: new Float32Array(analyserR.fftSize),
          fxNodes: fxChain.fxNodes,
          fxRuntime: fxChain.fxRuntime || {}
        };
      } catch (e) {
        console.warn('pgm meter connect failed:', sourceId, e);
      }
      _pgmRenderMixDebugPanel(true);
    }

    function _pgmDisconnectSource(sourceId) {
      const entry = _pgmSources[sourceId];
      if (entry) {
        try { entry.node.disconnect(); } catch (e) {}
        if (Array.isArray(entry.inputRouteNodes)) {
          entry.inputRouteNodes.forEach((n) => { try { n.disconnect(); } catch (_) {} });
        }
        if (Array.isArray(entry.inputModeNodes)) {
          entry.inputModeNodes.forEach((n) => { try { n.disconnect(); } catch (_) {} });
        }
        if (Array.isArray(entry.spatialNodes)) {
          entry.spatialNodes.forEach((n) => { try { n.disconnect(); } catch (_) {} });
        }
        if (Array.isArray(entry.fxNodes)) {
          entry.fxNodes.forEach((n) => { try { n.disconnect(); } catch (_) {} });
        }
        try { if (entry.monitorTapGain) entry.monitorTapGain.disconnect(); } catch (_) {}
        // Disconnect send gain nodes
        if (entry.sendGains) {
          Object.values(entry.sendGains).forEach(sg => { try { sg.disconnect(); } catch (_) {} });
        }
        try { if (entry.splitter) entry.splitter.disconnect(); } catch (e) {}
        try { if (entry.analyserL) entry.analyserL.disconnect(); } catch (e) {}
        try { if (entry.analyserR) entry.analyserR.disconnect(); } catch (e) {}
        // Disconnect from both the main merger and the monitor mixer
        try { entry.gain.disconnect(); } catch (e) {}
        delete _pgmSources[sourceId];
      }
      _pgmRenderMixDebugPanel(true);
    }

    function _pgmDisconnectAllSources() {
      Object.keys(_pgmSources).forEach(id => _pgmDisconnectSource(id));
    }

    function _pgmDbFromRms(rms) {
      return 20 * Math.log10(Math.max(1e-6, rms));
    }
    function _pgmNormFromDb(db) {
      return Math.max(0, (Math.min(0, db) + 60) / 60);
    }

    const _pgmBufL = new Float32Array(512);
    const _pgmBufR = new Float32Array(512);
    let _pgmMeterElCache = null;

    function _pgmDbFromAnalyser(entry) {
      if (!entry || !entry.analyserL || !entry.analyserR || !entry.analyserBufL || !entry.analyserBufR) return -60;
      entry.analyserL.getFloatTimeDomainData(entry.analyserBufL);
      entry.analyserR.getFloatTimeDomainData(entry.analyserBufR);
      let sumL = 0;
      let sumR = 0;
      for (let i = 0; i < entry.analyserBufL.length; i++) {
        sumL += entry.analyserBufL[i] * entry.analyserBufL[i];
      }
      for (let i = 0; i < entry.analyserBufR.length; i++) {
        sumR += entry.analyserBufR[i] * entry.analyserBufR[i];
      }
      const rmsL = Math.sqrt(sumL / entry.analyserBufL.length);
      const rmsR = Math.sqrt(sumR / entry.analyserBufR.length);
      return Math.max(-60, _pgmDbFromRms(Math.max(rmsL, rmsR)));
    }

    function _pgmRenderMixDebugPanel(force = false) {
      if (!_PGM_DEV_MIX_DEBUG) return;
      const panel = document.getElementById('pgm-mix-debug-panel');
      const rowsEl = document.getElementById('pgm-mix-debug-rows');
      if (!panel || !rowsEl) return;
      panel.style.display = '';
      const now = performance.now();
      if (!force && (now - _pgmDevMixDebugLastPaint) < _PGM_DEV_MIX_DEBUG_PAINT_MS) return;
      _pgmDevMixDebugLastPaint = now;

      const scene = _activeScene();
      if (!scene || !Array.isArray(scene.sources) || !scene.sources.length) {
        rowsEl.innerHTML = 'No active audio sources.';
        return;
      }
      const activeAudioTypes = new Set(['audio-input', 'camera', 'media-source', 'ndi']);
      const rows = [];
      scene.sources.forEach((src) => {
        if (!src || src.visible === false || !activeAudioTypes.has(src.type)) return;
        const id = String(src.id || '');
        if (!id) return;
        const entry = _pgmSources[id];
        const muted = _ctrlMutedSources.has(id);
        const gainVal = entry && entry.gain ? Number(entry.gain.gain.value || 0) : 0;
        const db = entry ? _pgmDbFromAnalyser(entry) : -60;
        const status = muted ? '<span class="pgm-mix-debug-muted">MUTED</span>' : `${db > -59 ? `${db.toFixed(1)} dB` : '-inf dB'}`;
        rows.push(
          `<div class="pgm-mix-debug-row"><span class="pgm-mix-debug-name">${esc(src.name || id)}</span><span class="pgm-mix-debug-level">${status} · gain ${gainVal.toFixed(2)}</span></div>`
        );
      });
      rowsEl.innerHTML = rows.length ? rows.join('') : 'No active audio sources.';
    }

    function _pgmAnimateMeter() {
      if (!_pgmAnalyserL || !_pgmAnalyserR) { _pgmRaf = 0; return; }
      _pgmAnalyserL.getFloatTimeDomainData(_pgmBufL);
      _pgmAnalyserR.getFloatTimeDomainData(_pgmBufR);
      let sumL = 0, sumR = 0;
      for (let i = 0; i < _pgmBufL.length; i++) {
        sumL += _pgmBufL[i] * _pgmBufL[i];
        sumR += _pgmBufR[i] * _pgmBufR[i];
      }
      let normL = _pgmNormFromDb(_pgmDbFromRms(Math.sqrt(sumL / _pgmBufL.length)));
      let normR = _pgmNormFromDb(_pgmDbFromRms(Math.sqrt(sumR / _pgmBufR.length)));
      if (normR < 0.003 && normL > 0.01) normR = normL;
      _pgmDisplayL = _meterSmooth(_pgmDisplayL, normL);
      _pgmDisplayR = _meterSmooth(_pgmDisplayR, normR);
      _pgmPeakL = Math.max(_pgmDisplayL, (_pgmPeakL || 0) - _meterBallistics.peakFall);
      _pgmPeakR = Math.max(_pgmDisplayR, (_pgmPeakR || 0) - _meterBallistics.peakFall);
      if (!_pgmMeterElCache || !_pgmMeterElCache.fillL || !_pgmMeterElCache.fillL.isConnected) {
        _pgmMeterElCache = {
          fillL: document.getElementById('pgm-fill-l'),
          fillR: document.getElementById('pgm-fill-r'),
          peakL: document.getElementById('pgm-peak-l'),
          peakR: document.getElementById('pgm-peak-r')
        };
      }
      const { fillL, fillR, peakL, peakR } = _pgmMeterElCache;
      if (fillL) fillL.style.height = Math.round(_pgmDisplayL * 100) + '%';
      if (fillR) fillR.style.height = Math.round(_pgmDisplayR * 100) + '%';
      if (peakL) peakL.style.bottom = Math.round(_pgmPeakL * 100) + '%';
      if (peakR) peakR.style.bottom = Math.round(_pgmPeakR * 100) + '%';
      _pgmRenderMixDebugPanel(false);
      _pgmRaf = requestAnimationFrame(_pgmAnimateMeter);
    }

    function _pgmStartMeter() {
      if (!_pgmRaf) _pgmRaf = requestAnimationFrame(_pgmAnimateMeter);
    }

    function _pgmStopMeter() {
      if (_pgmRaf) { cancelAnimationFrame(_pgmRaf); _pgmRaf = 0; }
      _pgmDisplayL = 0;
      _pgmDisplayR = 0;
      _pgmPeakL = 0;
      _pgmPeakR = 0;
      const fillL = document.getElementById('pgm-fill-l');
      const fillR = document.getElementById('pgm-fill-r');
      const peakL = document.getElementById('pgm-peak-l');
      const peakR = document.getElementById('pgm-peak-r');
      if (fillL) fillL.style.height = '0%';
      if (fillR) fillR.style.height = '0%';
      if (peakL) peakL.style.bottom = '0%';
      if (peakR) peakR.style.bottom = '0%';
      _pgmRenderMixDebugPanel(true);
    }

    /** Sync master output meter connections to match _activeStreams */
    function _pgmSyncSources() {
      const scene = _activeScene();
      if (!scene) {
        _pgmDisconnectAllSources();
        _pgmStopMeter();
        return;
      }
      const activeAudioTypes = new Set(['audio-input', 'camera', 'media-source', 'ndi']);
      const wantedIds = new Set();
      scene.sources.forEach(src => {
        if (src.visible !== false && activeAudioTypes.has(src.type)) {
          _ctrlHydrateSourceState(src.id);
          // For NDI sources, prefer the dedicated audio stream over
          // _activeStreams (which holds the video camera stream).
          let stream = _activeStreams[src.id];
          if (src.type === 'ndi') {
            const ndiAudio = _ndiAudioStreams[src.id];
            if (ndiAudio && ndiAudio.active && ndiAudio.getAudioTracks().length) {
              stream = ndiAudio;
            }
          }
          if (stream && stream.active && stream.getAudioTracks().length) {
            _ctrlApplyMuteToStream(src.id, stream);
            wantedIds.add(src.id);
            if (!_pgmSources[src.id]) {
              _pgmConnectSource(src.id, stream);
            } else {
              const entry = _pgmSources[src.id];
              const wantedRoute = _getSourceInputChannelRoute(src);
              const wantedMode = _getSourceInputMode(src);
              const wantedPan = _getSourcePan(src);
              const wantedWidth = _getSourceWidth(src);
              const wantedMonitorBypassFx = _pgmShouldBypassFxForMonitor(src);
              if (!entry
                || _normalizeSourceInputChannelIndex(entry.inputRouteLeft, 0) !== wantedRoute.left
                || _normalizeSourceInputChannelIndex(entry.inputRouteRight, 1) !== wantedRoute.right
                || _normalizeSourceInputMode(entry.inputMode) !== wantedMode
                || !!entry.monitorBypassFx !== !!wantedMonitorBypassFx) {
                _pgmConnectSource(src.id, stream, { rampIn: true });
              } else {
                if (_normalizeSourcePan(entry.pan) !== wantedPan || _normalizeSourceWidth(entry.width) !== wantedWidth) {
                  _pgmApplySourceSpatial(entry, wantedPan, wantedWidth);
                }
                _ctrlApplyMixGainToProgramSource(src.id);
              }
            }
          }
        }
      });
      // Remove sources no longer wanted
      Object.keys(_pgmSources).forEach(id => {
        if (!wantedIds.has(id)) _pgmDisconnectSource(id);
      });
      if (wantedIds.size > 0) _pgmStartMeter(); else _pgmStopMeter();
      _pgmRenderMixDebugPanel(true);
      // Keep LS projection audio meter in sync with program output
      if (_lsState.projectionPreviewActive && _lsState.sourceMode === 'projection') {
        const pgmStream = getPgmOutputStream();
        if (pgmStream && pgmStream.getAudioTracks().length) {
          if (!_lsState.audioMeterAnalyserL) _lsStartAudioMeter(pgmStream);
        }
      }
    }

    function pgmToggleMute(target) {
      if (target === 'monitor') {
        _pgmMutedMonitor = !_pgmMutedMonitor;
        _pgmApplyMonitorGain();
        const btn = document.getElementById('pgm-mute-monitor');
        if (btn) btn.classList.toggle('muted', _pgmMutedMonitor);
        if (btn) btn.title = _pgmMutedMonitor ? 'Unmute monitor output' : 'Mute monitor output';
        if (typeof saveToStorageDebounced === 'function') saveToStorageDebounced();
      } else if (target === 'stream') {
        // Legacy — no longer affects stream, redirect to monitor
        pgmToggleMute('monitor');
      } else {
        // Legacy headphone toggle — redirect to monitor
        pgmToggleMute('monitor');
      }
    }

    /** Get the master output stream (for LS or streaming) */
    function getPgmOutputStream() {
      _pgmEnsureGraph();
      return _pgmStreamDest ? _pgmStreamDest.stream : null;
    }

    const _pgmMediaCtrlState = {
      raf: 0,
      dragging: false,
      seekPending: false,
      seekTarget: 0,
      wasPlaying: false,
      seekInFlight: false,
      resumeAfterSeek: false,
      stopped: false   // true when user clicked Stop — hides the media layer
    };
    /** Set of media source IDs explicitly paused by the user.
     *  Prevents renderProgramDisplay() from auto-resuming paused media. */
    const _userPausedMedia = new Set();
    let _pgmMediaLocalAvSyncMs = 0;    // user-adjustable fine-tune offset (ms)

    /** Effective A/V sync offset.
     *  With the OBS-like captureStream approach, the <video> element handles
     *  A/V sync natively — no auto-detected pipeline latency needed.
     *  The user offset is kept for fine-tuning edge-cases only.
     */
    function _pgmGetMediaLocalAvSyncMs() {
      return Math.max(-200, Math.min(400, Math.round(
        Number(_pgmMediaLocalAvSyncMs) || 0
      )));
    }

    /** Legacy stub — latency probing is no longer needed with captureStream. */
    function _pgmProbeAudioLatency() {
      // No-op: native A/V sync eliminates the need for pipeline latency compensation.
    }

    function _pgmSyncMediaLocalAvSyncUi() {
      const input = document.getElementById('pgm-av-sync-input');
      if (!input) return;
      input.value = String(Math.round(Number(_pgmMediaLocalAvSyncMs) || 0));
    }

    function pgmSetMediaLocalAvSyncMs(value) {
      const next = Math.max(-200, Math.min(400, Math.round(Number(value) || 0)));
      _pgmMediaLocalAvSyncMs = next;
      _pgmSyncMediaLocalAvSyncUi();
      if (typeof saveToStorageDebounced === 'function') saveToStorageDebounced();
      renderProgramDisplay();
    }

    function _pgmMediaRequestRenderedFrame(vid, onReady) {
      if (!vid || typeof onReady !== 'function') return;
      let done = false;
      let timeoutId = 0;
      let rvfcId = 0;
      const finish = () => {
        if (done) return;
        done = true;
        if (timeoutId) clearTimeout(timeoutId);
        try {
          if (rvfcId && typeof vid.cancelVideoFrameCallback === 'function') {
            vid.cancelVideoFrameCallback(rvfcId);
          }
        } catch (_) {}
        vid.removeEventListener('seeked', onSeeked);
        onReady();
      };
      const onSeeked = () => finish();
      vid.addEventListener('seeked', onSeeked, { once: true });
      if (typeof vid.requestVideoFrameCallback === 'function') {
        try {
          rvfcId = vid.requestVideoFrameCallback(() => finish());
        } catch (_) {}
      }
      // Safety fallback: never block subsequent seeks waiting on decode callback.
      timeoutId = setTimeout(finish, 120);
    }

    function _pgmMediaDrainSeekQueue() {
      const { vid } = _pgmGetPrimaryMediaVideo();
      if (!vid) {
        _pgmMediaCtrlState.seekPending = false;
        _pgmMediaCtrlState.seekInFlight = false;
        return;
      }
      if (_pgmMediaCtrlState.seekInFlight) return;

      _pgmMediaCtrlState.seekPending = false;
      _pgmMediaCtrlState.seekInFlight = true;
      const target = _pgmMediaCtrlState.seekTarget;

      try {
        // Use precise currentTime seeks for smoother visual scrubbing.
        vid.currentTime = target;
      } catch (_) {
        _pgmMediaCtrlState.seekInFlight = false;
        return;
      }

      _pgmMediaRequestRenderedFrame(vid, () => {
        _pgmMediaCtrlState.seekInFlight = false;
        if (_pgmMediaCtrlState.seekPending) {
          // Another target arrived while this frame was decoding/presenting.
          _pgmMediaDrainSeekQueue();
        } else {
          if (_pgmMediaCtrlState.resumeAfterSeek && !_pgmMediaCtrlState.dragging) {
            _pgmMediaCtrlState.resumeAfterSeek = false;
            vid.play().catch(() => {});
          }
          _pgmMediaUpdateUi();
          _pgmSyncMediaClockToOutputs(true);
        }
      });
    }

    function _pgmMediaFormatTime(secs) {
      const safe = Math.max(0, Number(secs) || 0);
      const h = Math.floor(safe / 3600);
      const m = Math.floor((safe % 3600) / 60);
      const s = Math.floor(safe % 60);
      if (h > 0) return `${String(h)}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function _pgmGetPrimaryMediaSource() {
      const scene = _activeScene();
      if (!scene || !Array.isArray(scene.sources)) return null;
      if (_selectedSourceEl) {
        const selectedId = String(_selectedSourceEl.dataset.sourceId || '');
        if (selectedId) {
          const selected = scene.sources.find((s) => s && s.id === selectedId);
          if (selected && selected.type === 'media-source' && selected.visible !== false) return selected;
        }
      }
      return scene.sources.find((s) => s && s.type === 'media-source' && s.visible !== false) || null;
    }

    function _pgmGetPrimaryMediaVideo() {
      const src = _pgmGetPrimaryMediaSource();
      if (!src) return { src: null, vid: null };
      const vid = _mediaSourceVideoEls[String(src.id || '')] || null;
      return { src, vid };
    }

    function _pgmMediaUpdateUi() {
      const playBtn = document.getElementById('pgm-media-play');
      const seek = document.getElementById('pgm-media-seek');
      if (!playBtn || !seek) return;

      const { src, vid } = _pgmGetPrimaryMediaVideo();
      if (!src || !vid) {
        playBtn.disabled = true;
        playBtn.title = 'Play';
        playBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="8 5 19 12 8 19 8 5"></polygon></svg>';
        seek.disabled = true;
        seek.value = '0';
        seek.max = '1';
        seek.title = 'No media source';
        const timeLabelNone = document.getElementById('pgm-media-time');
        if (timeLabelNone) timeLabelNone.textContent = '0:00 / 0:00';
        return;
      }

      const duration = (Number.isFinite(vid.duration) && vid.duration > 0) ? vid.duration : 0;
      playBtn.disabled = false;
      if (vid.paused) {
        playBtn.title = 'Play';
        playBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="8 5 19 12 8 19 8 5"></polygon></svg>';
      } else {
        playBtn.title = 'Pause';
        playBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="9" y1="6" x2="9" y2="18"></line><line x1="15" y1="6" x2="15" y2="18"></line></svg>';
      }
      seek.disabled = duration <= 0;
      seek.max = duration > 0 ? String(duration) : '1';
      if (!_pgmMediaCtrlState.dragging) {
        seek.value = String(Math.max(0, Math.min(duration || 0, vid.currentTime || 0)));
      }
      seek.title = `${src.name || 'Media source'} • ${_pgmMediaFormatTime(vid.currentTime || 0)} / ${_pgmMediaFormatTime(duration)}`;
      const timeLabel = document.getElementById('pgm-media-time');
      if (timeLabel) timeLabel.textContent = `${_pgmMediaFormatTime(vid.currentTime || 0)} / ${_pgmMediaFormatTime(duration)}`;
    }

    function _pgmMediaUiTick() {
      _pgmMediaUpdateUi();
      Object.keys(_mediaSourceVisualEls).forEach((sid) => _syncMediaVisualToMaster(sid, false));
      _pgmSyncMediaClockToOutputs(false);
      _pgmMediaCtrlState.raf = requestAnimationFrame(_pgmMediaUiTick);
    }

    function _pgmMediaEnsureUiLoop() {
      if (_pgmMediaCtrlState.raf) return;
      _pgmMediaCtrlState.raf = requestAnimationFrame(_pgmMediaUiTick);
    }

    function pgmMediaTogglePlayPause() {
      const { src, vid } = _pgmGetPrimaryMediaVideo();
      if (!vid) { console.warn('pgmMediaTogglePlayPause: no media video found'); return; }
      // Ensure AudioContext is running (may be suspended until user gesture)
      const bridge = _mediaSourceAudioBridges[vid.dataset.mediaSourceId || ''];
      if (bridge && bridge.ctx && bridge.ctx.state === 'suspended') bridge.ctx.resume().catch(() => {});
      // Clear any lingering seek-resume state so it doesn't fight with the user's intent
      _pgmMediaCtrlState.resumeAfterSeek = false;
      if (vid.paused || vid.ended) {
        // Un-stop: show the media layer again
        _pgmMediaCtrlState.stopped = false;
        _userPausedMedia.delete(vid.dataset.mediaSourceId || '');
        _pgmMediaSetLayerVisible(src, true);
        vid.play().then(() => {
          _pgmMediaUpdateUi();
          _pgmSyncMediaClockToOutputs(true);
        }).catch((e) => console.warn('play() rejected:', e));
      } else {
        _userPausedMedia.add(vid.dataset.mediaSourceId || '');
        vid.pause();
      }
      _pgmMediaUpdateUi();
      _pgmSyncMediaClockToOutputs(true);
    }

    function pgmMediaRestart() {
      const { src, vid } = _pgmGetPrimaryMediaVideo();
      if (!vid) return;
      const bridge = _mediaSourceAudioBridges[vid.dataset.mediaSourceId || ''];
      if (bridge && bridge.ctx && bridge.ctx.state === 'suspended') bridge.ctx.resume().catch(() => {});
      // Reset seek-queue state so it can't block further interactions
      _pgmMediaCtrlState.seekInFlight = false;
      _pgmMediaCtrlState.seekPending = false;
      _pgmMediaCtrlState.resumeAfterSeek = false;
      // Un-stop: show the media layer again
      _pgmMediaCtrlState.stopped = false;
      _userPausedMedia.delete(vid.dataset.mediaSourceId || '');
      _pgmMediaSetLayerVisible(src, true);
      vid.pause();
      try { vid.currentTime = 0; } catch (_) {}
      // Wait for the seek to land, then play
      const onReady = () => {
        vid.removeEventListener('seeked', onReady);
        clearTimeout(safetyTimer);
        vid.play().catch(() => {});
        _pgmMediaUpdateUi();
        _pgmSyncMediaClockToOutputs(true);
      };
      vid.addEventListener('seeked', onReady, { once: true });
      const safetyTimer = setTimeout(onReady, 300);
      _pgmMediaUpdateUi();
      _pgmSyncMediaClockToOutputs(true);
    }

    function pgmMediaStop() {
      const { src, vid } = _pgmGetPrimaryMediaVideo();
      if (!vid) return;
      // Reset seek-queue state
      _pgmMediaCtrlState.seekInFlight = false;
      _pgmMediaCtrlState.seekPending = false;
      _pgmMediaCtrlState.resumeAfterSeek = false;
      _pgmMediaCtrlState.stopped = true;
      vid.pause();
      try { vid.currentTime = 0; } catch (_) {}
      // Hide the media-source layer so content underneath shows through
      _pgmMediaSetLayerVisible(src, false);
      _pgmMediaUpdateUi();
      _pgmSyncMediaClockToOutputs(true);
    }

    /** Show or hide the media-source layer in the compositor */
    function _pgmMediaSetLayerVisible(src, visible) {
      if (!src) return;
      const sid = String(src.id || '');
      if (!sid) return;
      // Control-panel compositor
      const cpLayer = document.querySelector(`#source-compositor .src-layer[data-src-id="${sid}"]`);
      if (cpLayer) cpLayer.style.visibility = visible ? '' : 'hidden';
      // Also sync to display windows via the existing broadcast mechanism
      _pgmSyncSources();
      _pgmSyncMediaClockToOutputs(true);
    }

    function pgmMediaSeekFromSlider(inputEl) {
      const { vid } = _pgmGetPrimaryMediaVideo();
      if (!vid || !inputEl) return;

      _pgmMediaCtrlState.dragging = true;
      const t = Math.max(0, Number(inputEl.value) || 0);
      _pgmMediaCtrlState.seekTarget = t;

      /* Update time label immediately so the readout feels instant */
      const duration = (Number.isFinite(vid.duration) && vid.duration > 0) ? vid.duration : 0;
      const timeLabel = document.getElementById('pgm-media-time');
      if (timeLabel) timeLabel.textContent = `${_pgmMediaFormatTime(t)} / ${_pgmMediaFormatTime(duration)}`;
      const seek = document.getElementById('pgm-media-seek');
      if (seek) seek.title = `${_pgmMediaFormatTime(t)} / ${_pgmMediaFormatTime(duration)}`;

      _pgmMediaCtrlState.seekPending = true;
      _pgmMediaDrainSeekQueue();
    }

    function pgmMediaSeekStart(inputEl) {
      const { vid } = _pgmGetPrimaryMediaVideo();
      if (!vid) return;
      _pgmMediaCtrlState.dragging = true;
      _pgmMediaCtrlState.wasPlaying = !vid.paused && !vid.ended;
      if (_pgmMediaCtrlState.wasPlaying) {
        try { vid.pause(); } catch (_) {}
      }
      if (inputEl) pgmMediaSeekFromSlider(inputEl);
    }

    function pgmMediaSeekCommit(inputEl) {
      /* Guard: both pointerup and change can fire – only honour the first. */
      if (!_pgmMediaCtrlState.dragging && !_pgmMediaCtrlState.wasPlaying) {
        /* Already committed – ignore duplicate. */
        return;
      }
      const { vid } = _pgmGetPrimaryMediaVideo();
      if (!vid || !inputEl) {
        _pgmMediaCtrlState.dragging = false;
        _pgmMediaCtrlState.wasPlaying = false;
        return;
      }
      const shouldResume = !!_pgmMediaCtrlState.wasPlaying;
      _pgmMediaCtrlState.wasPlaying = false;
      _pgmMediaCtrlState.dragging = false;
      _pgmMediaCtrlState.resumeAfterSeek = shouldResume;
      const t = Math.max(0, Number(inputEl.value) || 0);
      _pgmMediaCtrlState.seekTarget = t;
      _pgmMediaCtrlState.seekPending = true;
      _pgmMediaDrainSeekQueue();
      _pgmMediaUpdateUi();
      _pgmSyncMediaClockToOutputs(true);
    }

    function pgmMediaSeekCancel() {
      _pgmMediaCtrlState.dragging = false;
      _pgmMediaCtrlState.seekPending = false;
      _pgmMediaCtrlState.resumeAfterSeek = false;
      const shouldResume = !!_pgmMediaCtrlState.wasPlaying;
      _pgmMediaCtrlState.wasPlaying = false;
      if (shouldResume) {
        const { vid } = _pgmGetPrimaryMediaVideo();
        if (vid) vid.play().catch(() => {});
      }
      _pgmMediaUpdateUi();
      _pgmSyncMediaClockToOutputs(true);
    }

    const _mediaSourceVideoEls = Object.create(null); // sourceId -> persistent HTMLVideoElement (audio/clock master)
    const _mediaSourceVisualEls = Object.create(null); // sourceId -> local visual-only element (legacy, unused)
    const _mediaSourceAudioBridges = Object.create(null); // legacy compat reference
    const _mediaSourceCaptureStreams = Object.create(null); // sourceId -> MediaStream from captureStream()

    /* _syncMediaVisualToMaster — no longer needed.
     * OBS-like approach: the <video> element plays audio natively with
     * perfect A/V sync.  No visual clone or time-offset hack required.
     */
    function _syncMediaVisualToMaster(sourceId, force = false) {
      // No-op — kept for call-site compat; visual clones are retired.
    }

    /* _getOrCreateMediaSourceVisualVideo — retired.
     * OBS-like approach: we display the master <video> directly.
     * The element plays audio natively, so A/V is inherently in sync.
     * No visual clone needed.
     */
    function _getOrCreateMediaSourceVisualVideo(sourceId, masterVid, dataUrl) {
      // Clean up any legacy visual clone that may still exist.
      const sid = String(sourceId || '');
      const existing = _mediaSourceVisualEls[sid];
      if (existing) {
        try { existing.pause(); } catch (_) {}
        try { if (existing.parentElement) existing.parentElement.removeChild(existing); } catch (_) {}
        try { existing.removeAttribute('src'); existing.load(); } catch (_) {}
        delete _mediaSourceVisualEls[sid];
      }
      return null; // always use masterVid directly
    }

    function _disposeMediaSourceAudioBridge(sourceId) {
      const sid = String(sourceId || '');
      if (!sid) return;
      // Dispose legacy bridge if somehow still present
      const bridge = _mediaSourceAudioBridges[sid];
      if (bridge) {
        try { if (bridge.source) bridge.source.disconnect(); } catch (_) {}
        try { if (bridge.gain) bridge.gain.disconnect(); } catch (_) {}
        try { if (bridge.dest) bridge.dest.disconnect(); } catch (_) {}
        try {
          if (bridge.stream && bridge.stream.getTracks) {
            bridge.stream.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} });
          }
        } catch (_) {}
        try {
          if (bridge.ownsCtx && bridge.ctx && bridge.ctx.state !== 'closed') bridge.ctx.close();
        } catch (_) {}
        delete _mediaSourceAudioBridges[sid];
      }
      // Dispose captureStream
      const cs = _mediaSourceCaptureStreams[sid];
      if (cs) {
        try { cs.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} }); } catch (_) {}
        delete _mediaSourceCaptureStreams[sid];
      }
    }

    /* _getOrCreateMediaSourceAudioBridge — replaced by captureStream().
     * OBS-like: audio stays in the <video> element for native A/V sync.
     * captureStream() passively taps the audio for the program bus.
     */
    function _getOrCreateMediaSourceAudioBridge(sourceId, vid) {
      // Redirect to captureStream path
      const sid = String(sourceId || '');
      if (!sid || !vid) return null;
      return _getOrCreateMediaSourceCaptureStream(sid, vid);
    }

    function _getOrCreateMediaSourceCaptureStream(sourceId, vid) {
      const sid = String(sourceId || '');
      if (!sid || !vid) return null;
      let stream = _mediaSourceCaptureStreams[sid];
      if (stream && stream.active && stream.getAudioTracks().length) return stream;
      try {
        stream = vid.captureStream();
        _mediaSourceCaptureStreams[sid] = stream;
        return stream;
      } catch (e) {
        console.warn('captureStream failed for media source', sid, e);
        return null;
      }
    }

    function _captureMediaSourceAudio(sourceId, vid) {
      try {
        const sid = String(sourceId || '');
        if (!sid || !vid) return;

        // OBS-like: use captureStream() to passively tap the video's audio
        // without intercepting it.  The element keeps native A/V sync.
        const stream = _getOrCreateMediaSourceCaptureStream(sid, vid);
        if (!stream || !stream.active) return;
        if (!stream.getAudioTracks().length) return;

        if (_activeStreams[sid] === stream) {
          _pgmSyncSources();
          return;
        }

        _activeStreams[sid] = stream;
        renderControlsPanel();
        _pgmSyncSources();
      } catch (e) {
        console.warn('media-source audio capture failed:', e);
      }
    }

    function _getOrCreateMediaSourceVideo(sourceId, dataUrl) {
      const sid = String(sourceId || '');
      if (!sid) return null;
      let vid = _mediaSourceVideoEls[sid];
      if (!vid) {
        vid = document.createElement('video');
        vid.autoplay = true;
        vid.loop = true;
        vid.playsInline = true;
        vid.preload = 'auto';
        vid.style.objectFit = 'contain';
        vid.dataset.mediaSourceId = sid;
        _mediaSourceVideoEls[sid] = vid;

        // OBS-like approach: let the <video> element play audio natively
        // for perfect A/V sync.  captureStream() passively taps the audio
        // into the program mixing bus (metering, streaming, headphone
        // monitoring on a secondary device).  No createMediaElementSource —
        // that adds WebAudio pipeline latency and breaks native sync.
        vid.volume = Math.min(1, _ctrlGetEffectiveMixGain(sid));

        vid.addEventListener('playing', () => _captureMediaSourceAudio(sid, vid));
        vid.addEventListener('loadedmetadata', () => _captureMediaSourceAudio(sid, vid));
        vid.addEventListener('canplay', () => _captureMediaSourceAudio(sid, vid));
      }
      const nextUrl = String(dataUrl || '');
      if (String(vid.dataset.mediaUrl || '') !== nextUrl) {
        vid.dataset.mediaUrl = nextUrl;
        // Dispose the old captureStream so a fresh one is created for the new src.
        _disposeMediaSourceAudioBridge(sid);
        _ctrlStopMeter(sid);
        _pgmDisconnectSource(sid);
        delete _activeStreams[sid];
        vid.src = nextUrl;
      }
      return vid;
    }

    function _disposeMediaSourceVideo(sourceId, stopAudioStream = true) {
      const sid = String(sourceId || '');
      if (!sid) return;
      const vid = _mediaSourceVideoEls[sid];
      if (!vid) return;
      try { vid.pause(); } catch (_) {}
      try { if (vid.parentElement) vid.parentElement.removeChild(vid); } catch (_) {}
      try { vid.removeAttribute('src'); vid.load(); } catch (_) {}
      delete _mediaSourceVideoEls[sid];
      _userPausedMedia.delete(sid);
      // Clean up legacy visual clone if present
      const visual = _mediaSourceVisualEls[sid];
      if (visual) {
        try { visual.pause(); } catch (_) {}
        try { if (visual.parentElement) visual.parentElement.removeChild(visual); } catch (_) {}
        try { visual.removeAttribute('src'); visual.load(); } catch (_) {}
        delete _mediaSourceVisualEls[sid];
      }
      _disposeMediaSourceAudioBridge(sid);
      if (stopAudioStream) {
        const s = _activeStreams[sid];
        if (s) {
          try { s.getTracks().forEach((t) => t.stop()); } catch (_) {}
          delete _activeStreams[sid];
        }
        _ctrlStopMeter(sid);
        _pgmDisconnectSource(sid);
      }
    }

    function _stopStream(sourceId) {
      _disposeMediaSourceVideo(sourceId, false);
      _detachSourceFromSharedAudioInput(sourceId, { stopIfUnused: true });
      const s = _activeStreams[sourceId];
      if (s) {
        const sharedPool = _findSharedAudioPoolByStream(s);
        if (!sharedPool) {
          s.getTracks().forEach(t => t.stop());
        }
        delete _activeStreams[sourceId];
      }
      _clearCameraReconnect(sourceId);
      _clearAudioInputReconnect(sourceId);
      _ctrlStopMeter(sourceId);
      _pgmDisconnectSource(sourceId);
      _stopNdiRetry(sourceId);
      _stopNdiAudioStream(sourceId);
      /* Stop low-latency NDI canvas renderer */
      const bridgeSt = _ndiBridgeState[sourceId];
      if (bridgeSt && bridgeSt.renderer) { bridgeSt.renderer.stop(); bridgeSt.renderer = null; }
    }

    function _stopAllStreams() {
      Object.keys(_activeStreams).forEach(id => _stopStream(id));
      Object.keys(_sharedAudioInputPools).forEach((key) => {
        const pool = _sharedAudioInputPools[key];
        if (!pool) return;
        try { pool.stream?.getTracks?.().forEach((t) => t.stop()); } catch (_) {}
        delete _sharedAudioInputPools[key];
      });
      Object.keys(_audioInputSourceToSharedKey).forEach((sid) => delete _audioInputSourceToSharedKey[sid]);
      Object.keys(_ndiAudioStreams).forEach(id => _stopNdiAudioStream(id));
      /* Stop all NDI canvas renderers */
      Object.keys(_ndiBridgeState).forEach(id => {
        const st = _ndiBridgeState[id];
        if (st && st.renderer) { st.renderer.stop(); st.renderer = null; }
      });
      _ctrlStopAllMeters();
      _pgmDisconnectAllSources();
      _pgmStopMeter();
      _stopAllNdiRetries();
    }

    /** Try to connect NDI source video via camera/capture device */
    const _ndiCameraAttempted = {}; // sourceId → true (avoid repeated failed attempts)
    const _ndiRetryTimers = {};    // sourceId → intervalId for periodic retry
    const _ndiBridgeState = {};    // sourceId -> { inFlight, url, renderer }

    /**
     * Find an active NDI video stream from ANY source that uses the same camera
     * device or NDI source name.  Used during scene switches where a different
     * source ID points to the same physical NDI feed.
     */
    function _findReusableNdiStream(targetCameraDeviceId, targetNdiSourceName) {
      for (const [sid, stream] of Object.entries(_activeStreams)) {
        if (!stream || !stream.active) continue;
        // Only consider streams with video tracks (skip audio-only)
        if (!stream.getVideoTracks || !stream.getVideoTracks().length) continue;
        const src = _findSourceInAnyScene(sid);
        if (!src || src.type !== 'ndi') continue;
        const cfg = src.config || {};
        // Source name is authoritative for NDI; check it first to avoid stale feed reuse.
        if (targetNdiSourceName && cfg.ndiSourceName === targetNdiSourceName) return { sid, stream };
        if (targetCameraDeviceId && cfg.cameraDeviceId === targetCameraDeviceId) return { sid, stream };
      }
      return null;
    }

    /**
     * Find an active NDI bridge renderer from ANY source that uses the same NDI
     * source name.  Avoids restarting the native bridge on scene switches.
     */
    function _findReusableNdiBridge(targetNdiSourceName) {
      for (const [sid, st] of Object.entries(_ndiBridgeState)) {
        if (!st || !st.renderer || !st.renderer._running) continue;
        const src = _findSourceInAnyScene(sid);
        if (!src || src.type !== 'ndi') continue;
        if ((src.config || {}).ndiSourceName === targetNdiSourceName) return { sid, state: st };
      }
      return null;
    }

    function _stopNdiRetry(sourceId) {
      if (_ndiRetryTimers[sourceId]) {
        clearInterval(_ndiRetryTimers[sourceId]);
        delete _ndiRetryTimers[sourceId];
      }
    }

    function _stopAllNdiRetries() {
      Object.keys(_ndiRetryTimers).forEach(id => _stopNdiRetry(id));
    }

    /* ────────────────────────────────────────────────────────────────────
     *  Low-latency MJPEG → Canvas Streaming Renderer
     *
     *  Replaces the old `<img src="mjpeg">` approach which let the browser
     *  internally buffer 1-3 MJPEG frames (33-100 ms extra latency).
     *
     *  This class:
     *  1. Opens a streaming `fetch()` to the MJPEG endpoint
     *  2. Parses multipart boundaries on-the-fly using a growable buffer
     *  3. Decodes each JPEG via `createImageBitmap()` (off-main-thread)
     *  4. Draws to `<canvas>` with `drawImage()`
     *  5. Drops frames when decode can't keep up (always shows latest)
     *
     *  Result: frame-to-pixel latency ≈ JPEG decode time (~3-5 ms).
     * ──────────────────────────────────────────────────────────────────── */
    class _NdiStreamCanvas {
      constructor(canvas) {
        this.canvas = canvas;
        // Keep alpha so NDI content does not force an opaque black backing layer.
        this.ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
        this._running = false;
        this._abort = null;
        this._pendingBlob = null;
        this._rendering = false;
        this._frameCount = 0;
        this._droppedFrames = 0;
      }

      async start(url) {
        this.stop();
        this._running = true;
        this._abort = new AbortController();
        const streamUrl = url + (url.includes('?') ? '&' : '?') + '_ll=1&t=' + Date.now();
        try {
          const resp = await fetch(streamUrl, {
            signal: this._abort.signal,
            cache: 'no-store',
            keepalive: false
          });
          if (!resp.ok || !resp.body) throw new Error('fetch-failed');
          await this._consumeStream(resp.body.getReader());
        } catch (e) {
          if (e.name !== 'AbortError' && this._running) {
            console.warn('[ndi-stream] Stream error, will retry:', e.message);
            // Auto-retry after a short delay
            if (this._running) {
              setTimeout(() => { if (this._running) this.start(url); }, 500);
            }
          }
        }
      }

      async _consumeStream(reader) {
        /*
         * Growable ring buffer: avoids creating new Uint8Arrays on every chunk.
         * Typical MJPEG frame is 30-80 KB; we pre-allocate 256 KB.
         */
        let buf = new Uint8Array(262144);
        let len = 0;

        const BOUNDARY = [0x2D, 0x2D, 0x66, 0x72, 0x61, 0x6D, 0x65, 0x0D, 0x0A]; // "--frame\r\n"
        const HDR_END  = [0x0D, 0x0A, 0x0D, 0x0A]; // "\r\n\r\n"

        while (this._running) {
          const { value, done } = await reader.read();
          if (done || !this._running) break;
          if (!value || !value.length) continue;

          // Append chunk to buffer, grow if needed
          if (len + value.length > buf.length) {
            const newSize = Math.max(buf.length * 2, len + value.length + 65536);
            const newBuf = new Uint8Array(newSize);
            newBuf.set(buf.subarray(0, len));
            buf = newBuf;
          }
          buf.set(value, len);
          len += value.length;

          // Extract all complete JPEG frames from the buffer
          let consumed = 0;
          while (true) {
            // Find "--frame\r\n"
            const bndIdx = this._indexOf(buf, BOUNDARY, consumed, len);
            if (bndIdx < 0) break;

            // Find "\r\n\r\n" (end of headers)
            const hdrStart = bndIdx + BOUNDARY.length;
            const hdrEnd = this._indexOf(buf, HDR_END, hdrStart, len);
            if (hdrEnd < 0) break;

            // Parse Content-Length from the header block
            const headerStr = String.fromCharCode.apply(null, buf.subarray(hdrStart, hdrEnd));
            const clMatch = headerStr.match(/Content-Length:\s*(\d+)/i);
            if (!clMatch) { consumed = hdrEnd + 4; continue; }

            const bodyLen = parseInt(clMatch[1], 10);
            const bodyStart = hdrEnd + 4;
            const bodyEnd = bodyStart + bodyLen;

            if (bodyEnd > len) break; // incomplete frame, wait for more data

            // Extract JPEG bytes and schedule decode+render
            const jpegSlice = buf.slice(bodyStart, bodyEnd);
            consumed = bodyEnd;
            this._scheduleRender(jpegSlice);
          }

          // Compact buffer: shift unconsumed data to front
          if (consumed > 0) {
            if (consumed < len) {
              buf.copyWithin(0, consumed, len);
              len -= consumed;
            } else {
              len = 0;
            }
          }
        }
        try { reader.cancel(); } catch (_) {}
      }

      _scheduleRender(jpegBytes) {
        /*
         * Frame-dropping strategy: if we're still decoding the previous
         * frame, replace _pendingBlob with the newer data so we always
         * skip to the latest.  At most one decode is in flight.
         */
        this._pendingBlob = jpegBytes;
        if (this._rendering) {
          this._droppedFrames++;
          return;
        }
        this._drainRenderQueue();
      }

      async _drainRenderQueue() {
        this._rendering = true;
        while (this._pendingBlob && this._running) {
          const data = this._pendingBlob;
          this._pendingBlob = null;
          try {
            const blob = new Blob([data], { type: 'image/jpeg' });
            const bmp = await createImageBitmap(blob);
            if (!this._running) { bmp.close(); break; }
            /* Resize canvas to match source dimensions (only when they change) */
            if (this.canvas.width !== bmp.width || this.canvas.height !== bmp.height) {
              this.canvas.width = bmp.width;
              this.canvas.height = bmp.height;
            }
            this.ctx.drawImage(bmp, 0, 0);
            bmp.close();
            this._frameCount++;
          } catch (e) { /* decode error — skip frame */ }
        }
        this._rendering = false;
      }

      _indexOf(arr, needle, start, end) {
        const nLen = needle.length;
        const limit = end - nLen;
        for (let i = start; i <= limit; i++) {
          let ok = true;
          for (let j = 0; j < nLen; j++) {
            if (arr[i + j] !== needle[j]) { ok = false; break; }
          }
          if (ok) return i;
        }
        return -1;
      }

      stop() {
        this._running = false;
        if (this._abort) { try { this._abort.abort(); } catch (_) {} this._abort = null; }
        this._pendingBlob = null;
      }

      get stats() {
        return { frames: this._frameCount, dropped: this._droppedFrames };
      }
    }

    /* ── Bridge stream entry point (now uses canvas renderer) ── */
    async function _startNdiBridgeStream(sourceId, canvasEl, infoDiv, srcConfig) {
      if (!srcConfig || !srcConfig.ndiSourceName || !canvasEl) return { ok: false };
      const st = _ndiBridgeState[sourceId] || (_ndiBridgeState[sourceId] = { inFlight: false, url: '', renderer: null });
      if (st.inFlight) return { ok: false, pending: true };
      st.inFlight = true;
      try {
        if (!(window.BSPDesktop && typeof window.BSPDesktop.startNdiBridge === 'function')) {
          return { ok: false, error: 'ndi-bridge-unavailable' };
        }
        const res = await window.BSPDesktop.startNdiBridge({ sourceName: srcConfig.ndiSourceName });
        if (!res || !res.ok || !res.url) return { ok: false, error: (res && res.error) || 'ndi-bridge-start-failed' };
        st.url = res.url;

        /* Stop any previous renderer for this source */
        if (st.renderer) { st.renderer.stop(); st.renderer = null; }

        /* Start the low-latency canvas renderer */
        const renderer = new _NdiStreamCanvas(canvasEl);
        st.renderer = renderer;
        canvasEl.style.display = 'block';

        /* The renderer runs its own async loop; we don't await it */
        renderer.start(res.url).then(() => {
          /* Stream ended — might reconnect on next renderProgramDisplay */
        });

        /* Hide info overlay once first frame paints */
        const checkPaint = () => {
          if (!renderer._running) return;
          if (renderer._frameCount > 0) {
            if (infoDiv) infoDiv.style.display = 'none';
          } else {
            setTimeout(checkPaint, 100);
          }
        };
        setTimeout(checkPaint, 50);

        return { ok: true, url: res.url };
      } catch (e) {
        return { ok: false, error: (e && e.message) || 'ndi-bridge-error' };
      } finally {
        st.inFlight = false;
      }
    }

    async function _getNdiVideoInputDevices(forceRefresh = false) {
      try {
        const devices = await _refreshMediaDeviceCache('videoinput', {
          forceRefresh: !!forceRefresh,
          requestPermission: true
        });
        return Array.isArray(devices) ? devices : [];
      } catch (e) {
        return [];
      }
    }

    /**
     * Scan available video devices and find NDI-related camera.
     * Returns { device, matchType } or null.
     */
    async function _findNdiCameraDevice(srcConfig) {
      const videoDevices = await _getNdiVideoInputDevices(false);
      if (!videoDevices.length) return null;

      const hasSavedCamera = !!(srcConfig && srcConfig.cameraDeviceId);

      // Strategy 1: User-assigned camera device
      if (hasSavedCamera) {
        const found = videoDevices.find(d => d.deviceId === srcConfig.cameraDeviceId);
        if (found) return { device: found, matchType: 'saved' };
      }

      // Strategy 2: Weighted ranking (NDI virtual-device labels + source keywords)
      const ndiNameLower = String(srcConfig && srcConfig.ndiSourceName || '').toLowerCase();
      const skipWords = new Set(['stream', 'a', 'b', 'input', 'output', 'local', 'the', 'ndi']);
      const keywords = ndiNameLower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
        .filter(w => w.length >= 3 && !skipWords.has(w));

      const scored = videoDevices.map((d) => {
        const label = String(d.label || '').toLowerCase();
        let score = 0;
        if (label.includes('ndi virtual input')) score += 120;
        if (label.includes('ndi hx capture')) score += 110;
        if (label.includes('ndi')) score += 80;
        if (label.includes('virtual camera')) score += 30;
        if (keywords.length) keywords.forEach((kw) => { if (label.includes(kw)) score += 25; });
        return { device: d, score };
      }).sort((a, b) => b.score - a.score);

      if (scored.length && scored[0].score > 0) {
        const kind = scored[0].score >= 100 ? 'ndi-camera' : 'keyword';
        return { device: scored[0].device, matchType: kind };
      }

      return null;
    }

    /**
     * Get a camera stream for NDI virtual camera with robust constraints.
     * Virtual cameras (NDI Virtual Input, OBS Virtual Camera) often need explicit
     * resolution/framerate to produce frames instead of blank black.
     */
    async function _getNdiCameraStream(deviceId, srcConfig) {
      const preferred = _buildVideoConstraintsFromPrefs(
        { deviceId: { exact: deviceId } },
        srcConfig && srcConfig.resolution,
        srcConfig && srcConfig.fps
      );
      const constraintSets = [
        preferred,
        { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60, min: 30 } },
        { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60, min: 30 } },
        { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        { deviceId: { exact: deviceId } }
      ];
      let lastError;
      for (const constraints of constraintSets) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: constraints });
          const track = stream.getVideoTracks()[0];
          if (track && track.readyState === 'live') {
            const settings = track.getSettings();
            console.log('[ndi] Camera stream opened:', settings.width + 'x' + settings.height, '@' + settings.frameRate + 'fps', '(device:', track.label + ')');
            return stream;
          }
          stream.getTracks().forEach(t => t.stop());
        } catch (e) {
          lastError = e;
        }
      }
      throw lastError || new Error('No working constraint set for NDI camera');
    }

    /**
     * NDI signal check — disabled; only video feed is shown.
     */
    function _checkNdiSignal(sourceId, vidEl, infoDiv) {
      // No-op: no "No Signal" banner displayed
    }

    function _recheckNdiSignal(sourceId, vidEl) {
      // No-op
    }

    async function _tryNdiVirtualCamera(sourceId, vidEl, infoDiv, srcConfig) {
      // If we already have an active stream for this source, just reuse it
      const existingStream = _activeStreams[sourceId];
      if (existingStream && existingStream.active) {
        vidEl.srcObject = existingStream;
        vidEl.style.display = 'block';
        if (infoDiv) infoDiv.style.display = 'none';
        vidEl.play().catch(() => {});
        _stopNdiRetry(sourceId);
        return;
      }

      // Update status on the info overlay
      const _updateNdiStatus = (text, color) => {
        if (!infoDiv) return;
        const statusSpan = infoDiv.querySelector('.ndi-status-text');
        if (statusSpan) { statusSpan.textContent = text; statusSpan.style.color = color; }
      };

      _updateNdiStatus('\u25cf Connecting video...', '#fbbf24');

      const result = await _findNdiCameraDevice(srcConfig);

      if (result && result.device) {
        try {
          const stream = await _getNdiCameraStream(result.device.deviceId, srcConfig);
          _activeStreams[sourceId] = stream;
          vidEl.srcObject = stream;
          vidEl.style.display = 'block';
          if (infoDiv) infoDiv.style.display = 'none';
          // Hide bridge canvas — video stream takes priority
          const bridgeCanvas = document.getElementById('ndi-img-' + sourceId);
          if (bridgeCanvas) bridgeCanvas.style.display = 'none';
          vidEl.play().catch(() => {});
          _stopNdiRetry(sourceId);
          _checkNdiSignal(sourceId, vidEl, infoDiv);
          // Auto-reconnect if the NDI virtual camera track ends
          const vTrack = stream.getVideoTracks()[0];
          if (vTrack) {
            vTrack.onended = () => {
              if (_activeStreams[sourceId] === stream) {
                delete _activeStreams[sourceId];
                console.log('[ndi] Video track ended for', sourceId, '— scheduling reconnect');
                _scheduleNdiRetry(sourceId, vidEl, infoDiv, srcConfig);
              }
            };
          }
          // Save the matched camera for next time if it was auto-detected
          const hasSavedCamera = !!(srcConfig && srcConfig.cameraDeviceId);
          if (!hasSavedCamera && srcConfig) {
            srcConfig.cameraDeviceId = result.device.deviceId;
            srcConfig.cameraDeviceLabel = result.device.label || '';
            schedulePersistAppState();
          }
        } catch (e) {
          console.warn('[ndi] Camera stream failed:', e.message);
          _updateNdiStatus('\u25cb Video device busy or denied', '#f87171');
          _scheduleNdiRetry(sourceId, vidEl, infoDiv, srcConfig);
        }
      } else {
        _ndiCameraAttempted[sourceId] = true;
        _updateNdiStatus('\u25cb No NDI camera found — open NDI Virtual Input app or assign device in Properties', '#fb923c');
        _scheduleNdiRetry(sourceId, vidEl, infoDiv, srcConfig);
      }
    }

    /** Schedule periodic retry to find NDI camera (e.g. user starts NDI Virtual Input later) */
    function _scheduleNdiRetry(sourceId, vidEl, infoDiv, srcConfig) {
      _stopNdiRetry(sourceId);
      let retryCount = 0;
      _ndiRetryTimers[sourceId] = setInterval(async () => {
        retryCount++;
        // Stop retrying after 30 attempts (~5 minutes)
        if (retryCount > 30) { _stopNdiRetry(sourceId); return; }
        // Skip if source already has active stream
        const existing = _activeStreams[sourceId];
        if (existing && existing.active) { _stopNdiRetry(sourceId); return; }
        // Try again
        const result = await _findNdiCameraDevice(srcConfig);
        if (result && result.device) {
          try {
            const stream = await _getNdiCameraStream(result.device.deviceId, srcConfig);
            _activeStreams[sourceId] = stream;
            vidEl.srcObject = stream;
            vidEl.style.display = 'block';
            if (infoDiv) infoDiv.style.display = 'none';
            // Hide bridge canvas when video stream is available
            const bridgeCanvas = document.getElementById('ndi-img-' + sourceId);
            if (bridgeCanvas) bridgeCanvas.style.display = 'none';
            vidEl.play().catch(() => {});
            _stopNdiRetry(sourceId);
            _checkNdiSignal(sourceId, vidEl, infoDiv);
            // Auto-reconnect on track end
            const vTrack = stream.getVideoTracks()[0];
            if (vTrack) {
              vTrack.onended = () => {
                if (_activeStreams[sourceId] === stream) {
                  delete _activeStreams[sourceId];
                  _scheduleNdiRetry(sourceId, vidEl, infoDiv, srcConfig);
                }
              };
            }
            if (srcConfig && !srcConfig.cameraDeviceId) {
              srcConfig.cameraDeviceId = result.device.deviceId;
              srcConfig.cameraDeviceLabel = result.device.label || '';
              schedulePersistAppState();
            }
          } catch (e) { /* will retry next interval */ }
        }
      }, 10000); // retry every 10s
    }

    /** Manual retry / refresh button handler for NDI */
    async function retryNdiConnection(sourceId) {
      const scene = _activeScene();
      if (!scene) return;
      const src = scene.sources.find(s => s.id === sourceId);
      if (!src || src.type !== 'ndi') return;
      /* Stop existing canvas renderer */
      const bridgeSt = _ndiBridgeState[sourceId];
      if (bridgeSt && bridgeSt.renderer) { bridgeSt.renderer.stop(); bridgeSt.renderer = null; }
      try {
        if (window.BSPDesktop && typeof window.BSPDesktop.stopNdiBridge === 'function' && src.config?.ndiSourceName) {
          await window.BSPDesktop.stopNdiBridge({ sourceName: src.config.ndiSourceName });
        }
      } catch (e) {}
      // Clear resolved endpoint so it re-discovers
      delete src.config.ndiHost;
      delete src.config.ndiPort;
      delete src.config._resolving;
      renderProgramDisplay();
    }

