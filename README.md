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

## Deployment Guide

This application is designed to be deployed on Cloudflare. The frontend uses **Cloudflare Pages**, and the backend uses **Cloudflare Workers** with **KV Storage**.

### Prerequisites

- A Cloudflare Account
- A GitHub Repository hosting this code
- Node.js and npm installed locally (for initial setup)

### 1. Backend Setup (Cloudflare Workers)

The backend is configured to deploy automatically via Cloudflare's Git integration.

#### Step 1.1: Create KV Namespace
The backend needs a Key-Value storage namespace to persist the encrypted secrets.

1. Install Wrangler globally if you haven't: `npm install -g wrangler`
2. Login to Cloudflare: `wrangler login`
3. Create the namespace:
   ```bash
   wrangler kv namespace create SECRETS_KV
   ```
4. Copy the `id` from the output.
5. Edit `backend/wrangler.toml` and replace `YOUR_KV_NAMESPACE_ID` with the ID you just copied. 
   *(Note: You can also set this as a variable in the Cloudflare Dashboard if you prefer not to commit it, but `wrangler.toml` IDs are generally not considered sensitive credentials, just identifiers.)*

#### Step 1.2: Create R2 Bucket
The backend needs an R2 bucket to store file uploads.

1. Create the bucket:
   ```bash
   wrangler r2 bucket create burn-after-reading-files
   ```

#### Step 1.3: Connect to Git via Cloudflare Dashboard
Instead of using GitHub Actions, we will connect the repository directly via the Cloudflare Dashboard.

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/) and go to **Workers & Pages**.
2. Click **Create Application** -> **Connect to Git** and select your repository.
3. Configure the build settings:
    - **Root directory**: `/backend`
    - **Deploy command**: `npx wrangler deploy`
4. Click **Save and Deploy**.

#### Step 1.4: Verify Bindings
If your `wrangler.toml` is correctly configured and committed, Cloudflare should automatically detect your bindings.

1. Go to your Worker's **Settings** -> **Bindings**.
2. Verify that `SECRETS_KV` and `BUCKET` are listed.
3. If they are missing, you can add them manually:
    - **KV Namespace**: Variable name `SECRETS_KV` mapped to your `SECRETS_KV` namespace.
    - **R2 Bucket**: Variable name `BUCKET` mapped to the `burn-after-reading-files` bucket.

### 2. Frontend Setup (Cloudflare Pages)

Cloudflare Pages connects directly to your GitHub repository.

1. Go to the [Cloudflare Dashboard](https://dash.cloudflare.com/) and select **Pages**.
2. Click **Connect to Git** and select your repository.
3. Configure the build settings:
    - **Framework Preset**: `Vite` (or `Vue`)
    - **Build command**: `npm run build`
    - **Build output directory**: `dist`
    - **Root directory**: `frontend` (Important! The app is in a subdirectory)
4. **Environment Variables**:
    - Add a variable named `VITE_API_URL`.
    - Set the value to your deployed Worker URL (e.g., `https://backend.your-name.workers.dev`).
5. Click **Save and Deploy**.

### 3. Verify Deployment

1. Open your new Pages URL (e.g., `https://frontend.pages.dev`).
2. Create a secret.
3. Verify that the link is generated.
4. Open the link in a private window to verify decryption works.

## Security Model

1. **Encryption**: `AES-GCM` with a 256-bit key.
2. **Key Storage**: The key is encoded in the URL hash `#`. Browsers do not send the hash fragment to the server, ensuring the server cannot decrypt the message.
3. **Storage**: Only the `ciphertext` and `iv` (Initialization Vector) are stored in Cloudflare KV.
