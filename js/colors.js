export const PLAYER_COLORS = [
  '#e63946', '#f4a261', '#e9c46a', '#2a9d8f',
  '#264653', '#a8dadc', '#6d597a', '#b56576',
  '#457b9d', '#43aa8b'
];

export function nextColor(existingCount) {
  return PLAYER_COLORS[existingCount % PLAYER_COLORS.length];
}
