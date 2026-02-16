#!/usr/bin/env node
/**
 * HTTPS proxy for Next.js app.
 * Requires: SSL_CERT_PATH, SSL_KEY_PATH (env).
 * Optional: PORT (default 3000), INTERNAL_PORT (default 3001), HOSTNAME (default 127.0.0.1).
 * Spawns next start (or next dev when MODE=dev) on INTERNAL_PORT, then serves HTTPS on PORT and proxies to it.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const INTERNAL_PORT = parseInt(process.env.INTERNAL_PORT, 10) || 3001;
const hostname = process.argv.includes('--lan') ? '0.0.0.0' : (process.env.HOSTNAME || '127.0.0.1');
const certPath = process.env.SSL_CERT_PATH;
const keyPath = process.env.SSL_KEY_PATH;
const isDev = process.env.MODE === 'dev';

if (!certPath || !keyPath) {
  console.error('HTTPS requires SSL_CERT_PATH and SSL_KEY_PATH.');
  console.error('Example: SSL_CERT_PATH=./cert.pem SSL_KEY_PATH=./key.pem npm run start:https');
  process.exit(1);
}

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error('Certificate or key file not found.');
  process.exit(1);
}

const nextArgs = isDev
  ? ['next', 'dev', '-p', String(INTERNAL_PORT), '-H', '127.0.0.1']
  : ['next', 'start', '-p', String(INTERNAL_PORT), '-H', '127.0.0.1'];

const child = spawn('npx', nextArgs, {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, PORT: String(INTERNAL_PORT) },
  stdio: 'inherit',
  shell: true,
});

child.on('error', (err) => {
  console.error('Failed to start Next.js:', err);
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
    proxyReq.on('error', (err) => {
      res.writeHead(502);
      res.end('Bad Gateway');
    });
    req.pipe(proxyReq);
  };

  https.createServer(options, proxy).listen(PORT, hostname, () => {
    console.log(`HTTPS server listening on https://${hostname}:${PORT}`);
  });
}

setTimeout(check, 1500);
