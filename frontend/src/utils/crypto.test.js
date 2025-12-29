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

        expect(ciphertext.constructor.name).toBe('ArrayBuffer');

        const decrypted = await decrypt(ciphertext, iv, key, true);

        expect(decrypted.constructor.name).toBe('ArrayBuffer');
        const decryptedArr = new Uint8Array(decrypted);
        expect(decryptedArr).toEqual(new Uint8Array(data));
    });

    it('should handle mixed types (Binary Encrypt -> Base64 Decrypt fail check or similar)', async () => {
        const key = await generateKey();
        const text = "Test";
        const { ciphertext, iv } = await encrypt(text, key, true);

        const decrypted = await decrypt(ciphertext, iv, key);
        expect(decrypted).toBe(text);
    });
});
