import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER_EMOJIS, nextEmoji } from '../js/emojis.js';

test('PLAYER_EMOJIS has at least 8 distinct emoji', () => {
  assert.ok(PLAYER_EMOJIS.length >= 8);
  assert.equal(new Set(PLAYER_EMOJIS).size, PLAYER_EMOJIS.length);
});

test('nextEmoji cycles through the palette round-robin', () => {
  assert.equal(nextEmoji(0), PLAYER_EMOJIS[0]);
  assert.equal(nextEmoji(1), PLAYER_EMOJIS[1]);
  assert.equal(nextEmoji(PLAYER_EMOJIS.length), PLAYER_EMOJIS[0]);
});
