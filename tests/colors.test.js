import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER_COLORS, nextColor } from '../js/colors.js';

test('PLAYER_COLORS has at least 8 distinct colors', () => {
  assert.ok(PLAYER_COLORS.length >= 8);
  assert.equal(new Set(PLAYER_COLORS).size, PLAYER_COLORS.length);
});

test('nextColor cycles through the palette round-robin', () => {
  assert.equal(nextColor(0), PLAYER_COLORS[0]);
  assert.equal(nextColor(1), PLAYER_COLORS[1]);
  assert.equal(nextColor(PLAYER_COLORS.length), PLAYER_COLORS[0]);
});
