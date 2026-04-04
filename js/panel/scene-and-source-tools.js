    function updateDockSceneTabUi(tabId) {
      document.querySelectorAll('.dock-scene-tab').forEach((btn) => {
        btn.classList.toggle('active', btn.id === 'dock-scene-' + tabId);
      });
      // Sync activity bar highlight
      updateActivityBarUi(tabId);
    }

    function updateActivityBarUi(tabId) {
      const map = { bible: 'ab-bible', song: 'ab-song', schedule: 'ab-schedule' };
      document.querySelectorAll('#activity-bar .ab-btn').forEach(b => b.classList.remove('active'));
      const id = map[tabId];
      if (id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('active');
      }
    }

    /* ---- Scene & Source Management ---- */
    // Data model: each scene has an id, name, and an array of sources
    let _scenes = [];       // [{ id, name, sources: [{ id, type, name, visible }] }]
    let _activeSceneId = null;
    let _sceneIdCounter = 0;
    let _sourceIdCounter = 0;
    let _selectedSceneEl = null;
    let _selectedSourceEl = null;
    let _pendingSourceType = null;
    let _editingSourceEl = null;
    let _editingSceneEl = null;

    function _genSceneId() { return 'sc-' + (++_sceneIdCounter); }
    function _genSourceId() { return 'src-' + (++_sourceIdCounter); }
    function _getScene(id) { return _scenes.find(s => s.id === id); }
    function _activeScene() { return _getScene(_activeSceneId); }
    function _sceneHasTransition(scene) {
      if (!scene) return false;
      const t = scene.transition;
      if (t == null) return false;
      if (typeof t === 'boolean') return t;
      if (typeof t === 'string') return t.trim().length > 0;
      if (typeof t === 'object') {
        if (Object.keys(t).length === 0) return false;
        if (Object.prototype.hasOwnProperty.call(t, 'enabled')) return t.enabled !== false;
        return true;
      }
      return false;
    }

    function _sceneTransitionBadgeHtml(scene) {
      return _sceneHasTransition(scene)
        ? '<span class="sli-transition-state" title="Transition enabled">TR</span>'
        : '';
    }

    function _updateSceneListTransitionBadge(sceneId) {
      const row = document.querySelector(`.scene-list-item[data-scene-id="${sceneId}"]`);
      if (!row) return;
      const scene = _getScene(sceneId);
      const hasTransition = _sceneHasTransition(scene);
      const existing = row.querySelector('.sli-transition-state');
      if (hasTransition && !existing) row.insertAdjacentHTML('beforeend', _sceneTransitionBadgeHtml(scene));
      else if (!hasTransition && existing) existing.remove();
    }

    function _updateSceneTransitionToolbarState() {
      const btn = document.getElementById('scene-transition-toolbar-btn');
      if (!btn) return;
      const selectedSceneId = _selectedSceneEl?.dataset?.sceneId || _activeSceneId || '';
      const scene = selectedSceneId ? _getScene(selectedSceneId) : null;
      btn.disabled = !scene;
      btn.title = scene
        ? 'Edit transition for ' + (scene.name || 'selected scene')
        : 'Select a scene to edit transition';
    }
    /** Find a source across ALL scenes (not just the active one). */
    function _findSourceInAnyScene(sourceId) {
      for (let i = 0; i < _scenes.length; i++) {
        const src = _scenes[i].sources.find(s => s.id === sourceId);
        if (src) return src;
      }
      return null;
    }

    /** Serialize scenes for persistence (exclude non-serializable data) */
    function _serializeScenes() {
      return _scenes.map(sc => ({
        id: sc.id,
        name: sc.name,
        transition: (sc.transition && typeof sc.transition === 'object')
          ? { ...sc.transition }
          : (sc.transition ?? null),
        sources: sc.sources.map(src => {
          const s = {
            id: src.id,
            type: src.type,
            name: src.name,
            visible: src.visible,
            transformLocked: src.transformLocked === true
          };
          if (src.transform) s.transform = { ...src.transform };
          if (src.config) {
            const cfg = { ...src.config };
            // Keep dataUrl for images/media but omit for cameras (streams can't be serialized)
            if (src.type === 'camera' || src.type === 'audio-input') {
              delete cfg.dataUrl;
            }
            // Strip internal flags
            delete cfg._resolving;
            delete cfg._ndiCamChecked;
            s.config = cfg;
          }
          return s;
        })
      }));
    }

    /** Restore scenes from persisted state */
    function _restoreScenes(scenesData, activeId, sceneCounter, sourceCounter) {
      _scenes = [];
      _activeSceneId = null;
      _sceneIdCounter = sceneCounter || 0;
      _sourceIdCounter = sourceCounter || 0;
      _selectedSceneEl = null;
      _selectedSourceEl = null;
      const sceneList = document.getElementById('scene-list');
      const sourcesList = document.getElementById('sources-list');
      if (sceneList) sceneList.innerHTML = '';
      if (sourcesList) sourcesList.innerHTML = '';

      if (!Array.isArray(scenesData) || scenesData.length === 0) {
        // No saved scenes — create default
        createScene('Scene 1');
        _updateSceneTransitionToolbarState();
        return;
      }

      scenesData.forEach(sc => {
        const scene = {
          id: sc.id,
          name: sc.name,
          transition: (sc.transition && typeof sc.transition === 'object') ? { ...sc.transition } : (sc.transition ?? null),
          sources: (sc.sources || []).map(s => ({ ...s, config: s.config ? { ...s.config } : {} }))
        };
        _scenes.push(scene);
        renderSceneItem(scene);
      });

      // Switch to the saved active scene, or the first one
      const targetId = activeId && _getScene(activeId) ? activeId : (_scenes.length > 0 ? _scenes[0].id : null);
      if (targetId) {
        const sceneEl = document.querySelector(`.scene-list-item[data-scene-id="${targetId}"]`);
        if (sceneEl) selectSceneEl(sceneEl);
        switchToScene(targetId);
      }
      _updateSceneTransitionToolbarState();
    }

    // ---- Source type definitions ----
    const SOURCE_TYPE_ICONS = {
      'audio-input':    { color: '#f472b6', svg: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>' },
      'camera':         { color: '#60a5fa', svg: '<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>' },
      'image':          { color: '#34d399', svg: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>' },
      'media-source':   { color: '#fb923c', svg: '<polygon points="5 3 19 12 5 21 5 3"/>' },
      'ndi':            { color: '#a78bfa', svg: '<circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49"/><path d="M7.76 16.24a6 6 0 0 1 0-8.49"/>' },
      'scene':          { color: '#fbbf24', svg: '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>' },
      'text':           { color: '#38bdf8', svg: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>' },
      'window-capture': { color: '#e879f9', svg: '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="7" x2="22" y2="7"/>' }
    };
    const SOURCE_TYPE_LABELS = {
      'audio-input': 'Audio Input', 'camera': 'Camera', 'image': 'Image',
      'media-source': 'Media Source', 'ndi': 'NDI', 'scene': 'Scene',
      'text': 'Text', 'window-capture': 'Window Capture'
    };
    const SOURCE_AUDIO_FX_LIBRARY = [
      { type: 'air', label: 'Air Boost' },
      { type: 'channel-eq', label: 'Channel EQ' },
      { type: 'chorus', label: 'Chorus' },
      { type: 'compressor', label: 'Compressor' },
      { type: 'pro-compressor', label: 'Pro Compressor' },
      { type: 'de-esser', label: 'De-esser' },
      { type: 'delay', label: 'Delay' },
      { type: 'denoiser', label: 'Denoiser' },
      { type: 'distortion', label: 'Distortion / Saturation' },
      { type: 'ducking', label: 'Ducking' },
      { type: 'exciter', label: 'Exciter' },
      { type: 'expander', label: 'Expander' },
      { type: 'flanger', label: 'Flanger' },
      { type: 'highpass', label: 'High-pass Clean' },
      { type: 'limiter', label: 'Limiter' },
      { type: 'lowpass', label: 'Low-pass Filter' },
      { type: 'noise-gate', label: 'Noise Gate' },
      { type: 'parametric-eq', label: 'Parametric EQ' },
      { type: 'phaser', label: 'Phaser' },
      { type: 'pitch-shifter', label: 'Pitch Shifter' },
      { type: 'presence', label: 'Presence Boost' },
      { type: 'pro-denoiser', label: 'Pro Denoiser AI' },
      { type: 'pro-reverb', label: 'Pro Reverb' },
      { type: 'reverb', label: 'Reverb' },
      { type: 'stereo-widener', label: 'Stereo Widener' },
      { type: 'tremolo', label: 'Tremolo' },
      { type: 'gain', label: 'Trim Gain' },
      { type: 'lowshelf', label: 'Warmth EQ' }
    ];
    const SOURCE_VIDEO_FX_LIBRARY = [
      { type: 'brightness-contrast', label: 'Brightness / Contrast' },
      { type: 'saturation', label: 'Saturation' },
      { type: 'hue-shift', label: 'Hue Shift' },
      { type: 'temperature', label: 'Temperature / Tint' },
      { type: 'sharpness', label: 'Sharpen' },
      { type: 'denoise-video', label: 'Video Denoise' },
      { type: 'gamma', label: 'Gamma' },
      { type: 'vignette', label: 'Vignette' },
      { type: 'blur', label: 'Gaussian Blur' },
      { type: 'lut', label: 'LUT Color Grade' }
    ];
    let _editingFxSourceId = '';
    let _sourceFxMode = 'audio'; // audio | video
    let _sourceFxPopupOffset = { x: 0, y: 0 };
    let _sourceFxPopupDrag = { active: false, pointerId: null, startX: 0, startY: 0, baseX: 0, baseY: 0 };
    let _sourceFxPopupDragBound = false;
    let _fxDragSourceId = '';
    let _fxDragFxId = '';
    let _systemAudioPluginsCache = [];
    let _systemAudioPluginsLoaded = false;
    let _systemAudioPluginsLoading = null;
    let _systemAudioPluginsLastLoadedAt = 0;
    let _audioPluginHostStatus = { available: false, executable: '', reason: '' };
    let _sourcePluginFolders = { vst2: [], vst3: [] };
    const _SOURCE_FX_PRESET_STORAGE_KEY = 'source.fx.presets.v1';
    let _sourceFxUserPresets = [];

    function _isAudioCapableSourceType(type) {
      return type === 'audio-input' || type === 'camera' || type === 'media-source' || type === 'ndi';
    }

    const SOURCE_INPUT_MODE_OPTIONS = [
      { id: 'mono', label: 'Mono' },
      { id: 'stereo', label: 'Stereo' }
    ];

    function _normalizeSourceInputMode(mode) {
      return String(mode || '').toLowerCase() === 'mono' ? 'mono' : 'stereo';
    }

    function _sourceInputModeLabel(mode) {
      return _normalizeSourceInputMode(mode) === 'mono' ? 'Mono' : 'Stereo';
    }

    function _sourceInputModeIconSvg(mode) {
      return _normalizeSourceInputMode(mode) === 'mono'
        ? '<circle cx="12" cy="12" r="9"/>'
        : '<circle cx="8" cy="12" r="6"/><circle cx="16" cy="12" r="6"/>';
    }

    function _sourceToggleInputMode(mode) {
      return _normalizeSourceInputMode(mode) === 'mono' ? 'stereo' : 'mono';
    }

    function _getSourceInputMode(src) {
      return _normalizeSourceInputMode(src?.config?.inputMode);
    }

    function _normalizeSourceInputChannelIndex(value, fallback = 0) {
      const n = Number(value);
      if (!Number.isFinite(n)) return Math.max(0, Math.floor(Number(fallback) || 0));
      return Math.max(0, Math.floor(n));
    }

    function _normalizeSourceInputChannelRoute(leftOrRoute, rightMaybe) {
      let left = 0;
      let right = 1;
      if (leftOrRoute && typeof leftOrRoute === 'object') {
        left = _normalizeSourceInputChannelIndex(leftOrRoute.left, 0);
        right = _normalizeSourceInputChannelIndex(leftOrRoute.right, 1);
      } else {
        left = _normalizeSourceInputChannelIndex(leftOrRoute, 0);
        right = _normalizeSourceInputChannelIndex(rightMaybe, 1);
      }
      return { left, right };
    }

    function _getSourceInputChannelRoute(src) {
      return _normalizeSourceInputChannelRoute({
        left: src?.config?.inputRouteLeft,
        right: src?.config?.inputRouteRight
      });
    }

    function _fmtSourceInputRouteLabel(routeOrSource) {
      const route = (routeOrSource && routeOrSource.config)
        ? _getSourceInputChannelRoute(routeOrSource)
        : _normalizeSourceInputChannelRoute(routeOrSource);
      const leftCh = route.left + 1;
      const rightCh = route.right + 1;
      return leftCh === rightCh ? `In ${leftCh}` : `In ${leftCh}-${rightCh}`;
    }

    function _getStreamAudioChannelCount(stream) {
      if (!stream || typeof stream.getAudioTracks !== 'function') return 0;
      const track = stream.getAudioTracks()[0];
      if (!track) return 0;
      let count = 0;
      try {
        const settings = track.getSettings ? track.getSettings() : null;
        const raw = Number(settings && settings.channelCount);
        if (Number.isFinite(raw) && raw > 0) count = Math.max(count, raw);
      } catch (_) {}
      try {
        const caps = track.getCapabilities ? track.getCapabilities() : null;
        const cap = Number(caps && caps.channelCount && caps.channelCount.max);
        if (Number.isFinite(cap) && cap > 0) count = Math.max(count, cap);
      } catch (_) {}
      return Math.max(0, Math.min(16, Math.round(count || 0)));
    }

    function _getSourceInputChannelCount(sourceOrId) {
      const src = (sourceOrId && typeof sourceOrId === 'object' && sourceOrId.id)
        ? sourceOrId
        : (_ctrlGetPersistedSourceRef(String(sourceOrId || '')) || _getSourceById(String(sourceOrId || '')));
      if (!src) return 2;
      let stream = _activeStreams[src.id];
      if (src.type === 'ndi') {
        const ndiAudio = _ndiAudioStreams[src.id];
        if (ndiAudio && ndiAudio.active && ndiAudio.getAudioTracks && ndiAudio.getAudioTracks().length) stream = ndiAudio;
      }
      const streamCount = _getStreamAudioChannelCount(stream);
      const cfgCountRaw = Number(src.config && src.config.inputChannelCount);
      const cfgCount = Number.isFinite(cfgCountRaw) && cfgCountRaw > 0 ? Math.round(cfgCountRaw) : 0;
      const count = Math.max(streamCount, cfgCount, 2);
      return Math.max(2, Math.min(16, count));
    }

    function _normalizeSourcePan(pan) {
      const n = Number(pan);
      if (!Number.isFinite(n)) return 0;
      return Math.max(-100, Math.min(100, Math.round(n)));
    }

    function _normalizeSourceWidth(width) {
      const n = Number(width);
      if (!Number.isFinite(n)) return 100;
      return Math.max(0, Math.min(200, Math.round(n)));
    }

    function _getSourcePan(src) {
      return _normalizeSourcePan(src?.config?.pan);
    }

    function _getSourceWidth(src) {
      return _normalizeSourceWidth(src?.config?.width);
    }

    function _makeFxId() {
      return 'fx_' + Math.random().toString(36).slice(2, 10);
    }

    function _makeSourceFxByType(type) {
      const fx = { id: _makeFxId(), type, enabled: true, params: {} };
      if (type === 'highpass') fx.params = { frequency: 80, q: 0.707 };
      else if (type === 'lowshelf') fx.params = { frequency: 160, gain: 1.8, q: 0.707 };
      else if (type === 'presence') fx.params = { frequency: 3200, q: 1.05, gain: 2.2 };
      else if (type === 'air') fx.params = { frequency: 9800, gain: 2.2, q: 0.707 };
      else if (type === 'compressor') fx.params = { threshold: -22, knee: 10, ratio: 2.4, attack: 0.004, release: 0.14 };
      else if (type === 'pro-compressor') fx.params = { threshold: -24, knee: 8, ratio: 3.2, attack: 0.003, release: 0.12, makeup: 2.0, mix: 100 };
      else if (type === 'limiter') fx.params = { threshold: -2.5, knee: 0, ratio: 20, attack: 0.001, release: 0.08 };
      else if (type === 'gain') fx.params = { gain: 1 };
      else if (type === 'denoiser') fx.params = { amount: 35 };
      else if (type === 'pro-denoiser') fx.params = { reduction: 65, sensitivity: 50, preserve: 70, attack: 6, release: 40, hpf: 60, lpf: 18000, dryMix: 0 };
      else if (type === 'reverb') fx.params = { mix: 24, decay: 1.6, tone: 7400 };
      else if (type === 'pro-reverb') fx.params = { mix: 22, decay: 2.2, size: 60, predelay: 18, damping: 5500, brightness: 8200, width: 78, modrate: 0.6, moddepth: 16 };
      else if (type === 'channel-eq') fx.params = {
        hp_on: 1, hp_freq: 80, hp_slope: 12,
        ls_on: 1, ls_freq: 100, ls_gain: 0,
        lm_on: 1, lm_freq: 400, lm_gain: 0, lm_q: 1.0,
        m_on: 1, m_freq: 1000, m_gain: 0, m_q: 1.0,
        hm_on: 1, hm_freq: 3200, hm_gain: 0, hm_q: 1.0,
        hs_on: 1, hs_freq: 8000, hs_gain: 0,
        lp_on: 0, lp_freq: 18000, lp_slope: 12,
        output_gain: 0
      };
      else if (type === 'lowpass') fx.params = { frequency: 8000, q: 0.707 };
      else if (type === 'parametric-eq') fx.params = { frequency: 1000, gain: 0, q: 1.0 };
      else if (type === 'de-esser') fx.params = { frequency: 6500, threshold: -20, ratio: 6, range: 12 };
      else if (type === 'noise-gate') fx.params = { threshold: -45, attack: 0.002, release: 0.05, hold: 0.05, range: 60, hysteresis: 4, lookahead: 1.5 };
      else if (type === 'delay') fx.params = { time: 0.3, feedback: 30, mix: 25, tone: 6000 };
      else if (type === 'chorus') fx.params = { rate: 1.5, depth: 5, mix: 40 };
      else if (type === 'exciter') fx.params = { frequency: 3000, drive: 4, mix: 30 };
      else if (type === 'stereo-widener') fx.params = { width: 50 };
      else if (type === 'pitch-shifter') fx.params = { semitones: 0, mix: 100 };
      else if (type === 'phaser') fx.params = { rate: 0.5, depth: 50, stages: 4, feedback: 30, mix: 50 };
      else if (type === 'flanger') fx.params = { rate: 0.3, depth: 3, feedback: 40, mix: 50 };
      else if (type === 'tremolo') fx.params = { rate: 4, depth: 50, shape: 0 };
      else if (type === 'distortion') fx.params = { drive: 20, tone: 4000, mix: 50 };
      else if (type === 'expander') fx.params = { threshold: -40, ratio: 2, attack: 0.005, release: 0.1 };
      else if (type === 'ducking') fx.params = { threshold: -30, amount: 12, attack: 0.01, release: 0.3 };
      /* ── Video FX defaults ── */
      else if (type === 'brightness-contrast') fx.params = { brightness: 0, contrast: 0 };
      else if (type === 'saturation') fx.params = { saturation: 100 };
      else if (type === 'hue-shift') fx.params = { hue: 0 };
      else if (type === 'temperature') fx.params = { temperature: 0, tint: 0 };
      else if (type === 'sharpness') fx.params = { amount: 0, radius: 1.0 };
      else if (type === 'denoise-video') fx.params = { strength: 0 };
      else if (type === 'gamma') fx.params = { gamma: 1.0 };
      else if (type === 'vignette') fx.params = { amount: 50, size: 50, roundness: 50 };
      else if (type === 'blur') fx.params = { radius: 0 };
      else if (type === 'lut') fx.params = { intensity: 100, preset: 'none' };
      return fx;
    }

    function _defaultRichFxStack() {
      return [
        _makeSourceFxByType('highpass'),
        _makeSourceFxByType('lowshelf'),
        _makeSourceFxByType('presence'),
        _makeSourceFxByType('air'),
        _makeSourceFxByType('compressor'),
        _makeSourceFxByType('limiter')
      ];
    }

    function _builtinFxPresets() {
      const cleanSpeech = [
        { type: 'highpass', enabled: true, params: { frequency: 95, q: 0.707 } },
        { type: 'presence', enabled: true, params: { frequency: 3400, q: 1.1, gain: 2.6 } },
        { type: 'compressor', enabled: true, params: { threshold: -20, knee: 8, ratio: 2.8, attack: 0.003, release: 0.11 } },
        { type: 'limiter', enabled: true, params: { threshold: -2.2, knee: 0, ratio: 20, attack: 0.001, release: 0.08 } }
      ];
      const broadcastPunch = [
        { type: 'highpass', enabled: true, params: { frequency: 75, q: 0.707 } },
        { type: 'lowshelf', enabled: true, params: { frequency: 150, gain: 2.6, q: 0.75 } },
        { type: 'presence', enabled: true, params: { frequency: 3000, q: 1.05, gain: 3.2 } },
        { type: 'air', enabled: true, params: { frequency: 10500, gain: 2.5, q: 0.707 } },
        { type: 'compressor', enabled: true, params: { threshold: -24, knee: 12, ratio: 3.2, attack: 0.002, release: 0.14 } },
        { type: 'limiter', enabled: true, params: { threshold: -2.0, knee: 0, ratio: 20, attack: 0.001, release: 0.07 } }
      ];
      const warmMusic = [
        { type: 'highpass', enabled: true, params: { frequency: 40, q: 0.707 } },
        { type: 'lowshelf', enabled: true, params: { frequency: 130, gain: 1.6, q: 0.707 } },
        { type: 'air', enabled: true, params: { frequency: 9000, gain: 1.5, q: 0.707 } },
        { type: 'compressor', enabled: true, params: { threshold: -18, knee: 14, ratio: 1.9, attack: 0.01, release: 0.2 } },
        { type: 'limiter', enabled: true, params: { threshold: -1.8, knee: 0, ratio: 20, attack: 0.001, release: 0.1 } }
      ];
      /* Studio Clean AI — podcast-grade: natural, clean, intimate.
         Philosophy: gentle cleanup → subtle tonal shaping → transparent dynamics. */
      const studioCleanAI = [
        { type: 'pro-denoiser', enabled: true, params: { reduction: 48, sensitivity: 40, preserve: 82, attack: 8, release: 55, hpf: 80, lpf: 16000, dryMix: 3 } },
        { type: 'highpass', enabled: true, params: { frequency: 80, q: 0.72 } },
        { type: 'de-esser', enabled: true, params: { frequency: 6200, threshold: -30, ratio: 3, q: 2.4 } },
        { type: 'pro-compressor', enabled: true, params: { threshold: -22, knee: 10, ratio: 2.5, attack: 0.008, release: 0.14, makeup: 1.5, mix: 100 } },
        { type: 'limiter', enabled: true, params: { threshold: -1.8, knee: 0, ratio: 20, attack: 0.001, release: 0.08 } }
      ];
      /* Broadcast AI Pro — broadcast-grade: authoritative, punchy, loudness-consistent.
         Philosophy: aggressive cleanup → body + presence shaping → two-stage compression → brick-wall limiter. */
      const broadcastAIPro = [
        { type: 'noise-gate', enabled: true, params: { threshold: -40, attack: 0.0008, release: 0.05, hold: 0.04, range: 55, hysteresis: 5, lookahead: 2 } },
        { type: 'pro-denoiser', enabled: true, params: { reduction: 60, sensitivity: 48, preserve: 72, attack: 5, release: 35, hpf: 60, lpf: 17500, dryMix: 0 } },
        { type: 'highpass', enabled: true, params: { frequency: 70, q: 0.72 } },
        { type: 'lowshelf', enabled: true, params: { frequency: 180, gain: 1.8, q: 0.72 } },
        { type: 'de-esser', enabled: true, params: { frequency: 5800, threshold: -26, ratio: 4, q: 2 } },
        { type: 'presence', enabled: true, params: { frequency: 3200, q: 1.0, gain: 2.8 } },
        { type: 'pro-compressor', enabled: true, params: { threshold: -26, knee: 6, ratio: 3.8, attack: 0.002, release: 0.1, makeup: 3.0, mix: 100 } },
        { type: 'pro-compressor', enabled: true, params: { threshold: -14, knee: 4, ratio: 2.0, attack: 0.008, release: 0.18, makeup: 1.0, mix: 100 } },
        { type: 'limiter', enabled: true, params: { threshold: -1.0, knee: 0, ratio: 20, attack: 0.0005, release: 0.05 } }
      ];
      return [
        { id: 'builtin-rich', name: 'Rich Vocal (Default)', builtin: true, stack: _defaultRichFxStack().map((fx) => ({ type: fx.type, enabled: fx.enabled !== false, params: { ...(fx.params || {}) } })) },
        { id: 'builtin-clean-speech', name: 'Clean Speech', builtin: true, stack: cleanSpeech },
        { id: 'builtin-broadcast-punch', name: 'Broadcast Punch', builtin: true, stack: broadcastPunch },
        { id: 'builtin-warm-music', name: 'Warm Music Bed', builtin: true, stack: warmMusic },
        { id: 'builtin-studio-clean-ai', name: 'Studio Clean AI', builtin: true, stack: studioCleanAI },
        { id: 'builtin-broadcast-ai-pro', name: 'Broadcast AI Pro', builtin: true, stack: broadcastAIPro }
      ];
    }

    function _cloneFxStackForSource(stack) {
      const src = _normalizeAudioFxStack(stack || []);
      return src.map((fx) => ({
        id: _makeFxId(),
        type: fx.type,
        enabled: fx.enabled !== false,
        params: { ...(fx.params || {}) }
      }));
    }

    function _loadSourceFxUserPresets() {
      try {
        const raw = localStorage.getItem(_SOURCE_FX_PRESET_STORAGE_KEY);
        if (!raw) { _sourceFxUserPresets = []; return; }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) { _sourceFxUserPresets = []; return; }
        _sourceFxUserPresets = parsed
          .filter((p) => p && typeof p === 'object' && p.name)
          .map((p, i) => ({
            id: String(p.id || ('user-' + i + '-' + Date.now())),
            name: String(p.name || 'Preset'),
            builtin: false,
            stack: _normalizeAudioFxStack(p.stack || []).map((fx) => ({
              type: fx.type,
              enabled: fx.enabled !== false,
              params: { ...(fx.params || {}) }
            }))
          }))
          .filter((p) => p.stack.length > 0);
      } catch (_) {
        _sourceFxUserPresets = [];
      }
    }

    function _saveSourceFxUserPresets() {
      try {
        localStorage.setItem(_SOURCE_FX_PRESET_STORAGE_KEY, JSON.stringify(_sourceFxUserPresets.map((p) => ({
          id: p.id,
          name: p.name,
          stack: p.stack
        }))));
      } catch (_) {}
    }

    function _allSourceFxPresets() {
      return [..._builtinFxPresets(), ..._sourceFxUserPresets];
    }

    /* ── Preset Dropdown Menu (macOS-style) ── */
    function toggleSourceFxPresetMenu(ev) {
      if (ev) { ev.stopPropagation(); ev.preventDefault(); }
      const dd = document.getElementById('source-fx-preset-dropdown');
      if (!dd) return;
      const isOpen = dd.classList.contains('open');
      if (isOpen) { closeSourceFxPresetMenu(); return; }
      _buildSourceFxPresetMenu(dd);
      // Position dropdown below the trigger using fixed positioning
      const trigger = document.getElementById('source-fx-preset-trigger');
      if (trigger) {
        const rect = trigger.getBoundingClientRect();
        dd.style.left = rect.left + 'px';
        dd.style.top = (rect.bottom + 4) + 'px';
      }
      dd.classList.add('open');
      setTimeout(() => document.addEventListener('click', _onClickOutsidePresetMenu, true), 0);
    }
    function closeSourceFxPresetMenu() {
      const dd = document.getElementById('source-fx-preset-dropdown');
      if (dd) dd.classList.remove('open');
      document.removeEventListener('click', _onClickOutsidePresetMenu, true);
    }
    function _onClickOutsidePresetMenu(ev) {
      const dd = document.getElementById('source-fx-preset-dropdown');
      const trigger = document.getElementById('source-fx-preset-trigger');
      if (dd && !dd.contains(ev.target) && trigger && !trigger.contains(ev.target)) {
        closeSourceFxPresetMenu();
      }
    }
    function _buildSourceFxPresetMenu(host) {
      const src = _getSourceById(_editingFxSourceId);
      const hasFx = src && src.config && Array.isArray(src.config.audioFx) && src.config.audioFx.length > 0;
      const builtins = _builtinFxPresets();
      const userPresets = _sourceFxUserPresets || [];
      const hasUserPresets = userPresets.length > 0;
      let html = '';
      // Next / Previous
      html += `<div class="sfx-dd-item" onclick="sourceFxPresetNav(1);closeSourceFxPresetMenu()">Next<span class="sfx-dd-shortcut">]</span></div>`;
      html += `<div class="sfx-dd-item" onclick="sourceFxPresetNav(-1);closeSourceFxPresetMenu()">Previous<span class="sfx-dd-shortcut">[</span></div>`;
      html += `<div class="sfx-dd-divider"></div>`;
      // Copy / Paste
      const hasClipboard = !!(window._sourceFxClipboard && window._sourceFxClipboard.length);
      html += `<div class="sfx-dd-item${hasFx ? '' : ' disabled'}" onclick="${hasFx ? 'sourceFxPresetCopy();closeSourceFxPresetMenu()' : ''}">Copy</div>`;
      html += `<div class="sfx-dd-item${hasClipboard ? '' : ' disabled'}" onclick="${hasClipboard ? 'sourceFxPresetPaste();closeSourceFxPresetMenu()' : ''}">Paste</div>`;
      html += `<div class="sfx-dd-divider"></div>`;
      // Save (update current preset) / Save As (new name) / Save As Default / Recall Default / Delete
      html += `<div class="sfx-dd-item${hasFx && window._activeSourceFxPresetId ? '' : ' disabled'}" onclick="${hasFx && window._activeSourceFxPresetId ? 'sourceFxPresetSave();closeSourceFxPresetMenu()' : ''}">Save</div>`;
      html += `<div class="sfx-dd-item${hasFx ? '' : ' disabled'}" onclick="${hasFx ? 'sourceFxPresetSaveAsPrompt();closeSourceFxPresetMenu()' : ''}">Save As...</div>`;
      html += `<div class="sfx-dd-item${hasFx ? '' : ' disabled'}" onclick="${hasFx ? 'sourceFxPresetSaveAsDefault();closeSourceFxPresetMenu()' : ''}">Save As Default</div>`;
      html += `<div class="sfx-dd-item" onclick="sourceFxPresetRecallDefault();closeSourceFxPresetMenu()">Recall Default</div>`;
      // Delete sub-menu (only for user presets)
      if (hasUserPresets) {
        html += `<div class="sfx-dd-submenu-wrap">`;
        html += `<div class="sfx-dd-item">Delete<span class="sfx-dd-arrow">›</span></div>`;
        html += `<div class="sfx-dd-submenu">`;
        userPresets.forEach(p => {
          html += `<div class="sfx-dd-item" onclick="deleteSourceFxPreset('${esc(p.id)}')">${esc(p.name)}</div>`;
        });
        html += `</div></div>`;
      } else {
        html += `<div class="sfx-dd-item disabled">Delete</div>`;
      }
      html += `<div class="sfx-dd-divider"></div>`;
      // Built-in presets
      if (builtins.length) {
        builtins.forEach(p => {
          html += `<div class="sfx-dd-item" onclick="applySourceFxPreset('${esc(p.id)}');closeSourceFxPresetMenu()">${esc(p.name)}</div>`;
        });
      }
      // User presets as sub-menu
      if (hasUserPresets) {
        html += `<div class="sfx-dd-divider"></div>`;
        html += `<div class="sfx-dd-submenu-wrap">`;
        html += `<div class="sfx-dd-item">User Presets<span class="sfx-dd-arrow">›</span></div>`;
        html += `<div class="sfx-dd-submenu">`;
        userPresets.forEach(p => {
          html += `<div class="sfx-dd-item" onclick="applySourceFxPreset('${esc(p.id)}');closeSourceFxPresetMenu()">${esc(p.name)}</div>`;
        });
        html += `</div></div>`;
      }
      host.innerHTML = html;
    }

    /* Preset menu helper actions */
    function sourceFxPresetNav(dir) {
      const presets = _allSourceFxPresets();
      if (!presets.length) return;
      const src = _getSourceById(_editingFxSourceId);
      if (!src) return;
      const curName = document.getElementById('source-fx-preset-trigger-text')?.textContent || '';
      let idx = presets.findIndex(p => p.name === curName);
      idx = idx < 0 ? 0 : idx + dir;
      if (idx < 0) idx = presets.length - 1;
      if (idx >= presets.length) idx = 0;
      applySourceFxPreset(presets[idx].id);
      const label = document.getElementById('source-fx-preset-trigger-text');
      if (label) label.textContent = presets[idx].name;
    }
    function sourceFxPresetCopy() {
      const src = _getSourceById(_editingFxSourceId);
      if (!src || !src.config || !Array.isArray(src.config.audioFx) || !src.config.audioFx.length) return;
      window._sourceFxClipboard = JSON.parse(JSON.stringify(src.config.audioFx));
      showToast('FX chain copied');
    }
    /** Save: update the currently loaded preset in-place */
    function sourceFxPresetSave() {
      if (!window._activeSourceFxPresetId) { sourceFxPresetSaveAsPrompt(); return; }
      const src = _getSourceById(_editingFxSourceId);
      if (!src || !src.config || !Array.isArray(src.config.audioFx) || !src.config.audioFx.length) return;
      const existing = _sourceFxUserPresets.find(p => p.id === window._activeSourceFxPresetId);
      if (!existing) { sourceFxPresetSaveAsPrompt(); return; }
      existing.stack = _normalizeAudioFxStack(src.config.audioFx).map(fx => ({ type: fx.type, enabled: fx.enabled !== false, params: { ...(fx.params || {}) } }));
      _saveSourceFxUserPresets();
      renderSourceFxPresetsList();
      showToast('Preset updated: ' + existing.name);
    }
    /** Save As: always prompt for a new name */
    function sourceFxPresetSaveAsPrompt() {
      const name = prompt('Save preset as:', '');
      if (!name || !name.trim()) return;
      saveCurrentFxAsPreset(name.trim());
    }
    function sourceFxPresetSavePrompt() { sourceFxPresetSaveAsPrompt(); }
    /** Paste audio FX chain from clipboard to current source */
    function sourceFxPresetPaste() {
      if (!window._sourceFxClipboard || !window._sourceFxClipboard.length) { showToast('Nothing to paste'); return; }
      const src = _getSourceById(_editingFxSourceId);
      if (!src) return;
      if (!src.config) src.config = {};
      src.config.audioFx = _cloneFxStackForSource(window._sourceFxClipboard);
      src.config.fxSelectedId = src.config.audioFx[0]?.id || '';
      setSourceFxTab('fx');
      renderSourceFxList();
      _refreshSourceFxAudio(src.id);
      showToast('FX chain pasted');
    }
    /** Copy video FX chain to clipboard */
    function videoFxCopy() {
      const src = _getSourceById(_editingFxSourceId);
      if (!src || !src.config || !Array.isArray(src.config.videoFx) || !src.config.videoFx.length) { showToast('No video FX to copy'); return; }
      window._videoFxClipboard = JSON.parse(JSON.stringify(src.config.videoFx));
      showToast('Video FX chain copied');
    }
    /** Paste video FX chain from clipboard to current source */
    function videoFxPaste() {
      if (!window._videoFxClipboard || !window._videoFxClipboard.length) { showToast('Nothing to paste'); return; }
      const src = _getSourceById(_editingFxSourceId);
      if (!src) return;
      if (!src.config) src.config = {};
      src.config.videoFx = window._videoFxClipboard.map(item => {
        const fx = _makeSourceFxByType(item.type);
        if (item.params) fx.params = { ...fx.params, ...item.params };
        fx.enabled = item.enabled !== false;
        return fx;
      });
      src.config.videoFxSelectedId = src.config.videoFx[0]?.id || '';
      renderVideoFxList();
      _applyVideoFxToAllLayers();
      schedulePersistAppState();
      showToast('Video FX chain pasted');
    }
    function sourceFxPresetSaveAsDefault() {
      const src = _getSourceById(_editingFxSourceId);
      if (!src || !src.config || !Array.isArray(src.config.audioFx) || !src.config.audioFx.length) return;
      try {
        localStorage.setItem('source-fx-default-chain', JSON.stringify(src.config.audioFx.map(fx => ({ type: fx.type, enabled: fx.enabled !== false, params: { ...(fx.params || {}) } }))));
        showToast('Saved as default');
      } catch(_) {}
    }
    function sourceFxPresetRecallDefault() {
      try {
        const raw = localStorage.getItem('source-fx-default-chain');
        if (!raw) { showToast('No default saved'); return; }
        const stack = JSON.parse(raw);
        const src = _getSourceById(_editingFxSourceId);
        if (!src) return;
        if (!src.config) src.config = {};
        src.config.audioFx = _cloneFxStackForSource(stack);
        src.config.fxSelectedId = src.config.audioFx[0]?.id || '';
        setSourceFxTab('fx');
        renderSourceFxList();
        _refreshSourceFxAudio(src.id);
        showToast('Default recalled');
      } catch(_) { showToast('No default saved'); }
    }

    function _normalizeAudioFxStack(stack) {
      if (!Array.isArray(stack)) return [];
      return stack
        .filter((fx) => fx && typeof fx === 'object' && fx.type)
        .map((fx) => ({
          id: fx.id || _makeFxId(),
          type: String(fx.type),
          enabled: fx.enabled !== false,
          params: (fx.params && typeof fx.params === 'object') ? { ...fx.params } : {}
        }));
    }

    function _ensureSourceAudioFxDefaults(src) {
      if (!src || !_isAudioCapableSourceType(src.type)) return false;
      if (!src.config) src.config = {};
      let changed = false;
      if (!Array.isArray(src.config.audioFx)) {
        // Start with an empty chain; presets can be loaded explicitly by the user.
        src.config.audioFx = [];
        changed = true;
      }
      const normalized = _normalizeAudioFxStack(src.config.audioFx);
      if (normalized.length !== src.config.audioFx.length) {
        src.config.audioFx = normalized;
        changed = true;
      }
      src.config.audioFx = normalized;
      if (typeof src.config.fxMasterEnabled !== 'boolean') {
        src.config.fxMasterEnabled = true;
        changed = true;
      }
      if (typeof src.config.fxBypass !== 'boolean') {
        src.config.fxBypass = false;
        changed = true;
      }
      if (typeof src.config.fxTab !== 'string') {
        src.config.fxTab = 'fx';
        changed = true;
      }
      if (typeof src.config.fxSelectedId !== 'string') {
        src.config.fxSelectedId = '';
        changed = true;
      }
      const inputMode = _normalizeSourceInputMode(src.config.inputMode);
      if (src.config.inputMode !== inputMode) {
        src.config.inputMode = inputMode;
        changed = true;
      }
      const inputRoute = _normalizeSourceInputChannelRoute({
        left: src.config.inputRouteLeft,
        right: src.config.inputRouteRight
      });
      if (src.config.inputRouteLeft !== inputRoute.left) {
        src.config.inputRouteLeft = inputRoute.left;
        changed = true;
      }
      if (src.config.inputRouteRight !== inputRoute.right) {
        src.config.inputRouteRight = inputRoute.right;
        changed = true;
      }
      const inputChannelCount = Math.max(2, Math.min(16, Number(src.config.inputChannelCount) || 2));
      if (src.config.inputChannelCount !== inputChannelCount) {
        src.config.inputChannelCount = inputChannelCount;
        changed = true;
      }
      const pan = _normalizeSourcePan(src.config.pan);
      if (src.config.pan !== pan) {
        src.config.pan = pan;
        changed = true;
      }
      const width = _normalizeSourceWidth(src.config.width);
      if (src.config.width !== width) {
        src.config.width = width;
        changed = true;
      }
      return changed;
    }

    /* ── Video FX Normalization & Defaults ── */
    function _normalizeVideoFxStack(stack) {
      if (!Array.isArray(stack)) return [];
      return stack
        .filter(fx => fx && typeof fx === 'object' && fx.type)
        .map(fx => ({
          id: fx.id || _makeFxId(),
          type: String(fx.type),
          enabled: fx.enabled !== false,
          params: (fx.params && typeof fx.params === 'object') ? { ...fx.params } : {}
        }));
    }

    function _ensureSourceVideoFxDefaults(src) {
      if (!src) return false;
      if (!src.config) src.config = {};
      let changed = false;
      if (!Array.isArray(src.config.videoFx)) {
        src.config.videoFx = [];
        changed = true;
      }
      const normalized = _normalizeVideoFxStack(src.config.videoFx);
      if (normalized.length !== src.config.videoFx.length) {
        src.config.videoFx = normalized;
        changed = true;
      }
      src.config.videoFx = normalized;
      if (typeof src.config.videoFxMasterEnabled !== 'boolean') {
        src.config.videoFxMasterEnabled = true;
        changed = true;
      }
      if (typeof src.config.videoFxBypass !== 'boolean') {
        src.config.videoFxBypass = false;
        changed = true;
      }
      return changed;
    }

    /* ── Video FX Presets ── */
    const _SOURCE_VIDEO_FX_PRESET_STORAGE_KEY = 'source.videoFx.presets.v1';
    let _sourceVideoFxUserPresets = [];

    function _builtinVideoFxPresets() {
      return [
        { name: 'Warm Glow', builtin: true, stack: [
          { type: 'temperature', enabled: true, params: { temperature: 35, tint: 5 } },
          { type: 'brightness-contrast', enabled: true, params: { brightness: 5, contrast: 8 } },
          { type: 'vignette', enabled: true, params: { amount: 30, size: 60, roundness: 50 } }
        ]},
        { name: 'Cool Tone', builtin: true, stack: [
          { type: 'temperature', enabled: true, params: { temperature: -30, tint: -5 } },
          { type: 'brightness-contrast', enabled: true, params: { brightness: 0, contrast: 10 } },
          { type: 'saturation', enabled: true, params: { saturation: 85 } }
        ]},
        { name: 'Vivid', builtin: true, stack: [
          { type: 'saturation', enabled: true, params: { saturation: 140 } },
          { type: 'brightness-contrast', enabled: true, params: { brightness: 5, contrast: 15 } },
          { type: 'sharpness', enabled: true, params: { amount: 25, radius: 1.0 } }
        ]},
        { name: 'Cinematic', builtin: true, stack: [
          { type: 'brightness-contrast', enabled: true, params: { brightness: -5, contrast: 20 } },
          { type: 'saturation', enabled: true, params: { saturation: 80 } },
          { type: 'temperature', enabled: true, params: { temperature: 10, tint: -3 } },
          { type: 'vignette', enabled: true, params: { amount: 50, size: 40, roundness: 50 } }
        ]},
        { name: 'Black & White', builtin: true, stack: [
          { type: 'saturation', enabled: true, params: { saturation: 0 } },
          { type: 'brightness-contrast', enabled: true, params: { brightness: 0, contrast: 15 } },
          { type: 'gamma', enabled: true, params: { gamma: 1.1 } }
        ]},
        { name: 'Soft Focus', builtin: true, stack: [
          { type: 'blur', enabled: true, params: { radius: 1.5 } },
          { type: 'brightness-contrast', enabled: true, params: { brightness: 8, contrast: -10 } },
          { type: 'saturation', enabled: true, params: { saturation: 90 } }
        ]}
      ];
    }

    function _allSourceVideoFxPresets() {
      const builtins = _builtinVideoFxPresets();
      const user = Array.isArray(_sourceVideoFxUserPresets) ? _sourceVideoFxUserPresets : [];
      return [...builtins, ...user];
    }

    function _loadVideoFxUserPresets() {
      try {
        const raw = localStorage.getItem(_SOURCE_VIDEO_FX_PRESET_STORAGE_KEY);
        if (raw) _sourceVideoFxUserPresets = JSON.parse(raw);
      } catch (_) {}
    }

    function _saveVideoFxUserPresets() {
      try {
        localStorage.setItem(_SOURCE_VIDEO_FX_PRESET_STORAGE_KEY, JSON.stringify(_sourceVideoFxUserPresets || []));
      } catch (_) {}
    }

    function makeSourceIconSvg(type, size) {
      const info = SOURCE_TYPE_ICONS[type];
      if (!info) return '';
      return `<svg class="sli-icon" viewBox="0 0 24 24" fill="none" stroke="${info.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:${size||16}px;height:${size||16}px">${info.svg}</svg>`;
    }

    // ========== SCENE FUNCTIONS ==========

    function _nextDefaultSceneName() {
      const existing = new Set(_scenes.map(s => s.name));
      let i = 1;
      while (existing.has('Scene ' + i)) i++;
      return 'Scene ' + i;
    }
    function openAddScenePopup() {
      resetAddScenePopup();
      document.getElementById('add-scene-overlay').classList.add('open');
      const inp = document.getElementById('add-scene-name');
      inp.value = _nextDefaultSceneName();
      setTimeout(() => { inp.focus(); inp.select(); }, 60);
    }
    function closeAddScenePopup() {
      const overlay = document.getElementById('add-scene-overlay');
      overlay.classList.remove('open');
      _resetModalPosition(overlay);
    }
    function _isSceneNameTaken(name, exceptSceneId) {
      const target = name.trim().toLowerCase();
      return _scenes.some(s => s.name.trim().toLowerCase() === target && s.id !== exceptSceneId);
    }
    function confirmAddScene() {
      const inp = document.getElementById('add-scene-name');
      const name = inp.value.trim();
      if (!name) return;
      if (_isSceneNameTaken(name)) {
        showToast('Scene name "' + name + '" already exists. Choose a different name.');
        inp.focus();
        inp.select();
        return;
      }
      closeAddScenePopup();
      createScene(name);
    }

    function openSelectedSceneTransitionFromToolbar() {
      const sceneId = _selectedSceneEl?.dataset?.sceneId || _activeSceneId;
      if (!sceneId) return;
      const scene = _getScene(sceneId);
      if (!scene) return;
      openSceneTransitionPopup(scene);
    }

    /* ── Scene Transition Popup State ── */
    let _trEditingSceneId = null;
    let _trState = { enabled: false, type: 'fade', duration: 500, easing: 'ease' };
    let _trPreviewAnim = null;

    function openSceneTransitionPopup(scene) {
      _trEditingSceneId = scene.id;
      // Read existing transition data or defaults
      const t = scene.transition;
      if (t && typeof t === 'object') {
        _trState = {
          enabled: t.enabled !== false,
          type: t.type || 'fade',
          duration: t.duration || 500,
          easing: t.easing || 'ease'
        };
      } else {
        _trState = { enabled: !!t, type: 'fade', duration: 500, easing: 'ease' };
      }

      // Header
      const header = document.getElementById('scene-transition-header');
      if (header) header.textContent = 'Transition — ' + (scene.name || 'Scene');

      // Enable toggle
      const toggle = document.getElementById('tr-enabled-toggle');
      if (toggle) toggle.classList.toggle('on', _trState.enabled);

      // Type grid
      trSelectType(_trState.type, true);

      // Duration
      const slider = document.getElementById('tr-duration-slider');
      if (slider) slider.value = _trState.duration;
      trUpdateDuration(_trState.duration, true);

      // Easing
      const easing = document.getElementById('tr-easing-select');
      if (easing) easing.value = _trState.easing;

      // Show/hide sections based on enabled
      trUpdateSectionsVisibility();

      // Open
      const overlay = document.getElementById('scene-transition-overlay');
      if (overlay) overlay.classList.add('open');

      // Position modal near the Transition button
      const btn = document.getElementById('scene-transition-toolbar-btn');
      const modal = overlay?.querySelector('.sp-modal');
      if (btn && modal) {
        const btnRect = btn.getBoundingClientRect();
        // Place above the button, aligned horizontally to its center
        modal.style.position = 'fixed';
        modal.style.margin = '0';
        modal.style.animation = 'none';
        const modalW = modal.offsetWidth || 480;
        const modalH = modal.offsetHeight || 400;
        let left = btnRect.left + btnRect.width / 2 - modalW / 2;
        let top = btnRect.top - modalH - 12;
        // Clamp so it stays on screen
        left = Math.max(8, Math.min(left, window.innerWidth - modalW - 8));
        if (top < 8) top = btnRect.bottom + 8;
        top = Math.max(8, Math.min(top, window.innerHeight - modalH - 8));
        modal.style.left = left + 'px';
        modal.style.top = top + 'px';
        modal.style.transform = 'none';
      }

      // Run a preview animation
      trRunPreview();
    }

    function closeSceneTransitionPopup() {
      _trEditingSceneId = null;
      if (_trPreviewAnim) { cancelAnimationFrame(_trPreviewAnim); _trPreviewAnim = null; }
      const overlay = document.getElementById('scene-transition-overlay');
      if (overlay) overlay.classList.remove('open');
      // Reset modal position
      const modal = overlay?.querySelector('.sp-modal');
      if (modal) { modal.style.transform = ''; modal.style.left = ''; modal.style.top = ''; modal.style.position = ''; }
    }

    /* ── Draggable sp-modal windows via header ── */
    function _resetModalPosition(overlay) {
      if (!overlay) return;
      const modal = overlay.querySelector('.sp-modal');
      if (modal) {
        modal.style.transform = '';
        modal.style.left = '';
        modal.style.top = '';
        modal.style.position = '';
        modal.style.margin = '';
        modal.style.animation = '';
      }
    }

    (function initDraggableModals() {
      let dragModal = null, startX = 0, startY = 0, origX = 0, origY = 0;

      document.addEventListener('pointerdown', e => {
        const header = e.target.closest('.sp-modal-header');
        if (!header) return;
        const modal = header.closest('.sp-modal');
        if (!modal) return;

        e.preventDefault();
        dragModal = modal;

        // Get current position (may already be offset from prior drag)
        const rect = modal.getBoundingClientRect();
        // Switch to fixed positioning so it can move freely
        modal.style.position = 'fixed';
        modal.style.margin = '0';
        modal.style.left = rect.left + 'px';
        modal.style.top = rect.top + 'px';
        modal.style.transform = 'none';
        modal.style.animation = 'none';

        origX = rect.left;
        origY = rect.top;
        startX = e.clientX;
        startY = e.clientY;

        header.setPointerCapture(e.pointerId);
      });

      document.addEventListener('pointermove', e => {
        if (!dragModal) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        dragModal.style.left = (origX + dx) + 'px';
        dragModal.style.top = (origY + dy) + 'px';
      });

      document.addEventListener('pointerup', () => {
        dragModal = null;
      });
    })();

    function trToggleEnabled() {
      _trState.enabled = !_trState.enabled;
      const toggle = document.getElementById('tr-enabled-toggle');
      if (toggle) toggle.classList.toggle('on', _trState.enabled);
      trUpdateSectionsVisibility();
    }

    function trUpdateSectionsVisibility() {
      const show = _trState.enabled;
      ['tr-type-section', 'tr-duration-section', 'tr-easing-section'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.style.opacity = show ? '1' : '0.35';
          el.style.pointerEvents = show ? '' : 'none';
        }
      });
    }

    function trSelectType(type, skipPreview) {
      _trState.type = type;
      document.querySelectorAll('#tr-type-grid .tr-type-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.type === type);
      });
      // Hide duration for 'cut' (instant)
      const durSection = document.getElementById('tr-duration-section');
      const easeSection = document.getElementById('tr-easing-section');
      if (durSection) durSection.style.display = type === 'cut' ? 'none' : '';
      if (easeSection) easeSection.style.display = type === 'cut' ? 'none' : '';
      if (!skipPreview) trRunPreview();
    }

    function trUpdateDuration(val, skipPreview) {
      _trState.duration = parseInt(val, 10);
      const label = document.getElementById('tr-duration-value');
      if (label) label.textContent = _trState.duration + 'ms';
      if (!skipPreview) trRunPreview();
    }

    function trUpdateEasing(val) {
      _trState.easing = val;
      trRunPreview();
    }

    function trRunPreview() {
      const box = document.getElementById('tr-preview-box');
      const area = document.getElementById('tr-preview-area');
      if (!box || !area) return;
      if (_trPreviewAnim) cancelAnimationFrame(_trPreviewAnim);

      const type = _trState.type;
      const dur = type === 'cut' ? 80 : _trState.duration;
      const easingMap = {
        'ease': 'ease', 'ease-in': 'ease-in', 'ease-out': 'ease-out',
        'ease-in-out': 'ease-in-out', 'linear': 'linear',
        'spring': 'cubic-bezier(0.2, 0.9, 0.3, 1.0)'
      };
      const cssEasing = easingMap[_trState.easing] || 'ease';

      // Reset
      box.style.transition = 'none';
      box.style.opacity = '1';
      box.style.transform = 'translate(-50%, -50%) scale(1)';
      box.style.left = '50%'; box.style.top = '50%';

      // Determine start position based on type
      const startMap = {
        'cut':        { opacity: '1', transform: 'translate(-50%, -50%)' },
        'fade':       { opacity: '0', transform: 'translate(-50%, -50%)' },
        'crossfade':  { opacity: '0', transform: 'translate(-50%, -50%)' },
        'slide-left': { opacity: '1', transform: 'translate(-200%, -50%)' },
        'slide-right':{ opacity: '1', transform: 'translate(100%, -50%)' },
        'slide-up':   { opacity: '1', transform: 'translate(-50%, -200%)' },
        'slide-down': { opacity: '1', transform: 'translate(-50%, 100%)' },
        'zoom-in':    { opacity: '0', transform: 'translate(-50%, -50%) scale(0.3)' },
        'zoom-out':   { opacity: '0', transform: 'translate(-50%, -50%) scale(2)' },
      };
      const endState = { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' };
      const start = startMap[type] || startMap['fade'];

      // Apply start state
      Object.assign(box.style, start);

      // Trigger reflow, then animate to end
      void box.offsetWidth;
      box.style.transition = `all ${dur}ms ${cssEasing}`;
      Object.assign(box.style, endState);

      // Loop the preview
      const loopDelay = dur + 800;
      const loop = () => {
        _trPreviewAnim = setTimeout(() => {
          box.style.transition = 'none';
          Object.assign(box.style, start);
          void box.offsetWidth;
          box.style.transition = `all ${dur}ms ${cssEasing}`;
          Object.assign(box.style, endState);
          loop();
        }, loopDelay);
      };
      loop();
    }

    function trSaveTransition() {
      if (!_trEditingSceneId) return;
      const scene = _getScene(_trEditingSceneId);
      if (!scene) return;

      if (_trState.enabled) {
        scene.transition = {
          enabled: true,
          type: _trState.type,
          duration: _trState.duration,
          easing: _trState.easing
        };
      } else {
        scene.transition = null;
      }

      _updateSceneListTransitionBadge(_trEditingSceneId);
      _updateSceneTransitionToolbarState();
      schedulePersistAppState();
      closeSceneTransitionPopup();
    }

    function trClearTransition() {
      if (!_trEditingSceneId) return;
      const scene = _getScene(_trEditingSceneId);
      if (scene) scene.transition = null;
      _updateSceneListTransitionBadge(_trEditingSceneId);
      _updateSceneTransitionToolbarState();
      schedulePersistAppState();
      closeSceneTransitionPopup();
    }

    function createScene(name) {
      const id = _genSceneId();
      const scene = { id, name, transition: null, sources: [] };
      _scenes.push(scene);
      renderSceneItem(scene);
      switchToScene(id);
      saveState('Add Scene: ' + name);
      schedulePersistAppState();
      return scene;
    }

    function renderSceneItem(scene) {
      const list = document.getElementById('scene-list');
      const el = document.createElement('div');
      el.className = 'scene-list-item';
      el.draggable = true;
      el.dataset.sceneId = scene.id;
      el.innerHTML = `<svg class="sli-icon" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg><span class="sli-label">${esc(scene.name)}</span>${_sceneTransitionBadgeHtml(scene)}`;
      el.onclick = () => { selectSceneEl(el); switchToScene(scene.id); };
      el.ondblclick = () => openSceneProperties(el);
      setupDrag(el, 'scene-list');
      list.appendChild(el);
      _updateSceneTransitionToolbarState();
    }

    let _sceneTransitioning = false;
    let _sceneTransitionTimer = null;
    let _sceneTransitionId = 0;

    /** Immediately kill any in-flight transition, restoring a clean compositor. */
    function _cancelSceneTransition() {
      if (_sceneTransitionTimer) {
        clearTimeout(_sceneTransitionTimer);
        _sceneTransitionTimer = null;
      }
      _sceneTransitionId++;          // invalidate any lingering callbacks
      const comp = document.getElementById('source-compositor');
      if (comp) {
        // Remove leftover transition wrappers
        comp.querySelectorAll('.scene-tr-outgoing, .scene-tr-incoming').forEach(el => {
          // Cancel web-animations on this element
          el.getAnimations().forEach(a => a.cancel());
          el.remove();
        });
      }
      _sceneTransitioning = false;
    }

    function switchToScene(sceneId) {
      // Save current source order back to model before switching
      saveCurrentSourceOrder();

      const targetScene = _getScene(sceneId);
      const prevSceneId = _activeSceneId;
      const comp = document.getElementById('source-compositor');
      const shell = document.getElementById('program-display-shell');

      // If a transition is already running, cancel it cleanly first
      if (_sceneTransitioning) {
        _cancelSceneTransition();
      }

      // Determine if we should animate
      const shouldTransition = targetScene
        && _sceneHasTransition(targetScene)
        && targetScene.transition
        && targetScene.transition.type !== 'cut'
        && prevSceneId
        && prevSceneId !== sceneId
        && comp && shell;

      if (!shouldTransition) {
        _doInstantSceneSwitch(sceneId);
        return;
      }

      const t = targetScene.transition;
      const type  = t.type || 'fade';
      const dur   = Math.max(50, Math.min(t.duration || 500, 5000));
      const easingRaw = t.easing || 'ease';
      const easing = easingRaw === 'spring'
        ? 'cubic-bezier(0.2, 0.9, 0.3, 1.0)' : easingRaw;

      _sceneTransitioning = true;
      const txnId = ++_sceneTransitionId;   // unique id for this transition

      /* ── 1. Snapshot current compositor children into outgoing wrapper ── */
      const outgoing = document.createElement('div');
      outgoing.className = 'scene-tr-outgoing';
      while (comp.firstChild) outgoing.appendChild(comp.firstChild);
      comp.appendChild(outgoing);

      /* ── 2. Switch scene & render new content ── */
      _activeSceneId = sceneId;
      _xfControlsVisible = false;
      const list = document.getElementById('scene-list');
      list.querySelectorAll('.scene-list-item').forEach(el => {
        el.classList.toggle('selected', el.dataset.sceneId === sceneId);
        if (el.dataset.sceneId === sceneId) _selectedSceneEl = el;
      });
      renderSourcesForScene(sceneId);
      renderProgramDisplay();
      renderControlsPanel();
      schedulePersistAppState();

      /* ── 3. Wrap newly-rendered compositor children in incoming layer ── */
      const incoming = document.createElement('div');
      incoming.className = 'scene-tr-incoming';
      const newChildren = [];
      for (let c = comp.firstChild; c; c = c.nextSibling) {
        if (c !== outgoing) newChildren.push(c);
      }
      newChildren.forEach(c => incoming.appendChild(c));

      comp.appendChild(incoming);
      comp.appendChild(outgoing);

      /* ── 4. Animate using Web Animations API ── */
      const animOpts = { duration: dur, easing, fill: 'forwards' };
      const anims = _getSceneTransitionKeyframes(type);

      if (anims.outgoing) {
        outgoing.animate(anims.outgoing, animOpts);
      }
      if (anims.incoming) {
        incoming.animate(anims.incoming, animOpts);
      }

      /* ── 5. Cleanup after transition completes (guarded by txnId) ── */
      _sceneTransitionTimer = setTimeout(() => {
        _sceneTransitionTimer = null;
        // Guard: if another transition was started, this one is stale — bail
        if (txnId !== _sceneTransitionId) return;
        // Unwrap incoming children back into compositor
        while (incoming.firstChild) comp.appendChild(incoming.firstChild);
        incoming.remove();
        outgoing.remove();
        _sceneTransitioning = false;
      }, dur + 60);
    }

    /** Instant scene switch (no animation) — the original behavior. */
    function _doInstantSceneSwitch(sceneId) {
      _activeSceneId = sceneId;
      _xfControlsVisible = false;
      const list = document.getElementById('scene-list');
      list.querySelectorAll('.scene-list-item').forEach(el => {
        el.classList.toggle('selected', el.dataset.sceneId === sceneId);
        if (el.dataset.sceneId === sceneId) _selectedSceneEl = el;
      });
      renderSourcesForScene(sceneId);
      renderProgramDisplay();
      renderControlsPanel();
      schedulePersistAppState();
    }

    /**
     * Return { outgoing, incoming } keyframe arrays for each transition type.
     * Used by the Web Animations API.
     */
    function _getSceneTransitionKeyframes(type) {
      switch (type) {
        case 'fade':
          return {
            outgoing: [{ opacity: 1 }, { opacity: 0 }],
            incoming: null   // new scene sits under, revealed as outgoing fades
          };
        case 'crossfade':
          return {
            outgoing: [{ opacity: 1 }, { opacity: 0 }],
            incoming: [{ opacity: 0 }, { opacity: 1 }]
          };
        case 'slide-left':
          return {
            outgoing: [{ transform: 'translateX(0)' }, { transform: 'translateX(-100%)' }],
            incoming: [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }]
          };
        case 'slide-right':
          return {
            outgoing: [{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }],
            incoming: [{ transform: 'translateX(-100%)' }, { transform: 'translateX(0)' }]
          };
        case 'slide-up':
          return {
            outgoing: [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }],
            incoming: [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }]
          };
        case 'slide-down':
          return {
            outgoing: [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }],
            incoming: [{ transform: 'translateY(-100%)' }, { transform: 'translateY(0)' }]
          };
        case 'zoom-in':
          return {
            outgoing: [
              { transform: 'scale(1)', opacity: 1 },
              { transform: 'scale(1.3)', opacity: 0 }
            ],
            incoming: [
              { transform: 'scale(0.7)', opacity: 0 },
              { transform: 'scale(1)', opacity: 1 }
            ]
          };
        case 'zoom-out':
          return {
            outgoing: [
              { transform: 'scale(1)', opacity: 1 },
              { transform: 'scale(0.7)', opacity: 0 }
            ],
            incoming: [
              { transform: 'scale(1.3)', opacity: 0 },
              { transform: 'scale(1)', opacity: 1 }
            ]
          };
        default:
          return { outgoing: null, incoming: null };
      }
    }

    function saveCurrentSourceOrder() {
      if (!_activeSceneId) return;
      const scene = _activeScene();
      if (!scene) return;
      const sourceEls = [...document.getElementById('sources-list').children];
      // Rebuild sources array from DOM order
      const reordered = [];
      sourceEls.forEach(el => {
        const sid = el.dataset.sourceId;
        const existing = scene.sources.find(s => s.id === sid);
        if (existing) {
          existing.name = el.querySelector('.sli-label')?.textContent || existing.name;
          existing.visible = el.dataset.hidden !== '1';
          reordered.push(existing);
        }
      });
      scene.sources = reordered;
    }

    function selectSceneEl(el) {
      if (_selectedSceneEl) _selectedSceneEl.classList.remove('selected');
      _selectedSceneEl = el;
      el.classList.add('selected');
      _xfControlsVisible = false;
      _updateTransformOverlay();
      _updateSceneTransitionToolbarState();
    }

    function removeSelectedScene() {
      if (!_selectedSceneEl) return;
      const sceneId = _selectedSceneEl.dataset.sceneId;
      const _scName = (_getScene(sceneId) || {}).name || 'scene';
      _scenes = _scenes.filter(s => s.id !== sceneId);
      _selectedSceneEl.remove();
      _selectedSceneEl = null;
      _updateSceneTransitionToolbarState();
      // Switch to first remaining scene or clear sources
      if (_scenes.length > 0) {
        const firstEl = document.querySelector('.scene-list-item');
        if (firstEl) { selectSceneEl(firstEl); switchToScene(firstEl.dataset.sceneId); }
      } else {
        _activeSceneId = null;
        document.getElementById('sources-list').innerHTML = '';
        _selectedSourceEl = null;
        _stopAllStreams();
        renderProgramDisplay();
      }
      saveState('Delete Scene: ' + _scName);
      schedulePersistAppState();
    }

    function openSceneProperties(el) {
      _editingSceneEl = el;
      const overlay = document.getElementById('add-scene-overlay');
      const header = overlay.querySelector('.sp-modal-header');
      const inp = document.getElementById('add-scene-name');
      const okBtn = overlay.querySelector('.sp-btn-primary');
      header.textContent = 'Rename Scene';
      inp.value = el.querySelector('.sli-label').textContent;
      okBtn.textContent = 'Save';
      okBtn.setAttribute('onclick', 'confirmRenameScene()');
      overlay.classList.add('open');
      setTimeout(() => { inp.focus(); inp.select(); }, 60);
    }
    function confirmRenameScene() {
      const inp = document.getElementById('add-scene-name');
      const name = inp.value.trim();
      if (!name || !_editingSceneEl) return;
      const sceneId = _editingSceneEl.dataset.sceneId;
      if (_isSceneNameTaken(name, sceneId)) {
        showToast('Scene name "' + name + '" already exists. Choose a different name.');
        inp.focus();
        inp.select();
        return;
      }
      _editingSceneEl.querySelector('.sli-label').textContent = name;
      const scene = _getScene(sceneId);
      if (scene) scene.name = name;
      _editingSceneEl = null;
      resetAddScenePopup();
      closeAddScenePopup();
      schedulePersistAppState();
    }
    function resetAddScenePopup() {
      const overlay = document.getElementById('add-scene-overlay');
      const header = overlay.querySelector('.sp-modal-header');
      const okBtn = overlay.querySelector('.sp-btn-primary');
      header.textContent = 'Add Scene';
      okBtn.textContent = 'Add';
      okBtn.setAttribute('onclick', 'confirmAddScene()');
      _editingSceneEl = null;
    }

    function duplicateSelectedScene() {
      if (!_selectedSceneEl) return;
      const srcScene = _getScene(_selectedSceneEl.dataset.sceneId);
      if (!srcScene) return;
      const newScene = createScene(srcScene.name + ' (Copy)');
      newScene.transition = (srcScene.transition && typeof srcScene.transition === 'object')
        ? { ...srcScene.transition }
        : (srcScene.transition ?? null);
      // Duplicate sources (including config)
      srcScene.sources.forEach(s => {
        const ns = {
          id: _genSourceId(),
          type: s.type,
          name: s.name,
          visible: s.visible,
          transformLocked: s.transformLocked === true,
          transform: s.transform ? { ...s.transform } : undefined,
          config: s.config ? { ...s.config } : {}
        };
        newScene.sources.push(ns);
      });
      _updateSceneListTransitionBadge(newScene.id);
      renderSourcesForScene(newScene.id);
      renderProgramDisplay();
      schedulePersistAppState();
    }

    function moveSelectedScene(dir) {
      if (!_selectedSceneEl) return;
      const list = document.getElementById('scene-list');
      const items = [...list.children];
      const idx = items.indexOf(_selectedSceneEl);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= items.length) return;
      if (dir === -1) list.insertBefore(_selectedSceneEl, items[newIdx]);
      else list.insertBefore(_selectedSceneEl, items[newIdx].nextSibling);
      // Also reorder in data model
      const sIdx = _scenes.findIndex(s => s.id === _selectedSceneEl.dataset.sceneId);
      if (sIdx >= 0) {
        const [moved] = _scenes.splice(sIdx, 1);
        _scenes.splice(sIdx + dir, 0, moved);
      }
      schedulePersistAppState();
    }

    // ========== SOURCE FUNCTIONS ==========

    function renderSourcesForScene(sceneId) {
      const list = document.getElementById('sources-list');
      list.innerHTML = '';
      _selectedSourceEl = null;
      const scene = _getScene(sceneId);
      if (!scene) return;
      let changed = false;
      scene.sources.forEach(src => {
        const cleanedName = _sanitizeSourceNameForType(src && src.name, src && src.type);
        if (src && cleanedName && cleanedName !== src.name) {
          src.name = cleanedName;
          changed = true;
        }
        changed = _ensureSourceAudioFxDefaults(src) || changed;
        renderSourceItem(src);
      });
      _updateSourceFxToolbarButton();
      if (changed) schedulePersistAppState();
    }

    function renderSourceItem(src) {
      const list = document.getElementById('sources-list');
      const el = document.createElement('div');
      el.className = 'source-list-item';
      el.draggable = true;
      el.dataset.sourceType = src.type;
      el.dataset.sourceId = src.id;
      if (!src.visible) { el.style.opacity = '0.45'; el.dataset.hidden = '1'; }
      el.innerHTML = `${makeSourceIconSvg(src.type, 16)}${_sourceColorDotHtml(src)}<span class="sli-label">${esc(src.name)}</span>${_sourceFxBadgeHtml(src)}${makeVisibilityEyeSvg(src.visible === false)}${makeTransformLockSvg(src.transformLocked === true)}`;
      el.onclick = () => selectSourceItem(el);
      el.ondblclick = () => { selectSourceItem(el); openSourceProperties(); };
      setupDrag(el, 'sources-list');
      list.appendChild(el);
    }

    function _isSourceTransformLocked(src) {
      return !!(src && src.transformLocked === true);
    }

    function makeTransformLockSvg(locked) {
      const isLocked = !!locked;
      const cls = isLocked ? 'sli-lock locked' : 'sli-lock';
      const title = isLocked ? 'Unlock layer transform' : 'Lock layer transform';
      const path = isLocked
        ? '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
        : '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M16 11V8a4 4 0 0 0-7.2-2.4"/>';
      return `<svg class="${cls}" data-locked="${isLocked ? '1' : '0'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" onclick="event.stopPropagation();toggleSourceTransformLock(this)" title="${title}">${path}</svg>`;
    }

    function toggleSourceTransformLock(lockSvg) {
      const item = lockSvg && lockSvg.closest ? lockSvg.closest('.source-list-item') : null;
      if (!item || !item.dataset || !item.dataset.sourceId) return;
      const src = _getSourceById(item.dataset.sourceId);
      if (!src) return;
      const nextLocked = !_isSourceTransformLocked(src);
      src.transformLocked = nextLocked;
      lockSvg.classList.toggle('locked', nextLocked);
      lockSvg.dataset.locked = nextLocked ? '1' : '0';
      lockSvg.title = nextLocked ? 'Unlock layer transform' : 'Lock layer transform';
      lockSvg.innerHTML = nextLocked
        ? '<rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path>'
        : '<rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M16 11V8a4 4 0 0 0-7.2-2.4"></path>';
      if (nextLocked && _xfDragState && _xfDragState.targetKind === 'source' && _xfDragState.targetId === src.id) {
        _xfDragState = null;
        const box = document.querySelector('.xf-box');
        if (box) box.classList.remove('dragging');
        _hideSnapGuides();
      }
      if (_selectedSourceEl && _selectedSourceEl.dataset.sourceId === src.id) {
        _updateTransformOverlay();
      }
      schedulePersistAppState();
    }

    function _getSourceById(sourceId) {
      const scene = _activeScene();
      if (!scene || !Array.isArray(scene.sources)) return null;
      return scene.sources.find((s) => s.id === sourceId) || null;
    }

