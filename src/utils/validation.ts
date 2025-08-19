import simpleGit, { SimpleGit } from 'simple-git';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Validates if the given path contains a valid git repository
 */
export async function validateRepository(path: string): Promise<boolean> {
  try {
    // Check if .git directory exists
    const gitPath = join(path, '.git');
    if (!existsSync(gitPath)) {
      return false;
    }

    // Initialize git and check if it's a valid repository
    const git: SimpleGit = simpleGit(path);
    await git.status();
    
    return true;
  } catch (error) {
    return false;
  }
}
