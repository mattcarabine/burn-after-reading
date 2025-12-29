import { describe, it, expect } from 'vitest';
import { generateKey, encrypt, decrypt } from './crypto';

describe('Crypto Utils', () => {
    it('should encrypt and decrypt text (default)', async () => {
        const key = await generateKey();
        const text = "Hello World 123";

        const { ciphertext, iv } = await encrypt(text, key);

        expect(typeof ciphertext).toBe('string');
        expect(typeof iv).toBe('string');

        const decrypted = await decrypt(ciphertext, iv, key);
        expect(decrypted).toBe(text);
    });

    it('should encrypt and decrypt binary data', async () => {
        const key = await generateKey();
        const data = new Uint8Array([1, 2, 3, 255]).buffer;

        const { ciphertext, iv } = await encrypt(data, key, true);

        console.log('Ciphertext type:', ciphertext.constructor.name);
        console.log('Ciphertext value:', ciphertext);

        // Ciphertext should be ArrayBuffer
        expect(ciphertext.constructor.name).toBe('ArrayBuffer');
        // expect(ciphertext).toBeInstanceOf(ArrayBuffer); // Fails in some envs
        expect(iv).toBeInstanceOf(Uint8Array); // or ArrayBuffer depending on implementation, let's check what we returned.
        // encrypt returns iv as Uint8Array (from getRandomValues) if returnBinary is true in my impl

        const decrypted = await decrypt(ciphertext, iv, key, true);

        expect(decrypted.constructor.name).toBe('ArrayBuffer');
        // expect(decrypted).toBeInstanceOf(ArrayBuffer);
        const decryptedArr = new Uint8Array(decrypted);
        expect(decryptedArr).toEqual(new Uint8Array(data));
    });

    it('should handle mixed types (Binary Encrypt -> Base64 Decrypt fail check or similar)', async () => {
        // Just checking robustness
        const key = await generateKey();
        const text = "Test";
        const { ciphertext, iv } = await encrypt(text, key, true);

        // Decrypt expecting text but passing binary inputs
        const decrypted = await decrypt(ciphertext, iv, key); // returnBinary defaults false
        expect(decrypted).toBe(text);
    });
});
