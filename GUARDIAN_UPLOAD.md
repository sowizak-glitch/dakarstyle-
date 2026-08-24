# Guardian-verified visual uploads

`POST /visuals/api/upload-secured` is the only image path that may produce a
`GUARDIAN_VERIFIED` manifest.

The caller must provide:

- `X-SOWHAT-KEY` through an encrypted machine credential;
- the secured image in multipart field `file`;
- the twelve `guardian_*` evidence fields returned by AI Image Guardian.

The Worker verifies the HMAC-SHA-256 envelope with
`GUARDIAN_EVIDENCE_KEY`, recomputes SHA-256 over the exact uploaded bytes and
requires the watermark, metadata and C2PA controls to all be true. It then
writes the media, Visual Passport V2 manifest and Visual Vault index entry to
R2. Partial R2 writes are rolled back.

Configure both Worker secrets with Wrangler; do not put them in source or
`wrangler.visual-upload.jsonc`:

```bash
npx wrangler secret put SOWHAT_UPLOAD_KEY --config wrangler.visual-upload.jsonc
npx wrangler secret put GUARDIAN_EVIDENCE_KEY --config wrangler.visual-upload.jsonc
```

The historical `/visuals/api/upload` route remains for videos and explicitly
labels its output `LEGACY_UNVERIFIED`. It never asserts image watermark or C2PA
protection.
