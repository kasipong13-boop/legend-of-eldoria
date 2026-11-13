'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseSummary } = require('./mutation-summary');
const tap = (pass, fail, tests=pass+fail) => 'TAP version 13\n1..'+tests+'\n# tests '+tests+'\n# pass '+pass+'\n# fail '+fail+'\n';
test('unmodified control TAP is accepted with zero exit', () => {
  assert.deepEqual(parseSummary(tap(293,0),0), {pass:293,fail:0,tests:293,exitCode:0,valid:true,reason:null});
});
test('mutant failure TAP is accepted only with nonzero exit', () => {
  const r=parseSummary(tap(290,3),1);
  assert.equal(r.valid,true); assert.equal(r.fail,3);
});
test('missing TAP summary fails closed', () => {
  assert.equal(parseSummary('ℹ pass 293\nℹ fail 0',0).reason,'MISSING_TAP_SUMMARY');
});
test('nonzero exit with zero failures fails closed', () => {
  assert.equal(parseSummary(tap(293,0),1).reason,'EXIT_SUMMARY_MISMATCH');
});
test('zero exit with failures fails closed', () => {
  assert.equal(parseSummary(tap(292,1),0).reason,'EXIT_SUMMARY_MISMATCH');
});
test('spawn error fails closed', () => {
  assert.match(parseSummary(tap(293,0),null,new Error('ENOENT')).reason,/SPAWN_ERROR/);
});
test('invalid counts fail closed', () => {
  assert.equal(parseSummary(tap(4,3,5),1).reason,'INVALID_TAP_COUNTS');
});
test('missing exit status fails closed', () => {
  assert.equal(parseSummary(tap(293,0),null).reason,'NO_EXIT_STATUS');
});
