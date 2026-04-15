    // =============================================================
    // Bible Song Pro — Command Bus + MIDI Learn (P2 #14)
    // =============================================================
    //
    // A unified command surface so external controllers (Stream Deck,
    // MIDI pads, keyboard macros, remote tablets) can trigger panel
    // actions through one API instead of reaching into private helpers.
    //
    // Architecture:
    //
    //   window.BSPCommands.register(id, {label, run, category})
    //   window.BSPCommands.run(id, payload?)       → returns a promise
    //   window.BSPCommands.list()                  → array of registrations
    //   window.BSPCommands.onBroadcast(msg)        → receives BroadcastChannel
    //                                                 {type: 'COMMAND', id, payload}
    //   window.BSPCommands.midi.learn(id)          → starts MIDI learn for id
    //   window.BSPCommands.midi.clear(id)          → unbinds id
    //   window.BSPCommands.midi.bindings           → current bindings map
    //
    // A small "Commands" button in the panic bar opens a table showing
    // every registered command with its current MIDI binding and a Learn
    // button.  Hotkeys are not re-exposed here — they're already handled
    // by service-reliability.js and app-commands-and-shortcuts.js.
    //
    // Stream Deck integration is scaffolded: a JSON manifest is exposed at
    // window.BSPCommands.streamDeckManifest() for a companion Stream Deck
    // plugin to fetch and register actions.  The companion plugin sends
    // BroadcastChannel messages {type: 'COMMAND', id} which we dispatch
    // through the same bus.
    //
    // Loaded after service-plan-import.js.
    // =============================================================

    // ----- Constants & state -----------------------------------------------

    const BSP_CMD_VERSION = 1;
    const BSP_CMD_MIDI_BINDINGS_KEY = 'commandBusMidiBindings';

    let bspCmdInitialized = false;
    let bspCmdRegistry = Object.create(null); // id → {label, run, category}
    let bspCmdMidiBindings = Object.create(null); // id → {type, channel, number}
    let bspCmdMidiLearnTarget = null; // id currently learning
    let bspCmdMidiAccess = null;
    let bspCmdModalEl = null;
    let bspCmdOpenButtonEl = null;

    // ----- Registry --------------------------------------------------------

    function bspCmdRegister(id, spec) {
      if (!id || typeof id !== 'string') return false;
      if (!spec || typeof spec.run !== 'function') return false;
      bspCmdRegistry[id] = {
        label: String(spec.label || id),
        run: spec.run,
        category: String(spec.category || 'general')
      };
      return true;
    }

    function bspCmdUnregister(id) {
      if (bspCmdRegistry[id]) delete bspCmdRegistry[id];
    }

    function bspCmdRun(id, payload) {
      const reg = bspCmdRegistry[id];
      if (!reg) {
        try { console.warn('[BSP Commands] unknown command:', id); } catch (_) {}
        return Promise.resolve({ ok: false, error: 'unknown command' });
      }
      try {
        const result = reg.run(payload);
        return Promise.resolve(result).then(function (r) { return { ok: true, result: r }; });
      } catch (err) {
        return Promise.resolve({ ok: false, error: (err && err.message) || String(err) });
      }
    }

    function bspCmdList() {
      const out = [];
      Object.keys(bspCmdRegistry).sort().forEach(function (id) {
        const r = bspCmdRegistry[id];
        out.push({ id: id, label: r.label, category: r.category });
      });
      return out;
    }

    // ----- Built-in command registration ----------------------------------
    //
    // Registered at init time so external controllers have a stable,
    // documented surface even if downstream modules change their internals.

    function bspCmdRegisterBuiltIns() {
      // Panic triad (from service-reliability.js)
      bspCmdRegister('panic.black', {
        label: 'Panic: Black output',
        category: 'panic',
        run: function () { if (typeof bspSendPanic === 'function') bspSendPanic('black'); }
      });
      bspCmdRegister('panic.clear', {
        label: 'Panic: Clear output',
        category: 'panic',
        run: function () {
          if (typeof clearOutput === 'function') { clearOutput({ fade: false }); }
          else if (typeof bspSendPanic === 'function') { bspSendPanic('clear'); }
        }
      });
      bspCmdRegister('panic.logo', {
        label: 'Panic: Show logo',
        category: 'panic',
        run: function () { if (typeof bspSendPanic === 'function') bspSendPanic('logo'); }
      });
      // Slide navigation (from workspace-and-editor-tools.js)
      bspCmdRegister('slide.next', {
        label: 'Next slide',
        category: 'navigation',
        run: function () { if (typeof nextSlide === 'function') nextSlide(); }
      });
      bspCmdRegister('slide.prev', {
        label: 'Previous slide',
        category: 'navigation',
        run: function () { if (typeof prevSlide === 'function') prevSlide(); }
      });
      // Project live
      bspCmdRegister('project.live', {
        label: 'Project / Go Live',
        category: 'navigation',
        run: function () { if (typeof projectLive === 'function') projectLive(true); }
      });
      // Service session
      bspCmdRegister('service.end', {
        label: 'End service (clear close guard)',
        category: 'service',
        run: function () { if (typeof bspEndService === 'function') bspEndService(); }
      });
      // Modals
      bspCmdRegister('modal.preflight', {
        label: 'Open pre-service checklist',
        category: 'ui',
        run: function () {
          if (window.BSPReliability && typeof window.BSPReliability.runPreflight === 'function') {
            window.BSPReliability.runPreflight();
          }
        }
      });
      bspCmdRegister('modal.ccli', {
        label: 'Open CCLI report',
        category: 'ui',
        run: function () {
          if (window.BSPCcli && typeof window.BSPCcli.openReport === 'function') {
            window.BSPCcli.openReport();
          }
        }
      });
      bspCmdRegister('modal.plan', {
        label: 'Open service plan import',
        category: 'ui',
        run: function () {
          if (window.BSPPlanImport && typeof window.BSPPlanImport.openModal === 'function') {
            window.BSPPlanImport.openModal();
          }
        }
      });
      // Preview/Program
      bspCmdRegister('preview.toggle', {
        label: 'Toggle Preview Mode',
        category: 'preview',
        run: function () {
          if (window.BSPReliability && typeof window.BSPReliability.togglePreview === 'function') {
            window.BSPReliability.togglePreview();
          }
        }
      });
      // Bilingual
      bspCmdRegister('bilingual.toggle', {
        label: 'Toggle bilingual display',
        category: 'display',
        run: function () {
          if (window.BSPBilingual && typeof window.BSPBilingual.toggle === 'function') {
            window.BSPBilingual.toggle();
          }
        }
      });
    }

    // ----- BroadcastChannel dispatch ---------------------------------------
    //
    // External controllers can send {type: 'COMMAND', id, payload} over the
    // existing BroadcastChannel and we'll route it through the registry.
    // This makes the command bus reachable from remote tablets (P2 #15)
    // and from a Stream Deck plugin that posts to the channel via a
    // companion helper.

    function bspCmdInstallChannelListener() {
      if (typeof channel === 'undefined' || !channel) return;
      const prev = channel.onmessage;
      channel.onmessage = function (e) {
        const d = (e && e.data) || {};
        if (d && d.type === 'COMMAND' && typeof d.id === 'string') {
          bspCmdRun(d.id, d.payload).then(function (result) {
            // Echo the result back so remote controllers can show confirm UI.
            try {
              if (channel) {
                channel.postMessage({
                  type: 'COMMAND_RESULT',
                  id: d.id,
                  requestId: d.requestId || null,
                  ts: Date.now(),
                  result: result
                });
              }
            } catch (_) {}
          });
        }
        if (typeof prev === 'function') {
          try { prev.call(channel, e); } catch (err) {
            try { console.error('[BSP Commands] prior onmessage failed', err); } catch (_) {}
          }
        }
      };
    }

    // ----- MIDI learn ------------------------------------------------------
    //
    // Uses the Web MIDI API (navigator.requestMIDIAccess).  When learning is
    // active, the first incoming NoteOn or ControlChange becomes the binding.
    // Bindings are persisted to STORE_STATE:commandBusMidiBindings.

    function bspCmdMidiLoadBindings() {
      if (typeof idbGet !== 'function') return Promise.resolve({});
      return idbGet(STORE_STATE, BSP_CMD_MIDI_BINDINGS_KEY).then(function (entry) {
        if (entry && entry.value && typeof entry.value === 'object') return entry.value;
        return {};
      }).catch(function () { return {}; });
    }

    function bspCmdMidiSaveBindings() {
      if (typeof idbPut !== 'function') return Promise.resolve(false);
      return idbPut(STORE_STATE, {
        key: BSP_CMD_MIDI_BINDINGS_KEY,
        value: bspCmdMidiBindings,
        updatedAt: Date.now()
      }).catch(function () { return false; });
    }

    function bspCmdMidiInit() {
      if (!navigator || typeof navigator.requestMIDIAccess !== 'function') {
        try { console.info('[BSP Commands] Web MIDI API unavailable'); } catch (_) {}
        return;
      }
      navigator.requestMIDIAccess({ sysex: false }).then(function (access) {
        bspCmdMidiAccess = access;
        access.inputs.forEach(function (input) {
          input.onmidimessage = bspCmdMidiMessageHandler;
        });
        access.onstatechange = function (ev) {
          if (ev.port && ev.port.type === 'input') {
            if (ev.port.state === 'connected') {
              ev.port.onmidimessage = bspCmdMidiMessageHandler;
            }
          }
        };
      }).catch(function (err) {
        try { console.info('[BSP Commands] MIDI access denied:', err); } catch (_) {}
      });
    }

    function bspCmdMidiMessageHandler(e) {
      const data = e.data || [];
      const status = data[0] || 0;
      const cmd = status & 0xf0;
      const channelNum = (status & 0x0f) + 1;
      let type = null;
      let number = data[1];
      if (cmd === 0x90 && data[2] > 0) type = 'note';      // Note On with velocity
      else if (cmd === 0xb0) type = 'cc';                   // Control Change
      if (!type) return;

      // If learning, bind the first qualifying event.
      if (bspCmdMidiLearnTarget) {
        const targetId = bspCmdMidiLearnTarget;
        bspCmdMidiLearnTarget = null;
        bspCmdMidiBindings[targetId] = { type: type, channel: channelNum, number: number };
        bspCmdMidiSaveBindings();
        bspCmdRenderModalTable();
        if (typeof showToast === 'function') {
          showToast('MIDI bound: ' + targetId + ' → ' + type + ' ch' + channelNum + ' #' + number);
        }
        return;
      }

      // Otherwise, look up a matching binding and fire.
      const ids = Object.keys(bspCmdMidiBindings);
      for (let i = 0; i < ids.length; i += 1) {
        const id = ids[i];
        const b = bspCmdMidiBindings[id];
        if (!b) continue;
        if (b.type === type && b.channel === channelNum && b.number === number) {
          bspCmdRun(id);
          return;
        }
      }
    }

    function bspCmdMidiStartLearn(id) {
      if (!bspCmdRegistry[id]) return;
      bspCmdMidiLearnTarget = id;
      if (typeof showToast === 'function') {
        showToast('Press a MIDI note or knob to bind to: ' + id);
      }
      bspCmdRenderModalTable();
    }

    function bspCmdMidiClearBinding(id) {
      if (bspCmdMidiBindings[id]) {
        delete bspCmdMidiBindings[id];
        bspCmdMidiSaveBindings();
        bspCmdRenderModalTable();
        if (typeof showToast === 'function') showToast('Cleared binding: ' + id);
      }
    }

    // ----- Config modal UI -------------------------------------------------

    function bspCmdInjectStyles() {
      if (document.getElementById('bsp-cmd-styles')) return;
      const css = `
        #bsp-cmd-modal {
          background: #12151d;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 14px;
          padding: 20px 22px;
          width: min(640px, 94vw);
          max-height: 86vh;
          display: flex;
          flex-direction: column;
          color: #e8eaed;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          box-shadow: 0 24px 60px rgba(0,0,0,0.55);
        }
        #bsp-cmd-modal h2 { margin: 0 0 6px 0; font-size: 18px; font-weight: 700; }
        #bsp-cmd-modal .bsp-cmd-sub { margin: 0 0 14px 0; font-size: 12px; color: #9aa0a6; }
        #bsp-cmd-modal .bsp-cmd-status {
          font-size: 12px;
          color: #9aa0a6;
          margin: 0 0 10px 0;
        }
        #bsp-cmd-modal .bsp-cmd-table-wrap {
          flex: 1 1 auto;
          overflow: auto;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          background: rgba(0,0,0,0.2);
        }
        #bsp-cmd-modal table.bsp-cmd-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        #bsp-cmd-modal .bsp-cmd-table th,
        #bsp-cmd-modal .bsp-cmd-table td {
          padding: 7px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          text-align: left;
          vertical-align: middle;
        }
        #bsp-cmd-modal .bsp-cmd-table th {
          background: rgba(255,255,255,0.03);
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #9aa0a6;
          position: sticky;
          top: 0;
        }
        #bsp-cmd-modal .bsp-cmd-cat {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          border: 1px solid rgba(255,255,255,0.12);
          color: #9aa0a6;
        }
        #bsp-cmd-modal .bsp-cmd-binding {
          font-family: ui-monospace, "SF Mono", Menlo, monospace;
          font-size: 11px;
          color: #80ffe0;
        }
        #bsp-cmd-modal .bsp-cmd-binding.empty { color: #6b7280; }
        #bsp-cmd-modal .bsp-cmd-binding.learning { color: #ffd580; animation: bspCmdPulse 1s ease-in-out infinite; }
        @keyframes bspCmdPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        #bsp-cmd-modal .bsp-cmd-actions {
          margin-top: 14px;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
      `;
      const style = document.createElement('style');
      style.id = 'bsp-cmd-styles';
      style.textContent = css;
      document.head.appendChild(style);
    }

    function bspCmdOpenModal() {
      bspCmdInjectStyles();
      const existing = document.getElementById('bsp-sr-modal-backdrop');
      if (existing) existing.remove();

      const backdrop = document.createElement('div');
      backdrop.id = 'bsp-sr-modal-backdrop';
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) backdrop.remove();
      });

      const modal = document.createElement('div');
      modal.id = 'bsp-cmd-modal';
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);
      bspCmdModalEl = modal;

      const title = document.createElement('h2');
      title.textContent = 'Commands & MIDI';
      modal.appendChild(title);
      const sub = document.createElement('p');
      sub.className = 'bsp-cmd-sub';
      sub.textContent = 'Every command exposed to Stream Deck, MIDI, and remote operators. Click "Learn" then press a MIDI note or knob to bind.';
      modal.appendChild(sub);

      const status = document.createElement('div');
      status.className = 'bsp-cmd-status';
      modal.appendChild(status);
      const midiOk = !!(navigator && typeof navigator.requestMIDIAccess === 'function');
      const inputsCount = bspCmdMidiAccess ? bspCmdMidiAccess.inputs.size : 0;
      status.textContent = midiOk
        ? ('MIDI: ' + inputsCount + ' input(s) available')
        : 'MIDI: Web MIDI API unavailable in this browser';

      const wrap = document.createElement('div');
      wrap.className = 'bsp-cmd-table-wrap';
      wrap.id = 'bsp-cmd-table-wrap';
      modal.appendChild(wrap);

      const actions = document.createElement('div');
      actions.className = 'bsp-cmd-actions';
      const manifestBtn = document.createElement('button');
      manifestBtn.type = 'button';
      manifestBtn.className = 'bsp-sr-btn';
      manifestBtn.textContent = 'Copy Stream Deck manifest';
      manifestBtn.addEventListener('click', function () {
        const manifest = bspCmdStreamDeckManifest();
        const json = JSON.stringify(manifest, null, 2);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(json).then(function () {
            if (typeof showToast === 'function') showToast('Stream Deck manifest copied to clipboard');
          }).catch(function () {
            try { console.log('[BSP Commands] Stream Deck manifest:\n' + json); } catch (_) {}
          });
        } else {
          try { console.log('[BSP Commands] Stream Deck manifest:\n' + json); } catch (_) {}
          if (typeof showToast === 'function') showToast('Manifest logged to console');
        }
      });
      actions.appendChild(manifestBtn);
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'bsp-sr-btn';
      closeBtn.textContent = 'Close';
      closeBtn.addEventListener('click', function () { backdrop.remove(); });
      actions.appendChild(closeBtn);
      modal.appendChild(actions);

      bspCmdRenderModalTable();
    }

    function bspCmdRenderModalTable() {
      if (!bspCmdModalEl) return;
      const wrap = document.getElementById('bsp-cmd-table-wrap');
      if (!wrap) return;
      wrap.innerHTML = '';
      const table = document.createElement('table');
      table.className = 'bsp-cmd-table';
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th style="width:100px">Category</th><th>Command</th><th style="width:170px">MIDI binding</th><th style="width:130px"></th></tr>';
      table.appendChild(thead);
      const tbody = document.createElement('tbody');
      bspCmdList().forEach(function (cmd) {
        const tr = document.createElement('tr');
        const catCell = document.createElement('td');
        const catBadge = document.createElement('span');
        catBadge.className = 'bsp-cmd-cat';
        catBadge.textContent = cmd.category;
        catCell.appendChild(catBadge);
        tr.appendChild(catCell);

        const labelCell = document.createElement('td');
        const labelStrong = document.createElement('div');
        labelStrong.style.fontWeight = '600';
        labelStrong.textContent = cmd.label;
        labelCell.appendChild(labelStrong);
        const idSmall = document.createElement('div');
        idSmall.style.cssText = 'font-size:10px;color:#6b7280;font-family:ui-monospace,Menlo,monospace;';
        idSmall.textContent = cmd.id;
        labelCell.appendChild(idSmall);
        tr.appendChild(labelCell);

        const bindingCell = document.createElement('td');
        const bindSpan = document.createElement('span');
        bindSpan.className = 'bsp-cmd-binding';
        const b = bspCmdMidiBindings[cmd.id];
        if (bspCmdMidiLearnTarget === cmd.id) {
          bindSpan.classList.add('learning');
          bindSpan.textContent = '⏺ learning…';
        } else if (b) {
          bindSpan.textContent = b.type + ' ch' + b.channel + ' #' + b.number;
        } else {
          bindSpan.classList.add('empty');
          bindSpan.textContent = '— none —';
        }
        bindingCell.appendChild(bindSpan);
        tr.appendChild(bindingCell);

        const actCell = document.createElement('td');
        const learnBtn = document.createElement('button');
        learnBtn.type = 'button';
        learnBtn.className = 'bsp-sr-btn';
        learnBtn.style.fontSize = '10px';
        learnBtn.style.padding = '3px 7px';
        learnBtn.style.marginRight = '4px';
        learnBtn.textContent = 'Learn';
        learnBtn.addEventListener('click', function () { bspCmdMidiStartLearn(cmd.id); });
        actCell.appendChild(learnBtn);
        if (b) {
          const clearBtn = document.createElement('button');
          clearBtn.type = 'button';
          clearBtn.className = 'bsp-sr-btn';
          clearBtn.style.fontSize = '10px';
          clearBtn.style.padding = '3px 7px';
          clearBtn.textContent = '✕';
          clearBtn.addEventListener('click', function () { bspCmdMidiClearBinding(cmd.id); });
          actCell.appendChild(clearBtn);
        }
        const runBtn = document.createElement('button');
        runBtn.type = 'button';
        runBtn.className = 'bsp-sr-btn bsp-sr-btn-accent';
        runBtn.style.fontSize = '10px';
        runBtn.style.padding = '3px 7px';
        runBtn.style.marginLeft = '4px';
        runBtn.textContent = 'Run';
        runBtn.addEventListener('click', function () { bspCmdRun(cmd.id); });
        actCell.appendChild(runBtn);
        tr.appendChild(actCell);

        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
    }

    // ----- Stream Deck manifest --------------------------------------------
    //
    // A tiny JSON descriptor a companion Stream Deck plugin can fetch to
    // populate its action list.  Each action in the manifest maps to a
    // command id; the plugin sends {type:'COMMAND',id} on the relay
    // socket (or a BroadcastChannel bridge) and the command bus dispatches.

    function bspCmdStreamDeckManifest() {
      return {
        name: 'Bible Song Pro',
        version: BSP_CMD_VERSION,
        description: 'Stream Deck command surface for Bible Song Pro panel',
        transport: 'broadcastchannel',
        channelName: (typeof CHANNEL_NAME !== 'undefined') ? CHANNEL_NAME : 'bible_song_pro_v1',
        actions: bspCmdList()
      };
    }

    // ----- Panic bar button + init ----------------------------------------

    function bspCmdInstallPanicBarButton() {
      if (bspCmdOpenButtonEl) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Cmds';
      btn.title = 'Commands & MIDI';
      btn.addEventListener('click', bspCmdOpenModal);

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
          'position:fixed;top:8px;right:170px;z-index:9500;' +
          'background:#1b1f2a;color:#e8eaed;border:1px solid rgba(255,255,255,0.18);' +
          'padding:6px 10px;border-radius:6px;font:600 12px -apple-system,sans-serif;cursor:pointer;';
        document.body.appendChild(btn);
      }
      bspCmdOpenButtonEl = btn;
    }

    function bspCommandBusInit() {
      if (bspCmdInitialized) return;
      bspCmdInitialized = true;
      try {
        bspCmdRegisterBuiltIns();
        bspCmdInstallChannelListener();
        bspCmdMidiLoadBindings().then(function (bindings) {
          bspCmdMidiBindings = bindings || {};
          bspCmdMidiInit();
        });
        bspCmdInstallPanicBarButton();
      } catch (err) {
        try { console.error('[BSP Commands] init failed', err); } catch (_) {}
      }
    }

    window.BSPCommands = {
      version: BSP_CMD_VERSION,
      init: bspCommandBusInit,
      register: bspCmdRegister,
      unregister: bspCmdUnregister,
      run: bspCmdRun,
      list: bspCmdList,
      openModal: bspCmdOpenModal,
      streamDeckManifest: bspCmdStreamDeckManifest,
      midi: {
        learn: bspCmdMidiStartLearn,
        clear: bspCmdMidiClearBinding,
        get bindings() { return Object.assign({}, bspCmdMidiBindings); }
      }
    };

    window.addEventListener('load', function () {
      const start = Date.now();
      const wait = setInterval(function () {
        const ready = (typeof stateReady !== 'undefined' && stateReady);
        if (ready || Date.now() - start > 8000) {
          clearInterval(wait);
          bspCommandBusInit();
        }
      }, 100);
    });

    // =============================================================
    // END OF FILE — Bible Song Pro Command Bus + MIDI Learn
    // =============================================================
