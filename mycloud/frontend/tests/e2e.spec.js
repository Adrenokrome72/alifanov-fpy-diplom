// frontend/tests/e2e.spec.js
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const API_BASE = process.env.API_BASE || 'http://127.0.0.1:8000';

function parseSetCookie(setCookieHeader) {
  const arr = Array.isArray(setCookieHeader) ? setCookieHeader : (setCookieHeader ? [setCookieHeader] : []);
  const cookies = {};
  for (const item of arr) {
    const m = item.match(/^\s*([^=;]+)=([^;]+)/);
    if (m) cookies[m[1]] = m[2];
  }
  return cookies;
}

test('register -> login -> create folder -> upload file', async ({ page, request }) => {
  const username = `pw_user_${Date.now() % 100000}`;
  const password = 'PwTest123!';
  const email = `${username}@example.com`;

  // 0) GET CSRF
  const csrfResp = await request.get(`${API_BASE}/api/users/csrf/`);
  if (!csrfResp.ok()) {
    throw new Error(`CSRF endpoint failed: ${csrfResp.status()} ${await csrfResp.text()}`);
  }
  const csrfCookies = parseSetCookie(csrfResp.headers()['set-cookie']);
  let csrftoken = csrfCookies['csrftoken'] || null;
  let cookieHeader = Object.entries(csrfCookies).map(([k, v]) => `${k}=${v}`).join('; ');

  // 1) Register
  const regResp = await request.post(`${API_BASE}/api/users/register/`, {
    headers: {
      Cookie: cookieHeader || '',
      ...(csrftoken ? { 'X-CSRFToken': csrftoken } : {}),
      'Content-Type': 'application/json'
    },
    data: JSON.stringify({ username, password, email })
  });
  if (![200, 201, 400].includes(regResp.status())) {
    throw new Error(`Register failed ${regResp.status()}: ${await regResp.text()}`);
  }
  // continue regardless (user may already exist or validation may return 400)

  // 2) Login
  const loginResp = await request.post(`${API_BASE}/api/users/login/`, {
    headers: {
      Cookie: cookieHeader || '',
      ...(csrftoken ? { 'X-CSRFToken': csrftoken } : {}),
      'Content-Type': 'application/json'
    },
    data: JSON.stringify({ username, password })
  });
  if (!loginResp.ok()) {
    throw new Error(`Login failed (status ${loginResp.status()}): ${await loginResp.text()}`);
  }

  // 3) Merge cookies from login
  const loginCookies = parseSetCookie(loginResp.headers()['set-cookie']);
  const merged = { ...(csrfCookies || {}), ...(loginCookies || {}) };
  cookieHeader = Object.entries(merged).map(([k, v]) => `${k}=${v}`).join('; ');
  csrftoken = merged['csrftoken'] || csrftoken || null;
  if (!cookieHeader) throw new Error('No cookies available after login');

  // 4) Create folder
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
    const body = await createFolderResp.text();
    throw new Error(`Create folder failed (status ${createFolderResp.status()}): ${body}`);
  }
  const folderJson = await createFolderResp.json();
  expect(folderJson).toHaveProperty('id');

  // 5) Upload — create tmp file, read as Buffer and pass buffer -> PLAYWRIGHT ACCEPTS THIS
   const cookieArray = Object.entries(merged).map(([name, value]) => ({
    name,
    value,
    domain: new URL(API_BASE).hostname, // e.g. '127.0.0.1'
    path: '/',
    httpOnly: name.toLowerCase() === 'sessionid', // heuristic
    sameSite: 'Lax'
  }));
  // Add cookies into browser context so page.fetch will include them
  await page.context().addCookies(cookieArray);

  // Navigate the page to the API origin so fetch is same-origin and cookies are sent automatically.
  // We don't care about the response body of the page navigation (it can be 404) — we only need origin.
  await page.goto(API_BASE, { waitUntil: 'domcontentloaded' });

  // Build and submit FormData in page context using Blob (browser side).
  // Use folderJson.id created earlier.
  const uploaded = await page.evaluate(async ({ folderId }) => {
    // read csrftoken from document.cookie
    function readCookie(name) {
      const m = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]+)'));
      return m ? decodeURIComponent(m[2]) : null;
    }
    const csrftoken = readCookie('csrftoken') || '';

    const fd = new FormData();
    // small text file via Blob; if you need binary, you can construct Blob from Uint8Array
    fd.append('file', new Blob(['hello playwright'], { type: 'text/plain' }), 'pw.txt');
    fd.append('comment', 'pw');
    fd.append('folder', String(folderId));

    const resp = await fetch('/api/storage/files/upload/', {
      method: 'POST',
      credentials: 'include', // important — sends cookies
      headers: {
        'X-CSRFToken': csrftoken
      },
      body: fd
    });

    const text = await resp.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { json = { ok: false, text }; }
    return { status: resp.status, ok: resp.ok, body: json };
  }, { folderId: folderJson.id });

  if (!uploaded.ok) {
    throw new Error(`Upload via page failed (status ${uploaded.status}): ${JSON.stringify(uploaded.body)}`);
  }

  // uploaded.body should be the created object
  expect(uploaded.body).toHaveProperty('id');
  const uploadedId = uploaded.body.id;

  // 6) Verify list -- use request.get as before (still okay)
  const listResp = await request.get(`${API_BASE}/api/storage/files/?folder_id=${folderJson.id}`, {
    headers: { Cookie: cookieHeader }
  });
  expect(listResp.ok()).toBeTruthy();
  const listJson = await listResp.json();
  expect(Array.isArray(listJson)).toBeTruthy();
  expect(listJson.some(x => x.id === uploadedId)).toBeTruthy();

  // Optional: open UI
  await page.goto(BASE);
});
