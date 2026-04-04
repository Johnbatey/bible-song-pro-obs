    function remoteShowLog(event, details) {
      const ts = new Date().toISOString();
      const line = `[${ts}] ${event}${details ? ` | ${details}` : ''}`;
      remoteShowDebugLog.push(line);
      if (remoteShowDebugLog.length > 100) remoteShowDebugLog.shift();
      console.log('[RemoteShow]', event, details || '');
      const logEl = document.getElementById('remote-show-debug-log');
      if (logEl) logEl.textContent = remoteShowDebugLog.slice(-25).join('\n') || 'No events yet.';
    }

    function normalizePairCode(raw) {
      const cleaned = String(raw || '').replace(/[^0-9a-zA-Z]/g, '').slice(0, 32).toUpperCase();
      return cleaned;
    }

    function generatePairCode() {
      const randomSix = String(Math.floor(100000 + Math.random() * 900000));
      return randomSix.slice(0, REMOTE_SHOW_PAIR_CODE_LENGTH);
    }

    function ensureRemoteShowCredentials() {
      const pairCodeInput = document.getElementById('remote-show-pair-code');
      if (!pairCodeInput) return;
      let code = normalizePairCode(pairCodeInput.value);
      if (!code) code = generatePairCode();
      pairCodeInput.value = code;
      remoteShowSessionId = `session_${code.toLowerCase()}`;
    }

    function getRemoteShowPairCode() {
      ensureRemoteShowCredentials();
      const value = document.getElementById('remote-show-pair-code')?.value || '';
      return normalizePairCode(value);
    }

    function setRemoteShowConnectionState(nextState, reason = '') {
      remoteShowConnectionState = nextState;
      if (reason) remoteShowLastError = reason;
      if (nextState === 'connected') remoteShowLastError = '';
      const map = {
        idle: 'disabled',
        resolving: 'connecting',
        connecting: 'connecting',
        connected: 'connected',
        degraded: 'error',
        error: 'error'
      };
      relayStatus = map[nextState] || 'disconnected';
      updateRelayUi();
      const stateEl = document.getElementById('remote-show-conn-state');
      if (stateEl) stateEl.textContent = nextState;
      const errEl = document.getElementById('remote-show-last-error');
      if (errEl) errEl.textContent = remoteShowLastError || 'None';
    }

    function parsePort(value, fallback) {
      const n = Number(String(value || '').trim());
      if (!Number.isInteger(n) || n < 1 || n > 65535) return String(fallback);
      return String(n);
    }

    function getHttpPort() {
      const inputVal = document.getElementById('remote-show-port')?.value;
      const pagePort = window.location.port || '';
      return parsePort(inputVal || pagePort, REMOTE_SHOW_DEFAULT_PORT);
    }

    function getRelayPort() {
      const inputVal = document.getElementById('remote-show-relay-port')?.value;
      const pagePort = window.location.port || '';
      return parsePort(inputVal || pagePort, RELAY_DEFAULT_PORT);
    }

    function resolveNonLocalhostHostname() {
      const host = String(window.location.hostname || '').trim();
      if (!host || isLocalhostHost(host)) return '';
      return host;
    }

    function resolveShareUrlHost() {
      const manualHost = String(document.getElementById('remote-show-host')?.value || '').trim();
      if (manualHost) return manualHost;
      if (remoteShowDetectedIp) return remoteShowDetectedIp;
      return resolveNonLocalhostHostname();
    }

    function resolveRelayHost() {
      const manualRelayHost = String(document.getElementById('remote-show-relay-host')?.value || '').trim();
      if (manualRelayHost) return manualRelayHost;
      const manualShareHost = String(document.getElementById('remote-show-host')?.value || '').trim();
      if (manualShareHost) return manualShareHost;
      if (remoteShowDetectedIp) return remoteShowDetectedIp;
      return resolveNonLocalhostHostname();
    }

    function openRemoteShowModal() {
      ensureRemoteShowCredentials();
      detectRemoteShowIp();
      syncRemoteShowHostMode();
      updateRemoteShowDetails();
      connectRelay();
      openModal('remoteShowModal');
    }

    function handleRemoteShowInput() {
      ensureRemoteShowCredentials();
      updateRemoteShowDetails();
      reconnectRelay();
      saveToStorageDebounced();
    }

    function handleRemoteShowHostMode() {
      syncRemoteShowHostMode();
      updateRemoteShowDetails();
      reconnectRelay();
      saveToStorageDebounced();
    }

    function syncRemoteShowHostMode() {
      const useHostname = document.getElementById('remote-show-use-hostname')?.checked;
      const hostInput = document.getElementById('remote-show-host');
      if (hostInput) hostInput.disabled = !!useHostname;
      if (!useHostname && hostInput && !hostInput.value && remoteShowDetectedIp) {
        hostInput.value = remoteShowDetectedIp;
      }
      const portInput = document.getElementById('remote-show-port');
      if (portInput && !portInput.value) {
        portInput.value = getHttpPort();
      }
      const relayPortInput = document.getElementById('remote-show-relay-port');
      if (relayPortInput && !relayPortInput.value) {
        relayPortInput.value = getRelayPort();
      }
    }

    function buildRelayUrl() {
      const protocol = (window.location.protocol === 'https:') ? 'wss:' : 'ws:';
      const host = resolveRelayHost();
      const port = getRelayPort();
      if (!host || !port) return '';
      return `${protocol}//${host}:${port}`;
    }

    function isLocalhostHost(host) {
      return !host || host === 'localhost' || host === '127.0.0.1';
    }

    function isIpv4Address(value) {
      if (!value || !/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return false;
      return value.split('.').every((part) => {
        const num = Number(part);
        return Number.isInteger(num) && num >= 0 && num <= 255;
      });
    }

    function updateRemoteShowDetectedUi() {
      const valueEl = document.getElementById('remote-show-detected-value');
      const useBtn = document.querySelector('#remote-show-detected button');
      if (!valueEl) return;
      if (remoteShowDetectedIp) {
        valueEl.textContent = remoteShowDetectedIp;
        if (useBtn) useBtn.disabled = false;
      } else if (remoteShowDetecting) {
        valueEl.textContent = 'Detecting...';
        if (useBtn) useBtn.disabled = true;
      } else {
        valueEl.textContent = 'Not detected';
        if (useBtn) useBtn.disabled = true;
      }
    }

    function detectRemoteShowIp() {
      if (remoteShowDetecting || remoteShowDetectedIp) {
        updateRemoteShowDetectedUi();
        return;
      }
      const host = window.location.hostname || '';
      if (host && !isLocalhostHost(host) && isIpv4Address(host)) {
        remoteShowDetectedIp = host;
        updateRemoteShowDetectedUi();
        updateRemoteShowDetails();
        connectRelay();
        return;
      }
      if (!window.RTCPeerConnection) {
        updateRemoteShowDetectedUi();
        return;
      }
      remoteShowDetecting = true;
      updateRemoteShowDetectedUi();
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pc.createDataChannel('remote-show');
      const closePc = () => {
        remoteShowDetecting = false;
        try { pc.close(); } catch (e) {}
        updateRemoteShowDetectedUi();
        updateRemoteShowDetails();
      };
      pc.onicecandidate = (event) => {
        const candidate = event.candidate && event.candidate.candidate;
        if (!candidate) return;
        const match = candidate.match(/(?:\d{1,3}\.){3}\d{1,3}/);
        if (match && isIpv4Address(match[0])) {
          remoteShowDetectedIp = match[0];
          closePc();
          connectRelay();
        }
      };
      pc.createOffer().then((offer) => pc.setLocalDescription(offer)).catch(() => {
        closePc();
      });
      setTimeout(() => {
        if (!remoteShowDetectedIp) closePc();
      }, 2500);
    }

    function applyDetectedRemoteShowIp() {
      if (!remoteShowDetectedIp) return;
      const useHostname = document.getElementById('remote-show-use-hostname');
      if (useHostname) useHostname.checked = false;
      const hostInput = document.getElementById('remote-show-host');
      if (hostInput) hostInput.value = remoteShowDetectedIp;
      syncRemoteShowHostMode();
      updateRemoteShowDetails();
      reconnectRelay();
      saveToStorageDebounced();
    }

    function buildRemoteShowUrl() {
      const isFile = window.location.protocol === 'file:';
      const protocol = isFile ? 'http:' : (window.location.protocol || 'http:');
      let path = window.location.pathname || '/';
      if (isFile) {
        const parts = path.split('/');
        const file = parts[parts.length - 1] || '';
        path = file ? `/${file}` : '/';
      }
      const search = window.location.search || '';
      const hash = window.location.hash || '';
      const host = resolveShareUrlHost();
      if (!host) return '';
      const port = getHttpPort();
      const portSegment = port ? `:${port}` : '';
      return `${protocol}//${host}${portSegment}${path}${search}${hash}`;
    }

    function buildRemoteShowQrPrimaryUrl(url) {
      return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(url)}`;
    }

    function buildRemoteShowQrFallbackUrl(url) {
      return `https://quickchart.io/qr?size=220&margin=0&text=${encodeURIComponent(url)}`;
    }

    function updateRemoteShowQr(url, qrImg, qrBox) {
      if (!qrImg || !qrBox) return;
      if (!url) {
        qrImg.removeAttribute('src');
        qrImg.removeAttribute('data-qr-fallback');
        qrImg.alt = 'RemoteShow QR';
        qrBox.classList.add('is-empty');
        qrBox.title = '';
        return;
      }

      const primary = buildRemoteShowQrPrimaryUrl(url);
      const fallback = buildRemoteShowQrFallbackUrl(url);
      qrImg.alt = 'RemoteShow QR';
      qrImg.setAttribute('referrerpolicy', 'no-referrer');
      qrImg.setAttribute('crossorigin', 'anonymous');
      qrImg.onload = () => {
        qrBox.classList.remove('is-empty');
        qrBox.title = url;
      };
      qrImg.onerror = () => {
        const hasFallback = qrImg.getAttribute('data-qr-fallback') === '1';
        if (!hasFallback) {
          qrImg.setAttribute('data-qr-fallback', '1');
          qrImg.src = fallback;
          return;
        }
        qrImg.removeAttribute('src');
        qrImg.removeAttribute('data-qr-fallback');
        qrBox.classList.add('is-empty');
        qrBox.title = 'Unable to load QR image. Copy URL instead.';
      };
      qrImg.setAttribute('data-qr-fallback', '0');
      qrImg.src = primary;
    }

    function copyRemoteShowRelayUrl() {
      const url = buildRelayUrl();
      if (!url) {
        showToast(t('remote_show_relay_url_unavailable'));
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          showToast(t('remote_show_relay_url_copied'));
        }).catch(() => {
          fallbackCopyRemoteShowUrl(url, 'remote-show-relay-url', t('remote_show_relay_url_copied'));
        });
        return;
      }
      fallbackCopyRemoteShowUrl(url, 'remote-show-relay-url', t('remote_show_relay_url_copied'));
    }

    function getRemoteShowRetryLabel() {
      if (!relayReconnectTimer || !remoteShowRetryNextAt) return 'Idle';
      const remaining = Math.max(0, Math.ceil((remoteShowRetryNextAt - Date.now()) / 1000));
      return `Retry in ${remaining}s (attempt ${remoteShowRetryAttempt})`;
    }

    function updateRemoteShowStatusPanel() {
      const resolvedEl = document.getElementById('remote-show-resolved');
      const heartbeatEl = document.getElementById('remote-show-heartbeat');
      const retryEl = document.getElementById('remote-show-retry');
      const relayUrlInput = document.getElementById('remote-show-relay-url');
      const relayCopyBtn = document.getElementById('remote-show-copy-relay-btn');
      const shareHost = resolveShareUrlHost();
      const relayHost = resolveRelayHost();
      const httpPort = getHttpPort();
      const relayPort = getRelayPort();
      remoteShowResolved = { shareUrlHost: shareHost, relayHost, httpPort, relayPort };
      if (resolvedEl) {
        const sharePart = shareHost ? `${shareHost}:${httpPort}` : '-';
        const relayPart = relayHost ? `${relayHost}:${relayPort}` : '-';
        resolvedEl.textContent = `Share: ${sharePart} | Relay: ${relayPart}`;
      }
      const relayUrlText = buildRelayUrl();
      if (relayUrlInput) relayUrlInput.value = relayUrlText;
      if (relayCopyBtn) relayCopyBtn.disabled = !relayUrlText;
      if (heartbeatEl) {
        heartbeatEl.textContent = remoteShowLastHeartbeatAt
          ? new Date(remoteShowLastHeartbeatAt).toLocaleTimeString()
          : 'Never';
      }
      if (retryEl) retryEl.textContent = getRemoteShowRetryLabel();
    }

    function updateRelayUi() {
      const el = document.getElementById('remote-show-relay-value');
      const wrap = document.getElementById('remote-show-relay-status');
      if (!el) return;
      const labels = {
        idle: 'Idle',
        resolving: 'Resolving',
        connecting: 'Connecting...',
        connected: 'Connected',
        degraded: 'Degraded',
        error: 'Error'
      };
      el.textContent = labels[remoteShowConnectionState] || 'Idle';
      if (wrap) wrap.title = relayUrl || '';
      updateRemoteShowStatusPanel();
    }

    function startRemoteShowUiTicker() {
      if (remoteShowUiTickTimer) return;
      remoteShowUiTickTimer = setInterval(() => {
        updateRemoteShowStatusPanel();
      }, 1000);
    }

    function stopRemoteShowUiTicker() {
      if (!remoteShowUiTickTimer) return;
      clearInterval(remoteShowUiTickTimer);
      remoteShowUiTickTimer = null;
    }

    function disconnectRelay(opts = {}) {
      const markIdle = !!opts.markIdle;
      const reason = opts.reason || '';
      if (relayReconnectTimer) {
        clearTimeout(relayReconnectTimer);
        relayReconnectTimer = null;
      }
      if (remoteShowHeartbeatTimer) {
        clearInterval(remoteShowHeartbeatTimer);
        remoteShowHeartbeatTimer = null;
      }
      remoteShowPendingPingAt = 0;
      if (relaySocket) {
        try { relaySocket.onopen = null; relaySocket.onclose = null; relaySocket.onerror = null; relaySocket.onmessage = null; } catch (_) {}
        try { relaySocket.close(); } catch (e) {}
      }
      relaySocket = null;
      relayUrl = '';
      if (markIdle) {
        setRemoteShowConnectionState('idle', reason);
        stopRemoteShowUiTicker();
      }
      updateRelayUi();
    }

    function scheduleRelayReconnect(reason = '') {
      if (relayReconnectTimer) return;
      remoteShowRetryAttempt += 1;
      const baseDelay = Math.min(1000 * Math.pow(2, Math.max(0, remoteShowRetryAttempt - 1)), 30000);
      const jitterFactor = 0.85 + (Math.random() * 0.3);
      const delay = Math.round(baseDelay * jitterFactor);
      remoteShowRetryNextAt = Date.now() + delay;
      setRemoteShowConnectionState('degraded', reason || 'Retrying relay connection');
      remoteShowLog('reconnect_scheduled', `${delay}ms`);
      relayReconnectTimer = setTimeout(() => {
        relayReconnectTimer = null;
        connectRelay();
      }, delay);
      updateRelayUi();
    }

    function relayNormalizeInbound(raw) {
      if (!raw || typeof raw !== 'object') return null;
      let payload = raw;
      let envelope = null;
      if (raw.type === 'RS_ENVELOPE') {
        envelope = raw;
        const ver = Number(raw.version || 0);
        if (!Number.isFinite(ver) || ver < 1) {
          remoteShowLog('envelope_rejected', 'Invalid protocol version');
          return null;
        }
        if (!raw.payload || typeof raw.payload !== 'object') return null;
        const pairCode = getRemoteShowPairCode();
        const token = normalizePairCode(raw.token || '');
        if (pairCode && token && pairCode !== token) {
          remoteShowLog('envelope_rejected', 'Pair code mismatch');
          return null;
        }
        if (raw.sessionId && raw.sessionId !== remoteShowSessionId) {
          remoteShowLog('envelope_rejected', 'Session mismatch');
          return null;
        }
        if (raw.senderId && raw.senderId === relayClientId) return null;
        payload = raw.payload;
      }
      if (!payload || typeof payload !== 'object') return null;
      if (typeof payload.type !== 'string' || !payload.type) return null;
      const ts = Number((envelope && envelope.ts) || payload.ts || 0);
      const typeKey = payload.type;
      const lastTs = Number(remoteShowLastSeenTsByType[typeKey] || 0);
      if (ts && lastTs && ts < lastTs) {
        remoteShowLog('stale_rejected', `${typeKey}@${ts} < ${lastTs}`);
        return null;
      }
      if (ts) remoteShowLastSeenTsByType[typeKey] = ts;
      payload.__remoteMeta = {
        viaRelay: true,
        senderId: envelope ? envelope.senderId : '',
        sessionId: envelope ? envelope.sessionId : '',
        ts
      };
      return payload;
    }

    function relaySend(msg) {
      if (!relaySocket || relaySocket.readyState !== WebSocket.OPEN) return false;
      if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return false;
      const envelope = {
        type: 'RS_ENVELOPE',
        version: REMOTE_SHOW_PROTOCOL_VERSION,
        senderId: relayClientId,
        sessionId: remoteShowSessionId,
        token: getRemoteShowPairCode(),
        ts: Date.now(),
        payload: msg
      };
      try {
        relaySocket.send(JSON.stringify(envelope));
        return true;
      } catch (e) {
        remoteShowLog('send_error', e && e.message ? e.message : 'send failed');
        return false;
      }
    }

    function sendRemoteShowHeartbeat() {
      if (!relaySocket || relaySocket.readyState !== WebSocket.OPEN) return;
      const now = Date.now();
      if (remoteShowPendingPingAt && (now - remoteShowPendingPingAt > remoteShowHeartbeatTimeoutMs)) {
        remoteShowLog('heartbeat_timeout', `${now - remoteShowPendingPingAt}ms`);
        setRemoteShowConnectionState('degraded', 'Heartbeat timeout');
        try { relaySocket.close(); } catch (_) {}
        return;
      }
      remoteShowPendingPingAt = now;
      relaySend({ type: 'PING', ts: now });
    }

    function startRemoteShowHeartbeat() {
      if (remoteShowHeartbeatTimer) clearInterval(remoteShowHeartbeatTimer);
      remoteShowHeartbeatTimer = setInterval(sendRemoteShowHeartbeat, remoteShowHeartbeatIntervalMs);
      sendRemoteShowHeartbeat();
    }

    function reconnectRelay() {
      remoteShowRetryAttempt = 0;
      remoteShowRetryNextAt = 0;
      disconnectRelay();
      connectRelay();
    }

    function connectRelay() {
      const enabled = document.getElementById('remote-show-toggle')?.checked;
      if (!enabled) {
        disconnectRelay({ markIdle: true, reason: 'RemoteShow disabled' });
        return;
      }
      ensureRemoteShowCredentials();
      setRemoteShowConnectionState('resolving');
      const host = resolveRelayHost();
      const relayPort = getRelayPort();
      if (!host) {
        setRemoteShowConnectionState('error', 'Relay host is missing. Set Host/IP or wait for LAN detection.');
        updateRelayUi();
        return;
      }
      if (!relayPort) {
        setRemoteShowConnectionState('error', 'Relay port is missing.');
        updateRelayUi();
        return;
      }
      const url = buildRelayUrl();
      if (!url) {
        setRemoteShowConnectionState('error', 'Relay URL could not be built.');
        updateRelayUi();
        return;
      }
      if (relaySocket && relayUrl === url && (relaySocket.readyState === WebSocket.OPEN || relaySocket.readyState === WebSocket.CONNECTING)) {
        updateRelayUi();
        return;
      }
      disconnectRelay();
      relayUrl = url;
      setRemoteShowConnectionState('connecting');
      updateRelayUi();
      remoteShowLog('connect_attempt', url);
      try {
        relaySocket = new WebSocket(url);
      } catch (e) {
        setRemoteShowConnectionState('error', e && e.message ? e.message : 'Relay socket init failed');
        scheduleRelayReconnect('Relay socket init failed');
        return;
      }
      startRemoteShowUiTicker();
      relaySocket.onopen = () => {
        remoteShowRetryAttempt = 0;
        remoteShowRetryNextAt = 0;
        remoteShowPendingPingAt = 0;
        setRemoteShowConnectionState('connected');
        remoteShowLastHeartbeatAt = Date.now();
        remoteShowLog('connected', relayUrl);
        requestRelayState();
        flushRelayStateQueue();
        startRemoteShowHeartbeat();
        relaySend({ type: 'HELLO', ts: Date.now() });
      };
      relaySocket.onclose = () => {
        remoteShowLog('closed', relayUrl || 'relay');
        if (remoteShowHeartbeatTimer) {
          clearInterval(remoteShowHeartbeatTimer);
          remoteShowHeartbeatTimer = null;
        }
        if (document.getElementById('remote-show-toggle')?.checked) {
          setRemoteShowConnectionState('degraded', 'Relay connection closed');
          scheduleRelayReconnect('Relay connection closed');
        } else {
          setRemoteShowConnectionState('idle');
        }
      };
      relaySocket.onerror = () => {
        remoteShowLog('socket_error', relayUrl || 'relay');
        setRemoteShowConnectionState('degraded', 'WebSocket error');
      };
      relaySocket.onmessage = (event) => {
        let data = null;
        try { data = JSON.parse(event.data); } catch (e) { return; }
        const payload = relayNormalizeInbound(data);
        if (!payload) return;
        remoteShowLastHeartbeatAt = Date.now();
        if (payload.type === 'PONG') {
          remoteShowPendingPingAt = 0;
          setRemoteShowConnectionState('connected');
          updateRelayUi();
          return;
        }
        if (payload.type === 'PING') {
          relaySend({ type: 'PONG', ts: Date.now() });
          return;
        }
        handleSyncMessage(payload);
      };
    }

    function updateRemoteShowDetails() {
      updateRemoteShowDetectedUi();
      updateRelayUi();
      const url = buildRemoteShowUrl();
      const urlInput = document.getElementById('remote-show-url');
      const qrImg = document.getElementById('remote-show-qr');
      const qrBox = document.getElementById('remote-show-qr-box');
      const copyBtn = document.getElementById('remote-show-copy-btn');
      if (urlInput) urlInput.value = url;
      if (copyBtn) copyBtn.disabled = !url;
      updateRemoteShowQr(url, qrImg, qrBox);
      updateRemoteShowStatusPanel();
      const warning = document.getElementById('remote-show-warning');
      if (warning) {
        let msg = '';
        const useHostname = document.getElementById('remote-show-use-hostname')?.checked;
        const hostname = window.location.hostname || '';
        const usingDetected = useHostname && remoteShowDetectedIp && isLocalhostHost(hostname);
        if (window.location.protocol === 'file:') {
          msg = 'RemoteShow needs the control panel served over HTTP (not file://).';
        } else if (!url) {
          msg = 'Cannot build share URL. Set Host/IP manually or wait for LAN IP detection.';
        } else if (!buildRelayUrl()) {
          msg = 'Cannot build relay URL. Set Relay Host/IP and Relay Port.';
        } else if (usingDetected) {
          msg = 'Localhost only works on this computer. Using detected LAN IP for the link.';
        } else if (useHostname && isLocalhostHost(hostname)) {
          msg = 'Localhost only works on this computer. Use your LAN IP for other devices.';
        } else if (remoteShowConnectionState === 'error') {
          msg = 'Relay is not connected. Check host/IP and relay port.';
        } else if (remoteShowConnectionState === 'degraded') {
          msg = 'Connection degraded. Waiting to reconnect automatically.';
        }
        warning.textContent = msg;
        warning.style.display = msg ? 'block' : 'none';
      }
    }

    function copyRemoteShowUrl() {
      const url = buildRemoteShowUrl();
      if (!url) {
        showToast(t('remote_show_url_unavailable'));
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          showToast(t('remote_show_url_copied'));
        }).catch(() => {
          fallbackCopyRemoteShowUrl(url, 'remote-show-url', t('remote_show_url_copied'));
        });
        return;
      }
      fallbackCopyRemoteShowUrl(url, 'remote-show-url', t('remote_show_url_copied'));
    }

    function testRemoteShowConnection() {
      if (!document.getElementById('remote-show-toggle')?.checked) {
        showToast(t('remote_show_enable_first'));
        return;
      }
      if (!relaySocket || relaySocket.readyState !== WebSocket.OPEN) {
        reconnectRelay();
        showToast(t('remote_show_testing_reconnect'));
        return;
      }
      relaySend({ type: 'STATE_REQUEST', ts: Date.now(), sender: 'control', clientId: relayClientId, stateUpdatedAt: appStateUpdatedAt || 0 });
      sendRemoteShowHeartbeat();
      showToast(t('remote_show_connection_test_sent'));
    }

    function fallbackCopyRemoteShowUrl(url, inputId = 'remote-show-url', successMessage = 'RemoteShow URL copied') {
      const input = document.getElementById(inputId);
      if (input) {
        input.focus();
        input.select();
        try {
          document.execCommand('copy');
          showToast(successMessage);
        } catch (e) {
          showToast(t('common_copy_failed'));
        }
        return;
      }
      window.prompt('RemoteShow URL', url);
    }

