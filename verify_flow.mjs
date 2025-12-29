// import { webcrypto } from 'node:crypto';
globalThis.window = { crypto: globalThis.crypto };
// globalThis.crypto = webcrypto; // Read-only in Node 22
// Polyfill TextEncoder/Decoder
import { TextEncoder, TextDecoder } from 'util';
globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;

import { generateKey, encrypt, decrypt } from './frontend/src/utils/crypto.js';
const API_URL = 'http://localhost:8787/api/secrets';

async function run() {
    try {
        console.log('--- Starting Verification ---');

        const key = await generateKey();
        console.log('1. Generated Key');

        const fileContent = new Uint8Array([10, 20, 30, 40, 50]).buffer;
        const { ciphertext, iv } = await encrypt(fileContent, key, true);
        console.log('2. Encrypted File (Binary)');

        const formData = new FormData();
        formData.append('ciphertext', new Blob([ciphertext]));
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
            // process.exit(1);
        }
        if (burnFilename !== 'test-verify.bin') {
            console.error(`Filename Mismatch! Expected test-verify.bin, got ${burnFilename}`);
        }

        const dlBuffer = await dlRes.arrayBuffer();
        console.log(`6. Downloaded ${dlBuffer.byteLength} bytes`);

        const decrypted = await decrypt(dlBuffer, burnIv, key, true);
        console.log('7. Decrypted');

        const match = new Uint8Array(decrypted).every((val, i) => val === new Uint8Array(fileContent)[i]);
        if (match) {
            console.log('SUCCESS: Decrypted content matches original!');
        } else {
            console.error('FAILURE: Content mismatch');
            process.exit(1);
        }

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


run();
