const GitHubOAuthService = require('../services/github-oauth.service');
const GitHubIntegration = require('../models/githubIntegration.model');
const axios = require('axios');

const RAG_API_URL = process.env.RAG_API_URL || 'http://localhost:8001';

// Temporary in-memory store for OAuth state (use Redis in production)
const oauthStateStore = new Map();

// Clean up old states every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [state, data] of oauthStateStore.entries()) {
        if (now - data.timestamp > 10 * 60 * 1000) { // 10 minutes
            oauthStateStore.delete(state);
        }
    }
}, 10 * 60 * 1000);

/**
 * Initiate GitHub OAuth flow
 */
exports.initiateGitHubAuth = async (req, res) => {
    try {
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // Generate state for CSRF protection
        const state = GitHubOAuthService.generateState();
        
        // Store state and userId in memory (works better with popups than sessions)
        oauthStateStore.set(state, {
            userId: userId,
            timestamp: Date.now()
        });

        // Get authorization URL
        const authUrl = GitHubOAuthService.getAuthorizationUrl(state);

        res.json({
            success: true,
            authUrl: authUrl,
            state: state // Return state to frontend for debugging
        });
    } catch (error) {
        console.error('Error initiating GitHub auth:', error);
        res.status(500).json({
            error: 'Failed to initiate GitHub authentication',
            message: error.message
        });
    }
};

/**
 * Handle GitHub OAuth callback
 */
