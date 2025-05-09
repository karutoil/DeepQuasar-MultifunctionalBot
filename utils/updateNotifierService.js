const getUpdateNotifierModel = require('../models/updateNotifierModel');
const fetch = require('node-fetch');
const os = require('os');

class UpdateNotifierService {
    constructor(client) {
        this.client = client;
        this.checkIntervalHours = 24;
        this.isCheckingForUpdates = false;
        this.checkInterval = null;
    }

    /**
     * Start the update check interval
     */
    async start() {
        try {
            const updateNotifierModel = getUpdateNotifierModel();
            const config = await updateNotifierModel.getConfig();
            
            if (!config.enabled) {
                console.log('[UpdateNotifier] Update notifications are disabled in config.');
                return;
            }
            
            // Run once at startup
            await this.checkForUpdates();
            
            // Set up interval check (every 24 hours)
            this.checkInterval = setInterval(() => {
                this.checkForUpdates();
            }, this.checkIntervalHours * 60 * 60 * 1000);
            
            console.log(`[UpdateNotifier] Update check scheduled every ${this.checkIntervalHours} hours.`);
        } catch (error) {
            console.error('[UpdateNotifier] Error starting update notifier:', error);
        }
    }
    
    /**
     * Stop the update check interval
     */
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log('[UpdateNotifier] Update notifier stopped.');
        }
    }
    
    /**
     * Main update check logic
     */
    async checkForUpdates() {
        // Prevent concurrent checks
        if (this.isCheckingForUpdates) {
            return;
        }
        
        this.isCheckingForUpdates = true;
        
        try {
            // Get configuration
            const updateNotifierModel = getUpdateNotifierModel();
            const config = await updateNotifierModel.getConfig();
            if (!config.enabled) {
                console.log('[UpdateNotifier] Update notifications are disabled.');
                this.isCheckingForUpdates = false;
                return;
            }
            
            // Update last check time
            await updateNotifierModel.updateLastCheckTime();
            
            // Get current and latest digests
            const currentDigest = await this.getCurrentDigest();
            const latestDigest = await this.getLatestDigest();
            
            if (!currentDigest || !latestDigest) {
                console.log('[UpdateNotifier] Skipping update check due to missing digest(s).');
                this.isCheckingForUpdates = false;
                return;
            }
            
            if (currentDigest !== latestDigest) {
                const { summary, commitsBehind } = await this.getCommitSummary(currentDigest, latestDigest, config.github_api_token);
                if (commitsBehind > 0) {
                    await this.notifyOwner(commitsBehind, summary, config.owner_id_override);
                    await updateNotifierModel.updateLastNotificationTime();
                } else {
                    console.log('[UpdateNotifier] No new commits. Skipping notification.');
                }
            } else {
                console.log('[UpdateNotifier] Bot is up to date with the latest Docker image.');
            }
        } catch (error) {
            console.error('[UpdateNotifier] Error during update check:', error);
        } finally {
            this.isCheckingForUpdates = false;
        }
    }
    
    /**
     * Get the current Docker image digest
     * @returns {Promise<string|null>} Current digest or null if not found
     */
    async getCurrentDigest() {
        const digest = process.env.DOCKER_IMAGE_DIGEST;
        if (digest) {
            return digest;
        }
        
        console.log('[UpdateNotifier] Environment variable DOCKER_IMAGE_DIGEST not set. Falling back to commit SHA.');
        
        const commitSha = process.env.GIT_COMMIT_SHA;
        if (commitSha) {
            return commitSha;
        }
        
        console.log('[UpdateNotifier] GIT_COMMIT_SHA also not set. Cannot determine current version.');
        return null;
    }
    
    /**
     * Get the latest Docker image digest from Docker Hub
     * @returns {Promise<string|null>} Latest digest or null if not found
     */
    async getLatestDigest() {
        try {
            const repo = "karutoil/deepquasar-multifunctionalbot";
            const tag = "latest";
            const url = `https://registry.hub.docker.com/v2/repositories/${repo}/tags/${tag}`;
            
            const response = await fetch(url);
            if (!response.ok) {
                console.log(`[UpdateNotifier] Failed to fetch Docker Hub tag info: ${response.status}`);
                return null;
            }
            
            const data = await response.json();
            const images = data.images || [];
            
            if (!images.length) {
                console.log('[UpdateNotifier] No images found for tag.');
                return null;
            }
            
            const digest = images[0].digest;
            if (!digest) {
                console.log('[UpdateNotifier] Digest not found in tag info.');
                return null;
            }
            
            return digest;
        } catch (error) {
            console.error('[UpdateNotifier] Error fetching latest digest:', error);
            return null;
        }
    }
    
    /**
     * Get commit summary between current and latest versions
     * @param {string} currentDigest - Current digest/SHA
     * @param {string} latestDigest - Latest digest/SHA
     * @param {string|null} githubToken - GitHub API token
     * @returns {Promise<Object>} Object with summary and commitsBehind
     */
    async getCommitSummary(currentDigest, latestDigest, githubToken = null) {
        try {
            // GitHub repo info
            const owner = "karutoil";
            const repo = "DeepQuasar-MultifunctionalBot";
            
            // Headers for GitHub API
            const headers = {};
            if (githubToken) {
                headers.Authorization = `token ${githubToken}`;
            }
            
            // Get latest commit SHA
            const branchUrl = `https://api.github.com/repos/${owner}/${repo}/branches/main`;
            const branchResponse = await fetch(branchUrl, { headers });
            
            if (!branchResponse.ok) {
                console.log(`[UpdateNotifier] Failed to fetch latest commit SHA: ${branchResponse.status}`);
                return { summary: "Could not fetch commit info.", commitsBehind: 0 };
            }
            
            const branchData = await branchResponse.json();
            const latestSha = branchData.commit?.sha;
            
            if (!latestSha) {
                console.log('[UpdateNotifier] Latest commit SHA not found in branch info.');
                return { summary: "Could not fetch commit info.", commitsBehind: 0 };
            }
            
            // Compare commits
            const compareUrl = `https://api.github.com/repos/${owner}/${repo}/compare/${currentDigest}...${latestSha}`;
            const compareResponse = await fetch(compareUrl, { headers });
            
            if (!compareResponse.ok) {
                console.log(`[UpdateNotifier] Failed to fetch commit comparison: ${compareResponse.status}`);
                return { summary: "Could not fetch commit info.", commitsBehind: 0 };
            }
            
            const compareData = await compareResponse.json();
            const commits = compareData.commits || [];
            const commitsBehind = commits.length;
            
            if (commitsBehind === 0) {
                return { summary: "Up to date.", commitsBehind: 0 };
            }
            
            // Format commit summary
            const summaryLines = ["Latest commits:"];
            const recentCommits = commits.slice(-5); // Last 5 commits only
            
            for (const commit of recentCommits) {
                const shaShort = commit.sha.substring(0, 7);
                const message = commit.commit.message.split('\n')[0];
                const author = commit.commit.author.name || "Unknown";
                summaryLines.push(`- \`${shaShort}\` by **${author}**: ${message}`);
            }
            
            return {
                summary: summaryLines.join('\n'),
                commitsBehind
            };
        } catch (error) {
            console.error('[UpdateNotifier] Error fetching commit summary:', error);
            return { summary: "Could not fetch commit info.", commitsBehind: 0 };
        }
    }
    
    /**
     * Notify the bot owner about available updates
     * @param {number} commitsBehind - Number of commits behind
     * @param {string} commitSummary - Formatted commit summary
     * @param {string|null} ownerIdOverride - User ID to notify instead of app owner
     */
    async notifyOwner(commitsBehind, commitSummary, ownerIdOverride = null) {
        try {
            let owner;
            
            if (ownerIdOverride) {
                try {
                    owner = await this.client.users.fetch(ownerIdOverride);
                } catch (error) {
                    console.error(`[UpdateNotifier] Failed to fetch override owner with ID ${ownerIdOverride}:`, error);
                }
            }
            
            if (!owner) {
                const appInfo = await this.client.application.fetch();
                owner = appInfo.owner;
            }
            
            if (!owner) {
                console.log('[UpdateNotifier] Bot owner not found.');
                return;
            }
            
            const updateCommand = this.getUpdateCommand();
            
            const message = (
                `🔔 **Update Available!**\n` +
                `You are **${commitsBehind}** commits behind the latest Docker image.\n\n` +
                `${commitSummary}\n` +
                `**To update your bot, run:**\n` +
                `\`\`\`bash\n${updateCommand}\n\`\`\``
            );
            
            await owner.send(message);
            console.log(`[UpdateNotifier] Sent update notification to owner: ${owner.tag}`);
        } catch (error) {
            console.error('[UpdateNotifier] Failed to notify owner:', error);
        }
    }
    
    /**
     * Get the appropriate update command based on the OS
     * @returns {string} Update command
     */
    getUpdateCommand() {
        const platform = os.platform();
        
        if (platform === 'win32') {
            return 'docker pull karutoil/deepquasar-multifunctionalbot:latest && docker-compose down && docker-compose up -d';
        } else {
            // Linux/macOS
            return 'docker pull karutoil/deepquasar-multifunctionalbot:latest && docker-compose down && docker-compose up -d';
        }
    }
}

module.exports = UpdateNotifierService;