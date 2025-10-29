// frontend/tests/e2e.spec.js
// Playwright E2E — register -> login -> create folder -> upload file
const { test, expect } = require('@playwright/test');
const qs = require('querystring');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const API_BASE = process.env.API_BASE || 'http://127.0.0.1:8000';

function parseSetCookie(setCookieHeader) {
  // setCookieHeader may be string or array
  const arr = Array.isArray(setCookieHeader) ? setCookieHeader : (setCookieHeader ? [setCookieHeader] : []);
  const cookies = {};
  for (const item of arr) {
    // each item like: "csrftoken=abc; Path=/; ..."
    const m = item.match(/^\s*([^=]+)=([^;]+)/);
    if (m) cookies[m[1]] = m[2];
  }
  return cookies;
}

test('register -> login -> create folder -> upload file', async ({ page, request }) => {
  const username = `pw_user_${Date.now() % 100000}`;
  const password = 'PwTest123!';
  const email = `${username}@example.com`;

  // 1) Try to register via API (if your backend enforces username rules this may return 400 — it's ok)
  const regResp = await request.post(`${API_BASE}/api/users/register/`, {
    data: { username, password, email }
  });
  // accept success or already-handled validation (we continue anyway)
  // if regResp.ok() === false we still attempt to login — tests should handle both cases
  // log status for debugging
  // console.log('register', regResp.status(), await regResp.text());

  // 2) Login via API to obtain session cookie and csrftoken (we'll reuse these for subsequent API calls)
  const loginResp = await request.post(`${API_BASE}/api/users/login/`, {
    data: { username, password }
  });

  if (!loginResp.ok()) {
    // maybe the registration created different constraints; try fallback: create a known test user via a tolerant endpoint
    // but here we fail test with useful info
    const body = await loginResp.text();
    throw new Error(`Login failed (status ${loginResp.status()}) — body: ${body}`);
  }

  // Parse cookies from Set-Cookie header(s)
  const setCookie = loginResp.headers()['set-cookie'] || loginResp.headers()['Set-Cookie'] || null;
  const cookiesMap = parseSetCookie(setCookie);
  const cookieHeader = Object.entries(cookiesMap).map(([k, v]) => `${k}=${v}`).join('; ');

  // Get CSRF token — either from cookiesMap['csrftoken'] or from GET /csrf/
  let csrftoken = cookiesMap['csrftoken'] || null;
  if (!csrftoken) {
    const csrfResp = await request.get(`${API_BASE}/api/users/csrf/`, { headers: { Cookie: cookieHeader } });
    // If endpoint returns JSON with token, use it, otherwise check headers
    try {
      const j = await csrfResp.json().catch(() => null);
      if (j && j.csrfToken) csrftoken = j.csrfToken;
    } catch (e) { /* ignore */ }
    if (!csrftoken) {
      const setCookie2 = csrfResp.headers()['set-cookie'] || null;
      const cookies2 = parseSetCookie(setCookie2);
      csrftoken = csrftoken || cookies2['csrftoken'] || null;
    }
  }

  // Safety: if still no cookie, throw with diagnostics
  if (!cookieHeader) {
    throw new Error('No session cookie returned after login. Check backend login endpoint and session settings. Headers: ' + JSON.stringify(loginResp.headers()));
  }

  // 3) Now create folder using authenticated request (attach Cookie and X-CSRFToken)
  const folderPayload = { name: 'pw-folder', parent: null };
  const createFolderResp = await request.post(`${API_BASE}/api/storage/folders/create/`, {
    headers: {
      Cookie: cookieHeader,
      ...(csrftoken ? { 'X-CSRFToken': csrftoken } : {}),
      'Content-Type': 'application/json'
    },
    data: JSON.stringify(folderPayload)
  });

  if (!createFolderResp.ok()) {
    // fetch response body for debugging
    const text = await createFolderResp.text();
    throw new Error(`Create folder failed (status ${createFolderResp.status()}): ${text}`);
  }

  const folderJson = await createFolderResp.json();
  expect(folderJson).toHaveProperty('id');

  // 4) Upload a tiny file using authenticated multipart request
  // Playwright multipart: pass 'multipart' option as object
  const fileBuffer = Buffer.from('hello playwright');
  const multipartForm = [
    { name: 'file', mimeType: 'text/plain', buffer: fileBuffer, fileName: 'pw.txt' },
    { name: 'comment', value: 'pw' },
    { name: 'folder', value: String(folderJson.id) }
  ];
  const uploadResp = await request.post(`${API_BASE}/api/storage/files/upload/`, {
    headers: {
      Cookie: cookieHeader,
      ...(csrftoken ? { 'X-CSRFToken': csrftoken } : {})
    },
    multipart: multipartForm
  });

  if (!uploadResp.ok()) {
    const text = await uploadResp.text();
    throw new Error(`Upload failed (status ${uploadResp.status()}): ${text}`);
  }
  const uploaded = await uploadResp.json();
  expect(uploaded).toHaveProperty('id');

  // 5) Final verification: list files in folder
  const listResp = await request.get(`${API_BASE}/api/storage/files/?folder_id=${folderJson.id}`, {
    headers: { Cookie: cookieHeader }
  });
  expect(listResp.ok()).toBeTruthy();
  const listJson = await listResp.json();
  expect(Array.isArray(listJson)).toBeTruthy();
  expect(listJson.some(x => x.id === uploaded.id || x.id === uploaded.id)).toBeTruthy();

  // Optionally open UI and check presence (best-effort, not required)
  await page.goto(BASE);
  // if your UI shows authenticated state, you could check UI elements here
});
