const express = require('express');
const router = express.Router();
const githubController = require('../controllers/github.controller');
const { authenticateToken } = require('../auth/authToken');

// Initiate OAuth flow
router.get('/auth/initiate', authenticateToken, githubController.initiateGitHubAuth);

// OAuth callback (no auth required as this comes from GitHub)
router.get('/auth/callback', githubController.handleGitHubCallback);

// Get connection status
router.get('/status', authenticateToken, githubController.getGitHubStatus);

// Accept terms
router.post('/terms/accept', authenticateToken, githubController.acceptTerms);

// Get user's repositories
router.get('/repositories', authenticateToken, githubController.getRepositories);

// Get repository branches
router.get('/repositories/:owner/:repo/branches', authenticateToken, githubController.getRepositoryBranches);

// Get connected repositories with indexing status
router.get('/repositories/connected', authenticateToken, githubController.getConnectedRepositories);

// Select repository for RAG queries
router.post('/repositories/select', authenticateToken, githubController.selectRepository);

// Connect repository
router.post('/repositories/connect', authenticateToken, githubController.connectRepository);

// Disconnect repository
router.delete('/repositories/:repositoryId', authenticateToken, githubController.disconnectRepository);

// Disconnect GitHub integration
router.delete('/disconnect', authenticateToken, githubController.disconnectGitHub);

module.exports = router;
