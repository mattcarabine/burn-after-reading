# Burn After Reading

A secure, ephemeral secret sharing application. This tool allows users to encrypt messages in their browser and generate a unique, one-time-use link. The message is encrypted locally using the Web Crypto API, and the server receives only the encrypted data. The decryption key is contained entirely within the URL anchor (fragment) and is never sent to the server.

## Features

- **Zero-Knowledge Privacy**: Encryption happens in the browser. The server never sees the plaintext or the decryption key.
- **One-Time Use**: Secrets are permanently deleted from the database immediately after they are retrieved.
- **Automatic Expiration**: Secrets have a short Time-To-Live (TTL) and expire automatically if not viewed.
- **Modern Stack**: Built with Vue 3, Tailwind CSS, and Cloudflare Workers.

## Project Structure

- `backend/`: Cloudflare Worker API that handles encrypted storage (KV) and retrieval.
- `frontend/`: Vue.js application handling the UI and client-side cryptography.

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm (installed with Node.js)

### 1. Start the Backend

The backend utilizes Cloudflare Workers and KV storage. Local development is powered by Wrangler, which simulates the Worker environment.

```bash
cd backend
npm install
npm run dev
```

The server effectively runs on `http://127.0.0.1:8787` (Wrangler will confirm the port).

### 2. Start the Frontend

The frontend is a Vite-powered Vue application.

```bash
cd frontend
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`) to use the application.

## Configuration & Deployment

### Local Development
Wrangler simulates the KV store locally in the `.wrangler` directory. No external Cloudflare account configuration is required for `npm run dev`.

### Production Deployment

To deploy to the internet, you will need a Cloudflare account.

1. **Backend**:
   - Log in to Cloudflare: `npx wrangler login`
   - Create the KV namespace: `npx wrangler kv:namespace create SECRETS_KV`
   - Update `backend/wrangler.toml` with the `id` returned by the previous command.
   - Deploy: `npm run deploy`

2. **Frontend**:
   - Configure the API URL in the frontend code to point to your production request worker URL instead of localhost.
   - Build for production: `npm run build`
   - Deploy the `dist/` folder to a static host like Cloudflare Pages.

## Security Model

1. **Encryption**: `AES-GCM` with a 256-bit key.
2. **Key Storage**: The key is encoded in the URL hash `#`. Browsers do not send the hash fragment to the server, ensuring the server cannot decrypt the message.
3. **Storage**: Only the `ciphertext` and `iv` (Initialization Vector) are stored in Cloudflare KV.
