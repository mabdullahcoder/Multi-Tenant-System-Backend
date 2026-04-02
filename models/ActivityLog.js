/**
 * Activity Log Model
 * Tracks user activities like login, logout, orders, profile changes
 */

const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        action: {
            type: String,
            required: true,
            enum: [
                'login',
                'logout',
                'register',
                'password_change',
                'profile_update',
                'order_created',
                'order_cancelled',
                'order_status_changed',
                'report_generated',
                'report_downloaded',
                'profile_picture_updated',
                'account_status_changed',
            ],
        },
        actionDescription: {
            type: String,
            trim: true,
        },
        ipAddress: {
            type: String,
            trim: true,
        },
        device: {
            type: String,
            trim: true,
        },
        userAgent: {
            type: String,
            trim: true,
        },
        resourceId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
            // Can reference Order, Report, or other resources
        },
        resourceType: {
            type: String,
            enum: ['Order', 'Report', 'User', 'Profile'],
        },
        status: {
            type: String,
            enum: ['success', 'failed'],
            default: 'success',
        },
        statusCode: {
            type: Number,
            default: 200,
        },
        location: {
            latitude: Number,
            longitude: Number,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for faster queries
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ action: 1 });
activityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
