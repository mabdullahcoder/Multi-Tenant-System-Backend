/**
 * Cron Jobs
 * Scheduled tasks for the application
 */

const cron = require('node-cron');
const ActivityLogRepository = require('../repositories/ActivityLogRepository');
const ReportRepository = require('../repositories/ReportRepository');
const logger = require('../utils/logger');

// Cleanup old activity logs (daily at 2 AM)
const cleanupOldLogs = cron.schedule('0 2 * * *', async () => {
    try {
        logger.info('Starting cleanup of old activity logs');
        const result = await ActivityLogRepository.cleanupOldLogs(90); // Delete logs older than 90 days
        logger.info(`Deleted ${result.deletedCount} old activity logs`);
    } catch (error) {
        logger.error('Error cleaning up old logs', error);
    }
});

// Delete expired reports (daily at 3 AM)
const deleteExpiredReports = cron.schedule('0 3 * * *', async () => {
    try {
        logger.info('Starting deletion of expired reports');
        const result = await ReportRepository.deleteExpiredReports();
        logger.info(`Deleted ${result.deletedCount} expired reports`);
    } catch (error) {
        logger.error('Error deleting expired reports', error);
    }
});

// Export cron jobs
module.exports = {
    cleanupOldLogs,
    deleteExpiredReports,
};
