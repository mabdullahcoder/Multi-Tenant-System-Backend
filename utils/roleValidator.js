/**
 * Role Validator Utility
 * SENIOR FIX: Provides role validation and verification functions
 * Ensures role consistency throughout the application
 */

const logger = require('./logger');

const VALID_ROLES = ['user', 'admin', 'super-admin'];

/**
 * Validate and get role from user object
 * @param {Object} user - User document from database
 * @param {string} context - Context for logging
 * @returns {string} - Valid role or throws error
 */
const validateUserRole = (user, context = 'unknown') => {
    if (!user) {
        logger.error(`[${context}] User object is null or undefined`);
        throw new Error('User not found');
    }

    const role = user.role || user.role === '' ? user.role : null;

    if (!role || typeof role !== 'string') {
        logger.error(`[${context}] User ${user._id} has invalid role:`, { role, type: typeof role });
        throw new Error('User role is invalid or missing');
    }

    if (!VALID_ROLES.includes(role)) {
        logger.error(`[${context}] User ${user._id} has unauthorized role: ${role}`);
        throw new Error(`Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(', ')}`);
    }

    return role;
};

/**
 * Validate JWT token payload has required role fields
 * @param {Object} decoded - Decoded JWT payload
 * @returns {string} - Valid role
 */
const validateTokenRole = (decoded) => {
    if (!decoded || !decoded.role) {
        logger.error('Token payload missing role:', { decoded });
        throw new Error('Token does not contain valid role');
    }

    if (!VALID_ROLES.includes(decoded.role)) {
        logger.error(`Token has invalid role: ${decoded.role}`);
        throw new Error(`Invalid role in token: ${decoded.role}`);
    }

    return decoded.role;
};

/**
 * Check if role has authorization for action
 * @param {string} userRole - User's role
 * @param {string[]} allowedRoles - Array of allowed roles
 * @returns {boolean}
 */
const hasRole = (userRole, allowedRoles = []) => {
    if (!Array.isArray(allowedRoles)) {
        logger.error('allowedRoles must be an array');
        return false;
    }

    return allowedRoles.includes(userRole);
};

/**
 * Safe role extraction with logging
 * @param {Object} req - Express request object
 * @param {string} context - Context for logging
 * @returns {string} - Valid role
 */
const extractRoleFromRequest = (req, context = 'unknown') => {
    try {
        if (!req.user) {
            logger.error(`[${context}] Request has no authenticated user`);
            throw new Error('User not authenticated');
        }

        return validateTokenRole(req.user);
    } catch (error) {
        logger.error(`[${context}] Error extracting role:`, error.message);
        throw error;
    }
};

module.exports = {
    VALID_ROLES,
    validateUserRole,
    validateTokenRole,
    hasRole,
    extractRoleFromRequest,
};
