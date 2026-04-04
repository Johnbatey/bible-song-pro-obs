    function getSearchTabKey(rawTab) {
      const tab = String(rawTab || '').toLowerCase();
      return SEARCH_TABS.includes(tab) ? tab : 'songs';
    }

    function getSearchValueForTab(tab) {
      return searchQueriesByTab[getSearchTabKey(tab)] || '';
    }

    function setSearchValueForTab(tab, value) {
      searchQueriesByTab[getSearchTabKey(tab)] = value != null ? String(value) : '';
    }

    function getSearchSnapshot() {
      const snapshot = {};
      SEARCH_TABS.forEach(t => {
        snapshot[t] = getSearchValueForTab(t);
      });
      return snapshot;
    }

    function restoreSearchInputForCurrentTab() {
      const input = document.getElementById('song-search');
      const mirror = document.getElementById('nav-mirror-search');
      if (!input) return;
      const query = getSearchValueForTab(sidebarTab);
      if (input.value !== query) {
        input.value = query;
      }
      if (mirror && mirror.value !== query) {
        mirror.value = query;
      }
    }

    function restoreSearchQueriesFromState(state) {
      const saved = state && state.ui ? state.ui.searchText : null;
      const entries = (saved && typeof saved === 'object' && !Array.isArray(saved)) ? saved : null;
      const fallback = (typeof saved === 'string') ? saved : '';
      SEARCH_TABS.forEach(tab => {
        if (entries && entries[tab] != null) {
          searchQueriesByTab[tab] = String(entries[tab]);
        } else if (fallback) {
          searchQueriesByTab[tab] = fallback;
        } else {
          searchQueriesByTab[tab] = '';
        }
      });
    }

    function normalizeBibleRefKey(value) {
      return normalizeSearchText(String(value || '')).replace(/\s+/g, ' ').trim();
    }

    function sanitizeBibleRefEntries(entries, maxItems) {
      if (!Array.isArray(entries)) return [];
      const out = [];
      const seen = new Set();
      entries.forEach(raw => {
        if (!raw || typeof raw !== 'object') return;
        const query = String(raw.query || '').trim();
        if (!query) return;
        const versionId = String(raw.versionId || '').trim();
        const key = `${normalizeBibleRefKey(query)}|${normalizeBibleRefKey(versionId)}`;
        if (!key || seen.has(key)) return;
        seen.add(key);
        out.push({
          query,
          versionId: versionId || null,
          title: String(raw.title || query),
          ts: Number(raw.ts) || Date.now()
        });
      });
      return out.slice(0, Math.max(1, Number(maxItems) || 1));
    }

    function getCurrentBibleRefFromView() {
      if (sidebarTab !== 'bible' || !currentItem || !getIsBibleItem(currentItem)) return null;
      const extracted = extractBookAndChapter(currentItem);
      const book = String(extracted.book || '').trim();
      const chap = String(extracted.chap || '').trim();
      if (!book || !chap) return null;
      let verseStart = '';
      let verseEnd = '';
      const pages = getPagesFromItem(currentItem, true);
      const page = pages[Math.max(0, Math.min(lineCursor || 0, Math.max(0, pages.length - 1)))];
      if (page && page.raw) {
        const lines = String(page.raw).split('\n').map(l => l.trim()).filter(Boolean);
        const first = lines.find(l => /^\d+/.test(l));
        const last = [...lines].reverse().find(l => /^\d+/.test(l));
        const firstMatch = first ? first.match(/^(\d+)/) : null;
        const lastMatch = last ? last.match(/^(\d+)/) : null;
        verseStart = firstMatch ? firstMatch[1] : '';
        verseEnd = lastMatch ? lastMatch[1] : verseStart;
      }
      const verseSuffix = verseStart ? `:${verseStart}${(verseEnd && verseEnd !== verseStart) ? `-${verseEnd}` : ''}` : '';
      const query = `${book} ${chap}${verseSuffix}`.trim();
      return {
        query,
        title: query,
        versionId: activeBibleVersion || null,
        ts: Date.now()
      };
    }

    function buildBibleRefEntry(book, chapter, verseStart, verseEnd, versionId) {
      const cleanBook = String(book || '').trim();
      const cleanChapter = String(chapter || '').trim();
      if (!cleanBook || !cleanChapter) return null;
      const vStart = String(verseStart || '').trim();
      const vEnd = String(verseEnd || '').trim();
      const verseSuffix = vStart ? `:${vStart}${(vEnd && vEnd !== vStart) ? `-${vEnd}` : ''}` : '';
      const query = `${cleanBook} ${cleanChapter}${verseSuffix}`.trim();
      return {
        query,
        title: query,
        versionId: versionId || activeBibleVersion || null,
        ts: Date.now()
      };
    }

    function addBibleRecentReference(entry, opts = {}) {
      const cleanList = sanitizeBibleRefEntries([entry], 1);
      if (!cleanList.length) return;
      const clean = cleanList[0];
      const key = `${normalizeBibleRefKey(clean.query)}|${normalizeBibleRefKey(clean.versionId || '')}`;
      bibleRecentRefs = sanitizeBibleRefEntries(
        [clean, ...bibleRecentRefs.filter(ref => `${normalizeBibleRefKey(ref.query)}|${normalizeBibleRefKey(ref.versionId || '')}` !== key)],
        MAX_BIBLE_RECENT_REFS
      );
      if (!opts.silent) saveToStorageDebounced();
      renderBibleReferencePicker();
      renderMirrorBibleReferencePicker();
    }

    function pinBibleReference(entry, opts = {}) {
      const cleanList = sanitizeBibleRefEntries([entry], 1);
      if (!cleanList.length) return;
      const clean = cleanList[0];
      const key = `${normalizeBibleRefKey(clean.query)}|${normalizeBibleRefKey(clean.versionId || '')}`;
      biblePinnedRefs = sanitizeBibleRefEntries(
        [clean, ...biblePinnedRefs.filter(ref => `${normalizeBibleRefKey(ref.query)}|${normalizeBibleRefKey(ref.versionId || '')}` !== key)],
        MAX_BIBLE_PINNED_REFS
      );
      addBibleRecentReference(clean, { silent: true });
      if (!opts.silent) saveToStorageDebounced();
      renderBibleReferencePicker();
      renderMirrorBibleReferencePicker();
    }

    function unpinBibleReference(query, versionId, opts = {}) {
      const key = `${normalizeBibleRefKey(query)}|${normalizeBibleRefKey(versionId || '')}`;
      biblePinnedRefs = biblePinnedRefs.filter(ref => `${normalizeBibleRefKey(ref.query)}|${normalizeBibleRefKey(ref.versionId || '')}` !== key);
      if (!opts.silent) saveToStorageDebounced();
      renderBibleReferencePicker();
      renderMirrorBibleReferencePicker();
    }

    function isPinnedBibleReference(query, versionId) {
      const key = `${normalizeBibleRefKey(query)}|${normalizeBibleRefKey(versionId || '')}`;
      return biblePinnedRefs.some(ref => `${normalizeBibleRefKey(ref.query)}|${normalizeBibleRefKey(ref.versionId || '')}` === key);
    }

    function setBibleReferencePickerOpen(open) {
      const picker = document.getElementById('bible-ref-picker');
      const btn = document.getElementById('bible-ref-history-btn');
      if (!picker || !btn) return;
      const shouldOpen = !!open && sidebarTab === 'bible';
      picker.style.display = shouldOpen ? 'block' : 'none';
      btn.classList.toggle('active', shouldOpen);
      if (shouldOpen) {
        const ac = document.getElementById('search-autocomplete');
        if (ac) ac.style.display = 'none';
        setMirrorBibleReferencePickerOpen(false);
      }
    }

    function setMirrorBibleReferencePickerOpen(open) {
      const picker = document.getElementById('nav-mirror-bible-ref-picker');
      const btn = document.getElementById('nav-mirror-ref-history-btn');
      if (!picker || !btn) return;
      const shouldOpen = !!open && sidebarTab === 'bible';
      picker.style.display = shouldOpen ? 'block' : 'none';
      btn.classList.toggle('active', shouldOpen);
      if (shouldOpen) {
        const results = document.getElementById('nav-mirror-results');
        if (results) results.style.display = 'none';
        setBibleReferencePickerOpen(false);
      }
    }

    function applyBibleReferenceEntry(entry) {
      if (!entry || !entry.query) return;
      if (entry.versionId && bibles[entry.versionId]) {
        activeBibleVersion = entry.versionId;
        renderVersionBar();
      }
      const input = document.getElementById('song-search');
      if (input) input.value = entry.query;
      const mirror = document.getElementById('nav-mirror-search');
      if (mirror) mirror.value = entry.query;
      setSearchValueForTab('bible', entry.query);
      setBibleReferencePickerOpen(false);
      setMirrorBibleReferencePickerOpen(false);
      handleSearchImmediate(entry.query, 'bible');
      addBibleRecentReference(entry);
    }

    function renderBibleReferencePicker() {
      const picker = document.getElementById('bible-ref-picker');
      if (!picker) return;
      if (sidebarTab !== 'bible') {
        picker.style.display = 'none';
        picker.innerHTML = '';
        return;
      }
      picker.innerHTML = '';
      const groups = [
        { label: t('ui_pinned'), items: biblePinnedRefs, pinnedGroup: true },
        {
          label: t('ui_recent'),
          items: bibleRecentRefs.filter(ref => !isPinnedBibleReference(ref.query, ref.versionId)),
          pinnedGroup: false
        }
      ];
      let hasRows = false;
      groups.forEach(group => {
        const label = document.createElement('div');
        label.className = 'bible-ref-group-label';
        label.textContent = group.label;
        picker.appendChild(label);
        if (!group.items.length) {
          const empty = document.createElement('div');
          empty.className = 'bible-ref-empty';
          empty.textContent = group.pinnedGroup ? t('ui_no_pinned_references_yet') : t('ui_no_recent_references_yet');
          picker.appendChild(empty);
          return;
        }
        hasRows = true;
        group.items.forEach(ref => {
          const row = document.createElement('button');
          row.type = 'button';
          row.className = 'bible-ref-item';
          row.onmousedown = (e) => e.preventDefault();
          row.onclick = () => applyBibleReferenceEntry(ref);
          const main = document.createElement('span');
          main.className = 'bible-ref-item-main';
          const title = document.createElement('span');
          title.className = 'bible-ref-item-title';
          title.textContent = ref.title || ref.query;
          const meta = document.createElement('span');
          meta.className = 'bible-ref-item-meta';
          meta.textContent = ref.versionId || t('ui_current_version');
          main.appendChild(title);
          main.appendChild(meta);
          row.appendChild(main);
          const pin = document.createElement('button');
          pin.type = 'button';
          pin.className = 'bible-ref-item-pin' + (isPinnedBibleReference(ref.query, ref.versionId) ? ' is-pinned' : '');
          pin.textContent = 'P';
          pin.title = isPinnedBibleReference(ref.query, ref.versionId) ? t('ui_unpin_reference') : t('ui_pin_reference');
          pin.onmousedown = (e) => e.preventDefault();
          pin.onclick = (e) => {
            e.stopPropagation();
            if (isPinnedBibleReference(ref.query, ref.versionId)) unpinBibleReference(ref.query, ref.versionId);
            else pinBibleReference(ref);
          };
          row.appendChild(pin);
          picker.appendChild(row);
        });
      });
      if (!hasRows) {
        const empty = document.createElement('div');
        empty.className = 'bible-ref-empty';
        empty.textContent = t('ui_search_bible_reference_pin_help');
        picker.appendChild(empty);
      }
    }

    function renderMirrorBibleReferencePicker() {
      const picker = document.getElementById('nav-mirror-bible-ref-picker');
      if (!picker) return;
      if (sidebarTab !== 'bible') {
        picker.style.display = 'none';
        picker.innerHTML = '';
        return;
      }
      picker.innerHTML = '';
      const groups = [
        { label: t('ui_pinned'), items: biblePinnedRefs, pinnedGroup: true },
        {
          label: t('ui_recent'),
          items: bibleRecentRefs.filter(ref => !isPinnedBibleReference(ref.query, ref.versionId)),
          pinnedGroup: false
        }
      ];
      let hasRows = false;
      groups.forEach(group => {
        const label = document.createElement('div');
        label.className = 'bible-ref-group-label';
        label.textContent = group.label;
        picker.appendChild(label);
        if (!group.items.length) {
          const empty = document.createElement('div');
          empty.className = 'bible-ref-empty';
          empty.textContent = group.pinnedGroup ? t('ui_no_pinned_references_yet') : t('ui_no_recent_references_yet');
          picker.appendChild(empty);
          return;
        }
        hasRows = true;
        group.items.forEach(ref => {
          const row = document.createElement('button');
          row.type = 'button';
          row.className = 'bible-ref-item';
          row.onmousedown = (e) => e.preventDefault();
          row.onclick = () => {
            applyBibleReferenceEntry(ref);
            const mirror = document.getElementById('nav-mirror-search');
            if (mirror) mirror.focus();
          };
          const main = document.createElement('span');
          main.className = 'bible-ref-item-main';
          const title = document.createElement('span');
          title.className = 'bible-ref-item-title';
          title.textContent = ref.title || ref.query;
          const meta = document.createElement('span');
          meta.className = 'bible-ref-item-meta';
          meta.textContent = ref.versionId || t('ui_current_version');
          main.appendChild(title);
          main.appendChild(meta);
          row.appendChild(main);
          const pin = document.createElement('button');
          pin.type = 'button';
          pin.className = 'bible-ref-item-pin' + (isPinnedBibleReference(ref.query, ref.versionId) ? ' is-pinned' : '');
          pin.textContent = 'P';
          pin.title = isPinnedBibleReference(ref.query, ref.versionId) ? t('ui_unpin_reference') : t('ui_pin_reference');
          pin.onmousedown = (e) => e.preventDefault();
          pin.onclick = (e) => {
            e.stopPropagation();
            if (isPinnedBibleReference(ref.query, ref.versionId)) unpinBibleReference(ref.query, ref.versionId);
            else pinBibleReference(ref);
          };
          row.appendChild(pin);
          picker.appendChild(row);
        });
      });
      if (!hasRows) {
        const empty = document.createElement('div');
        empty.className = 'bible-ref-empty';
        empty.textContent = t('ui_search_bible_reference_pin_help');
        picker.appendChild(empty);
      }
    }

    function updateBibleSearchToolsVisibility() {
      const isBible = sidebarTab === 'bible';
      const pinBtn = document.getElementById('bible-ref-pin-current');
      const historyBtn = document.getElementById('bible-ref-history-btn');
      const mirrorPinBtn = document.getElementById('nav-mirror-ref-pin-current');
      const mirrorHistoryBtn = document.getElementById('nav-mirror-ref-history-btn');
      if (pinBtn) pinBtn.style.display = isBible ? 'inline-flex' : 'none';
      if (historyBtn) historyBtn.style.display = isBible ? 'inline-flex' : 'none';
      if (mirrorPinBtn) mirrorPinBtn.style.display = isBible ? 'inline-flex' : 'none';
      if (mirrorHistoryBtn) mirrorHistoryBtn.style.display = isBible ? 'inline-flex' : 'none';
      if (!isBible) {
        setBibleReferencePickerOpen(false);
        setMirrorBibleReferencePickerOpen(false);
      }
    }

    function bindBibleReferenceSearchTools() {
      const input = document.getElementById('song-search');
      const pinBtn = document.getElementById('bible-ref-pin-current');
      const historyBtn = document.getElementById('bible-ref-history-btn');
      if (!input || !pinBtn || !historyBtn || historyBtn.dataset.bound === '1') return;
      historyBtn.dataset.bound = '1';
      pinBtn.onclick = () => {
        const ref = getCurrentBibleRefFromView();
        if (!ref) {
          showToast('No active Bible reference to pin');
          return;
        }
        pinBibleReference(ref);
        showToast(t('reference_pinned'));
      };
      historyBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        renderBibleReferencePicker();
        const picker = document.getElementById('bible-ref-picker');
        const shouldOpen = !picker || picker.style.display === 'none';
        setBibleReferencePickerOpen(shouldOpen);
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') setBibleReferencePickerOpen(false);
      });
    }

    function applyAutoLiteralTranslations() {
      const roots = AUTO_I18N_ROOT_SELECTORS
        .map((selector) => document.querySelector(selector))
        .filter(Boolean);
      const skipSelector = [
        '#song-list',
        '#version-bar',
        '#search-autocomplete',
        '#bible-ref-picker',
        '#nav-mirror-results',
        '#nav-mirror-bible-ref-picker',
        '#dual-version-primary-menu',
        '#dual-version-secondary-menu',
        '#scene-list',
        '#sources-list',
        '#controls-panel-body',
        '#extras-panel-body',
        '#new-song-search-results',
        '#auto-lyrics-results',
        '#remote-show-debug-log'
      ].join(',');
      const translateAttr = (el, attrName, sourceName) => {
        const stored = el.dataset[sourceName];
        const raw = stored != null ? stored : String(el.getAttribute(attrName) || '').trim();
        if (!raw) return;
        if (stored == null) el.dataset[sourceName] = raw;
        const key = AUTO_I18N_LITERAL_MAP[raw];
        if (key) el.setAttribute(attrName, t(key));
      };
      roots.forEach((root) => {
        root.querySelectorAll('*').forEach((el) => {
          if (!el || el.closest(skipSelector)) return;
          if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
          if (!el.hasAttribute('data-i18n') && el.children.length === 0) {
            const raw = el.dataset.i18nAutoText != null ? el.dataset.i18nAutoText : String(el.textContent || '').trim();
            if (raw) {
              if (el.dataset.i18nAutoText == null) el.dataset.i18nAutoText = raw;
              const key = AUTO_I18N_LITERAL_MAP[raw];
              if (key) el.textContent = t(key);
            }
          }
          if (!el.hasAttribute('data-i18n-title')) translateAttr(el, 'title', 'i18nAutoTitle');
          if (!el.hasAttribute('data-i18n-placeholder')) translateAttr(el, 'placeholder', 'i18nAutoPlaceholder');
          if (!el.hasAttribute('data-i18n-aria-label')) translateAttr(el, 'aria-label', 'i18nAutoAriaLabel');
        });
      });
    }
    function t(key) {
      const dict = I18N[currentLanguage] || I18N.en || {};
      if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
      const fallback = I18N.en || {};
      return fallback[key] || key;
    }

    function refreshTranslatedRuntimeUi() {
      const fontHint = document.getElementById('font-upload-hint');
      if (fontHint) {
        fontHint.innerText = customFonts.length
          ? t(customFonts.length > 1 ? 'settings_custom_fonts_loaded_plural' : 'settings_custom_fonts_loaded').replace('{count}', String(customFonts.length))
          : t('settings_no_custom_font_loaded');
      }
      const bgHint = document.getElementById('bg-upload-hint');
      if (bgHint) bgHint.innerText = bgUploadDataUrl ? t('settings_image_selected') : t('settings_no_image_selected');
      const bgVideoHint = document.getElementById('bg-video-upload-hint');
      if (bgVideoHint) bgVideoHint.innerText = bgVideoUploadDataUrl ? t('settings_video_selected') : t('settings_no_video_selected');
      renderCustomFontList();
      renderPresetList();
    }

    function refreshLanguageSensitiveViews() {
      renderBibleReferencePicker();
      renderMirrorBibleReferencePicker();
      renderVersionBar();
      updateBibleLists();
      renderSongs();
      renderDualVersionPickers();
      if (footerBibleVersionPopoverOpen) {
        renderFooterBibleVersionPopover();
        requestAnimationFrame(positionFooterBibleVersionPopover);
      }
      if (outputPopoverOpen) {
        renderOutputScreenPopover();
      }
      const abPopup = document.getElementById('ab-settings-popup');
      if (abPopup && abPopup.classList.contains('open')) {
        buildAbLangSubmenu();
      }
    }

    function applyLanguage() {
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (!key) return;
        el.textContent = t(key);
      });
      document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (!key) return;
        el.title = t(key);
      });
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (!key) return;
        el.setAttribute('placeholder', t(key));
      });
      document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
        const key = el.getAttribute('data-i18n-aria-label');
        if (!key) return;
        el.setAttribute('aria-label', t(key));
      });
      if (!isLive || !livePointer || livePointer.kind !== 'bible') {
        const previewRefTextEl = document.getElementById('previewRefText');
        const previewMainTextEl = document.getElementById('previewMainText');
        const previewVerseTextEl = document.getElementById('previewVerseText');
        const previewRef = t('preview_ref_default');
        const previewVer = t('preview_version_default');
        const previewBody = `<span class="preview-verse-sup">1</span>${t('preview_verse_default')}`;
        if (previewRefTextEl) previewRefTextEl.innerHTML = `${previewRef}${previewVer ? ' (' + previewVer + ')' : ''}`;
        if (previewMainTextEl) previewMainTextEl.innerHTML = previewBody;
        if (previewVerseTextEl) previewVerseTextEl.innerHTML = previewBody;
        styleCanvasState.sample = { ref: previewRef, version: previewVer, verseHtml: previewBody };
      }
      updateSearchPlaceholder();
      updateStatusText();
      setupExplicitTooltips();
      renderLtStylePicker();
      renderSidebarQuickActionsPanel();
      refreshTranslatedRuntimeUi();
      refreshLanguageSensitiveViews();
      if (editingStyleId) updateStyleEditorMeta(ltStyles[editingStyleId] || { type: 'custom' });
      applyAutoLiteralTranslations();
    }

    function populateLanguageSelect() {
      const select = document.getElementById('language-select');
      if (!select) return;
      const prev = select.value || currentLanguage || 'en';
      select.innerHTML = '';
      LANGUAGES.forEach(lang => {
        const opt = document.createElement('option');
        opt.value = lang.code;
        opt.textContent = lang.label;
        select.appendChild(opt);
      });
      select.value = prev;
      if (!select.value) select.value = currentLanguage || 'en';
    }

    function setLanguage(lang, opts = {}) {
      const known = LANGUAGES.some(entry => entry.code === lang);
      const next = known ? lang : 'en';
      const select = document.getElementById('language-select');
      if (select && !select.options.length) populateLanguageSelect();
      currentLanguage = next;
      try { localStorage.setItem('bible_app_language', next); } catch (_) {}
      document.documentElement.lang = next;
      if (select) select.value = next;
      applyLanguage();
      if (!opts.silent) saveToStorage();
    }

    function handleLanguageChange() {
      const select = document.getElementById('language-select');
      if (!select) return;
      setLanguage(select.value);
    }

    function updateStatusText() {
      const text = document.getElementById('status-text');
      if (!text) return;
      text.textContent = isDisplayOnline ? t('status_online') : t('status_offline');
    }

    const previewBaseScale = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--preview-base-scale') || '1') || 1;
    const BIBLE_BOOKS = {1:"Genesis",2:"Exodus",3:"Leviticus",4:"Numbers",5:"Deuteronomy",6:"Joshua",7:"Judges",8:"Ruth",9:"1 Samuel",10:"2 Samuel",11:"1 Kings",12:"2 Kings",13:"1 Chronicles",14:"2 Chronicles",15:"Ezra",16:"Nehemiah",17:"Esther",18:"Job",19:"Psalms",20:"Proverbs",21:"Ecclesiastes",22:"Song of Solomon",23:"Isaiah",24:"Jeremiah",25:"Lamentations",26:"Ezekiel",27:"Daniel",28:"Hosea",29:"Joel",30:"Amos",31:"Obadiah",32:"Jonah",33:"Micah",34:"Nahum",35:"Habakkuk",36:"Zephaniah",37:"Haggai",38:"Zechariah",39:"Malachi",40:"Matthew",41:"Mark",42:"Luke",43:"John",44:"Acts",45:"Romans",46:"1 Corinthians",47:"2 Corinthians",48:"Galatians",49:"Ephesians",50:"Philippians",51:"Colossians",52:"1 Thessalonians",53:"2 Thessalonians",54:"1 Timothy",55:"2 Timothy",56:"Titus",57:"Philemon",58:"Hebrews",59:"James",60:"1 Peter",61:"2 Peter",62:"1 John",63:"2 John",64:"3 John",65:"Jude",66:"Revelation"};
    const buildTranslationMap = (list) => {
      const arr = (list || "").split('\n').map(s => s.trim()).filter(Boolean);
      const map = {};
      arr.forEach((name, idx) => { map[String(idx + 1)] = name; });
      return map;
    };
    const BIBLE_BOOK_TRANSLATIONS = {
      afrikaans: {
        1:"Genesis",2:"Eksodus",3:"Levitikus",4:"Numeri",5:"Deuteronomium",6:"Josua",7:"Rigtis",8:"Rut",9:"1 Samuel",10:"2 Samuel",11:"1 Konings",12:"2 Konings",13:"1 Kronieke",14:"2 Kronieke",15:"Esra",16:"Nehemia",17:"Ester",18:"Job",19:"Psalms",20:"Spreuke",21:"Prediker",22:"Hooglied",23:"Jesaja",24:"Jeremia",25:"Klaagliedere",26:"Esekiël",27:"Daniël",28:"Hosea",29:"Joël",30:"Amos",31:"Obadja",32:"Jona",33:"Miga",34:"Nahum",35:"Habakuk",36:"Sefanja",37:"Haggai",38:"Sagaria",39:"Maleagi",40:"Matteus",41:"Markus",42:"Lukas",43:"Johannes",44:"Handelinge",45:"Romeine",46:"1 Korintiërs",47:"2 Korintiërs",48:"Galasiërs",49:"Efesiërs",50:"Filippense",51:"Kolossense",52:"1 Tessalonisense",53:"2 Tessalonisense",54:"1 Timoteus",55:"2 Timoteus",56:"Titus",57:"Filemon",58:"Hebrëers",59:"Jakobus",60:"1 Petrus",61:"2 Petrus",62:"1 Johannes",63:"2 Johannes",64:"3 Johannes",65:"Judas",66:"Openbaring"
      },
      arabic: {
        1:"تكوين",2:"خروج",3:"لاويين",4:"عدد",5:"تثنية",6:"يشوع",7:"قضاة",8:"راعوث",9:"1 صموئيل",10:"2 صموئيل",11:"1 ملوك",12:"2 ملوك",13:"1 أخبار",14:"2 أخبار",15:"عزرا",16:"نحميا",17:"أستير",18:"أيوب",19:"مزامير",20:"أمثال",21:"جامعة",22:"نشيد الأنشاد",23:"إشعياء",24:"إرميا",25:"مراثي",26:"حزقيال",27:"دانيال",28:"هوشع",29:"يوئيل",30:"عاموس",31:"عوبديا",32:"يونان",33:"ميخا",34:"ناحوم",35:"حبقوق",36:"صفنيا",37:"حجي",38:"زكريا",39:"ملاخي",40:"متى",41:"مرقس",42:"لوقا",43:"يوحنا",44:"أعمال",45:"رومية",46:"1 كورنثوس",47:"2 كورنثوس",48:"غلاطية",49:"أفسس",50:"فيلبي",51:"كولوسي",52:"1 تسالونيكي",53:"2 تسالونيكي",54:"1 تيموثاوس",55:"2 تيموثاوس",56:"تيطس",57:"فليمون",58:"عبرانيين",59:"يعقوب",60:"1 بطرس",61:"2 بطرس",62:"1 يوحنا",63:"2 يوحنا",64:"3 يوحنا",65:"يهوذا",66:"رؤيا"
      },
      albanian: {
        1:"Zanafilla",2:"Eksodi",3:"Levitiku",4:"Numrat",5:"Ligji i Përtërirë",6:"Jozueu",7:"Gjyqtarët",8:"Ruta",9:"1 Samuelit",10:"2 Samuelit",11:"1 Mbretërve",12:"2 Mbretërve",13:"1 Kronikave",14:"2 Kronikave",15:"Esdra",16:"Nehemia",17:"Esteri",18:"Jobi",19:"Psalmet",20:"Fjalët e Urta",21:"Predikuesi",22:"Kënga e Këngëve",23:"Isaia",24:"Jeremia",25:"Vajtimet",26:"Ezekieli",27:"Danieli",28:"Osea",29:"Joeli",30:"Amosi",31:"Abdia",32:"Jona",33:"Mikea",34:"Nahumi",35:"Habakuku",36:"Sofonia",37:"Agjeu",38:"Zakaria",39:"Malakia",40:"Mateu",41:"Marku",42:"Luka",43:"Gjoni",44:"Veprat",45:"Romakëve",46:"1 Korintasve",47:"2 Korintasve",48:"Galatasve",49:"Efesianëve",50:"Filipianëve",51:"Kolosianëve",52:"1 Selanikasve",53:"2 Selanikasve",54:"1 Timoteut",55:"2 Timoteut",56:"Titit",57:"Filemonit",58:"Hebrenjve",59:"Jakobi",60:"1 Pjetrit",61:"2 Pjetrit",62:"1 Gjonit",63:"2 Gjonit",64:"3 Gjonit",65:"Juda",66:"Zbulimi"
      },
      amharic: {
        1:"ዘፍጥረት",2:"ዘጸአት",3:"ዘሌዋውያን",4:"ዘሁልቁ",5:"ዘዳግም",6:"እያሱ",7:"መሳፍንቲ",8:"ሩት",9:"1 ሳሙኤል",10:"2 ሳሙኤል",11:"1 ነገሥት",12:"2 ነገሥት",13:"1 ዜና መዋዕል",14:"2 ዜና መዋዕል",15:"እዝራ",16:"ነህምያ",17:"አስቴር",18:"እዮብ",19:"መዝሙር",20:"ምስላ",21:"መክብብ",22:"መኃልየ መኃልይ",23:"ኢሳይያስ",24:"ኤርምያስ",25:"ሰቆቃው ኤርምያስ",26:"ሕዝቅኤል",27:"ዳንኤል",28:"ሆሴዕ",29:"እዩኤል",30:"አሞጽ",31:"አብድዩ",32:"ዮናስ",33:"ሚክያስ",34:"ናሆም",35:"ዕንባቆም",36:"ሶፎንያስ",37:"ሓጌ",38:"ዘካርያስ",39:"ሚልክያስ",40:"ማቴዎስ",41:"ማርቆስ",42:"ሉቃስ",43:"ዮሐንስ",44:"ግብረ ሃዋርያት",45:"ሮሜ",46:"1 ቈረንቶስ",47:"2 ቈረንቶስ",48:"ገላትያ",49:"ኤፌሶን",50:"ፊልጵስዩስ",51:"ቈላሴ",52:"1 ተሰሎንቄ",53:"2 ተሰሎንቄ",54:"1 ጢሞቴዎስ",55:"2 ጢሞቴዎስ",56:"ቲቶ",57:"ፊልሞና",58:"እብራውያን",59:"ያዕቆብ",60:"1 ጴጥሮስ",61:"2 ጴጥሮስ",62:"1 ዮሐንስ",63:"2 ዮሐንስ",64:"3 ዮሐንስ",65:"ይሁዳ",66:"የዮሐንስ ራእይ"
      },
      arabic: {
        1:"تكوين",2:"خروج",3:"لاويين",4:"عدد",5:"تثنية",6:"يشوع",7:"قضاة",8:"راعوث",9:"1 صموئيل",10:"2 صموئيل",11:"1 ملوك",12:"2 ملوك",13:"1 أخبار",14:"2 أخبار",15:"عزرا",16:"نحميا",17:"أستير",18:"أيوب",19:"مزامير",20:"أمثال",21:"جامعة",22:"نشيد الأنشاد",23:"إشعياء",24:"إرميا",25:"مراثي",26:"حزقيال",27:"دانيال",28:"هوشع",29:"يوئيل",30:"عاموس",31:"عوبديا",32:"يونان",33:"ميخا",34:"ناحوم",35:"حبقوق",36:"صفنيا",37:"حجي",38:"زكريا",39:"ملاخي",40:"متى",41:"مرقس",42:"لوقا",43:"يوحنا",44:"أعمال",45:"رومية",46:"1 كورنثوس",47:"2 كورنثوس",48:"غلاطية",49:"أفسس",50:"فيلبي",51:"كولوسي",52:"1 تسالونيكي",53:"2 تسالونيكي",54:"1 تيموثاوس",55:"2 تيموثاوس",56:"تيطس",57:"فليمون",58:"عبرانيين",59:"يعقوب",60:"1 بطرس",61:"2 بطرس",62:"1 يوحنا",63:"2 يوحنا",64:"3 يوحنا",65:"يهوذا",66:"رؤيا"
      },
      armenian: {
        1:"Ծննդոց",2:"Ելից",3:"Ղևտական",4:"Թվեր",5:"Երկրորդ Օրենք",6:"Հեսու",7:"Դատավորներ",8:"Հռութ",9:"1 Թագավորաց",10:"2 Թագավորաց",11:"3 Թագավորաց",12:"4 Թագավորաց",13:"1 Մնացորդաց",14:"2 Մնացորդաց",15:"Եզրաս",16:"Նեմի",17:"Եսթեր",18:"Հոբ",19:"Սաղմոսներ",20:"Առակներ",21:"Ժողովող",22:"Երգ Երգոց",23:"Եսայի",24:"Երեմիա",25:"Ողբ",26:"Եզեկիել",27:"Դանիել",28:"Օսեե",29:"Հովել",30:"Ամոս",31:"Աբդիու",32:"Հովնան",33:"Միքիա",34:"Նավում",35:"Ամբակում",36:"Սոփոնիա",37:"Անգե",38:"Զաքարիա",39:"Մաղաքիա",40:"Մատթեոս",41:"Մարկոս",42:"Ղուկաս",43:"Հովհաննես",44:"Գործք Առաքելոց",45:"Հռոմեացիս",46:"1 Կորնթացիս",47:"2 Կորնթացիս",48:"Գաղատացիս",49:"Եփեսացիս",50:"Փիլիպպեցիս",51:"Կողոսացիս",52:"1 Թեսաղոնիկեցիս",53:"2 Թեսաղոնիկեցիս",54:"1 Տիմոթեոս",55:"2 Տիմոթեոս",56:"Տիտոս",57:"Փիլիմոն",58:"Եբրայեցիս",59:"Հակոբոս",60:"1 Պետրոս",61:"2 Պետրոս",62:"1 Հովհաննես",63:"2 Հովհաննես",64:"3 Հովհաննես",65:"Հուդա",66:"Հայտնություն"
      },
      bengali: {
        1:"আদিপুস্তক",2:"যাত্রাপুস্তক",3:"লেবীয়পুস্তক",4:"গণনাপুস্তক",5:"দ্বিতীয় বিবরণ",6:"যিহোশূয়",7:"বিচারকর্তৃগণ",8:"রূথ",9:"1 শমূয়েল",10:"2 শমূয়েল",11:"1 রাজাবলি",12:"2 রাজাবলি",13:"1 বংশাবলি",14:"2 বংশাবলি",15:"ইজ্রা",16:"নহেমিয়",17:"ইষ্টের",18:"ইয়োব",19:"গীতসংহিতা",20:"হিতোপদেশ",21:"উপদেশক",22:"পরম গীত",23:"যিশাইয়",24:"যিরমিয়",25:"বিলাপ",26:"যিহিষ্কেল",27:"দানিয়েল",28:"হোশেয়",29:"যোয়েল",30:"আমোষ",31:"ওবদীয়",32:"যোনা",33:"মীখা",34:"নহূম",35:"হবক্কূক",36:"সফনিয়",37:"হগয়",38:"সখরিয়",39:"মালাখি",40:"মথি",41:"মার্ক",42:"লূক",43:"যোহন",44:"প্রেরিত",45:"রোমীয়",46:"1 করিন্থীয়",47:"2 করিন্থীয়",48:"গালাতীয়",49:"ইফিষীয়",50:"ফিলিপীয়",51:"কলসীয়",52:"1 থিষলনীকীয়",53:"2 থিষলনীকীয়",54:"1 তীমথিয়",55:"2 তীমথিয়",56:"তীত",57:"ফিলেমোন",58:"ইব্রীয়",59:"যাকোব",60:"1 পিতর",61:"2 পিতর",62:"1 যোহন",63:"2 যোহন",64:"3 যোহন",65:"যিহূদা",66:"প্রকাশিত বাক্য"
      },
      bulgarian: {
        1:"Битие",2:"Изход",3:"Левит",4:"Числа",5:"Второзаконие",6:"Исус Навин",7:"Съдии",8:"Рут",9:"1 Царе",10:"2 Царе",11:"3 Царе",12:"4 Царе",13:"1 Летописи",14:"2 Летописи",15:"Ездра",16:"Неемия",17:"Естир",18:"Йов",19:"Псалми",20:"Притчи",21:"Еклисиаст",22:"Песен на песните",23:"Исая",24:"Еремия",25:"Плачът на Еремия",26:"Езекиил",27:"Даниил",28:"Осия",29:"Йоил",30:"Амос",31:"Авдий",32:"Йона",33:"Михей",34:"Наум",35:"Авакум",36:"Софония",37:"Агей",38:"Захария",39:"Малахия",40:"Матей",41:"Марк",42:"Лука",43:"Йоан",44:"Деяния",45:"Римляни",46:"1 Коринтяни",47:"2 Коринтяни",48:"Галатяни",49:"Ефесяни",50:"Филипяни",51:"Колосяни",52:"1 Солунци",53:"2 Солунци",54:"1 Тимотей",55:"2 Тимотей",56:"Тит",57:"Филимон",58:"Евреи",59:"Яков",60:"1 Петър",61:"2 Петър",62:"1 Йоан",63:"2 Йоান",64:"3 Йоан",65:"Юда",66:"Откровение"
      },
      bundeli: {
        1:"उत्पत्ति",2:"निर्गमन",3:"लैव्यव्यवस्था",4:"गणना",5:"व्यवस्था",6:"यहोशू",7:"न्यायि",8:"रूत",9:"1 समुएल",10:"2 समुएल",11:"1 राजा",12:"2 राजा",13:"1 इतिहास",14:"2 इतिहास",15:"एज्रा",16:"नहेमायाह",17:"एस्तेर",18:"अय्यूब",19:"भजन",20:"नीतिवचन",21:"सभोपदेशक",22:"श्रेष्ठगीत",23:"यशायाह",24:"यिर्मयाह",25:"विलाप",26:"यहेजकेल",27:"दानिय्येल",28:"होशे",29:"योएल",30:"आमोस",31:"ओबद्याह",32:"योना",33:"मीका",34:"नहूम",35:"हबक्कूक",36:"सपन्याह",37:"हाग्गै",38:"जकर्याह",39:"मलाकी",40:"मत्ती",41:"मरकुस",42:"लूका",43:"यूहन्ना",44:"प्रेरितों",45:"रोमियों",46:"1 कुरिन्थियों",47:"2 कुरिन्थियों",48:"गलातियों",49:"इफिसियों",50:"फिलिप्पियों",51:"कुलुस्सियों",52:"1 थिस्स.",53:"2 थिस्स.",54:"तीमुथियुस",55:"तीमुथियुस",56:"तीतुस",57:"फिलेमोन",58:"इब्रानियों",59:"याकूब",60:"1 पतरस",61:"2 पतरस",62:"1 यूहन्ना",63:"2 यूहन्ना",64:"3 यूहन्ना",65:"यहूदा",66:"प्रकाशितवाक्य"
      },
      burmese: {
        1:"ကမ္ဘာဦးကျမ်း",2:"ထွက်မြောက်ရာကျမ်း",3:"ဝတ်ပြုရာကျမ်း",4:"တောလည်ရာကျမ်း",5:"တရားဟောရာကျမ်း",6:"ယောရှုမှတ်စာ",7:"သူကြီးမှတ်စာ",8:"ရုသဝတ္ထု",9:"ဓမ္မရာဇဝင်ပထမစောင်",10:"ဓမ္မရာဇဝင်ဒုတိယစောင်",11:"ဓမ္မရာဇဝင်တတိယစောင်",12:"ဓမ္မရာဇဝင်စတုတ္ထစောင်",13:"ရာဇဝင်ချုပ်ပထမစောင်",14:"ရာဇဝင်ချုပ်ဒုတိယစောင်",15:"ဧဇရမှတ်စာ",16:"နေဟမိမှတ်စာ",17:"ဧသတာဝတ္ထု",18:"ယောဘဝတ္ထု",19:"ဆာလံကျမ်း",20:"သုတ္တံကျမ်း",21:"ဒေသနာကျမ်း",22:"ရှောလမုန်သီချင်း",23:"ဟေရှာယအနာဂတ္တိကျမ်း",24:"ယေရမိအနာဂတ္တိကျမ်း",25:"ယေရမိညည်းတွားရာကျမ်း",26:"ယေဇကျေလအနာဂတ္တိကျမ်း",27:"ဒံယေလအနာဂတ္တိကျမ်း",28:"ဟောရှေအနာဂတ္တိကျမ်း",29:"ယောလအနာဂတ္တိကျမ်း",30:"အာမုတ်အနာဂတ္တိကျမ်း",31:"အာဗဒိအနာဂတ္တိကျမ်း",32:"ယောနအနာဂတ္တိကျမ်း",33:"မိက္ခာအနာဂတ္တိကျမ်း",34:"နာဟုံအနာဂတ္တိကျမ်း",35:"ဟဗက္ကုတ်အနာဂတ္တိကျမ်း",36:"ဇေဖနိအနာဂတ္တိကျမ်း",37:"ဟဂ္ဂဲအနာဂတ္တိကျမ်း",38:"ဇာခရိအနာဂတ္တိကျမ်း",39:"မာလခိအနာဂတ္တိကျမ်း",40:"မဿဲခရစ်ဝင်",41:"မာကုခရစ်ဝင်",42:"လုကာခရစ်ဝင်",43:"ယောဟန်ခရစ်ဝင်",44:"တမန်တော်ဝတ္ထု",45:"ရောမဩဝါဒစာ",46:"ကောရိန္သုဩဝါဒစာပထမစောင်",47:"ကောရိန္သုဩဝါဒစာဒုတိယစောင်",48:"ဂလာတိဩဝါဒစာ",49:"ဧဖက်ဩဝါဒစာ",50:"ဖိလိပ္ပိဩဝါဒစာ",51:"ကောလောသဲဩဝါဒစာ",52:"သက်သာလောနိတ်ဩဝါဒစာပထမစောင်",53:"သက်သာလောနိတ်ဩဝါဒစာဒုတိယစောင်",54:"တိမောသေဩဝါဒစာပထမစောင်",55:"တိမောသေဩဝါဒစာဒုတိယစောင်",56:"တိတုဩဝါဒစာ",57:"ဖိလေမုန်ဩဝါဒစာ",58:"ဟေဗြဲဩဝါဒစာ",59:"ယာကုပ်ဩဝါဒစာ",60:"ပေတရုဩဝါဒစာပထမစောင်",61:"ပေတရုဩဝါဒစာဒုတိယစောင်",62:"ယောဟန်ဩဝါဒစာပထမစောင်",63:"ယောဟန်ဩဝါဒစာဒုတိယစောင်",64:"ယောဟန်ဩဝါဒစာတတိယစောင်",65:"ယုဒဩဝါဒစာ",66:"ဗျာဒိတ်ကျမ်း"
      },
      catalan: {
        1:"Gènesi",2:"Èxode",3:"Levític",4:"Nombres",5:"Deuteronomi",6:"Josuè",7:"Jutges",8:"Rut",9:"1 Samuel",10:"2 Samuel",11:"1 Reis",12:"2 Reis",13:"1 Cròniques",14:"2 Cròniques",15:"Esdras",16:"Nehemies",17:"Ester",18:"Job",19:"Salms",20:"Proverbis",21:"Eclesiastès",22:"Càntic dels Càntics",23:"Isaïes",24:"Jeremies",25:"Lamentacions",26:"Ezequiel",27:"Daniel",28:"Osees",29:"Joel",30:"Amós",31:"Abdies",32:"Jonàs",33:"Miquees",34:"Nahum",35:"Habacuc",36:"Sofonies",37:"Aggeu",38:"Zacaries",39:"Malaquies",40:"Mateu",41:"Marc",42:"Lluc",43:"Joan",44:"Fets",45:"Romans",46:"1 Corintis",47:"2 Corintis",48:"Gàlates",49:"Efesis",50:"Filipencs",51:"Colossencs",52:"1 Tessalonicencs",53:"2 Tessalonicencs",54:"1 Timoteu",55:"2 Timoteu",56:"Titus",57:"Filemó",58:"Hebreus",59:"Jaume",60:"1 Pere",61:"2 Pere",62:"1 Joan",63:"2 Joan",64:"3 Joan",65:"Judes",66:"Apocalipsi"
      },
      cebuano: {
        1:"Genesis",2:"Exodo",3:"Levitico",4:"Numeros",5:"Deuteronomio",6:"Josue",7:"Mga Hulom",8:"Rut",9:"1 Samuel",10:"2 Samuel",11:"1 Mga Hari",12:"2 Mga Hari",13:"1 Cronicas",14:"2 Cronicas",15:"Esdras",16:"Nehemias",17:"Ester",18:"Job",19:"Salmo",20:"Panultihon",21:"Ecclesiastes",22:"Awit ni Salomon",23:"Isaias",24:"Jeremias",25:"Lamentaciones",26:"Ezequiel",27:"Daniel",28:"Hosea",29:"Joel",30:"Amos",31:"Obadias",32:"Jonas",33:"Miqueas",34:"Nahum",35:"Habacuc",36:"Sofonias",37:"Haggeo",38:"Zacarias",39:"Malaquias",40:"Mateo",41:"Marcos",42:"Lucas",43:"Juan",44:"Mga Buhat",45:"Roma",46:"1 Corinto",47:"2 Corinto",48:"Galacia",49:"Efeso",50:"Filipos",51:"Colosas",52:"1 Tesalonica",53:"2 Tesalonica",54:"1 Timoteo",55:"2 Timoteo",56:"Tito",57:"Filemon",58:"Hebreohanon",59:"Santiago",60:"1 Pedro",61:"2 Pedro",62:"1 Juan",63:"2 Juan",64:"3 Juan",65:"Judas",66:"Pinadayag"
      },
      chechen: {
        1:"Йаздар",2:"Мисрара арадалар",3:"Левитийн",4:"Терахьаш",5:"Шолха закон",6:"Ешуа",7:"Кхиэлахой",8:"Рут",9:"1 Самуил",10:"2 Самуил",11:"1 Пачхьалкхаш",12:"2 Пачхьалкхаш",13:"1 ТIаьхьенаш",14:"2 ТIаьхьенаш",15:"Ездра",16:"Неемия",17:"Есфирь",18:"Иов",19:"Забур",20:"Кицаш",21:"Хьехамча",22:"Иллеш",23:"Исаия",24:"Иеремия",25:"Еремиян тезеташ",26:"Иезекииль",27:"Даниил",28:"Осия",29:"Иоиль",30:"Амос",31:"Авдий",32:"Юнус",33:"Михей",34:"Наум",35:"Аввакум",36:"Софония",37:"Аггей",38:"Закария",39:"Малахия",40:"Матфей",41:"Марк",42:"Лука",43:"Иоанн",44:"Жайнаш",45:"Румляшка",46:"1 Коринфянам",47:"2 Коринфянам",48:"Галатяшка",49:"Эфесяшка",50:"Филиппийцашка",51:"Колоссянка",52:"1 Фессалоникийцам",53:"2 Фессалоникийцам",54:"1 Тимофейга",55:"2 Тимофейга",56:"Титка",57:"Филимонка",58:"Еврешка",59:"Яков",60:"1 Петр",61:"2 Петр",62:"1 Иоанн",63:"2 Иоанн",64:"3 Иоанн",65:"Иуда",66:"Хайам"
      },
      chewa: {
        1:"Genesis",2:"Eksodo",3:"Levitiko",4:"Numeri",5:"Deuteronomo",6:"Yoswa",7:"Oweruza",8:"Ruti",9:"1 Samuel",10:"2 Samuel",11:"1 Mafumu",12:"2 Mafumu",13:"1 Mbiri",14:"2 Mbiri",15:"Ezara",16:"Nehemiya",17:"Estere",18:"Yobu",19:"Masalimo",20:"Miyambo",21:"Mlaliki",22:"Nyimbo",23:"Yesaya",24:"Yeremiya",25:"Maliro",26:"Ezekieli",27:"Danieli",28:"Hoseya",29:"Yoweli",30:"Amosi",31:"Obadiya",32:"Yona",33:"Mika",34:"Nahumu",35:"Habakuku",36:"Zefaniya",37:"Hagai",38:"Zakariya",39:"Malaki",40:"Mateyu",41:"Marko",42:"Luka",43:"Yohane",44:"Machitidwe",45:"Aroma",46:"1 Akorinto",47:"2 Akorinto",48:"Agalatiya",49:"Aefeso",50:"Afilipi",51:"Akolose",52:"1 Atesalonika",53:"2 Atesalonika",54:"1 Timoteo",55:"2 Timoteo",56:"Tito",57:"Filimoni",58:"Aheberi",59:"Yakobo",60:"1 Petro",61:"2 Petro",62:"1 Yohane",63:"2 Yohane",64:"3 Yohane",65:"Yuda",66:"Chivumbulutso"
      },
      chhattisgarhi: {
        1:"उतपत्ती",2:"निकारी",3:"लेव्यव्यवस्था",4:"गनती",5:"नियम",6:"यहोशू",7:"नियाव",8:"रूत",9:"1 समुएल",10:"2 समुएल",11:"1 राजा",12:"2 राजा",13:"1 इतिहास",14:"2 इतिहास",15:"एज्रा",16:"नहेमायाह",17:"एस्तेर",18:"अय्यूब",19:"भजन",20:"नीतिवचन",21:"सभोपदेसक",22:"श्रेष्ठगीत",23:"यसायाह",24:"यिर्मयाह",25:"रोना",26:"यहेजकेल",27:"दानिय्येल",28:"होसे",29:"योएल",30:"आमोस",31:"ओबद्याह",32:"योना",33:"मीका",34:"नहूम",35:"हबक्कूक",36:"सपन्याह",37:"हाग्गै",38:"जकर्याह",39:"मलाकी",40:"मत्ती",41:"मरकुस",42:"लूका",43:"यूहन्ना",44:"प्रेरित मन",45:"रोमियों",46:"1 कुरिन्थियों",47:"2 कुरिन्थियों",48:"गलातियों",49:"इफिसियों",50:"फिलिप्पियों",51:"कुलुस्सियों",52:"1 थिस्स.",53:"2 थिस्स.",54:"तीमुथियुस",55:"तीमुथियुस",56:"तीतुस",57:"फिलेमोन",58:"इब्रानियों",59:"याकूब",60:"1 पतरस",61:"2 पतरस",62:"1 यूहन्ना",63:"2 यूहन्ना",64:"3 यूहन्ना",65:"यहूदा",66:"प्रकाशितवाक्य"
      },
      chuvash: {
        1:"Пулса пуçланни",2:"Тухни",3:"Левит",4:"Хисепсем",5:"Саккунсене тепĕр хут калани",6:"Иисус Навин",7:"Судьясен",8:"Руфь",9:"1 Самуил",10:"2 Самуил",11:"1 Патшасен",12:"2 Патшасен",13:"1 Летопись",14:"2 Летопись",15:"Ездра",16:"Неемия",17:"Есфирь",18:"Иов",19:"Псаломсем",20:"Вĕрентӳ сăмахĕсем",21:"Экклезиаст",22:"Юрăсен юрри",23:"Исаия",24:"Иеремия",25:"Иеремия йĕрени",26:"Иезекииль",27:"Даниил",28:"Осия",29:"Иоиль",30:"Амос",31:"Авдий",32:"Иона",33:"Михей",34:"Наум",35:"Аввакум",36:"Софония",37:"Аггей",38:"Захария",39:"Малахия",40:"Матвей",41:"Марк",42:"Лука",43:"Иоанн",44:"Апостолсен ĕçĕсем",45:"Римлянсем патне",46:"Коринфянсем патне 1",47:"Коринфянсем патне 2",48:"Галатсем патне",49:"Эфессем патне",50:"Филиппсем патне",51:"Колосссем патне",52:"Фессалониксем патне 1",53:"Фессалониксем патне 2",54:"Тимофей патне 1",55:"Тимофей патне 2",56:"Тит патне",57:"Филимон патне",58:"Еврейсем патне",59:"Иаков",60:"Петрăн 1",61:"Петрăн 2",62:"Иоаннăн 1",63:"Иоаннăн 2",64:"Иоаннăн 3",65:"Иуда",66:"Иоаннăн Откровенийĕ"
      },
      coptic: {
        1:"Genesis",2:"Exodus",3:"Levitikon",4:"Arithmoi",5:"Deuteronomion",6:"Iosue",7:"Kritai",8:"Ruth",9:"1 Samuel",10:"2 Samuel",11:"1 Basileion",12:"2 Basileion",13:"1 Paraleipomenon",14:"2 Paraleipomenon",15:"Ezras",16:"Nehemias",17:"Esther",18:"Iob",19:"Psalterion",20:"Paroimiai",21:"Ekklesiastes",22:"Ho de ho",23:"Isaias",24:"Ieremias",25:"Threnoi",26:"Iezekiel",27:"Daniel",28:"Hosee",29:"Ioel",30:"Amos",31:"Obadiou",32:"Ionas",33:"Michaias",34:"Naoum",35:"Ambakoum",36:"Sophonias",37:"Haggaios",38:"Zacharias",39:"Malachias",40:"Mataios",41:"Markos",42:"Loukas",43:"Ioannes",44:"Praxeis",45:"Pros Romaious",46:"1 Korinthious",47:"2 Korinthious",48:"Pros Galatas",49:"Pros Ephesious",50:"Pros Philippesious",51:"Pros Kolossaeis",52:"1 Thessalonikeis",53:"2 Thessalonikeis",54:"1 Timotheon",55:"2 Timotheon",56:"Titon",57:"Philemona",58:"Pros Hebraious",59:"Iakobos",60:"1 Petrou",61:"2 Petrou",62:"1 Ioannou",63:"2 Ioannou",64:"3 Ioannou",65:"Iouda",66:"Apokalypsis"
      },
      dagbani: {
        1:"Piilli",2:"Yibu na",3:"Leviticus",4:"Kalinli",5:"Zaligu",6:"Joshua",7:"Alikaalinima",8:"Ruti",9:"1 Samuel",10:"2 Samuel",11:"1 Nanima",12:"2 Nanima",13:"1 Chronicles",14:"2 Chronicles",15:"Ezra",16:"Nehemiah",17:"Estera",18:"Job",19:"Yila",20:"Shishirigu",21:"Ecclesiastes",22:"Solomon Yila",23:"Isaiah",24:"Jeremiah",25:"Jeremiah Kuhu",26:"Ezekiel",27:"Daniel",28:"Hosea",29:"Joel",30:"Amos",31:"Obadiah",32:"Jonah",33:"Micah",34:"Nahum",35:"Habakkuk",36:"Zephaniah",37:"Haggai",38:"Zechariah",39:"Malachi",40:"Matiu",41:"Maaku",42:"Luka",43:"Yohana",44:"Tuma",45:"Romanima",46:"1 Korintianima",47:"2 Korintianima",48:"Galatianima",49:"Efesianima",50:"Philippianima",51:"Kolosianima",52:"1 Tesalonianima",53:"2 Tesalonianima",54:"1 Timothy",55:"2 Timothy",56:"Titus",57:"Philemon",58:"Hebrew",59:"James",60:"1 Peter",61:"2 Peter",62:"1 Yohana",63:"2 Yohana",64:"3 Yohana",65:"Jude",66:"Revelation"
      },
      dinka: {
        1:"Chakandit",2:"Thok tuɔ̈ɔ̈r",3:"Lēbi",4:"Kwën",5:"Dɛtɛrɔnomi",6:"Jociua",7:"Lukunykɔ̈ɔ̈k",8:"Rut",9:"1 Samuēl",10:"2 Samuēl",11:"1 Bɛ̈ny",12:"2 Bɛ̈ny",13:"1 Jam Thɛɛr",14:"2 Jam Thɛɛr",15:"Ɛdra",16:"Nɛyɛmiya",17:"Ɛstɛr",18:"Job",19:"Diɛt",20:"Käŋ ka pel",21:"Akueen",22:"Diɛt ke Jalamon",23:"Yisaya",24:"Jɛrimaya",25:"Thɔ̈ŋ",26:"Ɛsɛkiēl",27:"Danyēl",28:"Oseya",29:"Jowēl",30:"Amos",31:"Obadiya",32:"Jona",33:"Mika",34:"Nahum",35:"Habakuk",36:"Jɛpanya",37:"Hagai",38:"Jɛkaraya",39:"Malaki",40:"Matayo",41:"Maako",42:"Luka",43:"Jɔ̈n",44:"Luɔi",45:"Rom",46:"1 Korinto",47:"2 Korinto",48:"Galatia",49:"Ɛpɛjo",50:"Pilipi",51:"Koloje",52:"1 Tɛjalonika",53:"2 Tɛjalonika",54:"1 Timoti",55:"2 Timoti",56:"Tito",57:"Pilimɔn",58:"Ibru",59:"Jēmi",60:"1 Piɛr",61:"2 Piɛr",62:"1 Jɔ̈n",63:"2 Jɔ̈n",64:"3 Jɔ̈n",65:"Jūda",66:"Nyuth"
      },
      dogri: {
        1:"उतपत्ती",2:"निर्गमन",3:"लेव्यव्यवस्था",4:"गनती",5:"नियम",6:"यहोशू",7:"नियाव",8:"रूत",9:"1 समुएल",10:"2 समुएल",11:"1 राजा",12:"2 राजा",13:"1 इतिहास",14:"2 इतिहास",15:"एज्रा",16:"नहेमायाह",17:"एस्तेर",18:"अय्यूब",19:"भजन",20:"नीतिवचन",21:"सभोपदेसक",22:"श्रेष्ठगीत",23:"यशायाह",24:"यिर्मयाह",25:"रोना",26:"यहेजकेल",27:"दानिय्येल",28:"होसे",29:"योएल",30:"आमोस",31:"ओबद्याह",32:"योना",33:"मीका",34:"नहूम",35:"हबक्कूक",36:"सपन्याह",37:"हाग्गै",38:"जकर्याह",39:"मलाकी",40:"मत्ती",41:"मरकुस",42:"लूका",43:"यूहन्ना",44:"प्रेरित मन",45:"रोमियों",46:"1 कुरिन्थियों",47:"2 कुरिन्थियों",48:"गलातियों",49:"इफिसियों",50:"फिलिप्पियों",51:"कुलुस्सियों",52:"1 थिस्स.",53:"2 थिस्स.",54:"तीमुथियुस",55:"तीमुथियुस",56:"तीतुस",57:"फिलेमोन",58:"इब्रानियों",59:"याकूब",60:"1 पतरस",61:"2 पतरस",62:"1 यूहन्ना",63:"2 यूहन्ना",64:"3 यूहन्ना",65:"यहूदा",66:"प्रकाशितवाक्य"
      },
      dyula: {
        1:"Sensen",2:"Bɔli",3:"Lewi",4:"Jatiya",5:"Sariya Kurunfali",6:"Jɔsuwe",7:"Kiritigow",8:"Ruti",9:"1 Samuɛli",10:"2 Samuɛli",11:"1 Masow",12:"2 Masow",13:"1 Kibarow",14:"2 Kibarow",15:"Ɛsdras",16:"Neemi",17:"Ɛstɛɛ",18:"Jɔb",19:"Zaburu",20:"Taaliw",21:"Jɛhakariyow",22:"Jalamon ka dɔnkili",23:"Ezayi",24:"Zeremi",25:"Kuuna dɔnkili",26:"Ezekiyɛli",27:"Daniyɛli",28:"Oze",29:"Zoɛli",30:"Amɔsi",31:"Abdiyasi",32:"Yunusi",33:"Mise",34:"Nahum",35:"Abakuki",36:"Sofoni",37:"Aze",38:"Zakari",39:"Malasi",40:"Matiyu",41:"Mariki",42:"Liki",43:"Zan",44:"Kɛwaliw",45:"Romɛkaw",46:"1 Korɛntikaw",47:"2 Korɛntikaw",48:"Galasikaw",49:"Efɛzikaw",50:"Filipikaw",51:"Kolosikaw",52:"1 Tesalonikikaw",53:"2 Tesalonikikaw",54:"1 Timote",55:"2 Timote",56:"Titi",57:"Filimɔn",58:"Heburukaw",59:"Jaki",60:"1 Piyɛri",61:"2 Piyɛri",62:"1 Zan",63:"2 Zan",64:"3 Zan",65:"Zid",66:"Nyiriba"
      },
      edo: {
        1:"Genẹsis",2:"Ẹksodọs",3:"Levitikọs",4:"Nọmbas",5:"Diuteronọmi",6:"Jọshua",7:"Izẹgi",8:"Rut",9:"1 Samuẹl",10:"2 Samuẹl",11:"1 Ivie",12:"2 Ivie",13:"1 Krọnikẹl",14:"2 Krọnikẹl",15:"Ẹzra",16:"Nẹhẹmaya",17:"Ẹsta",18:"Job",19:"Ivbuọma",20:"Itan",21:"Ikue",22:"Ihuan rẹ Sọlọmọn",23:"Aizaya",24:"Jẹrẹmaya",25:"Usu",26:"Izikiẹl",27:"Daniẹl",28:"Hosia",29:"Joẹl",30:"Amọs",31:"Obadaya",32:"Jona",33:"Maika",34:"Nahum",35:"Habakuk",36:"Zẹfanaya",37:"Hagai",38:"Zẹkaraya",39:"Malakai",40:"Matiu",41:"Mak",42:"Luk",43:"Jọn",44:"Iwin rẹ emọsi",45:"Rom",46:"1 Kọrint",47:"2 Kọrint",48:"Galẹshia",49:"Ẹfẹsọs",50:"Filipai",51:"Kọlọsi",52:"1 Tẹsalọnika",53:"2 Tẹsalọnika",54:"1 Timọti",55:"2 Timọti",56:"Taitọs",57:"Filẹmọn",58:"Hibru",59:"Jems",60:"1 Pita",61:"2 Pita",62:"1 Jọn",63:"2 Jọn",64:"3 Jọn",65:"Jud",66:"Arhuan-fẹ"
      },
      chinese: {
        1:"创世记",2:"出埃及记",3:"利未记",4:"民数记",5:"申命记",6:"约书亚记",7:"士师记",8:"路得记",9:"撒母耳记上",10:"撒母耳记下",11:"列王纪上",12:"列王纪下",13:"历代志上",14:"历代志下",15:"以斯拉记",16:"尼希米记",17:"以斯帖记",18:"约伯记",19:"诗篇",20:"箴言",21:"传道书",22:"雅歌",23:"以赛亚书",24:"耶利米书",25:"耶利米哀歌",26:"以西结书",27:"但以理书",28:"何西阿书",29:"约珥书",30:"阿摩司书",31:"俄巴底亚书",32:"约拿书",33:"弥迦书",34:"那鸿书",35:"哈巴谷书",36:"西番雅书",37:"哈该书",38:"撒迦利亚书",39:"玛拉基书",40:"马太福音",41:"马可福音",42:"路加福音",43:"约翰福音",44:"使徒行传",45:"罗马书",46:"哥林多前书",47:"哥林多后书",48:"加拉太书",49:"以弗所书",50:"腓立比书",51:"歌罗西书",52:"帖撒罗尼迦前书",53:"帖撒罗尼迦后书",54:"提摩太前书",55:"提摩太后书",56:"提多书",57:"腓利门书",58:"希伯来书",59:"雅各书",60:"彼得前书",61:"彼得后书",62:"约翰一书",63:"约翰二书",64:"约翰三书",65:"犹大书",66:"启示录"
      },
      chinese_traditional: {
        1:"創世記",2:"出埃及記",3:"利未記",4:"民數記",5:"申命記",6:"約書亞記",7:"士師記",8:"路得記",9:"撒母耳記上",10:"撒母耳記下",11:"列王紀上",12:"列王紀下",13:"歷代志上",14:"歷代志下",15:"以斯拉記",16:"尼希米記",17:"以斯帖記",18:"約伯記",19:"詩篇",20:"箴言",21:"傳道書",22:"雅歌",23:"以賽亞書",24:"耶利米書",25:"耶利米哀歌",26:"以西結書",27:"但以理書",28:"何西阿書",29:"約珥書",30:"阿摩司書",31:"俄巴底亞書",32:"約拿書",33:"彌迦書",34:"那鴻書",35:"哈巴谷書",36:"西番雅書",37:"哈該書",38:"撒迦利亞書",39:"瑪拉基書",40:"馬太福音",41:"馬可福音",42:"路加福音",43:"約翰福音",44:"使徒行傳",45:"羅馬書",46:"哥林多前書",47:"哥林多後書",48:"加拉太書",49:"以弗所書",50:"腓立比書",51:"歌羅西書",52:"帖撒羅尼迦前書",53:"帖撒羅尼迦後書",54:"提摩太前書",55:"提摩太後書",56:"提多書",57:"腓利門書",58:"希伯來書",59:"雅各書",60:"彼得前書",61:"彼得後書",62:"約翰一書",63:"約翰二書",64:"約翰三書",65:"猶大書",66:"啟示錄"
      },
      azerbaijani: {
        1:"Yaradılış",2:"Chixış",3:"Levililər",4:"Saylar",5:"Qanunun təkrarı",6:"Yeşua",7:"Hakimlər",8:"Rut",9:"1 Şamuel",10:"2 Şamuel",11:"1 Padşahlar",12:"2 Padşahlar",13:"1 Salnamələr",14:"2 Salnamələr",15:"Ezra",16:"Nehemiya",17:"Ester",18:"Əyyub",19:"Zəbur",20:"Süleymanın məsəlləri",21:"Vaiz",22:"Nəğmələr nəğməsi",23:"İşaya",24:"Yeremya",25:"Yeremyanın mərsiyələri",26:"Hezekiel",27:"Dənyal",28:"Huşə",29:"Yoel",30:"Amos",31:"Obadya",32:"Yunus",33:"Mika",34:"Nahum",35:"Habaquq",36:"Sefanya",37:"Haqqay",38:"Zəkəriyyə",39:"Malaki",40:"Matta",41:"Mark",42:"Luka",43:"Yəhya",44:"Həvariyyun",45:"Romalılara",46:"1 Korinflilərə",47:"2 Korinflilərə",48:"Qalatlılara",49:"Efeslilərə",50:"Filippililərə",51:"Koloslulara",52:"1 Saloniklilərə",53:"2 Saloniklilərə",54:"1 Timoteyə",55:"2 Timoteyə",56:"Titusa",57:"Filimona",58:"İbranilərə",59:"Yaqub",60:"1 Peter",61:"2 Peter",62:"1 Yəhya",63:"2 Yəhya",64:"3 Yəhya",65:"Yəhuda",66:"Vəhy"
      },
      basque: {
        1:"Hasiera",2:"Irteera",3:"Lebitarrena",4:"Zenbakiak",5:"Deuteronomioa",6:"Josue",7:"Epaileak",8:"Rut",9:"1 Samuel",10:"2 Samuel",11:"1 Erregeak",12:"2 Erregeak",13:"1 Kronikak",14:"2 Kronikak",15:"Esdras",16:"Nehemias",17:"Ester",18:"Job",19:"Salmoak",20:"Atsotitzak",21:"Kohelet",22:"Kanturik Ederrena",23:"Isaias",24:"Jeremias",25:"Tamalaia",26:"Ezekiel",27:"Daniel",28:"Osea",29:"Joel",30:"Amos",31:"Abdias",32:"Jonas",33:"Mikeas",34:"Nahum",35:"Habakuk",36:"Sofonias",37:"Ageo",38:"Zakarias",39:"Malakias",40:"Mateo",41:"Markos",42:"Lukas",43:"Joan",44:"Egiteak",45:"Erromatarrei",46:"1 Korintoarrei",47:"2 Korintoarrei",48:"Galatiarrei",49:"Efesoarrei",50:"Filipiarrei",51:"Kolosarrei",52:"1 Tesalonikarrei",53:"2 Tesalonikarrei",54:"1 Timoteori",55:"2 Timoteori",56:"Titusi",57:"Filemoni",58:"Hebrearrei",59:"Jakue",60:"1 Petri",61:"2 Petri",62:"1 Joan",63:"2 Joan",64:"3 Joan",65:"Juda",66:"Apokalipsia"
      },
      bavarian: {
        1:"Genesis",2:"Exodus",3:"Levitikus",4:"Numeri",5:"Deuteronomium",6:"Josua",7:"Richter",8:"Rut",9:"1 Samuel",10:"2 Samuel",11:"1 Könige",12:"2 Könige",13:"1 Chronik",14:"2 Chronik",15:"Esra",16:"Nehemia",17:"Ester",18:"Hiob",19:"Psalmen",20:"Sprichwörter",21:"Kohelet",22:"Hohelied",23:"Jesaja",24:"Jeremia",25:"Klagelieder",26:"Ezechiel",27:"Daniel",28:"Hosea",29:"Joël",30:"Amos",31:"Obadja",32:"Jona",33:"Micha",34:"Nahum",35:"Habakuk",36:"Zefanja",37:"Haggai",38:"Sacharja",39:"Maleachi",40:"Matthäus",41:"Markus",42:"Lukas",43:"Johannes",44:"Apostelgeschichte",45:"Römer",46:"1 Korinther",47:"2 Korinther",48:"Galater",49:"Epheser",50:"Philipper",51:"Kolosser",52:"1 Thessalonicher",53:"2 Thessalonicher",54:"1 Timotheus",55:"2 Timotheus",56:"Titus",57:"Philemon",58:"Hebräer",59:"Jakobus",60:"1 Petrus",61:"2 Petrus",62:"1 Johannes",63:"2 Johannes",64:"3 Johannes",65:"Judas",66:"Offenbarung"
      },
      belarusian: {
        1:"Род",2:"Выхад",3:"Левіт",4:"Лічбы",5:"Другі Закон",6:"Ісус Навін",7:"Суддзі",8:"Рут",9:"1 Самуіла",10:"2 Самуіла",11:"1 Царстваў",12:"2 Царстваў",13:"1 Летапісаў",14:"2 Летапісаў",15:"Ездра",16:"Неямія",17:"Эсфір",18:"Іоў",19:"Псалтыр",20:"Прытчы",21:"Эклезіяст",22:"Найвышэйшая песня",23:"Ісая",24:"Ермія",25:"Плач Ерміі",26:"Езекііль",27:"Данііл",28:"Асія",29:"Іоіль",30:"Амос",31:"Аўдзій",32:"Ёна",33:"Міхей",34:"Навум",35:"Авакум",36:"Сафонія",37:"Агей",38:"Захарыя",39:"Малахія",40:"Мацвея",41:"Марка",42:"Лукі",43:"Іаана",44:"Дзеі",45:"Рымлянам",46:"1 Карынфянам",47:"2 Карынфянам",48:"Галатам",49:"Эфесянам",50:"Філіпянам",51:"Каласянам",52:"1 Фесаланікійцам",53:"2 Фесаланікійцам",54:"1 Цімафея",55:"2 Цімафея",56:"Ціту",57:"Філімона",58:"Яўрэям",59:"Якава",60:"1 Пятра",61:"2 Пятра",62:"1 Іаана",63:"2 Іаана",64:"3 Іаана",65:"Іуды",66:"Адкрыццё"
      },
      bemba: {
        1:"Icitencekelo",2:"Ukafuma",3:"Abena Levi",4:"Impendwa",5:"Amafunde",6:"Yoshua",7:"Abapingushi",8:"Ruti",9:"1 Samwele",10:"2 Samwele",11:"1 Ishamfumu",12:"2 Ishamfumu",13:"1 Imilandu",14:"2 Imilandu",15:"Esra",16:"Nehemia",17:"Esta",18:"Yobo",19:"Amalumbo",20:"Amapinda",21:"Kufundisha",22:"Ulwimbo",23:"Esaya",24:"Yeremia",25:"Amalilo",26:"Esekieli",27:"Daniele",28:"Hosea",29:"Yoeli",30:"Amosi",31:"Obadia",32:"Yona",33:"Mika",34:"Nahumu",35:"Habakuku",36:"Sefania",37:"Hagai",38:"Sakaria",39:"Malaki",40:"Mateo",41:"Mako",42:"Luka",43:"Yoani",44:"Imilimo",45:"Roma",46:"1 Kolinti",47:"2 Kolinti",48:"Galatia",49:"Efeso",50:"Filipi",51:"Kolose",52:"1 Tesalonika",53:"2 Tesalonika",54:"1 Timote",55:"2 Timote",56:"Tito",57:"Filemoni",58:"Bahibulu",59:"Yakobo",60:"1 Petelo",61:"2 Petelo",62:"1 Yoani",63:"2 Yoani",64:"3 Yoani",65:"Yuda",66:"Ubusokololo"
      },
      bengali: {
        1:"আদিপুস্তক",2:"যাত্রাপুস্তক",3:"লেবীয় পুস্তক",4:"গণনা পুস্তক",5:"দ্বিতীয় বিবরণ",6:"যিহোশূয়",7:"বিচারকর্তৃগণ",8:"রূথ",9:"১ শমূয়েল",10:"২ শমূয়েল",11:"১ রাজাবলি",12:"২ রাজাবলি",13:"১ বংশাবলি",14:"২ বংশাবলি",15:"ইষ্রা",16:"নহিমীয়",17:"ইষ্টের",18:"ইয়োব",19:"গীতসংহিতা",20:"হিতোপদেশ",21:"উপদেশক",22:"শ্রেষ্ঠ গীত",23:"যিশাইয়",24:"যিরমিয়",25:"বিলাপ",26:"যিহিষ্কেল",27:"দানিয়েল",28:"হোশেয়",29:"যোয়েল",30:"আমোষ",31:"ওবদিয়",32:"যোনা",33:"মীখা",34:"নাহূম",35:"হবক্কূক",36:"সফনিয়",37:"হগয়",38:"জখরায়",39:"মালাখি",40:"মথি",41:"মার্ক",42:"লূক",43:"যোহন",44:"প্রেরিত",45:"রোমীয়",46:"১ করিন্থীয়",47:"২ করিন্থীয়",48:"গালাতীয়",49:"ইফিষীয়",50:"ফিলিপীয়",51:"কলসীয়",52:"১ থিষলনীকীয়",53:"২ থিষলনীকীয়",54:"১ তীমথিয়",55:"২ তীমথিয়",56:"তীত",57:"ফিলীমন",58:"ইব্রীয়",59:"যাকোব",60:"১ পিতর",61:"২ পিতর",62:"১ যোহন",63:"২ যোহন",64:"৩ যোহন",65:"যিহূদা",66:"প্রকাশিত বাক্য"
      },
      berber: {
        1:"Bantayen",2:"Affugh",3:"Inamazaren",4:"Izuyyan",5:"Tinitrit",6:"Jusuɛ",7:"Ifessaren",8:"Rut",9:"1 Samwil",10:"2 Samwil",11:"1 Igelliden",12:"2 Igelliden",13:"1 Imazzayen",14:"2 Imazzayen",15:"Ezra",16:"Nehemi",17:"Estir",18:"Jib",19:"Ihellilen",20:"Inzan",21:"Amussnaw",22:"Azru n Tizlatin",23:"Izaya",24:"Jeremi",25:"Isuɣan n Jeremi",26:"Izikyel",27:"Danyil",28:"Uzya",29:"Jwil",30:"Amus",31:"Abdyas",32:"Yunas",33:"Mika",34:"Nahum",35:"Abakuk",36:"Sufunya",37:"Ajjay",38:"Zakarya",39:"Malaki",40:"Matta",41:"Marqus",42:"Luqa",43:"Yuhenna",44:"Tigawt n Imuraren",45:"Irumaniyen",46:"1 Ikurintiyen",47:"2 Ikurintiyen",48:"Igalatiyen",49:"Ifisiyen",50:"Ifilipiyen",51:"Ikulusiye",52:"1 Itisaluniken",53:"2 Itisaluniken",54:"1 Timuti",55:"2 Timuti",56:"Titus",57:"Filimun",58:"Iburaniyen",59:"Yaqub",60:"1 Butrus",61:"2 Butrus",62:"1 Yuhenna",63:"2 Yuhenna",64:"3 Yuhenna",65:"Yudas",66:"Aweḥḥi"
      },
      bhilali: {
        1:"उत्पत्ति",2:"निर्गमन",3:"लैव्यव्यवस्था",4:"गणना",5:"व्यवस्था",6:"यहोशू",7:"न्यायि",8:"रूत",9:"1 समुएल",10:"2 समुएल",11:"1 राजा",12:"2 राजा",13:"1 इतिहास",14:"2 इतिहास",15:"एज्रा",16:"नहेमायाह",17:"एस्तेर",18:"अय्यूब",19:"भजन",20:"नीतिवचन",21:"सभोपदेशक",22:"श्रेष्ठगीत",23:"यशायाह",24:"यिर्मयाह",25:"विलाप",26:"यहेजकेल",27:"दानिय्येल",28:"होशे",29:"योएल",30:"आमोस",31:"ओबद्याह",32:"योना",33:"मीका",34:"नहूम",35:"हबक्कूक",36:"सपन्याह",37:"हाग्गै",38:"जकर्याह",39:"मलाकी",40:"मत्ती",41:"मरकुस",42:"लूका",43:"यूहन्ना",44:"प्रेरितों",45:"रोमियों",46:"1 कुरिन्थियों",47:"2 कुरिन्थियों",48:"गलातियों",49:"इफिसियों",50:"फिलिप्पियों",51:"कुलुस्सियों",52:"1 थिस्स.",53:"2 थिस्स.",54:"तीमुथियुस",55:"तीमुथियुस",56:"तीतुस",57:"फिलेमोन",58:"इब्रानियों",59:"याकूब",60:"1 पतरस",61:"2 पतरस",62:"1 यूहन्ना",63:"2 यूहन्ना",64:"3 यूहन्ना",65:"यहूदा",66:"प्रकाशितवाक्य"
      },
      bodo: {
        1:"बिबेक",2:"ओंखारनाय",3:"लेबीया",4:"अनजिमा",5:"नैथि बिधान",6:"योशुआ",7:"बिचारगिरि",8:"रुथ",9:"1 सामुयेल",10:"2 सामुयेल",11:"1 राजफोर",12:"2 राजफोर",13:"1 बंसावलि",14:"2 बंसावलि",15:"एज्रा",16:"नेहेमिया",17:"एस्तर",18:"जोब",19:"भजन",20:"सोलो",21:"उपदेसक",22:"मेथायफोरनि मेथाय",23:"यशायाह",24:"यिर्मयाह",25:"बिलाब",26:"यहेजकेल",27:"दानियेल",28:"होसे",29:"योएल",30:"आमोस",31:"ओबदिया",32:"योना",33:"मीका",34:"नहूम",35:"हबक्कुक",36:"सपन्याह",37:"हाग्गै",38:"जकारिया",39:"मलाखी",40:"माथिउ",41:"मार्क",42:"लुका",43:"योहन",44:"पांचनिफोरनि हाबा",45:"रोमफोराव",46:"1 करिन्थीयाव",47:"2 करिन्थीयाव",48:"गालातीयाव",49:"एफिसीयाव",50:"फिलीपीयाव",51:"कलसीयाव",52:"1 थिसलनीकीयाव",53:"2 थिसलनीकीयाव",54:"1 तिमथीयाव",55:"2 तिमथीयाव",56:"तीतस",57:"फिलेमोनाव",58:"हिब्रूफोराव",59:"जाकोब",60:"1 पीतर",61:"2 पीतर",62:"1 योहन",63:"2 योहन",64:"3 योहन",65:"जुदा",66:"फुनगांनाय"
      },
      bosnian: {
        1:"Postanak",2:"Izlazak",3:"Levitifikat",4:"Brojevi",5:"Ponovljeni zakoni",6:"Jošua",7:"Sudije",8:"Ruta",9:"1. Samuelova",10:"2. Samuelova",11:"1. Kraljevima",12:"2. Kraljevima",13:"1. Ljetopisa",14:"2. Ljetopisa",15:"Ezra",16:"Nehemija",17:"Estera",18:"Job",19:"Psalmi",20:"Izreke",21:"Propovjednik",22:"Pjesma nad pjesmama",23:"Izaija",24:"Jeremija",25:"Tužaljke",26:"Ezekiel",27:"Daniel",28:"Hosea",29:"Joel",30:"Amos",31:"Abdija",32:"Jona",33:"Mihej",34:"Nahum",35:"Habakuk",36:"Sofonija",37:"Agej",38:"Zaharija",39:"Malahija",40:"Matej",41:"Marko",42:"Luka",43:"Ivan",44:"Djela apostolska",45:"Rimljanima",46:"1. Korinćanima",47:"2. Korinćanima",48:"Galaćanima",49:"Efežanima",50:"Filipljanima",51:"Kološanima",52:"1. Solunjanima",53:"2. Solunjanima",54:"1. Timoteju",55:"2. Timoteju",56:"Titu",57:"Filemonu",58:"Jevrejima",59:"Jakovljeva",60:"1. Petrova",61:"2. Petrova",62:"1. Ivanova",63:"2. Ivanova",64:"3. Ivanova",65:"Judina",66:"Otkrivenje"
      },
      braj: {
        1:"उत्पत्ति",2:"निर्गमन",3:"लैव्यव्यवस्था",4:"गणना",5:"व्यवस्था",6:"यहोशू",7:"न्यायि",8:"रूत",9:"1 समुएल",10:"2 समुएल",11:"1 राजा",12:"2 राजा",13:"1 इतिहास",14:"2 इतिहास",15:"एज्रा",16:"नहेमायाह",17:"एस्तेर",18:"अय्यूब",19:"भजन",20:"नीतिवचन",21:"सभोपदेशक",22:"श्रेष्ठगीत",23:"यशायाह",24:"यिर्मयाह",25:"विलाप",26:"यहेजकेल",27:"दानिय्येल",28:"होसे",29:"योएल",30:"आमोस",31:"ओबद्याह",32:"योना",33:"मीका",34:"नहूम",35:"हबक्कूक",36:"सपन्याह",37:"हाग्गै",38:"जकर्याह",39:"मलाकी",40:"मत्ती",41:"मरकुस",42:"लूका",43:"यूहन्ना",44:"प्रेरितों",45:"रोमियों",46:"1 कुरिन्थियों",47:"2 कुरिन्थियों",48:"गलातियों",49:"इफिसियों",50:"फिलिप्पियों",51:"कुलुस्सियों",52:"1 थिस्स.",53:"2 थिस्स.",54:"तीमुथियुस",55:"तीमुथियुस",56:"तीतुस",57:"फिलेमोन",58:"इब्रानियों",59:"याकूब",60:"1 पतरस",61:"2 पतरस",62:"1 यूहन्ना",63:"2 यूहन्ना",64:"3 यूहन्ना",65:"यहूदा",66:"प्रकाशितवाक्य"
      },
      bugis: {
        1:"Pammulaang",2:"Massu’",3:"Léwi",4:"Bilangeng",5:"Pangulangi",6:"Yosua",7:"Pa’biaraé",8:"Rut",9:"1 Samuél",10:"2 Samuél",11:"1 Arung-arungé",12:"2 Arung-arungé",13:"1 Babad",14:"2 Babad",15:"Esra",16:"Nehemia",17:"Ester",18:"Ayub",19:"Kélong-kélong",20:"Pappaseng",21:"Panginuru’",22:"Kélong-kélongna Salomoni",23:"Yésaya",24:"Yérémia",25:"Elong-elongna Yérémia",26:"Yéhézkiél",27:"Daniél",28:"Hoséa",29:"Yoél",30:"Amos",31:"Obaja",32:"Yunus",33:"Mikha",34:"Nahum",35:"Habakuk",36:"Sépanya",37:"Hagai",38:"Zakharia",39:"Malaki",40:"Matius",41:"Markus",42:"Lukas",43:"Yohanés",44:"Pikkauangna sining Suroé",45:"Roma",46:"1 Korintus",47:"2 Korintus",48:"Galatia",49:"Efesus",50:"Filipi",51:"Kolose",52:"1 Tésalonika",53:"2 Tésalonika",54:"1 Timotius",55:"2 Timotius",56:"Titus",57:"Pilémon",58:"Ibrani",59:"Yakobus",60:"1 Pétrus",61:"2 Pétrus",62:"1 Yohanés",63:"2 Yohanés",64:"2 Yohanés",65:"Yudas",66:"Pa’paccéléngé"
      },
      croatian: {
        1:"Postanak",2:"Izlazak",3:"Levitski zakonik",4:"Brojevi",5:"Ponovljeni zakon",6:"Jošua",7:"Suci",8:"Ruta",9:"1. Samuelova",10:"2. Samuelova",11:"1. Kraljevima",12:"2. Kraljevima",13:"1. Ljetopisa",14:"2. Ljetopisa",15:"Ezra",16:"Nehemija",17:"Estera",18:"Job",19:"Psalmi",20:"Izreke",21:"Propovjednik",22:"Pjesma nad pjesmama",23:"Izaija",24:"Jeremija",25:"Tužaljke",26:"Ezekiel",27:"Daniel",28:"Hosea",29:"Joel",30:"Amos",31:"Abdija",32:"Jona",33:"Mihej",34:"Nahum",35:"Habakuk",36:"Sofonija",37:"Agej",38:"Zaharija",39:"Malahija",40:"Matej",41:"Marko",42:"Luka",43:"Ivan",44:"Djela apostolska",45:"Rimljanima",46:"1. Korinćanima",47:"2. Korinćanima",48:"Galaćanima",49:"Efežanima",50:"Filipljanima",51:"Kološanima",52:"1. Solunjanima",53:"2. Solunjanima",54:"1. Timoteju",55:"2. Timoteju",56:"Titu",57:"Filemonu",58:"Hebrejima",59:"Jakovljeva poslanica",60:"1. Petrova",61:"2. Petrova",62:"1. Ivanova",63:"2. Ivanova",64:"3. Ivanova",65:"Judina poslanica",66:"Otkrivenje"
      },
      czech: {
        1:"Genesis",2:"Exodus",3:"Leviticus",4:"Numeri",5:"Deuteronomium",6:"Jozue",7:"Soudců",8:"Rut",9:"1. Samuelova",10:"2. Samuelova",11:"1. Královská",12:"2. Královská",13:"1. Paralipomenon",14:"2. Paralipomenon",15:"Ezdráš",16:"Nehemjáš",17:"Ester",18:"Jób",19:"Žalmy",20:"Přísloví",21:"Kazatel",22:"Píseň písní",23:"Izajáš",24:"Jeremjáš",25:"Pláč",26:"Ezechiel",27:"Daniel",28:"Ozeáš",29:"Jóel",30:"Amos",31:"Abdiáš",32:"Jonáš",33:"Micheáš",34:"Nahum",35:"Abakuk",36:"Sofonjáš",37:"Ageus",38:"Zachariáš",39:"Malachiáš",40:"Matouš",41:"Marek",42:"Lukáš",43:"Jan",44:"Skutky apoštolské",45:"Římanům",46:"1. Korintským",47:"2. Korintským",48:"Galatským",49:"Efeským",50:"Filipským",51:"Koloským",52:"1. Tesalonickým",53:"2. Tesalonickým",54:"1. Timoteovi",55:"2. Timoteovi",56:"Titovi",57:"Filemonovi",58:"Židům",59:"Jakubův",60:"1. Petrova",61:"2. Petrova",62:"1. Janova",63:"2. Janova",64:"3. Janova",65:"Judův",66:"Zjevení Janovo"
      },
      danish: {
        1:"Genesis",2:"Exodus",3:"Leviticus",4:"Numeri",5:"Deuteronomium",6:"Josua",7:"Dommerne",8:"Rut",9:"1. Samuels Bog",10:"2. Samuels Bog",11:"1. Kongebog",12:"2. Kongebog",13:"1. Krønikebog",14:"2. Krønikebog",15:"Ezras Bog",16:"Nehemiashog",17:"Esters Bog",18:"Jobs Bog",19:"Salmernes Bog",20:"Ordsprogenes Bog",21:"Prædikerens Bog",22:"Højsangen",23:"Esajas' Bog",24:"Jeremias' Bog",25:"Klagesangene",26:"Ezekiel",27:"Daniels Bog",28:"Hoseas Bog",29:"Joels Bog",30:"Amos' Bog",31:"Obadias' Bog",32:"Jonas' Bog",33:"Mikas Bog",34:"Nahums Bog",35:"Habakkuks Bog",36:"Sefanias' Bog",37:"Haggajs Bog",38:"Zakarias' Bog",39:"Malakias' Bog",40:"Matthæus-Evangeliet",41:"Markus-Evangeliet",42:"Lukas-Evangeliet",43:"Johannes-Evangeliet",44:"Apostlenes Gerninger",45:"Romere",46:"1. Korintherne",47:"2. Korintherne",48:"Galaterne",49:"Efeserne",50:"Filipperne",51:"Kolossenserne",52:"1. Tessalonikerne",53:"2. Tessalonikerne",54:"1. Timotheus",55:"2. Timotheus",56:"Titus",57:"Filemon",58:"Hebræerne",59:"Jakobs Brev",60:"1. Peters Brev",61:"2. Peters Brev",62:"1. Johannes' Brev",63:"2. Johannes' Brev",64:"3. Johannes' Brev",65:"Judas' Brev",66:"Johannes' Åbenbaring"
      },
      dutch: {
        1:"Genesis",2:"Exodus",3:"Leviticus",4:"Numeri",5:"Deuteronomium",6:"Jozua",7:"Richteren",8:"Ruth",9:"1 Samuël",10:"2 Samuël",11:"1 Koningen",12:"2 Koningen",13:"1 Kronieken",14:"2 Kronieken",15:"Ezra",16:"Nehemia",17:"Ester",18:"Job",19:"Psalmen",20:"Spreuken",21:"Prediker",22:"Hooglied",23:"Jesaja",24:"Jeremia",25:"Klaagliederen",26:"Ezechiël",27:"Daniël",28:"Hosea",29:"Joël",30:"Amos",31:"Obadja",32:"Jona",33:"Micha",34:"Nahum",35:"Habakuk",36:"Sefanja",37:"Haggai",38:"Zacharia",39:"Maleachi",40:"Mattheüs",41:"Marcus",42:"Lucas",43:"Johannes",44:"Handelingen",45:"Romeinen",46:"1 Korinthiërs",47:"2 Korinthiërs",48:"Galaten",49:"Efeziërs",50:"Filippenzen",51:"Kolossenzen",52:"1 Tessalonicenzen",53:"2 Tessalonicenzen",54:"1 Timotheüs",55:"2 Timotheüs",56:"Titus",57:"Filemon",58:"Hebreeën",59:"Jakobus",60:"1 Petrus",61:"2 Petrus",62:"1 Johannes",63:"2 Johannes",64:"3 Johannes",65:"Judas",66:"Openbaring"
      },
      esperanto: {
        1:"Genezo",2:"Eliro",3:"Levitiko",4:"Nombroj",5:"Readmono",6:"Josuo",7:"Juĝistoj",8:"Rut",9:"1 Samuel",10:"2 Samuel",11:"1 Reĝoj",12:"2 Reĝoj",13:"1 Kroniko",14:"2 Kroniko",15:"Ezra",16:"Neĥemja",17:"Ester",18:"Ijob",19:"Psalmaro",20:"Proverboj",21:"Predikanto",22:"Alta Kanto",23:"Jesaja",24:"Jeremja",25:"Plorkanto",26:"Jeĥezkel",27:"Daniel",28:"Hoŝea",29:"Joel",30:"Amos",31:"Obadja",32:"Jona",33:"Miĥa",34:"Nahum",35:"Ĥabakuk",36:"Cefanja",37:"Ĥagaj",38:"Zeĥarja",39:"Malaĥi",40:"Mateo",41:"Marko",42:"Luko",43:"Johano",44:"Agoj",45:"Romanoj",46:"1 Korintanoj",47:"2 Korintanoj",48:"Galatoj",49:"Efesanoj",50:"Filipanoj",51:"Koloseanoj",52:"1 Tesalonikanoj",53:"2 Tesalonikanoj",54:"1 Timoteo",55:"2 Timoteo",56:"Tito",57:"Filemon",58:"Hebreoj",59:"Jakobo",60:"1 Petro",61:"2 Petro",62:"1 Johano",63:"2 Johano",64:"3 Johano",65:"Jehudo",66:"Apokalipso"
      },
      estonian: {
        1:"Moosese 1",2:"Moosese 2",3:"Moosese 3",4:"Moosese 4",5:"Moosese 5",6:"Joosua",7:"Kohtumõistjate",8:"Rutt",9:"Saamueli 1",10:"Saamueli 2",11:"Kuningate 1",12:"Kuningate 2",13:"Ajaraamat 1",14:"Ajaraamat 2",15:"Esra",16:"Nehemja",17:"Ester",18:"Iiob",19:"Laulud",20:"Õpetussõnad",21:"Koguja",22:"Ülemlaul",23:"Jesaja",24:"Jeremja",25:"Nutulaulud",26:"Hesekiel",27:"Taaniel",28:"Hoosea",29:"Joel",30:"Amos",31:"Obadja",32:"Joona",33:"Miika",34:"Nahum",35:"Habakuk",36:"Sefanja",37:"Haggai",38:"Sakarja",39:"Malakia",40:"Matteuse",41:"Markuse",42:"Luuka",43:"Johannese",44:"Apostlite teod",45:"Roomlastele",46:"Korintlastele 1",47:"Korintlastele 2",48:"Galatlastele",49:"Efeslastele",50:"Filiplastele",51:"Koloslastele",52:"Tessalooniklastele 1",53:"Tessalooniklastele 2",54:"Timoteosele 1",55:"Timoteosele 2",56:"Tiitusele",57:"Fileemonile",58:"Heebrealastele",59:"Jakoobuse",60:"Peetruse 1",61:"Peetruse 2",62:"Johannese 1",63:"Johannese 2",64:"Johannese 3",65:"Juuda",66:"Ilmutusraamat"
      },
      ewe: {
        1:"1 Mose",2:"2 Mose",3:"3 Mose",4:"4 Mose",5:"5 Mose",6:"Yosua",7:"Ʋɔnudrɔ̃lawo",8:"Rut",9:"1 Samuel",10:"2 Samuel",11:"1 Fiawo",12:"2 Fiawo",13:"1 Kronika",14:"2 Kronika",15:"Ezra",16:"Nehemia",17:"Ester",18:"Hiob",19:"Psalmo",20:"Lododowo",21:"Nyagblɔla",22:"Hadzigbe",23:"Yesaya",24:"Yeremia",25:"Yeremia ƒe konyifafa",26:"Hesekiel",27:"Daniel",28:"Hosea",29:"Yoel",30:"Amos",31:"Obadia",32:"Yona",33:"Mika",34:"Nahum",35:"Habakuk",36:"Sefania",37:"Hagai",38:"Zakaria",39:"Malaki",40:"Mateo",41:"Marko",42:"Luka",43:"Yohanes",44:"Dɔwɔwɔwo",45:"Roma",46:"1 Korinto",47:"2 Korinto",48:"Galatia",49:"Efeso",50:"Filipi",51:"Kolose",52:"1 Tesalonika",53:"2 Tesalonika",54:"1 Timoteo",55:"2 Timoteo",56:"Tito",57:"Filemon",58:"Hebritɔwo",59:"Yakobo",60:"1 Petro",61:"2 Petro",62:"1 Yohanes",63:"2 Yohanes",64:"3 Yohanes",65:"Yuda",66:"Nyaɖeɖefia"
      },
      finnish: {
        1:"Genesis",2:"Exodus",3:"Leviticus",4:"Numeri",5:"Deuteronomium",6:"Joosua",7:"Tuomarien",8:"Ruut",9:"1. Samuelin",10:"2. Samuelin",11:"1. Kuninkaiden",12:"2. Kuninkaiden",13:"1. Aikakirja",14:"2. Aikakirja",15:"Esra",16:"Nehemia",17:"Ester",18:"Job",19:"Psalmit",20:"Sananlaskut",21:"Saarnaaja",22:"Korkea veisu",23:"Jesaja",24:"Jeremia",25:"Valitusvirret",26:"Hesekiel",27:"Daniel",28:"Hoosea",29:"Joel",30:"Amos",31:"Obadja",32:"Joona",33:"Miika",34:"Nahum",35:"Habakuk",36:"Sefanja",37:"Haggai",38:"Sakarja",39:"Malakia",40:"Matteus",41:"Markus",42:"Luukas",43:"Johannes",44:"Apostolien teot",45:"Roomalaiskirje",46:"1. Korinttolaiskirje",47:"2. Korinttolaiskirje",48:"Galatalaiskirje",49:"Efesolaiskirje",50:"Filippiläiskirje",51:"Kolossalaiskirje",52:"1. Tessalonikalaiskirje",53:"2. Tessalonikalaiskirje",54:"1. kirje Timoteukselle",55:"2. kirje Timoteukselle",56:"kirje Titukselle",57:"kirje Filemonille",58:"Heprealaiskirje",59:"Jaakobin kirje",60:"1. Pietarin kirje",61:"2. Pietarin kirje",62:"1. Johanneksen kirje",63:"2. Johanneksen kirje",64:"3. Johanneksen kirje",65:"Juudan kirje",66:"Ilmestyskirja"
      },
      fon: {
        1:"Gǐnɛ́sì",2:"Tǐntɔ́n",3:"Leví",4:"Kɛ́n",5:"Sɛ́n-Flínmɛ",6:"Jozuwé",7:"Whɛðɔtɔ́ lɛ́ɛ",8:"Luti",9:"1 Samuyɛ́li",10:"2 Samuyɛ́li",11:"1 Axɔ́sú lɛ́ɛ",12:"2 Axɔ́sú lɛ́ɛ",13:"1 Tan mɛ",14:"2 Tan mɛ",15:"Ɛsdrási",16:"Nehemíi",17:"Ɛstɛ́ɛ",18:"Jɔ́bu",19:"Ðɛhan",20:"Ló",21:"Nǔnywɛ́tɔ́",22:"Han lɛ́ɛ sín Han",23:"Ezayíi",24:"Jelemíi",25:"Aluwɛ́han lɛ́ɛ",26:"Ezekiyɛ́li",27:"Danyɛ́li",28:"Ozéye",29:"Jowɛ́li",30:"Amɔ́si",31:"Obadyá",32:"Jɔnási",33:"Michée",34:"Naúmu",35:"Abakúku",36:"Sofoníi",37:"Ajɛ́ɛ",38:"Zakalíi",39:"Malachíi",40:"Matyé",41:"Máaki",42:"Luki",43:"Jaan",44:"Mɛsɛ́dó lɛ́ɛ sín azɔ̌",45:"Hlɔ́manu lɛ́ɛ",46:"1 Kɔlɛ́ntinu lɛ́ɛ",47:"2 Kɔlɛ́ntinu lɛ́ɛ",48:"Galátinu lɛ́ɛ",49:"Efɛ́zinu lɛ́ɛ",50:"Filípunu lɛ́ɛ",51:"Kolósinu lɛ́ɛ",52:"1 Tɛsaloníkinu lɛ́ɛ",53:"2 Tɛsaloníkinu lɛ́ɛ",54:"1 Timotée",55:"2 Timotée",56:"Títi",57:"Filɛmɔ́ɔ",58:"Eblée lɛ́ɛ",59:"Jaki",60:"1 Piyɛ́ɛ",61:"2 Piyɛ́ɛ",62:"1 Jaan",63:"2 Jaan",64:"3 Jaan",65:"Jídi",66:"Nǔɖexlɛ́mɛ"
      },
      fulfulde: {
        1:"Fuɗɗorde",2:"Eggol",3:"Lewinkon",4:"Limngal",5:"Dankino",6:"Yosuwa",7:"Ñaawooɓe",8:"Ruuta",9:"1 Samuyila",10:"2 Samuyila",11:"1 Laamiiɓe",12:"2 Laamiiɓe",13:"1 Taariiki",14:"2 Taariiki",15:"Esdra",16:"Nehemiya",17:"Esta",18:"Ayuba",19:"Jabuura",20:"Balndu",21:"Waajotooɗo",22:"Gimɗi gimɗi",23:"Esaya",24:"Yeremiya",25:"Boyli",26:"Esekiyela",27:"Daniyela",28:"Oseya",29:"Yowila",30:"Amosi",31:"Obadiya",32:"Yunusa",33:"Mika",34:"Nahuma",35:"Habakuka",36:"Sofoniya",37:"Haggaya",38:"Sakariya",39:"Malakiya",40:"Matta",41:"Marku",42:"Luka",43:"Yuhanna",44:"Golle",45:"Romi'en",46:"1 Korinti'en",47:"2 Korinti'en",48:"Galati'en",49:"Efesi'en",50:"Filipi'en",51:"Kolosi'en",52:"1 Tesaloniki'en",53:"2 Tesaloniki'en",54:"1 Timote",55:"2 Timote",56:"Titu",57:"Filimon",58:"Ibirani'en",59:"Yakuuba",60:"1 Piyer",61:"2 Piyer",62:"1 Yuhanna",63:"2 Yuhanna",64:"3 Yuhanna",65:"Yuda",66:"Hollitaare"
      },
      gaelic: {
        1:"Genesis",2:"Exodus",3:"Leviticus",4:"Numbers",5:"Deuteronomy",6:"Joshua",7:"Judges",8:"Ruth",9:"1 Samuel",10:"2 Samuel",11:"1 Kings",12:"2 Kings",13:"1 Chronicles",14:"2 Chronicles",15:"Ezra",16:"Nehemiah",17:"Esther",18:"Job",19:"Psalms",20:"Proverbs",21:"Ecclesiastes",22:"Song of Solomon",23:"Isaiah",24:"Jeremiah",25:"Lamentations",26:"Ezekiel",27:"Daniel",28:"Hosea",29:"Joel",30:"Amos",31:"Obadiah",32:"Jonah",33:"Micah",34:"Nahum",35:"Habakkuk",36:"Zephaniah",37:"Haggai",38:"Zechariah",39:"Malachi",40:"Matthew",41:"Mark",42:"Luke",43:"John",44:"Acts",45:"Romans",46:"1 Corinthians",47:"2 Corinthians",48:"Galatians",49:"Ephesians",50:"Philippians",51:"Colossians",52:"1 Thessalonians",53:"2 Thessalonians",54:"1 Timothy",55:"2 Timothy",56:"Titus",57:"Philemon",58:"Hebrews",59:"James",60:"1 Peter",61:"2 Peter",62:"1 John",63:"2 John",64:"3 John",65:"Jude",66:"Revelation"
      },
      galician: {
        1:"Xénese",2:"Éxodo",3:"Levítico",4:"Números",5:"Deuteronomio",6:"Xosué",7:"Xuíces",8:"Rut",9:"1 Samuel",10:"2 Samuel",11:"1 Reis",12:"2 Reis",13:"1 Crónicas",14:"2 Crónicas",15:"Esdras",16:"Nehemías",17:"Ester",18:"Job",19:"Salmos",20:"Proverbios",21:"Eclesiastés",22:"Cantar dos Cantares",23:"Isaías",24:"Xeremías",25:"Lamentacións",26:"Ezequiel",27:"Daniel",28:"Oseas",29:"Xoel",30:"Amós",31:"Abdías",32:"Xonás",33:"Miqueas",34:"Naúm",35:"Habacuc",36:"Sofonías",37:"Axeo",38:"Zacarías",39:"Malaquías",40:"Mateo",41:"Marcos",42:"Lucas",43:"Xoán",44:"Feitos",45:"Romanos",46:"1 Corintios",47:"2 Corintios",48:"Gálatas",49:"Efesios",50:"Filipenses",51:"Colosenses",52:"1 Tesalonicenses",53:"2 Tesalonicenses",54:"1 Timoteo",55:"2 Timoteo",56:"Tito",57:"Filemón",58:"Hebreos",59:"Santiago",60:"1 Pedro",61:"2 Pedro",62:"1 Xoán",63:"2 Xoან",64:"3 Xoან",65:"Xudas",66:"Apocalipse"
      },
      garhwali: {
        1:"उत्पत्ति",2:"निर्गमन",3:"लैव्यव्यवस्था",4:"गणना",5:"व्यवस्था",6:"यहोशू",7:"न्यायि",8:"रूत",9:"1 समुएल",10:"2 समुएल",11:"1 राजा",12:"2 राजा",13:"1 इतिहास",14:"2 इतिहास",15:"एज्रा",16:"नहेमायाह",17:"एस्तेर",18:"अय्यूब",19:"भजन",20:"नीतिवचन",21:"सभोपदेशक",22:"श्रेष्ठगीत",23:"यशायाह",24:"यिर्मयाह",25:"विलाप",26:"यहेजकेल",27:"दानिय्येल",28:"होशे",29:"योएल",30:"आमोस",31:"ओबद्याह",32:"योना",33:"मीका",34:"नहूम",35:"हबक्कूक",36:"सपन्याह",37:"हाग्गै",38:"जकर्याह",39:"मलाकी",40:"मत्ती",41:"मरकुस",42:"लूका",43:"यूहन्ना",44:"प्रेरितों",45:"रोमियों",46:"1 कुरिन्थियों",47:"2 कुरिन्थियों",48:"गलातियों",49:"इफिसियों",50:"फिलिप्पियों",51:"कुलुस्सियों",52:"1 थिस्स.",53:"2 थिस्स.",54:"तीमुथियुस",55:"तीमुथियुस",56:"तीतुस",57:"फिलेमोन",58:"इब्रानियों",59:"याकूब",60:"1 पतरस",61:"2 पतरस",62:"1 यूहन्ना",63:"2 यूहन्ना",64:"3 यूहन्ना",65:"यहूदा",66:"प्रकाशितवाक्य"
      },
      georgian: {
        1:"დაბადება",2:"გამოსვლა",3:"ლევიტელთა",4:"რიცხვნი",5:"მეორე რჯული",6:"იესო ნავეს ძე",7:"მსაჯულთა",8:"რუთი",9:"1 მეფეთა",10:"2 მეფეთა",11:"3 მეფეთა",12:"4 მეფეთა",13:"1 ნეშტთა",14:"2 ნეშტთა",15:"ეზრა",16:"ნეემია",17:"ესთერი",18:"იობი",19:"ფსალმუნნი",20:"იგავნი სოლომონისა",21:"ეკლესიასტე",22:"ქება ქებათა",23:"ესაია",24:"იერემია",25:"გოდება იერემიასი",26:"ეზეკიელი",27:"დანიელი",28:"ოსია",29:"იოელი",30:"ამოსი",31:"აბდია",32:"იონა",33:"მიქა",34:"ნაუმი",35:"ამბაკუმი",36:"სოფონია",37:"ანგია",38:"ზაქარია",39:"მალაქია",40:"მათე",41:"მარკოზი",42:"ლუკა",43:"იოანე",44:"მოციქულთა საქმე",45:"რომაელთა",46:"1 კორინთელთა",47:"2 კორინთელთა",48:"გალატელთა",49:"ეფესელთა",50:"ფილიპელთა",51:"კოლოსელთა",52:"1 თესალონიკელთა",53:"2 თესალონიკელთა",54:"1 ტიმოთე",55:"2 ტიმოთე",56:"ტიტე",57:"ფილიმონი",58:"ებრაელთა",59:"იაკობი",60:"1 პეტრე",61:"2 პეტრე",62:"1 იოანე",63:"2 იოანე",64:"3 იოანე",65:"იუდა",66:"გამოცხადება"
      },
      german: {
        1:"Genesis",2:"Exodus",3:"Levitikus",4:"Numeri",5:"Deuteronomium",6:"Josua",7:"Richter",8:"Rut",9:"1. Samuel",10:"2. Samuel",11:"1. Könige",12:"2. Könige",13:"1. Chronik",14:"2. Chronik",15:"Esra",16:"Nehemia",17:"Ester",18:"Hiob",19:"Psalmen",20:"Sprüche",21:"Prediger",22:"Hohelied",23:"Jesaja",24:"Jeremia",25:"Klagelieder",26:"Hesekiel",27:"Daniel",28:"Hosea",29:"Joel",30:"Amos",31:"Obadja",32:"Jona",33:"Micha",34:"Nahum",35:"Habakuk",36:"Zefanja",37:"Haggai",38:"Sacharja",39:"Maleachi",40:"Matthäus",41:"Markus",42:"Lukas",43:"Johannes",44:"Apostelgeschichte",45:"Römer",46:"1. Korinther",47:"2. Korinther",48:"Galater",49:"Epheser",50:"Philipper",51:"Kolosser",52:"1. Thessalonicher",53:"2. Thessalonicher",54:"1. Timotheus",55:"2. Timotheus",56:"Titus",57:"Philemon",58:"Hebräer",59:"Jakobus",60:"1. Petrus",61:"2. Petrus",62:"1. Johannes",63:"2. Johannes",64:"3. Johannes",65:"Judas",66:"Offenbarung"
      },
      ghomala: {
        1:"Gǐnɛ́sì",2:"Tǐntɔ́n",3:"Leví",4:"Kɛ́n",5:"Sɛ́n-Flínmɛ",6:"Jozuwé",7:"Whɛðɔtɔ́ lɛ́ɛ",8:"Luti",9:"1 Samuyɛ́li",10:"2 Samuyɛ́li",11:"1 Axɔ́sú lɛ́ɛ",12:"2 Axɔ́sú lɛ́ɛ",13:"1 Tan mɛ",14:"2 Tan mɛ",15:"Ɛsdrási",16:"Nehemíi",17:"Ɛstɛ́ɛ",18:"Jɔ́bu",19:"Ðɛhan",20:"Ló",21:"Nǔnywɛ́tɔ́",22:"Han lɛ́ɛ sín Han",23:"Ezayíi",24:"Jelemíi",25:"Aluwɛ́han lɛ́ɛ",26:"Ezekiyɛ́li",27:"Danyɛ́li",28:"Ozéye",29:"Jowɛ́li",30:"Amɔ́si",31:"Obadyá",32:"Jɔnási",33:"Michée",34:"Naúmu",35:"Abakúku",36:"Sofoníi",37:"Ajɛ́ɛ",38:"Zakalíi",39:"Malachíi",40:"Matyé",41:"Máaki",42:"Luki",43:"Jaan",44:"Mɛsɛ́dó lɛ́ɛ sín azɔ̌",45:"Hlɔ́manu lɛ́ɛ",46:"1 Kɔlɛ́ntinu lɛ́ɛ",47:"2 Kɔlɛ́ntinu lɛ́ɛ",48:"Galátinu lɛ́ɛ",49:"Efɛ́zinu lɛ́ɛ",50:"Filípunu lɛ́ɛ",51:"Kolósinu lɛ́ɛ",52:"1 Tɛsaloníkinu lɛ́ɛ",53:"2 Tɛsaloníkinu lɛ́ɛ",54:"1 Timotée",55:"2 Timotée",56:"Títi",57:"Filɛmɔ́ɔ",58:"Eblée lɛ́ɛ",59:"Jaki",60:"1 Piyɛ́ɛ",61:"2 Piyɛ́ɛ",62:"1 Jaan",63:"2 Jaan",64:"3 Jaan",65:"Jídi",66:"Nǔɖexlɛ́mɛ"
      },
      greek: {
        1:"Γένεσις",2:"Έξοδος",3:"Λευιτικόν",4:"Αριθμοί",5:"Δευτερονόμιον",6:"Ιησούς του Ναυή",7:"Κριταί",8:"Ρουθ",9:"Α' Σαμουήλ",10:"Β' Σαμουήλ",11:"Α' Βασιλέων",12:"Β' Βασιλέων",13:"Α' Παραλειπομένων",14:"Β' Παραλειπομένων",15:"Έσδρας",16:"Νεεμίας",17:"Εσθήρ",18:"Ιώβ",19:"Ψαλμοί",20:"Παροιμίαι",21:"Εκκλησιαστής",22:"Άσμα Ασμάτων",23:"Ησαΐας",24:"Ιερεμίας",25:"Θρήνοι",26:"Ιεζεκιήλ",27:"Δανιήλ",28:"Ωσηέ",29:"Ιωήλ",30:"Αμός",31:"Αβδιού",32:"Ιωνάς",33:"Μιχαίας",34:"Ναούμ",35:"Αββακούμ",36:"Σοφονίας",37:"Αγγαίος",38:"Ζαχαρίας",39:"Μαλαχίας",40:"Ματθαίος",41:"Μάρκος",42:"Λουκάς",43:"Ιωάννης",44:"Πράξεις",45:"Ρωμαίους",46:"Α' Κορινθίους",47:"Β' Κορινθίους",48:"Γαλάτας",49:"Εφεσίους",50:"Φιλιππησίους",51:"Κολοσσαείς",52:"Α' Θεσσαλονικείς",53:"Β' Θεσσαλονικείς",54:"Α' Τιμόθεον",55:"Β' Τιμόθεον",56:"Τίτον",57:"Φιλήμονα",58:"Εβραίους",59:"Ιακώβου",60:"Α' Πέτρου",61:"Β' Πέτρου",62:"Α' Ιωάννου",63:"Β' Ιωάννου",64:"Γ' Ιωάννου",65:"Ιούδα",66:"Αποκάλυψις"
      },
      guarani: {
        1:"Ñepyru",2:"Ẽsodo",3:"Levítico",4:"Números",5:"Deuteronomio",6:"Josué",7:"Jueces",8:"Rut",9:"1 Samuel",10:"2 Samuel",11:"1 Reyes",12:"2 Reyes",13:"1 Crónicas",14:"2 Crónicas",15:"Esdras",16:"Nehemías",17:"Ester",18:"Job",19:"Salmos",20:"Proverbios",21:"Eclesiastés",22:"Cantares",23:"Isaías",24:"Jeremías",25:"Lamentaciones",26:"Ezequiel",27:"Daniel",28:"Oseas",29:"Joel",30:"Amós",31:"Abdías",32:"Jonás",33:"Miqueas",34:"Nahúm",35:"Habacuc",36:"Sofonías",37:"Ageo",38:"Zacarías",39:"Malaquías",40:"Mateo",41:"Marcos",42:"Lucas",43:"Juan",44:"Hechos",45:"Romanos",46:"1 Corintios",47:"2 Corintios",48:"Gálatas",49:"Efesios",50:"Filipenses",51:"Colosenses",52:"1 Tesalonicenses",53:"2 Tesalonicenses",54:"1 Timoteo",55:"2 Timoteo",56:"Tito",57:"Filemón",58:"Hebreos",59:"Santiago",60:"1 Pedro",61:"2 Pedro",62:"1 Juan",63:"2 Juan",64:"3 Juan",65:"Judas",66:"Apocalipsis"
      },
      gujarati: {
        1:"ઉત્પત્તિ",2:"નિર્ગમન",3:"લેવીય",4:"ગણના",5:"પુનર્નિયમ",6:"યહોશુઆ",7:"ન્યાયાધીશો",8:"રૂથ",9:"1 શમૂએલ",10:"2 શમૂએલ",11:"1 રાજાઓ",12:"2 રાજાઓ",13:"1 કાળવૃત્તાંત",14:"2 કાળવૃત્તાંત",15:"એઝરા",16:"નહેમ્યા",17:"એસ્થર",18:"અયૂબ",19:"ભજનસંહિતા",20:"નીતિવચનો",21:"ઉપદેશક",22:"ગીતોનું ગીત",23:"યશાયાહ",24:"યર્મિયા",25:"વિલાપ",26:"હઝકિયેલ",27:"દાનિયેલ",28:"હોશિયા",29:"યોએલ",30:"આમોસ",31:"ઓબાદ્યા",32:"યૂનાહ",33:"મીખાહ",34:"નાહૂમ",35:"હબાક્કૂક",36:"સફાન્યા",37:"હાગ્ગાય",38:"ઝખાર્યા",39:"માલાખી",40:"માથ્થી",41:"માર્ક",42:"લૂક",43:"યોહાન",44:"પ્રેરિતોનાં કૃત્યો",45:"રોમનોને પત્ર",46:"1 કોરીંથીઓને પત્ર",47:"2 કોરીંથીઓને પત્ર",48:"ગલાતીઓને પત્ર",49:"એફેસીઓને પત્ર",50:"ફિલિપીઓને પત્ર",51:"કોલોસીઓને પત્ર",52:"1 થેસ્સાલોનીકીઓને",53:"2 થેસ્સાલોનીકીઓને",54:"1 તીમોથીને પત્ર",55:"૨ તીમોથીને પત્ર",56:"તીતસને પત્ર",57:"ફિલેમોનને પત્ર",58:"હિબ્રૂઓને પત્ર",59:"યાકોબનો પત્ર",60:"1 પિતરનો પત્ર",61:"2 પિતરનો પત્ર",62:"૧ યોહાનનો પત્ર",63:"૨ યોહાનનો પત્ર",64:"૩ યોહાનનો પત્ર",65:"યહૂદાનો પત્ર",66:"પ્રકટીકરણ"
      },
      gussi: {
        1:"Omochakano",2:"Okoru",3:"Rebitiko",4:"Emanyaro",5:"Ogokonya",6:"Joshua",7:"Abatuki",8:"Ruth",9:"1 Samuel",10:"2 Samuel",11:"1 Abamura",12:"2 Abamura",13:"1 Amang'ana",14:"2 Amang'ana",15:"Ezra",16:"Nehemia",17:"Esther",18:"Job",19:"Zaburi",20:"Embegeto",21:"Omotiori",22:"Obokano",23:"Isaya",24:"Jeremia",25:"Amanyinga",26:"Ezekiel",27:"Daniel",28:"Hosea",29:"Joel",30:"Amos",31:"Obadia",32:"Jona",33:"Mika",34:"Nahum",35:"Habakuk",36:"Zephania",37:"Haggai",38:"Zecharia",39:"Malachi",40:"Matayo",41:"Mariko",42:"Luka",43:"Yohana",44:"Emanyaro",45:"Roma",46:"1 Korinto",47:"2 Korinto",48:"Galatia",49:"Efeso",50:"Filipi",51:"Kolose",52:"1 Tesalonika",53:"2 Tesalonika",54:"1 Timotheo",55:"2 Timotheo",56:"Tito",57:"Philemon",58:"Ahiburania",59:"Jakobo",60:"1 Petero",61:"2 Petero",62:"1 Yohana",63:"2 Yohana",64:"3 Yohana",65:"Juda",66:"Omoyio"
      },
      hadiyya: {
        1:"Ginnicho",2:"Fiteeramo",3:"Lewawo",4:"Errimo",5:"Higga",6:"Yooshua",7:"Makkisanchcha",8:"Ruuti",9:"1 Saamu'eela",10:"2 Saamu'eela",11:"1 Mootota",12:"2 Mootota",13:"1 Higga",14:"2 Higga",15:"Izira",16:"Nehemiya",17:"Isiteera",18:"Iyyoobi",19:"Mazmura",20:"Maxxiitoota",21:"Errimo",22:"Masmura",23:"Isayaasa",24:"Ermiyaasa",25:"Uwwo",26:"Hizqi'eela",27:"Daani'eela",28:"Hoose'e",29:"Iyyo'eela",30:"Amootsa",31:"Obadiyaasa",32:"Yoonaasa",33:"Mikkiyaasa",34:"Na'ooma",35:"Inbaaqooma",36:"Sifaniyaasa",37:"Haage'e",38:"Zakariyaasa",39:"Miilkiyyaasa",40:"Maatewoosa",41:"Marqoosa",42:"Luqaasa",43:"Yoohannisa",44:"Errimo",45:"Roomu",46:"1 Qorontosa",47:"2 Qorontosa",48:"Galaatiya",49:"Efesoona",50:"Filipisiyusa",51:"Qolasiyusa",52:"1 Tasalooniqa",53:"2 Tasalooniqa",54:"1 Timootiwoosa",55:"2 Timootiwoosa",56:"Tiitoosa",57:"Filimoona",58:"Ibirayya",59:"Yaaqoobisa",60:"1 Pheexiroosa",61:"2 Pheexiroosa",62:"1 Yoohannisa",63:"2 Yoohannisa",64:"3 Yoohannisa",65:"Yihudaasa",66:"Ajuujuwa"
      },
      haryanvi: {
        1:"उतपत्ती",2:"निकारी",3:"लेव्यव्यवस्था",4:"गनती",5:"नियम",6:"यहोशू",7:"नियाव",8:"रूत",9:"1 समुएल",10:"2 समुएल",11:"1 राजा",12:"2 राजा",13:"1 इतिहास",14:"2 इतिहास",15:"एज्रा",16:"नहेमायाह",17:"एस्तेर",18:"अय्यूब",19:"भजन",20:"नीतिवचन",21:"सभोपदेसक",22:"श्रेष्ठगीत",23:"यशायाह",24:"यिर्मयाह",25:"रोना",26:"यहेजकेल",27:"दानिय्येल",28:"होसे",29:"योएल",30:"आमोस",31:"ओबद्याह",32:"योना",33:"मीका",34:"नहूम",35:"हबक्कूक",36:"सपन्याह",37:"हाग्गै",38:"जकर्याह",39:"मलाकी",40:"मत्ती",41:"मरकुस",42:"लूका",43:"यूहन्ना",44:"प्रेरित मन",45:"रोमियों",46:"1 कुरिन्थियों",47:"2 कुरिन्थियों",48:"गलातियों",49:"इफिसियों",50:"फिलिप्पियों",51:"कुलुस्सियों",52:"1 थिस्स.",53:"2 थिस्स.",54:"तीमुथियुस",55:"तीमुथियुस",56:"तीतुस",57:"फिलेमोन",58:"इब्रानियों",59:"याकूब",60:"1 पतरस",61:"2 पतरस",62:"1 यूहन्ना",63:"2 यूहन्ना",64:"3 यूहन्ना",65:"यहूदा",66:"प्रकाशितवाक्य"
      },
      hausa: {
        1:"Farawa",2:"Fitowa",3:"Levitikus",4:"Lissafi",5:"maimaitawar doka",6:"Yoshua",7:"Masu Shari'a",8:"Ruta",9:"1 Sama'ila",10:"2 Sama'ila",11:"1 Sarakuna",12:"2 Sarakuna",13:"1 Labarun Sarauta",14:"2 Labarun Sarauta",15:"Ezra",16:"Nehemiya",17:"Eshta",18:"Ayuba",19:"Zabura",20:"Karin Magana",21:"Mai Wa'azi",22:"Wakokin Wakoki",23:"Isaya",24:"Irmiya",25:"Makoki",26:"Ezekiyel",27:"Daniyel",28:"Yahuza",29:"Joyel",30:"Amos",31:"Obadiya",32:"Yunana",33:"Mika",34:"Nahum",35:"Habakuk",36:"Safaniya",37:"Haggai",38:"Zakariya",39:"Malaki",40:"Matiyu",41:"Markus",42:"Luka",43:"Yohanna",44:"Ayukan Manzanni",45:"Romawa",46:"1 Korintiyawa",47:"2 Korintiyawa",48:"Galatiyawa",49:"Efisawa",50:"Filipiyawa",51:"Kolosawa",52:"1 Tasaloniikawa",53:"2 Tasaloniikawa",54:"1 Timothawus",55:"2 Timothawus",56:"Titus",57:"Filimon",58:"Ibraniyawa",59:"Yakub",60:"1 Bitrus",61:"2 Bitrus",62:"1 Yohanna",63:"2 Yohanna",64:"3 Yohanna",65:"Yuda",66:"Ru'uyoyi"
      },
      hebrew: {
        1:"בראשית",2:"שמות",3:"ויקרא",4:"במדבר",5:"דברים",6:"יהושע",7:"שופטים",8:"רות",9:"שמואל א",10:"שמואל ב",11:"מלכים א",12:"מלכים ב",13:"דברי הימים א",14:"דברי הימים ב",15:"עזרא",16:"נחמיה",17:"אסתר",18:"איוב",19:"תהילים",20:"משלי",21:"קהלת",22:"שיר השירים",23:"ישעיהו",24:"ירמיהו",25:"איכה",26:"יחזקאל",27:"דניאל",28:"הושע",29:"יואל",30:"עמוס",31:"עובדיה",32:"יונה",33:"מיכה",34:"נחום",35:"חבקוק",36:"צפניה",37:"חגי",38:"זכריה",39:"מלאכי",40:"מתי",41:"מרקוס",42:"לוקס",43:"יוחנן",44:"מעשי השליחים",45:"רומאים",46:"קורינתים א",47:"קורינתים ב",48:"גלטים",49:"אפסים",50:"פיליפים",51:"קולוסים",52:"תסלוניקים א",53:"תסלוניקים ב",54:"טימותיאוס א",55:"טימותיאוס ב",56:"טיטוס",57:"פילמון",58:"עברים",59:"יעקב",60:"פטרוס א",61:"פטרוס ב",62:"יוחנן א",63:"יוחנן ב",64:"יוחנן ג",65:"יהודה",66:"התגלות"
      },
      hmong: {
        1:"Chiv Keeb",2:"Khiav Tswm",3:"Levi",4:"Npe",5:"Kev Cai",6:"Yausua",7:"Cov Nom Tswv",8:"Rut",9:"1 Xamu-ee-la",10:"2 Xamu-ee-la",11:"1 Cov Vajntxwv",12:"2 Cov Vajntxwv",13:"1 Cov Keeb Kwm",14:"2 Cov Keeb Kwm",15:"Etha-la",16:"Nehemi",17:"Exata",18:"Yope",19:"Ntawv Nkauj",20:"Paj Lug",21:"Tub Txib",22:"Nkauj Hmab Nkauj Ntxoo",23:"Yaxaya",24:"Yelemis",25:"Yelemis Quaj Tsaug",26:"Exekiye-la",27:"Daniye-la",28:"Hauxeya",29:"Yo-ee-la",30:"Amoo",31:"Obadiya",32:"Yona",33:"Mikha",34:"Nahu",35:"Hanpakku",36:"Xefaniya",37:"Hakai",38:"Xakaliya",39:"Malaki",40:"Mathai",41:"Malakau",42:"Luka",43:"Yauhas",44:"Tes Hauj Lwm",45:"Loos",46:"1 Kau-li-thas",47:"2 Kau-li-thas",48:"Kalatias",49:"Efexaus",50:"Filipi",51:"Kolau-xas",52:"1 Thexalunika",53:"2 Thexalunika",54:"1 Timautes",55:"2 Timautes",56:"Titas",57:"Filimoos",58:"Hiblaus",59:"Yakaubas",60:"1 Petus",61:"2 Petus",62:"1 Yauhas",63:"2 Yauhas",64:"3 Yauhas",65:"Yudas",66:"Qhia"
      },
      hungarian: {
        1:"Mózes I.",2:"Mózes II.",3:"Mózes III.",4:"Mózes IV.",5:"Mózes V.",6:"Józsué",7:"Bírák",8:"Ruth",9:"1. Sámuel",10:"2. Sámuel",11:"1. Királyok",12:"2. Királyok",13:"1. Krónika",14:"2. Krónika",15:"Ezdrás",16:"Nehémiás",17:"Eszter",18:"Jób",19:"Zsoltárok",20:"Példabeszédek",21:"Prédikátor",22:"Énekek éneke",23:"Ézsaiás",24:"Jeremiás",25:"Siralmak",26:"Ezékiel",27:"Dániel",28:"Hóseás",29:"Jóel",30:"Ámósz",31:"Abdiás",32:"Jónás",33:"Mikeás",34:"Náhum",35:"Habakuk",36:"Sofóniás",37:"Aggeus",38:"Zakariás",39:"Malakiás",40:"Máté",41:"Márk",42:"Lukács",43:"János",44:"Apostolok cselekedetei",45:"Rómaiak",46:"1. Korintus",47:"2. Korintus",48:"Galaták",49:"Efezus",50:"Filippiek",51:"Kolossé",52:"1. Thesszalonika",53:"2. Thesszalonika",54:"1. Timóteus",55:"2. Timóteus",56:"Titus",57:"Filemon",58:"Zsidók",59:"Jakab",60:"1. Péter",61:"2. Péter",62:"1. János",63:"2. János",64:"3. János",65:"Júdás",66:"Jelenések"
      },
      iban: {
        1:"Pemungkal",2:"Pansut",3:"Imamat",4:"Bilangan",5:"Adat nunga",6:"Josua",7:"Akim",8:"Rut",9:"1 Samuel",10:"2 Samuel",11:"1 Raja",12:"2 Raja",13:"1 bansa",14:"2 bansa",15:"Esra",16:"Nehemia",17:"Ester",18:"Jop",19:"Jabur",20:"Jaku Dalam",21:"Pengajar",22:"Lagu Sulaeman",23:"Isaya",24:"Jeremaya",25:"Sedu",26:"Esekias",27:"Daniel",28:"Hosea",29:"Joel",30:"Amos",31:"Obadia",32:"Juna",33:"Mika",34:"Nahum",35:"Habakuk",36:"Sepania",37:"Hagai",38:"Sakaria",39:"Malaki",40:"Matius",41:"Markus",42:"Lukas",43:"Johanis",44:"Kereja Rasul",45:"Rom",46:"1 Korint",47:"2 Korint",48:"Galatia",49:"Epesus",50:"Pilipi",51:"Kolosi",52:"1 Tesalonika",53:"2 Tesalonika",54:"1 Timoti",55:"2 Timoti",56:"Titus",57:"Pilemon",58:"Hebru",59:"Jakop",60:"1 Peter",61:"2 Peter",62:"1 Johanis",63:"2 Johanis",64:"3 Johanis",65:"Judas",66:"Ayas"
      },
      ibibio: {
        1:"Genesis",2:"Exodus",3:"Leviticus",4:"Numbers",5:"Deuteronomy",6:"Joshua",7:"Judges",8:"Ruth",9:"1 Samuel",10:"2 Samuel",11:"1 Kings",12:"2 Kings",13:"1 Chronicles",14:"2 Chronicles",15:"Ezra",16:"Nehemiah",17:"Esther",18:"Job",19:"Psalms",20:"Proverbs",21:"Ecclesiastes",22:"Song of Solomon",23:"Isaiah",24:"Jeremiah",25:"Lamentations",26:"Ezekiel",27:"Daniel",28:"Hosea",29:"Joel",30:"Amos",31:"Obadiah",32:"Jonah",33:"Micah",34:"Nahum",35:"Habakkuk",36:"Zephaniah",37:"Haggai",38:"Zechariah",39:"Malachi",40:"Matthew",41:"Mark",42:"Luke",43:"John",44:"Acts",45:"Romans",46:"1 Corinthians",47:"2 Corinthians",48:"Galatians",49:"Ephesians",50:"Philippians",51:"Colossians",52:"1 Thessalonians",53:"2 Thessalonians",54:"1 Timothy",55:"2 Timothy",56:"Titus",57:"Philemon",58:"Hebrews",59:"James",60:"1 Peter",61:"2 Peter",62:"1 John",63:"2 John",64:"3 John",65:"Jude",66:"Revelation"
      },
      icelandic: {
        1:"1. Mósebók",2:"2. Mósebók",3:"3. Mósebók",4:"4. Mósebók",5:"5. Mósebók",6:"Jósúabók",7:"Dómarabókin",8:"Rutarbók",9:"1. Samúelsbók",10:"2. Samúelsbók",11:"1. Konungabók",12:"2. Konungabók",13:"1. Krónikubók",14:"2. Krónikubók",15:"Esrabók",16:"Nehemíabók",17:"Esterarbók",18:"Jobsbók",19:"Sálmarnir",20:"Orðskviðirnir",21:"Prédikarinn",22:"Ljóðaljóðin",23:"Jesaja",24:"Jeremía",25:"Harmljóðin",26:"Esekíel",27:"Daníel",28:"Hósea",29:"Jóel",30:"Ámos",31:"Óbadía",32:"Jónas",33:"Mika",34:"Nahúm",35:"Habakkuk",36:"Sefanía",37:"Haggaí",38:"Sakaría",39:"Malakí",40:"Matteusar-guðspjall",41:"Markúsar-guðspjall",42:"Lúkasar-guðspjall",43:"Jóhannesar-guðspjall",44:"Postulasagan",45:"Rómverjabréfið",46:"1. Korintubréf",47:"2. Korintubréf",48:"Galatabréfið",49:"Efesusbréfið",50:"Filippíbréfið",51:"Kólossubréfið",52:"1. Tessalóníkubréf",53:"2. Tessalóníkubréf",54:"1. Tímóteusarbréf",55:"2. Tímóteusarbréf",56:"Títusarbréf",57:"Filemonarbréf",58:"Hebreabréfið",59:"Jakobsbréf",60:"1. Pétursbréf",61:"2. Pétursbréf",62:"1. Jóhannesarbréf",63:"2. Jóhannesarbréf",64:"3. Jóhannesarbréf",65:"Júdasarbréfið",66:"Opinberunarbókin"
      },
      igbo: {
        1:"Jenesis",2:"Eksodọs",3:"Levitikọs",4:"Ọnụ ọgụgụ",5:"Diuteronọmi",6:"Jọshua",7:"Ndị Ikpe",8:"Rut",9:"1 Samuẹl",10:"2 Samuẹl",11:"1 Ndị Eze",12:"2 Ndị Eze",13:"1 Ihe Emere",14:"2 Ihe Emere",15:"Ẹzra",16:"Nehemaya",17:"Ẹsta",18:"Job",19:"Abụ Ọma",20:"Ilu",21:"Onye-nkwusa",22:"Abụ Sọlọmọn",23:"Aizaya",24:"Jeremaya",25:"Ịkwa Ákwá",26:"Izikiẹl",27:"Daniẹl",28:"Hosia",29:"Joẹl",30:"Amọs",31:"Obadaya",32:"Jona",33:"Maika",34:"Nehum",35:"Habakuk",36:"Zẹfanaya",37:"Hagai",38:"Zẹkaraya",39:"Malakaị",40:"Matiu",41:"Mak",42:"Luk",43:"Jọn",44:"Ọrụ Ndị Ozi",45:"Ndị Rom",46:"1 Ndị Kọrint",47:"2 Ndị Kọrint",48:"Ndị Galatia",49:"Ndị Efesọs",50:"Ndị Filipai",51:"Ndị Kọlọsi",52:"1 Ndị Tesalọnaịka",53:"2 Ndị Tesalọनाịका",54:"1 Timọti",55:"2 Timọti",56:"Taitọs",57:"Filẹmọn",58:"Ndị Hibru",59:"Jems",60:"1 Pita",61:"2 Pita",62:"1 Jọn",63:"2 Jọn",64:"2 Jọn",65:"Jud",66:"Mkpughe"
      },
      ika: {
        1:"Jenẹsis",2:"Ẹksodọs",3:"Levitikọs",4:"Nọmbas",5:"Diuteronọmi",6:"Jọshua",7:"Ndị Ikpe",8:"Rut",9:"1 Samuẹl",10:"2 Samuẹl",11:"1 Ndị Eze",12:"2 Ndị Eze",13:"1 Ihe Emere",14:"2 Ihe Emere",15:"Ẹzra",16:"Nehemaya",17:"Ẹsta",18:"Job",19:"Abụ Ọma",20:"Ilu",21:"Onye-nkwusa",22:"Abụ Sọlọmọn",23:"Aizaya",24:"Jeremaya",25:"Ịkwa Ákwá",26:"Izikiẹl",27:"Daniẹl",28:"Hosia",29:"Joẹl",30:"Amọs",31:"Obadaya",32:"Jona",33:"Maika",34:"Nahum",35:"Habakuk",36:"Zẹfanaya",37:"Hagai",38:"Zẹkaraya",39:"Malakaị",40:"Matiu",41:"Mak",42:"Luk",43:"Jọn",44:"Iwin rẹ emọsi",45:"Rom",46:"1 Kọrint",47:"2 Kọrint",48:"Galẹshia",49:"Ẹfẹsọs",50:"Filipai",51:"Kọlọsi",52:"1 Tẹsalọnika",53:"2 Tẹsalọnika",54:"1 Timọti",55:"2 Timọti",56:"Taitọs",57:"Filẹmọn",58:"Hibru",59:"Jems",60:"1 Pita",61:"2 Pita",62:"1 Jọn",63:"2 Jọn",64:"3 Jọn",65:"Jud",66:"Arhuan-fẹ"
      },
      ilokano: {
        1:"Genesis",2:"Exodo",3:"Levitico",4:"Numeros",5:"Deuteronomio",6:"Josue",7:"Uk-ukon",8:"Rut",9:"1 Samuel",10:"2 Samuel",11:"1 Ar-ari",12:"2 Ar-ari",13:"1 Cronicas",14:"2 Cronicas",15:"Esdras",16:"Nehemias",17:"Ester",18:"Job",19:"Salmo",20:"Proverbio",21:"Eclesiastes",22:"Kanta ni Solomon",23:"Isaias",24:"Jeremias",25:"Un-unnoy",26:"Ezequiel",27:"Daniel",28:"Oseas",29:"Joel",30:"Amos",31:"Obadias",32:"Jonas",33:"Miqueas",34:"Nahum",35:"Habacuc",36:"Sofonias",37:"Ageo",38:"Zacarias",39:"Malaquias",40:"Mateo",41:"Marcos",42:"Lucas",43:"Juan",44:"Ar-aramid",45:"Roma",46:"1 Corinto",47:"2 Corinto",48:"Galacia",49:"Efeso",50:"Filipos",51:"Colosas",52:"1 Tesalonica",53:"2 Tesalonica",54:"1 Timoteo",55:"2 Timoteo",56:"Tito",57:"Filemon",58:"Hebreo",59:"Santiago",60:"1 Pedro",61:"2 Pedro",62:"1 Juan",63:"2 Juan",64:"3 Juan",65:"Judas",66:"Apocalipsis"
      },
      ilonggo: {
        1:"Genesis",2:"Exodo",3:"Levitico",4:"Numeros",5:"Deuteronomio",6:"Josue",7:"Mga Hurado",8:"Rut",9:"1 Samuel",10:"2 Samuel",11:"1 Mga Hari",12:"2 Mga Hari",13:"1 Cronicas",14:"2 Cronicas",15:"Esdras",16:"Nehemias",17:"Ester",18:"Job",19:"Salmo",20:"Hulubaton",21:"Manunulad",22:"Ambahanon",23:"Isaias",24:"Jeremias",25:"Panaghoy",26:"Ezequiel",27:"Daniel",28:"Oseas",29:"Joel",30:"Amos",31:"Obadias",32:"Jonas",33:"Miqueas",34:"Nahum",35:"Habacuc",36:"Sofonias",37:"Ageo",38:"Zacarias",39:"Malaquias",40:"Mateo",41:"Marcos",42:"Lucas",43:"Juan",44:"Mga Buhat",45:"Roma",46:"1 Corinto",47:"2 Corinto",48:"Galacia",49:"Efeso",50:"Filipos",51:"Colosas",52:"1 Tesalonica",53:"2 Tesalonica",54:"1 Timoteo",55:"2 Timoteo",56:"Tito",57:"Filemon",58:"Hebreo",59:"Santiago",60:"1 Pedro",61:"2 Pedro",62:"1 Juan",63:"2 Juan",64:"3 Juan",65:"Judas",66:"Bugna"
      },
      indonesian: {
        1:"Kejadian",2:"Keluaran",3:"Imamat",4:"Bilangan",5:"Ulangan",6:"Yosua",7:"Hakim-hakim",8:"Rut",9:"1 Samuel",10:"2 Samuel",11:"1 Raja-raja",12:"2 Raja-raja",13:"1 Tawarikh",14:"2 Tawarikh",15:"Ezra",16:"Nehemia",17:"Ester",18:"Ayub",19:"Mazmur",20:"Amsal",21:"Pengkhotbah",22:"Kidung Agung",23:"Yesaya",24:"Yeremia",25:"Ratapan",26:"Yehezkiel",27:"Daniel",28:"Hosea",29:"Yoel",30:"Amos",31:"Obaja",32:"Yunus",33:"Mikha",34:"Nahum",35:"Habakuk",36:"Zefanya",37:"Hagai",38:"Zakharia",39:"Maleakhi",40:"Matius",41:"Markus",42:"Lukas",43:"Yohanes",44:"Kisah Para Rasul",45:"Roma",46:"1 Korintus",47:"2 Korintus",48:"Galatia",49:"Efesus",50:"Filipi",51:"Kolose",52:"1 Tesalonika",53:"2 Tesalonika",54:"1 Timotius",55:"2 Timotius",56:"Titus",57:"Filemon",58:"Ibrani",59:"Yakobus",60:"1 Petrus",61:"2 Petrus",62:"1 Yohanes",63:"2 Yohanes",64:"3 Yohanes",65:"Yudas",66:"Wahyu"
      },
      irish: {
        1:"Geineasas",2:"Eaxodus",3:"Leiviticus",4:"Uimhreacha",5:"Deitéaranaim",6:"Iósua",7:"Breithiúna",8:"Rút",9:"1 Samúéil",10:"2 Samúéil",11:"1 Ríthe",12:"2 Ríthe",13:"1 Croinicí",14:"2 Croinicí",15:"Ezrà",16:"Nihimiá",17:"Estéar",18:"Iób",19:"Sailm",20:"Seanfhocail",21:"Cóheileat",22:"Amhrán na nAmhrán",23:"Íseáia",24:"Iremiá",25:"Caoineadh",26:"Eizicéil",27:"Dainéil",28:"Hóisey",29:"Ióéil",30:"Amós",31:"Abadiá",32:"Ióna",33:"Míocá",34:"Náchúm",35:"Habacúc",36:"Zephaniah",37:"Hagaí",38:"Zacairiá",39:"Malaicí",40:"Mata",41:"Marcas",42:"Lúcás",43:"Eoin",44:"Gníomhartha na nAspal",45:"Rómhánaigh",46:"1 Corantaigh",47:"2 Corantaigh",48:"Galataigh",49:"Eifeisigh",50:"Filipigh",51:"Colosaigh",52:"1 Teasalónacaigh",53:"2 Teasalónacaigh",54:"1 Tiomóid",55:"2 Tiomóid",56:"Títas",57:"Filéamón",58:"Eabhraigh",59:"Séamas",60:"1 Peadar",61:"2 Peadar",62:"1 Eoin",63:"2 Eoin",64:"3 Eoin",65:"Iúd",66:"Apacailipsis"
      },
      italian: {
        1:"Genesi",2:"Esodo",3:"Levitico",4:"Numeri",5:"Deuteronomio",6:"Giosuè",7:"Giudici",8:"Rut",9:"1 Samuele",10:"2 Samuele",11:"1 Re",12:"2 Re",13:"1 Cronache",14:"2 Cronache",15:"Esdra",16:"Neemia",17:"Ester",18:"Giobbe",19:"Salmi",20:"Proverbi",21:"Ecclesiaste",22:"Cantico dei Cantici",23:"Isaia",24:"Geremia",25:"Lamentazioni",26:"Ezechiele",27:"Daniele",28:"Osea",29:"Gioele",30:"Amos",31:"Abdia",32:"Giona",33:"Michea",34:"Naum",35:"Abacuc",36:"Sofonia",37:"Aggeo",38:"Zaccaria",39:"Malachia",40:"Matteo",41:"Marco",42:"Luca",43:"Giovanni",44:"Atti degli Apostoli",45:"Romani",46:"1 Corinzi",47:"2 Corinzi",48:"Galati",49:"Efesini",50:"Filippesi",51:"Colossesi",52:"1 Tessalonicesi",53:"2 Tessalonicesi",54:"1 Timoteo",55:"2 Timoteo",56:"Tito",57:"Filemone",58:"Ebrei",59:"Giacomo",60:"1 Pietro",61:"2 Pietro",62:"1 Giovanni",63:"2 Giovanni",64:"3 Giovanni",65:"Giuda",66:"Apocalisse"
      },
      iu_mien: {
        1:"Tin Deic",2:"Cuot I-Yip",3:"Le-wi",4:"Saau Ginv",5:"Douh Sanc Sieteiv",6:"Yosua",7:"Zoom-Zyeiv",8:"Lu-te",9:"1 Sa-mu-en",10:"2 Sa-mu-en",11:"1 Ncungz-Zungv",12:"2 Ncungz-Zungv",13:"1 Douh Sanc",14:"2 Douh Sanc",15:"E-sa-la",16:"Ne-he-mi",17:"E-sa-te",18:"Yo-ba",19:"Singx Njaang",20:"Cong-Yong",21:"Gid-Tou-Zouv",22:"Laux-Lorm-Zauv",23:"I-sa-ya",24:"Ye-le-mi",25:"Ye-le-mi nyei Haau-Njang",26:"E-se-ki-en",27:"Da-ni-en",28:"Ho-se-ya",29:"Yo-en",30:"A-mote",31:"O-ba-di",32:"Yo-na",33:"Mi-ka",34:"Na-hum",35:"Ha-ba-kuk",36:"Se-fa-ni",37:"Hak-kaai",38:"Sa-ka-li-ya",39:"Ma-la-ki",40:"Ma-tai",41:"Ma-ko",42:"Lu-ka",43:"Yo-han",44:"Gorngev",45:"Lo-ma",46:"1 Ko-lin-to",47:"2 Ko-lin-to",48:"Ka-la-ti-ya",49:"E-fe-so",50:"Fi-lip-pi",51:"Ko-lo-si",52:"1 Te-sa-lo-ni-ka",53:"2 Te-sa-lo-ni-ka",54:"1 Ti-mo-tai",55:"2 Ti-mo-tai",56:"Ti-to",57:"Fi-le-mon",58:"Hi-bu-lu",59:"Ya-ko-ba",60:"1 Be-te-lo",61:"2 Be-te-lo",62:"1 Yo-han",63:"2 Yo-han",64:"3 Yo-han",65:"Yu-da",66:"Laau-Zangv"
      },
      jamaican: {
        1:"Jeneris",2:"Exodas",3:"Livitikọs",4:"Nomba",5:"Diutaranami",6:"Jashua",7:"Jajiz",8:"Ruut",9:"1 Samyuel",10:"2 Samyuel",11:"1 King",12:"2 King",13:"1 Kranikl",14:"2 Kranikl",15:"Ezra",16:"Neimaya",17:"Esta",18:"Juob",19:"Saam",20:"Pravab",21:"Ikliziastiz",22:"Sang a Solaman",23:"Aizaaya",24:"Jerimaya",25:"Lamantieshanz",26:"Izikyel",27:"Danyel",28:"Oziya",29:"Juwel",30:"Amos",31:"Obadaya",32:"Jona",33:"Maika",34:"Neihum",35:"Habakuk",36:"Zefanaya",37:"Hagai",38:"Zekaraya",39:"Malakai",40:"Matyu",41:"Maak",42:"Luuk",43:"Jan",44:"Aks",45:"Ruomanz",46:"1 Korintyanz",47:"2 Korintyanz",48:"Galieshanz",49:"Ifiizhanz",50:"Filipyanz",51:"Kalooshanz",52:"1 Tesaluonyanz",53:"2 Tesaluonyanz",54:"1 Timati",55:"2 Timati",56:"Taitas",57:"Filimuon",58:"Hiibruuz",59:"Jiemz",60:"1 Piita",61:"2 Piita",62:"1 Jan",63:"2 Jan",64:"3 Jan",65:"Juud",66:"Rivilieshan"
      },
      japanese: {
        1:"創世記",2:"出エジプト記",3:"レビ記",4:"民数記",5:"申命記",6:"ヨシュア記",7:"士師記",8:"ルツ記",9:"サムエル記上",10:"サムエル記下",11:"列王記上",12:"列王記下",13:"歴代誌上",14:"歴代誌下",15:"エズラ記",16:"ネヘミヤ記",17:"エステル記",18:"ヨブ記",19:"詩篇",20:"箴言",21:"伝道者の書",22:"雅歌",23:"イザヤ書",24:"エレミヤ書",25:"哀歌",26:"エゼキエル書",27:"ダニエル書",28:"ホセア書",29:"ヨエル書",30:"アモス書",31:"オバデヤ書",32:"ヨナ書",33:"ミカ書",34:"ナホム書",35:"ハバクク書",36:"ゼパニヤ書",37:"ハガイ書",38:"ゼカリヤ書",39:"マラキ書",40:"マタイによる福音書",41:"マルコによる福音書",42:"ルカによる福音書",43:"ヨハネによる福音書",44:"使徒の働き",45:"ローマ人への手紙",46:"コリント人への手紙第一",47:"コリント人への手紙第二",48:"ガラテヤ人への手紙",49:"エペソ人への手紙",50:"フィリピ人への手紙",51:"コロサイ人への手紙",52:"テサロニケ人への手紙第一",53:"テサロニケ人への手紙第二",54:"テモテへの手紙第一",55:"テモテへの手紙第二",56:"テトスへの手紙",57:"フィレモンへの手紙",58:"ヘブル人への手紙",59:"ヤコブの手紙",60:"ペテロの手紙第一",61:"ペテロの手紙第二",62:"ヨハネの手紙第一",63:"ヨハネの手紙第二",64:"ヨハネの手紙第三",65:"ユダの手紙",66:"ヨハネの黙示録"
      },
      javanese: {
        1:"Purwaning Dumadi",2:"Peon",3:"Kaimaman",4:"Wilangan",5:"Pangandharaning Toret",6:"Yusak",7:"Para Hakim",8:"Rut",9:"1 Samuel",10:"2 Samuel",11:"1 Para Raja",12:"2 Para Raja",13:"1 Babad",14:"2 Babad",15:"Ezra",16:"Nehemia",17:"Ester",18:"Ayub",19:"Jabur",20:"Wulang Bebasan",21:"Juru Khotbah",22:"Kidung Agung",23:"Yesaya",24:"Yeremia",25:"Kidung Pasambat",26:"Yehezkiel",27:"Daniel",28:"Hosea",29:"Yoel",30:"Amos",31:"Obaja",32:"Yunus",33:"Mikha",34:"Nahum",35:"Habakuk",36:"Zefanya",37:"Hagai",38:"Zakharia",39:"Maleakhi",40:"Matius",41:"Markus",42:"Lukas",43:"Yohanes",44:"Lelakoné Para Rasul",45:"Rum",46:"1 Korintus",47:"2 Korintus",48:"Galati",49:"Efesus",50:"Filipi",51:"Kolose",52:"1 Tesalonika",53:"2 Tesalonika",54:"1 Timotius",55:"2 Timotius",56:"Titus",57:"Filemon",58:"Ibrani",59:"Yakobus",60:"1 Petrus",61:"2 Petrus",62:"1 Yohanes",63:"2 Yohanes",64:"3 Yohanes",65:"Yudas",66:"Wahyu"
      },
      kabardian: {
        1:"Псалъэ",2:"Щыпсэу",3:"Левит",4:"Бжыгъэхэр",5:"Закон",6:"Ешуа",7:"Хьэкум",8:"Рут",9:"1 Самуил",10:"2 Самуил",11:"1 Пащтыхь",12:"2 Пащтыхь",13:"1 Тхыдэ",14:"2 Тхыдэ",15:"Ездра",16:"Неемия",17:"Есфирь",18:"Иов",19:"Псаломхэр",20:"Псалъэжьхэр",21:"Екклезиаст",22:"Илльэ",23:"Исаия",24:"Иеремия",25:"Тхьэусыхэ",26:"Иезекииль",27:"Даниил",28:"Осия",29:"Иоиль",30:"Амос",31:"Авдий",32:"Иона",33:"Михей",34:"Наум",35:"Аввакум",36:"Софония",37:"Аггей",38:"Закария",39:"Малахия",40:"Матей",41:"Марк",42:"Лука",43:"Иоанн",44:"Гъуазэ",45:"Рим",46:"1 Коринф",47:"2 Коринф",48:"Галат",49:"Эфес",50:"Филипп",51:"Колос",52:"1 Фессалоник",53:"2 Фессалоник",54:"1 Тимофей",55:"2 Timothy",56:"Тит",57:"Филимон",58:"Еврей",59:"Якъуб",60:"1 Петр",61:"2 Петр",62:"1 Иоанн",63:"2 Иоанн",64:"3 Иоанн",65:"Иуда",66:"Тхьэм иӀа"
      },
      kabyle: {
        1:"Tazwara",2:"Effer",3:"Lecat",4:"Imḍanen",5:"Aselmed",6:"Yocwa",7:"Inemzura",8:"Rut",9:"1 Camwil",10:"2 Camwil",11:"1 Igelliden",12:"2 Igelliden",13:"1 Imazrayen",14:"2 Imazrayen",15:"Σdra",16:"Nehemi",17:"Σster",18:"Ayub",19:"Isalmen",20:"Inzi",21:"Amusnaw",22:"Tizlit",23:"Iceya",24:"Jirmya",25:"Imettawen",26:"Σzekyel",27:"Danyel",28:"Huciya",29:"Jwil",30:"Amus",31:"Σbadya",32:"Yunus",33:"Micée",34:"Nahum",35:"Habakuk",36:"Σfunya",37:"Σjjay",38:"Zakarya",39:"Malaki",40:"Matta",41:"Marqus",42:"Luqa",43:"Yuhenna",44:"Lecɣал",45:"Irumaniyen",46:"1 Ikurintiyen",47:"2 Ikurintiyen",48:"Igatiyen",49:"Ificiyen",50:"Ifilipiyen",51:"Ikulusiye",52:"1 Itisaluniken",53:"2 Itisaluniken",54:"1 Timuti",55:"2 Timuti",56:"Titu",57:"Filimun",58:"Ibebran",59:"Yaɛqub",60:"1 Buṭrus",61:"2 Buṭrus",62:"1 Yuhenna",63:"2 Yuhenna",64:"3 Yuhenna",65:"Yuda",66:"Aweḥḥi"
      },
      kachin: {
        1:"Ningpawt",2:"Gamyawng",3:"Lewi",4:"Garan",5:"Tara",6:"Yosua",7:"Jadu",8:"Rut",9:"1 Samu-ela",10:"2 Samu-ela",11:"1 Hkawng",12:"2 Hkawng",13:"1 Labau",14:"2 Labau",15:"Esra",16:"Nehemia",17:"Estera",18:"Yob",19:"Shingran",20:"Ga-un",21:"Hpaji",22:"Mahkawn",23:"Esaia",24:"Jeremia",25:"Myit",26:"Hesekiel",27:"Daniel",28:"Hosea",29:"Yo-el",30:"Amos",31:"Obadia",32:"Yona",33:"Mika",34:"Nahum",35:"Habakuk",36:"Sepania",37:"Haggai",38:"Zakaria",39:"Malaki",40:"Matai",41:"Marku",42:"Luka",43:"Yo-han",44:"Shingran",45:"Roma",46:"1 Korintu",47:"2 Korintu",48:"Galatia",49:"Efesu",50:"Pilipi",51:"Kolose",52:"1 Tesalonika",53:"2 Tesalonika",54:"1 Timoti",55:"2 Timoti",56:"Titu",57:"Pilemon",58:"Bebru",59:"Yaku",60:"1 Petru",61:"2 Petru",62:"1 Yo-han",63:"2 Yo-han",64:"3 Yo-han",65:"Yuda",66:"Singran"
      },
      kalenjin: {
        1:"Toitunnot",2:"King'eunnot",3:"Lawi",4:"Iitut",5:"Ngatutiet",6:"Joshua",7:"Ngatutik",8:"Rut",9:"1 Samuel",10:"2 Samuel",11:"1 Saiton",12:"2 Saiton",13:"1 Chronicles",14:"2 Chronicles",15:"Ezra",16:"Nehemiah",17:"Esther",18:"Job",19:"Zaburi",20:"Kaleweno",21:"Ecclesiastes",22:"King'eunnot",23:"Isaya",24:"Jeremia",25:"Lamentations",26:"Ezekiel",27:"Daniel",28:"Hosea",29:"Joel",30:"Amos",31:"Obadiah",32:"Jona",33:"Micah",34:"Nahum",35:"Habakkuk",36:"Zephaniah",37:"Haggai",38:"Zechariah",39:"Malachi",40:"Matayo",41:"Mariko",42:"Luka",43:"Yohana",44:"Kereunnot",45:"Rom",46:"1 Korinto",47:"2 Korinto",48:"Galatia",49:"Efeso",50:"Pilipi",51:"Kolose",52:"1 Tesalonika",53:"2 Tesalonika",54:"1 Timoteo",55:"2 Timoteo",56:"Tito",57:"Philemon",58:"Eberania",59:"Jakobo",60:"1 Petero",61:"2 Petero",62:"1 Yohana",63:"2 Yohana",64:"3 Yohana",65:"Yuda",66:"Revelation"
      },
      kamba: {
        1:"Kyambîlo",2:"Kuma",3:"Alawi",4:"Talatũ",5:"Mwĩlao",6:"Yosua",7:"Asilĩ",8:"Luti",9:"1 Samuel",10:"2 Samuel",11:"1 Asumbĩ",12:"2 Asumbĩ",13:"1 Mavinda",14:"2 Mavinda",15:"Esila",16:"Neemia",17:"Esita",18:"Iyobu",19:"Zaburi",20:"Ndai",21:"Mũtavany'a",22:"Wĩmbo",23:"Isaya",24:"Yelemia",25:"Ũng'endu",26:"Esekiely",27:"Ndanyieli",28:"Osea",29:"Yoeli",30:"Amosi",31:"Obadia",32:"Yona",33:"Mika",34:"Naumu",35:"Habakuku",36:"Sefania",37:"Akai",38:"Sekaria",39:"Malaki",40:"Mataio",41:"Maliko",42:"Luka",43:"Yoana",44:"Maiko",45:"Aloma",46:"1 Akolintho",47:"2 Akolintho",48:"Agalatia",49:"Aefeso",50:"Apilipi",51:"Akolose",52:"1 Atesalonika",53:"2 Atesalonika",54:"1 Timoteo",55:"2 Timoteo",56:"Tito",57:"Filimona",58:"Aiebalania",59:"Yakobo",60:"1 Petero",61:"2 Petero",62:"1 Yoana",63:"2 Yoana",64:"3 Yoana",65:"Yuda",66:"Ngunũ"
      },
      kangri: {
        1:"उतपत्ती",2:"निकारी",3:"लेव्यव्यवस्था",4:"गनती",5:"नियम",6:"यहोशू",7:"नियाव",8:"रूत",9:"1 समुएल",10:"2 समुएल",11:"1 राजा",12:"2 राजा",13:"1 इतिहास",14:"2 इतिहास",15:"एज्रा",16:"नहेमायाह",17:"एस्तेर",18:"अय्यूब",19:"भजन",20:"नीतिवचन",21:"सभोपदेसक",22:"श्रेष्ठगीत",23:"यशायाह",24:"यिर्मयाह",25:"रोना",26:"यहेजकेल",27:"दानिय्येल",28:"होसे",29:"योएल",30:"आमोस",31:"ओबद्याह",32:"योना",33:"मीका",34:"नहूम",35:"हबक्कूक",36:"सपन्याह",37:"हाग्गै",38:"जकर्याह",39:"मलाकी",40:"मत्ती",41:"मरकुस",42:"लूका",43:"यूहन्ना",44:"प्रेरित मन",45:"रोमियों",46:"1 कुरिन्थियों",47:"2 कुरिन्थियों",48:"गलातियों",49:"इफिसियों",50:"फिलिप्पियों",51:"कुलुस्सियों",52:"1 थिस्स.",53:"2 थिस्स.",54:"तीमुथियुस",55:"तीमुथियुस",56:"तीतुस",57:"फिलेमोन",58:"इब्रानियों",59:"याकूब",60:"1 पतरस",61:"2 पतरस",62:"1 यूहन्ना",63:"2 यूहन्ना",64:"3 यूहन्ना",65:"यहूदा",66:"प्रकाशितवाक्य"
      },
      kannada: {
        1:"ಆದಿಕಾಂಡ",2:"ವಿಮೋಚನಕಾಂಡ",3:"ಯಾಜಕಕಾಂಡ",4:"ಅರಣ್ಯಕಾಂಡ",5:"ಧರ್ಮೋಪದೇಶಕಾಂಡ",6:"ಯೆಹೋಶುವ",7:"ನ್ಯಾಯಾಧಿಪತಿಗಳು",8:"ರೂತಳು",9:"1 ಸಮುವೇಲನು",10:"2 ಸಮುವೇಲನು",11:"1 ಅರಸುಗಳು",12:"2 ಅರಸುಗಳು",13:"1 ಪೂರ್ವಕಾಲವೃತ್ತಾಂತ",14:"2 ಪೂರ್ವಕಾಲವೃತ್ತಾಂತ",15:"ಎಜ್ರನು",16:"ನೆಹೆಮೀಯನು",17:"ಎಸ್ತೇರಳು",18:"ಯೋಬನು",19:"ಕೀರ್ತನೆಗಳು",20:"ಜ್ಞಾನೋಕ್ತಿಗಳು",21:"ಪ್ರಸಂಗಿ",22:"ಪರಮ ಗೀತೆ",23:"ಯೆಶಾಯ",24:"ಯೆರೆಮೀಯ",25:"ಪ್ರಲಾಪಗಳು",26:"ಎಜೆಕಿಯೇಲನು",27:"ದಾನಿಯೇಲನು",28:"ಹೋಶೇಯ",29:"ಯೋವೇಲನು",30:"ಆಮೋಸನು",31:"ಓಬದ್ಯನು",32:"ಯೋನನು",33:"ಮಿಕನು",34:"ನಾಹೂಮನು",35:"ಹಬಕ್ಕೂಕನು",36:"ಚೆಫನ್ಯನು",37:"ಹಗ್ಗಾಯನು",38:"ಜೆಕರ್ಯನು",39:"ಮಲಾಕಿಯನು",40:"ಮತ್ತಾಯನು",41:"ಮಾರ್ಕನು",42:"ಲೂಕನು",43:"ಯೋಹಾನನು",44:"ಅಪೊಸ್ತಲರ ಕೃತ್ಯಗಳು",45:"ರೋಮಾಪುರದವರಿಗೆ",46:"1 ಕೊರಿಂಥದವರಿಗೆ",47:"2 ಕೊರಿಂಥದವರಿಗೆ",48:"ಗಲಾತ್ಯದವರಿಗೆ",49:"ಎಫೆಸದವರಿಗೆ",50:"ಫಿಲಿಪ್ಪಿಯವರಿಗೆ",51:"ಕೊಲೊಸ್ಸೆಯವರಿಗೆ",52:"1 ತೆಸಲೋನಿಯದವರಿಗೆ",53:"2 ತೆಸಲೋನಿಯದವರಿಗೆ",54:"1 ತಿಮೊಥೆಯನಿಗೆ",55:"2 ತಿಮೊಥೆಯನಿಗೆ",56:"ತೀತನಿಗೆ",57:"ಫಿಲೆಮೋನನಿಗೆ",58:"ಇಬ್ರಿಯರಿಗೆ",59:"ಯಾಕೋಬನು",60:"1 ಪೇತ್ರನು ಬರೆದದ್ದು",61:"2 ಪೇತ್ರನು ಬರೆದದ್ದು",62:"1 ಯೋಹಾನನು ಬರೆದದ್ದು",63:"2 ಯೋಹಾನನು ಬರೆದದ್ದು",64:"3 ಯೋಹಾನನು ಬರೆದದ್ದು",65:"ಯೂದನು ಬರೆದದ್ದು",66:"ಪ್ರಕಟಣೆ"
      },
      karakalpak: {
        1:"Yaratiłiw",2:"Shigiwis",3:"Levit",4:"Sanlar",5:"Nzamzam",6:"Eshua",7:"Biyler",8:"Rut",9:"1 Samuel",10:"2 Samuel",11:"1 Patshalar",12:"2 Patshalar",13:"1 Tarıyx",14:"2 Tarıyx",15:"Ezra",16:"Nexemıya",17:"Esfir",18:"Ayup",19:"Zabur",20:"Naqıl-maqallar",21:"Ekklisıast",22:"Sulaymannıń qosıǵı",23:"Isaya",24:"İyeremıya",25:"Iyeremıyanıń jılawı",26:"Ezekıyl",27:"Danıyal",28:"Oseya",29:"İyoıl",30:"Amos",31:"Obadıya",32:"Yunus",33:"Mıxey",34:"Naum",35:"Avvakum",36:"Sofonıya",37:"Aggey",38:"Zakarıya",39:"Malaxıya",40:"Matfey",41:"Mark",42:"Luka",43:"İoann",44:"Rasulllardıń isleri",45:"Rimliklerge",46:"1 Korinflilerge",47:"2 Korinflilerge",48:"Galatıyalılarǵa",49:"Efesliklerge",50:"Filippililerge",51:"Kolossılılarǵa",52:"1 Fessalonıkalılarǵa",53:"2 Fessalonıkalılarǵa",54:"1 Timofeyge",55:"2 Timofeyge",56:"Titge",57:"Filimonǵa",58:"Evreylerge",59:"Yaqup",60:"1 Petr",61:"2 Petr",62:"1 İoann",63:"2 İoann",64:"3 İoann",65:"Yuda",66:"Ashıluw"
      },
      kazakh: {
        1:"Жаратылыстың басталуы",2:"Мысырдан шығу",3:"Леуілер",4:"Сандар",5:"Заңды қайталау",6:"Ешуа",7:"Билер",8:"Рут",9:"1 Самуил",10:"2 Самуил",11:"1 Патшалықтар",12:"2 Патшалықтар",13:"1 Шежіре",14:"2 Шежіре",15:"Езра",16:"Неемия",17:"Есфир",18:"Әйүп",19:"Зәбүр",20:"Нақыл сөздер",21:"Уағыздаушы",22:"Сүлейменнің таңдаулы әні",23:"Ишая",24:"Еремия",25:"Еремияның зарлы әні",26:"Езекиел",27:"Даниял",28:"Ошия",29:"Жоел",30:"Амос",31:"Абади",32:"Жүніс",33:"Миха",34:"Нахум",35:"Хабақұқ",36:"Софония",37:"Аггей",38:"Зәкәрия",39:"Малахи",40:"Матай",41:"Марқа",42:"Лұқа",43:"Жохан",44:"Елшілердің істері",45:"Римдіктерге",46:"1 Қорынттықтарға",47:"2 Қорынттықтарға",48:"Ғалаттықтарға",49:"Ефестіктерге",50:"Філіпіліктерге",51:"Колостықтарға",52:"1 Салоникалықтарға",53:"2 Салоникалықтарға",54:"1 Тімотеге",55:"2 Тімотеге",56:"Титке",57:"Филемонға",58:"Еврейлерге",59:"Жақып",60:"1 Петір",61:"2 Петір",62:"1 Жохан",63:"2 Жохан",64:"3 Жохан",65:"Яһуда",66:"Аян"
      },
      khmer: {
        1:"លោត្បត្តិ",2:"និក្ខមនំ",3:"លេវីវិន័យ",4:"ជនគណនា",5:"ទុតិយសញ្ញា",6:"យ៉ូស្វេ",7:"ពួកចៅហ្វាយ",8:"រស់",9:"1 សាំយូអែល",10:"2 សាំយូអែល",11:"1 ស្តេច",12:"2 ស្តេច",13:"1 របាក្សត្រ",14:"2 របាក្សត្រ",15:"អែសរ៉ា",16:"នេហេមា",17:"អេសធើរ",18:"យ៉ូប",19:"ទំនុកតម្កើង",20:"សុភាសិត",21:"សាស្តា",22:"បទចម្រៀង",23:"អេសាយ",24:"យេរេមា",25:"បរិទេវ",26:"អេសេគីអែល",27:"ដានីយ៉ែល",28:"ហូសេ",29:"យ៉ូអែល",30:"អេម៉ុស",31:"អូបាឌី",32:"យ៉ូណាស",33:"មីកា",34:"ណាហ៊ុម",35:"ហាបាគុក",36:"សេផានី",37:"ហាកាយ",38:"សាការី",39:"ម៉ាឡាគី",40:"ម៉ាថាយ",41:"ម៉ាកុស",42:"លូកា",43:"យ៉ូហាន",44:"កិច្ចការ",45:"រ៉ូម",46:"1 កូរិនថូស",47:"2 កូរិនថូស",48:"កាឡាទី",49:"អេភេសូរ",50:"ភីលីព",51:"កូឡុស",52:"1 ថេស្សាឡូនីច",53:"2 ថេស្សាឡូនីច",54:"1 ធីម៉ូថេ",55:"2 ធីម៉ូថេ",56:"ទីតុស",57:"ភីលេម៉ូន",58:"ហេព្រើ",59:"យ៉ាកុប",60:"1 ពេត្រុស",61:"1 ពេត្រុស",62:"1 យ៉ូហាន",63:"1 យ៉ូហាន",64:"1 យ៉ូហាន",65:"យូដា",66:"វិវរណៈ"
      },
      kiche: {
        1:"Rutikirib’al",2:"Elik",3:"Lewitiko",4:"Ajlanem",5:"Utzalijik ri Pixab’",6:"Josué",7:"Q’atb’al Tzij",8:"Rut",9:"1 Samuel",10:"2 Samuel",11:"1 Reyes",12:"2 Reyes",13:"1 Crónicas",14:"2 Crónicas",15:"Esdras",16:"Nehemías",17:"Ester",18:"Job",19:"Salmos",20:"K’utb’al Na’oj",21:"Eclesiastés",22:"B’ixonem re ri B’ixonem",23:"Isaías",24:"Jeremías",25:"B’ixonem re Oq’ej",26:"Ezequiel",27:"Daniel",28:"Oseas",29:"Joel",30:"Amós",31:"Abdías",32:"Jonás",33:"Miqueas",34:"Nahum",35:"Habacuc",36:"Sofonías",37:"Ageo",38:"Zacarías",39:"Malaquías",40:"Mateo",41:"Marcos",42:"Lucas",43:"Juan",44:"Chakpatan",45:"Roma",46:"1 Corinto",47:"2 Corinto",48:"Galacia",49:"Efeso",50:"Filipos",51:"Colosas",52:"1 Tesalónica",53:"2 Tesalónica",54:"1 Timoteo",55:"2 Timoteo",56:"Tito",57:"Filemón",58:"Hebreos",59:"Santiago",60:"1 Pedro",61:"2 Pedro",62:"1 Juan",63:"2 Juan",64:"3 Juan",65:"Judas",66:"K’utunem"
      },
      kikuyu: {
        1:"Kĩambĩrĩria",2:"Kuma",3:"Alawi",4:"Atalo",5:"Gũcookerithia Wĩatho",6:"Joshua",7:"Atuĩri",8:"Rutu",9:"1 Samuele",10:"2 Samuele",11:"1 Athamaki",12:"2 Athamaki",13:"1 Maũhoro ma Tene",14:"2 Maũhoro ma Tene",15:"Ezira",16:"Nehemia",17:"Esita",18:"Ayubu",19:"Thaburi",20:"Thimo",21:"Kohelethu",22:"Rwĩmbo rwa Nyimbo",23:"Isaia",24:"Jeremia",25:"Macakaya",26:"Ezekieli",27:"Danieli",28:"Hosea",29:"Joeli",30:"Amosi",31:"Obadia",32:"Jona",33:"Mika",34:"Nahumu",35:"Habakuku",36:"Sefania",37:"Hagai",38:"Zakaria",39:"Malaki",40:"Mathayo",41:"Mariko",42:"Luka",43:"Johana",44:"Atũmwo",45:"Aroma",46:"1 Akorinto",47:"2 Akorinto",48:"Agalatia",49:"Aefeso",50:"Afilipi",51:"Akolosai",52:"1 Atesalonike",53:"2 Atesalonike",54:"1 Timotheo",55:"2 Timotheo",56:"Tito",57:"Filemona",58:"Ahibirania",59:"Jakubu",60:"1 Petero",61:"2 Petero",62:"1 Johana",63:"2 Johana",64:"3 Johana",65:"Juda",66:"Kũguũririo"
      },
      kikwango: {
        1:"luyantiku",2:"kubasika",3:"bileko",4:"kutanga",5:"munsiku",6:"Yozua",7:"bazuzi",8:"Ruti",9:"1 Samuele",10:"2 Samuele",11:"1 Bantotila",12:"2 Bantotila",13:"1 Bansangu",14:"2 Bansangu",15:"Ezdrasi",16:"Nehemi",17:"Estere",18:"Yobi",19:"Bankunga",20:"Bingana",21:"Mupangi",22:"Nkuunga",23:"Ezayi",24:"Yeremi",25:"Bidilo",26:"Ezekiele",27:"Daniele",28:"Ozea",29:"Yoele",30:"Amoze",31:"Obadia",32:"Yona",33:"Mika",34:"Nahumi",35:"Abakuku",36:"Sefania",37:"Agai",38:"Zakaria",39:"Malaki",40:"Matayo",41:"Marko",42:"Luka",43:"Yoane",44:"Bisalu",45:"Baloma",46:"1 Bakolinto",47:"2 Bakolinto",48:"Bagalatia",49:"Baefezo",50:"Bafilipi",51:"Bakoloze",52:"1 Batesalonika",53:"2 Batesalonika",54:"1 Timote",55:"2 Timote",56:"Tito",57:"Filemoni",58:"Baebreo",59:"Yakobo",60:"1 Piere",61:"2 Piere",62:"1 Yoane",63:"2 Yoane",64:"3 Yoane",65:"Yuda",66:"Kusonga"
      },
      kimbundu: {
        1:"Ngenese",2:"Kubatuka",3:"Levi",4:"Kulonda",5:"Kwambulula",6:"Josuè",7:"Azuzi",8:"Rute",9:"1 Samuele",10:"2 Samuele",11:"1 Jisobele",12:"2 Jisobele",13:"1 Hisitola",14:"2 Hisitola",15:"Êsdrâ",16:"Nehemiya",17:"Êsutere",18:"Jobi",19:"Isalamu",20:"Jisabu",21:"Mulongi",22:"Muimbu",23:"Izaya",24:"Jelemiya",25:"Kudila",26:"Ezekiyele",27:"Danyele",28:"Ozeia",29:"Joele",30:"Amoze",31:"Obadiya",32:"Jona",33:"Mikeia",34:"Nahume",35:"Habakuke",36:"Sefaniya",37:"Agai",38:"Zakariya",39:"Malakiya",40:"Mataiu",41:"Malako",42:"Luka",43:"Juau",44:"Ikaisu",45:"Loma",46:"1 Kolindu",47:"2 Kolindu",48:"Ngala",49:"Efezu",50:"Filipi",51:"Kolosu",52:"1 Tesalonika",53:"2 Tesalonika",54:"1 Timote",55:"2 Timote",56:"Titu",57:"Filemona",58:"Hebeleu",59:"Tiyagu",60:"1 Petulu",61:"2 Petulu",62:"1 Juau",63:"2 Juau",64:"3 Juau",65:"Zuda",66:"Kukulula"
      },
      kimiiru: {
        1:"Kiamiriria",2:"Kuma",3:"Alawi",4:"Atalo",5:"Gucokeerithia",6:"Joshua",7:"Atuiiri",8:"Rutu",9:"1 Samuele",10:"2 Samuele",11:"1 Athamaki",12:"2 Athamaki",13:"1 Mauhoro",14:"2 Mauhoro",15:"Ezira",16:"Nehemia",17:"Esita",18:"Ayubu",19:"Thaburi",20:"Thimo",21:"Kohelethu",22:"Rwimbo",23:"Isaia",24:"Jeremia",25:"Macakaya",26:"Ezekieli",27:"Danieli",28:"Hosea",29:"Joeli",30:"Amosi",31:"Obadia",32:"Jona",33:"Mika",34:"Nahumu",35:"Habakuku",36:"Sefania",37:"Hagai",38:"Zakaria",39:"Malaki",40:"Mathayo",41:"Mariko",42:"Luka",43:"Johana",44:"Atumwo",45:"Aroma",46:"1 Akorinto",47:"2 Akorinto",48:"Agalatia",49:"Aefeso",50:"Afilipi",51:"Akolosai",52:"1 Atesalonike",53:"2 Atesalonike",54:"1 Timotheo",55:"2 Timotheo",56:"Tito",57:"Filemona",58:"Ahibirania",59:"Jakubu",60:"1 Petero",61:"2 Petero",62:"1 Johana",63:"2 Johana",64:"3 Johana",65:"Juda",66:"Kuguuririo"
      },
      kinyarwanda: {
        1:"Itangiriro",2:"Kuva",3:"Abalewi",4:"Kubara",5:"Gucura amategeko",6:"Yosuwa",7:"Abacamanza",8:"Ruti",9:"1 Samweli",10:"2 Samweli",11:"1 Abami",12:"2 Abami",13:"1 Ngoro",14:"2 Ngoro",15:"Ezira",16:"Nehemiya",17:"Esitera",18:"Yobu",19:"Zaburi",20:"Imigani",21:"Umubwiriza",22:"Indirimbo",23:"Yesaya",24:"Yeremiya",25:"Amaganya",26:"Ezekiyeli",27:"Daniyeli",28:"Hoseya",29:"Yoweli",30:"Amosi",31:"Obadiya",32:"Yona",33:"Mika",34:"Nahumu",35:"Habakuku",36:"Sefaniya",37:"Hagayi",38:"Zakariya",39:"Malaki",40:"Matayo",41:"Mariko",42:"Luka",43:"Yohani",44:"Ibikorwa",45:"Abaroma",46:"1 Abakorinto",47:"2 Abakorinto",48:"Abagalatiya",49:"Abanyefeso",50:"Abanyafilipi",51:"Abanyakolosi",52:"1 Abatesaloniki",53:"2 Abatesaloniki",54:"1 Timoteyo",55:"2 Timoteyo",56:"Tito",57:"Filemoni",58:"Abaheburayo",59:"Yakobo",60:"1 Petero",61:"2 Petero",62:"1 Yohani",63:"2 Yohani",64:"3 Yohani",65:"Yuda",66:"Ibyahishuwe"
      },
      kirundi: {
        1:"Itanguriro",2:"Kuvayo",3:"Abalewi",4:"Guharura",5:"Gusubira mu vyagezwe",6:"Yozuwa",7:"Abacamanza",8:"Ruti",9:"1 Samuweli",10:"2 Samuweli",11:"1 Abami",12:"2 Abami",13:"1 Ivyamaze kuba",14:"2 Ivyamaze kuba",15:"Ezira",16:"Nehemiya",17:"Esitera",18:"Yobu",19:"Zaburi",20:"Imigani",21:"Umubwiriza",22:"Indirimbo",23:"Yesaya",24:"Yeremiya",25:"Amaganya",26:"Ezekiyeli",27:"Daniyeli",28:"Hoseya",29:"Yoweli",30:"Amosi",31:"Obadiya",32:"Yona",33:"Mika",34:"Nahumu",35:"Habakuku",36:"Sefaniya",37:"Hagayi",38:"Zakariya",39:"Malaki",40:"Matayo",41:"Mariko",42:"Luka",43:"Yohani",44:"Ivyakozwe",45:"Abaroma",46:"1 Abakorinto",47:"2 Abakorinto",48:"Abagalatiya",49:"Abanyefeso",50:"Abanyafilipi",51:"Abanyakolosi",52:"1 Abatesaloniki",53:"2 Abatesaloniki",54:"1 Timoteyo",55:"2 Timoteyo",56:"Tito",57:"Filemoni",58:"Abaheburayo",59:"Yakobo",60:"1 Petero",61:"2 Petero",62:"1 Yohani",63:"2 Yohani",64:"3 Yohani",65:"Yuda",66:"Ivyahishuwe"
      },
      kituba: {
        1:"luyantiku",2:"kubasika",3:"bileko",4:"kutanga",5:"munsiku",6:"Yozua",7:"bazuzi",8:"Ruti",9:"1 Samuele",10:"2 Samuele",11:"1 Bantotila",12:"2 Bantotila",13:"1 Bansangu",14:"2 Bansangu",15:"Ezdrasi",16:"Nehemi",17:"Estere",18:"Yobi",19:"Bankunga",20:"Bingana",21:"Mupangi",22:"Nkuunga",23:"Ezayi",24:"Yeremi",25:"Bidilo",26:"Ezekiele",27:"Daniele",28:"Ozea",29:"Yoele",30:"Amoze",31:"Obadia",32:"Yona",33:"Mika",34:"Nahumi",35:"Abakuku",36:"Sefania",37:"Agai",38:"Zakaria",39:"Malaki",40:"Matayo",41:"Marko",42:"Luka",43:"Yoane",44:"Bisalu",45:"Baloma",46:"1 Bakolinto",47:"2 Bakolinto",48:"Bagalatia",49:"Baefezo",50:"Bafilipi",51:"Bakoloze",52:"1 Batesalonika",53:"2 Batesalonika",54:"1 Timote",55:"2 Timote",56:"Tito",57:"Filemoni",58:"Baebreo",59:"Yakobo",60:"1 Piere",61:"2 Piere",62:"1 Yoane",63:"2 Yoane",64:"3 Yoane",65:"Yuda",66:"Kusonga"
      },
      konkani: {
        1:"ಉತ್ಪತ್ತಿ",2:"ನಿರ್ಗಮನ",3:"ಲೇವಿಯ",4:"ಗಣನೆ",5:"ಪುನರ್ನಿಮಯ",6:"ಯೆಹೋಶುವ",7:"ನ್ಯಾಯಾಧೀಶರು",8:"ರೂತಳು",9:"1 ಸಮುವೇಲ",10:"2 ಸಮುವೇಲ",11:"1 ರಾಜರು",12:"2 ರಾಜರು",13:"1 ಪೂರ್ವಕಾಲವೃತ್ತಾಂತ",14:"2 ಪೂರ್ವಕಾಲವೃತ್ತಾಂತ",15:"ಎಜ್ರ",16:"ನೆಹೆಮೀಯ",17:"ಎಸ್ತೇರಳು",18:"ಯೋಬ",19:"ಕೀರ್ತನೆಗಳು",20:"ಜ್ಞಾನೋಕ್ತಿಗಳು",21:"ಪ್ರಸಂಗಿ",22:"ಪರಮಗೀತೆ",23:"ಯೆಶಾಯ",24:"ಯೆರೆಮೀಯ",25:"ಪ್ರಲಾಪಗಳು",26:"ಎಜೆಕಿಯೇಲ",27:"ದಾನಿಯೇಲ",28:"ಹೋಶೇಯ",29:"ಯೋವೇಲ",30:"ಆಮೋಸ",31:"ಓಬದ್ಯ",32:"ಯೋನ",33:"ಮಿಕ",34:"ನಾಹೂಮ",35:"ಹಬಕ್ಕೂಕ",36:"ಚೆಫನ್ಯ",37:"ಹಗ್ಗಾಯ",38:"ಜೆಕರ್ಯ",39:"ಮಲಾಕಿಯ",40:"ಮತ್ತಾಯ",41:"ಮಾರ್ಕ",42:"ಲೂಕ",43:"ಯೋಹಾನ",44:"ಅಪೊಸ್ತಲರ ಕೃತ್ಯಗಳು",45:"ರೋಮನ್ನರಿಗೆ",46:"1 ಕೊರಿಂಥದವರಿಗೆ",47:"2 ಕೊರಿಂಥದವರಿಗೆ",48:"ಗಲಾತ್ಯದವರಿಗೆ",49:"ಎಫೆಸದವರಿಗೆ",50:"ಫಿಲಿಪ್ಪಿಯವರಿಗೆ",51:"ಕೊಲೊಸ್ಸೆಯವರಿಗೆ",52:"1 ತೆಸಲೋನಿಯದವರಿಗೆ",53:"2 ತೆಸಲೋನಿಯದವರಿಗೆ",54:"1 ತಿಮೊಥೇಯನಿಗೆ",55:"2 ತಿಮೊಥೇಯನಿಗೆ",56:"ತೀತನಿಗೆ",57:"ಫಿಲೆಮೋನನಿಗೆ",58:"ಇಬ್ರಿಯರಿಗೆ",59:"ಯಾಕೋಬ",60:"1 ಪೇತ್ರ",61:"2 ಪೇತ್ರ",62:"1 ಯೋಹಾನ",63:"2 ಯೋಹಾನ",64:"3 ಯೋಹಾನ",65:"ಯೂದ",66:"ಪ್ರಕಟಣೆ"
      },
      korean: {
        1:"창세기",2:"출애굽기",3:"레위기",4:"민수기",5:"신명기",6:"여호수아",7:"사사기",8:"룻기",9:"1 사무엘",10:"2 사무엘",11:"열왕기상",12:"열왕기하",13:"역대상",14:"역대하",15:"에스라",16:"느헤미야",17:"에스더",18:"욥기",19:"시편",20:"잠언",21:"전도도",22:"아가",23:"이사야",24:"예레미야",25:"예레미야 애가",26:"에스겔",27:"다니엘",28:"호세아",29:"요엘",30:"아모스",31:"오바댜",32:"요나",33:"미가",34:"나훔",35:"하박국",36:"스바냐",37:"학개",38:"스가랴",39:"말라기",40:"마태복음",41:"마가복음",42:"누가복음",43:"요한복음",44:"사도행전",45:"로마서",46:"고린도전서",47:"고린도후서",48:"갈라디아서",49:"에베소서",50:"빌립보서",51:"골로새서",52:"데살로니가전서",53:"데살로니가후서",54:"디모데전서",55:"디모데후서",56:"디도서",57:"빌레몬서",58:"히브리서",59:"야고보서",60:"베드로전서",61:"베드로후서",62:"요한1서",63:"요한2서",64:"요한3서",65:"유다서",66:"요한계시록"
      },
      koya: {
        1:"आदि",2:"निर्गमन",3:"लेव्य",4:"गणना",5:"नियम",6:"यहोशू",7:"न्यायि",8:"रूत",9:"1 समुएल",10:"2 समुएल",11:"1 राजा",12:"2 राजा",13:"1 इतिहास",14:"2 इतिहास",15:"एज्रा",16:"नहेमायाह",17:"एस्तेर",18:"अय्यूब",19:"भजन",20:"नीतिवचन",21:"सभोपदेसक",22:"श्रेष्ठगीत",23:"यशायाह",24:"यिर्मयाह",25:"रोना",26:"यहेजकेल",27:"दानिय्येल",28:"होसे",29:"योएल",30:"आमोस",31:"ओबद्याह",32:"योना",33:"मीका",34:"नहूम",35:"हबक्कूक",36:"सपन्याह",37:"हाग्गै",38:"जकर्याह",39:"मलाकी",40:"मत्ती",41:"मरकुस",42:"लूका",43:"यूहन्ना",44:"प्रेरित मन",45:"रोम",46:"1 कोरिन",47:"2 कोरिन",48:"गलतिया",49:"इफिसुस",50:"फिलिप्पी",51:"कुलुस्से",52:"1 थिस्स.",53:"2 थिस्स.",54:"तीमुथियुस",55:"तीमुथियुस",56:"तीतुस",57:"फिलेमोन",58:"इब्रानी",59:"याकूब",60:"1 पतरस",61:"2 पतरस",62:"1 यूहन्ना",63:"2 यूहन्ना",64:"3 यूहन्ना",65:"यहूदा",66:"प्रकाशितवाक्य"
      },
      krio: {
        1:"Jẹnɛsis",2:"Ɛksodɔs",3:"Lɛvitikɔs",4:"Nɔmbas",5:"Diutaranɔmi",6:"Jɔshua",7:"Jajiz",8:"Rut",9:"1 Samyɛl",10:"2 Samyɛl",11:"1 Kiŋ",12:"2 Kiŋ",13:"1 Kranikl",14:"2 Kranikl",15:"Ɛzra",16:"Niimaya",17:"Ɛsta",18:"Job",19:"Samz",20:"Prɔvabz",21:"Ɛkliziastiz",22:"Sɔŋ ɔv Sɔlɔmɔn",23:"Ayzaya",24:"Jɛrimaya",25:"Lamɛnteshɔnz",26:"Izikyɛl",27:"Danyɛl",28:"Ozia",29:"Juwɛl",30:"Emɔs",31:"Obadaya",32:"Jona",33:"Mayka",34:"Nehum",35:"Abakɔk",36:"Zɛfanya",37:"Agay",38:"Zɛkaraya",39:"Malakay",40:"Matyu",41:"Mak",42:"Luk",43:"Jɔn",44:"Akts",45:"Romanz",46:"1 Kɔrintyanz",47:"2 Kɔrintyanz",48:"Galieshanz",49:"Ifizhianz",50:"Filipyanz",51:"Kɔlɔshanz",52:"1 Tɛsalɔnyanz",53:"2 Tɛsalɔnyanz",54:"1 Timati",55:"2 Timati",56:"Taytɔs",57:"Filimɔn",58:"Hibriuz",59:"Jemz",60:"1 Pita",61:"2 Pita",62:"1 Jɔn",63:"2 Jɔn",64:"3 Jɔn",65:"Jud",66:"Rivilieshan"
      },
      kumaoni: {
        1:"उत्पत्ति",2:"निर्गमन",3:"लैव्यव्यवस्था",4:"गणना",5:"व्यवस्था",6:"यहोशू",7:"न्यायि",8:"रूत",9:"1 समुएल",10:"2 समुएल",11:"1 राजा",12:"2 राजा",13:"1 इतिहास",14:"2 इतिहास",15:"एज्रा",16:"नहेमायाह",17:"एस्तेर",18:"अय्यूब",19:"भजन",20:"नीतिवचन",21:"सभोपदेसक",22:"श्रेष्ठगीत",23:"यशायाह",24:"यिर्मयाह",25:"रोना",26:"यहेजकेल",27:"दानिय्येल",28:"होसे",29:"योएल",30:"आमोस",31:"ओबद्याह",32:"योना",33:"मीका",34:"नहूम",35:"हबक्कूक",36:"सपन्याह",37:"हाग्गै",38:"जकर्याह",39:"मलाकी",40:"मत्ती",41:"मरकुस",42:"लूका",43:"यूहन्ना",44:"प्रेरित मन",45:"रोम",46:"1 कोरिन",47:"2 कोरिन",48:"गलतिया",49:"इफिसुस",50:"फिलिप्पी",51:"कुलुस्से",52:"1 थिस्स.",53:"2 थिस्स.",54:"तीमुथियुस",55:"तीमुथियुस",56:"तीतुस",57:"फिलेमोन",58:"इब्रानी",59:"याकूब",60:"1 पतरस",61:"2 पतरस",62:"1 यूहन्ना",63:"2 यूहन्ना",64:"3 यूहन्ना",65:"यहूदा",66:"प्रकाशितवाक्य"
      },
      kurdish: {
        1:"Destpêkirin",2:"Derketin",3:"Lêviyan",4:"Hejmar",5:"Dubarekirina Yasayê",6:"Yeşû",7:"Dadweran",8:"Rût",9:"1 Samûêl",10:"2 Samûêl",11:"1 Padşayan",12:"2 Padşayan",13:"1 Dîrokan",14:"2 Dîrokan",15:"Ezrayê",16:"Nehemiya",17:"Ester",18:"Eyûb",19:"Zebûr",20:"Metelên Silêman",21:"Waîz",22:"Strana Stranan",23:"Yeşaya",24:"Yêremya",25:"Lorîn",26:"Hezekîl",27:"Danyal",28:"Hoşeya",29:"Yoêl",30:"Amos",31:"Obadyah",32:"Ûnis",33:"Mîka",34:"Nahûm",35:"Hebakûk",36:"Sêfanya",37:"Hegay",38:"Zekerya",39:"Melaxî",40:"Metta",41:"Marqos",42:"Lûqa",43:"Yûhenna",44:"Karên Şandiyan",45:"Romiyan",46:"1 Korintiyan",47:"2 Korintiyan",48:"Galatiyan",49:"Efesiyan",50:"Fîlîpiyan",51:"Kolosiyan",52:"1 Selanîkiyan",53:"2 Selanîkiyan",54:"1 Tîmotêyos",55:"2 Tîmotêyos",56:"Tîtos",57:"Filêmon",58:"Îbraniyan",59:"Yaqûb",60:"1 Petrûs",61:"2 Petrûs",62:"1 Yûhenna",63:"2 Yûhenna",64:"3 Yûhenna",65:"Yehûda",66:"Peyaxî"
      },
      kurukh: {
        1:"मुंध",2:"बाइसरना",3:"लेवी",4:"गनती",5:"नेम",6:"यहोशू",7:"नियाव",8:"रूत",9:"1 समुएल",10:"2 समुएल",11:"1 राजा",12:"2 राजा",13:"1 इतिहास",14:"2 इतिहास",15:"एज्रा",16:"नहेमायाह",17:"एस्तेर",18:"अय्यूब",19:"भजन",20:"नीतिवचन",21:"सभोपदेसक",22:"श्रेष्ठगीत",23:"यशायाह",24:"यिर्मयाह",25:"रोना",26:"यहेजकेल",27:"दानिय्येल",28:"होसे",29:"योएल",30:"आमोस",31:"ओबद्याह",32:"योना",33:"मीका",34:"नहूम",35:"हबक्कूक",36:"सपन्याह",37:"हाग्गै",38:"जकर्याह",39:"मलाकी",40:"मत्ती",41:"मरकुस",42:"लूका",43:"यूहन्ना",44:"प्रेरित मन",45:"रोम",46:"1 कोरिन",47:"2 कोरिन",48:"गलतिया",49:"इफिसुस",50:"फिलिप्पी",51:"कुलुस्से",52:"1 थिस्स.",53:"2 थिस्स.",54:"तीमुथियुस",55:"तीमुथियुस",56:"तीतुस",57:"फिलेमोन",58:"इब्रानी",59:"याकूब",60:"1 पतरस",61:"2 पतरस",62:"1 यूहन्ना",63:"2 यूहन्ना",64:"3 यूहन्ना",65:"यहूदा",66:"प्रकाशितवाक्य"
      },
      kyrgyz: {
        1:"Башталыш",2:"Мисырдан чыгуу",3:"Левилер",4:"Сандар",5:"Мыйзам кайталоо",6:"Ешуа",7:"Бийлер",8:"Рут",9:"1 Шемуел",10:"2 Шемуел",11:"1 Падышалар",12:"2 Падышалар",13:"1 Шежіре",14:"2 Шежіре",15:"Эзра",16:"Неемия",17:"Эстер",18:"Аюб",19:"Забур",20:"Нақыл сөздер",21:"Насиятчы",22:"Ырдын ыры",23:"Исаия",24:"Иеремия",25:"Иеремиянын ыйы",26:"Эзекиел",27:"Даниял",28:"Ошуя",29:"Жоел",30:"Амос",31:"Абади",32:"Жүніс",33:"Миха",34:"Нахум",35:"Хабақұқ",36:"Софония",37:"Аггей",38:"Закария",39:"Малахия",40:"Матай",41:"Марк",42:"Лука",43:"Жакан",44:"Элчилердин иштери",45:"Римдіктерге",46:"1 Қорынттықтарға",47:"2 Қорынттықтарға",48:"Ғалаттықтарға",49:"Ефестіктерге",50:"Філіпіліктерге",51:"Колостықтарға",52:"1 Салоникалықтарға",53:"2 Салоникалықтарға",54:"1 Тімотеге",55:"2 Тімотеге",56:"Титке",57:"Филемонға",58:"Еврейлерге",59:"Жақып",60:"1 Петір",61:"2 Петір",62:"1 Жохан",63:"2 Жохан",64:"3 Жохан",65:"Яһуда",66:"Аян"
      },
      lahu: {
        1:"Pi-yì-vẹ",2:"Taw-hpa-vẹ",3:"Le-wi-vẹ",4:"Gid-vẹ",5:"Taw-pa-vẹ",6:"Yo-su-ya-vẹ",7:"Ma-ti-vẹ",8:"Lu-te-vẹ",9:"1 Sa-mu-ela-vẹ",10:"2 Sa-mu-ela-vẹ",11:"1 Hk'o-vẹ",12:"2 Hk'o-vẹ",13:"1 Li-chi-vẹ",14:"2 Li-chi-vẹ",15:"E-sa-la-vẹ",16:"Ne-he-mi-vẹ",17:"E-sa-te-vẹ",18:"Yo-ba-vẹ",19:"To-vẹ",20:"Taw-vẹ",21:"Ca-vẹ",22:"Hk'aw-vẹ",23:"I-sa-ya-vẹ",24:"Ye-le-mi-vẹ",25:"Daw-vẹ",26:"E-se-ki-ya-vẹ",27:"Da-ni-ela-vẹ",28:"Ho-se-ya-vẹ",29:"Yo-ela-vẹ",30:"A-mo-se-vẹ",31:"O-ba-di-ya-vẹ",32:"Yo-na-vẹ",33:"Mi-ka-vẹ",34:"Na-hu-ma-vẹ",35:"Ha-ba-ku-vẹ",36:"Se-pa-ni-ya-vẹ",37:"Ha-gai-vẹ",38:"Sa-ka-li-ya-vẹ",39:"Ma-la-ki-vẹ",40:"Ma-tai-vẹ",41:"Ma-ko-vẹ",42:"Lu-ka-vẹ",43:"Yo-han-vẹ",44:"G'o-vẹ",45:"Lo-ma-vẹ",46:"1 Ko-li-to-vẹ",47:"2 Ko-li-to-vẹ",48:"Ka-la-ti-vẹ",49:"E-hpe-su-vẹ",50:"Hpi-li-pi-vẹ",51:"Ko-lo-se-vẹ",52:"1 Te-sa-lo-ni-ka",53:"2 Te-sa-lo-ni-ka",54:"1 Ti-mo-te-vẹ",55:"2 Ti-mo-te-vẹ",56:"Ti-tu-vẹ",57:"Pi-le-mo-vẹ",58:"He-pulu-vẹ",59:"Ya-ko-vẹ",60:"1 Pe-tu-lu-vẹ",61:"2 Pe-tu-lu-vẹ",62:"1 Yo-han-vẹ",63:"2 Yo-han-vẹ",64:"3 Yo-han-vẹ",65:"Yu-da-vẹ",66:"G'o-vẹ"
      },
      lambadi: {
        1:"उत्पत्ती",2:"निर्गमन",3:"लेव्यव्यवस्था",4:"गनती",5:"नियम",6:"यहोशू",7:"न्यायि",8:"रूत",9:"1 समुएल",10:"2 समुएल",11:"1 राजा",12:"2 राजा",13:"1 इतिहास",14:"2 इतिहास",15:"एज्रा",16:"नहेमायाह",17:"एस्तेर",18:"अय्यूब",19:"भजन",20:"नीतिवचन",21:"सभोपदेसक",22:"श्रेष्ठगीत",23:"यशायाह",24:"यिर्मयाह",25:"रोना",26:"यहेजकेल",27:"दानिय्येल",28:"होसे",29:"योएल",30:"आमोस",31:"ओबद्याह",32:"योना",33:"मीका",34:"नहूम",35:"हबक्कूक",36:"सपन्याह",37:"हाग्गै",38:"जकर्याह",39:"मलाकी",40:"मत्ती",41:"मरकुस",42:"लूका",43:"यूहन्ना",44:"प्रेरित मन",45:"रोम",46:"1 कोरिन",47:"2 कोरिन",48:"गलतिया",49:"इफिसुस",50:"फिलिप्पी",51:"कुलुस्से",52:"1 थिस्स.",53:"2 थिस्स.",54:"तीमुथियुस",55:"तीमुथियुस",56:"तीतुस",57:"फिलेमोन",58:"इब्रानी",59:"याकूब",60:"1 पतरस",61:"2 पतरस",62:"1 यूहन्ना",63:"2 यूहन्ना",64:"3 यूहन्ना",65:"यहूदा",66:"प्रकाशितवाक्य"
      },
      lango: {
        1:"Cakandit",2:"Wot",3:"Lebi",4:"Kwën",5:"Cik",6:"Jociua",7:"Okunykɔ̈ɔ̈k",8:"Rut",9:"1 Samuēl",10:"2 Samuēl",11:"1 Ker",12:"2 Ker",13:"1 Chronicles",14:"2 Chronicles",15:"Ɛdra",16:"Nɛyɛmiya",17:"Ɛstɛr",18:"Job",19:"Diɛt",20:"Pa pel",21:"Akueen",22:"Diɛt ke Jalamon",23:"Yisaya",24:"Jɛrimaya",25:"Thɔ̈ŋ",26:"Ɛsɛkiēl",27:"Danyēl",28:"Oseya",29:"Jowēl",30:"Amos",31:"Obadiya",32:"Jona",33:"Mika",34:"Nahum",35:"Habakuk",36:"Jɛpanya",37:"Hagai",38:"Jɛkaraya",39:"Malaki",40:"Matayo",41:"Maako",42:"Luka",43:"Jɔ̈n",44:"Luɔi",45:"Rom",46:"1 Korinto",47:"2 Korinto",48:"Galatia",49:"Ɛpɛjo",50:"Pilipi",51:"Koloje",52:"1 Tɛjalonika",53:"2 Tɛjalonika",54:"1 Timoti",55:"2 Timoti",56:"Tito",57:"Pilimɔn",58:"Ibru",59:"Jēmi",60:"1 Piɛr",61:"2 Piɛr",62:"1 Jɔ̈n",63:"2 Jɔ̈n",64:"3 Jɔ̈n",65:"Jūda",66:"Nyuth"
      },
      lao: {
        1:"ປະຖົມມະການ",2:"ອົບພະຍົບ",3:"ເລວີວິນຍານ",4:"ຈົດໝາຍເຫດ",5:"ພຣະທຳບັນຍັດ",6:"ໂຢຊວຍ",7:"ພວກຜູ້ນຳ",8:"ນາງຣຸດ",9:"1 ຊາມູເອນ",10:"2 ຊາມູເອນ",11:"1 ກະສັດ",12:"2 ກະສັດ",13:"1 ຂ່າວຄາວ",14:"2 ຂ່າວຄາວ",15:"ເອັດສະຣາ",16:"ເນເຫມີ",17:"ເອສະເທີ",18:"ໂຢບ",19:"ເພງສັນລະເສີນ",20:"ສຸພາສິດ",21:"ປັນຍາຈານ",22:"ເພງຊາໂລໂມນ",23:"ເອຊາຢາ",24:"ເຢເຣມີ",25:"ການຮ້ອງໄຫ້",26:"ເອເຊກຽນ",27:"ດານຽນ",28:"ໂຮເຊອາ",29:"ໂຢເອນ",30:"ອາໂມດ",31:"ໂອບາດີຢາ",32:"ໂຢນາ",33:"ມີກາ",34:"ນາຮູມ",35:"ຮາບາກຸກ",36:"ເຊຟານີຢາ",37:"ຮັດກາຍ",38:"ຊາກາຣີຢາ",39:"ມາລາກີ",40:"ມັດທາຍ",41:"ມາລະໂກ",42:"ລູກາ",43:"ໂຢຮັນ",44:"ກິດຈະການ",45:"ໂຣມ",46:"1 ໂກຣິນໂທ",47:"2 ໂກຣິນໂທ",48:"ຄະລາເຕຍ",49:"ເອເຟໂຊ",50:"ຟີລິບປອຍ",51:"ໂກໂລຊາຍ",52:"1 ເທຊະໂລນິກ",53:"2 ເທຊະໂລນິກ",54:"1 ຕີໂມທຽວ",55:"2 ຕີໂມທຽວ",56:"ຕີໂຕ",57:"ຟີເລໂມນ",58:"ເຮັບເຣີ",59:"ຢາໂກໂບ",60:"1 ເປໂຕ",61:"2 ເປໂຕ",62:"1 ໂຢຮັນ",63:"2 ໂຢຮັນ",64:"3 ໂຢຮັນ",65:"ຢູດາ",66:"ວິວອນ"
      },
      latin: {
        1:"Genesis",2:"Exodus",3:"Leviticus",4:"Numeri",5:"Deuteronomium",6:"Iosue",7:"Iudicum",8:"Ruth",9:"1 Samuelis",10:"2 Samuelis",11:"1 Regum",12:"2 Regum",13:"1 Paralipomenon",14:"2 Paralipomenon",15:"Esdrae",16:"Nehemiae",17:"Esther",18:"Iob",19:"Psalmi",20:"Proverbia",21:"Ecclesiastes",22:"Canticum Canticorum",23:"Isaias",24:"Ieremias",25:"Lamentationes",26:"Ezechiel",27:"Daniel",28:"Osee",29:"Ioel",30:"Amos",31:"Abdias",32:"Ionas",33:"Michaeas",34:"Nahum",35:"Habacuc",36:"Sophonias",37:"Aggaeus",38:"Zacharias",39:"Malachias",40:"Matthaeus",41:"Marcus",42:"Lucas",43:"Ioannes",44:"Actus Apostolorum",45:"Romanos",46:"1 Corinthios",47:"2 Corinthios",48:"Galatas",49:"Ephesios",50:"Philippenses",51:"Colossenses",52:"1 Thess.",53:"2 Thess.",54:"1 Timotheus",55:"2 Timotheus",56:"Titus",57:"Philemon",58:"Hebraeos",59:"Iacobus",60:"1 Petrus",61:"2 Petrus",62:"1 Ioannes",63:"2 Ioannes",64:"3 Ioannes",65:"Iudas",66:"Apocalypsis"
      },
      latvian: {
        1:"1. Mozus",2:"2. Mozus",3:"3. Mozus",4:"4. Mozus",5:"5. Mozus",6:"Jozuas",7:"Soģu",8:"Rutes",9:"1. Samuēla",10:"2. Samuēla",11:"1. Ķēniņu",12:"2. Ķēniņu",13:"1. Laiku",14:"2. Laiku",15:"Ezras",16:"Nehemijas",17:"Esteres",18:"Ījaba",19:"Psalmi",20:"Salamana pamācības",21:"Mācītājs",22:"Augstā dziesma",23:"Jesajas",24:"Jeremijas",25:"Raudu dziesmas",26:"Ecēhiēla",27:"Daniēla",28:"Hozejas",29:"Joēla",30:"Amosa",31:"Abdijas",32:"Jonas",33:"Mihas",34:"Nauma",35:"Habakuka",36:"Cefanjas",37:"Hagaja",38:"Zakarijas",39:"Malakijas",40:"Mateja",41:"Marka",42:"Lūkas",43:"Jāņa",44:"Apustuļu darbi",45:"Romiešiem",46:"1. Korintiešiem",47:"2. Korintiešiem",48:"Galatiešiem",49:"Efeziešiem",50:"Filipiešiem",51:"Kolosiešiem",52:"1. Tesaloniķiešiem",53:"2. Tesaloniķiešiem",54:"1. Timotejam",55:"2. Timotejam",56:"Titam",57:"Philemonam",58:"Ebrejiem",59:"Jēkaba",60:"1. Pētera",61:"2. Pētera",62:"1. Jāņa",63:"2. Jāņa",64:"3. Jāņa",65:"Jūdas",66:"Jāņa atklāsmes"
      },
      liberian_kreyol: {
        1:"Jɛnɛsis",2:"Ɛksodɔs",3:"Lɛvitikɔs",4:"Nɔmbas",5:"Diutarɔnɔmi",6:"Jɔshua",7:"Jajiz",8:"Rut",9:"1 Samyɛl",10:"2 Samyɛl",11:"1 Kiŋ",12:"2 Kiŋ",13:"1 Kranikl",14:"2 Kranikl",15:"Ɛzra",16:"Niimaya",17:"Ɛsta",18:"Job",19:"Samz",20:"Prɔvabz",21:"Ɛkliziastiz",22:"Sɔŋ ɔv Sɔlɔmɔn",23:"Ayzaya",24:"Jɛrimaya",25:"Lamɛnteshɔnz",26:"Izikyɛl",27:"Danyɛl",28:"Ozia",29:"Juwɛl",30:"Emɔs",31:"Obadaya",32:"Jona",33:"Mayka",34:"Nehum",35:"Abakɔk",36:"Zɛfanya",37:"Agay",38:"Zɛkaraya",39:"Malakay",40:"Matyu",41:"Mak",42:"Luk",43:"Jɔn",44:"Akts",45:"Romanz",46:"1 Korintyanz",47:"2 Korintyanz",48:"Galieshanz",49:"Ifizhianz",50:"Filipyanz",51:"Kalooshanz",52:"1 Tesaluonyanz",53:"2 Tesaluonyanz",54:"1 Timati",55:"2 Timati",56:"Taytɔs",57:"Filimɔn",58:"Hibriuz",59:"Jemz",60:"1 Piita",61:"2 Piita",62:"1 Jan",63:"2 Jan",64:"3 Jan",65:"Juud",66:"Rivilieshan"
      },
      lingala: {
        1:"Genese",2:"Kobima",3:"Levitike",4:"Mitángo",5:"Kolimbola Mibeko",6:"Yozua",7:"Basambisi",8:"Ruta",9:"1 Samuele",10:"2 Samuele",11:"1 Bakonzi",12:"2 Bakonzi",13:"1 Ntango",14:"2 Ntango",15:"Ezera",16:"Nehemia",17:"Estere",18:"Yobo",19:"Nzembo",20:"Masese",21:"Mosakoli",22:"Loyembo la Bayembo",23:"Yisaya",24:"Yeremia",25:"Bileli",26:"Ezekiele",27:"Daniele",28:"Ozea",29:"Yoele",30:"Amoze",31:"Obadia",32:"Yona",33:"Mika",34:"Nahumu",35:"Abakuku",36:"Sefania",37:"Hagai",38:"Zakaria",39:"Malaki",40:"Matai",41:"Marko",42:"Luka",43:"Yoane",44:"Misala",45:"Baloma",46:"1 Bakolinto",47:"2 Bakolinto",48:"Bagalatia",49:"Baefezo",50:"Bafilipi",51:"Bakoloze",52:"1 Batesalonika",53:"2 Batesalonika",54:"1 Timote",55:"2 Timote",56:"Tito",57:"Filemoni",58:"Baebreo",59:"Yakobo",60:"1 Petro",61:"2 Petro",62:"1 Yoane",63:"2 Yoane",64:"3 Yoane",65:"Yuda",66:"Emoniseli"
      },
      lithuanian: {
        1:"Pradžios",2:"Išėjimo",3:"Kunigų",4:"Skaičių",5:"Pakartoto Įstatymo",6:"Jozujės",7:"Teisėjų",8:"Rūtos",9:"1 Samuelio",10:"2 Samuelio",11:"1 Karalių",12:"2 Karalių",13:"1 Metraščių",14:"2 Metraščių",15:"Ezros",16:"Nehemijo",17:"Esteros",18:"Jovo",19:"Psalmių",20:"Patarlių",21:"Koheleto",22:"Giesmių giesmė",23:"Izaijo",24:"Jeremijo",25:"Raudų",26:"Ezechielio",27:"Danielio",28:"Ozėjo",29:"Joelio",30:"Amoso",31:"Abdijo",32:"Jonos",33:"Michėjo",34:"Nahumo",35:"Habakuko",36:"Sofonijo",37:"Agėjo",38:"Zacharijo",39:"Malachijo",40:"Mato",41:"Morko",42:"Luko",43:"Jono",44:"Apaštalų darbai",45:"Romiečiams",46:"1 Korintiečiams",47:"2 Korintiečiams",48:"Galatams",49:"Efeziečiams",50:"Filipiečiams",51:"Kolosiečiams",52:"1 Tesalonikiečiams",53:"2 Tesalonikiečiams",54:"1 Timotiejui",55:"2 Timotiejui",56:"Titui",57:"Filemonui",58:"Hebrajams",59:"Jokūbo",60:"1 Petro",61:"2 Petro",62:"1 Jono",63:"2 Jono",64:"3 Jono",65:"Judo",66:"Apreiškimo"
      },
      lomwe: {
        1:"Maphattu",2:"Okhuma",3:"Aléwi",4:"Namani",5:"Malamulo",6:"Joxua",7:"Atxhuli",8:"Ruti",9:"1 Samuweli",10:"2 Samuweli",11:"1 Mamwene",12:"2 Mamwene",13:"1 Sanchu",14:"2 Sanchu",15:"Ezira",16:"Nehemiya",17:"Estere",18:"Jobi",19:"Isalamu",20:"Miruku",21:"Namalaliha",22:"Ncipo",23:"Isaiya",24:"Yeremiya",25:"Onlekha",26:"Ezekiyeli",27:"Daniyeli",28:"Oseya",29:"Yoweli",30:"Amozi",31:"Obadiya",32:"Yona",33:"Miya",34:"Nahumi",35:"Abakuku",36:"Sefaniya",37:"Agai",38:"Zakariya",39:"Malakiya",40:"Matayo",41:"Marko",42:"Luka",43:"Yohane",44:"Sanchu",45:"Aroma",46:"1 Akorinto",47:"2 Akorinto",48:"Agalatia",49:"Aefeso",50:"Afilipi",51:"Akoloze",52:"1 Atesalonika",53:"2 Atesalonika",54:"1 Timoteo",55:"2 Timoteo",56:"Tito",57:"Filemoni",58:"Ahebri",59:"Tiago",60:"1 Pedro",61:"2 Pedro",62:"1 Yohane",63:"2 Yohane",64:"3 Yohane",65:"Yuda",66:"Ovuhuleli"
      },
      luganda: {
        1:"Olubereberye",2:"Okuva",3:"Ebyaleevi",4:"Okubala",5:"Ekyamateeka",6:"Yosuwa",7:"Abalamuzi",8:"Luusi",9:"1 Samwiri",10:"2 Samwiri",11:"1 Bassekabaka",12:"2 Bassekabaka",13:"1 Ebyomumirembe",14:"2 Ebyomumirembe",15:"Ezera",16:"Neemiya",17:"Esita",18:"Yobu",19:"Zabbuli",20:"Engero",21:"Omubuulizi",22:"Oluyimba lwa Sulemaani",23:"Isaaya",24:"Yeremiya",25:"Okukaba",26:"Ezekyeri",27:"Danyeri",28:"Koseya",29:"Yoweri",30:"Amosi",31:"Obadiya",32:"Yona",33:"Mika",34:"Nahumu",35:"Xabakuku",36:"Sefaniya",37:"Haggayi",38:"Zekkariya",39:"Malaki",40:"Matayo",41:"Mako",42:"Lukka",43:"Yokaana",44:"Ebikolwa by'Abatume",45:"Abarumi",46:"1 Abakkolinto",47:"2 Abakkolinto",48:"Abagalatiya",49:"Abayefeso",50:"Abafilippi",51:"Abakkolosayi",52:"1 Abattessalonika",53:"2 Abattessalonika",54:"1 Timuseeyo",55:"2 Timuseeyo",56:"Tito",57:"Firemooni",58:"Abahebburaayo",59:"Yakobo",60:"1 Peetero",61:"2 Peetero",62:"1 Yokaana",63:"2 Yokaana",64:"3 Yokaana",65:"Yuda",66:"Okubikkulirwa"
      },
      lugbara: {
        1:"E’do",2:"Anyapa",3:"Lawi",4:"Tara",5:"Aziza",6:"Yosua",7:"O’dukpî",8:"Rutu",9:"1 Samuele",10:"2 Samuele",11:"1 Amvî",12:"2 Amvî",13:"1 Atatapi",14:"2 Atatapi",15:"Ezira",16:"Nehemiya",17:"Esitera",18:"Yobu",19:"Zaburi",20:"Ezaza",21:"Omulasî",22:"Wiiri",23:"Isaya",24:"Yeremiya",25:"Adi’du",26:"Ezekiele",27:"Daniele",28:"Ozea",29:"Yoele",30:"Amoze",31:"Obadia",32:"Yona",33:"Mika",34:"Nahumi",35:"Abakuku",36:"Sefania",37:"Agai",38:"Zakaria",39:"Malaki",40:"Matayo",41:"Marko",42:"Luka",43:"Yoane",44:"Lizi",45:"Aroma",46:"1 Bakorinto",47:"2 Bakorinto",48:"Bagalatia",49:"Baefezo",50:"Bafilipi",51:"Bakoloze",52:"1 Batesalonika",53:"2 Batesalonika",54:"1 Timoteo",55:"2 Timoteo",56:"Tito",57:"Filemoni",58:"Baebreo",59:"Yakobo",60:"1 Piere",61:"2 Piere",62:"1 Yoane",63:"2 Yoane",64:"2 Yoane",65:"Yuda",66:"Azaza"
      },
      luguru: {
        1:"Mwandu",2:"Kulawa",3:"Walawi",4:"Kumanza",5:"Malajilizo",6:"Yoshua",7:"Owalubanza",8:"Rutu",9:"1 Samweli",10:"2 Samweli",11:"1 Wandewa",12:"2 Wandewa",13:"1 Mbuli",14:"2 Mbuli",15:"Ezila",16:"Nehemiya",17:"Esita",18:"Yobu",19:"Izabuli",20:"Lukumbuluko",21:"Mhuvya",22:"Luwimbo",23:"Isaya",24:"Yeremiya",25:"Malilo",26:"Ezekiyeli",27:"Danyeli",28:"Hoseya",29:"Yoeli",30:"Amosi",31:"Obadiya",32:"Yona",33:"Mika",34:"Nahumu",35:"Habakuku",36:"Sefaniya",37:"Hagayi",38:"Zakariya",39:"Malaki",40:"Matayo",41:"Maluko",42:"Luka",43:"Yohana",44:"Matendo",45:"Warumi",46:"1 Wakolinto",47:"2 Wakolinto",48:"Wagalatiya",49:"Waefeso",50:"Wafilipi",51:"Wakolose",52:"1 Watessalonika",53:"2 Watessalonika",54:"1 Timoteo",55:"2 Timoteo",56:"Tito",57:"Filemon",58:"Waheburaayo",59:"Yakobo",60:"1 Petero",61:"2 Petero",62:"1 Yohana",63:"2 Yohana",64:"3 Yohana",65:"Yuda",66:"Ugubulo"
      },
      luo: {
        1:"Chakruok",2:"Wuok",3:"Leawi",4:"Kwan",5:"Ng’atueny",6:"Joshua",7:"Jung’",8:"Rut",9:"1 Samuel",10:"2 Samuel",11:"1 Ruodhi",12:"2 Ruodhi",13:"1 Weche",14:"2 Weche",15:"Ezra",16:"Nehemia",17:"Esta",18:"Ayub",19:"Zaburi",20:"Ngeche",21:"Japuonj",22:"Wer",23:"Isaya",24:"Jeremia",25:"Yuagruok",26:"Ezekiel",27:"Daniel",28:"Hosea",29:"Joel",30:"Amos",31:"Obadia",32:"Jona",33:"Mika",34:"Nahum",35:"Habakuk",36:"Zefania",37:"Hagai",38:"Zekaria",39:"Malaki",40:"Mathayo",41:"Mariko",42:"Luka",43:"Johana",44:"Tich",45:"Jo-Rumi",46:"1 Jo-Korinto",47:"2 Jo-Korinto",48:"Jo-Galatia",49:"Jo-Efeso",50:"Jo-Filipi",51:"Jo-Kolosai",52:"1 Jo-Thesalonika",53:"2 Jo-Thesalonika",54:"1 Timoteo",55:"2 Timoteo",56:"Tito",57:"Filemon",58:"Jo-Hibrania",59:"Jakobo",60:"1 Petro",61:"2 Petro",62:"1 Johana",63:"2 Johana",64:"3 Johana",65:"Juda",66:"Fweny"
      },
      maasai: {
        1:"Enkitunoto",2:"Enkuenata",3:"Inkitanot e Lewi",4:"Iititai",5:"Inkitanot nabo",6:"Joshua",7:"Ilaiguak",8:"Rut",9:"1 Samuel",10:"2 Samuel",11:"1 Ilaiguak",12:"2 Ilaiguak",13:"1 Chronicles",14:"2 Chronicles",15:"Ezra",16:"Nehemiah",17:"Esther",18:"Job",19:"Isalmuni",20:"Proverbs",21:"Ecclesiastes",22:"Song of Solomon",23:"Isaiah",24:"Jeremiah",25:"Lamentations",26:"Ezekiel",27:"Daniel",28:"Hosea",29:"Joel",30:"Amos",31:"Obadiah",32:"Jonah",33:"Micah",34:"Nahum",35:"Habakkuk",36:"Zephaniah",37:"Haggai",38:"Zechariah",39:"Malachi",40:"Matthew",41:"Mark",42:"Luke",43:"John",44:"Acts",45:"Romans",46:"1 Cor.",47:"2 Cor.",48:"Galatians",49:"Ephesians",50:"Philippians",51:"Colossians",52:"1 Thess.",53:"2 Thess.",54:"1 Timothy",55:"2 Timothy",56:"Titus",57:"Philemon",58:"Hebrews",59:"James",60:"1 Peter",61:"2 Peter",62:"1 John",63:"2 John",64:"3 John",65:"Jude",66:"Revelation"
      },
      macedonian: {
        1:"Битие",2:"Исход",3:"Левит",4:"Броеви",5:"Втора книга Мојсеева",6:"Исус Навин",7:"Судии",8:"Рут",9:"1 Самоил",10:"2 Самоил",11:"1 Цареви",12:"2 Цареви",13:"1 Летописи",14:"2 Летописи",15:"Ездра",16:"Неемија",17:"Естира",18:"Јов",19:"Псалми",20:"Пословици",21:"Проповедник",22:"Песна над песните",23:"Исаија",24:"Еремија",25:"Плачот на Еремија",26:"Езекиел",27:"Даниел",28:"Осија",29:"Јоил",30:"Амос",31:"Авдиј",32:"Јона",33:"Михеј",34:"Наум",35:"Авакум",36:"Софонија",37:"Агеј",38:"Захарија",39:"Малахија",40:"Матеј",41:"Марко",42:"Лука",43:"Јован",44:"Дела",45:"Римјаните",46:"1 Коринтјаните",47:"2 Коринтјаните",48:"Галатјаните",49:"Ефесјаните",50:"Филипјаните",51:"Колошаните",52:"1 Солуњаните",53:"2 Солуњаните",54:"1 Тимотеј",55:"2 Тимотеј",56:"Тит",57:"Филемон",58:"Евреите",59:"Јаков",60:"1 Петар",61:"2 Петар",62:"1 Јованово",63:"2 Јованово",64:"3 Јованово",65:"Јуда",66:"Откровение"
      },
      madurese: {
        1:"Kadaddiyan",2:"Kaloaran",3:"Kaimaman",4:"Itongan",5:"Onlang",6:"Yusak",7:"Para Hakim",8:"Rut",9:"1 Samuel",10:"2 Samuel",11:"1 Para Raja",12:"2 Para Raja",13:"1 Babad",14:"2 Babad",15:"Ezra",16:"Nehemia",17:"Ester",18:"Ayub",19:"Jabur",20:"Kebiyasan",21:"Juru Khotbah",22:"Kidung Agung",23:"Yesaya",24:"Yeremia",25:"Pasambat",26:"Yehezkiel",27:"Daniel",28:"Hosea",29:"Yoel",30:"Amos",31:"Obaja",32:"Yunus",33:"Mikha",34:"Nahum",35:"Habakuk",36:"Zefanya",37:"Hagai",38:"Zakharia",39:"Maleakhi",40:"Matius",41:"Markus",42:"Lukas",43:"Yohanes",44:"Lakon",45:"Roma",46:"1 Korintus",47:"2 Korintus",48:"Galati",49:"Efesus",50:"Filipi",51:"Kolose",52:"1 Tesalonika",53:"2 Tesalonika",54:"1 Timotius",55:"2 Timotius",56:"Titus",57:"Filemon",58:"Ibrani",59:"Yakobus",60:"1 Petrus",61:"2 Petrus",62:"1 Yohanes",63:"2 Yohanes",64:"3 Yohanes",65:"Yudas",66:"Wahyu"
      },
      maithili: {
        1:"उत्पत्ति",2:"निर्गमन",3:"लैव्यव्यवस्था",4:"गणना",5:"व्यवस्था",6:"यहोशू",7:"न्यायि",8:"रूत",9:"1 समुएल",10:"2 समुएल",11:"1 राजा",12:"2 राजा",13:"1 इतिहास",14:"2 इतिहास",15:"एज्रा",16:"नहेमायाह",17:"एस्तेर",18:"अय्यूब",19:"भजन",20:"नीतिवचन",21:"सभोपदेसक",22:"श्रेष्ठगीत",23:"यशायाह",24:"यिर्मयाह",25:"रोना",26:"यहेजकेल",27:"दानिय्येल",28:"होसे",29:"योएल",30:"आमोस",31:"ओबद्याह",32:"योना",33:"मीका",34:"नहूम",35:"हबक्कूक",36:"सपन्याह",37:"हाग्गै",38:"जकर्याह",39:"मलाकी",40:"मत्ती",41:"मरकुस",42:"लूका",43:"यूहन्ना",44:"प्रेरित मन",45:"रोमियों",46:"1 कुरिन्थियों",47:"2 कुरिन्थियों",48:"गलातियों",49:"इफिसियों",50:"फिलिप्पियों",51:"कुलुस्सियों",52:"1 थिस्स.",53:"2 थिस्स.",54:"तीमुथियुस",55:"तीमुथियुस",56:"तीतुस",57:"फिलेमोन",58:"इब्रानियों",59:"याकूब",60:"1 पतरस",61:"2 पतरस",62:"1 यूहन्ना",63:"2 यूहन्ना",64:"3 यूहन्ना",65:"यहूदा",66:"प्रकाशितवाक्य"
      },
      makhuwa: {
        1:"Maphattu",2:"Okhuma",3:"Aléwi",4:"Namani",5:"Malamulo",6:"Joxua",7:"Atxhuli",8:"Ruti",9:"1 Samuweli",10:"2 Samuweli",11:"1 Mamwene",12:"2 Mamwene",13:"1 Sanchu",14:"2 Sanchu",15:"Ezira",16:"Nehemiya",17:"Estere",18:"Jobi",19:"Isalamu",20:"Miruku",21:"Namalaliha",22:"Ncipo",23:"Isaiya",24:"Yeremiya",25:"Onlekha",26:"Ezekiyeli",27:"Daniyeli",28:"Oseya",29:"Yoweli",30:"Amozi",31:"Obadiya",32:"Yona",33:"Miya",34:"Nahumi",35:"Abakuku",36:"Sefaniya",37:"Agai",38:"Zakariya",39:"Malakiya",40:"Matayo",41:"Marko",42:"Luka",43:"Yohane",44:"Sanchu",45:"Aroma",46:"1 Akorinto",47:"2 Akorinto",48:"Agalatia",49:"Aefeso",50:"Afilipi",51:"Akoloze",52:"1 Atesalonika",53:"2 Atesalonika",54:"1 Timoteo",55:"2 Timoteo",56:"Tito",57:"Filemoni",58:"Ahebri",59:"Tiago",60:"1 Pedro",61:"2 Pedro",62:"1 Yohane",63:"2 Yohane",64:"3 Yohane",65:"Yuda",66:"Ovuhuleli"
      },
      makonde: {
        1:"Kutundupia",2:"Kulawa",3:"Walawi",4:"Kumanza",5:"Malajilizo",6:"Yoshua",7:"Owalubanza",8:"Rutu",9:"1 Samweli",10:"2 Samweli",11:"1 Wandewa",12:"2 Wandewa",13:"1 Mbuli",14:"2 Mbuli",15:"Ezila",16:"Nehemiya",17:"Esita",18:"Yobu",19:"Izabuli",20:"Lukumbuluko",21:"Mhuvya",22:"Luwimbo",23:"Isaya",24:"Yeremiya",25:"Malilo",26:"Ezekiyeli",27:"Danyeli",28:"Hoseya",29:"Yoeli",30:"Amosi",31:"Obadiya",32:"Yona",33:"Mika",34:"Nahumu",35:"Habakuku",36:"Sefaniya",37:"Hagayi",38:"Zakariya",39:"Malaki",40:"Matayo",41:"Maluko",42:"Luka",43:"Yohana",44:"Matendo",45:"Warumi",46:"1 Wakolinto",47:"2 Wakolinto",48:"Wagalatiya",49:"Waefeso",50:"Wafilipi",51:"Wakolose",52:"1 Watessalonika",53:"2 Watessalonika",54:"1 Timoteo",55:"2 Timoteo",56:"Tito",57:"Filemon",58:"Waheburaayo",59:"Yakobo",60:"1 Petero",61:"2 Petero",62:"1 Yohana",63:"2 Yohana",64:"3 Yohana",65:"Yuda",66:"Ugubulo"
      },
      malagasy: {
        1:"Genesisy",2:"Eksodosy",3:"Levitikosy",4:"Nomery",5:"Deteronomia",6:"Josoa",7:"Mpitsara",8:"Rota",9:"1 Samoela",10:"2 Samoela",11:"1 Mpanjaka",12:"2 Mpanjaka",13:"1 Tantara",14:"2 Tantara",15:"Ezra",16:"Nehemia",17:"Estera",18:"Joba",19:"Salamo",20:"Ohabolana",21:"Mpitoriteny",22:"Tononkiran'i Solomona",23:"Isaiya",24:"Jeremia",25:"Fitomaniana",26:"Ezekiela",27:"Daniela",28:"Hosea",29:"Joela",30:"Amosa",31:"Obadia",32:"Jona",33:"Mika",34:"Nahoma",35:"Habakoka",36:"Zefania",37:"Hagai",38:"Zakaria",39:"Malakia",40:"Matio",41:"Marka",42:"Lioka",43:"Jaona",44:"Asan'ny Apostoly",45:"Romana",46:"1 Korintiana",47:"2 Korintiana",48:"Galatiana",49:"Efesiana",50:"Filipiana",51:"Kolosiana",52:"1 Tesaloniana",53:"2 Tesaloniana",54:"1 Timoty",55:"2 Timoty",56:"Tita",57:"Filemona",58:"Hebreo",59:"Jakoba",60:"1 Petera",61:"2 Petera",62:"1 Jaona",63:"2 Jaona",64:"3 Jaona",65:"Joda",66:"Apokalypsy"
      },
      malayalam: {
        1:"ഉല്പത്തി",2:"പുറപ്പാട്",3:"ലേവ്യപുസ്തകം",4:"സംഖ്യാപുസ്തകം",5:"ആവർത്തനപുസ്തകം",6:"യോശുവ",7:"ന്യായാധിപന്മാർ",8:"രൂത്ത്",9:"1 ശമൂവേൽ",10:"2 ശമൂവേൽ",11:"1 രാജാക്കന്മാർ",12:"2 രാജാക്കന്മാർ",13:"1 ദിനവൃത്താന്തം",14:"2 ദിനവൃത്താന്തം",15:"എസ്രാ",16:"നെഹെമ്യാവ്",17:"എസ്ഥേർ",18:"ഇയ്യോബ്",19:"സങ്കീർത്തനങ്ങൾ",20:"സദൃശവാക്യങ്ങൾ",21:"സഭാപ്രസംഗി",22:"ഉത്തമഗീതം",23:"യെശയ്യാവ്",24:"യിരേമ്യാവ്",25:"വിലാപങ്ങൾ",26:"യെഹെസ്കേൽ",27:"ദാനിയേൽ",28:"ഹോശേയ",29:"യോവേൽ",30:"ആമോസ്",31:"ഓബദ്യാവ്",32:"യോന",33:"മീഖാ",34:"നഹൂം",35:"ഹബക്കൂക്",36:"സെഫന്യാവ്",37:"ഹഗ്ഗായി",38:"സെഖര്യാവ്",39:"മലാഖി",40:"മത്തായി",41:"മർക്കോസ്",42:"ലൂക്കോസ്",43:"യോഹന്നാൻ",44:"അപ്പൊസ്തലന്മാരുടെ പ്രവൃത്തികൾ",45:"റോമർക്ക് എഴുതിയ ലേഖനം",46:"1 കൊരിന്ത്യർ",47:"2 കൊരിന്ത്യർ",48:"ഗലാത്യർ",49:"എഫെസ്യർ",50:"ഫിലിപ്പിയർ",51:"കൊലോസ്യർ",52:"1 തെസ്സലോനീക്യർ",53:"2 തെസ്സലോനീക്യർ",54:"1 തിമൊഥെയൊസ്",55:"2 തിമൊഥെയൊസ്",56:"തീത്തൊസ്",57:"ഫിലേമോൻ",58:"എബ്രായർ",59:"യാക്കോബ്",60:"1 പത്രോസ്",61:"2 പത്രോസ്",62:"1 യോഹന്നാൻ",63:"2 യോഹന്നാൻ",64:"3 യോഹന്നാൻ",65:"യൂദാ",66:"വെളിപ്പാട്"
      },
      malaysian: {
        1:"Kejadian",2:"Keluaran",3:"Imamat",4:"Bilangan",5:"Ulangan",6:"Yosua",7:"Hakim-hakim",8:"Rut",9:"1 Samuel",10:"2 Samuel",11:"1 Raja-raja",12:"2 Raja-raja",13:"1 Tawarikh",14:"2 Tawarikh",15:"Ezra",16:"Nehemia",17:"Ester",18:"Ayub",19:"Mazmur",20:"Amsal",21:"Pengkhotbah",22:"Kidung Agung",23:"Yesaya",24:"Yeremia",25:"Ratapan",26:"Yehezkiel",27:"Daniel",28:"Hosea",29:"Yoel",30:"Amos",31:"Obaja",32:"Yunus",33:"Mikha",34:"Nahum",35:"Habakuk",36:"Zefanya",37:"Hagai",38:"Zakharia",39:"Maleakhi",40:"Matius",41:"Markus",42:"Lukas",43:"Yohanes",44:"Kisah Para Rasul",45:"Roma",46:"1 Korintus",47:"2 Korintus",48:"Galatia",49:"Efesus",50:"Filipi",51:"Kolose",52:"1 Tesalonika",53:"2 Tesalonika",54:"1 Timotius",55:"2 Timotius",56:"Titus",57:"Filemon",58:"Ibrani",59:"Yakobus",60:"1 Petrus",61:"2 Petrus",62:"1 Yohanes",63:"2 Yohanes",64:"3 Yohanes",65:"Yudas",66:"Wahyu"
      },
      maori: {
        1:"Kenehi",2:"Ekoruhe",3:"Rewitiku",4:"Tauanga",5:"Tiuteronomi",6:"Hoshua",7:"Kaiwhakawa",8:"Rutu",9:"1 Hamuera",10:"2 Hamuera",11:"1 Nga Kingi",12:"2 Nga Kingi",13:"1 Nga Whakapapa",14:"2 Nga Whakapapa",15:"Etera",16:"Nehemia",17:"Ehetera",18:"Hopa",19:"Nga Waiata",20:"Nga Whakatauki",21:"Te Kaikauwhau",22:"Te Waiata a Horomona",23:"Ihaia",24:"Heremaia",25:"Nga Tangi",26:"Ehekiera",27:"Raniera",28:"Hotea",29:"Hoera",30:"Amoho",31:"Opadia",32:"Hona",33:"Mika",34:"Nahumu",35:"Hapaku",36:"Tepataya",37:"Hakai",38:"Tekaria",39:"Maraki",40:"Mataio",41:"Maka",42:"Ruka",43:"Hoani",44:"Nga Mahi",45:"Roma",46:"1 Koriniti",47:"2 Koriniti",48:"Karatia",49:"Epeha",50:"Piripi",51:"Korohi",52:"1 Teharonika",53:"2 Teharonika",54:"1 Timoti",55:"2 Timoti",56:"Taitu",57:"Piremona",58:"Hiperu",59:"Hemi",60:"1 Pita",61:"2 Pita",62:"1 Hoani",63:"2 Hoani",64:"3 Hoani",65:"Hura",66:"Whakakitenga"
      },
      marathi: buildTranslationMap(`
उत्पत्ति
निर्गमन
लेवीय
गणना
अनुवादा
यहोशू
शास्त्रकर्ते
रूथ
1 शमुवेल
2 शमुवेल
1 राजे
2 राजे
1 इतिहास
2 इतिहास
एज़्रा
नहेम्या
एस्तेर
ईयोब
स्तोत्रसंहिता
नीतिसूत्रे
उपदेशक
गीतरत्न
यशया
यिर्मया
विलापगीत
यहेज्केल
दानीएल
होशे
योएल
आमोस
ओबद्या
योना
मीखा
नहूम
हबक्कूक
सफन्या
हाग्गय
जखऱ्या
मलाखी
मत्तय
मार्क
लूक
योहान
प्रेषितांची कृत्ये
रोमांस पत्र
1 करिंथकरांस
2 करिंथकरांस
गलतीकरांस
इफिसकरांस
फिलिप्पैकरांस
कलस्सैकरांस
1 थिस्सलो.
2 थिस्सलो.
1 तीमथ्य
2 तीमथ्य
तीत
फिलेमोन
इब्री लोकांस
याकोब
1 पेत्र
2 पेत्र
1 योहान
2 योहान
3 योहान
यहूदा
प्रकटीकरण
      `),
      marwari: buildTranslationMap(`
उत्पत्ति
निर्गमन
लेवीय
गणना
अनुवादा
यहोशू
न्यायि
रूत
1 समुएल
2 समुएल
1 राजा
2 राजा
1 इतिहास
2 इतिहास
एज़्रा
नहेमायाह
एस्तेर
अय्यूब
भजन
नीतिवचन
सभोपदेसक
श्रेष्ठगीत
यशायाह
यिर्मयाह
रोना
यहेजकेल
दानिय्येल
होसे
योएल
आमोस
ओबद्याह
योना
मीका
नहूम
हबक्कूक
सपन्याह
हाग्गै
जकर्याह
मलाकी
मत्ती
मरकुस
लूका
यूहन्ना
प्रेरित मन
रोमियों
1 कुरिन्थियों
2 कुरिन्थियों
गलातियों
इफिसियों
फिलिप्पियों
कुलुस्सियों
1 थिस्स.
2 थिस्स.
तीमुथियुस
तीमुथियुस
तीतुस
फिलेमोन
इब्रानियों
याकूब
1 पतरस
2 पतरस
1 यूहन्ना
2 यूहन्ना
3 यूहन्ना
यहूदा
प्रकाशितवाक्य
      `),
      marshallese: buildTranslationMap(`
Jeneris
Kōmālij
Livi
Bōnbōn
Diteronome
Josua
Ri-Ekaj
Rut
1 Samuel
2 Samuel
1 Kiiñ
2 Kiiñ
1 Kronikel
2 Kronikel
Esra
Nehaimaya
Esitɛr
Job
Jabōñ
Jabōnkōnnaan
Ekklisiastis
Al an Solomon
Aiseia
Jeremaia
Liaajlool
Esikiel
Daniel
Hoseia
Joel
Amos
Obadia
Jona
Maika
Nahum
Habakkuk
Zephanaia
Haggai
Sekaraia
Malakai
Matu
Mark
Luk
Jon
Jerbal ko an Ri-jilkaler
Rom
1 Korint
2 Korint
Galesia
Epesōs
Pilipai
Kolosse
1 Tessalonika
2 Tessalonika
1 Timote
2 Timote
Taitōs
Pilemōn
Hibru
Jemes
1 Piter
2 Piter
1 Jon
2 Jon
3 Jon
Juut
Revelatōn
      `),
      mauritian_creole: buildTranslationMap(`
Zenez
Exod
Levitik
Nonm
Deteronóm
Zoze
Ziz
Rit
1 Samyel
2 Samyel
1 Lerwa
2 Lerwa
1 Kronik
2 Kronik
Ezra
Neemi
Ester
Zob
Psom
Proverb
Eklezyast
Kantik
Izayi
Zeremi
Lamantasyon
Ezekyel
Danyel
Oze
Zoel
Amos
Obadya
Zona
Mika
Naoum
Abakik
Sofoni
Aze
Zakari
Malaki
Matye
Mark
Lik
Zan
Akt
Romin
1 Korintyin
2 Korintyin
Galat
Efezyin
Filipyin
Kolozyin
1 Tesalonisyen
2 Tesalonisyen
1 Timote
2 Timote
Tit
Filémon
Ebre
Zak
1 Pier
2 Pier
1 Zan
2 Zan
3 Zan
Zid
Revelasyon
      `),
      mazanderani: buildTranslationMap(`
آفرینش
خروج
لاویان
اعداد
تثنیه
یوشع
داوران
روت
۱ ساموئل
۲ ساموئल
۱ پادشاهان
۲ پادشاهان
۱ تواریخ
۲ تواریخ
عزرا
نحمیا
استر
ایوب
مزامیر
ाथल
جامعه
غزل غزل‌ها
اشعیا
ارمیا
مراثی
حزقیال
دانیال
هوشع
یوئیل
عاموس
عوبدیا
یونس
میکا
ناحوم
حبقوق
صفنیا
حجی
زکریا
ملاکی
متی
مرقس
لوقا
یوحنا
اعمال رسولان
رومیان
۱ قرنتیان
۲ قرنتیان
غلاطیان
افسسیان
فیلیپیان
کولسیان
۱ تسالونیکیان
۲ تسالونیکیان
۱ تیموتائوس
۲ تیموتائوس
تیطوس
فلیمون
عبرانیان
یعقوب
۱ پطرس
۲ پطرس
۱ یوحنا
۲ یوحنا
३ यوحना
یهودا
مکاشفه
      `),
      meitei: buildTranslationMap(`
मपे़थो़कपा
थो़कपा
लेविको़
मशिं पाबा
नियम
यहोशू
न्यायि
रूत
1 समुएल
2 समुएल
1 निंथौ
2 निंथौ
1 इतिहास
2 इतिहास
एज्रा
नहेमायाह
एस्तेर
अय्यूब
भजन
नीतिवचन
सभोपदेसक
श्रेष्ठगीत
यशायाह
यिर्मयाह
विलाप
यहेजकेल
दानिय्येल
होसे
योएल
आमोस
ओबद्याह
योना
मीका
नहूम
हबक्कूक
सपन्याह
हाग्गै
जकर्याह
मलाकी
मत्ती
मरकुस
लूका
यूहन्ना
प्रेरित मन
रोमियों
1 कोरिन्थी
2 कोरिन्थी
गलातिय
इफेसिय
फिलिपिय
कोलुसिय
1 थिस्सलोनिकी
2 थिस्सलोनिकी
1 तिमोथी
2 तिमोथी
तीत
फिलेमोन
इब्री
याकूब
1 पे़त्रु
2 पे़त्रु
1 यूहन्ना
2 यूहन्ना
3 यूहन्ना
यहूदा
मशा़य़ोकपा
      `),
      mende: buildTranslationMap(`
Ndoke-yila
Lewu-hinda
Livi
Nɔmba
Ditulɔnɔmi
Jɔsua
Jajia
Ruuti
1 Samyɛ
2 Samyɛ
1 Kiŋ
2 Kiŋ
1 Krɔnikul
2 Krɔnikul
Ɛsra
Neimaya
Ɛsta
Joobu
Saam
Prɔvab
Ɛklisiastis
Sɔŋ ɔf Sɔlɔmɔn
Ayizaya
Jɛlimaya
Lamɛnteshɔn
Izikyɛ
Danyɛ
Ozia
Juwɛ
Emɔs
Obadaya
Jona
Maika
Nehum
Abakɔk
Zɛfanya
Agai
Zɛkaraya
Malakai
Matyu
Maaki
Luuki
Jɔŋ
Akt
Romu
1 Kɔlintian
2 Kɔlintian
Galeshan
Efizhan
Filipyan
Kɔlɔshan
1 Tɛsalɔnian
2 Tɛsalɔnian
1 Timɔti
2 Timɔti
Taitɔs
Filimɔn
Hibru
Jems
1 Piita
2 Piita
1 Jaŋ
2 Jaŋ
3 Jaŋ
Juud
Rivilɛshɔn
      `),
      meru: buildTranslationMap(`
Kiamiriria
Kuma
Alawi
Atalo
Gucokeerithia
Joshua
Atuiiri
Rutu
1 Samuele
2 Samuele
1 Athamaki
2 Athamaki
1 Mauhoro
2 Mauhoro
Ezira
Nehemia
Esita
Ayubu
Thaburi
Thimo
Kohelethu
Rwimbo
Isaia
Jeremia
Macakaya
Ezekieli
Danieli
Hosea
Joeli
Amosi
Obadia
Jona
Mika
Nahumu
Habakuku
Sefania
Hagai
Zakaria
Malaki
Mathayo
Mariko
Luka
Johana
Atumwo
Aroma
1 Akorinto
2 Akorinto
Agalatia
Aefeso
Afilipi
Akolosai
1 Atesalonike
2 Atesalonike
1 Timotheo
2 Timotheo
Tito
Filemona
Ahibirania
Jakubu
1 Petero
2 Petero
1 Johana
2 Johana
3 Johana
Juda
Kuguuririo
      `),
      msl: buildTranslationMap(`
[Génesis]
[Éxodo]
[Levítico]
[Números]
[Deuteronomio]
[Josué]
[Jueces]
[Rut]
[1 Samuel]
[2 Samuel]
[1 Reyes]
[2 Reyes]
[1 Crónicas]
[2 Crónicas]
[Esdras]
[Nehemías]
[Ester]
[Job]
[Salmos]
[Proverbios]
[Eclesiastés]
[Cantar de los Cantares]
[Isaías]
[Jeremías]
[Lamentaciones]
[Ezequiel]
[Daniel]
[Oseas]
[Joel]
[Amós]
[Abdías]
[Jonás]
[Miqueas]
[Nahúm]
[Habacuc]
[Sofonías]
[Hageo]
[Zacarías]
[Malaquías]
[Mateo]
[Marcos]
[Lucas]
[Juan]
[Hechos]
[Romanos]
[1 Corintios]
[2 Corintios]
[Gálatas]
[Efesios]
[Filipenses]
[Colosenses]
[1 Tesalonicenses]
[2 Tesalonicenses]
[1 Timoteo]
[2 Timoteo]
[Tito]
[Filemón]
[Hebreos]
[Santiago]
[1 Pedro]
[2 Pedro]
[1 Juan]
[2 Juan]
[3 Juan]
[Judas]
[Apocalipsis]
      `),
      minangkabau: buildTranslationMap(`
Kejadian
Keluaran
Imamat
Bilangan
Ulangan
Yosua
Hakim-hakim
Rut
1 Samuel
2 Samuel
1 Raja-raja
2 Raja-raja
1 Tawarikh
2 Tawarikh
Ezra
Nehemia
Ester
Ayub
Mazmur
Amsal
Pengkhotbah
Kidung Agung
Yesaya
Yeremia
Ratapan
Yehezkiel
Daniel
Hosea
Yoel
Amos
Obaja
Yunus
Mikha
Nahum
Habakuk
Zefanya
Hagai
Zakharia
Maleakhi
Matius
Markus
Lukas
Yohanes
Kisah Para Rasul
Roma
1 Korintus
2 Korintus
Galatia
Efesus
Filipi
Kolose
1 Tesalonika
2 Tesalonika
1 Timotius
2 Timotius
Titus
Filemon
Ibrani
Yakobus
1 Petrus
2 Petrus
1 Yohanes
2 Yohanes
3 Yohanes
Yudas
Wahyu
      `),
      miskito: buildTranslationMap(`
Jɛnɛsis
Ɛksodɔs
Lɛvitikɔs
Nɔmbas
Diutarɔnɔmi
Jɔshua
Jajiz
Rut
1 Samyɛl
2 Samyɛl
1 Kiŋ
2 Kiŋ
1 Kranikl
2 Kranikl
Ɛzra
Niimaya
Ɛsta
Job
Samz
Prɔvabz
Ɛkliziastiz
Sɔŋ ɔv Sɔlɔmɔn
Ayzaya
Jɛrimaya
Lamɛnteshɔnz
Izikyɛl
Danyɛl
Ozia
Juwɛl
Emɔs
Obadaya
Jona
Mayka
Nehum
Habakuk
Zɛfanya
Agay
Zɛkaraya
Malakay
Matyu
Maak
Luuk
Jan
Akts
Ruomanz
1 Korintyanz
2 Korintyanz
Galieshanz
Ifizhianz
Filipyanz
Kalooshanz
1 Tesaluonyanz
2 Tesaluonyanz
1 Timati
2 Timati
Taitas
Filimuon
Hiibruuz
Jiemz
1 Piita
2 Piita
1 Jan
2 Jan
3 Jan
Juud
Rivilieshan
      `),
      mixtec: buildTranslationMap(`
Jenesis
Éxodo
Levítico
Números
Deuteronomio
Josué
Jueces
Rut
1 Samuel
2 Samuel
1 Reyes
2 Reyes
1 Crónicas
2 Chronicles
Esdras
Nehemías
Ester
Job
Salmos
Proverbios
Eclesiastés
Cantares
Isaías
Jeremías
Lamentaciones
Ezequiel
Daniel
Oseas
Joel
Amós
Abdías
Jonás
Miqueas
Nahúm
Habacuc
Sofonías
Hageo
Zacarías
Malaquías
Mateo
Marcos
Lucas
Juan
Hechos
Romanos
1 Corintios
2 Corintios
Gálatas
Efesios
Filipenses
Colosenses
1 Tesalonicenses
2 Tesalonicenses
1 Timoteo
2 Timoteo
Tito
Filemón
Hebreos
Santiago
1 Pedro
2 Pedro
1 Juan
2 Juan
3 Juan
Judas
Apocalipsis
      `),
      moore: buildTranslationMap(`
Sinsingre
Yikr-n-beo
Levitiko
Soolm-koɛɛga
Moise Taga
Zozue
Buge-rãmba
Rut
1 Samüɛll
2 Samüɛll
1 Rãmbã
2 Rãmbã
1 Tõre
2 Tõre
Esdras
Nehemi
Estɛɛr
Zoob
Yila
Yel-bũn-yɛɛga
Koe-moanda
Yila-yila
Ezayi
Zeremi
Zeremi nanda
Ezekiyɛll
Daniyɛll
Oze
Zoɛll
Amɔos
Abdiyase
Zonas
Mise
Nahũm
Habakuk
Sofoni
Aze
Zakari
Malaki
Matye
Mark
Luk
Za
Tuma
Rom dãmba
1 Korɛnt dãmba
2 Korɛnt dãmba
Galat dãmba
Efɛɛz dãmba
Filip dãmba
Kolos dãmba
1 Tesalonik dãmba
2 Tesalonik dãmba
1 Timote
2 Timote
Tit
Filemo
Ebre dãmba
Zak
1 Piɛɛr
2 Piɛɛr
1 Za
2 Za
3 Za
Zid
Vẽenego
      `),
      more: buildTranslationMap(`
Sinsingre
Yikr-n-beo
Levitiko
Soolm-koɛɛga
Moise Taga
Zozue
Buge-rãmba
Rut
1 Samüɛll
2 Samüɛll
1 Rãmbã
2 Rãmbã
1 Tõre
2 Tõre
Esdras
Nehemi
Estɛɛr
Zoob
Yila
Yel-bũn-yɛɛga
Koe-moanda
Yila-yila
Ezayi
Zeremi
Zeremi nanda
Ezekiyɛll
Daniyɛll
Oze
Zoɛll
Amɔos
Abdiyase
Zonas
Mise
Nahũm
Habakuk
Sofoni
Aze
Zakari
Malaki
Matye
Mark
Luk
Za
Tuma
Rom dãmba
1 Korɛnt dãmba
2 Korɛnt dãmba
Galat dãmba
Efɛɛz dãmba
Filip dãmba
Kolos dãmba
1 Tesalonik dãmba
2 Tesalonik dãmba
1 Timote
2 Timote
Tit
Filemo
Ebre dãmba
Zak
1 Piɛɛr
2 Piɛɛr
1 Za
2 Za
3 Za
Zid
Vẽenego
      `),
      mortlockese: buildTranslationMap(`
Poputáá
Towu
Lefitiko
Ámwa
Teuteronomi
Josua
Sounkapung
Rut
1 Samuel
2 Samuel
1 King
2 King
1 Kronikel
2 Kronikel
Esra
Nehaimaia
Ester
Jope
Kölfel
Pworaferp
Eklisiastis
Kölfelun Solomon
Aiseia
Jereimaya
Lamantasion
Esikiel
Taniel
Osea
Joel
Amos
Obadaia
Jona
Maika
Nahum
Apakuk
Sapania
Hakai
Sekaraia
Malakai
Mateus
Markus
Lukas
Jone
Fofun
Rom
1 Korint
2 Korint
Kalesia
Efisus
Filipai
Kolose
1 Tesalonika
2 Tesalonika
1 Timoti
2 Timoti
Titus
Filemon
Iperu
Jeims
1 Piter
2 Piter
1 Jone
2 Jone
3 Jone
Jute
Pwarata
      `),
      motu: buildTranslationMap(`
Genese
Esodo
Levitiko
Numera
Deuteronomio
Iosua
Hahediba taudia
Ruta
1 Samuela
2 Samuela
1 Hanua Pavapavana
2 Hanua Pavapavana
1 Sivarai
2 Sivarai
Esera
Nehemia
Estera
Iobu
Salamo
Hereva Lada-dae
Koheleta
Solomon ena Ane
Isaia
Ieremia
Ieremia ena Tai Ane
Esekihela
Daniela
Hosea
Ioela
Amosa
Obadia
Iona
Mika
Nahuma
Habakuku
Sefania
Hagai
Sakaria
Malaki
Mataio
Mareko
Luka
Ioane
Kara
Roma
1 Korinto
2 Korinto
Galatia
Efeso
Filipi
Kolose
1 Tesalonika
2 Tesalonika
1 Timoteo
2 Timoteo
Tito
Filemona
Heberu
Iakobo
1 Petero
2 Petero
1 Ioane
2 Ioane
3 Ioane
Iuda
Matahania
      `),
      mundari: buildTranslationMap(`
एते
बइसिरना
लेवी
गनती
नियम
यहोशू
नियाव
रूत
1 समुएल
2 समुएल
1 राजा
2 राजा
1 इतिहास
2 इतिहास
एज्रा
नहेमायाह
एस्तेर
अय्यूब
भजन
नीतिवचन
सभोपदेसक
श्रेष्ठगीत
यशायाह
यिर्मयाह
रोना
यहेजकेल
दानिय्येल
होसे
योएल
आमोस
ओबद्याह
योना
मीका
नहूम
हबक्कूक
सपन्याह
हाग्गै
जकर्याह
मलाकी
मत्ती
मरकुस
लूका
यूहन्ना
प्रेरित मन
रोमियों
1 कोरिन
2 कोरिन
गलतिया
इफिसुस
फिलिप्पी
कुलुस्से
1 थिस्स.
2 थिस्स.
तीमुथियुस
तीमुथियुस
तीतुस
फिलेमोन
इब्रानी
याकूब
1 पतरस
2 पतरस
1 यूहन्ना
2 यूहन्ना
3 यूहन्ना
यहूदा
प्रकाशितवाक्य
      `),
      mushunguli: buildTranslationMap(`
Mwandu
Kulawa
Walawi
Kumanza
Malajilizo
Yoshua
Owalubanza
Rutu
1 Samweli
2 Samweli
1 Wandewa
2 Wandewa
1 Mbuli
2 Mbuli
Ezila
Nehemiya
Esita
Yobu
Izabuli
Lukumbuluko
Mhuvya
Luwimbo
Isaya
Yeremiya
Malilo
Ezekiyeli
Danyeli
Hoseya
Yoeli
Amosi
Obadiya
Yona
Mika
Nahumu
Habakuku
Sefaniya
Hagayi
Zakariya
Malaki
Matayo
Mariko
Luka
Yohana
Matendo
Warumi
1 Wakolinto
2 Wakolinto
Wagalatiya
Waefeso
Wafilipi
Wakolose
1 Watessalonika
2 Watessalonika
1 Timoteo
2 Timoteo
Tito
Filemoni
Waheburaayo
Yakobo
1 Petero
2 Petero
1 Yohana
2 Yohana
3 Yohana
Yuda
Ugubulo
      `),
      myanmar: buildTranslationMap(`
ကမ္ဘာဦးကျမ်း
ထွက်မြောက်ရာကျမ်း
ဝတ်ပြုရာကျမ်း
တောလည်ရာကျမ်း
တရားဟောရာကျမ်း
ယောရှုမှတ်စာ
သူကြီးမှတ်စာ
ရုသဝတ္ထု
၁ ရာဇဝင်ချုပ်
၂ ရာဇဝင်ချုပ်
၃ ရာဇဝင်ချုပ်
၄ ရာဇဝင်ချုပ်
၅ ရာဇဝင်ချုပ်
၆ ရာဇဝင်ချုပ်
ဧဇရမှတ်စာ
နေဟမိမှတ်စာ
ဧသတာဝတ္ထု
ယောဘဝတ္ထု
ဆာလံကျမ်း
သုတ္တံကျမ်း
ဒေသနာကျမ်း
ရှောလမုန်သီချင်း
ဟေရှာယအနာဂတ္တိကျမ်း
ယေရမိအနာဂတ္တိကျမ်း
ယေရမိညည်းတွားရာကျမ်း
ယေဇကျေလအနာဂတ္တိကျမ်း
ဒံယေလအနာဂတ္တိကျမ်း
ဟောရှေအနာဂတ္တိကျမ်း
ယောလအနာဂတ္တိကျမ်း
အာမုတ်အနာဂတ္တိကျမ်း
ဩဗဒိအနာဂတ္တိကျမ်း
ယောနဝတ္ထု
မိက္ခာအနာဂတ္တိကျမ်း
နာဟုံအနာဂတ္တိကျမ်း
ဟဗက္ကုတ်အနာဂတ္တိကျမ်း
ဇေဖနိအနာဂတ္တိကျမ်း
ဟဂ္ဂဲအနာဂတ္တိကျမ်း
ဇာခရိအနာဂတ္တိကျမ်း
မာလခိအနာဂတ္တိကျမ်း
မဿဲခရစ်ဝင်
မာကုခရစ်ဝင်
လုကာခရစ်ဝင်
ယောဟန်ခရစ်ဝင်
တမန်တော်ဝတ္ထု
ရောမဩဝါဒစာ
၁ ကောရိန္တု
၂ ကောရိန္တု
ဂလာတိဩဝါဒစာ
ဧဖက်ဩဝါဒစာ
ဖိလိပ္ပိဩဝါဒစာ
ကောလောသဲဩဝါဒစာ
၁ သက်သာလောနိတ်
၂ သက်သာလောနိတ်
၁ တိမောသေ
၂ တိမောသေ
တိတုဩဝါဒစာ
ဖိလေမုန်ဩဝါဒစာ
ဟေဗြဲဩဝါဒစာ
ယာကုပ်ဩဝါဒစာ
၁ ပေတရု
၂ ပေတရု
၁ ယောဟန်
၂ ယောဟန်
၃ ယောဟန်
ယုဒဩဝါဒစာ
ဗျာဒိတ်ကျမ်း
      `),
      nama: buildTranslationMap(`
Gana-is
!Hu-is
Lewi-is
!An-is
2-!Hu-is
Josua-is
ǁGaikon
Rut-is
1 Samuel-is
2 Samuel-is
1 Gaon
2 Gaon
1 !An-is
2 !An-is
Esra-is
Nehemia-is
Ester-is
Job-is
ǁKhara-is
ǂAn-is
ǁGamba-is
ǁKhoe-ǁae
Jesaia-is
Jeremia-is
ǁKhara-is
Eseki-el-is
Daniel-is
Hosea-is
Joel-is
Amos-is
Obadia-is
Jona-is
Mika-is
Nahum-is
Habakuk-is
Sefania-is
Hagai-is
Sakaria-is
Malaki-is
Mate-is
Marku-is
Luka-is
Joha-is
!An-di
Rom-ǁîga
1 Korinti-ǁîga
2 Korinti-ǁîga
Galati-ǁîga
Efesi-ǁîga
Filipi-ǁîga
Kolosi-ǁîga
1 Tesaloniki-ǁîga
2 Tesaloniki-ǁîga
1 Timote-is
2 Timote-is
Titu-is
Filemon-is
Hebr-ǁîga
Jakobu-is
1 Petru-is
2 Petru-is
1 Joha-is
2 Joha-is
3 Joha-is
Juda-is
ǁGamba-is
      `),
      nauruan: buildTranslationMap(`
Genesis
Exodus
Leviticus
Numeri
Deuteronomium
Joshua
Judges
Ruth
1 Samuel
2 Samuel
1 Kings
2 Kings
1 Chronicles
2 Chronicles
Ezra
Nehemiah
Esther
Job
Psalms
Proverbs
Ecclesiastes
Song of Solomon
Isaiah
Jeremiah
Lamentations
Ezekiel
Daniel
Hosea
Joel
Amos
Obadiah
Jonah
Micah
Nahum
Habakkuk
Zephaniah
Haggai
Zechariah
Malachi
Matthew
Mark
Luke
John
Acts
Romans
1 Corinthians
2 Corinthians
Galatians
Ephesians
Philippians
Colossians
1 Thess.
2 Thess.
1 Timothy
2 Timothy
Titus
Philemon
Hebrews
James
1 Peter
2 Peter
1 John
2 John
3 John
Jude
Revelation
      `),
      ndau: buildTranslationMap(`
Genesisi
Eksodo
Levitiko
Numero
Deuteronomio
Joshua
Atongi
Ruti
1 Samueli
2 Samueli
1 Madzimambo
2 Madzimambo
1 Kronike
2 Kronike
Ezira
Nehemiya
Estere
Jobo
Mapisarema
Zvirevo
Muparidzi
Rwiyo rwa Soromona
Isaya
Jeremiya
Marisire
Ezekieri
Danieli
Hosea
Joeri
Amosi
Obadiya
Jona
Mika
Nahumu
Habakuku
Sefaniya
Hagayi
Zakariya
Maraki
Mateu
Marko
Ruka
Johani
Mabasa
Varoma
1 Vakorinde
2 Vakorinde
Agalatiya
Vaefeso
Vafilipi
Vakolosi
1 Vatesaronika
2 Vatesaronika
1 Timoti
2 Timoti
Tito
Firemoni
Vaheberi
Jakobo
1 Pedro
2 Pedro
1 Johani
2 Johani
3 Johani
Juda
Kupangidzwa
      `),
      ndonga: buildTranslationMap(`
Genesis
Eksodus
Levitikus
Numeri
Deuteronomium
Josua
Aatokoladhi
Rut
1 Samuel
2 Samuel
1 Aakwaniilwa
2 Aakwaniilwa
1 Ondjokonona
2 Ondjokonona
Esra
Nehemia
Ester
Job
Episalmi
Omayeletumbulo
Omuuvithi
Eimbilo lyoomaimbilo
Jesaya
Jeremia
Omanyanyuku
Hesekiel
Daniel
Hosea
Joel
Amos
Obadia
Jona
Mika
Nahum
Habakuk
Sefanja
Hagai
Sakaria
Malaki
Mateus
Markus
Lukas
Johannes
Iilonga
Aroma
1 Aakorinto
2 Aakorinto
Agalati
Aaefeso
Aafilipi
Aakolosi
1 Aatesalonika
2 Aatesalonika
1 Timoteus
2 Timoteus
Titus
Filemon
Aaheberi
Jakob
1 Petrus
2 Petrus
1 Johannes
2 Johannes
3 Johannes
Judas
Ehololo
      `),
      nepali: buildTranslationMap(`
उत्पत्ति
निर्गमन
लेवी
गन्ती
व्यवस्था
यहोशू
न्यायकर्ता
रूथ
1 समुएल
2 समुएल
1 राजा
2 राजा
1 इतिहास
2 इतिहास
एज्रा
नहेम्याह
एस्तर
अय्यूब
भजनसंग्रह
हितोपदेश
उपदेशक
श्रेष्ठ गीत
यशैया
यर्मिया
विलाप
इजकिएल
दानिएल
होसे
योएल
आमोस
ओबदिया
योना
मीका
नहूम
हबकूक
सपन्याह
हाग्गै
जकरिया
मलाकी
मत्ती
मर्कूस
लूका
यूहन्ना
प्रेरित
रोमी
1 कोरिन्थी
2 कोरिन्थी
गलाती
एफिसी
फिलिप्पी
कलस्सी
1 थिस्स.
2 थिस्स.
1 तिमोथी
2 तिमोथी
तीतस
फिलेमोन
हिब्रू
याकूब
1 पत्रुस
2 पत्रुस
1 यूहन्ना
2 यूहन्ना
3 यूहन्ना
यहूदा
प्रकाश
      `),
      ngambay: buildTranslationMap(`
Ngon-kunjí
Njé-mbe-kunjí
Lèbe
Ma-kunjí
Ngon-mbe-kunjí
Josue
Gumbá-kunjí
Rut
1 Samuel
2 Samuel
1 Ngon-mbe-lá
2 Ngon-mbe-lá
1 Njé-mbe-ndatâ
2 Njé-mbe-ndatâ
Esdra
Nehemi
Ester
Job
Ngon-yèl
Kâ-mbe-ndatâ
Labá-mbe-ndatâ
Yèl-ndatâ
Ezayi
Jeremi
Kunjí-gá
Ezekyel
Daniel
Oze
Joel
Amos
Abdyas
Jona
Mise
Nahum
Abakuk
Sofoni
Aze
Zakari
Malaki
Matye
Mark
Luk
Za
Ma-lá
Rom
1 Korent
2 Korent
Galat
Efez
Filip
Kolos
1 Tesalonik
2 Tesalonik
1 Timote
2 Timote
Tit
Filemo
Ebre
Zak
1 Piyer
2 Piyer
1 Za
2 Za
3 Za
Zid
Vẽenego
      `),
      nigerian_pidgin: buildTranslationMap(`
Genesis
Exodus
Leviticus
Numbers
Deuteronomy
Joshua
Judges
Ruth
1 Samuel
2 Samuel
1 Kings
2 Kings
1 Chronicles
2 Chronicles
Ezra
Nehemiah
Esther
Job
Psalms
Proverbs
Ecclesiastes
Song of Solomon
Isaiah
Jeremiah
Lamentations
Ezekiel
Daniel
Hosea
Joel
Amos
Obadiah
Jonah
Micah
Nahum
Habakkuk
Zephaniah
Haggai
Zechariah
Malachi
Matthew
Mark
Luke
John
Acts
Romans
1 Corinthians
2 Corinthians
Galatians
Ephesians
Philippians
Colossians
1 Thess.
2 Thess.
1 Timothy
2 Timothy
Titus
Philemon
Hebrews
James
1 Peter
2 Peter
1 John
2 John
3 John
Jude
Revelation
      `),
      niuean: buildTranslationMap(`
Kenese
Esoto
Levitiko
Numera
Teuteronome
Iosua
Tau Fakafili
Ruta
1 Samuela
2 Samuela
1 Tau Patuiki
2 Tau Patuiki
1 fakamauaga
2 fakamauaga
Esera
Nehemia
Eseta
Iopu
Salamo
Tau Fakatai
Koheleta
Lologo a Solomona
Isaia
Ieremia
Tau Tagi
Esekiela
Taniela
Hosea
Ioelu
Amosa
Opadia
Iona
Mika
Nahuma
Apakuka
Sefania
Hakai
Sakaria
Malaki
Mataio
Mareko
Luka
Ioane
Gahua he Tau Fakafili
Roma
1 Korinito
2 Korinito
Kalatia
Efeso
Filipi
Kolose
1 Tesalonika
2 Tesalonika
1 Timoteo
2 Timoteo
Tito
Filemona
Heperu
Iakopo
1 Peteru
2 Peteru
1 Ioane
2 Ioane
3 Ioane
Iuda
Fakakiteaga
      `),
      northern_sotho: buildTranslationMap(`
Genesi
Eksodo
Lefitiko
Dinomoro
Duteronome
Josua
Baahloli
Rute
1 Samuele
2 Samuele
1 Dikgoši
2 Dikgoši
1 Ditiragalo
2 Ditiragalo
Esra
Nehemia
Estere
Jobo
Dipsalme
Diema
Moreri
Koša ya Dikoša
Jesaya
Jeremia
Sellolane
Hesekiele
Daniele
Hosea
Joele
Amose
Obadia
Jona
Mika
Nahuma
Habakuku
Sefanya
Hagai
Sakaria
Malakia
Mateo
Mareko
Luka
Johane
Ditiro
Baroma
1 Bakorinte
2 Bakorinte
Bagalatia
Baefeso
Bafilipi
Bakolose
1 Batesalonika
2 Batesalonika
1 Timotheo
2 Timotheo
Tito
Filemone
Baheberu
Jakobo
1 Petro
2 Petro
1 Johane
2 Johane
3 Johane
Juda
Tshenolo
      `),
      norwegian: buildTranslationMap(`
1. Mosebok
2. Mosebok
3. Mosebok
4. Mosebok
5. Mosebok
Josva
Dommerne
Rut
1. Samuel
2. Samuel
1. Kongebok
2. Kongebok
1. Krønikebok
2. Krønikebok
Esra
Nehemia
Ester
Job
Salmene
Ordspråkene
Forkynneren
Høysangen
Jesaja
Jeremia
Klagesangene
Esekiel
Daniel
Hosea
Joel
Amos
Obadja
Jona
Mika
Nahum
Habakkuk
Sefanja
Haggai
Sakarja
Malaki
Matteus
Markus
Lukas
Johannes
Apostlenes gjerninger
Romerne
1. Korinter
2. Korinter
Galaterne
Efeserne
Filipperne
Kolosserne
1. Tessaloniker
2. Tessaloniker
1. Timoteus
2. Timoteus
Titus
Filemon
Hebreerne
Jakob
1. Peter
2. Peter
1. Johannes
2. Johannes
3. Johannes
Judas
Åpenbaringen
      `),
      nyanja: buildTranslationMap(`
Genesis
Eksodo
Levitiko
Numeri
Deuteronomo
Joshua
Oweruza
Ruti
1 Samuel
2 Samuel
1 Mafumu
2 Mafumu
1 Mbiri
2 Mbiri
Ezara
Nehemiya
Estere
Yobu
Masalmo
Miyambo
Mlaliki
Nyimbo za Solomo
Yesaya
Yeremiya
Maliro
Ezekieli
Danieli
Hoseya
Yoeli
Amosi
Obadiya
Yona
Mika
Nahumu
Habakuku
Sefaniya
Hagai
Zekariya
Malaki
Mateyu
Marko
Luka
Yohane
Machitidwe
Aroma
1 Akorinto
2 Akorinto
Agalatiya
Aefeso
Afilipi
Akolose
1 Atesalonika
2 Atesalonika
1 Timoteo
2 Timoteo
Tito
Filemoni
Ahebri
Yakobo
1 Petro
2 Petro
1 Yohane
2 Yohane
3 Yohane
Yuda
Chivumbulutso
      `),
      nyankore: buildTranslationMap(`
Okutandika
Okuruga
Abaleevi
Okubara
Okugarukamu
Yoshua
Abacwi b'emanja
Ruusi
1 Samwiri
2 Samwiri
1 Abagabe
2 Abagabe
1 Eby'emitsyo
2 Eby'emitsyo
Ezera
Nehemiya
Esita
Yobu
Zaburi
Enfumu
Omubuurizi
Rwimbo rwa Sulemaani
Isaya
Yeremiya
Okucura
Ezekieri
Danieli
Hosea
Yoeli
Amosi
Obadiya
Yona
Mika
Nahumu
Habakuku
Sefaniya
Hagai
Zakariya
Malaki
Matayo
Mariko
Luka
Yohana
Ebikorwa
Abarooma
1 Abakorinto
2 Abakorinto
Abagalatia
Abaefeso
Abafilipi
Abakolosai
1 Abatesalonika
2 Abatesalonika
1 Timoteo
2 Timoteo
Tito
Filemooni
Abaheburaayo
Yakobo
1 Petero
2 Petero
1 Yohana
2 Yohana
3 Yohana
Yuda
Okushuuruurwa
      `),
      nyoro: buildTranslationMap(`
Okutandika
Okuruga
Abaleevi
Okubara
Okugarukamu
Yoshua
Abacwi b'emanja
Ruusi
1 Samwiri
2 Samwiri
1 Abakama
2 Abakama
1 Ebyafayo
2 Ebyafayo
Ezera
Nehemiya
Esita
Yobu
Zaburi
Enfumu
Omutezi w'enfumu
Rwimbo rwa Sulemani
Isaya
Yeremiya
Okucura
Ezekieri
Danieli
Hosea
Yoeli
Amosi
Obadiya
Yona
Mika
Nahumu
Habakuku
Sefaniya
Hagai
Zakariya
Malaki
Matayo
Mariko
Luka
Yohana
Ebikorwa
Abarumi
1 Abakorinto
2 Abakorinto
Abagalatia
Abaefeso
Abafilipi
Abakolosai
1 Abatesalonika
2 Abatesalonika
1 Timoteo
2 Timoteo
Tito
Filemooni
Abaheburaayo
Yakobo
1 Petero
2 Petero
1 Yohana
2 Yohana
3 Yohana
Yuda
Okushuuruurwa
      `),
      occitan: buildTranslationMap(`
Gènesi
Exòde
Levitic
Nombres
Deuteronòmi
Jousuè
Jutges
Rut
1 Samuèl
2 Samuèl
1 Reis
2 Reis
1 Cronicas
2 Cronicas
Esdras
Neemia
Estèr
Jòb
Psalmes
Provèrbis
Ecclesiastes
Cantic dels Cantics
Isaias
Jeremia
Lamentacions
Ezequièl
Danièl
Osèa
Joèl
Amòs
Abdias
Jonas
Miquèu
Nahum
Abacuc
Sofonias
Agèu
Zacarias
Malaquias
Matèu
Marc
Luc
Joan
Actes
Romans
1 Corintians
2 Corintians
Galatas
Efesians
Felipians
Colossians
1 Tesalonians
2 Tesalonians
1 Timotèu
2 Timotèu
Tit
Filemon
Ebrieus
Jaume
1 Pèire
2 Pèire
1 Joan
2 Joan
3 Joan
Jūda
Apocalipsi
      `),
      odia: buildTranslationMap(`
ଆଦି ପୁସ୍ତକ
ଯାତ୍ରା ପୁସ୍ତକ
ଲେବୀୟ ପୁସ୍ତକ
ଗଣନା ପୁସ୍ତକ
ଦ୍ୱିତୀୟ ବିବରଣ
ଯିହୋଶୂୟ
ବିଚାରକର୍ତ୍ତାମାନଙ୍କ ବିବରଣ
ରୂତର ବିବରଣ
1 ଶାମୁଏଲ
2 ଶାମୁଏଲ
1 ରାଜାବଳୀ
2 ରାଜାବଳୀ
1 ବଂଶାବଳୀ
2 ବଂଶାବଳୀ
ଏଜ୍ରା
ନିହେମୀୟ
ଏଷ୍ଟର
ଆୟୁବ
ଗୀତସଂହିତା
ହିତୋପଦେଶ
ଉପଦେଶକ
ଶ୍ରେଷ୍ଠ ଗୀତ
ଯିଶାଇୟ
ଯିରିମୀୟ
ବିଳାପ
ଯିହିଜ୍‌କୀଏଲ
ଦାନିଏଲ
ହୋଶେୟ
ଯୋଏଲ
ଆମୋସ
ଓବଦିୟ
ଯୂନସ
ମୀଖା
ନହୂମ
ହବକୂକ
ସଫନିୟ
ହାଗୟ
ଜଖରିୟ
ମଲାକି
ମାଥିଉ ଲିଖିତ ସୁସମାଚାର
ମାର୍କ ଲିଖିତ ସୁସମାଚାର
ଲୂକ ଲିଖିତ ସୁସମାଚାର
ଯୋହନ ଲିଖିତ ସୁସମାଚାର
ପ୍ରେରିତମାନଙ୍କ କାର୍ଯ୍ୟ
ରୋମୀୟମାନଙ୍କ ପ୍ରତି ପତ୍ର
1 କରିନ୍ଥୀୟ
2 କରିନ୍ଥୀୟ
ଗାଲାତୀୟ
ଏଫିସୀୟ
ଫିଲିପ୍ପୀୟ
କଲସୀୟ
1 ଥେସଲୋନୀକୀୟ
2 ଥେସଲୋନୀକୀୟ
1 ତୀମୋଥି
2 ତୀମୋଥି
ତୀତସ
ଫିଲେମୋନ ପ୍ରତି ପତ୍ର
ଏବ୍ରୀ
ଯାକୁବଙ୍କ ପତ୍ର
1 ପିତର
2 ପିତର
1 ଯୋହନ
2 ଯୋହନ
3 ଯୋହନ
ଯିହୂଦାଙ୍କ ପତ୍ର
ପ୍ରକାଶିତ ବାକ୍ୟ
      `),
      oromo: buildTranslationMap(`
Seera Uumaa
Seera Ba'uu
Seera Lewwoota
Seera Lakkoobsaa
Seera Keessa Deebii
Yooshuu
Abbooti Seeraa
Ruut
1 Saamu'eel
2 Saamu'eel
1 Mootota
2 Mootota
1 Seera Guyyaa
2 Seera Guyyaa
Izraa
Nahimiya
Astratii
Iyoob
Faarfannaa
Fakkeenya
Lallabaa
Weeduu Weeduwwanii
Isaayas
Ermiyaas
Nawoo
Hizqi'eel
Daani'eel
Hose'a
Yo'eel
Amos
Obaadiyaa
Yoonaas
Miikiyaas
Naahum
Anbaaqoom
Sefaaniyaa
Haagee
Zakaariyaas
Miilkiyaas
Maatewos
Maarqos
Luqaas
Yohannis
Hojii Ergamootaa
Roomaa
1 Qorontos
2 Qorontos
Galaatiyaa
Efesoon
Filiphisiyus
Qolosaayis
1 Tasalooniiqee
2 Tasalooniiqee
1 Ximotewos
2 Ximotewos
Tiitoo
Filimoonaa
Ibroota
Yaaqoob
1 Phétros
2 Phétros
1 Yohannis
2 Yohannis
3 Yohannis
Yudaa
Mul’ata
      `),
      ossetian: buildTranslationMap(`
Райдиан
Рацыд
Левит
Нымадтæ
Дыгæтæ
Ешуа
Тæрхонгæнджытæ
Руф
1 Самуилы
2 Самуилы
1 Падзахты
2 Падзахты
1 Паралипоменон
2 Паралипоменон
Езрæ
Нееми
Есфирь
Иов
Псаломтæ
Притчæтæ
Екклесиаст
Залты Залтæ
Исай
Иереми
Еремийы богъæ
Иезекииль
Даниил
Осия
Иоиль
Амос
Авдий
Иона
Михей
Наум
Аввакум
Софония
Аггей
Закария
Малахи
Матфей
Марк
Лука
Иоанн
Апостолты куыстытæ
Ромæгтæм
1 Коринфæгтæм
2 Коринфæгтæм
Галатæм
Ефесæгтæм
Филиппæгтæм
Колоссæгтæм
1 Фессалоникæгтæм
2 Фессалоникæгтæм
1 Тимофейм
2 Тимофейм
Титм
Филимонмæ
Дзуттæгтæм
Иаковы
1 Пётры
2 Пётры
1 Иоанны
2 Иоанны
3 Иоанны
Иудæйы
Рæхст
      `),
      pangasinan: buildTranslationMap(`
Genesis
Exodo
Levitico
Numeros
Deuteronomio
Josue
Hakim
Rut
1 Samuel
2 Samuel
1 Ari
2 Ari
1 Cronicas
2 Cronicas
Ezra
Nehemias
Ester
Job
Salmo
Proverbio
Ecclesiastes
Cantores
Isaias
Jeremias
Lamentacion
Ezekiel
Daniel
Hosea
Joel
Amos
Obadias
Jonas
Miqueas
Nahum
Habakkuk
Zefanias
Hagai
Zacarias
Malakias
Mateo
Marcos
Lucas
Juan
Apostol
Roma
1 Corinto
2 Corinto
Galacia
Efeso
Filipos
Colosas
1 Tesalonica
2 Tesalonica
1 Timoteo
2 Timoteo
Tito
Filemon
Hebreos
Santiago
1 Pedro
2 Pedro
1 Juan
2 Juan
3 Juan
Judas
Paltiing
      `),
      papiamento: buildTranslationMap(`
Génesis
Éksodo
Levítiko
Numbernan
Deuteronomio
Josué
Hueznan
Rut
1 Samuel
2 Samuel
1 Rijnan
2 Rijnan
1 Krónikanan
2 Krónikanan
Esdras
Nehemías
Ester
Job
Salmonan
Proverbionan
Eklesiastés
Kántico di Salomon
Isaias
Jeremías
Lamentashonnan
Ezekiel
Daniel
Hosea
Joel
Amos
Abdías
Jonas
Mikeas
Nahum
Habakuk
Sofonías
Ageo
Zacarías
Malaquías
Mateo
Marcos
Lukas
Juan
Echonan
Romanonan
1 Korintionan
2 Korintionan
Galatonan
Efesionan
Filipensenan
Kolosensenan
1 Tesalonicensenan
2 Tesalonicensenan
1 Timoteo
2 Timoteo
Tito
Filemon
Hebreonan
Santiago
1 Pedro
2 Pedro
1 Juan
2 Juan
3 Juan
Judas
Revelashon
      `),
      pashto: buildTranslationMap(`
پېدښت
خروج
لويان
گڼنې
تثنیه
يشوع
قاضيان
روت
۱ سموئیل
۲ سموئیل
۱ پاچاهان
۲ پاچاهان
۱ تواریخ
۲ تواریخ
عزرا
نحمیا
استر
ايوب
زبور
متلونه
واعظ
د سليمان سندرې
اشعيا
يرميا
نوحې
حزقیال
دانيال
هوشع
يوئيل
عاموس
عبديا
يونس
ميکاه
ناحوم
حبقوق
صفنيا
حجی
زکريا
ملاکي
متی
مرقس
لوقا
يوحنا
عملونه
روميانو ته
۱ کورنتيانو ته
۲ کورنتيانو ته
ګلاټيان
افسيانو ته
فيلپيانو ته
کولسيانو ته
۱ تسالونيکيانو ته
۲ تسالونيکيانو ته
۱ تيموتيوس
۲ تيموتيوس
تيتوس
فليمون
عبرانيانو ته
يعقوب
۱ پطروس
۲ پطروس
۱ يوحنا
۲ يوحنا
۳ يوحنا
يهوداه
مکاشفه
      `),
      pedi: buildTranslationMap(`
Genesi
Eksodo
Lefitiko
Dinomoro
Duteronome
Josua
Baahloli
Rute
1 Samuele
2 Samuele
1 Dikgoši
2 Dikgoši
1 Ditiragalo
2 Ditiragalo
Esra
Nehemia
Estere
Jobo
Dipsalme
Diema
Moreri
Koša ya Dikoša
Jesaya
Jeremia
Sellolane
Hesekiele
Daniele
Hosea
Joele
Amose
Obadia
Jona
Mika
Nahuma
Habakuku
Sefanya
Hagai
Sakaria
Malakia
Mateo
Mareko
Luka
Johane
Ditiro
Baroma
1 Bakorinte
2 Bakorinte
Bagalatia
Baefeso
Bafilipi
Bakolose
1 Batesalonika
2 Batesalonika
1 Timotheo
2 Timotheo
Tito
Filemone
Baheberu
Jakobo
1 Petro
2 Petro
1 Johane
2 Johane
3 Johane
Juda
Tshenolo
      `),
      persian: buildTranslationMap(`
پیدایش
خروج
لاویان
اعداد
تثنیه
یوشع
داوران
روت
۱ ساموئل
۲ ساموئل
۱ پادشاهان
۲ پادشاهان
۱ تواریخ
۲ تواریخ
عزرا
نحمیا
استر
ایوب
مزامیر
امثال
جامعه
غزل غزل‌ها
اشعیا
ارمیا
مراثی
حزقیال
دانیال
هوشع
یوئیل
عاموس
عوبدیا
یونس
میکا
ناحوم
حبقوق
صفنیا
حجی
زکریا
ملاکی
متی
مرقس
لوقا
یوحنا
اعمال رسولان
رومیان
۱ قرنتیان
۲ قرنتیان
غلاطیان
افسسیان
فیلیپیان
کولسیان
۱ تسالونیکیان
۲ تسالونیکیان
۱ تیموتائوس
۲ تیموتائوس
تیطوس
فلیمون
عبرانیان
یعقوب
۱ پطرس
۲ پطرس
۱ یوحنا
۲ یوحنا
۳ یوحنا
یهودا
مکاشفه
      `),
      polish: buildTranslationMap(`
Rodzaju
Wyjścia
Kapłańska
Liczb
Powtórzonego Prawa
Jozuego
Sędziów
Rut
1 Samuela
2 Samuela
1 Królewska
2 Królewska
1 Kronik
2 Kronik
Ezdrasza
Nehemiasza
Estery
Hioba
Psalmów
Przysłów
Koheleta
Pieśń nad Pieśniami
Izajasza
Jeremiasza
Lamentacje
Ezechiela
Daniela
Ozeasza
Joela
Amosa
Abdiasza
Jonasza
Micheasza
Nahuma
Habakuka
Sofoniasza
Aggeusza
Zachariasza
Malachiasza
Mateusza
Marka
Łukasza
Jana
Dzieje Apostolskie
Rzymian
1 Koryntian
2 Koryntian
Galatów
Efezjan
Filipian
Kolosan
1 Tesaloniczan
2 Tesaloniczan
1 Tymoteusza
2 Tymoteusza
Tytusa
Filemona
Hebrajczyków
Jakuba
1 Piotra
2 Piotra
1 Jana
2 Jana
3 Jana
Judy
Objawienie
      `),
      portuguese: buildTranslationMap(`
Gênesis
Êxodo
Levítico
Números
Deuteronômio
Josué
Juízes
Rute
1 Samuel
2 Samuel
1 Reis
2 Reis
1 Crônicas
2 Crônicas
Esdras
Neemias
Ester
Jó
Salmos
Provérbios
Eclesiastes
Cântico dos Cânticos
Isaías
Jeremias
Lamentações
Ezequiel
Daniel
Oséias
Joel
Amós
Obadias
Jonas
Miquéias
Naum
Habacuque
Sofonias
Ageu
Zacarias
Malaquias
Mateus
Marcos
Lucas
João
Atos
Romanos
1 Coríntios
2 Coríntios
Gálatas
Efésios
Filipenses
Colossenses
1 Tessalonicenses
2 Tessalonicenses
1 Timóteo
2 Timóteo
Tito
Filemon
Hebreus
Tiago
1 Pedro
2 Pedro
1 João
2 João
3 João
Judas
Apocalipse
      `),
      punjabi: buildTranslationMap(`
ਉਤਪਤ
ਕੂਚ
ਲੇਵੀਆਂ
ਗਿਣਤੀ
ਬਿਵਸਥਾ ਸਾਰ
ਯਹੋਸ਼ੂ
ਨਿਆਈਆਂ
ਰੂਥ
1 ਸਮੂਏਲ
2 ਸਮੂਏਲ
1 ਰਾਜਿਆਂ
2 ਰਾਜਿਆਂ
1 ਇਤਹਾਸ
2 ਇਤਹਾਸ
ਅਜ਼ਰਾ
ਨਹਮਯਾਹ
ਅਸਤਰ
ਅਯੂਬ
ਜ਼ਬੂਰ
ਕਹਾਵਤਾਂ
ਉਪਦੇਸ਼ਕ ਦੀ ਪੋਥੀ
ਸ੍ਰੇਸ਼ਟ ਗੀਤ
ਯਸਾਯਾਹ
ਯਿਰਮਯਾਹ
ਵਿਲਾਪ
ਹਿਜ਼ਕੀਏਲ
ਦਾਨੀਏਲ
ਹੋਸ਼ੇਆ
ਯੋਏਲ
ਆਮੋਸ
ਓਬਦਯਾਹ
ਯੂਨਾਹ
ਮੀਕਾਹ
ਨਹੂਮ
ਹਬੱਕੂਕ
ਸਫ਼ਨਯਾਹ
ਹੱਜਈ
ਜ਼ਕਰਯਾਹ
ਮਲਾਕੀ
ਮੱਤੀ
ਮਰਕੁਸ
ਲੂਕਾ
ਯੂਹੰਨਾ
ਰਸੂਲਾਂ ਦੇ ਕਰਤੱਬ
ਰੋਮੀਆਂ
1 ਕੁਰਿੰਥੀਆਂ
2 ਕੁਰਿੰਥੀਆਂ
ਗਲਾਤੀਆਂ
ਅਫ਼ਸੀਆਂ
ਫ਼ਿਲਿੱਪੀਆਂ
ਕੁਲੁੱਸੀਆਂ
1 ਥੱਸਲੁਨੀਕੀਆਂ
2 ਥੱਸਲੁਨੀਕੀਆਂ
1 ਤਿਮੋਥਿਉਸ
2 ਤਿਮੋਥਿਉਸ
ਤੀਤੁਸ
ਫਿਲੇਮੋਨ
ਇਬਰਾਨੀਆਂ
ਯਾਕੂਬ
1 ਪਤਰਸ
2 ਪਤਰਸ
1 ਯੂਹੰਨਾ
2 ਯੂਹੰਨਾ
3 ਯੂਹੰਨਾ
ਯਹੂਦਾਹ
ਪ੍ਰਕਾਸ਼ ਦੀ ਪੋਥੀ
      `),
      quechua: buildTranslationMap(`
Genesis
Exodo
Levitico
Numeros
Deuteronomio
Josue
Jueces
Rut
1 Samuel
2 Samuel
1 Reyes
2 Reyes
1 Cronicas
2 Cronicas
Esdras
Nehemias
Ester
Job
Salmos
Proverbios
Eclesiastes
Cantares
Isaias
Jeremias
Lamentaciones
Ezequiel
Daniel
Oseas
Joel
Amos
Abdias
Jonas
Miqueas
Nahum
Habacuc
Sofonias
Hageo
Zacarias
Malaquias
Mateo
Marcos
Lucas
Juan
Hechos
Romanos
1 Corintios
2 Corintios
Galatas
Efesios
Filipenses
Colosenses
1 Tesalonicenses
2 Tesalonicenses
1 Timoteo
2 Timoteo
Tito
Filemon
Hebreos
Santiago
1 Pedro
2 Pedro
1 Juan
2 Juan
3 Juan
Judas
Apocalipsis
      `),
      romanian: buildTranslationMap(`
Geneza
Exodul
Leviticul
Numeri
Deuteronomul
Iosua
Judecători
Rut
1 Samuel
2 Samuel
1 Împărați
2 Împărați
1 Cronici
2 Cronici
Ezra
Neemia
Estera
Iov
Psalmii
Proverbele
Eclesiastul
Cântarea Cântărilor
Isaia
Ieremia
Plângerile
Ezechiel
Daniel
Osea
Ioel
Amos
Obadia
Iona
Mihea
Naum
Habacuc
Sefonia
Hagai
Zaharia
Maleahi
Matei
Marcu
Luca
Ioan
Faptele Apostolilor
Romani
1 Corinteni
2 Corinteni
Galateni
Efeseni
Filipeni
Coloseni
1 Tesaloniceni
2 Tesaloniceni
1 Timotei
2 Timotei
Tit
Filimon
Evrei
Iacov
1 Petru
2 Petru
1 Ioan
2 Ioan
3 Ioan
Iuda
Apocalipsa
      `),
      romansh: buildTranslationMap(`
Genesis
Exodus
Leviticus
Numeri
Deuteronomi
Josua
Juditgs
Rut
1 Samuel
2 Samuel
1 Regs
2 Regs
1 Cronica
2 Cronica
Esra
Nehemia
Ester
Job
Psalms
Proverbis
Ecclesiast
Cantic dals Cantics
Jesaja
Jeremia
Lamentaziuns
Ezechiel
Daniel
Osea
Joel
Amos
Abdias
Jonas
Miqueas
Nahum
Habacuc
Sofonias
Aggeus
Zacarias
Malachias
Mateus
Marcus
Lucas
Johannes
Actas dals Apostels
Romans
1 Corintshs
2 Corintshs
Galats
Efesers
Filipers
Colossers
1 Tessalonicrs
2 Tessalonicrs
1 Timoteus
2 Timoteus
Titus
Filemon
Ebreis
Giacun
1 Peder
2 Peder
1 Johannes
2 Johannes
3 Johannes
Judas
Apocalipsa
      `),
      romany: buildTranslationMap(`
Jeneris
Eksodus
Levitikus
Numbars
Diuteronoma
Joshua
Jajiz
Rut
1 Samuel
2 Samuel
1 King
2 King
1 Kroniklz
2 Kroniklz
Ezra
Nehemaya
Esta
Job
Samz
Prɔvabz
Ɛkliziastiz
Sɔŋ ɔv Solɔmɔn
Izaya
Jeremaya
Lamɛnteshɔnz
Izikyɛl
Danyɛl
Ozea
Juwɛl
Emɔs
Obadaya
Jona
Mayka
Nehum
Habakɔk
Zɛfanya
Agai
Zɛkaraya
Malakay
Matyu
Maak
Luuk
Jan
Akts
Ruomanz
1 Korintyanz
2 Korintyanz
Galieshanz
Ifizhianz
Filipyanz
Kalooshanz
1 Tesaluonyanz
2 Tesaluonyanz
1 Timati
2 Timati
Taitas
Filimuon
Hiibruuz
Jiemz
1 Piita
2 Piita
1 Jan
2 Jan
3 Jan
Juud
Rivilieshan
      `),
      russian: buildTranslationMap(`
Бытие
Исход
Левит
Числа
Второзаконие
Иисус Навин
Судьи
Руфь
1 Царств
2 Царств
3 Царств
4 Царств
1 Паралипоменон
2 Паралипоменон
Ездра
Неемия
Есфирь
Иов
Псалтирь
Притчи
Екклесиаст
Песнь Песней
Исаия
Иеремия
Плач Иеремии
Иезекииль
Даниил
Осия
Иоиль
Амос
Авдий
Иона
Михей
Наум
Аввакум
Софония
Аггей
Захария
Малахия
Матфея
Марка
Луки
Иоанна
Деяния
Римлянам
1 Коринфянам
2 Коринфянам
Галатам
Ефесянам
Филиппийцам
Колоссянам
1 Фессалоникийцам
2 Фессалоникийцам
1 Тимофею
2 Тимофею
Титу
Филимону
Евреям
Иакова
1 Петра
2 Петра
1 Иоанна
2 Иоанна
3 Иоанна
Иуды
Откровение
      `),
      samoan: buildTranslationMap(`
Kenese
Esoto
Levitiko
Numera
Teuteronome
Iosua
Faamasino
Ruta
1 Samuela
2 Samuela
1 Tupu
2 Tupu
1 Nofoaiga a Tupu
2 Nofoaiga a Tupu
Esera
Nehemia
Eseta
Iopu
Salamo
Faataoto
Failauga
Pese a Solomona
Isaia
Ieremia
Aue
Esekielu
Taniela
Hosea
Ioelu
Amosa
Opadia
Iona
Mika
Nahuma
Apakuka
Sefania
Hakai
Sakaria
Malaki
Mataio
Mareko
Luka
Ioane
Galuega
Roma
1 Korinito
2 Korinito
Kalatia
Efeso
Filipi
Kolose
1 Tesalonika
2 Tesalonika
1 Timoteo
2 Timoteo
Tito
Filemona
Heperu
Iakopo
1 Peteru
2 Peteru
1 Ioane
2 Ioane
3 Ioane
Iuda
Faaaliga
      `),
      sango: buildTranslationMap(`
Genèse
Éxode
Lévitique
Nombres
Deutéronome
Josué
Juges
Ruth
1 Samuel
2 Samuel
1 Rois
2 Rois
1 Chroniques
2 Chroniques
Esdras
Néhémie
Esther
Job
Psaumes
Proverbes
Ecclésiaste
Cantique des Cantiques
Ésaïe
Jérémie
Lamentations
Ézéchiel
Daniel
Osée
Joël
Amos
Abdias
Jonas
Michée
Nahum
Habacuc
Sophonie
Aggée
Zacharie
Malachie
Matthieu
Marc
Luc
Jean
Actes
Romains
1 Corinthiens
2 Corinthiens
Galates
Éphésiens
Philippiens
Colossiens
1 Thess.
2 Thess.
1 Timothée
2 Timothée
Tite
Philémon
Hébreux
Jacques
1 Pierre
2 Pierre
1 Jean
2 Jean
3 Jean
Jude
Apocalypse
      `),
      sanskrit: buildTranslationMap(`
उत्पत्ति
निर्गमन
लेव्यव्यवस्था
गणना
व्यवस्था
यहोशू
न्यायि
रूत
1 समुएल
2 समुएल
1 राजा
2 राजा
1 इतिहास
2 इतिहास
एज्रा
नहेमायाह
एस्तेर
अय्यूब
भजन
नीतिवचन
सभोपदेसक
श्रेष्ठगीत
यशायाह
यिर्मयाह
रोना
यहेजकेल
दानिय्येल
होसे
योएल
आमोस
ओबद्याह
योना
मीका
नहूम
हबक्कूक
सपन्याह
हाग्गै
जकर्याह
मलाकी
मत्ती
मरकुस
लूका
यूहन्ना
प्रेरित मन
रोम
1 कोरिन
2 कोरिन
गलतिया
इफिसुस
फिलिप्पी
कुलुस्से
1 थिस्स.
2 थिस्स.
तीमुथियुस
तीमुथियुस
तीतुस
फिलेमोन
इब्रानी
याकूब
1 पतरस
2 पतरस
1 यूहन्ना
2 यूहन्ना
3 यूहन्ना
यहूदा
प्रकाशितवाक्य
      `),
      santali: buildTranslationMap(`
एते
बइसिरना
लेवी
गनती
नियम
यहोशू
नियाव
रूत
1 समुएल
2 समुएल
1 राजा
2 राजा
1 इतिहास
2 इतिहास
एज्रा
नहेमायाह
एस्तेर
अय्यूब
भजन
नीतिवचन
सभोपदेसक
श्रेष्ठगीत
यशायाह
यिर्मयाह
रोना
यहेजकेल
दानिय्येल
होसे
योएल
आमोस
ओबद्याह
योना
मीका
नहूम
हबक्कूक
सपन्याह
हाग्गै
जकर्याह
मलाकी
मत्ती
मरकुस
लूका
यूहन्ना
प्रेरित मन
रोम
1 कोरिन
2 कोरिन
गलतिया
इफिसुस
फिलिप्पी
कुलुस्से
1 थिस्स.
2 थिस्स.
तीमुथियुस
तीमुथियुस
तीतुस
फिलेमोन
इब्रानी
याकूब
1 पतरस
2 पतरस
1 यूहन्ना
2 यूहन्ना
3 यूहन्ना
यहूदा
प्रकाशितवाक्य
      `),
      scots_gaelic: buildTranslationMap(`
Genesis
Exodus
Leviticus
Àireamh
Deuteronomaidh
Iosua
Britheamhan
Rut
1 Samuel
2 Samuel
1 Rìghrean
2 Rìghrean
1 Eachdraidh
2 Eachdraidh
Esra
Nehemiah
Ester
Iob
Sailm
Gnàths-fhacail
Ecclesiastes
Òran Sholaimh
Isaiah
Ieremiah
Tuireadh
Eseciel
Daniel
Hosea
Ioel
Amos
Obadiah
Ionah
Micah
Nahum
Habaccuc
Zephaniah
Haggai
Zechariah
Malachi
Mataih
Marc
Lùcas
Eòin
Gnìomharan
Ròmanaich
1 Coirintianaich
2 Coirintianaich
Galataich
Efeseich
Philipianaich
Colosaich
1 Tesalònica
2 Tesalònica
1 Timoteus
2 Timoteus
Titus
Philemon
Eabhraidh
Seumas
1 Peadar
2 Peadar
1 Eòin
2 Eòin
3 Eòin
Iùdas
Taisbeanadh
      `),
      serbian: buildTranslationMap(`
Постање
Излазак
Левитска
Бројеви
Поновљени закони
Исус Навин
Судије
Рута
1. Самуилова
2. Самуилова
1. Царевима
2. Царевима
1. Дневника
2. Дневника
Јездра
Немија
Јестира
Јов
Псалми
Пословице
Проповедник
Песма над песмама
Исаија
Јеремија
Плач Јеремијин
Језекиљ
Данило
Осија
Јоил
Амос
Авдија
Јона
Михеј
Наум
Авакум
Софонија
Агеј
Захарија
Малахија
Матеј
Марко
Лука
Јован
Дела апостолска
Римљанима
1. Коринћанима
2. Коринћанима
Галатима
Ефесцима
Филипљанима
Колошанима
1. Солуњанима
2. Солуњанима
1. Тимотеју
2. Тимотеју
Титу
Филимону
Јеврејима
Јаковљева
1. Петрова
2. Петрова
1. Јованова
2. Јованова
3. Јованова
Јудина
Откривење
      `),
      sesotho: buildTranslationMap(`
Genese
Eksodo
Lefitiko
Dinomoro
Duteronome
Josua
Baahloli
Rute
1 Samuele
2 Samuele
1 Dikgoši
2 Dikgoši
1 Ditiragalo
2 Ditiragalo
Esra
Nehemia
Estere
Jobo
Dipsalme
Diema
Moreri
Koša ya Dikoša
Jesaya
Jeremia
Sellolane
Hesekiele
Daniele
Hosea
Joele
Amose
Obadia
Jona
Mika
Nahuma
Habakuku
Sefanya
Hagai
Sakaria
Malakia
Mateo
Mareko
Luka
Johane
Ditiro
Baroma
1 Bakorinte
2 Bakorinte
Bagalatia
Baefeso
Bafilipi
Bakolose
1 Batesalonika
2 Batesalonika
1 Timotheo
2 Timotheo
Tito
Filemone
Baheberu
Jakobo
1 Petro
2 Petro
1 Johane
2 Johane
3 Johane
Juda
Tshenolo
      `),
      shona: buildTranslationMap(`
Genesi
Eksodo
Levitiko
Numeri
Deuteronomio
Joshua
Vatongi
Ruti
1 Samueli
2 Samueli
1 Madzimambo
2 Madzimambo
1 Kronike
2 Kronike
Ezira
Nehemiya
Estere
Jobo
Mapisarema
Zvirevo
Muparidzi
Rwiyo rwa Soromona
Isaya
Jeremiya
Marisire
Ezekieri
Danieli
Hosea
Joeri
Amosi
Obadiya
Jona
Mika
Nahumu
Habakuku
Sefaniya
Hagayi
Zakariya
Maraki
Mateu
Marko
Ruka
Johani
Mabasa
Varoma
1 Vakorinde
2 Vakorinde
Agalatiya
Vaefeso
Vafilipi
Vakolosi
1 Vatesaronika
2 Vatesaronika
1 Timoti
2 Timoti
Tito
Firemoni
Vaheberi
Jakobo
1 Pedro
2 Pedro
1 Johani
2 Johani
3 Johani
Juda
Kupangidzwa
      `),
      sindhi: buildTranslationMap(`
उत्‍पत्ति
निकासु
लेवी
गणती
अनुवाद
यहोशू
न्‍यायि
रूथ
1 समुएल
2 समुएल
1 राजा
2 राजा
1 इतिहास
2 इतिहास
एज्रा
नहेमायाह
एस्‍तेर
अय्यूब
जबूर
नीतिवचन
उपदेशक
श्रेष्‍ठ गीत
यशायाह
यिर्मयाह
विलाप
यहेजकेल
दानिय्येल
होसे
योएल
आमोस
ओबद्याह
योना
मीका
नहूम
हबक्कूक
सपन्याह
हाग्गै
जकर्याह
मलाकी
मत्ती
मरकुस
लूका
यूहन्ना
प्रेरित मन
रोम
1 कोरिन
2 कोरिन
गलतिया
इफिसुस
फिलिप्पी
कुलुस्से
1 थिस्स.
2 थिस्स.
तीमुथियुस
तीमुथियुस
तीतुस
फिलेमोन
इब्रानी
याकूब
1 पतरस
2 पतरस
1 यूहन्ना
2 यूहन्ना
3 यूहन्ना
यहूदा
प्रकाशितवाक्य
      `),
      sinhala: buildTranslationMap(`
උත්පත්ති
නික්මයාම
ලෙවී කථාව
ගණන් කථාව
ද්විතීය කථාව
යෝෂුවා
විනිශ්චයකාරයන්
රූත්
1 සාමුවෙල්
2 සාමුවෙල්
1 රාජාවලිය
2 රාජාවලිය
1 ලේකම්
2 ලේකම්
එස්රා
නෙහෙමියා
එස්තර්
යෝබ්
ගීතාවලිය
හිතෝපදේශ
දේශනාකාරයා
සාලමොන්ගේ ගීතිකාව
යෙසායා
යෙරෙමියා
විලාප ගී
එසකියෙල්
දානියෙල්
හෝෂෙයා
යෝවෙල්
ආමොස්
ඕබදියා
යෝනා
මීකා
නාහුම්
හබක්කුක්
ශෙපනියා
හග්ගයි
සෙකරියා
මලාකි
මතෙව්
මාක්
ලූක්
යොහන්
ක්‍රියා
රෝම
1 කොරින්ති
2 කොරින්ති
ගලාති
එපීස
ෆිලිප්පි
කොලොස්සි
1 තෙසලෝනික
2 තෙසලෝනික
1 තිමෝති
2 තිමෝති
තීතස්
පිලමොන්
හෙබ්‍රෙව්
යාකොබ්
1 පේතෘස්
2 පේතෘස්
1 යොහන්
2 යොහන්
3 යොහන්
යූද්
එළිදරව්ව
      `),
      slovak: buildTranslationMap(`
Genezis
Exodus
Levitikus
Numeri
Deuteronómium
Jozua
Sudcov
Rút
1. Samuelova
2. Samuelova
1. Kráľov
2. Kráľov
1. Kronická
2. Kronická
Ezdráš
Nehemiáš
Ester
Jób
Žalmy
Príslovia
Kazateľ
Pieseň piesní
Izaiáš
Jeremiáš
Náreky
Ezechiel
Daniel
Ozeáš
Joel
Ámos
Abdiáš
Jonáš
Micheáš
Nahum
Habakuk
Sofoniáš
Aggeus
Zachariáš
Malachiáš
Matúš
Marek
Lukáš
Ján
Skutky
Rimanom
1. Korinťanom
2. Korinťanom
Galaťanom
Efezanom
Filipanom
Kolosanom
1. Tesaloničanom
2. Tesaloničanom
1. Timotejovi
2. Timotejovi
Titovi
Filemonovi
Hebrejom
Jakubov
1. Petrov
2. Petrov
1. Jánov
2. Jánov
3. Jánov
Júdov
Zjavenie
      `),
      slovenian: buildTranslationMap(`
Geneza
Eksodus
Levitik
Numeri
Ponovljeni zakon
Jozue
Sodniki
Ruta
1 Samuel
2 Samuel
1 Kralji
2 Kralji
1 Kronika
2 Kronika
Esra
Nehemija
Estera
Job
Psalmi
Pregovori
Pridigar
Visoka pesem
Izaija
Jeremija
Žalostne pesmi
Ezekiel
Daniel
Ozej
Joel
Amos
Abdija
Jona
Miha
Nahum
Habakuk
Sofonija
Hagaj
Zaharija
Malahija
Matej
Marko
Luka
Janez
Apostolska dela
Rimljanom
1 Korintčanom
2 Korintčanom
Galačanom
Efežanom
Filipljanom
Kološanom
1 Tesaloničanom
2 Tesaloničanom
1 Timoteju
2 Timoteju
Titu
Filemonu
Hebrejcem
Jakobov
1 Petrov
2 Petrov
1 Janezov
2 Janezov
3 Janezov
Judov
Razodetje
      `),
      somali: buildTranslationMap(`
Bilowgii
Baxniintii
Laawiyiintii
Tiradii
Sharcigii Labaad
Yashua
Garsoorayaashii
Ruut
1 Samuu'eel
2 Samuu'eel
1 Boqorada
2 Boqorada
1 Taariikhdii
2 Taariikhdii
Cesra
Nexemiya
Ester
Ayuub
Sabuurradii
Maahmaahdii
Wacdiyihii
Heestii Heesaha
Ishacya
Yeremiya
Baroorashadii
Yexesqeel
Daanyeel
Hoosiya
Yoo'eel
Caamoos
Cobadyah
Yoonis
Miikaah
Naxuum
Xabaquuq
Sefaniya
Xagey
Sakariya
Malaakii
Matayos
Markos
Luukos
Yooxanaa
Falimadii
Rooma
1 Korintos
2 Korintos
Galatiya
Efesos
Filibi
Kolos
1 Tesalonika
2 Tesalonika
1 Timoteyos
2 Timoteyos
Tiitos
Filimoon
Cibraaniyada
Yacquub
1 Butros
2 Butros
1 Yooxanaa
2 Yooxanaa
3 Yooxanaa
Yuudah
Muujintii
      `),
      spanish: buildTranslationMap(`
Génesis
Éxodo
Levítico
Números
Deuteronomio
Josué
Jueces
Rut
1 Samuel
2 Samuel
1 Reyes
2 Reyes
1 Crónicas
2 Crónicas
Esdras
Nehemías
Ester
Job
Salmos
Proverbios
Eclesiastés
Cantar de los Cantares
Isaías
Jeremías
Lamentaciones
Ezequiel
Daniel
Oseas
Joel
Amós
Abdías
Jonás
Miqueas
Nahúm
Habacuc
Sofonías
Hageo
Zacarías
Malaquías
Mateo
Marcos
Lucas
Juan
Hechos
Romanos
1 Corintios
2 Corintios
Gálatas
Efesios
Filipenses
Colosenses
1 Tesalonicenses
2 Tesalonicenses
1 Timoteo
2 Timoteo
Tito
Filemón
Hebreos
Santiago
1 Pedro
2 Pedro
1 Juan
2 Juan
3 Juan
Judas
Apocalipsis
      `),
      sundanese: buildTranslationMap(`
Kajadian
Budalan
Imamat
Itungan
Pangulangan
Yosua
Hakim
Rut
1 Samuel
2 Samuel
1 Raja-raja
2 Raja-raja
1 Babad
2 Babad
Esra
Nehemia
Ester
Ayub
Jabur
Siloka
Pandita
Kidung Agung
Yesaya
Yeremia
Ramat
Yehezkiel
Daniel
Hosea
Yoel
Amos
Obaja
Yunus
Mikha
Nahum
Habakuk
Sefanya
Hagai
Jakaria
Maleakhi
Mateus
Markus
Lukas
Yohanes
Rasul
Rum
1 Korintus
2 Korintus
Galatia
Efesus
Pilipi
Kolose
1 Tesalonika
2 Tesalonika
1 Timoteus
2 Timoteus
Titus
Pilemon
Ibrani
Yakobus
1 Petrus
2 Petrus
1 Yohanes
2 Yohanes
3 Yohanes
Yudas
Wahyu
      `),
      swahili: buildTranslationMap(`
Mwanzo
Kutoka
Walawi
Hesabu
Kumbukumbu la Torati
Yoshua
Waamuzi
Rutu
1 Samweli
2 Samweli
1 Wafalme
2 Wafalme
1 Mambo ya Nyakati
2 Mambo ya Nyakati
Ezra
Nehemia
Esta
Ayubu
Zaburi
Mithali
Mhubiri
Wimbo Uliongoza
Isaya
Yeremia
Maombolezo
Ezekieli
Danieli
Hosea
Yoeli
Amosi
Obadia
Yona
Mika
Nahumu
Habakuku
Sefania
Hagai
Zakaria
Malaki
Mathayo
Marko
Luka
Yohana
Matendo ya Mitume
Warumi
1 Wakorintho
2 Wakorintho
Wagalatia
Waefeso
Wafilipi
Wakolosai
1 Wathesalonike
2 Wathesalonike
1 Timotheo
2 Timotheo
Tito
Filemoni
Waebrania
Yakobo
1 Petro
2 Petro
1 Yohana
2 Yohana
3 Yohana
Yuda
Ufunuo
      `),
      swati: buildTranslationMap(`
Genesisi
Eksodusi
Levitikhusi
Tinombolo
Dutheronomi
Joshuwa
Behluli
Ruthi
1 Samuweli
2 Samuweli
1 Emakhosi
2 Emakhosi
1 Timbhali
2 Timbhali
Ezra
Nehemiya
Esitera
Jobe
Tihlabelelo
Tinganekwane
Umshumayeli
Ingoma Yetingoma
Isaya
Jeremiya
Sililo
Hezekieli
Danyeli
Hoseya
Joweli
Amosi
Obadiya
Jona
Mika
Nahumu
Habakuku
Sefaniya
Hagayi
Sakariya
Malaki
Matewu
Makho
Lukha
Johane
Imisebenti
KwabaseRoma
1 KwabaseKorinte
2 KwabaseKorinte
KwabaseGalathiya
Kwabase-Efesu
KwabaseFilipi
KwabaseKholose
1 KwabaseThesalonika
2 KwabaseThesalonika
1 KuThimothewu
2 KuThimothewu
KuThitusi
KuFilimoni
KwabaHebheru
KuJakobe
1 KuPhetro
2 KuPhetro
1 KuJohane
2 KuJohane
3 KuJohane
KuJuda
Sembulo
      `),
      swedish: buildTranslationMap(`
Genesis
Exodus
Leviticus
Numeri
Deuteronomium
Josua
Domarboken
Rut
1 Samuelsboken
2 Samuelsboken
1 Kungaboken
2 Kungaboken
1 Krönikeboken
2 Krönikeboken
Esra
Nehemia
Ester
Job
Psaltaren
Ordspråksboken
Predikaren
Höga Visan
Jesaja
Jeremia
Klagovisorna
Hesekiel
Daniel
Hosea
Joel
Amos
Obadja
Jona
Mika
Nahum
Habackuk
Sefanja
Haggai
Sakarja
Malaki
Matteus
Markus
Lukas
Johannes
Apostlagärningarna
Romarbrevet
1 Korintierbrevet
2 Korintierbrevet
Galaterbrevet
Efesierbrevet
Filipperbrevet
Kolosserbrevet
1 Tessalonikerbrevet
2 Tessalonikerbrevet
1 Timoteusbrevet
2 Timoteusbrevet
Titusbrevet
Filemonbrevet
Hebreerbrevet
Jakobsbrevet
1 Petrusbrevet
2 Petrusbrevet
1 Johannesbrevet
2 Johannesbrevet
3 Johannesbrevet
Judasbrevet
Uppenbarelseboken
      `),
      tagalog: buildTranslationMap(`
Genesis
Exodo
Levitico
Mga Bilang
Deuteronomio
Josue
Mga Hukom
Rut
1 Samuel
2 Samuel
1 Mga Hari
2 Mga Hari
1 Mga Cronica
2 Mga Cronica
Ezra
Nehemias
Ester
Job
Mga Awit
Mga Kawikaan
Mnangaral
Awit ng mga Awit
Isaias
Jeremias
Mga Panaghoy
Ezequiel
Daniel
Hosea
Joel
Amos
Obadias
Jonas
Mikas
Nahum
Habacuc
Sofonias
Hagai
Zacarias
Malaquias
Mateo
Marcos
Lucas
Juan
Mga Gawa
Mga Taga-Roma
1 Mga Taga-Corinto
2 Mga Taga-Corinto
Mga Taga-Galacia
Mga Taga-Efeso
Mga Taga-Filipos
Mga Taga-Colosas
1 Mga Taga-Tesalonica
2 Mga Taga-Tesalonica
1 Timoteo
2 Timoteo
Tito
Filemon
Mga Hebreo
Santiago
1 Pedro
2 Pedro
1 Juan
2 Juan
3 Juan
Judas
Pahayag
      `),
      tahitian: buildTranslationMap(`
Genese
Exodo
Levitiko
Numera
Teuteronomi
Iosua
Te mau Faavae
Ruta
1 Samuela
2 Samuela
1 Te mau Arii
2 Te mau Arii
1 Paraleipomeno
2 Paraleipomeno
Ezera
Nehemia
Esetera
Iobo
Salamo
Maseli
Te傳道者
Sire a Solomona
Isaia
Ieremia
Oto
Ezekiela
Daniela
Hosea
Ioela
Amosa
Obadia
Iona
Mika
Nahuma
Habakuka
Zephania
Hagai
Zakaria
Malaki
Mataio
Mareko
Luka
Ioane
Ohipa
Roma
1 Korinetia
2 Korinetia
Galatia
Ephesia
Philipia
Kolosa
1 Tesalonia
2 Tesalonia
1 Timoteo
2 Timoteo
Tito
Philemona
Hebera
Iakobo
1 Petero
2 Petero
1 Ioane
2 Ioane
3 Ioane
Iuda
Apokalupo
      `),
      tajik: buildTranslationMap(`
Ҳастӣ
Хуروج
Левит
Ададҳо
Татния
Ешуа
Доварон
Рут
1 Самуил
2 Самуил
1 Подшоҳон
2 Подшоҳон
1 Вақоеънома
2 Вақоеънома
Эзро
Неҳемиё
Есфир
Айюб
Забур
Масалҳо
Воизи
Суруди сурудҳо
Ишаъё
Ирмиё
Навҳа
Ҳизқиёл
Даниёл
Ҳушаъ
Юил
Амос
Абдиё
Юнус
Мико
Нахум
Хабаккук
Сефанё
Ҳаҷҷай
Закариё
Малокӣ
Матто
Марқус
Луқо
Юҳанно
Аъмол
Румиён
1 Қӯринтиён
2 Қӯринтиён
Галатӣ
Эфесӣ
Филиппӣ
Колосӣ
1 Таслӯникӣ
2 Таслӯникӣ
1 Тимотию
2 Тимотию
Титус
Филимӯн
Ибриён
Яъқуб
1 Петрус
2 Петрус
1 Юҳанно
2 Юҳанно
3 Юҳанно
Яҳудо
Ваҳй
      `),
      tamazight: buildTranslationMap(`
Tawilit
Effuɣ
Alawi
Amḍan
Isuraf
Juchwa
Imsefrayen
Rut
1 Samwil
2 Samwil
1 Igelliden
2 Igelliden
1 Isallen
2 Isallen
Ezra
Nehemi
Estir
Ayub
Izliyen
Inziyen
Amusnaw
Izli n Sliman
Icaya
Irmiya
Anzuzen
Hizqiyal
Danyal
Huci
Juwil
Amus
Abdiya
Yunus
Mika
Nahum
Habaquq
Sifanya
Haggay
Zakariya
Malaki
Matta
Marqus
Luqa
Yuhenna
Isiggan
Irumiyen
1 Ikurintiyen
2 Ikurintiyen
Igalatiyen
Ifesiyen
Ifilipiyen
Ikolosiyen
1 Itesalonikiyen
2 Itesalonikiyen
1 Timuti
2 Timuti
Titus
Filimun
Ihebriyen
Yaqub
1 Buṭrus
2 Buṭrus
1 Yuhenna
2 Yuhenna
3 Yuhenna
Yuda
Aweḥḥi
      `),
      tamil: buildTranslationMap(`
ஆதியாகமம்
யாத்திராகமம்
லேவியராகமம்
எண்ணாகமம்
உபாகமம்
யோசுவா
நியாயாதிபதிகள்
ரூத்
1 சாமுவேல்
2 சாமுவேல்
1 இராஜாக்கள்
2 இராஜாக்கள்
1 நாளாகமம்
2 நாளாகமம்
எஸ்றா
நெகேமியா
எஸ்தர்
யோபு
சங்கீதங்கள்
நீதிமொழிகள்
பிரசங்கி
உன்னதப்பாட்டு
ஏசாயா
எரேமியா
புலம்பல்
எசேக்கியேல்
தானியேல்
ஓசியா
யோவேல்
ஆமோஸ்
ஒபதியா
யோனா
மீகா
నహూమ్
ஆபகூக்
செப்பனியா
ஆகாய்
சகரியா
மல்கியா
மத்தேயு
மாற்கு
லூக்கா
யோவான்
அப்போஸ்தலர்
ரோமர்
1 கொரிந்தியர்
2 கொரிந்தியர்
கலாத்தியர்
எபேசியர்
பிலிப்பியர்
கொலோசெயர்
1 தெசலோனிக்கேயர்
2 தெசலோனிக்கேயர்
1 தீமோத்தேயு
2 தீமோத்தேயு
தீத்து
பிலேமோன்
எபிரெயர்
யாக்கோபு
1 பேதுரு
2 பேதுரு
1 யோவான்
2 யோவான்
3 யோவான்
யூதா
வெளிப்படுத்தின விசேஷம்
      `),
      tatar: buildTranslationMap(`
Ярату
Чыгу
Левит
Саннар
Канун
Ешуа
Хөкемчеләр
Руфь
1 Самуил
2 Самуил
1 Патшалар
2 Патшалар
1 Паралипоменон
2 Паралипоменон
Ездра
Неемия
Эсфирь
Иов
Псаломнар
Гыйбрәтле сүзләр
Экклезиаст
Песнь Песней
Исайя
Иеремия
Плач Иеремии
Иезекииль
Даниил
Осия
Иоиль
Амос
Авдий
Иона
Михей
నహూము
Аввакум
Софония
Аггей
Захария
Малахия
Матфей
Марк
Лука
Иоанн
Деяния
Римлыларга
1 Коринфлыларга
2 Коринфлыларга
Галатларга
Эфеслыларга
Филипплыларга
Колоссыларга
1 Фессалоникалыларга
2 Фессалоникалыларга
1 Тимофейга
2 Тимофейга
Титус
Филимонга
Еврейләргә
Якуб
1 Петр
2 Петр
1 Иоанн
2 Иоанн
3 Иоанн
Иуда
Ачылыш
      `),
      telugu: buildTranslationMap(`
ఆదికాండము
నిర్గమకాండము
లేవీయకాండము
సంఖ్యాకాండము
ద్వితీయోపదేశకాండము
యెహోషువ
న్యాయాధిపతులు
రూతు
1 సమూయేలు
2 సమూయేలు
1 రాజులు
2 రాజులు
1 దినవృత్తాంతములు
2 దినవృత్తాంతములు
ఎజ్రా
నెహెమ్యా
ఎస్తేరు
యోబు
కీర్తనలు
సామెతలు
ప్రసంగి
పరమగీతము
యెషయా
యిర్మీయా
విలాపవాక్యములు
యెహెజ్కేలు
దానియేలు
హోషేయ
యోవేలు
ఆమోసు
ఓబద్యా
యోనా
మీకా
నహూము
హబక్కూకు
జెఫన్యా
హగ్గయి
జెకర్యా
మలాకీ
మత్తయి
మార్కు
లూకా
యోహాను
అపొస్తలుల కార్యములు
రోమీయులకు
1 కొరింథీయులకు
2 కొరింథీయులకు
గలతీయులకు
ఎఫెసీయులకు
ఫిలిప్పీయులకు
కొలొస్సయులకు
1 థెస్సలొనీకయులకు
2 థెస్సలొనీకయులకు
1 తిమోతికి
2 తిమోతికి
తీతుకు
ఫిలేమోనుకు
హెబ్రీయులకు
యాకోబు
1 పేతురు
2 పేతురు
1 యోహాను
2 యోహాను
3 యోహాను
యూదా
ప్రకటన గ్రంథము
      `),
      tetum: buildTranslationMap(`
Jénesis
Éxodu
Levítiku
Númeru
Deuteronómiu
Josué
Juís
Rute
1 Samuel
2 Samuel
1 Reis
2 Reis
1 Krónikas
2 Krónikas
Esdra
Neemia
Ester
Job
Salmus
Provérbiu
Eclesiastes
Kántiku di Salomon
Izaias
Jeremias
Lamentasoins
Ezequiel
Daniel
Oseias
Joel
Amos
Obadias
Jonas
Mikeas
Naum
Habakuk
Sofonias
Ageu
Zacarias
Malakias
Mateus
Marcos
Lucas
João
Aktus
Roma
1 Korinto
2 Korinto
Galásia
Efézu
Filipu
Kolosu
1 Tesalónika
2 Tesalónika
1 Timóteo
2 Timóteo
Titu
Filemón
Ebreus
Tiago
1 Pedru
2 Pedru
1 João
2 João
3 João
Judas
Apokalipse
      `),
      thai: buildTranslationMap(`
ปฐมกาล
อพยพ
เลวีนิติ
กันดารวิถี
เฉลยธรรมบัญญัติ
ยอชูวา
ผู้วินิจฉัย
นางรูธ
1 ซามูเอล
2 ซามูเอล
1 พงศ์กษัตริย์
2 พงศ์กษัตริย์
1 พงศาวดาร
2 พงศาวดาร
เอสรา
เนหะมีย์
เอสเธอร์
โยบ
เพลงสดุดี
สุภาษิต
ปัญญาจารย์
เพลงซาโลมอน
อิสยาห์
เยเรมีย์
เพลงคร่ำครวญ
เอเซเคียล
ดาเนียล
โฮเชยา
โยเอล
อาโมส
โอบาดีย์
โยนาห์
มีคาห์
นาฮูม
ฮาบากุก
เซฟันยา
ฮักกัย
เศคาริยาห์
มาลาคี
มัทธิว
มาระโก
ลูกา
ยอห์น
กิจการ
โรม
1 โครินธ์
2 โครินธ์
กาลาเทีย
เอเฟซัส
ฟีลิปปี
โคโลสี
1 เธสะโลนิกา
2 เธสะโลนิกา
1 ทิโมธี
2 ทิโมธี
ทิตัส
ฟีเลโมน
ฮีบรู
ยากอบ
1 เปโตร
2 เปโตร
1 ยอห์น
2 ยอห์น
3 ยอห์น
ยูดา
วิวรณ์
      `),
      tibetan: buildTranslationMap(`
འཇིག་རྟེན་ཆགས་རབས།
ཐར་པ།
ལེ་བཱི་པ།
གྲངས་ཀ།
བཀའ་ལུང་གཉིས་པ།
ཇོ་ཤུ་ཨཱ།
ཞལ་ཆེ་པ།
རུ་ཐཱ།
1 སཱ་མུ་ཨེལ།
2 སཱ་མུ་ཨེལ།
1 རྒྱལ་པོའི་ལོ་རྒྱུས།
2 རྒྱལ་པོའི་ལོ་རྒྱུས།
1 ལོ་རྒྱུས་ཕྱོགས་བསྒྲིགས།
2 ལོ་རྒྱུས་ཕྱོགས་བསྒྲིགས།
ཨེས་རཱ།
ནེ་ཧེམ་ཡཱ།
ཨེས་ཐར།
ཡོབ་ཀྱི་ལོ་རྒྱུས།
གསུང་མགུར།
གཏམ་དཔེ།
ཆོས་བཤད་པ།
གླུ་དབྱངས་མཆོག
ཨེ་ཤ་ཡཱ།
ཡེ་རེམ་ཡཱ།
མྱ་ངན་འོ་དོད་ཀྱི་གླུ།
ཨེ་ཟེ་ཀི་ཨེལ།
དཱ་ནི་ཨེལ།
ཧོ་ཤེ་ཡཱ།
ཡོ་ཨེལ།
ཨ་མོ་སི།
ཨོ་བད་ཡཱ།
ཡོ་ནཱ།
མི་ཀཱ།
ན་ཧུམ།
ཧ་བ་ཀུཀ།
ཟེ་ཕན་ཡཱ།
ཧག་གཱ།
ཟེ་ཀར་ཡཱ།
མ་ལ་ཀི།
མ་ཐཱ།
མར་ཀུས།
ལུ་ཀཱ།
ཡོ་ཧཱ་ནཱ།
མཛད་འཕྲིན།
རོ་མཱ་པ།
1 ཀོ་རིན་ཐུ་པ།
2 ཀོ་རིན་ཐུ་པ།
ག་ལ་ཤཱ་པ།
ཨེ་ཕེ་སུ་པ།
ཕི་ལིཔ་པི་པ།
ཀོ་ལོ་སཱ་པ།
1 ཐེ་ས་ལོ་ནཱི་ཀ་པ།
2 ཐེ་ས་ལོ་ནཱི་ཀ་པ།
1 ཐི་མོ་ཐེ་ཨཱ།
2 ཐི་མོ་ཐེ་ཨཱ།
ཐི་ཐཱ་པ།
ཕི་ལེ་མོ་ན།
ཨིབ་རི་པ།
ཡ་ཀོ་བཱ།
1 པེ་ཏྲོ་པ།
2 པེ་ཏྲོ་པ།
1 ཡོ་ཧཱ་ནཱ།
2 ཡོ་ཧཱ་ནཱ།
3 ཡོ་ཧཱ་ནཱ།
ཡ་ཧུ་དཱ།
མངོན་པར་གསལ་བ།
      `),
      tigrinya: buildTranslationMap(`
ዘፍጥረት
ዘጸአት
ዘሌዋውያን
ዘሁልቁ
ዘዳግም
እያሱ
መሳፍንቲ
ሩት
1 ሳሙኤል
2 ሳሙኤል
1 ነገሥት
2 ነገሥት
1 ዜና መዋዕል
2 ዜና መዋዕል
እዝራ
ነህምያ
አስቴር
እዮብ
መዝሙር
ምስላ
መክብብ
መኃልየ መኃልይ
ኢሳይያስ
ኤርምያስ
ሰቆቃው ኤርምያስ
ሕዝቅኤል
ዳንኤል
ሆሴዕ
እዩኤል
አሞጽ
አብድዩ
ዮናስ
ሚክያስ
ናሆም
ዕንባቆም
ሶፎንያስ
ሓጌ
ዘካርያስ
ሚልክያስ
ማቴዎስ
ማርቆስ
ሉቃስ
ዮሐንስ
ግብረ ሃዋርያት
ሮሜ
1 ቈረንቶስ
2 ቈረንቶስ
ገላትያ
ኤፌሶን
ፊልጵስዩስ
ቈላሴ
1 ተሰሎንቄ
2 ተሰሎንቄ
1 ጢሞቴዎስ
2 ጢሞቴዎስ
ቲቶ
ፊልሞና
እብራውያን
ያዕቆብ
1 ጴጥሮስ
2 ጴጥሮስ
1 ዮሐንስ
2 ዮሐንስ
3 ዮሐንስ
ይሁዳ
ራእይ
      `),
      tiv: buildTranslationMap(`
Genese
Eksodu
Levitiku
Numeri
Duteronomi
Joshua
Mbajiren
Rut
1 Samuel
2 Samuel
1 Utor
2 Utor
1 Mbise
2 Mbise
Esera
Nehemia
Eseter
Yobu
Pasalmi
Anzaakaa
Orpasen
Icam i Solomon
Yesaya
Yeremia
Iyongo i Yeremia
Hesekiel
Daniel
Hosea
Yoel
Amos
Obadia
Yona
Mika
Nahum
Habakuku
Sefania
Hagai
Sekaria
Malaki
Mateu
Marko
Luka
Yohane
Aeren
Aroma
1 Mbakorinto
2 Mbakorinto
Agalatia
Aefese
Afilipi
Akolose
1 Atesalonika
2 Atesalonika
1 Timoteu
2 Timoteu
Titu
Filemon
Mbaheberu
Yakobu
1 Peteru
2 Peteru
1 Yohane
2 Yohane
3 Yohane
Yuda
Mpase i Yohane
      `),
      tok_pisin: buildTranslationMap(`
Jenesis
Kisim Bek
Levitikas
Namba
Lo
Josua
Hetman
Rut
1 Samuel
2 Samuel
1 King
2 King
1 Stori
2 Stori
Esra
Nehemia
Esta
Jop
Sam
Gutpela Tok
Kamanda
Song Bilong Solomon
Aisaia
Jeremaia
Sori Song
Hesekiel
Daniel
Hosea
Joel
Amos
Obadia
Jona
Maika
Nahum
Habakuk
Sefanaia
Hagai
Sekaraia
Malakai
Matyu
Mak
Luk
Jon
Apostel
Rom
1 Korin
2 Korin
Galesia
Efesus
Filipai
Kolosi
1 Tesalonika
2 Tesalonika
1 Timoti
2 Timoti
Taitus
Pilemon
Hibru
Jems
1 Pita
2 Pita
1 Jon
2 Jon
3 Jon
Juta
Revelesen
      `),
      tongan: buildTranslationMap(`
Sēnesi
Ekisoto
Livitiko
Nōmipa
Teutallonome
Siosua
Kau Fakamaau
Luti
1 Samiuela
2 Samiuela
1 Ngaahi Tu‘i
2 Ngaahi Tu‘i
1 Fakamatala Mea
2 Fakamatala Mea
Esela
Nehemaia
Esita
Siope
Ngaahi Saame
Ngaahi Palovepi
Koheleti
Hiva ‘a e Ngaahi Hiva
‘Aisea
Selemaia
Tangi
Isikieli
Taniela
Hosea
Sioeli
Emosi
Opataia
Siona
Maika
Nehumi
Hapakuki
Sefanaia
Hakei
Sākalaia
Malaki
Mātiu
Ma‘ake
Luke
Sione
Ngāue
Loma
1 Kolinito
2 Kolinito
Kaletia
Efeso
Filipai
Kolose
1 Tesalonika
2 Tesalonika
1 Timote
2 Timote
Taitusi
Filimone
Hepelu
Sēmisi
1 Pita
2 Pita
1 Sione
2 Sione
3 Sione
Siuta
Fakahā
      `),
      tsonga: buildTranslationMap(`
Genesa
Eksoda
Levhitika
Tinhlayo
Deteronoma
Yoshwa
Vaavanyisi
Rhuta
1 Samuele
2 Samuele
1 Tihosi
2 Tihosi
1 Tikronika
2 Tikronika
Esra
Nehemiya
Estere
Yobo
Mapsalma
Swivuriso
Muhuweri
Risimu ra Tinsimu
Esaya
Yeremiya
Swirilo
Eksikiyele
Daniele
Hofiya
Yuwele
Amosi
Obadiya
Yona
Mika
Nahumu
Habakuku
Sofoniya
Hagayi
Zakariya
Malaki
Matewu
Marka
Luka
Yohane
Mintirho
Varhoma
1 Vakorinto
2 Vakorinto
Vagalatiya
Vaefesa
Vafilipi
Vakolosa
1 Vatesalonika
2 Vatesalonika
1 Timotiya
2 Timotiya
Tito
Filemon
Vaheveru
Yakobo
1 Petro
2 Petro
1 Yohane
2 Yohane
3 Yohane
Yudha
Nhlavutelo
      `),
      tswana: buildTranslationMap(`
Genesisi
Ekisodo
Lefitiko
Dipalo
Duteronome
Joshua
Baatlhodi
Rute
1 Samuele
2 Samuele
1 Dikgosi
2 Dikgosi
1 Ditiragalo
2 Ditiragalo
Esra
Nehemia
Esitere
Jobe
Dipesalema
Diane
Moreri
Sela sa Dipela
Isaya
Jeremia
Selello
Hesekiele
Daniele
Hosea
Joele
Amose
Obadia
Jona
Mika
Nahuma
Habakuku
Sefanya
Hagai
Sekaria
Malaki
Mathaio
Mareko
Luke
Johane
Ditiro
Baroma
1 Bakorinthe
2 Bakorinthe
Bagalatia
Baefeso
Bafilipi
Bakolose
1 Batesalonika
2 Batesalonika
1 Timotheo
2 Timotheo
Tito
Filemone
Bahebera
Yakobo
1 Petere
2 Petere
1 Johane
2 Johane
3 Johane
Juda
Tshenolo
      `),
      tumbuka: buildTranslationMap(`
Genesis
Exodus
Leviticus
Maŵerengero
Duteronome
Joshua
Ŵeruzgi
Rut
1 Samuel
2 Samuel
1 Mathemba
2 Mathemba
1 Midauko
2 Midauko
Ezra
Nehemiya
Esiteri
Yobu
Masalimo
Ntharika
Mupharazgi
Sumu ya Mathemba
Yesaya
Yeremiya
Chitengero
Ezekiyeli
Daniyeli
Hoseya
Yoeli
Amosi
Obadiya
Yona
Mika
Nahumu
Habakuku
Sefaniya
Hagai
Zakaariya
Malaki
Mateyu
Marko
Luka
Yohane
Milimo
Ŵaroma
1 Ŵakorinte
2 Ŵakorinte
Ŵagalatiya
Ŵaefeso
Ŵafilipi
Ŵakolose
1 Ŵatesalonika
2 Ŵatesalonika
1 Timote
2 Timote
Tito
Filemon
Ŵahebere
Yakobe
1 Petulu
2 Petulu
1 Yohane
2 Yohane
3 Yohane
Yuda
Chivumbulutso
      `),
      turkish: buildTranslationMap(`
Yaratılış
Mısır'dan Çıkış
Levililer
Sayılar
Yasanın Tekrarı
Yeşu
Hakimler
Rut
1. Samuel
2. Samuel
1. Krallar
2. Krallar
1. Tarihler
2. Tarihler
Ezra
Nehemya
Ester
Eyüp
Mezmurlar
Özdeyişler
Vaiz
Ezgiler Ezgisi
Yeşaya
Yeremya
Ağıtlar
Hezekiel
Daniel
Hoşea
Yoel
Amos
Obadya
Yunus
Mika
Nahum
Habakkuk
Sefanya
Hagay
Zekeriya
Malaki
Matta
Markos
Luka
Yuhanna
Elçilerin İşleri
Romalılar
1. Korintliler
2. Korintliler
Galatyalılar
Efesliler
Filipililer
Koloseliler
1. Selanikliler
2. Selanikliler
1. Timoteos
2. Timoteos
Titus
Filimun
İbraniler
Yakup
1. Petrus
2. Petrus
1. Yuhanna
2. Yuhanna
3. Yuhanna
Yahuda
Vahiy
      `),
      turkmen: buildTranslationMap(`
Gelip çykyş
Chykys
Lewiler
Sanlar
Kanun taglymaty
Ýeşua
Kazylar
Rut
1 Şamuwel
2 Şamuwel
1 Patşalar
2 Patşalar
1 Ýazgylar
2 Ýazgylar
Ezera
Nehemiýa
Ester
Eýýup
Zebur
Nakyllar
Wagyzçy
Nagmeler nagmesi
Işaýa
Ýeremiýa
Agylar
Hyzekiel
Danyel
Hoşea
Ýowel
Amos
Abdiýa
Ýunus
Mika
Nahum
Habakkuk
Sefanýa
Haggaý
Zekeriýa
Malaki
Matta
Markus
Luka
Ýahýa
Resullaryň işleri
Rimler
1 Korinfliler
2 Korinfliler
Galatýalylar
Efesliler
Filippililer
Kolosseliler
1 Selanikliler
2 Selanikliler
1 Timoteos
2 Timoteos
Titus
Filimun
Ýewreýler
Ýakup
1 Petrus
2 Petrus
1 Ýahýa
2 Ýahýa
3 Ýahýa
Ýahuda
Ylham
      `),
      tuvaluan: buildTranslationMap(`
Jenese
Esoto
Levitiko
Numera
Teuteronome
Iosua
Faka-fili
Ruta
1 Samuela
2 Samuela
1 Tupu
2 Tupu
1 Nofoaiga
2 Nofoaiga
Esera
Nehemia
Eseta
Iopu
Salamo
Faataoto
Failauga
Pese a Solomona
Isaia
Ieremia
Tagila
Esekielu
Taniela
Hosea
Ioelu
Amosa
Opadia
Iona
Mika
Nahuma
Apakuka
Sefania
Hakai
Sakaria
Malaki
Mataio
Mareko
Luka
Ioane
Galuega
Roma
1 Korinito
2 Korinito
Kalatia
Efeso
Filipi
Kolose
1 Tesalonika
2 Tesalonika
1 Timoteo
2 Timoteo
Tito
Filemona
Heperu
Iakopo
1 Peteru
2 Peteru
1 Ioane
2 Ioane
3 Ioane
Iuda
Faka-asiga
      `),
      twi: buildTranslationMap(`
Genesis
Exodus
Leviticus
Numbers
Deuteronomy
Joshua
Atemmufo
Ruth
1 Samuel
2 Samuel
1 Ahene
2 Ahene
1 Beresidi
2 Beresidi
Ezra
Nehemiah
Esther
Job
Dwom
Mmebusɛm
Ɔsɛnkafo
Solomonn Dwom
Yesaia
Yeremia
Kwadwom
Hesekiel
Daniel
Hosea
Joel
Amos
Obadia
Jona
Mika
Nahum
Habakuk
Sefania
Hagai
Sakaria
Malaki
Mateo
Marko
Luka
Yohane
Nnwuma
Romafo
1 Korintofo
2 Korintofo
Galatiafo
Efesofo
Filipifo
Kolosefo
1 Tesalonikafo
2 Tesalonikafo
1 Timoteo
2 Timoteo
Tito
Filemon
Hebrifo
Yakobo
1 Petro
2 Petro
1 Yohane
2 Yohane
3 Yohane
Yuda
Nyansatumi
      `),
      ukrainian: buildTranslationMap(`
Буття
Вихід
Левит
Числа
Повторення Закону
Ісус Навин
Судді
Рут
1 Самуїла
2 Самуїла
1 Царів
2 Царів
1 Хронік
2 Хронік
Ездра
Неемія
Естер
Йов
Псалми
Приповісті
Екклезіяст
Пісня над піснями
Ісая
Єремія
Плач Єремії
Єзекіїль
Даниїл
Осія
Йоїл
Амос
Овдій
Йона
Михей
Наум
Авакум
Софонія
Огій
Захарія
Малахія
Матвій
Марко
Лука
Іван
Дії Апостолів
Римлян
1 Коринтян
2 Коринтян
Галатів
Ефесян
Филип'ян
Колосян
1 Солунян
2 Солунян
1 Тимофія
2 Тимофія
Тита
Филимона
Євреїв
Якова
1 Петра
2 Петра
1 Івана
2 Івана
3 Івана
Юди
Об'явлення
      `),
      umbundu: buildTranslationMap(`
Efetikilo
Esodu
Levitiko
Atendelo
Elivulu Lietendelo
Josue
Olondingupopia
Ruta
1 Samuele
2 Samuele
1 Olosoma
2 Olosoma
1 Asapulo
2 Asapulo
Esdra
Nehemiya
Estere
Jobe
Olosamo
Olosapo
Ukunumi
Ocili
Isaya
Yeremiya
Alasi
Hesekiele
Daniele
Oseya
Yowele
Amosi
Ovadiya
Yona
Mika
Nahumu
Habakuku
Sefaniya
Hagai
Sakariya
Malakiya
Mateo
Marko
Luka
Yoano
Ovilinga
Aroma
1 Akorinto
2 Akorinto
Agalatiya
Aefeso
Afilipi
Akolose
1 Atesalonika
2 Atesalonika
1 Timoteo
2 Timoteo
Tito
Filemona
Vaheberu
Tiago
1 Petulu
2 Petulu
1 Yoano
2 Yoano
3 Yoano
Yuda
Esituluilo
      `),
      urdu: buildTranslationMap(`
پیدائش
خروج
لاویان
گنتی
استثنا
یوشع
قضاۃ
روت
1 سموئیل
2 سموئیل
1 سلاطین
2 سلاطین
1 تواریخ
2 تواریخ
عزرا
نحمیاہ
استیر
ایوب
زبور
امثال
واعظ
غزل الغزلات
یسعیاہ
یرمیاہ
نوحہ
حزقیال
دانیال
ہوشع
یایل
عاموس
عبدیاہ
یونس
میکاہ
ناحوم
حبقوق
صفنیاہ
حجی
زکریاہ
ملاکی
متی
مرقس
لوقا
یوحنا
اعمال
رومیوں
1 کرنتھیوں
2 کرنتھیوں
گلتیوں
افسیوں
فلپیوں
کلسیوں
1 تھسلنیکیوں
2 تھسلنیکیوں
1 تیموتھی
2 تیموتھی
ططس
فلیمون
عبرانیوں
یعقوب
1 پطرس
2 پطرس
1 یوحنا
2 یوحنا
3 یوحنا
یہوداہ
مکاشفہ
      `),
      uzbek: buildTranslationMap(`
Ibtido
Chiqish
Levit
Sonlar
Qonunlar
Yoshua
Hakamlar
Rut
1 Samuel
2 Samuel
1 Podshohlar
2 Podshohlar
1 Solnomalar
2 Solnomalar
Ezra
Nehemiyo
Esta
Ayub
Zaburlar
Hikmatlar
Voiz
Qo'shiqlar qo'shig'i
Isaiyo
Yeremiyo
Marsiyalar
Hizqiyo
Doniyor
Ho'sheya
Yoel
Amos
Obadiyo
Yunus
Miko
Nahum
Habakkuk
Zafaniyo
Haggay
Zakariyo
Malaki
Matto
Mark
Luqo
Yuhanno
Rasullar
Rimliklar
1 Korinfliklar
2 Korinfliklar
Galatiyaliklar
Efesliklar
Filippiliklar
Kolosaliklar
1 Salonikaliklar
2 Salonikaliklar
1 Timo'tiy
2 Timo'tiy
Titus
Filimun
Ibroniylar
Yoqub
1 Petr
2 Petr
1 Yuhanno
2 Yuhanno
3 Yuhanno
Yuda
Vahiy
      `),
      vietnamese: buildTranslationMap(`
Sáng thế ký
Xuất hành
Lê-vi
Dân số
Đệ nhị luật
Giô-suê
Các quan xét
Ru-tơ
1 Sa-mu-ên
2 Sa-mu-ên
1 Các vua
2 Các vua
1 Sử ký
2 Sử ký
Ê-xơ-ra
Nê-hê-mi
Ê-xơ-tê
Gióp
Thánh vịnh
Châm ngôn
Giảng viên
Diệu ca
I-sai-a
Giê-rê-mi
Ca vịnh
Ê-zê-ki-ên
Đa-ni-ên
Hô-sê
Giô-ên
A-mốt
Áp-đia
Giô-na
Mi-kha
Na-hum
Ha-ba-cúc
Xô-phô-ni
Ha-gai
Xa-cha-ri
Ma-la-chi
Ma-thi-ơ
Mác
Lu-ca
Gio-an
Công vụ
Rô-ma
1 Cô-rinh-tô
2 Cô-rinh-tô
Ga-la-ti
Ê-phê-sô
Phi-líp
Cô-lô-se
1 Tê-sa-lô-ni-ca
2 Tê-sa-lô-ni-ca
1 Ti-mô-thê
2 Ti-mô-thê
Tít
Phi-lê-môn
Do Thái
Gia-cơ
1 Phi-e-rơ
2 Phi-e-rơ
1 Gio-an
2 Gio-an
3 Gio-an
Giu-đa
Khải huyền
      `),
      waray: buildTranslationMap(`
Genesis
Exodo
Levitico
Numero
Deuteronomio
Josue
Mga Hukom
Rut
1 Samuel
2 Samuel
1 Mga Hadi
2 Mga Hadi
1 Cronicas
2 Cronicas
Esdras
Nehemias
Ester
Job
Salmos
Proverbios
Ecclesiastes
Cantares
Isaias
Jeremias
Lamentaciones
Ezequiel
Daniel
Oseas
Joel
Amos
Obadias
Jonas
Miqueas
Nahum
Habacuc
Sofonias
Hageo
Zacarias
Malaquias
Mateo
Marcos
Lucas
Juan
Mga Buhat
Roma
1 Corinto
2 Corinto
Galacia
Efeso
Filipos
Colosas
1 Tesalonica
2 Tesalonica
1 Timoteo
2 Timoteo
Tito
Filemon
Hebreo
Santiago
1 Pedro
2 Pedro
1 Juan
2 Juan
3 Juan
Judas
Pahayag
      `),
      welsh: buildTranslationMap(`
Genesis
Exodus
Lefiticus
Numeri
Deuteronomium
Josua
Barnwyr
Ruth
1 Samuel
2 Samuel
1 Brenhinoedd
2 Brenhinoedd
1 Cronicl
2 Cronicl
Esra
Nehemia
Esther
Job
Salmau
Diarhebion
Pregethwr
Can Solomon
Eseia
Jeremeia
Galarnad
Eseciel
Daniel
Hosea
Joel
Amos
Obadia
Jona
Michea
Nahum
Habacuc
Seffania
Haggai
Secharia
Malachi
Mathew
Marc
Luc
Ioan
Actau
Rhufeiniaid
1 Corinthiaid
2 Corinthiaid
Galatiaid
Effesiaid
Philipiaid
Colosiaid
1 Thesaloniaid
2 Thesaloniaid
1 Timotheus
2 Timotheus
Titus
Philemon
Hebreaid
Iago
1 Pedr
2 Pedr
1 Ioan
2 Ioan
3 Ioan
Jid
Datguddiad
      `),
      wolof: buildTranslationMap(`
Genesis
Eksodus
Lewitikus
Numbars
Dewteronóm
Yosua
Àttekaat yi
Rit
1 Samwil
2 Samwil
1 Buur yi
2 Buur yi
1 Kronig yi
2 Kronig yi
Esdras
Nehemi
Ester
Yob
Saboor yi
Léeb yi
Kolet
Woy wi gën a rafet
Esayi
Yeremi
Jooy yi
Esekiyel
Danyel
Ose
Sowèl
Amos
Obadi
Yonus
Mike
Naum
Abakuk
Sofoni
Age
Sakari
Malaki
Macë
Mark
Hug
Yan
Jëf yi
Room
1 Korent
2 Korent
Galat
Efes
Filip
Kolos
1 Tesalonik
2 Tesalonik
1 Timote
2 Timote
Tit
Filemoŋ
Ebre
Saag
1 Piyeer
2 Piyeer
1 Yan
2 Yan
3 Yan
Yud
Peeñu bi
      `),
      xhosa: buildTranslationMap(`
iGenesis
ieksodus
iLevitikus
iNumeri
iDuteronomi
uYoshuwa
aba-Ahluli
uRuti
1 kaSamuele
2 kaSamuele
1 kooKumkani
2 kooKumkani
1 miba-Lise
2 miba-Lise
uEsra
uNehemiya
uEstere
uYobi
iiNdumiso
imi-Zekeliso
uMshumayeli
iNgoma yeeNgoma
uIsaya
uYeremiya
isi-Lilo
uHezekile
uDaniyeli
uHoseya
uYoweli
uAmosi
uObadiya
uYona
uMika
uNahumu
uHabakuku
uZefaniya
uHagayi
uZekariya
uMalaki
uMateyu
uMarko
uLuka
uYohane
iZenzo
kwabase-Roma
1 baseKorinte
2 baseKorinte
baseGalati
base-Efese
baseFilipi
baseKolose
1 baseTesalonika
2 baseTesalonika
1 kaTimoti
2 kaTimoti
uTito
uFilemon
ka-Hebhere
uYakobi
1 kaPetros
2 kaPetros
1 kaYohane
2 kaYohane
3 kaYohane
uYuda
isi-Tyhilelo
      `),
      yiddish: buildTranslationMap(`
בראשית
שמות
ויקרא
במדבר
דברים
יהושע
שופטים
רות
שמואל א
שמואל ב
מלכים א
מלכים ב
דברי הימים א
דברי הימים ב
עזרא
נחמיה
אסתר
איוב
תהילים
משלי
קהלת
שיר השירים
ישעיהו
ירמיהו
איכה
יחזקאל
דניאל
הושע
יואל
עמוס
עובדיה
יונה
מיכה
נחום
חבקוק
צפניה
חגי
זכריה
מלאכי
מתי
מרקוס
לוקס
יוחנן
מעשי השליחים
רומאים
קורינתים א
קורינתים ב
גלטים
אפסים
פיליפים
קולוסים
תסלוניקים א
תסלוניקים ב
טימותיאוס א
טימותיאוס ב
טיטוס
פילמון
עברים
יעקב
פטרוס א
פטרוס ב
יוחנן א
יוחנן ב
יוחנן ג
יהודה
התגלות
      `),
      yoruba: buildTranslationMap(`
Jẹ́nẹ́sísì
Ẹ́kísódù
Léfítíkù
Nọ́ńbà
Diutarónómì
Jósúà
Àwọn Onídàájọ́
Rúùtù
1 Sámúẹ́lì
2 Sámúẹ́lì
1 Àwọn Ọba
2 Àwọn Ọba
1 Kíróníkà
2 Kíróníkà
Ẹ́sírà
Nèhemáyà
Ẹ́sítà
Jóbù
Sáàmù
Òwe
Oníwàásù
Orin Sólómọ́nì
Àìsáyà
Jeremáyà
Ẹkún Jeremáyà
Ẹ́síkíẹ́lì
Dáníẹ́lì
Hósíà
Jọ́ẹ́lì
Ámọ́sì
Ọbadáyà
Jónà
Míkà
Náhúmù
Hábákúkù
Sẹfánáyà
Hágáì
Sèkaráyà
Málákì
Mátíù
Máàkù
Lúùkù
Jòhánù
Ìṣe Àwọn Àpọ́sítélì
Róòmù
1 Kọ́ríńtì
2 Kọ́ríńtì
Gálátíà
Éfésù
Fílípì
Kólósè
1 Tẹsalóníkà
2 Tẹsalóníkà
1 Tímótì
2 Tímótì
Títù
Fílímọ́nì
Héberù
Jákọ́bù
1 Pétérù
2 Pétérù
1 Jòhánù
2 Jòhánù
3 Jòhánù
Júdà
Ìfihàn
      `),
      zulu: buildTranslationMap(`
uGenesisi
u-Eksodusi
uLevitikhusi
uNumeri
uDuteronomi
uJoshuwa
abaHluli
uRuti
1 kaSamuweli
2 kaSamuweli
1 amaKhosi
2 amaKhosi
1 emiLando
2 emiLando
u-Ezra
uNehemiya
u-Esteri
uJobe
amaHubo
izAga
umShumayeli
isiHlabelelo seziHlabelelo
u-Isaya
uJeremiya
isiLilo
uHezekiyeli
uDaniyeli
uHoseya
uJoweli
u-Amosi
u-Obadiya
uJona
uMika
uNahumu
uHabakuku
uZefaniya
uHagayi
uZekariya
uMalaki
uMathewu
uMarku
uLuka
uJohane
imiSebenzi
kwabaseRoma
1 kwabaseKorinte
2 kwabaseKorinte
kwabaseGalathiya
kwabase-Efesu
kwabaseFilipi
kwabaseKholose
1 kwabaseThesalonika
2 kwabaseThesalonika
1 kuThimothewu
2 kuThimothewu
uThitusi
uFilimoni
kwabaHebheru
uJakobe
1 kaPhetro
2 kaPhetro
1 kaJohane
2 kaJohane
3 kaJohane
uJuda
isiSembulo
      `),
      haitian: {
        1:"Jenèz",2:"Egzòd",3:"Levitik",4:"Nonm",5:"Deteronòm",6:"Jozye",7:"Jidj",8:"Rit",9:"1 Samyèl",10:"2 Samyèl",11:"1 Wa",12:"2 Wa",13:"1 Kwonik",14:"2 Kwonik",15:"Esdras",16:"Neemi",17:"Estè",18:"Jòb",19:"Sòm",20:"Pwovèb",21:"Eklezyas",22:"Chante tout chante",23:"Ezayi",24:"Jeremi",25:"Lamantasyon",26:"Ezekyèl",27:"Danyèl",28:"Oze",29:"Jowèl",30:"Amòs",31:"Abdias",32:"Jonas",33:"Miche",34:"Nawoum",35:"Abakik",36:"Sofoni",37:"Aje",38:"Zakari",39:"Malachi",40:"Matye",41:"Mak",42:"Lik",43:"Jan",44:"Travay Apòt yo",45:"Women",46:"1 Korent",47:"2 Korent",48:"Galat",49:"Efez",50:"Filip",51:"Kolòs",52:"1 Tesalonik",53:"2 Tesalonik",54:"1 Timote",55:"2 Timote",56:"Tit",57:"Filemon",58:"Ebre",59:"Jak",60:"1 Pyè",61:"2 Pyè",62:"1 Jan",63:"2 Jan",64:"3 Jan",65:"Jid",66:"Revelasyon"
      },
      fulfulde: {
        1:"Fuɗɗorde",2:"Eggol",3:"Lewinkon",4:"Limngal",5:"Dankino",6:"Yosuwa",7:"Ñaawooɓe",8:"Ruuta",9:"1 Samuyila",10:"2 Samuyila",11:"1 Laamiiɓe",12:"2 Laamiiɓe",13:"1 Taariiki",14:"2 Taariiki",15:"Esdra",16:"Nehemiya",17:"Esta",18:"Ayuba",19:"Jabuura",20:"Balndu",21:"Waajotooɗo",22:"Gimɗi gimɗi",23:"Esaya",24:"Yeremiya",25:"Boyli",26:"Esekiyela",27:"Daniyela",28:"Oseya",29:"Yowila",30:"Amosi",31:"Obadiya",32:"Yunusa",33:"Mika",34:"Nahuma",35:"Habakuka",36:"Sofoniya",37:"Haggaya",38:"Sakariya",39:"Malakiya",40:"Matta",41:"Marku",42:"Luka",43:"Yuhanna",44:"Golle",45:"Romi'en",46:"1 Korinti'en",47:"2 Korinti'en",48:"Galati'en",49:"Efesi'en",50:"Filipi'en",51:"Kolosi'en",52:"1 Tesaloniki'en",53:"2 Tesaloniki'en",54:"1 Timote",55:"2 Timote",56:"Titu",57:"Filimon",58:"Ibirani'en",59:"Yakuuba",60:"1 Piyer",61:"2 Piyer",62:"1 Yuhanna",63:"2 Yuhanna",64:"3 Yuhanna",65:"Yuda",66:"Hollitaare"
      },
      gaelic: {
        1:"Genesis",2:"Exodus",3:"Leviticus",4:"Numbers",5:"Deuteronomy",6:"Joshua",7:"Judges",8:"Ruth",9:"1 Samuel",10:"2 Samuel",11:"1 Kings",12:"2 Kings",13:"1 Chronicles",14:"2 Chronicles",15:"Ezra",16:"Nehemiah",17:"Esther",18:"Job",19:"Psalms",20:"Proverbs",21:"Ecclesiastes",22:"Song of Solomon",23:"Isaiah",24:"Jeremiah",25:"Lamentations",26:"Ezekiel",27:"Daniel",28:"Hosea",29:"Joel",30:"Amos",31:"Obadiah",32:"Jonah",33:"Micah",34:"Nahum",35:"Habakkuk",36:"Zephaniah",37:"Haggai",38:"Zechariah",39:"Malachi",40:"Matthew",41:"Mark",42:"Luke",43:"John",44:"Acts",45:"Romans",46:"1 Corinthians",47:"2 Corinthians",48:"Galatians",49:"Ephesians",50:"Philippians",51:"Colossians",52:"1 Thessalonians",53:"2 Thessalonians",54:"1 Timothy",55:"2 Timothy",56:"Titus",57:"Philemon",58:"Hebrews",59:"James",60:"1 Peter",61:"2 Peter",62:"1 John",63:"2 John",64:"3 John",65:"Jude",66:"Revelation"
      },
      galician: {
        1:"Xénese",2:"Éxodo",3:"Levítico",4:"Números",5:"Deuteronomio",6:"Xosué",7:"Xuíces",8:"Rut",9:"1 Samuel",10:"2 Samuel",11:"1 Reis",12:"2 Reis",13:"1 Crónicas",14:"2 Crónicas",15:"Esdras",16:"Nehemías",17:"Ester",18:"Job",19:"Salmos",20:"Proverbios",21:"Eclesiastés",22:"Cantar dos Cantares",23:"Isaías",24:"Xeremías",25:"Lamentacións",26:"Ezequiel",27:"Daniel",28:"Oseas",29:"Xoel",30:"Amós",31:"Abdías",32:"Xonás",33:"Miqueas",34:"Naúm",35:"Habacuc",36:"Sofonías",37:"Axeo",38:"Zacarías",39:"Malaquías",40:"Mateo",41:"Marcos",42:"Lucas",43:"Xoán",44:"Feitos",45:"Romanos",46:"1 Corintios",47:"2 Corintios",48:"Gálatas",49:"Efesios",50:"Filipenses",51:"Colosenses",52:"1 Tesalonicenses",53:"2 Tesalonicenses",54:"1 Timoteo",55:"2 Timoteo",56:"Tito",57:"Filemón",58:"Hebreos",59:"Santiago",60:"1 Pedro",61:"2 Pedro",62:"1 Xoán",63:"2 Xoán",64:"3 Xoán",65:"Xudas",66:"Apocalipse"
      },
      fr: {
        1:"Genèse",2:"Exode",3:"Lévitique",4:"Nombres",5:"Deutéronome",6:"Josué",7:"Juges",8:"Ruth",9:"1 Samuel",10:"2 Samuel",11:"1 Rois",12:"2 Rois",13:"1 Chroniques",14:"2 Chroniques",15:"Esdras",16:"Néhémie",17:"Esther",18:"Job",19:"Psaumes",20:"Proverbes",21:"Ecclésiaste",22:"Cantique des Cantiques",23:"Ésaïe",24:"Jérémie",25:"Lamentations",26:"Ézéchiel",27:"Daniel",28:"Osée",29:"Joël",30:"Amos",31:"Abdias",32:"Jonas",33:"Michée",34:"Nahum",35:"Habacuc",36:"Sophonie",37:"Aggée",38:"Zacharie",39:"Malachie",40:"Matthieu",41:"Marc",42:"Luc",43:"Jean",44:"Actes",45:"Romains",46:"1 Corinthiens",47:"2 Corinthiens",48:"Galates",49:"Éphésiens",50:"Philippiens",51:"Colossiens",52:"1 Thessaloniciens",53:"2 Thessaloniciens",54:"1 Timothée",55:"2 Timothée",56:"Tite",57:"Philémon",58:"Hébreux",59:"Jacques",60:"1 Pierre",61:"2 Pierre",62:"1 Jean",63:"2 Jean",64:"3 Jean",65:"Jude",66:"Apocalypse"
      },
      hi: {
        1:"उत्पत्ति",2:"निर्गमन",3:"लैव्यव्यवस्था",4:"गिनती",5:"व्यवस्थाविवरण",6:"यहोशू",7:"न्यायियों",8:"रूत",9:"1 शमूएल",10:"2 शमूएल",11:"1 राजा",12:"2 राजा",13:"1 इतिहास",14:"2 इतिहास",15:"एज्रा",16:"नहेम्याह",17:"एस्तेर",18:"अय्यूब",19:"भजन संहिता",20:"नीतिवचन",21:"सभोपदेशक",22:"श्रेष्ठगीत",23:"यशायाह",24:"यिर्मयाह",25:"विलापगीत",26:"यहेजकेल",27:"दानिय्येल",28:"होशे",29:"योएल",30:"आमोस",31:"ओबद्याह",32:"योना",33:"मीका",34:"नहूम",35:"हबक्कूक",36:"सपन्याह",37:"हाग्गै",38:"जकर्याह",39:"मलाकी",40:"मत्ती",41:"मरकुस",42:"लूका",43:"यूहन्ना",44:"प्रेरितों के काम",45:"रोमियों",46:"1 कुरिन्थियों",47:"2 कुरिन्थियों",48:"गलातियों",49:"इफिसियों",50:"फिलिप्पियों",51:"कुलुस्सियों",52:"1 थिस्सलुनीकियों",53:"2 थिस्सलुनीकियों",54:"1 तीमुथियुस",55:"2 तीमुथियुस",56:"तीतुस",57:"फिलेमोन",58:"इब्रानियों",59:"याकूब",60:"1 पतरस",61:"2 पतरस",62:"1 यूहन्ना",63:"2 यूहन्ना",64:"3 यूहन्ना",65:"यहूदा",66:"प्रकाशितवाक्य"
      }
    };
    function persistModeSettings() {
      if (!stateReady || isRestoringBackup) {
        pendingModePersist = true;
        return;
      }
      const snapshot = getModeSettingsSnapshot();
      if (!snapshot) return;
      const payload = { key: 'modeSettings', value: snapshot, updatedAt: Date.now() };
      idbPut(STORE_STATE, payload).catch(() => {});
    }

    function schedulePersistModeSettings() {
      if (!stateReady || isRestoringBackup) {
        pendingModePersist = true;
        return;
      }
      clearTimeout(modeSaveTimer);
      modeSaveTimer = setTimeout(() => {
        persistModeSettings();
      }, 500);
    }

    function persistBackgroundState() {
      if (!stateReady || isRestoringBackup) {
        pendingBgPersist = true;
        return;
      }
      const snapshot = getBackgroundSnapshot();
      if (!snapshot) return;
      const payload = { key: 'bgSettings', value: snapshot, updatedAt: Date.now() };
      idbPut(STORE_STATE, payload).catch(() => {});
    }

    function schedulePersistBackground() {
      if (!stateReady || isRestoringBackup) {
        pendingBgPersist = true;
        return;
      }
      clearTimeout(bgSaveTimer);
      bgSaveTimer = setTimeout(() => {
        persistBackgroundState();
      }, 500);
    }

      // Theme switching logic
      function handleThemeChange() {
        const select = document.getElementById('theme-select');
        const rawTheme = select.value;
        const theme = normalizeThemeId(rawTheme);
        if (theme !== rawTheme) select.value = theme;
        const root = document.documentElement;
        /* Set theme identifier for theme-specific CSS */
        root.setAttribute('data-theme', theme);
        /* Persist theme name for other windows */
        try { localStorage.setItem('bible_app_current_theme', theme); } catch(_) {}
        /* Persist theme for splash screen on next launch */
        try { if (window.BSPDesktop && window.BSPDesktop.saveTheme) window.BSPDesktop.saveTheme(theme); } catch(_) {}
        /* Set light/dark mode attribute for CSS overrides */
        const isLight = (theme === 'liquid-glass' || theme === 'paperlight');
        if (isLight) {
          root.setAttribute('data-theme-mode', 'light');
        } else {
          root.removeAttribute('data-theme-mode');
          /* Reset material variables to dark defaults when switching back */
          root.style.setProperty('--material-chrome', 'rgba(30, 30, 30, 0.78)');
          root.style.setProperty('--material-thin', 'rgba(44, 44, 46, 0.6)');
          root.style.setProperty('--material-thick', 'rgba(28, 28, 30, 0.92)');
          root.style.setProperty('--material-ultrathin', 'rgba(255, 255, 255, 0.03)');
          root.style.setProperty('--text-tertiary', '#6e6e73');
          root.style.setProperty('--border-elevated', 'rgba(255, 255, 255, 0.12)');
          root.style.setProperty('--danger', '#ff453a');
          root.style.setProperty('--success', '#30d158');
          root.style.setProperty('--warning', '#ffd60a');
        }
        switch (theme) {
          case 'dark':
            const darkColor = '#101010';
            root.style.setProperty('--bg-dark', darkColor);
            root.style.setProperty('--bg-panel', darkColor);
            root.style.setProperty('--accent', darkColor);
            root.style.setProperty('--accent-light', darkColor);
            root.style.setProperty('--accent-dark', darkColor);
            root.style.setProperty('--text', '#e0e0e0');
            root.style.setProperty('--text-secondary', '#b0b0b0');
            root.style.setProperty('--border', '#2a2a2a');
            root.style.setProperty('--panel-content-bg', darkColor);
            root.style.setProperty('--panel-section-bg', 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))');
            root.style.setProperty('--section-label-color', '#ffffff');
            root.style.setProperty('--settings-footer-color', '#e0e0e0');
            root.style.setProperty('--settings-footer-link-color', '#e0e0e0');
            root.style.setProperty('--tab-active-color', '#0ea5e9');
            root.style.setProperty('--button-border', 'rgba(255, 255, 255, 0.18)');
            root.style.setProperty('--button-live-border', 'rgba(248, 113, 113, 0.8)');
            root.style.setProperty('--button-shadow', 'rgba(255, 255, 255, 0.16)');
            root.style.setProperty('--header-toolbar-bg', darkColor);
            root.style.setProperty('--activity-bar-bg', darkColor);
            root.style.setProperty('--body-bg', darkColor);
            root.style.setProperty('--body-radial', 'none');
            root.style.setProperty('--studio-dock-bg', darkColor);
            root.style.setProperty('--footer-bar-bg', darkColor);
            root.style.setProperty('--studio-pane-bg', darkColor);
            root.style.setProperty('--studio-pane-title-bg', '#1a1a1a');
            root.style.setProperty('--program-panel-bg', darkColor);
            break;
          case 'thamar-black':
            root.style.setProperty('--bg-dark', '#181818');
            root.style.setProperty('--bg-panel', '#1e1e1e');
            root.style.setProperty('--accent', '#2C5B85');
            root.style.setProperty('--accent-light', '#3a7ab5');
            root.style.setProperty('--accent-dark', '#1e4060');
            root.style.setProperty('--text', '#e0e0e0');
            root.style.setProperty('--text-secondary', '#868686');
            root.style.setProperty('--border', '#2a2a2a');
            root.style.setProperty('--panel-content-bg', '#1e1e1e');
            root.style.setProperty('--panel-section-bg', 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))');
            root.style.setProperty('--section-label-color', '#3a7ab5');
            root.style.setProperty('--settings-footer-color', '#868686');
            root.style.setProperty('--settings-footer-link-color', '#3a7ab5');
            root.style.setProperty('--tab-active-color', '#3a7ab5');
            root.style.setProperty('--button-border', 'rgba(134, 134, 134, 0.3)');
            root.style.setProperty('--button-live-border', 'rgba(248, 113, 113, 0.7)');
            root.style.setProperty('--button-shadow', 'rgba(0, 0, 0, 0.4)');
            root.style.setProperty('--header-toolbar-bg', '#1e1e1e');
            root.style.setProperty('--header-btn-bg', '#252525');
            root.style.setProperty('--activity-bar-bg', '#141414');
            root.style.setProperty('--body-bg', '#181818');
            root.style.setProperty('--body-radial', 'none');
            root.style.setProperty('--studio-dock-bg', '#1e1e1e');
            root.style.setProperty('--footer-bar-bg', '#141414');
            root.style.setProperty('--studio-pane-bg', '#1a1a1a');
            root.style.setProperty('--studio-pane-title-bg', '#1e1e1e');
            root.style.setProperty('--program-panel-bg', '#181818');
            break;
          case 'sunset':
            root.style.setProperty('--bg-dark', '#2c1a1a');
            root.style.setProperty('--bg-panel', '#3b2323');
            root.style.setProperty('--accent', '#ff7e5f');
            root.style.setProperty('--accent-light', '#feb47b');
            root.style.setProperty('--accent-dark', '#b24592');
            root.style.setProperty('--text', '#fff4e6');
            root.style.setProperty('--text-secondary', '#ffd6b3');
            root.style.setProperty('--border', '#b24592');
            root.style.setProperty('--panel-content-bg', '#3b2323');
            root.style.setProperty('--panel-section-bg', 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02))');
            root.style.setProperty('--section-label-color', '#ffffff');
            root.style.setProperty('--tab-active-color', '#feb47b');
            root.style.setProperty('--button-border', 'rgba(255, 255, 255, 0.12)');
            root.style.setProperty('--button-live-border', 'rgba(255, 255, 255, 0.7)');
            root.style.setProperty('--button-shadow', 'rgba(255, 255, 255, 0.1)');
            root.style.setProperty('--header-toolbar-bg', '#3b2323');
            root.style.setProperty('--activity-bar-bg', 'linear-gradient(180deg, #2c1a1a, #231414)');
            root.style.setProperty('--body-bg', 'linear-gradient(180deg, #2c1a1a 0%, #1e1212 100%)');
            root.style.setProperty('--body-radial', 'radial-gradient(1200px 700px at 10% -20%, rgba(255, 126, 95, 0.1), transparent 55%)');
            root.style.setProperty('--studio-dock-bg', '#3b2323');
            root.style.setProperty('--footer-bar-bg', '#2c1a1a');
            root.style.setProperty('--studio-pane-bg', '#321e1e');
            root.style.setProperty('--studio-pane-title-bg', '#3b2323');
            root.style.setProperty('--program-panel-bg', 'linear-gradient(180deg, #2c1a1a, #231414)');
            break;
          case 'neon-horizon':
            root.style.setProperty('--bg-dark', '#111d1a');
            root.style.setProperty('--bg-panel', '#162923');
            root.style.setProperty('--accent', '#32e0a1');
            root.style.setProperty('--accent-light', '#7af7d0');
            root.style.setProperty('--accent-dark', '#148a64');
            root.style.setProperty('--text', '#e8fff7');
            root.style.setProperty('--text-secondary', '#9ad9c6');
            root.style.setProperty('--border', '#239d7a');
            root.style.setProperty('--panel-content-bg', '#162923');
            root.style.setProperty('--panel-section-bg', 'linear-gradient(145deg, rgba(50, 224, 161, 0.14), rgba(15, 41, 34, 0.45))');
            root.style.setProperty('--section-label-color', '#7af7d0');
            root.style.setProperty('--tab-active-color', '#32e0a1');
            root.style.setProperty('--button-border', 'rgba(122, 247, 208, 0.28)');
            root.style.setProperty('--button-live-border', 'rgba(255, 116, 121, 0.72)');
            root.style.setProperty('--button-shadow', 'rgba(0, 0, 0, 0.42)');
            root.style.setProperty('--header-toolbar-bg', '#193328');
            root.style.setProperty('--activity-bar-bg', 'linear-gradient(180deg, #132720, #0f1f1a)');
            root.style.setProperty('--body-bg', 'linear-gradient(160deg, #0f1a17 0%, #142723 46%, #0d1916 100%)');
            root.style.setProperty('--body-radial', 'radial-gradient(1050px 650px at 8% -10%, rgba(50, 224, 161, 0.22), transparent 55%), radial-gradient(900px 560px at 88% 115%, rgba(38, 189, 139, 0.12), transparent 60%)');
            root.style.setProperty('--studio-dock-bg', '#172b24');
            root.style.setProperty('--footer-bar-bg', '#13231d');
            root.style.setProperty('--studio-pane-bg', '#14241f');
            root.style.setProperty('--studio-pane-title-bg', '#1a3028');
            root.style.setProperty('--program-panel-bg', 'linear-gradient(180deg, #10201b, #0c1714)');
            break;
          case 'midnight-bloom':
            root.style.setProperty('--bg-dark', '#141428');
            root.style.setProperty('--bg-panel', '#202043');
            root.style.setProperty('--accent', '#8b7bff');
            root.style.setProperty('--accent-light', '#ff6fae');
            root.style.setProperty('--accent-dark', '#5142cc');
            root.style.setProperty('--text', '#f1efff');
            root.style.setProperty('--text-secondary', '#bbb3f0');
            root.style.setProperty('--border', '#7467e8');
            root.style.setProperty('--panel-content-bg', '#202043');
            root.style.setProperty('--panel-section-bg', 'linear-gradient(145deg, rgba(139, 123, 255, 0.14), rgba(255, 111, 174, 0.10))');
            root.style.setProperty('--section-label-color', '#c8beff');
            root.style.setProperty('--tab-active-color', '#ff85bb');
            root.style.setProperty('--button-border', 'rgba(200, 190, 255, 0.32)');
            root.style.setProperty('--button-live-border', 'rgba(255, 139, 177, 0.74)');
            root.style.setProperty('--button-shadow', 'rgba(8, 5, 24, 0.52)');
            root.style.setProperty('--header-toolbar-bg', '#25234a');
            root.style.setProperty('--activity-bar-bg', 'linear-gradient(180deg, #1a1a35, #141428)');
            root.style.setProperty('--body-bg', 'linear-gradient(165deg, #121225 0%, #1d1f3f 48%, #16152f 100%)');
            root.style.setProperty('--body-radial', 'radial-gradient(1100px 640px at 12% -18%, rgba(139, 123, 255, 0.25), transparent 58%), radial-gradient(780px 520px at 84% 108%, rgba(255, 111, 174, 0.16), transparent 60%)');
            root.style.setProperty('--studio-dock-bg', '#23244a');
            root.style.setProperty('--footer-bar-bg', '#1a1a34');
            root.style.setProperty('--studio-pane-bg', '#1b1b37');
            root.style.setProperty('--studio-pane-title-bg', '#26264f');
            root.style.setProperty('--program-panel-bg', 'linear-gradient(180deg, #171735, #121227)');
            break;
          case 'liquid-glass':
            root.style.setProperty('--bg-dark', 'rgba(238, 240, 248, 0.55)');
            root.style.setProperty('--bg-panel', 'rgba(255, 255, 255, 0.38)');
            root.style.setProperty('--accent', '#007AFF');
            root.style.setProperty('--accent-light', '#409CFF');
            root.style.setProperty('--accent-dark', '#0055D4');
            root.style.setProperty('--accent-hover', '#0062CC');
            root.style.setProperty('--text', '#1c1c1e');
            root.style.setProperty('--text-secondary', '#6e6e73');
            root.style.setProperty('--text-tertiary', '#aeaeb2');
            root.style.setProperty('--border', 'rgba(255, 255, 255, 0.45)');
            root.style.setProperty('--border-elevated', 'rgba(255, 255, 255, 0.55)');
            root.style.setProperty('--panel-content-bg', 'rgba(255, 255, 255, 0.28)');
            root.style.setProperty('--panel-section-bg', 'linear-gradient(135deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0.15))');
            root.style.setProperty('--section-label-color', '#007AFF');
            root.style.setProperty('--settings-footer-color', '#6e6e73');
            root.style.setProperty('--settings-footer-link-color', '#007AFF');
            root.style.setProperty('--tab-active-color', '#007AFF');
            root.style.setProperty('--button-border', 'rgba(255, 255, 255, 0.50)');
            root.style.setProperty('--button-live-border', 'rgba(255, 59, 48, 0.65)');
            root.style.setProperty('--button-shadow', 'rgba(0, 0, 0, 0.04)');
            root.style.setProperty('--header-toolbar-bg', 'rgba(255, 255, 255, 0.35)');
            root.style.setProperty('--header-btn-bg', 'rgba(255, 255, 255, 0.32)');
            root.style.setProperty('--activity-bar-bg', 'rgba(255, 255, 255, 0.25)');
            root.style.setProperty('--body-bg', 'linear-gradient(145deg, #c7d0e0 0%, #b8c4da 30%, #d4d0e8 60%, #c2cce0 100%)');
            root.style.setProperty('--body-radial', 'radial-gradient(900px 500px at 25% 15%, rgba(120, 160, 255, 0.15), transparent 60%), radial-gradient(700px 400px at 75% 80%, rgba(200, 160, 255, 0.10), transparent 55%)');
            root.style.setProperty('--studio-dock-bg', 'rgba(255, 255, 255, 0.30)');
            root.style.setProperty('--footer-bar-bg', 'rgba(255, 255, 255, 0.28)');
            root.style.setProperty('--studio-pane-bg', 'rgba(255, 255, 255, 0.22)');
            root.style.setProperty('--studio-pane-title-bg', 'rgba(255, 255, 255, 0.35)');
            root.style.setProperty('--program-panel-bg', 'rgba(255, 255, 255, 0.18)');
            root.style.setProperty('--material-chrome', 'rgba(255, 255, 255, 0.45)');
            root.style.setProperty('--material-thin', 'rgba(255, 255, 255, 0.30)');
            root.style.setProperty('--material-thick', 'rgba(255, 255, 255, 0.55)');
            root.style.setProperty('--material-ultrathin', 'rgba(255, 255, 255, 0.08)');
            root.style.setProperty('--danger', '#ff3b30');
            root.style.setProperty('--success', '#28cd41');
            root.style.setProperty('--warning', '#ff9500');
            break;
          case 'apple-music':
            root.style.setProperty('--bg-dark', '#1c1c1e');
            root.style.setProperty('--bg-panel', '#2c2c2e');
            root.style.setProperty('--accent', '#fc3c44');
            root.style.setProperty('--accent-light', '#ff6169');
            root.style.setProperty('--accent-dark', '#d42f36');
            root.style.setProperty('--accent-hover', '#e63740');
            root.style.setProperty('--text', '#f5f5f7');
            root.style.setProperty('--text-secondary', '#98989d');
            root.style.setProperty('--text-tertiary', '#636366');
            root.style.setProperty('--border', '#3a3a3c');
            root.style.setProperty('--border-elevated', 'rgba(255, 255, 255, 0.10)');
            root.style.setProperty('--panel-content-bg', '#2c2c2e');
            root.style.setProperty('--panel-section-bg', 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)');
            root.style.setProperty('--section-label-color', '#fc3c44');
            root.style.setProperty('--settings-footer-color', '#98989d');
            root.style.setProperty('--settings-footer-link-color', '#fc3c44');
            root.style.setProperty('--tab-active-color', '#fc3c44');
            root.style.setProperty('--button-border', 'rgba(255, 255, 255, 0.12)');
            root.style.setProperty('--button-live-border', 'rgba(252, 60, 68, 0.6)');
            root.style.setProperty('--button-shadow', 'rgba(0, 0, 0, 0.35)');
            root.style.setProperty('--header-toolbar-bg', '#242426');
            root.style.setProperty('--header-btn-bg', '#323234');
            root.style.setProperty('--activity-bar-bg', '#1a1a1c');
            root.style.setProperty('--body-bg', '#1c1c1e');
            root.style.setProperty('--body-radial', 'radial-gradient(1400px 800px at 30% -10%, rgba(252, 60, 68, 0.06), transparent 55%)');
            root.style.setProperty('--studio-dock-bg', '#2c2c2e');
            root.style.setProperty('--footer-bar-bg', '#1a1a1c');
            root.style.setProperty('--studio-pane-bg', '#252527');
            root.style.setProperty('--studio-pane-title-bg', '#2c2c2e');
            root.style.setProperty('--program-panel-bg', '#202022');
            root.style.setProperty('--material-chrome', 'rgba(44, 44, 46, 0.78)');
            root.style.setProperty('--material-thin', 'rgba(50, 50, 52, 0.6)');
            root.style.setProperty('--material-thick', 'rgba(38, 38, 40, 0.92)');
            root.style.setProperty('--material-ultrathin', 'rgba(255, 255, 255, 0.03)');
            root.style.setProperty('--danger', '#ff453a');
            root.style.setProperty('--success', '#30d158');
            root.style.setProperty('--warning', '#ffd60a');
            break;
          case 'paperlight':
            root.style.setProperty('--bg-dark', '#f7f4ec');
            root.style.setProperty('--bg-panel', '#fffdf7');
            root.style.setProperty('--accent', '#b86a2f');
            root.style.setProperty('--accent-light', '#d88f52');
            root.style.setProperty('--accent-dark', '#8f4f1f');
            root.style.setProperty('--accent-hover', '#a45b28');
            root.style.setProperty('--text', '#2b2620');
            root.style.setProperty('--text-secondary', '#75685c');
            root.style.setProperty('--text-tertiary', '#a7988a');
            root.style.setProperty('--border', '#dccbb6');
            root.style.setProperty('--border-elevated', 'rgba(76, 46, 22, 0.22)');
            root.style.setProperty('--panel-content-bg', '#fffaf2');
            root.style.setProperty('--panel-section-bg', 'linear-gradient(145deg, rgba(255, 252, 246, 0.98), rgba(244, 232, 214, 0.70))');
            root.style.setProperty('--section-label-color', '#a85f2a');
            root.style.setProperty('--settings-footer-color', '#7e6f61');
            root.style.setProperty('--settings-footer-link-color', '#b86a2f');
            root.style.setProperty('--tab-active-color', '#b86a2f');
            root.style.setProperty('--button-border', 'rgba(111, 73, 38, 0.24)');
            root.style.setProperty('--button-live-border', 'rgba(199, 86, 77, 0.66)');
            root.style.setProperty('--button-shadow', 'rgba(68, 45, 24, 0.10)');
            root.style.setProperty('--header-toolbar-bg', '#f7efe2');
            root.style.setProperty('--header-btn-bg', '#f3e7d8');
            root.style.setProperty('--activity-bar-bg', '#f0e2d0');
            root.style.setProperty('--body-bg', 'linear-gradient(165deg, #f8f4eb 0%, #f2e7d6 54%, #efe0cb 100%)');
            root.style.setProperty('--body-radial', 'radial-gradient(900px 540px at 18% -12%, rgba(184, 106, 47, 0.12), transparent 58%), radial-gradient(780px 440px at 88% 110%, rgba(216, 143, 82, 0.10), transparent 60%)');
            root.style.setProperty('--studio-dock-bg', '#fffaf3');
            root.style.setProperty('--footer-bar-bg', '#efe2cf');
            root.style.setProperty('--studio-pane-bg', '#f9f1e6');
            root.style.setProperty('--studio-pane-title-bg', '#fffaf2');
            root.style.setProperty('--program-panel-bg', '#f3e8d9');
            root.style.setProperty('--material-chrome', 'rgba(255, 249, 240, 0.92)');
            root.style.setProperty('--material-thin', 'rgba(255, 250, 242, 0.72)');
            root.style.setProperty('--material-thick', 'rgba(245, 232, 214, 0.95)');
            root.style.setProperty('--material-ultrathin', 'rgba(98, 64, 37, 0.03)');
            root.style.setProperty('--danger', '#d9553f');
            root.style.setProperty('--success', '#3b9b5f');
            root.style.setProperty('--warning', '#c6862e');
            break;
          case 'skyline':
            // Skyline theme (default)
            root.style.setProperty('--bg-dark', '#0e1117');
            root.style.setProperty('--bg-panel', '#131923');
            root.style.setProperty('--accent', '#2f6df6');
            root.style.setProperty('--accent-light', '#4a86ff');
            root.style.setProperty('--accent-dark', '#1f59d4');
            root.style.setProperty('--text', '#edf2ff');
            root.style.setProperty('--text-secondary', '#a6afc2');
            root.style.setProperty('--border', '#2a3343');
            root.style.setProperty('--panel-content-bg', '#1e232d');
            root.style.setProperty('--panel-section-bg', 'linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0))');
            root.style.setProperty('--tab-active-color', '#4a86ff');
            root.style.setProperty('--button-border', 'rgba(85, 97, 121, 0.5)');
            root.style.setProperty('--button-live-border', 'rgba(248, 113, 113, 0.6)');
            root.style.setProperty('--button-shadow', 'rgba(0, 0, 0, 0.35)');
            root.style.setProperty('--section-label-color', '#4a86ff');
            root.style.setProperty('--header-toolbar-bg', '#161b24');
            root.style.setProperty('--activity-bar-bg', 'linear-gradient(180deg, #0f141d, #0b0f17)');
            root.style.setProperty('--body-bg', 'linear-gradient(180deg, #0d1016 0%, #0f1218 100%)');
            root.style.setProperty('--body-radial', 'radial-gradient(1200px 700px at 10% -20%, rgba(74, 134, 255, 0.08), transparent 55%)');
            root.style.setProperty('--studio-dock-bg', '#171f32');
            root.style.setProperty('--footer-bar-bg', '#181d27');
            root.style.setProperty('--studio-pane-bg', '#151b24');
            root.style.setProperty('--studio-pane-title-bg', '#1a212d');
            root.style.setProperty('--program-panel-bg', 'linear-gradient(180deg, #0b1020, #090e1a)');
            break;
      default:
        root.style.setProperty('--bg-dark', '#0e1117');
        root.style.setProperty('--bg-panel', '#131923');
            root.style.setProperty('--accent', '#2f6df6');
            root.style.setProperty('--accent-light', '#4a86ff');
            root.style.setProperty('--accent-dark', '#1f59d4');
            root.style.setProperty('--text', '#edf2ff');
            root.style.setProperty('--text-secondary', '#a6afc2');
            root.style.setProperty('--border', '#2a3343');
            root.style.setProperty('--panel-content-bg', '#1e232d');
            root.style.setProperty('--panel-section-bg', 'linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0))');
            root.style.setProperty('--section-label-color', '#4a86ff');
            root.style.setProperty('--tab-active-color', '#4a86ff');
            root.style.setProperty('--button-border', 'rgba(85, 97, 121, 0.5)');
            root.style.setProperty('--button-live-border', 'rgba(248, 113, 113, 0.6)');
            root.style.setProperty('--button-shadow', 'rgba(0, 0, 0, 0.35)');
        root.style.setProperty('--header-toolbar-bg', '#161b24');
            root.style.setProperty('--activity-bar-bg', 'linear-gradient(180deg, #0f141d, #0b0f17)');
            root.style.setProperty('--body-bg', 'linear-gradient(180deg, #0d1016 0%, #0f1218 100%)');
            root.style.setProperty('--body-radial', 'radial-gradient(1200px 700px at 10% -20%, rgba(74, 134, 255, 0.08), transparent 55%)');
            root.style.setProperty('--studio-dock-bg', '#171f32');
            root.style.setProperty('--footer-bar-bg', '#181d27');
            root.style.setProperty('--studio-pane-bg', '#151b24');
            root.style.setProperty('--studio-pane-title-bg', '#1a212d');
            root.style.setProperty('--program-panel-bg', 'linear-gradient(180deg, #0b1020, #090e1a)');
        break;
      }
      /* Broadcast theme to Presentation Panel and other windows */
      try {
        const themeVars = {};
        const cs = getComputedStyle(root);
        ['--bg', '--panel', '--panel-content', '--accent', '--accent-light', '--text', '--text-secondary', '--border', '--danger', '--success'].forEach(k => {
          themeVars[k] = cs.getPropertyValue(k).trim() || root.style.getPropertyValue(k).trim();
        });
        /* Also send the raw theme name so receivers can map it */
        const themeChannel = new BroadcastChannel('bible_app_theme');
        themeChannel.postMessage({ action: 'theme-change', theme, isLight: root.getAttribute('data-theme-mode') === 'light', vars: themeVars });
        themeChannel.close();
      } catch(_) {}
      saveToStorageDebounced();
    }