exports.handleGitHubCallback = async (req, res) => {
    try {
        const { code, state, error, error_description } = req.query;

        // Check if GitHub returned an error
        if (error) {
            console.error('GitHub OAuth error:', error, error_description);
            const errorUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/github/callback?github_error=true&error_description=${encodeURIComponent(error_description || error)}`;
            return res.redirect(errorUrl);
        }

        // Verify required parameters
        if (!code) {
            console.error('Missing authorization code in callback');
            const errorUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/github/callback?github_error=true&error_description=missing_code`;
            return res.redirect(errorUrl);
        }

        // Verify state to prevent CSRF
        if (!state) {
            console.error('Missing state parameter');
            const errorUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/github/callback?github_error=true&error_description=missing_state`;
            return res.redirect(errorUrl);
        }

        // Get stored state data
        const stateData = oauthStateStore.get(state);
        
        if (!stateData) {
            console.error('Invalid or expired state parameter. State:', state);
            console.log('Available states:', Array.from(oauthStateStore.keys()));
            const errorUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/github/callback?github_error=true&error_description=invalid_or_expired_state`;
            return res.redirect(errorUrl);
        }

        // Remove state after validation (one-time use)
        oauthStateStore.delete(state);
        
        const userId = stateData.userId;
        if (!userId) {
            console.error('User ID not found in state data');
            const errorUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/github/callback?github_error=true&error_description=user_session_not_found`;
            return res.redirect(errorUrl);
        }

        console.log('Exchanging GitHub authorization code for access token...');
        
        // Exchange code for access token
        const tokenData = await GitHubOAuthService.getAccessToken(code);

        // Get user information from GitHub
        const githubUser = await GitHubOAuthService.getUser(tokenData.accessToken);

        // Encrypt access token
        const encryptedToken = GitHubOAuthService.encryptToken(tokenData.accessToken);

        // Save or update GitHub integration
        let integration = await GitHubIntegration.findOne({ userId: userId });

        if (integration) {
            // Update existing integration
            integration.githubId = githubUser.githubId;
            integration.username = githubUser.username;
            integration.email = githubUser.email;
            integration.name = githubUser.name;
            integration.avatarUrl = githubUser.avatarUrl;
            integration.profileUrl = githubUser.profileUrl;
            integration.accessToken = encryptedToken;
            integration.tokenScope = tokenData.scope;
            integration.tokenType = tokenData.tokenType;
            integration.active = true;
            integration.lastUsedAt = new Date();
        } else {
            // Create new integration
            integration = new GitHubIntegration({
                userId: userId,
                githubId: githubUser.githubId,
                username: githubUser.username,
                email: githubUser.email,
                name: githubUser.name,
                avatarUrl: githubUser.avatarUrl,
                profileUrl: githubUser.profileUrl,
                accessToken: encryptedToken,
                tokenScope: tokenData.scope,
                tokenType: tokenData.tokenType,
                lastUsedAt: new Date()
            });
        }

        await integration.save();

        // Clear session state
        delete req.session.githubOAuthState;

        // Redirect to frontend GitHub callback page with success indicator
        const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/github/callback?github_auth=success`;
        res.redirect(redirectUrl);

    } catch (error) {
        console.error('Error handling GitHub callback:', error);
        const errorUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/github/callback?github_error=true&error_description=${encodeURIComponent(error.message)}`;
        res.redirect(errorUrl);
    }
};

/**
 * Get GitHub connection status
 */
exports.getGitHubStatus = async (req, res) => {
    try {
        const userId = req.user?.id;

        const integration = await GitHubIntegration.findOne({
            userId: userId,
            active: true
        });

        if (!integration) {
            return res.json({
                connected: false
            });
        }

        res.json({
            connected: true,
            username: integration.username,
            avatarUrl: integration.avatarUrl,
            termsAccepted: integration.termsAccepted,
            connectedRepositories: integration.connectedRepositories.length
        });
    } catch (error) {
        console.error('Error getting GitHub status:', error);
        res.status(500).json({
            error: 'Failed to get GitHub status',
            message: error.message
        });
    }
};

/**
 * Accept terms and conditions
 */
exports.acceptTerms = async (req, res) => {
    try {
        const userId = req.user?.id;

        const integration = await GitHubIntegration.findOne({
            userId: userId,
            active: true
        });

        if (!integration) {
            return res.status(404).json({ error: 'GitHub integration not found' });
        }

        integration.termsAccepted = true;
        integration.termsAcceptedAt = new Date();
        await integration.save();

        res.json({
            success: true,
            message: 'Terms accepted successfully'
        });
    } catch (error) {
        console.error('Error accepting terms:', error);
        res.status(500).json({
            error: 'Failed to accept terms',
            message: error.message
        });
    }
};

/**
 * Get user's GitHub repositories
 */
exports.getRepositories = async (req, res) => {
    try {
        const userId = req.user?.id;

        const integration = await GitHubIntegration.findOne({
            userId: userId,
            active: true
        });

        if (!integration) {
            return res.status(404).json({ error: 'GitHub not connected' });
        }

        if (!integration.termsAccepted) {
            return res.status(403).json({ error: 'Terms not accepted' });
        }

        // Decrypt access token
        const accessToken = GitHubOAuthService.decryptToken(integration.accessToken);

        // Get repositories from GitHub
        const repositories = await GitHubOAuthService.getUserRepositories(accessToken);

        // Mark already connected repositories
        const connectedRepoIds = integration.connectedRepositories.map(r => r.repositoryId);
        const reposWithStatus = repositories.map(repo => ({
            ...repo,
            connected: connectedRepoIds.includes(repo.id.toString())
        }));

        res.json({
            success: true,
            repositories: reposWithStatus
        });
    } catch (error) {
        console.error('Error getting repositories:', error);
        res.status(500).json({
            error: 'Failed to get repositories',
            message: error.message
        });
    }
};

/**
 * Get repository branches
 */
exports.getRepositoryBranches = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { owner, repo } = req.params;

        const integration = await GitHubIntegration.findOne({
            userId: userId,
            active: true
        });

        if (!integration) {
            return res.status(404).json({ error: 'GitHub not connected' });
        }

        // Decrypt access token
        const accessToken = GitHubOAuthService.decryptToken(integration.accessToken);

        // Get branches from GitHub
        const branches = await GitHubOAuthService.getRepositoryBranches(accessToken, owner, repo);

        res.json({
            success: true,
            branches: branches
        });
    } catch (error) {
        console.error('Error getting branches:', error);
        res.status(500).json({
            error: 'Failed to get branches',
            message: error.message
        });
    }
};

/**
 * Connect a repository for RAG indexing
 */
exports.connectRepository = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { repositoryId, name, fullName, branch, cloneUrl } = req.body;

        console.log('Connect repository request:', { userId, repositoryId, name, fullName, branch, cloneUrl });

        const integration = await GitHubIntegration.findOne({
            userId: userId,
            active: true
        });

        if (!integration) {
            console.error('GitHub integration not found for user:', userId);
            return res.status(404).json({ error: 'GitHub not connected' });
        }

        if (!integration.termsAccepted) {
            console.error('Terms not accepted for user:', userId);
            return res.status(403).json({ error: 'Terms not accepted' });
        }

        // Check if already connected
        const existingRepo = integration.connectedRepositories.find(
            r => r.repositoryId === repositoryId.toString()
        );

        if (existingRepo) {
            console.error('Repository already connected:', repositoryId);
            return res.status(400).json({ error: 'Repository already connected' });
        }

        console.log('Creating repository in RAG API...');
        
        // Decrypt access token
        const accessToken = GitHubOAuthService.decryptToken(integration.accessToken);

        // Generate webhook secret (we store and pass to RAG before creating the GitHub webhook)
        const webhookSecret = GitHubOAuthService.generateWebhookSecret();

        // Create repository in RAG API and pass webhook secret so RAG can verify incoming webhooks
        const ragResponse = await axios.post(`${RAG_API_URL}/api/repositories`, {
            user_id: userId,
            name: name,
            full_name: fullName,
            clone_url: cloneUrl || `https://github.com/${fullName}.git`,
            default_branch: branch,
            branch: branch,  // Selected branch
            provider: 'github',
            github_access_token: accessToken,
            webhook_secret: webhookSecret
        });

        const ragRepository = ragResponse.data;
        console.log('Repository created in RAG API:', ragRepository.id);

        // Create webhook (use Smee URL if in development)
        const webhookUrl = process.env.USE_WEBHOOK_PROXY === 'true'
            ? process.env.WEBHOOK_PROXY_URL
            : `${RAG_API_URL}/webhooks/github`;

        console.log('Creating webhook on GitHub...', { webhookUrl });
        
        const [owner, repoName] = fullName.split('/');
        const webhook = await GitHubOAuthService.createWebhook(
            accessToken,
            owner,
            repoName,
            webhookUrl,
            webhookSecret
        );

        console.log('Webhook created successfully:', webhook);

        // Determine webhook id (createWebhook may return { exists: true } with id info)
        const webhookId = webhook && webhook.id ? webhook.id : (webhook && webhook.hook_id ? webhook.hook_id : null);

        // Add to connected repositories
        integration.connectedRepositories.push({
            repositoryId: repositoryId.toString(),
            name: name,
            fullName: fullName,
            branch: branch,
            webhookId: webhookId,
            webhookSecret: webhookSecret,
            ragRepositoryId: ragRepository.id,
            connectedAt: new Date()
        });

        // Auto-select this repository if it's the first one
        if (!integration.selectedRepository && integration.connectedRepositories.length === 1) {
            integration.selectedRepository = {
                repositoryId: repositoryId.toString(),
                name: name,
                fullName: fullName,
                branch: branch,
                ragRepositoryId: ragRepository.id
            };
        }

        await integration.save();

        console.log('Repository connected successfully:', { repositoryId, name, branch });

        res.json({
            success: true,
            repository: ragRepository,
            message: 'Repository connected successfully'
        });
    } catch (error) {
        console.error('Error connecting repository:', error);
        console.error('Error details:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Failed to connect repository',
            message: error.response?.data?.message || error.message
        });
    }
};

