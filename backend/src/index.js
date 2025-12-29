export default {
    async fetch(request, env, ctx) {
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Content-Length",
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        const url = new URL(request.url);
        const path = url.pathname;

        try {
            if (request.method === "POST" && path === "/api/secrets") {
                const contentType = request.headers.get("Content-Type") || "";

                const contentLength = request.headers.get("Content-Length");
                const MAX_SIZE = 100 * 1024 * 1024; // 100 MB

                if (contentLength && parseInt(contentLength) > MAX_SIZE) {
                    return new Response(JSON.stringify({ error: "Payload too large. Max 100MB." }), {
                        status: 413,
                        headers: { "Content-Type": "application/json", ...corsHeaders },
                    });
                }

                let ciphertext, iv, expiry, filename;
                let isFile = false;

                if (contentType.includes("application/json")) {
                    const body = await request.json();
                    ciphertext = body.ciphertext;
                    iv = body.iv;
                    expiry = body.expiry || 3600;
                } else if (contentType.includes("multipart/form-data")) {
                    const formData = await request.formData();
                    ciphertext = formData.get("ciphertext");
                    iv = formData.get("iv");
                    expiry = formData.get("expiry") || 3600;
                    filename = formData.get("filename");
                    isFile = true;
                } else {
                    return new Response(JSON.stringify({ error: "Unsupported Content-Type" }), {
                        status: 415,
                        headers: { "Content-Type": "application/json", ...corsHeaders },
                    });
                }

                if (!ciphertext || !iv) {
                    return new Response(JSON.stringify({ error: "Missing ciphertext or iv" }), {
                        status: 400,
                        headers: { "Content-Type": "application/json", ...corsHeaders },
                    });
                }

                const id = crypto.randomUUID();
                const ttl = Math.max(60, Math.min(expiry, 60 * 60 * 24 * 7));

                if (isFile && filename) {
                    await env.BUCKET.put(id, ciphertext);

                    await env.SECRETS_KV.put(id, JSON.stringify({
                        iv,
                        filename,
                        type: 'file',
                        r2_key: id
                    }), {
                        expirationTtl: ttl,
                    });
                } else {
                    await env.SECRETS_KV.put(id, JSON.stringify({ ciphertext, iv, type: 'text' }), {
                        expirationTtl: ttl,
                    });
                }

                return new Response(JSON.stringify({ id }), {
                    headers: { "Content-Type": "application/json", ...corsHeaders },
                });
            }

            if (request.method === "GET" && path.startsWith("/api/secrets/")) {
                const id = path.split("/").pop();

                if (!id) {
                    return new Response(JSON.stringify({ error: "Missing ID" }), {
                        status: 400,
                        headers: { "Content-Type": "application/json", ...corsHeaders },
                    });
                }

                const secretRaw = await env.SECRETS_KV.get(id);

                if (!secretRaw) {
                    return new Response(JSON.stringify({ error: "Secret not found or already burned" }), {
                        status: 404,
                        headers: { "Content-Type": "application/json", ...corsHeaders },
                    });
                }

                await env.SECRETS_KV.delete(id);

                const secret = JSON.parse(secretRaw);

                if (secret.type === 'file') {
                    const object = await env.BUCKET.get(id);

                    if (!object) {
                        return new Response(JSON.stringify({ error: "File data missing from storage" }), {
                            status: 500,
                            headers: { "Content-Type": "application/json", ...corsHeaders },
                        });
                    }

                    ctx.waitUntil(env.BUCKET.delete(id));

                    const headers = new Headers(corsHeaders);
                    headers.set("Content-Type", "application/octet-stream");
                    headers.set("X-Burn-IV", secret.iv);
                    headers.set("X-Burn-Filename", secret.filename);
                    headers.set("Access-Control-Expose-Headers", "X-Burn-IV, X-Burn-Filename");

                    return new Response(object.body, {
                        headers,
                    });

                } else {
                    return new Response(JSON.stringify(secret), {
                        headers: { "Content-Type": "application/json", ...corsHeaders },
                    });
                }
            }

            return new Response("Not Found", { status: 404, headers: corsHeaders });
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), {
                status: 500,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }
    },
};
