const mongoose = require('mongoose');

const GitHubIntegrationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    githubId: {
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String,
        required: true
    },
    email: String,
    name: String,
    avatarUrl: String,
    profileUrl: String,
    
    // Encrypted access token
    accessToken: {
        encrypted: String,
        iv: String,
        authTag: String
    },
    
    // Token metadata
    tokenScope: String,
    tokenType: String,
    
    // Terms acceptance
    termsAccepted: {
        type: Boolean,
        default: false
    },
    termsAcceptedAt: Date,
    
    // Connected repositories
    connectedRepositories: [{
        repositoryId: String,
        name: String,
        fullName: String,
        branch: String,
        webhookId: String,
        webhookSecret: String,
        ragRepositoryId: String, // Reference to RAG API repository
        connectedAt: Date,
        lastSyncAt: Date
    }],
    
    // Selected repository for RAG queries
    selectedRepository: {
        repositoryId: String,
        name: String,
        fullName: String,
        branch: String,
        ragRepositoryId: String
    },
    
    // Integration status
    active: {
        type: Boolean,
        default: true
    },
    lastUsedAt: Date,
    
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update timestamp on save
GitHubIntegrationSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Index for faster lookups
GitHubIntegrationSchema.index({ userId: 1 });
// githubId already has unique index from schema definition
GitHubIntegrationSchema.index({ 'connectedRepositories.repositoryId': 1 });

module.exports = mongoose.model('GitHubIntegration', GitHubIntegrationSchema);
