'use strict';
// Parse the explicitly requested Node TAP reporter output.
// A failed/spawned/invalid test process must never count as a caught mutation.
function parseSummary(output, exitCode, spawnError) {
  const passMatch = /^# pass (\d+)\s*$/m.exec(output);
  const failMatch = /^# fail (\d+)\s*$/m.exec(output);
  const testMatch = /^# tests (\d+)\s*$/m.exec(output);
  const pass = passMatch ? Number(passMatch[1]) : -1;
  const fail = failMatch ? Number(failMatch[1]) : -1;
  const tests = testMatch ? Number(testMatch[1]) : -1;
  let reason = null;
  if (spawnError) reason = 'SPAWN_ERROR: ' + spawnError.message;
  else if (!Number.isInteger(exitCode)) reason = 'NO_EXIT_STATUS';
  else if (pass < 0 || fail < 0 || tests < 0) reason = 'MISSING_TAP_SUMMARY';
  else if (tests <= 0 || pass + fail > tests) reason = 'INVALID_TAP_COUNTS';
  else if ((fail === 0 && exitCode !== 0) || (fail > 0 && exitCode === 0)) reason = 'EXIT_SUMMARY_MISMATCH';
  return { pass, fail, tests, exitCode, valid: reason === null, reason };
}
module.exports = { parseSummary };
