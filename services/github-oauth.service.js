const axios = require('axios');
const crypto = require('crypto');

/**
 * GitHub OAuth Service
 * Handles GitHub OAuth authentication flow
 */
class GitHubOAuthService {
    constructor() {
        this.clientId = process.env.GITHUB_CLIENT_ID;
        this.clientSecret = process.env.GITHUB_CLIENT_SECRET;
        this.callbackUrl = process.env.GITHUB_CALLBACK_URL || 'http://localhost:4000/auth/github/callback';
        this.scope = 'repo,user:email,read:org';
    }

    /**
     * Generate OAuth authorization URL
     */
    getAuthorizationUrl(state) {
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.callbackUrl,
            scope: this.scope,
            state: state,
            allow_signup: 'true'
        });

        return `https://github.com/login/oauth/authorize?${params.toString()}`;
    }

    /**
     * Exchange code for access token
     */
    async getAccessToken(code) {
        try {
            console.log('Exchanging code for token with GitHub...');
            console.log('Client ID:', this.clientId);
            console.log('Callback URL:', this.callbackUrl);
            
            const response = await axios.post(
                'https://github.com/login/oauth/access_token',
                {
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    code: code,
                    redirect_uri: this.callbackUrl
                },
                {
                    headers: {
                        Accept: 'application/json'
                    }
                }
            );

            if (response.data.error) {
                console.error('GitHub OAuth error response:', response.data);
                throw new Error(response.data.error_description || response.data.error);
            }

            console.log('Successfully obtained access token from GitHub');
            
            return {
                accessToken: response.data.access_token,
                scope: response.data.scope,
                tokenType: response.data.token_type
            };
        } catch (error) {
            console.error('Error getting access token from GitHub:', error.message);
            if (error.response) {
                console.error('GitHub API response status:', error.response.status);
                console.error('GitHub API response data:', error.response.data);
            }
            throw error;
        }
    }

    /**
     * Get authenticated user information
     */
    async getUser(accessToken) {
        try {
            const response = await axios.get('https://api.github.com/user', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/vnd.github.v3+json'
                }
            });

            return {
                githubId: response.data.id,
                username: response.data.login,
                email: response.data.email,
                name: response.data.name,
                avatarUrl: response.data.avatar_url,
                profileUrl: response.data.html_url
            };
        } catch (error) {
            console.error('Error getting user:', error.message);
            throw error;
        }
    }

    /**
     * Get user's repositories
     */
    async getUserRepositories(accessToken, page = 1, perPage = 100) {
        try {
            const response = await axios.get('https://api.github.com/user/repos', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/vnd.github.v3+json'
                },
                params: {
                    page: page,
                    per_page: perPage,
                    sort: 'updated',
                    affiliation: 'owner,collaborator,organization_member'
                }
            });

            return response.data.map(repo => ({
                id: repo.id,
                name: repo.name,
                fullName: repo.full_name,
                description: repo.description,
                private: repo.private,
                cloneUrl: repo.clone_url,
                htmlUrl: repo.html_url,
                defaultBranch: repo.default_branch,
                language: repo.language,
                updatedAt: repo.updated_at,
                size: repo.size,
                stargazersCount: repo.stargazers_count
            }));
        } catch (error) {
            console.error('Error getting repositories:', error.message);
            throw error;
        }
    }

    /**
     * Get repository branches
     */
    async getRepositoryBranches(accessToken, owner, repo) {
        try {
            const response = await axios.get(
                `https://api.github.com/repos/${owner}/${repo}/branches`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        Accept: 'application/vnd.github.v3+json'
                    }
                }
            );

            return response.data.map(branch => ({
                name: branch.name,
                protected: branch.protected,
                commit: {
                    sha: branch.commit.sha,
                    url: branch.commit.url
                }
            }));
        } catch (error) {
            console.error('Error getting branches:', error.message);
            throw error;
        }
    }

    /**
     * Create webhook for repository
     */
    async createWebhook(accessToken, owner, repo, webhookUrl, secret) {
        try {
            const response = await axios.post(
                `https://api.github.com/repos/${owner}/${repo}/hooks`,
                {
                    name: 'web',
                    active: true,
                    events: ['push', 'pull_request'],
                    config: {
                        url: webhookUrl,
                        content_type: 'json',
                        secret: secret,
                        insecure_ssl: process.env.NODE_ENV === 'development' ? '1' : '0'
                    }
                },
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        Accept: 'application/vnd.github.v3+json'
                    }
                }
            );

            return {
                id: response.data.id,
                url: response.data.url,
                active: response.data.active,
                events: response.data.events
            };
        } catch (error) {
            if (error.response?.status === 422) {
                // Webhook already exists - attempt to find existing hook by URL
                try {
                    const listResp = await axios.get(
                        `https://api.github.com/repos/${owner}/${repo}/hooks`,
                        {
                            headers: {
                                Authorization: `Bearer ${accessToken}`,
                                Accept: 'application/vnd.github.v3+json'
                            }
                        }
                    );

                    const existing = listResp.data.find(h => h.config && h.config.url === webhookUrl);
                    if (existing) {
                        return {
                            id: existing.id,
                            url: existing.url,
                            active: existing.active,
                            events: existing.events,
                            exists: true
                        };
                    }
                    // If we didn't find it, return generic exists flag
                    console.log('Webhook already exists but was not found by URL');
                    return { exists: true };
                } catch (listError) {
                    console.error('Error listing webhooks after 422:', listError.message);
                    return { exists: true };
                }
            }
            console.error('Error creating webhook:', error.message);
            throw error;
        }
    }

    /**
     * Delete webhook
     */
    async deleteWebhook(accessToken, owner, repo, hookId) {
        try {
            await axios.delete(
                `https://api.github.com/repos/${owner}/${repo}/hooks/${hookId}`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        Accept: 'application/vnd.github.v3+json'
                    }
                }
            );
            return true;
        } catch (error) {
            console.error('Error deleting webhook:', error.message);
            throw error;
        }
    }

    /**
     * Encrypt access token for storage
     */
    encryptToken(token) {
        const algorithm = 'aes-256-gcm';
        const key = crypto.scryptSync(process.env.SECRET_KEY || 'default-secret', 'salt', 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);

        let encrypted = cipher.update(token, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        return {
            encrypted: encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        };
    }

    /**
     * Decrypt access token
     */
    decryptToken(encryptedData) {
        const algorithm = 'aes-256-gcm';
        const key = crypto.scryptSync(process.env.SECRET_KEY || 'default-secret', 'salt', 32);
        const decipher = crypto.createDecipheriv(
            algorithm,
            key,
            Buffer.from(encryptedData.iv, 'hex')
        );

        decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    /**
     * Generate random state for CSRF protection
     */
    generateState() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Generate webhook secret
     */
    generateWebhookSecret() {
        return crypto.randomBytes(32).toString('hex');
    }
}

module.exports = new GitHubOAuthService();
