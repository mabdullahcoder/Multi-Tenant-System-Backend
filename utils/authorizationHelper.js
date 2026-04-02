/**
 * Authorization Helper Utilities
 * Centralized authorization logic for services
 */

/**
 * Check if user can access a resource
 * @param {string} userRole - User's role (user, admin, super-admin)
 * @param {string} resourceOwnerId - ID of resource owner
 * @param {string} userId - Current user's ID
 * @returns {boolean} - Whether user has access
 */
const canAccessResource = (userRole, resourceOwnerId, userId) => {
    // Admin and Super admin can access everything
    if (['admin', 'super-admin'].includes(userRole)) {
        return true;
    }
    // Regular users can only access their own resources
    return resourceOwnerId.toString() === userId.toString();
};

/**
 * Verify admin or super admin access
 * @param {string} userRole - User's role
 * @throws {Object} - Error object if not authorized
 */
const requireAdmin = (userRole) => {
    if (!['admin', 'super-admin'].includes(userRole)) {
        throw {
            status: 403,
            message: 'Access denied. Admin or Super Admin role required.',
        };
    }
};

/**
 * Verify super admin access
 * @param {string} userRole - User's role
 * @throws {Object} - Error object if not authorized
 */
const requireSuperAdmin = (userRole) => {
    if (userRole !== 'super-admin') {
        throw {
            status: 403,
            message: 'Access denied. Super Admin role required.',
        };
    }
};

/**
 * Throw unauthorized error with context
 * @param {string} action - The attempted action
 * @param {string} resource - The resource type
 * @throws {Object} - Error object
 */
const throwUnauthorized = (action = 'access', resource = 'resource') => {
    throw {
        status: 403,
        message: `You are not authorized to ${action} this ${resource}.`,
    };
};

module.exports = {
    canAccessResource,
    requireAdmin,
    requireSuperAdmin,
    throwUnauthorized,
};
