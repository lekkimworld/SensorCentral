import { config as dotenvConfig } from "dotenv";
import http from "http";
import crypto from "crypto";
import { URL, URLSearchParams } from "url";
import path from "path";

dotenvConfig({ path: path.join(__dirname, ".env") });

const PORT = Number(process.env.OIDC_PORT || 9876);
const HOSTNAME = process.env.OIDC_HOSTNAME || "localhost";
const EXTERNAL_HOSTNAME = process.env.OIDC_EXTERNAL_HOSTNAME || "localhost";
const ISSUER = `http://${HOSTNAME}:${PORT}`;
const EXTERNAL_BASE = `http://${EXTERNAL_HOSTNAME}:${PORT}`;
const CLIENT_ID = process.env.OIDC_CLIENT_ID || "test-client-id";
const CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET || "test-client-secret";

// Generate RSA key pair for signing tokens
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const KID = "test-key-1";

const sub = process.env.OIDC_SUB || "local-test-user-001";
const testUser = {
    sub,
    email: `${sub}@localhost`,
    given_name: "Test",
    family_name: "User",
};

function base64url(data: Buffer | string): string {
    const buf = typeof data === "string" ? Buffer.from(data) : data;
    return buf.toString("base64url");
}

function createJwt(payload: Record<string, any>): string {
    const header = { alg: "RS256", typ: "JWT", kid: KID };
    const headerB64 = base64url(JSON.stringify(header));
    const payloadB64 = base64url(JSON.stringify(payload));
    const signature = crypto.sign("sha256", Buffer.from(`${headerB64}.${payloadB64}`), privateKey);
    return `${headerB64}.${payloadB64}.${base64url(signature)}`;
}

function getJwks() {
    const keyObject = crypto.createPublicKey(publicKey);
    const jwk = keyObject.export({ format: "jwk" });
    return { keys: [{ ...jwk, kid: KID, use: "sig", alg: "RS256" }] };
}

function getDiscovery() {
    return {
        issuer: ISSUER,
        authorization_endpoint: `${EXTERNAL_BASE}/authorize`,
        token_endpoint: `${ISSUER}/token`,
        userinfo_endpoint: `${ISSUER}/userinfo`,
        jwks_uri: `${ISSUER}/.well-known/jwks.json`,
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        scopes_supported: ["openid", "email", "profile"],
        token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
        code_challenge_methods_supported: ["S256"],
    };
}

// Store authorization codes
const codes = new Map<string, { nonce?: string; codeChallenge?: string; redirectUri: string }>();

const server = http.createServer((req, res) => {
    const url = new URL(req.url!, `http://localhost:${PORT}`);
    const path = url.pathname;

    // CORS for local dev
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    if (path === "/.well-known/openid-configuration") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(getDiscovery()));
        return;
    }

    if (path === "/.well-known/jwks.json") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(getJwks()));
        return;
    }

    if (path === "/authorize") {
        const code = crypto.randomUUID();
        const nonce = url.searchParams.get("nonce") || undefined;
        const codeChallenge = url.searchParams.get("code_challenge") || undefined;
        const redirectUri = url.searchParams.get("redirect_uri")!;
        codes.set(code, { nonce, codeChallenge, redirectUri });

        const redirect = new URL(redirectUri);
        redirect.searchParams.set("code", code);
        if (url.searchParams.get("state")) {
            redirect.searchParams.set("state", url.searchParams.get("state")!);
        }

        console.log(`[oidc-provider] Authorize -> redirecting to ${redirect.href}`);
        res.writeHead(302, { location: redirect.href });
        res.end();
        return;
    }

    if (path === "/token" && req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
            const params = new URLSearchParams(body);
            const code = params.get("code");
            const codeVerifier = params.get("code_verifier");

            if (!code || !codes.has(code)) {
                res.writeHead(400, { "content-type": "application/json" });
                res.end(JSON.stringify({ error: "invalid_grant" }));
                return;
            }

            const stored = codes.get(code)!;
            codes.delete(code);

            // Verify PKCE if code_challenge was provided
            if (stored.codeChallenge && codeVerifier) {
                const expected = base64url(crypto.createHash("sha256").update(codeVerifier).digest());
                if (expected !== stored.codeChallenge) {
                    res.writeHead(400, { "content-type": "application/json" });
                    res.end(JSON.stringify({ error: "invalid_grant", error_description: "PKCE verification failed" }));
                    return;
                }
            }

            const now = Math.floor(Date.now() / 1000);
            const idToken = createJwt({
                iss: ISSUER,
                sub: testUser.sub,
                aud: CLIENT_ID,
                exp: now + 3600,
                iat: now,
                nonce: stored.nonce,
                email: testUser.email,
                given_name: testUser.given_name,
                family_name: testUser.family_name,
            });

            res.writeHead(200, { "content-type": "application/json" });
            res.end(JSON.stringify({
                access_token: crypto.randomUUID(),
                token_type: "Bearer",
                expires_in: 3600,
                id_token: idToken,
            }));
        });
        return;
    }

    if (path === "/userinfo") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(testUser));
        return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
});

server.listen(PORT, () => {
    console.log(`[oidc-provider] Local OIDC provider running at ${ISSUER}`);
    console.log(`[oidc-provider] Client ID:     ${CLIENT_ID}`);
    console.log(`[oidc-provider] Client Secret: ${CLIENT_SECRET}`);
    console.log(`[oidc-provider] Sub claim:     ${testUser.sub}${process.env.OIDC_LOCAL_SUB ? " (from OIDC_LOCAL_SUB)" : " (default)"}`);
    console.log(`[oidc-provider] Test user:     ${testUser.email} (${testUser.given_name} ${testUser.family_name})`);
    console.log();
    console.log(`[oidc-provider] Set these env vars in SensorCentral:`);
    console.log(`  OIDC_PROVIDER_URL_LOCAL=${ISSUER}`);
    console.log(`  OIDC_CLIENT_ID_LOCAL=${CLIENT_ID}`);
    console.log(`  OIDC_CLIENT_SECRET_LOCAL=${CLIENT_SECRET}`);
    console.log(`  OIDC_REDIRECT_URI_LOCAL=http://localhost:8080/openid/callback/local`);
    console.log();
    console.log(`[oidc-provider] Override sub claim with: OIDC_LOCAL_SUB=<your-user-sub>`);
});