/**
 * Disconnect a repository
 */
exports.disconnectRepository = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { repositoryId } = req.params;

        const integration = await GitHubIntegration.findOne({
            userId: userId,
            active: true
        });

        if (!integration) {
            return res.status(404).json({ error: 'GitHub not connected' });
        }

        const repoIndex = integration.connectedRepositories.findIndex(
            r => r.repositoryId === repositoryId
        );

        if (repoIndex === -1) {
            return res.status(404).json({ error: 'Repository not found' });
        }

        const repo = integration.connectedRepositories[repoIndex];

        // Decrypt access token
        const accessToken = GitHubOAuthService.decryptToken(integration.accessToken);

        // Delete webhook from GitHub
        const [owner, repoName] = repo.fullName.split('/');
        try {
            await GitHubOAuthService.deleteWebhook(accessToken, owner, repoName, repo.webhookId);
        } catch (error) {
            console.error('Error deleting webhook:', error);
            // Continue even if webhook deletion fails
        }

        // Delete repository from RAG API
        try {
            await axios.delete(`${RAG_API_URL}/api/repositories/${repo.ragRepositoryId}`);
        } catch (error) {
            console.error('Error deleting RAG repository:', error);
        }

        // Remove from connected repositories
        integration.connectedRepositories.splice(repoIndex, 1);
        await integration.save();

        res.json({
            success: true,
            message: 'Repository disconnected successfully'
        });
    } catch (error) {
        console.error('Error disconnecting repository:', error);
        res.status(500).json({
            error: 'Failed to disconnect repository',
            message: error.message
        });
    }
};

