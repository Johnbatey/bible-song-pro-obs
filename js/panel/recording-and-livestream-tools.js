    function _re(iid, baseId) { return document.getElementById(baseId + '-' + iid); }
    function _ri(iid) { return _recInstances.get(iid); }
    function _recLinkKey(srcIid, dstIid) {
      return `${srcIid}>${dstIid}`;
    }
    function _recParseLinkKey(key) {
      const [src, dst] = String(key || '').split('>');
      return { src: parseInt(src, 10), dst: parseInt(dst, 10) };
    }
    function _recAnyLinkKeyBetween(a, b) {
      const k1 = _recLinkKey(a, b);
      const k2 = _recLinkKey(b, a);
      if (_recLinks.has(k1)) return k1;
      if (_recLinks.has(k2)) return k2;
      return '';
    }
    function recGetLinkedIids(iid) {
      const out = [];
      for (const key of _recLinks) {
        const { src, dst } = _recParseLinkKey(key);
        if (src === iid && !out.includes(dst)) out.push(dst);
        else if (dst === iid && !out.includes(src)) out.push(src);
      }
      return out;
    }
    function recRefreshLinkNodeState(iid) {
      const inNode = _re(iid, 'rec-link-in');
      const outNode = _re(iid, 'rec-link-out');
      const hasAnyLinks = recGetLinkedIids(iid).length > 0;
      if (inNode) inNode.classList.toggle('active', hasAnyLinks);
      if (outNode) {
        outNode.classList.toggle('active', hasAnyLinks);
      }
      if (_recLinkDrag && _recLinkDrag.iid === iid) {
        if (_recLinkDrag.side === 'left' && inNode) inNode.classList.add('armed');
        if (_recLinkDrag.side === 'right' && outNode) outNode.classList.add('armed');
      } else {
        if (inNode) inNode.classList.remove('armed');
        if (outNode) outNode.classList.remove('armed');
      }
    }
    function recRefreshAllLinkNodeStates() {
      for (const iid of _recInstances.keys()) recRefreshLinkNodeState(iid);
    }
    function recGetNodeCenterInMain(iid, side) {
      const main = document.getElementById('rec-instances-container');
      const node = _re(iid, side === 'left' ? 'rec-link-in' : 'rec-link-out');
      if (!main || !node) return null;
      const mainRect = main.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      return {
        x: nodeRect.left - mainRect.left + (nodeRect.width / 2),
        y: nodeRect.top - mainRect.top + (nodeRect.height / 2)
      };
    }
    function recRenderLinks() {
      const layer = document.getElementById('rec-link-layer');
      const main = document.getElementById('rec-instances-container');
      if (!layer || !main) return;
      if (_recSelectedLinkKey && !_recLinks.has(_recSelectedLinkKey)) _recSelectedLinkKey = '';
      const w = main.clientWidth || 0;
      const h = main.clientHeight || 0;
      layer.setAttribute('viewBox', `0 0 ${w} ${h}`);
      layer.setAttribute('width', `${w}`);
      layer.setAttribute('height', `${h}`);
      const paths = [];
      for (const key of _recLinks) {
        const { src, dst } = _recParseLinkKey(key);
        if (!_ri(src) || !_ri(dst)) continue;
        const from = recGetNodeCenterInMain(src, 'right');
        const to = recGetNodeCenterInMain(dst, 'left');
        if (!from || !to) continue;
        const stA = _ri(src);
        const stroke = (stA && stA.windowColor) ? stA.windowColor : '#39bcc0';
        const d = recBuildWirePath(from.x, from.y, to.x, to.y, 'right', 'left');
        const selected = key === _recSelectedLinkKey;
        paths.push(`<path class="rec-link-path" d="${d}" fill="none" stroke="${stroke}" stroke-width="${selected ? 4.4 : 3.2}" stroke-linecap="round" opacity="0.95" onpointerdown="recSelectLink('${key}', event)"></path>`);
        if (selected) {
          paths.push(`<path d="${d}" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="7.8" stroke-linecap="round" opacity="0.25" pointer-events="none"></path>`);
        }
      }
      if (_recLinkDrag && _ri(_recLinkDrag.iid)) {
        const start = recGetNodeCenterInMain(_recLinkDrag.iid, _recLinkDrag.side);
        if (start) {
          const mainRect = main.getBoundingClientRect();
          const ex = _recLinkDrag.x - mainRect.left;
          const ey = _recLinkDrag.y - mainRect.top;
          const st = _ri(_recLinkDrag.iid);
          const stroke = (st && st.windowColor) ? st.windowColor : '#39bcc0';
          const d = recBuildWirePath(start.x, start.y, ex, ey, _recLinkDrag.side, (_recLinkDrag.side === 'right' ? 'left' : 'right'));
          paths.push(`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="2.8" stroke-linecap="round" opacity="0.9" stroke-dasharray="10 7"></path>`);
        }
      }
      layer.innerHTML = paths.join('');
      recRefreshAllLinkNodeStates();
    }
    function recSelectLink(key, event) {
      if (event) { event.preventDefault(); event.stopPropagation(); }
      if (!_recLinks.has(key)) return;
      _recSelectedLinkKey = (_recSelectedLinkKey === key) ? '' : key;
      recRenderLinks();
    }
    function recDeleteSelectedLink() {
      if (!_recSelectedLinkKey || !_recLinks.has(_recSelectedLinkKey)) return false;
      _recLinks.delete(_recSelectedLinkKey);
      _recSelectedLinkKey = '';
      recRenderLinks();
      return true;
    }
    function recBuildWirePath(x1, y1, x2, y2, fromSide, toSide) {
      const dx = Math.abs(x2 - x1);
      const c = Math.max(46, Math.min(220, dx * 0.45));
      const c1x = fromSide === 'right' ? (x1 + c) : (x1 - c);
      const c2x = toSide === 'left' ? (x2 - c) : (x2 + c);
      return `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`;
    }
    function recStartLinkDrag(iid, side, event) {
      if (event) { event.stopPropagation(); event.preventDefault(); }
      if (!_ri(iid) || (side !== 'left' && side !== 'right')) return;
      if (event && event.button !== undefined && event.button !== 0) return;
      _recLinkDrag = {
        iid,
        side,
        pointerId: (event && typeof event.pointerId === 'number') ? event.pointerId : null,
        x: event ? event.clientX : 0,
        y: event ? event.clientY : 0
      };
      const node = event ? event.currentTarget : null;
      if (node && node.setPointerCapture && _recLinkDrag.pointerId != null) {
        try { node.setPointerCapture(_recLinkDrag.pointerId); } catch (_) {}
      }
      document.addEventListener('pointermove', recOnLinkDragMove);
      document.addEventListener('pointerup', recOnLinkDragEnd);
      document.addEventListener('pointercancel', recOnLinkDragCancel);
      recRenderLinks();
    }
    function recOnLinkDragMove(event) {
      if (!_recLinkDrag) return;
      if (_recLinkDrag.pointerId != null && event.pointerId != null && event.pointerId !== _recLinkDrag.pointerId) return;
      _recLinkDrag.x = event.clientX;
      _recLinkDrag.y = event.clientY;
      recRenderLinks();
    }
    function recCompleteLinkBetween(startIid, startSide, targetIid, targetSide) {
      if (!_ri(startIid) || !_ri(targetIid)) return;
      if (startIid === targetIid) return;
      // Wiring rule:
      // 1) right connects to left
      // 2) left connects to right
      // 3) same-window links are not allowed
      // Normalize both drag directions into src(right-side window) -> dst(left-side window)
      let src = null;
      let dst = null;
      if (startSide === 'right' && targetSide === 'left') {
        src = startIid;
        dst = targetIid;
      } else if (startSide === 'left' && targetSide === 'right') {
        src = targetIid;
        dst = startIid;
      } else {
        return;
      }
      if (src === dst) return;
      const existing = _recAnyLinkKeyBetween(src, dst);
      if (existing) {
        _recLinks.delete(existing);
        if (_recSelectedLinkKey === existing) _recSelectedLinkKey = '';
      }
      else _recLinks.add(_recLinkKey(src, dst));
      recRenderLinks();
    }
    function recOnLinkDragEnd(event) {
      if (!_recLinkDrag) return;
      if (_recLinkDrag.pointerId != null && event.pointerId != null && event.pointerId !== _recLinkDrag.pointerId) return;
      const start = _recLinkDrag;
      let targetNode = null;
      const el = document.elementFromPoint(event.clientX, event.clientY);
      if (el && el.closest) targetNode = el.closest('.rec-link-node');
      if (targetNode && targetNode.id) {
        const m = targetNode.id.match(/^rec-link-(in|out)-(\d+)$/);
        if (m) {
          const targetSide = m[1] === 'in' ? 'left' : 'right';
          const targetIid = parseInt(m[2], 10);
          recCompleteLinkBetween(start.iid, start.side, targetIid, targetSide);
        }
      }
      recOnLinkDragCancel();
    }
    function recOnLinkDragCancel() {
      _recLinkDrag = null;
      document.removeEventListener('pointermove', recOnLinkDragMove);
      document.removeEventListener('pointerup', recOnLinkDragEnd);
      document.removeEventListener('pointercancel', recOnLinkDragCancel);
      recRenderLinks();
    }
    function recRemoveAllLinksForWindow(iid) {
      let changed = false;
      for (const key of Array.from(_recLinks)) {
        const { src, dst } = _recParseLinkKey(key);
        if (src === iid || dst === iid) {
          _recLinks.delete(key);
          if (_recSelectedLinkKey === key) _recSelectedLinkKey = '';
          changed = true;
        }
      }
      if (_recLinkDrag && _recLinkDrag.iid === iid) recOnLinkDragCancel();
      if (changed) recRenderLinks();
      else recRefreshAllLinkNodeStates();
    }
    function recPropagateRecordState(sourceIid, shouldRecord) {
      const visited = new Set([sourceIid]);
      const queue = [sourceIid];
      while (queue.length) {
        const cur = queue.shift();
        const nexts = recGetLinkedIids(cur);
        for (const n of nexts) {
          if (visited.has(n)) continue;
          visited.add(n);
          queue.push(n);
          recSetRecordState(n, shouldRecord, true);
        }
      }
    }

    function _recMakeFxId() {
      return 'rfx_' + Math.random().toString(36).slice(2, 10);
    }

    function _recFxLabel(type) {
      const f = REC_AUDIO_FX_LIBRARY.find((x) => x.type === type);
      return f ? f.label : String(type || 'Effect');
    }

    function _recMakeFxByType(type) {
      const fx = { id: _recMakeFxId(), type: String(type || ''), enabled: true, params: {} };
      if (fx.type === 'highpass') fx.params = { frequency: 80, q: 0.707 };
      else if (fx.type === 'lowshelf') fx.params = { frequency: 160, gain: 1.8, q: 0.707 };
      else if (fx.type === 'presence') fx.params = { frequency: 3200, q: 1.05, gain: 2.2 };
      else if (fx.type === 'air') fx.params = { frequency: 9800, gain: 2.2, q: 0.707 };
      else if (fx.type === 'compressor') fx.params = { threshold: -22, knee: 10, ratio: 2.4, attack: 0.004, release: 0.14 };
      else if (fx.type === 'pro-compressor') fx.params = { threshold: -24, knee: 8, ratio: 3.2, attack: 0.003, release: 0.12, makeup: 2.0, mix: 100 };
      else if (fx.type === 'limiter') fx.params = { threshold: -2.5, knee: 0, ratio: 20, attack: 0.001, release: 0.08 };
      else if (fx.type === 'gain') fx.params = { gain: 1 };
      else if (fx.type === 'reverb') fx.params = { mix: 26, decay: 1.7, tone: 7000 };
      else if (fx.type === 'pro-reverb') fx.params = { mix: 22, decay: 2.2, size: 60, predelay: 18, damping: 5500, brightness: 8200, width: 78, modrate: 0.6, moddepth: 16 };
      else if (fx.type === 'denoiser') fx.params = { amount: 36 };
      else if (fx.type === 'pro-denoiser') fx.params = { reduction: 65, sensitivity: 50, preserve: 70, attack: 6, release: 40, hpf: 60, lpf: 18000, dryMix: 0 };
      else if (fx.type === 'channel-eq') fx.params = {
        hp_on: 1, hp_freq: 80, hp_slope: 12,
        ls_on: 1, ls_freq: 100, ls_gain: 0,
        lm_on: 1, lm_freq: 400, lm_gain: 0, lm_q: 1.0,
        m_on: 1, m_freq: 1000, m_gain: 0, m_q: 1.0,
        hm_on: 1, hm_freq: 3200, hm_gain: 0, hm_q: 1.0,
        hs_on: 1, hs_freq: 8000, hs_gain: 0,
        lp_on: 0, lp_freq: 18000, lp_slope: 12,
        output_gain: 0
      };
      else if (fx.type === 'lowpass') fx.params = { frequency: 8000, q: 0.707 };
      else if (fx.type === 'parametric-eq') fx.params = { frequency: 1000, gain: 0, q: 1.0 };
      else if (fx.type === 'de-esser') fx.params = { frequency: 6500, threshold: -20, ratio: 6, range: 12 };
      else if (fx.type === 'noise-gate') fx.params = { threshold: -45, attack: 0.002, release: 0.05, hold: 0.05, range: 60, hysteresis: 4, lookahead: 1.5 };
      else if (fx.type === 'delay') fx.params = { time: 0.3, feedback: 30, mix: 25, tone: 6000 };
      else if (fx.type === 'chorus') fx.params = { rate: 1.5, depth: 5, mix: 40 };
      else if (fx.type === 'exciter') fx.params = { frequency: 3000, drive: 4, mix: 30 };
      else if (fx.type === 'stereo-widener') fx.params = { width: 50 };
      else if (fx.type === 'pitch-shifter') fx.params = { semitones: 0, mix: 100 };
      else if (fx.type === 'phaser') fx.params = { rate: 0.5, depth: 50, stages: 4, feedback: 30, mix: 50 };
      else if (fx.type === 'flanger') fx.params = { rate: 0.3, depth: 3, feedback: 40, mix: 50 };
      else if (fx.type === 'tremolo') fx.params = { rate: 4, depth: 50, shape: 0 };
      else if (fx.type === 'distortion') fx.params = { drive: 20, tone: 4000, mix: 50 };
      else if (fx.type === 'expander') fx.params = { threshold: -40, ratio: 2, attack: 0.005, release: 0.1 };
      else if (fx.type === 'ducking') fx.params = { threshold: -30, amount: 12, attack: 0.01, release: 0.3 };
      return fx;
    }

    function _recNormalizeFxStack(stack) {
      if (!Array.isArray(stack)) return [];
      return stack
        .filter((fx) => fx && typeof fx === 'object' && fx.type)
        .map((fx) => ({
          id: fx.id || _recMakeFxId(),
          type: String(fx.type),
          enabled: fx.enabled !== false,
          params: (fx.params && typeof fx.params === 'object') ? { ...fx.params } : {}
        }));
    }

    function _recBuiltinFxPresets() {
      return [
        {
          id: 'rec-builtin-clean-vocal',
          name: 'Clean Vocal',
          builtin: true,
          stack: [
            { type: 'denoiser', enabled: true, params: { amount: 28 } },
            { type: 'highpass', enabled: true, params: { frequency: 90, q: 0.707 } },
            { type: 'presence', enabled: true, params: { frequency: 3200, q: 1.1, gain: 2.4 } },
            { type: 'compressor', enabled: true, params: { threshold: -21, knee: 8, ratio: 2.8, attack: 0.003, release: 0.1 } }
          ]
        },
        {
          id: 'rec-builtin-rich-room',
          name: 'Rich Room',
          builtin: true,
          stack: [
            { type: 'denoiser', enabled: true, params: { amount: 35 } },
            { type: 'reverb', enabled: true, params: { mix: 24, decay: 1.6, tone: 7400 } },
            { type: 'compressor', enabled: true, params: { threshold: -23, knee: 10, ratio: 2.4, attack: 0.004, release: 0.13 } },
            { type: 'limiter', enabled: true, params: { threshold: -2.2, knee: 0, ratio: 20, attack: 0.001, release: 0.08 } }
          ]
        },
        {
          id: 'rec-builtin-podcast-tight',
          name: 'Podcast Tight',
          builtin: true,
          stack: [
            { type: 'denoiser', enabled: true, params: { amount: 42 } },
            { type: 'highpass', enabled: true, params: { frequency: 100, q: 0.707 } },
            { type: 'compressor', enabled: true, params: { threshold: -20, knee: 9, ratio: 3.1, attack: 0.002, release: 0.1 } },
            { type: 'gain', enabled: true, params: { gain: 1.08 } }
          ]
        },
        {
          id: 'rec-builtin-studio-clean-ai',
          name: 'Studio Clean AI',
          builtin: true,
          stack: [
            { type: 'pro-denoiser', enabled: true, params: { reduction: 48, sensitivity: 40, preserve: 82, attack: 8, release: 55, hpf: 80, lpf: 16000, dryMix: 3 } },
            { type: 'highpass', enabled: true, params: { frequency: 80, q: 0.72 } },
            { type: 'de-esser', enabled: true, params: { frequency: 6200, threshold: -30, ratio: 3, q: 2.4 } },
            { type: 'pro-compressor', enabled: true, params: { threshold: -22, knee: 10, ratio: 2.5, attack: 0.008, release: 0.14, makeup: 1.5, mix: 100 } },
            { type: 'limiter', enabled: true, params: { threshold: -1.8, knee: 0, ratio: 20, attack: 0.001, release: 0.08 } }
          ]
        },
        {
          id: 'rec-builtin-broadcast-ai-pro',
          name: 'Broadcast AI Pro',
          builtin: true,
          stack: [
            { type: 'noise-gate', enabled: true, params: { threshold: -40, attack: 0.0008, release: 0.05, hold: 0.04, range: 55, hysteresis: 5, lookahead: 2 } },
            { type: 'pro-denoiser', enabled: true, params: { reduction: 60, sensitivity: 48, preserve: 72, attack: 5, release: 35, hpf: 60, lpf: 17500, dryMix: 0 } },
            { type: 'highpass', enabled: true, params: { frequency: 70, q: 0.72 } },
            { type: 'lowshelf', enabled: true, params: { frequency: 180, gain: 1.8, q: 0.72 } },
            { type: 'de-esser', enabled: true, params: { frequency: 5800, threshold: -26, ratio: 4, q: 2 } },
            { type: 'presence', enabled: true, params: { frequency: 3200, q: 1.0, gain: 2.8 } },
            { type: 'pro-compressor', enabled: true, params: { threshold: -26, knee: 6, ratio: 3.8, attack: 0.002, release: 0.1, makeup: 3.0, mix: 100 } },
            { type: 'pro-compressor', enabled: true, params: { threshold: -14, knee: 4, ratio: 2.0, attack: 0.008, release: 0.18, makeup: 1.0, mix: 100 } },
            { type: 'limiter', enabled: true, params: { threshold: -1.0, knee: 0, ratio: 20, attack: 0.0005, release: 0.05 } }
          ]
        }
      ];
    }

    function _recAllFxPresets() {
      return [..._recBuiltinFxPresets(), ..._recFxUserPresets];
    }

    function _recLoadFxUserPresets() {
      try {
        const raw = localStorage.getItem(_REC_FX_PRESET_STORAGE_KEY);
        if (!raw) { _recFxUserPresets = []; return; }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) { _recFxUserPresets = []; return; }
        _recFxUserPresets = parsed
          .filter((p) => p && typeof p === 'object' && p.name)
          .map((p, i) => ({
            id: String(p.id || ('rec-user-' + i + '-' + Date.now())),
            name: String(p.name || 'Preset'),
            builtin: false,
            stack: _recNormalizeFxStack(p.stack || []).map((fx) => ({
              type: fx.type, enabled: fx.enabled !== false, params: { ...(fx.params || {}) }
            }))
          }))
          .filter((p) => p.stack.length > 0);
      } catch (_) {
        _recFxUserPresets = [];
      }
    }

    function _recSaveFxUserPresets() {
      try {
        localStorage.setItem(_REC_FX_PRESET_STORAGE_KEY, JSON.stringify(_recFxUserPresets.map((p) => ({
          id: p.id, name: p.name, stack: p.stack
        }))));
      } catch (_) {}
    }

    function _recCreateState() {
      return {
        recording: false, paused: false, seconds: 0, timerId: null, meterRAF: null,
        audioCtx: null, analyserL: null, analyserR: null, splitter: null,
        meterStream: null, inputMuted: false, outputMuted: true,
        monitorEl: null, monitorGain: null, monitorConnected: false,
        inputGain: null, inputGainValue: 1.0,
        fxNodes: [], fxRuntimeById: {}, fxSelectedId: '', fxMasterEnabled: true, fxBypass: false, audioFx: [], fxTab: 'fx', fxRewireTimer: 0,
        mediaRecorder: null, recordChunks: [], recordStream: null, recordDest: null, recordStartMs: 0,
        splitStartSeconds: 0, splitSeq: 0, _splitting: false,
        saveState: { dirPath: '', dirLabel: 'Documents' },
        recordings: [],
        playingAudio: null, playingIdx: -1, saveSeq: 0,
        selectionMode: false, selectedIds: new Set(), selectedOrder: [], contextIdx: -1,
        windowColor: '#84A0C4',
        skinColor: null,
        designMode: 'studio',
        winDrag: null
      };
    }

    // ── HTML template for a record window instance ──
    function recWindowHTML(iid) {
      return `<div class="rec-window" id="rec-window-block-${iid}">
        <button class="rec-link-node left" id="rec-link-in-${iid}" type="button" title="Link input" onpointerdown="recStartLinkDrag(${iid}, 'left', event)"></button>
        <button class="rec-link-node right" id="rec-link-out-${iid}" type="button" title="Link output" onpointerdown="recStartLinkDrag(${iid}, 'right', event)"></button>
        <div class="rec-w-page active" id="rec-w-page-main-${iid}">
        <div class="rec-w-body">
          <div class="rec-w-head">
            <input class="rec-w-title" id="rec-project-title-${iid}" type="text" value="Untitled Project" spellcheck="false" placeholder="Project Name">
            <div class="rec-w-top-actions">
              <button class="rec-w-top-btn" type="button" title="Close" onclick="recCloseWindowBlock(${iid})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <button class="rec-w-top-btn" id="rec-headphone-btn-${iid}" type="button" title="Headphone Monitoring" onclick="recToggleHeadphone(${iid})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14v3a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z"/><path d="M21 14v3a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2z"/><path d="M4 13a8 8 0 0 1 16 0"/></svg>
              </button>
              <button class="rec-w-top-btn fx" id="rec-fx-btn-${iid}" type="button" title="Disable FX" onclick="recToggleFxMaster(${iid})">FX</button>
              <button class="rec-w-top-btn" id="rec-pin-btn-${iid}" type="button" title="Lock window" onclick="recTogglePinWindow(${iid})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M9 11V8a4 4 0 0 1 7.2-2.4"/></svg>
              </button>
            </div>
          </div>
          <div class="rec-w-row rec-w-row-format">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span class="rec-w-label">Format</span>
            <select class="rec-w-select" id="rec-file-type-${iid}">
              <option value="wav-48-24" selected>WAV \u00b7 48kHz \u00b7 24-bit</option>
              <option value="wav-44-16">WAV \u00b7 44.1kHz \u00b7 16-bit</option>
              <option value="wav-96-24">WAV \u00b7 96kHz \u00b7 24-bit</option>
              <option value="mp3-320">MP3 \u00b7 320kbps</option>
              <option value="mp3-192">MP3 \u00b7 192kbps</option>
              <option value="aac-256">AAC \u00b7 256kbps</option>
              <option value="flac">FLAC \u00b7 Lossless</option>
              <option value="ogg">OGG Vorbis</option>
            </select>
          </div>
          <div class="rec-w-row rec-w-row-input">
            <button class="rec-w-mute-btn" id="rec-input-mute-btn-${iid}" onclick="recToggleInputMute(${iid})" title="Mute input">
              <svg id="rec-input-mute-icon-${iid}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            </button>
            <span class="rec-w-label">Input</span>
            <select class="rec-w-select" id="rec-input-src-${iid}">
              <option value="default" selected>Default System Input</option>
            </select>
            <button class="rec-input-gain-btn" onclick="recOpenGainPopup(${iid})" title="Input level">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
            </button>
          </div>
          <div class="rec-w-row rec-w-row-output">
            <button class="rec-w-mute-btn muted" id="rec-output-mute-btn-${iid}" onclick="recToggleOutputMute(${iid})" title="Unmute output">
              <svg id="rec-output-mute-icon-${iid}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            </button>
            <span class="rec-w-label">Output</span>
            <select class="rec-w-select" id="rec-output-src-${iid}">
              <option value="default" selected>Default System Output</option>
            </select>
          </div>
          <div class="rec-w-divider"></div>
          <div class="rec-w-strips">
            <div class="rec-w-strips-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>
              Input Channels
            </div>
            <div class="rec-w-strip rec-w-strip-l">
              <span class="rec-w-strip-name">L</span>
              <div class="rec-w-strip-track"><div class="rec-w-strip-fill" id="rec-strip-l-${iid}" style="width:0%"></div></div>
              <span class="rec-w-strip-db" id="rec-strip-l-db-${iid}">\u2212\u221e dB</span>
            </div>
            <div class="rec-w-strip rec-w-strip-r">
              <span class="rec-w-strip-name">R</span>
              <div class="rec-w-strip-track"><div class="rec-w-strip-fill" id="rec-strip-r-${iid}" style="width:0%"></div></div>
              <span class="rec-w-strip-db" id="rec-strip-r-db-${iid}">\u2212\u221e dB</span>
            </div>
            <div class="rec-w-strip-actions">
              <button class="rec-w-advanced-toggle" onclick="recToggleAdvanced(${iid})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68"/></svg>
                Channel Routing
              </button>
              <button class="rec-w-fx-mini" id="rec-fx-mini-btn-${iid}" onclick="recToggleFxPopup(${iid})" title="Audio FX">Audio FX</button>
            </div>
          </div>
        </div>
        <div class="rec-gain-overlay" id="rec-gain-overlay-${iid}" onclick="recCloseGainPopup(${iid},event)">
          <div class="rec-gain-popup" onclick="event.stopPropagation()">
            <div class="rec-ch-popup-header">
              <span class="rec-ch-popup-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
                Input Level
              </span>
              <button class="rec-ch-popup-close" onclick="recCloseGainPopup(${iid})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="rec-ch-popup-desc">Adjust the input gain. The L/R meters reflect the current level in real time.</div>
            <div class="rec-gain-slider-wrap">
              <div class="rec-gain-slider-row">
                <input type="range" id="rec-gain-slider-${iid}" min="0" max="200" value="100" oninput="recSetInputGain(${iid},this.value)">
                <span class="rec-gain-value" id="rec-gain-value-${iid}">100%</span>
              </div>
            </div>
          </div>
        </div>
        <div class="rec-ch-overlay" id="rec-ch-overlay-${iid}" onclick="recCloseAdvanced(${iid},event)">
          <div class="rec-ch-popup" onclick="event.stopPropagation()">
            <div class="rec-ch-popup-header">
              <span class="rec-ch-popup-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>
                Channel Routing
              </span>
              <button class="rec-ch-popup-close" onclick="recCloseAdvanced(${iid})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="rec-ch-popup-desc">Map which physical input channels feed the Left and Right recording channels.</div>
            <div class="rec-w-ch-row">
              <span class="rec-w-ch-label">L \u2190 Input</span>
              <select class="rec-w-ch-select" id="rec-ch-left-${iid}">
                <option value="0" selected>Channel 1</option>
              </select>
            </div>
            <div class="rec-w-ch-row">
              <span class="rec-w-ch-label">R \u2190 Input</span>
              <select class="rec-w-ch-select" id="rec-ch-right-${iid}">
                <option value="1" selected>Channel 2</option>
              </select>
            </div>
          </div>
        </div>
        <div class="rec-fx-overlay" id="rec-fx-overlay-${iid}" onclick="recCloseFxPopup(${iid},event)">
          <div class="rec-fx-popup" onclick="event.stopPropagation()">
            <div class="rec-fx-header">
              <button type="button" class="rec-fx-power-btn" id="rec-fx-power-btn-${iid}" aria-label="Power" onclick="recToggleFxMaster(${iid})"></button>
              <div class="rec-fx-tabs">
                <button class="rec-fx-tab-btn active" id="rec-fx-tab-btn-fx-${iid}" onclick="recSetFxTab(${iid},'fx')">FX Stack</button>
                <button class="rec-fx-tab-btn" id="rec-fx-tab-btn-presets-${iid}" onclick="recSetFxTab(${iid},'presets')">Presets</button>
                <button class="rec-ch-popup-close" onclick="recCloseFxPopup(${iid})">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
            <div class="rec-fx-body">
              <div class="rec-fx-panel active" id="rec-fx-panel-fx-${iid}">
                <div class="rec-fx-add-row">
                  <div class="rec-fx-type-picker" id="rec-fx-type-picker-${iid}">
                    <button class="rec-fx-type-btn" id="rec-fx-type-btn-${iid}" type="button" onclick="recToggleFxTypePicker(${iid})">
                      <span class="rec-fx-type-label" id="rec-fx-type-label-${iid}">High-pass Clean</span>
                      <svg viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1L5 5L9 1"/></svg>
                    </button>
                    <div class="rec-fx-type-list" id="rec-fx-type-list-${iid}"></div>
                  </div>
                  <button class="rec-fx-btn" type="button" onclick="recAddEffect(${iid})">Add FX</button>
                </div>
                <div class="rec-fx-list" id="rec-fx-list-${iid}"></div>
                <div class="rec-fx-editor" id="rec-fx-editor-${iid}"></div>
              </div>
              <div class="rec-fx-panel" id="rec-fx-panel-presets-${iid}">
                <div class="rec-fx-preset-list" id="rec-fx-preset-list-${iid}"></div>
                <div class="rec-fx-save-row">
                  <input class="rec-fx-input" id="rec-fx-save-name-${iid}" type="text" placeholder="Preset name">
                  <button class="rec-fx-btn" type="button" onclick="recSaveFxPreset(${iid})">Save</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
        <div class="rec-w-page rec-w-page-recordings" id="rec-w-page-recordings-${iid}">
          <div class="rec-w-recs-header">
            <span class="rec-w-recs-title">Recordings</span>
            <button class="rec-w-recs-merge-btn" id="rec-merge-btn-${iid}" type="button" onclick="recMergeSelected(${iid})">Merge</button>
            <button class="rec-w-recs-select-btn" id="rec-select-mode-btn-${iid}" type="button" onclick="recToggleSelectMode(${iid})">Select</button>
          </div>
          <div class="rec-w-recs-list" id="rec-w-recs-list-${iid}">
            <div class="rec-w-recs-empty" id="rec-recs-empty-${iid}">No recordings yet</div>
          </div>
          <div class="rec-recs-context-menu" id="rec-recs-context-menu-${iid}">
            <button id="rec-ctx-open-location-${iid}" type="button" onclick="recContextOpenLocation(${iid})">Open in location</button>
            <button type="button" onclick="recContextRename(${iid})">Rename</button>
            <button type="button" onclick="recContextDelete(${iid})">Delete</button>
          </div>
        </div>
        <div class="rec-w-tabs-row">
          <div class="rec-w-tabs">
            <button class="rec-w-tab active" id="rec-tab-main-${iid}" onclick="recSwitchTab(${iid},'main')">Main</button>
            <button class="rec-w-tab" id="rec-tab-recordings-${iid}" onclick="recSwitchTab(${iid},'recordings')">Recordings</button>
          </div>
          <div class="rec-save-to-wrap" id="rec-save-to-wrap-${iid}">
            <span class="rec-save-to-label">Save to</span>
            <button class="rec-save-to-path-btn" id="rec-save-to-path-btn-${iid}" type="button" onclick="recToggleSaveToMenu(${iid},event)" title="Choose save location">
              <span class="rec-save-to-path-text" id="rec-save-to-path-${iid}">Documents</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <button class="rec-save-to-search-btn" type="button" onclick="recChooseSaveDir(${iid})" title="Change save folder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <div class="rec-save-to-menu" id="rec-save-to-menu-${iid}" onclick="event.stopPropagation()">
              <button class="rec-save-to-opt current" id="rec-save-to-opt-current-${iid}" type="button" onclick="recCloseSaveToMenu(${iid})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                <span id="rec-save-to-opt-current-label-${iid}">Documents</span>
              </button>
              <hr class="rec-save-to-menu-sep">
              <button class="rec-save-to-opt rec-save-to-other" type="button" onclick="recChooseSaveDir(${iid})">
                Other...
              </button>
            </div>
            <input id="rec-save-dir-fallback-${iid}" type="file" webkitdirectory directory multiple style="display:none" onchange="recHandleFallbackDirPick(${iid},this)">
          </div>
        </div>
        <div class="rec-w-footer">
          <div>
            <div class="rec-w-time" id="rec-time-display-${iid}">00:00:00</div>
            <div class="rec-w-time-sub">Record Time</div>
          </div>
          <div class="rec-side-btns">
            <button class="rec-side-btn" id="rec-pause-btn-${iid}" onclick="recTogglePause(${iid})" disabled title="Pause">
              <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
              <span id="rec-pause-label-${iid}">Pause</span>
            </button>
            <button class="rec-side-btn" id="rec-split-btn-${iid}" onclick="recSplit(${iid})" disabled title="Split">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><polyline points="8 6 12 2 16 6"/><polyline points="8 18 12 22 16 18"/></svg>
              Split
            </button>
          </div>
          <button class="rec-window-btn" type="button" title="Record" id="rec-btn-${iid}" onclick="recToggleRecord(${iid})">
            <div class="rec-window-btn-dot"></div>
          </button>
        </div>
        <div class="rec-window-context-menu" id="rec-window-context-menu-${iid}" onclick="event.stopPropagation()">
          <button class="rec-win-ctx-item" type="button" onclick="recWindowCtxRename(${iid})">Rename</button>
          <div class="rec-win-ctx-section">Change Color</div>
          <div class="rec-win-ctx-colors">
            <button class="rec-win-ctx-color-btn" data-color="#B400FF" style="background:#B400FF" onclick="recWindowCtxSetColor(${iid}, '#B400FF')" title="Purple"></button>
            <button class="rec-win-ctx-color-btn" data-color="#3398FF" style="background:#3398FF" onclick="recWindowCtxSetColor(${iid}, '#3398FF')" title="Blue"></button>
            <button class="rec-win-ctx-color-btn" data-color="#0E1824" style="background:#0E1824" onclick="recWindowCtxSetColor(${iid}, '#0E1824')" title="Columbus"></button>
            <button class="rec-win-ctx-color-btn" data-color="#17C9D4" style="background:#17C9D4" onclick="recWindowCtxSetColor(${iid}, '#17C9D4')" title="Cyan"></button>
            <button class="rec-win-ctx-color-btn" data-color="#09C67A" style="background:#09C67A" onclick="recWindowCtxSetColor(${iid}, '#09C67A')" title="Green"></button>
            <button class="rec-win-ctx-color-btn" data-color="#FDB515" style="background:#FDB515" onclick="recWindowCtxSetColor(${iid}, '#FDB515')" title="Yellow"></button>
            <button class="rec-win-ctx-color-btn" data-color="#FF760E" style="background:#FF760E" onclick="recWindowCtxSetColor(${iid}, '#FF760E')" title="Orange"></button>
            <button class="rec-win-ctx-color-btn" data-color="#FF2B1E" style="background:#FF2B1E" onclick="recWindowCtxSetColor(${iid}, '#FF2B1E')" title="Red"></button>
            <button class="rec-win-ctx-color-btn" data-color="#090B13" style="background:#090B13" onclick="recWindowCtxSetColor(${iid}, '#090B13')" title="Night"></button>
            <button class="rec-win-ctx-color-btn" data-color="#5B3A29" style="background:#5B3A29" onclick="recWindowCtxSetColor(${iid}, '#5B3A29')" title="Walnut"></button>
            <button class="rec-win-ctx-color-btn" data-color="#8C6A43" style="background:#8C6A43" onclick="recWindowCtxSetColor(${iid}, '#8C6A43')" title="Bronze"></button>
            <button class="rec-win-ctx-color-btn" data-color="#4F5D3A" style="background:#4F5D3A" onclick="recWindowCtxSetColor(${iid}, '#4F5D3A')" title="Olive"></button>
            <button class="rec-win-ctx-color-btn" data-color="#7A3F6A" style="background:#7A3F6A" onclick="recWindowCtxSetColor(${iid}, '#7A3F6A')" title="Mulberry"></button>
            <button class="rec-win-ctx-color-btn" data-color="#3E4B5C" style="background:#3E4B5C" onclick="recWindowCtxSetColor(${iid}, '#3E4B5C')" title="Slate"></button>
            <button class="rec-win-ctx-color-btn" data-color="#6B2E2E" style="background:#6B2E2E" onclick="recWindowCtxSetColor(${iid}, '#6B2E2E')" title="Oxide"></button>
            <button class="rec-win-ctx-color-btn" data-color="#3F4A3A" style="background:#3F4A3A" onclick="recWindowCtxSetColor(${iid}, '#3F4A3A')" title="Moss"></button>
          </div>
          <hr class="rec-win-ctx-sep">
          <div class="rec-win-ctx-section">Design</div>
          <button class="rec-win-ctx-item rec-win-ctx-design-btn" data-design="classic" type="button" onclick="recWindowCtxSetDesign(${iid}, 'classic')">
            <span>Classic</span><span class="rec-win-ctx-item-tag">Current</span>
          </button>
          <button class="rec-win-ctx-item rec-win-ctx-design-btn" data-design="studio" type="button" onclick="recWindowCtxSetDesign(${iid}, 'studio')">
            <span>Studio Pro</span><span class="rec-win-ctx-item-tag">New</span>
          </button>
          <hr class="rec-win-ctx-sep">
          <button class="rec-win-ctx-item" type="button" onclick="recWindowCtxDuplicate(${iid})">Duplicate Window</button>
          <button class="rec-win-ctx-item" type="button" onclick="recWindowCtxCenter(${iid})">Center Window</button>
          <hr class="rec-win-ctx-sep">
          <button class="rec-win-ctx-item" type="button" onclick="recWindowCtxDelete(${iid})">Delete</button>
        </div>
      </div>`;
    }

    // ── Global menu (no iid needed) ──
    function recToggleMenu() {
      const dd = document.getElementById('rec-menu-dropdown');
      if (!dd) return;
      dd.classList.toggle('open');
      if (dd.classList.contains('open')) {
        const close = (e) => {
          if (!dd.contains(e.target) && e.target.id !== 'rec-hamburger-btn' && !e.target.closest('#rec-hamburger-btn')) {
            dd.classList.remove('open');
            document.removeEventListener('pointerdown', close);
          }
        };
        setTimeout(() => document.addEventListener('pointerdown', close), 0);
      }
    }
    function recMenuAction(action) {
      const dd = document.getElementById('rec-menu-dropdown');
      if (dd) dd.classList.remove('open');
      console.log('Record menu action:', action);
    }

    // ── Per-instance window management ──
    function recSyncHeadphoneBtn(iid) {
      const st = _ri(iid); if (!st) return;
      const hp = _re(iid, 'rec-headphone-btn');
      if (!hp) return;
      const isOn = !st.outputMuted;
      hp.classList.toggle('active', isOn);
      hp.title = isOn ? 'Mute output' : 'Unmute output';
    }

    function recCloseWindowBlock(iid) {
      recStopMetering(iid);
      const win = _re(iid, 'rec-window-block');
      if (win) win.remove();
      recRemoveAllLinksForWindow(iid);
      _recInstances.delete(iid);
      recRenderLinks();
    }

    function recTogglePinWindow(iid) {
      const win = _re(iid, 'rec-window-block');
      const pin = _re(iid, 'rec-pin-btn');
      if (!win || !pin) return;
      const isPinned = win.classList.toggle('rec-window-pinned');
      pin.classList.toggle('active', isPinned);
      pin.title = isPinned ? 'Unlock window' : 'Lock window';
      pin.innerHTML = isPinned
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M9 11V8a4 4 0 0 1 7.2-2.4"/></svg>';
    }

    function recToggleHeadphone(iid) { recToggleOutputMute(iid); }

    function recToggleFxPopup(iid) {
      const overlay = _re(iid, 'rec-fx-overlay');
      if (!overlay) return;
      if (overlay.classList.contains('open')) recCloseFxPopup(iid);
      else recOpenFxPopup(iid);
    }

    function recSyncFxButtons(iid) {
      const st = _ri(iid); if (!st) return;
      const open = !!_re(iid, 'rec-fx-overlay')?.classList.contains('open');
      const topBtn = _re(iid, 'rec-fx-btn');
      const miniBtn = _re(iid, 'rec-fx-mini-btn');
      if (topBtn) {
        const fxEnabled = st.fxMasterEnabled !== false;
        topBtn.classList.toggle('active', fxEnabled);
        topBtn.title = fxEnabled ? 'Disable FX' : 'Enable FX';
      }
      if (miniBtn) miniBtn.classList.toggle('active', open);
    }

    function recSetFxTab(iid, tab) {
      const st = _ri(iid); if (!st) return;
      const next = tab === 'presets' ? 'presets' : 'fx';
      st.fxTab = next;
      _re(iid, 'rec-fx-tab-btn-fx')?.classList.toggle('active', next === 'fx');
      _re(iid, 'rec-fx-tab-btn-presets')?.classList.toggle('active', next === 'presets');
      _re(iid, 'rec-fx-panel-fx')?.classList.toggle('active', next === 'fx');
      _re(iid, 'rec-fx-panel-presets')?.classList.toggle('active', next === 'presets');
      if (next === 'presets') recRenderFxPresetList(iid);
    }

    function recToggleFxTypePicker(iid) {
      const list = _re(iid, 'rec-fx-type-list');
      const btn = _re(iid, 'rec-fx-type-btn');
      if (!list) return;
      const isOpen = list.classList.contains('open');
      document.querySelectorAll('.rec-fx-type-list.open').forEach(el => el.classList.remove('open'));
      document.querySelectorAll('.rec-fx-type-btn.open').forEach(el => el.classList.remove('open'));
      if (!isOpen) {
        const st = _ri(iid);
        const selectedType = st?._fxAddType || REC_AUDIO_FX_LIBRARY[0]?.type || '';
        list.innerHTML = REC_AUDIO_FX_LIBRARY.map(fx =>
          `<div class="rec-fx-type-list-item ${fx.type === selectedType ? 'selected' : ''}" onclick="event.stopPropagation();recSelectFxType(${iid},'${fx.type}')">${esc(fx.label)}</div>`
        ).join('');
        list.classList.add('open');
        if (btn) btn.classList.add('open');
        // Close on click outside
        const closeOnOutside = (e) => {
          const picker = _re(iid, 'rec-fx-type-picker');
          if (picker && !picker.contains(e.target)) {
            list.classList.remove('open');
            if (btn) btn.classList.remove('open');
            document.removeEventListener('pointerdown', closeOnOutside, true);
          }
        };
        setTimeout(() => document.addEventListener('pointerdown', closeOnOutside, true), 0);
      }
    }

    function recSelectFxType(iid, type) {
      const st = _ri(iid);
      if (st) st._fxAddType = type;
      const label = _re(iid, 'rec-fx-type-label');
      const fx = REC_AUDIO_FX_LIBRARY.find(x => x.type === type);
      if (label && fx) label.textContent = fx.label;
      const list = _re(iid, 'rec-fx-type-list');
      const btn = _re(iid, 'rec-fx-type-btn');
      if (list) list.classList.remove('open');
      if (btn) btn.classList.remove('open');
    }

    function recOpenFxPopup(iid) {
      const st = _ri(iid); if (!st) return;
      _recLoadFxUserPresets();
      st.audioFx = _recNormalizeFxStack(st.audioFx || []);
      if (st.fxRewireTimer) {
        clearTimeout(st.fxRewireTimer);
        st.fxRewireTimer = 0;
      }
      // Set custom picker label
      const label = _re(iid, 'rec-fx-type-label');
      if (label) {
        const selectedType = st._fxAddType || REC_AUDIO_FX_LIBRARY[0]?.type || '';
        const fx = REC_AUDIO_FX_LIBRARY.find(x => x.type === selectedType);
        label.textContent = fx ? fx.label : (REC_AUDIO_FX_LIBRARY[0]?.label || 'High-pass Clean');
      }
      const overlay = _re(iid, 'rec-fx-overlay');
      if (overlay) overlay.classList.add('open');
      recSetFxTab(iid, st.fxTab || 'fx');
      recRenderFxMasterControls(iid);
      recRenderFxList(iid);
      recRenderFxPresetList(iid);
      recSyncFxButtons(iid);
    }

    function recCloseFxPopup(iid, e) {
      if (e && e.target !== e.currentTarget) return;
      const overlay = _re(iid, 'rec-fx-overlay');
      if (overlay) overlay.classList.remove('open');
      recSyncFxButtons(iid);
    }

    function recRenderFxMasterControls(iid) {
      const st = _ri(iid); if (!st) return;
      const powerBtn = _re(iid, 'rec-fx-power-btn');
      if (powerBtn) powerBtn.classList.toggle('off', st.fxMasterEnabled === false);
    }

    function recRenderFxList(iid) {
      const st = _ri(iid); if (!st) return;
      const host = _re(iid, 'rec-fx-list');
      if (!host) return;
      st.audioFx = _recNormalizeFxStack(st.audioFx || []);
      if (!st.audioFx.length) {
        host.innerHTML = '<div class="rec-fx-item-empty">No FX in stack. Add one above.</div>';
      } else {
        if (!st.fxSelectedId && st.audioFx[0]) st.fxSelectedId = st.audioFx[0].id;
        if (st.fxSelectedId && !st.audioFx.find((x) => x.id === st.fxSelectedId)) st.fxSelectedId = st.audioFx[0]?.id || '';
        host.innerHTML = st.audioFx.map((fx, idx) => `
          <div class="rec-fx-item ${st.fxSelectedId === fx.id ? 'active' : ''}" data-fx-id="${fx.id}" data-fx-idx="${idx}" onclick="recSelectEffect(${iid},'${fx.id}')" onpointerdown="_recFxPointerDown(event,${iid})">
            ${recFxEnabledEyeSvg(iid, fx.id, fx.enabled !== false)}
            <div class="rec-fx-item-title">${esc(_recFxLabel(fx.type))}</div>
          </div>
        `).join('');
      }
      if (!st.fxSelectedId && st.audioFx[0]) st.fxSelectedId = st.audioFx[0].id;
      if (st.fxSelectedId && !st.audioFx.find((x) => x.id === st.fxSelectedId)) st.fxSelectedId = st.audioFx[0]?.id || '';
      recRenderFxEditor(iid);
      recRenderFxMasterControls(iid);
    }

    function recFxEnabledEyeSvg(iid, fxId, enabled) {
      const isHidden = enabled === false;
      const eyeClass = isHidden ? 'sli-eye hidden' : 'sli-eye';
      const hiddenFlag = isHidden ? '1' : '0';
      const eyeOpacity = isHidden ? 0.52 : 0.82;
      return `<svg class="${eyeClass}" data-hidden="${hiddenFlag}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" onclick="event.stopPropagation();recToggleEffectEnabled(${iid},'${fxId}')" style="opacity:${eyeOpacity}"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line class="eye-slash" x1="3" y1="21" x2="21" y2="3"/></svg>`;
    }

    function recRenderFxEditor(iid) {
      const st = _ri(iid); if (!st) return;
      const host = _re(iid, 'rec-fx-editor');
      if (!host) return;
      const fx = (st.audioFx || []).find((x) => x.id === st.fxSelectedId);
      if (!fx) {
        host.innerHTML = '<div class="rec-fx-item-empty">Select an effect to edit parameters.</div>';
        return;
      }
      const rows = [];
      const addParam = (key, label, min, max, step, suffix, transform) => {
        const val = Number(fx.params?.[key] ?? min);
        const shown = recFormatFxParamValue(fx.type, key, val, suffix, transform);
        rows.push(`
          <div class="rec-fx-param">
            <label>${label}</label>
            <input type="range" min="${min}" max="${max}" step="${step}" value="${val}" oninput="_paintRecFxSlider(this);recSetEffectParam(${iid},'${fx.id}','${key}',this.value)">
            <span id="rec-fx-param-val-${fx.id}-${key}">${shown}</span>
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
      host.innerHTML = `<div class="rec-fx-editor-title">${esc(_recFxLabel(fx.type))}</div>${rows.join('')}`;
      host.querySelectorAll('input[type="range"]').forEach(s => _paintRecFxSlider(s));
    }

    function recFormatFxParamValue(type, key, value, suffix, transform) {
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

    /* ── Rec FX: Pointer-based sortable drag ── */
    let _recFxDragIdx = -1;
    let _recFxDragActive = false;
    let _recFxDragStartY = 0;
    let _recFxDragCurrentIdx = -1;
    let _recFxDragItems = [];
    let _recFxDragItemH = 0;
    let _recFxDragSuppressClick = false;
    let _recFxDragIid = -1;

    function _recFxPointerDown(e, iid) {
      // Prevent bubbling into the record-window drag handler while reordering FX.
      e.stopPropagation();
      if (e.target.closest('.sli-eye')) return;
      const item = e.currentTarget;
      const host = _re(iid, 'rec-fx-list');
      if (!host) return;
      const idx = parseInt(item.dataset.fxIdx, 10);
      _recFxDragIid = iid;
      _recFxDragIdx = idx;
      _recFxDragCurrentIdx = idx;
      _recFxDragActive = false;
      _recFxDragSuppressClick = false;
      _recFxDragStartY = e.clientY;
      _recFxDragItems = Array.from(host.querySelectorAll('.rec-fx-item'));
      if (_recFxDragItems.length > 0) {
        const r = _recFxDragItems[0].getBoundingClientRect();
        const gap = _recFxDragItems.length > 1
          ? _recFxDragItems[1].getBoundingClientRect().top - r.bottom
          : 0;
        _recFxDragItemH = r.height + gap;
      }
      item.setPointerCapture(e.pointerId);
      item.addEventListener('pointermove', _recFxPointerMove);
      item.addEventListener('pointerup', _recFxPointerUp);
      item.addEventListener('pointercancel', _recFxPointerUp);
    }

    function _recFxPointerMove(e) {
      const dy = e.clientY - _recFxDragStartY;
      if (!_recFxDragActive && Math.abs(dy) < 4) return;
      if (!_recFxDragActive) {
        _recFxDragActive = true;
        _recFxDragSuppressClick = true;
        _recFxDragItems[_recFxDragIdx]?.classList.add('sortable-ghost');
      }
      const dragEl = _recFxDragItems[_recFxDragIdx];
      if (dragEl) dragEl.style.transform = `translateY(${dy}px)`;
      const items = _recFxDragItems;
      const fromIdx = _recFxDragIdx;
      const shift = Math.round(dy / _recFxDragItemH);
      let toIdx = Math.max(0, Math.min(items.length - 1, fromIdx + shift));
      _recFxDragCurrentIdx = toIdx;
      items.forEach((el, i) => {
        el.classList.remove('sortable-shift-down', 'sortable-shift-up');
        el.style.setProperty('--sortable-shift', _recFxDragItemH + 'px');
        if (i === fromIdx) return;
        if (fromIdx < toIdx && i > fromIdx && i <= toIdx) {
          el.classList.add('sortable-shift-up');
        } else if (fromIdx > toIdx && i >= toIdx && i < fromIdx) {
          el.classList.add('sortable-shift-down');
        }
      });
    }

    function _recFxPointerUp(e) {
      const item = e.currentTarget;
      item.removeEventListener('pointermove', _recFxPointerMove);
      item.removeEventListener('pointerup', _recFxPointerUp);
      item.removeEventListener('pointercancel', _recFxPointerUp);
      const fromIdx = _recFxDragIdx;
      const toIdx = _recFxDragCurrentIdx;
      const iid = _recFxDragIid;
      _recFxDragItems.forEach(el => {
        el.classList.remove('sortable-ghost', 'sortable-shift-down', 'sortable-shift-up');
        el.style.transform = '';
      });
      if (_recFxDragActive && fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
        const st = _ri(iid);
        if (st && Array.isArray(st.audioFx)) {
          const [moved] = st.audioFx.splice(fromIdx, 1);
          st.audioFx.splice(toIdx, 0, moved);
          recRenderFxList(iid);
          recRewireFxGraph(iid);
        }
      }
      if (_recFxDragSuppressClick) {
        item.addEventListener('click', function suppress(ev) {
          ev.stopImmediatePropagation();
          item.removeEventListener('click', suppress, true);
        }, true);
      }
      _recFxDragIdx = -1;
      _recFxDragCurrentIdx = -1;
      _recFxDragActive = false;
      _recFxDragItems = [];
      _recFxDragIid = -1;
    }

    /* ── Rec FX: Slider track fill paint ── */
    function _paintRecFxSlider(el) {
      const min = Number.isFinite(parseFloat(el.min)) ? parseFloat(el.min) : 0;
      const max = Number.isFinite(parseFloat(el.max)) ? parseFloat(el.max) : 100;
      const val = Number.isFinite(parseFloat(el.value)) ? parseFloat(el.value) : 0;
      const pct = max !== min ? ((val - min) / (max - min)) * 100 : 0;
      const thumbW = 16;
      const offset = thumbW / 2 - (pct / 100) * thumbW;
      el.style.background = `linear-gradient(90deg, var(--rec-accent, #B400FF) calc(${pct}% + ${offset}px), #17191B calc(${pct}% + ${offset}px))`;
    }

    function recScheduleFxRewire(iid, delayMs = 140) {
      const st = _ri(iid); if (!st) return;
      if (st.fxRewireTimer) clearTimeout(st.fxRewireTimer);
      const delay = Math.max(0, Number(delayMs) || 0);
      st.fxRewireTimer = setTimeout(() => {
        const latest = _ri(iid);
        if (!latest) return;
        latest.fxRewireTimer = 0;
        recRewireFxGraph(iid);
      }, delay);
    }

    function recRenderFxPresetList(iid) {
      const host = _re(iid, 'rec-fx-preset-list');
      if (!host) return;
      const presets = _recAllFxPresets();
      if (!presets.length) {
        host.innerHTML = '<div class="rec-fx-item-empty">No presets available.</div>';
        return;
      }
      host.innerHTML = presets.map((p) => `
        <div class="rec-fx-preset-row">
          <div class="rec-fx-preset-name" title="${esc(p.name)}">${esc(p.name)}</div>
          <button class="rec-fx-btn secondary" type="button" onclick="recApplyFxPreset(${iid},'${esc(p.id)}')">Load</button>
          ${p.builtin ? '<span></span>' : `<button class="rec-fx-btn secondary" type="button" onclick="recDeleteFxPreset('${esc(p.id)}');recRenderFxPresetList(${iid})">Delete</button>`}
        </div>
      `).join('');
    }

    function recAddEffect(iid) {
      const st = _ri(iid); if (!st) return;
      const type = st._fxAddType || REC_AUDIO_FX_LIBRARY[0]?.type || 'reverb';
      st.audioFx = _recNormalizeFxStack(st.audioFx || []);
      const fx = _recMakeFxByType(type);
      st.audioFx.push(fx);
      st.fxSelectedId = fx.id;
      recRenderFxList(iid);
      recRewireFxGraph(iid);
    }

    function recSelectEffect(iid, fxId) {
      const st = _ri(iid); if (!st) return;
      st.fxSelectedId = fxId;
      recRenderFxList(iid);
    }

    function _setRecFxEyeUi(iid, fxId, enabled) {
      const row = _re(iid, 'rec-fx-list')?.querySelector(`.rec-fx-item[data-fx-id="${fxId}"]`);
      if (!row) return;
      const eye = row.querySelector('.sli-eye');
      if (!eye) return;
      const hidden = enabled === false;
      eye.classList.toggle('hidden', hidden);
      eye.dataset.hidden = hidden ? '1' : '0';
      eye.style.opacity = hidden ? '0.52' : '0.82';
    }

    function recToggleEffectEnabled(iid, fxId) {
      const st = _ri(iid); if (!st) return;
      const fx = (st.audioFx || []).find((x) => x.id === fxId);
      if (!fx) return;
      fx.enabled = fx.enabled === false;
      _setRecFxEyeUi(iid, fxId, fx.enabled !== false);
      recScheduleFxRewire(iid, 24);
    }

    function recDeleteEffect(iid, fxId) {
      const st = _ri(iid); if (!st) return;
      st.audioFx = _recNormalizeFxStack(st.audioFx || []).filter((x) => x.id !== fxId);
      if (st.fxSelectedId === fxId) st.fxSelectedId = st.audioFx[0]?.id || '';
      recRenderFxList(iid);
      recRewireFxGraph(iid);
    }

    function recSetEffectParam(iid, fxId, key, val) {
      const st = _ri(iid); if (!st) return;
      const fx = (st.audioFx || []).find((x) => x.id === fxId);
      if (!fx) return;
      const num = Number(val);
      const nextVal = Number.isFinite(num) ? num : val;
      fx.params[key] = nextVal;
      const valueEl = document.getElementById(`rec-fx-param-val-${fx.id}-${key}`);
      if (valueEl) valueEl.textContent = recFormatFxParamValue(fx.type, key, nextVal);
      if (_recApplyFxParamInPlace(iid, fx, key, nextVal)) return;
      recScheduleFxRewire(iid);
    }

    function _recApplyFxParamInPlace(iid, fx, key, value) {
      const st = _ri(iid); if (!st || !st.fxRuntimeById) return false;
      const runtimeNode = st.fxRuntimeById[fx.id];
      if (!runtimeNode) return false;
      return _applyFxParamInPlace(runtimeNode, fx.type, key, value, st.audioCtx || null);
    }

    function recToggleFxMaster(iid) {
      const st = _ri(iid); if (!st) return;
      st.fxMasterEnabled = st.fxMasterEnabled === false;
      recRenderFxMasterControls(iid);
      recSyncFxButtons(iid);
      recRewireFxGraph(iid);
    }

    function recToggleFxBypass(iid) {
      const st = _ri(iid); if (!st) return;
      st.fxBypass = !st.fxBypass;
      recRenderFxMasterControls(iid);
      recRewireFxGraph(iid);
    }

    function recApplyFxPreset(iid, presetId) {
      const st = _ri(iid); if (!st) return;
      const p = _recAllFxPresets().find((x) => String(x.id) === String(presetId));
      if (!p) return;
      st.audioFx = _recNormalizeFxStack(p.stack || []).map((fx) => ({
        id: _recMakeFxId(),
        type: fx.type,
        enabled: fx.enabled !== false,
        params: { ...(fx.params || {}) }
      }));
      st.fxSelectedId = st.audioFx[0]?.id || '';
      recSetFxTab(iid, 'fx');
      recRenderFxList(iid);
      recRewireFxGraph(iid);
      if (typeof showToast === 'function') showToast(`Loaded preset: ${p.name}`);
    }

    function recSaveFxPreset(iid) {
      const st = _ri(iid); if (!st) return;
      const nameEl = _re(iid, 'rec-fx-save-name');
      const name = String(nameEl?.value || '').trim();
      if (!name) { if (typeof showToast === 'function') showToast(t('preset_name_required')); return; }
      const chain = _recNormalizeFxStack(st.audioFx || []);
      if (!chain.length) { if (typeof showToast === 'function') showToast(t('fx_no_effects_to_save')); return; }
      const existing = _recFxUserPresets.find((p) => String(p.name).toLowerCase() === name.toLowerCase());
      const payload = {
        id: existing ? existing.id : ('rec-user-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)),
        name,
        builtin: false,
        stack: chain.map((fx) => ({ type: fx.type, enabled: fx.enabled !== false, params: { ...(fx.params || {}) } }))
      };
      if (existing) Object.assign(existing, payload);
      else _recFxUserPresets.push(payload);
      _recSaveFxUserPresets();
      if (nameEl) nameEl.value = '';
      recRenderFxPresetList(iid);
      if (typeof showToast === 'function') showToast(t('preset_saved'));
    }

    function recDeleteFxPreset(presetId) {
      const idx = _recFxUserPresets.findIndex((p) => String(p.id) === String(presetId));
      if (idx < 0) return;
      _recFxUserPresets.splice(idx, 1);
      _recSaveFxUserPresets();
      if (typeof showToast === 'function') showToast(t('preset_deleted'));
    }

    function recHexToRgba(hex, alpha) {
      const clean = String(hex || '').replace('#', '').trim();
      if (!/^[0-9a-fA-F]{6}$/.test(clean)) return `rgba(132,160,196,${alpha})`;
      const r = parseInt(clean.slice(0, 2), 16);
      const g = parseInt(clean.slice(2, 4), 16);
      const b = parseInt(clean.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function recHexToRgbTuple(hex) {
      const clean = String(hex || '').replace('#', '').trim();
      if (!/^[0-9a-fA-F]{6}$/.test(clean)) return '180, 0, 255';
      const r = parseInt(clean.slice(0, 2), 16);
      const g = parseInt(clean.slice(2, 4), 16);
      const b = parseInt(clean.slice(4, 6), 16);
      return `${r}, ${g}, ${b}`;
    }

    function recApplyWindowColor(iid, color) {
      const st = _ri(iid);
      const win = _re(iid, 'rec-window-block');
      const recsPage = _re(iid, 'rec-w-page-recordings');
      if (!st || !win) return;
      st.windowColor = String(color || '#84A0C4').toUpperCase();
      win.style.setProperty('--rec-accent', st.windowColor);
      win.style.setProperty('--rec-accent-rgb', recHexToRgbTuple(st.windowColor));
      win.style.borderColor = recHexToRgba(st.windowColor, 0.7);
      win.style.boxShadow = `0 30px 80px rgba(0,0,0,0.62), 0 0 0 1px ${recHexToRgba(st.windowColor, 0.26)}`;
      if (recsPage) recsPage.style.background = st.windowColor;
      const menu = _re(iid, 'rec-window-context-menu');
      if (menu) {
        menu.querySelectorAll('.rec-win-ctx-color-btn').forEach((btn) => {
          btn.classList.toggle('active', String(btn.dataset.color || '').toUpperCase() === st.windowColor);
        });
      }
    }

    function recApplyWindowDesign(iid, mode) {
      const st = _ri(iid);
      const win = _re(iid, 'rec-window-block');
      if (!st || !win) return;
      const nextMode = (mode === 'studio') ? 'studio' : 'classic';
      st.designMode = nextMode;
      win.classList.toggle('design-studio', nextMode === 'studio');
      win.classList.toggle('design-classic', nextMode !== 'studio');
      const menu = _re(iid, 'rec-window-context-menu');
      if (menu) {
        menu.querySelectorAll('.rec-win-ctx-design-btn').forEach((btn) => {
          btn.classList.toggle('active', String(btn.dataset.design || '') === nextMode);
        });
      }
    }

    function recCloseWindowContextMenu(iid) {
      const menu = _re(iid, 'rec-window-context-menu');
      if (menu) menu.classList.remove('open');
    }

    function recOpenWindowContextMenu(iid, event) {
      const win = _re(iid, 'rec-window-block');
      const menu = _re(iid, 'rec-window-context-menu');
      if (!win || !menu) return;
      if (event.target.closest('.rec-item') || event.target.closest('.rec-recs-context-menu') || event.target.closest('.rec-window-context-menu')) return;
      event.preventDefault();
      recCloseContextMenu(iid);
      const rect = win.getBoundingClientRect();
      const x = Math.max(8, Math.min(event.clientX - rect.left + 8, win.clientWidth - 260));
      const y = Math.max(8, Math.min(event.clientY - rect.top + 8, win.clientHeight - 370));
      menu.style.left = `${x}px`;
      menu.style.top = `${y}px`;
      menu.classList.add('open');
      recApplyWindowColor(iid, _ri(iid)?.windowColor || '#84A0C4');
      recApplyWindowDesign(iid, _ri(iid)?.designMode || 'studio');
    }

    function recWindowCtxRename(iid) {
      recCloseWindowContextMenu(iid);
      const input = _re(iid, 'rec-project-title');
      if (!input) return;
      const next = window.prompt('Rename window', (input.value || '').trim() || 'Untitled Project');
      if (next == null) return;
      const clean = String(next).trim();
      if (!clean) return;
      input.value = clean;
    }

    function recWindowCtxSetColor(iid, color) {
      recApplyWindowColor(iid, color);
      const skinHex = _outlineToSkinMap[String(color || '').toUpperCase()] || null;
      recApplyWindowSkin(iid, skinHex);
    }

    function recWindowCtxSetDesign(iid, mode) {
      recApplyWindowDesign(iid, mode);
      recCloseWindowContextMenu(iid);
    }

    // ── Skin color helpers ──
    const _outlineToSkinMap = {
      '#B400FF': '#1a1025',
      '#3398FF': '#0c1a2e',
      '#0E1824': '#111a24',
      '#17C9D4': '#0f2026',
      '#09C67A': '#0d1f1a',
      '#FDB515': '#26200f',
      '#FF760E': '#26170d',
      '#FF2B1E': '#1a0a0a',
      '#090B13': '#090b13',
      '#5B3A29': '#1d140f',
      '#8C6A43': '#241b12',
      '#4F5D3A': '#141b11',
      '#7A3F6A': '#231322',
      '#3E4B5C': '#121923',
      '#6B2E2E': '#220f0f',
      '#3F4A3A': '#121811',
    };
    const _recOutlinePalette = Object.keys(_outlineToSkinMap);

    function recPickRandomOutlineColor() {
      if (!_recOutlinePalette.length) return '#84A0C4';
      const weighted = [];
      _recOutlinePalette.forEach((hex) => {
        const w = (hex === '#090B13') ? 5 : 1; // Night appears more often, but not guaranteed.
        for (let i = 0; i < w; i++) weighted.push(hex);
      });
      const idx = Math.floor(Math.random() * weighted.length);
      return weighted[idx] || _recOutlinePalette[0];
    }

    const _skinAccentMap = {
      '#1a1025': { accent: '#c78dff', bg1: '#1a1025', bg2: '#130b1c' },
      '#0c1a2e': { accent: '#6db3ff', bg1: '#0c1a2e', bg2: '#081425' },
      '#111a24': { accent: '#4E647E', bg1: '#111a24', bg2: '#0c141d' },
      '#0f2026': { accent: '#17C9D4', bg1: '#0f2026', bg2: '#0a171c' },
      '#0d1f1a': { accent: '#5ee8a8', bg1: '#0d1f1a', bg2: '#091812' },
      '#26200f': { accent: '#FDB515', bg1: '#26200f', bg2: '#1a160a' },
      '#26170d': { accent: '#FF760E', bg1: '#26170d', bg2: '#1b1009' },
      '#1f1410': { accent: '#ffa86a', bg1: '#1f1410', bg2: '#18100b' },
      '#1a0a0a': { accent: '#ff7070', bg1: '#1a0a0a', bg2: '#140707' },
      '#181818': { accent: '#b0b0b0', bg1: '#181818', bg2: '#111111' },
      '#090b13': { accent: '#8ea0bf', bg1: '#090b13', bg2: '#070a10' },
      '#1d140f': { accent: '#caa07d', bg1: '#1d140f', bg2: '#140e0a' },
      '#241b12': { accent: '#d7b48a', bg1: '#241b12', bg2: '#19130d' },
      '#141b11': { accent: '#a9be87', bg1: '#141b11', bg2: '#0f140c' },
      '#231322': { accent: '#d596c3', bg1: '#231322', bg2: '#190e18' },
      '#121923': { accent: '#9fb1c8', bg1: '#121923', bg2: '#0c1118' },
      '#220f0f': { accent: '#d38f8f', bg1: '#220f0f', bg2: '#180b0b' },
      '#121811': { accent: '#9db394', bg1: '#121811', bg2: '#0d110c' },
    };

    function recApplyWindowSkin(iid, skinHex) {
      const st = _ri(iid);
      const win = _re(iid, 'rec-window-block');
      if (!st || !win) return;
      st.skinColor = skinHex || null;

      if (!skinHex) {
        // Reset to default
        win.style.background = '';
        win.querySelectorAll('.rec-w-title').forEach(el => el.style.color = '');
        win.querySelectorAll('.rec-w-label').forEach(el => el.style.color = '');
        win.querySelectorAll('.rec-w-select').forEach(el => el.style.color = '');
        win.querySelectorAll('.rec-w-time').forEach(el => el.style.color = '');
        win.querySelectorAll('.rec-w-row svg, .rec-w-strips-label svg').forEach(el => el.style.color = '');
        win.querySelectorAll('.rec-w-strip-name').forEach(el => el.style.color = '');
        win.querySelectorAll('.rec-w-strip-db').forEach(el => el.style.color = '');
        win.querySelectorAll('.rec-w-strip-fill').forEach(el => el.style.background = '');
        win.querySelectorAll('.rec-w-footer').forEach(el => el.style.borderTopColor = '');
        win.querySelectorAll('.rec-w-divider').forEach(el => el.style.background = '');
        return;
      }

      const info = _skinAccentMap[skinHex.toLowerCase()] || { accent: '#aaa', bg1: skinHex, bg2: skinHex };
      const accent = info.accent;
      const key = String(skinHex || '').toLowerCase();
      const isLowContrastSkin = key === '#090b13' || key === '#111a24';
      const titleColor = isLowContrastSkin ? '#ffffff' : accent;
      const labelColor = isLowContrastSkin ? '#ffffff' : recHexToRgba(accent, 0.45);
      const selectColor = isLowContrastSkin ? '#ffffff' : recHexToRgba(accent, 0.75);
      const stripNameColor = isLowContrastSkin ? '#ffffff' : recHexToRgba(accent, 0.55);
      const stripDbColor = isLowContrastSkin ? '#ffffff' : recHexToRgba(accent, 0.4);
      const iconColor = isLowContrastSkin ? '#ffffff' : accent;

      // Background
      win.style.background = `linear-gradient(180deg, ${info.bg1} 0%, ${info.bg2} 100%)`;

      // Title
      win.querySelectorAll('.rec-w-title').forEach(el => el.style.color = titleColor);

      // Labels
      win.querySelectorAll('.rec-w-label').forEach(el => el.style.color = labelColor);

      // Selects
      win.querySelectorAll('.rec-w-select').forEach(el => el.style.color = selectColor);

      // Timer
      win.querySelectorAll('.rec-w-time').forEach(el => el.style.color = titleColor);

      // SVG icons in rows
      win.querySelectorAll('.rec-w-row svg, .rec-w-strips-label svg').forEach(el => el.style.color = iconColor);

      // Strip labels + dB
      win.querySelectorAll('.rec-w-strip-name').forEach(el => el.style.color = stripNameColor);
      win.querySelectorAll('.rec-w-strip-db').forEach(el => el.style.color = stripDbColor);

      // Meter fill
      win.querySelectorAll('.rec-w-strip-fill').forEach(el => el.style.background = accent);

      // Footer border
      win.querySelectorAll('.rec-w-footer').forEach(el => el.style.borderTopColor = recHexToRgba(accent, 0.12));

      // Dividers
      win.querySelectorAll('.rec-w-divider').forEach(el => el.style.background = recHexToRgba(accent, 0.1));

    }

    function recWindowCtxSetSkin(iid, skinHex) {
      recApplyWindowSkin(iid, skinHex);
    }

    function recWindowCtxDelete(iid) {
      recCloseWindowContextMenu(iid);
      recCloseWindowBlock(iid);
    }

    function recWindowCtxCenter(iid) {
      recCloseWindowContextMenu(iid);
      recCenterWindowBlock(iid, true);
    }

    function recWindowCtxDuplicate(iid) {
      recCloseWindowContextMenu(iid);
      const srcWin = _re(iid, 'rec-window-block');
      const srcTitle = _re(iid, 'rec-project-title');
      const srcState = _ri(iid);
      const newIid = recAddTrack();
      if (!newIid) return;
      const newTitle = _re(newIid, 'rec-project-title');
      if (newTitle && srcTitle) newTitle.value = srcTitle.value;
      if (srcState && srcState.windowColor) recApplyWindowColor(newIid, srcState.windowColor);
      if (srcState && srcState.skinColor) recApplyWindowSkin(newIid, srcState.skinColor);
      if (srcState && srcState.designMode) recApplyWindowDesign(newIid, srcState.designMode);
      if (srcState && Array.isArray(srcState.audioFx)) {
        const dst = _ri(newIid);
        if (dst) {
          dst.audioFx = _recNormalizeFxStack(srcState.audioFx).map((fx) => ({
            id: _recMakeFxId(),
            type: fx.type,
            enabled: fx.enabled !== false,
            params: { ...(fx.params || {}) }
          }));
          dst.fxMasterEnabled = srcState.fxMasterEnabled !== false;
          dst.fxBypass = !!srcState.fxBypass;
        }
      }
      if (srcWin) {
        const newWin = _re(newIid, 'rec-window-block');
        if (newWin) {
          const l = parseFloat(srcWin.style.left || '0') || 0;
          const t = parseFloat(srcWin.style.top || '0') || 0;
          newWin.style.left = `${l + 24}px`;
          newWin.style.top = `${t + 24}px`;
          newWin.dataset.userMoved = '1';
          recRenderLinks();
        }
      }
    }

    // ── Add Track: create new instance ──
    function recAddTrack() {
      const iid = ++_recNextIid;
      const st = _recCreateState();
      if (iid === 1) {
        // First window: all colors are possible, but red has higher probability.
        if (Math.random() < 0.7) st.windowColor = '#FF2B1E';
        else st.windowColor = recPickRandomOutlineColor();
      } else {
        st.windowColor = recPickRandomOutlineColor();
      }
      _recInstances.set(iid, st);
      const container = document.getElementById('rec-instances-container');
      if (!container) return;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = recWindowHTML(iid);
      const win = wrapper.firstElementChild;
      container.appendChild(win);
      const linkLayer = document.getElementById('rec-link-layer');
      if (linkLayer && linkLayer.parentElement === container) container.appendChild(linkLayer);
      win.addEventListener('pointerdown', (e) => recStartWindowDrag(iid, e));
      win.addEventListener('contextmenu', (e) => recOpenWindowContextMenu(iid, e));
      // New windows always appear above existing ones
      win.style.zIndex = ++_recNextZOrder + 1000;
      recApplyWindowColor(iid, st.windowColor);
      recApplyWindowSkin(iid, _outlineToSkinMap[st.windowColor] || null);
      recApplyWindowDesign(iid, st.designMode || 'studio');
      recCenterWindowBlock(iid, true);
      recRenderLinks();
      // Set up per-instance input/output change listeners
      const inputSel = _re(iid, 'rec-input-src');
      if (inputSel) {
        inputSel.addEventListener('change', () => {
          recUpdateChannelOptions(iid);
          const pg = document.getElementById('page-record');
          if (pg && pg.classList.contains('active')) {
            recStopMetering(iid);
            setTimeout(() => recStartMetering(iid), 100);
          }
        });
      }
      const outputSel = _re(iid, 'rec-output-src');
      if (outputSel) {
        outputSel.addEventListener('change', () => {
          const pg = document.getElementById('page-record');
          if (pg && pg.classList.contains('active')) {
            recApplyOutputMonitoringImmediate(iid);
            recApplyOutputMonitoring(iid);
          }
        });
      }
      // Initialize this instance
      recSyncHeadphoneBtn(iid);
      recSyncFxButtons(iid);
      recUpdateSaveToBtn(iid);
      recUpdateRecordingsToolbar(iid);
      recInitSaveDir(iid);
      recPopulateDeviceSelects(iid);
      recEnumerateDevicesGlobal().then(() => {
        recPopulateDeviceSelects(iid);
        recStartMetering(iid);
      });
      return iid;
    }

    // ── Window drag (per-instance) ──
    function recCenterWindowBlock(iid, force) {
      const main = document.getElementById('rec-instances-container');
      const win = _re(iid, 'rec-window-block');
      if (!main || !win) return;
      if (!force && win.dataset.userMoved === '1') return;
      const ww = win.offsetWidth || 400;
      const wh = win.offsetHeight || 450;
      const topInset = recGetWindowTopInset();
      // Offset each instance slightly so they don't stack exactly
      const count = _recInstances.size;
      const offset = Math.max(0, (count - 1) * 30);
      const left = Math.max(0, (main.clientWidth - ww) / 2 + offset);
      const maxTop = Math.max(topInset, main.clientHeight - wh);
      const top = Math.max(topInset, Math.min((main.clientHeight - wh) / 2 + offset, maxTop));
      win.style.left = `${left}px`;
      win.style.top = `${top}px`;
      win.dataset.userMoved = '0';
      recRenderLinks();
    }

    function recGetWindowTopInset() {
      const main = document.getElementById('rec-instances-container');
      const topbar = document.querySelector('#page-record .rec-topbar');
      if (!main || !topbar) return 10;
      const mainRect = main.getBoundingClientRect();
      const topbarRect = topbar.getBoundingClientRect();
      return Math.max(30, Math.ceil(topbarRect.bottom - mainRect.top + 30));
    }

    function recStartWindowDrag(iid, e) {
      const st = _ri(iid); if (!st) return;
      const win = _re(iid, 'rec-window-block');
      const main = document.getElementById('rec-instances-container');
      if (!win || !main) return;
      if (win.classList.contains('rec-window-pinned')) return;
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target.closest('button,input,select,textarea,a,label')) return;
      const winRect = win.getBoundingClientRect();
      st.winDrag = { dx: e.clientX - winRect.left, dy: e.clientY - winRect.top };
      _recDraggingIid = iid;
      win.classList.add('rec-dragging');
      // Bring to front
      win.style.zIndex = ++_recNextZOrder + 1000;
      document.addEventListener('pointermove', _recGlobalOnDrag);
      document.addEventListener('pointerup', _recGlobalStopDrag);
      e.preventDefault();
    }

    function _recGlobalOnDrag(e) {
      if (_recDraggingIid == null) return;
      const iid = _recDraggingIid;
      const st = _ri(iid); if (!st || !st.winDrag) return;
      const win = _re(iid, 'rec-window-block');
      const main = document.getElementById('rec-instances-container');
      if (!win || !main) return;
      const mainRect = main.getBoundingClientRect();
      const ww = win.offsetWidth || 400;
      const wh = win.offsetHeight || 450;
      const topInset = recGetWindowTopInset();
      let left = e.clientX - mainRect.left - st.winDrag.dx;
      let top = e.clientY - mainRect.top - st.winDrag.dy;
      left = Math.max(0, Math.min(left, Math.max(0, main.clientWidth - ww)));
      top = Math.max(topInset, Math.min(top, Math.max(topInset, main.clientHeight - wh)));
      win.style.left = `${left}px`;
      win.style.top = `${top}px`;
      win.dataset.userMoved = '1';
      recRenderLinks();
    }

    function _recGlobalStopDrag() {
      if (_recDraggingIid != null) {
        const win = _re(_recDraggingIid, 'rec-window-block');
        if (win) win.classList.remove('rec-dragging');
        const st = _ri(_recDraggingIid);
        if (st) st.winDrag = null;
      }
      _recDraggingIid = null;
      document.removeEventListener('pointermove', _recGlobalOnDrag);
      document.removeEventListener('pointerup', _recGlobalStopDrag);
    }

    // ── Popup functions ──
    function recToggleAdvanced(iid) {
      const overlay = _re(iid, 'rec-ch-overlay');
      if (overlay) overlay.classList.add('open');
    }
    function recCloseAdvanced(iid, e) {
      if (e && e.target !== e.currentTarget) return;
      const overlay = _re(iid, 'rec-ch-overlay');
      if (overlay) overlay.classList.remove('open');
    }
    function recOpenGainPopup(iid) {
      const st = _ri(iid); if (!st) return;
      const overlay = _re(iid, 'rec-gain-overlay');
      if (!overlay) return;
      const slider = _re(iid, 'rec-gain-slider');
      const display = _re(iid, 'rec-gain-value');
      if (slider) slider.value = Math.round(st.inputGainValue * 100);
      if (display) display.textContent = Math.round(st.inputGainValue * 100) + '%';
      overlay.classList.add('open');
    }
    function recCloseGainPopup(iid, e) {
      if (e && e.target !== e.currentTarget) return;
      const overlay = _re(iid, 'rec-gain-overlay');
      if (overlay) overlay.classList.remove('open');
    }
    function recSetInputGain(iid, val) {
      const st = _ri(iid); if (!st) return;
      const pct = parseInt(val, 10);
      const gain = pct / 100;
      st.inputGainValue = gain;
      const display = _re(iid, 'rec-gain-value');
      if (display) display.textContent = pct + '%';
      if (st.inputGain && st.audioCtx) {
        st.inputGain.gain.setTargetAtTime(gain, st.audioCtx.currentTime, 0.02);
      }
    }

    // ── Global device helpers ──
    function recResolveDefaultDeviceId(kind, selectedId) {
      if (selectedId && selectedId !== 'default') return selectedId;
      const list = kind === 'audiooutput' ? _recDeviceCache.outputs : _recDeviceCache.inputs;
      if (!Array.isArray(list) || list.length === 0) return 'default';
      const defaultEntry = list.find(d => d.deviceId === 'default');
      if (defaultEntry && defaultEntry.groupId) {
        const physical = list.find(d => d.deviceId !== 'default' && d.groupId === defaultEntry.groupId);
        if (physical) return physical.deviceId;
      }
      const labeledDefault = list.find(d => d.deviceId !== 'default' && /default/i.test(d.label || ''));
      if (labeledDefault) return labeledDefault.deviceId;
      const firstPhysical = list.find(d => d.deviceId !== 'default' && d.deviceId !== 'communications');
      return firstPhysical ? firstPhysical.deviceId : 'default';
    }

    async function recGetInputStream(deviceId, { preferStereo = true } = {}) {
      const resolvedDeviceId = recResolveDefaultDeviceId('audioinput', deviceId || 'default');
      const isDefault = !resolvedDeviceId || resolvedDeviceId === 'default';
      const attempts = [];
      const buildAudioConstraints = (withExactDevice = false, withStereo = preferStereo) => {
        const c = {
          echoCancellation: false, noiseSuppression: false, autoGainControl: false,
          latency: { ideal: 0.0, max: 0.01 }
        };
        if (withStereo) c.channelCount = { ideal: 2 };
        if (withExactDevice && !isDefault) c.deviceId = { exact: resolvedDeviceId };
        return {
          audio: {
            ...c,
            // Browser-specific low-latency hints (ignored where unsupported).
            googEchoCancellation: false,
            googAutoGainControl: false,
            googNoiseSuppression: false,
            googHighpassFilter: false
          }
        };
      };
      if (!isDefault) {
        attempts.push(buildAudioConstraints(true, preferStereo));
        attempts.push(buildAudioConstraints(true, false));
      }
      attempts.push(buildAudioConstraints(false, preferStereo));
      attempts.push(buildAudioConstraints(false, false));
      attempts.push({ audio: true });
      let lastError = null;
      for (const constraints of attempts) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          const track = stream.getAudioTracks()[0];
          if (track && typeof track.applyConstraints === 'function') {
            try {
              await track.applyConstraints({
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                latency: 0
              });
            } catch (_) {}
          }
          return stream;
        }
        catch (e) { lastError = e; }
      }
      throw lastError || new Error('Could not open audio input stream');
    }

    async function recUpdateChannelOptions(iid) {
      const inputSel = _re(iid, 'rec-input-src');
      const chLeft = _re(iid, 'rec-ch-left');
      const chRight = _re(iid, 'rec-ch-right');
      if (!inputSel || !chLeft || !chRight) return;
      const deviceId = inputSel.value;
      let channelCount = 2;
      try {
        const stream = await recGetInputStream(deviceId, { preferStereo: false });
        const track = stream.getAudioTracks()[0];
        if (track) {
          const settings = track.getSettings();
          channelCount = settings.channelCount || 2;
          try {
            const caps = track.getCapabilities();
            if (caps && caps.channelCount && caps.channelCount.max) channelCount = Math.max(channelCount, caps.channelCount.max);
          } catch (_) {}
        }
        stream.getTracks().forEach(t => t.stop());
      } catch (e) { console.warn('Could not detect channel count:', e); }
      channelCount = Math.max(channelCount, 2);
      const prevL = chLeft.value, prevR = chRight.value;
      chLeft.innerHTML = ''; chRight.innerHTML = '';
      for (let i = 0; i < channelCount; i++) {
        const optL = document.createElement('option'); optL.value = i; optL.textContent = 'Channel ' + (i + 1);
        if (String(i) === prevL) optL.selected = true; chLeft.appendChild(optL);
        const optR = document.createElement('option'); optR.value = i; optR.textContent = 'Channel ' + (i + 1);
        if (String(i) === prevR) optR.selected = true; chRight.appendChild(optR);
      }
      if (!prevL && chLeft.options.length > 0) chLeft.value = '0';
      if (!prevR && chRight.options.length > 1) chRight.value = '1';
    }

    // ── Per-instance monitor ──
    function recEnsureMonitorEl(iid) {
      const st = _ri(iid); if (!st) return null;
      if (st.monitorEl) return st.monitorEl;
      const el = new Audio(); el.autoplay = true; el.playsInline = true;
      st.monitorEl = el; return el;
    }

    function recApplyOutputMonitoringImmediate(iid) {
      const st = _ri(iid); if (!st) return;
      const stream = st.meterStream, ctx = st.audioCtx, gain = st.monitorGain, monitor = st.monitorEl;
      if (ctx && gain) {
        if (st.outputMuted) {
          if (st.monitorConnected) { try { gain.disconnect(ctx.destination); } catch (_) {} st.monitorConnected = false; }
          gain.gain.value = 0;
        } else {
          if (ctx.state === 'suspended') ctx.resume().catch(() => {});
          if (!st.monitorConnected) { try { gain.connect(ctx.destination); st.monitorConnected = true; } catch (_) {} }
          gain.gain.value = 1;
        }
      }
      if (monitor) {
        monitor.muted = !!st.outputMuted;
        monitor.volume = st.outputMuted ? 0 : 1;
        if (st.outputMuted || !stream) { monitor.pause(); } else { monitor.play().catch(() => {}); }
      }
    }

    async function recApplyOutputMonitoring(iid) {
      const st = _ri(iid); if (!st) return;
      const stream = st.meterStream, ctx = st.audioCtx, gain = st.monitorGain;
      const outputSel = _re(iid, 'rec-output-src');
      const selectedOutput = outputSel ? outputSel.value : 'default';
      const resolvedOutput = recResolveDefaultDeviceId('audiooutput', selectedOutput || 'default');
      const wantsDefaultOutput = !resolvedOutput || resolvedOutput === 'default';
      if (ctx && gain) {
        if (st.outputMuted) {
          if (st.monitorConnected) { try { gain.disconnect(ctx.destination); } catch (_) {} st.monitorConnected = false; }
          gain.gain.value = 0;
        } else {
          if (!st.monitorConnected) { try { gain.connect(ctx.destination); st.monitorConnected = true; } catch (_) {} }
          gain.gain.value = 1;
        }
        if (typeof ctx.setSinkId === 'function') {
          try {
            await ctx.setSinkId(wantsDefaultOutput ? 'default' : resolvedOutput);
            if (st.monitorEl) { st.monitorEl.pause(); st.monitorEl.srcObject = null; }
            return;
          } catch (e) { console.warn('Could not set AudioContext output device:', e); }
        } else if (wantsDefaultOutput) {
          if (st.monitorEl) { st.monitorEl.pause(); st.monitorEl.srcObject = null; }
          return;
        }
      }
      const monitor = recEnsureMonitorEl(iid);
      if (!monitor) return;
      monitor.srcObject = stream || null;
      monitor.muted = !!st.outputMuted;
      monitor.volume = st.outputMuted ? 0 : 1;
      if (typeof monitor.setSinkId === 'function') {
        try { await monitor.setSinkId(wantsDefaultOutput ? 'default' : resolvedOutput); }
        catch (e) { console.warn('Could not set monitor output device:', e); }
      }
      if (stream && !st.outputMuted) { monitor.play().catch(() => {}); } else { monitor.pause(); }
    }

    function recBuildReverbImpulse(ctx, decaySeconds = 1.7, toneHz = 7000) {
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

    function recCreateFxNode(ctx, fx) {
      const type = String(fx?.type || '');
      const p = (fx && fx.params) || {};
      if (type === 'highpass') {
        const n = ctx.createBiquadFilter(); n.type = 'highpass';
        n.frequency.value = Number(p.frequency || 80); n.Q.value = Number(p.q || 0.707);
        return n;
      }
      if (type === 'lowshelf') {
        const n = ctx.createBiquadFilter(); n.type = 'lowshelf';
        n.frequency.value = Number(p.frequency || 160); n.gain.value = Number(p.gain || 1.8); n.Q.value = Number(p.q || 0.707);
        return n;
      }
      if (type === 'presence') {
        const n = ctx.createBiquadFilter(); n.type = 'peaking';
        n.frequency.value = Number(p.frequency || 3200); n.Q.value = Number(p.q || 1.05); n.gain.value = Number(p.gain || 2.2);
        return n;
      }
      if (type === 'air') {
        const n = ctx.createBiquadFilter(); n.type = 'highshelf';
        n.frequency.value = Number(p.frequency || 9800); n.Q.value = Number(p.q || 0.707); n.gain.value = Number(p.gain || 2.2);
        return n;
      }
      if (type === 'compressor' || type === 'limiter') {
        const n = ctx.createDynamicsCompressor();
        n.threshold.value = Number(p.threshold ?? (type === 'limiter' ? -2.5 : -22));
        n.knee.value = Number(p.knee ?? (type === 'limiter' ? 0 : 10));
        n.ratio.value = Number(p.ratio ?? (type === 'limiter' ? 20 : 2.4));
        n.attack.value = Number(p.attack ?? (type === 'limiter' ? 0.001 : 0.004));
        n.release.value = Number(p.release ?? (type === 'limiter' ? 0.08 : 0.14));
        return n;
      }
      if (type === 'gain') {
        const n = ctx.createGain(); n.gain.value = Number(p.gain || 1); return n;
      }
      if (type === 'denoiser') {
        const amount = Math.max(0, Math.min(100, Number(p.amount) || 0));
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
      if (type === 'reverb') {
        const mix = Math.max(0, Math.min(100, Number(p.mix) || 26)) / 100;
        const input = ctx.createGain();
        const conv = ctx.createConvolver();
        conv.buffer = recBuildReverbImpulse(ctx, Number(p.decay || 1.7), Number(p.tone || 7000));
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
      // Delegate all other types to the source FX node creator
      return _pgmCreateFxNode(ctx, fx);
    }

    function recRewireFxGraph(iid) {
      const st = _ri(iid); if (!st) return;
      if (!(st.inputGain && st.monitorGain && st.splitter && st.audioCtx)) return;
      const chain = _recNormalizeFxStack(st.audioFx || []);
      const hasSoftSwapFx = chain.some((fx) => fx && fx.enabled !== false && (fx.type === 'noise-gate' || fx.type === 'pro-denoiser' || fx.type === 'pro-compressor'));
      const fadeOutTc = hasSoftSwapFx ? 0.016 : 0.012;
      const swapDelayMs = hasSoftSwapFx ? 38 : 30;
      const fadeInTc = hasSoftSwapFx ? 0.032 : 0.03;
      if (st._fxRewiring) { st._fxRewirePending = true; return; }
      st._fxRewiring = true;
      st._fxRewirePending = false;
      const applyRewire = () => {
        try {
          try { st.inputGain.disconnect(); } catch (_) {}
          (st.fxNodes || []).forEach((n) => { try { n.disconnect(); } catch (_) {} });
          st.fxNodes = [];
          st.fxRuntimeById = {};
          let tail = st.inputGain;
          st.audioFx = chain;
          if (st.fxMasterEnabled !== false && !st.fxBypass) {
            chain.forEach((fx) => {
              if (!fx || fx.enabled === false) return;
              const node = recCreateFxNode(st.audioCtx, fx);
              if (!node) return;
              try {
                if (node.input && node.output) {
                  tail.connect(node.input);
                  tail = node.output;
                  (node.nodes || []).forEach((x) => st.fxNodes.push(x));
                  if (fx.id) st.fxRuntimeById[fx.id] = node;
                  return;
                }
                tail.connect(node);
                tail = node;
                st.fxNodes.push(node);
                if (fx.id) st.fxRuntimeById[fx.id] = node;
              } catch (_) {}
            });
          }
          if (tail) {
            try { tail.connect(st.monitorGain); } catch (_) {}
            try { tail.connect(st.splitter); } catch (_) {}
            if (st.recordDest) {
              try { tail.connect(st.recordDest); } catch (_) {}
            }
          }
          try {
            const now = st.audioCtx.currentTime || 0;
            const target = Math.max(0, Number(st.inputGainValue ?? 1) || 1);
            st.inputGain.gain.cancelScheduledValues(now);
            st.inputGain.gain.setTargetAtTime(target, now + 0.01, fadeInTc);
          } catch (_) {}
        } finally {
          st._fxRewiring = false;
          if (st._fxRewirePending) {
            st._fxRewirePending = false;
            recRewireFxGraph(iid);
          }
        }
      };
      try {
        const now = st.audioCtx.currentTime || 0;
        st.inputGain.gain.cancelScheduledValues(now);
        st.inputGain.gain.setTargetAtTime(0.0001, now, fadeOutTc);
        if (st._fxSwapTimer) clearTimeout(st._fxSwapTimer);
        st._fxSwapTimer = setTimeout(() => {
          st._fxSwapTimer = 0;
          applyRewire();
        }, swapDelayMs);
      } catch (_) {
        applyRewire();
      }
    }

    // ── Per-instance metering ──
    async function recStartMetering(iid) {
      const st = _ri(iid); if (!st) return;
      recSyncHeadphoneBtn(iid);
      if (st.analyserL && st.analyserR) {
        if (st.audioCtx && st.audioCtx.state === 'suspended') st.audioCtx.resume().catch(() => {});
        if (!st.meterRAF) recMeterLoop(iid);
        return;
      }
      try {
        const inputSel = _re(iid, 'rec-input-src');
        const deviceId = inputSel ? inputSel.value : undefined;
        // Keep the source in its native channel/sample-rate characteristics for dry/original capture.
        const stream = await recGetInputStream(deviceId, { preferStereo: false });
        st.meterStream = stream;
        stream.getAudioTracks().forEach((track) => {
          track.onended = () => {
            const page = document.getElementById('page-record');
            if (!(page && page.classList.contains('active'))) return;
            const latest = _ri(iid);
            if (!latest || latest.recording) return;
            recStopMetering(iid);
            setTimeout(() => recStartMetering(iid), 120);
          };
        });
        let ctx = null;
        const firstTrack = stream.getAudioTracks()[0];
        const inSettings = firstTrack ? firstTrack.getSettings() : null;
        const preferredRate = (inSettings && inSettings.sampleRate) ? inSettings.sampleRate : 48000;
        try {
          ctx = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 0,
            sampleRate: preferredRate
          });
        } catch (_) {
          try { ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' }); }
          catch (__){ ctx = new (window.AudioContext || window.webkitAudioContext)(); }
        }
        st.audioCtx = ctx;
        if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
        const source = ctx.createMediaStreamSource(stream);
        const inputGain = ctx.createGain();
        inputGain.gain.value = st.inputGainValue;
        st.inputGain = inputGain;
        source.connect(inputGain);
        const monitorGain = ctx.createGain();
        monitorGain.gain.value = st.outputMuted ? 0 : 1;
        st.monitorGain = monitorGain;
        st.monitorConnected = false;
        st.recordDest = ctx.createMediaStreamDestination();
        if (!st.outputMuted) {
          try { monitorGain.connect(ctx.destination); st.monitorConnected = true; } catch (_) {}
        }
        const splitter = ctx.createChannelSplitter(2);
        st.splitter = splitter;
        const analyserL = ctx.createAnalyser(); analyserL.fftSize = 256; analyserL.smoothingTimeConstant = 0.55;
        const analyserR = ctx.createAnalyser(); analyserR.fftSize = 256; analyserR.smoothingTimeConstant = 0.55;
        splitter.connect(analyserL, 0);
        splitter.connect(analyserR, source.channelCount > 1 ? 1 : 0);
        st.analyserL = analyserL; st.analyserR = analyserR;
        recRewireFxGraph(iid);
        recApplyOutputMonitoringImmediate(iid);
        recApplyOutputMonitoring(iid);
        recMeterLoop(iid);
      } catch (e) { console.warn('Could not start metering for instance ' + iid + ':', e); }
    }

    function recStopMetering(iid) {
      const st = _ri(iid); if (!st) return;
      if (st.recording) {
        st.recording = false; st.paused = false;
        clearInterval(st.timerId); st.timerId = null;
        recStopCaptureForCurrentRecording(iid);
      }
      if (st.meterRAF) { cancelAnimationFrame(st.meterRAF); st.meterRAF = null; }
      if (st.fxRewireTimer) { clearTimeout(st.fxRewireTimer); st.fxRewireTimer = 0; }
      if (st._fxSwapTimer) { clearTimeout(st._fxSwapTimer); st._fxSwapTimer = 0; }
      if (st.meterStream) { st.meterStream.getTracks().forEach(t => t.stop()); st.meterStream = null; }
      if (st.monitorEl) { st.monitorEl.pause(); st.monitorEl.srcObject = null; }
      st.monitorGain = null; st.monitorConnected = false; st.fxNodes = []; st.fxRuntimeById = {};
      st.recordDest = null;
      if (st.audioCtx) { st.audioCtx.close().catch(() => {}); st.audioCtx = null; }
      st.analyserL = null; st.analyserR = null; st.splitter = null;
      const lFill = _re(iid, 'rec-strip-l'), rFill = _re(iid, 'rec-strip-r');
      const lDb = _re(iid, 'rec-strip-l-db'), rDb = _re(iid, 'rec-strip-r-db');
      if (lFill) lFill.style.width = '0%'; if (rFill) rFill.style.width = '0%';
      const win = _re(iid, 'rec-window-block');
      if (win && win.classList.contains('design-studio')) {
        if (lFill) lFill.style.background = '#2bd96b';
        if (rFill) rFill.style.background = '#2bd96b';
      }
      if (lDb) lDb.textContent = '\u2212\u221e dB'; if (rDb) rDb.textContent = '\u2212\u221e dB';
    }

    function recStudioMeterColorForDb(db) {
      const v = Number.isFinite(db) ? db : -60;
      if (v >= -3) return '#ff3b30';     // red / near clipping
      if (v >= -12) return '#ffd034';    // yellow / hot
      return '#2bd96b';                  // green / safe
    }

    function recMeterLoop(iid) {
      const st = _ri(iid); if (!st) return;
      const { analyserL, analyserR } = st;
      if (!analyserL || !analyserR) return;
      const bufL = new Float32Array(analyserL.fftSize), bufR = new Float32Array(analyserR.fftSize);
      analyserL.getFloatTimeDomainData(bufL); analyserR.getFloatTimeDomainData(bufR);
      let sumL = 0, sumR = 0;
      for (let i = 0; i < bufL.length; i++) { sumL += bufL[i] * bufL[i]; sumR += bufR[i] * bufR[i]; }
      const rmsL = Math.sqrt(sumL / bufL.length), rmsR = Math.sqrt(sumR / bufR.length);
      const dbL = rmsL > 0 ? 20 * Math.log10(rmsL) : -Infinity;
      const dbR = rmsR > 0 ? 20 * Math.log10(rmsR) : -Infinity;
      const pctL = Math.max(0, Math.min(100, ((dbL + 60) / 60) * 100));
      const pctR = Math.max(0, Math.min(100, ((dbR + 60) / 60) * 100));
      const lFill = _re(iid, 'rec-strip-l'), rFill = _re(iid, 'rec-strip-r');
      const lDb = _re(iid, 'rec-strip-l-db'), rDb = _re(iid, 'rec-strip-r-db');
      if (lFill) lFill.style.width = pctL + '%'; if (rFill) rFill.style.width = pctR + '%';
      const win = _re(iid, 'rec-window-block');
      if (win && win.classList.contains('design-studio')) {
        if (lFill) lFill.style.background = recStudioMeterColorForDb(dbL);
        if (rFill) rFill.style.background = recStudioMeterColorForDb(dbR);
      }
      if (lDb) lDb.textContent = (dbL <= -60 ? '\u2212\u221e' : dbL.toFixed(1)) + ' dB';
      if (rDb) rDb.textContent = (dbR <= -60 ? '\u2212\u221e' : dbR.toFixed(1)) + ' dB';
      st.meterRAF = requestAnimationFrame(() => recMeterLoop(iid));
    }

    // ── Recording ──
    function recGetRecordMimeType() {
      if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
      if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
      return '';
    }

    function recGetSelectedFormatKey(iid) {
      const sel = _re(iid, 'rec-file-type');
      return sel ? String(sel.value || '').trim().toLowerCase() : 'wav-48-24';
    }

    function recBuildRecordingName(iid) {
      const titleEl = _re(iid, 'rec-project-title');
      const base = (titleEl ? titleEl.value : 'Recording').trim() || 'Recording';
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `${base} ${hh}:${mm}:${ss}`;
    }

    function recStartCaptureForCurrentRecording(iid) {
      const st = _ri(iid); if (!st) return;
      if (!st.meterStream || typeof MediaRecorder === 'undefined') return;
      const recStream = st.recordStream || (st.recordDest && st.recordDest.stream ? st.recordDest.stream.clone() : st.meterStream.clone());
      st.recordStream = recStream;
      st.recordChunks = [];
      st.recordStartMs = Date.now();
      const mimeType = recGetRecordMimeType();
      let mr = null;
      try { mr = mimeType ? new MediaRecorder(recStream, { mimeType }) : new MediaRecorder(recStream); }
      catch (_) { try { mr = new MediaRecorder(recStream); } catch (__) { mr = null; } }
      if (!mr) { recStream.getTracks().forEach(t => t.stop()); st.recordStream = null; return; }
      st.mediaRecorder = mr;
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) st.recordChunks.push(e.data); };
      mr.onstop = () => {
        const chunks = st.recordChunks.slice();
        const segDuration = Math.max(0, st.seconds - (st.splitStartSeconds || 0));
        const durationSecs = segDuration || Math.max(0, Math.round((Date.now() - (st.recordStartMs || Date.now())) / 1000));
        const useType = (mr.mimeType || mimeType || 'audio/webm');
        if (chunks.length) {
          const blob = new Blob(chunks, { type: useType });
          const seq = st.splitSeq;
          const name = seq > 0 ? recBuildRecordingName(iid) + ' (part ' + seq + ')' : recBuildRecordingName(iid);
          if (blob.size > 0) recAddRecording(iid, name, durationSecs, blob, recGetSelectedFormatKey(iid));
        }
        st.recordChunks = [];
        st.mediaRecorder = null;
        if (st._splitting) {
          st._splitting = false;
          st.splitStartSeconds = st.seconds;
          recStartCaptureForCurrentRecording(iid);
        } else {
          if (st.recordStream) st.recordStream.getTracks().forEach(t => t.stop());
          st.recordStream = null;
        }
      };
      mr.start(200);
    }

    function recStopCaptureForCurrentRecording(iid) {
      const st = _ri(iid); if (!st) return;
      const mr = st.mediaRecorder;
      if (mr && mr.state !== 'inactive') { try { mr.stop(); } catch (_) {} }
      else if (st.recordStream) { st.recordStream.getTracks().forEach(t => t.stop()); st.recordStream = null; }
    }

    function recSetRecordState(iid, shouldRecord, fromLink) {
      const st = _ri(iid); if (!st) return;
      if (!!st.recording === !!shouldRecord) return;
      st.recording = !!shouldRecord;
      const btn = _re(iid, 'rec-btn');
      const dot = btn ? btn.querySelector('.rec-window-btn-dot') : null;
      const pauseBtn = _re(iid, 'rec-pause-btn');
      const splitBtn = _re(iid, 'rec-split-btn');
      if (st.recording) {
        st.paused = false; st.seconds = 0; st.splitStartSeconds = 0; st.splitSeq = 0;
        recUpdateTime(iid);
        st.timerId = setInterval(() => { st.seconds++; recUpdateTime(iid); }, 1000);
        if (dot) { dot.style.borderRadius = '10px'; dot.style.width = '36px'; dot.style.height = '36px'; }
        if (pauseBtn) pauseBtn.disabled = false;
        if (splitBtn) splitBtn.disabled = false;
        recUpdatePauseBtn(iid);
        recStartCaptureForCurrentRecording(iid);
      } else {
        st.paused = false; clearInterval(st.timerId); st.timerId = null;
        if (dot) { dot.style.borderRadius = '50%'; dot.style.width = '56px'; dot.style.height = '56px'; }
        if (pauseBtn) pauseBtn.disabled = true;
        if (splitBtn) splitBtn.disabled = true;
        recUpdatePauseBtn(iid);
        if (st.splitSeq > 0) st.splitSeq++;
        recStopCaptureForCurrentRecording(iid);
        st.seconds = 0; recUpdateTime(iid);
      }
      if (!fromLink) recPropagateRecordState(iid, st.recording);
    }

    function recToggleRecord(iid) {
      const st = _ri(iid); if (!st) return;
      recSetRecordState(iid, !st.recording, false);
    }

    function recTogglePause(iid) {
      const st = _ri(iid); if (!st || !st.recording) return;
      st.paused = !st.paused;
      if (st.paused) {
        clearInterval(st.timerId); st.timerId = null;
        if (st.mediaRecorder && st.mediaRecorder.state === 'recording') { try { st.mediaRecorder.pause(); } catch (_) {} }
      } else {
        st.timerId = setInterval(() => { st.seconds++; recUpdateTime(iid); }, 1000);
        if (st.mediaRecorder && st.mediaRecorder.state === 'paused') { try { st.mediaRecorder.resume(); } catch (_) {} }
      }
      recUpdatePauseBtn(iid);
    }

    function recUpdatePauseBtn(iid) {
      const st = _ri(iid); if (!st) return;
      const pauseBtn = _re(iid, 'rec-pause-btn');
      const label = _re(iid, 'rec-pause-label');
      const svg = pauseBtn ? pauseBtn.querySelector('svg') : null;
      if (!pauseBtn || !label || !svg) return;
      if (st.paused) {
        label.textContent = 'Resume'; pauseBtn.title = 'Resume';
        svg.innerHTML = '<polygon points="6 4 20 12 6 20"/>'; svg.setAttribute('fill', 'currentColor'); svg.setAttribute('stroke', 'none');
      } else {
        label.textContent = 'Pause'; pauseBtn.title = 'Pause';
        svg.innerHTML = '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'; svg.setAttribute('fill', 'currentColor'); svg.setAttribute('stroke', 'none');
      }
    }

    function recSplit(iid) {
      const st = _ri(iid); if (!st || !st.recording || st.paused) return;
      const mr = st.mediaRecorder;
      if (!mr || mr.state === 'inactive') return;
      st.splitSeq++;
      st._splitting = true;
      try { mr.stop(); } catch (_) {}
    }

    function recUpdateTime(iid) {
      const st = _ri(iid); if (!st) return;
      const el = _re(iid, 'rec-time-display'); if (!el) return;
      const h = String(Math.floor(st.seconds / 3600)).padStart(2, '0');
      const m = String(Math.floor((st.seconds % 3600) / 60)).padStart(2, '0');
      const s = String(st.seconds % 60).padStart(2, '0');
      el.textContent = `${h}:${m}:${s}`;
    }

    function recSwitchTab(iid, tab) {
      const mainPage = _re(iid, 'rec-w-page-main');
      const recsPage = _re(iid, 'rec-w-page-recordings');
      const mainTab = _re(iid, 'rec-tab-main');
      const recsTab = _re(iid, 'rec-tab-recordings');
      if (tab === 'main') {
        if (mainPage) mainPage.classList.add('active'); if (recsPage) recsPage.classList.remove('active');
        if (mainTab) mainTab.classList.add('active'); if (recsTab) recsTab.classList.remove('active');
      } else {
        if (mainPage) mainPage.classList.remove('active'); if (recsPage) recsPage.classList.add('active');
        if (mainTab) mainTab.classList.remove('active'); if (recsTab) recsTab.classList.add('active');
        recRenderRecordings(iid);
      }
    }

    // ── Per-instance recordings list ──
    function recUpdateSaveToBtn(iid) {
      const st = _ri(iid); if (!st) return;
      const pathEl = _re(iid, 'rec-save-to-path');
      const menuLabelEl = _re(iid, 'rec-save-to-opt-current-label');
      if (!pathEl) return;
      const shownLabel = st.saveState.dirLabel || 'Documents';
      const shownPath = st.saveState.dirPath || shownLabel;
      pathEl.textContent = shownLabel; pathEl.title = shownPath;
      if (menuLabelEl) menuLabelEl.textContent = shownLabel;
    }

    function recCloseSaveToMenu(iid) {
      const menu = _re(iid, 'rec-save-to-menu');
      if (menu) menu.classList.remove('open');
    }

    function recToggleSaveToMenu(iid, event) {
      if (event) event.stopPropagation();
      const menu = _re(iid, 'rec-save-to-menu');
      if (menu) menu.classList.toggle('open');
    }

    async function recInitSaveDir(iid) {
      const st = _ri(iid); if (!st) return;
      if (!(window.BSPDesktop && typeof window.BSPDesktop.getDefaultRecordingsDir === 'function')) return;
      try {
        const resp = await window.BSPDesktop.getDefaultRecordingsDir();
        if (resp && resp.ok && resp.path) { recApplyChosenSaveDir(iid, resp.path); recUpdateSaveToBtn(iid); }
      } catch (_) {}
    }

    function recApplyChosenSaveDir(iid, dirPath, preferredLabel) {
      const st = _ri(iid); if (!st) return;
      const cleanPath = String(dirPath || '').trim();
      st.saveState.dirPath = cleanPath;
      if (preferredLabel) { st.saveState.dirLabel = preferredLabel; return; }
      if (!cleanPath) { st.saveState.dirLabel = 'Documents'; return; }
      const parts = cleanPath.split(/[\\/]/).filter(Boolean);
      st.saveState.dirLabel = parts.length ? parts[parts.length - 1] : 'Folder';
    }

    async function recChooseSaveDirWithDesktopBridge() {
      if (!(window.BSPDesktop && typeof window.BSPDesktop.chooseRecordingsDir === 'function')) return { available: false };
      const resp = await window.BSPDesktop.chooseRecordingsDir().catch(() => null);
      if (!resp || resp.canceled || !resp.ok || !resp.path) return { available: true, canceled: true };
      return { available: true, path: resp.path, label: '' };
    }

    async function recChooseSaveDirWithNativePicker() {
      if (typeof window.showDirectoryPicker !== 'function') return { available: false };
      try {
        const handle = await window.showDirectoryPicker();
        if (!handle) return { available: true, canceled: true };
        return { available: true, path: '', label: handle.name || 'Folder' };
      } catch (_) { return { available: true, canceled: true }; }
    }

    function recChooseSaveDirWithFallbackInput(iid) {
      return new Promise((resolve) => {
        const input = _re(iid, 'rec-save-dir-fallback');
        if (!input) { resolve(null); return; }
        input.value = ''; input.dataset.pendingPick = '1';
        const onDone = () => {
          input.removeEventListener('change', onDone);
          const val = input.dataset.pickedLabel || '';
          input.dataset.pendingPick = ''; input.dataset.pickedLabel = '';
          resolve(val ? { path: '', label: val } : null);
        };
        input.addEventListener('change', onDone, { once: true });
        input.click();
      });
    }

    function recHandleFallbackDirPick(iid, input) {
      if (!input || input.dataset.pendingPick !== '1') return;
      const files = input.files; let label = '';
      if (files && files.length > 0) {
        const rel = String(files[0].webkitRelativePath || '');
        if (rel.includes('/')) label = rel.split('/')[0];
      }
      input.dataset.pickedLabel = label;
    }

    async function recChooseSaveDir(iid) {
      recCloseSaveToMenu(iid);
      const desktopPick = await recChooseSaveDirWithDesktopBridge();
      if (desktopPick && desktopPick.available) {
        if (desktopPick.canceled) return;
        recApplyChosenSaveDir(iid, desktopPick.path, desktopPick.label);
        recUpdateSaveToBtn(iid);
        if (typeof showToast === 'function') showToast('Save folder updated');
        return;
      }
      const nativePick = await recChooseSaveDirWithNativePicker();
      if (nativePick && nativePick.available) {
        if (nativePick.canceled) return;
        recApplyChosenSaveDir(iid, nativePick.path, nativePick.label);
        recUpdateSaveToBtn(iid);
        if (typeof showToast === 'function') showToast('Save folder updated');
        return;
      }
      let picked = await recChooseSaveDirWithFallbackInput(iid);
      if (!picked) return;
      recApplyChosenSaveDir(iid, picked.path, picked.label);
      recUpdateSaveToBtn(iid);
      if (typeof showToast === 'function') showToast('Save folder updated');
    }

    function recExtFromBlobType(type) {
      const t = String(type || '').toLowerCase();
      if (t.includes('webm')) return 'webm';
      if (t.includes('mp4') || t.includes('aac') || t.includes('m4a')) return 'm4a';
      if (t.includes('wav')) return 'wav';
      if (t.includes('ogg')) return 'ogg';
      if (t.includes('flac')) return 'flac';
      if (t.includes('mpeg') || t.includes('mp3')) return 'mp3';
      return 'webm';
    }

    function recFileUrlFromPath(filePath) {
      const p = String(filePath || '').trim();
      if (!p) return null;
      if (/^file:\/\//i.test(p)) return p;
      const normalized = p.replace(/\\/g, '/');
      return normalized.startsWith('/') ? encodeURI('file://' + normalized) : encodeURI('file:///' + normalized);
    }

    function recUpdateRecordingsToolbar(iid) {
      const st = _ri(iid); if (!st) return;
      const selectBtn = _re(iid, 'rec-select-mode-btn');
      const mergeBtn = _re(iid, 'rec-merge-btn');
      const selectedCount = st.selectedOrder.length;
      if (selectBtn) selectBtn.textContent = st.selectionMode ? 'Done' : 'Select';
      if (mergeBtn) {
        mergeBtn.classList.toggle('show', st.selectionMode && selectedCount >= 2);
        mergeBtn.textContent = selectedCount >= 2 ? `Merge (${selectedCount})` : 'Merge';
      }
    }

    function recSetSelectionMode(iid, enabled) {
      const st = _ri(iid); if (!st) return;
      st.selectionMode = !!enabled;
      if (!st.selectionMode) { st.selectedIds.clear(); st.selectedOrder = []; }
      recCloseContextMenu(iid);
      recUpdateRecordingsToolbar(iid);
      recRenderRecordings(iid);
    }

    function recToggleSelectMode(iid) {
      const st = _ri(iid); if (!st) return;
      recSetSelectionMode(iid, !st.selectionMode);
    }

    function recToggleSelectedRecording(iid, recId, checked) {
      const st = _ri(iid); if (!st || !recId) return;
      if (checked) {
        st.selectedIds.add(recId);
        if (!st.selectedOrder.includes(recId)) st.selectedOrder.push(recId);
      } else {
        st.selectedIds.delete(recId);
        st.selectedOrder = st.selectedOrder.filter((id) => id !== recId);
      }
      recUpdateRecordingsToolbar(iid);
      recRenderRecordings(iid);
    }

    async function recSaveRecordingBlob(iid, recording) {
      const st = _ri(iid); if (!st) return;
      if (!recording || !recording.blob || !(window.BSPDesktop && typeof window.BSPDesktop.saveRecordingFile === 'function')) return;
      try {
        const arr = await recording.blob.arrayBuffer();
        const bytes = new Uint8Array(arr);
        const ext = recExtFromBlobType(recording.blob.type);
        const resp = await window.BSPDesktop.saveRecordingFile({
          directory: st.saveState.dirPath || '', name: recording.name,
          format: recording.formatKey || recGetSelectedFormatKey(iid), inputExt: ext, ext, bytes
        });
        if (resp && resp.ok && resp.path) {
          recording.savedPath = resp.path;
          if (!recording.url || String(recording.url).startsWith('blob:')) recording.url = recFileUrlFromPath(resp.path) || recording.url;
          recording.saveError = '';
        } else { recording.savedPath = ''; recording.saveError = (resp && resp.error) || 'Save failed'; }
      } catch (e) { recording.savedPath = ''; recording.saveError = (e && e.message) || 'Save failed'; }
      recRenderRecordings(iid);
    }

    function recAddRecording(iid, name, durationSecs, audioBlob, formatKey) {
      const st = _ri(iid); if (!st) return;
      const recording = {
        id: ++st.saveSeq, name, duration: durationSecs, blob: audioBlob,
        formatKey: formatKey || recGetSelectedFormatKey(iid),
        url: audioBlob ? URL.createObjectURL(audioBlob) : null,
        date: new Date(), savedPath: '', saveError: ''
      };
      st.recordings.push(recording);
      recRenderRecordings(iid);
      recSaveRecordingBlob(iid, recording);
    }

    function recFormatDuration(secs) {
      const h = String(Math.floor(secs / 3600)).padStart(2, '0');
      const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
      const s = String(secs % 60).padStart(2, '0');
      return h + ':' + m + ':' + s;
    }

    function recDrawMiniWaveform(canvas, seed) {
      const ctx = canvas.getContext('2d');
      const w = canvas.width = canvas.offsetWidth * 2;
      const h = canvas.height = canvas.offsetHeight * 2;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath();
      const bars = 40, barW = w / bars;
      let rng = seed || 1;
      for (let i = 0; i < bars; i++) {
        rng = (rng * 16807 + 7) % 2147483647;
        const amp = 0.15 + 0.7 * ((rng % 1000) / 1000);
        const barH = amp * h * 0.8;
        const x = i * barW + barW / 2;
        ctx.moveTo(x, (h - barH) / 2); ctx.lineTo(x, (h + barH) / 2);
      }
      ctx.stroke();
    }

    function recRenderRecordings(iid) {
      const st = _ri(iid); if (!st) return;
      const list = _re(iid, 'rec-w-recs-list');
      if (!list) return;
      list.innerHTML = '';
      if (st.recordings.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'rec-w-recs-empty';
        emptyEl.textContent = 'No recordings yet';
        list.appendChild(emptyEl); return;
      }
      st.recordings.forEach((rec, idx) => {
        const item = document.createElement('div');
        item.className = 'rec-item';
        const isSelected = st.selectedIds.has(rec.id);
        if (isSelected) item.classList.add('selected');
        item.oncontextmenu = (e) => recOpenContextMenu(iid, e, idx);
        if (st.selectionMode) {
          const chk = document.createElement('input'); chk.type = 'checkbox';
          chk.className = 'rec-item-checkbox'; chk.checked = isSelected;
          chk.onchange = () => recToggleSelectedRecording(iid, rec.id, chk.checked);
          item.appendChild(chk);
          if (isSelected) {
            const orderIdx = st.selectedOrder.indexOf(rec.id);
            const badge = document.createElement('span');
            badge.className = 'rec-item-order-badge';
            badge.textContent = String(orderIdx + 1);
            item.appendChild(badge);
          }
        }
        const playBtn = document.createElement('button');
        playBtn.className = 'rec-item-play'; playBtn.title = 'Play';
        const isPlaying = st.playingIdx === idx && st.playingAudio && !st.playingAudio.paused;
        playBtn.innerHTML = isPlaying
          ? '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 4 20 12 6 20"/></svg>';
        playBtn.onclick = () => { if (!st.selectionMode) recTogglePlayRecording(iid, idx); };
        item.appendChild(playBtn);
        const info = document.createElement('div'); info.className = 'rec-item-info';
        const nameEl = document.createElement('div'); nameEl.className = 'rec-item-name'; nameEl.textContent = rec.name;
        const meta = document.createElement('div'); meta.className = 'rec-item-meta';
        const baseMeta = recFormatDuration(rec.duration);
        if (rec.savedPath) meta.textContent = baseMeta + ' \u2022 Saved';
        else if (rec.saveError) meta.textContent = baseMeta + ' \u2022 Save failed';
        else meta.textContent = baseMeta + ' \u2022 Saving...';
        info.appendChild(nameEl); info.appendChild(meta); item.appendChild(info);
        const wave = document.createElement('canvas'); wave.className = 'rec-item-wave';
        item.appendChild(wave);
        requestAnimationFrame(() => recDrawMiniWaveform(wave, idx * 12345 + 7));
        const delBtn = document.createElement('button');
        delBtn.className = 'rec-item-del'; delBtn.title = 'Delete';
        delBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
        delBtn.onclick = () => recDeleteRecording(iid, idx);
        item.appendChild(delBtn);
        list.appendChild(item);
      });
      recUpdateRecordingsToolbar(iid);
    }

    function recTogglePlayRecording(iid, idx) {
      const st = _ri(iid); if (!st || st.selectionMode) return;
      const rec = st.recordings[idx]; if (!rec || !rec.url) return;
      if (st.playingIdx === idx && st.playingAudio) {
        if (st.playingAudio.paused) st.playingAudio.play(); else st.playingAudio.pause();
        recRenderRecordings(iid); return;
      }
      if (st.playingAudio) { st.playingAudio.pause(); st.playingAudio.currentTime = 0; }
      st.playingAudio = new Audio(rec.url); st.playingIdx = idx;
      st.playingAudio.play();
      st.playingAudio.onended = () => { st.playingIdx = -1; recRenderRecordings(iid); };
      recRenderRecordings(iid);
    }

    function recDeleteRecording(iid, idx) {
      const st = _ri(iid); if (!st) return;
      if (st.playingIdx === idx && st.playingAudio) { st.playingAudio.pause(); st.playingAudio = null; st.playingIdx = -1; }
      const rec = st.recordings[idx];
      if (rec && rec.url && String(rec.url).startsWith('blob:')) URL.revokeObjectURL(rec.url);
      if (rec && rec.id) {
        st.selectedIds.delete(rec.id);
        st.selectedOrder = st.selectedOrder.filter((id) => id !== rec.id);
      }
      st.recordings.splice(idx, 1);
      if (st.playingIdx > idx) st.playingIdx--;
      recRenderRecordings(iid);
    }

    function recCloseContextMenu(iid) {
      const menu = _re(iid, 'rec-recs-context-menu');
      if (!menu) return;
      menu.classList.remove('open');
      const st = _ri(iid); if (st) st.contextIdx = -1;
    }

    function recOpenContextMenu(iid, event, idx) {
      event.preventDefault();
      const st = _ri(iid); if (!st) return;
      const menu = _re(iid, 'rec-recs-context-menu');
      const win = _re(iid, 'rec-window-block');
      if (!menu || !win) return;
      st.contextIdx = idx;
      const rec = st.recordings[idx];
      const openBtn = _re(iid, 'rec-ctx-open-location');
      if (openBtn) openBtn.disabled = !(rec && rec.savedPath);
      const winRect = win.getBoundingClientRect();
      menu.style.left = `${Math.max(8, Math.min((event.clientX - winRect.left) + 8, win.clientWidth - 190))}px`;
      menu.style.top = `${Math.max(8, Math.min((event.clientY - winRect.top) + 8, win.clientHeight - 130))}px`;
      menu.classList.add('open');
    }

    async function recContextOpenLocation(iid) {
      const st = _ri(iid); if (!st) return;
      const rec = st.recordings[st.contextIdx];
      recCloseContextMenu(iid);
      if (!rec || !rec.savedPath) { if (typeof showToast === 'function') showToast('File has not been saved to disk yet'); return; }
      if (!(window.BSPDesktop && typeof window.BSPDesktop.openRecordingInLocation === 'function')) {
        if (typeof showToast === 'function') showToast('Open location is not available in this mode'); return;
      }
      const resp = await window.BSPDesktop.openRecordingInLocation({ path: rec.savedPath }).catch(() => null);
      if (!resp || !resp.ok) { if (typeof showToast === 'function') showToast((resp && resp.error) || 'Could not open file location'); }
    }

    async function recContextRename(iid) {
      const st = _ri(iid); if (!st) return;
      const rec = st.recordings[st.contextIdx];
      recCloseContextMenu(iid);
      if (!rec || !rec.savedPath) { if (typeof showToast === 'function') showToast('Only saved files can be renamed'); return; }
      const current = String(rec.name || '').trim() || 'Recording';
      const nextName = window.prompt('Rename recording', current);
      if (nextName == null) return;
      const clean = String(nextName).trim(); if (!clean) return;
      if (!(window.BSPDesktop && typeof window.BSPDesktop.renameRecordingFile === 'function')) return;
      const resp = await window.BSPDesktop.renameRecordingFile({ path: rec.savedPath, newName: clean }).catch(() => null);
      if (!resp || !resp.ok || !resp.path) { if (typeof showToast === 'function') showToast((resp && resp.error) || 'Rename failed'); return; }
      rec.savedPath = resp.path; rec.name = clean; rec.url = recFileUrlFromPath(resp.path) || rec.url;
      recRenderRecordings(iid);
    }

    async function recContextDelete(iid) {
      const st = _ri(iid); if (!st) return;
      const idx = st.contextIdx;
      const rec = st.recordings[idx];
      recCloseContextMenu(iid);
      if (!rec) return;
      if (rec.savedPath && window.BSPDesktop && typeof window.BSPDesktop.deleteRecordingFile === 'function') {
        const resp = await window.BSPDesktop.deleteRecordingFile({ path: rec.savedPath }).catch(() => null);
        if (resp && resp.ok !== true) { if (typeof showToast === 'function') showToast(resp.error || 'Delete failed'); return; }
      }
      recDeleteRecording(iid, idx);
    }

    async function recMergeSelected(iid) {
      const st = _ri(iid); if (!st) return;
      const selected = st.selectedOrder
        .map((id) => st.recordings.find((rec) => rec.id === id))
        .filter(Boolean);
      if (selected.length < 2) return;
      if (!(window.BSPDesktop && typeof window.BSPDesktop.mergeRecordingFiles === 'function')) {
        if (typeof showToast === 'function') showToast('Merge is not available in this mode'); return;
      }
      for (const rec of selected) { if (!rec.savedPath && rec.blob) await recSaveRecordingBlob(iid, rec); }
      const paths = selected.map((rec) => rec.savedPath).filter(Boolean);
      if (paths.length < 2) { if (typeof showToast === 'function') showToast('All selected recordings must be saved first'); return; }
      const mergeName = 'Merged Recording';
      const resp = await window.BSPDesktop.mergeRecordingFiles({
        paths, directory: st.saveState.dirPath || '', format: recGetSelectedFormatKey(iid), name: mergeName
      }).catch(() => null);
      if (!resp || !resp.ok || !resp.path) { if (typeof showToast === 'function') showToast((resp && resp.error) || 'Merge failed'); return; }
      const totalSecs = selected.reduce((sum, rec) => sum + (Number(rec.duration) || 0), 0);
      st.recordings.push({
        id: ++st.saveSeq, name: String(resp.name || mergeName).replace(/\.[^/.]+$/, ''),
        duration: totalSecs, blob: null, formatKey: recGetSelectedFormatKey(iid),
        url: recFileUrlFromPath(resp.path), date: new Date(), savedPath: resp.path, saveError: ''
      });
      recSetSelectionMode(iid, false);
      if (typeof showToast === 'function') showToast('Files merged');
    }

    // ── Mute toggles ──
    function recToggleInputMute(iid) {
      const st = _ri(iid); if (!st) return;
      st.inputMuted = !st.inputMuted;
      const btn = _re(iid, 'rec-input-mute-btn');
      const icon = _re(iid, 'rec-input-mute-icon');
      if (!btn || !icon) return;
      if (st.inputMuted) {
        btn.classList.add('muted'); btn.title = 'Unmute input';
        icon.innerHTML = '<line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>';
        if (st.meterStream) st.meterStream.getAudioTracks().forEach(t => t.enabled = false);
      } else {
        btn.classList.remove('muted'); btn.title = 'Mute input';
        icon.innerHTML = '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>';
        if (st.meterStream) st.meterStream.getAudioTracks().forEach(t => t.enabled = true);
      }
    }

    function recToggleOutputMute(iid) {
      const st = _ri(iid); if (!st) return;
      st.outputMuted = !st.outputMuted;
      const btn = _re(iid, 'rec-output-mute-btn');
      const icon = _re(iid, 'rec-output-mute-icon');
      if (!btn || !icon) return;
      if (st.outputMuted) {
        btn.classList.add('muted'); btn.title = 'Unmute output';
        icon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';
      } else {
        btn.classList.remove('muted'); btn.title = 'Mute output';
        icon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>';
      }
      recSyncHeadphoneBtn(iid);
      recApplyOutputMonitoringImmediate(iid);
      recApplyOutputMonitoring(iid);
    }

    // ── Device enumeration ──
    async function recEnumerateDevicesGlobal() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        const devices = await navigator.mediaDevices.enumerateDevices();
        _recDeviceCache.inputs = devices.filter(d => d.kind === 'audioinput');
        _recDeviceCache.outputs = devices.filter(d => d.kind === 'audiooutput');
      } catch (e) { console.warn('Could not enumerate audio devices:', e); }
    }

    function recPopulateDeviceSelects(iid) {
      const inputSel = _re(iid, 'rec-input-src');
      const outputSel = _re(iid, 'rec-output-src');
      if (inputSel) {
        const prevInput = inputSel.value || 'default';
        inputSel.innerHTML = '';
        let matchedInput = false;
        const defaultInput = document.createElement('option');
        defaultInput.value = 'default'; defaultInput.textContent = 'Default System Input';
        if (prevInput === 'default') { defaultInput.selected = true; matchedInput = true; }
        inputSel.appendChild(defaultInput);
        const inputs = _recDeviceCache.inputs.filter(d => d.deviceId !== 'default');
        inputs.forEach((d, i) => {
          const opt = document.createElement('option');
          opt.value = d.deviceId; opt.textContent = _sanitizeSourceDisplayLabel(d.label, 'Microphone ' + (i + 1));
          if (d.deviceId === prevInput) { opt.selected = true; matchedInput = true; defaultInput.selected = false; }
          inputSel.appendChild(opt);
        });
        if (!matchedInput) defaultInput.selected = true;
      }
      if (outputSel) {
        const prevOutput = outputSel.value || 'default';
        outputSel.innerHTML = '';
        let matchedOutput = false;
        const defaultOutput = document.createElement('option');
        defaultOutput.value = 'default'; defaultOutput.textContent = 'Default System Output';
        if (prevOutput === 'default') { defaultOutput.selected = true; matchedOutput = true; }
        outputSel.appendChild(defaultOutput);
        const outputs = _recDeviceCache.outputs.filter(d => d.deviceId !== 'default');
        outputs.forEach((d, i) => {
          const opt = document.createElement('option');
          opt.value = d.deviceId; opt.textContent = _sanitizeSourceDisplayLabel(d.label, 'Speaker ' + (i + 1));
          if (d.deviceId === prevOutput) { opt.selected = true; matchedOutput = true; defaultOutput.selected = false; }
          outputSel.appendChild(opt);
        });
        if (!matchedOutput) defaultOutput.selected = true;
      }
      recUpdateChannelOptions(iid);
    }

    // ── Batch operations for page switching ──
    function recStartMeteringAll() {
      for (const iid of _recInstances.keys()) recStartMetering(iid);
    }
    function recStopMeteringAll() {
      for (const iid of _recInstances.keys()) recStopMetering(iid);
    }
    async function recEnumerateDevicesAll() {
      await recEnumerateDevicesGlobal();
      for (const iid of _recInstances.keys()) recPopulateDeviceSelects(iid);
    }

    function recInputOptionExists(iid, deviceId) {
      const sel = _re(iid, 'rec-input-src');
      if (!sel) return false;
      const want = String(deviceId || '').trim();
      if (!want) return false;
      return Array.from(sel.options || []).some((o) => String(o.value || '') === want);
    }

    function recNeedsMeterRestartAfterDeviceChange(iid) {
      const st = _ri(iid);
      const inputSel = _re(iid, 'rec-input-src');
      if (!st || !inputSel) return false;
      if (st.recording) return false;
      const selected = String(inputSel.value || 'default');
      if (selected === 'default') return true;
      if (!recInputOptionExists(iid, selected)) return true;
      const tracks = st.meterStream ? st.meterStream.getAudioTracks() : [];
      if (!tracks.length) return true;
      const dead = tracks.some((t) => t.readyState === 'ended' || t.muted);
      return !!dead;
    }

    function recHandleInputDeviceChange() {
      const pg = document.getElementById('page-record');
      if (!(pg && pg.classList.contains('active'))) return;
      recEnumerateDevicesAll().finally(() => {
        for (const iid of _recInstances.keys()) {
          if (!recNeedsMeterRestartAfterDeviceChange(iid)) continue;
          recStopMetering(iid);
          setTimeout(() => recStartMetering(iid), 90);
        }
      });
    }

    // ── DOMContentLoaded: global listeners ──
    document.addEventListener('DOMContentLoaded', () => {
      bindStepperPressAndHold();
      document.addEventListener('keydown', (e) => {
        if (e.defaultPrevented) return;
        const key = (e.key || '').toLowerCase();
        if (key !== 'delete' && key !== 'backspace') return;
        const t = e.target;
        if (t instanceof Element) {
          if (t.closest('input,textarea,select,[contenteditable="true"]')) return;
        }
        if (typeof _isBlockingOverlayOpen === 'function' && _isBlockingOverlayOpen()) return;
        if (recDeleteSelectedLink()) e.preventDefault();
      });
      // Close save-to menus on outside click
      document.addEventListener('pointerdown', (e) => {
        if (!(e.target instanceof Element && e.target.closest('.rec-link-path'))) {
          if (_recSelectedLinkKey) {
            _recSelectedLinkKey = '';
            recRenderLinks();
          }
        }
        for (const iid of _recInstances.keys()) {
          const wrap = _re(iid, 'rec-save-to-wrap');
          if (wrap && !wrap.contains(e.target)) recCloseSaveToMenu(iid);
        }
      });
      // Close context menus on outside click
      document.addEventListener('pointerdown', (e) => {
        for (const iid of _recInstances.keys()) {
          const menu = _re(iid, 'rec-recs-context-menu');
          if (menu && !menu.contains(e.target)) recCloseContextMenu(iid);
        }
      });
      // Close window context menus on outside click
      document.addEventListener('pointerdown', (e) => {
        for (const iid of _recInstances.keys()) {
          const menu = _re(iid, 'rec-window-context-menu');
          if (menu && !menu.contains(e.target)) recCloseWindowContextMenu(iid);
        }
      });
      // Recenter windows on resize
      window.addEventListener('resize', () => {
        if (_recDraggingIid == null) {
          for (const iid of _recInstances.keys()) recCenterWindowBlock(iid);
        }
        recRenderLinks();
      });
      // MutationObserver for page switching
      const observer = new MutationObserver(() => {
        const page = document.getElementById('page-record');
        if (page && page.classList.contains('active')) {
          for (const iid of _recInstances.keys()) recCenterWindowBlock(iid);
          recEnumerateDevicesAll().finally(() => recStartMeteringAll());
          recRenderLinks();
        }
      });
      const page = document.getElementById('page-record');
      if (page) observer.observe(page, { attributes: true, attributeFilter: ['class'] });
      // Re-enumerate on device plug/unplug
      if (navigator.mediaDevices) {
        navigator.mediaDevices.addEventListener('devicechange', () => {
          recHandleInputDeviceChange();
        });
      }
    });

    /* ═══════════════════════════════════════════
       Livestreaming Page Logic
       ═══════════════════════════════════════════ */
    const _lsState = {
      streaming: false,
      backendStarting: false,
      encoderReady: false,
      encoderReason: '',
      encoderPath: '',
      timer: null,
      seconds: 0,
      previewStream: null,
      audioMeterCtx: null,
      audioMeterSource: null,
      audioMeterAnalyserL: null,
      audioMeterAnalyserR: null,
      audioMeterRaf: 0,
      audioMeterDisplayL: 0,
      audioMeterDisplayR: 0,
      audioMeterPeakL: 0,
      audioMeterPeakR: 0,
      selectedCameraId: '',
      selectedAudioId: '',
      destinations: [],
      destIdCounter: 0,
      protocol: 'rtmp',
      sourceMode: 'camera', // camera-only
      aspect: '16:9',           // '16:9' | '9:16'
      lowerThirdOn: false,
      projectionPreviewActive: false,
      projectionPreviewReady: false,
      monitorMuted: true,
      monitorGainNode: null,
      previewDisabled: false,
      projectionPreviewFpsLive: 5,
      projectionPreviewFpsIdle: 8,
    };

    function _lsMeterDbFromRms(rms) {
      const safe = Math.max(1e-6, Number(rms) || 0);
      return 20 * Math.log10(safe);
    }

    /* ── LS Preview Context Menu ── */
    (function initLsPreviewContextMenu() {
      document.addEventListener('DOMContentLoaded', () => {
        const box = document.getElementById('ls-preview-box');
        if (!box) return;
        box.addEventListener('contextmenu', _lsOnPreviewContextMenu);
        document.addEventListener('click', _lsHidePreviewCtx);
        document.addEventListener('contextmenu', (e) => {
          if (!e.target.closest('#ls-preview-box') && !e.target.closest('#ls-preview-ctx')) _lsHidePreviewCtx();
        });
      });
    })();

    function _lsOnPreviewContextMenu(e) {
      e.preventDefault();
      e.stopPropagation();
      const menu = document.getElementById('ls-preview-ctx');
      if (!menu) return;
      const disabled = _lsState.previewDisabled;
      const hasPreview = _lsState.projectionPreviewActive || !!_lsState.previewStream;
      let html = '';
      // Toggle preview rendering
      if (hasPreview || disabled) {
        html += `<div class="ls-preview-ctx-item" onclick="lsTogglePreviewDisabled()">`
          + `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`
          + (disabled
            ? `<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>`
            : `<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="2" y1="3" x2="22" y2="17"/>`)
          + `</svg>`
          + (disabled ? 'Enable Preview' : 'Disable Preview')
          + `<span class="ls-ctx-note">${disabled ? '' : 'saves GPU'}</span>`
          + `</div>`;
      }
      if (!html) {
        html = '<div class="ls-preview-ctx-item" style="color:rgba(255,255,255,0.3);cursor:default;pointer-events:none;">No preview active</div>';
      }
      menu.innerHTML = html;
      // Position
      menu.classList.add('visible');
      const mw = menu.offsetWidth;
      const mh = menu.offsetHeight;
      let x = e.clientX;
      let y = e.clientY;
      if (x + mw > window.innerWidth - 8) x = window.innerWidth - mw - 8;
      if (y + mh > window.innerHeight - 8) y = window.innerHeight - mh - 8;
      menu.style.left = x + 'px';
      menu.style.top = y + 'px';
    }

    function _lsHidePreviewCtx() {
      const menu = document.getElementById('ls-preview-ctx');
      if (menu) menu.classList.remove('visible');
    }

    function lsTogglePreviewDisabled() {
      _lsHidePreviewCtx();
      lsSetPreviewDisabled(!_lsState.previewDisabled);
    }

    function lsSetPreviewDisabled(disabled) {
      _lsState.previewDisabled = !!disabled;
      const overlay = document.getElementById('ls-preview-disabled-overlay');
      const img = document.getElementById('ls-preview-capture');
      const vid = document.getElementById('ls-preview-video');
      if (disabled) {
        // Hide the rendering elements but keep stream pipeline alive
        if (img) img.style.visibility = 'hidden';
        if (vid) vid.style.visibility = 'hidden';
        if (overlay) overlay.classList.add('active');
      } else {
        // Restore rendering
        if (img) img.style.visibility = '';
        if (vid) vid.style.visibility = '';
        if (overlay) overlay.classList.remove('active');
      }
      _lsApplyProjectionPreviewPolicy();
    }

    function _lsApplyProjectionPreviewPolicy() {
      if (_lsState.sourceMode !== 'projection') return;
      if (!window.BSPDesktop || typeof window.BSPDesktop.setProjectionPreviewOptions !== 'function') return;
      const isActive = !!_lsState.projectionPreviewActive;
      const enabled = isActive && !_lsState.previewDisabled;
      const fps = _lsState.streaming
        ? Math.max(1, Number(_lsState.projectionPreviewFpsLive) || 5)
        : Math.max(1, Number(_lsState.projectionPreviewFpsIdle) || 8);
      window.BSPDesktop.setProjectionPreviewOptions({ enabled, fps }).catch(() => {});
    }


    function _lsMeterNormFromDb(db) {
      const clamped = Math.max(-60, Math.min(0, Number(db) || -60));
      return (clamped + 60) / 60;
    }

    function inferStreamProtocol(url, fallback = 'rtmp') {
      const raw = String(url || '').trim().toLowerCase();
      if (raw.startsWith('srt://')) return 'srt';
      if (raw.startsWith('rtmps://')) return 'rtmps';
      if (raw.startsWith('rtmp://')) return 'rtmp';
      if (raw.startsWith('https://') || raw.startsWith('http://')) return 'whip';
      return fallback;
    }

    function _lsRenderAudioMeter(lNorm, rNorm) {
      const fillL = document.getElementById('ls-audio-fill-l');
      const fillR = document.getElementById('ls-audio-fill-r');
      const peakL = document.getElementById('ls-audio-peak-l');
      const peakR = document.getElementById('ls-audio-peak-r');
      if (!fillL || !fillR || !peakL || !peakR) return;
      const left = Math.max(0, Math.min(1, Number(lNorm) || 0));
      const right = Math.max(0, Math.min(1, Number(rNorm) || 0));
      _lsState.audioMeterDisplayL = _meterSmooth(_lsState.audioMeterDisplayL || 0, left);
      _lsState.audioMeterDisplayR = _meterSmooth(_lsState.audioMeterDisplayR || 0, right);
      _lsState.audioMeterPeakL = Math.max(_lsState.audioMeterDisplayL, (_lsState.audioMeterPeakL || 0) - _meterBallistics.peakFall);
      _lsState.audioMeterPeakR = Math.max(_lsState.audioMeterDisplayR, (_lsState.audioMeterPeakR || 0) - _meterBallistics.peakFall);
      fillL.style.height = `${Math.round(_lsState.audioMeterDisplayL * 100)}%`;
      fillR.style.height = `${Math.round(_lsState.audioMeterDisplayR * 100)}%`;
      peakL.style.bottom = `${Math.round(_lsState.audioMeterPeakL * 100)}%`;
      peakR.style.bottom = `${Math.round(_lsState.audioMeterPeakR * 100)}%`;
    }

    function _lsResetAudioMeter() {
      _lsState.audioMeterDisplayL = 0;
      _lsState.audioMeterDisplayR = 0;
      _lsState.audioMeterPeakL = 0;
      _lsState.audioMeterPeakR = 0;
      _lsRenderAudioMeter(0, 0);
    }

    function _lsStopAudioMeter() {
      if (_lsState.audioMeterRaf) {
        cancelAnimationFrame(_lsState.audioMeterRaf);
        _lsState.audioMeterRaf = 0;
      }
      if (_lsState.audioMeterSource) {
        try { _lsState.audioMeterSource.disconnect(); } catch (e) {}
      }
      if (_lsState.audioMeterAnalyserL) {
        try { _lsState.audioMeterAnalyserL.disconnect(); } catch (e) {}
      }
      if (_lsState.audioMeterAnalyserR) {
        try { _lsState.audioMeterAnalyserR.disconnect(); } catch (e) {}
      }
      if (_lsState.monitorGainNode) {
        try { _lsState.monitorGainNode.disconnect(); } catch (e) {}
      }
      _lsState.audioMeterSource = null;
      _lsState.audioMeterAnalyserL = null;
      _lsState.audioMeterAnalyserR = null;
      _lsState.monitorGainNode = null;
      if (_lsState.audioMeterCtx) {
        try { _lsState.audioMeterCtx.close(); } catch (e) {}
      }
      _lsState.audioMeterCtx = null;
      _lsResetAudioMeter();
    }

    function lsToggleMonitoring() {
      _lsState.monitorMuted = !_lsState.monitorMuted;
      if (_lsState.monitorGainNode) {
        _lsState.monitorGainNode.gain.setTargetAtTime(
          _lsState.monitorMuted ? 0 : 1, _lsState.monitorGainNode.context.currentTime, 0.015
        );
      }
      lsSyncMonitorBtn();
    }

    function lsSyncMonitorBtn() {
      const btn = document.getElementById('ls-meter-hp-btn');
      if (!btn) return;
      const on = !_lsState.monitorMuted;
      btn.classList.toggle('monitoring', on);
      btn.title = on ? 'Headphone Monitoring (on)' : 'Headphone Monitoring (muted)';
      btn.innerHTML = on
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14v3a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z"/><path d="M21 14v3a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2z"/><path d="M4 13a8 8 0 0 1 16 0"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14v3a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z"/><path d="M21 14v3a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2z"/><path d="M4 13a8 8 0 0 1 16 0"/><line x1="2" y1="2" x2="22" y2="22"/></svg>';
    }

    function _lsBuildOriginalAudioConstraints(deviceId) {
      const c = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: { ideal: 2 },
        sampleRate: { ideal: 48000 },
        sampleSize: { ideal: 24 },
        latency: { ideal: 0.0, max: 0.005 }
      };
      if (deviceId) c.deviceId = { exact: deviceId };
      return c;
    }

    function _lsStartAudioMeter(stream) {
      _lsStopAudioMeter();
      const audioTracks = stream && typeof stream.getAudioTracks === 'function' ? stream.getAudioTracks() : [];
      if (!audioTracks || !audioTracks.length) {
        _lsResetAudioMeter();
        return;
      }
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      try {
        const ctx = new AudioCtx({ latencyHint: 0, sampleRate: 48000 });
        _lsState.audioMeterCtx = ctx;
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        const src = ctx.createMediaStreamSource(stream);
        const splitter = ctx.createChannelSplitter(2);
        const analyserL = ctx.createAnalyser();
        const analyserR = ctx.createAnalyser();
        analyserL.fftSize = 512;
        analyserR.fftSize = 512;
        analyserL.smoothingTimeConstant = 0.55;
        analyserR.smoothingTimeConstant = 0.55;
        src.connect(splitter);
        splitter.connect(analyserL, 0);
        splitter.connect(analyserR, 1);
        const monGain = ctx.createGain();
        monGain.gain.value = _lsState.monitorMuted ? 0 : 1;
        src.connect(monGain);
        monGain.connect(ctx.destination);
        _lsState.monitorGainNode = monGain;
        _lsState.audioMeterSource = src;
        _lsState.audioMeterAnalyserL = analyserL;
        _lsState.audioMeterAnalyserR = analyserR;
        const bufL = new Float32Array(analyserL.fftSize);
        const bufR = new Float32Array(analyserR.fftSize);

        const frame = () => {
          if (!_lsState.audioMeterAnalyserL || !_lsState.audioMeterAnalyserR) return;
          analyserL.getFloatTimeDomainData(bufL);
          analyserR.getFloatTimeDomainData(bufR);
          let sumL = 0;
          let sumR = 0;
          for (let i = 0; i < bufL.length; i++) {
            const l = bufL[i];
            const r = bufR[i];
            sumL += l * l;
            sumR += r * r;
          }
          const rmsL = Math.sqrt(sumL / bufL.length);
          const rmsR = Math.sqrt(sumR / bufR.length);
          let normL = _lsMeterNormFromDb(_lsMeterDbFromRms(rmsL));
          let normR = _lsMeterNormFromDb(_lsMeterDbFromRms(rmsR));
          if (normR < 0.003 && normL > 0.01) normR = normL;
          _lsRenderAudioMeter(normL, normR);
          _lsState.audioMeterRaf = requestAnimationFrame(frame);
        };
        _lsState.audioMeterRaf = requestAnimationFrame(frame);
      } catch (e) {
        _lsResetAudioMeter();
      }
    }

    async function lsRefreshCameraSources() {
      const select = document.getElementById('ls-camera-source');
      if (!select) return;
      const previous = _lsState.selectedCameraId || select.value || '';
      select.innerHTML = '<option value="">Loading cameras...</option>';
      if (!(navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function')) {
        select.innerHTML = '<option value="">Camera listing not supported</option>';
        return;
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(d => d.kind === 'videoinput');
        if (!cameras.length) {
          select.innerHTML = '<option value="">No camera found</option>';
          _lsState.selectedCameraId = '';
          return;
        }
        select.innerHTML = '<option value="">Default camera</option>';
        cameras.forEach((cam, idx) => {
          const opt = document.createElement('option');
          opt.value = cam.deviceId || '';
          opt.textContent = _sanitizeSourceDisplayLabel(cam.label, `Camera ${idx + 1}`);
          select.appendChild(opt);
        });
        if (previous && cameras.some(c => c.deviceId === previous)) {
          select.value = previous;
          _lsState.selectedCameraId = previous;
        } else {
          _lsState.selectedCameraId = '';
        }
      } catch (e) {
        select.innerHTML = '<option value="">Unable to list cameras</option>';
      }
    }

    function _lsBuildCameraVideoConstraints() {
      const isPortrait = _lsState.aspect === '9:16';
      const selectedCameraId = _lsState.selectedCameraId || (document.getElementById('ls-camera-source')?.value || '');
      return {
        width: isPortrait ? 720 : 1280,
        height: isPortrait ? 1280 : 720,
        ...(selectedCameraId ? { deviceId: { exact: selectedCameraId } } : { facingMode: 'user' })
      };
    }

    async function _lsSwapPreviewAudioTrack() {
      if (!(_lsState.previewStream && _lsState.previewStream.active)) return false;
      const selectedAudioId = _lsState.selectedAudioId || (document.getElementById('ls-audio-source')?.value || '');
      let tmp = null;
      try {
        tmp = await navigator.mediaDevices.getUserMedia({
          audio: _lsBuildOriginalAudioConstraints(selectedAudioId),
          video: false
        });
        const newTrack = tmp.getAudioTracks()[0];
        if (!newTrack) return false;
        if (typeof newTrack.applyConstraints === 'function') {
          try {
            await newTrack.applyConstraints({
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            });
          } catch (_) {}
        }
        _lsState.previewStream.getAudioTracks().forEach((t) => {
          try { _lsState.previewStream.removeTrack(t); } catch (_) {}
          try { t.stop(); } catch (_) {}
        });
        _lsState.previewStream.addTrack(newTrack);
        _lsStartAudioMeter(_lsState.previewStream);
        return true;
      } catch (e) {
        return false;
      } finally {
        if (tmp) {
          tmp.getAudioTracks().forEach((t) => {
            if (_lsState.previewStream && _lsState.previewStream.getAudioTracks().includes(t)) return;
            try { t.stop(); } catch (_) {}
          });
          tmp.getVideoTracks().forEach((t) => { try { t.stop(); } catch (_) {} });
        }
      }
    }

    async function _lsSwapPreviewVideoTrack() {
      if (!(_lsState.previewStream && _lsState.previewStream.active)) return false;
      let tmp = null;
      try {
        tmp = await navigator.mediaDevices.getUserMedia({
          video: _lsBuildCameraVideoConstraints(),
          audio: false
        });
        const newTrack = tmp.getVideoTracks()[0];
        if (!newTrack) return false;
        _lsState.previewStream.getVideoTracks().forEach((t) => {
          try { _lsState.previewStream.removeTrack(t); } catch (_) {}
          try { t.stop(); } catch (_) {}
        });
        _lsState.previewStream.addTrack(newTrack);
        const vid = document.getElementById('ls-preview-video');
        if (vid) {
          if (vid.srcObject !== _lsState.previewStream) vid.srcObject = _lsState.previewStream;
          vid.muted = true;
          vid.play().catch(() => {});
        }
        return true;
      } catch (e) {
        return false;
      } finally {
        if (tmp) {
          tmp.getVideoTracks().forEach((t) => {
            if (_lsState.previewStream && _lsState.previewStream.getVideoTracks().includes(t)) return;
            try { t.stop(); } catch (_) {}
          });
          tmp.getAudioTracks().forEach((t) => { try { t.stop(); } catch (_) {} });
        }
      }
    }

    function lsHandleCameraSourceChange() {
      const select = document.getElementById('ls-camera-source');
      _lsState.selectedCameraId = select ? String(select.value || '') : '';
      if (_lsState.sourceMode === 'camera' && _lsState.previewStream) {
        _lsSwapPreviewVideoTrack().then((ok) => {
          if (!ok) _lsStartCameraPreview();
        });
      }
    }

    async function lsRefreshAudioSources() {
      const select = document.getElementById('ls-audio-source');
      if (!select) return;
      const previous = _lsState.selectedAudioId || select.value || '';
      select.innerHTML = '<option value="">Loading inputs...</option>';
      if (!(navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function')) {
        select.innerHTML = '<option value="">Audio listing not supported</option>';
        return;
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter(d => d.kind === 'audioinput');
        if (!inputs.length) {
          select.innerHTML = '<option value="">No audio input found</option>';
          _lsState.selectedAudioId = '';
          return;
        }
        select.innerHTML = '<option value="">Default input</option>';
        inputs.forEach((mic, idx) => {
          const opt = document.createElement('option');
          opt.value = mic.deviceId || '';
          opt.textContent = _sanitizeSourceDisplayLabel(mic.label, `Input ${idx + 1}`);
          select.appendChild(opt);
        });
        if (previous && inputs.some(i => i.deviceId === previous)) {
          select.value = previous;
          _lsState.selectedAudioId = previous;
        } else {
          _lsState.selectedAudioId = '';
        }
      } catch (e) {
        select.innerHTML = '<option value="">Unable to list audio inputs</option>';
      }
    }

    function lsHandleAudioSourceChange() {
      const select = document.getElementById('ls-audio-source');
      _lsState.selectedAudioId = select ? String(select.value || '') : '';
      if (_lsState.sourceMode === 'camera' && _lsState.previewStream) {
        _lsSwapPreviewAudioTrack().then((ok) => {
          if (!ok) _lsStartCameraPreview();
        });
      }
    }

    function _lsSetEncoderStatus(kind, text, tooltip) {
      const el = document.getElementById('ls-encoder-status');
      if (!el) return;
      el.classList.remove('ready', 'warn', 'err');
      if (kind) el.classList.add(kind);
      el.textContent = text || 'Encoder: Unknown';
      el.title = tooltip || text || 'Encoder status';
    }

    async function _lsCheckEncoderReadiness(opts = {}) {
      const silent = !!opts.silent;
      if (!(window.BSPDesktop)) {
        _lsState.encoderReady = false;
        _lsState.encoderReason = 'Desktop stream backend unavailable.';
        _lsSetEncoderStatus('err', 'Encoder: Backend Missing', _lsState.encoderReason);
        if (!silent) _lsFlash(_lsState.encoderReason);
        return false;
      }
      _lsSetEncoderStatus('', 'Encoder: Checking...', 'Checking stream backend...');
      const applyReadiness = (ready) => {
        if (!ready || ready.ok === false) {
          _lsState.encoderReady = false;
          _lsState.encoderReason = 'Could not verify stream encoder.';
          _lsSetEncoderStatus('err', 'Encoder: Check Failed', _lsState.encoderReason);
          if (!silent) _lsFlash(_lsState.encoderReason);
          return false;
        }
        _lsState.encoderPath = ready.path || '';
        _lsState.encoderReason = ready.reason || '';
        if (ready.platformSupported === false) {
          _lsState.encoderReady = false;
          _lsSetEncoderStatus('warn', 'Encoder: Unsupported Platform', _lsState.encoderReason || 'Streaming backend not supported on this platform.');
          if (!silent) _lsFlash(_lsState.encoderReason || 'Streaming backend not supported on this platform.');
          return false;
        }
        if (ready.available === false) {
          _lsState.encoderReady = false;
          _lsSetEncoderStatus('err', 'Encoder: FFmpeg Missing', _lsState.encoderReason || 'ffmpeg not found');
          if (!silent) _lsFlash(_lsState.encoderReason || 'ffmpeg not found');
          return false;
        }
        _lsState.encoderReady = true;
        _lsSetEncoderStatus('ready', 'Encoder: Ready', _lsState.encoderPath || 'ffmpeg found');
        return true;
      };
      try {
        if (typeof window.BSPDesktop.getStreamReadiness === 'function') {
          const ready = await window.BSPDesktop.getStreamReadiness();
          return applyReadiness(ready);
        }
        if (typeof window.BSPDesktop.getStreamStatus === 'function') {
          const st = await window.BSPDesktop.getStreamStatus();
          if (st && st.ok) {
            return applyReadiness({
              ok: true,
              available: st.ffmpegAvailable !== false,
              platformSupported: st.platformSupported !== false,
              path: st.ffmpegPath || '',
              reason: st.readinessReason || ''
            });
          }
        }
        return applyReadiness({ ok: false });
      } catch (e) {
        const msg = (e && e.message) ? String(e.message) : '';
        if (/No handler registered|stream-readiness/i.test(msg) && typeof window.BSPDesktop.getStreamStatus === 'function') {
          try {
            const st = await window.BSPDesktop.getStreamStatus();
            if (st && st.ok) {
              return applyReadiness({
                ok: true,
                available: st.ffmpegAvailable !== false,
                platformSupported: st.platformSupported !== false,
                path: st.ffmpegPath || '',
                reason: st.readinessReason || ''
              });
            }
          } catch (e2) {}
        }
        _lsState.encoderReady = false;
        _lsState.encoderReason = msg || 'Failed to query stream backend.';
        _lsSetEncoderStatus('err', 'Encoder: Check Failed', _lsState.encoderReason);
        if (!silent) _lsFlash(_lsState.encoderReason);
        return false;
      }
    }

    function _lsSetLiveUi(isLive) {
      const btn = document.getElementById('ls-btn-golive');
      const dot = document.getElementById('ls-live-dot');
      const badge = document.getElementById('ls-preview-badge');
      if (btn) {
        btn.disabled = false;
        if (isLive) {
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg><span>End Stream</span>';
          btn.classList.add('streaming');
        } else {
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg><span>Go Live</span>';
          btn.classList.remove('streaming');
        }
      }
      if (dot) {
        dot.classList.toggle('live', !!isLive);
        const label = dot.querySelector('.ls-dot-label');
        if (label) label.textContent = isLive ? 'LIVE' : 'OFFLINE';
      }
      if (badge) {
        badge.textContent = isLive ? 'LIVE' : 'PREVIEW';
        badge.classList.toggle('live', !!isLive);
      }
      _lsUpdateDestStatuses(!!isLive);
      _lsApplyProjectionPreviewPolicy();
    }

    function _lsStartTimer() {
      if (_lsState.timer) clearInterval(_lsState.timer);
      _lsState.seconds = 0;
      _lsUpdateTimer();
      _lsState.timer = setInterval(() => { _lsState.seconds++; _lsUpdateTimer(); }, 1000);
    }

    function _lsStopTimer() {
      if (_lsState.timer) clearInterval(_lsState.timer);
      _lsState.timer = null;
      _lsState.seconds = 0;
      _lsUpdateTimer();
    }

    function _lsCollectTargets() {
      const enabledDestinations = (_lsState.destinations || [])
        .filter(d => d && d.enabled !== false)
        .map(d => ({
          url: _lsNormalizeDestinationUrl(String(d.platform || 'custom'), d.rtmpUrl || ''),
          key: String(d.streamKey || '').trim(),
          name: String(d.name || d.platform || 'Destination'),
          protocol: String(d.protocol || inferStreamProtocol(d.rtmpUrl, _lsState.protocol || 'rtmp'))
        }))
        .filter(d => d.url && (d.protocol === 'srt' || d.key));
      if (enabledDestinations.length) return enabledDestinations;
      const url = (document.getElementById('ls-rtmp-url')?.value || '').trim();
      const key = (document.getElementById('ls-stream-key')?.value || '').trim();
      const protocol = inferStreamProtocol(url, _lsState.protocol || 'rtmp');
      if (url && (protocol === 'srt' || key)) {
        return [{ url, key, name: 'Primary Output', protocol }];
      }
      return [];
    }

    async function _lsSyncBackendStatus() {
      if (!(window.BSPDesktop && typeof window.BSPDesktop.getStreamStatus === 'function')) return;
      try {
        const st = await window.BSPDesktop.getStreamStatus();
        if (!st || !st.ok) return;
        if (st.platformSupported === false) {
          _lsState.encoderReady = false;
          _lsSetEncoderStatus('warn', 'Encoder: Unsupported Platform', st.readinessReason || 'Streaming backend not supported on this platform.');
        } else if (st.ffmpegAvailable === false) {
          _lsState.encoderReady = false;
          _lsSetEncoderStatus('err', 'Encoder: FFmpeg Missing', st.readinessReason || 'ffmpeg not found');
        } else if (st.ffmpegPath) {
          _lsState.encoderReady = true;
          _lsSetEncoderStatus('ready', 'Encoder: Ready', st.ffmpegPath);
        }
        const isBackendLive = !!st.running && (st.status === 'live' || st.status === 'starting' || st.status === 'stopping');
        const owner = String(st.streamOwner || '').trim();
        const mirrorToLs = !owner || owner === 'livestreaming-page';
        const isLive = isBackendLive && mirrorToLs;
        _lsState.streaming = isLive;
        _lsState.backendStarting = isLive && st.status === 'starting';
        if (isLive) {
          if (!_lsState.timer && st.startedAt) {
            _lsState.seconds = Math.max(0, Math.floor((Date.now() - st.startedAt) / 1000));
            _lsStartTimer();
          }
        } else {
          _lsStopTimer();
        }
        _lsSetLiveUi(isLive);
        if (st.status === 'error' && st.lastError) {
          _lsFlash(`Stream error: ${st.lastError}`);
        }
      } catch (e) {}
    }

    const _LS_PLATFORMS = {
      youtube:   { name: 'YouTube',      color: '#FF0000', icon: '▶' },
      facebook:  { name: 'Facebook',     color: '#1877F2', icon: 'f' },
      twitch:    { name: 'Twitch',       color: '#9146FF', icon: '⚡' },
      kick:      { name: 'Kick',         color: '#53FC18', icon: 'K' },
      instagram: { name: 'Instagram',    color: '#E4405F', icon: '📷' },
      tiktok:    { name: 'TikTok',       color: '#000000', icon: '♪' },
      x:         { name: 'X (Twitter)',   color: '#1DA1F2', icon: '𝕏' },
      linkedin:  { name: 'LinkedIn',     color: '#0A66C2', icon: 'in' },
      custom:    { name: 'Custom RTMP',  color: '#6366f1', icon: '⚙' },
    };

    /* ─── Source Mode Switching ─── */
    function lsSwitchSource(mode) {
      mode = 'camera';
      const prevMode = _lsState.sourceMode;
      _lsState.sourceMode = mode;

      // Update tabs
      document.querySelectorAll('.ls-source-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.source === mode);
      });

      // Stop any running preview first
      if (prevMode !== mode) lsStopPreview();

      // Update source badge
      const badge = document.getElementById('ls-source-badge');
      if (badge) badge.textContent = 'CAMERA';

      // Update no-signal text and icon
      const noSigText = document.getElementById('ls-no-signal-text');
      const noSig = document.getElementById('ls-no-signal');
      const noSigSvg = noSig?.querySelector('svg');
      if (noSigText) noSigText.textContent = 'No Camera Feed';
      if (noSigSvg) noSigSvg.innerHTML = '<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>';

      // Show/hide camera-only controls
      const aspectGroup = document.getElementById('ls-aspect-group');
      if (aspectGroup) aspectGroup.classList.toggle('visible', mode === 'camera');
      const cameraGroup = document.getElementById('ls-camera-group');
      if (cameraGroup) cameraGroup.classList.toggle('visible', mode === 'camera');
      const audioGroup = document.getElementById('ls-audio-group');
      if (audioGroup) audioGroup.classList.toggle('visible', mode === 'camera');

      const ltCard = document.getElementById('ls-lt-card');
      if (ltCard) ltCard.classList.toggle('visible', mode === 'camera');

      // Restore lower third if it was on
      if (_lsState.lowerThirdOn) {
        const lt = document.getElementById('ls-lowerthird');
        if (lt) lt.classList.add('visible');
      }
      const previewBox = document.getElementById('ls-preview-box');
      if (previewBox) previewBox.style.aspectRatio = '';
      // Camera mode uses its own selected aspect/layout
      lsSetAspect(_lsState.aspect === '9:16' ? '9:16' : '16:9');
      lsRefreshCameraSources();
      lsRefreshAudioSources();

      // Update start button text
      const startBtn = document.getElementById('ls-start-preview-btn');
      if (startBtn) startBtn.textContent = 'Start Camera';
    }

    function lsSyncProjectionLayoutFromProgramDisplay() {
      if (_lsState.sourceMode !== 'projection') return;
      const shell = document.getElementById('program-display-shell');
      const page = document.querySelector('.ls-page');
      if (!shell || !page) return;
      const wantsPortrait = shell.dataset.aspect === '9:16';
      const isPortrait = page.classList.contains('portrait-layout');
      if (wantsPortrait && !isPortrait) _lsEnterPortraitLayout();
      if (!wantsPortrait && isPortrait) _lsExitPortraitLayout();
    }

    /* ─── Aspect Ratio ─── */
    function lsSetAspect(ratio) {
      const normalized = (ratio === '9:16') ? '9:16' : '16:9';
      _lsState.aspect = normalized;
      document.querySelectorAll('.ls-aspect-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.aspect === normalized);
      });

      const page = document.querySelector('.ls-page');
      if (!page) return;
      const isPortrait = page.classList.contains('portrait-layout');
      if (normalized === '9:16') {
        if (isPortrait) return;
        _lsEnterPortraitLayout();
      } else {
        if (!isPortrait) return;
        _lsExitPortraitLayout();
      }
    }

    /* Move elements into portrait 3-column layout */
    function _lsEnterPortraitLayout() {
      const page = document.querySelector('.ls-page');
      const main = document.getElementById('ls-main');
      const sidebar = document.getElementById('ls-sidebar-main');
      const portraitBody = document.getElementById('ls-portrait-body');
      const leftPanel = document.getElementById('ls-portrait-left');
      const center = document.getElementById('ls-portrait-center');
      const rightPanel = document.getElementById('ls-portrait-right');

      if (!page || !main || !portraitBody) return;

      // Move topbar to page-level (before portrait body)
      const topbar = main.querySelector('.ls-topbar');
      if (topbar) page.insertBefore(topbar, portraitBody);

      // Move source bar into center
      const sourceBar = main.querySelector('.ls-source-bar');
      if (sourceBar) center.appendChild(sourceBar);

      // Move preview-area (with stage & health strip) into center
      const previewArea = main.querySelector('.ls-preview-area');
      if (previewArea) center.appendChild(previewArea);

      // Move lower third card + config row into left panel
      const ltCard = document.getElementById('ls-lt-card');
      if (ltCard) leftPanel.appendChild(ltCard);
      const configRow = main.querySelector('.ls-config-row');
      if (configRow) {
        // In portrait, stack the cards vertically
        configRow.style.flexDirection = 'column';
        configRow.style.padding = '0';
        leftPanel.appendChild(configRow);
      }

      // Move sidebar contents into right panel
      if (sidebar) {
        while (sidebar.firstChild) {
          rightPanel.appendChild(sidebar.firstChild);
        }
      }

      // Activate portrait layout
      page.classList.add('portrait-layout');
    }

    /* Restore elements back to normal landscape layout */
    function _lsExitPortraitLayout() {
      const page = document.querySelector('.ls-page');
      const main = document.getElementById('ls-main');
      const sidebar = document.getElementById('ls-sidebar-main');
      const leftPanel = document.getElementById('ls-portrait-left');
      const center = document.getElementById('ls-portrait-center');
      const rightPanel = document.getElementById('ls-portrait-right');

      if (!page || !main) return;

      // Deactivate portrait layout first (so hidden elements become visible)
      page.classList.remove('portrait-layout');

      // Move topbar back into main as first child
      const topbar = page.querySelector(':scope > .ls-topbar');
      if (topbar) main.insertBefore(topbar, main.firstChild);

      // Move source bar back to main (after topbar)
      const sourceBar = center?.querySelector('.ls-source-bar');
      const topbarInMain = main.querySelector('.ls-topbar');
      if (sourceBar && topbarInMain) topbarInMain.after(sourceBar);

      // Move preview area back (after source bar)
      const sourceBarInMain = main.querySelector('.ls-source-bar');
      const previewArea = center?.querySelector('.ls-preview-area');
      if (previewArea && sourceBarInMain) sourceBarInMain.after(previewArea);

      // Move lower third card back
      const ltCard = document.getElementById('ls-lt-card');
      const previewInMain = main.querySelector('.ls-preview-area');
      if (ltCard && previewInMain) previewInMain.after(ltCard);

      // Move config row back and restore styles
      const configRow = leftPanel?.querySelector('.ls-config-row');
      if (configRow) {
        configRow.style.flexDirection = '';
        configRow.style.padding = '';
        const ltCardInMain = main.querySelector('.ls-lt-card') || main.querySelector('.ls-preview-area');
        if (ltCardInMain) ltCardInMain.after(configRow);
      }

      // Move sidebar contents back
      if (sidebar && rightPanel) {
        while (rightPanel.firstChild) {
          sidebar.appendChild(rightPanel.firstChild);
        }
      }
    }

    /* ─── Lower Third ─── */
    function lsToggleLowerThird() {
      _lsState.lowerThirdOn = !_lsState.lowerThirdOn;
      const toggle = document.getElementById('ls-lt-toggle');
      if (toggle) toggle.classList.toggle('on', _lsState.lowerThirdOn);
      const lt = document.getElementById('ls-lowerthird');
      if (lt) lt.classList.toggle('visible', _lsState.lowerThirdOn && _lsState.sourceMode === 'camera');
    }

    function lsUpdateLowerThird() {
      const name = document.getElementById('ls-lt-name-input')?.value || '';
      const title = document.getElementById('ls-lt-title-input')?.value || '';
      const color = document.getElementById('ls-lt-color')?.value || '#2f6df6';

      const nameEl = document.getElementById('ls-lt-name');
      const titleEl = document.getElementById('ls-lt-title');
      const barEl = document.getElementById('ls-lt-color-bar');

      if (nameEl) nameEl.textContent = name || 'Speaker Name';
      if (titleEl) titleEl.textContent = title || 'Title / Role';
      if (barEl) barEl.style.background = color;
    }

    function lsSwitchProtocol(proto) {
      _lsState.protocol = proto || 'rtmp';
      document.querySelectorAll('.ls-proto-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.proto === proto);
      });
      const urlInput = document.getElementById('ls-rtmp-url');
      if (urlInput) {
        const placeholders = {
          rtmp: 'rtmp://live.example.com/live',
          rtmps: 'rtmps://live.example.com/live',
          srt: 'srt://live.example.com:9999',
          whip: 'https://whip.example.com/live',
        };
        urlInput.placeholder = placeholders[proto] || '';
      }
      const keyLabel = document.getElementById('ls-stream-key-label');
      if (keyLabel) {
        keyLabel.textContent = (proto === 'srt') ? 'SRT Passphrase (optional)' : 'Stream Key';
      }
      const urlLabel = document.getElementById('ls-stream-url-label');
      if (urlLabel) {
        urlLabel.textContent = (proto === 'srt') ? 'SRT URL' : 'Server / RTMP URL';
      }
      const srtAdvanced = document.getElementById('ls-srt-advanced');
      if (srtAdvanced) {
        srtAdvanced.style.display = (proto === 'srt') ? 'grid' : 'none';
      }
    }

    function lsToggleKeyVis() {
      const inp = document.getElementById('ls-stream-key');
      if (!inp) return;
      inp.type = inp.type === 'password' ? 'text' : 'password';
    }

    async function lsPaste(inputId) {
      try {
        const text = await navigator.clipboard.readText();
        const el = document.getElementById(inputId);
        if (el) el.value = text;
      } catch (e) {}
    }

    /* ─── Preview Start/Stop ─── */
    function lsStartPreview() {
      // If preview was disabled, re-enable the rendering elements first
      if (_lsState.previewDisabled) lsSetPreviewDisabled(false);
      _lsStartCameraPreview();
    }

    function _lsStartProjectionPreview() {
      // Receive preview thumbnails captured from the actual Program Display
      // window by the main process via capturePage — no iframe needed.
      const img = document.getElementById('ls-preview-capture');
      const vid = document.getElementById('ls-preview-video');
      if (!img) return;
      _lsState.projectionPreviewActive = true;
      _lsState.projectionPreviewReady = true;
      if (vid) vid.style.display = 'none';
      img.classList.add('active');
      const noSig = document.getElementById('ls-no-signal');
      if (noSig) noSig.classList.add('hidden');
      // Ask the main process to start sending preview thumbnails
      if (window.BSPDesktop && typeof window.BSPDesktop.startProjectionPreview === 'function') {
        window.BSPDesktop.startProjectionPreview();
      }
      _lsApplyProjectionPreviewPolicy();
      // Route scene audio to LS audio meter in projection mode
      const pgmStream = getPgmOutputStream();
      if (pgmStream) _lsStartAudioMeter(pgmStream);
    }

    function _lsStartCameraPreview() {
      const selectedAudioId = _lsState.selectedAudioId || (document.getElementById('ls-audio-source')?.value || '');
      const constraints = {
        video: _lsBuildCameraVideoConstraints(),
        audio: _lsBuildOriginalAudioConstraints(selectedAudioId),
      };
      if (_lsState.previewStream) {
        _lsState.previewStream.getTracks().forEach(t => t.stop());
        _lsState.previewStream = null;
      }
      navigator.mediaDevices.getUserMedia(constraints)
        .then(async (stream) => {
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
          _lsState.previewStream = stream;
          const vid = document.getElementById('ls-preview-video');
          if (vid) { vid.srcObject = stream; vid.muted = true; }
          _lsStartAudioMeter(stream);
          const noSig = document.getElementById('ls-no-signal');
          if (noSig) noSig.classList.add('hidden');
        })
        .catch(err => {
          console.warn('Camera access failed:', err);
          _lsFlash('Could not access camera — check permissions');
        });
    }

    function lsStopPreview() {
      // Clear disabled state when fully stopping
      if (_lsState.previewDisabled) lsSetPreviewDisabled(false);
      if (_lsState.previewStream) {
        _lsState.previewStream.getTracks().forEach(t => t.stop());
        _lsState.previewStream = null;
      }
      _lsStopAudioMeter();
      const vid = document.getElementById('ls-preview-video');
      if (vid) { vid.srcObject = null; vid.muted = true; vid.style.display = ''; }
      // Tear down projection preview capture
      const img = document.getElementById('ls-preview-capture');
      if (img) {
        img.classList.remove('active');
        img.removeAttribute('src');
      }
      // Tell main process to stop sending preview frames
      if (window.BSPDesktop && typeof window.BSPDesktop.stopProjectionPreview === 'function') {
        window.BSPDesktop.stopProjectionPreview();
      }
      _lsState.projectionPreviewActive = false;
      _lsState.projectionPreviewReady = false;
      _lsApplyProjectionPreviewPolicy();
      const noSig = document.getElementById('ls-no-signal');
      if (noSig) noSig.classList.remove('hidden');
    }

    function updateLsProjectionPreviewScale() {
      // No longer needed — preview is a simple <img> with object-fit:contain.
      // The aspect ratio of the preview box is set via CSS.
    }

    // Preview is now driven by backend-captured thumbnails.
    // syncLsProjectionPreview and its throttle machinery are no longer needed.
    function syncLsProjectionPreview() {
      // No-op — preview frames arrive via IPC from the main process.
    }

    function _syncLsProjectionPreviewImmediate() {
      // No-op — retained for call-site compatibility.
    }

    async function lsToggleStream() {
      const btn = document.getElementById('ls-btn-golive');
      if (_lsState.backendStarting) return;
      if (!window.BSPDesktop || typeof window.BSPDesktop.startStream !== 'function') {
        _lsFlash('Desktop stream backend is unavailable.');
        return;
      }

      if (_lsState.streaming) {
        _lsState.backendStarting = true;
        if (btn) btn.disabled = true;
        try {
          await window.BSPDesktop.stopStream();
        } catch (e) {}
        _lsState.backendStarting = false;
        _lsState.streaming = false;
        _lsStopTimer();
        _lsSetLiveUi(false);
        return;
      }

      const targets = _lsCollectTargets();
      if (!targets.length) {
        _lsFlash('Configure a stream URL + key or add an enabled destination first');
        return;
      }
      const ready = await _lsCheckEncoderReadiness({ silent: false });
      if (!ready) return;

      const resolution = document.getElementById('ls-resolution')?.value || '1280x720';
      const fps = Number(document.getElementById('ls-framerate')?.value || 30);
      const bitrate = Number(document.getElementById('ls-bitrate')?.value || 4500);
      const srtLatencyMs = Number(document.getElementById('ls-srt-latency')?.value || 120);
      const srtMode = String(document.getElementById('ls-srt-mode')?.value || 'caller');
      const cameraSel = document.getElementById('ls-camera-source');
      const selectedCameraLabel = (cameraSel && cameraSel.selectedIndex >= 0)
        ? String(cameraSel.options[cameraSel.selectedIndex]?.text || '')
        : '';
      // Pass the ordinal position (0-based, excluding the "Default camera"
      // placeholder) so the backend can fall back to positional matching when
      // browser labels don't match avfoundation/dshow device names.
      const selectedCameraOrdinal = (cameraSel && cameraSel.selectedIndex > 0)
        ? cameraSel.selectedIndex - 1   // subtract 1 for the placeholder option
        : -1;
      const audioSel = document.getElementById('ls-audio-source');
      const selectedAudioLabel = (audioSel && audioSel.selectedIndex >= 0)
        ? String(audioSel.options[audioSel.selectedIndex]?.text || '')
        : '';
      const selectedAudioOrdinal = (audioSel && audioSel.selectedIndex > 0)
        ? audioSel.selectedIndex - 1
        : -1;

      _lsState.backendStarting = true;
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>Starting...</span>';
      }
      const startResp = await window.BSPDesktop.startStream({
        sourceMode: _lsState.sourceMode,
        streamOwner: 'livestreaming-page',
        resolution,
        fps,
        bitrateKbps: bitrate,
        streamProtocol: _lsState.protocol || inferStreamProtocol(document.getElementById('ls-rtmp-url')?.value || '', 'rtmp'),
        srtLatencyMs,
        srtMode,
        videoDeviceId: _lsState.selectedCameraId || '',
        videoDeviceLabel: selectedCameraLabel,
        videoDeviceOrdinal: selectedCameraOrdinal,
        audioDeviceId: _lsState.selectedAudioId || '',
        audioDeviceLabel: selectedAudioLabel,
        audioDeviceOrdinal: selectedAudioOrdinal,
        targets
      });
      _lsState.backendStarting = false;

      if (!startResp || !startResp.ok) {
        if (btn) btn.disabled = false;
        _lsSetLiveUi(false);
        _lsFlash((startResp && startResp.error) ? startResp.error : 'Failed to start stream');
        return;
      }

      _lsState.streaming = true;
      _lsStartTimer();
      _lsSetLiveUi(true);
      _lsSimulateHealth();
      if (!_lsState.previewStream) lsStartPreview();
    }

    function _lsUpdateTimer() {
      const h = String(Math.floor(_lsState.seconds / 3600)).padStart(2, '0');
      const m = String(Math.floor((_lsState.seconds % 3600) / 60)).padStart(2, '0');
      const s = String(_lsState.seconds % 60).padStart(2, '0');
      const el = document.getElementById('ls-timer');
      if (el) el.textContent = `${h}:${m}:${s}`;
    }

    function _lsSimulateHealth() {
      if (!_lsState.streaming) return;
      const res = document.getElementById('ls-resolution')?.value || '1280x720';
      document.getElementById('ls-health-res').textContent = res.replace('x', '×');
      document.getElementById('ls-health-fps').textContent = (document.getElementById('ls-framerate')?.value || '30') + ' fps';
      const br = parseInt(document.getElementById('ls-bitrate')?.value || '4500');
      const jitter = Math.round((Math.random() - 0.5) * 300);
      document.getElementById('ls-health-bitrate').textContent = (br + jitter) + ' kbps';
      document.getElementById('ls-health-dropped').textContent = String(Math.floor(Math.random() * 3));
      setTimeout(_lsSimulateHealth, 2000);
    }

    function _lsFlash(msg) {
      const topbar = document.querySelector('.ls-topbar');
      if (!topbar) return;
      let flash = topbar.querySelector('.ls-flash');
      if (flash) flash.remove();
      flash = document.createElement('div');
      flash.className = 'ls-flash';
      flash.style.cssText = 'position:absolute;bottom:-32px;left:50%;transform:translateX(-50%);padding:4px 16px;border-radius:6px;background:var(--warning);color:#000;font-size:10px;font-weight:700;white-space:nowrap;z-index:20;pointer-events:none;opacity:1;transition:opacity 0.5s';
      flash.textContent = msg;
      topbar.style.position = 'relative';
      topbar.appendChild(flash);
      setTimeout(() => { flash.style.opacity = '0'; }, 2500);
      setTimeout(() => { flash.remove(); }, 3100);
    }

    /* Destinations */
    const _LS_PLATFORM_DEFAULTS = {
      youtube:   { url: 'rtmps://a.rtmp.youtube.com/live2', help: 'Go to <a href="https://studio.youtube.com" target="_blank">YouTube Studio</a> → Go Live → Stream → copy your Stream URL and Stream Key.' },
      facebook:  { url: 'rtmps://live-api-s.facebook.com:443/rtmp/', help: 'Go to <a href="https://www.facebook.com/live/producer" target="_blank">Facebook Live Producer</a> → Use Stream Key → copy your Server URL and Stream Key.' },
      twitch:    { url: 'rtmp://live.twitch.tv/app/', help: 'Go to <a href="https://dashboard.twitch.tv/settings/stream" target="_blank">Twitch Dashboard</a> → Settings → Stream → copy your Primary Stream Key.' },
      kick:      { url: 'rtmp://fa723fc1b171.global-contribute.live-video.net/app/', help: 'Go to <a href="https://kick.com/dashboard/settings/stream" target="_blank">Kick Dashboard</a> → Stream Key & URL → copy both values.' },
      instagram: { url: 'rtmps://live-upload.instagram.com:443/rtmp/', help: 'Open Instagram app → Go Live → choose "Streaming software" → copy the Stream URL and Stream Key shown.' },
      tiktok:    { url: '', help: 'Open TikTok app or <a href="https://www.tiktok.com/studio" target="_blank">TikTok Studio</a> → Go Live → choose "Go live on PC" → copy the Server URL and Stream Key.' },
      x:         { url: '', help: 'Go to <a href="https://studio.x.com" target="_blank">X (Twitter) Media Studio</a> → Producer → Create Broadcast → copy the RTMP URL and Stream Key.' },
      linkedin:  { url: '', help: 'On LinkedIn, create a LinkedIn Live event → Stream Settings → copy the RTMP URL and Stream Key.' },
      custom:    { url: '', help: 'Enter the RTMP/RTMPS server URL and stream key provided by your streaming platform.' },
    };

    let _lsDestModalPlatform = null;
    let _lsDestEditId = null;

    function _lsNormalizeDestinationUrl(platform, rawUrl) {
      const url = String(rawUrl || '').trim();
      if (!url) return '';
      // Migrate legacy YouTube default (plain RTMP) to RTMPS.
      if (platform === 'youtube' && /^rtmp:\/\/a\.rtmp\.youtube\.com\/live2\/?$/i.test(url)) {
        return 'rtmps://a.rtmp.youtube.com/live2';
      }
      return url;
    }

    function lsOpenDestModal(platform, editId) {
      _lsDestModalPlatform = platform;
      _lsDestEditId = editId || null;
      const p = _LS_PLATFORMS[platform] || _LS_PLATFORMS.custom;
      const defaults = _LS_PLATFORM_DEFAULTS[platform] || _LS_PLATFORM_DEFAULTS.custom;
      const modal = document.getElementById('ls-dest-modal');
      if (!modal) return;

      // Set icon
      const icon = document.getElementById('ls-dest-modal-icon');
      icon.style.background = p.color + '22';
      icon.style.color = p.color;
      icon.textContent = p.icon;

      // Set title
      document.getElementById('ls-dest-modal-title').textContent = editId ? 'Edit ' + p.name : 'Connect to ' + p.name;

      // Set help text
      document.getElementById('ls-dest-modal-help').innerHTML = defaults.help;

      // Pre-fill URL
      const urlInput = document.getElementById('ls-dest-url');
      const keyInput = document.getElementById('ls-dest-key');
      if (editId) {
        const existing = _lsState.destinations.find(d => d.id === editId);
        urlInput.value = existing?.rtmpUrl || defaults.url;
        keyInput.value = existing?.streamKey || '';
      } else {
        urlInput.value = defaults.url;
        keyInput.value = '';
      }
      keyInput.type = 'password';

      // Set button label
      document.getElementById('ls-dest-modal-connect').textContent = editId ? 'Save' : 'Connect';

      modal.classList.add('open');
    }

    function lsCloseDestModal() {
      const modal = document.getElementById('ls-dest-modal');
      if (modal) modal.classList.remove('open');
      _lsDestModalPlatform = null;
      _lsDestEditId = null;
    }

    function lsConfirmDestModal() {
      const platform = _lsDestModalPlatform || 'custom';
      const url = _lsNormalizeDestinationUrl(
        platform,
        document.getElementById('ls-dest-url')?.value || ''
      );
      const key = (document.getElementById('ls-dest-key')?.value || '').trim();
      if (!url) { _lsFlash('Server URL is required'); return; }
      const inferredProtocol = inferStreamProtocol(url, _lsState.protocol || 'rtmp');
      if (inferredProtocol !== 'srt' && !key) { _lsFlash('Stream Key is required'); return; }

      const p = _LS_PLATFORMS[platform] || _LS_PLATFORMS.custom;

      if (_lsDestEditId) {
        // Update existing
        const d = _lsState.destinations.find(d => d.id === _lsDestEditId);
        if (d) {
          d.rtmpUrl = url;
          d.streamKey = key;
          d.protocol = inferredProtocol;
        }
      } else {
        // Add new
        const id = ++_lsState.destIdCounter;
        _lsState.destinations.push({
          id,
          platform,
          name: p.name,
          enabled: true,
          rtmpUrl: url,
          streamKey: key,
          protocol: inferredProtocol
        });
      }

      _lsRenderDestinations();
      lsCloseDestModal();
    }

    function lsAddDestination(platform = 'custom') {
      lsOpenDestModal(platform);
    }

    function lsQuickAdd(platform) {
      // Don't add duplicates
      if (_lsState.destinations.some(d => d.platform === platform)) {
        _lsFlash((_LS_PLATFORMS[platform]?.name || platform) + ' already added');
        return;
      }
      lsOpenDestModal(platform);
    }

    function lsEditDest(id) {
      const d = _lsState.destinations.find(d => d.id === id);
      if (d) lsOpenDestModal(d.platform, id);
    }

    function lsRemoveDest(id) {
      _lsState.destinations = _lsState.destinations.filter(d => d.id !== id);
      _lsRenderDestinations();
    }

    function lsToggleDest(id) {
      const d = _lsState.destinations.find(d => d.id === id);
      if (d) d.enabled = !d.enabled;
      _lsRenderDestinations();
    }

    function _lsUpdateDestStatuses(live) {
      document.querySelectorAll('.ls-dest-status').forEach(el => {
        if (live) {
          el.textContent = 'Connected';
          el.className = 'ls-dest-status connected';
        } else {
          el.textContent = 'Ready';
          el.className = 'ls-dest-status';
        }
      });
    }

    function _lsRenderDestinations() {
      const list = document.getElementById('ls-dest-list');
      if (!list) return;
      list.innerHTML = '';
      if (!_lsState.destinations.length) {
        list.innerHTML = '<div style="padding:20px 10px;text-align:center;color:var(--text-secondary);font-size:10px;opacity:0.6">No destinations added yet.<br>Use Quick Connect below.</div>';
        return;
      }
      _lsState.destinations.forEach(d => {
        const p = _LS_PLATFORMS[d.platform] || _LS_PLATFORMS.custom;
        const hasKey = !!(d.streamKey);
        const statusText = _lsState.streaming && d.enabled ? 'Connected' : (hasKey ? 'Configured' : 'Not configured');
        const statusClass = _lsState.streaming && d.enabled ? 'connected' : (hasKey ? '' : 'warn');
        const item = document.createElement('div');
        item.className = 'ls-dest-item';
        item.innerHTML = `
          <div class="ls-dest-icon" style="background:${p.color}22;color:${p.color};font-weight:900;font-size:14px">${p.icon}</div>
          <div class="ls-dest-info" style="cursor:pointer" onclick="lsEditDest(${d.id})">
            <div class="ls-dest-name">${p.name}</div>
            <div class="ls-dest-status ${statusClass}">${statusText}</div>
          </div>
          <button class="ls-dest-toggle ${d.enabled ? 'on' : ''}" onclick="lsToggleDest(${d.id})"></button>
          <button class="ls-dest-remove" onclick="lsRemoveDest(${d.id})">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>`;
        list.appendChild(item);
      });
    }

    function lsToggleSettings() {
      // Placeholder: could open a modal with advanced settings
      _lsFlash('Advanced settings coming soon');
    }

    function lsSendChat() {
      const inp = document.getElementById('ls-chat-input');
      if (!inp || !inp.value.trim()) return;
      const box = document.getElementById('ls-chat-box');
      const empty = box.querySelector('.ls-chat-empty');
      if (empty) empty.remove();
      const msg = document.createElement('div');
      msg.className = 'ls-chat-msg';
      msg.innerHTML = `<span class="ls-chat-msg-author">You</span>${inp.value.trim().replace(/</g,'&lt;')}`;
      box.appendChild(msg);
      box.scrollTop = box.scrollHeight;
      inp.value = '';
    }

    // Init destinations render on page load
    _lsRenderDestinations();
    lsSwitchProtocol('rtmp');
    lsRefreshCameraSources();
    lsRefreshAudioSources();
    window.addEventListener('resize', updateLsProjectionPreviewScale);
    if (typeof ResizeObserver === 'function') {
      const lsPreviewBox = document.getElementById('ls-preview-box');
      if (lsPreviewBox) {
        const ro = new ResizeObserver(() => updateLsProjectionPreviewScale());
        ro.observe(lsPreviewBox);
      }
    }
    if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === 'function') {
      navigator.mediaDevices.addEventListener('devicechange', () => {
        if (_lsState.sourceMode === 'camera') {
          lsRefreshCameraSources();
          lsRefreshAudioSources();
        }
      });
    }
    _lsSetLiveUi(false);
    _lsCheckEncoderReadiness({ silent: true });
    _lsSyncBackendStatus();
    if (window.BSPDesktop && typeof window.BSPDesktop.onStreamStatus === 'function') {
      window.BSPDesktop.onStreamStatus((status) => {
        const st = status || {};
        if (st.platformSupported === false) {
          _lsState.encoderReady = false;
          _lsSetEncoderStatus('warn', 'Encoder: Unsupported Platform', st.readinessReason || 'Streaming backend not supported on this platform.');
        } else if (st.ffmpegAvailable === false) {
          _lsState.encoderReady = false;
          _lsSetEncoderStatus('err', 'Encoder: FFmpeg Missing', st.readinessReason || 'ffmpeg not found');
        } else if (st.ffmpegPath) {
          _lsState.encoderReady = true;
          _lsSetEncoderStatus('ready', 'Encoder: Ready', st.ffmpegPath);
        }
        const isBackendLive = !!st.running && (st.status === 'live' || st.status === 'starting' || st.status === 'stopping');
        const owner = String(st.streamOwner || '').trim();
        const mirrorToLs = !owner || owner === 'livestreaming-page';
        const isLive = isBackendLive && mirrorToLs;
        _lsState.streaming = isLive;
        _lsState.backendStarting = isLive && st.status === 'starting';
        if (isLive) {
          if (!_lsState.timer) {
            if (st.startedAt) {
              _lsState.seconds = Math.max(0, Math.floor((Date.now() - st.startedAt) / 1000));
            }
            _lsStartTimer();
          }
        } else {
          _lsStopTimer();
        }
        _lsSetLiveUi(isLive);
        if (st.status === 'error' && st.lastError) {
          _lsFlash(`Stream error: ${st.lastError}`);
        }
      });
    }

    /* Projection capture no longer uses an offscreen window — the main
       process captures directly from the Program Display via capturePage.
       The onRequestDisplayStateForStream handler is kept for backwards
       compatibility but is rarely triggered. */
    if (window.BSPDesktop && typeof window.BSPDesktop.onRequestDisplayStateForStream === 'function') {
      window.BSPDesktop.onRequestDisplayStateForStream(() => {
        try { syncStandaloneOutputDirect(); } catch (e) { console.warn('stream display-state sync error', e); }
      });
    }

    /* ── Receive preview thumbnails from the main process ── */
    let _lsPreviewFrameUrl = null;
    if (window.BSPDesktop && typeof window.BSPDesktop.onStreamPreviewFrame === 'function') {
      window.BSPDesktop.onStreamPreviewFrame((data) => {
        if (!_lsState.projectionPreviewActive) return;
        if (_lsState.previewDisabled) return;
        const img = document.getElementById('ls-preview-capture');
        if (!img) return;
        if (!data) {
          // No output window — thumbnail is null
          return;
        }
        // data is a Uint8Array (JPEG bytes)
        try {
          if (_lsPreviewFrameUrl) {
            URL.revokeObjectURL(_lsPreviewFrameUrl);
            _lsPreviewFrameUrl = null;
          }
          const blob = new Blob([data], { type: 'image/jpeg' });
          _lsPreviewFrameUrl = URL.createObjectURL(blob);
          img.src = _lsPreviewFrameUrl;
        } catch (e) {}
      });
    }

