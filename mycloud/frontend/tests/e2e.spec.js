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

test('register -> login -> create folder -> upload file -> download -> share', async ({ page, request }) => {
  const username = `pwuser${Date.now() % 100000}`;
  const password = 'NewPass1!';
  const email = `${username}@example.com`;

  // Get CSRF token
  const csrfResp = await request.get(`${API_BASE}/api/users/csrf/`);
  console.log('CSRF response:', await csrfResp.text(), csrfResp.status());
  expect(csrfResp.ok()).toBeTruthy();
  const csrfCookies = parseSetCookie(csrfResp.headers()['set-cookie']);
  let csrftoken = csrfCookies['csrftoken'];
  let cookieHeader = Object.entries(csrfCookies).map(([k, v]) => `${k}=${v}`).join('; ');
  console.log('CSRF cookies:', csrfCookies);

  // Register
  const regOptions = {
    headers: { 'Cookie': cookieHeader, 'X-CSRFToken': csrftoken, 'Content-Type': 'application/json' },
    data: JSON.stringify({ username, password, email }),
  };
  const regResp = await request.post(`${API_BASE}/api/users/register/`, regOptions);
  console.log('Register response:', await regResp.text(), regResp.status());
  expect(regResp.status()).toBe(201);

  // Login
  const loginResp = await request.post(`${API_BASE}/api/users/login/`, {
    headers: { 'Cookie': cookieHeader, 'X-CSRFToken': csrftoken, 'Content-Type': 'application/json' },
    data: JSON.stringify({ username, password }),
  });
  console.log('Login response:', await loginResp.text(), loginResp.status());
  expect(loginResp.ok()).toBeTruthy();

  const loginCookies = parseSetCookie(loginResp.headers()['set-cookie']);
  const merged = { ...csrfCookies, ...loginCookies };
  cookieHeader = Object.entries(merged).map(([k, v]) => `${k}=${v}`).join('; ');
  csrftoken = merged['csrftoken'] || csrfCookies['csrftoken'];
  console.log('Login cookies:', merged);

  // Refresh CSRF before creating folder
  const csrfRefresh = await request.get(`${API_BASE}/api/users/csrf/`, {
    headers: { 'Cookie': cookieHeader },
  });
  console.log('CSRF refresh response:', await csrfRefresh.text(), csrfRefresh.status());
  expect(csrfRefresh.ok()).toBeTruthy();
  const newCsrfCookies = parseSetCookie(csrfRefresh.headers()['set-cookie']);
  csrftoken = newCsrfCookies['csrftoken'] || csrftoken;
  cookieHeader = Object.entries({ ...merged, ...newCsrfCookies }).map(([k, v]) => `${k}=${v}`).join('; ');
  console.log('Merged cookies after refresh:', cookieHeader);

  // Create folder
  const createFolderResp = await request.post(`${API_BASE}/api/storage/folders/create/`, {
    headers: { 'Cookie': cookieHeader, 'X-CSRFToken': csrftoken, 'Content-Type': 'application/json' },
    data: JSON.stringify({ name: 'pw-folder' }),
  });
  console.log('Create folder response:', await createFolderResp.text(), createFolderResp.status());
  expect(createFolderResp.ok()).toBeTruthy();
  const folderJson = await createFolderResp.json();

  // Upload file
  const tmpPath = path.join(os.tmpdir(), `pw-${Date.now()}.txt`);
  fs.writeFileSync(tmpPath, 'hello playwright');
  const uploadResp = await request.post(`${API_BASE}/api/storage/files/upload/`, {
    headers: { 'Cookie': cookieHeader, 'X-CSRFToken': csrftoken },
    multipart: {
      file: {
        name: 'file',
        mimeType: 'text/plain',
        buffer: fs.readFileSync(tmpPath),
      },
      comment: 'pw',
      folder: String(folderJson.id),
    },
  });
  fs.unlinkSync(tmpPath);
  console.log('Upload response:', await uploadResp.text(), uploadResp.status());
  expect(uploadResp.ok()).toBeTruthy();
  const uploaded = await uploadResp.json();

  // List files
  const listResp = await request.get(`${API_BASE}/api/storage/files/?folder_id=${folderJson.id}`, { headers: { Cookie: cookieHeader } });
  console.log('List files response:', await listResp.text(), listResp.status());
  expect(listResp.ok()).toBeTruthy();
  const listJson = await listResp.json();
  expect(Array.isArray(listJson)).toBeTruthy();
  expect(listJson.some(x => x.id === uploaded.id)).toBeTruthy();

  // Download file
  const downloadResp = await request.get(`${API_BASE}/api/storage/files/${uploaded.id}/download/`, { headers: { Cookie: cookieHeader } });
  console.log('Download response:', await downloadResp.text(), downloadResp.status());
  expect(downloadResp.ok()).toBeTruthy();

  // Share link
  const shareLink = uploaded.share_link;
  const shareDownloadResp = await request.get(`${API_BASE}/api/storage/share/${shareLink}/`);
  console.log('Share response:', await shareDownloadResp.text(), shareDownloadResp.status());
  expect(shareDownloadResp.ok()).toBeTruthy();
});