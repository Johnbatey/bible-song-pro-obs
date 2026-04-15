    // =============================================================
    // Bible Song Pro — Accessibility & Readability Pass (P2 #16)
    // =============================================================
    //
    // WCAG-AA contrast presets, minimum-font-size guardrails,
    // ambiguous-background auto-shadow, and a safe-area overlay.
    // All UI is a single "A11y" button in the panic bar.
    //
    // Config persisted to STORE_STATE:accessibilityConfig. Default
    // state is everything off → zero behavior change until the
    // operator explicitly opts in.
    //
    // Loaded after obs-websocket-bridge.js.
    // =============================================================

    // ----- Constants & state -----------------------------------------------

    const BSP_A11Y_VERSION = 1;
    const BSP_A11Y_CONFIG_KEY = 'accessibilityConfig';
    const BSP_A11Y_FONT_CHECK_MS = 2000;

    const BSP_A11Y_PRESETS = [
      {
        id: 'none',
        name: 'No preset (use panel colors)',
        textColor: null,
        bgColor: null,
        minContrast: 0
      },
      {
        id: 'high-contrast-dark',
        name: 'High Contrast — White on Black',
        textColor: '#ffffff',
        bgColor: '#000000',
        minContrast: 21
      },
      {
        id: 'high-contrast-light',
        name: 'High Contrast — Black on White',
        textColor: '#000000',
        bgColor: '#ffffff',
        minContrast: 21
      },
      {
        id: 'warm-amber',
        name: 'Warm Amber on Black',
        textColor: '#ffd580',
        bgColor: '#000000',
        minContrast: 12.3
      },
      {
        id: 'soft-cyan',
        name: 'Soft Cyan on Dark Navy',
        textColor: '#b3e5fc',
        bgColor: '#001524',
        minContrast: 11.1
      },
      {
        id: 'low-vision-yellow',
        name: 'Low Vision — Yellow on Deep Blue',
        textColor: '#ffff00',
        bgColor: '#001a4d',
        minContrast: 13.2
      }
    ];

    let bspA11yInitialized = false;
    let bspA11yConfig = {
      presetId: 'none',
      minFontSize: 0,         // 0 = disabled
      autoShadow: false,
      safeAreaOverlay: false
    };
    let bspA11yFontTimer = null;
    let bspA11yButtonEl = null;
    let bspA11yOriginalPostUpdate = null;
    let bspA11yPostUpdateWrapped = false;

    // ----- Config persistence ----------------------------------------------

    function bspA11yLoadConfig() {
      if (typeof idbGet !== 'function') return Promise.resolve();
      return idbGet(STORE_STATE, BSP_A11Y_CONFIG_KEY).then(function (entry) {
        if (entry && entry.value && typeof entry.value === 'object') {
          bspA11yConfig = Object.assign(bspA11yConfig, entry.value);
        }
      }).catch(function () {});
    }

    function bspA11ySaveConfig() {
      if (typeof idbPut !== 'function') return Promise.resolve();
      return idbPut(STORE_STATE, {
        key: BSP_A11Y_CONFIG_KEY,
        value: bspA11yConfig,
        updatedAt: Date.now()
      }).catch(function () {});
    }

    function bspA11yGetConfig() {
      return Object.assign({}, bspA11yConfig);
    }

    function bspA11ySetConfig(next) {
      if (!next || typeof next !== 'object') return;
      bspA11yConfig = Object.assign(bspA11yConfig, next);
      bspA11ySaveConfig();
      bspA11yApplyLive();
    }

    // ----- Live application ------------------------------------------------
    //
    // When any accessibility feature is active, we wrap postUpdate so every
    // outgoing UPDATE payload carries the relevant flags.  The display-side
    // applyAccessibilityHints() helper (in BSP_display.html) reads them.
    //
    // Also updates the live preset via direct panel control if a preset
    // specifies textColor / bgColor.

    function bspA11yApplyLive() {
      bspA11yInstallPostUpdateWrap();
      bspA11yEnforceMinFontSize();
      // Trigger a live update so the display picks up any new flag state.
      try {
        if (typeof scheduleLiveUpdate === 'function') scheduleLiveUpdate();
      } catch (_) {}
    }

    function bspA11yInstallPostUpdateWrap() {
      if (bspA11yPostUpdateWrapped) return;
      if (typeof postUpdate !== 'function') return;
      bspA11yOriginalPostUpdate = postUpdate;
      try {
        // eslint-disable-next-line no-global-assign
        postUpdate = bspA11yPostUpdateWrapper;
      } catch (_) {}
      try { window.postUpdate = bspA11yPostUpdateWrapper; } catch (_) {}
      bspA11yPostUpdateWrapped = true;
    }

    function bspA11yPostUpdateWrapper(payload) {
      const p = payload || {};
      // Only augment when at least one flag is active — otherwise passthrough
      // is a perfect no-op.
      if (bspA11yConfig.autoShadow) p.accessibilityAutoShadow = true;
      if (bspA11yConfig.safeAreaOverlay) p.accessibilitySafeAreaOverlay = true;
      const preset = bspA11yGetActivePreset();
      if (preset && preset.id !== 'none' && preset.textColor) {
        p.accessibilityPresetId = preset.id;
        p.accessibilityTextColor = preset.textColor;
        p.accessibilityBgColor = preset.bgColor;
      }
      return bspA11yOriginalPostUpdate(p);
    }

    function bspA11yGetActivePreset() {
      for (let i = 0; i < BSP_A11Y_PRESETS.length; i += 1) {
        if (BSP_A11Y_PRESETS[i].id === bspA11yConfig.presetId) return BSP_A11Y_PRESETS[i];
      }
      return null;
    }

    // ----- Minimum font-size guardrail -------------------------------------
    //
    // Polls the known panel font-size inputs every 2s and clamps values
    // below the configured floor.  Avoids mutating DOM when the minimum is
    // disabled so we don't fight with the operator's adjustments.

    function bspA11yEnforceMinFontSize() {
      if (bspA11yFontTimer) {
        clearInterval(bspA11yFontTimer);
        bspA11yFontTimer = null;
      }
      if (!bspA11yConfig.minFontSize || bspA11yConfig.minFontSize <= 0) return;
      bspA11yFontTimer = setInterval(bspA11yCheckFontSizes, BSP_A11Y_FONT_CHECK_MS);
    }

    function bspA11yCheckFontSizes() {
      const min = Number(bspA11yConfig.minFontSize) || 0;
      if (min <= 0) return;
      const ids = [
        'font-size-full',
        'font-size-lt',
        'lt-font-songs',
        'lt-font-bible',
        'song-full-font',
        'bible-full-font'
      ];
      let clamped = false;
      ids.forEach(function (id) {
        const el = document.getElementById(id);
        if (!el || el.type !== 'number' && el.tagName !== 'INPUT') return;
        const v = Number(el.value);
        if (Number.isFinite(v) && v > 0 && v < min) {
          el.value = String(min);
          // Fire input event so the panel's own listeners react.
          try {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } catch (_) {}
          clamped = true;
        }
      });
      if (clamped && typeof showToast === 'function') {
        showToast('Min font size enforced (' + min + 'px)');
      }
    }

    // ----- Config modal UI -------------------------------------------------

    function bspA11yInjectStyles() {
      if (document.getElementById('bsp-a11y-styles')) return;
      const css = `
        #bsp-a11y-modal {
          background: #12151d;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 14px;
          padding: 20px 22px;
          width: min(580px, 94vw);
          max-height: 86vh;
          display: flex;
          flex-direction: column;
          color: #e8eaed;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          box-shadow: 0 24px 60px rgba(0,0,0,0.55);
        }
        #bsp-a11y-modal h2 { margin: 0 0 6px 0; font-size: 18px; font-weight: 700; }
        #bsp-a11y-modal .bsp-a11y-sub { margin: 0 0 14px 0; font-size: 12px; color: #9aa0a6; }
        #bsp-a11y-modal .bsp-a11y-section {
          margin-bottom: 14px;
          padding: 12px 14px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          background: rgba(255,255,255,0.02);
        }
        #bsp-a11y-modal .bsp-a11y-section-title {
          font-size: 11px;
          color: #9aa0a6;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 8px;
        }
        #bsp-a11y-modal .bsp-a11y-preset-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 4px;
          cursor: pointer;
          border-radius: 6px;
        }
        #bsp-a11y-modal .bsp-a11y-preset-row:hover { background: rgba(255,255,255,0.04); }
        #bsp-a11y-modal .bsp-a11y-preset-swatch {
          width: 44px;
          height: 28px;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.12);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          flex: 0 0 auto;
        }
        #bsp-a11y-modal .bsp-a11y-preset-name {
          flex: 1 1 auto;
          font-size: 12px;
        }
        #bsp-a11y-modal .bsp-a11y-preset-ratio {
          font-size: 10px;
          color: #9aa0a6;
          font-family: ui-monospace, Menlo, monospace;
        }
        #bsp-a11y-modal .bsp-a11y-field {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }
        #bsp-a11y-modal .bsp-a11y-field label { font-size: 12px; flex: 1 1 auto; }
        #bsp-a11y-modal .bsp-a11y-field input[type="number"] {
          width: 72px;
          background: #0a0d14;
          color: #e8eaed;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 6px;
          padding: 6px 8px;
          font-size: 12px;
        }
        #bsp-a11y-modal .bsp-a11y-field input[type="range"] { flex: 1 1 auto; }
        #bsp-a11y-modal .bsp-a11y-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 10px;
        }
      `;
      const style = document.createElement('style');
      style.id = 'bsp-a11y-styles';
      style.textContent = css;
      document.head.appendChild(style);
    }

    function bspA11yOpenConfigModal() {
      bspA11yInjectStyles();
      const existing = document.getElementById('bsp-sr-modal-backdrop');
      if (existing) existing.remove();
      const backdrop = document.createElement('div');
      backdrop.id = 'bsp-sr-modal-backdrop';
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) backdrop.remove();
      });
      const modal = document.createElement('div');
      modal.id = 'bsp-a11y-modal';
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);

      const title = document.createElement('h2');
      title.textContent = 'Accessibility & Readability';
      modal.appendChild(title);
      const sub = document.createElement('p');
      sub.className = 'bsp-a11y-sub';
      sub.textContent = 'WCAG-AA contrast presets, minimum font size, auto drop-shadow, and a safe-area overlay for the stream view.';
      modal.appendChild(sub);

      // Preset section
      const presetSec = document.createElement('div');
      presetSec.className = 'bsp-a11y-section';
      const presetTitle = document.createElement('div');
      presetTitle.className = 'bsp-a11y-section-title';
      presetTitle.textContent = 'Contrast preset';
      presetSec.appendChild(presetTitle);
      const presetState = { id: bspA11yConfig.presetId };
      BSP_A11Y_PRESETS.forEach(function (p) {
        const row = document.createElement('div');
        row.className = 'bsp-a11y-preset-row';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'bsp-a11y-preset';
        radio.value = p.id;
        radio.checked = presetState.id === p.id;
        radio.addEventListener('change', function () {
          presetState.id = p.id;
        });
        row.appendChild(radio);
        const sw = document.createElement('div');
        sw.className = 'bsp-a11y-preset-swatch';
        if (p.id !== 'none' && p.textColor) {
          sw.style.background = p.bgColor;
          sw.style.color = p.textColor;
          sw.textContent = 'Aa';
        } else {
          sw.textContent = '—';
          sw.style.color = '#6b7280';
        }
        row.appendChild(sw);
        const name = document.createElement('div');
        name.className = 'bsp-a11y-preset-name';
        name.textContent = p.name;
        row.appendChild(name);
        if (p.minContrast > 0) {
          const ratio = document.createElement('div');
          ratio.className = 'bsp-a11y-preset-ratio';
          ratio.textContent = p.minContrast.toFixed(1) + ':1';
          row.appendChild(ratio);
        }
        row.addEventListener('click', function () { radio.checked = true; presetState.id = p.id; });
        presetSec.appendChild(row);
      });
      modal.appendChild(presetSec);

      // Min font size
      const fontSec = document.createElement('div');
      fontSec.className = 'bsp-a11y-section';
      const fontTitle = document.createElement('div');
      fontTitle.className = 'bsp-a11y-section-title';
      fontTitle.textContent = 'Minimum font size (0 = off)';
      fontSec.appendChild(fontTitle);
      const fontField = document.createElement('div');
      fontField.className = 'bsp-a11y-field';
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '60';
      slider.step = '1';
      slider.value = String(bspA11yConfig.minFontSize || 0);
      const numInput = document.createElement('input');
      numInput.type = 'number';
      numInput.min = '0';
      numInput.max = '60';
      numInput.value = String(bspA11yConfig.minFontSize || 0);
      slider.addEventListener('input', function () { numInput.value = slider.value; });
      numInput.addEventListener('input', function () { slider.value = numInput.value; });
      fontField.appendChild(slider);
      fontField.appendChild(numInput);
      fontSec.appendChild(fontField);
      modal.appendChild(fontSec);

      // Checkboxes
      const optSec = document.createElement('div');
      optSec.className = 'bsp-a11y-section';
      const optTitle = document.createElement('div');
      optTitle.className = 'bsp-a11y-section-title';
      optTitle.textContent = 'Options';
      optSec.appendChild(optTitle);
      const mkCheck = function (labelText, initial) {
        const row = document.createElement('div');
        row.className = 'bsp-a11y-field';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!initial;
        const lbl = document.createElement('label');
        lbl.textContent = labelText;
        lbl.style.cursor = 'pointer';
        lbl.addEventListener('click', function () { cb.checked = !cb.checked; });
        row.appendChild(cb);
        row.appendChild(lbl);
        optSec.appendChild(row);
        return cb;
      };
      const shadowCb = mkCheck('Auto drop-shadow on ambiguous backgrounds', bspA11yConfig.autoShadow);
      const safeCb = mkCheck('Show safe-area overlay on display (90% TV safe)', bspA11yConfig.safeAreaOverlay);
      modal.appendChild(optSec);

      // Actions
      const actions = document.createElement('div');
      actions.className = 'bsp-a11y-actions';
      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'bsp-sr-btn';
      resetBtn.textContent = 'Reset';
      resetBtn.addEventListener('click', function () {
        bspA11ySetConfig({ presetId: 'none', minFontSize: 0, autoShadow: false, safeAreaOverlay: false });
        backdrop.remove();
        if (typeof showToast === 'function') showToast('Accessibility preset reset');
      });
      actions.appendChild(resetBtn);
      const applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.className = 'bsp-sr-btn bsp-sr-btn-accent';
      applyBtn.textContent = 'Apply';
      applyBtn.addEventListener('click', function () {
        bspA11ySetConfig({
          presetId: presetState.id,
          minFontSize: Number(numInput.value) || 0,
          autoShadow: shadowCb.checked,
          safeAreaOverlay: safeCb.checked
        });
        backdrop.remove();
        if (typeof showToast === 'function') showToast('Accessibility settings applied');
      });
      actions.appendChild(applyBtn);
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'bsp-sr-btn';
      closeBtn.textContent = 'Close';
      closeBtn.addEventListener('click', function () { backdrop.remove(); });
      actions.appendChild(closeBtn);
      modal.appendChild(actions);
    }

    // ----- Panic bar button + init ----------------------------------------

    function bspA11yInstallPanicBarButton() {
      if (bspA11yButtonEl) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bsp-sr-btn';
      btn.textContent = 'A11y';
      btn.title = 'Accessibility & readability';
      btn.addEventListener('click', bspA11yOpenConfigModal);
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
          'position:fixed;top:8px;right:330px;z-index:9500;' +
          'background:#1b1f2a;color:#e8eaed;border:1px solid rgba(255,255,255,0.18);' +
          'padding:6px 10px;border-radius:6px;font:600 12px -apple-system,sans-serif;cursor:pointer;';
        document.body.appendChild(btn);
      }
      bspA11yButtonEl = btn;
    }

    function bspA11yInit() {
      if (bspA11yInitialized) return;
      bspA11yInitialized = true;
      bspA11yLoadConfig().then(function () {
        bspA11yInstallPanicBarButton();
        bspA11yApplyLive();
        if (window.BSPCommands && typeof window.BSPCommands.register === 'function') {
          window.BSPCommands.register('a11y.openConfig', {
            label: 'A11y: Open config',
            category: 'accessibility',
            run: function () { bspA11yOpenConfigModal(); }
          });
          window.BSPCommands.register('a11y.toggleSafeArea', {
            label: 'A11y: Toggle safe-area overlay',
            category: 'accessibility',
            run: function () {
              bspA11ySetConfig({ safeAreaOverlay: !bspA11yConfig.safeAreaOverlay });
            }
          });
        }
      }).catch(function (err) {
        try { console.error('[BSP A11y] init failed', err); } catch (_) {}
      });
    }

    window.BSPA11y = {
      version: BSP_A11Y_VERSION,
      init: bspA11yInit,
      getConfig: bspA11yGetConfig,
      setConfig: bspA11ySetConfig,
      openConfigModal: bspA11yOpenConfigModal,
      presets: BSP_A11Y_PRESETS.slice()
    };

    window.addEventListener('load', function () {
      const start = Date.now();
      const wait = setInterval(function () {
        const ready = (typeof stateReady !== 'undefined' && stateReady);
        if (ready || Date.now() - start > 8000) {
          clearInterval(wait);
          bspA11yInit();
        }
      }, 100);
    });

    // =============================================================
    // END OF FILE — Bible Song Pro Accessibility Presets
    // =============================================================
