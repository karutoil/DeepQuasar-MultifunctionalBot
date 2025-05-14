# Automatic Version Increment System

This project includes an automatic version increment system that increments the patch version in `package.json` with each Git commit.

## How it Works

1. When you make a Git commit, a pre-commit hook runs automatically
2. The hook executes the `scripts/version-increment.js` script
3. This script increments the patch version in `package.json` (e.g., 1.0.0 → 1.0.1)
4. The updated `package.json` is automatically added to your commit
5. A commit lock mechanism prevents recursive commits

## Safeguards

The system includes several safeguards to prevent issues:

- A `.commit-lock` file is created during the version increment process to prevent recursive commits
- The lock file is automatically removed after the process completes or fails
- A post-commit hook ensures the lock file is removed even if there's an error

## Manual Reset

If you encounter any issues with the automatic version increment, you can:

1. Check if a `.commit-lock` file exists in the project root and remove it
2. Manually edit the version in `package.json`
3. Temporarily disable the pre-commit hook: `chmod -x .git/hooks/pre-commit`
4. Re-enable the hook when needed: `chmod +x .git/hooks/pre-commit`

## Customizing

If you want to change how versions are incremented (e.g., increment minor or major version), edit the `scripts/version-increment.js` file.
