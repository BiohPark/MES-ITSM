# Offline / Firewall-Friendly Deployment (No npm Required)

This folder is a **standalone deployment package** that runs without any npm or network access.
Suitable for environments where the firewall blocks npm registry or external connections.

## Requirements

- **Node.js** only (npm is not required to run the app).
- MySQL database reachable from the deployment host.

## Quick Start

1. Copy `.env.example` to `.env` and set your database and app settings (e.g. `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`).
2. Start the server:

   ```bash
   node server.js
   ```

3. Open in browser: `http://localhost:3000` (or `http://<this-machine-IP>:3000` when listening on all interfaces).

Default port: **3000** (override with the `PORT` environment variable).

## Listening Modes

- **LAN / shared network**: By default the server binds to `0.0.0.0`, so other PCs can use `http://<host-IP>:3000`.
- **Local only**: To accept connections only from this machine:

  - Windows: `set HOSTNAME=127.0.0.1` then `node server.js`
  - Linux/macOS: `HOSTNAME=127.0.0.1 node server.js`

## HTTPS (Optional)

If you have SSL certificate and key files:

- Windows:
  ```bat
  set SSL_CERT_PATH=./cert.pem
  set SSL_KEY_PATH=./key.pem
  node server-https.js
  ```
- Linux/macOS:
  ```bash
  SSL_CERT_PATH=./cert.pem SSL_KEY_PATH=./key.pem node server-https.js
  ```

To listen on all interfaces with HTTPS:

```bash
HOSTNAME=0.0.0.0 SSL_CERT_PATH=./cert.pem SSL_KEY_PATH=./key.pem node server-https.js
```

## Contents of This Package

- **server.js** – Main Next.js standalone server (HTTP).
- **server-https.js** – HTTPS server wrapper when SSL is required.
- **.next/** – Built application and static assets.
- **public/** – Static files.
- **.env.example** – Example environment variables (copy to `.env` and edit).

No `node_modules` or `npm install` is needed to run this package.
