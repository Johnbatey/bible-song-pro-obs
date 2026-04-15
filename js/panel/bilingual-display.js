    // =============================================================
    // BibleRhythm AGL — Bilingual Display (P1 #11)
    // =============================================================
    //
    // A "Bilingual" display template that renders primary + secondary
    // language on the same slide for both songs and Bible, using the
    // existing translation pipeline.
    //
    // This module adds a *global* bilingual toggle that augments the
    // outgoing UPDATE payload built by `postUpdate(...)` in
    // sync-and-output.js.  The panel runtime already computes per-song
    // secondary HTML via `getProjectedSongTextPair()` and already ships
    // `bilingualEnabled` / `translatedText` fields on the payload — the
    // job of this module is:
    //
    //   1. expose a one-click "Bilingual: On/Off" toggle on the panic
    //      bar so operators can flip it during a service;
    //   2. persist that toggle across reloads (survives OBS dock close,
    //      crash, browser refresh);
    //   3. wrap `postUpdate` so that when the toggle is ON we force
    //      `bilingualEnabled: true` on the payload and promote the
    //      already-computed `translatedText` (or, failing that, the raw
    //      `translatedLyrics` field on the current song) to a dedicated
    //      `secondaryText` field that BSP_display.html can render;
    //   4. for Bible items, when dual-version Bible mode is NOT already
    //      active, look up the same chapter/verse in a user-configured
    //      "secondary Bible version" (defaulting to the second entry in
    //      the global `bibles` object) and populate `secondaryText` from
    //      there so the display can render it in a stacked layout.
    //
    // Loaded after ccli-reporting.js so we can inject a "Bilingual"
    // button into the #bsp-sr-panic-bar without a second panic bar.
    //
    // Storage: STORE_STATE key 'bilingualDisplayEnabled' (a boolean) and
    // 'bilingualDisplaySecondaryVersion' (a Bible version id string or
    // null).  Writes are fire-and-forget.
    //
    // Non-goals (explicitly NOT built here — see CLAUDE.md §P1 notes):
    //   - A full secondary-Bible-version picker UI.  v1 ships with a
    //     silent fallback to `Object.keys(bibles)[1]` and a JS API
    //     (`window.BSPBilingual.setSecondaryVersion(id)`) for power users
    //     or future UI.
    //   - Translation provider configuration — already handled entirely
    //     by vmix-and-translation.js.
    //   - Live on-the-fly translation — we reuse whatever
    //     `translatedLyrics` the existing workflow has already populated.
    // =============================================================

    // ----- Shared constants ------------------------------------------------

    const BSP_BILINGUAL_VERSION = 1;
    const BSP_BILINGUAL_TOGGLE_KEY = 'bilingualDisplayEnabled';
    const BSP_BILINGUAL_SECONDARY_KEY = 'bilingualDisplaySecondaryVersion';

    // ----- Module state (script-scoped) ------------------------------------

    let bspBilingualInitialized = false;
    let bspBilingualEnabled = false;
    let bspBilingualSecondaryVersionId = null;
    let bspBilingualToggleButtonEl = null;
    let bspBilingualOriginalPostUpdate = null;

    // ----- IDB helpers -----------------------------------------------------
    //
    // Both keys live under STORE_STATE so we don't have to bump the IDB
    // schema version to add a new store.  Loads are tolerant of missing
    // or malformed values — if anything goes wrong we simply default to
    // "off" with no secondary version configured.

    function bspBilingualLoadToggle() {
      if (typeof idbGet !== 'function') return Promise.resolve(false);
      return idbGet(STORE_STATE, BSP_BILINGUAL_TOGGLE_KEY).then(function (entry) {
        if (entry && typeof entry.value === 'boolean') return entry.value;
        return false;
      }).catch(function () { return false; });
    }

    function bspBilingualSaveToggle() {
      if (typeof idbPut !== 'function') return Promise.resolve(false);
      const payload = {
        key: BSP_BILINGUAL_TOGGLE_KEY,
        value: !!bspBilingualEnabled,
        updatedAt: Date.now()
      };
      return idbPut(STORE_STATE, payload).catch(function () { return false; });
    }

    function bspBilingualLoadSecondaryVersion() {
      if (typeof idbGet !== 'function') return Promise.resolve(null);
      return idbGet(STORE_STATE, BSP_BILINGUAL_SECONDARY_KEY).then(function (entry) {
        if (entry && typeof entry.value === 'string' && entry.value) return entry.value;
        return null;
      }).catch(function () { return null; });
    }

    function bspBilingualSaveSecondaryVersion() {
      if (typeof idbPut !== 'function') return Promise.resolve(false);
      const payload = {
        key: BSP_BILINGUAL_SECONDARY_KEY,
        value: bspBilingualSecondaryVersionId || '',
        updatedAt: Date.now()
      };
      return idbPut(STORE_STATE, payload).catch(function () { return false; });
    }

    // ----- Secondary version resolution ------------------------------------
    //
    // Resolve which Bible version to pull secondary verses from.  Order
    // of preference:
    //   1. an explicit id set via `setSecondaryVersion(id)` that exists
    //      in the current `bibles` global;
    //   2. the second entry in `bibles` (whichever one the user happens
    //      to have loaded second — reasonable default);
    //   3. null, in which case Bible items pass through unchanged.

    function bspBilingualResolveSecondaryVersionId() {
      if (typeof bibles !== 'object' || !bibles) return null;
      const ids = Object.keys(bibles);
      if (bspBilingualSecondaryVersionId && ids.indexOf(bspBilingualSecondaryVersionId) !== -1) {
        return bspBilingualSecondaryVersionId;
      }
      if (ids.length >= 2) return ids[1];
      return null;
    }

    // ----- Secondary-text extraction for payloads --------------------------
    //
    // Given an outgoing UPDATE payload, produce the secondary text to
    // stack underneath the primary.  For songs we prefer the
    // already-computed HTML the panel produced in `translatedText` (this
    // is what `getProjectedSongTextPair` returns for the current page
    // slice); if that's missing — e.g. the per-song bilingual flag was
    // never set so the song pipeline didn't compute it — we fall back to
    // the raw `translatedLyrics` field on the current item.
    //
    // For Bible items we can't reuse any pre-computed field: the dual
    // Bible pipeline only runs when dualVersionMode is already on.  So
    // we attempt a live lookup from the resolved secondary version using
    // the same index the primary is at.

    function bspBilingualExtractCurrentSongItem() {
      // `currentItem` is the global song/bible record the operator has
      // focused in the panel.  `livePointer` tracks what's live on air.
      // Prefer the live one when available so the secondary text tracks
      // the actual page being projected.
      try {
        if (typeof livePointer !== 'undefined' && livePointer && livePointer.kind === 'songs') {
          if (typeof songs !== 'undefined' && Array.isArray(songs)) {
            const song = songs[livePointer.index];
            if (song) return song;
          }
        }
      } catch (_) {}
      try {
        if (typeof currentItem !== 'undefined' && currentItem && !currentItem.isBible) {
          return currentItem;
        }
      } catch (_) {}
      return null;
    }

    function bspBilingualGetSongSecondaryText(payload) {
      if (payload && typeof payload.translatedText === 'string' && payload.translatedText.trim()) {
        return payload.translatedText;
      }
      const song = bspBilingualExtractCurrentSongItem();
      if (song && typeof song.translatedLyrics === 'string' && song.translatedLyrics.trim()) {
        // Raw plain-text fallback — escape newlines to <br> so the
        // display renders something sensible without double-processing
        // highlight markup.
        return bspBilingualEscapeAndLineBreak(song.translatedLyrics);
      }
      return '';
    }

    function bspBilingualEscapeAndLineBreak(raw) {
      return String(raw || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\r?\n/g, '<br>');
    }

    function bspBilingualGetSongLanguage(payload) {
      const song = bspBilingualExtractCurrentSongItem();
      if (song && typeof song.translationLanguage === 'string' && song.translationLanguage) {
        return song.translationLanguage;
      }
      return '';
    }

    function bspBilingualGetPrimaryLanguage() {
      try {
        if (typeof currentLanguage === 'string' && currentLanguage) return currentLanguage;
      } catch (_) {}
      return '';
    }

    // ----- Bible secondary lookup ------------------------------------------
    //
    // For Bible items, if dualVersionMode is already on we leave the
    // payload alone — the existing dual-version path already stacks two
    // versions.  Otherwise we try to look up the same book/chapter in
    // the resolved secondary version and, if found, stringify it.

    function bspBilingualGetBibleSecondaryText(payload) {
      if (!payload || !payload.isBible) return '';
      if (payload.dualVersionMode) return ''; // already handled by dual Bible path
      const secondaryVerId = bspBilingualResolveSecondaryVersionId();
      if (!secondaryVerId) return '';
      const primaryVerId = payload.dualVersionPrimaryId || '';
      if (secondaryVerId === primaryVerId) return '';
      try {
        const list = (typeof bibles !== 'undefined' && bibles) ? bibles[secondaryVerId] : null;
        if (!Array.isArray(list)) return '';
        // Find the chapter index on the live item.  The safest way is
        // to match the primary livePointer.index into the secondary
        // version's list — panel code uses the same parallel-index
        // assumption for dual Bible mode.
        let idx = 0;
        try {
          if (typeof livePointer !== 'undefined' && livePointer && livePointer.kind === 'bible') {
            idx = livePointer.index || 0;
          }
        } catch (_) {}
        const secondaryItem = list[idx] || null;
        if (!secondaryItem) return '';
        const raw = (secondaryItem.text || secondaryItem.content || '').trim();
        if (!raw) return '';
        // Crude but safe: render the whole chapter snippet we have.
        // The display will stack this under the primary verse.
        return bspBilingualEscapeAndLineBreak(raw);
      } catch (_) {
        return '';
      }
    }

    // ----- postUpdate wrapper ----------------------------------------------
    //
    // Classic scripts allow top-level `function postUpdate(payload){}`
    // declarations to be reassigned via the bare binding.  This is the
    // same pattern service-reliability.js uses for its broadcastMessage
    // interception — see bspSrInstallPreviewInterception().
    //
    // When the bilingual toggle is OFF this wrapper is transparent: it
    // calls through to the original with the untouched payload.  When
    // ON it mutates a shallow copy of the payload to add/override:
    //
    //   bilingualEnabled: true
    //   secondaryText: <string>
    //   secondaryLanguage: <string>
    //   primaryLanguage: <string>
    //
    // It does NOT modify the original `text` field — stacked rendering
    // already happens panel-side via buildStackedSongBilingualHtml when
    // the per-song flag is on.  The display applies `secondaryText` as
    // an overlay on top of whatever `text` already contains, so if the
    // panel happened to pre-stack we'll overwrite that overlay with an
    // equivalent block (idempotent for the common case).

    function bspBilingualPostUpdateWrapper(payload) {
      if (!bspBilingualEnabled || !payload) {
        return bspBilingualOriginalPostUpdate(payload);
      }
      const augmented = { ...payload };
      let secondaryText = '';
      let secondaryLanguage = '';
      if (payload.isBible) {
        secondaryText = bspBilingualGetBibleSecondaryText(payload);
        if (secondaryText) {
          const secondaryVerId = bspBilingualResolveSecondaryVersionId();
          if (secondaryVerId) secondaryLanguage = secondaryVerId;
        }
      } else {
        secondaryText = bspBilingualGetSongSecondaryText(payload);
        secondaryLanguage = bspBilingualGetSongLanguage(payload);
      }
      if (secondaryText) {
        augmented.bilingualEnabled = true;
        augmented.secondaryText = secondaryText;
        augmented.secondaryLanguage = secondaryLanguage || '';
        augmented.primaryLanguage = bspBilingualGetPrimaryLanguage();
      }
      return bspBilingualOriginalPostUpdate(augmented);
    }

    function bspBilingualInstallPostUpdateWrap() {
      if (bspBilingualOriginalPostUpdate) return;
      if (typeof postUpdate !== 'function') return;
      bspBilingualOriginalPostUpdate = postUpdate;
      try {
        // eslint-disable-next-line no-global-assign
        postUpdate = bspBilingualPostUpdateWrapper;
      } catch (_) {
        try { window.postUpdate = bspBilingualPostUpdateWrapper; } catch (__) {}
      }
      try { window.postUpdate = bspBilingualPostUpdateWrapper; } catch (_) {}
    }

    // ----- Panic bar button ------------------------------------------------

    function bspBilingualInstallPanicBarButton() {
      if (bspBilingualToggleButtonEl) {
        bspBilingualRefreshButtonLabel();
        return;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.title = 'Toggle bilingual (side-by-side) display';
      btn.addEventListener('click', bspBilingualToggle);

      const panicBar = document.getElementById('bsp-sr-panic-bar');
      if (panicBar) {
        btn.className = 'bsp-sr-btn';
        const endBtn = document.getElementById('bsp-sr-end-service');
        if (endBtn && endBtn.parentNode === panicBar) {
          panicBar.insertBefore(btn, endBtn);
        } else {
          panicBar.appendChild(btn);
        }
      } else {
        // Fallback: standalone top-right button, offset so it doesn't
        // collide with the CCLI fallback button.
        btn.style.cssText =
          'position:fixed;top:8px;right:120px;z-index:9500;' +
          'background:#1b1f2a;color:#e8eaed;border:1px solid rgba(255,255,255,0.18);' +
          'padding:6px 10px;border-radius:6px;font:600 12px -apple-system,BlinkMacSystemFont,sans-serif;' +
          'cursor:pointer;';
        document.body.appendChild(btn);
      }
      bspBilingualToggleButtonEl = btn;
      bspBilingualRefreshButtonLabel();
    }

    function bspBilingualRefreshButtonLabel() {
      if (!bspBilingualToggleButtonEl) return;
      bspBilingualToggleButtonEl.textContent = bspBilingualEnabled ? 'Bilingual: On' : 'Bilingual: Off';
      bspBilingualToggleButtonEl.classList.toggle('bsp-sr-btn-accent', !!bspBilingualEnabled);
    }

    // ----- Public actions --------------------------------------------------

    function bspBilingualToggle() {
      bspBilingualEnabled = !bspBilingualEnabled;
      bspBilingualRefreshButtonLabel();
      bspBilingualSaveToggle();
      if (typeof showToast === 'function') {
        showToast(bspBilingualEnabled
          ? 'Bilingual display ON'
          : 'Bilingual display OFF');
      }
      // Nudge the live output so the display picks up the change
      // immediately — without this the operator has to click the next
      // line before the overlay appears.
      try {
        if (typeof scheduleLiveUpdate === 'function') scheduleLiveUpdate();
      } catch (_) {}
    }

    function bspBilingualIsEnabled() {
      return !!bspBilingualEnabled;
    }

    function bspBilingualSetSecondaryVersion(id) {
      bspBilingualSecondaryVersionId = id ? String(id) : null;
      bspBilingualSaveSecondaryVersion();
      try {
        if (typeof scheduleLiveUpdate === 'function') scheduleLiveUpdate();
      } catch (_) {}
    }

    // ----- Main init + boot hook ------------------------------------------

    function bspBilingualInit() {
      if (bspBilingualInitialized) return;
      bspBilingualInitialized = true;
      Promise.all([
        bspBilingualLoadToggle(),
        bspBilingualLoadSecondaryVersion()
      ]).then(function (results) {
        bspBilingualEnabled = !!results[0];
        bspBilingualSecondaryVersionId = results[1] || null;
        bspBilingualInstallPanicBarButton();
        bspBilingualInstallPostUpdateWrap();
      }).catch(function (err) {
        try { console.error('[BSP Bilingual] init failed', err); } catch (_) {}
      });
    }

    // Expose for diagnostics + external callers.
    window.BSPBilingual = {
      version: BSP_BILINGUAL_VERSION,
      init: bspBilingualInit,
      toggle: bspBilingualToggle,
      isEnabled: bspBilingualIsEnabled,
      setSecondaryVersion: bspBilingualSetSecondaryVersion,
      get secondaryVersionId() { return bspBilingualSecondaryVersionId; }
    };

    // Wait for window.onload + stateReady before wiring so the panic
    // bar has definitely been created by service-reliability.js and so
    // that globals like `bibles` and `postUpdate` are available.
    window.addEventListener('load', function () {
      const start = Date.now();
      const wait = setInterval(function () {
        const ready = (typeof stateReady !== 'undefined' && stateReady);
        if (ready || Date.now() - start > 8000) {
          clearInterval(wait);
          bspBilingualInit();
        }
      }, 100);
    });

    // =============================================================
    // END OF FILE — BibleRhythm AGL Bilingual Display
    // =============================================================
