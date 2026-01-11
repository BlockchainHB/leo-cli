#!/usr/bin/env node
/**
 * Leo Update Command
 *
 * Self-updates Leo to the latest version while preserving user configuration.
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import semver from 'semver';

const PACKAGE_NAME = '@anthropic/leo';

interface UpdateResult {
  success: boolean;
  previousVersion: string;
  newVersion: string;
  message: string;
}

/**
 * Get the current installed version
 */
function getCurrentVersion(): string {
  try {
    const packagePath = path.join(process.cwd(), 'node_modules', PACKAGE_NAME, 'package.json');
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      return pkg.version;
    }

    // Fallback: check global installation
    const result = execSync(`npm list -g ${PACKAGE_NAME} --json 2>/dev/null`, { encoding: 'utf-8' });
    const data = JSON.parse(result);
    return data.dependencies?.[PACKAGE_NAME]?.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Get the latest available version from npm
 */
async function getLatestVersion(): Promise<string> {
  try {
    const result = execSync(`npm view ${PACKAGE_NAME} version 2>/dev/null`, { encoding: 'utf-8' });
    return result.trim();
  } catch {
    return '0.0.0';
  }
}

/**
 * Check if an update is available
 */
export async function checkForUpdates(): Promise<{
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
}> {
  const currentVersion = getCurrentVersion();
  const latestVersion = await getLatestVersion();

  const updateAvailable = semver.valid(currentVersion) && semver.valid(latestVersion)
    ? semver.lt(currentVersion, latestVersion)
    : false;

  return {
    updateAvailable,
    currentVersion,
    latestVersion
  };
}

/**
 * Backup user configuration files
 */
function backupConfig(): string[] {
  const backupFiles: string[] = [];
  const configFiles = ['leo.config.json', '.env', 'keywords.json'];

  const backupDir = path.join(process.cwd(), '.leo-backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  for (const file of configFiles) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      const backupPath = path.join(backupDir, `${file}.backup`);
      fs.copyFileSync(filePath, backupPath);
      backupFiles.push(file);
      console.log(`  Backed up: ${file}`);
    }
  }

  return backupFiles;
}

/**
 * Restore user configuration files after update
 */
function restoreConfig(): void {
  const backupDir = path.join(process.cwd(), '.leo-backup');

  if (!fs.existsSync(backupDir)) {
    return;
  }

  const backupFiles = fs.readdirSync(backupDir);

  for (const backupFile of backupFiles) {
    if (backupFile.endsWith('.backup')) {
      const originalName = backupFile.replace('.backup', '');
      const backupPath = path.join(backupDir, backupFile);
      const originalPath = path.join(process.cwd(), originalName);

      fs.copyFileSync(backupPath, originalPath);
      console.log(`  Restored: ${originalName}`);
    }
  }

  // Clean up backup directory
  fs.rmSync(backupDir, { recursive: true });
}

/**
 * Perform the update
 */
export async function performUpdate(options: { force?: boolean } = {}): Promise<UpdateResult> {
  const { updateAvailable, currentVersion, latestVersion } = await checkForUpdates();

  if (!updateAvailable && !options.force) {
    return {
      success: true,
      previousVersion: currentVersion,
      newVersion: currentVersion,
      message: `Already on the latest version (${currentVersion})`
    };
  }

  console.log('\nLeo Update');
  console.log('='.repeat(40));
  console.log(`Current version: ${currentVersion}`);
  console.log(`Latest version: ${latestVersion}`);
  console.log('');

  // Backup configuration
  console.log('Backing up configuration...');
  const backedUp = backupConfig();
  console.log(`  ${backedUp.length} files backed up`);
  console.log('');

  // Perform update
  console.log('Installing update...');

  try {
    // Determine if global or local install
    const isGlobal = process.argv[1]?.includes('node_modules/.bin') === false;
    const installCmd = isGlobal
      ? `npm install -g ${PACKAGE_NAME}@latest`
      : `npm install ${PACKAGE_NAME}@latest`;

    execSync(installCmd, { stdio: 'inherit' });

    console.log('');
    console.log('Restoring configuration...');
    restoreConfig();

    console.log('');
    console.log('Update complete!');

    return {
      success: true,
      previousVersion: currentVersion,
      newVersion: latestVersion,
      message: `Successfully updated from ${currentVersion} to ${latestVersion}`
    };
  } catch (error) {
    // Restore config on failure
    console.log('');
    console.log('Update failed, restoring configuration...');
    restoreConfig();

    return {
      success: false,
      previousVersion: currentVersion,
      newVersion: currentVersion,
      message: `Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Show update status
 */
export async function showUpdateStatus(): Promise<void> {
  const { updateAvailable, currentVersion, latestVersion } = await checkForUpdates();

  console.log('\nLeo Version Status');
  console.log('='.repeat(40));
  console.log(`Current version: ${currentVersion}`);
  console.log(`Latest version: ${latestVersion}`);

  if (updateAvailable) {
    console.log('');
    console.log('An update is available!');
    console.log('Run `leo update` to update to the latest version.');
  } else {
    console.log('');
    console.log('You are on the latest version.');
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  switch (command) {
    case 'check':
      showUpdateStatus();
      break;

    case 'force':
      performUpdate({ force: true }).then(result => {
        console.log(result.message);
        process.exit(result.success ? 0 : 1);
      });
      break;

    default:
      performUpdate().then(result => {
        console.log(result.message);
        process.exit(result.success ? 0 : 1);
      });
  }
}
