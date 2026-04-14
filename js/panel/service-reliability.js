    // =============================================================
    // Bible Song Pro — Service-Day Reliability (P0)
    // =============================================================
    //
    // Implements the 8 P0 items from CLAUDE.md in a single self-contained
    // module.  Loaded LAST, after bootstrap-and-init.js, as a plain script.
    // All js/panel/*.js files share script scope, so globals declared in the
    // other files (channel, appState, idbGet/idbPut, STORE_STATE, stateReady,
    // isLive, schedule, bibles, broadcastMessage, postClear, clearOutput,
    // showToast, sendSyncState, etc.) are visible here at runtime.
    //
    //   #1 Crash-safe autosave + "restore previous service" banner
    //   #2 Black / Clear / Logo panic buttons + global hotkeys
    //   #3 Online/offline indicator + fetch cache scaffold
    //   #4 Preview/Program split with Take button
    //   #5 Display health pill + heartbeat monitoring
    //   #6 Confirm-before-close / service-in-progress guard
    //   #7 Safe-mode boot on corrupt state
    //   #8 Pre-service checklist / preflight diagnostic
    //
    // No behavior is changed unless a specific P0 trigger fires.  Every
    // feature gracefully no-ops if its dependencies are missing.
    // =============================================================

    // ----- Shared constants -------------------------------------------------

    const BSP_SR_VERSION = 1;
    const BSP_SR_SESSION_KEY = 'serviceSession';
    const BSP_SR_QUARANTINE_PREFIX = 'appState:quarantine:';
    const BSP_SR_OFFLINE_CACHE_PREFIX = 'offlineCache:';
    const BSP_SR_HEALTH_AMBER_MS = 10 * 1000;
    const BSP_SR_HEALTH_CHECK_MS = 1000;
    const BSP_SR_SESSION_TICK_MS = 2000;
    const BSP_SR_SESSION_IDLE_GRACE_MS = 30 * 1000;

    // ----- Shared module state (script-scoped) -----------------------------

    let bspSrInitialized = false;
    let bspSrBannerRestoreEl = null;
    let bspSrBannerSafeModeEl = null;
    let bspSrPanicBarEl = null;
    let bspSrHealthPillEl = null;
    let bspSrOnlinePillEl = null;
    let bspSrPreviewToggleEl = null;
    let bspSrTakeBtnEl = null;
    let bspSrEndServiceBtnEl = null;
    let bspSrPreviewBuffer = null;
    let bspSrPreviewMode = false;
    let bspSrOriginalBroadcastMessage = null;
    let bspSrSessionRecord = null;
    let bspSrLastOnlineAt = Date.now();
    let bspSrHealthState = 'green'; // 'green' | 'amber' | 'red'
    let bspSrHealthTimer = null;
    let bspSrSessionTimer = null;
    let bspSrLastActivityAt = 0;

    // ----- P0 #7: Safe-mode boot rescue (runs at script parse time) -------
    //
    // This IIFE fires IMMEDIATELY, before window.onload runs initControlPanel
    // and bootApp().  If the persisted appState is corrupt, quarantine it and
    // blank the live key so bootApp() loads defaults instead of crashing.
    // All errors are swallowed — this path must NEVER break the normal boot.

    (function bspSrSafeModeRescue() {
      try {
        if (typeof openDb !== 'function' || typeof idbGet !== 'function' || typeof idbPut !== 'function') {
          return;
        }
        if (typeof STORE_STATE !== 'string') return;
        openDb().then(function () {
          return idbGet(STORE_STATE, 'appState');
        }).then(function (entry) {
          if (!entry) return null;
          if (bspSrValidateAppStateEntry(entry)) return null;
          const ts = Date.now();
          const quarantineKey = BSP_SR_QUARANTINE_PREFIX + ts;
          const quarantinePayload = {
            key: quarantineKey,
            value: entry.value == null ? null : entry.value,
            originalUpdatedAt: entry.updatedAt || 0,
            quarantinedAt: ts
          };
          return idbPut(STORE_STATE, quarantinePayload).then(function () {
            // Overwrite the live appState slot with a benign empty record so
            // bootApp()'s idbGet returns a value that applyLoadedState will
            // treat as a cold start.
            return idbPut(STORE_STATE, { key: 'appState', value: null, updatedAt: 0 });
          }).then(function () {
            window.__bspSafeModeRescued = { quarantineKey: quarantineKey, at: ts };
            try {
              console.warn('[BSP Reliability] Safe mode: quarantined corrupt appState →', quarantineKey);
            } catch (_) {}
          });
        }).catch(function () { /* ignore */ });
      } catch (_) { /* never throw */ }
    })();

    function bspSrValidateAppStateEntry(entry) {
      if (!entry || typeof entry !== 'object') return false;
      if (entry.key !== 'appState') return false;
      if (!('value' in entry)) return false;
      const v = entry.value;
      if (v == null) return true; // empty is benign
      if (typeof v !== 'object') return false;
      // A real state record has at least one of these top-level keys.
      const expected = ['schedule', 'settings', 'mode', 'ui', 'live', 'version', 'activeTab'];
      return expected.some(function (k) { return Object.prototype.hasOwnProperty.call(v, k); });
    }

    // ----- Style injection -------------------------------------------------

    function bspSrInjectStyles() {
      if (document.getElementById('bsp-sr-styles')) return;
      const css = `
        #bsp-sr-panic-bar {
          position: fixed;
          top: 8px;
          right: 8px;
          z-index: 9500;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 8px;
          background: rgba(12, 14, 20, 0.92);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 10px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 12px;
          color: #e8eaed;
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        #bsp-sr-panic-bar.collapsed > .bsp-sr-expand { display: none; }
        .bsp-sr-btn {
          cursor: pointer;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: #1b1f2a;
          color: #e8eaed;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.02em;
          min-width: 56px;
          transition: background 0.12s ease, transform 0.08s ease;
        }
        .bsp-sr-btn:hover { background: #262b38; }
        .bsp-sr-btn:active { transform: translateY(1px); }
        .bsp-sr-btn[disabled] { opacity: 0.45; cursor: not-allowed; }
        .bsp-sr-btn-danger {
          background: #2a0a0a;
          border-color: #5a1717;
          color: #ffb3b3;
        }
        .bsp-sr-btn-danger:hover { background: #3a0e0e; }
        .bsp-sr-btn-warn {
          background: #2a200a;
          border-color: #5a4217;
          color: #ffd580;
        }
        .bsp-sr-btn-warn:hover { background: #3a2d0e; }
        .bsp-sr-btn-accent {
          background: #0a2a2a;
          border-color: #175a5a;
          color: #80ffe0;
        }
        .bsp-sr-btn-accent:hover { background: #0e3a3a; }
        .bsp-sr-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: #0e1117;
        }
        .bsp-sr-pill .bsp-sr-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #999;
          box-shadow: 0 0 6px rgba(255, 255, 255, 0.12);
        }
        .bsp-sr-pill[data-state="green"] .bsp-sr-dot { background: #3ddc84; box-shadow: 0 0 8px #3ddc8466; }
        .bsp-sr-pill[data-state="amber"] .bsp-sr-dot { background: #ffb64d; box-shadow: 0 0 8px #ffb64d66; }
        .bsp-sr-pill[data-state="red"]   .bsp-sr-dot { background: #ff5252; box-shadow: 0 0 10px #ff525277; animation: bspSrPulse 1.2s ease-in-out infinite; }
        .bsp-sr-pill[data-state="green"] { color: #b6f4ce; }
        .bsp-sr-pill[data-state="amber"] { color: #ffd99a; }
        .bsp-sr-pill[data-state="red"]   { color: #ffb3b3; }
        @keyframes bspSrPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.55; transform: scale(0.85); }
        }
        .bsp-sr-sep {
          width: 1px;
          height: 20px;
          background: rgba(255, 255, 255, 0.12);
          margin: 0 2px;
        }
        .bsp-sr-banner {
          position: fixed;
          top: 8px;
          left: 8px;
          right: 260px;
          z-index: 9400;
          padding: 10px 14px;
          border-radius: 10px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 13px;
          color: #e8eaed;
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: 0 6px 22px rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .bsp-sr-banner[data-kind="restore"] {
          background: linear-gradient(180deg, #2a200a, #1b150a);
          border-color: #5a4217;
        }
        .bsp-sr-banner[data-kind="safe-mode"] {
          background: linear-gradient(180deg, #2a0a0a, #1b0a0a);
          border-color: #5a1717;
        }
        .bsp-sr-banner .bsp-sr-banner-text { flex: 1 1 auto; line-height: 1.4; }
        .bsp-sr-banner .bsp-sr-btn { font-size: 11px; padding: 5px 9px; min-width: 0; }
        .bsp-sr-banner.bsp-sr-hidden { display: none; }
        #bsp-sr-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(4, 6, 10, 0.68);
          z-index: 9700;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }
        #bsp-sr-modal-backdrop.bsp-sr-hidden { display: none; }
        #bsp-sr-modal {
          background: #12151d;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 14px;
          padding: 20px 22px;
          width: min(520px, 92vw);
          max-height: 82vh;
          overflow: auto;
          color: #e8eaed;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
        }
        #bsp-sr-modal h2 {
          margin: 0 0 6px 0;
          font-size: 18px;
          font-weight: 700;
        }
        #bsp-sr-modal .bsp-sr-modal-sub {
          margin: 0 0 16px 0;
          font-size: 12px;
          color: #9aa0a6;
        }
        #bsp-sr-modal .bsp-sr-check-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 10px 0;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }
        #bsp-sr-modal .bsp-sr-check-row:first-of-type { border-top: none; }
        #bsp-sr-modal .bsp-sr-check-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          margin-top: 5px;
          flex: 0 0 10px;
        }
        #bsp-sr-modal .bsp-sr-check-dot[data-state="pass"] { background: #3ddc84; box-shadow: 0 0 8px #3ddc8455; }
        #bsp-sr-modal .bsp-sr-check-dot[data-state="warn"] { background: #ffb64d; box-shadow: 0 0 8px #ffb64d55; }
        #bsp-sr-modal .bsp-sr-check-dot[data-state="fail"] { background: #ff5252; box-shadow: 0 0 8px #ff525266; }
        #bsp-sr-modal .bsp-sr-check-label {
          font-weight: 600;
          font-size: 13px;
        }
        #bsp-sr-modal .bsp-sr-check-detail {
          font-size: 12px;
          color: #9aa0a6;
          margin-top: 2px;
        }
        #bsp-sr-modal .bsp-sr-modal-actions {
          margin-top: 18px;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
      `;
      const style = document.createElement('style');
      style.id = 'bsp-sr-styles';
      style.textContent = css;
      document.head.appendChild(style);
    }

    // ----- Panic bar UI builder --------------------------------------------
    //
    // Single fixed-position bar in the top-right of the panel.  Houses every
    // service-day control so operators have one place to look under pressure:
    //   [Display pill] [Net pill] | [Preview toggle] [Take] | [Black] [Clear]
    //   [Logo] | [Checklist] [End Service]

    function bspSrBuildPanicBar() {
      if (document.getElementById('bsp-sr-panic-bar')) return;
      const bar = document.createElement('div');
      bar.id = 'bsp-sr-panic-bar';
      bar.setAttribute('role', 'toolbar');
      bar.setAttribute('aria-label', 'Service reliability controls');

      // Health pill (P0 #5)
      const healthPill = document.createElement('span');
      healthPill.className = 'bsp-sr-pill';
      healthPill.id = 'bsp-sr-health-pill';
      healthPill.dataset.state = 'amber';
      healthPill.title = 'Display link health';
      healthPill.innerHTML = '<span class="bsp-sr-dot"></span><span class="bsp-sr-pill-label">Display…</span>';
      bspSrHealthPillEl = healthPill;
      bar.appendChild(healthPill);

      // Online pill (P0 #3)
      const onlinePill = document.createElement('span');
      onlinePill.className = 'bsp-sr-pill';
      onlinePill.id = 'bsp-sr-online-pill';
      onlinePill.dataset.state = 'green';
      onlinePill.title = 'Network connectivity';
      onlinePill.innerHTML = '<span class="bsp-sr-dot"></span><span class="bsp-sr-pill-label">Online</span>';
      bspSrOnlinePillEl = onlinePill;
      bar.appendChild(onlinePill);

      bar.appendChild(bspSrSeparator());

      // Preview toggle + Take (P0 #4)
      const previewBtn = document.createElement('button');
      previewBtn.type = 'button';
      previewBtn.className = 'bsp-sr-btn';
      previewBtn.id = 'bsp-sr-preview-toggle';
      previewBtn.textContent = 'Preview: Off';
      previewBtn.title = 'Stage updates before broadcasting (Preview/Program split)';
      previewBtn.addEventListener('click', bspSrTogglePreviewMode);
      bspSrPreviewToggleEl = previewBtn;
      bar.appendChild(previewBtn);

      const takeBtn = document.createElement('button');
      takeBtn.type = 'button';
      takeBtn.className = 'bsp-sr-btn bsp-sr-btn-accent';
      takeBtn.id = 'bsp-sr-take-btn';
      takeBtn.textContent = 'Take';
      takeBtn.title = 'Promote staged update to program (Take)';
      takeBtn.disabled = true;
      takeBtn.addEventListener('click', bspSrTakeStaged);
      bspSrTakeBtnEl = takeBtn;
      bar.appendChild(takeBtn);

      bar.appendChild(bspSrSeparator());

      // Panic triad (P0 #2)
      const blackBtn = document.createElement('button');
      blackBtn.type = 'button';
      blackBtn.className = 'bsp-sr-btn bsp-sr-btn-danger';
      blackBtn.textContent = 'Black';
      blackBtn.title = 'Black out the output (Ctrl/Cmd+Shift+B)';
      blackBtn.addEventListener('click', function () { bspSendPanic('black'); });
      bar.appendChild(blackBtn);

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'bsp-sr-btn bsp-sr-btn-danger';
      clearBtn.textContent = 'Clear';
      clearBtn.title = 'Clear the output (Ctrl/Cmd+Shift+C)';
      clearBtn.addEventListener('click', function () { bspSrPanicClear(); });
      bar.appendChild(clearBtn);

      const logoBtn = document.createElement('button');
      logoBtn.type = 'button';
      logoBtn.className = 'bsp-sr-btn bsp-sr-btn-warn';
      logoBtn.textContent = 'Logo';
      logoBtn.title = 'Show logo on output (Ctrl/Cmd+Shift+L)';
      logoBtn.addEventListener('click', function () { bspSendPanic('logo'); });
      bar.appendChild(logoBtn);

      bar.appendChild(bspSrSeparator());

      // Preflight + End Service (P0 #8, #6)
      const checklistBtn = document.createElement('button');
      checklistBtn.type = 'button';
      checklistBtn.className = 'bsp-sr-btn';
      checklistBtn.textContent = 'Checklist';
      checklistBtn.title = 'Run pre-service diagnostics';
      checklistBtn.addEventListener('click', bspSrOpenPreflightModal);
      bar.appendChild(checklistBtn);

      const endBtn = document.createElement('button');
      endBtn.type = 'button';
      endBtn.className = 'bsp-sr-btn bsp-sr-btn-warn';
      endBtn.id = 'bsp-sr-end-service';
      endBtn.textContent = 'End Service';
      endBtn.title = 'Mark the current service as ended (clears unload guard)';
      endBtn.addEventListener('click', bspEndService);
      bspSrEndServiceBtnEl = endBtn;
      bar.appendChild(endBtn);

      document.body.appendChild(bar);
      bspSrPanicBarEl = bar;
    }

    function bspSrSeparator() {
      const s = document.createElement('span');
      s.className = 'bsp-sr-sep';
      return s;
    }

    // ----- P0 #2: Panic handlers --------------------------------------------
    //
    // Black / Logo go out as a new `PANIC` message type the display handles
    // (see BSP_display.html).  Clear reuses the existing clearOutput() path
    // so it plays nicely with vMix, OBS scenes, persistence, etc.

    function bspSendPanic(mode) {
      const m = String(mode || 'clear');
      const msg = { type: 'PANIC', proto: 1, sender: 'control', mode: m, ts: Date.now() };
      try {
        if (typeof broadcastMessage === 'function') {
          // Use the current (possibly wrapped) broadcastMessage.  PANIC bypasses
          // Preview Mode — panic buttons MUST always reach the display.
          if (bspSrOriginalBroadcastMessage) {
            bspSrOriginalBroadcastMessage(msg);
          } else {
            broadcastMessage(msg);
          }
        } else if (typeof channel !== 'undefined' && channel) {
          channel.postMessage(msg);
        }
      } catch (err) {
        try { console.error('[BSP Reliability] panic send failed', err); } catch (_) {}
      }
      if (typeof showToast === 'function') {
        showToast(m === 'black' ? 'Output: BLACK' : (m === 'logo' ? 'Output: LOGO' : 'Panic cleared'));
      }
    }

    function bspSrPanicClear() {
      // Use the existing clear pipeline so all systems stay in sync.
      try {
        if (typeof clearOutput === 'function') {
          clearOutput({ fade: false });
        } else if (typeof postClear === 'function') {
          postClear({ fade: false });
        } else {
          bspSendPanic('clear');
        }
      } catch (err) {
        bspSendPanic('clear');
      }
      if (typeof showToast === 'function') showToast('Output: CLEAR');
    }

    // ----- Global hotkeys (P0 #2) ------------------------------------------
    //
    // Registered via a dedicated keydown listener.  Does NOT touch the
    // existing setupKeyboardShortcuts() wiring — just adds alongside it.

    function bspSrInstallHotkeys() {
      document.addEventListener('keydown', function (e) {
        if (!e) return;
        const target = e.target;
        const tag = (target && target.tagName) ? target.tagName.toLowerCase() : '';
        const isTypingTarget = !!(target && (
          target.isContentEditable ||
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'select' ||
          (typeof target.closest === 'function' && target.closest('[contenteditable="true"]'))
        ));
        const isMod = e.ctrlKey || e.metaKey;
        if (!isMod || !e.shiftKey) return;
        const keyLower = (e.key || '').toLowerCase();
        if (keyLower !== 'b' && keyLower !== 'c' && keyLower !== 'l') return;
        // Panic hotkeys work even when focus is in an input — this is a
        // deliberate departure from the rest of the app.  A volunteer who
        // just typed the wrong search query still needs to black the output.
        e.preventDefault();
        if (keyLower === 'b') bspSendPanic('black');
        else if (keyLower === 'c') bspSrPanicClear();
        else if (keyLower === 'l') bspSendPanic('logo');
        // Mark typing target as "safely interrupted" for clarity.
        if (isTypingTarget && typeof target.blur === 'function') {
          try { target.blur(); } catch (_) {}
        }
      }, true);
    }

    // ----- P0 #5: Display health pill --------------------------------------
    //
    // Observes the existing `isDisplayOnline` flag that sync-and-output.js
    // flips on PONG.  Drives a three-state pill (green/amber/red) with a
    // one-shot resync attempt when transitioning amber → red.

    function bspSrInstallHealthMonitor() {
      if (bspSrHealthTimer) return;
      bspSrLastOnlineAt = Date.now();
      bspSrHealthState = 'amber';
      bspSrApplyHealthPill('amber', 'Display…');
      bspSrHealthTimer = setInterval(bspSrTickHealth, BSP_SR_HEALTH_CHECK_MS);
    }

    function bspSrTickHealth() {
      const online = (typeof isDisplayOnline !== 'undefined' && !!isDisplayOnline);
      if (online) {
        bspSrLastOnlineAt = Date.now();
        if (bspSrHealthState !== 'green') {
          const wasRed = bspSrHealthState === 'red';
          bspSrHealthState = 'green';
          bspSrApplyHealthPill('green', 'Display OK');
          if (wasRed && typeof showToast === 'function') {
            showToast('Display reconnected');
          }
        }
        return;
      }
      const elapsed = Date.now() - bspSrLastOnlineAt;
      if (elapsed < BSP_SR_HEALTH_AMBER_MS) {
        if (bspSrHealthState !== 'amber') {
          bspSrHealthState = 'amber';
          bspSrApplyHealthPill('amber', 'Display checking…');
        }
      } else {
        if (bspSrHealthState !== 'red') {
          bspSrHealthState = 'red';
          bspSrApplyHealthPill('red', 'Display OFFLINE');
          // One-shot resync attempt.
          try {
            if (typeof sendSyncState === 'function') sendSyncState();
          } catch (_) {}
          if (typeof showToast === 'function') {
            showToast('Display unreachable — check Browser Source');
          }
        }
      }
    }

    function bspSrApplyHealthPill(state, label) {
      if (!bspSrHealthPillEl) return;
      bspSrHealthPillEl.dataset.state = state;
      const lbl = bspSrHealthPillEl.querySelector('.bsp-sr-pill-label');
      if (lbl) lbl.textContent = label;
    }

    // ----- P0 #3: Online/offline monitor + offline fetch wrapper -----------
    //
    // Minimal online/offline indicator + a scaffolded fetch wrapper that
    // caches successful responses in IndexedDB under `offlineCache:<url>`
    // and returns the cache on failure.  Call sites must adopt it
    // explicitly (window.bspOfflineFetch) — full integration is a follow-up.
    // Downloaded for offline → future integration point: replace `fetch` in
    // js/panel/songs-and-bible.js auto-lyrics lookup + Bible version load.

    function bspSrInstallOnlineMonitor() {
      const apply = function () {
        const online = (typeof navigator !== 'undefined' && navigator && 'onLine' in navigator)
          ? !!navigator.onLine
          : true;
        if (!bspSrOnlinePillEl) return;
        bspSrOnlinePillEl.dataset.state = online ? 'green' : 'red';
        const lbl = bspSrOnlinePillEl.querySelector('.bsp-sr-pill-label');
        if (lbl) lbl.textContent = online ? 'Online' : 'Offline';
      };
      apply();
      window.addEventListener('online', function () {
        apply();
        if (typeof showToast === 'function') showToast('Back online');
      });
      window.addEventListener('offline', function () {
        apply();
        if (typeof showToast === 'function') showToast('You are offline — cached data only');
      });
    }

    window.bspOfflineFetch = function (url, opts) {
      const cacheKey = BSP_SR_OFFLINE_CACHE_PREFIX + String(url);
      const doFetch = function () {
        return fetch(url, opts || {}).then(function (res) {
          if (!res || !res.ok) throw new Error('fetch failed: ' + (res && res.status));
          return res.clone().text().then(function (body) {
            try {
              idbPut(STORE_STATE, {
                key: cacheKey,
                value: body,
                url: String(url),
                cachedAt: Date.now()
              }).catch(function () {});
            } catch (_) {}
            return res;
          });
        });
      };
      return doFetch().catch(function (err) {
        // Fall back to cached copy if available.
        return idbGet(STORE_STATE, cacheKey).then(function (entry) {
          if (entry && typeof entry.value === 'string') {
            if (typeof showToast === 'function') showToast('Using cached copy (offline)');
            return new Response(entry.value, { status: 200, headers: { 'X-Bsp-Offline-Cache': '1' } });
          }
          throw err;
        });
      });
    };

    // ----- P0 #4: Preview/Program split ------------------------------------
    //
    // Wraps the existing `broadcastMessage(msg)` function.  When Preview
    // Mode is ON, outgoing `UPDATE` messages are BUFFERED (not broadcast);
    // every other message type (CLEAR, PING, PONG, SYNC_STATE, PANIC, …)
    // passes through unchanged.  The Take button flushes the most recent
    // buffered UPDATE through the original broadcastMessage, sending it
    // to the display for real.
    //
    // This gives operators a staging buffer without touching any call
    // site: they enable preview mode, stage a slide with the normal UI,
    // verify it in the embedded panel preview (which still updates
    // locally via syncEmbeddedProgramDisplay), and press Take when ready.
    //
    // Preview mode state is intentionally NOT persisted — reload defaults
    // back to OFF so a confused handoff never leaves the app in a silent
    // state.

    function bspSrInstallPreviewInterception() {
      if (bspSrOriginalBroadcastMessage) return;
      if (typeof broadcastMessage !== 'function') return;
      bspSrOriginalBroadcastMessage = broadcastMessage;
      // Reassign the top-level binding.  In classic scripts, function
      // declarations at script scope live on the global object, so this
      // replacement is visible to callers that look up broadcastMessage
      // by bare name from other js/panel/*.js files.
      try {
        // eslint-disable-next-line no-global-assign
        broadcastMessage = bspSrBroadcastMessageWrapper;
      } catch (_) {
        // Fallback: attach to window and hope callers resolve via global.
        try { window.broadcastMessage = bspSrBroadcastMessageWrapper; } catch (__) {}
      }
      try { window.broadcastMessage = bspSrBroadcastMessageWrapper; } catch (_) {}
    }

    function bspSrBroadcastMessageWrapper(msg) {
      if (!bspSrPreviewMode) {
        return bspSrOriginalBroadcastMessage(msg);
      }
      if (msg && msg.type === 'UPDATE') {
        // Buffer only — do not broadcast.  Preview is staging-only.
        bspSrPreviewBuffer = msg;
        bspSrRefreshTakeButton();
        return undefined;
      }
      // Everything else (CLEAR, PING, PANIC, SYNC_STATE, …) passes through.
      return bspSrOriginalBroadcastMessage(msg);
    }

    function bspSrTogglePreviewMode() {
      bspSrPreviewMode = !bspSrPreviewMode;
      if (bspSrPreviewToggleEl) {
        bspSrPreviewToggleEl.textContent = bspSrPreviewMode ? 'Preview: On' : 'Preview: Off';
        bspSrPreviewToggleEl.classList.toggle('bsp-sr-btn-accent', bspSrPreviewMode);
      }
      if (!bspSrPreviewMode) {
        // Turning OFF does not auto-flush — any staged update is discarded
        // so the operator has to make a conscious decision to go live.
        bspSrPreviewBuffer = null;
      }
      bspSrRefreshTakeButton();
      if (typeof showToast === 'function') {
        showToast(bspSrPreviewMode ? 'Preview mode ON — updates will be staged' : 'Preview mode OFF');
      }
    }

    function bspSrTakeStaged() {
      if (!bspSrPreviewBuffer) return;
      const staged = bspSrPreviewBuffer;
      bspSrPreviewBuffer = null;
      bspSrRefreshTakeButton();
      try {
        if (bspSrOriginalBroadcastMessage) bspSrOriginalBroadcastMessage(staged);
      } catch (err) {
        try { console.error('[BSP Reliability] take failed', err); } catch (_) {}
      }
      if (typeof showToast === 'function') showToast('TAKE — staged update sent to program');
    }

    function bspSrRefreshTakeButton() {
      if (!bspSrTakeBtnEl) return;
      bspSrTakeBtnEl.disabled = !(bspSrPreviewMode && bspSrPreviewBuffer);
    }

    // ----- P0 #1: Service session tracker + restore banner -----------------
    //
    // The existing bootstrap already persists appState to IndexedDB, so the
    // setlist + current item come back automatically.  What's missing is the
    // *signal* to the operator that the previous session crashed, and an
    // explicit "Start Fresh" escape hatch.  We maintain a small companion
    // record at STORE_STATE:serviceSession that is updated on every tick
    // the app looks alive and cleared on explicit End Service / beforeunload.

    function bspSrStartSessionTicker() {
      if (bspSrSessionTimer) return;
      bspSrLastActivityAt = Date.now();
      bspSrSessionTimer = setInterval(bspSrTickSession, BSP_SR_SESSION_TICK_MS);
    }

    function bspSrTickSession() {
      try {
        const live = (typeof isLive !== 'undefined' && !!isLive);
        const sched = (typeof schedule !== 'undefined' && Array.isArray(schedule)) ? schedule : [];
        const active = live || sched.length > 0;
        if (active) {
          bspSrLastActivityAt = Date.now();
          const rec = {
            key: BSP_SR_SESSION_KEY,
            inProgress: true,
            startedAt: (bspSrSessionRecord && bspSrSessionRecord.startedAt) || Date.now(),
            lastUpdateAt: Date.now(),
            cleanShutdown: false,
            wasLive: live,
            scheduleLength: sched.length
          };
          bspSrSessionRecord = rec;
          if (typeof idbPut === 'function') {
            idbPut(STORE_STATE, rec).catch(function () {});
          }
        }
        // No implicit auto-shutdown — idle ≠ ended.  Ending a service is
        // always explicit (End Service button) or beforeunload.
      } catch (_) { /* never throw from ticker */ }
    }

    function bspSrCheckRestoreBanner() {
      if (typeof idbGet !== 'function') return;
      idbGet(STORE_STATE, BSP_SR_SESSION_KEY).then(function (rec) {
        if (!rec) return;
        bspSrSessionRecord = rec;
        if (rec.inProgress === true && rec.cleanShutdown === false) {
          bspSrShowRestoreBanner(rec);
        }
      }).catch(function () {});
    }

    function bspSrShowRestoreBanner(rec) {
      if (bspSrBannerRestoreEl) return;
      const banner = document.createElement('div');
      banner.className = 'bsp-sr-banner';
      banner.setAttribute('data-kind', 'restore');
      const items = rec && rec.scheduleLength ? rec.scheduleLength : 0;
      const when = rec && rec.lastUpdateAt ? bspSrRelativeTime(rec.lastUpdateAt) : 'recently';
      const text = document.createElement('div');
      text.className = 'bsp-sr-banner-text';
      text.innerHTML =
        '<strong>⚠ Previous service was interrupted</strong><br>' +
        'Your setlist (' + items + ' item' + (items === 1 ? '' : 's') + ') and settings were restored. ' +
        'Last activity: ' + when + '.';
      banner.appendChild(text);

      const fresh = document.createElement('button');
      fresh.type = 'button';
      fresh.className = 'bsp-sr-btn bsp-sr-btn-warn';
      fresh.textContent = 'Start Fresh';
      fresh.addEventListener('click', function () {
        bspSrStartFresh();
      });
      banner.appendChild(fresh);

      const dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.className = 'bsp-sr-btn';
      dismiss.textContent = 'Dismiss';
      dismiss.addEventListener('click', function () {
        banner.remove();
        bspSrBannerRestoreEl = null;
      });
      banner.appendChild(dismiss);

      document.body.appendChild(banner);
      bspSrBannerRestoreEl = banner;
    }

    function bspSrStartFresh() {
      try {
        if (typeof schedule !== 'undefined' && Array.isArray(schedule)) {
          schedule.length = 0;
        }
        if (typeof appState !== 'undefined' && appState) {
          appState.schedule = [];
          if (appState.live) {
            appState.live.isLive = false;
            appState.live.liveKind = null;
            appState.live.livePointer = null;
            appState.live.liveLineCursor = 0;
          }
        }
        if (typeof clearOutput === 'function') {
          try { clearOutput({ fade: false }); } catch (_) {}
        }
        if (typeof saveToStorage === 'function') {
          saveToStorage();
        }
        // Mark the session record as ended so the banner doesn't come back.
        bspEndService({ silent: true });
      } catch (err) {
        try { console.error('[BSP Reliability] start-fresh failed', err); } catch (_) {}
      }
      if (typeof showToast === 'function') showToast('Started fresh — setlist cleared');
      // Give the user visual confirmation, then reload to normalize all UI.
      setTimeout(function () {
        try { location.reload(); } catch (_) {}
      }, 600);
    }

    function bspSrRelativeTime(ts) {
      const diff = Math.max(0, Date.now() - Number(ts || 0));
      const sec = Math.round(diff / 1000);
      if (sec < 60) return sec + 's ago';
      const min = Math.round(sec / 60);
      if (min < 60) return min + 'm ago';
      const hr = Math.round(min / 60);
      if (hr < 24) return hr + 'h ago';
      const day = Math.round(hr / 24);
      return day + 'd ago';
    }

    // ----- P0 #7: Safe-mode banner (runtime half) --------------------------

    function bspSrCheckSafeModeBanner() {
      const info = window.__bspSafeModeRescued;
      if (!info) return;
      if (bspSrBannerSafeModeEl) return;
      const banner = document.createElement('div');
      banner.className = 'bsp-sr-banner';
      banner.setAttribute('data-kind', 'safe-mode');
      // Stack below the restore banner if both show.
      if (bspSrBannerRestoreEl) banner.style.top = '70px';
      const text = document.createElement('div');
      text.className = 'bsp-sr-banner-text';
      text.innerHTML =
        '<strong>⚠ Safe Mode</strong><br>' +
        'Your previous saved state was unreadable and has been quarantined. ' +
        'The app started with defaults.';
      banner.appendChild(text);

      const details = document.createElement('button');
      details.type = 'button';
      details.className = 'bsp-sr-btn';
      details.textContent = 'View details';
      details.addEventListener('click', function () {
        try {
          console.warn('[BSP Reliability] Quarantine record:', info);
          if (typeof showToast === 'function') {
            showToast('Quarantine key: ' + info.quarantineKey);
          }
        } catch (_) {}
      });
      banner.appendChild(details);

      const dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.className = 'bsp-sr-btn';
      dismiss.textContent = 'Dismiss';
      dismiss.addEventListener('click', function () {
        banner.remove();
        bspSrBannerSafeModeEl = null;
      });
      banner.appendChild(dismiss);

      document.body.appendChild(banner);
      bspSrBannerSafeModeEl = banner;
    }

    // ----- P0 #6: Confirm-before-close / service-in-progress guard ---------
    //
    // `beforeunload` returning a string triggers the browser's native
    // confirm dialog in Electron and normal web contexts.  In OBS Browser
    // Source the dialog is usually suppressed, but the End Service button
    // is still the authoritative way to mark a clean shutdown.  We cover
    // both paths.

    function bspSrInstallBeforeUnloadGuard() {
      window.addEventListener('beforeunload', function (e) {
        if (!bspSrSessionRecord) return undefined;
        if (!bspSrSessionRecord.inProgress) return undefined;
        if (bspSrSessionRecord.cleanShutdown) return undefined;
        const message = 'A service is in progress. Close anyway?';
        try { e.returnValue = message; } catch (_) {}
        return message;
      });
    }

    function bspEndService(opts) {
      const silent = !!(opts && opts.silent);
      try {
        const rec = {
          key: BSP_SR_SESSION_KEY,
          inProgress: false,
          startedAt: (bspSrSessionRecord && bspSrSessionRecord.startedAt) || Date.now(),
          lastUpdateAt: Date.now(),
          cleanShutdown: true,
          wasLive: false,
          scheduleLength: (typeof schedule !== 'undefined' && Array.isArray(schedule)) ? schedule.length : 0
        };
        bspSrSessionRecord = rec;
        if (typeof idbPut === 'function') {
          idbPut(STORE_STATE, rec).catch(function () {});
        }
      } catch (_) {}
      if (!silent && typeof showToast === 'function') {
        showToast('Service ended — safe to close');
      }
    }

    // Expose on window for external callers (hotkeys, Stream Deck, future
    // integrations) without polluting the global identifier namespace.
    window.bspEndService = bspEndService;
    window.bspSendPanic = bspSendPanic;

    // ----- Panic channel listener ------------------------------------------
    //
    // Wraps the existing channel.onmessage handler so we can observe a few
    // message types (END_SERVICE, panic acknowledgements) without breaking
    // the sync-and-output.js dispatcher.

    function bspSrInstallPanicChannelListener() {
      if (typeof channel === 'undefined' || !channel) return;
      const prev = channel.onmessage;
      channel.onmessage = function (e) {
        const d = (e && e.data) || {};
        if (d && d.type === 'END_SERVICE') {
          bspEndService();
        }
        if (typeof prev === 'function') {
          try { prev.call(channel, e); } catch (err) {
            try { console.error('[BSP Reliability] prior onmessage failed', err); } catch (_) {}
          }
        }
      };
    }

    // ----- P0 #8: Preflight checklist modal --------------------------------
    //
    // A compact modal that runs seven checks in a row, showing pass/warn/fail
    // for each.  Designed to be run by a volunteer 10 seconds before the
    // doors open, surfacing the most common live-service failure modes.

    function bspSrOpenPreflightModal() {
      // Tear down any previous instance.
      const existing = document.getElementById('bsp-sr-modal-backdrop');
      if (existing) existing.remove();

      const backdrop = document.createElement('div');
      backdrop.id = 'bsp-sr-modal-backdrop';
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) backdrop.remove();
      });

      const modal = document.createElement('div');
      modal.id = 'bsp-sr-modal';
      backdrop.appendChild(modal);

      const title = document.createElement('h2');
      title.textContent = 'Pre-Service Checklist';
      modal.appendChild(title);

      const sub = document.createElement('p');
      sub.className = 'bsp-sr-modal-sub';
      sub.textContent = 'Run this 10 seconds before the doors open. Most failures are caught here.';
      modal.appendChild(sub);

      const list = document.createElement('div');
      modal.appendChild(list);

      const actions = document.createElement('div');
      actions.className = 'bsp-sr-modal-actions';
      const rerun = document.createElement('button');
      rerun.type = 'button';
      rerun.className = 'bsp-sr-btn bsp-sr-btn-accent';
      rerun.textContent = 'Re-run';
      rerun.addEventListener('click', function () { bspSrRunPreflightChecks(list); });
      actions.appendChild(rerun);
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'bsp-sr-btn';
      close.textContent = 'Close';
      close.addEventListener('click', function () { backdrop.remove(); });
      actions.appendChild(close);
      modal.appendChild(actions);

      document.body.appendChild(backdrop);
      bspSrRunPreflightChecks(list);
    }

    function bspSrRunPreflightChecks(listEl) {
      listEl.innerHTML = '';
      const checks = [];

      // 1. Display link
      checks.push({
        label: 'Display link',
        state: (typeof isDisplayOnline !== 'undefined' && isDisplayOnline) ? 'pass' : 'fail',
        detail: (typeof isDisplayOnline !== 'undefined' && isDisplayOnline)
          ? 'BSP_display.html is responding to heartbeats.'
          : 'No response from display. Check that BSP_display.html is added as a Browser Source.'
      });

      // 3. Online status
      const online = (typeof navigator !== 'undefined' && navigator.onLine);
      checks.push({
        label: 'Network connectivity',
        state: online ? 'pass' : 'warn',
        detail: online
          ? 'Online — auto-retrieve lyrics and remote providers are reachable.'
          : 'Offline — only cached data will be available.'
      });

      // 4. Fonts ready
      const fontsOk = !!(document.fonts && document.fonts.status === 'loaded');
      checks.push({
        label: 'Fonts loaded',
        state: fontsOk ? 'pass' : 'warn',
        detail: fontsOk
          ? 'All declared fonts have loaded.'
          : 'Some fonts are still loading — give it a moment and re-run.'
      });

      // 5. Setlist populated
      const schedLen = (typeof schedule !== 'undefined' && Array.isArray(schedule)) ? schedule.length : 0;
      checks.push({
        label: 'Setlist',
        state: schedLen > 0 ? 'pass' : 'warn',
        detail: schedLen > 0
          ? schedLen + ' item' + (schedLen === 1 ? '' : 's') + ' queued.'
          : 'Setlist is empty — open the Schedule tab to build one.'
      });

      // 6. Bible library
      const bibleCount = (typeof bibles !== 'undefined' && bibles) ? Object.keys(bibles).length : 0;
      checks.push({
        label: 'Bible library',
        state: bibleCount > 0 ? 'pass' : 'fail',
        detail: bibleCount > 0
          ? bibleCount + ' version' + (bibleCount === 1 ? '' : 's') + ' available offline.'
          : 'No Bible versions loaded. Import at least one version from Settings.'
      });

      // 7. Safe-mode state
      const safe = !!window.__bspSafeModeRescued;
      checks.push({
        label: 'Safe mode',
        state: safe ? 'warn' : 'pass',
        detail: safe
          ? 'Started in safe mode — previous state was quarantined.'
          : 'Previous state loaded cleanly.'
      });

      // Render immediate rows first.
      checks.forEach(function (c) {
        listEl.appendChild(bspSrRenderCheckRow(c));
      });

      // 2. Storage round-trip — async, replaces a placeholder row.
      const storageRow = bspSrRenderCheckRow({
        label: 'Storage',
        state: 'warn',
        detail: 'Testing IndexedDB round-trip…'
      });
      listEl.appendChild(storageRow);
      bspSrProbeStorage().then(function (result) {
        storageRow.replaceWith(bspSrRenderCheckRow({
          label: 'Storage',
          state: result.ok ? 'pass' : 'fail',
          detail: result.ok
            ? 'IndexedDB is writable and responsive.'
            : 'Storage probe failed: ' + (result.error || 'unknown')
        }));
      });
    }

    function bspSrRenderCheckRow(c) {
      const row = document.createElement('div');
      row.className = 'bsp-sr-check-row';
      const dot = document.createElement('div');
      dot.className = 'bsp-sr-check-dot';
      dot.dataset.state = c.state;
      row.appendChild(dot);
      const text = document.createElement('div');
      const label = document.createElement('div');
      label.className = 'bsp-sr-check-label';
      label.textContent = c.label;
      text.appendChild(label);
      const detail = document.createElement('div');
      detail.className = 'bsp-sr-check-detail';
      detail.textContent = c.detail;
      text.appendChild(detail);
      row.appendChild(text);
      return row;
    }

    function bspSrProbeStorage() {
      if (typeof idbPut !== 'function' || typeof idbGet !== 'function') {
        return Promise.resolve({ ok: false, error: 'IDB helpers missing' });
      }
      const probeKey = 'preflightProbe';
      const probeValue = 'ok:' + Date.now();
      return idbPut(STORE_STATE, {
        key: probeKey, value: probeValue, updatedAt: Date.now()
      }).then(function () {
        return idbGet(STORE_STATE, probeKey);
      }).then(function (entry) {
        if (entry && entry.value === probeValue) return { ok: true };
        return { ok: false, error: 'readback mismatch' };
      }).catch(function (err) {
        return { ok: false, error: (err && err.message) || String(err) };
      });
    }

    // ----- Main init + boot hook -------------------------------------------

    function bspServiceReliabilityInit() {
      if (bspSrInitialized) return;
      bspSrInitialized = true;
      try {
        bspSrInjectStyles();
        bspSrBuildPanicBar();
        bspSrInstallHotkeys();
        bspSrInstallHealthMonitor();
        bspSrInstallOnlineMonitor();
        bspSrInstallBeforeUnloadGuard();
        bspSrInstallPanicChannelListener();
        bspSrInstallPreviewInterception();
        bspSrStartSessionTicker();
        bspSrCheckRestoreBanner();
        bspSrCheckSafeModeBanner();
      } catch (err) {
        try { console.error('[BSP Reliability] init failed:', err); } catch (_) {}
      }
    }

    // Expose for diagnostics + external callers.
    window.BSPReliability = {
      version: BSP_SR_VERSION,
      init: bspServiceReliabilityInit,
      endService: bspEndService,
      sendPanic: bspSendPanic,
      runPreflight: bspSrOpenPreflightModal,
      togglePreview: bspSrTogglePreviewMode,
      get isPreviewMode() { return bspSrPreviewMode; },
      get sessionRecord() { return bspSrSessionRecord; },
      get healthState() { return bspSrHealthState; }
    };

    // Wait for window.onload to run initControlPanel() → bootApp(), then
    // poll for stateReady before wiring UI.  Falls back to an 8-second
    // timeout so a stuck bootApp can't block the reliability layer.
    window.addEventListener('load', function () {
      const start = Date.now();
      const wait = setInterval(function () {
        const ready = (typeof stateReady !== 'undefined' && stateReady);
        if (ready || Date.now() - start > 8000) {
          clearInterval(wait);
          bspServiceReliabilityInit();
        }
      }, 100);
    });

    // =============================================================
    // END OF FILE — Bible Song Pro Service Reliability
    // =============================================================








