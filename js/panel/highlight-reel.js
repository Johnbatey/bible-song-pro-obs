    // =============================================================
    // Bible Song Pro — Service Highlight Reel (P3 #19)
    // =============================================================
    //
    // Operators tag moments while a service is running ("Mark").  The
    // timestamps are stored in a per-service highlight log and can be
    // exported as a YouTube chapter list, SRT subtitle file, or plain
    // CSV.  Designed so a volunteer editor can turn the Sunday morning
    // stream into a highlight reel without rewatching the full VOD.
    //
    // Timestamps are relative to the current service start — the
    // module records an anchor when the first highlight is marked, or
    // when the operator explicitly starts a service via the P0 session
    // tracker.  Chapters under 3 seconds apart are merged so a
    // double-click doesn't produce noise.
    //
    // Loaded after accessibility-presets.js.
    // =============================================================

    // ----- Constants & state -----------------------------------------------

    const BSP_HR_VERSION = 1;
    const BSP_HR_STORE_KEY = 'highlightReel';
    const BSP_HR_DEDUPE_MS = 3000;

    let bspHrInitialized = false;
    let bspHrMarks = []; // {ts, relativeMs, label, type, songId?, title?}
    let bspHrAnchorTs = 0; // service-start timestamp (0 = not started)
    let bspHrLastMarkAt = 0;
    let bspHrButtonEl = null;
    let bspHrModalEl = null;

    // ----- IDB persistence -------------------------------------------------

    function bspHrLoad() {
      if (typeof idbGet !== 'function') return Promise.resolve();
      return idbGet(STORE_STATE, BSP_HR_STORE_KEY).then(function (entry) {
        if (entry && entry.value && typeof entry.value === 'object') {
          bspHrMarks = Array.isArray(entry.value.marks) ? entry.value.marks : [];
          bspHrAnchorTs = Number(entry.value.anchorTs) || 0;
        }
      }).catch(function () {});
    }

    function bspHrSave() {
      if (typeof idbPut !== 'function') return Promise.resolve();
      return idbPut(STORE_STATE, {
        key: BSP_HR_STORE_KEY,
        value: { marks: bspHrMarks, anchorTs: bspHrAnchorTs },
        updatedAt: Date.now()
      }).catch(function () {});
    }

    // ----- Marking ---------------------------------------------------------

    function bspHrMark(label, opts) {
      const now = Date.now();
      // Dedupe rapid-fire clicks.
      if (now - bspHrLastMarkAt < BSP_HR_DEDUPE_MS) {
        if (typeof showToast === 'function') showToast('Already marked (debounce)');
        return null;
      }
      bspHrLastMarkAt = now;
      if (!bspHrAnchorTs) bspHrAnchorTs = now;
      const relativeMs = now - bspHrAnchorTs;
      const mark = {
        ts: now,
        relativeMs: relativeMs,
        label: String(label || 'Mark'),
        type: (opts && opts.type) ? String(opts.type) : 'manual'
      };
      // Auto-attach the currently live song/bible item, if any.
      try {
        if (typeof isLive !== 'undefined' && isLive && typeof livePointer !== 'undefined' && livePointer) {
          if (livePointer.kind === 'songs' && typeof songs !== 'undefined' && Array.isArray(songs)) {
            const song = songs[livePointer.index];
            if (song) {
              mark.songId = song.id || null;
              mark.title = song.title || '';
              if (!opts || !opts.type) mark.type = 'song';
            }
          } else if (livePointer.kind === 'bible') {
            mark.type = 'bible';
          }
        }
      } catch (_) {}
      bspHrMarks.push(mark);
      bspHrSave();
      if (typeof showToast === 'function') {
        showToast('Highlight marked @ ' + bspHrFormatTime(relativeMs));
      }
      bspHrRenderModalIfOpen();
      return mark;
    }

    function bspHrDeleteMark(index) {
      if (index < 0 || index >= bspHrMarks.length) return;
      bspHrMarks.splice(index, 1);
      bspHrSave();
      bspHrRenderModalIfOpen();
    }

    function bspHrClearAll() {
      if (!bspHrMarks.length) return;
      if (typeof confirm === 'function' && !confirm('Clear all highlights for this service?')) return;
      bspHrMarks = [];
      bspHrAnchorTs = 0;
      bspHrSave();
      bspHrRenderModalIfOpen();
      if (typeof showToast === 'function') showToast('Highlights cleared');
    }

    function bspHrStartNewService() {
      bspHrMarks = [];
      bspHrAnchorTs = Date.now();
      bspHrSave();
      bspHrRenderModalIfOpen();
      if (typeof showToast === 'function') showToast('Highlight reel: new service started');
    }

    // ----- Time formatting -------------------------------------------------

    function bspHrFormatTime(ms) {
      const total = Math.max(0, Math.floor(ms / 1000));
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      const pad = function (n) { return n < 10 ? '0' + n : String(n); };
      return (h > 0 ? h + ':' : '') + pad(m) + ':' + pad(s);
    }

    function bspHrFormatTimeSrt(ms) {
      const total = Math.max(0, ms);
      const h = Math.floor(total / 3600000);
      const m = Math.floor((total % 3600000) / 60000);
      const s = Math.floor((total % 60000) / 1000);
      const msOut = total % 1000;
      const pad = function (n, w) {
        let out = String(n);
        while (out.length < w) out = '0' + out;
        return out;
      };
      return pad(h, 2) + ':' + pad(m, 2) + ':' + pad(s, 2) + ',' + pad(msOut, 3);
    }

    // ----- Exports ---------------------------------------------------------

    function bspHrExportYouTubeChapters() {
      // YouTube chapter format: H:MM:SS Chapter title, first entry must be 0:00
      const lines = [];
      if (!bspHrMarks.length) return '';
      // Ensure a 0:00 entry exists.
      if (bspHrMarks[0].relativeMs > 0) {
        lines.push('0:00 Service start');
      }
      bspHrMarks.forEach(function (m) {
        const time = bspHrFormatTime(m.relativeMs);
        const label = m.title ? (m.label === 'Mark' ? m.title : m.label + ' — ' + m.title) : m.label;
        lines.push(time + ' ' + label);
      });
      return lines.join('\n');
    }

    function bspHrExportSrt() {
      // Each mark becomes a 3-second subtitle cue so you can overlay chapter
      // markers on the VOD timeline while editing.
      const lines = [];
      bspHrMarks.forEach(function (m, idx) {
        const start = m.relativeMs;
        const end = start + 3000;
        lines.push(String(idx + 1));
        lines.push(bspHrFormatTimeSrt(start) + ' --> ' + bspHrFormatTimeSrt(end));
        lines.push(m.title ? (m.label + ' — ' + m.title) : m.label);
        lines.push('');
      });
      return lines.join('\n');
    }

    function bspHrExportCsv() {
      const header = 'Timestamp,Relative,Type,Label,Title,SongId';
      const rows = bspHrMarks.map(function (m) {
        const d = new Date(m.ts);
        const abs = d.toISOString();
        return [
          abs,
          bspHrFormatTime(m.relativeMs),
          m.type || '',
          (m.label || '').replace(/,/g, ' '),
          (m.title || '').replace(/,/g, ' '),
          m.songId || ''
        ].join(',');
      });
      return header + '\n' + rows.join('\n');
    }

    function bspHrDownloadText(filename, text) {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    function bspHrCopyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          if (typeof showToast === 'function') showToast('Copied to clipboard');
        }).catch(function () {});
      } else {
        try { console.log(text); } catch (_) {}
        if (typeof showToast === 'function') showToast('Logged to console');
      }
    }

    // ----- Modal UI --------------------------------------------------------

    function bspHrInjectStyles() {
      if (document.getElementById('bsp-hr-styles')) return;
      const css = `
        #bsp-hr-modal {
          background: #12151d;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 14px;
          padding: 20px 22px;
          width: min(620px, 94vw);
          max-height: 86vh;
          display: flex;
          flex-direction: column;
          color: #e8eaed;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          box-shadow: 0 24px 60px rgba(0,0,0,0.55);
        }
        #bsp-hr-modal h2 { margin: 0 0 6px; font-size: 18px; font-weight: 700; }
        #bsp-hr-modal .bsp-hr-sub { margin: 0 0 14px; font-size: 12px; color: #9aa0a6; }
        #bsp-hr-modal .bsp-hr-status {
          font-size: 12px;
          color: #9aa0a6;
          margin-bottom: 10px;
          display: flex;
          gap: 10px;
        }
        #bsp-hr-modal .bsp-hr-status strong { color: #e8eaed; }
        #bsp-hr-modal .bsp-hr-list {
          flex: 1 1 auto;
          overflow: auto;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          background: rgba(0,0,0,0.2);
          margin-bottom: 12px;
        }
        #bsp-hr-modal .bsp-hr-empty {
          padding: 28px 16px;
          text-align: center;
          color: #9aa0a6;
          font-size: 13px;
        }
        #bsp-hr-modal .bsp-hr-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        #bsp-hr-modal .bsp-hr-row:last-child { border-bottom: none; }
        #bsp-hr-modal .bsp-hr-time {
          font-family: ui-monospace, Menlo, monospace;
          font-size: 12px;
          color: #80ffe0;
          min-width: 60px;
        }
        #bsp-hr-modal .bsp-hr-label {
          flex: 1 1 auto;
          font-size: 12px;
        }
        #bsp-hr-modal .bsp-hr-label .t { font-weight: 600; }
        #bsp-hr-modal .bsp-hr-label .s { font-size: 10px; color: #9aa0a6; }
        #bsp-hr-modal .bsp-hr-type {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #9aa0a6;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 4px;
          padding: 2px 6px;
        }
        #bsp-hr-modal .bsp-hr-actions {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
        }
        #bsp-hr-modal .bsp-hr-actions-group {
          display: flex;
          gap: 6px;
        }
        #bsp-hr-modal .bsp-hr-export-row {
          display: flex;
          gap: 6px;
          margin-bottom: 10px;
        }
      `;
      const style = document.createElement('style');
      style.id = 'bsp-hr-styles';
      style.textContent = css;
      document.head.appendChild(style);
    }

    function bspHrOpenModal() {
      bspHrInjectStyles();
      const existing = document.getElementById('bsp-sr-modal-backdrop');
      if (existing) existing.remove();
      const backdrop = document.createElement('div');
      backdrop.id = 'bsp-sr-modal-backdrop';
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) backdrop.remove();
      });
      const modal = document.createElement('div');
      modal.id = 'bsp-hr-modal';
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);
      bspHrModalEl = modal;
      bspHrRenderModal();
    }

    function bspHrRenderModalIfOpen() {
      if (document.getElementById('bsp-hr-modal')) bspHrRenderModal();
    }

    function bspHrRenderModal() {
      const modal = bspHrModalEl;
      if (!modal) return;
      modal.innerHTML = '';
      const title = document.createElement('h2');
      title.textContent = 'Highlight Reel';
      modal.appendChild(title);
      const sub = document.createElement('p');
      sub.className = 'bsp-hr-sub';
      sub.textContent = 'Tag moments during the live service, then export as YouTube chapters or SRT for the VOD editor.';
      modal.appendChild(sub);

      const status = document.createElement('div');
      status.className = 'bsp-hr-status';
      const anchorText = bspHrAnchorTs
        ? 'Anchor: ' + new Date(bspHrAnchorTs).toLocaleTimeString()
        : 'Anchor not set';
      status.innerHTML = '<span>' + bspHrMarks.length + ' mark' + (bspHrMarks.length === 1 ? '' : 's') + '</span>' +
        '<span>' + anchorText + '</span>';
      modal.appendChild(status);

      const exportRow = document.createElement('div');
      exportRow.className = 'bsp-hr-export-row';
      const mkExport = function (label, fn) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bsp-sr-btn';
        b.textContent = label;
        b.addEventListener('click', fn);
        return b;
      };
      exportRow.appendChild(mkExport('Copy YT chapters', function () {
        bspHrCopyText(bspHrExportYouTubeChapters());
      }));
      exportRow.appendChild(mkExport('Download SRT', function () {
        bspHrDownloadText('bsp-highlight-reel.srt', bspHrExportSrt());
      }));
      exportRow.appendChild(mkExport('Download CSV', function () {
        bspHrDownloadText('bsp-highlight-reel.csv', bspHrExportCsv());
      }));
      modal.appendChild(exportRow);

      const list = document.createElement('div');
      list.className = 'bsp-hr-list';
      if (!bspHrMarks.length) {
        const empty = document.createElement('div');
        empty.className = 'bsp-hr-empty';
        empty.textContent = 'No marks yet. Click "Mark Now" in the panic bar during the service.';
        list.appendChild(empty);
      } else {
        bspHrMarks.slice().sort(function (a, b) { return a.relativeMs - b.relativeMs; }).forEach(function (m, idx) {
          const row = document.createElement('div');
          row.className = 'bsp-hr-row';
          const time = document.createElement('div');
          time.className = 'bsp-hr-time';
          time.textContent = bspHrFormatTime(m.relativeMs);
          row.appendChild(time);
          const lbl = document.createElement('div');
          lbl.className = 'bsp-hr-label';
          lbl.innerHTML = '<div class="t">' + bspHrEscape(m.title || m.label) + '</div>' +
            (m.title && m.label && m.label !== 'Mark' ? '<div class="s">' + bspHrEscape(m.label) + '</div>' : '');
          row.appendChild(lbl);
          const type = document.createElement('div');
          type.className = 'bsp-hr-type';
          type.textContent = m.type || 'manual';
          row.appendChild(type);
          const del = document.createElement('button');
          del.type = 'button';
          del.className = 'bsp-sr-btn';
          del.style.cssText = 'font-size:10px;padding:3px 7px;';
          del.textContent = '✕';
          del.addEventListener('click', function () { bspHrDeleteMark(idx); });
          row.appendChild(del);
          list.appendChild(row);
        });
      }
      modal.appendChild(list);

      const actions = document.createElement('div');
      actions.className = 'bsp-hr-actions';
      const left = document.createElement('div');
      left.className = 'bsp-hr-actions-group';
      const newBtn = document.createElement('button');
      newBtn.type = 'button';
      newBtn.className = 'bsp-sr-btn bsp-sr-btn-warn';
      newBtn.textContent = 'Start new service';
      newBtn.addEventListener('click', bspHrStartNewService);
      left.appendChild(newBtn);
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'bsp-sr-btn bsp-sr-btn-danger';
      clearBtn.textContent = 'Clear all';
      clearBtn.addEventListener('click', bspHrClearAll);
      left.appendChild(clearBtn);
      actions.appendChild(left);

      const right = document.createElement('div');
      right.className = 'bsp-hr-actions-group';
      const markBtn = document.createElement('button');
      markBtn.type = 'button';
      markBtn.className = 'bsp-sr-btn bsp-sr-btn-accent';
      markBtn.textContent = 'Mark Now';
      markBtn.addEventListener('click', function () { bspHrMark('Mark'); });
      right.appendChild(markBtn);
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'bsp-sr-btn';
      closeBtn.textContent = 'Close';
      closeBtn.addEventListener('click', function () {
        const bd = document.getElementById('bsp-sr-modal-backdrop');
        if (bd) bd.remove();
      });
      right.appendChild(closeBtn);
      actions.appendChild(right);
      modal.appendChild(actions);
    }

    function bspHrEscape(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    // ----- Panic bar button + init ----------------------------------------

    function bspHrInstallPanicBarButton() {
      if (bspHrButtonEl) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bsp-sr-btn';
      btn.textContent = 'Mark';
      btn.title = 'Tag a highlight moment (click to mark, dbl-click to open log)';
      // Single click = mark. Double click = open modal.
      let clickTimer = null;
      btn.addEventListener('click', function () {
        if (clickTimer) return;
        clickTimer = setTimeout(function () {
          clickTimer = null;
          bspHrMark('Mark');
        }, 220);
      });
      btn.addEventListener('dblclick', function () {
        if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
        bspHrOpenModal();
      });
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
          'position:fixed;top:8px;right:410px;z-index:9500;' +
          'background:#1b1f2a;color:#e8eaed;border:1px solid rgba(255,255,255,0.18);' +
          'padding:6px 10px;border-radius:6px;font:600 12px -apple-system,sans-serif;cursor:pointer;';
        document.body.appendChild(btn);
      }
      bspHrButtonEl = btn;
    }

    function bspHighlightReelInit() {
      if (bspHrInitialized) return;
      bspHrInitialized = true;
      bspHrLoad().then(function () {
        bspHrInstallPanicBarButton();
        if (window.BSPCommands && typeof window.BSPCommands.register === 'function') {
          window.BSPCommands.register('highlight.mark', {
            label: 'Highlight: Mark now',
            category: 'highlight',
            run: function () { bspHrMark('Mark'); }
          });
          window.BSPCommands.register('highlight.openReport', {
            label: 'Highlight: Open log',
            category: 'highlight',
            run: function () { bspHrOpenModal(); }
          });
          window.BSPCommands.register('highlight.newService', {
            label: 'Highlight: Start new service',
            category: 'highlight',
            run: function () { bspHrStartNewService(); }
          });
        }
      }).catch(function (err) {
        try { console.error('[BSP HighlightReel] init failed', err); } catch (_) {}
      });
    }

    window.BSPHighlightReel = {
      version: BSP_HR_VERSION,
      init: bspHighlightReelInit,
      mark: bspHrMark,
      openModal: bspHrOpenModal,
      clearAll: bspHrClearAll,
      startNewService: bspHrStartNewService,
      exportYouTubeChapters: bspHrExportYouTubeChapters,
      exportSrt: bspHrExportSrt,
      exportCsv: bspHrExportCsv,
      get marks() { return bspHrMarks.slice(); },
      get anchorTs() { return bspHrAnchorTs; }
    };

    window.addEventListener('load', function () {
      const start = Date.now();
      const wait = setInterval(function () {
        const ready = (typeof stateReady !== 'undefined' && stateReady);
        if (ready || Date.now() - start > 8000) {
          clearInterval(wait);
          bspHighlightReelInit();
        }
      }, 100);
    });

    // =============================================================
    // END OF FILE — Bible Song Pro Highlight Reel
    // =============================================================
