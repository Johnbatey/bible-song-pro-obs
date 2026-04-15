# BibleRhythm AGL — OBS Plugin

This document describes **what the plugin does**, **how it is structured**, and a
**prioritized list of planned improvements** to deliver more value for church use.
It is written as an orientation doc for contributors and for Claude Code sessions
working in this repository.

---

## 1. What This Plugin Does

BibleRhythm AGL is a church presentation tool that lives **inside OBS Studio** as a
Custom Browser Dock + Browser Source pair. It lets worship teams project
**Bible verses** and **song lyrics** live on stream, without needing separate
presentation software like ProPresenter or EasyWorship.

At its core it is a two-file OBS plugin:

| File | Role |
|---|---|
| `Bible Song Pro panel.html` | The **control panel** — loaded as an OBS *Custom Browser Dock*. Operators use it to search the Bible, load songs, build setlists, and trigger "go live". |
| `BSP_display.html` | The **display/output screen** — loaded as an OBS *Browser Source* in a scene. This is what viewers see on stream. |

The panel and the display talk to each other in real time over the browser
`BroadcastChannel` API (same-origin, no server required). Going live is instant
and fully local.

### Key features (shipped, v2.0.0)

- **Bible projection** — 250+ Bible versions, dual-version support, book/chapter
  browsing, reference search, verse grouping, pinned & recent references.
- **Song lyrics projection** — manual entry, import, and an **Auto-Retrieve
  Lyrics** workflow that fetches lyrics from online providers.
- **Display modes** — Full Screen mode and Lower Third mode for both Bible and
  songs.
- **Setlists** — build an ordered list of songs + Bible items and fire them in
  sequence during a service.
- **Styling & themes** — typography, colors, backgrounds, themes, and plugin
  layout controls.
- **Multi-language UI** — 50+ interface languages; song translation workflow
  with pluggable provider configuration.
- **vMix integration** — configurable vMix connection, routing, and output so
  the same panel drives vMix users, not just OBS.
- **Desktop packaging** — Electron-based desktop builds for macOS, Windows, and
  Linux (`electron/`, `electron-builder` config in `package.json`), so users
  who don't run OBS can still use the tool standalone.
- **In-app Feedback → GitHub issues** — users can report bugs/requests from
  inside the app. A bundled Node backend (`server/feedback-backend.js`) or a
  Cloudflare Worker (`feedback-worker/`) receives the submission and creates a
  GitHub issue using a server-side token, so no credentials leak to the client.

### Repository layout

```
Bible Song Pro panel.html     # Control dock (monolithic HTML shell)
BSP_display.html              # OBS Browser Source output
index.html                    # Desktop / web entrypoint wrapper
js/panel/                     # Modular panel runtime (split from the shell)
  bootstrap-and-init.js         boot + init sequence
  panel-app-core.js             core app state/controller
  state-and-storage.js          persistence (localStorage / host mode)
  songs-and-bible.js            songs + bible workflows
  sync-and-output.js            BroadcastChannel sync to BSP_display
  program-display-and-transform.js  display transforms
  render-and-selection.js       rendering + selection
  settings-and-controls.js      settings UI
  sidebar-and-workspace.js      workspace + sidebar
  scene-and-source-tools.js     scene tools
  output-and-streaming.js       streaming helpers
  vmix-and-translation.js       vMix bridge + song translation
  reference-localization-theme.js  i18n + themes
  recording-and-livestream-tools.js
  fx-and-source-config.js, media-and-background.js,
  annotate-tools.js, remote-show-tools.js,
  app-commands-and-shortcuts.js, source-runtime-and-promixer.js,
  workspace-and-editor-tools.js, obs-isolated-layout.js
electron/                     # Electron shell for desktop builds
  main.js, preload.js, render-icon.js, resources/
server/feedback-backend.js    # Local Node backend for feedback → GitHub issues
feedback-worker/              # Cloudflare Worker alternative for feedback
assets/                       # Icons, showcase images, branding
README.md, HOWTO.md, CHANGELOG.md, RELEASE_NOTES.md,
COPYRIGHT.md, DISCLAIMER.md, LICENSE (GPL-3.0)
```

### How it runs

