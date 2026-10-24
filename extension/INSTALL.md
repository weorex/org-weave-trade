# Weorex Trade Capture

## Build from source
From the project root, run `bun install` then `bun run extension/build.ts`.
TypeScript is checked before a standalone Vite build. Output is `extension/dist`; the inspected installable archive is `public/weorex-capture.zip`.

## Install
1. Unzip the downloaded extension (or use `extension/dist` after building).
2. Open `chrome://extensions` in Chrome.
3. Enable Developer mode.
4. Choose Load unpacked and select the folder containing `manifest.json`.
5. Open Weorex Trade Capture and press Connect. Sign in to Weorex in another tab if needed, then approve the connection.
6. Open a company web page and press Capture page. Choose an organization/type, edit fields, map table columns, select product rows and named contacts, then Save capture.

## Privacy and permissions
- `activeTab` + `scripting`: read only the accessible main-frame DOM of the active tab after Capture page is pressed. No background worker, content scripts, history permission, automatic navigation capture or cross-origin iframe access.
- `storage`: session-only token storage in trusted extension contexts; drafts remain only in popup memory. Closing the popup clears the captured draft. Disconnect clears tokens; browser restart/expiry requires reconnecting. No refresh token is transferred.
- `identity`: user-approved connection with a random state and Chrome's extension-specific HTTPS redirect.
- Single host permission: `https://org-weave-trade.lovable.app/*`, for authenticated Weorex API calls only. No privileged/publishable database keys in the extension.
- URL queries, fragments and embedded credentials are removed. Hidden DOM, scripts, password fields, whole HTML and browsing history are not collected. Captured accessible contacts may be personal data; save only when authorized.
- Tables are bounded to 20, 200 rows each, 30 columns; selected products to 200 and contacts to 50. Shadow DOM, image text, blocked pages, and non-HTML catalogues are not read.

## Saving behavior
Dynamic field definitions and permissions come from the selected organization. Server validation plus PostgreSQL RLS/triggers enforce permissions. Generic company-only captures follow type create/read permissions; products/contacts require owner/admin and entity update access.

Possible company duplicates use the first required text/email/URL identity field (otherwise the first such field), ignoring case and surrounding spaces. Existing values are never overwritten. A match reuses the existing entity and adds selected product links/contacts. SKUs match case-insensitively; existing products are retained, missing supplier links added. Contact duplicates match name, email and phone. Preview is advisory; atomic backend duplicate checking is authoritative.

Retrying the same submission is idempotent. Editing any value starts a new request key. Successful saves create a data capture and protected audit event; only reviewed structured values and sanitized source URL are stored, not raw HTML.

## Deployment
Publish the Weorex web app before using Connect against the fixed production URL. This ZIP is an unpacked developer extension, not a Chrome Web Store listing. Endpoint/manifest changes require rebuilding and reloading the extension. Do not put secrets or tokens in source/configuration.