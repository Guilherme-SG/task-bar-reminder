const {
  parseHexColor,
  getLuminance,
  lightenColor,
  darkenColor,
  deriveButtonColors,
} = require('../../src/utils/colorUtils');

describe('colorUtils', () => {
  describe('parseHexColor', () => {
    it('parses black', () => {
      expect(parseHexColor('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('parses white', () => {
      expect(parseHexColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('parses red', () => {
      expect(parseHexColor('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('parses mixed color', () => {
      expect(parseHexColor('#1a1a2e')).toEqual({ r: 26, g: 26, b: 46 });
    });
  });

  describe('getLuminance', () => {
    it('returns 0 for black', () => {
      expect(getLuminance('#000000')).toBe(0);
    });

    it('returns ~1 for white', () => {
      expect(getLuminance('#ffffff')).toBeCloseTo(1.0);
    });

    it('returns value between 0 and 1 for other colors', () => {
      const lum = getLuminance('#1a1a2e');
      expect(lum).toBeGreaterThan(0);
      expect(lum).toBeLessThan(1);
    });
  });

  describe('lightenColor', () => {
    it('lightens black by amount', () => {
      expect(lightenColor('#000000', 40)).toBe('#282828');
    });

    it('clamps to 255', () => {
      expect(lightenColor('#ffffff', 40)).toBe('#ffffff');
    });

    it('lightens partial color', () => {
      const result = lightenColor('#1a1a2e', 40);
      expect(result).toBe('#424256');
    });
  });

  describe('darkenColor', () => {
    it('darkens white by amount', () => {
      expect(darkenColor('#ffffff', 30)).toBe('#e1e1e1');
    });

    it('clamps to 0', () => {
      expect(darkenColor('#000000', 30)).toBe('#000000');
    });

    it('darkens partial color', () => {
      const result = darkenColor('#ff0000', 30);
      expect(result).toBe('#e10000');
    });
  });

  describe('deriveButtonColors', () => {
    it('derives colors for dark card', () => {
      const result = deriveButtonColors('#1a1a2e');
      expect(result.buttonBg).toBe('#424256');
      expect(result.snoozeBg).toBe('#000010');
      expect(result.textColor).toBe('#ffffff');
    });

    it('derives colors for light card', () => {
      const result = deriveButtonColors('#ffffff');
      expect(result.buttonBg).toBe('#ffffff');
      expect(result.snoozeBg).toBe('#e1e1e1');
      expect(result.textColor).toBe('#1a1a2e');
    });

    it('derives colors for red card', () => {
      const result = deriveButtonColors('#ff0000');
      expect(result.buttonBg).toBe('#ff2828');
      expect(result.snoozeBg).toBe('#e10000');
      expect(result.textColor).toBe('#ffffff');
    });
  });
});
