    // =============================================================
    // Bible Song Pro — Scripture Reference Parser (P1 #12)
    // =============================================================
    //
    // Extends the existing parseBibleReferenceQuery / findBibleReferenceMatches
    // pair with:
    //
    //   * Verse ranges:    "john 3:16-18", "ps 23:1-6"
    //   * Compact forms:   "jn3:16", "ps23", "mt5.3-10"
    //   * Delimiters:      ":", ".", "v"  (ps 23v1)
    //   * Book aliases:    standard 66-book abbreviation table
    //                       (jn, jhn, jno → john, etc.)
    //
    // Implementation strategy: we reassign the two top-level function
    // declarations from state-and-storage.js at script-load time so every
    // call site (render-and-selection.js, bootstrap-and-init.js) picks up
    // the richer behavior without touching a single existing line.  The
    // new parser gracefully falls back to the legacy regex for inputs it
    // can't handle — so nothing already working is broken.
    //
    // Loaded after state-and-storage.js.
    // =============================================================

    // ----- Canonical book list (English) ----------------------------------
    //
    // Each entry: canonical name (matches the Bible loader's book strings)
    // followed by any number of aliases.  Aliases are normalized (lowercase,
    // stripped of punctuation and spaces) before matching, so you only need
    // to list the distinct forms.

    const BSP_REF_BOOK_ALIASES = [
      // ----- Old Testament -----
      ['genesis', 'gen', 'gn', 'ge'],
      ['exodus', 'ex', 'exo', 'exod'],
      ['leviticus', 'lev', 'lv', 'le'],
      ['numbers', 'num', 'nm', 'nu', 'nb'],
      ['deuteronomy', 'deut', 'dt', 'de'],
      ['joshua', 'josh', 'jos', 'jsh'],
      ['judges', 'judg', 'jdg', 'jg'],
      ['ruth', 'rth', 'ru'],
      ['1 samuel', '1samuel', '1sam', '1sm', '1sa', '1s', 'isam', '1samuel', 'firstsamuel'],
      ['2 samuel', '2samuel', '2sam', '2sm', '2sa', '2s', 'iisam', 'secondsamuel'],
      ['1 kings', '1kings', '1kgs', '1ki', '1k', 'ikgs', 'firstkings'],
      ['2 kings', '2kings', '2kgs', '2ki', '2k', 'iikgs', 'secondkings'],
      ['1 chronicles', '1chronicles', '1chr', '1ch', '1chron', 'ichron', 'firstchronicles'],
      ['2 chronicles', '2chronicles', '2chr', '2ch', '2chron', 'iichron', 'secondchronicles'],
      ['ezra', 'ezr', 'ez'],
      ['nehemiah', 'neh', 'ne'],
      ['esther', 'esth', 'est', 'es'],
      ['job', 'jb'],
      ['psalms', 'psalm', 'ps', 'psa', 'psm', 'pss', 'pslm'],
      ['proverbs', 'prov', 'prv', 'pro', 'pr'],
      ['ecclesiastes', 'eccl', 'ecc', 'ec', 'qoh'],
      ['song of solomon', 'songofsolomon', 'song', 'sos', 'sng', 'canticles', 'cant'],
      ['isaiah', 'isa', 'is'],
      ['jeremiah', 'jer', 'je', 'jr'],
      ['lamentations', 'lam', 'la'],
      ['ezekiel', 'ezek', 'eze', 'ezk'],
      ['daniel', 'dan', 'da', 'dn'],
      ['hosea', 'hos', 'ho'],
      ['joel', 'jl', 'joe'],
      ['amos', 'am', 'amo'],
      ['obadiah', 'obad', 'oba', 'ob'],
      ['jonah', 'jon', 'jnh'],
      ['micah', 'mic', 'mi'],
      ['nahum', 'nah', 'na'],
      ['habakkuk', 'hab', 'hb'],
      ['zephaniah', 'zeph', 'zep', 'zp'],
      ['haggai', 'hag', 'hg'],
      ['zechariah', 'zech', 'zec', 'zc'],
      ['malachi', 'mal', 'ml'],
      // ----- New Testament -----
      ['matthew', 'matt', 'mt', 'mat'],
      ['mark', 'mrk', 'mk', 'mr'],
      ['luke', 'luk', 'lk'],
      ['john', 'jn', 'jhn', 'jno', 'joh'],
      ['acts', 'ac', 'act'],
      ['romans', 'rom', 'ro', 'rm'],
      ['1 corinthians', '1corinthians', '1cor', '1co', '1c', 'icor', 'firstcorinthians'],
      ['2 corinthians', '2corinthians', '2cor', '2co', '2c', 'iicor', 'secondcorinthians'],
      ['galatians', 'gal', 'ga'],
      ['ephesians', 'eph', 'ephes'],
      ['philippians', 'phil', 'php', 'pp'],
      ['colossians', 'col', 'co'],
      ['1 thessalonians', '1thessalonians', '1thess', '1thes', '1th', 'ithess', 'firstthessalonians'],
      ['2 thessalonians', '2thessalonians', '2thess', '2thes', '2th', 'iithess', 'secondthessalonians'],
      ['1 timothy', '1timothy', '1tim', '1ti', '1t', 'itim', 'firsttimothy'],
      ['2 timothy', '2timothy', '2tim', '2ti', '2t', 'iitim', 'secondtimothy'],
      ['titus', 'tit', 'ti'],
      ['philemon', 'philem', 'phm', 'phlm', 'pm'],
      ['hebrews', 'heb', 'he'],
      ['james', 'jas', 'jm'],
      ['1 peter', '1peter', '1pet', '1pe', '1pt', '1p', 'ipet', 'firstpeter'],
      ['2 peter', '2peter', '2pet', '2pe', '2pt', '2p', 'iipet', 'secondpeter'],
      ['1 john', '1john', '1jn', '1jhn', '1jo', '1j', 'ijn', 'firstjohn'],
      ['2 john', '2john', '2jn', '2jhn', '2jo', '2j', 'iijn', 'secondjohn'],
      ['3 john', '3john', '3jn', '3jhn', '3jo', '3j', 'iiijn', 'thirdjohn'],
      ['jude', 'jud', 'jde'],
      ['revelation', 'rev', 'rv', 're', 'revelations', 'apocalypse', 'apoc']
    ];

    // Normalized alias → canonical book name lookup.  Computed once.
    const BSP_REF_ALIAS_LOOKUP = (function () {
      const m = Object.create(null);
      BSP_REF_BOOK_ALIASES.forEach(function (row) {
        const canonical = row[0];
        const canonicalKey = bspRefNormalizeBookToken(canonical);
        m[canonicalKey] = canonical;
        for (let i = 1; i < row.length; i += 1) {
          const alias = bspRefNormalizeBookToken(row[i]);
          if (alias && !m[alias]) m[alias] = canonical;
        }
      });
      return m;
    })();

    function bspRefNormalizeBookToken(token) {
      return String(token || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
    }

    // Expand a book token to its canonical form, or null if unknown.
    function bspRefExpandBook(rawBook) {
      const key = bspRefNormalizeBookToken(rawBook);
      if (!key) return null;
      if (BSP_REF_ALIAS_LOOKUP[key]) return BSP_REF_ALIAS_LOOKUP[key];
      // Prefix match — "john" already canonical, "phi" could match philippians
      // or philemon. Return null on ambiguity.
      const candidates = [];
      for (const aliasKey in BSP_REF_ALIAS_LOOKUP) {
        if (aliasKey.length > key.length && aliasKey.startsWith(key)) {
          const canon = BSP_REF_ALIAS_LOOKUP[aliasKey];
          if (candidates.indexOf(canon) === -1) candidates.push(canon);
          if (candidates.length > 1) break;
        }
      }
      return candidates.length === 1 ? candidates[0] : null;
    }

    // ----- Core parser ----------------------------------------------------
    //
    // Accepts many forms:
    //   "john 3:16"          → {book:'john', chapter:'3', verseStart:'16', verseEnd:'16'}
    //   "john 3:16-18"       → {..., verseStart:'16', verseEnd:'18'}
    //   "jn 3:16-18"         → canonicalized to 'john'
    //   "jn3:16-18"          → compact, still parsed
    //   "1 jn 4:7-8"         → {book:'1 john', ...}
    //   "1jn 4"              → chapter only
    //   "ps 23v1-6"          → 'v' delimiter
    //   "mt 5.3-10"          → '.' delimiter
    //   "psalm 23"           → chapter-only
    //   "revelation 22:20-21"→ long canonical name

    const BSP_REF_REGEX = new RegExp(
      '^' +
      '\\s*' +
      // Book: optional 1/2/3 prefix + letters, possibly with internal spaces.
      '((?:[1-3]\\s*)?[a-z\\u00c0-\\u024f]+(?:\\s+[a-z\\u00c0-\\u024f]+)*)' +
      // Separator between book and chapter: whitespace OR nothing (for compact)
      '\\s*' +
      // Chapter
      '(\\d+)' +
      // Optional verse section: :, ., v followed by start[-end]
      '(?:[:\\.\\s]\\s*(\\d+)(?:\\s*[-\\u2013\\u2014]\\s*(\\d+))?|v\\s*(\\d+)(?:\\s*[-\\u2013\\u2014]\\s*(\\d+))?)?' +
      '\\s*$',
      'i'
    );

    function bspParseScriptureReference(raw) {
      if (raw == null) return null;
      let s = String(raw)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
      if (!s) return null;
      // Insert a space between a book token and a run-on chapter number so the
      // primary regex can match compact forms: "jn3:16" → "jn 3:16".
      // Guard against existing delimiters being broken.
      s = s.replace(/^(\s*(?:[1-3]\s*)?[a-z]+(?:\s+[a-z]+)*?)(\d)/i, function (_, book, digit) {
        return book.trim() + ' ' + digit;
      });
      const m = s.match(BSP_REF_REGEX);
      if (!m) return null;
      const bookRaw = m[1].trim();
      const chapter = m[2];
      // Verse group A: `:` / `.` / ` ` form.  Verse group B: `v` form.
      const verseStartA = m[3];
      const verseEndA = m[4];
      const verseStartB = m[5];
      const verseEndB = m[6];
      const verseStart = verseStartA != null ? verseStartA : (verseStartB != null ? verseStartB : null);
      const verseEnd   = verseEndA   != null ? verseEndA   : (verseEndB   != null ? verseEndB   : null);

      const canonical = bspRefExpandBook(bookRaw);
      if (!canonical) return null;
      const startNum = verseStart != null ? Number(verseStart) : null;
      const endNum   = verseEnd   != null ? Number(verseEnd)   : startNum;
      // Validate range: end >= start
      if (startNum != null && endNum != null && endNum < startNum) return null;
      return {
        raw: String(raw),
        book: canonical,
        chapter: String(chapter),
        verseStart: startNum != null ? String(startNum) : null,
        verseEnd:   endNum   != null ? String(endNum)   : null,
        isChapterQuery: startNum == null,
        hasRange: startNum != null && endNum != null && endNum > startNum,
        // Legacy compatibility fields consumed by findBibleReferenceMatches
        // and other existing call sites:
        versePrefix: startNum != null ? String(startNum) : '',
        hasColon: startNum != null,
        normalizedQuery: canonical + ' ' + chapter + (startNum != null ? (':' + startNum + (endNum != null && endNum !== startNum ? '-' + endNum : '')) : '')
      };
    }

    // ----- Legacy-compatible wrappers -------------------------------------
    //
    // Replace the two top-level function declarations from state-and-storage.js
    // with wrappers that prefer the new parser.  Call sites pass the return
    // value straight through to findBibleReferenceChapter / match filters, so
    // the compatibility fields above (versePrefix, hasColon, isChapterQuery)
    // keep everything working.  The legacy regex is still used as a fallback
    // for any input the new parser can't handle.

    const __bspOriginalParseBibleReferenceQuery = (typeof parseBibleReferenceQuery === 'function')
      ? parseBibleReferenceQuery
      : null;
    const __bspOriginalFindBibleReferenceMatches = (typeof findBibleReferenceMatches === 'function')
      ? findBibleReferenceMatches
      : null;

    function bspParseBibleReferenceQueryWrapped(raw) {
      const parsed = bspParseScriptureReference(raw);
      if (parsed) return parsed;
      if (__bspOriginalParseBibleReferenceQuery) return __bspOriginalParseBibleReferenceQuery(raw);
      return null;
    }

    function bspFindBibleReferenceMatchesWrapped(query, opts = {}) {
      const parsed = (query && typeof query === 'object' && query.chapter)
        ? query
        : bspParseBibleReferenceQueryWrapped(query);
      if (!parsed) return [];
      if (typeof activeBibleVersion === 'undefined') return [];
      const versionId = opts.versionId || activeBibleVersion;
      if (!versionId || typeof bibles === 'undefined' || !bibles[versionId]) return [];
      if (typeof findBibleReferenceChapter !== 'function') return [];
      const chapterMatch = findBibleReferenceChapter(versionId, parsed, opts);
      if (!chapterMatch) return [];
      const chapterIndex = chapterMatch.chapterIndex;
      const chapterItem = chapterMatch.chapterItem;
      const start = parsed.verseStart != null ? Number(parsed.verseStart) : null;
      const end   = parsed.verseEnd   != null ? Number(parsed.verseEnd)   : start;
      const results = [];
      String(chapterItem.content || '').split('\n').forEach(function (line) {
        const match = String(line || '').match(/^(\d+)\s+(.+)/);
        if (!match) return;
        const verseNum = Number(match[1]);
        if (start != null) {
          if (!Number.isFinite(verseNum)) return;
          if (verseNum < start || verseNum > end) return;
        }
        results.push({
          chapterIndex: chapterIndex,
          book: chapterItem.book || (typeof extractBookAndChapter === 'function' ? extractBookAndChapter(chapterItem).book : ''),
          chapter: parsed.chapter,
          verse: match[1],
          text: match[2]
        });
      });
      return results;
    }

    // Install the replacements on the global binding.  In classic scripts,
    // top-level function declarations are writable globals, so bare-name
    // lookups from other files resolve to the new function.
    try {
      // eslint-disable-next-line no-global-assign
      parseBibleReferenceQuery = bspParseBibleReferenceQueryWrapped;
    } catch (_) {}
    try {
      window.parseBibleReferenceQuery = bspParseBibleReferenceQueryWrapped;
    } catch (_) {}
    try {
      // eslint-disable-next-line no-global-assign
      findBibleReferenceMatches = bspFindBibleReferenceMatchesWrapped;
    } catch (_) {}
    try {
      window.findBibleReferenceMatches = bspFindBibleReferenceMatchesWrapped;
    } catch (_) {}

    // Expose the richer parser for external callers (P0 preflight, future
    // CCLI reporting, remote-show tablets, etc.).
    window.BSPScriptureReference = {
      parse: bspParseScriptureReference,
      expandBook: bspRefExpandBook,
      aliases: BSP_REF_BOOK_ALIASES
    };

    // =============================================================
    // END OF FILE — Bible Song Pro Scripture Reference Parser
    // =============================================================
