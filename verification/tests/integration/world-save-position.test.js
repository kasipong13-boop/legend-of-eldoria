'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function loadWorld() {
  const listeners = {};
  const buttons = [];
  const pad = { querySelectorAll: () => buttons };
  const document = { getElementById: id => id === 'dpad' ? pad : null };
  const window = {
    ELDORIA: {},
    addEventListener: (name, fn) => { (listeners[name] ||= []).push(fn); },
    devicePixelRatio: 1
  };
  const context = {
    ELDORIA: window.ELDORIA, window, document, console,
    setTimeout, clearTimeout,
    requestAnimationFrame: () => 0,
    performance: { now: () => 0 },
    Math, Number, Object, Array
  };
  vm.createContext(context);
  const projectRoot = path.resolve(__dirname, '../../..');
  const gameRoot = fs.existsSync(path.join(projectRoot, 'game/js/world.js')) ? path.join(projectRoot, 'game') : projectRoot;
  // Load the map/spawn dependencies before the world runtime, matching index.html.
  ['map-data.js', 'monster-spawn.js', 'world.js'].forEach(file => {
    const source = fs.readFileSync(path.join(gameRoot, 'js', file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  });
  return context.ELDORIA.World;
}

test('World Save/Load API exposes the original Greenvale start tile', () => {
  const world = loadWorld();
  assert.deepEqual(JSON.parse(JSON.stringify(world.startPosition())), { c: 5, r: 5 });
  assert.deepEqual(JSON.parse(JSON.stringify(world.getPosition())), { c: 5, r: 5 });
});

test('World.setPosition restores a valid walkable tile', () => {
  const world = loadWorld();
  assert.equal(world.setPosition({ c: 4, r: 4 }), true);
  assert.deepEqual(JSON.parse(JSON.stringify(world.getPosition())), { c: 4, r: 4 });
});

test('World.setPosition rejects blocked, out-of-bounds, and malformed coordinates without moving', () => {
  const world = loadWorld();
  const invalid = [
    { c: 0, r: 0 },       // map boundary / tree
    { c: 2, r: 2 },       // house
    { c: 8, r: 3 },       // water
    { c: -1, r: 5 },
    { c: 12, r: 5 },
    { c: 5.5, r: 5 },
    null,
    {}
  ];
  for (const position of invalid) assert.equal(world.setPosition(position), false);
  assert.deepEqual(JSON.parse(JSON.stringify(world.getPosition())), { c: 5, r: 5 });
});
