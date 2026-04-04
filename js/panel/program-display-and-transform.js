    function renderProgramDisplay() {
      const comp = document.getElementById('source-compositor');
      if (!comp) return;
      const scene = _activeScene();
      if (!scene || scene.sources.length === 0) {
        // No sources in active scene — clear compositor.
        // Only kill streams for truly orphaned sources (not in ANY scene).
        comp.innerHTML = '';
        Object.keys(_activeStreams).forEach(sid => {
          const global = _findSourceInAnyScene(sid);
          if (!global) {
            _stopStream(sid);
          } else {
            // Keep the stream alive, just detach from mix graph + meters
            _ctrlStopMeter(sid);
            _pgmDisconnectSource(sid);
          }
        });
        Object.keys(_mediaSourceVideoEls).forEach((sid) => {
          if (!_findSourceInAnyScene(sid)) _disposeMediaSourceVideo(sid, true);
        });
        _pgmStopMeter();
        queueStandaloneSyncBurst();
        return;
      }

      // Determine which source IDs are visible
      const visibleIds = new Set();
      scene.sources.forEach(src => {
        if (src.visible !== false) visibleIds.add(src.id);
      });

      // Stop streams for sources no longer in any scene.
      // Keep ALL streams alive if the source exists in ANY scene
      // so scene switching is instant.
      Object.keys(_activeStreams).forEach(sid => {
        const src = scene.sources.find(s => s.id === sid);
        if (!src) {
          // Not in active scene: check all scenes before killing
          const global = _findSourceInAnyScene(sid);
          if (global) {
            // Keep stream alive, just detach from mix graph + meters
            _ctrlStopMeter(sid);
            _pgmDisconnectSource(sid);
          } else {
            _stopStream(sid);
          }
          return;
        }
        if (src.visible !== false) return;
        // Hidden source: detach from graph but keep stream alive
        _ctrlStopMeter(sid);
        _pgmDisconnectSource(sid);
      });
      // Release cached media elements only for sources removed from all scenes.
      Object.keys(_mediaSourceVideoEls).forEach((sid) => {
        if (!_findSourceInAnyScene(sid)) _disposeMediaSourceVideo(sid, true);
      });
      // Release orphaned window capture streams
      Object.keys(_windowCaptureStreams).forEach((sid) => {
        if (!_findSourceInAnyScene(sid)) _stopWindowCapture(sid);
      });

      // Clear and rebuild layers (top of source list = highest z-index = covers layers below)
      const totalSources = scene.sources.length;
      comp.innerHTML = '';
      const sceneRoot = document.createElement('div');
      sceneRoot.className = 'scene-transform-root';
      comp.appendChild(sceneRoot);
      scene.sources.forEach((src, idx) => {
        const layer = document.createElement('div');
        layer.className = 'src-layer';
        if (src.type === 'media-source') layer.classList.add('media-source-layer');
        layer.dataset.srcId = src.id;
        layer.style.zIndex = totalSources - idx;
        if (src.visible === false) layer.style.visibility = 'hidden';

        // Apply transform if present
        const tf = src.transform || {};
        const tx = tf.x ?? 0, ty = tf.y ?? 0;
        const tw = tf.w ?? 100, th = tf.h ?? 100;
        const tr = Number(tf.rotation ?? 0) || 0;
        const cT = tf.cropTop ?? 0, cR = tf.cropRight ?? 0;
        const cB = tf.cropBottom ?? 0, cL = tf.cropLeft ?? 0;
        layer.style.left   = tx + '%';
        layer.style.top    = ty + '%';
        layer.style.width  = tw + '%';
        layer.style.height = th + '%';
        layer.style.transformOrigin = '50% 50%';
        const _transforms = [];
        if (tr) _transforms.push(`rotate(${tr}deg)`);
        const _fH = tf.flipH ? -1 : 1;
        const _fV = tf.flipV ? -1 : 1;
        if (_fH === -1 || _fV === -1) _transforms.push(`scale(${_fH}, ${_fV})`);
        layer.style.transform = _transforms.length ? _transforms.join(' ') : '';
        // Apply crop via clip-path (inset from each edge as % of the layer itself)
        if (cT || cR || cB || cL) {
          layer.style.clipPath = `inset(${cT}% ${cR}% ${cB}% ${cL}%)`;
        }

        switch (src.type) {
          case 'camera': {
            layer.style.background = '#000';
            const vid = document.createElement('video');
            vid.autoplay = true;
            vid.muted = true;
            vid.playsInline = true;
            _bindVisualFitModeAuto(vid, src, { mirror: !!src.config?.mirror });
            layer.appendChild(vid);
            // Reuse existing stream or start new one
            const existing = _activeStreams[src.id];
            if (existing && existing.active) {
              vid.srcObject = existing;
              vid.play().catch(() => {});
            } else {
              _startCameraStream(src.id, src.config?.deviceId, src.config);
            }
            break;
          }
          case 'image': {
            layer.style.background = '#000';
            if (src.config?.dataUrl) {
              const img = document.createElement('img');
              img.src = src.config.dataUrl;
              img.alt = src.name;
              _applyVisualFitMode(img, _getSourceFitMode(src), { mirror: false });
              // Apply opacity
              const opacity = src.config.opacity != null ? src.config.opacity : 100;
              if (opacity < 100) img.style.opacity = (opacity / 100).toFixed(2);
              layer.appendChild(img);
            }
            break;
          }
          case 'media-source': {
            layer.style.background = 'transparent';
            if (_pgmMediaCtrlState.stopped) {
              layer.style.visibility = 'hidden';
              break;
            }
            const mediaUrl = src.config?.dataUrl || (src.config?.filePath ? 'media-file://media' + encodeURI(src.config.filePath) : '');
            if (mediaUrl) {
              const masterVid = _getOrCreateMediaSourceVideo(src.id, mediaUrl);
              if (!masterVid) {
                break;
              }
              // Apply loop and volume from config
              masterVid.loop = src.config?.loop !== false;
              const cfgVol = src.config?.volume != null ? src.config.volume : 100;
              masterVid.volume = Math.min(1, (cfgVol / 100) * _ctrlGetEffectiveMixGain(src.id));
              // Auto-play
              if (src.config?.autoplay !== false) {
                masterVid.autoplay = true;
              }
              _bindVisualFitModeAuto(masterVid, src, { mirror: false });
              layer.appendChild(masterVid);
              // Only auto-play if the user hasn't explicitly paused this media source
              if (!_userPausedMedia.has(src.id)) {
                masterVid.play().catch(() => {});
              }
            } else {
              _disposeMediaSourceVideo(src.id, true);
            }
            break;
          }
          case 'text': {
            const cfg = src.config || {};
            const txt = document.createElement('div');
            txt.className = 'src-text-overlay';
            txt.style.fontFamily = cfg.fontFamily || 'SF Pro Display, -apple-system, sans-serif';
            txt.style.fontSize = (cfg.fontSize || 48) + 'px';
            txt.style.color = cfg.color || '#ffffff';
            txt.style.textAlign = cfg.align || 'center';
            if (cfg.wordWrap === false) txt.style.whiteSpace = 'nowrap';
            if (cfg.showBg) {
              txt.style.backgroundColor = cfg.bgColor || '#000000';
              txt.style.padding = '0.2em 0.5em';
              txt.style.borderRadius = '6px';
            }
            txt.textContent = cfg.text || src.name;
            layer.appendChild(txt);
            break;
          }
          case 'audio-input': {
            // Audio-only — no visual layer in compositor
            layer.style.display = 'none';
            // Start audio capture stream if not already active
            if (src.visible !== false) {
              const existingAudio = _activeStreams[src.id];
              if (!existingAudio || !existingAudio.active) {
                _startAudioInputStream(src.id, src.config?.deviceId);
              }
            }
            break;
          }
          case 'ndi': {
            layer.style.background = 'transparent';
            const ndiName = src.config?.ndiSourceName || src.name;
            const isConfigured = !!src.config?.ndiSourceName;
            const hasEndpoint = !!(src.config?.ndiHost && src.config?.ndiPort);

            // Create video element for NDI virtual camera feed
            const ndiVid = document.createElement('video');
            ndiVid.autoplay = true;
            ndiVid.muted = true;
            ndiVid.playsInline = true;
            ndiVid.id = 'ndi-video-' + src.id;
            ndiVid.style.cssText = 'display:none;';
            _bindVisualFitModeAuto(ndiVid, src, { mirror: false });
            layer.appendChild(ndiVid);
            const ndiImg = document.createElement('canvas');
            ndiImg.id = 'ndi-img-' + src.id;
            ndiImg.style.cssText = 'display:none;';
            _bindVisualFitModeAuto(ndiImg, src, { mirror: false });
            layer.appendChild(ndiImg);

            // Info overlay — shown while connecting, hidden once video plays
            const infoDiv = document.createElement('div');
            infoDiv.className = 'src-placeholder';
            infoDiv.id = 'ndi-info-' + src.id;
            infoDiv.style.cssText = 'position:absolute;inset:0;flex-direction:column;gap:6px;background:transparent;z-index:1;';
            let statusText, statusColor;
            if (!isConfigured) {
              statusText = '\u25cb Not configured';
              statusColor = '#f87171';
            } else if (hasEndpoint) {
              statusText = '\u25cf Endpoint resolved \u2022 ' + src.config.ndiHost + ':' + src.config.ndiPort;
              statusColor = '#34d399';
            } else if (src.config._resolving) {
              statusText = '\u25cf Resolving…';
              statusColor = '#fbbf24';
            } else {
              statusText = '\u25cf Discovered';
              statusColor = '#34d399';
            }
            const lowBw = src.config?.lowBandwidth ? ' \u2022 Low bandwidth' : '';
            infoDiv.innerHTML = `
              <svg viewBox="0 0 24 24" fill="none" stroke="${isConfigured ? '#0a84ff' : '#555'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:32px;height:32px"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M7.76 16.24a6 6 0 0 1 0-8.49"/><path d="M4.93 19.07a10 10 0 0 1 0-14.14"/></svg>
              <span style="color:#0a84ff;font-size:13px;font-weight:600">${esc(ndiName)}</span>
              <span class="ndi-status-text" style="font-size:10px;color:${statusColor}">${statusText}${lowBw}</span>
              <span style="font-size:9px;color:rgba(255,255,255,.35);margin-top:2px">NDI\u00ae Network Source</span>
              <button onclick="retryNdiConnection('${src.id}')" style="margin-top:6px;padding:3px 12px;font-size:10px;background:rgba(10,132,255,.15);border:1px solid rgba(10,132,255,.3);color:#0a84ff;border-radius:6px;cursor:pointer">Refresh</button>`;
            layer.appendChild(infoDiv);
            infoDiv.style.display = 'none';

            // Reuse existing stream or connect NDI virtual camera
            let existingNdi = _activeStreams[src.id];
            if (existingNdi && existingNdi.active && existingNdi.getVideoTracks().length) {
              ndiVid.srcObject = existingNdi;
              ndiVid.style.display = 'block';
              infoDiv.style.display = 'none';
              ndiVid.play().catch(() => {});
            } else if (isConfigured && src.visible !== false) {
              // Before opening a new connection, check if another source
              // (e.g. in the previous scene) already has a live stream for
              // the same NDI feed — reuse it for zero-downtime scene switch.
              const reusable = _findReusableNdiStream(
                src.config?.cameraDeviceId, src.config?.ndiSourceName);
              if (reusable && reusable.stream) {
                _activeStreams[src.id] = reusable.stream;
                ndiVid.srcObject = reusable.stream;
                ndiVid.style.display = 'block';
                infoDiv.style.display = 'none';
                ndiVid.play().catch(() => {});
              } else {
                // Also try to reuse an existing bridge renderer
                const reusableBridge = _findReusableNdiBridge(src.config?.ndiSourceName);
                if (reusableBridge && reusableBridge.state.renderer) {
                  // Transfer the renderer to the new canvas element
                  const oldRenderer = reusableBridge.state.renderer;
                  oldRenderer.canvas = ndiImg;
                  oldRenderer.ctx = ndiImg.getContext('2d', { alpha: true, desynchronized: true });
                  _ndiBridgeState[src.id] = reusableBridge.state;
                  if (reusableBridge.sid !== src.id) delete _ndiBridgeState[reusableBridge.sid];
                  ndiImg.style.display = 'block';
                  infoDiv.style.display = 'none';
                } else {
                  _startNdiBridgeStream(src.id, ndiImg, infoDiv, src.config).then((bridgeRes) => {
                    if (bridgeRes && bridgeRes.ok) return;
                    ndiImg.style.display = 'none';
                    _tryNdiVirtualCamera(src.id, ndiVid, infoDiv, src.config);
                  });
                }
              }
            }

            // NDI Audio: start audio input stream if enabled
            if (isConfigured && src.visible !== false && src.config?.ndiAudioEnabled !== false) {
              let existingNdiAudio = _ndiAudioStreams[src.id];
              // Reuse NDI audio from another source with the same NDI source name
              if (!existingNdiAudio || !existingNdiAudio.active) {
                for (const [sid, stream] of Object.entries(_ndiAudioStreams)) {
                  if (sid === src.id || !stream || !stream.active) continue;
                  const otherSrc = _findSourceInAnyScene(sid);
                  if (otherSrc && otherSrc.type === 'ndi' && (otherSrc.config || {}).ndiSourceName === src.config?.ndiSourceName) {
                    _ndiAudioStreams[src.id] = stream;
                    existingNdiAudio = stream;
                    break;
                  }
                }
              }
              if (!existingNdiAudio || !existingNdiAudio.active) {
                _startNdiAudioStream(src.id, src.config);
              }
            } else if (src.config?.ndiAudioEnabled === false) {
              _stopNdiAudioStream(src.id);
            }

            // Resolve endpoint if needed (once per source)
            if (isConfigured && !hasEndpoint && !src.config._resolving) {
              src.config._resolving = true;
              _resolveNdiSourceConfig(src.config.ndiSourceName, src.config.ndiDomain).then(resolved => {
                src.config._resolving = false;
                if (resolved && resolved.ok) {
                  src.config.ndiHost = resolved.host;
                  src.config.ndiPort = resolved.port;
                  schedulePersistAppState();
                  const info = document.getElementById('ndi-info-' + src.id);
                  if (info) {
                    const statusSpan = info.querySelector('.ndi-status-text');
                    if (statusSpan) {
                      statusSpan.style.color = '#34d399';
                      statusSpan.textContent = '\u25cf Endpoint resolved \u2022 ' + resolved.host + ':' + resolved.port;
                    }
                  }
                }
              });
            }
            break;
          }
          case 'window-capture': {
            layer.style.background = '#000';
            const vid = document.createElement('video');
            vid.autoplay = true;
            vid.muted = true;
            vid.playsInline = true;
            _bindVisualFitModeAuto(vid, src, { mirror: false });
            layer.appendChild(vid);
            const existingWc = _windowCaptureStreams[src.id];
            if (existingWc && existingWc.active) {
              vid.srcObject = existingWc;
              vid.play().catch(() => {});
            } else if (src.config?.windowId) {
              _startWindowCapture(src.id, src.config.windowId, {
                captureCursor: src.config.captureCursor !== false
              });
            } else {
              // No window selected — show placeholder
              const ph = document.createElement('div');
              ph.className = 'src-placeholder';
              ph.textContent = 'No window selected';
              layer.appendChild(ph);
            }
            break;
          }
          case 'scene': {
            // Nested scene source — render the target scene's layers inline
            layer.style.background = '#000';
            const targetSceneName = src.config?.sceneName;
            const targetScene = _scenes.find(s => s.name === targetSceneName);
            if (targetScene && Array.isArray(targetScene.sources) && targetScene.sources.length > 0) {
              const nestedRoot = document.createElement('div');
              nestedRoot.style.cssText = 'position:absolute;inset:0;overflow:hidden;';
              const nestedTotal = targetScene.sources.length;
              targetScene.sources.forEach((nestedSrc, nIdx) => {
                if (nestedSrc.visible === false) return;
                const nLayer = document.createElement('div');
                nLayer.style.cssText = 'position:absolute;inset:0;overflow:hidden;';
                nLayer.style.zIndex = nestedTotal - nIdx;
                // Simplified nested rendering per-type
                const nCfg = nestedSrc.config || {};
                if (nestedSrc.type === 'image' && nCfg.dataUrl) {
                  const img = document.createElement('img');
                  img.src = nCfg.dataUrl;
                  _applyVisualFitMode(img, _normalizeSourceFitMode(nCfg.fitMode || nCfg.fit || 'contain'), { mirror: false });
                  nLayer.appendChild(img);
                } else if (nestedSrc.type === 'text') {
                  const t = document.createElement('div');
                  t.className = 'src-text-overlay';
                  t.textContent = nCfg.text || nestedSrc.name;
                  if (nCfg.fontFamily) t.style.fontFamily = nCfg.fontFamily;
                  if (nCfg.fontSize) t.style.fontSize = nCfg.fontSize + 'px';
                  if (nCfg.color) t.style.color = nCfg.color;
                  nLayer.appendChild(t);
                } else if (nestedSrc.type === 'camera') {
                  const nv = document.createElement('video');
                  nv.autoplay = true; nv.muted = true; nv.playsInline = true;
                  _applyVisualFitMode(nv, _normalizeSourceFitMode(nCfg.fitMode || nCfg.fit || 'contain'), { mirror: !!nCfg.mirror });
                  const es = _activeStreams[nestedSrc.id];
                  if (es && es.active) { nv.srcObject = es; nv.play().catch(() => {}); }
                  nLayer.appendChild(nv);
                }
                nestedRoot.appendChild(nLayer);
              });
              layer.appendChild(nestedRoot);
            } else {
              const ph = document.createElement('div');
              ph.className = 'src-placeholder';
              ph.textContent = targetSceneName ? `Scene: ${targetSceneName}` : 'No scene selected';
              layer.appendChild(ph);
            }
            break;
          }
          default: {
            break;
          }
        }
        // Apply video FX CSS filters to this layer
        _applyVideoFxToLayer(layer, src);
        sceneRoot.appendChild(layer);
      });
      _applySceneTransformToCompositor(scene);
      queueStandaloneSyncBurst();
      syncLsProjectionPreview();
      // Rebuild controls/mix immediately so visibility toggles feel instant.
      renderControlsPanel();
      _pgmSyncSources();
      _pgmMediaEnsureUiLoop();
      _pgmMediaUpdateUi();
    }

    function getOutputSceneLayers() {
      const scene = _activeScene();
      if (!scene || !Array.isArray(scene.sources)) return [];
      const totalSources = scene.sources.length;
      return scene.sources
        .map((src, idx) => ({ src, idx }))
        .filter(({ src }) => src && src.visible !== false)
        .map(({ src, idx }) => {
          const tf = src.transform || {};
          const cfg = src.config || {};
          const layer = {
            id: src.id,
            type: src.type,
            name: src.name,
            zIndex: totalSources - idx,
            transform: {
              x: tf.x ?? 0,
              y: tf.y ?? 0,
              w: tf.w ?? 100,
              h: tf.h ?? 100,
              rotation: tf.rotation ?? 0,
              cropTop: tf.cropTop ?? 0,
              cropRight: tf.cropRight ?? 0,
              cropBottom: tf.cropBottom ?? 0,
              cropLeft: tf.cropLeft ?? 0
            },
            config: {}
          };
          if (src.type === 'camera') {
            layer.config.deviceId = cfg.deviceId || '';
            layer.config.mirror = !!cfg.mirror;
            layer.config.resolution = cfg.resolution || 'auto';
            layer.config.fps = cfg.fps || 'auto';
            layer.config.fitMode = _normalizeSourceFitMode(cfg.fitMode || cfg.fit || 'contain');
            layer.config.fit = _fitModeToLegacyFit(layer.config.fitMode);
          } else if (src.type === 'ndi') {
            layer.config.ndiSourceName = cfg.ndiSourceName || '';
            layer.config.ndiHost = cfg.ndiHost || '';
            layer.config.ndiPort = cfg.ndiPort || 0;
            layer.config.label = cfg.ndiDisplayLabel || cfg.ndiSourceName || src.name || '';
            layer.config.cameraDeviceId = cfg.cameraDeviceId || '';
            layer.config.fitMode = _normalizeSourceFitMode(cfg.fitMode || cfg.fit || 'cover');
            layer.config.fit = _fitModeToLegacyFit(layer.config.fitMode);
            layer.config.ndiAudioEnabled = cfg.ndiAudioEnabled !== false;
            layer.config.ndiAudioVolume = cfg.ndiAudioVolume != null ? cfg.ndiAudioVolume : 100;
            layer.config.ndiMonitorAudio = !!cfg.ndiMonitorAudio;
          } else if (src.type === 'image') {
            layer.config.dataUrl = cfg.dataUrl || '';
            layer.config.fitMode = _normalizeSourceFitMode(cfg.fitMode || cfg.fit || 'contain');
            layer.config.fit = _fitModeToLegacyFit(layer.config.fitMode);
            layer.config.opacity = cfg.opacity != null ? cfg.opacity : 100;
          } else if (src.type === 'media-source') {
            layer.config.dataUrl = cfg.dataUrl || '';
            layer.config.fitMode = _normalizeSourceFitMode(cfg.fitMode || cfg.fit || 'contain');
            layer.config.fit = _fitModeToLegacyFit(layer.config.fitMode);
            layer.config.mediaStopped = !!_pgmMediaCtrlState.stopped;
            const mediaVid = _mediaSourceVideoEls[String(src.id || '')] || null;
            // OBS-like: the <video> element plays audio natively with perfect
            // A/V sync.  Send the raw currentTime to display outputs — no
            // pipeline-latency offset needed.
            const rawTime = (mediaVid && Number.isFinite(mediaVid.currentTime)) ? Number(mediaVid.currentTime) : 0;
            layer.config.mediaCurrentTime = Math.max(0, rawTime);
            layer.config.mediaPaused = mediaVid ? !!mediaVid.paused : true;
            layer.config.mediaPlaybackRate = (mediaVid && Number.isFinite(mediaVid.playbackRate)) ? Number(mediaVid.playbackRate) : 1;
            layer.config.mediaLoop = mediaVid ? !!mediaVid.loop : true;
            // Display outputs are visual-only — audio comes from the control
            // panel's native <video> element.  Muting prevents double-audio
            // between the control panel and display window.
            layer.config.mediaMuted = true;
            layer.config.mediaVolume = 0;
            layer.config.mediaSyncTs = Date.now();
          } else if (src.type === 'text') {
            layer.config.text = cfg.text || src.name || '';
            layer.config.fontFamily = cfg.fontFamily || '';
            layer.config.fontSize = cfg.fontSize || 48;
            layer.config.color = cfg.color || '#ffffff';
            layer.config.bgColor = cfg.bgColor || '#000000';
            layer.config.align = cfg.align || 'center';
            layer.config.wordWrap = cfg.wordWrap !== false;
            layer.config.showBg = !!cfg.showBg;
          } else if (src.type === 'window-capture') {
            layer.config.windowId = cfg.windowId || '';
            layer.config.windowName = cfg.windowName || '';
            layer.config.fitMode = _normalizeSourceFitMode(cfg.fitMode || cfg.fit || 'contain');
            layer.config.fit = _fitModeToLegacyFit(layer.config.fitMode);
          } else if (src.type === 'scene') {
            layer.config.sceneName = cfg.sceneName || '';
          }
          // Pre-compute video FX CSS filter string for display outputs
          const vfxChain = Array.isArray(cfg.videoFx) ? cfg.videoFx : [];
          const vfxMaster = cfg.videoFxMasterEnabled !== false;
          const vfxBypass = cfg.videoFxBypass === true;
          const vfxResult = _buildVideoFxCssFilter(vfxChain, vfxMaster, vfxBypass);
          if (vfxResult.filter) layer.config.videoFilter = vfxResult.filter;
          if (vfxResult.vignette) layer.config.videoVignette = _buildVignetteBoxShadow(vfxResult.vignette);
          if (vfxResult.sharpenDefs && vfxResult.sharpenDefs.length) {
            layer.config.sharpenDefs = vfxResult.sharpenDefs;
          }
          return layer;
        });
    }

    function selectSourceItem(el) {
      if (_selectedSourceEl) _selectedSourceEl.classList.remove('selected');
      _selectedSourceEl = el;
      el.classList.add('selected');
      _xfControlsVisible = false;
      _updateTransformOverlay();
      _updateSourceFxToolbarButton();
      _pgmMediaUpdateUi();
    }

    /* ======= Transform Overlay System ======= */
    let _xfCropMode = false;       // Alt-key toggles crop handle visibility
    let _xfDragState = null;       // Active drag state: { type, srcId, startMouse, startTf, handle }
    let _xfCanvasHover = false;    // Canvas hover state (shows blue pre-selection outline)
    let _xfControlsVisible = false; // False = blue outline only, True = full transform controls
    const _XF_ROTATE_SNAP_DEG = 90;
    const _XF_ROTATE_SNAP_THRESHOLD_DEG = 3;

    /** Get the selected source data object */
    function _getSelectedSourceData() {
      if (!_selectedSourceEl) return null;
      const scene = _activeScene();
      if (!scene) return null;
      return scene.sources.find(s => s.id === _selectedSourceEl.dataset.sourceId) || null;
    }

    function _ensureSceneTransform(scene) {
      if (!scene.transform) {
        scene.transform = { x: 0, y: 0, w: 100, h: 100, rotation: 0, cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0 };
      }
      if (!Number.isFinite(Number(scene.transform.rotation))) scene.transform.rotation = 0;
      return scene.transform;
    }

    function _getTransformTarget() {
      const src = _getSelectedSourceData();
      if (src && src.visible !== false) return { kind: 'source', id: src.id, name: src.name || 'Source', data: src, locked: _isSourceTransformLocked(src) };
      const scene = _activeScene();
      if (!scene) return null;
      return { kind: 'scene', id: scene.id, name: scene.name || 'Scene', data: scene, locked: false };
    }

    function _getTransformFromTarget(target) {
      if (!target || !target.data) return null;
      return target.kind === 'scene'
        ? _ensureSceneTransform(target.data)
        : _ensureTransform(target.data);
    }

    function _applySceneTransformToCompositor(scene) {
      const comp = document.getElementById('source-compositor');
      if (!comp) return;
      const sceneRoot = comp.querySelector('.scene-transform-root');
      if (!sceneRoot) return;
      const tf = _ensureSceneTransform(scene);
      sceneRoot.style.position = 'absolute';
      sceneRoot.style.left = (tf.x ?? 0) + '%';
      sceneRoot.style.top = (tf.y ?? 0) + '%';
      sceneRoot.style.width = (tf.w ?? 100) + '%';
      sceneRoot.style.height = (tf.h ?? 100) + '%';
      sceneRoot.style.overflow = 'hidden';
      const rotation = Number(tf.rotation ?? 0) || 0;
      sceneRoot.style.transformOrigin = '50% 50%';
      sceneRoot.style.transform = rotation ? `rotate(${rotation}deg)` : '';
      const cT = tf.cropTop ?? 0, cR = tf.cropRight ?? 0, cB = tf.cropBottom ?? 0, cL = tf.cropLeft ?? 0;
      sceneRoot.style.clipPath = (cT || cR || cB || cL) ? `inset(${cT}% ${cR}% ${cB}% ${cL}%)` : '';
    }

    /** Ensure source has a transform object, return it */
    function _ensureTransform(src) {
      if (!src.transform) src.transform = { x: 0, y: 0, w: 100, h: 100, rotation: 0, cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0 };
      if (!Number.isFinite(Number(src.transform.rotation))) src.transform.rotation = 0;
      return src.transform;
    }

    /** Build or update the transform overlay for the selected source */
    function _updateTransformOverlay() {
      const overlay = document.getElementById('transform-overlay');
      if (!overlay) return;
      const target = _getTransformTarget();
      if (!target || target.locked || (!_xfControlsVisible && !_xfCanvasHover)) {
        overlay.innerHTML = '';
        overlay.classList.remove('active');
        overlay.classList.remove('preview');
        return;
      }
      const tf = _getTransformFromTarget(target);
      if (!tf) {
        overlay.innerHTML = '';
        overlay.classList.remove('active');
        overlay.classList.remove('preview');
        return;
      }
      overlay.classList.add('active');
      overlay.classList.toggle('preview', !_xfControlsVisible);

      // Build transform box
      let box = overlay.querySelector('.xf-box');
      if (!box) {
        overlay.innerHTML = '';
        box = document.createElement('div');
        box.className = 'xf-box';
        box.innerHTML = `
          <span class="xf-label"></span>
          <span class="xf-dims"></span>
          <span class="xf-rot-stem"></span>
          <span class="xf-rot-dot"></span>
          <div class="xf-handle xf-tl" data-handle="tl"></div>
          <div class="xf-handle xf-tr" data-handle="tr"></div>
          <div class="xf-handle xf-bl" data-handle="bl"></div>
          <div class="xf-handle xf-br" data-handle="br"></div>
          <div class="xf-handle xf-tm" data-handle="tm"></div>
          <div class="xf-handle xf-bm" data-handle="bm"></div>
          <div class="xf-handle xf-ml" data-handle="ml"></div>
          <div class="xf-handle xf-mr" data-handle="mr"></div>
          <div class="xf-crop-handle xf-ct" data-crop="top"></div>
          <div class="xf-crop-handle xf-cb" data-crop="bottom"></div>
          <div class="xf-crop-handle xf-cl" data-crop="left"></div>
          <div class="xf-crop-handle xf-cr" data-crop="right"></div>`;
        overlay.appendChild(box);

        // Drag on box = move
        box.addEventListener('mousedown', e => {
          if (!_xfControlsVisible) return;
          if (
            e.target.classList.contains('xf-handle') ||
            e.target.classList.contains('xf-crop-handle') ||
            e.target.classList.contains('xf-rot-dot') ||
            e.target.classList.contains('xf-rot-stem')
          ) return;
          e.preventDefault();
          e.stopPropagation();
          const t = _getTransformTarget();
          if (!t || t.locked) return;
          const curTf = _getTransformFromTarget(t);
          _xfDragState = {
            type: 'move',
            targetKind: t.kind,
            targetId: t.id,
            startMouse: { x: e.clientX, y: e.clientY },
            startTf: { ...curTf }
          };
          box.classList.add('dragging');
        });

        // Rotation handle
        const rotHandle = box.querySelector('.xf-rot-dot');
        if (rotHandle) {
          rotHandle.addEventListener('mousedown', e => {
            if (!_xfControlsVisible) return;
            e.preventDefault();
            e.stopPropagation();
            const t = _getTransformTarget();
            if (!t || t.locked) return;
            const curTf = _getTransformFromTarget(t);
            const overlay = document.getElementById('transform-overlay');
            const r = overlay?.getBoundingClientRect();
            if (!r || r.width <= 0 || r.height <= 0) return;
            const centerX = r.left + ((Number(curTf.x || 0) + (Number(curTf.w || 0) / 2)) / 100) * r.width;
            const centerY = r.top + ((Number(curTf.y || 0) + (Number(curTf.h || 0) / 2)) / 100) * r.height;
            const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
            _xfDragState = {
              type: 'rotate',
              targetKind: t.kind,
              targetId: t.id,
              startMouse: { x: e.clientX, y: e.clientY },
              startTf: { ...curTf },
              startAngle,
              startRotation: Number(curTf.rotation || 0),
              centerPx: { x: centerX, y: centerY }
            };
            box.classList.add('dragging');
          });
        }

        // Resize handles
        box.querySelectorAll('.xf-handle').forEach(h => {
          h.addEventListener('mousedown', e => {
            if (!_xfControlsVisible) return;
            e.preventDefault(); e.stopPropagation();
            const t = _getTransformTarget();
            if (!t || t.locked) return;
            const handle = h.dataset.handle;
            const curTf = _getTransformFromTarget(t);
            // Alt+handle = crop mode for that edge
            if (e.altKey) {
              const cropMap = { tl: null, tr: null, bl: null, br: null, tm: 'top', bm: 'bottom', ml: 'left', mr: 'right' };
              const cropDir = cropMap[handle];
              if (cropDir) {
                _xfDragState = {
                  type: 'crop',
                  targetKind: t.kind,
                  targetId: t.id,
                  startMouse: { x: e.clientX, y: e.clientY },
                  startTf: { ...curTf },
                  cropDir
                };
                box.classList.add('dragging');
                return;
              }
            }
            _xfDragState = {
              type: 'resize',
              targetKind: t.kind,
              targetId: t.id,
              startMouse: { x: e.clientX, y: e.clientY },
              startTf: { ...curTf },
              handle
            };
            box.classList.add('dragging');
          });
        });

        // Crop handles
        box.querySelectorAll('.xf-crop-handle').forEach(h => {
          h.addEventListener('mousedown', e => {
            if (!_xfControlsVisible) return;
            e.preventDefault(); e.stopPropagation();
            const t = _getTransformTarget();
            if (!t || t.locked) return;
            const curTf = _getTransformFromTarget(t);
            _xfDragState = {
              type: 'crop',
              targetKind: t.kind,
              targetId: t.id,
              startMouse: { x: e.clientX, y: e.clientY },
              startTf: { ...curTf },
              cropDir: h.dataset.crop
            };
            box.classList.add('dragging');
          });
        });
      }
      box.classList.toggle('preview', !_xfControlsVisible);

      // Update box position/size (percentage-based relative to overlay)
      box.style.left   = tf.x + '%';
      box.style.top    = tf.y + '%';
      box.style.width  = tf.w + '%';
      box.style.height = tf.h + '%';

      // Crop mode toggle
      box.classList.toggle('crop-mode', _xfCropMode || (tf.cropTop > 0 || tf.cropRight > 0 || tf.cropBottom > 0 || tf.cropLeft > 0));

      // Label
      const label = box.querySelector('.xf-label');
      if (label) label.textContent = target.name;

      // Dims
      const dims = box.querySelector('.xf-dims');
      if (dims) {
        const rot = Number(tf.rotation || 0);
        const rotText = Number.isFinite(rot) ? `${rot.toFixed(1)}°` : '0.0°';
        dims.textContent = `${Math.round(tf.w)}% × ${Math.round(tf.h)}% • ${rotText}`;
      }

      // Update crop shading
      _updateCropShading(box, tf);
    }

    /** Draw crop shading inside the transform box */
    function _updateCropShading(box, tf) {
      // Remove old shades
      box.querySelectorAll('.xf-crop-shade').forEach(s => s.remove());
      const cT = tf.cropTop || 0, cR = tf.cropRight || 0, cB = tf.cropBottom || 0, cL = tf.cropLeft || 0;
      if (!cT && !cR && !cB && !cL) return;
      // Top shade
      if (cT > 0) { const d = document.createElement('div'); d.className = 'xf-crop-shade'; d.style.cssText = `top:0;left:0;width:100%;height:${cT}%`; box.appendChild(d); }
      // Bottom shade
      if (cB > 0) { const d = document.createElement('div'); d.className = 'xf-crop-shade'; d.style.cssText = `bottom:0;left:0;width:100%;height:${cB}%`; box.appendChild(d); }
      // Left shade
      if (cL > 0) { const d = document.createElement('div'); d.className = 'xf-crop-shade'; d.style.cssText = `top:${cT}%;left:0;width:${cL}%;height:${100-cT-cB}%`; box.appendChild(d); }
      // Right shade
      if (cR > 0) { const d = document.createElement('div'); d.className = 'xf-crop-shade'; d.style.cssText = `top:${cT}%;right:0;width:${cR}%;height:${100-cT-cB}%`; box.appendChild(d); }
    }

    /** Convert pixel delta to % of program display shell */
    function _pxToPct(dxPx, dyPx) {
      const shell = document.getElementById('program-display-shell');
      const overlay = document.getElementById('transform-overlay');
      const overlayRect = overlay ? overlay.getBoundingClientRect() : null;
      const r = (overlayRect && overlayRect.width && overlayRect.height)
        ? overlayRect
        : (shell ? shell.getBoundingClientRect() : null);
      if (!r) return { dx: 0, dy: 0 };
      return { dx: (dxPx / r.width) * 100, dy: (dyPx / r.height) * 100 };
    }

    // Global mouse handlers for transform dragging
    const _SNAP_THRESHOLD = 2.0; // % distance to trigger snap
    const _SNAP_MAGNET   = 1.0; // % distance for magnetic snap
    const _SNAP_EDGES    = [0, 50, 100]; // snap targets: left/center/right (or top/center/bottom)

    /** Create persistent snap guide elements inside the transform overlay */
    function _ensureSnapGuides() {
      const overlay = document.getElementById('transform-overlay');
      if (!overlay || overlay.querySelector('.xf-snap-line')) return;
      // Horizontal guides: top(0%), centerH(50%), bottom(100%)
      // Vertical guides: left(0%), centerV(50%), right(100%)
      const ids = ['snap-top','snap-centerH','snap-bottom','snap-left','snap-centerV','snap-right'];
      ids.forEach(id => {
        const isH = id.startsWith('snap-top') || id.startsWith('snap-center') && id.endsWith('H') || id.startsWith('snap-bottom');
        const isHoriz = ['snap-top','snap-centerH','snap-bottom'].includes(id);
        const line = document.createElement('div');
        line.className = 'xf-snap-line ' + (isHoriz ? 'horizontal' : 'vertical') + (id.includes('center') ? ' center' : '');
        line.dataset.snapId = id;
        if (isHoriz) {
          const pos = id === 'snap-top' ? 0 : id === 'snap-centerH' ? 50 : 100;
          line.style.top = pos + '%';
        } else {
          const pos = id === 'snap-left' ? 0 : id === 'snap-centerV' ? 50 : 100;
          line.style.left = pos + '%';
        }
        overlay.appendChild(line);
      });
    }

    /** Show/hide snap guides based on current transform edges */
    function _updateSnapGuides(tf) {
      const overlay = document.getElementById('transform-overlay');
      if (!overlay) return;
      _ensureSnapGuides();
      const left = tf.x, top = tf.y;
      const right = tf.x + tf.w, bottom = tf.y + tf.h;
      const cx = tf.x + tf.w / 2, cy = tf.y + tf.h / 2;

      // Check each edge of the box against each snap line
      const hChecks = [
        { target: 0,   edges: [top, bottom, cy] },
        { target: 50,  edges: [top, bottom, cy] },
        { target: 100, edges: [top, bottom, cy] }
      ];
      const vChecks = [
        { target: 0,   edges: [left, right, cx] },
        { target: 50,  edges: [left, right, cx] },
        { target: 100, edges: [left, right, cx] }
      ];

      const snapIds = ['snap-top','snap-centerH','snap-bottom','snap-left','snap-centerV','snap-right'];
      const hTargets = [0, 50, 100];
      const vTargets = [0, 50, 100];

      // Horizontal snap lines
      hTargets.forEach((target, i) => {
        const line = overlay.querySelector(`[data-snap-id="${snapIds[i]}"]`);
        if (!line) return;
        const edges = [top, bottom, cy];
        const near = edges.some(e => Math.abs(e - target) < _SNAP_THRESHOLD);
        line.classList.toggle('visible', near);
      });

      // Vertical snap lines
      vTargets.forEach((target, i) => {
        const line = overlay.querySelector(`[data-snap-id="${snapIds[i + 3]}"]`);
        if (!line) return;
        const edges = [left, right, cx];
        const near = edges.some(e => Math.abs(e - target) < _SNAP_THRESHOLD);
        line.classList.toggle('visible', near);
      });
    }

    /** Hide all snap guides */
    function _hideSnapGuides() {
      const overlay = document.getElementById('transform-overlay');
      if (!overlay) return;
      overlay.querySelectorAll('.xf-snap-line').forEach(l => l.classList.remove('visible'));
    }

    /** Apply magnetic snapping — mutates tf in place, returns snapped state */
    function _applySnap(tf) {
      const left = tf.x, top = tf.y;
      const right = tf.x + tf.w, bottom = tf.y + tf.h;
      const cx = tf.x + tf.w / 2, cy = tf.y + tf.h / 2;

      // Horizontal (Y-axis) snapping
      for (const target of _SNAP_EDGES) {
        if (Math.abs(top - target) < _SNAP_MAGNET) { tf.y = target; break; }
        if (Math.abs(bottom - target) < _SNAP_MAGNET) { tf.y = target - tf.h; break; }
        if (Math.abs(cy - target) < _SNAP_MAGNET) { tf.y = target - tf.h / 2; break; }
      }
      // Vertical (X-axis) snapping
      for (const target of _SNAP_EDGES) {
        if (Math.abs(left - target) < _SNAP_MAGNET) { tf.x = target; break; }
        if (Math.abs(right - target) < _SNAP_MAGNET) { tf.x = target - tf.w; break; }
        if (Math.abs(cx - target) < _SNAP_MAGNET) { tf.x = target - tf.w / 2; break; }
      }
    }

    document.addEventListener('mousemove', e => {
      if (!_xfDragState) return;
      const { type, startMouse, startTf, handle, cropDir } = _xfDragState;
      const d = _pxToPct(e.clientX - startMouse.x, e.clientY - startMouse.y);
      const target = _getTransformTarget();
      if (!target || target.locked || target.kind !== _xfDragState.targetKind || target.id !== _xfDragState.targetId) {
        _xfDragState = null;
        _hideSnapGuides();
        const box = document.querySelector('.xf-box');
        if (box) box.classList.remove('dragging');
        return;
      }
      const tf = _getTransformFromTarget(target);
      if (!tf) return;

      if (type === 'rotate') {
        const cx = Number(_xfDragState.centerPx?.x);
        const cy = Number(_xfDragState.centerPx?.y);
        if (Number.isFinite(cx) && Number.isFinite(cy)) {
          const currentAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
          let nextRotation = Number(_xfDragState.startRotation || 0) + (currentAngle - Number(_xfDragState.startAngle || 0));
          // Normalize to [-180, 180) for stable persistence.
          nextRotation = ((nextRotation + 180) % 360 + 360) % 360 - 180;
          // Magnetic snap to cardinal angles while still allowing free rotation.
          const nearestCardinal = Math.round(nextRotation / _XF_ROTATE_SNAP_DEG) * _XF_ROTATE_SNAP_DEG;
          if (Math.abs(nextRotation - nearestCardinal) <= _XF_ROTATE_SNAP_THRESHOLD_DEG) {
            nextRotation = nearestCardinal;
          }
          if (e.shiftKey) nextRotation = Math.round(nextRotation / 15) * 15;
          tf.rotation = Math.round(nextRotation * 10) / 10;
        }
      } else if (type === 'move') {
        tf.x = startTf.x + d.dx;
        tf.y = startTf.y + d.dy;
      } else if (type === 'resize') {
        // Corner handles = uniform scaling, edge-mid handles = single-axis scaling.
        const overlay = document.getElementById('transform-overlay');
        const r = overlay?.getBoundingClientRect();
        if (r && r.width > 0 && r.height > 0) {
          const dxPx = e.clientX - startMouse.x;
          const dyPx = e.clientY - startMouse.y;
          const sLeft = (startTf.x / 100) * r.width;
          const sTop = (startTf.y / 100) * r.height;
          const sWidth = (startTf.w / 100) * r.width;
          const sHeight = (startTf.h / 100) * r.height;
          const sRight = sLeft + sWidth;
          const sBottom = sTop + sHeight;
          const sCx = sLeft + (sWidth / 2);
          const sCy = sTop + (sHeight / 2);

          const handleStart = {
            tl: { x: sLeft,  y: sTop },
            tr: { x: sRight, y: sTop },
            bl: { x: sLeft,  y: sBottom },
            br: { x: sRight, y: sBottom },
            tm: { x: sCx,    y: sTop },
            bm: { x: sCx,    y: sBottom },
            ml: { x: sLeft,  y: sCy },
            mr: { x: sRight, y: sCy }
          }[handle] || { x: sRight, y: sBottom };

          const anchor = {
            tl: { x: sRight, y: sBottom },
            tr: { x: sLeft,  y: sBottom },
            bl: { x: sRight, y: sTop },
            br: { x: sLeft,  y: sTop },
            tm: { x: sCx,    y: sBottom },
            bm: { x: sCx,    y: sTop },
            ml: { x: sRight, y: sCy },
            mr: { x: sLeft,  y: sCy }
          }[handle] || { x: sLeft, y: sTop };

          const moveX = (handle.includes('l') || handle.includes('r')) ? dxPx : 0;
          const moveY = (handle.includes('t') || handle.includes('b')) ? dyPx : 0;
          const newHandle = { x: handleStart.x + moveX, y: handleStart.y + moveY };

          const isEdgeHandle = (handle === 'tm' || handle === 'bm' || handle === 'ml' || handle === 'mr');
          if (isEdgeHandle) {
            const minW = (5 / 100) * r.width;
            const minH = (5 / 100) * r.height;

            if (handle === 'tm') {
              const nTop = Math.min(sBottom - minH, newHandle.y);
              tf.x = (sLeft / r.width) * 100;
              tf.y = (nTop / r.height) * 100;
              tf.w = (sWidth / r.width) * 100;
              tf.h = ((sBottom - nTop) / r.height) * 100;
            } else if (handle === 'bm') {
              const nBottom = Math.max(sTop + minH, newHandle.y);
              tf.x = (sLeft / r.width) * 100;
              tf.y = (sTop / r.height) * 100;
              tf.w = (sWidth / r.width) * 100;
              tf.h = ((nBottom - sTop) / r.height) * 100;
            } else if (handle === 'ml') {
              const nLeft = Math.min(sRight - minW, newHandle.x);
              tf.x = (nLeft / r.width) * 100;
              tf.y = (sTop / r.height) * 100;
              tf.w = ((sRight - nLeft) / r.width) * 100;
              tf.h = (sHeight / r.height) * 100;
            } else if (handle === 'mr') {
              const nRight = Math.max(sLeft + minW, newHandle.x);
              tf.x = (sLeft / r.width) * 100;
              tf.y = (sTop / r.height) * 100;
              tf.w = ((nRight - sLeft) / r.width) * 100;
              tf.h = (sHeight / r.height) * 100;
            }
          } else {
            let scale = 1;
            const denX = (handleStart.x - anchor.x);
            const denY = (handleStart.y - anchor.y);
            const sx = denX ? ((newHandle.x - anchor.x) / denX) : 1;
            const sy = denY ? ((newHandle.y - anchor.y) / denY) : 1;
            scale = Math.abs(sx - 1) >= Math.abs(sy - 1) ? sx : sy;

            const minW = (5 / 100) * r.width;
            const minH = (5 / 100) * r.height;
            const minScale = Math.max(minW / Math.max(1, sWidth), minH / Math.max(1, sHeight), 0.02);
            if (!Number.isFinite(scale)) scale = 1;
            scale = Math.max(minScale, scale);

            const nLeft = anchor.x + (sLeft - anchor.x) * scale;
            const nTop = anchor.y + (sTop - anchor.y) * scale;
            const nRight = anchor.x + (sRight - anchor.x) * scale;
            const nBottom = anchor.y + (sBottom - anchor.y) * scale;

            tf.x = (Math.min(nLeft, nRight) / r.width) * 100;
            tf.y = (Math.min(nTop, nBottom) / r.height) * 100;
            tf.w = (Math.abs(nRight - nLeft) / r.width) * 100;
            tf.h = (Math.abs(nBottom - nTop) / r.height) * 100;
          }
        }
      } else if (type === 'crop') {
        switch (cropDir) {
          case 'top':    tf.cropTop    = Math.max(0, Math.min(90, startTf.cropTop + (d.dy / (startTf.h||100)) * 100)); break;
          case 'bottom': tf.cropBottom = Math.max(0, Math.min(90, startTf.cropBottom - (d.dy / (startTf.h||100)) * 100)); break;
          case 'left':   tf.cropLeft   = Math.max(0, Math.min(90, startTf.cropLeft + (d.dx / (startTf.w||100)) * 100)); break;
          case 'right':  tf.cropRight  = Math.max(0, Math.min(90, startTf.cropRight - (d.dx / (startTf.w||100)) * 100)); break;
        }
      }

      // Live update the compositor layer position/crop
      // Apply magnetic snap for move/resize (not crop)
      if (type === 'move' || type === 'resize') {
        _applySnap(tf);
        _updateSnapGuides(tf);
      }
      if (target.kind === 'scene') _applySceneTransformToCompositor(target.data);
      else _applyTransformToLayer(target.data);
      _updateTransformOverlay();
    });

    document.addEventListener('mouseup', e => {
      if (!_xfDragState) return;
      _hideSnapGuides();
      const box = document.querySelector('.xf-box');
      if (box) box.classList.remove('dragging');
      _xfDragState = null;
      schedulePersistAppState();
    });

    // Alt key toggles crop mode
    document.addEventListener('keydown', e => {
      if (e.key === 'Alt') { _xfCropMode = true; _updateTransformOverlay(); }
    });
    document.addEventListener('keyup', e => {
      if (e.key === 'Alt') { _xfCropMode = false; _updateTransformOverlay(); }
    });

    // Click on program display stage (outside sources list) deselects
    document.getElementById('program-display-shell')?.addEventListener('mouseenter', () => {
      _xfCanvasHover = true;
      _updateTransformOverlay();
    });
    document.getElementById('program-display-shell')?.addEventListener('mousemove', () => {
      if (!_xfCanvasHover) _xfCanvasHover = true;
      if (!_xfControlsVisible) _updateTransformOverlay();
    });
    document.getElementById('program-display-shell')?.addEventListener('mouseleave', () => {
      _xfCanvasHover = false;
      if (!_xfControlsVisible) _updateTransformOverlay();
    });
    document.getElementById('program-display-shell')?.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (_xfControlsVisible) return;
      const target = _getTransformTarget();
      if (!target || target.locked) return;
      _xfControlsVisible = true;
      _updateTransformOverlay();
      e.preventDefault();
      e.stopPropagation();
    });

    // Click on program display stage (outside sources list) deselects source.
    document.getElementById('program-display-stage')?.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (e.target.id === 'program-display-stage') {
        if (_selectedSourceEl) {
          _selectedSourceEl.classList.remove('selected');
          _selectedSourceEl = null;
          _xfControlsVisible = false;
          _updateTransformOverlay();
          _updateSourceFxToolbarButton();
        }
      }
    });

    /** Apply transform to a specific compositor layer without full re-render */
    function _applyTransformToLayer(src) {
      const tf = src.transform || {};
      const layer = document.querySelector(`#source-compositor .src-layer[data-src-id="${src.id}"]`);
      if (!layer) return;
      layer.style.left   = (tf.x ?? 0) + '%';
      layer.style.top    = (tf.y ?? 0) + '%';
      layer.style.width  = (tf.w ?? 100) + '%';
      layer.style.height = (tf.h ?? 100) + '%';
      const rotation = Number(tf.rotation ?? 0) || 0;
      const flipH = tf.flipH ? -1 : 1;
      const flipV = tf.flipV ? -1 : 1;
      layer.style.transformOrigin = '50% 50%';
      const transforms = [];
      if (rotation) transforms.push(`rotate(${rotation}deg)`);
      if (flipH === -1 || flipV === -1) transforms.push(`scale(${flipH}, ${flipV})`);
      layer.style.transform = transforms.length ? transforms.join(' ') : '';
      const cT = tf.cropTop ?? 0, cR = tf.cropRight ?? 0, cB = tf.cropBottom ?? 0, cL = tf.cropLeft ?? 0;
      layer.style.clipPath = (cT || cR || cB || cL) ? `inset(${cT}% ${cR}% ${cB}% ${cL}%)` : '';
    }

    /** Reset transform for the selected source to default (contain + no crop) */
    function resetSelectedSourceTransform() {
      const src = _getSelectedSourceData();
      if (!src) return;
      if (_isSourceTransformLocked(src)) return;
      src.transform = { x: 0, y: 0, w: 100, h: 100, rotation: 0, cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0 };
      if (_isFitModeCapableSourceType(src.type)) {
        src.config = src.config || {};
        src.config.fitMode = 'contain';
        src.config.fit = _fitModeToLegacyFit('contain');
      }
      _applyTransformToLayer(src);
      renderProgramDisplay();
      _updateTransformOverlay();
      schedulePersistAppState();
    }

    /** Fit the selected source inside the canvas while preserving aspect ratio */
    function fitSelectedSourceToScreen() {
      const src = _getSelectedSourceData();
      if (!src) return;
      if (_isSourceTransformLocked(src)) return;
      _ensureTransform(src);
      // Reset position to fill the canvas (the compositor is 100% × 100%)
      src.transform.x = 0;
      src.transform.y = 0;
      src.transform.w = 100;
      src.transform.h = 100;
      src.transform.rotation = 0;
      src.transform.cropTop = 0;
      src.transform.cropRight = 0;
      src.transform.cropBottom = 0;
      src.transform.cropLeft = 0;
      if (_isFitModeCapableSourceType(src.type)) {
        src.config = src.config || {};
        src.config.fitMode = 'contain';
        src.config.fit = _fitModeToLegacyFit('contain');
      }
      _applyTransformToLayer(src);
      renderProgramDisplay();
      _updateTransformOverlay();
      schedulePersistAppState();
    }

    /** Stretch the selected source to fill the entire canvas */
    function stretchSelectedSourceToScreen() {
      const src = _getSelectedSourceData();
      if (!src) return;
      if (_isSourceTransformLocked(src)) return;
      _ensureTransform(src);
      src.transform.x = 0;
      src.transform.y = 0;
      src.transform.w = 100;
      src.transform.h = 100;
      src.transform.rotation = 0;
      src.transform.cropTop = 0;
      src.transform.cropRight = 0;
      src.transform.cropBottom = 0;
      src.transform.cropLeft = 0;
      if (_isFitModeCapableSourceType(src.type)) {
        src.config = src.config || {};
        src.config.fitMode = 'stretch';
        src.config.fit = _fitModeToLegacyFit('stretch');
      }
      _applyTransformToLayer(src);
      renderProgramDisplay();
      _updateTransformOverlay();
      schedulePersistAppState();
    }

    /** Center the selected source on the canvas */
    function centerSelectedSourceOnScreen() {
      const src = _getSelectedSourceData();
      if (!src) return;
      if (_isSourceTransformLocked(src)) return;
      _ensureTransform(src);
      const tf = src.transform;
      tf.x = (100 - tf.w) / 2;
      tf.y = (100 - tf.h) / 2;
      _applyTransformToLayer(src);
      _updateTransformOverlay();
      schedulePersistAppState();
    }

    /** Flip the selected source horizontally using CSS scaleX */
    function flipSelectedSourceHorizontal() {
      const src = _getSelectedSourceData();
      if (!src) return;
      if (_isSourceTransformLocked(src)) return;
      _ensureTransform(src);
      src.transform.flipH = !src.transform.flipH;
      _applyTransformToLayer(src);
      _updateTransformOverlay();
      schedulePersistAppState();
    }

    /** Flip the selected source vertically using CSS scaleY */
    function flipSelectedSourceVertical() {
      const src = _getSelectedSourceData();
      if (!src) return;
      if (_isSourceTransformLocked(src)) return;
      _ensureTransform(src);
      src.transform.flipV = !src.transform.flipV;
      _applyTransformToLayer(src);
      _updateTransformOverlay();
      schedulePersistAppState();
    }

    /** Rotate the selected source by 90° clockwise */
    function rotateSelectedSource90CW() {
      const src = _getSelectedSourceData();
      if (!src) return;
      if (_isSourceTransformLocked(src)) return;
      _ensureTransform(src);
      let r = Number(src.transform.rotation || 0) + 90;
      r = ((r + 180) % 360 + 360) % 360 - 180;
      src.transform.rotation = Math.round(r * 10) / 10;
      _applyTransformToLayer(src);
      _updateTransformOverlay();
      schedulePersistAppState();
    }

    /** Rotate the selected source by 90° counter-clockwise */
    function rotateSelectedSource90CCW() {
      const src = _getSelectedSourceData();
      if (!src) return;
      if (_isSourceTransformLocked(src)) return;
      _ensureTransform(src);
      let r = Number(src.transform.rotation || 0) - 90;
      r = ((r + 180) % 360 + 360) % 360 - 180;
      src.transform.rotation = Math.round(r * 10) / 10;
      _applyTransformToLayer(src);
      _updateTransformOverlay();
      schedulePersistAppState();
    }

    function removeSelectedSource() {
      if (!_selectedSourceEl) return;
      const srcId = _selectedSourceEl.dataset.sourceId;
      const scene = _activeScene();
      const _srcName = (scene && scene.sources.find(s => s.id === srcId) || {}).name || 'source';
      if (scene) {
        scene.sources = scene.sources.filter(s => s.id !== srcId);
      }
      _stopStream(srcId);
      _selectedSourceEl.remove();
      _selectedSourceEl = null;
      renderProgramDisplay();
      _updateSourceFxToolbarButton();
      saveState('Delete Source: ' + _srcName);
      schedulePersistAppState();
    }

    function _updateSourceFxToolbarButton() {
      const btn = document.getElementById('source-fx-toolbar-btn');
      if (!btn) return;
      const src = _getSelectedSourceData();
      const enabled = !!src;
      btn.disabled = !enabled;
      btn.title = enabled
        ? 'Open FX for ' + (src.name || 'selected source')
        : 'Select a source to edit FX';
    }

    function openSelectedSourceFxFromToolbar() {
      const src = _getSelectedSourceData();
      if (!src) {
        if (typeof showToast === 'function') showToast(t('source_config_select_layer_first'));
        return;
      }
      openSourceFxPopup(src.id);
    }

    /** Helper: set active segment in a segmented control */
    function _setSegVal(id, val) {
      const el = document.getElementById(id);
      if (!el) return;
      el.querySelectorAll('.seg-opt').forEach(s => {
        s.classList.toggle('active', (s.dataset.v || s.textContent.trim()) === String(val));
      });
    }
    /** Helper: set mini-toggle on/off */
    function _setTogVal(id, on) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('on', !!on);
    }

    function openSourceProperties() {
      if (!_selectedSourceEl) return;
      _editingSourceEl = _selectedSourceEl;
      const type = _selectedSourceEl.dataset.sourceType || 'text';
      // For NDI: set preselect BEFORE opening config so enumerateNdiSources uses it
      const scene = _activeScene();
      const srcData = scene ? scene.sources.find(s => s.id === _selectedSourceEl.dataset.sourceId) : null;
      if (type === 'ndi' && srcData && srcData.config) {
        if (srcData.config.ndiSourceName) _ndiPreselectValue = srcData.config.ndiSourceName;
      }
      if ((type === 'camera' || type === 'audio-input') && srcData && srcData.config && srcData.config.deviceId) {
        _cameraPreselectValue = srcData.config.deviceId;
      }
      if (type === 'window-capture' && srcData && srcData.config && srcData.config.windowId) {
        _windowCapturePreselectId = srcData.config.windowId;
      }
      openSourceConfig(type);
      const titleEl = document.getElementById('source-config-title');
      const label = SOURCE_TYPE_LABELS[type] || type;
      titleEl.textContent = label + ' Properties';
      // Populate name
      const inp = document.getElementById('src-cfg-name');
      if (inp) inp.value = _selectedSourceEl.querySelector('.sli-label').textContent;

      const c = srcData && srcData.config ? srcData.config : {};
      if (_isAudioCapableSourceType(type)) {
        _setSegVal('src-cfg-input-mode', _normalizeSourceInputMode(c.inputMode));
        const panEl = document.getElementById('src-cfg-pan');
        if (panEl) {
          const pan = _normalizeSourcePan(c.pan);
          panEl.value = String(pan);
          const hint = panEl.closest('.src-cfg-group')?.querySelector('.src-cfg-hint');
          if (hint) hint.textContent = pan === 0 ? 'C' : (pan < 0 ? `L${Math.abs(pan)}` : `R${pan}`);
        }
        const widthEl = document.getElementById('src-cfg-width');
        if (widthEl) {
          const width = _normalizeSourceWidth(c.width);
          widthEl.value = String(width);
          const hint = widthEl.closest('.src-cfg-group')?.querySelector('.src-cfg-hint');
          if (hint) hint.textContent = `${width} %`;
        }
      }

      /* ── Camera ── */
      if (type === 'camera') {
        const fitMode = _normalizeSourceFitMode(c.fitMode || c.fit || 'contain');
        _setSegVal('src-cfg-fitmode', fitMode);
        const fitSeg = document.getElementById('src-cfg-fitmode');
        const fitHint = fitSeg ? fitSeg.closest('.src-cfg-group')?.querySelector('.src-cfg-hint') : null;
        if (fitHint) fitHint.textContent = _sourceFitModeHintText(fitMode);
        if (c.resolution) _setSegVal('src-cfg-resolution', c.resolution);
        if (c.fps) _setSegVal('src-cfg-fps', c.fps);
        _setTogVal('src-cfg-mirror', !!c.mirror);
        const devField = document.getElementById('src-cfg-device');
        if (devField && c.deviceId) {
          setTimeout(() => {
            if (devField.querySelector(`option[value="${c.deviceId}"]`)) {
              devField.value = c.deviceId;
              _updateSourcePreview();
            }
          }, 600);
        }
      }

      /* ── Audio Input ── */
      if (type === 'audio-input') {
        _setTogVal('src-cfg-monitor', !!c.monitor);
        const gainEl = document.getElementById('src-cfg-gain');
        if (gainEl && c.gain != null) {
          gainEl.value = c.gain;
          const hint = gainEl.closest('.src-cfg-group')?.querySelector('.src-cfg-hint');
          if (hint) hint.textContent = c.gain + ' %';
        }
        const devField = document.getElementById('src-cfg-device');
        if (devField && c.deviceId) {
          setTimeout(() => {
            if (devField.querySelector(`option[value="${c.deviceId}"]`)) {
              devField.value = c.deviceId;
            }
          }, 600);
        }
      }

      /* ── Image ── */
      if (type === 'image') {
        if (c.fit) _setSegVal('src-cfg-fit', c.fit);
        const opEl = document.getElementById('src-cfg-opacity');
        if (opEl && c.opacity != null) {
          opEl.value = c.opacity;
          const hint = opEl.closest('.src-cfg-group')?.querySelector('.src-cfg-hint');
          if (hint) hint.textContent = c.opacity + ' %';
        }
      }

      /* ── Text ── */
      if (type === 'text') {
        const txtField = document.getElementById('src-cfg-text');
        if (txtField && c.text != null) txtField.value = c.text;
        const fontSel = document.getElementById('src-cfg-font');
        if (fontSel && c.fontFamily) fontSel.value = c.fontFamily;
        const sizeInp = document.getElementById('src-cfg-fontsize');
        if (sizeInp && c.fontSize != null) sizeInp.value = c.fontSize;
        const colorInp = document.getElementById('src-cfg-color');
        if (colorInp && c.color) colorInp.value = c.color;
        const bgColorInp = document.getElementById('src-cfg-bgcolor');
        if (bgColorInp && c.bgColor) bgColorInp.value = c.bgColor;
        if (c.align) _setSegVal('src-cfg-align', c.align);
        _setTogVal('src-cfg-wordwrap', c.wordWrap !== false);
        _setTogVal('src-cfg-showbg', !!c.showBg);
      }

      /* ── Media Source ── */
      if (type === 'media-source') {
        const filePath = String(c.filePath || c.fileName || '').trim();
        const pathField = document.getElementById('src-cfg-file-path');
        const fileHint = document.getElementById('src-cfg-file-hint');
        if (pathField) pathField.value = filePath;
        if (fileHint) fileHint.textContent = filePath
          ? t('source_config_current_file').replace('{file}', filePath)
          : t('common_no_file_selected');
        _setTogVal('src-cfg-loop', c.loop !== false);
        _setTogVal('src-cfg-autoplay', c.autoplay !== false);
        const volEl = document.getElementById('src-cfg-volume');
        if (volEl && c.volume != null) {
          volEl.value = c.volume;
          const hint = volEl.closest('.src-cfg-group')?.querySelector('.src-cfg-hint');
          if (hint) hint.textContent = c.volume + ' %';
        }
      }

      /* ── Window Capture ── */
      if (type === 'window-capture') {
        _setTogVal('src-cfg-cursor', c.captureCursor !== false);
        // Window selection restored via _windowCapturePreselectId in enumerateDesktopSources
      }

      /* ── NDI ── */
      if (type === 'ndi') {
        if (c.resolution) _setSegVal('src-cfg-resolution', c.resolution);
        if (c.fps) _setSegVal('src-cfg-fps', c.fps);
        _setTogVal('src-cfg-ndi-lowbw', !!c.lowBandwidth);
        // Restore NDI audio settings
        _setTogVal('src-cfg-ndi-audio', c.ndiAudioEnabled !== false);
        _setTogVal('src-cfg-ndi-monitor', !!c.ndiMonitorAudio);
        const ndiVolEl = document.getElementById('src-cfg-ndi-volume');
        if (ndiVolEl && c.ndiAudioVolume != null) {
          ndiVolEl.value = c.ndiAudioVolume;
          const hint = ndiVolEl.closest('.src-cfg-group')?.querySelector('.src-cfg-hint');
          if (hint) hint.textContent = c.ndiAudioVolume + ' %';
        }
        // Update audio section UI state (opacity/disabled) and populate device dropdown with saved selection
        _onNdiAudioToggled(c.ndiAudioDeviceId || 'auto');
      }
    }

    function moveSelectedSource(dir) {
      if (!_selectedSourceEl) return;
      const list = document.getElementById('sources-list');
      const items = [...list.children];
      const idx = items.indexOf(_selectedSourceEl);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= items.length) return;
      if (dir === -1) list.insertBefore(_selectedSourceEl, items[newIdx]);
      else list.insertBefore(_selectedSourceEl, items[newIdx].nextSibling);
      // Sync data model order
      saveCurrentSourceOrder();
      renderProgramDisplay();
      schedulePersistAppState();
    }

    function duplicateSelectedSource() {
      if (!_selectedSourceEl) return;
      const scene = _activeScene();
      if (!scene || !Array.isArray(scene.sources)) return;
      const srcId = _selectedSourceEl.dataset.sourceId;
      const idx = scene.sources.findIndex((s) => s && s.id === srcId);
      if (idx < 0) return;
      const clone = _cloneSourceForScene(scene.sources[idx]);
      if (!clone) return;
      clone.name = _makeUniqueSourceNameInScene(scene, (clone.name || 'Layer') + ' Copy');
      _ensureSourceAudioFxDefaults(clone);
      scene.sources.splice(idx + 1, 0, clone);
      renderSourcesForScene(scene.id);
      const newEl = document.querySelector(`.source-list-item[data-source-id="${clone.id}"]`);
      if (newEl) selectSourceItem(newEl);
      renderProgramDisplay();
      schedulePersistAppState();
    }

    function setSelectedSourceVisibility(visible) {
      if (!_selectedSourceEl) return;
      const eye = _selectedSourceEl.querySelector('.sli-eye');
      if (!eye) return;
      const currentlyVisible = eye.dataset.hidden !== '1';
      if (currentlyVisible === !!visible) return;
      toggleVisibility(eye);
    }

    function setSelectedSourceTransformLock(locked) {
      if (!_selectedSourceEl) return;
      const lockIcon = _selectedSourceEl.querySelector('.sli-lock');
      if (!lockIcon) return;
      const currentlyLocked = lockIcon.dataset.locked === '1';
      if (currentlyLocked === !!locked) return;
      toggleSourceTransformLock(lockIcon);
    }

    function showSelectedSourceTransformControls() {
      if (!_selectedSourceEl) return;
      _xfCanvasHover = true;
      _xfControlsVisible = true;
      _updateTransformOverlay();
    }

    function resetActiveSceneTransform() {
      const scene = _activeScene();
      if (!scene) return;
      scene.transform = { x: 0, y: 0, w: 100, h: 100, rotation: 0, cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0 };
      _applySceneTransformToCompositor(scene);
      _updateTransformOverlay();
      schedulePersistAppState();
    }

    function showSceneTransformControls() {
      if (_selectedSourceEl) {
        _selectedSourceEl.classList.remove('selected');
        _selectedSourceEl = null;
      }
      _xfCanvasHover = true;
      _xfControlsVisible = true;
      _updateTransformOverlay();
      _updateSourceFxToolbarButton();
    }

    let _sceneLayerCtxState = { kind: '', id: '' };
    let _sceneLayerSubmenus = Object.create(null);
    let _sceneLayerActiveSubmenu = '';

    function _sceneLayerMenuEl() {
      return document.getElementById('scene-layer-context-menu');
    }
    function _sceneLayerSubmenuEl() {
      return document.getElementById('scene-layer-context-submenu');
    }

    function _positionSceneLayerSubmenu(anchorBtn) {
      const submenu = _sceneLayerSubmenuEl();
      if (!submenu || !anchorBtn) return;
      const pad = 8;
      const anchorRect = anchorBtn.getBoundingClientRect();
      const width = submenu.offsetWidth || 272;
      const height = submenu.offsetHeight || 320;
      let left = anchorRect.right + 4;
      if (left + width > window.innerWidth - pad) left = anchorRect.left - width - 4;
      left = Math.max(pad, Math.min(left, window.innerWidth - width - pad));
      // Prefer opening upward from the hovered item.
      let top = anchorRect.bottom - height + 4;
      if (top < pad) top = Math.min(window.innerHeight - height - pad, anchorRect.top - 4);
      top = Math.max(pad, top);
      submenu.style.left = `${Math.round(left)}px`;
      submenu.style.top = `${Math.round(top)}px`;
    }

    function closeSceneLayerSubmenu() {
      const submenu = _sceneLayerSubmenuEl();
      if (!submenu) return;
      submenu.classList.remove('open');
      submenu.setAttribute('aria-hidden', 'true');
      submenu.innerHTML = '';
      _sceneLayerActiveSubmenu = '';
      const menu = _sceneLayerMenuEl();
      if (menu) menu.querySelectorAll('.sl-ctx-submenu-trigger.active').forEach((el) => el.classList.remove('active'));
    }

    function _openSceneLayerSubmenu(key, anchorBtn) {
      const submenu = _sceneLayerSubmenuEl();
      const menu = _sceneLayerMenuEl();
      if (!submenu || !menu) return;
      const html = _sceneLayerSubmenus[key] || '';
      if (!html) {
        closeSceneLayerSubmenu();
        return;
      }
      submenu.innerHTML = html;
      submenu.classList.add('open');
      submenu.setAttribute('aria-hidden', 'false');
      _sceneLayerActiveSubmenu = key;
      menu.querySelectorAll('.sl-ctx-submenu-trigger').forEach((el) => {
        el.classList.toggle('active', el === anchorBtn && String(el.dataset.submenu || '') === key);
      });
      _positionSceneLayerSubmenu(anchorBtn);
    }

    function closeSceneLayerContextMenu() {
      const menu = _sceneLayerMenuEl();
      if (!menu) return;
      closeSceneLayerSubmenu();
      menu.classList.remove('open');
      menu.setAttribute('aria-hidden', 'true');
      menu.innerHTML = '';
      _sceneLayerSubmenus = Object.create(null);
      _sceneLayerCtxState = { kind: '', id: '' };
    }

    function _positionSceneLayerContextMenu(x, y) {
      const menu = _sceneLayerMenuEl();
      if (!menu) return;
      const pad = 8;
      const width = menu.offsetWidth || 246;
      const height = menu.offsetHeight || 280;
      const xOffset = 18;
      const left = Math.max(pad, Math.min(x - xOffset, window.innerWidth - width - pad));
      // Prefer opening upward from cursor.
      let top = y - height + 4;
      if (top < pad) top = y;
      top = Math.max(pad, Math.min(top, window.innerHeight - height - pad));
      menu.style.left = `${Math.round(left)}px`;
      menu.style.top = `${Math.round(top)}px`;
    }

    const SOURCE_LAYER_TRANSITION_OPTIONS = [
      { id: 'cut', label: 'Cut' },
      { id: 'fade', label: 'Fade' },
      { id: 'swipe', label: 'Swipe' },
      { id: 'slide', label: 'Slide' },
      { id: 'stinger', label: 'Stinger' },
      { id: 'fade-to-colour', label: 'Fade to Colour' },
      { id: 'luma-wipe', label: 'Luma Wipe' }
    ];
    const SOURCE_COLOR_LABEL_OPTIONS = [
      { id: '', label: 'No Color / Default', color: '' },
      { id: '#3b82f6', label: 'Cobalt Blue', color: '#3b82f6' },
      { id: '#06b6d4', label: 'Cyan', color: '#06b6d4' },
      { id: '#14b8a6', label: 'Teal', color: '#14b8a6' },
      { id: '#22c55e', label: 'Emerald', color: '#22c55e' },
      { id: '#84cc16', label: 'Lime', color: '#84cc16' },
      { id: '#eab308', label: 'Amber', color: '#eab308' },
      { id: '#f97316', label: 'Orange', color: '#f97316' },
      { id: '#ef4444', label: 'Red', color: '#ef4444' },
      { id: '#ec4899', label: 'Pink', color: '#ec4899' },
      { id: '#8b5cf6', label: 'Violet', color: '#8b5cf6' },
      { id: '#94a3b8', label: 'Slate', color: '#94a3b8' }
    ];
    // Fit mode options are no longer exposed in the right-click menu;
    // legacy array kept for potential future use, but empty to avoid accidental
    // iteration.
    const SOURCE_FIT_MODE_OPTIONS = [];

    function _normalizeHexColor(value) {
      const raw = String(value || '').trim();
      if (!raw) return '';
      const six = raw.match(/^#([0-9a-f]{6})$/i);
      if (six) return `#${six[1].toLowerCase()}`;
      const three = raw.match(/^#([0-9a-f]{3})$/i);
      if (!three) return '';
      const chars = three[1].toLowerCase().split('');
      return `#${chars.map((ch) => ch + ch).join('')}`;
    }

    function _getSourceColorLabel(src) {
      const raw = src && src.config ? src.config.colorLabel : '';
      return _normalizeHexColor(raw);
    }

    function _isDefaultSourceColorLabel(color) {
      return !_normalizeHexColor(color);
    }

    function _getSourceTrackColor(src, fallbackColor) {
      const custom = _getSourceColorLabel(src);
      return custom || String(fallbackColor || '#8899aa');
    }

    function _legacyFitToFitMode(raw) {
      const key = String(raw || '').trim().toLowerCase();
      if (key === 'contain' || key === 'cover' || key === 'stretch' || key === 'pixel-1:1') return key;
      if (key === 'fill') return 'stretch';
      if (key === 'none') return 'pixel-1:1';
      return '';
    }

    function _fitModeToLegacyFit(mode) {
      const normalized = _normalizeSourceFitMode(mode);
      if (normalized === 'stretch') return 'fill';
      if (normalized === 'pixel-1:1') return 'none';
      return normalized;
    }

    function _normalizeSourceFitMode(mode, fallback = 'contain') {
      const normalized = _legacyFitToFitMode(mode);
      if (normalized) return normalized;
      const fallbackNorm = _legacyFitToFitMode(fallback);
      return fallbackNorm || 'contain';
    }

    function _isFitModeCapableSourceType(type) {
      return type === 'camera'
        || type === 'ndi'
        || type === 'window-capture'
        || type === 'media-source'
        || type === 'image';
    }

    function _getSourceFitMode(src) {
      if (!src || !_isFitModeCapableSourceType(src.type)) return 'contain';
      const cfg = src.config || {};
      const fallback = src.type === 'ndi' ? 'cover' : 'contain';
      return _normalizeSourceFitMode(cfg.fitMode || cfg.fit || fallback);
    }

    function _sourceFitModeLabel(mode) {
      const normalized = _normalizeSourceFitMode(mode);
      const found = SOURCE_FIT_MODE_OPTIONS.find((opt) => opt.id === normalized);
      return found ? found.label : 'Contain';
    }

    function _isAspectPreservedFitMode(mode) {
      const normalized = _normalizeSourceFitMode(mode);
      return normalized === 'contain' || normalized === 'pixel-1:1';
    }

    function _sourceFitModeHintText(mode) {
      return _isAspectPreservedFitMode(mode) ? 'Aspect ratio preserved' : 'Aspect ratio may be altered or cropped';
    }

    function _sourceFitModeItemHtml(mode, active) {
      const normalized = _normalizeSourceFitMode(mode);
      const label = _sourceFitModeLabel(normalized);
      const activeClass = active ? ' active' : '';
      return `<button class="sl-ctx-item${activeClass}" data-action="source-fit-mode" data-fit-mode="${normalized}">${esc(label)}${active ? '<span class="sl-ctx-check">✓</span>' : ''}</button>`;
    }

    function _applyVisualFitMode(el, mode, opts = {}) {
      if (!el) return;
      const normalized = _normalizeSourceFitMode(mode);
      const mirror = opts.mirror === true;
      el.style.position = 'absolute';
      el.style.display = 'block';
      el.style.transformOrigin = '50% 50%';
      el.style.maxWidth = 'none';
      el.style.maxHeight = 'none';
      if (normalized === 'pixel-1:1') {
        el.style.left = '50%';
        el.style.top = '50%';
        el.style.right = '';
        el.style.bottom = '';
        el.style.width = 'auto';
        el.style.height = 'auto';
        el.style.objectFit = 'none';
        el.style.transform = mirror ? 'translate(-50%, -50%) scaleX(-1)' : 'translate(-50%, -50%)';
      } else {
        el.style.left = '0';
        el.style.top = '0';
        el.style.right = '';
        el.style.bottom = '';
        el.style.width = '100%';
        el.style.height = '100%';
        el.style.objectFit = normalized === 'stretch' ? 'fill' : normalized;
        el.style.transform = mirror ? 'scaleX(-1)' : '';
      }
      el.dataset.fitMode = normalized;
    }

    function _bindVisualFitModeAuto(el, src, opts = {}) {
      if (!el || !src) return;
      const apply = () => _applyVisualFitMode(el, _getSourceFitMode(src), opts);
      apply();
      if (el.dataset.fitBound === '1') return;
      el.dataset.fitBound = '1';
      el.addEventListener('loadedmetadata', apply);
      el.addEventListener('resize', apply);
    }

    function _sourceColorMenuItemHtml(color, label, active) {
      const normalized = _normalizeHexColor(color);
      const chipClass = normalized ? 'sl-ctx-color-chip' : 'sl-ctx-color-chip default';
      const chipStyle = normalized ? ` style="--sl-chip:${normalized}"` : '';
      const activeClass = active ? ' active' : '';
      const dataColor = normalized ? normalized : '';
      return `<button class="sl-ctx-item${activeClass}" data-action="source-color-label" data-color="${dataColor}"><span class="${chipClass}"${chipStyle}></span>${esc(label)}${active ? '<span class="sl-ctx-check">✓</span>' : ''}</button>`;
    }

    function _sourceColorSwatchHtml(color, label, active) {
      const normalized = _normalizeHexColor(color);
      const dataColor = normalized ? normalized : '';
      const swatchClass = normalized ? 'sl-ctx-item sl-ctx-color-swatch' : 'sl-ctx-item sl-ctx-color-swatch default';
      const style = normalized ? ` style="--swatch:${normalized}"` : '';
      const activeClass = active ? ' active' : '';
      return `<button class="${swatchClass}${activeClass}"${style} data-action="source-color-label" data-color="${dataColor}" title="${esc(label)}">${active ? '<span class="sl-ctx-check">✓</span>' : ''}</button>`;
    }

    function _sourceColorDotHtml(src) {
      const color = _getSourceColorLabel(src);
      if (color) return `<span class="sli-color-dot" style="--sli-color:${color}" title="Layer color: ${color}"></span>`;
      return '<span class="sli-color-dot default" title="Layer color: Default"></span>';
    }

    function _normalizeSourceLayerTransitionType(raw) {
      const key = String(raw || 'cut').trim().toLowerCase();
      if (!key || key === 'none') return 'cut';
      if (key === 'slide-left' || key === 'slide-right' || key === 'slide-up' || key === 'slide-down') return 'slide';
      if (key === 'zoom-in' || key === 'zoom-out') return 'stinger';
      if (SOURCE_LAYER_TRANSITION_OPTIONS.some((opt) => opt.id === key)) return key;
      return 'cut';
    }

    function _getSourceLayerTransitionLabel(type) {
      const key = _normalizeSourceLayerTransitionType(type);
      const found = SOURCE_LAYER_TRANSITION_OPTIONS.find((opt) => opt.id === key);
      return found ? found.label : 'Cut';
    }

    function _getSourceLayerTransitionType(src, kind) {
      const key = kind === 'out' ? 'outTransition' : 'inTransition';
      const raw = String(src?.config?.[key] || 'cut').toLowerCase();
      return _normalizeSourceLayerTransitionType(raw);
    }

    function _getSourceLayerTransitionDurationMs(src, kind) {
      const key = kind === 'out' ? 'outTransitionDurationMs' : 'inTransitionDurationMs';
      const raw = Number(src?.config?.[key]);
      if (Number.isFinite(raw) && raw > 0) return Math.max(50, Math.min(5000, Math.round(raw)));
      const legacy = Number(src?.config?.transitionDurationMs);
      if (Number.isFinite(legacy) && legacy > 0) return Math.max(50, Math.min(5000, Math.round(legacy)));
      return 420;
    }

    function _isTransitionableLayerSourceType(type) {
      return type === 'media-source'
        || type === 'camera'
        || type === 'window-capture'
        || type === 'ndi'
        || type === 'image'
        || type === 'text'
        || type === 'scene';
    }

    function _pickSourceLayerTransitionType(src, kind) {
      if (!src) return;
      if (!src.config) src.config = {};
      const key = kind === 'out' ? 'outTransition' : 'inTransition';
      const current = _getSourceLayerTransitionType(src, kind);
      const title = kind === 'out' ? 'Out Transition' : 'In Transition';
      const lines = SOURCE_LAYER_TRANSITION_OPTIONS
        .map((opt, idx) => `${idx + 1}. ${opt.label}${opt.id === current ? ' (current)' : ''}`)
        .join('\n');
      const input = window.prompt(`${title}\n${lines}\nEnter number or name:`, current);
      if (input == null) return;
      const raw = String(input || '').trim().toLowerCase();
      if (!raw) return;
      let picked = null;
      const idxNum = parseInt(raw, 10);
      if (Number.isFinite(idxNum) && idxNum >= 1 && idxNum <= SOURCE_LAYER_TRANSITION_OPTIONS.length) {
        picked = SOURCE_LAYER_TRANSITION_OPTIONS[idxNum - 1].id;
      } else {
        const match = SOURCE_LAYER_TRANSITION_OPTIONS.find((opt) =>
          opt.id === raw || opt.label.toLowerCase() === raw
        );
        picked = match ? match.id : null;
      }
      if (!picked) {
        if (typeof showToast === 'function') showToast('Invalid transition selection.');
        return;
      }
      src.config[key] = picked;
      schedulePersistAppState();
      if (typeof showToast === 'function') showToast(`${title} set to ${_getSourceLayerTransitionLabel(picked)}.`);
    }

    function _pickSourceLayerTransitionDuration(src, kind) {
      if (!src) return;
      if (!src.config) src.config = {};
      const key = kind === 'out' ? 'outTransitionDurationMs' : 'inTransitionDurationMs';
      const title = kind === 'out' ? 'Out Transition Duration' : 'In Transition Duration';
      const current = _getSourceLayerTransitionDurationMs(src, kind);
      const input = window.prompt(`${title}\nEnter duration in milliseconds (50 - 5000):`, String(current));
      if (input == null) return;
      const val = Number(String(input).trim());
      if (!Number.isFinite(val)) {
        if (typeof showToast === 'function') showToast('Invalid duration.');
        return;
      }
      const ms = Math.max(50, Math.min(5000, Math.round(val)));
      src.config[key] = ms;
      schedulePersistAppState();
      if (typeof showToast === 'function') showToast(`${title} set to ${ms}ms.`);
    }

    function _setSourceLayerTransitionType(sourceOrId, kind, type, opts = {}) {
      let src = null;
      if (sourceOrId && typeof sourceOrId === 'object' && sourceOrId.id) src = sourceOrId;
      else src = _getSourceById(String(sourceOrId || ''));
      if (!src) return false;
      if (!src.config) src.config = {};
      const key = kind === 'out' ? 'outTransition' : 'inTransition';
      const next = _normalizeSourceLayerTransitionType(type);
      const prev = _getSourceLayerTransitionType(src, kind);
      if (prev === next) return false;
      src.config[key] = next;
      if (_sceneLayerCtxState && _sceneLayerCtxState.kind === 'source' && _sceneLayerCtxState.id === src.id) {
        const keepSubmenuKey = _sceneLayerActiveSubmenu;
        _renderSceneLayerContextMenu('source', src.id);
        if (keepSubmenuKey) {
          const menu = _sceneLayerMenuEl();
          const trigger = menu ? menu.querySelector(`.sl-ctx-submenu-trigger[data-submenu="${keepSubmenuKey}"]`) : null;
          if (trigger) _openSceneLayerSubmenu(keepSubmenuKey, trigger);
        }
      }
      if (opts.persist !== false) schedulePersistAppState();
      return true;
    }

    function _setSourceLayerTransitionDuration(sourceOrId, kind, durationMs, opts = {}) {
      let src = null;
      if (sourceOrId && typeof sourceOrId === 'object' && sourceOrId.id) src = sourceOrId;
      else src = _getSourceById(String(sourceOrId || ''));
      if (!src) return false;
      if (!src.config) src.config = {};
      const key = kind === 'out' ? 'outTransitionDurationMs' : 'inTransitionDurationMs';
      const next = Math.max(50, Math.min(5000, Math.round(Number(durationMs) || 0)));
      const prev = _getSourceLayerTransitionDurationMs(src, kind);
      if (next === prev) return false;
      src.config[key] = next;
      if (_sceneLayerCtxState && _sceneLayerCtxState.kind === 'source' && _sceneLayerCtxState.id === src.id) {
        const keepSubmenuKey = _sceneLayerActiveSubmenu;
        _renderSceneLayerContextMenu('source', src.id);
        if (keepSubmenuKey) {
          const menu = _sceneLayerMenuEl();
          const trigger = menu ? menu.querySelector(`.sl-ctx-submenu-trigger[data-submenu="${keepSubmenuKey}"]`) : null;
          if (trigger) _openSceneLayerSubmenu(keepSubmenuKey, trigger);
        }
      }
      if (opts.persist !== false) schedulePersistAppState();
      return true;
    }

    function _setSourceInputMode(sourceOrId, mode, opts = {}) {
      let src = null;
      if (sourceOrId && typeof sourceOrId === 'object' && sourceOrId.id) src = sourceOrId;
      else src = _getSourceById(String(sourceOrId || ''));
      if (!src || !_isAudioCapableSourceType(src.type)) return false;
      if (!src.config) src.config = {};
      const nextMode = _normalizeSourceInputMode(mode);
      const prevMode = _normalizeSourceInputMode(src.config.inputMode);
      if (prevMode === nextMode) return false;
      src.config.inputMode = nextMode;
      const keepSubmenuKey = _sceneLayerActiveSubmenu;
      if (typeof _pgmSyncSources === 'function') _pgmSyncSources();
      if (_promixOpen) renderProMixer();
      _syncSourceInputModeUi(src.id);
      if (keepSubmenuKey && _sceneLayerCtxState && _sceneLayerCtxState.kind === 'source' && _sceneLayerCtxState.id === src.id) {
        const menu = _sceneLayerMenuEl();
        const trigger = menu ? menu.querySelector(`.sl-ctx-submenu-trigger[data-submenu="${keepSubmenuKey}"]`) : null;
        if (trigger) _openSceneLayerSubmenu(keepSubmenuKey, trigger);
      }
      if (opts.renderControls !== false) {
        if (typeof _ctrlSyncRowFromSource === 'function') _ctrlSyncRowFromSource(src.id);
      }
      if (opts.persist !== false) schedulePersistAppState();
      return true;
    }

    function _syncSourceInputModeUi(sourceId) {
      if (!sourceId) return;
      const src = _ctrlGetPersistedSourceRef(sourceId) || _getSourceById(sourceId);
      if (!src || !_isAudioCapableSourceType(src.type)) return;
      const mode = _getSourceInputMode(src);
      const modeLabel = _sourceInputModeLabel(mode);
      const nextLabel = _sourceInputModeLabel(_sourceToggleInputMode(mode));
      const icon = _sourceInputModeIconSvg(mode);

      const proBtn = document.querySelector(`.promix-input-opt[data-src-id="${sourceId}"]`);
      if (proBtn) {
        proBtn.classList.toggle('active', mode === 'mono');
        proBtn.dataset.inputMode = mode;
        proBtn.setAttribute('aria-pressed', mode === 'mono' ? 'true' : 'false');
        proBtn.setAttribute('aria-label', `Input mode: ${modeLabel}. Activate to switch to ${nextLabel}.`);
        proBtn.title = `Input mode: ${modeLabel} (click to switch to ${nextLabel})`;
        const svg = proBtn.querySelector('svg');
        if (svg) svg.innerHTML = icon;
      }

      const ctrlBtn = document.querySelector(`.ctrl-meter-row[data-src-id="${sourceId}"] .ctrl-input-mode-btn`);
      if (ctrlBtn) {
        ctrlBtn.classList.toggle('active', mode === 'mono');
        ctrlBtn.dataset.ctrlInputMode = mode;
        ctrlBtn.setAttribute('aria-pressed', mode === 'mono' ? 'true' : 'false');
        ctrlBtn.setAttribute('aria-label', `Input mode: ${modeLabel}. Activate to switch to ${nextLabel}.`);
        ctrlBtn.title = `Input mode: ${modeLabel} (click to switch to ${nextLabel})`;
        const svg = ctrlBtn.querySelector('svg');
        if (svg) svg.innerHTML = icon;
      }

      if (_editingSourceEl && String(_editingSourceEl.dataset.sourceId || '') === String(sourceId)) {
        _setSegVal('src-cfg-input-mode', mode);
      }

      if (_sceneLayerCtxState && _sceneLayerCtxState.kind === 'source' && _sceneLayerCtxState.id === sourceId) {
        _renderSceneLayerContextMenu('source', sourceId);
      }
    }

    function _setSourceInputChannelRoute(sourceOrId, left, right, opts = {}) {
      let src = null;
      if (sourceOrId && typeof sourceOrId === 'object' && sourceOrId.id) src = sourceOrId;
      else src = _getSourceById(String(sourceOrId || ''));
      if (!src || !_isAudioCapableSourceType(src.type)) return false;
      if (!src.config) src.config = {};
      const prevRoute = _getSourceInputChannelRoute(src);
      const nextRoute = _normalizeSourceInputChannelRoute(left, right);
      if (prevRoute.left === nextRoute.left && prevRoute.right === nextRoute.right) return false;
      src.config.inputRouteLeft = nextRoute.left;
      src.config.inputRouteRight = nextRoute.right;
      if (typeof _pgmSyncSources === 'function') _pgmSyncSources();
      _syncSourceInputRouteUi(src.id);
      if (_promixOpen && opts.render !== false) renderProMixer();
      if (opts.renderControls !== false) {
        if (typeof _ctrlSyncRowFromSource === 'function') _ctrlSyncRowFromSource(src.id);
      }
      if (opts.persist !== false) schedulePersistAppState();
      return true;
    }

    function _syncSourceInputRouteUi(sourceId) {
      if (!sourceId) return;
      const src = _ctrlGetPersistedSourceRef(sourceId) || _getSourceById(sourceId);
      if (!src || !_isAudioCapableSourceType(src.type)) return;
      const route = _getSourceInputChannelRoute(src);
      const routeLabel = _fmtSourceInputRouteLabel(route);
      const btn = document.querySelector(`.promix-input-route-btn[data-src-id="${sourceId}"]`);
      if (btn) {
        btn.setAttribute('data-route-left', String(route.left));
        btn.setAttribute('data-route-right', String(route.right));
        btn.title = `Channel input routing: ${routeLabel}`;
        btn.setAttribute('aria-label', `Channel input routing ${routeLabel}. Activate to change routing.`);
        const label = btn.querySelector('.promix-input-route-label');
        if (label) label.textContent = routeLabel;
      }
      if (typeof _promixRefreshInputRoutePop === 'function') _promixRefreshInputRoutePop(sourceId);
      if (_sceneLayerCtxState && _sceneLayerCtxState.kind === 'source' && _sceneLayerCtxState.id === sourceId) {
        _renderSceneLayerContextMenu('source', sourceId);
      }
    }

    function _setSourcePanWidth(sourceOrId, nextPan, nextWidth, opts = {}) {
      let src = null;
      if (sourceOrId && typeof sourceOrId === 'object' && sourceOrId.id) src = sourceOrId;
      else src = _getSourceById(String(sourceOrId || ''));
      if (!src || !_isAudioCapableSourceType(src.type)) return false;
      if (!src.config) src.config = {};
      const pan = _normalizeSourcePan(nextPan == null ? src.config.pan : nextPan);
      const width = _normalizeSourceWidth(nextWidth == null ? src.config.width : nextWidth);
      const prevPan = _normalizeSourcePan(src.config.pan);
      const prevWidth = _normalizeSourceWidth(src.config.width);
      if (pan === prevPan && width === prevWidth) return false;
      src.config.pan = pan;
      src.config.width = width;
      if (typeof _pgmSyncSources === 'function') _pgmSyncSources();
      if (_promixOpen && opts.render !== false) renderProMixer();
      if (opts.renderControls !== false) {
        if (typeof _ctrlSyncRowFromSource === 'function') _ctrlSyncRowFromSource(src.id);
      }
      if (opts.persist !== false) schedulePersistAppState();
      return true;
    }

    function _fmtPanLabel(v) {
      const pan = _normalizeSourcePan(v);
      if (pan === 0) return 'C';
      return pan < 0 ? `L${Math.abs(pan)}` : `R${pan}`;
    }

    function _pickSourcePan(src) {
      if (!src || !_isAudioCapableSourceType(src.type)) return;
      const current = _getSourcePan(src);
      const input = window.prompt('Pan (-100..100)\nLeft is negative, right is positive.', String(current));
      if (input == null) return;
      const parsed = Number(String(input).trim());
      if (!Number.isFinite(parsed)) {
        if (typeof showToast === 'function') showToast('Invalid pan value.');
        return;
      }
      const pan = _normalizeSourcePan(parsed);
      const changed = _setSourcePanWidth(src, pan, null, { persist: true });
      if (changed && typeof showToast === 'function') showToast(`Pan set to ${_fmtPanLabel(pan)}.`);
    }

    function _pickSourceWidth(src) {
      if (!src || !_isAudioCapableSourceType(src.type)) return;
      const current = _getSourceWidth(src);
      const input = window.prompt('Width (0..200%)\n0% = mono, 100% = normal stereo.', String(current));
      if (input == null) return;
      const parsed = Number(String(input).trim());
      if (!Number.isFinite(parsed)) {
        if (typeof showToast === 'function') showToast('Invalid width value.');
        return;
      }
      const width = _normalizeSourceWidth(parsed);
      const changed = _setSourcePanWidth(src, null, width, { persist: true });
      if (changed && typeof showToast === 'function') showToast(`Width set to ${width}%.`);
    }

    function _pickSourceInputMode(src) {
      if (!src || !_isAudioCapableSourceType(src.type)) return;
      if (!src.config) src.config = {};
      const current = _normalizeSourceInputMode(src.config.inputMode);
      const lines = SOURCE_INPUT_MODE_OPTIONS
        .map((opt, idx) => `${idx + 1}. ${opt.label}${opt.id === current ? ' (current)' : ''}`)
        .join('\n');
      const input = window.prompt(`Input Mode\n${lines}\nEnter number or name:`, current);
      if (input == null) return;
      const raw = String(input || '').trim().toLowerCase();
      if (!raw) return;
      let picked = null;
      const idxNum = parseInt(raw, 10);
      if (Number.isFinite(idxNum) && idxNum >= 1 && idxNum <= SOURCE_INPUT_MODE_OPTIONS.length) {
        picked = SOURCE_INPUT_MODE_OPTIONS[idxNum - 1].id;
      } else {
        const match = SOURCE_INPUT_MODE_OPTIONS.find((opt) =>
          opt.id === raw || opt.label.toLowerCase() === raw
        );
        picked = match ? match.id : null;
      }
      if (!picked) {
        if (typeof showToast === 'function') showToast('Invalid input mode.');
        return;
      }
      const changed = _setSourceInputMode(src, picked, { persist: true });
      if (changed && typeof showToast === 'function') {
        showToast(`Input mode set to ${picked === 'mono' ? 'Mono' : 'Stereo'}.`);
      }
    }

    function _setSourceFitMode(sourceOrId, mode, opts = {}) {
      let src = null;
      if (sourceOrId && typeof sourceOrId === 'object' && sourceOrId.id) src = sourceOrId;
      else src = _getSourceById(String(sourceOrId || ''));
      if (!src || !_isFitModeCapableSourceType(src.type)) return false;
      src.config = src.config || {};
      const nextMode = _normalizeSourceFitMode(mode);
      const prevMode = _getSourceFitMode(src);
      if (nextMode === prevMode) return false;
      src.config.fitMode = nextMode;
      src.config.fit = _fitModeToLegacyFit(nextMode);
      if (opts.render !== false) renderProgramDisplay();
      if (opts.renderControls !== false && typeof renderControlsPanel === 'function') renderControlsPanel();
      if (_sceneLayerCtxState && _sceneLayerCtxState.kind === 'source' && _sceneLayerCtxState.id === src.id) {
        _renderSceneLayerContextMenu('source', src.id);
      }
      if (_editingSourceEl && String(_editingSourceEl.dataset.sourceId || '') === String(src.id)) {
        _setSegVal('src-cfg-fitmode', nextMode);
        const fitSeg = document.getElementById('src-cfg-fitmode');
        const fitHint = fitSeg ? fitSeg.closest('.src-cfg-group')?.querySelector('.src-cfg-hint') : null;
        if (fitHint) fitHint.textContent = _sourceFitModeHintText(nextMode);
      }
      if (opts.persist !== false) schedulePersistAppState();
      return true;
    }

    function _setSourceColorLabel(sourceOrId, color, opts = {}) {
      let src = null;
      if (sourceOrId && typeof sourceOrId === 'object' && sourceOrId.id) src = sourceOrId;
      else src = _getSourceById(String(sourceOrId || ''));
      if (!src) return false;
      src.config = src.config || {};
      const nextColor = _normalizeHexColor(color);
      const prevColor = _getSourceColorLabel(src);
      if (nextColor === prevColor) return false;
      if (nextColor) src.config.colorLabel = nextColor;
      else delete src.config.colorLabel;
      _updateSourceListColorLabel(src.id);
      if (opts.renderControls !== false && typeof renderControlsPanel === 'function') renderControlsPanel();
      if (_promixOpen) renderProMixer();
      if (opts.persist !== false) schedulePersistAppState();
      return true;
    }

    function _pickSourceCustomColorLabel(src) {
      if (!src) return;
      const current = _getSourceColorLabel(src);
      const input = window.prompt('Layer Color Label\nEnter a HEX color (#RRGGBB):', current || '#3b82f6');
      if (input == null) return;
      const normalized = _normalizeHexColor(input);
      if (!normalized) {
        if (typeof showToast === 'function') showToast('Invalid color. Use #RRGGBB or #RGB.');
        return;
      }
      const changed = _setSourceColorLabel(src, normalized, { persist: true });
      if (changed && typeof showToast === 'function') showToast(`Layer color set to ${normalized}.`);
    }

    function _renderSceneLayerContextMenu(kind, id) {
      const menu = _sceneLayerMenuEl();
      if (!menu) return;

      _sceneLayerSubmenus = Object.create(null);
      _sceneLayerActiveSubmenu = '';
      const rows = [];
      const pushSubmenuTrigger = (label, key, opts = {}) => {
        const extraClass = opts.className ? ` ${opts.className}` : '';
        const disabledAttr = opts.disabled ? ' disabled' : '';
        rows.push(
          `<button class="sl-ctx-item sl-ctx-submenu-trigger${extraClass}" data-submenu="${esc(key)}"${disabledAttr}>${esc(label)}<span class="sl-ctx-submenu-arrow">›</span></button>`
        );
      };
      if (kind === 'scene') {
        const sceneItem = _getScene(id);
        if (!sceneItem) return;
        rows.push('<div class="sl-ctx-group-title">Scene</div>');
        rows.push('<button class="sl-ctx-item" data-action="scene-switch">Switch to Scene</button>');
        rows.push('<button class="sl-ctx-item" data-action="scene-rename">Rename Scene</button>');
        rows.push('<button class="sl-ctx-item" data-action="scene-duplicate">Duplicate Scene</button>');
        rows.push('<button class="sl-ctx-item" data-action="scene-add">Add New Scene</button>');
        rows.push('<div class="sl-ctx-sep"></div>');
        rows.push('<div class="sl-ctx-group-title">Transform</div>');
        rows.push('<button class="sl-ctx-item" data-action="scene-transform-show">Show Scene Transform Controls</button>');
        rows.push('<button class="sl-ctx-item" data-action="scene-transform-reset">Reset Scene Transform</button>');
        rows.push('<div class="sl-ctx-sep"></div>');
        rows.push('<button class="sl-ctx-item" data-action="scene-move-up">Move Scene Up</button>');
        rows.push('<button class="sl-ctx-item" data-action="scene-move-down">Move Scene Down</button>');
        rows.push('<button class="sl-ctx-item danger" data-action="scene-delete">Delete Scene</button>');
      } else if (kind === 'source') {
        const src = _getSourceById(id);
        if (!src) return;
        const isLocked = src.transformLocked === true;
        const isTransitionableLayer = _isTransitionableLayerSourceType(src.type);
        const isAudioSource = _isAudioCapableSourceType(src.type);
        const activeColor = _getSourceColorLabel(src);
        rows.push('<div class="sl-ctx-group-title">Layer</div>');
        rows.push(`<button class="sl-ctx-item" data-action="source-visibility">${src.visible === false ? 'Show Layer' : 'Hide Layer'}</button>`);
        rows.push('<button class="sl-ctx-item" data-action="source-props">Layer Properties</button>');
        rows.push('<button class="sl-ctx-item" data-action="source-rename">Rename Layer</button>');
        rows.push('<button class="sl-ctx-item" data-action="source-fx">Open FX</button>');
        rows.push('<button class="sl-ctx-item" data-action="source-duplicate">Duplicate Layer</button>');
        rows.push('<button class="sl-ctx-item" data-action="source-add">Add New Layer</button>');
        rows.push('<div class="sl-ctx-sep"></div>');
        pushSubmenuTrigger('Change Color', 'source-color');
        _sceneLayerSubmenus['source-color'] = (() => {
          const colorRows = [];
          colorRows.push('<div class="sl-ctx-group-title">Change Color</div>');
          colorRows.push('<div class="sl-ctx-color-grid">');
          SOURCE_COLOR_LABEL_OPTIONS.forEach((opt) => {
            colorRows.push(_sourceColorSwatchHtml(opt.color, opt.label, _normalizeHexColor(opt.color) === activeColor));
          });
          colorRows.push('</div>');
          colorRows.push('<div class="sl-ctx-color-grid-actions">');
          colorRows.push('<button class="sl-ctx-item" data-action="source-color-custom">Custom…</button>');
          colorRows.push('</div>');
          return colorRows.join('');
        })();
        if (isAudioSource) {
          const modeLbl = _getSourceInputMode(src) === 'mono' ? 'Mono' : 'Stereo';
          const panLbl = _fmtPanLabel(_getSourcePan(src));
          const widthLbl = `${_getSourceWidth(src)}%`;
          const mode = _getSourceInputMode(src);
          pushSubmenuTrigger(`Audio (${modeLbl})`, 'source-audio');
          _sceneLayerSubmenus['source-audio'] = [
            '<div class="sl-ctx-group-title">Audio</div>',
            `<button class="sl-ctx-item${mode === 'mono' ? ' active' : ''}" data-action="source-input-mode-set" data-input-mode="mono">Mono${mode === 'mono' ? '<span class="sl-ctx-check">✓</span>' : ''}</button>`,
            `<button class="sl-ctx-item${mode === 'stereo' ? ' active' : ''}" data-action="source-input-mode-set" data-input-mode="stereo">Stereo${mode === 'stereo' ? '<span class="sl-ctx-check">✓</span>' : ''}</button>`,
            '<div class="sl-ctx-sep"></div>',
            `<button class="sl-ctx-item" data-action="source-pan">Set Pan… (${panLbl})</button>`,
            `<button class="sl-ctx-item" data-action="source-width">Set Width… (${widthLbl})</button>`,
            '<button class="sl-ctx-item" data-action="source-spatial-reset">Reset Pan/Width</button>'
          ].join('');
        }
        if (isTransitionableLayer) {
          const inType = _getSourceLayerTransitionType(src, 'in');
          const outType = _getSourceLayerTransitionType(src, 'out');
          const inDur = _getSourceLayerTransitionDurationMs(src, 'in');
          const outDur = _getSourceLayerTransitionDurationMs(src, 'out');
          const buildTransitionMenu = (kind, activeType, durationMs) => {
            const title = kind === 'out' ? 'Out Transition' : 'In Transition';
            const setAction = kind === 'out' ? 'source-transition-out-set' : 'source-transition-in-set';
            const inputAction = kind === 'out' ? 'source-transition-out-duration-input' : 'source-transition-in-duration-input';
            const stepAction = kind === 'out' ? 'source-transition-out-duration-step' : 'source-transition-in-duration-step';
            const options = [
              { id: 'none', label: 'None' },
              ...SOURCE_LAYER_TRANSITION_OPTIONS.filter((opt) => opt.id !== 'cut')
            ];
            const rowsT = [`<div class="sl-ctx-group-title">${title}</div>`];
            options.forEach((opt) => {
              const normalizedId = opt.id === 'none' ? 'cut' : opt.id;
              const isActive = normalizedId === activeType;
              rowsT.push(
                `<button class="sl-ctx-item${isActive ? ' active' : ''}" data-action="${setAction}" data-transition="${esc(opt.id)}">${esc(opt.label)}${isActive ? '<span class="sl-ctx-check">✓</span>' : ''}</button>`
              );
            });
            rowsT.push('<div class="sl-ctx-sep"></div>');
            rowsT.push('<div class="sl-ctx-duration-row">');
            rowsT.push(`<input class="sl-ctx-duration-input" type="number" min="50" max="5000" step="10" value="${durationMs}" data-action="${inputAction}" aria-label="${title} duration in milliseconds" title="Duration (ms)">`);
            rowsT.push(`<button class="sl-ctx-item sl-ctx-duration-step" data-action="${stepAction}" data-delta="-50" title="Decrease duration">-</button>`);
            rowsT.push(`<button class="sl-ctx-item sl-ctx-duration-step" data-action="${stepAction}" data-delta="50" title="Increase duration">+</button>`);
            rowsT.push('</div>');
            return rowsT.join('');
          };
          pushSubmenuTrigger('In Transition', 'source-transition-in-menu');
          _sceneLayerSubmenus['source-transition-in-menu'] = buildTransitionMenu('in', inType, inDur);
          pushSubmenuTrigger('Out Transition', 'source-transition-out-menu');
          _sceneLayerSubmenus['source-transition-out-menu'] = buildTransitionMenu('out', outType, outDur);
        }
        pushSubmenuTrigger('Transform', 'source-transform');
        _sceneLayerSubmenus['source-transform'] = [
          '<div class="sl-ctx-group-title">Transform</div>',
          '<button class="sl-ctx-item" data-action="source-transform-show">Show Transform Controls</button>',
          `<button class="sl-ctx-item" data-action="source-lock">${isLocked ? 'Unlock Transform' : 'Lock Transform'}</button>`,
          `<button class="sl-ctx-item" data-action="source-fit"${isLocked ? ' disabled' : ''}>Fit to Screen</button>`,
          `<button class="sl-ctx-item" data-action="source-stretch"${isLocked ? ' disabled' : ''}>Stretch to Screen</button>`,
          `<button class="sl-ctx-item" data-action="source-center"${isLocked ? ' disabled' : ''}>Center on Screen</button>`,
          `<button class="sl-ctx-item" data-action="source-transform-reset"${isLocked ? ' disabled' : ''}>Reset Transform</button>`,
          '<div class="sl-ctx-sep"></div>',
          `<button class="sl-ctx-item" data-action="source-flip-h"${isLocked ? ' disabled' : ''}>Flip Horizontal</button>`,
          `<button class="sl-ctx-item" data-action="source-flip-v"${isLocked ? ' disabled' : ''}>Flip Vertical</button>`,
          `<button class="sl-ctx-item" data-action="source-rotate-cw"${isLocked ? ' disabled' : ''}>Rotate 90° CW</button>`,
          `<button class="sl-ctx-item" data-action="source-rotate-ccw"${isLocked ? ' disabled' : ''}>Rotate 90° CCW</button>`
        ].join('');
        pushSubmenuTrigger('Order', 'source-order');
        _sceneLayerSubmenus['source-order'] = [
          '<div class="sl-ctx-group-title">Order</div>',
          '<button class="sl-ctx-item" data-action="source-move-up">Move Layer Up</button>',
          '<button class="sl-ctx-item" data-action="source-move-down">Move Layer Down</button>',
          '<button class="sl-ctx-item danger" data-action="source-delete">Delete Layer</button>'
        ].join('');
      }

      menu.innerHTML = rows.join('');
    }

    function openSceneLayerContextMenu(kind, id, x, y) {
      _renderSceneLayerContextMenu(kind, id);
      const menu = _sceneLayerMenuEl();
      if (!menu || !menu.innerHTML) return;
      _sceneLayerCtxState = { kind, id };
      menu.classList.add('open');
      menu.setAttribute('aria-hidden', 'false');
      _positionSceneLayerContextMenu(x, y);
    }

    function _handleSceneLayerContextAction(action, meta = {}) {
      const { kind, id } = _sceneLayerCtxState || {};
      if (!action || !kind || !id) return;
      let shouldCloseMenu = true;
      if (kind === 'scene') {
        const row = document.querySelector(`.scene-list-item[data-scene-id="${id}"]`);
        if (row) selectSceneEl(row);
        switch (action) {
          case 'scene-switch': switchToScene(id); break;
          case 'scene-rename': if (row) openSceneProperties(row); break;
          case 'scene-duplicate': duplicateSelectedScene(); break;
          case 'scene-add': openAddScenePopup(); break;
          case 'scene-transform-show': showSceneTransformControls(); break;
          case 'scene-transform-reset': resetActiveSceneTransform(); break;
          case 'scene-move-up': moveSelectedScene(-1); break;
          case 'scene-move-down': moveSelectedScene(1); break;
          case 'scene-delete': removeSelectedScene(); break;
        }
      } else if (kind === 'source') {
        const row = document.querySelector(`.source-list-item[data-source-id="${id}"]`);
        if (row) selectSourceItem(row);
        switch (action) {
          case 'source-visibility': {
            const src = _getSelectedSourceData();
            if (src) setSelectedSourceVisibility(src.visible === false);
            break;
          }
          case 'source-props': openSourceProperties(); break;
          case 'source-fx': {
            const src = _getSelectedSourceData();
            if (src) openSourceFxPopup(src.id);
            break;
          }
          case 'source-input-mode': {
            const src = _getSelectedSourceData();
            if (src) _pickSourceInputMode(src);
            break;
          }
          case 'source-input-mode-set': {
            const src = _getSelectedSourceData();
            const nextMode = String(meta.inputMode || '');
            if (src && (nextMode === 'mono' || nextMode === 'stereo')) {
              _setSourceInputMode(src, nextMode, { persist: true });
              shouldCloseMenu = false;
            }
            break;
          }
          case 'source-pan': {
            const src = _getSelectedSourceData();
            if (src) _pickSourcePan(src);
            break;
          }
          case 'source-width': {
            const src = _getSelectedSourceData();
            if (src) _pickSourceWidth(src);
            break;
          }
          case 'source-color-label': {
            const src = _getSelectedSourceData();
            if (src) {
              const changed = _setSourceColorLabel(src, String(meta.color || ''), { persist: true });
              if (changed && typeof showToast === 'function') {
                const next = _getSourceColorLabel(src);
                showToast(next ? `Layer color set to ${next}.` : 'Layer color reset.');
              }
            }
            break;
          }
          case 'source-color-custom': {
            const src = _getSelectedSourceData();
            if (src) _pickSourceCustomColorLabel(src);
            break;
          }
          case 'source-fit-mode': {
            const src = _getSelectedSourceData();
            if (src && _isFitModeCapableSourceType(src.type)) {
              const changed = _setSourceFitMode(src, String(meta.fitMode || 'contain'), { persist: true });
              if (changed && typeof showToast === 'function') {
                showToast(`Fit mode set to ${_sourceFitModeLabel(_getSourceFitMode(src))}.`);
              }
            }
            break;
          }
          case 'source-spatial-reset': {
            const src = _getSelectedSourceData();
            if (src && _isAudioCapableSourceType(src.type)) {
              _setSourcePanWidth(src, 0, 100, { persist: true });
              if (typeof showToast === 'function') showToast('Pan/Width reset.');
            }
            break;
          }
          case 'source-transition-in': {
            const src = _getSelectedSourceData();
            if (src) _pickSourceLayerTransitionType(src, 'in');
            break;
          }
          case 'source-transition-in-set': {
            const src = _getSelectedSourceData();
            if (src) _setSourceLayerTransitionType(src, 'in', String(meta.transition || 'cut'), { persist: true });
            shouldCloseMenu = false;
            break;
          }
          case 'source-transition-in-duration': {
            const src = _getSelectedSourceData();
            if (src) _pickSourceLayerTransitionDuration(src, 'in');
            break;
          }
          case 'source-transition-in-duration-input': {
            const src = _getSelectedSourceData();
            const raw = Number(meta.durationMs);
            if (src && Number.isFinite(raw)) {
              _setSourceLayerTransitionDuration(src, 'in', raw, { persist: true });
              shouldCloseMenu = false;
            }
            break;
          }
          case 'source-transition-in-duration-step': {
            const src = _getSelectedSourceData();
            if (src) {
              const delta = Number(meta.delta || 0);
              if (Number.isFinite(delta) && delta !== 0) {
                const next = _getSourceLayerTransitionDurationMs(src, 'in') + delta;
                _setSourceLayerTransitionDuration(src, 'in', next, { persist: true });
              }
            }
            shouldCloseMenu = false;
            break;
          }
          case 'source-transition-out': {
            const src = _getSelectedSourceData();
            if (src) _pickSourceLayerTransitionType(src, 'out');
            break;
          }
          case 'source-transition-out-set': {
            const src = _getSelectedSourceData();
            if (src) _setSourceLayerTransitionType(src, 'out', String(meta.transition || 'cut'), { persist: true });
            shouldCloseMenu = false;
            break;
          }
          case 'source-transition-out-duration': {
            const src = _getSelectedSourceData();
            if (src) _pickSourceLayerTransitionDuration(src, 'out');
            break;
          }
          case 'source-transition-out-duration-input': {
            const src = _getSelectedSourceData();
            const raw = Number(meta.durationMs);
            if (src && Number.isFinite(raw)) {
              _setSourceLayerTransitionDuration(src, 'out', raw, { persist: true });
              shouldCloseMenu = false;
            }
            break;
          }
          case 'source-transition-out-duration-step': {
            const src = _getSelectedSourceData();
            if (src) {
              const delta = Number(meta.delta || 0);
              if (Number.isFinite(delta) && delta !== 0) {
                const next = _getSourceLayerTransitionDurationMs(src, 'out') + delta;
                _setSourceLayerTransitionDuration(src, 'out', next, { persist: true });
              }
            }
            shouldCloseMenu = false;
            break;
          }
          case 'source-duplicate': duplicateSelectedSource(); break;
          case 'source-add': openAddSourcePopup(); break;
          case 'source-transform-show': showSelectedSourceTransformControls(); break;
          case 'source-lock': {
            const src = _getSelectedSourceData();
            if (src) setSelectedSourceTransformLock(!(src.transformLocked === true));
            break;
          }
          case 'source-transform-reset': resetSelectedSourceTransform(); break;
          case 'source-fit': fitSelectedSourceToScreen(); break;
          case 'source-stretch': stretchSelectedSourceToScreen(); break;
          case 'source-center': centerSelectedSourceOnScreen(); break;
          case 'source-flip-h': flipSelectedSourceHorizontal(); break;
          case 'source-flip-v': flipSelectedSourceVertical(); break;
          case 'source-rotate-cw': rotateSelectedSource90CW(); break;
          case 'source-rotate-ccw': rotateSelectedSource90CCW(); break;
          case 'source-rename': openSourceProperties(); break;
          case 'source-move-up': moveSelectedSource(-1); break;
          case 'source-move-down': moveSelectedSource(1); break;
          case 'source-delete': removeSelectedSource(); break;
        }
      }
      if (shouldCloseMenu) closeSceneLayerContextMenu();
    }

    function setupSceneLayerContextMenu() {
      const menu = _sceneLayerMenuEl();
      const submenu = _sceneLayerSubmenuEl();
      if (!menu || !submenu) return;
      if (menu.parentElement !== document.body) document.body.appendChild(menu);
      if (submenu.parentElement !== document.body) document.body.appendChild(submenu);
      if (menu.dataset.bound === '1') return;
      menu.dataset.bound = '1';
      submenu.dataset.bound = '1';

      const _findSceneLayerRows = (evt) => {
        const t = (evt.target && evt.target.nodeType === 1) ? evt.target : (evt.target && evt.target.parentElement);
        if (!t || typeof t.closest !== 'function') return { t: null, sourceRow: null, sceneRow: null };
        return {
          t,
          sourceRow: t.closest('#sources-list .source-list-item'),
          sceneRow: t.closest('#scene-list .scene-list-item')
        };
      };

      document.addEventListener('contextmenu', (e) => {
        const { t, sourceRow, sceneRow } = _findSceneLayerRows(e);
        if (!t) return;
        if (!sceneRow && !sourceRow) {
          const insideMenu = t.closest('#scene-layer-context-menu, #scene-layer-context-submenu');
          if (menu.classList.contains('open') && !insideMenu) closeSceneLayerContextMenu();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        closeSceneLayerContextMenu();
        if (sourceRow) {
          selectSourceItem(sourceRow);
          openSceneLayerContextMenu('source', sourceRow.dataset.sourceId, e.clientX, e.clientY);
          return;
        }
        if (sceneRow) {
          selectSceneEl(sceneRow);
          openSceneLayerContextMenu('scene', sceneRow.dataset.sceneId, e.clientX, e.clientY);
        }
      });

      document.addEventListener('mousedown', (e) => {
        // Fallback for environments where contextmenu can be suppressed.
        if (e.button === 2) {
          const { sourceRow, sceneRow } = _findSceneLayerRows(e);
          if (sourceRow || sceneRow) {
            e.preventDefault();
            e.stopPropagation();
            closeSceneLayerContextMenu();
            if (sourceRow) {
              selectSourceItem(sourceRow);
              openSceneLayerContextMenu('source', sourceRow.dataset.sourceId, e.clientX, e.clientY);
            } else if (sceneRow) {
              selectSceneEl(sceneRow);
              openSceneLayerContextMenu('scene', sceneRow.dataset.sceneId, e.clientX, e.clientY);
            }
            return;
          }
        }
        if (!menu.classList.contains('open')) return;
        if (e.button !== 0) return;
        const mt = (e.target && e.target.nodeType === 1) ? e.target : (e.target && e.target.parentElement);
        const insideMenu = mt && typeof mt.closest === 'function'
          ? mt.closest('#scene-layer-context-menu, #scene-layer-context-submenu')
          : null;
        if (!insideMenu) closeSceneLayerContextMenu();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSceneLayerContextMenu();
      });
      window.addEventListener('resize', closeSceneLayerContextMenu);
      window.addEventListener('scroll', (e) => {
        if (!menu.classList.contains('open')) return;
        const t = e && e.target;
        if (t && t.nodeType === 1 && (menu.contains(t) || submenu.contains(t))) return;
        closeSceneLayerContextMenu();
      }, true);

      const _onMenuInteraction = (e) => {
        const btn = e.target.closest('.sl-ctx-item');
        if (!btn || btn.disabled) return;
        const submenuKey = btn.dataset.submenu || '';
        if (submenuKey) {
          e.preventDefault();
          e.stopPropagation();
          _openSceneLayerSubmenu(submenuKey, btn);
          return;
        }
        const action = btn.dataset.action || '';
        if (!action) return;
        _handleSceneLayerContextAction(action, {
          color: btn.dataset.color || '',
          fitMode: btn.dataset.fitMode || '',
          transition: btn.dataset.transition || '',
          delta: btn.dataset.delta || '',
          inputMode: btn.dataset.inputMode || '',
          durationMs: btn.dataset.durationMs || ''
        });
      };

      const _applyDurationInputAction = (inputEl) => {
        if (!inputEl) return;
        const action = String(inputEl.dataset.action || '');
        if (!action) return;
        const val = Number(inputEl.value);
        if (!Number.isFinite(val)) return;
        const clamped = Math.max(50, Math.min(5000, Math.round(val)));
        inputEl.value = String(clamped);
        _handleSceneLayerContextAction(action, { durationMs: clamped });
      };

      menu.addEventListener('click', (e) => {
        _onMenuInteraction(e);
      });
      submenu.addEventListener('click', (e) => {
        _onMenuInteraction(e);
      });
      submenu.addEventListener('change', (e) => {
        const input = e.target.closest('.sl-ctx-duration-input');
        if (!input) return;
        _applyDurationInputAction(input);
      });
      submenu.addEventListener('keydown', (e) => {
        const input = e.target.closest('.sl-ctx-duration-input');
        if (!input) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          _applyDurationInputAction(input);
          input.blur();
        }
      });
      menu.addEventListener('mouseover', (e) => {
        const btn = e.target.closest('.sl-ctx-submenu-trigger');
        if (!btn || btn.disabled) return;
        const key = String(btn.dataset.submenu || '');
        if (!key || _sceneLayerActiveSubmenu === key) return;
        _openSceneLayerSubmenu(key, btn);
      });
      menu.addEventListener('mouseleave', (e) => {
        if (!_sceneLayerActiveSubmenu) return;
        const rt = e.relatedTarget;
        if (rt && typeof rt.closest === 'function' && rt.closest('#scene-layer-context-submenu')) return;
        window.setTimeout(() => {
          if (!submenu.matches(':hover') && !menu.matches(':hover')) closeSceneLayerSubmenu();
        }, 90);
      });
      submenu.addEventListener('mouseleave', () => {
        window.setTimeout(() => {
          if (!submenu.matches(':hover') && !menu.matches(':hover')) closeSceneLayerSubmenu();
        }, 90);
      });
    }

    // ---- Toggle visibility eye ----
    const _sourceVisibilityAnim = new Map();

    function _cancelSourceVisibilityAnim(sourceId) {
      const sid = String(sourceId || '');
      const active = _sourceVisibilityAnim.get(sid);
      if (active) {
        try { active.cancel(); } catch (_) {}
        _sourceVisibilityAnim.delete(sid);
      }
    }

    function _applySourceVisibilityTransition(layer, src, visible) {
      if (!layer) return;
      const sid = String(src?.id || layer.dataset?.srcId || '');
      if (sid) _cancelSourceVisibilityAnim(sid);
      const kind = visible ? 'in' : 'out';
      const type = _getSourceLayerTransitionType(src, kind);
      if (type === 'cut') {
        layer.style.opacity = '';
        layer.style.visibility = visible ? '' : 'hidden';
        layer.style.willChange = '';
        return;
      }
      const dur = _getSourceLayerTransitionDurationMs(src, kind);
      const baseTransform = layer.style.transform || '';
      const baseClipPath = layer.style.clipPath || 'inset(0 0 0 0)';
      const baseFilter = layer.style.filter || 'none';
      const buildState = (opts = {}) => {
        const tx = Number(opts.tx || 0);
        const ty = Number(opts.ty || 0);
        const scale = Number(opts.scale == null ? 1 : opts.scale);
        const opacity = Number(opts.opacity == null ? 1 : opts.opacity);
        const clipPath = typeof opts.clipPath === 'string' ? opts.clipPath : baseClipPath;
        const filter = typeof opts.filter === 'string' ? opts.filter : baseFilter;
        const transforms = [];
        if (baseTransform && baseTransform !== 'none') transforms.push(baseTransform);
        if (tx || ty) transforms.push(`translate(${tx}%, ${ty}%)`);
        if (scale !== 1) transforms.push(`scale(${scale})`);
        return {
          opacity,
          transform: transforms.length ? transforms.join(' ') : 'none',
          clipPath,
          filter
        };
      };

      const easingByType = (t, isIn) => {
        switch (t) {
          case 'luma-wipe': return isIn ? 'steps(18, end)' : 'steps(18, start)';
          case 'stinger': return isIn ? 'cubic-bezier(0.16, 1, 0.3, 1)' : 'cubic-bezier(0.7, 0, 0.84, 0)';
          case 'swipe': return isIn ? 'cubic-bezier(0.2, 0.9, 0.2, 1)' : 'cubic-bezier(0.7, 0, 1, 0.3)';
          default: return isIn ? 'cubic-bezier(0.22, 1, 0.36, 1)' : 'cubic-bezier(0.4, 0, 1, 1)';
        }
      };
      const states = (function() {
        switch (type) {
          case 'fade':
            return visible
              ? [buildState({ opacity: 0 }), buildState({ opacity: 1 })]
              : [buildState({ opacity: 1 }), buildState({ opacity: 0 })];
          case 'swipe':
            return visible
              ? [buildState({ opacity: 1, clipPath: 'inset(0 100% 0 0)' }), buildState({ opacity: 1, clipPath: 'inset(0 0 0 0)' })]
              : [buildState({ opacity: 1, clipPath: 'inset(0 0 0 0)' }), buildState({ opacity: 1, clipPath: 'inset(0 0 0 100%)' })];
          case 'slide':
            return visible
              ? [buildState({ tx: 16, opacity: 0 }), buildState({ tx: 0, opacity: 1 })]
              : [buildState({ tx: 0, opacity: 1 }), buildState({ tx: -16, opacity: 0 })];
          case 'stinger':
            return visible
              ? [buildState({ scale: 1.16, opacity: 0 }), buildState({ scale: 1, opacity: 1 })]
              : [buildState({ scale: 1, opacity: 1 }), buildState({ scale: 0.84, opacity: 0 })];
          case 'fade-to-colour':
            return visible
              ? [buildState({ opacity: 0, filter: 'brightness(0.1) saturate(0.85)' }), buildState({ opacity: 1, filter: 'brightness(1) saturate(1)' })]
              : [buildState({ opacity: 1, filter: 'brightness(1) saturate(1)' }), buildState({ opacity: 0, filter: 'brightness(0.08) saturate(0.7)' })];
          case 'luma-wipe':
            return visible
              ? [buildState({ opacity: 1, clipPath: 'inset(0 100% 0 0)', filter: 'contrast(1.28)' }), buildState({ opacity: 1, clipPath: 'inset(0 0 0 0)', filter: 'contrast(1)' })]
              : [buildState({ opacity: 1, clipPath: 'inset(0 0 0 0)', filter: 'contrast(1)' }), buildState({ opacity: 1, clipPath: 'inset(0 0 0 100%)', filter: 'contrast(1.28)' })];
          case 'user-shader':
            return visible
              ? [buildState({ scale: 1.06, opacity: 0 }), buildState({ scale: 1, opacity: 1 })]
              : [buildState({ scale: 1, opacity: 1 }), buildState({ scale: 0.94, opacity: 0 })];
          case 'slide-left':
            return visible
              ? [buildState({ tx: -18, opacity: 0 }), buildState({ tx: 0, opacity: 1 })]
              : [buildState({ tx: 0, opacity: 1 }), buildState({ tx: -18, opacity: 0 })];
          case 'slide-right':
            return visible
              ? [buildState({ tx: 18, opacity: 0 }), buildState({ tx: 0, opacity: 1 })]
              : [buildState({ tx: 0, opacity: 1 }), buildState({ tx: 18, opacity: 0 })];
          case 'slide-up':
            return visible
              ? [buildState({ ty: -18, opacity: 0 }), buildState({ ty: 0, opacity: 1 })]
              : [buildState({ ty: 0, opacity: 1 }), buildState({ ty: -18, opacity: 0 })];
          case 'slide-down':
            return visible
              ? [buildState({ ty: 18, opacity: 0 }), buildState({ ty: 0, opacity: 1 })]
              : [buildState({ ty: 0, opacity: 1 }), buildState({ ty: 18, opacity: 0 })];
          case 'zoom-in':
            return visible
              ? [buildState({ scale: 0.86, opacity: 0 }), buildState({ scale: 1, opacity: 1 })]
              : [buildState({ scale: 1, opacity: 1 }), buildState({ scale: 1.16, opacity: 0 })];
          case 'zoom-out':
            return visible
              ? [buildState({ scale: 1.16, opacity: 0 }), buildState({ scale: 1, opacity: 1 })]
              : [buildState({ scale: 1, opacity: 1 }), buildState({ scale: 0.86, opacity: 0 })];
          default:
            return visible
              ? [buildState({ opacity: 0 }), buildState({ opacity: 1 })]
              : [buildState({ opacity: 1 }), buildState({ opacity: 0 })];
        }
      })();

      layer.style.willChange = 'opacity, transform';
      if (visible) layer.style.visibility = '';
      const anim = layer.animate(
        states,
        {
          duration: dur,
          easing: easingByType(type, !!visible),
          fill: 'forwards'
        }
      );
      if (sid) _sourceVisibilityAnim.set(sid, anim);
      anim.onfinish = () => {
        if (!visible) layer.style.visibility = 'hidden';
        layer.style.opacity = '';
        layer.style.transform = baseTransform;
        layer.style.clipPath = baseClipPath === 'inset(0 0 0 0)' ? '' : baseClipPath;
        layer.style.filter = baseFilter === 'none' ? '' : baseFilter;
        layer.style.willChange = '';
        if (sid) _sourceVisibilityAnim.delete(sid);
      };
      anim.oncancel = () => {
        layer.style.opacity = '';
        layer.style.transform = baseTransform;
        layer.style.clipPath = baseClipPath === 'inset(0 0 0 0)' ? '' : baseClipPath;
        layer.style.filter = baseFilter === 'none' ? '' : baseFilter;
        layer.style.willChange = '';
        if (sid) _sourceVisibilityAnim.delete(sid);
      };
    }

    function _setSourceVisibilityImmediate(sourceId, visible) {
      const sid = String(sourceId || '');
      if (!sid) return;
      const layer = document.querySelector(`#source-compositor .src-layer[data-src-id="${sid}"]`);
      if (!layer) {
        renderProgramDisplay();
        return;
      }
      const scene = _activeScene();
      const src = scene ? scene.sources.find((s) => s.id === sid) : null;
      _applySourceVisibilityTransition(layer, src, !!visible);
      if (visible && src) {
        if (src.type === 'camera') {
          const existing = _activeStreams[sid];
          if (!existing || !existing.active) _startCameraStream(sid, src.config?.deviceId, src.config);
        } else if (src.type === 'audio-input') {
          // Reuse existing stream if it's still alive — instant resume.
          // Only open a fresh getUserMedia if the old stream died.
          const existingAudio = _activeStreams[sid];
          if (existingAudio && existingAudio.active && existingAudio.getAudioTracks().length) {
            if (!_isSourceUsingSharedAudioInput(sid) && !_findSharedAudioPoolByStream(existingAudio)) {
              existingAudio.getAudioTracks().forEach(t => { try { t.enabled = true; } catch (_) {} });
            }
            _ctrlHydrateSourceState(sid);
            _ctrlApplyMuteToStream(sid, existingAudio);
            renderControlsPanel();
          } else {
            _startAudioInputStream(sid, src.config?.deviceId);
          }
        } else if (src.type === 'media-source') {
          _pgmMediaSetLayerVisible(src, true);
        } else if (src.type === 'window-capture') {
          const existingWc = _windowCaptureStreams[sid];
          if (!existingWc || !existingWc.active) {
            _startWindowCapture(sid, src.config?.windowId, { captureCursor: src.config?.captureCursor !== false });
          }
        } else if (src.type === 'ndi') {
          const existingNdi = _activeStreams[sid];
          const ndiVidEl = document.getElementById('ndi-video-' + sid);
          const ndiImgEl = document.getElementById('ndi-img-' + sid);
          const ndiInfoEl = document.getElementById('ndi-info-' + sid);
          const bridgeSt = _ndiBridgeState[sid];
          const hasBridgeRenderer = !!(bridgeSt && bridgeSt.renderer && bridgeSt.renderer._running);
          const hasVideoStream = !!(existingNdi && existingNdi.active && existingNdi.getVideoTracks && existingNdi.getVideoTracks().length);

          if (hasVideoStream) {
            // Active video stream — attach to <video>, hide bridge canvas.
            if (ndiVidEl) {
              if (!ndiVidEl.srcObject || ndiVidEl.srcObject !== existingNdi) {
                ndiVidEl.srcObject = existingNdi;
              }
              ndiVidEl.style.display = 'block';
              ndiVidEl.play().catch(() => {});
              if (ndiInfoEl) ndiInfoEl.style.display = 'none';
            }
            // Always hide bridge canvas when using video stream path
            // to prevent a stale/blank canvas from covering the feed.
            if (ndiImgEl) ndiImgEl.style.display = 'none';
          } else if (hasBridgeRenderer) {
            // No camera stream but bridge renderer is alive — use bridge canvas.
            if (ndiImgEl) ndiImgEl.style.display = 'block';
            if (ndiVidEl) ndiVidEl.style.display = 'none';
            if (ndiInfoEl) ndiInfoEl.style.display = 'none';
          } else {
            // No active stream and no bridge — reconnect from scratch.
            if (ndiVidEl) _tryNdiVirtualCamera(sid, ndiVidEl, ndiInfoEl, src.config);
            // Also hide canvas to prevent blank canvas covering video
            if (ndiImgEl) ndiImgEl.style.display = 'none';
          }
          // Resume or restart NDI audio if enabled
          if (src.config?.ndiAudioEnabled !== false) {
            if (!_resumeNdiAudioStream(sid, src.config)) {
              _startNdiAudioStream(sid, src.config);
            }
          }
        }
      } else {
        _ctrlStopMeter(sid);
        _pgmDisconnectSource(sid);
        if (src && src.type === 'media-source') _pgmMediaSetLayerVisible(src, false);
        if (src && src.type === 'window-capture') _stopWindowCapture(sid);
        if (src && src.type === 'ndi') _suspendNdiAudioStream(sid);
        // For audio-input: disable tracks but keep stream alive for instant resume
        if (src && src.type === 'audio-input') {
          const audioStream = _activeStreams[sid];
          if (audioStream && audioStream.active && !_isSourceUsingSharedAudioInput(sid) && !_findSharedAudioPoolByStream(audioStream)) {
            audioStream.getAudioTracks().forEach(t => { try { t.enabled = false; } catch (_) {} });
          }
        }
      }

      _pgmSyncSources();
      queueStandaloneSyncBurst();
      syncLsProjectionPreview();
      _pgmMediaUpdateUi();
      _updateTransformOverlay();
    }

    function toggleVisibility(eyeSvg) {
      const isHidden = eyeSvg.dataset.hidden === '1';
      eyeSvg.dataset.hidden = isHidden ? '0' : '1';
      eyeSvg.classList.toggle('hidden', !isHidden);
      eyeSvg.style.opacity = isHidden ? '0.5' : '0.2';
      const item = eyeSvg.closest('.scene-list-item,.source-list-item');
      if (item) {
        item.style.opacity = isHidden ? '1' : '0.45';
        item.dataset.hidden = isHidden ? '0' : '1';
        // Update source data model
        if (item.dataset.sourceId) {
          const scene = _activeScene();
          if (scene) {
            const src = scene.sources.find(s => s.id === item.dataset.sourceId);
            if (src) src.visible = isHidden;
            // If toggling a media-source back on, clear the stopped state
            if (isHidden && src && src.type === 'media-source') {
              _pgmMediaCtrlState.stopped = false;
            }
          }
          _setSourceVisibilityImmediate(item.dataset.sourceId, !!isHidden);
          renderControlsPanel();
        }
        schedulePersistAppState();
      }
    }

    function makeVisibilityEyeSvg(hidden) {
      const isHidden = !!hidden;
      const eyeClass = isHidden ? 'sli-eye hidden' : 'sli-eye';
      const eyeOpacity = isHidden ? '0.2' : '0.5';
      const hiddenFlag = isHidden ? '1' : '0';
      return `<svg class="${eyeClass}" data-hidden="${hiddenFlag}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" onclick="event.stopPropagation();toggleVisibility(this)" style="opacity:${eyeOpacity}"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line class="eye-slash" x1="3" y1="21" x2="21" y2="3"/></svg>`;
    }

    // ---- Drag-to-reorder ----
    let _dragEl = null;
    function setupDrag(el, listId) {
      el.addEventListener('dragstart', e => {
        _dragEl = el;
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        _dragEl = null;
        document.querySelectorAll('#' + listId + ' > *').forEach(c => c.style.borderTop = '');
        // Sync data model after drag
        if (listId === 'sources-list') { saveCurrentSourceOrder(); renderProgramDisplay(); }
        schedulePersistAppState();
      });
      el.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (_dragEl && _dragEl !== el) {
          el.style.borderTop = '2px solid #4a86ff';
        }
      });
      el.addEventListener('dragleave', () => {
        el.style.borderTop = '';
      });
      el.addEventListener('drop', e => {
        e.preventDefault();
        el.style.borderTop = '';
        if (_dragEl && _dragEl !== el) {
          const list = document.getElementById(listId);
          list.insertBefore(_dragEl, el);
        }
      });
    }

    // ---- Initialize default scene ----
    // Scene init is handled by applyLoadedState (persistence) or initDefaultScene fallback
    let _scenesInitialized = false;
    function initDefaultScene() {
      if (_scenesInitialized) return;
      _scenesInitialized = true;
      if (_scenes.length === 0) {
        createScene('Scene 1');
      }
    }
    // Defer: don't create default scene immediately — let persistence restore first.
    // If bootApp hasn't run within 3s, create default as fallback.
    setTimeout(() => { if (!_scenesInitialized) initDefaultScene(); }, 3000);

    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    /* ---- Activity-bar gear popup helpers ---- */
    function toggleAbSettingsPopup(e) {
      if (e) e.stopPropagation();
      const popup = document.getElementById('ab-settings-popup');
      const backdrop = document.getElementById('ab-settings-backdrop');
      const isOpen = popup.classList.contains('open');
      if (isOpen) {
        closeAbSettingsPopup();
      } else {
        // populate language submenu from main settings
        populateLanguageSelect();
        buildAbLangSubmenu();
        // sync active theme indicator
        const currentTheme = document.getElementById('theme-select')?.value || 'skyline';
        syncActiveThemeIndicator(currentTheme);
        popup.classList.add('open');
        backdrop.classList.add('open');
      }
    }
    function closeAbSettingsPopup() {
      const popup = document.getElementById('ab-settings-popup');
      const backdrop = document.getElementById('ab-settings-backdrop');
      if (popup) popup.classList.remove('open');
      if (backdrop) backdrop.classList.remove('open');
    }
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest('#dual-version-primary-btn') || t.closest('#dual-version-secondary-btn')) return;
      if (t.closest('#dual-version-primary-menu') || t.closest('#dual-version-secondary-menu')) return;
      closeDualVersionMenus();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDualVersionMenus();
    });

    // ---- App Page Navigation ----
    let currentAppPage = 'projection';
    function _isProjectionLivePair(a, b) {
      return false;
    }

    function _resetKeepMountedPageStyle(el) {
      if (!el) return;
      el.style.position = '';
      el.style.left = '';
      el.style.top = '';
      el.style.width = '';
      el.style.height = '';
      el.style.visibility = '';
      el.style.pointerEvents = '';
      el.style.zIndex = '';
      el.style.display = '';
      delete el.dataset.keepMountedHidden;
    }

    function _keepPageMountedHidden(el) {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      el.style.display = 'flex';
      el.style.position = 'fixed';
      el.style.left = `${Math.round(rect.left)}px`;
      el.style.top = `${Math.round(rect.top)}px`;
      el.style.width = `${Math.max(1, Math.round(rect.width))}px`;
      el.style.height = `${Math.max(1, Math.round(rect.height))}px`;
      el.style.visibility = 'hidden';
      el.style.pointerEvents = 'none';
      el.style.zIndex = '0';
      el.dataset.keepMountedHidden = '1';
    }

    function renderFooterBibleVersionPopover() {
      const pop = document.getElementById('footer-bible-version-popover');
      if (!pop) return;
      pop.innerHTML = '';
      const verKeys = Object.keys(bibles || {});
      if (!verKeys.length) {
        const empty = document.createElement('div');
        empty.className = 'footer-bv-empty';
        empty.textContent = 'No Bible versions loaded';
        pop.appendChild(empty);
        return;
      }
      const list = document.createElement('div');
      list.className = 'footer-bv-list';
      const searchWrap = document.createElement('div');
      searchWrap.className = 'footer-bv-search';
      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.placeholder = t('ui_search_generic');
      searchInput.autocomplete = 'off';
      searchInput.setAttribute('aria-label', t('ui_search_generic'));
      searchWrap.appendChild(searchInput);
      list.appendChild(searchWrap);
      const itemRows = [];
      verKeys.forEach((ver) => {
        const isPrimaryActive = activeBibleVersion === ver;
        const isSecondaryActive = !!(dualVersionModeEnabled && dualVersionSecondaryId === ver);
        const markerClass = (isPrimaryActive || isSecondaryActive) ? ' marked' : '';
        const wrapper = document.createElement('div');
        wrapper.className = `footer-bv-item ${isPrimaryActive ? 'active' : ''}${markerClass}`;
        wrapper.dataset.searchLabel = normalizeSearchText(ver);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'footer-bv-btn';
        const flags = [];
        if (isPrimaryActive && dualVersionModeEnabled && dualVersionSecondaryId) {
          flags.push('<span class="footer-bv-flag primary" title="Primary">1</span>');
        } else if (isPrimaryActive) {
          flags.push('<span class="footer-bv-flag primary" title="Active">✓</span>');
        }
        if (isSecondaryActive) {
          flags.push('<span class="footer-bv-flag secondary" title="Secondary">2</span>');
        }
        btn.innerHTML = `
          <svg class="footer-bv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          <span class="footer-bv-name">${esc(ver)}</span>
          <span class="footer-bv-flags">${flags.join('')}</span>
        `;
        btn.onclick = () => {
          changeActiveBibleVersion(ver);
          toggleFooterBibleVersionPopover(false);
        };
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'footer-bv-del';
        del.title = `Delete ${ver}`;
        del.setAttribute('aria-label', `Delete ${ver}`);
        del.textContent = '×';
        del.onclick = (e) => {
          e.stopPropagation();
          showConfirm(
            'Delete Bible Version',
            `Remove "${ver}" from imported Bible versions?`,
            () => {
              delete bibles[ver];
              clearBibleSearchCache(ver);
              if (activeBibleVersion === ver) {
                const remaining = Object.keys(bibles).filter(name => name !== ver);
                activeBibleVersion = remaining.length ? remaining[0] : null;
              }
              idbDelete(STORE_BIBLES, ver).catch(() => {});
              saveState();
              saveToStorageDebounced();
              renderVersionBar();
              renderSongs();
              updateBibleLists();
              if (isLive) scheduleLiveUpdate();
              renderFooterBibleVersionPopover();
            }
          );
        };
        wrapper.appendChild(btn);
        wrapper.appendChild(del);
        itemRows.push(wrapper);
        list.appendChild(wrapper);
      });
      searchInput.addEventListener('input', () => {
        const q = normalizeSearchText(searchInput.value || '').trim();
        itemRows.forEach(row => {
          const label = row.dataset.searchLabel || '';
          row.style.display = !q || label.includes(q) ? '' : 'none';
        });
      });
      pop.appendChild(list);
      requestAnimationFrame(() => {
        try { searchInput.focus(); } catch (_) {}
      });
    }

    function positionFooterBibleVersionPopover() {
      const btn = document.getElementById('footer-bible-version-btn');
      const pop = document.getElementById('footer-bible-version-popover');
      if (!btn || !pop || !footerBibleVersionPopoverOpen) return;
      const btnRect = btn.getBoundingClientRect();
      pop.style.left = '10px';
      pop.style.top = '10px';
      const popRect = pop.getBoundingClientRect();
      const margin = 8;
      const left = Math.max(margin, Math.min(btnRect.left, window.innerWidth - popRect.width - margin));
      const top = Math.max(margin, btnRect.top - popRect.height - 6);
      pop.style.left = Math.round(left) + 'px';
      pop.style.top = Math.round(top) + 'px';
    }

    function positionAutoLyricsModal() {
      const modal = document.getElementById('autoLyricsModal');
      if (!modal || modal.style.display !== 'flex') return;
      const content = modal.querySelector('.modal-content');
      if (!content) return;
      const mainAnchorBtn = document.getElementById('main-get-lyrics-btn');
      const footerAnchorBtn = document.getElementById('footer-auto-lyrics-btn');
      const anchorBtn = (mainAnchorBtn && mainAnchorBtn.style.display !== 'none')
        ? mainAnchorBtn
        : footerAnchorBtn;
      const margin = 10;
      const anchorGap = 16;
      content.style.left = `${margin}px`;
      content.style.top = `${margin}px`;
      const contentRect = content.getBoundingClientRect();
      const anchorRect = anchorBtn
        ? anchorBtn.getBoundingClientRect()
        : { left: window.innerWidth * 0.5, width: 0, top: window.innerHeight - margin, bottom: window.innerHeight - margin };
      let left = anchorRect.left + ((anchorRect.width || 0) - contentRect.width) / 2;
      left = Math.max(margin, Math.min(left, window.innerWidth - contentRect.width - margin));
      let top = anchorRect.top - contentRect.height - anchorGap;
      if (top < margin) top = anchorRect.bottom + anchorGap;
      if (top + contentRect.height > window.innerHeight - margin) {
        top = Math.max(margin, window.innerHeight - contentRect.height - margin);
      }
      content.style.left = `${Math.round(left)}px`;
      content.style.top = `${Math.round(top)}px`;
    }

    function toggleFooterBibleVersionPopover(forceOpen) {
      const pop = document.getElementById('footer-bible-version-popover');
      if (!pop) return;
      const nextOpen = (typeof forceOpen === 'boolean') ? forceOpen : !footerBibleVersionPopoverOpen;
      footerBibleVersionPopoverOpen = nextOpen;
      pop.classList.toggle('open', nextOpen);
      pop.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');
      if (!nextOpen) return;
      renderFooterBibleVersionPopover();
      requestAnimationFrame(positionFooterBibleVersionPopover);
    }

    function setupFooterBibleVersionPopover() {
      const btn = document.getElementById('footer-bible-version-btn');
      const pop = document.getElementById('footer-bible-version-popover');
      if (!btn || !pop || btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      if (!btn.hasAttribute('onclick')) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleFooterBibleVersionPopover();
        });
      }
      document.addEventListener('click', (e) => {
        if (!footerBibleVersionPopoverOpen) return;
        const t = e.target;
        if (!(t instanceof Element)) return;
        if (t.closest('#footer-bible-version-popover') || t.closest('#footer-bible-version-btn')) return;
        toggleFooterBibleVersionPopover(false);
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && footerBibleVersionPopoverOpen) {
          toggleFooterBibleVersionPopover(false);
        }
      });
      window.addEventListener('resize', () => {
        if (footerBibleVersionPopoverOpen) positionFooterBibleVersionPopover();
      });
      window.addEventListener('scroll', () => {
        if (footerBibleVersionPopoverOpen) positionFooterBibleVersionPopover();
      }, true);
    }

    /* ═══════════════════════════════════════════
       Record Page — Multi-Instance System
       ═══════════════════════════════════════════ */

    // ── Multi-instance infrastructure ──
    const _recInstances = new Map();
    let _recNextIid = 0;
    let _recNextZOrder = 100;
    const _recDeviceCache = { inputs: [], outputs: [] };
    let _recDraggingIid = null;
    const _recLinks = new Set();
    let _recLinkDrag = null;
    let _recSelectedLinkKey = '';
    const _REC_FX_PRESET_STORAGE_KEY = 'record.fx.presets.v1';
    const REC_AUDIO_FX_LIBRARY = [
      { type: 'air', label: 'Air Boost' },
      { type: 'channel-eq', label: 'Channel EQ' },
      { type: 'chorus', label: 'Chorus' },
      { type: 'compressor', label: 'Compressor' },
      { type: 'pro-compressor', label: 'Pro Compressor' },
      { type: 'de-esser', label: 'De-esser' },
      { type: 'delay', label: 'Delay' },
      { type: 'denoiser', label: 'Denoiser' },
      { type: 'distortion', label: 'Distortion' },
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
    let _recFxUserPresets = [];