- **OBS-first path:** Add `BSP_display.html` as a Browser Source, add
  `Bible Song Pro panel.html` as a Custom Browser Dock, operate from the dock.
- **Desktop path:** `npm start` launches the Electron shell (`electron/main.js`)
  which loads the same HTML. `npm run dist:mac|dist:win|dist:linux` produces
  packaged installers via `electron-builder`.
- **Feedback backend (optional):** `npm run feedback:server` runs a local Node
  server that exchanges panel feedback for GitHub issue creations. For public
  builds, the deployed Cloudflare Worker at
  `bible-song-pro-feedback.johnbatey-bsp.workers.dev` is the default endpoint.

### Tech stack

HTML, CSS, vanilla JavaScript, `BroadcastChannel` API, Electron (desktop),
Node.js + `ws` (feedback backend), Cloudflare Workers (public feedback relay),
`electron-builder` (packaging). No framework dependency in the panel runtime,
which keeps it lightweight enough to run inside an OBS Browser Source.

---

## 2. Planned Work — Prioritized Improvements for Church Use

The plugin already covers the core "put verses and lyrics on stream" need. The
biggest gains for churches come from **reliability during live services**,
**faster operator workflow on Sunday morning**, and **better integration with
the rest of a church's stack** (CCLI, media teams, translators, remote
volunteers). The list below is ordered so the highest-leverage items ship
first.

Each item lists: **Why it matters for churches**, **What to build**, and
**Where it likely lives in the codebase**.

### P0 — Service-day reliability (ship first)

These protect a live service. A single failure on Sunday morning costs far more
than any new feature is worth, so these come before anything else.

1. **Crash-safe autosave & "restore last service" on launch**
   - *Why:* OBS browser sources can be reloaded mid-service; a volunteer can
     accidentally close the dock. Losing the setlist 30 seconds before a song
     is devastating.
   - *What:* Persist the full working state (current setlist, active item,
     display settings, recent Bible refs) to `localStorage` on every change,
     and show a "Restore previous service?" banner on boot.
   - *Where:* `js/panel/state-and-storage.js`,
     `js/panel/bootstrap-and-init.js`.

2. **"Black / Clear / Logo" panic buttons with a global hotkey**
   - *Why:* Every operator needs a one-press way to clear the output when
     something goes wrong (wrong verse, wrong song, kid on stage). This is
     table stakes for live presentation.
   - *What:* Three always-visible buttons in the dock (Black, Clear, Logo) +
     configurable keyboard shortcuts. Should also work via vMix shortcut and
     OBS hotkey bridge.
   - *Where:* `js/panel/app-commands-and-shortcuts.js`,
     `js/panel/sync-and-output.js`, `BSP_display.html`.

3. **Offline-first Bible + song caching**
   - *Why:* Many churches have flaky internet; Auto-Retrieve Lyrics and some
     Bible versions fetch from the network today. Services must not depend on
     WAN connectivity.
   - *What:* Cache downloaded Bible versions and retrieved lyrics to IndexedDB;
     add a "Download for offline" action on Bible versions and a visible
     online/offline indicator.
   - *Where:* `js/panel/songs-and-bible.js`,
     `js/panel/state-and-storage.js`.

4. **Preview-before-live (Program/Preview split)**
   - *Why:* Sending content straight to air is error-prone. Church operators
     need to stage the next verse/slide and confirm before it hits the stream.
   - *What:* Second preview pane in the dock that mirrors the display pipeline
     but is not broadcast; a "Take" button promotes Preview → Program.
   - *Where:* `js/panel/program-display-and-transform.js`,
     `js/panel/render-and-selection.js`, `js/panel/sync-and-output.js`.

5. **Panel ↔ display heartbeat with visible health indicator**
   - *Why:* If the Browser Source silently drops the `BroadcastChannel` link,
     the operator keeps clicking "Go Live" and nothing reaches the stream.
     Today there is no in-dock signal that the display is actually listening.
   - *What:* A periodic heartbeat from `BSP_display.html` back to the panel,
     plus a green/amber/red "Display" status pill in the dock header; on red,
     auto-attempt resync and surface a "reload display" hint.
   - *Where:* `js/panel/sync-and-output.js`, `BSP_display.html`,
     `js/panel/sidebar-and-workspace.js`.

