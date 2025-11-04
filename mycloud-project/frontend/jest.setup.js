// frontend/jest.setup.js
import '@testing-library/jest-dom';

// polyfill TextEncoder/TextDecoder for jest/jsdom environment
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Optional: prevent accidental navigation calls (defensive)
if (typeof window !== 'undefined' && !window.location) {
  window.location = { href: '/', assign: () => {}, replace: () => {} };
}

// Provide a minimal fetch polyfill if some tests rely on global.fetch (optional)
// if (typeof global.fetch === 'undefined') {
//   global.fetch = require('node-fetch');
// }
