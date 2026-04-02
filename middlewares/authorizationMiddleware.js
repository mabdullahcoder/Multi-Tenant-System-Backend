/**
 * Authorization Middleware
 * Role-based access control
 * SENIOR FIX: Added detailed logging and validation
 */

const logger = require('../utils/logger');

const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            logger.warn('Authorization check: User not authenticated');
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }

        const userRole = req.user.role;
        const userId = req.user.id;
        const endpoint = `${req.method} ${req.path}`;

        if (!userRole) {
            logger.error(`Authorization check: User ${userId} has no role at ${endpoint}`);
            return res.status(403).json({
                success: false,
                message: 'User role not found in token',
            });
        }

        if (!allowedRoles.includes(userRole)) {
            logger.warn(
                `Authorization denied: User ${userId} with role "${userRole}" tried to access ${endpoint}. ` +
                `Required: [${allowedRoles.join(', ')}]`
            );
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role: ${allowedRoles.join(', ')}. Your role: ${userRole}`,
            });
        }

        logger.debug(`Authorization granted: User ${userId} (${userRole}) accessing ${endpoint}`);
        next();
    };
};

module.exports = authorizeRoles;