6. **Confirm-before-close & "service in progress" guard**
   - *Why:* A volunteer tabbing away, closing the dock, or refreshing OBS
     mid-service will silently blank the stream. The app should know when a
     service is live and resist accidental teardown.
   - *What:* Mark a service "in progress" the moment the first item goes live;
     intercept `beforeunload`, dock-close, and hotkey-reload with a confirm
     dialog; expose a "End Service" button to clear the flag intentionally.
   - *Where:* `js/panel/bootstrap-and-init.js`,
     `js/panel/app-commands-and-shortcuts.js`,
     `js/panel/state-and-storage.js`.

7. **Safe-mode boot when persisted state is corrupt**
   - *Why:* A malformed setlist or bad theme JSON in `localStorage` can take
     the whole dock down on launch — the worst possible time, right before a
     service. There must always be a way back into a working panel.
   - *What:* Wrap state hydration in a try/catch; on parse failure, boot into
     a "Safe Mode" with defaults, keep the broken state in a quarantined key
     for recovery, and show a banner explaining what happened.
   - *Where:* `js/panel/state-and-storage.js`,
     `js/panel/bootstrap-and-init.js`.

8. **Pre-service checklist / "Ready for service" diagnostic**
   - *Why:* Most live-service failures are preventable: wrong Bible version
     missing offline, display source not added, vMix not reachable, fonts not
     loaded. A 10-second check before the doors open catches all of them.
   - *What:* A "Run Pre-Service Check" button that verifies display link,
     offline Bible availability, selected fonts, vMix/OBS bridge, and
     storage headroom, then reports pass/warn/fail with one-click fixes.
   - *Where:* New `js/panel/preflight.js`, wired into
     `js/panel/sidebar-and-workspace.js` and `js/panel/sync-and-output.js`.

### P1 — Operator workflow & Sunday-morning speed

Once the service is safe, the next win is making the operator faster under
pressure.

9. **Service plan import (Planning Center / Elvanto / CSV)**
   - *Why:* Most churches already plan songs + readings in Planning Center or
     similar. Re-typing them into the panel is duplicated work and a source of
     errors.
   - *What:* An "Import Service Plan" action that accepts Planning Center
     Services API, Elvanto, or a simple CSV and builds the setlist
     automatically (with song lookup + Bible reference parsing).
   - *Where:* New `js/panel/service-plan-import.js`, wired into
     `js/panel/songs-and-bible.js` and setlist code.

10. **CCLI reporting support**
   - *Why:* Licensed churches are required to report song usage to CCLI. If
     the plugin already tracks which song went live, it can export a compliant
     usage report and save the worship leader hours each month.
   - *What:* Capture CCLI song number + timestamp whenever a song is sent
     live; add an "Export CCLI report" view with date-range filter and CSV
     output.
   - *Where:* `js/panel/songs-and-bible.js`,
     `js/panel/state-and-storage.js`, new export view in
     `js/panel/workspace-and-editor-tools.js`.

11. **Bilingual / dual-language display (side-by-side, not just dual Bible)**
   - *Why:* Many churches run services in two languages (e.g. English +
     Spanish, English + Yoruba, English + Mandarin). Dual Bible versions exist,
     but song lyrics currently don't have a first-class bilingual layout.
   - *What:* A "Bilingual" display template that renders primary + secondary
     language on the same slide for both songs and Bible, using the existing
     translation pipeline.
   - *Where:* `js/panel/vmix-and-translation.js`,
     `BSP_display.html`, `js/panel/program-display-and-transform.js`.

12. **Scripture reference parser in the quick-search bar**
   - *Why:* Operators should type `john 3:16-18` or `ps 23` into one box and
     get the verse staged. Today's flow requires picking a book + chapter +
     verse explicitly.
   - *What:* A single-line reference parser that understands common
     abbreviations in multiple languages and hands off to the Bible loader.
   - *Where:* `js/panel/songs-and-bible.js`,
     `js/panel/reference-localization-theme.js`.

### P2 — Integration with the rest of the church stack

