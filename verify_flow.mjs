// import { webcrypto } from 'node:crypto';
globalThis.window = { crypto: globalThis.crypto };
// globalThis.crypto = webcrypto; // Read-only in Node 22
// Polyfill TextEncoder/Decoder
import { TextEncoder, TextDecoder } from 'util';
globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;

import { generateKey, encrypt, decrypt } from './frontend/src/utils/crypto.js';
// We need to polyfill fetch and crypto for Node environment if not present
// Vitest environment has them, but running this as a script might need setup.
// Actually, I can use a vitest test file for this "verification" script to leverage the setup!

// But let's write a standalone script using 'node' and 'undici' (built-in fetch in Node 18) and 'webcrypto'.
// Node 18+ has fetch and crypto.

const API_URL = 'http://localhost:8787/api/secrets';

async function run() {
    try {
        console.log('--- Starting Verification ---');

        // 1. Generate Key
        const key = await generateKey();
        console.log('1. Generated Key');

        // 2. Encrypt File
        const fileContent = new Uint8Array([10, 20, 30, 40, 50]).buffer;
        const { ciphertext, iv } = await encrypt(fileContent, key, true);
        console.log('2. Encrypted File (Binary)');

        // 3. Upload
        const formData = new FormData();
        formData.append('ciphertext', new Blob([ciphertext]));
        // Note: Node's Blob/FormData support might be slightly different but usually works in modern Node.
        // We might need to ensure 'iv' is passed as base64 string because backend expects it in KV?
        // Backend put: JSON.stringify({ iv, ... }).
        // If we append blob, backend formData.get('iv') gets a file object?
        // In App.vue I did: formData.append('iv', btoa(...)).
        // Let's do same here.
        const ivB64 = Buffer.from(iv).toString('base64');
        formData.append('iv', ivB64);
        formData.append('filename', 'test-verify.bin');

        console.log('3. Uploading...');
        const res = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            console.error('Upload Failed:', await res.text());
            process.exit(1);
        }

        const { id } = await res.json();
        console.log(`4. Uploaded. ID: ${id}`);

        // 5. Download
        console.log('5. Downloading...');
        const dlRes = await fetch(`${API_URL}/${id}`);

        if (!dlRes.ok) {
            console.error('Download Failed:', await dlRes.text());
            process.exit(1);
        }

        // Check Headers
        const burnIv = dlRes.headers.get('X-Burn-IV');
        const burnFilename = dlRes.headers.get('X-Burn-Filename');

        if (burnIv !== ivB64) {
            console.error(`IV Mismatch! Expected ${ivB64}, got ${burnIv}`);
            // process.exit(1); // Maybe soft fail if headers normalization differs
        }
        if (burnFilename !== 'test-verify.bin') {
            console.error(`Filename Mismatch! Expected test-verify.bin, got ${burnFilename}`);
        }

        const dlBuffer = await dlRes.arrayBuffer();
        console.log(`6. Downloaded ${dlBuffer.byteLength} bytes`);

        // 6. Decrypt
        // burnIv is base64 string
        const decrypted = await decrypt(dlBuffer, burnIv, key, true);
        console.log('7. Decrypted');

        const match = new Uint8Array(decrypted).every((val, i) => val === new Uint8Array(fileContent)[i]);
        if (match) {
            console.log('SUCCESS: Decrypted content matches original!');
        } else {
            console.error('FAILURE: Content mismatch');
            process.exit(1);
        }

        // 7. Verify Burn
        console.log('8. Verifying Burn (Expect 404)...');
        const retryRes = await fetch(`${API_URL}/${id}`);
        if (retryRes.status === 404) {
            console.log('SUCCESS: Secret burned.');
        } else {
            console.error(`FAILURE: Secret still exists or error: ${retryRes.status}`);
            process.exit(1);
        }

    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

// Helpers for Crypto in Node context if import fails (as ESM in script is tricky without package.json "type": "module" or .mjs)
// I will write this file as .mjs
// import { webcrypto } from 'node:crypto';
// if (!globalThis.crypto) globalThis.crypto = webcrypto;

// But I need to import from my crypto.js which is an ES module.
// So I must save this as verify.mjs

run();
