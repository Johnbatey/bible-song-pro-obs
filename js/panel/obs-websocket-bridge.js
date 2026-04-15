    // =============================================================
    // BibleRhythm AGL — OBS WebSocket v5 Bridge (P2 #13)
    // =============================================================
    //
    // Minimal obs-websocket v5 client so the panel can trigger OBS
    // scene changes and hotkeys from inside the dock.  Implements:
    //
    //   * Hello (op=0) → Identify (op=1) → Identified (op=2) handshake
    //     with optional SHA-256 authentication (Web Crypto)
    //   * Request (op=6) / RequestResponse (op=7)
    //   * Scene change via SetCurrentProgramScene
    //   * Hotkey trigger via TriggerHotkeyByName
    //   * Scene list discovery via GetSceneList
    //
    // Per-setlist-item scene trigger: the config holds a sceneMap
    // keyed by `${livePointer.kind}:${livePointer.index}`.  A 2-second
    // poller observes livePointer changes and switches OBS scenes
    // when an entry is mapped.  Deduped against same-pointer flaps.
    //
    // Loaded after command-bus.js.
    // =============================================================

    // ----- Constants & state -----------------------------------------------

    const BSP_OBSWS_VERSION = 1;
    const BSP_OBSWS_CONFIG_KEY = 'obsWebSocketConfig';
    const BSP_OBSWS_DEFAULT_PORT = 4455;
    const BSP_OBSWS_POLL_MS = 2000;
    const BSP_OBSWS_DEDUPE_MS = 5000;

    let bspObsWsInitialized = false;
    let bspObsWsConfig = {
      enabled: false,
      host: '127.0.0.1',
      port: BSP_OBSWS_DEFAULT_PORT,
      password: '',
      autoConnect: true,
      sceneMap: {}
    };
    let bspObsWsSocket = null;
    let bspObsWsConnState = 'disconnected'; // disconnected | connecting | connected | error
    let bspObsWsLastError = '';
    let bspObsWsScenes = []; // array of scene names
    let bspObsWsPollTimer = null;
    let bspObsWsLastPointerKey = null;
    let bspObsWsLastPointerAt = 0;
    let bspObsWsPending = Object.create(null); // requestId → {resolve, reject}
    let bspObsWsButtonEl = null;
    let bspObsWsModalEl = null;

    // ----- Crypto helper ----------------------------------------------------
    //
    // obs-websocket v5 auth:
    //   base64(sha256(base64(sha256(password + salt)) + challenge))

    function bspObsWsSha256Base64(input) {
      if (!window.crypto || !window.crypto.subtle) {
        return Promise.reject(new Error('Web Crypto API unavailable'));
      }
      const data = new TextEncoder().encode(String(input));
      return window.crypto.subtle.digest('SHA-256', data).then(function (buf) {
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.length; i += 1) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      });
    }

    function bspObsWsComputeAuth(password, salt, challenge) {
      return bspObsWsSha256Base64(password + salt).then(function (innerB64) {
        return bspObsWsSha256Base64(innerB64 + challenge);
      });
    }

    // ----- WebSocket lifecycle ---------------------------------------------

    function bspObsWsConnect() {
      if (typeof WebSocket !== 'function') {
        bspObsWsConnState = 'error';
        bspObsWsLastError = 'WebSocket unavailable';
        bspObsWsRefreshButton();
        return;
      }
      bspObsWsDisconnect();
      const url = 'ws://' + String(bspObsWsConfig.host || '127.0.0.1') + ':' + String(bspObsWsConfig.port || BSP_OBSWS_DEFAULT_PORT);
      bspObsWsConnState = 'connecting';
      bspObsWsLastError = '';
      bspObsWsRefreshButton();
      try {
        bspObsWsSocket = new WebSocket(url, 'obswebsocket.json');
      } catch (err) {
        try {
          // Some OBS builds reject the subprotocol param — retry without it.
          bspObsWsSocket = new WebSocket(url);
        } catch (err2) {
          bspObsWsConnState = 'error';
          bspObsWsLastError = (err2 && err2.message) || String(err2);
          bspObsWsRefreshButton();
          return;
        }
      }
      bspObsWsSocket.onopen = function () {
        // Wait for Hello (op=0) before identifying.
      };
      bspObsWsSocket.onmessage = function (ev) {
        let msg;
        try { msg = JSON.parse(ev.data); } catch (_) { return; }
        bspObsWsHandleMessage(msg);
      };
      bspObsWsSocket.onerror = function () {
        bspObsWsConnState = 'error';
        bspObsWsLastError = 'WebSocket error';
        bspObsWsRefreshButton();
      };
      bspObsWsSocket.onclose = function () {
        bspObsWsConnState = 'disconnected';
        bspObsWsRefreshButton();
        // Reject any pending requests.
        Object.keys(bspObsWsPending).forEach(function (id) {
          try { bspObsWsPending[id].reject(new Error('socket closed')); } catch (_) {}
          delete bspObsWsPending[id];
        });
      };
    }

    function bspObsWsDisconnect() {
      if (bspObsWsSocket) {
        try { bspObsWsSocket.close(); } catch (_) {}
      }
      bspObsWsSocket = null;
      bspObsWsConnState = 'disconnected';
      bspObsWsRefreshButton();
    }

    function bspObsWsIsConnected() {
      return bspObsWsConnState === 'connected';
    }

    // ----- Protocol message dispatch ---------------------------------------

    function bspObsWsHandleMessage(msg) {
      if (!msg || typeof msg.op !== 'number') return;
      if (msg.op === 0) {
        // Hello — authenticate if required, then send Identify.
        const d = msg.d || {};
        const auth = d.authentication;
        if (auth && auth.challenge && auth.salt) {
          bspObsWsComputeAuth(bspObsWsConfig.password || '', auth.salt, auth.challenge)
            .then(function (digest) {
              bspObsWsSend({ op: 1, d: { rpcVersion: 1, authentication: digest, eventSubscriptions: 0 } });
            })
            .catch(function (err) {
              bspObsWsConnState = 'error';
              bspObsWsLastError = 'Auth failed: ' + (err && err.message);
              bspObsWsRefreshButton();
            });
        } else {
          bspObsWsSend({ op: 1, d: { rpcVersion: 1, eventSubscriptions: 0 } });
        }
        return;
      }
      if (msg.op === 2) {
        // Identified.
        bspObsWsConnState = 'connected';
        bspObsWsLastError = '';
        bspObsWsRefreshButton();
        if (typeof showToast === 'function') showToast('OBS WebSocket connected');
        // Fetch scene list so the config modal can populate immediately.
        bspObsWsRequest('GetSceneList').then(function (data) {
          const scenes = (data && data.scenes) || [];
          bspObsWsScenes = scenes.map(function (s) { return s.sceneName; }).filter(Boolean);
          bspObsWsRenderModalIfOpen();
        }).catch(function () {});
        return;
      }
      if (msg.op === 7) {
        // RequestResponse
        const d = msg.d || {};
        const rid = d.requestId;
        if (!rid || !bspObsWsPending[rid]) return;
        const entry = bspObsWsPending[rid];
        delete bspObsWsPending[rid];
        if (d.requestStatus && d.requestStatus.result) {
          entry.resolve(d.responseData || {});
        } else {
          entry.reject(new Error((d.requestStatus && d.requestStatus.comment) || 'Request failed'));
        }
        return;
      }
      // op=5 (Event) ignored for v1 — we don't subscribe.
    }

    function bspObsWsSend(obj) {
      if (!bspObsWsSocket || bspObsWsSocket.readyState !== 1) return false;
      try { bspObsWsSocket.send(JSON.stringify(obj)); return true; }
      catch (_) { return false; }
    }

    function bspObsWsRequest(requestType, requestData) {
      if (!bspObsWsIsConnected()) {
        return Promise.reject(new Error('OBS WebSocket not connected'));
      }
      const requestId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const payload = { op: 6, d: { requestType: String(requestType), requestId: requestId, requestData: requestData || {} } };
      return new Promise(function (resolve, reject) {
        bspObsWsPending[requestId] = { resolve: resolve, reject: reject };
        bspObsWsSend(payload);
        // Time out after 6 seconds.
        setTimeout(function () {
          if (bspObsWsPending[requestId]) {
            delete bspObsWsPending[requestId];
            reject(new Error('Request timeout: ' + requestType));
          }
        }, 6000);
      });
    }

    function bspObsWsTriggerScene(sceneName) {
      if (!sceneName) return Promise.reject(new Error('No scene name'));
      return bspObsWsRequest('SetCurrentProgramScene', { sceneName: String(sceneName) });
    }

    function bspObsWsTriggerHotkey(hotkeyName) {
      if (!hotkeyName) return Promise.reject(new Error('No hotkey name'));
      return bspObsWsRequest('TriggerHotkeyByName', { hotkeyName: String(hotkeyName) });
    }

    function bspObsWsListScenes() {
      if (bspObsWsScenes.length) return Promise.resolve(bspObsWsScenes.slice());
      return bspObsWsRequest('GetSceneList').then(function (data) {
        const scenes = (data && data.scenes) || [];
        bspObsWsScenes = scenes.map(function (s) { return s.sceneName; }).filter(Boolean);
        return bspObsWsScenes.slice();
      });
    }

    // ----- Config persistence ---------------------------------------------

    function bspObsWsLoadConfig() {
      if (typeof idbGet !== 'function') return Promise.resolve();
      return idbGet(STORE_STATE, BSP_OBSWS_CONFIG_KEY).then(function (entry) {
        if (entry && entry.value && typeof entry.value === 'object') {
          bspObsWsConfig = Object.assign(bspObsWsConfig, entry.value);
          if (!bspObsWsConfig.sceneMap || typeof bspObsWsConfig.sceneMap !== 'object') {
            bspObsWsConfig.sceneMap = {};
          }
        }
      }).catch(function () {});
    }

    function bspObsWsSaveConfig() {
      if (typeof idbPut !== 'function') return Promise.resolve();
      // NOTE: password is stored plaintext in IndexedDB. Acceptable for a
      // local tool but documented — never sync this record to a remote relay.
      return idbPut(STORE_STATE, {
        key: BSP_OBSWS_CONFIG_KEY,
        value: bspObsWsConfig,
        updatedAt: Date.now()
      }).catch(function () {});
    }

    function bspObsWsSetConfig(next) {
      if (!next || typeof next !== 'object') return;
      bspObsWsConfig = Object.assign(bspObsWsConfig, next);
      if (!bspObsWsConfig.sceneMap) bspObsWsConfig.sceneMap = {};
      bspObsWsSaveConfig();
    }

    function bspObsWsGetConfig() {
      return Object.assign({}, bspObsWsConfig, { sceneMap: Object.assign({}, bspObsWsConfig.sceneMap) });
    }

    function bspObsWsSetSceneForEntry(scheduleKey, sceneName) {
      if (!scheduleKey) return;
      if (sceneName) {
        bspObsWsConfig.sceneMap[scheduleKey] = String(sceneName);
      } else {
        delete bspObsWsConfig.sceneMap[scheduleKey];
      }
      bspObsWsSaveConfig();
    }

    // ----- Live pointer poller --------------------------------------------

    function bspObsWsStartPoller() {
      if (bspObsWsPollTimer) return;
      bspObsWsPollTimer = setInterval(bspObsWsTickPoller, BSP_OBSWS_POLL_MS);
    }

    function bspObsWsTickPoller() {
      try {
        if (!bspObsWsIsConnected()) return;
        if (typeof isLive === 'undefined' || !isLive) return;
        if (typeof livePointer === 'undefined' || !livePointer) return;
        const key = (livePointer.kind || 'unknown') + ':' + (livePointer.index != null ? livePointer.index : '');
        const now = Date.now();
        if (key === bspObsWsLastPointerKey && now - bspObsWsLastPointerAt < BSP_OBSWS_DEDUPE_MS) return;
        bspObsWsLastPointerKey = key;
        bspObsWsLastPointerAt = now;
        const sceneName = bspObsWsConfig.sceneMap[key];
        if (sceneName) {
          bspObsWsTriggerScene(sceneName).catch(function () {});
        }
      } catch (_) { /* never throw from ticker */ }
    }

    // ----- Config modal UI ------------------------------------------------

    function bspObsWsInjectStyles() {
      if (document.getElementById('bsp-obsws-styles')) return;
      const css = `
        #bsp-obsws-modal {
          background: #12151d;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 14px;
          padding: 20px 22px;
          width: min(640px, 94vw);
          max-height: 86vh;
          display: flex;
          flex-direction: column;
          color: #e8eaed;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          box-shadow: 0 24px 60px rgba(0,0,0,0.55);
        }
        #bsp-obsws-modal h2 { margin: 0 0 6px 0; font-size: 18px; font-weight: 700; }
        #bsp-obsws-modal .bsp-obsws-sub { margin: 0 0 14px 0; font-size: 12px; color: #9aa0a6; }
        #bsp-obsws-modal .bsp-obsws-grid {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 8px 12px;
          margin-bottom: 14px;
          padding: 12px 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          align-items: center;
        }
        #bsp-obsws-modal .bsp-obsws-grid label {
          font-size: 11px;
          color: #9aa0a6;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        #bsp-obsws-modal .bsp-obsws-grid input[type="text"],
        #bsp-obsws-modal .bsp-obsws-grid input[type="number"],
        #bsp-obsws-modal .bsp-obsws-grid input[type="password"] {
          background: #0a0d14;
          border: 1px solid rgba(255,255,255,0.12);
          color: #e8eaed;
          border-radius: 6px;
          padding: 7px 10px;
          font-size: 12px;
          width: 100%;
        }
        #bsp-obsws-modal .bsp-obsws-grid input[type="checkbox"] {
          transform: scale(1.2);
        }
        #bsp-obsws-modal .bsp-obsws-status {
          font-size: 12px;
          margin-bottom: 10px;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.08);
        }
        #bsp-obsws-modal .bsp-obsws-status[data-state="connected"] { background: rgba(61,220,132,0.08); color: #80ffb6; border-color: #175a34; }
        #bsp-obsws-modal .bsp-obsws-status[data-state="connecting"] { background: rgba(255,182,77,0.08); color: #ffd580; border-color: #5a4217; }
        #bsp-obsws-modal .bsp-obsws-status[data-state="error"] { background: rgba(255,82,82,0.08); color: #ffb3b3; border-color: #5a1717; }
        #bsp-obsws-modal .bsp-obsws-status[data-state="disconnected"] { color: #9aa0a6; }
        #bsp-obsws-modal .bsp-obsws-scenes {
          flex: 1 1 auto;
          overflow: auto;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          background: rgba(0,0,0,0.2);
          padding: 6px;
          margin-bottom: 12px;
          min-height: 120px;
        }
        #bsp-obsws-modal .bsp-obsws-scene-row {
          display: flex;
          gap: 6px;
          padding: 6px;
          border-radius: 6px;
          align-items: center;
        }
        #bsp-obsws-modal .bsp-obsws-scene-row:hover { background: rgba(255,255,255,0.03); }
        #bsp-obsws-modal .bsp-obsws-scene-name {
          flex: 1 1 auto;
          font-size: 12px;
          font-family: ui-monospace, Menlo, monospace;
        }
        #bsp-obsws-modal .bsp-obsws-warn {
          font-size: 10px;
          color: #ffd580;
          margin-top: 8px;
        }
        #bsp-obsws-modal .bsp-obsws-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
      `;
      const style = document.createElement('style');
      style.id = 'bsp-obsws-styles';
      style.textContent = css;
      document.head.appendChild(style);
    }

    function bspObsWsOpenConfigModal() {
      bspObsWsInjectStyles();
      const existing = document.getElementById('bsp-sr-modal-backdrop');
      if (existing) existing.remove();
      const backdrop = document.createElement('div');
      backdrop.id = 'bsp-sr-modal-backdrop';
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) backdrop.remove();
      });
      const modal = document.createElement('div');
      modal.id = 'bsp-obsws-modal';
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);
      bspObsWsModalEl = modal;
      bspObsWsRenderModal();
    }

    function bspObsWsRenderModal() {
      const modal = bspObsWsModalEl;
      if (!modal) return;
      modal.innerHTML = '';
      const title = document.createElement('h2');
      title.textContent = 'OBS WebSocket';
      modal.appendChild(title);
      const sub = document.createElement('p');
      sub.className = 'bsp-obsws-sub';
      sub.textContent = 'Connects to OBS Studio via obs-websocket v5. Enable in OBS → Tools → WebSocket Server Settings.';
      modal.appendChild(sub);

      // Connection settings
      const grid = document.createElement('div');
      grid.className = 'bsp-obsws-grid';
      const mk = function (lbl, input) {
        const l = document.createElement('label');
        l.textContent = lbl;
        grid.appendChild(l);
        grid.appendChild(input);
      };
      const enableInput = document.createElement('input');
      enableInput.type = 'checkbox';
      enableInput.checked = !!bspObsWsConfig.enabled;
      mk('Enabled', enableInput);
      const hostInput = document.createElement('input');
      hostInput.type = 'text';
      hostInput.value = String(bspObsWsConfig.host || '127.0.0.1');
      mk('Host', hostInput);
      const portInput = document.createElement('input');
      portInput.type = 'number';
      portInput.value = String(bspObsWsConfig.port || BSP_OBSWS_DEFAULT_PORT);
      mk('Port', portInput);
      const pwInput = document.createElement('input');
      pwInput.type = 'password';
      pwInput.value = String(bspObsWsConfig.password || '');
      pwInput.placeholder = 'leave blank if disabled';
      mk('Password', pwInput);
      const autoInput = document.createElement('input');
      autoInput.type = 'checkbox';
      autoInput.checked = !!bspObsWsConfig.autoConnect;
      mk('Auto-connect on start', autoInput);
      modal.appendChild(grid);

      // Status
      const status = document.createElement('div');
      status.className = 'bsp-obsws-status';
      status.dataset.state = bspObsWsConnState;
      const statusLabel = {
        disconnected: 'Disconnected',
        connecting: 'Connecting…',
        connected: 'Connected — ' + bspObsWsScenes.length + ' scene' + (bspObsWsScenes.length === 1 ? '' : 's') + ' loaded',
        error: 'Error: ' + (bspObsWsLastError || 'unknown')
      };
      status.textContent = statusLabel[bspObsWsConnState] || bspObsWsConnState;
      modal.appendChild(status);

      // Scene list for test trigger
      const scenesTitle = document.createElement('div');
      scenesTitle.style.cssText = 'font-size:11px;color:#9aa0a6;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;';
      scenesTitle.textContent = 'Available scenes (click to test)';
      modal.appendChild(scenesTitle);
      const wrap = document.createElement('div');
      wrap.className = 'bsp-obsws-scenes';
      modal.appendChild(wrap);
      if (!bspObsWsScenes.length) {
        const empty = document.createElement('div');
        empty.style.cssText = 'padding:12px;text-align:center;color:#9aa0a6;font-size:12px;';
        empty.textContent = bspObsWsIsConnected() ? 'No scenes returned.' : 'Connect to list scenes.';
        wrap.appendChild(empty);
      } else {
        bspObsWsScenes.forEach(function (name) {
          const row = document.createElement('div');
          row.className = 'bsp-obsws-scene-row';
          const lbl = document.createElement('div');
          lbl.className = 'bsp-obsws-scene-name';
          lbl.textContent = name;
          row.appendChild(lbl);
          const test = document.createElement('button');
          test.type = 'button';
          test.className = 'bsp-sr-btn';
          test.style.cssText = 'font-size:10px;padding:4px 8px;';
          test.textContent = 'Test';
          test.addEventListener('click', function () {
            bspObsWsTriggerScene(name).then(function () {
              if (typeof showToast === 'function') showToast('OBS scene → ' + name);
            }).catch(function (err) {
              if (typeof showToast === 'function') showToast('Test failed: ' + (err && err.message));
            });
          });
          row.appendChild(test);
          wrap.appendChild(row);
        });
      }

      const warn = document.createElement('div');
      warn.className = 'bsp-obsws-warn';
      warn.textContent = '⚠ Password stored locally in IndexedDB. Safe for a single workstation; do not share the user profile.';
      modal.appendChild(warn);

      // Actions
      const actions = document.createElement('div');
      actions.className = 'bsp-obsws-actions';
      const disconnectBtn = document.createElement('button');
      disconnectBtn.type = 'button';
      disconnectBtn.className = 'bsp-sr-btn';
      disconnectBtn.textContent = 'Disconnect';
      disconnectBtn.disabled = !bspObsWsIsConnected();
      disconnectBtn.addEventListener('click', function () {
        bspObsWsDisconnect();
        bspObsWsRenderModal();
      });
      actions.appendChild(disconnectBtn);
      const connectBtn = document.createElement('button');
      connectBtn.type = 'button';
      connectBtn.className = 'bsp-sr-btn bsp-sr-btn-accent';
      connectBtn.textContent = 'Save & Connect';
      connectBtn.addEventListener('click', function () {
        bspObsWsSetConfig({
          enabled: enableInput.checked,
          host: hostInput.value.trim() || '127.0.0.1',
          port: Number(portInput.value) || BSP_OBSWS_DEFAULT_PORT,
          password: pwInput.value,
          autoConnect: autoInput.checked
        });
        if (enableInput.checked) {
          bspObsWsConnect();
        } else {
          bspObsWsDisconnect();
        }
        setTimeout(bspObsWsRenderModal, 400);
      });
      actions.appendChild(connectBtn);
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'bsp-sr-btn';
      closeBtn.textContent = 'Close';
      closeBtn.addEventListener('click', function () {
        const bd = document.getElementById('bsp-sr-modal-backdrop');
        if (bd) bd.remove();
      });
      actions.appendChild(closeBtn);
      modal.appendChild(actions);
    }

    function bspObsWsRenderModalIfOpen() {
      if (document.getElementById('bsp-obsws-modal')) bspObsWsRenderModal();
    }

    // ----- Panic bar button + init ----------------------------------------

    function bspObsWsRefreshButton() {
      if (!bspObsWsButtonEl) return;
      const labels = {
        disconnected: 'OBS: Off',
        connecting: 'OBS: …',
        connected: 'OBS: On',
        error: 'OBS: Err'
      };
      bspObsWsButtonEl.textContent = labels[bspObsWsConnState] || ('OBS: ' + bspObsWsConnState);
      bspObsWsButtonEl.classList.remove('bsp-sr-btn-accent', 'bsp-sr-btn-warn', 'bsp-sr-btn-danger');
      if (bspObsWsConnState === 'connected') bspObsWsButtonEl.classList.add('bsp-sr-btn-accent');
      if (bspObsWsConnState === 'error') bspObsWsButtonEl.classList.add('bsp-sr-btn-danger');
    }

    function bspObsWsInstallPanicBarButton() {
      if (bspObsWsButtonEl) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bsp-sr-btn';
      btn.textContent = 'OBS: Off';
      btn.title = 'OBS WebSocket bridge';
      btn.addEventListener('click', bspObsWsOpenConfigModal);
      const panicBar = document.getElementById('bsp-sr-panic-bar');
      if (panicBar) {
        const endBtn = document.getElementById('bsp-sr-end-service');
        if (endBtn && endBtn.parentNode === panicBar) {
          panicBar.insertBefore(btn, endBtn);
        } else {
          panicBar.appendChild(btn);
        }
      } else {
        btn.style.cssText =
          'position:fixed;top:8px;right:250px;z-index:9500;' +
          'background:#1b1f2a;color:#e8eaed;border:1px solid rgba(255,255,255,0.18);' +
          'padding:6px 10px;border-radius:6px;font:600 12px -apple-system,sans-serif;cursor:pointer;';
        document.body.appendChild(btn);
      }
      bspObsWsButtonEl = btn;
    }

    function bspObsWsInit() {
      if (bspObsWsInitialized) return;
      bspObsWsInitialized = true;
      bspObsWsLoadConfig().then(function () {
        bspObsWsInstallPanicBarButton();
        bspObsWsRefreshButton();
        if (bspObsWsConfig.enabled && bspObsWsConfig.autoConnect) {
          bspObsWsConnect();
        }
        bspObsWsStartPoller();

        // Register OBS commands on the command bus if available.
        if (window.BSPCommands && typeof window.BSPCommands.register === 'function') {
          window.BSPCommands.register('obs.connect', {
            label: 'OBS: Connect',
            category: 'obs',
            run: function () { bspObsWsConnect(); }
          });
          window.BSPCommands.register('obs.disconnect', {
            label: 'OBS: Disconnect',
            category: 'obs',
            run: function () { bspObsWsDisconnect(); }
          });
          window.BSPCommands.register('obs.openConfig', {
            label: 'OBS: Open config',
            category: 'obs',
            run: function () { bspObsWsOpenConfigModal(); }
          });
        }
      }).catch(function (err) {
        try { console.error('[BSP OBS WS] init failed', err); } catch (_) {}
      });
    }

    window.BSPObsWs = {
      version: BSP_OBSWS_VERSION,
      init: bspObsWsInit,
      connect: bspObsWsConnect,
      disconnect: bspObsWsDisconnect,
      isConnected: bspObsWsIsConnected,
      setConfig: bspObsWsSetConfig,
      getConfig: bspObsWsGetConfig,
      setSceneForEntry: bspObsWsSetSceneForEntry,
      triggerScene: bspObsWsTriggerScene,
      triggerHotkey: bspObsWsTriggerHotkey,
      listScenes: bspObsWsListScenes,
      openConfigModal: bspObsWsOpenConfigModal
    };

    window.addEventListener('load', function () {
      const start = Date.now();
      const wait = setInterval(function () {
        const ready = (typeof stateReady !== 'undefined' && stateReady);
        if (ready || Date.now() - start > 8000) {
          clearInterval(wait);
          bspObsWsInit();
        }
      }, 100);
    });

    // =============================================================
    // END OF FILE — BibleRhythm AGL OBS WebSocket Bridge
    // =============================================================
