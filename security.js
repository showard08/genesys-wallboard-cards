/* Shared security logic: phone-number normalisation and validation.
   Loaded in TWO contexts so the same rules apply everywhere:
     - the dispatch content script (dial-dispatch.js) — first check, before
       the confirm dialog is even shown;
     - the service worker (background.js) — independent RE-check at the
       privileged chokepoint, so a bug or bypass in page-side code can never
       push a non-policy number through to Genesys.
   Also exported for Node so the rules are unit-testable (test/security.test.js).

   Assigned on globalThis (not `const`) so the file can be safely injected
   into a page more than once, same pattern as defaults.js. */

(() => {
  if (globalThis.AGENT_CARDS_SECURITY) return;

  const ALLOWED_PREFIXES = ['+44'];   // add e.g. '+353' if you dial ROI
  const BLOCKED_PREFIXES = [          // premium / revenue-share UK ranges
    '+449',                           // 09xx premium rate
    '+44844', '+44845',               // 084x service numbers
    '+44870', '+44871', '+44872', '+44873', // 087x revenue share
  ];
  const MIN_DIGITS = 10;              // total digits after the leading +
  const MAX_DIGITS = 15;              // E.164 ceiling

  function normaliseNumber(raw) {
    let n = (raw || '').replace(/[^\d+]/g, '');
    if (n.startsWith('00')) n = '+' + n.slice(2);        // 0044… → +44…
    else if (n.startsWith('0')) n = '+44' + n.slice(1);  // UK national 0… → +44…
    else if (n && !n.startsWith('+')) n = '+' + n;
    return n;
  }

  function validNumber(n) {
    if (typeof n !== 'string' || !/^\+\d+$/.test(n)) return false;
    const digits = n.replace(/\D/g, '');
    if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return false;
    if (BLOCKED_PREFIXES.some((p) => n.startsWith(p))) return false;
    return ALLOWED_PREFIXES.some((p) => n.startsWith(p));
  }

  globalThis.AGENT_CARDS_SECURITY = {
    normaliseNumber,
    validNumber,
    ALLOWED_PREFIXES,
    BLOCKED_PREFIXES,
    MIN_DIGITS,
    MAX_DIGITS,
  };

  // Node (unit tests) — no effect in the browser or service worker
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = globalThis.AGENT_CARDS_SECURITY;
  }
})();
