// Loads data.js + battle.js (+ optional save.js) from a game folder into a fresh, isolated global.
const fs = require('fs'), path = require('path'), vm = require('vm');
module.exports = function load(dir, files = ['js/data.js', 'js/battle.js']) {
  const sandbox = { console, Math, JSON, Intl, TextEncoder, Uint8Array, crypto: globalThis.crypto };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), sandbox, { filename: f });
  return sandbox.ELDORIA;
};
module.exports.mulberry32 = function (seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
