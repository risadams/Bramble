import { GitAnalyzer } from '../src/core/GitAnalyzer.js';
import { BranchInfo, AnalysisResult } from '../src/types/analysis.js';

// Mock data for testing
export const mockBranchData = {
  main: {
    name: 'main',
    commit: 'abc123',
    current: true,
    lastCommitDate: '2025-08-20T10:00:00Z',
    lastCommitAuthor: 'Test Author',
    commitCount: 50,
    mergedIntoDefault: false
  },
  'feature/test': {
    name: 'feature/test',
    commit: 'def456',
    current: false,
    lastCommitDate: '2025-08-19T15:30:00Z',
    lastCommitAuthor: 'Developer',
    commitCount: 5,
    mergedIntoDefault: false
  },
  'stale-branch': {
    name: 'stale-branch',
    commit: 'ghi789',
    current: false,
    lastCommitDate: '2025-06-01T08:00:00Z',
    lastCommitAuthor: 'Old Developer',
    commitCount: 2,
    mergedIntoDefault: false
  }
};

export const mockAnalysisResult: AnalysisResult = {
  repository: {
    path: '/test/repo',
    defaultBranch: 'main',
    totalBranches: 3,
    localBranches: 3,
    remoteBranches: 0,
    staleBranches: 1,
    mergeableBranches: 2,
    conflictedBranches: 1
  },
  branches: [
    {
      name: 'main',
      current: true,
      commit: 'abc123',
      lastActivity: new Date('2025-08-20T10:00:00Z'),
      lastCommitAuthor: 'Test Author',
      isStale: false,
      commitCount: 50,
      branchType: 'local',
      divergence: { ahead: 0, behind: 0 },
      contributors: ['Test Author', 'Developer'],
      mergeable: true,
      conflictCount: 0,
      commitFrequency: [
        { date: '2025-08-20', count: 3 },
        { date: '2025-08-19', count: 2 }
      ],
      size: 100
    },
    {
      name: 'feature/test',
      current: false,
      commit: 'def456',
      lastActivity: new Date('2025-08-19T15:30:00Z'),
      lastCommitAuthor: 'Developer',
      isStale: false,
      commitCount: 5,
      branchType: 'local',
      divergence: { ahead: 2, behind: 1 },
      contributors: ['Developer'],
      mergeable: true,
      conflictCount: 0,
      commitFrequency: [
        { date: '2025-08-19', count: 5 }
      ],
      size: 25
    },
    {
      name: 'stale-branch',
      current: false,
      commit: 'ghi789',
      lastActivity: new Date('2025-06-01T08:00:00Z'),
      lastCommitAuthor: 'Old Developer',
      isStale: true,
      commitCount: 2,
      branchType: 'local',
      divergence: { ahead: 0, behind: 15 },
      contributors: ['Old Developer'],
      mergeable: false,
      conflictCount: 3,
      commitFrequency: [],
      size: 10
    }
  ],
  statistics: {
    averageAge: 45.5,
    mostActive: 'main',
    leastActive: 'stale-branch',
    totalCommits: 57,
    averageCommitsPerBranch: 19.0,
    totalContributors: 3,
    averageBranchSize: 45.0,
    mostConflicted: 'stale-branch'
  },
  activityOverview: {
    dailyActivity: [
      { date: '2025-08-19', count: 7 },
      { date: '2025-08-20', count: 3 }
    ],
    topContributors: [
      { name: 'Test Author', commits: 50 },
      { name: 'Developer', commits: 5 },
      { name: 'Old Developer', commits: 2 }
    ],
    branchTypes: [
      { type: 'local', count: 3 },
      { type: 'remote', count: 0 }
    ]
  }
};

export const createMockGitAnalyzer = (repositoryPath: string = '/test/repo'): GitAnalyzer => {
  return new GitAnalyzer(repositoryPath);
};
