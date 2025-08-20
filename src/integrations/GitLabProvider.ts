import { GitHostingProvider, RepositoryMetadata, BranchEnrichment, PullRequest, Issue } from './types.js';

export interface GitLabConfig {
  token?: string;
  baseUrl?: string; // For self-hosted GitLab instances
}

export class GitLabProvider implements GitHostingProvider {
  public readonly name = 'GitLab';
  private config: GitLabConfig;
  private baseUrl: string;

  constructor(config: GitLabConfig = {}) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://gitlab.com';
  }

  isConfigured(): boolean {
    return !!this.config.token || !!process.env.GITLAB_TOKEN;
  }

  private getToken(): string | undefined {
    return this.config.token || process.env.GITLAB_TOKEN;
  }

  private async makeRequest(endpoint: string): Promise<any> {
    const token = this.getToken();
    if (!token) {
      throw new Error('GitLab token not configured. Set GITLAB_TOKEN environment variable or provide token in config.');
    }

    const response = await fetch(`${this.baseUrl}/api/v4${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async detectRepository(repositoryPath: string): Promise<RepositoryMetadata | null> {
    try {
      // Extract GitLab repo info from git remote
      const { execSync } = await import('child_process');
      const remotesOutput = execSync('git remote -v', { 
        cwd: repositoryPath, 
        encoding: 'utf-8' 
      }).toString();

      const gitlabMatch = remotesOutput.match(/gitlab\.com[:/]([^/]+)\/([^.\s]+)/);
      if (!gitlabMatch) {
        return null;
      }

      const [, owner, repo] = gitlabMatch;
      const projectPath = encodeURIComponent(`${owner}/${repo}`);
      const repoData = await this.makeRequest(`/projects/${projectPath}`);

      return {
        name: repoData.name,
        fullName: repoData.path_with_namespace,
        defaultBranch: repoData.default_branch,
        url: repoData.web_url,
        description: repoData.description,
        isPrivate: repoData.visibility === 'private',
        language: repoData.language,
        stars: repoData.star_count,
        forks: repoData.forks_count,
        lastActivity: new Date(repoData.last_activity_at),
        topics: repoData.topics || []
      };
    } catch (error) {
      console.warn('Failed to detect GitLab repository:', error);
      return null;
    }
  }

  async enrichBranch(branch: string, repository: RepositoryMetadata): Promise<BranchEnrichment> {
    try {
      const projectPath = encodeURIComponent(repository.fullName);
      
      // Get merge requests for this branch
      const mrsData = await this.makeRequest(`/projects/${projectPath}/merge_requests?source_branch=${branch}&state=all`);
      const pullRequests: PullRequest[] = mrsData.map((mr: any) => ({
        id: mr.id,
        number: mr.iid,
        title: mr.title,
        branch: mr.source_branch,
        baseBranch: mr.target_branch,
        author: mr.author.username,
        state: mr.state === 'merged' ? 'merged' : (mr.state === 'opened' ? 'open' : 'closed'),
        createdAt: new Date(mr.created_at),
        updatedAt: new Date(mr.updated_at),
        url: mr.web_url,
        mergeable: !mr.has_conflicts,
        conflicts: mr.has_conflicts,
        labels: mr.labels || []
      }));

      const hasOpenPR = pullRequests.some(pr => pr.state === 'open');
      const lastPRActivity = pullRequests.length > 0 
        ? new Date(Math.max(...pullRequests.map(pr => pr.updatedAt.getTime())))
        : undefined;

      // Get branch protection if available
      let protection;
      try {
        const protectionData = await this.makeRequest(`/projects/${projectPath}/protected_branches/${encodeURIComponent(branch)}`);
        protection = {
          enforced: true,
          requiredReviews: 1, // GitLab doesn't expose this in the same way
          dismissStaleReviews: false,
          requireCodeOwnerReviews: protectionData.code_owner_approval_required || false
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
      const projectPath = encodeURIComponent(repository.fullName);
      const mrsData = await this.makeRequest(`/projects/${projectPath}/merge_requests?state=all&per_page=100`);
      
      return mrsData.map((mr: any) => ({
        id: mr.id,
        number: mr.iid,
        title: mr.title,
        branch: mr.source_branch,
        baseBranch: mr.target_branch,
        author: mr.author.username,
        state: mr.state === 'merged' ? 'merged' : (mr.state === 'opened' ? 'open' : 'closed'),
        createdAt: new Date(mr.created_at),
        updatedAt: new Date(mr.updated_at),
        url: mr.web_url,
        mergeable: !mr.has_conflicts,
        conflicts: mr.has_conflicts,
        labels: mr.labels || []
      }));
    } catch (error) {
      console.warn('Failed to list merge requests:', error);
      return [];
    }
  }

  async listIssues(repository: RepositoryMetadata): Promise<Issue[]> {
    try {
      const projectPath = encodeURIComponent(repository.fullName);
      const issuesData = await this.makeRequest(`/projects/${projectPath}/issues?state=all&per_page=100`);
      
      return issuesData.map((issue: any) => ({
        id: issue.id,
        number: issue.iid,
        title: issue.title,
        author: issue.author.username,
        state: issue.state,
        createdAt: new Date(issue.created_at),
        updatedAt: new Date(issue.updated_at),
        url: issue.web_url,
        labels: issue.labels || []
      }));
    } catch (error) {
      console.warn('Failed to list issues:', error);
      return [];
    }
  }
}
