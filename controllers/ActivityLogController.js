/**
 * Activity Log Controller
 * Handles activity log endpoints for admins
 */

const ActivityLogRepository = require('../repositories/ActivityLogRepository');
const { sendSuccess, sendError } = require('../utils/responseFormatter');

class ActivityLogController {
    // Get user activity logs
    async getUserActivityLogs(req, res, next) {
        try {
            const { userId } = req.params;
            const { page = 1, limit = 20 } = req.query;

            const result = await ActivityLogRepository.getUserActivityLogs(
                userId,
                parseInt(page),
                parseInt(limit)
            );

            sendSuccess(res, 200, 'Activity logs retrieved successfully', result.logs, result.pagination);
        } catch (error) {
            next(error);
        }
    }

    // Get all activity logs (admin only)
    async getAllActivityLogs(req, res, next) {
        try {
            const { page = 1, limit = 20, action = null, status = null } = req.query;

            const filters = {};
            if (action) filters.action = action;
            if (status) filters.status = status;

            const result = await ActivityLogRepository.getAllActivityLogs(
                parseInt(page),
                parseInt(limit),
                filters
            );

            sendSuccess(res, 200, 'Activity logs retrieved successfully', result.logs, result.pagination);
        } catch (error) {
            next(error);
        }
    }

    // Get user login history
    async getUserLoginHistory(req, res, next) {
        try {
            const { userId } = req.params;
            const { limit = 10 } = req.query;

            const logs = await ActivityLogRepository.getUserLoginHistory(userId, parseInt(limit));

            sendSuccess(res, 200, 'Login history retrieved successfully', logs);
        } catch (error) {
            next(error);
        }
    }

    // Get activity statistics (admin only)
    async getActivityStats(req, res, next) {
        try {
            const stats = await ActivityLogRepository.getActivityStats();
            sendSuccess(res, 200, 'Activity statistics retrieved', stats);
        } catch (error) {
            next(error);
        }
    }

    // Get logs by date range (admin only)
    async getLogsByDateRange(req, res, next) {
        try {
            const { startDate, endDate, action = null } = req.query;

            if (!startDate || !endDate) {
                return sendError(res, 400, 'startDate and endDate are required');
            }

            const filters = {};
            if (action) filters.action = action;

            const logs = await ActivityLogRepository.getLogsByDateRange(startDate, endDate, filters);

            sendSuccess(res, 200, 'Logs retrieved successfully', logs);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ActivityLogController();
