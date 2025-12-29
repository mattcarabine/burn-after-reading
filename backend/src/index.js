export default {
    async fetch(request, env, ctx) {
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        const url = new URL(request.url);
        const path = url.pathname;

        try {
            if (request.method === "POST" && path === "/api/secrets") {
                const body = await request.json();
                const { ciphertext, iv, expiry = 3600 } = body || {};

                if (!ciphertext || !iv) {
                    return new Response(JSON.stringify({ error: "Missing ciphertext or iv" }), {
                        status: 400,
                        headers: { "Content-Type": "application/json", ...corsHeaders },
                    });
                }

                const id = crypto.randomUUID();
                // Store in KV with expiration (default 1 hour if not specified, max 7 days)
                // Note: expiry is in seconds from now.
                // KV put options: { expirationTtl: number } (min 60)
                const ttl = Math.max(60, Math.min(expiry, 60 * 60 * 24 * 7)); // Clamp between 60s and 7 days

                await env.SECRETS_KV.put(id, JSON.stringify({ ciphertext, iv }), {
                    expirationTtl: ttl,
                });

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

                const secret = await env.SECRETS_KV.get(id);

                if (!secret) {
                    return new Response(JSON.stringify({ error: "Secret not found or already burned" }), {
                        status: 404,
                        headers: { "Content-Type": "application/json", ...corsHeaders },
                    });
                }

                // BURN AFTER READING: Delete immediately
                await env.SECRETS_KV.delete(id);

                return new Response(secret, {
                    headers: { "Content-Type": "application/json", ...corsHeaders },
                });
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
