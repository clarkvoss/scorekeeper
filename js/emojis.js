export const PLAYER_EMOJIS = [
  '😀', '😎', '🤓', '😺', '🐶',
  '🦁', '🐸', '🍕', '⭐', '🎲'
];

export function nextEmoji(existingCount) {
  return PLAYER_EMOJIS[existingCount % PLAYER_EMOJIS.length];
}
