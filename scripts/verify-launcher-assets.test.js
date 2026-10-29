import test from 'node:test';
import assert from 'node:assert/strict';
import { assertOrbitBundle } from './verify-launcher-assets.mjs';

const indexHtml = '<html><head><title>Orbit Launcher</title></head><body><script src="/assets/app.js"></script></body></html>';

test('accepts a production bundle containing the new launcher UI', () => {
  assert.equal(assertOrbitBundle(indexHtml, 'SMART AUTO-TIDY Clean & Auto-Tidy'), '/assets/app.js');
});

test('rejects a bundle that still contains the old simulator', () => {
  assert.throws(
    () => assertOrbitBundle(indexHtml, 'SMART AUTO-TIDY Clean & Auto-Tidy Canvas Studio'),
    /old simulator interface/,
  );
});

test('rejects an old app title or missing Auto-Tidy section', () => {
  assert.throws(() => assertOrbitBundle(indexHtml.replace('Orbit Launcher', 'App Organizer'), 'SMART AUTO-TIDY Clean &'));
  assert.throws(() => assertOrbitBundle(indexHtml, 'Canvas Studio'));
});
