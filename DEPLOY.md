# Deployment Guide

This application is designed to be deployed on Cloudflare. The frontend uses **Cloudflare Pages**, and the backend uses **Cloudflare Workers** with **KV Storage**.

## Prerequisites

- A Cloudflare Account
- A GitHub Repository hosting this code
- Node.js and npm installed locally (for initial setup)

## 1. Backend Setup (Cloudflare Workers)

The backend is configured to deploy automatically via GitHub Actions.

### Step 1.1: Create KV Namespace
The backend needs a Key-Value storage namespace to persist the encrypted secrets.

1. Install Wrangler globally if you haven't: `npm install -g wrangler`
2. Login to Cloudflare: `wrangler login`
3. Create the namespace:
   ```bash
   wrangler kv:namespace create SECRETS_KV
   ```
4. Copy the `id` from the output.
5. Edit `backend/wrangler.toml` and replace `YOUR_KV_NAMESPACE_ID` with the ID you just copied. 
   *(Note: You can also set this as a secret in GitHub Actions if you prefer not to commit it, but `wrangler.toml` IDs are generally not considered sensitive credentials, just identifiers.)*

### Step 1.2: Configure GitHub Secrets
For the GitHub Action to deploy your worker, it needs permissions.

1. Go to your GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions**.
2. Add the following repository secrets:
    - `CLOUDFLARE_API_TOKEN`: Create this in the [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens) using the **Edit Cloudflare Workers** template.
    - `CLOUDFLARE_ACCOUNT_ID`: Find this on the right side of your Cloudflare Dashboard overview page.

### Step 1.3: Push to Deploy
Commit your changes (including the updated `wrangler.toml`) and push to the `main` branch.
- The **Deploy Backend Worker** action should run and successfully deploy your worker.
- Note the URL of your deployed worker (e.g., `https://backend.your-name.workers.dev`).

## 2. Frontend Setup (Cloudflare Pages)

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

## 3. Verify Deployment

1. Open your new Pages URL (e.g., `https://frontend.pages.dev`).
2. Create a secret.
3. Verify that the link is generated.
4. Open the link in a private window to verify decryption works.
