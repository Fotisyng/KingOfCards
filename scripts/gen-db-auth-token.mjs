#!/usr/bin/env node
// Generates a one-off Ed25519 keypair and a matching, non-expiring full-access JWT for sqld's
// JWT auth strategy (SQLD_AUTH_JWT_KEY / TURSO_AUTH_TOKEN). sqld's other auth mode ("legacy HTTP
// basic") can't be used here: @libsql/client always sends `Authorization: Bearer <token>`, and
// sqld's basic strategy rejects any scheme word but "Basic".
// Run: node scripts/gen-db-auth-token.mjs
import crypto from "node:crypto";

const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");

const b64url = (data) => Buffer.from(data).toString("base64url");
const header = b64url(JSON.stringify({ alg: "EdDSA", typ: "JWT" }));
const payload = b64url(JSON.stringify({}));
const signingInput = `${header}.${payload}`;
const signature = crypto.sign(null, Buffer.from(signingInput), privateKey);
const jwt = `${signingInput}.${b64url(signature)}`;

const publicKeyX = publicKey.export({ format: "jwk" }).x;

console.log(`TURSO_AUTH_JWT_PUBLIC_KEY=${publicKeyX}`);
console.log(`TURSO_AUTH_TOKEN=${jwt}`);
