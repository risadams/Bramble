// Test setup configuration for Bramble
import { jest } from '@jest/globals';

// Mock chalk to avoid ES module issues
jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    blue: jest.fn((str: string) => str),
    red: jest.fn((str: string) => str),
    green: jest.fn((str: string) => str),
    yellow: jest.fn((str: string) => str),
    gray: jest.fn((str: string) => str),
    bold: jest.fn((str: string) => str),
  },
}));

// Mock simple-git for consistent testing
jest.mock('simple-git', () => {
  return {
    __esModule: true,
    default: jest.fn(() => ({
      // Mock git operations
      branch: jest.fn(),
      log: jest.fn(),
      raw: jest.fn(),
      status: jest.fn(),
      revparse: jest.fn(),
      diffSummary: jest.fn(),
    })),
  };
});

// Mock blessed for terminal UI testing
jest.mock('blessed', () => ({
  screen: jest.fn(() => ({
    render: jest.fn(),
    destroy: jest.fn(),
    key: jest.fn(),
  })),
  box: jest.fn(() => ({
    setContent: jest.fn(),
    append: jest.fn(),
  })),
}));

// Mock ConfigManager
jest.mock('../src/utils/ConfigManager.js', () => ({
  ConfigManager: {
    loadConfig: jest.fn(() => ({
      includeRemoteBranches: true,
      maxBranches: 100,
      staleDays: 30
    }))
  }
}));

// Mock file system operations
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  access: jest.fn(),
  mkdir: jest.fn(),
}));

// Set test environment
process.env.NODE_ENV = 'test';
