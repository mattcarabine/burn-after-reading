import { describe, it, expect } from 'vitest';
import { parseSecretUrl } from './urlParser';

describe('parseSecretUrl', () => {
    it('parses a standard valid URL', () => {
        const hash = '#/secret/12345678-1234-1234-1234-1234567890ab#someKeyString';
        const result = parseSecretUrl(hash);
        expect(result).toEqual({
            id: '12345678-1234-1234-1234-1234567890ab',
            key: 'someKeyString'
        });
    });

    it('parses a URL with encoded separator (%23)', () => {
        const hash = '#/secret/12345678-1234-1234-1234-1234567890ab%23someKeyString';
        const result = parseSecretUrl(hash);
        expect(result).toEqual({
            id: '12345678-1234-1234-1234-1234567890ab',
            key: 'someKeyString'
        });
    });

    it('parses a URL where key is also encoded', () => {
        // simulated encoded key
        const hash = '#/secret/myId%23my%2Fkey%3D';
        // my/key= encoded is my%2Fkey%3D
        const result = parseSecretUrl(hash);
        expect(result).toEqual({
            id: 'myId',
            key: 'my/key='
        });
    });

    it('returns null for non-secret URLs', () => {
        expect(parseSecretUrl('')).toBeNull();
        expect(parseSecretUrl('#/')).toBeNull();
        expect(parseSecretUrl('#/other')).toBeNull();
    });

    it('throws error for missing separator', () => {
        const hash = '#/secret/justanidwithoutkey';
        expect(() => parseSecretUrl(hash)).toThrow('Invalid link format');
    });

    it('throws error for missing ID', () => {
        const hash = '#/secret/#keyonly';
        expect(() => parseSecretUrl(hash)).toThrow('Invalid link format');
    });

    it('throws error for missing key', () => {
        const hash = '#/secret/idonly#';
        expect(() => parseSecretUrl(hash)).toThrow('Invalid link format');
    });

    it('throws error for missing key with encoded separator', () => {
        const hash = '#/secret/idonly%23';
        expect(() => parseSecretUrl(hash)).toThrow('Invalid link format');
    });
});
