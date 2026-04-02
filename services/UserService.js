/**
 * User Service
 * Handles user profile and management operations
 */

const UserRepository = require('../repositories/UserRepository');
const ActivityLog = require('../models/ActivityLog');
const AdminLog = require('../models/AdminLog');
const { validateInput, userValidationSchemas } = require('../utils/validationSchemas');
const { requireAdmin } = require('../utils/authorizationHelper');

class UserService {
    // Get user profile
    async getProfile(userId) {
        const user = await UserRepository.findById(userId);
        if (!user) {
            throw {
                status: 404,
                message: 'User not found',
            };
        }
        return user;
    }

    // Update user profile
    async updateProfile(userId, updateData, ipAddress, userAgent) {
        // Validate input
        const validation = validateInput(userValidationSchemas.updateProfile, updateData);
        if (!validation.valid) {
            throw {
                status: 400,
                message: 'Validation failed',
                errors: validation.errors,
            };
        }

        // Store previous values for activity log
        const previousUser = await UserRepository.findById(userId);

        // Update user
        const updatedUser = await UserRepository.update(userId, validation.data);
        if (!updatedUser) {
            throw {
                status: 404,
                message: 'User not found',
            };
        }

        // Log activity
        await ActivityLog.create({
            userId,
            action: 'profile_update',
            actionDescription: 'User profile updated',
            ipAddress,
            userAgent,
            status: 'success',
        });

        return updatedUser;
    }

    // Get all users (admin only)
    // callerRole drives what's visible: super-admin can request roleFilter='admin'|'user'|'all'
    async getAllUsers(userRole, page = 1, limit = 50, filters = {}, search = null, roleFilter = 'user') {
        requireAdmin(userRole);

        // Only super-admin may view admin accounts
        const effectiveRoleFilter =
            userRole === 'super-admin' ? roleFilter : 'user';

        if (search) {
            return await UserRepository.searchUsers(search, page, limit, effectiveRoleFilter);
        }
        return await UserRepository.getAllUsers(page, limit, filters, effectiveRoleFilter);
    }

    // Search users
    async searchUsers(userRole, query, page = 1, limit = 50, roleFilter = 'user') {
        requireAdmin(userRole);
        const effectiveRoleFilter = userRole === 'super-admin' ? roleFilter : 'user';
        return await UserRepository.searchUsers(query, page, limit, effectiveRoleFilter);
    }

    // Get user statistics (admin only)
    async getUserStats(userRole) {
        requireAdmin(userRole);
        return await UserRepository.getUserStats();
    }

    // Block user (admin only)
    async blockUser(userId, userRole, targetUserId, ipAddress, userAgent) {
        // Enforce admin access
        requireAdmin(userRole);

        // Get target user to check their role
        const targetUser = await UserRepository.findById(targetUserId);
        if (!targetUser) {
            throw {
                status: 404,
                message: 'User not found',
            };
        }

        // Prevent blocking yourself
        if (userId === targetUserId) {
            throw {
                status: 403,
                message: 'You cannot block yourself',
            };
        }

        // Role-based blocking restrictions
        if (userRole === 'admin') {
            // Admins cannot block other admins or super-admins
            if (targetUser.role === 'admin' || targetUser.role === 'super-admin') {
                throw {
                    status: 403,
                    message: 'Admins cannot block other admins or super-admins. Only super-admins can perform this action.',
                };
            }
        } else if (userRole === 'super-admin') {
            // Super-admins cannot block other super-admins
            if (targetUser.role === 'super-admin') {
                throw {
                    status: 403,
                    message: 'Super-admins cannot block other super-admins',
                };
            }
        }

        const user = await UserRepository.blockUser(targetUserId);

        // Log admin activity
        await AdminLog.create({
            adminId: userId,
            action: 'user_blocked',
            actionDescription: `User ${targetUserId} (${targetUser.role}) blocked by ${userRole}`,
            targetResourceId: targetUserId,
            resourceType: 'User',
            ipAddress,
            userAgent,
        });

        // Log user activity
        await ActivityLog.create({
            userId: targetUserId,
            action: 'account_status_changed',
            actionDescription: `Account blocked by ${userRole}`,
            ipAddress,
            userAgent,
            status: 'success',
        });

        return user;
    }

