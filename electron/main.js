const { app, BrowserWindow, ipcMain, screen, shell, clipboard } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const { WebSocketServer } = require('ws');

let mainWindow = null;
let outputWindow = null;
let outputClosedCallbacks = new Set();
let httpServer = null;
let relayServer = null;
const relayClients = new Set();
const LOCAL_HTTP_PORT = 5510;
const LOCAL_RELAY_PORT = 5511;

function resolveAppFile(name) {
  return path.join(__dirname, '..', name);
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.json') return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

function getLanAddresses() {
  const interfaces = os.networkInterfaces();
  const out = [];
  Object.values(interfaces).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (!entry || entry.internal) return;
      if (entry.family !== 'IPv4') return;
      out.push(entry.address);
    });
  });
  return [...new Set(out)];
}

function getLocalServerInfo() {
  const addresses = getLanAddresses();
  const preferredHost = addresses[0] || '127.0.0.1';
  return {
    httpPort: LOCAL_HTTP_PORT,
    relayPort: LOCAL_RELAY_PORT,
    preferredHost,
    availableHosts: ['127.0.0.1', ...addresses],
    displayPath: '/BSP_display.html',
    displayUrl: `http://${preferredHost}:${LOCAL_HTTP_PORT}/BSP_display.html?hostMode=vmix&relay=ws://${preferredHost}:${LOCAL_RELAY_PORT}`,
    relayUrl: `ws://${preferredHost}:${LOCAL_RELAY_PORT}`
  };
}

function startHttpServer() {
  if (httpServer) return;
  httpServer = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = decodeURIComponent(url.pathname === '/' ? '/BSP_display.html' : url.pathname);
    const target = resolveAppFile(pathname.replace(/^\/+/, ''));
    if (!target.startsWith(path.join(__dirname, '..'))) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.readFile(target, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': getContentType(target) });
      res.end(data);
    });
  });
  httpServer.listen(LOCAL_HTTP_PORT, '0.0.0.0');
}

function startRelayServer() {
  if (relayServer) return;
  relayServer = new WebSocketServer({ host: '0.0.0.0', port: LOCAL_RELAY_PORT });
  relayServer.on('connection', (socket) => {
    relayClients.add(socket);
    socket.on('close', () => relayClients.delete(socket));
    socket.on('message', (payload) => {
      relayClients.forEach((client) => {
        if (client === socket || client.readyState !== 1) return;
        client.send(payload.toString());
      });
    });
  });
}

function broadcastRelayMessage(message) {
  const data = typeof message === 'string' ? message : JSON.stringify(message);
  relayClients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(data);
    }
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 560,
    minHeight: 760,
    backgroundColor: '#101318',
    title: 'Bible Song Pro',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(resolveAppFile('Bible Song Pro panel.html'));
  mainWindow.on('closed', () => {
    mainWindow = null;
    if (outputWindow && !outputWindow.isDestroyed()) {
      outputWindow.close();
    }
  });
}

function getDisplayBounds(displayId) {
  const displays = screen.getAllDisplays();
  if (displayId) {
    const match = displays.find((entry) => entry.id === displayId);
    if (match) return match.bounds;
  }
  const external = displays.find((entry) => !entry.internal) || screen.getPrimaryDisplay();
  return external.bounds;
}

function createOutputWindow(options = {}) {
  const bounds = getDisplayBounds(options.displayId);
  if (outputWindow && !outputWindow.isDestroyed()) {
    outputWindow.setBounds(bounds);
    outputWindow.focus();
    return outputWindow;
  }

  outputWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    show: true,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    fullscreen: !!options.fullscreen,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  outputWindow.loadFile(resolveAppFile('BSP_display.html'), {
    query: {
      standalone: '1',
      hostMode: 'standalone'
    }
  });

  outputWindow.on('closed', () => {
    outputWindow = null;
    outputClosedCallbacks.forEach((webContentsId) => {
      const sender = BrowserWindow.fromWebContents(
        [...BrowserWindow.getAllWindows()]
          .map((win) => win.webContents)
          .find((contents) => contents.id === webContentsId)
      );
      if (sender && sender.webContents) {
        sender.webContents.send('bsp:output-closed');
      }
    });
  });

  return outputWindow;
}

function getSystemStats() {
  return {
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
      percent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100)
    },
    cpu: {
      percent: 0
    },
    gpu: {
      renderer: 'Electron',
      vram: ''
    }
  };
}

app.whenReady().then(() => {
  ipcMain.handle('bsp:get-displays', () => {
    return screen.getAllDisplays().map((display) => ({
      id: display.id,
      label: display.label || `Display ${display.id}`,
      width: display.bounds.width,
      height: display.bounds.height,
      x: display.bounds.x,
      y: display.bounds.y,
      isPrimary: display.id === screen.getPrimaryDisplay().id,
      isInternal: !!display.internal
    }));
  });

  ipcMain.handle('bsp:open-output', (event, options = {}) => {
    createOutputWindow(options);
    return { ok: true };
  });

  ipcMain.handle('bsp:close-output', () => {
    if (outputWindow && !outputWindow.isDestroyed()) {
      outputWindow.close();
    }
    return { ok: true };
  });

  ipcMain.handle('bsp:is-output-open', () => {
    return !!(outputWindow && !outputWindow.isDestroyed());
  });

  ipcMain.handle('bsp:send-output-message', (_event, message) => {
    if (!outputWindow || outputWindow.isDestroyed()) return { ok: false };
    outputWindow.webContents.send('bsp:output-message', message);
    return { ok: true };
  });
  ipcMain.handle('bsp:send-vmix-output-message', (_event, message) => {
    broadcastRelayMessage(message);
    return { ok: true };
  });
  ipcMain.handle('bsp:get-local-server-info', () => getLocalServerInfo());
  ipcMain.handle('bsp:copy-text', (_event, text) => {
    clipboard.writeText(String(text || ''));
    return { ok: true };
  });

  ipcMain.handle('bsp:request-output-fullscreen', () => {
    if (outputWindow && !outputWindow.isDestroyed()) {
      outputWindow.setFullScreen(true);
    }
    return { ok: true };
  });

  ipcMain.handle('bsp:get-system-stats', () => getSystemStats());
  ipcMain.handle('bsp:save-theme', () => ({ ok: true }));
  ipcMain.handle('bsp:open-in-location', async (_event, targetPath) => {
    if (targetPath) await shell.showItemInFolder(targetPath);
    return { ok: true };
  });

  ipcMain.on('bsp:register-output-closed-listener', (event) => {
    outputClosedCallbacks.add(event.sender.id);
  });

  startHttpServer();
  startRelayServer();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (httpServer) {
    try { httpServer.close(); } catch (e) {}
  }
  if (relayServer) {
    try { relayServer.close(); } catch (e) {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
