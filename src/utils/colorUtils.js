const LUMINANCE_R_WEIGHT = 0.299;
const LUMINANCE_G_WEIGHT = 0.587;
const LUMINANCE_B_WEIGHT = 0.114;
const LUMINANCE_THRESHOLD = 0.5;

function parseHexColor(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function toHex(r, g, b) {
  const toStr = (v) => Math.round(v).toString(16).padStart(2, '0');
  return `#${toStr(r)}${toStr(g)}${toStr(b)}`;
}

function getLuminance(hex) {
  const { r, g, b } = parseHexColor(hex);
  return (
    LUMINANCE_R_WEIGHT * (r / 255) +
    LUMINANCE_G_WEIGHT * (g / 255) +
    LUMINANCE_B_WEIGHT * (b / 255)
  );
}

function lightenColor(hex, amount) {
  const { r, g, b } = parseHexColor(hex);
  return toHex(
    Math.min(255, r + amount),
    Math.min(255, g + amount),
    Math.min(255, b + amount)
  );
}

function darkenColor(hex, amount) {
  const { r, g, b } = parseHexColor(hex);
  return toHex(
    Math.max(0, r - amount),
    Math.max(0, g - amount),
    Math.max(0, b - amount)
  );
}

function deriveButtonColors(color) {
  return {
    buttonBg: lightenColor(color, 40),
    snoozeBg: darkenColor(color, 30),
    textColor: getLuminance(color) < LUMINANCE_THRESHOLD ? '#ffffff' : '#1a1a2e',
  };
}

module.exports = {
  parseHexColor,
  getLuminance,
  lightenColor,
  darkenColor,
  deriveButtonColors,
};
