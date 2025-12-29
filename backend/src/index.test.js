import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from './index.js';

describe('Worker API', () => {
    let env;
    let ctx;

    beforeEach(() => {
        env = {
            SECRETS_KV: {
                put: vi.fn(),
                get: vi.fn(),
                delete: vi.fn(),
            },
            BUCKET: {
                put: vi.fn(),
                get: vi.fn(),
                delete: vi.fn(),
            },
        };
        ctx = {
            waitUntil: vi.fn(),
        };
        global.crypto.randomUUID = vi.fn(() => 'test-uuid');
    });

    describe('POST /api/secrets', () => {
        it('should handle JSON text secrets', async () => {
            const request = new Request('http://localhost/api/secrets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ciphertext: 'ct', iv: 'iv' }),
            });

            const response = await worker.fetch(request, env, ctx);
            expect(response.status).toBe(200);

            const body = await response.json();
            expect(body.id).toBe('test-uuid');

            expect(env.SECRETS_KV.put).toHaveBeenCalledWith(
                'test-uuid',
                JSON.stringify({ ciphertext: 'ct', iv: 'iv', type: 'text' }),
                expect.objectContaining({ expirationTtl: expect.any(Number) })
            );
        });

        it('should handle multipart/form-data file uploads', async () => {
            const formData = new FormData();
            formData.append('ciphertext', new Blob(['file content']));
            formData.append('iv', 'iv-file');
            formData.append('filename', 'test.txt');

            const request = new Request('http://localhost/api/secrets', {
                method: 'POST',
                body: formData
            });


            const response = await worker.fetch(request, env, ctx);

            expect(response.status).toBe(200);
            expect(env.BUCKET.put).toHaveBeenCalledWith('test-uuid', expect.any(Object));
            expect(env.SECRETS_KV.put).toHaveBeenCalledWith(
                'test-uuid',
                JSON.stringify({ iv: 'iv-file', filename: 'test.txt', type: 'file', r2_key: 'test-uuid' }),
                expect.any(Object)
            );
        });

        it('should reject payload too large', async () => {
            const request = new Request('http://localhost/api/secrets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': (100 * 1024 * 1024 + 1).toString()
                },
                body: JSON.stringify({}),
            });

            const response = await worker.fetch(request, env, ctx);
            expect(response.status).toBe(413);
        });
    });

    describe('GET /api/secrets/:id', () => {
        it('should return text secrets and delete from KV', async () => {
            const secret = { ciphertext: 'ct', iv: 'iv', type: 'text' };
            env.SECRETS_KV.get.mockResolvedValue(JSON.stringify(secret));

            const request = new Request('http://localhost/api/secrets/test-uuid', {
                method: 'GET',
            });

            const response = await worker.fetch(request, env, ctx);
            expect(response.status).toBe(200);

            const body = await response.json();
            expect(body).toEqual(secret);

            expect(env.SECRETS_KV.delete).toHaveBeenCalledWith('test-uuid');
        });

        it('should return file stream and delete from R2 (lazy)', async () => {
            const secret = { iv: 'iv-file', filename: 'file.txt', type: 'file', r2_key: 'test-uuid' };
            env.SECRETS_KV.get.mockResolvedValue(JSON.stringify(secret));

            env.BUCKET.get.mockResolvedValue({
                body: new ReadableStream(),
            });

            const request = new Request('http://localhost/api/secrets/test-uuid', {
                method: 'GET',
            });

            const response = await worker.fetch(request, env, ctx);
            expect(response.status).toBe(200);

            expect(response.headers.get('X-Burn-IV')).toBe('iv-file');
            expect(response.headers.get('X-Burn-Filename')).toBe('file.txt');
            expect(response.headers.get('Content-Type')).toBe('application/octet-stream');

            expect(env.SECRETS_KV.delete).toHaveBeenCalledWith('test-uuid');
            expect(ctx.waitUntil).toHaveBeenCalled();
            expect(env.BUCKET.delete).toHaveBeenCalledWith('test-uuid');
        });
    });
});
