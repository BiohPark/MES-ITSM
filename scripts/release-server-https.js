#!/usr/bin/env node
/**
 * HTTPS server for release folder. Copy this to release/server-https.js when packaging.
 * Usage: SSL_CERT_PATH=./cert.pem SSL_KEY_PATH=./key.pem node server-https.js
 * Spawns server.js on INTERNAL_PORT (127.0.0.1), then proxies HTTPS (PORT) to it.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const INTERNAL_PORT = parseInt(process.env.INTERNAL_PORT, 10) || 3001;
const hostname = process.env.HOSTNAME || '0.0.0.0';
const certPath = process.env.SSL_CERT_PATH;
const keyPath = process.env.SSL_KEY_PATH;

if (!certPath || !keyPath) {
  console.error('HTTPS requires SSL_CERT_PATH and SSL_KEY_PATH.');
  process.exit(1);
}

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error('Certificate or key file not found.');
  process.exit(1);
}

const dir = __dirname;
const child = spawn('node', [path.join(dir, 'server.js')], {
  cwd: dir,
  env: { ...process.env, PORT: String(INTERNAL_PORT), HOSTNAME: '127.0.0.1' },
  stdio: 'inherit',
});

child.on('error', (err) => {
  console.error('Failed to start app server:', err);
  process.exit(1);
});

let ready = false;
const check = () => {
  const req = http.get(`http://127.0.0.1:${INTERNAL_PORT}`, (res) => {
    if (!ready) {
      ready = true;
      startHttps();
    }
  });
  req.on('error', () => {
    if (!ready) setTimeout(check, 200);
  });
  req.setTimeout(500, () => req.destroy());
};

function startHttps() {
  const options = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };

  const proxy = (req, res) => {
    const headers = { ...req.headers, host: `127.0.0.1:${INTERNAL_PORT}` };
    if (req.headers.host) headers['x-forwarded-host'] = req.headers.host;
    headers['x-forwarded-proto'] = 'https';
    const opts = {
      hostname: '127.0.0.1',
      port: INTERNAL_PORT,
      path: req.url,
      method: req.method,
      headers,
    };
    const proxyReq = http.request(opts, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', () => {
      res.writeHead(502);
      res.end('Bad Gateway');
    });
    req.pipe(proxyReq);
  };

  https.createServer(options, proxy).listen(PORT, hostname, () => {
    console.log(`HTTPS server listening on https://${hostname}:${PORT}`);
  });
}

setTimeout(check, 2000);
