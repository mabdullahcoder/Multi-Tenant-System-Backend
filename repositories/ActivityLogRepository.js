/**
 * ActivityLog Repository
 * Database operations for ActivityLog model
 */

const ActivityLog = require('../models/ActivityLog');

class ActivityLogRepository {
    // Create activity log
    async create(logData) {
        return await ActivityLog.create(logData);
    }

    // Get user activity logs with pagination
    async getUserActivityLogs(userId, page = 1, limit = 20) {
        const skip = (page - 1) * limit;

        const logs = await ActivityLog.find({ userId })
            .limit(limit)
            .skip(skip)
            .sort({ createdAt: -1 });

        const total = await ActivityLog.countDocuments({ userId });

        return {
            logs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }

    // Get all activity logs (for admins)
    async getAllActivityLogs(page = 1, limit = 20, filters = {}) {
        const skip = (page - 1) * limit;

        const logs = await ActivityLog.find(filters)
            .populate('userId', 'firstName lastName email')
            .limit(limit)
            .skip(skip)
            .sort({ createdAt: -1 });

        const total = await ActivityLog.countDocuments(filters);

        return {
            logs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }

    // Get activity logs by date range
    async getLogsByDateRange(startDate, endDate, filters = {}) {
        const query = {
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            },
            ...filters,
        };

        return await ActivityLog.find(query)
            .populate('userId', 'firstName lastName email')
            .sort({ createdAt: -1 });
    }

    // Get user login history
    async getUserLoginHistory(userId, limit = 10) {
        return await ActivityLog.find({
            userId,
            action: { $in: ['login', 'logout'] },
        })
            .limit(limit)
            .sort({ createdAt: -1 });
    }

    // Get specific action logs
    async getActionLogs(action, page = 1, limit = 20) {
        const skip = (page - 1) * limit;

        const logs = await ActivityLog.find({ action })
            .populate('userId', 'firstName lastName email')
            .limit(limit)
            .skip(skip)
            .sort({ createdAt: -1 });

        const total = await ActivityLog.countDocuments({ action });

        return {
            logs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }

    // Get activity statistics
    async getActivityStats() {
        return await ActivityLog.aggregate([
            {
                $facet: {
                    total: [{ $count: 'count' }],
                    byAction: [
                        {
                            $group: {
                                _id: '$action',
                                count: { $sum: 1 },
                            },
                        },
                    ],
                    successFailure: [
                        {
                            $group: {
                                _id: '$status',
                                count: { $sum: 1 },
                            },
                        },
                    ],
                    todayActivities: [
                        {
                            $match: {
                                createdAt: {
                                    $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                                },
                            },
                        },
                        { $count: 'count' },
                    ],
                },
            },
        ]);
    }

    // Cleanup old logs (older than 90 days)
    async cleanupOldLogs(daysOld = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        return await ActivityLog.deleteMany({
            createdAt: { $lt: cutoffDate },
        });
    }
}

module.exports = new ActivityLogRepository();
