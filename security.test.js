/* Unit tests for the shared security rules in security.js.
   Zero dependencies — uses Node's built-in test runner (Node 18+):

       node --test test/

   Place this file at test/security.test.js (security.js stays in the repo
   root). Run in CI before packaging — see ci job in publish.yml. */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normaliseNumber, validNumber } = require('../security.js');

// ── Normalisation ─────────────────────────────────────────────────────────

test('UK national format becomes +44', () => {
  assert.equal(normaliseNumber('07700900123'), '+447700900123');
});

test('international 00 prefix becomes +', () => {
  assert.equal(normaliseNumber('00447700900123'), '+447700900123');
});

test('already-canonical number is unchanged', () => {
  assert.equal(normaliseNumber('+447700900123'), '+447700900123');
});

test('spaces, dashes and brackets are stripped', () => {
  for (const raw of ['07700 900123', '07700-900-123', '(07700) 900123', '+44 7700 900 123']) {
    assert.equal(normaliseNumber(raw), '+447700900123', `raw: ${raw}`);
  }
});

test('all common formats of the same number normalise identically', () => {
  const forms = ['07700900123', '0044 7700 900123', '+44 7700 900123', '07700 900123'];
  const canon = new Set(forms.map(normaliseNumber));
  assert.equal(canon.size, 1);
});

test('empty and junk input do not throw', () => {
  assert.equal(normaliseNumber(''), '');
  assert.equal(normaliseNumber(null), '');
  assert.equal(normaliseNumber(undefined), '');
  assert.equal(normaliseNumber('call me maybe'), ''); // no digits → empty, never throws
});

// ── Validation: accepted ──────────────────────────────────────────────────

test('valid UK mobile is accepted', () => {
  assert.equal(validNumber('+447700900123'), true);
});

test('valid UK geographic is accepted', () => {
  assert.equal(validNumber('+441482123456'), true);
});

// ── Validation: rejected ──────────────────────────────────────────────────

test('premium rate 09xx is blocked', () => {
  assert.equal(validNumber('+449123456789'), false);
});

test('084x service numbers are blocked', () => {
  assert.equal(validNumber('+448441234567'), false);
  assert.equal(validNumber('+448451234567'), false);
});

test('087x revenue-share numbers are blocked', () => {
  for (const p of ['+448701234567', '+448711234567', '+448721234567', '+448731234567']) {
    assert.equal(validNumber(p), false, p);
  }
});

test('non-UK prefixes are rejected by the allow-list', () => {
  assert.equal(validNumber('+35312345678'), false);  // ROI (add to allow-list if needed)
  assert.equal(validNumber('+12025550123'), false);  // US
});

test('too short and too long are rejected', () => {
  assert.equal(validNumber('+44770'), false);                 // < MIN_DIGITS
  assert.equal(validNumber('+4477009001234567890'), false);   // > E.164 ceiling
});

test('non-canonical strings are rejected outright', () => {
  for (const bad of ['', '07700900123', '447700900123', '+44 7700900123', '+44-7700900123', null, undefined, 447700900123]) {
    assert.equal(validNumber(bad), false, String(bad));
  }
});

test('injection-shaped input is rejected', () => {
  for (const bad of ['+44<script>', '+44;drop', '+44%0a900123', '++447700900123']) {
    assert.equal(validNumber(bad), false, bad);
  }
});

// ── End-to-end: normalise then validate (the real pipeline) ───────────────

test('raw dispatch-page text flows to a valid canonical number', () => {
  const n = normaliseNumber(' 07700 900123 ');
  assert.equal(n, '+447700900123');
  assert.equal(validNumber(n), true);
});

test('raw premium-rate text is caught after normalisation', () => {
  const n = normaliseNumber('0912 345 6789');
  assert.equal(validNumber(n), false);
});
