    function parseSongVerseHeader(line, allowLoose = false) {
      const raw = String(line || '').trim();
      if (!raw) return null;
      let match = raw.match(/^(\d{1,3})\s*[:.,]\s*(.*)$/);
      if (match) {
        return { number: match[1], text: (match[2] || '').trim() };
      }
      match = raw.match(/^(\d{1,3})\s*$/);
      if (match) {
        return { number: match[1], text: '' };
      }
      if (allowLoose) {
        match = raw.match(/^(\d{1,3})\s+(.+)$/);
        if (match) {
          return { number: match[1], text: (match[2] || '').trim() };
        }
      }
      return null;
    }

    function normalizeSongLyricsLineBreaks(text) {
      return String(text || '').replace(/\r\n?/g, '\n');
    }

    function parseNamedSongSectionHeader(line) {
      const raw = String(line || '').trim();
      if (!raw) return null;
      const match = raw.match(/^(verse|chorus|bridge|refrain|pre[-\s]?chorus|intro|outro|tag|hook)(?:\s+(\d{1,3}|[ivxlcdm]+))?\s*[:.\-]?\s*(.*)$/i);
      if (!match) return null;
      const kind = match[1].replace(/\s+/g, ' ').replace(/^pre[-\s]?chorus$/i, 'Pre-Chorus');
      const number = (match[2] || '').trim();
      const text = (match[3] || '').trim();
      const prettyKind = kind
        .split(/[\s-]+/)
        .map(part => part ? (part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()) : '')
        .join(kind.includes('-') ? '-' : ' ');
      return {
        label: `${prettyKind}${number ? ' ' + number.toUpperCase() : ''}`.trim(),
        text
      };
    }

    function splitSongSectionLines(lines, maxLines = 6) {
      const clean = (Array.isArray(lines) ? lines : []).map(line => String(line || '').trim()).filter(Boolean);
      if (!clean.length) return [];
      const limit = Math.max(1, Number(maxLines) || 6);
      const partCount = Math.max(1, Math.ceil(clean.length / limit));
      const chunks = [];
      let offset = 0;
      for (let i = 0; i < partCount; i += 1) {
        const remainingLines = clean.length - offset;
        const remainingParts = partCount - i;
        const size = Math.ceil(remainingLines / remainingParts);
        chunks.push(clean.slice(offset, offset + size));
        offset += size;
      }
      return chunks.filter(chunk => chunk.length);
    }

    function buildSongSectionPages(filteredLines, defaultTag) {
      const fallbackTag = defaultTag || 'Lyrics';
      const normalizedText = filteredLines.join('\n').trim();
      if (!normalizedText) return [];

      const hasBracketHeaders = filteredLines.some(line => {
        const trimmed = String(line || '').trim();
        return trimmed.startsWith('[') && trimmed.endsWith(']');
      });
      const hasNamedHeaders = filteredLines.some(line => !!parseNamedSongSectionHeader(line));
      const hasNumericHeaders = filteredLines.some(line => !!parseSongVerseHeader(line, true));
      const hasBlankBreaks = filteredLines.some(line => !String(line || '').trim());

      let parseSource = normalizedText;
      if (!hasBracketHeaders && !hasNamedHeaders && !hasNumericHeaders && hasBlankBreaks) {
        parseSource = inferSectionedLyricsFromText(normalizedText);
      }

      const parseLines = normalizeSongLyricsLineBreaks(parseSource).split('\n');
      const sections = [];
      let currentTag = fallbackTag;
      let currentLines = [];
      let autoVerseNumber = 1;

      const flushSection = () => {
        const clean = currentLines.map(line => String(line || '').trim()).filter(Boolean);
        if (!clean.length) {
          currentLines = [];
          return;
        }
        sections.push({
          tag: currentTag || fallbackTag,
          lines: clean
        });
        currentLines = [];
      };

      parseLines.forEach((line) => {
        const trimmed = String(line || '').trim();
        if (!trimmed) {
          if (!hasBracketHeaders && !hasNamedHeaders && !hasNumericHeaders) {
            flushSection();
            currentTag = `Verse ${autoVerseNumber++}`;
          }
          return;
        }

        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          flushSection();
          currentTag = trimmed.slice(1, -1).trim() || fallbackTag;
          return;
        }

        const namedHeader = parseNamedSongSectionHeader(trimmed);
        if (namedHeader) {
          flushSection();
          currentTag = namedHeader.label || fallbackTag;
          if (namedHeader.text) currentLines.push(namedHeader.text);
          return;
        }

        const numericHeader = parseSongVerseHeader(trimmed, true);
        if (numericHeader) {
          flushSection();
          currentTag = `Verse ${numericHeader.number}`;
          if (numericHeader.text) currentLines.push(numericHeader.text);
          return;
        }

        if (!sections.length && !currentLines.length && !hasBracketHeaders && !hasNamedHeaders && !hasNumericHeaders && !hasBlankBreaks) {
          currentTag = fallbackTag;
        }
        currentLines.push(trimmed);
      });

      flushSection();

      if (!sections.length) {
        sections.push({
          tag: fallbackTag,
          lines: filteredLines.map(line => String(line || '').trim()).filter(Boolean)
        });
      }

      const pages = [];
      sections.forEach((section, sectionIndex) => {
        const tag = section.tag || (sectionIndex === 0 ? fallbackTag : `Verse ${sectionIndex + 1}`);
        splitSongSectionLines(section.lines, 6).forEach((chunk) => {
          pages.push({
            text: renderSongPageHtml(chunk),
            raw: chunk.join('\n'),
            tag
          });
        });
      });
      return pages;
    }

    function normalizeSongBlockKey(text) {
      return String(text || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function inferSectionedLyricsFromText(text) {
      const normalized = normalizeSongLyricsLineBreaks(text).trim();
      if (!normalized) return '';
      if (/\[[^[\]\n]{1,40}\]/.test(normalized)) return normalized;
      if (/^\s*(verse|chorus|bridge|refrain|pre-chorus|intro|outro|tag)\b/im.test(normalized)) return normalized;

      const rawBlocks = normalized
        .split(/\n\s*\n+/)
        .map(block => block.split('\n').map(line => line.trim()).filter(Boolean).join('\n'))
        .filter(Boolean);

      if (rawBlocks.length < 2) return normalized;

      const counts = new Map();
      rawBlocks.forEach((block) => {
        const key = normalizeSongBlockKey(block);
        if (!key) return;
        counts.set(key, (counts.get(key) || 0) + 1);
      });

      let chorusKey = '';
      let chorusScore = 0;
      counts.forEach((count, key) => {
        if (count < 2) return;
        const score = (key.length >= 24 ? 2 : 1) * count;
        if (score > chorusScore) {
          chorusKey = key;
          chorusScore = score;
        }
      });

      let verseNumber = 1;
      const sectioned = rawBlocks.map((block) => {
        const key = normalizeSongBlockKey(block);
        const label = chorusKey && key === chorusKey ? 'Chorus' : `Verse ${verseNumber++}`;
        return `[${label}]\n${block}`;
      });
      return sectioned.join('\n\n');
    }

    function renderSongPageHtml(linesChunk) {
      return linesChunk.map((line) => line ? convertHighlightsToHtml(line) : '&nbsp;').join('<br>');
    }

    function getBibleItemKey(item) {
      if (!item) return '';
      return `${item.version || ''}::${item.title || ''}`;
    }

    function getFirstVerseNumber(raw) {
      if (!raw) return null;
      const lines = String(raw).split('\n');
      for (const line of lines) {
        const normalized = line.replace(/^\uFEFF/, '').trimStart();
        const match = normalized.match(/^(\d+)\b/);
        if (match) return match[1];
      }
      return null;
    }

    function matchesVerseStart(raw, verseNum) {
      if (verseNum == null) return false;
      const desired = String(verseNum).trim();
      if (!desired) return false;
      const first = getFirstVerseNumber(raw);
      return !!first && String(first).trim() === desired;
    }

    function setBibleGroupAnchor(verseNum, item) {
      const key = getBibleItemKey(item);
      const value = (verseNum != null) ? String(verseNum).trim() : '';
      if (!key || !value) return false;
      bibleGroupAnchorVerse = value;
      bibleGroupAnchorKey = key;
      return true;
    }

    function getBibleGroupAnchorIndex(item, verseLines) {
      if (!verseLines.length) return 0;
      const key = getBibleItemKey(item);
      if (!bibleGroupAnchorVerse || bibleGroupAnchorKey !== key) return 0;
      const idx = verseLines.findIndex(line => matchesVerseStart(line, bibleGroupAnchorVerse));
      return idx >= 0 ? idx : 0;
    }

    function findBiblePageByVerse(pages, verseNum) {
      if (!Array.isArray(pages)) return null;
      const target = parseInt(String(verseNum || '').replace(/[^\d]/g, ''), 10);
      if (!Number.isFinite(target)) return null;
      return pages.find(page => {
        const start = parseInt(String(page.startVerse || '').replace(/[^\d]/g, ''), 10);
        if (!Number.isFinite(start)) return false;
        const count = Math.max(1, parseInt(page.verseCount || 1, 10));
        const end = start + count - 1;
        return target >= start && target <= end;
      }) || null;
    }

    const ITEM_PAGES_CACHE = new Map();
    const ITEM_PAGES_CACHE_LIMIT = 400;
    const WRAPPED_LINE_ESTIMATE_CACHE = new Map();
    const WRAPPED_LINE_ESTIMATE_CACHE_LIMIT = 500;

    function hashTextFast(value) {
      const text = String(value || '');
      let hash = 2166136261;
      for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(36);
    }

    function setBoundedCacheValue(cache, key, value, maxSize) {
      if (!cache || !key) return value;
      if (cache.has(key)) cache.delete(key);
      cache.set(key, value);
      if (cache.size > maxSize) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey != null) cache.delete(oldestKey);
      }
      return value;
    }

    function getPagesCacheKey(item, isBible, lineCountOverride) {
      if (!item) return '';
      const effectiveLinesPerPage = Math.max(1, Number(lineCountOverride) || Number(linesPerPage) || 1);
      if (item.pageSnapshot && typeof item.pageSnapshot === 'object') {
        const snapshot = item.pageSnapshot;
        return [
          'snapshot',
          item.id || item.title || '',
          snapshot.tag || '',
          snapshot.verseCount || 0,
          snapshot.startVerse || '',
          hashTextFast(snapshot.raw || snapshot.text || '')
        ].join('|');
      }
      if (isBible) {
        return [
          'bible',
          item.version || '',
          item.title || '',
          effectiveLinesPerPage,
          hashTextFast(item.content || item.text || '')
        ].join('|');
      }
      return [
        'song',
        item.id || item.title || '',
        effectiveLinesPerPage,
        shouldDisplaySongsBySection() ? 'sections' : 'flat',
        shouldShowSongSolfaNotes() ? 'solfa-on' : 'solfa-off',
        shouldShowSongCategoryName() ? 'cat-on' : 'cat-off',
        hashTextFast(item.content || item.text || '')
      ].join('|');
    }

    function getPagesFromItem(item, isBible, lineCountOverride = null) {
      if (!item) return [];
      const cacheKey = getPagesCacheKey(item, isBible, lineCountOverride);
      if (cacheKey && ITEM_PAGES_CACHE.has(cacheKey)) {
        return ITEM_PAGES_CACHE.get(cacheKey);
      }
      const effectiveLinesPerPage = Math.max(1, Number(lineCountOverride) || Number(linesPerPage) || 1);
      if (item.pageSnapshot && typeof item.pageSnapshot === 'object') {
        const snapshot = item.pageSnapshot;
        return setBoundedCacheValue(ITEM_PAGES_CACHE, cacheKey, [{
          text: snapshot.text || '',
          raw: snapshot.raw || '',
          tag: snapshot.tag || 'Scripture',
          verseCount: snapshot.verseCount || 0,
          startVerse: snapshot.startVerse || getFirstVerseNumber(snapshot.raw)
        }], ITEM_PAGES_CACHE_LIMIT);
      }
      let lines = normalizeSongLyricsLineBreaks(item.content || "").split('\n').map(l => l.trim());
      if (!isBible) {
        const filteredLines = [];
        let tag = "Lyrics";
        let categoryTag = '';
        const showSolfa = shouldShowSongSolfaNotes();
        const showCategory = shouldShowSongCategoryName();
        lines.forEach((line) => {
          if (!line) {
            if (filteredLines.length && filteredLines[filteredLines.length - 1] !== '') filteredLines.push('');
            return;
          }
          if (shouldSkipPunctuationLine(line)) return;
          if (!showSolfa && isLikelySolfaLine(line)) return;
          const categoryName = parseSongCategoryName(line);
          if (categoryName) {
            categoryTag = showCategory ? categoryName : '';
            return;
          }
          filteredLines.push(line);
        });

        if (shouldDisplaySongsBySection()) {
          return setBoundedCacheValue(
            ITEM_PAGES_CACHE,
            cacheKey,
            buildSongSectionPages(filteredLines, categoryTag || tag),
            ITEM_PAGES_CACHE_LIMIT
          );
        }

        const hasExplicitHeaders = filteredLines.some(line => {
          const trimmed = String(line || '').trim();
          if (!trimmed) return false;
          return /^(\d{1,3})\s*[:.]/.test(trimmed) || /^(\d{1,3})\s*$/.test(trimmed);
        });

        const pages = [];
        let temp = [];
        let currentTag = categoryTag || tag;
        const pushPage = (linesChunk) => {
          if (!linesChunk || !linesChunk.length) return;
          const normalizedChunk = [...linesChunk];
          while (normalizedChunk.length && !normalizedChunk[0]) normalizedChunk.shift();
          while (normalizedChunk.length && !normalizedChunk[normalizedChunk.length - 1]) normalizedChunk.pop();
          if (!normalizedChunk.length) return;
          const rawChunk = normalizedChunk.join('\n');
          pages.push({
            text: renderSongPageHtml(normalizedChunk),
            raw: rawChunk,
            tag: currentTag || "Lyrics"
          });
        };

        if (hasExplicitHeaders) {
          let verseLines = [];
          const flushVerse = () => {
            if (!verseLines.length) return;
            pushPage(verseLines);
            verseLines = [];
          };
          filteredLines.forEach((line) => {
            const trimmed = String(line || '').trim();
            if (!trimmed) {
              if (verseLines.length && verseLines[verseLines.length - 1] !== '') verseLines.push('');
              return;
            }
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
              flushVerse();
              currentTag = trimmed.slice(1, -1) || (categoryTag || "Lyrics");
              return;
            }
            const header = parseSongVerseHeader(trimmed, true);
            if (header) {
              flushVerse();
              verseLines = header.text ? [`${header.number}: ${header.text}`] : [`${header.number}:`];
              return;
            }
            if (!verseLines.length) {
              verseLines.push(trimmed);
            } else {
              verseLines.push(trimmed);
            }
          });
          flushVerse();
        } else {
          filteredLines.forEach((line) => {
            const trimmed = String(line || '').trim();
            if (!trimmed) {
              pushPage(temp);
              temp = [];
              return;
            }
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
              pushPage(temp);
              temp = [];
              currentTag = trimmed.slice(1, -1) || (categoryTag || "Lyrics");
              return;
            }
            temp.push(trimmed);
            if (temp.length >= effectiveLinesPerPage) {
              pushPage(temp);
              temp = [];
            }
          });
          pushPage(temp);
        }
        return setBoundedCacheValue(ITEM_PAGES_CACHE, cacheKey, pages, ITEM_PAGES_CACHE_LIMIT);
      } else {
        const pages = [];
        let tag = "Scripture";
        const verseLines = [];
        lines.forEach((line) => {
          if (line.startsWith('[') && line.endsWith(']')) {
            tag = line.slice(1, -1);
          } else if (line.trim()) {
            verseLines.push(line);
          }
        });

        const groupSize = effectiveLinesPerPage;
        const anchorIndex = getBibleGroupAnchorIndex(item, verseLines);
        const getSliceStartVerse = (slice) => getFirstVerseNumber(slice && slice[0]);
        let start = Math.max(0, Math.min(anchorIndex, Math.max(0, verseLines.length - 1)));
        const startIndices = [];
        while (start >= 0) {
          startIndices.push(start);
          start -= groupSize;
        }
        startIndices.reverse();
        if (startIndices.length && startIndices[0] > 0) {
          const leading = verseLines.slice(0, startIndices[0]);
          const combinedText = combineVersesIntoFlow(leading);
          pages.push({
            text: combinedText,
            raw: leading.join('\n'),
            tag,
            verseCount: leading.length,
            startVerse: getSliceStartVerse(leading)
          });
        }
        startIndices.forEach((idx) => {
          const slice = verseLines.slice(idx, idx + groupSize);
          const combinedText = combineVersesIntoFlow(slice);
          pages.push({
            text: combinedText,
            raw: slice.join('\n'),
            tag,
            verseCount: slice.length,
            startVerse: getSliceStartVerse(slice)
          });
        });
        let nextStart = startIndices.length ? (startIndices[startIndices.length - 1] + groupSize) : 0;
        while (nextStart < verseLines.length) {
          const slice = verseLines.slice(nextStart, nextStart + groupSize);
          const combinedText = combineVersesIntoFlow(slice);
          pages.push({
            text: combinedText,
            raw: slice.join('\n'),
            tag,
            verseCount: slice.length,
            startVerse: getSliceStartVerse(slice)
          });
          nextStart += groupSize;
        }

        return setBoundedCacheValue(ITEM_PAGES_CACHE, cacheKey, pages, ITEM_PAGES_CACHE_LIMIT);
      }
    }

    function combineVersesIntoFlow(verseLines) {
      let combinedText = '';
      verseLines.forEach((line, index) => {
        const verseMatch = line.match(/^(\d+)\s+(.+)$/);
        if (verseMatch) {
          const [, verseNum, verseText] = verseMatch;
          const safeText = convertHighlightsToHtml(verseText.trim());
          combinedText += `<span class="jo-verse-sup">${verseNum}</span>${safeText}`;
          if (index < verseLines.length - 1) combinedText += ' ';
        } else {
          combinedText += convertHighlightsToHtml(line);
          if (index < verseLines.length - 1) combinedText += ' ';
        }
      });
      return combinedText;
    }

    function buildStackedSongBilingualHtml(primaryHtml, secondaryHtml, secondaryScale) {
      const scale = Math.max(0.4, Math.min(1, parseFloat(secondaryScale) || DEFAULT_SONG_BILINGUAL_SETTINGS.secondaryFontScale));
      const secondaryPercent = (scale * 100).toFixed(2).replace(/\.00$/, '');
      const secondaryBlock = secondaryHtml
        ? `<div class="song-bilingual-secondary" style="margin-top:0.55em;font-size:${secondaryPercent}%;line-height:1.18;opacity:0.96">${secondaryHtml}</div>`
        : '';
      return `<div class="song-bilingual-stack">${primaryHtml}${secondaryBlock}</div>`;
    }

    function getProjectedSongTextPair(song, pageIndex, lineCountOverride = null) {
      if (!song || getIsBibleItem(song)) {
        return { primaryHtml: '', secondaryHtml: '', bilingualEnabled: false, renderMode: 'primary' };
      }
      normalizeSongTranslationState(song);
      const primaryPages = getPagesFromItem(song, false, lineCountOverride);
      const primaryPage = primaryPages[Math.max(0, Math.min(pageIndex, primaryPages.length - 1))] || primaryPages[0] || null;
      const primaryHtml = primaryPage ? (primaryPage.text || '') : '';
      const settings = getSongBilingualSettings();
      const canShowBilingual = settings.bilingualEnabled &&
        !!song.translatedLyrics.trim() &&
        String(song.translationStatus || '').toLowerCase() === 'ready';
      const displayMode = settings.displayMode || 'stacked';
      if (!canShowBilingual) {
        return { primaryHtml, secondaryHtml: '', bilingualEnabled: false, renderMode: 'primary' };
      }
      if (displayMode === 'primary') {
        return {
          primaryHtml,
          secondaryHtml: '',
          bilingualEnabled: false,
          renderMode: 'primary'
        };
      }
      const translatedSong = {
        ...song,
        content: song.translatedLyrics,
        text: song.translatedLyrics
      };
      const secondaryPages = getPagesFromItem(translatedSong, false, lineCountOverride);
      const secondaryPage = secondaryPages[Math.max(0, Math.min(pageIndex, secondaryPages.length - 1))] || secondaryPages[0] || null;
      const secondaryHtml = secondaryPage ? (secondaryPage.text || '') : '';
      if (displayMode === 'translated-only') {
        return {
          primaryHtml: secondaryHtml,
          secondaryHtml: '',
          bilingualEnabled: false,
          renderMode: 'translated-only'
        };
      }
      return {
        primaryHtml,
        secondaryHtml,
        bilingualEnabled: true,
        renderMode: 'stacked'
      };
    }
    
    function scrollButtonsToTop() {
      const container = document.getElementById('lyric-buttons');
      if (container) container.scrollTop = 0;
    }

    function isButtonInView(container, button) {
      if (!container || !button) return true;
      const cRect = container.getBoundingClientRect();
      const bRect = button.getBoundingClientRect();
      return bRect.top >= cRect.top && bRect.bottom <= cRect.bottom;
    }

    function shouldShortenBibleBooks() {
      return !!document.getElementById('shorten-bible-books')?.checked;
    }

    function shouldShortenBibleVersions() {
      return !!document.getElementById('shorten-bible-versions')?.checked;
    }

    const VERSION_PREFIX_STOPWORDS = new Set([
      'the', 'of', 'and', 'a', 'an',
      'bible', 'version', 'translation', 'edition', 'revised', 'revision', 'rev'
    ]);

    function buildVersionPrefix(tokens) {
      const words = tokens.filter(token => {
        if (!/[A-Za-z]/.test(token)) return false;
        return !VERSION_PREFIX_STOPWORDS.has(token.toLowerCase());
      });
      if (words.length < 2) return '';
      return words.slice(0, 2).map(word => word[0].toUpperCase()).join('');
    }

    function abbreviateSingleWord(word) {
      const letters = String(word || '').replace(/[^A-Za-z]/g, '');
      if (!letters) return word || '';
      if (letters.length <= 6) return letters;
      const vowels = 'aeiou';
      let abbr = letters[0];
      let foundFirstConsonant = false;
      let seenVowelAfterFirst = false;
      for (let i = 1; i < letters.length && abbr.length < 3; i++) {
        const ch = letters[i];
        const isVowel = vowels.includes(ch.toLowerCase());
        if (!foundFirstConsonant) {
          if (!isVowel) {
            abbr += ch;
            foundFirstConsonant = true;
          }
        } else if (seenVowelAfterFirst) {
          if (!isVowel) {
            abbr += ch;
            break;
          }
        } else if (isVowel) {
          seenVowelAfterFirst = true;
        }
      }
      if (abbr.length < 3) abbr = letters.slice(0, 3);
      return abbr.toUpperCase();
    }

    function shortenBibleVersionName(name) {
      if (!name || typeof name !== 'string') return name || '';
      const trimmed = name.trim();
      if (!trimmed) return trimmed;

      const lower = trimmed.toLowerCase();
      const overrides = {
        'message': 'MSG',
        'the message': 'MSG',
        'message version': 'MSG'
      };
      if (overrides[lower]) return overrides[lower];

      const parenMatch = trimmed.match(/\(([A-Za-z0-9]{2,6})\)/);
      if (parenMatch) return parenMatch[1].toUpperCase();

      const rawTokens = trimmed.split(/\s+/).filter(Boolean);
      const cleanTokens = rawTokens
        .map(token => token.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ''))
        .filter(Boolean);
      const wordTokens = cleanTokens.filter(token => /[A-Za-z]/.test(token));
      const numberTokens = cleanTokens.filter(token => /^\d+$/.test(token));

      if (
        wordTokens.length === 1 &&
        wordTokens[0].length <= 6 &&
        wordTokens.length + numberTokens.length === cleanTokens.length
      ) {
        return wordTokens[0];
      }

      if (trimmed.length <= 6) return trimmed;

      const tokenAcronym = cleanTokens.find(token =>
        /^[A-Z0-9]{2,6}$/.test(token) && /[A-Z]/.test(token)
      );
      let embeddedAcronym = '';
      const embeddedMatches = trimmed.match(/[A-Z]{2,6}/g);
      if (embeddedMatches && embeddedMatches.length) embeddedAcronym = embeddedMatches[0];
      const acronym = tokenAcronym || embeddedAcronym;
      if (acronym) {
        const idx = cleanTokens.findIndex(token => token.includes(acronym));
        const prefix = idx > 0 ? buildVersionPrefix(cleanTokens.slice(0, idx)) : '';
        if (prefix) return `${prefix}. ${acronym}`;
        return acronym;
      }

      const initials = wordTokens.map(token => token[0].toUpperCase()).join('');
      if (initials.length >= 2 && initials.length <= 6) return initials;

      if (wordTokens.length === 1) return abbreviateSingleWord(wordTokens[0]);

      const letters = trimmed.replace(/[^A-Za-z0-9]/g, '');
      if (letters) return letters.slice(0, 6).toUpperCase();
      return trimmed;
    }

    function formatBibleVersionLabel(version) {
      if (!version) return '';
      return shouldShortenBibleVersions() ? shortenBibleVersionName(version) : version;
    }

    function shortenBibleToken(token) {
      if (!token) return token;
      const match = token.match(/^(.+?)([.,;:]*)$/);
      const core = match ? match[1] : token;
      const suffix = match ? match[2] : '';
      if (!core) return token;
      if (/\d/.test(core) || /^[ivxlcdm]+$/i.test(core)) return core + suffix;
      if (core.length <= 4) return core + suffix;
      return core.slice(0, 3) + '.' + suffix;
    }

    function shortenBibleBookName(name) {
      if (!name || typeof name !== 'string') return name || '';
      const trimmed = name.trim();
      if (!trimmed) return trimmed;
      return trimmed
        .split(/\s+/)
        .map(part => {
          if (!part) return part;
          if (!part.includes('-')) return shortenBibleToken(part);
          return part.split('-').map(seg => shortenBibleToken(seg)).join('-');
        })
        .join(' ');
    }

    function getBibleRefForPage(item, pageRaw, verseCount = 1) {
      const title = item.title || "";
      const shortenBooks = shouldShortenBibleBooks();
      const titleTrim = title.trim();
      const titleParts = titleTrim ? titleTrim.split(/\s+/) : [];
      const chap = titleParts.length > 1 ? titleParts[titleParts.length - 1] : "";
      const book = titleParts.length > 1 ? titleParts.slice(0, -1).join(' ') : titleTrim;
      const bookLabel = (shortenBooks && book) ? shortenBibleBookName(book) : book;
      const baseTitle = (book && chap)
        ? `${bookLabel} ${chap}`
        : (shortenBooks ? shortenBibleBookName(title) : title);
      const lines = (pageRaw || "").split('\n');
      
      if (lines.length === 0) return baseTitle;
      
      const firstVerseMatch = lines[0].match(/^(\d+)\s+/);
      const firstVerseNo = firstVerseMatch ? firstVerseMatch[1] : "";
      
      if (book && chap && firstVerseNo) {
        let lastVerseNo = firstVerseNo;
        
        for (let i = lines.length - 1; i >= 0; i--) {
          const verseMatch = lines[i].match(/^(\d+)\s+/);
          if (verseMatch) {
            lastVerseNo = verseMatch[1];
            break;
          }
        }
        
        if (firstVerseNo !== lastVerseNo) return `${bookLabel} ${chap}:${firstVerseNo}-${lastVerseNo}`;
        return `${bookLabel} ${chap}:${firstVerseNo}`;
      }
      return baseTitle;
    }
    
    function getEffectiveLtFont() {
      if (activeRatio === 'custom') return ltFontCustom;
      if (isLive && liveKind) return (liveKind === 'bible') ? ltFontBible : ltFontSongs;
      return (sidebarTab === 'bible') ? ltFontBible : ltFontSongs;
    }
    
    function setLtFontInputValue(v) {
      document.getElementById('font-size-lt-val').value = v;
    }
    
    function handleLtFontInput() {
      const v = Number(document.getElementById('font-size-lt-val').value || 30);
      const currentIsBible = currentItem ? getIsBibleItem(currentItem) : false;
      const isScheduleSong = (sidebarTab === 'schedule' && currentIsBible === false);
      if (isLive && liveKind) {
        if (liveKind === 'bible') ltFontBible = v;
        else ltFontSongs = v;
      } else if (sidebarTab === 'bible') {
        ltFontBible = v;
      } else if (sidebarTab === 'songs' || isScheduleSong) {
        ltFontSongs = v;
      } else if (sidebarTab === 'schedule' && currentIsBible) {
        ltFontBible = v;
      }
      onAnyControlChange();
    }
    
    function handleLtReferenceFontInput() {
      const v = Number(document.getElementById('ref-font-size-lt-val').value || 26);
      ltRefFontSize = v;
      onAnyControlChange();
    }
    
    function handleCustomFontInput() {
      const v = Number(document.getElementById('font-size-custom-val').value || 38);
      ltFontCustom = v;
      onAnyControlChange();
    }

    function updateLtTextTransformValue(value, { markUser = false, notify = false } = {}) {
      const normalized = value || 'none';
      ltTextTransform = normalized;
      const select = document.getElementById('lt-text-transform');
      if (select) {
        select.value = normalized;
      }
      if (markUser) {
        ltTransformUserOverride = true;
      }
      if (notify) onAnyControlChange();
    }

    function handleLtTextTransformChange() {
      const select = document.getElementById('lt-text-transform');
      const val = (select?.value || 'none');
      ltTransformUserOverride = true;
      updateLtTextTransformValue(val);
      const panelKind = getCurrentPanelContentKind();
      if (isLive && livePointer && panelKind && livePointer.kind === panelKind) {
        liveTextTransformState = captureTextTransformStateFromUi();
      }
      onAnyControlChange();
    }

    function updateReferenceTextTransformValue(mode, value, { notify = false } = {}) {
      const normalized = value || 'uppercase';
      if (mode === 'lt') {
        ltRefTextTransform = normalized;
        const select = document.getElementById('lt-ref-text-transform');
        if (select) select.value = normalized;
      } else {
        fullRefTextTransform = normalized;
        const select = document.getElementById('full-ref-text-transform');
        if (select) select.value = normalized;
      }
      referenceTextCapitalized = (fullRefTextTransform === 'uppercase' && ltRefTextTransform === 'uppercase');
      const capitalizeToggle = document.getElementById('capitalize-ref-text');
      if (capitalizeToggle) capitalizeToggle.checked = referenceTextCapitalized;
      if (notify) onAnyControlChange();
    }

    function handleReferenceTextTransformChange(mode) {
      const select = document.getElementById(mode === 'lt' ? 'lt-ref-text-transform' : 'full-ref-text-transform');
      updateReferenceTextTransformValue(mode, select?.value || 'uppercase');
      if (isLive && livePointer && livePointer.kind === 'bible') {
        liveTextTransformState = captureTextTransformStateFromUi();
      }
      onAnyControlChange();
    }

    function updateFullTextTransformValue(value, { notify = false } = {}) {
      const normalized = value || 'none';
      fullTextTransform = normalized;
      const select = document.getElementById('full-text-transform');
      if (select) select.value = normalized;
      if (notify) onAnyControlChange();
    }

    function handleFullTextTransformChange() {
      const select = document.getElementById('full-text-transform');
      updateFullTextTransformValue(select?.value || 'none');
      const panelKind = getCurrentPanelContentKind();
      if (isLive && livePointer && panelKind && livePointer.kind === panelKind) {
        liveTextTransformState = captureTextTransformStateFromUi();
      }
      onAnyControlChange();
    }

    function updateSongTextTransformControl() {
      const select = document.getElementById('lt-text-transform');
      if (!select) return;
      select.disabled = false;
      select.parentElement?.classList.remove('disabled');
    }

    function getCurrentPanelContentKind() {
      if (currentItem) return getIsBibleItem(currentItem) ? 'bible' : 'songs';
      if (sidebarTab === 'bible') return 'bible';
      if (sidebarTab === 'songs') return 'songs';
      return null;
    }

    function captureBackgroundStateFromUi() {
      return {
        bgEnabled: !!document.getElementById('bg-toggle')?.checked,
        bgType: document.getElementById('bg-type')?.value || 'color',
        bgOpacity: Math.max(0, Math.min(100, parseInt(getActiveBgOpacityValue(), 10) || 100)) / 100,
        bgY: Number(document.getElementById('bg-y')?.value || 0),
        bgColor: document.getElementById('bg-color-quick')?.value || '#111CB0',
        bgGradientShadow: document.getElementById('bg-color-shadow')?.value || '#AD0000',
        bgGradientHighlight: document.getElementById('bg-color-highlight')?.value || '#000000',
        bgMode: bgMode,
        bgImage: ((document.getElementById('bg-type')?.value || 'color') === 'image')
          ? ((document.getElementById('bg-image-source')?.value || 'upload') === 'upload'
              ? bgUploadDataUrl
              : (document.getElementById('bg-image-url')?.value || '').trim())
          : null,
        bgVideo: ((document.getElementById('bg-type')?.value || 'color') === 'video')
          ? ((document.getElementById('bg-video-source')?.value || 'upload') === 'upload'
              ? bgVideoUploadDataUrl
              : (document.getElementById('bg-video-url')?.value || '').trim())
          : null,
        bgVideoLoop: !!document.getElementById('bg-video-loop')?.checked,
        bgVideoSpeed: Math.max(0.25, Math.min(2.5, parseFloat(document.getElementById('bg-video-speed')?.value || '1') || 1)),
        bgBlur: Math.max(0, Math.min(40, parseInt(document.getElementById('bg-blur')?.value || '0', 10) || 0)),
        bgEdgeFix: (document.getElementById('bg-edge-fix')?.value || 'off') === 'on',
        bgGradientAngle: document.getElementById('bg-gradient-angle')?.value || 135
      };
    }

    function getEffectiveLiveBackgroundState() {
      const panelKind = getCurrentPanelContentKind();
      if (isLive && livePointer && panelKind && livePointer.kind === panelKind) {
        liveBackgroundState = captureBackgroundStateFromUi();
      }
      if (isLive && livePointer && livePointer.kind && typeof getProjectionSettingsSnapshotForTab === 'function') {
        const profile = getProjectionSettingsSnapshotForTab(livePointer.kind === 'songs' ? 'songs' : 'bible');
        if (profile && typeof profile === 'object') {
          const effectiveRatio = liveRatio || activeRatio || 'full';
          const scopedBgOpacity = effectiveRatio === 'full'
            ? (profile.bgOpacityFull != null ? profile.bgOpacityFull : profile.bgOpacity)
            : (profile.bgOpacityLT != null ? profile.bgOpacityLT : profile.bgOpacity);
          return {
            bgEnabled: profile.bgToggle != null ? !!profile.bgToggle : !!document.getElementById('bg-toggle')?.checked,
            bgType: profile.bgType || document.getElementById('bg-type')?.value || 'color',
            bgOpacity: Math.max(0, Math.min(100, parseInt(scopedBgOpacity, 10) || 100)) / 100,
            bgY: Number(profile.bgY != null ? profile.bgY : (document.getElementById('bg-y')?.value || 0)),
            bgColor: profile.bgColor || document.getElementById('bg-color-quick')?.value || '#111CB0',
            bgGradientShadow: profile.bgGradientShadow || document.getElementById('bg-color-shadow')?.value || '#AD0000',
            bgGradientHighlight: profile.bgGradientHighlight || document.getElementById('bg-color-highlight')?.value || '#000000',
            bgMode: profile.bgMode || bgMode,
            bgImage: ((profile.bgType || document.getElementById('bg-type')?.value || 'color') === 'image')
              ? ((profile.bgImageSource || document.getElementById('bg-image-source')?.value || 'upload') === 'upload'
                  ? (profile.bgUploadDataUrl || null)
                  : (profile.bgImageUrl || '').trim())
              : null,
            bgVideo: ((profile.bgType || document.getElementById('bg-type')?.value || 'color') === 'video')
              ? ((profile.bgVideoSource || document.getElementById('bg-video-source')?.value || 'upload') === 'upload'
                  ? (profile.bgVideoUploadDataUrl || null)
                  : (profile.bgVideoUrl || '').trim())
              : null,
            bgVideoLoop: !!(profile.bgVideoLoop != null ? profile.bgVideoLoop : document.getElementById('bg-video-loop')?.checked),
            bgVideoSpeed: Math.max(0.25, Math.min(2.5, parseFloat(profile.bgVideoSpeed != null ? profile.bgVideoSpeed : (document.getElementById('bg-video-speed')?.value || '1')) || 1)),
            bgBlur: Math.max(0, Math.min(40, parseInt(profile.bgBlur != null ? profile.bgBlur : (document.getElementById('bg-blur')?.value || '0'), 10) || 0)),
            bgEdgeFix: profile.bgEdgeFix != null ? !!profile.bgEdgeFix : ((document.getElementById('bg-edge-fix')?.value || 'off') === 'on'),
            bgGradientAngle: profile.bgGradientAngle != null ? profile.bgGradientAngle : (document.getElementById('bg-gradient-angle')?.value || 135)
          };
        }
      }
      return liveBackgroundState || captureBackgroundStateFromUi();
    }

    function captureTextTransformStateFromUi() {
      return {
        full: document.getElementById('full-text-transform')?.value || fullTextTransform || 'uppercase',
        lt: document.getElementById('lt-text-transform')?.value || ltTextTransform || 'uppercase',
        fullRef: document.getElementById('full-ref-text-transform')?.value || fullRefTextTransform || 'uppercase',
        ltRef: document.getElementById('lt-ref-text-transform')?.value || ltRefTextTransform || 'uppercase'
      };
    }

    function getEffectiveLiveTextTransformState() {
      const panelKind = getCurrentPanelContentKind();
      if (isLive && livePointer && panelKind && livePointer.kind === panelKind) {
        liveTextTransformState = captureTextTransformStateFromUi();
      }
      return liveTextTransformState || captureTextTransformStateFromUi();
    }

    function ensureSongLtTextTransformDefault({ force = false } = {}) {
      if (!force && (sidebarTab !== 'songs' || activeRatio !== '16-9')) return;
      if (ltTransformUserOverride) return;
      if (ltTextTransform === 'uppercase') return;
      ltTransformUserOverride = false;
      updateLtTextTransformValue('uppercase');
    }

    function ensureBibleLtTextTransformNone({ force = false } = {}) {
      if (!force && (sidebarTab !== 'bible' || activeRatio !== '16-9')) return;
      if (ltTextTransform === 'none') return;
      ltTransformUserOverride = false;
      updateLtTextTransformValue('none');
    }

    function isCurrentSelectionLive() {
      if (!isLive || !livePointer || !currentItem) return false;
      const itemIsBible = getIsBibleItem(currentItem);
      if (livePointer.kind === 'bible' && itemIsBible) {
        if (livePointer.version !== currentItem.version) return false;
        if (livePointer.index !== currentIndex) return false;
      } else if (livePointer.kind === 'songs' && !itemIsBible) {
        if (livePointer.index !== currentIndex) return false;
      } else {
        return false;
      }
      if (typeof liveLineCursor === 'number' && typeof lineCursor === 'number') {
        return liveLineCursor === lineCursor;
      }
      return true;
    }

    function refreshProjectLiveButtonState() {
      const btn = document.getElementById('btn-project-live');
      if (!btn) return;
      if (isCurrentSelectionLive()) {
        btn.classList.add('live-active');
      } else {
        btn.classList.remove('live-active');
      }
    }

    let pendingVerseProjectFrame = 0;
    function applyBibleActiveButtonStyle(btn, versionIndex, active) {
      if (!btn) return;
      if (active && Number.isFinite(versionIndex) && versionIndex >= 0) {
        const colorA = VERSION_COLORS[versionIndex % VERSION_COLORS.length];
        const colorB = VERSION_COLORS[(versionIndex + 1) % VERSION_COLORS.length];
        btn.style.borderColor = colorA;
        btn.style.background = `linear-gradient(135deg, ${colorA}44, ${colorB}22)`;
      } else {
        btn.style.borderColor = '';
        btn.style.background = '';
      }
    }

    function updateActiveButtonInPlace(activeIndex, isBible, versionIndex) {
      const container = document.getElementById('lyric-buttons');
      if (!container) return;
      container.querySelectorAll('.lyric-btn').forEach((btn) => {
        const pageIndex = Number(btn.dataset.pageIndex);
        const isActive = pageIndex === activeIndex;
        btn.classList.toggle('active', isActive);
        if (isBible) applyBibleActiveButtonStyle(btn, versionIndex, isActive);
      });
      const activeBtn = container.querySelector('.lyric-btn.active');
      if (activeBtn && !isButtonInView(container, activeBtn)) {
        activeBtn.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      refreshProjectLiveButtonState();
    }

    function updateButtonView(opts = {}) {
      const container = document.getElementById('lyric-buttons');
      if (!container) return;
      const preserveScroll = !!opts.preserveScroll;
      const skipAutoScroll = (opts.skipAutoScroll !== undefined) ? !!opts.skipAutoScroll : preserveScroll;
      const requestedScrollTop = Number.isFinite(opts.scrollTop) ? Math.max(0, opts.scrollTop) : null;
      const prevScrollTop = preserveScroll
        ? (requestedScrollTop != null ? requestedScrollTop : container.scrollTop)
        : 0;
      container.innerHTML = '';
      if (!currentItem) return;

      const isBible = getIsBibleItem(currentItem);
      const bibleVersionIndex = (isBible && currentItem.version) ? Object.keys(bibles).indexOf(currentItem.version) : -1;
      const pages = getPagesFromItem(currentItem, isBible);
      let lastTag = ""; let block = null;

      pages.forEach((p, idx) => {
        if (p.tag !== lastTag) {
          lastTag = p.tag;
          block = document.createElement('div');
          block.className = 'section-block';
          block.innerHTML = `<span class="section-label">${lastTag}</span>`;
          container.appendChild(block);
        }

        const row = document.createElement('div');
        row.className = 'lyric-row';

        const btn = document.createElement('button');
        btn.className = `lyric-btn ${idx === lineCursor ? 'active' : ''}`;
        btn.innerHTML = p.text;
        btn.dataset.pageIndex = String(idx);

        const isCurrentlyLive = isLive && livePointer &&
          ((livePointer.kind === 'bible' && isBible && livePointer.version === currentItem.version && livePointer.index === currentIndex) ||
           (livePointer.kind === 'songs' && !isBible && livePointer.index === currentIndex)) &&
           liveLineCursor === idx;

        if (isCurrentlyLive) {
          const badge = document.createElement('span');
          badge.className = 'live-indicator';
          badge.innerText = '[LIVE]';
          btn.appendChild(badge);
        }

        if (isBible) {
          applyBibleActiveButtonStyle(btn, bibleVersionIndex, idx === lineCursor);
        }

        btn.onclick = () => {
          if (annotateMode) return;
          if (editorMode === 'btn' && isCurrentlyLive) {
            clearOutput({ fade: true });
            return;
          }
          lineCursor = idx;
          if (isBible && linesPerPage === 1) {
            const verseNum = getFirstVerseNumber(p.raw);
            if (verseNum) setBibleGroupAnchor(verseNum, currentItem);
          }
          updateActiveButtonInPlace(idx, isBible, bibleVersionIndex);
          if (pendingVerseProjectFrame) {
            cancelAnimationFrame(pendingVerseProjectFrame);
            pendingVerseProjectFrame = 0;
          }
          pendingVerseProjectFrame = requestAnimationFrame(() => {
            pendingVerseProjectFrame = 0;
            projectLive(true);
          });
        };

        row.appendChild(btn);
        if (isBible) {
          const add = document.createElement('button');
          add.className = 'quick-add'; add.type = 'button'; add.innerText = '+'; add.onclick = (e) => { e.stopPropagation(); quickAddVerseToSetlist(idx) };
          row.appendChild(add);
        }
        block.appendChild(row);
      });
      
      if (preserveScroll) {
        const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
        container.scrollTop = Math.min(prevScrollTop, maxScroll);
      }
      const activeBtn = container.querySelector('.lyric-btn.active');
      if (!skipAutoScroll && activeBtn && !isButtonInView(container, activeBtn)) {
        activeBtn.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      refreshProjectLiveButtonState();
      updateCustomModeAvailability();
      updateTextEditorModeAvailability();
      if (typeof updateFocusedEditorBanner === 'function') updateFocusedEditorBanner();
    }

    function quickAddVerseToSetlist(pageIdx) {
      if (!currentItem || !currentItem.version) return;
      const pages = getPagesFromItem(currentItem, true);
      const p = pages[pageIdx]; if (!p) return;
      const ref = getBibleRefForPage(currentItem, p.raw, p.verseCount);
      const ver = currentItem.version || "";
      const title = `${ref}`;
      const cleaned = (p.raw || "").split('\n').map(line => line.replace(/^\s*\d+\s+/, '')).join('\n').trim();
      const content = `[${title}]\n${cleaned}`;
      const fontSizeSnapshot = Number(document.getElementById('font-size-val').value || DEFAULT_BIBLE_FULL_FONT);
      const pageSnapshot = {
        text: p.text,
        raw: p.raw,
        tag: p.tag || 'Scripture',
        verseCount: p.verseCount,
        startVerse: p.startVerse
      };
      const dualActive = dualVersionModeEnabled &&
        !!dualVersionSecondaryId &&
        activeRatio !== 'custom' &&
        sidebarTab === 'bible';
      const showVerseNos = document.getElementById('show-verse-nos').checked;
      const showVersionFlag = !!document.getElementById('show-version')?.checked;
      let dualSnapshot = null;
      if (dualActive) {
        const secondaryList = bibles[dualVersionSecondaryId];
        let secondaryItem = null;
        if (secondaryList && currentItem) {
          const { book: sourceBook, chap: sourceChap } = extractBookAndChapter(currentItem);
          const fallbackIdx = (typeof currentIndex === 'number' && currentIndex >= 0) ? currentIndex : 0;
          const secIdx = findBibleChapterIndex(dualVersionSecondaryId, sourceBook, sourceChap, fallbackIdx);
          if (secIdx >= 0 && secIdx < secondaryList.length) {
            secondaryItem = secondaryList[secIdx];
          }
        }
        if (secondaryItem) {
          const secondaryPages = getPagesFromItem(secondaryItem, true);
          const primaryStartVerse = pageSnapshot.startVerse || getFirstVerseNumber(pageSnapshot.raw);
          let secondaryPage = findBiblePageByVerse(secondaryPages, primaryStartVerse);
          if (!secondaryPage && Array.isArray(secondaryPages)) {
            secondaryPage = secondaryPages[Math.min(pageIdx, Math.max(0, secondaryPages.length - 1))] || secondaryPages[0];
          }
          if (secondaryPage) {
            let secondText = secondaryPage.text;
            if (!showVerseNos) {
              secondText = secondText.replace(/<span class="jo-verse-sup">.*?<\/span>\s*/g, '');
            }
            secondText = convertHighlightsToHtml(secondText);
            const secondaryRef = getBibleRefForPage(secondaryItem, secondaryPage.raw, secondaryPage.verseCount);
            const secondaryVersionLabel = formatBibleVersionLabel(secondaryItem.version || "");
            const secondaryVerText = (showVersionFlag && secondaryVersionLabel) ? ` (${secondaryVersionLabel})` : "";
            const secondaryLabel = `${secondaryRef}${secondaryVerText}`;
            dualSnapshot = {
              version: secondaryItem.version || dualVersionSecondaryId,
              text: secondText,
              raw: secondaryPage.raw,
              tag: secondaryPage.tag || 'Scripture',
              verseCount: secondaryPage.verseCount,
              startVerse: secondaryPage.startVerse,
              referenceLabel: secondaryLabel
            };
          }
        }
      }
      insertIntoSchedule({
        title,
        content,
        version: ver,
        _metaKind: 'bible_verse',
        pageSnapshot,
        fontSizeSnapshot,
        dualSnapshot,
        chapterIndex: Number.isFinite(currentIndex) ? currentIndex : null,
        pageIndex: Number.isFinite(pageIdx) ? pageIdx : 0,
        anchorVerse: pageSnapshot.startVerse || null
      }, {
        successMessage: 'Added to setlist',
        duplicateMessage: 'This verse is already on the setlist; moved to the top'
      });
    }

    function isCurrentItemFromScheduleList() {
      return sidebarTab === 'schedule' &&
        buttonContextTab === 'schedule' &&
        Array.isArray(schedule) &&
        !!currentItem &&
        schedule.includes(currentItem);
    }

    function projectLive(trigger = false) {
      if (trigger) isLive = true;
      if (!isLive) return;
      applyProgramDisplaySource('lyrics');
      if (!currentItem) return;
      const isBible = getIsBibleItem(currentItem);
      const scheduleProjectIndex = isCurrentItemFromScheduleList() ? currentIndex : -1;
      if (!isBible && activeRatio === 'custom') {
        activeRatio = 'full';
        document.getElementById('ratio-full').classList.add('active');
        document.getElementById('ratio-lt').classList.remove('active');
        document.getElementById('ratio-custom').classList.remove('active');
        document.getElementById('bg-toggle').checked = true;
        syncBgOpacitySlider();
      }
      const isScheduleItem = scheduleProjectIndex >= 0;
      if (isScheduleItem) {
        scheduleReturnTarget = buildScheduleRestoreTarget(currentItem);
      }
      liveKind = isBible ? 'bible' : 'songs';
      if (isBible) {
        livePointer = {
          kind: 'bible',
          version: currentItem.version,
          index: currentIndex,
          source: isScheduleItem ? 'schedule' : 'bible'
        };
      } else {
        livePointer = {
          kind: 'songs',
          index: currentIndex,
          source: isScheduleItem ? 'schedule' : 'songs'
        };
      }
      liveLineCursor = lineCursor;
      liveLinesPerPage = linesPerPage;
      liveBackgroundState = captureBackgroundStateFromUi();
      liveRatio = activeRatio;
      liveTextTransformState = captureTextTransformStateFromUi();
      if (activeRatio === '16-9') {
        if (isBible) ensureBibleLtTextTransformNone({ force: true });
        else ensureSongLtTextTransformDefault({ force: true });
      }
      if (isBible && activeRatio === '16-9') {
        delayBibleBgUntilVerse = false;
      }
      pushLiveUpdate(); saveToStorageDebounced(); updateButtonView(); setLtFontInputValue(getEffectiveLtFont());
      if (isScheduleItem) {
        const setlistBehavior = (typeof getSetlistSettingsSnapshot === 'function')
          ? getSetlistSettingsSnapshot()
          : DEFAULT_SETLIST_SETTINGS;
        if (setlistBehavior.advancePreviewAfterLive && scheduleProjectIndex < (schedule.length - 1)) {
          const nextIndex = scheduleProjectIndex + 1;
          const nextEntry = schedule[nextIndex];
          if (nextEntry) {
            scheduleReturnTarget = buildScheduleRestoreTarget(nextEntry);
            buttonContextTab = 'schedule';
            selectItem(nextIndex);
          }
        }
      }
      if (isVmixMode()) {
        vmixAfterProjectLive().catch((error) => {
          vmixConnectionState = 'error';
          vmixLastError = error && error.message ? error.message : 'vMix update failed';
          updateVmixStatusUi();
        });
      }
      if (!isBible && sidebarTab === 'songs') {
        preserveLtBgWhenSwitchingToSongs = false;
        if (applyLtBgDefaultForTab('songs')) onAnyControlChange();
      }
      handleSongFullFontState();
    }

    function getCurrentTransitionDuration() {
      const raw = document.getElementById('song-transition-duration')?.value || "0.8";
      return Math.max(0.1, Math.min(10, parseFloat(raw) || 0.8));
    }

    function getAutoResizeMeasureText(raw, isBible) {
      const text = String(raw || '');
      if (!isBible) return text;
      return text
        .split('\n')
        .map(line => line.replace(/^\s*\d+\s+/, ''))
        .join('\n');
    }

    function estimateWrappedLineCount(text, maxWidthPx, fontSizePt, fontFamily, fontWeight) {
      if (!text) return 0;
      if (!Number.isFinite(maxWidthPx) || maxWidthPx <= 0) return String(text).split('\n').length;
      const cacheKey = [
        hashTextFast(text),
        Math.round(maxWidthPx),
        Number(fontSizePt) || 0,
        fontFamily || 'sans-serif',
        fontWeight || '700'
      ].join('|');
      if (WRAPPED_LINE_ESTIMATE_CACHE.has(cacheKey)) {
        return WRAPPED_LINE_ESTIMATE_CACHE.get(cacheKey);
      }
      const canvas = estimateWrappedLineCount._canvas || (estimateWrappedLineCount._canvas = document.createElement('canvas'));
      const ctx = canvas.getContext('2d');
      if (!ctx) return String(text).split('\n').length;
      const sizePx = (Number(fontSizePt) || 0) * (96 / 72);
      const weight = fontWeight || '700';
      ctx.font = `${weight} ${sizePx}px ${fontFamily || 'sans-serif'}`;
      const spaceWidth = ctx.measureText(' ').width || 0;
      const lines = String(text).split('\n');
      let total = 0;
      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) {
          total += 1;
          return;
        }
        const hasSpaces = /\s/.test(trimmed);
        const parts = hasSpaces ? trimmed.split(/\s+/) : Array.from(trimmed);
        let lineWidth = 0;
        let lineCount = 1;
        parts.forEach((part) => {
          const partWidth = ctx.measureText(part).width || 0;
          const addWidth = (lineWidth === 0) ? partWidth : (hasSpaces ? spaceWidth + partWidth : partWidth);
          if (lineWidth + addWidth <= maxWidthPx || lineWidth === 0) {
            lineWidth += addWidth;
          } else {
            lineCount += 1;
            lineWidth = partWidth;
          }
          if (partWidth > maxWidthPx) {
            const extra = Math.ceil(partWidth / maxWidthPx) - 1;
            if (extra > 0) {
              lineCount += extra;
              lineWidth = partWidth % maxWidthPx;
            }
          }
        });
        total += lineCount;
      });
      return setBoundedCacheValue(WRAPPED_LINE_ESTIMATE_CACHE, cacheKey, total, WRAPPED_LINE_ESTIMATE_CACHE_LIMIT);
    }

    function estimateFullTextHeightPx(lineCount, fontSizePt, lineHeight, isBible, refFontSizePt) {
      const sizePx = (Number(fontSizePt) || 0) * (96 / 72);
      const bodyHeight = lineCount * sizePx * (Number(lineHeight) || 1.1);
      if (!isBible) return bodyHeight;
      const refSizePt = Number(refFontSizePt) || (Number(fontSizePt) || 0) * 1.05;
      const refSizePx = refSizePt * (96 / 72);
      const refHeight = (refSizePx * 1.1) + 20;
      return bodyHeight + refHeight;
    }

    function getDualBibleChapterIndex(liveItem, pointer) {
      if (liveItem && Number.isFinite(liveItem.chapterIndex)) {
        return liveItem.chapterIndex;
      }
      if (pointer && Number.isFinite(pointer.index)) {
        return pointer.index;
      }
      return null;
    }

    function resolveDualSecondaryRawForMeasurement(storedSnapshot, secondaryVersionId, pointer, lineCursor, liveItem) {
      if (storedSnapshot) {
        return storedSnapshot.raw || '';
      }
      if (!secondaryVersionId || !pointer || typeof pointer.index !== 'number') {
        return '';
      }
      const chapterIndex = getDualBibleChapterIndex(liveItem, pointer);
      if (chapterIndex == null) return '';
      const secondaryList = bibles[secondaryVersionId];
      if (!Array.isArray(secondaryList) || secondaryList.length === 0) return '';
      const secondaryItem = secondaryList[chapterIndex];
      if (!secondaryItem) return '';
      const pages = getPagesFromItem(secondaryItem, true);
      if (!pages.length) return '';
      const idx = Math.max(0, Math.min(lineCursor, pages.length - 1));
      const page = pages[idx] || pages[0];
      return (page && page.raw) ? page.raw : '';
    }
