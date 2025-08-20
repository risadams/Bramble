import { IntegrationManager } from '../IntegrationManager.js';
import { GitHubProvider } from '../GitHubProvider.js';
import { GitLabProvider } from '../GitLabProvider.js';
import { RepositoryMetadata, BranchEnrichment } from '../types.js';

// Mock the providers
jest.mock('../GitHubProvider.js');
jest.mock('../GitLabProvider.js');

const MockedGitHubProvider = GitHubProvider as jest.MockedClass<typeof GitHubProvider>;
const MockedGitLabProvider = GitLabProvider as jest.MockedClass<typeof GitLabProvider>;

describe('IntegrationManager', () => {
  let integrationManager: IntegrationManager;
  let mockGitHubProvider: jest.Mocked<GitHubProvider>;
  let mockGitLabProvider: jest.Mocked<GitLabProvider>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock instances
    mockGitHubProvider = {
      name: 'GitHub',
      isConfigured: jest.fn().mockReturnValue(true),
      detectRepository: jest.fn(),
      enrichBranch: jest.fn(),
      listPullRequests: jest.fn().mockResolvedValue([]),
      listIssues: jest.fn().mockResolvedValue([])
    } as any;

    mockGitLabProvider = {
      name: 'GitLab',
      isConfigured: jest.fn().mockReturnValue(false),
      detectRepository: jest.fn(),
      enrichBranch: jest.fn(),
      listPullRequests: jest.fn().mockResolvedValue([]),
      listIssues: jest.fn().mockResolvedValue([])
    } as any;

    MockedGitHubProvider.mockImplementation(() => mockGitHubProvider);
    MockedGitLabProvider.mockImplementation(() => mockGitLabProvider);

    integrationManager = new IntegrationManager();
  });

  describe('Repository Detection', () => {
    it('should detect GitHub repository', async () => {
      const mockMetadata: RepositoryMetadata = {
        name: 'repo',
        fullName: 'user/repo',
        defaultBranch: 'main',
        url: 'https://github.com/user/repo',
        description: 'Test repository',
        isPrivate: false,
        language: 'TypeScript',
        stars: 10,
        forks: 5,
        lastActivity: new Date('2023-01-01'),
        topics: ['typescript', 'testing']
      };

      mockGitHubProvider.detectRepository.mockResolvedValue(mockMetadata);
      
      const result = await integrationManager.detectRepository('/path/to/repo');
      
      expect(result).toEqual(mockMetadata);
      expect(mockGitHubProvider.detectRepository).toHaveBeenCalledWith('/path/to/repo');
    });

    it('should return null when no repository is detected', async () => {
      mockGitHubProvider.detectRepository.mockResolvedValue(null);
      mockGitLabProvider.detectRepository.mockResolvedValue(null);
      
      const result = await integrationManager.detectRepository('/path/to/repo');
      
      expect(result).toBeNull();
    });

    it('should handle detection errors gracefully', async () => {
      mockGitHubProvider.detectRepository.mockRejectedValue(new Error('API Error'));
      mockGitLabProvider.detectRepository.mockResolvedValue(null);
      
      const result = await integrationManager.detectRepository('/path/to/repo');
      
      expect(result).toBeNull();
    });
  });

  describe('Branch Enrichment', () => {
    const mockRepository: RepositoryMetadata = {
      name: 'repo',
      fullName: 'user/repo',
      defaultBranch: 'main',
      url: 'https://github.com/user/repo',
      description: 'Test repository',
      isPrivate: false,
      language: 'TypeScript',
      stars: 10,
      forks: 5,
      lastActivity: new Date('2023-01-01'),
      topics: ['typescript', 'testing']
    };

    it('should enrich branches with PR data', async () => {
      const mockEnrichment: BranchEnrichment = {
        pullRequests: [
          {
            id: 1,
            number: 1,
            title: 'Test PR',
            branch: 'feature-branch',
            baseBranch: 'main',
            author: 'testuser',
            state: 'open',
            createdAt: new Date('2023-01-01'),
            updatedAt: new Date('2023-01-02'),
            url: 'https://github.com/user/repo/pull/1',
            labels: ['feature']
          }
        ],
        issues: [],
        hasOpenPR: true
      };

      mockGitHubProvider.enrichBranch.mockResolvedValue(mockEnrichment);
      
      const result = await integrationManager.enrichBranches(['feature-branch'], mockRepository);
      
      expect(result.get('feature-branch')).toEqual(mockEnrichment);
      expect(mockGitHubProvider.enrichBranch).toHaveBeenCalledWith('feature-branch', mockRepository);
    });

    it('should handle enrichment errors gracefully', async () => {
      mockGitHubProvider.enrichBranch.mockRejectedValue(new Error('API Error'));
      
      const result = await integrationManager.enrichBranches(['feature-branch'], mockRepository);
      
      expect(result.get('feature-branch')).toEqual({
        pullRequests: [],
        issues: [],
        hasOpenPR: false
      });
    });

    it('should process branches in batches', async () => {
      const branches = ['branch1', 'branch2', 'branch3', 'branch4', 'branch5', 'branch6'];
      mockGitHubProvider.enrichBranch.mockResolvedValue({
        pullRequests: [],
        issues: [],
        hasOpenPR: false
      });
      
      await integrationManager.enrichBranches(branches, mockRepository);
      
      expect(mockGitHubProvider.enrichBranch).toHaveBeenCalledTimes(6);
    });
  });

  describe('Pull Requests', () => {
    const mockRepository: RepositoryMetadata = {
      name: 'repo',
      fullName: 'user/repo',
      defaultBranch: 'main',
      url: 'https://github.com/user/repo',
      description: 'Test repository',
      isPrivate: false,
      language: 'TypeScript',
      stars: 10,
      forks: 5,
      lastActivity: new Date('2023-01-01'),
      topics: ['typescript', 'testing']
    };

    it('should fetch all pull requests', async () => {
      const mockPRs = [
        {
          id: 1,
          number: 1,
          title: 'Test PR',
          branch: 'feature-branch',
          baseBranch: 'main',
          author: 'testuser',
          state: 'open' as const,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-02'),
          url: 'https://github.com/user/repo/pull/1',
          labels: ['feature']
        }
      ];

      mockGitHubProvider.listPullRequests.mockResolvedValue(mockPRs);
      
      const result = await integrationManager.getAllPullRequests(mockRepository);
      
      expect(result).toEqual(mockPRs);
      expect(mockGitHubProvider.listPullRequests).toHaveBeenCalledWith(mockRepository);
    });

    it('should handle PR fetch errors gracefully', async () => {
      mockGitHubProvider.listPullRequests.mockRejectedValue(new Error('API Error'));
      
      const result = await integrationManager.getAllPullRequests(mockRepository);
      
      expect(result).toEqual([]);
    });
  });

  describe('Configuration', () => {
    it('should detect configured providers', () => {
      const result = integrationManager.hasConfiguredProviders();
      
      expect(result).toBe(true);
      expect(mockGitHubProvider.isConfigured).toHaveBeenCalled();
    });

    it('should list configured provider names', () => {
      const result = integrationManager.getConfiguredProviders();
      
      expect(result).toEqual(['GitHub']);
    });
  });
});