    // Unblock user (admin only)
    async unblockUser(userId, userRole, targetUserId, ipAddress, userAgent) {
        // Enforce admin access
        requireAdmin(userRole);

        // Get target user to check their role
        const targetUser = await UserRepository.findById(targetUserId);
        if (!targetUser) {
            throw {
                status: 404,
                message: 'User not found',
            };
        }

        // Prevent unblocking yourself (though you shouldn't be blocked)
        if (userId === targetUserId) {
            throw {
                status: 403,
                message: 'You cannot unblock yourself',
            };
        }

        // Role-based unblocking restrictions
        if (userRole === 'admin') {
            // Admins cannot unblock other admins or super-admins
            if (targetUser.role === 'admin' || targetUser.role === 'super-admin') {
                throw {
                    status: 403,
                    message: 'Admins cannot unblock other admins or super-admins. Only super-admins can perform this action.',
                };
            }
        } else if (userRole === 'super-admin') {
            // Super-admins cannot unblock other super-admins
            if (targetUser.role === 'super-admin') {
                throw {
                    status: 403,
                    message: 'Super-admins cannot unblock other super-admins',
                };
            }
        }

        const user = await UserRepository.unblockUser(targetUserId);

        // Log admin activity
        await AdminLog.create({
            adminId: userId,
            action: 'user_unblocked',
            actionDescription: `User ${targetUserId} (${targetUser.role}) unblocked by ${userRole}`,
            targetResourceId: targetUserId,
            resourceType: 'User',
            ipAddress,
            userAgent,
        });

        // Log user activity
        await ActivityLog.create({
            userId: targetUserId,
            action: 'account_status_changed',
            actionDescription: `Account unblocked by ${userRole}`,
            ipAddress,
            userAgent,
            status: 'success',
        });

        return user;
    }

    // Get user details (admin only)
    async getUserDetails(userRole, userId) {
        // Enforce admin access
        requireAdmin(userRole);

        const user = await UserRepository.findById(userId);
        if (!user) {
            throw { status: 404, message: 'User not found' };
        }
        return user;
    }

    // Create user or admin (admin/super-admin only)
    async createUser(creatorId, creatorRole, userData, ipAddress, userAgent) {
        requireAdmin(creatorRole);

        const { firstName, lastName, email, password, role = 'user', phone } = userData;

        // Admins can only create regular users
        if (creatorRole === 'admin' && role !== 'user') {
            throw { status: 403, message: 'Admins can only create regular users' };
        }

        // Super-admins can create users and admins, not other super-admins
        if (creatorRole === 'super-admin' && role === 'super-admin') {
            throw { status: 403, message: 'Cannot create another super-admin' };
        }

        // Check email uniqueness
        const existing = await UserRepository.findByEmail(email);
        if (existing) {
            throw { status: 409, message: 'A user with this email already exists' };
        }

        // Pass plain password — the User model pre('save') hook handles hashing.
        // Do NOT pre-hash here; double-hashing corrupts the password.
        const newUser = await UserRepository.create({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim().toLowerCase(),
            password, // plain text — hashed by mongoose pre-save hook
            role,
            phone: phone ? phone.trim() : '',
        });

        // Log the admin action — wrapped so a log failure never blocks user creation.
        try {
            await AdminLog.create({
                adminId: creatorId,
                action: role === 'admin' ? 'admin_created' : 'user_created',
                actionDescription: `${role} account created for ${email} by ${creatorRole}`,
                targetResourceId: newUser._id,
                resourceType: 'User',
                ipAddress,
                userAgent,
            });
        } catch (logErr) {
            // Non-fatal — user was created successfully
            console.warn('AdminLog write failed (non-fatal):', logErr.message);
        }

        return newUser;
    }
}

module.exports = new UserService();
