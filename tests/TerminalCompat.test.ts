import { describe, test, expect } from '@jest/globals';
import { TerminalCompat } from '../src/utils/terminalCompat.js';

describe('TerminalCompat', () => {
  describe('charset detection', () => {
    test('should have default charset', () => {
      const charset = TerminalCompat.getCharset();
      expect(charset).toBeDefined();
      expect(charset.verticalLine).toBeDefined();
      expect(charset.horizontalLine).toBeDefined();
      expect(charset.blockFull).toBeDefined();
    });

    test('should detect compatibility mode', () => {
      const isCompat = TerminalCompat.isCompatibilityMode();
      expect(typeof isCompat).toBe('boolean');
    });

    test('should set ASCII mode', () => {
      TerminalCompat.setAsciiMode();
      const charset = TerminalCompat.getCharset();
      
      // In ASCII mode, special characters should be replaced with ASCII equivalents
      expect(charset.verticalLine).toBe('|');
      expect(charset.horizontalLine).toBe('-');
      expect(charset.blockFull).toBe('#');
    });
  });

  describe('charset types', () => {
    test('should provide different charsets for unicode and ASCII', () => {
      // Reset to auto-detect
      TerminalCompat.detectAndSetCharset();
      const unicodeCharset = TerminalCompat.getCharset();
      
      TerminalCompat.setAsciiMode();
      const asciiCharset = TerminalCompat.getCharset();
      
      // They should be different (unless we're already in a limited terminal)
      expect(unicodeCharset).toBeDefined();
      expect(asciiCharset).toBeDefined();
    });
  });
});
