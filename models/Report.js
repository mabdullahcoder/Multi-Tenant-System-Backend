/**
 * Report Model
 * Manages generated reports for users and admins
 */

const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        reportType: {
            type: String,
            enum: ['orders_report', 'user_activity_report', 'sales_report', 'custom_report'],
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        format: {
            type: String,
            enum: ['pdf', 'csv'],
            required: true,
        },
        dateRange: {
            startDate: Date,
            endDate: Date,
        },
        filters: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        filePath: {
            type: String,
            default: null,
        },
        fileSize: {
            type: Number,
            default: 0,
        },
        status: {
            type: String,
            enum: ['generating', 'completed', 'failed'],
            default: 'generating',
        },
        downloadCount: {
            type: Number,
            default: 0,
        },
        generatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        metadata: {
            totalRecords: Number,
            totalValue: Number,
            generationTime: Number, // in milliseconds
        },
        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
    },
    {
        timestamps: true,
    }
);

// Index for faster queries
reportSchema.index({ userId: 1, createdAt: -1 });
reportSchema.index({ reportType: 1 });
reportSchema.index({ status: 1 });

module.exports = mongoose.model('Report', reportSchema);
