/**
 * Authentication Middleware
 * Validates JWT tokens and attaches user to request
 * SENIOR FIX: Added role validation and debug logging
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const authMiddleware = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided',
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Validate required fields in token
        if (!decoded.id || !decoded.role || !decoded.email) {
            logger.error('Invalid token payload:', { decoded });
            return res.status(401).json({
                success: false,
                message: 'Invalid token payload',
            });
        }

        // Validate role is a valid enum value
        const validRoles = ['user', 'admin', 'super-admin'];
        if (!validRoles.includes(decoded.role)) {
            logger.error(`Invalid role in token: ${decoded.role}`);
            return res.status(401).json({
                success: false,
                message: 'Invalid user role',
            });
        }

        req.user = decoded;
        logger.debug(`Auth middleware verified user: ${decoded.id} with role: ${decoded.role}`);
        next();
    } catch (error) {
        logger.error(`Auth middleware error: ${error.message}`);
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token',
            error: error.message,
        });
    }
};

module.exports = authMiddleware;
