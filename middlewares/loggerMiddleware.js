/**
 * Activity Logging Middleware
 * Logs user activities with IP, device, and user agent information
 */

const ActivityLog = require('../models/ActivityLog');
const AdminLog = require('../models/AdminLog');
const logger = require('../utils/logger');

const getClientIp = (req) => {
    return (
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.socket.remoteAddress ||
        req.ip
    );
};

const getUserAgent = (req) => {
    return req.headers['user-agent'] || 'Unknown';
};

const getDeviceInfo = (req) => {
    const userAgent = req.headers['user-agent'] || '';
    if (userAgent.includes('Mobile')) return 'Mobile';
    if (userAgent.includes('Tablet')) return 'Tablet';
    return 'Desktop';
};

const logActivity = async (_req, _res, next) => {
    // Simply pass through without modifying response
    // Activity logging is now handled in individual services
    next();
};

const logAdminActivity = async (userId, action, targetUserId, resourceType, previousValue, newValue, req) => {
    try {
        await AdminLog.create({
            adminId: userId,
            action,
            targetUserId: targetUserId || null,
            resourceType,
            previousValue,
            newValue,
            ipAddress: getClientIp(req),
            userAgent: getUserAgent(req),
            status: 'success',
        });
    } catch (error) {
        logger.error('Failed to log admin activity', error);
    }
};

module.exports = {
    logActivity,
    logAdminActivity,
    getClientIp,
    getUserAgent,
    getDeviceInfo,
};
