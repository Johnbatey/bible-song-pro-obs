        // Annotate tool + highlight tags
        const ANNOTATE_TAG_RE = /\[hl=#[0-9a-fA-F]{6}\]|\[\/hl\]/g;
        let annotateMode = false;
        let annotateSelection = null;
        let annotateColor = null;
        const btnAnnotate = document.getElementById('btn-annotate');
        const annotateToolbar = document.getElementById('annotate-toolbar');
        const lyricEditor = document.getElementById('lyric-editor');
        const lyricButtons = document.getElementById('lyric-buttons');
        const annotateSwatches = Array.from(document.querySelectorAll('.annotate-swatch'));
        const annotateClearCurrent = document.getElementById('annotate-clear-current');
        const annotateClearAll = document.getElementById('annotate-clear-all');
        const annotateColorPicker = document.getElementById('annotate-color-picker');
        const annotateColorInput = document.getElementById('annotate-color-input');
        const annotateColorHex = document.getElementById('annotate-color-hex');
        const annotatePickerFill = document.getElementById('annotate-picker-fill');
        let annotatePickerColor = '';
        const dualVersionPanelEl = document.getElementById('dual-version-panel');

        // Keep popups at document root so toolbar/container layout can't clip them.
        if (annotateToolbar && annotateToolbar.parentElement !== document.body) {
          document.body.appendChild(annotateToolbar);
        }
        if (dualVersionPanelEl && dualVersionPanelEl.parentElement !== document.body) {
          document.body.appendChild(dualVersionPanelEl);
        }
        if (annotateColorPicker && annotateColorInput && annotateColorInput.parentElement !== annotateColorPicker) {
          annotateColorPicker.appendChild(annotateColorInput);
        }

        function stripHighlightTags(text) {
          return String(text || '').replace(ANNOTATE_TAG_RE, '');
        }

        function convertHighlightsToHtml(text) {
          return String(text || '').replace(/\[hl=(#[0-9a-fA-F]{6})\]|\[\/hl\]/g, (m, color) => {
            if (color) return `<span style="background:${color};border-radius:4px;padding:0 2px;">`;
            return `</span>`;
          });
        }

        function parseTaggedText(taggedText) {
          const input = String(taggedText || '');
          let clean = '';
          const colors = [];
          const stack = [];
          let i = 0;
          while (i < input.length) {
            if (input.startsWith('[hl=', i)) {
              const end = input.indexOf(']', i);
              if (end !== -1) {
                const token = input.slice(i + 4, end).trim();
                if (/^#[0-9a-fA-F]{6}$/.test(token)) stack.push(token);
                i = end + 1;
                continue;
              }
            }
            if (input.startsWith('[/hl]', i)) {
              if (stack.length) stack.pop();
              i += 5;
              continue;
            }
            clean += input[i];
            colors.push(stack.length ? stack[stack.length - 1] : null);
            i += 1;
          }
          return { clean, colors };
        }

        function buildTaggedFromColors(clean, colors) {
          let out = '';
          let current = null;
          for (let i = 0; i < clean.length; i += 1) {
            const next = colors[i] || null;
            if (next !== current) {
              if (current) out += '[/hl]';
              if (next) out += `[hl=${next}]`;
              current = next;
            }
            out += clean[i];
          }
          if (current) out += '[/hl]';
          return out;
        }

        function applyHighlightToTaggedText(taggedText, start, end, color) {
          const parsed = parseTaggedText(taggedText);
          const cleanLen = parsed.clean.length;
          const s = Math.max(0, Math.min(start, cleanLen));
          const e = Math.max(0, Math.min(end, cleanLen));
          if (e <= s) return taggedText;
          for (let i = s; i < e; i += 1) {
            parsed.colors[i] = color;
          }
          return buildTaggedFromColors(parsed.clean, parsed.colors);
        }

        function normalizeHexColor(raw) {
          const val = String(raw || '').trim();
          if (!val) return '';
          let hex = val.startsWith('#') ? val.slice(1) : val;
          if (/^[0-9a-fA-F]{3}$/.test(hex)) {
            hex = hex.split('').map(ch => ch + ch).join('');
          }
          if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '';
          return `#${hex.toUpperCase()}`;
        }

        function normalizeWithMap(value) {
          const input = String(value || '');
          let out = '';
          const map = [];
          let lastWasSpace = false;
          for (let i = 0; i < input.length; i += 1) {
            const ch = input[i];
            if (/\s/.test(ch)) {
              if (!lastWasSpace && out.length > 0) {
                out += ' ';
                map.push(i);
              }
              lastWasSpace = true;
            } else {
              out += ch;
              map.push(i);
              lastWasSpace = false;
            }
          }
          if (out.endsWith(' ')) {
            out = out.slice(0, -1);
            map.pop();
          }
          return { text: out, map };
        }

        function normalizeText(value) {
          return normalizeWithMap(value).text;
        }

        function insertHighlightTag(text, start, end, color) {
          if (start == null || end == null || end <= start) return text;
          return `${text.slice(0, start)}[hl=${color}]${text.slice(start, end)}[/hl]${text.slice(end)}`;
        }

        function getActiveEditorMode() {
          const btnBtn = document.getElementById('mode-btn');
          if (btnBtn && btnBtn.classList.contains('active')) return 'btn';
          return 'text';
        }

        function setAnnotateMode(next, opts = {}) {
          annotateMode = !!next;
          if (!annotateToolbar || !btnAnnotate) return;
          annotateToolbar.style.display = annotateMode ? 'flex' : 'none';
          if (annotateMode) positionAnnotateToolbar();
          btnAnnotate.classList.toggle('active', annotateMode);
          document.body.classList.toggle('annotate-active', annotateMode);
          if (!annotateMode) {
            annotateSelection = null;
            annotateSwatches.forEach(c => c.classList.remove('selected'));
            annotateColor = null;
          }
          if (!opts.silent && typeof saveFocusedWorkspaceControlsForTab === 'function' && typeof isFocusedWorkspaceMode === 'function' && isFocusedWorkspaceMode()) {
            saveFocusedWorkspaceControlsForTab(sidebarTab);
            if (typeof saveToStorageDebounced === 'function') saveToStorageDebounced();
          }
        }

        function getAnnotateWorkspaceState() {
          return {
            annotateOpen: !!annotateMode,
            annotateColor: annotateColor || null,
            annotatePickerColor: annotatePickerColor || ''
          };
        }

        function applyAnnotateWorkspaceState(state, opts = {}) {
          const next = (state && typeof state === 'object') ? state : {};
          annotateSelection = null;
          annotateColor = next.annotateColor || null;
          annotatePickerColor = next.annotatePickerColor || '';
          annotateSwatches.forEach((swatch) => {
            const color = swatch.getAttribute('data-color') || '';
            swatch.classList.toggle('selected', !!annotateColor && color.toLowerCase() === String(annotateColor).toLowerCase());
          });
          if (annotatePickerFill) annotatePickerFill.style.background = annotatePickerColor || 'transparent';
          if (annotateColorInput) annotateColorInput.value = annotatePickerColor || '#000000';
          if (annotateColorHex) annotateColorHex.value = annotatePickerColor ? String(annotatePickerColor).toUpperCase() : '';
          if (annotateColorPicker) {
            annotateColorPicker.classList.toggle('ready', !!annotatePickerColor);
            annotateColorPicker.setAttribute('draggable', annotatePickerColor ? 'true' : 'false');
          }
          setAnnotateMode(!!next.annotateOpen, { silent: opts.persist === false });
        }

        function positionAnnotateToolbar() {
          if (!annotateToolbar || annotateToolbar.style.display === 'none') return;
          const anchor = btnAnnotate?.getBoundingClientRect();
          if (!anchor) return;
          const panelWidth = annotateToolbar.offsetWidth || 320;
          const pad = 8;
          let left = anchor.left + (anchor.width / 2) - (panelWidth / 2);
          left = Math.max(pad, Math.min(left, window.innerWidth - panelWidth - pad));
          const top = Math.min(window.innerHeight - 40, anchor.bottom + 8);
          annotateToolbar.style.left = `${Math.round(left)}px`;
          annotateToolbar.style.top = `${Math.round(top)}px`;
        }

        function positionDualVersionPanel() {
          const panel = document.getElementById('dual-version-panel');
          const button = document.getElementById('btn-bible-tool');
          if (!panel || !button || !panel.classList.contains('open')) return;
          const anchor = button.getBoundingClientRect();
          const panelWidth = panel.offsetWidth || 320;
          const pad = 8;
          let left = anchor.right - panelWidth;
          left = Math.max(pad, Math.min(left, window.innerWidth - panelWidth - pad));
          const top = Math.min(window.innerHeight - 40, anchor.bottom + 8);
          panel.style.left = `${Math.round(left)}px`;
          panel.style.top = `${Math.round(top)}px`;
        }

        function getSelectionContainerNode(sel) {
          if (!sel || sel.rangeCount === 0) return null;
          return sel.anchorNode && sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode?.parentElement;
        }

        function measureFragmentText(node) {
          if (!node) return 0;
          if (node.nodeType === 3) return (node.nodeValue || '').length;
          if (node.nodeType === 1) {
            const el = node;
            if (el.classList && el.classList.contains('jo-verse-sup')) return 0;
            if (el.tagName === 'BR') return 1;
          }
          let total = 0;
          const kids = node.childNodes || [];
          kids.forEach(child => { total += measureFragmentText(child); });
          return total;
        }

        function getRangeOffsetInButton(btn, range, useEnd) {
          if (!btn || !range) return null;
          try {
            const r = document.createRange();
            r.selectNodeContents(btn);
            if (useEnd) r.setEnd(range.endContainer, range.endOffset);
            else r.setEnd(range.startContainer, range.startOffset);
            const frag = r.cloneContents();
            return measureFragmentText(frag);
          } catch (e) {
            return null;
          }
        }

        function getButtonTextLength(btn) {
          if (!btn) return 0;
          const r = document.createRange();
          r.selectNodeContents(btn);
          const frag = r.cloneContents();
          return measureFragmentText(frag);
        }

        function rangesIntersect(a, b) {
          if (!a || !b) return false;
          if (a.compareBoundaryPoints(Range.END_TO_START, b) <= 0) return false;
          if (a.compareBoundaryPoints(Range.START_TO_END, b) >= 0) return false;
          return true;
        }

        function getSelectionSpans() {
          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return [];
          const range = sel.getRangeAt(0);
          const buttons = Array.from(document.querySelectorAll('#lyric-buttons .lyric-btn'));
          const spans = [];
          buttons.forEach((btn) => {
            const btnRange = document.createRange();
            btnRange.selectNodeContents(btn);
            if (!rangesIntersect(range, btnRange)) return;
            const pageIndex = Number(btn.dataset.pageIndex);
            if (!Number.isFinite(pageIndex)) return;
            let startOffset = 0;
            let endOffset = getButtonTextLength(btn);
            if (range.compareBoundaryPoints(Range.START_TO_START, btnRange) > 0) {
              const start = getRangeOffsetInButton(btn, range, false);
              if (Number.isFinite(start)) startOffset = start;
            }
            if (range.compareBoundaryPoints(Range.END_TO_END, btnRange) < 0) {
              const end = getRangeOffsetInButton(btn, range, true);
              if (Number.isFinite(end)) endOffset = end;
            }
            if (endOffset > startOffset) {
              spans.push({ pageIndex, startOffset, endOffset, text: sel.toString() });
            }
          });
          return spans;
        }

        function getButtonSelectionData() {
          const sel = window.getSelection();
          if (!sel || sel.isCollapsed) return null;
          const anchorEl = getSelectionContainerNode(sel);
          const focusEl = sel.focusNode && sel.focusNode.nodeType === 1 ? sel.focusNode : sel.focusNode?.parentElement;
          const anchorBtn = anchorEl ? anchorEl.closest('.lyric-btn') : null;
          const focusBtn = focusEl ? focusEl.closest('.lyric-btn') : null;
          if (!anchorBtn || !focusBtn || anchorBtn !== focusBtn) return null;
          const pageIndex = Number(anchorBtn.dataset.pageIndex);
          const text = sel.toString();
          if (!text || !Number.isFinite(pageIndex)) return null;
          const range = sel.rangeCount ? sel.getRangeAt(0) : null;
          const startOffset = range ? getRangeOffsetInButton(anchorBtn, range, false) : null;
          const endOffset = range ? getRangeOffsetInButton(anchorBtn, range, true) : null;
          return {
            text,
            pageIndex,
            startOffset: (Number.isFinite(startOffset) ? startOffset : null),
            endOffset: (Number.isFinite(endOffset) ? endOffset : null)
          };
        }

        function captureAnnotateSelection() {
          if (!annotateMode) return;
          const data = getButtonSelectionData();
          if (data) annotateSelection = data;
        }

        document.addEventListener('selectionchange', captureAnnotateSelection);

        function updateItemContentFromPage(item, pageLines, updatedLines, isBible) {
          const allLines = String(item.content || '').split('\n');
          if (!Array.isArray(pageLines) || pageLines.length === 0) {
            item.content = allLines.join('\n');
            item.text = item.content;
            if (lyricEditor && getActiveEditorMode() === 'text') {
              lyricEditor.value = item.content;
            }
            item.updatedAt = Date.now();
            if (!isBible && typeof normalizeSearchText === 'function') {
              item.searchableText = normalizeSearchText(`${item.title || ''}\n${item.content || ''}`);
            }
            if (!isBible && typeof scheduleSongPersist === 'function') {
              scheduleSongPersist(item);
            } else if (isBible && typeof persistBibleVersion === 'function' && typeof activeBibleVersion !== 'undefined' && activeBibleVersion) {
              persistBibleVersion(activeBibleVersion).catch(() => {});
            }
            if (typeof saveState === 'function') saveState();
            if (typeof saveToStorageDebounced === 'function') saveToStorageDebounced();
            return true;
          }
          const contentLineInfos = [];
          allLines.forEach((line, idx) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) return;
            if (!isBible && typeof shouldSkipPunctuationLine === 'function' && shouldSkipPunctuationLine(trimmed)) return;
            contentLineInfos.push({ idx, text: trimmed });
          });

          let startIdx = -1;
          for (let i = 0; i <= contentLineInfos.length - pageLines.length; i += 1) {
            let matches = true;
            for (let j = 0; j < pageLines.length; j += 1) {
              if (contentLineInfos[i + j].text !== pageLines[j]) {
                matches = false;
                break;
              }
            }
            if (matches) {
              startIdx = i;
              break;
            }
          }

          if (startIdx === -1) {
            if (typeof showToast === 'function') showToast(t('annotate_could_not_apply_highlight'));
            return false;
          }

          for (let j = 0; j < updatedLines.length; j += 1) {
            const target = contentLineInfos[startIdx + j];
            if (target) allLines[target.idx] = updatedLines[j];
          }

          item.content = allLines.join('\n');
          item.text = item.content;
          if (lyricEditor && getActiveEditorMode() === 'text') {
            lyricEditor.value = item.content;
          }
          item.updatedAt = Date.now();
          if (!isBible && typeof normalizeSearchText === 'function') {
            item.searchableText = normalizeSearchText(`${item.title || ''}\n${item.content || ''}`);
          }
          if (!isBible && typeof scheduleSongPersist === 'function') {
            scheduleSongPersist(item);
          } else if (isBible && typeof persistBibleVersion === 'function' && typeof activeBibleVersion !== 'undefined' && activeBibleVersion) {
            persistBibleVersion(activeBibleVersion).catch(() => {});
          }
          if (typeof saveState === 'function') saveState();
          if (typeof saveToStorageDebounced === 'function') saveToStorageDebounced();
          return true;
        }

        function applyHighlightToCurrentPage(selectionText, color, pageIndexOverride, selectionOffsets) {
          if (!currentItem) return false;
          const isBible = typeof getIsBibleItem === 'function' ? getIsBibleItem(currentItem) : false;
          const pages = typeof getPagesFromItem === 'function' ? getPagesFromItem(currentItem, isBible) : [];
          const pageIndex = Number.isFinite(pageIndexOverride) ? pageIndexOverride : (annotateSelection?.pageIndex ?? lineCursor);
          const page = pages[pageIndex];
          if (!page || !page.raw) return false;

          const pageLines = page.raw.split('\n').map(l => l.trim()).filter(Boolean);
          if (!pageLines.length) return false;

          const lineInfos = pageLines.map((line) => {
            const match = isBible ? line.match(/^(\d+)\s+(.+)$/) : null;
            const number = match ? match[1] : null;
            const taggedText = match ? match[2] : line;
            const parsed = parseTaggedText(taggedText);
            return { number, taggedText, clean: parsed.clean };
          });

          const plainText = lineInfos.map(l => l.clean).join(' ');
          let startOrig = null;
          let endOrig = null;
          if (selectionOffsets && Number.isFinite(selectionOffsets.start) && Number.isFinite(selectionOffsets.end)) {
            startOrig = Math.max(0, Math.min(selectionOffsets.start, plainText.length));
            endOrig = Math.max(0, Math.min(selectionOffsets.end, plainText.length));
            if (endOrig < startOrig) [startOrig, endOrig] = [endOrig, startOrig];
          } else {
            const normalized = normalizeWithMap(plainText);
            let selection = normalizeText(selectionText);
            if (isBible) {
              selection = selection.replace(/^\d+\s+/, '').trim();
            }
            if (!selection) return false;
            let idx = normalized.text.toLowerCase().indexOf(selection.toLowerCase());
            if (idx === -1 && isBible) {
              const strippedNumbers = selection.replace(/\b\d+\b/g, '').replace(/\s+/g, ' ').trim();
              if (strippedNumbers) {
                selection = strippedNumbers;
                idx = normalized.text.toLowerCase().indexOf(selection.toLowerCase());
              }
            }
            if (idx === -1) {
              if (typeof showToast === 'function') showToast(t('annotate_select_single_verse'));
              return false;
            }
            startOrig = normalized.map[idx];
            endOrig = normalized.map[idx + selection.length - 1] + 1;
          }
          if (startOrig == null || endOrig == null || endOrig <= startOrig) return false;

          const lineStarts = [];
          let cursor = 0;
          lineInfos.forEach((info, idx) => {
            lineStarts[idx] = cursor;
            cursor += info.clean.length;
            if (idx < lineInfos.length - 1) cursor += 1;
          });

          const updatedLines = [];
          lineInfos.forEach((info, idx) => {
            const start = lineStarts[idx];
            const end = start + info.clean.length;
            let nextText = info.taggedText;
            if (endOrig > start && startOrig < end) {
              const localStart = Math.max(startOrig, start) - start;
              const localEnd = Math.min(endOrig, end) - start;
              if (localStart < localEnd) {
                nextText = applyHighlightToTaggedText(nextText, localStart, localEnd, color);
              }
            }
            updatedLines.push(info.number ? `${info.number} ${nextText}` : nextText);
          });

          return updateItemContentFromPage(currentItem, pageLines, updatedLines, isBible);
        }

        function applyHighlightFromSelection(color) {
          if (!annotateMode) return;
          const mode = getActiveEditorMode();
          let applied = false;
          if (mode === 'text') {
            if (!lyricEditor) return;
            const start = lyricEditor.selectionStart;
            const end = lyricEditor.selectionEnd;
            if (start == null || end == null || start === end) {
              if (typeof showToast === 'function') showToast(t('annotate_select_text_to_highlight'));
              return;
            }
            const before = lyricEditor.value.substring(0, start);
            const selected = lyricEditor.value.substring(start, end);
            const after = lyricEditor.value.substring(end);
            const tagOpen = `[hl=${color}]`;
            const tagClose = `[/hl]`;
            lyricEditor.value = before + tagOpen + selected + tagClose + after;
            lyricEditor.selectionStart = lyricEditor.selectionEnd = before.length + tagOpen.length + selected.length + tagClose.length;
            if (typeof saveCurrentItem === 'function') saveCurrentItem();
            if (typeof updateButtonView === 'function') updateButtonView();
            applied = true;
          } else {
            const spans = getSelectionSpans();
            if (!spans.length) {
              const selectionData = annotateSelection || getButtonSelectionData();
              const selectionText = selectionData?.text;
              if (!selectionText) {
                if (typeof showToast === 'function') showToast(t('annotate_select_text_to_highlight'));
                return;
              }
              const ok = applyHighlightToCurrentPage(selectionText, color, selectionData?.pageIndex, {
                start: selectionData?.startOffset,
                end: selectionData?.endOffset
              });
              if (ok && typeof updateButtonView === 'function') updateButtonView();
              applied = ok;
            } else {
              let any = false;
              spans.forEach((span) => {
                const ok = applyHighlightToCurrentPage(span.text || '', color, span.pageIndex, {
                  start: span.startOffset,
                  end: span.endOffset
                });
                any = any || ok;
              });
              if (any && typeof updateButtonView === 'function') updateButtonView();
              applied = any;
            }
          }
          annotateSelection = null;
          if (applied) {
            if (typeof projectLive === 'function') projectLive(true);
            if (typeof pushLiveUpdate === 'function') pushLiveUpdate();
          }
        }

        function clearCurrentHighlight() {
          if (!currentItem) return;
          const isBible = typeof getIsBibleItem === 'function' ? getIsBibleItem(currentItem) : false;
          const pages = typeof getPagesFromItem === 'function' ? getPagesFromItem(currentItem, isBible) : [];
          const page = pages[lineCursor];
          if (!page || !page.raw) return;
          const pageLines = page.raw.split('\n').map(l => l.trim()).filter(Boolean);
          if (!pageLines.length) return;
          const updatedLines = pageLines.map((line) => {
            if (isBible) {
              const match = line.match(/^(\d+)\s+(.+)$/);
              if (match) {
                const num = match[1];
                const text = stripHighlightTags(match[2]);
                return `${num} ${text}`;
              }
              return stripHighlightTags(line);
            }
            return stripHighlightTags(line);
          });
          updateItemContentFromPage(currentItem, pageLines, updatedLines, isBible);
          if (typeof updateButtonView === 'function') updateButtonView();
          if (typeof projectLive === 'function') projectLive(true);
          if (typeof pushLiveUpdate === 'function') pushLiveUpdate();
        }

        function clearAllHighlightsInCurrentBible() {
          if (!activeBibleVersion || !bibles || !bibles[activeBibleVersion]) return;
          bibles[activeBibleVersion].forEach((item) => {
            if (!item || !item.content) return;
            const cleaned = stripHighlightTags(item.content);
            item.content = cleaned;
            item.text = cleaned;
            item.updatedAt = Date.now();
          });
          if (currentItem && typeof getIsBibleItem === 'function' && getIsBibleItem(currentItem)) {
            if (lyricEditor && getActiveEditorMode() === 'text') {
              lyricEditor.value = currentItem.content || '';
            }
            if (typeof updateButtonView === 'function') updateButtonView();
          }
          if (typeof persistBibleVersion === 'function') {
            persistBibleVersion(activeBibleVersion).catch(() => {});
          }
          if (typeof saveState === 'function') saveState();
          if (typeof saveToStorageDebounced === 'function') saveToStorageDebounced();
          if (typeof projectLive === 'function') projectLive(true);
          if (typeof pushLiveUpdate === 'function') pushLiveUpdate();
        }

        annotateSwatches.forEach(el => {
          el.addEventListener('click', () => {
            const color = el.getAttribute('data-color');
            if (!color) return;
            annotateSwatches.forEach(c => c.classList.remove('selected'));
            el.classList.add('selected');
            annotateColor = color;
            if (typeof saveFocusedWorkspaceControlsForTab === 'function' && typeof isFocusedWorkspaceMode === 'function' && isFocusedWorkspaceMode()) {
              saveFocusedWorkspaceControlsForTab(sidebarTab);
              if (typeof saveToStorageDebounced === 'function') saveToStorageDebounced();
            }
            if (annotateColor) applyHighlightFromSelection(annotateColor);
          });
          el.addEventListener('dragover', (e) => {
            if (!annotatePickerColor) return;
            e.preventDefault();
          });
          el.addEventListener('drop', (e) => {
            if (!annotatePickerColor) return;
            e.preventDefault();
            const color = e.dataTransfer?.getData('text/plain') || annotatePickerColor;
            if (!color) return;
            el.setAttribute('data-color', color);
            el.style.background = color;
            el.classList.remove('annotate-placeholder');
          });
        });

        if (annotateClearCurrent) {
          annotateClearCurrent.addEventListener('click', () => {
            annotateSelection = null;
            clearCurrentHighlight();
          });
        }
        if (annotateClearAll) {
          annotateClearAll.addEventListener('click', () => {
            annotateSelection = null;
            clearAllHighlightsInCurrentBible();
          });
        }

        btnAnnotate.addEventListener('click', () => {
          setAnnotateMode(!annotateMode);
        });

        if (annotateColorPicker && annotateColorInput) {
          annotateColorInput.addEventListener('click', (e) => {
            e.stopPropagation();
          });
          annotateColorInput.addEventListener('input', () => {
            annotatePickerColor = annotateColorInput.value;
            if (annotatePickerFill) annotatePickerFill.style.background = annotatePickerColor;
            annotateColorPicker.classList.add('ready');
            annotateColorPicker.setAttribute('draggable', 'true');
            if (annotateColorHex) annotateColorHex.value = annotatePickerColor.toUpperCase();
            if (typeof saveFocusedWorkspaceControlsForTab === 'function' && typeof isFocusedWorkspaceMode === 'function' && isFocusedWorkspaceMode()) {
              saveFocusedWorkspaceControlsForTab(sidebarTab);
              if (typeof saveToStorageDebounced === 'function') saveToStorageDebounced();
            }
          });
          annotateColorPicker.addEventListener('dragstart', (e) => {
            if (!annotatePickerColor) {
              e.preventDefault();
              return;
            }
            annotateColorPicker.classList.add('dragging');
            e.dataTransfer?.setData('text/plain', annotatePickerColor);
          });
          annotateColorPicker.addEventListener('dragend', () => {
            annotateColorPicker.classList.remove('dragging');
          });
        }
        if (annotateColorHex) {
          annotateColorHex.addEventListener('input', () => {
            let raw = annotateColorHex.value || '';
            if (raw && !raw.startsWith('#')) {
              raw = `#${raw.replace(/#/g, '')}`;
              annotateColorHex.value = raw;
            }
            const normalized = normalizeHexColor(raw);
            if (!normalized) return;
            annotatePickerColor = normalized;
            if (annotatePickerFill) annotatePickerFill.style.background = annotatePickerColor;
            annotateColorPicker?.classList.add('ready');
            annotateColorPicker?.setAttribute('draggable', 'true');
            if (annotateColorInput) annotateColorInput.value = annotatePickerColor;
            if (typeof saveFocusedWorkspaceControlsForTab === 'function' && typeof isFocusedWorkspaceMode === 'function' && isFocusedWorkspaceMode()) {
              saveFocusedWorkspaceControlsForTab(sidebarTab);
              if (typeof saveToStorageDebounced === 'function') saveToStorageDebounced();
            }
          });
          annotateColorHex.addEventListener('blur', () => {
            const normalized = normalizeHexColor(annotateColorHex.value);
            if (normalized) annotateColorHex.value = normalized;
          });
        }
        function toggleBibleToolPanel(event) {
          const panel = document.getElementById('dual-version-panel');
          if (!panel) return;
          event.stopPropagation();
          panel.classList.toggle('open');
          if (panel.classList.contains('open')) positionDualVersionPanel();
        }
        window.addEventListener('click', (event) => {
          const panel = document.getElementById('dual-version-panel');
          const button = document.getElementById('btn-bible-tool');
          if (!panel || !panel.classList.contains('open')) return;
          if ((button && button.contains(event.target)) || panel.contains(event.target)) return;
          panel.classList.remove('open');
        });
        window.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') {
            const panel = document.getElementById('dual-version-panel');
            panel?.classList.remove('open');
          }
        });
        window.addEventListener('resize', () => {
          positionAnnotateToolbar();
          positionDualVersionPanel();
        });
        window.addEventListener('scroll', () => {
          positionAnnotateToolbar();
          positionDualVersionPanel();
        }, true);
