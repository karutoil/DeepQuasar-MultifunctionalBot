#!/usr/bin/env node

/**
 * This script increments the patch version in package.json
 * It's used as part of the git pre-commit hook
 */

const fs = require('fs');
const path = require('path');

// Get the package.json path
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJsonLockPath = path.join(__dirname, '..', 'package-lock.json');

// Flag to prevent recursive commits
const COMMIT_LOCK_FILE = path.join(__dirname, '..', '.commit-lock');

// Check if commit lock exists (prevents recursive commits)
if (fs.existsSync(COMMIT_LOCK_FILE)) {
  console.log('Commit lock detected, skipping version increment');
  process.exit(0);
}

// Create commit lock
fs.writeFileSync(COMMIT_LOCK_FILE, Date.now().toString());

try {
  // Read the package.json file
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const packageJsonLock = JSON.parse(fs.readFileSync(packageJsonLockPath, 'utf8'));
  
  // Get the current version
  const currentVersion = packageJson.version;
  const currentVersionLock = packageJsonLock.version;
  console.log(`Current version: ${currentVersion}`);
  
  // Split the version into parts
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  // Increment the patch version
  const newPatch = patch + 1;
  const newVersion = `${major}.${minor}.${newPatch}`;
  
  // Update the version in the package.json object
  packageJson.version = newVersion;
  packageJsonLock.version = newVersion;
  
  // Write the updated package.json back to file
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  fs.writeFileSync(packageJsonLockPath, JSON.stringify(packageJsonLock, null, 2) + '\n');
  
  console.log(`Version incremented: ${currentVersion} → ${newVersion}`);
  
  // Add the package.json to the git staging area
  const { execSync } = require('child_process');
  execSync('git add package.json package-lock.json');
  
  console.log('Updated package.json added to commit');
} catch (error) {
  console.error('Error incrementing version:', error);
  process.exit(1);
} finally {
  // Remove the commit lock regardless of success or failure
  if (fs.existsSync(COMMIT_LOCK_FILE)) {
    fs.unlinkSync(COMMIT_LOCK_FILE);
  }
}
