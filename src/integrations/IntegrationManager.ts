import { GitHostingProvider, RepositoryMetadata, BranchEnrichment } from './types.js';
import { GitHubProvider } from './GitHubProvider.js';
import { GitLabProvider } from './GitLabProvider.js';

export class IntegrationManager {
  private providers: GitHostingProvider[] = [];

  constructor() {
    // Initialize providers based on available configuration
    this.providers.push(new GitHubProvider());
    this.providers.push(new GitLabProvider());
  }

  /**
   * Add a custom provider
   */
  addProvider(provider: GitHostingProvider): void {
    this.providers.push(provider);
  }

  /**
   * Detect the repository hosting provider and metadata
   */
  async detectRepository(repositoryPath: string): Promise<RepositoryMetadata | null> {
    for (const provider of this.providers) {
      try {
        const metadata = await provider.detectRepository(repositoryPath);
        if (metadata) {
          console.log(`🔗 Detected ${provider.name} repository: ${metadata.fullName}`);
          return metadata;
        }
      } catch (error) {
        console.warn(`Failed to detect repository with ${provider.name}:`, error);
      }
    }
    return null;
  }

  /**
   * Enrich branch information with external data
   */
  async enrichBranches(
    branches: string[], 
    repository: RepositoryMetadata
  ): Promise<Map<string, BranchEnrichment>> {
    const provider = this.getProviderForRepository(repository);
    if (!provider) {
      return new Map();
    }

    const enrichmentMap = new Map<string, BranchEnrichment>();
    
    // Process branches in batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < branches.length; i += batchSize) {
      const batch = branches.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (branch) => {
        try {
          const enrichment = await provider.enrichBranch(branch, repository);
          return { branch, enrichment };
        } catch (error) {
          console.warn(`Failed to enrich branch ${branch}:`, error);
          return { 
            branch, 
            enrichment: { 
              pullRequests: [], 
              issues: [], 
              hasOpenPR: false 
            } 
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ branch, enrichment }) => {
        enrichmentMap.set(branch, enrichment);
      });

      // Small delay between batches to be respectful of API limits
      if (i + batchSize < branches.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return enrichmentMap;
  }

  /**
   * Get all pull requests for the repository
   */
  async getAllPullRequests(repository: RepositoryMetadata) {
    const provider = this.getProviderForRepository(repository);
    if (!provider) {
      return [];
    }

    try {
      return await provider.listPullRequests(repository);
    } catch (error) {
      console.warn('Failed to fetch pull requests:', error);
      return [];
    }
  }

  /**
   * Get all issues for the repository
   */
  async getAllIssues(repository: RepositoryMetadata) {
    const provider = this.getProviderForRepository(repository);
    if (!provider) {
      return [];
    }

    try {
      return await provider.listIssues(repository);
    } catch (error) {
      console.warn('Failed to fetch issues:', error);
      return [];
    }
  }

  /**
   * Check if any integrations are configured
   */
  hasConfiguredProviders(): boolean {
    return this.providers.some(provider => provider.isConfigured());
  }

  /**
   * Get list of configured providers
   */
  getConfiguredProviders(): string[] {
    return this.providers
      .filter(provider => provider.isConfigured())
      .map(provider => provider.name);
  }

  private getProviderForRepository(repository: RepositoryMetadata): GitHostingProvider | null {
    // Simple provider detection based on repository URL
    if (repository.url.includes('github.com')) {
      return this.providers.find(p => p.name === 'GitHub') || null;
    }
    if (repository.url.includes('gitlab.com')) {
      return this.providers.find(p => p.name === 'GitLab') || null;
    }
    
    // Could be enhanced to support custom domains
    return null;
  }
}
