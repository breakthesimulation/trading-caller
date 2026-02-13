// trust-proxy.cjs — Preloaded via NODE_OPTIONS to fix Express rate-limiter
// behind Railway's reverse proxy. Sets 'trust proxy' to 1 (numeric) which
// passes both express-rate-limit validations:
//   - 1 === true  → false (avoids ERR_ERL_PERMISSIVE_TRUST_PROXY)
//   - 1 === false → false (avoids ERR_ERL_UNEXPECTED_X_FORWARDED_FOR)
//
// Patches express.application.init so every new app gets trust proxy = 1
// before any middleware (including rate limiters) runs.
try {
  const express = require('express');
  const origInit = express.application.init;
  express.application.init = function () {
    origInit.call(this);
    this.set('trust proxy', 1);
  };
} catch (_) {
  // express not resolvable yet — ignore
}
