    // =============================================================
    // BibleRhythm AGL — CCLI Reporting (P1 #10)
    // =============================================================
    //
    // Licensed churches are required to report song usage to CCLI.  This
    // module captures a usage entry every time a song goes live, stores
    // CCLI metadata (song number + author) per song without modifying the
    // base song record, and exposes an "Export CCLI Report" modal that
    // filters by date range and generates a compliant CSV download.
    //
    // Storage (all under STORE_STATE to avoid a new IDB store version):
    //
    //   key: 'ccliSongMetadata'
    //     value: { [songId]: { ccliNumber, author, copyright } }
    //
    //   key: 'ccliUsageLog'
    //     value: [ { ts, songId, title, ccliNumber, author } ]
    //
    // Capture strategy: a 2-second poller observes the `livePointer` +
    // `isLive` globals from songs-and-bible.js.  When a new song-kind
    // livePointer appears (different songId than last captured), we log
    // a usage entry.  De-duplicated within a 2-minute window so repeat
    // projections of the same song within one service count once.
    //
    // Loaded after service-reliability.js so we can inject a "CCLI"
    // button into #bsp-sr-panic-bar without a second panic bar.
    // =============================================================

    // ----- Shared constants ------------------------------------------------

    const BSP_CCLI_VERSION = 1;
    const BSP_CCLI_METADATA_KEY = 'ccliSongMetadata';
    const BSP_CCLI_USAGE_LOG_KEY = 'ccliUsageLog';
    const BSP_CCLI_POLL_MS = 2000;
    const BSP_CCLI_DEDUPE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
    const BSP_CCLI_USAGE_LOG_MAX = 5000; // ring buffer cap

    // ----- Module state (script-scoped) ------------------------------------

    let bspCcliInitialized = false;
    let bspCcliMetadata = Object.create(null); // {songId → {ccliNumber, author, copyright}}
    let bspCcliUsageLog = []; // in-memory mirror of IDB record
    let bspCcliPollTimer = null;
    let bspCcliLastCapturedSongId = null;
    let bspCcliLastCapturedAt = 0;
    let bspCcliModalEl = null;
    let bspCcliOpenButtonEl = null;

    // ----- IDB helpers -----------------------------------------------------
    //
    // Both records live in STORE_STATE so we don't have to bump the IDB
    // version to add a new store.  Writes are fire-and-forget — CCLI
    // reporting must never block the UI.

    function bspCcliLoadMetadata() {
      if (typeof idbGet !== 'function') return Promise.resolve({});
      return idbGet(STORE_STATE, BSP_CCLI_METADATA_KEY).then(function (entry) {
        if (entry && entry.value && typeof entry.value === 'object') {
          return entry.value;
        }
        return {};
      }).catch(function () { return {}; });
    }

    function bspCcliSaveMetadata() {
      if (typeof idbPut !== 'function') return Promise.resolve(false);
      const payload = {
        key: BSP_CCLI_METADATA_KEY,
        value: bspCcliMetadata,
        updatedAt: Date.now()
      };
      return idbPut(STORE_STATE, payload).catch(function () { return false; });
    }

    function bspCcliLoadUsageLog() {
      if (typeof idbGet !== 'function') return Promise.resolve([]);
      return idbGet(STORE_STATE, BSP_CCLI_USAGE_LOG_KEY).then(function (entry) {
        if (entry && Array.isArray(entry.value)) return entry.value;
        return [];
      }).catch(function () { return []; });
    }

    function bspCcliSaveUsageLog() {
      if (typeof idbPut !== 'function') return Promise.resolve(false);
      // Cap the log at BSP_CCLI_USAGE_LOG_MAX by dropping oldest entries.
      if (bspCcliUsageLog.length > BSP_CCLI_USAGE_LOG_MAX) {
        bspCcliUsageLog = bspCcliUsageLog.slice(-BSP_CCLI_USAGE_LOG_MAX);
      }
      const payload = {
        key: BSP_CCLI_USAGE_LOG_KEY,
        value: bspCcliUsageLog,
        updatedAt: Date.now()
      };
      return idbPut(STORE_STATE, payload).catch(function () { return false; });
    }

    function bspCcliGetSongMetadata(songId) {
      if (!songId) return { ccliNumber: '', author: '', copyright: '' };
      const entry = bspCcliMetadata[songId];
      if (!entry || typeof entry !== 'object') {
        return { ccliNumber: '', author: '', copyright: '' };
      }
      return {
        ccliNumber: String(entry.ccliNumber || ''),
        author: String(entry.author || ''),
        copyright: String(entry.copyright || '')
      };
    }

    function bspCcliSetSongMetadata(songId, updates) {
      if (!songId) return;
      const current = bspCcliGetSongMetadata(songId);
      const next = {
        ccliNumber: updates && 'ccliNumber' in updates ? String(updates.ccliNumber || '') : current.ccliNumber,
        author:     updates && 'author' in updates     ? String(updates.author || '')     : current.author,
        copyright:  updates && 'copyright' in updates  ? String(updates.copyright || '')  : current.copyright
      };
      bspCcliMetadata[songId] = next;
      bspCcliSaveMetadata();
    }

    // ----- Live-song capture poller ---------------------------------------
    //
    // Observes `isLive` + `livePointer` from songs-and-bible.js on a 2s
    // tick.  When a new song-kind pointer is observed (different songId
    // or same song after the dedupe window has elapsed), record a usage
    // entry.  Bible items are ignored — CCLI only covers song usage.

    function bspCcliStartPoller() {
      if (bspCcliPollTimer) return;
      bspCcliPollTimer = setInterval(bspCcliTickCapture, BSP_CCLI_POLL_MS);
    }

    function bspCcliTickCapture() {
      try {
        if (typeof isLive === 'undefined' || !isLive) return;
        if (typeof livePointer === 'undefined' || !livePointer) return;
        if (livePointer.kind !== 'songs') return;
        if (typeof songs === 'undefined' || !Array.isArray(songs)) return;
        const idx = Number(livePointer.index);
        if (!Number.isFinite(idx) || idx < 0 || idx >= songs.length) return;
        const song = songs[idx];
        if (!song || !song.id) return;
        const songId = String(song.id);
        const now = Date.now();
        // De-duplicate consecutive captures of the same song within the window.
        if (bspCcliLastCapturedSongId === songId &&
            now - bspCcliLastCapturedAt < BSP_CCLI_DEDUPE_WINDOW_MS) {
          return;
        }
        bspCcliLastCapturedSongId = songId;
        bspCcliLastCapturedAt = now;
        const meta = bspCcliGetSongMetadata(songId);
        bspCcliUsageLog.push({
          ts: now,
          songId: songId,
          title: String(song.title || '(untitled)'),
          ccliNumber: meta.ccliNumber,
          author: meta.author
        });
        bspCcliSaveUsageLog();
      } catch (_) { /* never throw from ticker */ }
    }

    // Expose a manual-capture hook for callers that want to force an entry
    // (e.g., a "Mark as used" button on a song row).  Not wired into the UI
    // yet but available as window.BSPCcli.captureCurrent().
    function bspCcliCaptureCurrent() {
      bspCcliLastCapturedSongId = null; // bypass dedupe
      bspCcliLastCapturedAt = 0;
      bspCcliTickCapture();
    }

    // ----- CCLI report modal ----------------------------------------------
    //
    // Reuses the styling from service-reliability.js (#bsp-sr-modal-backdrop
    // + #bsp-sr-modal + .bsp-sr-btn) with a handful of extra rules layered
    // on top for the table, date inputs, and the inline metadata editor.

    function bspCcliInjectStyles() {
      if (document.getElementById('bsp-ccli-styles')) return;
      const css = `
        #bsp-ccli-modal {
          background: #12151d;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 14px;
          padding: 20px 22px;
          width: min(760px, 94vw);
          max-height: 86vh;
          display: flex;
          flex-direction: column;
          color: #e8eaed;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          box-shadow: 0 24px 60px rgba(0,0,0,0.55);
        }
        #bsp-ccli-modal h2 { margin: 0 0 6px 0; font-size: 18px; font-weight: 700; }
        #bsp-ccli-modal .bsp-ccli-sub { margin: 0 0 14px 0; font-size: 12px; color: #9aa0a6; }
        #bsp-ccli-modal .bsp-ccli-range {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 12px;
          padding: 10px 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
        }
        #bsp-ccli-modal .bsp-ccli-range label {
          font-size: 11px;
          color: #9aa0a6;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        #bsp-ccli-modal .bsp-ccli-range input[type="date"] {
          background: #0a0d14;
          border: 1px solid rgba(255,255,255,0.12);
          color: #e8eaed;
          border-radius: 6px;
          padding: 5px 8px;
          font-size: 12px;
        }
        #bsp-ccli-modal .bsp-ccli-preset-chip {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.14);
          color: #c8cdd3;
          padding: 4px 9px;
          font-size: 11px;
          border-radius: 999px;
          cursor: pointer;
        }
        #bsp-ccli-modal .bsp-ccli-preset-chip:hover { background: rgba(255,255,255,0.06); }
        #bsp-ccli-modal .bsp-ccli-preset-chip.active { background: #0e3a3a; border-color: #175a5a; color: #80ffe0; }
        #bsp-ccli-modal .bsp-ccli-summary {
          font-size: 12px;
          color: #9aa0a6;
          margin-bottom: 8px;
        }
        #bsp-ccli-modal .bsp-ccli-table-wrap {
          flex: 1 1 auto;
          overflow: auto;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          background: rgba(0,0,0,0.2);
        }
        #bsp-ccli-modal table.bsp-ccli-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        #bsp-ccli-modal .bsp-ccli-table th,
        #bsp-ccli-modal .bsp-ccli-table td {
          padding: 8px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          text-align: left;
          vertical-align: top;
        }
        #bsp-ccli-modal .bsp-ccli-table th {
          background: rgba(255,255,255,0.03);
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #9aa0a6;
          position: sticky;
          top: 0;
          z-index: 1;
        }
        #bsp-ccli-modal .bsp-ccli-table tr:hover { background: rgba(255,255,255,0.02); }
        #bsp-ccli-modal .bsp-ccli-table .bsp-ccli-missing {
          color: #ff8a8a;
          font-style: italic;
        }
        #bsp-ccli-modal .bsp-ccli-edit-btn {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.14);
          color: #c8cdd3;
          font-size: 10px;
          padding: 3px 7px;
          border-radius: 4px;
          cursor: pointer;
        }
        #bsp-ccli-modal .bsp-ccli-edit-btn:hover { background: rgba(255,255,255,0.06); }
        #bsp-ccli-modal .bsp-ccli-editor-row td {
          background: rgba(30, 40, 60, 0.4);
        }
        #bsp-ccli-modal .bsp-ccli-editor-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 2fr auto;
          gap: 6px;
        }
        #bsp-ccli-modal .bsp-ccli-editor-grid input {
          background: #0a0d14;
          border: 1px solid rgba(255,255,255,0.12);
          color: #e8eaed;
          border-radius: 4px;
          padding: 5px 7px;
          font-size: 12px;
        }
        #bsp-ccli-modal .bsp-ccli-empty {
          padding: 24px 10px;
          text-align: center;
          color: #9aa0a6;
          font-size: 13px;
        }
        #bsp-ccli-modal .bsp-ccli-actions {
          margin-top: 14px;
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }
        #bsp-ccli-modal .bsp-ccli-actions-right {
          display: flex;
          gap: 8px;
        }
      `;
      const style = document.createElement('style');
      style.id = 'bsp-ccli-styles';
      style.textContent = css;
      document.head.appendChild(style);
    }

    function bspCcliOpenReportModal() {
      bspCcliInjectStyles();
      // Tear down any previous instance.
      const existing = document.getElementById('bsp-sr-modal-backdrop');
      if (existing) existing.remove();

      const backdrop = document.createElement('div');
      backdrop.id = 'bsp-sr-modal-backdrop';
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) backdrop.remove();
      });

      const modal = document.createElement('div');
      modal.id = 'bsp-ccli-modal';
      backdrop.appendChild(modal);

      const title = document.createElement('h2');
      title.textContent = 'CCLI Usage Report';
      modal.appendChild(title);
      const sub = document.createElement('p');
      sub.className = 'bsp-ccli-sub';
      sub.textContent = 'Usage is captured automatically every time a song goes live. Edit CCLI metadata inline, then export as CSV for your quarterly report.';
      modal.appendChild(sub);

      // Date range row
      const range = document.createElement('div');
      range.className = 'bsp-ccli-range';
      modal.appendChild(range);

      const presets = [
        { key: '7',   label: 'Last 7 days' },
        { key: '30',  label: 'Last 30 days' },
        { key: '90',  label: 'Last 90 days' },
        { key: 'all', label: 'All time' }
      ];
      const state = { preset: '90', from: '', to: '' };
      const chipButtons = [];
      presets.forEach(function (p) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bsp-ccli-preset-chip' + (p.key === state.preset ? ' active' : '');
        b.textContent = p.label;
        b.addEventListener('click', function () {
          state.preset = p.key;
          state.from = '';
          state.to = '';
          fromInput.value = '';
          toInput.value = '';
          chipButtons.forEach(function (c) { c.classList.remove('active'); });
          b.classList.add('active');
          render();
        });
        chipButtons.push(b);
        range.appendChild(b);
      });

      const spacer = document.createElement('span');
      spacer.style.flex = '0 0 10px';
      range.appendChild(spacer);

      const fromLabel = document.createElement('label');
      fromLabel.textContent = 'From';
      range.appendChild(fromLabel);
      const fromInput = document.createElement('input');
      fromInput.type = 'date';
      range.appendChild(fromInput);

      const toLabel = document.createElement('label');
      toLabel.textContent = 'To';
      range.appendChild(toLabel);
      const toInput = document.createElement('input');
      toInput.type = 'date';
      range.appendChild(toInput);

      const applyCustomBtn = document.createElement('button');
      applyCustomBtn.type = 'button';
      applyCustomBtn.className = 'bsp-ccli-preset-chip';
      applyCustomBtn.textContent = 'Apply';
      applyCustomBtn.addEventListener('click', function () {
        state.preset = 'custom';
        state.from = fromInput.value;
        state.to = toInput.value;
        chipButtons.forEach(function (c) { c.classList.remove('active'); });
        render();
      });
      range.appendChild(applyCustomBtn);

      // Summary line
      const summary = document.createElement('div');
      summary.className = 'bsp-ccli-summary';
      modal.appendChild(summary);

      // Table wrap
      const tableWrap = document.createElement('div');
      tableWrap.className = 'bsp-ccli-table-wrap';
      modal.appendChild(tableWrap);

      // Actions
      const actions = document.createElement('div');
      actions.className = 'bsp-ccli-actions';
      const left = document.createElement('div');
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'bsp-sr-btn bsp-sr-btn-warn';
      clearBtn.textContent = 'Clear log…';
      clearBtn.addEventListener('click', function () {
        if (!confirm('Clear the entire CCLI usage log? This cannot be undone.')) return;
        bspCcliUsageLog = [];
        bspCcliSaveUsageLog();
        render();
      });
      left.appendChild(clearBtn);
      actions.appendChild(left);

      const right = document.createElement('div');
      right.className = 'bsp-ccli-actions-right';
      const exportBtn = document.createElement('button');
      exportBtn.type = 'button';
      exportBtn.className = 'bsp-sr-btn bsp-sr-btn-accent';
      exportBtn.textContent = 'Export CSV';
      exportBtn.addEventListener('click', function () {
        const entries = bspCcliFilterUsageLog(state);
        bspCcliExportCsv(entries, state);
      });
      right.appendChild(exportBtn);
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'bsp-sr-btn';
      closeBtn.textContent = 'Close';
      closeBtn.addEventListener('click', function () { backdrop.remove(); });
      right.appendChild(closeBtn);
      actions.appendChild(right);
      modal.appendChild(actions);

      document.body.appendChild(backdrop);
      bspCcliModalEl = modal;

      function render() {
        const entries = bspCcliFilterUsageLog(state);
        summary.textContent = entries.length + ' usage entr' + (entries.length === 1 ? 'y' : 'ies') + ' in selected range. ' +
          'Total in log: ' + bspCcliUsageLog.length + '.';
        bspCcliRenderTable(tableWrap, entries, render);
      }
      render();
    }

    function bspCcliFilterUsageLog(state) {
      let from = 0;
      let to = Infinity;
      if (state.preset === '7')   from = Date.now() - 7  * 86400 * 1000;
      if (state.preset === '30')  from = Date.now() - 30 * 86400 * 1000;
      if (state.preset === '90')  from = Date.now() - 90 * 86400 * 1000;
      if (state.preset === 'all') from = 0;
      if (state.preset === 'custom') {
        if (state.from) from = Date.parse(state.from + 'T00:00:00');
        if (state.to)   to   = Date.parse(state.to   + 'T23:59:59');
      }
      return bspCcliUsageLog
        .filter(function (e) { return e && e.ts >= from && e.ts <= to; })
        .slice()
        .sort(function (a, b) { return b.ts - a.ts; });
    }

    function bspCcliRenderTable(wrap, entries, onChange) {
      wrap.innerHTML = '';
      if (!entries.length) {
        const empty = document.createElement('div');
        empty.className = 'bsp-ccli-empty';
        empty.textContent = 'No usage entries in this range. Songs are captured automatically when they go live.';
        wrap.appendChild(empty);
        return;
      }
      const table = document.createElement('table');
      table.className = 'bsp-ccli-table';
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th style="width:140px">Date</th><th>Song</th><th style="width:110px">CCLI #</th><th style="width:180px">Author</th><th style="width:60px"></th></tr>';
      table.appendChild(thead);
      const tbody = document.createElement('tbody');
      entries.forEach(function (entry) {
        const tr = document.createElement('tr');
        // Always reflect the latest metadata in the row, not the snapshot at capture time.
        const meta = bspCcliGetSongMetadata(entry.songId);
        tr.innerHTML = '' +
          '<td>' + bspCcliFormatDate(entry.ts) + '</td>' +
          '<td>' + bspCcliEscape(entry.title) + '</td>' +
          '<td>' + (meta.ccliNumber ? bspCcliEscape(meta.ccliNumber) : '<span class="bsp-ccli-missing">missing</span>') + '</td>' +
          '<td>' + (meta.author ? bspCcliEscape(meta.author) : '<span class="bsp-ccli-missing">missing</span>') + '</td>' +
          '<td></td>';
        const editCell = tr.lastElementChild;
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'bsp-ccli-edit-btn';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', function () {
          bspCcliOpenInlineEditor(tr, entry, onChange);
        });
        editCell.appendChild(editBtn);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
    }

    function bspCcliOpenInlineEditor(anchorRow, entry, onChange) {
      // Toggle off if an editor row is already open for this anchor.
      const next = anchorRow.nextElementSibling;
      if (next && next.classList.contains('bsp-ccli-editor-row')) {
        next.remove();
        return;
      }
      const meta = bspCcliGetSongMetadata(entry.songId);
      const row = document.createElement('tr');
      row.className = 'bsp-ccli-editor-row';
      const td = document.createElement('td');
      td.colSpan = 5;
      const grid = document.createElement('div');
      grid.className = 'bsp-ccli-editor-grid';
      const ccliInput = document.createElement('input');
      ccliInput.type = 'text';
      ccliInput.placeholder = 'CCLI #';
      ccliInput.value = meta.ccliNumber;
      grid.appendChild(ccliInput);
      const authorInput = document.createElement('input');
      authorInput.type = 'text';
      authorInput.placeholder = 'Author(s)';
      authorInput.value = meta.author;
      grid.appendChild(authorInput);
      const copyrightInput = document.createElement('input');
      copyrightInput.type = 'text';
      copyrightInput.placeholder = 'Copyright';
      copyrightInput.value = meta.copyright;
      grid.appendChild(copyrightInput);
      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'bsp-sr-btn bsp-sr-btn-accent';
      saveBtn.textContent = 'Save';
      saveBtn.addEventListener('click', function () {
        bspCcliSetSongMetadata(entry.songId, {
          ccliNumber: ccliInput.value.trim(),
          author: authorInput.value.trim(),
          copyright: copyrightInput.value.trim()
        });
        row.remove();
        if (typeof onChange === 'function') onChange();
        if (typeof showToast === 'function') showToast('CCLI metadata saved');
      });
      grid.appendChild(saveBtn);
      td.appendChild(grid);
      row.appendChild(td);
      anchorRow.after(row);
      ccliInput.focus();
    }

    // ----- CSV export ------------------------------------------------------

    function bspCcliExportCsv(entries, state) {
      if (!entries.length) {
        if (typeof showToast === 'function') showToast('No entries in selected range');
        return;
      }
      const header = ['Date', 'Song Title', 'CCLI Song Number', 'Author(s)', 'Copyright'];
      const rows = entries.map(function (e) {
        const meta = bspCcliGetSongMetadata(e.songId);
        return [
          bspCcliFormatDate(e.ts),
          e.title || '',
          meta.ccliNumber || '',
          meta.author || '',
          meta.copyright || ''
        ];
      });
      const csv = [header].concat(rows).map(function (row) {
        return row.map(bspCcliCsvField).join(',');
      }).join('\r\n');
      const bom = '\ufeff'; // Excel-friendly UTF-8 BOM
      const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bible-song-pro-ccli-report-' + bspCcliFormatDateForFilename() + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      if (typeof showToast === 'function') showToast('Exported ' + entries.length + ' CCLI entries');
    }

    function bspCcliCsvField(value) {
      const s = String(value == null ? '' : value);
      if (/[",\r\n]/.test(s)) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }

    function bspCcliFormatDate(ts) {
      const d = new Date(ts);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return y + '-' + m + '-' + day + ' ' + hh + ':' + mm;
    }

    function bspCcliFormatDateForFilename() {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return y + m + day;
    }

    function bspCcliEscape(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // ----- Panic bar button injection -------------------------------------
    //
    // Finds the service-reliability panic bar and adds a single "CCLI"
    // button that opens the report modal.  If the panic bar isn't
    // available (e.g., service-reliability.js failed to init), falls
    // back to a fixed-position standalone button so the feature is
    // still reachable.

    function bspCcliInstallPanicBarButton() {
      if (bspCcliOpenButtonEl) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'CCLI';
      btn.title = 'Open CCLI usage report';
      btn.addEventListener('click', bspCcliOpenReportModal);

      const panicBar = document.getElementById('bsp-sr-panic-bar');
      if (panicBar) {
        btn.className = 'bsp-sr-btn';
        // Insert just before the End Service button so it groups with other tools.
        const endBtn = document.getElementById('bsp-sr-end-service');
        if (endBtn && endBtn.parentNode === panicBar) {
          panicBar.insertBefore(btn, endBtn);
        } else {
          panicBar.appendChild(btn);
        }
      } else {
        // Fallback: standalone top-right button.
        btn.style.cssText =
          'position:fixed;top:8px;right:8px;z-index:9500;' +
          'background:#1b1f2a;color:#e8eaed;border:1px solid rgba(255,255,255,0.18);' +
          'padding:6px 10px;border-radius:6px;font:600 12px -apple-system,BlinkMacSystemFont,sans-serif;' +
          'cursor:pointer;';
        document.body.appendChild(btn);
      }
      bspCcliOpenButtonEl = btn;
    }

    // ----- Main init + boot hook ------------------------------------------

    function bspCcliReportingInit() {
      if (bspCcliInitialized) return;
      bspCcliInitialized = true;
      Promise.all([
        bspCcliLoadMetadata(),
        bspCcliLoadUsageLog()
      ]).then(function (results) {
        bspCcliMetadata = results[0] || {};
        bspCcliUsageLog = Array.isArray(results[1]) ? results[1] : [];
        bspCcliStartPoller();
        bspCcliInstallPanicBarButton();
      }).catch(function (err) {
        try { console.error('[BSP CCLI] init failed', err); } catch (_) {}
      });
    }

    // Expose for diagnostics + external callers.
    window.BSPCcli = {
      version: BSP_CCLI_VERSION,
      init: bspCcliReportingInit,
      openReport: bspCcliOpenReportModal,
      captureCurrent: bspCcliCaptureCurrent,
      getMetadata: bspCcliGetSongMetadata,
      setMetadata: bspCcliSetSongMetadata,
      get usageLog() { return bspCcliUsageLog.slice(); }
    };

    // Wait for window.onload + stateReady before starting the poller so
    // we don't capture ghost entries during cold boot.
    window.addEventListener('load', function () {
      const start = Date.now();
      const wait = setInterval(function () {
        const ready = (typeof stateReady !== 'undefined' && stateReady);
        if (ready || Date.now() - start > 8000) {
          clearInterval(wait);
          bspCcliReportingInit();
        }
      }, 100);
    });

    // =============================================================
    // END OF FILE — BibleRhythm AGL CCLI Reporting
    // =============================================================
