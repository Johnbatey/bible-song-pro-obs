    // =============================================================
    // Bible Song Pro — Service Plan Import (P1 #9)
    // =============================================================
    //
    // Accepts a CSV (either a generic "type,title,reference" sheet, a
    // Planning Center Services CSV export, or a one-line-per-item fallback)
    // and builds a setlist from it.  Songs are matched against the existing
    // library by case-insensitive title; Bible references are resolved via
    // the new scripture reference parser (scripture-reference-parser.js).
    //
    // CSV parser is RFC 4180-compliant with BOM handling.  No dependencies.
    //
    // Loaded after ccli-reporting.js.
    // =============================================================

    // ----- Shared constants ------------------------------------------------

    const BSP_PLAN_VERSION = 1;
    const BSP_PLAN_TYPE_SONG = 'song';
    const BSP_PLAN_TYPE_BIBLE = 'bible';
    const BSP_PLAN_TYPE_NOTE = 'note';

    // ----- Module state ----------------------------------------------------

    let bspPlanInitialized = false;
    let bspPlanOpenButtonEl = null;
    let bspPlanModalState = null; // { phase, rawText, items }

    // ----- CSV parser (RFC 4180, BOM-aware) --------------------------------
    //
    // Returns a 2-D array of strings.  Handles:
    //   - Quoted fields with embedded commas, quotes ("" escape), newlines
    //   - CRLF and LF line endings
    //   - UTF-8 BOM at start of input
    //   - Trailing blank lines

    function bspParseCsv(text) {
      if (text == null) return [];
      let s = String(text);
      if (s.charCodeAt(0) === 0xfeff) s = s.slice(1); // strip BOM
      const rows = [];
      let row = [];
      let field = '';
      let i = 0;
      const len = s.length;
      let inQuotes = false;
      while (i < len) {
        const ch = s[i];
        if (inQuotes) {
          if (ch === '"') {
            if (s[i + 1] === '"') {
              field += '"';
              i += 2;
              continue;
            }
            inQuotes = false;
            i += 1;
            continue;
          }
          field += ch;
          i += 1;
          continue;
        }
        if (ch === '"') {
          inQuotes = true;
          i += 1;
          continue;
        }
        if (ch === ',') {
          row.push(field);
          field = '';
          i += 1;
          continue;
        }
        if (ch === '\r') {
          // eat optional \n in CRLF
          row.push(field);
          field = '';
          rows.push(row);
          row = [];
          i += 1;
          if (s[i] === '\n') i += 1;
          continue;
        }
        if (ch === '\n') {
          row.push(field);
          field = '';
          rows.push(row);
          row = [];
          i += 1;
          continue;
        }
        field += ch;
        i += 1;
      }
      // Flush trailing field/row.
      if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
      }
      // Drop purely empty trailing rows.
      while (rows.length > 0) {
        const last = rows[rows.length - 1];
        if (last.length === 0 || (last.length === 1 && last[0] === '')) {
          rows.pop();
        } else {
          break;
        }
      }
      return rows;
    }

    // ----- Plan parser -----------------------------------------------------
    //
    // Takes raw CSV text and returns an array of parsed "plan items" with
    // normalized shape: { type, title, reference, notes, raw }.  Type is
    // one of BSP_PLAN_TYPE_SONG | _BIBLE | _NOTE.

    // Column name synonyms (lowercased, stripped).
    const BSP_PLAN_COLUMN_MAP = {
      type: ['type', 'kind', 'itemtype', 'item_type'],
      title: ['title', 'name', 'item', 'itemtitle', 'item_title', 'plantitle', 'plan_title'],
      reference: ['reference', 'ref', 'scripture', 'bibleref', 'bible_ref'],
      notes: ['notes', 'note', 'description', 'itemdescription', 'item_description', 'details']
    };

    function bspPlanNormalizeHeader(s) {
      return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    function bspPlanParsePlanCsv(rawText) {
      const text = String(rawText || '').trim();
      if (!text) return { items: [], format: 'empty', warnings: ['CSV is empty'] };
      const rows = bspParseCsv(text);
      if (!rows.length) return { items: [], format: 'empty', warnings: ['No parseable rows'] };

      // Detect header row: require at least one recognizable header token.
      const firstRow = rows[0].map(bspPlanNormalizeHeader);
      const headerIndex = {};
      Object.keys(BSP_PLAN_COLUMN_MAP).forEach(function (key) {
        const syns = BSP_PLAN_COLUMN_MAP[key];
        for (let i = 0; i < firstRow.length; i += 1) {
          if (syns.indexOf(firstRow[i]) !== -1) {
            headerIndex[key] = i;
            break;
          }
        }
      });

      let format;
      let items = [];
      const warnings = [];
      const hasRecognizedHeader = Object.keys(headerIndex).length > 0;

      if (hasRecognizedHeader) {
        format = 'keyed';
        const bodyRows = rows.slice(1);
        bodyRows.forEach(function (row) {
          if (!row || row.every(function (c) { return !c || !c.trim(); })) return;
          const get = function (key) {
            const idx = headerIndex[key];
            if (idx == null) return '';
            return (row[idx] == null ? '' : String(row[idx])).trim();
          };
          const typeRaw = get('type').toLowerCase();
          const title = get('title');
          const reference = get('reference');
          const notes = get('notes');
          let type;
          if (typeRaw) {
            if (/song|music|worship/.test(typeRaw)) type = BSP_PLAN_TYPE_SONG;
            else if (/scripture|bible|reading|verse/.test(typeRaw)) type = BSP_PLAN_TYPE_BIBLE;
            else if (/header|note|announcement|sermon|prayer|welcome/.test(typeRaw)) type = BSP_PLAN_TYPE_NOTE;
            else type = reference ? BSP_PLAN_TYPE_BIBLE : BSP_PLAN_TYPE_SONG;
          } else {
            type = reference ? BSP_PLAN_TYPE_BIBLE : BSP_PLAN_TYPE_SONG;
          }
          if (!title && !reference) return; // skip empty
          items.push({ type: type, title: title, reference: reference, notes: notes, raw: row });
        });
      } else {
        // Fallback: one item per non-empty line.  Each cell is treated as
        // a title/reference.  If parseBibleReferenceQuery matches, it's a
        // Bible item.
        format = 'freeform';
        rows.forEach(function (row) {
          const cell = (row[0] == null ? '' : String(row[0])).trim();
          if (!cell) return;
          const parsed = (typeof parseBibleReferenceQuery === 'function')
            ? parseBibleReferenceQuery(cell)
            : null;
          if (parsed) {
            items.push({ type: BSP_PLAN_TYPE_BIBLE, title: cell, reference: cell, notes: '', raw: row });
          } else {
            items.push({ type: BSP_PLAN_TYPE_SONG, title: cell, reference: '', notes: '', raw: row });
          }
        });
      }

      return { items: items, format: format, warnings: warnings };
    }

    // ----- Resolution to schedule entries ----------------------------------
    //
    // For each parsed item, attempt to resolve it to a concrete setlist
    // entry.  Songs match against the existing `songs` library by
    // case-insensitive title.  Bible items use parseBibleReferenceQuery +
    // findBibleReferenceChapter to find the chapter item.  Unresolved items
    // are retained with status so the preview can show them to the operator.

    function bspPlanResolveItems(items) {
      const resolved = [];
      const songCount = (typeof songs !== 'undefined' && Array.isArray(songs)) ? songs.length : 0;
      // Build a case-insensitive title → song map once.
      const titleMap = Object.create(null);
      if (songCount > 0) {
        for (let i = 0; i < songs.length; i += 1) {
          const s = songs[i];
          if (!s || !s.title) continue;
          const key = String(s.title).trim().toLowerCase();
          if (key && !titleMap[key]) titleMap[key] = s;
        }
      }

      items.forEach(function (item) {
        const base = {
          type: item.type,
          title: item.title,
          reference: item.reference,
          notes: item.notes,
          status: 'unresolved',
          statusDetail: '',
          entry: null
        };

        if (item.type === BSP_PLAN_TYPE_NOTE) {
          base.status = 'skipped';
          base.statusDetail = 'Notes / sermon / prayer items are skipped in v1';
          resolved.push(base);
          return;
        }

        if (item.type === BSP_PLAN_TYPE_SONG) {
          const key = String(item.title || '').trim().toLowerCase();
          const existing = key ? titleMap[key] : null;
          if (existing) {
            base.status = 'resolved';
            base.statusDetail = 'Matched existing song';
            base.entry = {
              id: existing.id,
              title: existing.title,
              text: existing.text || existing.content || '',
              content: existing.content || existing.text || ''
            };
          } else {
            base.status = 'placeholder';
            base.statusDetail = 'No matching song — will insert a placeholder';
            base.entry = {
              title: item.title || '(untitled)',
              text: '',
              content: ''
            };
          }
          resolved.push(base);
          return;
        }

        if (item.type === BSP_PLAN_TYPE_BIBLE) {
          const refText = (item.reference || item.title || '').trim();
          if (!refText) {
            base.status = 'unresolved';
            base.statusDetail = 'No reference provided';
            resolved.push(base);
            return;
          }
          const parsed = (typeof parseBibleReferenceQuery === 'function')
            ? parseBibleReferenceQuery(refText)
            : null;
          if (!parsed) {
            base.status = 'unresolved';
            base.statusDetail = 'Could not parse reference: "' + refText + '"';
            resolved.push(base);
            return;
          }
          if (typeof activeBibleVersion === 'undefined' || !activeBibleVersion) {
            base.status = 'unresolved';
            base.statusDetail = 'No active Bible version — select one first';
            resolved.push(base);
            return;
          }
          if (typeof findBibleReferenceChapter !== 'function') {
            base.status = 'unresolved';
            base.statusDetail = 'Bible loader not available';
            resolved.push(base);
            return;
          }
          const chapterMatch = findBibleReferenceChapter(activeBibleVersion, parsed);
          if (!chapterMatch) {
            base.status = 'unresolved';
            base.statusDetail = 'Reference not found in ' + activeBibleVersion;
            resolved.push(base);
            return;
          }
          const titleText = parsed.book + ' ' + parsed.chapter +
            (parsed.verseStart
              ? (':' + parsed.verseStart + (parsed.verseEnd && parsed.verseEnd !== parsed.verseStart ? '-' + parsed.verseEnd : ''))
              : '');
          base.status = 'resolved';
          base.statusDetail = 'Resolved to ' + titleText;
          base.entry = {
            _metaKind: 'bible_verse',
            title: titleText,
            content: chapterMatch.chapterItem.content || '',
            version: activeBibleVersion,
            chapterIndex: chapterMatch.chapterIndex,
            pageIndex: 0,
            anchorVerse: parsed.verseStart || null
          };
          resolved.push(base);
          return;
        }

        resolved.push(base);
      });

      return resolved;
    }

    // ----- Modal UI --------------------------------------------------------
    //
    // Three phases: upload → preview → done.  Reuses #bsp-sr-modal-backdrop
    // from service-reliability.js so the backdrop styling stays consistent.

    function bspPlanInjectStyles() {
      if (document.getElementById('bsp-plan-import-styles')) return;
      const css = `
        #bsp-plan-modal {
          background: #12151d;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 14px;
          padding: 20px 22px;
          width: min(720px, 94vw);
          max-height: 86vh;
          display: flex;
          flex-direction: column;
          color: #e8eaed;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          box-shadow: 0 24px 60px rgba(0,0,0,0.55);
        }
        #bsp-plan-modal h2 { margin: 0 0 6px 0; font-size: 18px; font-weight: 700; }
        #bsp-plan-modal .bsp-plan-sub { margin: 0 0 14px 0; font-size: 12px; color: #9aa0a6; }
        #bsp-plan-modal .bsp-plan-dropzone {
          border: 2px dashed rgba(255,255,255,0.18);
          border-radius: 10px;
          padding: 22px;
          text-align: center;
          color: #9aa0a6;
          font-size: 13px;
          transition: border-color 0.15s ease, background 0.15s ease;
          cursor: pointer;
        }
        #bsp-plan-modal .bsp-plan-dropzone.dragover {
          border-color: #3ddc84;
          background: rgba(61,220,132,0.06);
          color: #e8eaed;
        }
        #bsp-plan-modal .bsp-plan-textarea {
          width: 100%;
          box-sizing: border-box;
          min-height: 140px;
          margin-top: 10px;
          background: #0a0d14;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 8px;
          color: #e8eaed;
          padding: 10px 12px;
          font-family: ui-monospace, "SF Mono", Menlo, monospace;
          font-size: 12px;
          resize: vertical;
        }
        #bsp-plan-modal .bsp-plan-counts {
          display: flex;
          gap: 12px;
          font-size: 12px;
          color: #9aa0a6;
          margin: 0 0 8px 0;
        }
        #bsp-plan-modal .bsp-plan-count-chip {
          padding: 3px 8px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.12);
        }
        #bsp-plan-modal .bsp-plan-count-resolved  { color: #80ffb6; border-color: #175a34; }
        #bsp-plan-modal .bsp-plan-count-placeholder{ color: #ffd580; border-color: #5a4217; }
        #bsp-plan-modal .bsp-plan-count-unresolved { color: #ffb3b3; border-color: #5a1717; }
        #bsp-plan-modal .bsp-plan-count-skipped    { color: #9aa0a6; }
        #bsp-plan-modal .bsp-plan-table-wrap {
          flex: 1 1 auto;
          overflow: auto;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          background: rgba(0,0,0,0.2);
        }
        #bsp-plan-modal table.bsp-plan-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        #bsp-plan-modal .bsp-plan-table th,
        #bsp-plan-modal .bsp-plan-table td {
          padding: 7px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          text-align: left;
          vertical-align: top;
        }
        #bsp-plan-modal .bsp-plan-table th {
          background: rgba(255,255,255,0.03);
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #9aa0a6;
          position: sticky;
          top: 0;
        }
        #bsp-plan-modal .bsp-plan-status-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 6px;
        }
        #bsp-plan-modal .bsp-plan-status-dot[data-status="resolved"]    { background: #3ddc84; }
        #bsp-plan-modal .bsp-plan-status-dot[data-status="placeholder"] { background: #ffb64d; }
        #bsp-plan-modal .bsp-plan-status-dot[data-status="unresolved"]  { background: #ff5252; }
        #bsp-plan-modal .bsp-plan-status-dot[data-status="skipped"]     { background: #6b7280; }
        #bsp-plan-modal .bsp-plan-type-badge {
          display: inline-block;
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border: 1px solid rgba(255,255,255,0.12);
        }
        #bsp-plan-modal .bsp-plan-type-badge[data-type="song"]  { color: #80c8ff; }
        #bsp-plan-modal .bsp-plan-type-badge[data-type="bible"] { color: #80ffc8; }
        #bsp-plan-modal .bsp-plan-type-badge[data-type="note"]  { color: #9aa0a6; }
        #bsp-plan-modal .bsp-plan-detail { color: #9aa0a6; font-size: 11px; }
        #bsp-plan-modal .bsp-plan-empty {
          padding: 24px 10px;
          text-align: center;
          color: #9aa0a6;
          font-size: 13px;
        }
        #bsp-plan-modal .bsp-plan-actions {
          margin-top: 14px;
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }
      `;
      const style = document.createElement('style');
      style.id = 'bsp-plan-import-styles';
      style.textContent = css;
      document.head.appendChild(style);
    }

    function bspPlanOpenModal() {
      bspPlanInjectStyles();
      const existing = document.getElementById('bsp-sr-modal-backdrop');
      if (existing) existing.remove();

      const backdrop = document.createElement('div');
      backdrop.id = 'bsp-sr-modal-backdrop';
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) backdrop.remove();
      });

      const modal = document.createElement('div');
      modal.id = 'bsp-plan-modal';
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);

      bspPlanModalState = { phase: 'upload', rawText: '', items: [] };
      bspPlanRenderModal(modal, backdrop);
    }

    function bspPlanRenderModal(modal, backdrop) {
      modal.innerHTML = '';
      const title = document.createElement('h2');
      title.textContent = 'Import Service Plan';
      modal.appendChild(title);
      const sub = document.createElement('p');
      sub.className = 'bsp-plan-sub';
      sub.textContent = 'Drop a CSV export from Planning Center, Elvanto, or any spreadsheet. Songs match your library by title; Bible references resolve via the active Bible version.';
      modal.appendChild(sub);

      if (bspPlanModalState.phase === 'upload') {
        bspPlanRenderUploadPhase(modal, backdrop);
      } else if (bspPlanModalState.phase === 'preview') {
        bspPlanRenderPreviewPhase(modal, backdrop);
      }
    }

    function bspPlanRenderUploadPhase(modal, backdrop) {
      const dz = document.createElement('div');
      dz.className = 'bsp-plan-dropzone';
      dz.textContent = 'Drop a .csv or .txt file here, or click to choose';
      modal.appendChild(dz);

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.csv,.txt,text/csv,text/plain';
      fileInput.style.display = 'none';
      modal.appendChild(fileInput);

      dz.addEventListener('click', function () { fileInput.click(); });
      dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('dragover'); });
      dz.addEventListener('dragleave', function () { dz.classList.remove('dragover'); });
      dz.addEventListener('drop', function (e) {
        e.preventDefault();
        dz.classList.remove('dragover');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
          bspPlanReadFile(e.dataTransfer.files[0], textarea);
        }
      });
      fileInput.addEventListener('change', function () {
        if (fileInput.files && fileInput.files.length) {
          bspPlanReadFile(fileInput.files[0], textarea);
        }
      });

      const textarea = document.createElement('textarea');
      textarea.className = 'bsp-plan-textarea';
      textarea.placeholder = 'Or paste CSV here...\n\nExamples:\n  type,title,reference\n  song,Amazing Grace,\n  bible,,John 3:16-18\n\nPlanning Center export columns are auto-detected.';
      modal.appendChild(textarea);

      const actions = document.createElement('div');
      actions.className = 'bsp-plan-actions';
      const left = document.createElement('div');
      actions.appendChild(left);
      const right = document.createElement('div');
      actions.appendChild(right);

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'bsp-sr-btn';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', function () { backdrop.remove(); });
      right.appendChild(cancelBtn);

      const parseBtn = document.createElement('button');
      parseBtn.type = 'button';
      parseBtn.className = 'bsp-sr-btn bsp-sr-btn-accent';
      parseBtn.textContent = 'Parse';
      parseBtn.style.marginLeft = '8px';
      parseBtn.addEventListener('click', function () {
        const text = textarea.value || '';
        if (!text.trim()) {
          if (typeof showToast === 'function') showToast('Nothing to parse — drop a file or paste CSV');
          return;
        }
        const parsed = bspPlanParsePlanCsv(text);
        const resolved = bspPlanResolveItems(parsed.items);
        bspPlanModalState.rawText = text;
        bspPlanModalState.items = resolved;
        bspPlanModalState.format = parsed.format;
        bspPlanModalState.phase = 'preview';
        bspPlanRenderModal(modal, backdrop);
      });
      right.appendChild(parseBtn);
      modal.appendChild(actions);
    }

    function bspPlanReadFile(file, textarea) {
      if (!file || !textarea) return;
      const reader = new FileReader();
      reader.onload = function () {
        textarea.value = String(reader.result || '');
      };
      reader.onerror = function () {
        if (typeof showToast === 'function') showToast('Failed to read file');
      };
      reader.readAsText(file);
    }

    function bspPlanRenderPreviewPhase(modal, backdrop) {
      const items = bspPlanModalState.items || [];
      const counts = { resolved: 0, placeholder: 0, unresolved: 0, skipped: 0 };
      items.forEach(function (it) { if (counts[it.status] != null) counts[it.status] += 1; });

      const chipRow = document.createElement('div');
      chipRow.className = 'bsp-plan-counts';
      ['resolved', 'placeholder', 'unresolved', 'skipped'].forEach(function (k) {
        const chip = document.createElement('span');
        chip.className = 'bsp-plan-count-chip bsp-plan-count-' + k;
        chip.textContent = k + ': ' + counts[k];
        chipRow.appendChild(chip);
      });
      modal.appendChild(chipRow);

      const wrap = document.createElement('div');
      wrap.className = 'bsp-plan-table-wrap';
      modal.appendChild(wrap);

      if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'bsp-plan-empty';
        empty.textContent = 'No items parsed. Go back and check your CSV format.';
        wrap.appendChild(empty);
      } else {
        const table = document.createElement('table');
        table.className = 'bsp-plan-table';
        const thead = document.createElement('thead');
        thead.innerHTML = '<tr><th style="width:60px">#</th><th style="width:70px">Type</th><th>Title</th><th>Reference</th><th>Status</th></tr>';
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        items.forEach(function (it, idx) {
          const tr = document.createElement('tr');
          const num = document.createElement('td');
          num.textContent = String(idx + 1);
          tr.appendChild(num);

          const typeCell = document.createElement('td');
          const badge = document.createElement('span');
          badge.className = 'bsp-plan-type-badge';
          badge.dataset.type = it.type;
          badge.textContent = it.type;
          typeCell.appendChild(badge);
          tr.appendChild(typeCell);

          const titleCell = document.createElement('td');
          titleCell.textContent = it.title || '(no title)';
          tr.appendChild(titleCell);

          const refCell = document.createElement('td');
          refCell.textContent = it.reference || '';
          tr.appendChild(refCell);

          const statusCell = document.createElement('td');
          const dot = document.createElement('span');
          dot.className = 'bsp-plan-status-dot';
          dot.dataset.status = it.status;
          statusCell.appendChild(dot);
          statusCell.appendChild(document.createTextNode(it.status));
          if (it.statusDetail) {
            const detail = document.createElement('div');
            detail.className = 'bsp-plan-detail';
            detail.textContent = it.statusDetail;
            statusCell.appendChild(detail);
          }
          tr.appendChild(statusCell);
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        wrap.appendChild(table);
      }

      const actions = document.createElement('div');
      actions.className = 'bsp-plan-actions';
      const left = document.createElement('div');
      const backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'bsp-sr-btn';
      backBtn.textContent = 'Back';
      backBtn.addEventListener('click', function () {
        bspPlanModalState.phase = 'upload';
        bspPlanRenderModal(modal, backdrop);
      });
      left.appendChild(backBtn);
      actions.appendChild(left);

      const right = document.createElement('div');
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'bsp-sr-btn';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', function () { backdrop.remove(); });
      right.appendChild(cancelBtn);

      const importableCount = counts.resolved + counts.placeholder;
      const importBtn = document.createElement('button');
      importBtn.type = 'button';
      importBtn.className = 'bsp-sr-btn bsp-sr-btn-accent';
      importBtn.textContent = 'Import ' + importableCount + ' item' + (importableCount === 1 ? '' : 's');
      importBtn.disabled = importableCount === 0;
      importBtn.style.marginLeft = '8px';
      importBtn.addEventListener('click', function () {
        const result = bspPlanApplyImport(items);
        if (typeof showToast === 'function') {
          showToast('Imported ' + result.inserted + ' items (' + result.skipped + ' skipped)');
        }
        backdrop.remove();
      });
      right.appendChild(importBtn);
      actions.appendChild(right);
      modal.appendChild(actions);
    }

    function bspPlanApplyImport(items) {
      let inserted = 0;
      let skipped = 0;
      items.forEach(function (it) {
        if (it.status !== 'resolved' && it.status !== 'placeholder') {
          skipped += 1;
          return;
        }
        if (!it.entry) {
          skipped += 1;
          return;
        }
        try {
          if (typeof insertIntoSchedule === 'function') {
            insertIntoSchedule(it.entry, { successMessage: null, duplicateMessage: null });
            inserted += 1;
          } else {
            skipped += 1;
          }
        } catch (_) {
          skipped += 1;
        }
      });
      return { inserted: inserted, skipped: skipped };
    }

    // ----- Panic bar button injection + init -------------------------------

    function bspPlanInstallPanicBarButton() {
      if (bspPlanOpenButtonEl) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Import Plan';
      btn.title = 'Import a service plan CSV';
      btn.addEventListener('click', bspPlanOpenModal);

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
        btn.style.cssText =
          'position:fixed;top:8px;right:90px;z-index:9500;' +
          'background:#1b1f2a;color:#e8eaed;border:1px solid rgba(255,255,255,0.18);' +
          'padding:6px 10px;border-radius:6px;font:600 12px -apple-system,sans-serif;cursor:pointer;';
        document.body.appendChild(btn);
      }
      bspPlanOpenButtonEl = btn;
    }

    function bspPlanImportInit() {
      if (bspPlanInitialized) return;
      bspPlanInitialized = true;
      try {
        bspPlanInstallPanicBarButton();
      } catch (err) {
        try { console.error('[BSP PlanImport] init failed', err); } catch (_) {}
      }
    }

    window.BSPPlanImport = {
      version: BSP_PLAN_VERSION,
      init: bspPlanImportInit,
      openModal: bspPlanOpenModal,
      parseCsv: bspParseCsv,
      parsePlanCsv: bspPlanParsePlanCsv,
      resolveItems: bspPlanResolveItems
    };

    window.addEventListener('load', function () {
      const start = Date.now();
      const wait = setInterval(function () {
        const ready = (typeof stateReady !== 'undefined' && stateReady);
        if (ready || Date.now() - start > 8000) {
          clearInterval(wait);
          bspPlanImportInit();
        }
      }, 100);
    });

    // =============================================================
    // END OF FILE — Bible Song Pro Service Plan Import
    // =============================================================