/**
 * Disconnect GitHub integration
 */
exports.disconnectGitHub = async (req, res) => {
    try {
        const userId = req.user?.id;

        const integration = await GitHubIntegration.findOne({
            userId: userId,
            active: true
        });

        if (!integration) {
            return res.status(404).json({ error: 'GitHub not connected' });
        }

        // Attempt to remove any created webhooks and RAG repositories for connected repositories
        const accessToken = GitHubOAuthService.decryptToken(integration.accessToken);

        for (const repo of integration.connectedRepositories || []) {
            try {
                const [owner, repoName] = repo.fullName.split('/');
                if (repo.webhookId) {
                    await GitHubOAuthService.deleteWebhook(accessToken, owner, repoName, repo.webhookId);
                }
            } catch (err) {
                console.error(`Error deleting webhook for ${repo.fullName}:`, err.message);
                // continue
            }

            try {
                if (repo.ragRepositoryId) {
                    await axios.delete(`${RAG_API_URL}/api/repositories/${repo.ragRepositoryId}`, {
                        params: { user_id: userId }
                    });
                }
            } catch (err) {
                console.error(`Error deleting RAG repository for ${repo.fullName}:`, err.message);
            }
        }

        // Clear connected repositories and mark integration inactive (for audit trail)
        integration.connectedRepositories = [];
        integration.active = false;
        await integration.save();

        res.json({
            success: true,
            message: 'GitHub disconnected successfully and webhooks removed'
        });
    } catch (error) {
        console.error('Error disconnecting GitHub:', error);
        res.status(500).json({
            error: 'Failed to disconnect GitHub',
            message: error.message
        });
    }
};

/**
 * Get connected repositories
 */
exports.getConnectedRepositories = async (req, res) => {
    try {
        const userId = req.user?.id;

        const integration = await GitHubIntegration.findOne({
            userId: userId,
            active: true
        });

        if (!integration) {
            return res.status(404).json({ error: 'GitHub not connected' });
        }

        // Get indexing status from RAG API for each repository
        const repositoriesWithStatus = await Promise.all(
            integration.connectedRepositories.map(async (repo) => {
                try {
                    const response = await axios.get(
                        `${RAG_API_URL}/api/repositories/${repo.ragRepositoryId}/status`,
                        { params: { user_id: userId } }
                    );
                    return {
                        ...repo.toObject(),
                        indexingStatus: response.data.indexing_status,
                        totalFiles: response.data.total_files,
                        indexedFiles: response.data.indexed_files,
                        progress: response.data.total_files > 0 
                            ? Math.round((response.data.indexed_files / response.data.total_files) * 100)
                            : 0
                    };
                } catch (error) {
                    console.error(`Error getting status for ${repo.ragRepositoryId}:`, error.message);
                    return {
                        ...repo.toObject(),
                        indexingStatus: 'UNKNOWN',
                        totalFiles: 0,
                        indexedFiles: 0,
                        progress: 0
                    };
                }
            })
        );

        res.json({
            success: true,
            repositories: repositoriesWithStatus,
            selectedRepository: integration.selectedRepository || null
        });
    } catch (error) {
        console.error('Error getting connected repositories:', error);
        res.status(500).json({
            error: 'Failed to get connected repositories',
            message: error.message
        });
    }
};

/**
 * Select a repository for RAG queries
 */
exports.selectRepository = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { repositoryId } = req.body;

        const integration = await GitHubIntegration.findOne({
            userId: userId,
            active: true
        });

        if (!integration) {
            return res.status(404).json({ error: 'GitHub not connected' });
        }

        // Verify the repository is connected
        const repo = integration.connectedRepositories.find(
            r => r.repositoryId === repositoryId.toString()
        );

        if (!repo) {
            return res.status(404).json({ error: 'Repository not found in connected repositories' });
        }

        // Update selected repository
        integration.selectedRepository = {
            repositoryId: repo.repositoryId,
            name: repo.name,
            fullName: repo.fullName,
            branch: repo.branch,
            ragRepositoryId: repo.ragRepositoryId
        };
        await integration.save();

        res.json({
            success: true,
            selectedRepository: integration.selectedRepository,
            message: `Selected repository: ${repo.fullName}`
        });
    } catch (error) {
        console.error('Error selecting repository:', error);
        res.status(500).json({
            error: 'Failed to select repository',
            message: error.message
        });
    }
};
