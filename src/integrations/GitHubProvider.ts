import { GitHostingProvider, RepositoryMetadata, BranchEnrichment, PullRequest, Issue } from './types.js';

export interface GitHubConfig {
  token?: string;
  apiUrl?: string; // For GitHub Enterprise
}

export class GitHubProvider implements GitHostingProvider {
  public readonly name = 'GitHub';
  private config: GitHubConfig;
  private baseUrl: string;

  constructor(config: GitHubConfig = {}) {
    this.config = config;
    this.baseUrl = config.apiUrl || 'https://api.github.com';
  }

  isConfigured(): boolean {
    return !!this.config.token || !!process.env.GITHUB_TOKEN;
  }

  private getToken(): string | undefined {
    return this.config.token || process.env.GITHUB_TOKEN;
  }

  private async makeRequest(endpoint: string): Promise<any> {
    const token = this.getToken();
    if (!token) {
      throw new Error('GitHub token not configured. Set GITHUB_TOKEN environment variable or provide token in config.');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Bramble-Git-Analyzer'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async detectRepository(repositoryPath: string): Promise<RepositoryMetadata | null> {
    try {
      // Extract GitHub repo info from git remote
      const { execSync } = await import('child_process');
      const remotesOutput = execSync('git remote -v', { 
        cwd: repositoryPath, 
        encoding: 'utf-8' 
      }).toString();

      const githubMatch = remotesOutput.match(/github\.com[:/]([^/]+)\/([^.\s]+)/);
      if (!githubMatch) {
        return null;
      }

      const [, owner, repo] = githubMatch;
      const repoData = await this.makeRequest(`/repos/${owner}/${repo}`);

      return {
        name: repoData.name,
        fullName: repoData.full_name,
        defaultBranch: repoData.default_branch,
        url: repoData.html_url,
        description: repoData.description,
        isPrivate: repoData.private,
        language: repoData.language,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        lastActivity: new Date(repoData.updated_at),
        topics: repoData.topics || []
      };
    } catch (error) {
      console.warn('Failed to detect GitHub repository:', error);
      return null;
    }
  }

  async enrichBranch(branch: string, repository: RepositoryMetadata): Promise<BranchEnrichment> {
    try {
      const [owner, repo] = repository.fullName.split('/');
      
      // Get pull requests for this branch
      const prsData = await this.makeRequest(`/repos/${owner}/${repo}/pulls?head=${owner}:${branch}&state=all`);
      const pullRequests: PullRequest[] = prsData.map((pr: any) => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        branch: pr.head.ref,
        baseBranch: pr.base.ref,
        author: pr.user.login,
        state: pr.merged_at ? 'merged' : pr.state,
        createdAt: new Date(pr.created_at),
        updatedAt: new Date(pr.updated_at),
        url: pr.html_url,
        mergeable: pr.mergeable,
        conflicts: pr.mergeable === false,
        labels: pr.labels.map((label: any) => label.name)
      }));

      const hasOpenPR = pullRequests.some(pr => pr.state === 'open');
      const lastPRActivity = pullRequests.length > 0 
        ? new Date(Math.max(...pullRequests.map(pr => pr.updatedAt.getTime())))
        : undefined;

      // Get branch protection if available
      let protection;
      try {
        const protectionData = await this.makeRequest(`/repos/${owner}/${repo}/branches/${branch}/protection`);
        protection = {
          enforced: true,
          requiredReviews: protectionData.required_pull_request_reviews?.required_approving_review_count || 0,
          dismissStaleReviews: protectionData.required_pull_request_reviews?.dismiss_stale_reviews || false,
          requireCodeOwnerReviews: protectionData.required_pull_request_reviews?.require_code_owner_reviews || false
        };
      } catch {
        // Branch protection not configured or not accessible
        protection = {
          enforced: false,
          requiredReviews: 0,
          dismissStaleReviews: false,
          requireCodeOwnerReviews: false
        };
      }

      return {
        pullRequests,
        issues: [], // Could be enhanced to find linked issues
        hasOpenPR,
        ...(lastPRActivity && { lastPRActivity }),
        protection
      };
    } catch (error) {
      console.warn(`Failed to enrich branch ${branch}:`, error);
      return {
        pullRequests: [],
        issues: [],
        hasOpenPR: false
      };
    }
  }

  async listPullRequests(repository: RepositoryMetadata): Promise<PullRequest[]> {
    try {
      const [owner, repo] = repository.fullName.split('/');
      const prsData = await this.makeRequest(`/repos/${owner}/${repo}/pulls?state=all&per_page=100`);
      
      return prsData.map((pr: any) => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        branch: pr.head.ref,
        baseBranch: pr.base.ref,
        author: pr.user.login,
        state: pr.merged_at ? 'merged' : pr.state,
        createdAt: new Date(pr.created_at),
        updatedAt: new Date(pr.updated_at),
        url: pr.html_url,
        mergeable: pr.mergeable,
        conflicts: pr.mergeable === false,
        labels: pr.labels.map((label: any) => label.name)
      }));
    } catch (error) {
      console.warn('Failed to list pull requests:', error);
      return [];
    }
  }

  async listIssues(repository: RepositoryMetadata): Promise<Issue[]> {
    try {
      const [owner, repo] = repository.fullName.split('/');
      const issuesData = await this.makeRequest(`/repos/${owner}/${repo}/issues?state=all&per_page=100`);
      
      return issuesData
        .filter((issue: any) => !issue.pull_request) // Exclude PRs which are also returned as issues
        .map((issue: any) => ({
          id: issue.id,
          number: issue.number,
          title: issue.title,
          author: issue.user.login,
          state: issue.state,
          createdAt: new Date(issue.created_at),
          updatedAt: new Date(issue.updated_at),
          url: issue.html_url,
          labels: issue.labels.map((label: any) => label.name)
        }));
    } catch (error) {
      console.warn('Failed to list issues:', error);
      return [];
    }
  }
}
