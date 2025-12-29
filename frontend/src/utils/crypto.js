// Web Crypto API utilities

// Generate a random AES-GCM key
export async function generateKey() {
    return window.crypto.subtle.generateKey(
        {
            name: "AES-GCM",
            length: 256,
        },
        true,
        ["encrypt", "decrypt"]
    );
}

// Encrypt text or binary
export async function encrypt(data, key, returnBinary = false) {
    let encodedData;
    if (typeof data === 'string') {
        const encoder = new TextEncoder();
        encodedData = encoder.encode(data);
    } else {
        encodedData = data;
    }

    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv,
        },
        key,
        encodedData
    );

    if (returnBinary) {
        return {
            ciphertext: ciphertext,
            iv: iv
        };
    }

    return {
        ciphertext: bufferToBase64(ciphertext),
        iv: bufferToBase64(iv),
    };
}

// Decrypt text or binary
export async function decrypt(ciphertext, iv, key, returnBinary = false) {
    let ciphertextBuf, ivBuf;

    if (typeof ciphertext === 'string') {
        ciphertextBuf = base64ToBuffer(ciphertext);
    } else {
        ciphertextBuf = ciphertext;
    }

    if (typeof iv === 'string') {
        ivBuf = base64ToBuffer(iv);
    } else {
        ivBuf = iv;
    }

    const decrypted = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: ivBuf,
        },
        key,
        ciphertextBuf
    );

    if (returnBinary) {
        return decrypted;
    }

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
}

// Export key to JWK (for URL)
export async function exportKey(key) {
    const exported = await window.crypto.subtle.exportKey("jwk", key);
    // We only need k component (the key material) for compact URL if we assume alg/ext
    // But safer to allow full JWK re-import.
    // To keep URL short, we can just export the raw bytes and base64url encode them?
    // JWK is standard. Let's start with JWK.
    // To make it URL safe, we encode the JSON string as base64url.
    return base64UrlEncode(JSON.stringify(exported));
}

// Import key from JWK string
export async function importKey(jwkString) {
    try {
        const jwk = JSON.parse(base64UrlDecode(jwkString));
        return window.crypto.subtle.importKey(
            "jwk",
            jwk,
            {
                name: "AES-GCM",
                length: 256
            },
            true,
            ["encrypt", "decrypt"]
        );
    } catch (e) {
        console.error("Key import failed", e);
        throw new Error("Invalid key format");
    }
}


// Helpers
function bufferToBase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToBuffer(base64) {
    try {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    } catch (e) {
        console.error("base64ToBuffer failed for input:", base64);
        throw e;
    }
}

function base64UrlEncode(str) {
    return btoa(str)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function base64UrlDecode(str) {
    str = str
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    while (str.length % 4) {
        str += '=';
    }
    return atob(str);
}
