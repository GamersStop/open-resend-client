# OpenResend

**OpenResend** is a lightweight, privacy-focused, multi-account webmail client built specifically for **local development and local mail management** with [Resend](https://resend.com) APIs.

> **Local Development Focus**: This project is developed specifically for your **local environment**. It gives you a fast, secure local webmail interface where you can connect multiple Resend domains, inspect inbound and outbound email threads, test email delivery, and directly compose or reply to emails with full RFC 5322 thread context.

---

## What You Can Do in OpenResend

- **Manage Resend Accounts Locally**: Connect one or multiple Resend domains and API keys. All keys are encrypted at rest using AES-256-GCM.
- **Read & Organize Conversations**: Automatic RFC 5322 threading groups messages into clean conversation timelines using `Message-ID`, `In-Reply-To`, and subject normalization.
- **Reply Directly to Emails**: Click "Reply" or "Reply All" to send context-aware replies through your Resend domain with automatic reference header linking.
- **Compose New Outbound Emails**: Send rich-text or plain-text messages with file attachments directly through your verified Resend domains.
- **Safe HTML Previews**: Embedded sandboxed viewer prevents scripts from executing and blocks remote tracking pixels to protect your local environment and IP address.
- **Zero-Setup Database**: Uses local SQLite by default (`dev.db`), requiring no external database servers or services.

---

## Step-by-Step: How to Run Locally

Follow these clear steps to run OpenResend on your local machine in under 2 minutes:

### Prerequisites
- **Node.js**: version `20.x` or later (verify with `node -v`)
- **npm**: version `9.x` or later (verify with `npm -v`)

---

### Step 1: Open Terminal & Navigate to App Directory
```bash
cd open-resend-client
```

---

### Step 2: Configure Local Environment (`.env`)
Copy the provided `.env.example` file to `.env`:

```bash
# On Linux/macOS
cp .env.example .env

# On Windows (PowerShell)
Copy-Item .env.example .env
```

Open `.env` in your code editor. For local running with SQLite, the defaults work out of the box:
```env
# Local SQLite database (creates dev.db automatically)
DATABASE_URL="file:./dev.db"

# 32-byte secret key for AES-256-GCM API key encryption (generate with: openssl rand -hex 32)
ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

# JWT session signing secret (generate with: openssl rand -base64 32)
JWT_SECRET="local-dev-jwt-secret-key-change-this-for-production"

# Local app URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

> **Tip**: You can generate secure local keys using OpenSSL or Node:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

### Step 3: Install Dependencies
```bash
npm install
```

---

### Step 4: Initialize Local SQLite Database
Run Prisma to create your local database schema and tables:

```bash
npx prisma db push
```

*(This creates `prisma/dev.db` with all tables for users, accounts, threads, messages, and attachments).*

---

### Step 5: (Optional) Run Automated Tests
Verify that all 40 test suites pass cleanly on your machine:

```bash
npm test
```

---

### Step 6: Start Local Development Server
```bash
npm run dev
```

Open your browser and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## How to Manage & Reply to Resend Emails

### 1. Initial Admin Account Setup
When running for the first time, navigate to:
- **`http://localhost:3000/setup`**
- Create your local administrator account (Email + Master Password).
- Once created, sign in at `/login`.

---

### 2. Connect Your Resend Account
1. In the sidebar, click **Account Settings** (or navigate to `http://localhost:3000/settings`).
2. Click **Add Account**.
3. Fill in:
   - **Account Display Label**: e.g., `Acme Production` or `Personal Domain`.
   - **Resend API Key**: Your `re_...` key from [Resend API Keys](https://resend.com/api-keys).
   - **Default Sender Email**: An email matching your verified Resend domain (e.g., `inbox@yourdomain.com`).
   - **Default Sender Name**: Your name or team name (e.g., `Alex from Acme`).
   - **Webhook Secret**: Paste your Resend webhook secret (`whsec_...`) or leave empty for local development.
4. Click **Save Account**. Your API key is encrypted with AES-256-GCM before saving to `dev.db`.

---

### 3. Receiving Inbound Emails Locally
To receive emails from Resend on your local development machine:

1. Copy your unique **Inbound Webhook Endpoint** from the Account Settings page:
   ```
   http://localhost:3000/api/webhooks/resend/<YOUR_UNIQUE_WEBHOOK_TOKEN>
   ```
2. For testing live emails received by Resend, expose your local port 3000 using a secure tunnel like [Cloudflare Tunnels](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) or [Ngrok](https://ngrok.com/):
   ```bash
   ngrok http 3000
   ```
3. In your [Resend Webhooks Dashboard](https://resend.com/webhooks), add a webhook pointing to:
   ```
   https://<your-ngrok-subdomain>.ngrok-free.app/api/webhooks/resend/<YOUR_UNIQUE_WEBHOOK_TOKEN>
   ```
   Select event: `email.received`.

---

### 4. Viewing Conversations & Mailbox
- Open the mailbox at `http://localhost:3000`.
- The left column shows your active conversation threads with unread indicators and timestamps.
- Click any thread to open the conversation timeline.
- External images and 1x1 tracking pixels are blocked by default with a safety banner. Click **Load Remote Images** whenever you wish to view them.

---

### 5. Replying to Emails
1. While viewing any thread in the timeline, click **Reply** or click the inline reply prompt at the bottom of the conversation.
2. The composer automatically:
   - Sets **From** to the configured account email.
   - Pre-fills **To** with the original sender's address.
   - Sets **Subject** with `Re: <original subject>`.
   - Attaches RFC 5322 headers (`In-Reply-To` and `References`) pointing to the parent message ID.
3. Type your response in Rich Text or Plain Text mode and click **Send Message**.
4. The message is dispatched through Resend's API and appended to your thread timeline as an `OUTBOUND` entry.

---

### 6. Composing Brand New Emails
- Click the **Compose** button in the sidebar.
- Choose which connected Resend account/domain to send from.
- Enter recipients (`To`, `Cc`, `Bcc`), subject, message body, and drag-and-drop attachments.
- Click **Send Message** to dispatch immediately.

---

## Local Development Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts local Next.js dev server with hot reload |
| `npm test` | Runs the Node.js native test runner (40 tests, 11 suites) |
| `npx prisma db push` | Synchronizes Prisma schema with local `dev.db` |
| `npx prisma studio` | Opens visual database browser at `http://localhost:5555` |
| `npm run build` | Builds production standalone bundle for deployment |

---

## Security In Local Environment

- **Zero Plaintext Secrets**: Resend API keys are encrypted with AES-256-GCM before entering SQLite.
- **Script Neutralization**: All email HTML is sanitized with `isomorphic-dompurify` and displayed inside an isolated iframe sandbox (`sandbox="allow-popups allow-popups-to-escape-sandbox"`), neutralizing `<script>` or malicious DOM injections.
- **Privacy First**: Remote images are blocked by default so viewing test emails will not leak your local IP address to tracking services.

---

## License

MIT License. OpenResend is free and open-source software.