13. **OBS WebSocket control (scenes + hotkeys from inside the dock)**
   - *Why:* The dock currently talks to the display but not to OBS itself.
     Letting it trigger OBS scene changes (e.g. switch to "Sermon" scene when
     a Bible reference goes live) removes a whole operator role.
   - *What:* OBS WebSocket v5 client in the panel; per-item "on-go-live" scene
     action; expose OBS hotkeys as triggers.
   - *Where:* New `js/panel/obs-websocket-bridge.js`; reuse
     `js/panel/sync-and-output.js`.

14. **Stream Deck / MIDI / keyboard macro layer**
    - *Why:* Volunteers are more confident with physical buttons than mouse
      hunting. Stream Deck is near-universal in church AV.
    - *What:* Expose panel commands over a stable local WebSocket + a Stream
      Deck plugin manifest; document a MIDI learn mode for cheap MIDI pads.
    - *Where:* `js/panel/app-commands-and-shortcuts.js`, new
      `integrations/streamdeck/` plugin folder.

15. **Remote operator mode (tablet on the platform, laptop in the booth)**
    - *Why:* The worship leader on stage often wants to advance lyrics
      themselves. Today that requires a second OBS instance.
    - *What:* A minimal web client that connects to the panel over LAN (same
      WebSocket as #10) and exposes a "next line / previous line / blank"
      interface suitable for a phone or tablet.
    - *Where:* `js/panel/remote-show-tools.js`, new `remote/` static app.

16. **Accessibility & readability pass on `BSP_display.html`**
    - *Why:* Viewers on small phones, older displays, and those with low
      vision struggle with thin fonts, low contrast, and tiny lower-thirds.
    - *What:* WCAG-AA contrast presets, min-font-size guardrails, automatic
      drop-shadow when background brightness is ambiguous, "safe area"
      overlay in the editor.
    - *Where:* `BSP_display.html`,
      `js/panel/program-display-and-transform.js`,
      `js/panel/settings-and-controls.js`.

### P3 — Growth features (after the above land)

17. **Sermon notes / outline projection** — separate content type alongside
    Songs and Bible, so pastors can publish an outline slide track (likely a
    new tab and new storage namespace in `state-and-storage.js`).
18. **Multi-campus sync** — one "host" panel broadcasts Program state to
    "follower" panels at other campuses via the existing Worker relay; reuse
    `feedback-worker/` infrastructure with a new `bsp-sync` Worker.
19. **Recording a "service highlight reel"** — tag moments while live, then
    export a chapter list for the stream VOD
    (`recording-and-livestream-tools.js`).
20. **Song library sharing between churches** — signed JSON bundles of song
    packs (lyrics + arrangement + CCLI number) that can be imported without
    re-typing, gated on CCLI compliance.
21. **Translator console** — a dedicated view for a live translator that sees
    upcoming verses + song lines a few seconds early and can push an override
    translation to the bilingual layout (#7).

### P4 — Project hygiene (ongoing, not blocking church value)

- Break up the 697 KB `Bible Song Pro panel.html` shell by moving more markup
  and CSS out of the monolithic file into `js/panel/` + companion stylesheets.
- Add automated smoke tests for the panel ↔ display handshake (Playwright
  against `index.html`) so regressions in `sync-and-output.js` are caught
  before release.
- Replace ad-hoc `localStorage` schemas with a versioned migration layer in
  `state-and-storage.js` so v2 → v3 doesn't wipe user setlists.
- CI build of the Electron artifacts on tagged releases, so
  `dist:mac|win|linux` isn't a manual step per platform.

---

## 3. Priority Summary

| Priority | Theme | Items |
|---|---|---|
| **P0** | Don't break the live service | Autosave/restore, panic buttons, offline cache, Preview/Program, display heartbeat, close guard, safe-mode boot, pre-service checklist |
| **P1** | Make Sunday morning faster | Service-plan import, CCLI reports, bilingual display, reference parser |
| **P2** | Fit the church AV stack | OBS WebSocket, Stream Deck/MIDI, remote operator, accessibility pass |
| **P3** | Grow the product | Sermon notes, multi-campus sync, highlight reel, song sharing, translator console |
| **P4** | Keep the codebase healthy | Shell decomposition, E2E tests, storage migrations, CI packaging |

Ship P0 before anything else. Every P1 item assumes P0 is in place.
