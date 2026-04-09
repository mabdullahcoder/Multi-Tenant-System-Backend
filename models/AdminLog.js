/**
 * Admin Log Model
 * Tracks all admin and super-admin actions
 */

const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema(
    {
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        action: {
            type: String,
            required: true,
            enum: [
                'user_blocked',
                'user_unblocked',
                'user_created',
                'order_status_updated',
                'order_cancelled',
                'order_deleted',
                'order_bulk_status_updated',
                'order_items_appended',
                'user_viewed',
                'user_deleted',
                'admin_created',
                'admin_deleted',
                'settings_updated',
                'report_generated',
                'report_deleted',
                'system_alert_triggered',
                'menu_item_created',
                'menu_item_updated',
                'menu_item_deleted',
                'menu_category_created',
                'menu_category_updated',
                'menu_category_deleted',
            ],
        },
        actionDescription: {
            type: String,
            trim: true,
        },
        targetUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        targetResourceId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },
        resourceType: {
            type: String,
            enum: ['User', 'Order', 'Report', 'SystemSettings', 'Admin', 'MenuItem', 'MenuCategory'],
            default: null,
        },
        previousValue: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
        newValue: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
        ipAddress: {
            type: String,
            trim: true,
        },
        userAgent: {
            type: String,
            trim: true,
        },
        status: {
            type: String,
            enum: ['success', 'failed'],
            default: 'success',
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
adminLogSchema.index({ adminId: 1, createdAt: -1 });
adminLogSchema.index({ action: 1 });
adminLogSchema.index({ targetUserId: 1 });
adminLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AdminLog', adminLogSchema);
