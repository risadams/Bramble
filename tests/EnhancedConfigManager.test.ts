import * as fs from 'fs';
import * as path from 'path';
import { EnhancedConfigManager } from '../src/utils/EnhancedConfigManager';
import { BrambleConfig, ConfigValidationResult, DEFAULT_CONFIG } from '../src/types/configEnhanced';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('EnhancedConfigManager', () => {
  let configManager: EnhancedConfigManager;
  let tempConfigPath: string;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue('{}');
    mockFs.writeFileSync.mockImplementation();
    mockFs.mkdirSync.mockImplementation();
    mockFs.watchFile.mockImplementation();
    mockFs.unwatchFile.mockImplementation();

    tempConfigPath = path.join(process.cwd(), 'test-config.json');
    
    configManager = new EnhancedConfigManager({
      configFile: tempConfigPath,
      validateOnLoad: true,
      autoSave: false,
      watchForChanges: false,
    });
  });

  afterEach(() => {
    if (configManager) {
      configManager.destroy();
    }
  });

  describe('initialization', () => {
    it('should initialize with default configuration', async () => {
      const initPromise = configManager.initialize();
      await expect(initPromise).resolves.not.toThrow();

      const config = configManager.getConfiguration();
      expect(config).toMatchObject(DEFAULT_CONFIG);
    });

    it('should emit initialized event on successful initialization', async () => {
      const initSpy = jest.fn();
      configManager.on('initialized', initSpy);

      await configManager.initialize();

      expect(initSpy).toHaveBeenCalledWith(DEFAULT_CONFIG);
    });

    it('should emit error event on initialization failure', async () => {
      const errorSpy = jest.fn();
      configManager.on('error', errorSpy);

      // Create a new config manager that will fail during validation
      const invalidConfigManager = new EnhancedConfigManager({
        configFile: tempConfigPath,
        validateOnLoad: true,
      });

      // Mock invalid configuration
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{"analysis": {"staleDays": -1}}'); // Invalid config

      await expect(invalidConfigManager.initialize()).resolves.not.toThrow();
      // The manager should still initialize but with validation errors
      
      invalidConfigManager.destroy();
    });
  });

  describe('configuration loading', () => {
    it('should load configuration from file when it exists', async () => {
      const testConfig = {
        analysis: {
          staleDays: 45,
          maxBranches: 150,
        },
        ui: {
          theme: 'light' as const,
          verbosity: 'verbose' as const,
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(testConfig));

      const result = await configManager.loadConfiguration();

      expect(result.valid).toBe(true);
      expect(result.parsed?.analysis.staleDays).toBe(45);
      expect(result.parsed?.analysis.maxBranches).toBe(150);
      expect(result.parsed?.ui.theme).toBe('light');
    });

    it('should handle malformed JSON gracefully', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{ invalid json }');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const result = await configManager.loadConfiguration();

      expect(result.valid).toBe(true); // Should still be valid with defaults
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load config file'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should load profile configuration', async () => {
      configManager = new EnhancedConfigManager({
        configFile: tempConfigPath,
        profile: 'development',
      });

      const result = await configManager.loadConfiguration();

      expect(result.valid).toBe(true);
      // Should have development profile settings
      expect(result.parsed?.analysis.analysisDepth).toBe('detailed');
      expect(result.parsed?.ui.verbosity).toBe('verbose');
    });

    it('should prioritize environment variables over file config', async () => {
      // Set environment variable
      process.env.BRAMBLE_STALE_DAYS = '60';
      process.env.BRAMBLE_THEME = 'light';

      const fileConfig = {
        analysis: { staleDays: 30 },
        ui: { theme: 'dark' },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(fileConfig));

      const result = await configManager.loadConfiguration();

      expect(result.valid).toBe(true);
      expect(result.parsed?.analysis.staleDays).toBe(60); // From env var
      expect(result.parsed?.ui.theme).toBe('light'); // From env var

      // Cleanup
      delete process.env.BRAMBLE_STALE_DAYS;
      delete process.env.BRAMBLE_THEME;
    });
  });

  describe('configuration validation', () => {
    it('should validate correct configuration', () => {
      const validConfig = {
        analysis: {
          staleDays: 30,
          maxBranches: 100,
        },
        ui: {
          theme: 'dark',
          verbosity: 'normal',
        },
      };

      const result = configManager.validateConfiguration(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.parsed).toBeDefined();
    });

    it('should reject invalid configuration', () => {
      const invalidConfig = {
        analysis: {
          staleDays: -5, // Invalid: must be positive
          maxBranches: 'invalid', // Invalid: must be number
        },
        ui: {
          theme: 'invalid-theme', // Invalid enum value
        },
      };

      const result = configManager.validateConfiguration(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.parsed).toBeUndefined();
    });

    it('should generate warnings for potentially problematic configurations', () => {
      const problemConfig = {
        analysis: {
          maxBranches: 2000, // Should generate warning
          maxConcurrency: 50, // Should generate warning
        },
        integrations: {
          github: {
            enabled: true,
            // Missing token - should generate warning
          },
        },
        staleCleanup: {
          enabled: true,
          dryRun: false,
          createBackups: false, // Risky - should generate warning
        },
      };

      const result = configManager.validateConfiguration(problemConfig);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      
      const warningPaths = result.warnings.map(w => w.path);
      expect(warningPaths).toContain('analysis.maxBranches');
      expect(warningPaths).toContain('analysis.maxConcurrency');
      expect(warningPaths).toContain('integrations.github.token');
      expect(warningPaths).toContain('staleCleanup');
    });
  });

  describe('configuration updates', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    it('should update configuration with partial values', async () => {
      const updates = {
        analysis: {
          staleDays: 45,
        },
        ui: {
          theme: 'light' as const,
        },
      };

      await configManager.updateConfiguration(updates);

      const config = configManager.getConfiguration();
      expect(config.analysis.staleDays).toBe(45);
      expect(config.ui.theme).toBe('light');
      // Other values should remain unchanged
      expect(config.analysis.maxBranches).toBe(DEFAULT_CONFIG.analysis.maxBranches);
    });

    it('should reject invalid updates', async () => {
      const invalidUpdates = {
        analysis: {
          staleDays: -10, // Invalid
        },
      };

      await expect(configManager.updateConfiguration(invalidUpdates)).rejects.toThrow();
    });

    it('should emit configChanged event on updates', async () => {
      const changeSpy = jest.fn();
      configManager.on('configChanged', changeSpy);

      const updates = { ui: { theme: 'light' as const } };
      await configManager.updateConfiguration(updates);

      expect(changeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'updated',
          changes: updates,
        })
      );
    });
  });

  describe('profile management', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    it('should switch to built-in profile', async () => {
      await configManager.switchProfile('development');

      const config = configManager.getConfiguration();
      expect(config.analysis.analysisDepth).toBe('detailed');
      expect(config.ui.verbosity).toBe('verbose');
    });

    it('should emit profile-changed event when switching profiles', async () => {
      const changeSpy = jest.fn();
      configManager.on('configChanged', changeSpy);

      await configManager.switchProfile('ci');

      expect(changeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'profile-changed',
        })
      );
    });

    it('should reject switching to non-existent profile', async () => {
      await expect(configManager.switchProfile('non-existent')).rejects.toThrow(
        "Profile 'non-existent' not found"
      );
    });
  });

  describe('configuration saving', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    it('should save configuration to file', async () => {
      const updates = {
        analysis: { staleDays: 45 },
        ui: { theme: 'light' as const },
      };

      await configManager.updateConfiguration(updates);
      await configManager.saveConfiguration();

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        tempConfigPath,
        expect.stringContaining('"staleDays": 45'),
      );
    });

    it('should create config directory if it does not exist', async () => {
      const configDir = path.dirname(tempConfigPath);
      
      await configManager.saveConfiguration();

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(configDir, { recursive: true });
    });

    it('should validate configuration before saving', async () => {
      const invalidConfig = {
        analysis: { staleDays: -5 },
      };

      await expect(configManager.saveConfiguration(invalidConfig)).rejects.toThrow(
        'Invalid configuration'
      );
    });
  });

  describe('configuration reset', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    it('should reset configuration to defaults', async () => {
      // Make some changes first
      await configManager.updateConfiguration({
        analysis: { staleDays: 45 },
        ui: { theme: 'light' as const },
      });

      // Reset
      await configManager.resetConfiguration();

      const config = configManager.getConfiguration();
      expect(config).toMatchObject(DEFAULT_CONFIG);
    });

    it('should emit configChanged event on reset', async () => {
      const changeSpy = jest.fn();
      configManager.on('configChanged', changeSpy);

      await configManager.resetConfiguration();

      expect(changeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'reset',
        })
      );
    });
  });

  describe('environment variable parsing', () => {
    it('should parse boolean environment variables correctly', async () => {
      process.env.BRAMBLE_PERFORMANCE_ENABLED = 'true';
      process.env.BRAMBLE_AUTO_OPTIMIZE = 'false';

      const result = await configManager.loadConfiguration();

      expect(result.parsed?.performance.enabled).toBe(true);
      expect(result.parsed?.performance.autoOptimize).toBe(false);

      delete process.env.BRAMBLE_PERFORMANCE_ENABLED;
      delete process.env.BRAMBLE_AUTO_OPTIMIZE;
    });

    it('should parse numeric environment variables correctly', async () => {
      process.env.BRAMBLE_STALE_DAYS = '60';
      process.env.BRAMBLE_MAX_BRANCHES = '200';

      const result = await configManager.loadConfiguration();

      expect(result.parsed?.analysis.staleDays).toBe(60);
      expect(result.parsed?.analysis.maxBranches).toBe(200);

      delete process.env.BRAMBLE_STALE_DAYS;
      delete process.env.BRAMBLE_MAX_BRANCHES;
    });
  });

  describe('CLI argument parsing', () => {
    const originalArgv = process.argv;

    afterEach(() => {
      process.argv = originalArgv;
    });

    it('should parse CLI arguments correctly', async () => {
      process.argv = ['node', 'bramble', '--stale-days', '75', '--theme', 'light', '--verbose'];

      const result = await configManager.loadConfiguration();

      expect(result.parsed?.analysis.staleDays).toBe(75);
      expect(result.parsed?.ui.theme).toBe('light');
      expect(result.parsed?.ui.verbosity).toBe('verbose');
    });

    it('should handle boolean flags correctly', async () => {
      process.argv = ['node', 'bramble', '--performance', '--no-cache'];

      const result = await configManager.loadConfiguration();

      expect(result.parsed?.performance.enabled).toBe(true);
      expect(result.parsed?.analysis.enableCaching).toBe(false);
    });
  });

  describe('configuration sources', () => {
    it('should track configuration sources correctly', async () => {
      await configManager.loadConfiguration();

      const sources = configManager.getConfigurationSources();
      expect(sources).toBeDefined();
      expect(sources.length).toBeGreaterThan(0);
      expect(sources[0]?.type).toBe('default');
    });

    it('should prioritize sources correctly', async () => {
      const originalArgv = process.argv;
      process.env.BRAMBLE_STALE_DAYS = '99';
      process.argv = ['node', 'bramble', '--stale-days', '77'];

      const result = await configManager.loadConfiguration();

      // CLI should override environment variable (higher priority)
      expect(result.parsed?.analysis.staleDays).toBe(77);

      delete process.env.BRAMBLE_STALE_DAYS;
      process.argv = originalArgv;
    });
  });

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const result = await configManager.loadConfiguration();

      expect(result.valid).toBe(true); // Should fall back to defaults
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle invalid JSON gracefully', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{ invalid: json');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const result = await configManager.loadConfiguration();

      expect(result.valid).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('resource cleanup', () => {
    it('should cleanup resources when destroyed', () => {
      // Setup file watching first
      configManager = new EnhancedConfigManager({
        configFile: tempConfigPath,
        watchForChanges: true,
      });

      // Add a file to watch paths manually to simulate setup
      (configManager as any).watchFilesPaths.add(tempConfigPath);
      
      configManager.destroy();

      // Check that cleanup was called
      expect(mockFs.unwatchFile).toHaveBeenCalled();
      expect(configManager.listenerCount('configChanged')).toBe(0);
    });
  });
});
