# OpenResend

**OpenResend** is a modern, lightweight, multi-account, self-hosted webmail client built specifically for [Resend](https://resend.com) transactional and inbound email APIs.

Designed with an AppSec-first posture, OpenResend allows developers, agencies, and small teams to manage incoming and outgoing email across multiple domains with full privacy, zero credential leakage, and robust cryptographic isolation.

---

## Key Features

- **Multi-Account & Multi-Domain Isolation**: Connect separate Resend API keys across domains. Cryptographically isolated tenants ensure no cross-account data leakage.
- **AES-256-GCM Encryption**: All Resend API keys are encrypted at rest with authenticated AES-256-GCM (`iv:authTag:ciphertext`). Zero plaintext keys are ever saved or returned to the frontend.
- **Deterministic RFC 5322 Email Threading**: Organizes incoming and outgoing messages into unified conversational threads using `Message-ID`, `In-Reply-To`, `References`, and normalized subject headers (with a 7-day fallback window).
- **Sandboxed Security Viewer & Tracking Blocker**: Renders email HTML inside a hardened, isolated sandbox (`sandbox="allow-popups allow-popups-to-escape-sandbox"`). Remote images and 1x1 tracking pixels are blocked by default to protect recipient IP addresses.
- **Inbound Webhook Verification**: Built-in verification for Resend / Svix signatures (`svix-signature`, `svix-timestamp`, `svix-id`) with 5-minute replay-attack protection and HMAC-SHA256 fallback.
- **Internationalization (i18n)**: Launch localization support for **English (`en`)**, **Spanish (`es`)**, **Hindi (`hi`)**, **Chinese (`zh`)**, **German (`de`)**, and **French (`fr`)**.
- **Dual Database Support**: Run effortlessly with local SQLite for lightweight single-node instances or production PostgreSQL for scalable container deployments.

---

## Environment Variables Checklist

Copy `.env.example` to `.env` and configure the following variables:

| Variable | Required | Description | Example |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **Yes** | Connection string for SQLite or PostgreSQL | `postgresql://user:pass@localhost:5432/openresend?schema=public` or `file:./dev.db` |
| `ENCRYPTION_KEY` | **Yes** | 32-byte secret key (or 64-char hex string) used for AES-256-GCM API key encryption | `openssl rand -hex 32` |
| `JWT_SECRET` | **Yes** | Cryptographic secret used for signing session tokens | `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | **Yes** | Public canonical URL of your instance for webhook dispatch | `https://mail.example.com` |

---

## Quickstart with Docker Compose

OpenResend includes a multi-stage `Dockerfile` and production `docker-compose.yml` linking the Next.js standalone runner with PostgreSQL 16.

### 1. Clone & Configure
```bash
git clone https://github.com/your-org/resend-webmail-client.git
cd resend-webmail-client/open-resend-client
cp .env.example .env
```

Generate secure secrets for `.env`:
```bash
# Generate ENCRYPTION_KEY
openssl rand -hex 32

# Generate JWT_SECRET
openssl rand -base64 32
```

### 2. Launch Services
```bash
docker compose up -d --build
```

### 3. Initialize Database Schema
```bash
docker compose exec app npx prisma db push
```

Access the web interface at `http://localhost:3000` and complete the initial administrator registration at `/setup`.

---

## Local Development

Ensure you have **Node.js 20+** and **npm** installed:

```bash
# Install dependencies
npm install

# Push local SQLite schema
npx prisma db push

# Run test suites (40 tests across 11 test suites)
npm test

# Start development server
npm run dev
```

---

## Reverse-Proxy Guidelines (Production)

When deploying behind a reverse-proxy (Nginx or Caddy), ensure HTTP headers and request bodies for incoming Resend webhooks are passed unmodified to preserve cryptographic Svix signatures.

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name mail.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mail.example.com;

    ssl_certificate /etc/letsencrypt/live/mail.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mail.example.com/privkey.pem;

    client_max_body_size 25M; # Support large inbound email attachments

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Standard proxy headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Inbound Webhook Signature Preservation
        proxy_set_header svix-id $http_svix_id;
        proxy_set_header svix-timestamp $http_svix_timestamp;
        proxy_set_header svix-signature $http_svix_signature;
        proxy_set_header x-webhook-secret $http_x_webhook_secret;

        # Disable buffering for real-time dispatch
        proxy_buffering off;
    }
}
```

### Caddy Configuration

```caddy
mail.example.com {
    request_body {
        max_size 25MB
    }

    reverse_proxy localhost:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

---

## Resend Inbound Routing Setup

1. Log into your [Resend Dashboard](https://resend.com/emails).
2. Navigate to **Webhooks** -> **Add Webhook**.
3. Set the endpoint URL to:
   ```
   https://mail.example.com/api/webhooks/resend/<YOUR_ACCOUNT_WEBHOOK_TOKEN>
   ```
   *(Find your unique Webhook Token in OpenResend -> **Account Settings**).*
4. Under events, select `email.received` (and optionally `email.delivered`, `email.bounced`).
5. Copy the **Signing Secret** (starting with `whsec_`) and paste it into OpenResend Account Settings to enable Svix cryptographic verification.

---

## Security Architecture

1. **Zero-Knowledge Key Storage**: API keys are encrypted at rest using AES-256-GCM. Decryption keys are held strictly in memory during dispatch and never stored in cookies or client caches.
2. **Replay-Attack Protection**: Inbound Svix webhooks reject timestamps with variance `> 300` seconds (5 minutes).
3. **HTML Sanitization**: All inbound HTML passes through `isomorphic-dompurify` to strip dangerous elements (`<script>`, `onerror`, `onload`, `javascript:` URI schemes).
4. **Sandboxed Rendering**: Message previews use `<iframe sandbox="allow-popups allow-popups-to-escape-sandbox">`, preventing script execution or cookie theft.
5. **Strict Tenant Boundaries**: All database queries enforce scoping to the authenticated `userId`.

---

## License

MIT License. OpenResend is free and open-source software.
