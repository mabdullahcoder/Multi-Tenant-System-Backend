/**
 * User Controller
 * Handles user endpoints
 */

const UserService = require('../services/UserService');
const { sendSuccess, sendError } = require('../utils/responseFormatter');
const { getClientIp, getUserAgent } = require('../middlewares/loggerMiddleware');

class UserController {
    // Get user profile
    async getProfile(req, res, next) {
        try {
            const userId = req.user.id;
            const user = await UserService.getProfile(userId);

            sendSuccess(res, 200, 'Profile retrieved successfully', user);
        } catch (error) {
            next(error);
        }
    }

    // Update user profile
    async updateProfile(req, res, next) {
        try {
            const userId = req.user.id;
            const ipAddress = getClientIp(req);
            const userAgent = getUserAgent(req);

            const updatedUser = await UserService.updateProfile(
                userId,
                req.body,
                ipAddress,
                userAgent
            );

            sendSuccess(res, 200, 'Profile updated successfully', updatedUser);
        } catch (error) {
            next(error);
        }
    }

    // Get all users (admin only)
    async getAllUsers(req, res, next) {
        try {
            const { page = 1, limit = 50, roleFilter = 'user', ...filters } = req.query;
            const search = req.query.search || null;
            const userRole = req.user.role;

            const result = await UserService.getAllUsers(
                userRole, parseInt(page), parseInt(limit),
                filters, search, roleFilter
            );

            sendSuccess(res, 200, 'Users retrieved successfully', result.users, result.pagination);
        } catch (error) {
            next(error);
        }
    }

    // Get user statistics (admin only)
    async getUserStats(req, res, next) {
        try {
            const userRole = req.user.role;
            const stats = await UserService.getUserStats(userRole);
            sendSuccess(res, 200, 'User statistics retrieved', stats);
        } catch (error) {
            next(error);
        }
    }

    // Get user details (admin only)
    async getUserDetail(req, res, next) {
        try {
            const { userId } = req.params;
            const userRole = req.user.role;

            const user = await UserService.getUserDetails(userRole, userId);

            sendSuccess(res, 200, 'User details retrieved successfully', user);
        } catch (error) {
            next(error);
        }
    }

    // Block user (admin only)
    async blockUser(req, res, next) {
        try {
            const { userId } = req.params;
            const adminId = req.user.id;
            const userRole = req.user.role;
            const ipAddress = getClientIp(req);
            const userAgent = getUserAgent(req);

            const blockedUser = await UserService.blockUser(adminId, userRole, userId, ipAddress, userAgent);

            sendSuccess(res, 200, 'User blocked successfully', blockedUser);
        } catch (error) {
            next(error);
        }
    }

    // Unblock user (admin only)
    async unblockUser(req, res, next) {
        try {
            const { userId } = req.params;
            const adminId = req.user.id;
            const userRole = req.user.role;
            const ipAddress = getClientIp(req);
            const userAgent = getUserAgent(req);

            const unblockedUser = await UserService.unblockUser(adminId, userRole, userId, ipAddress, userAgent);

            sendSuccess(res, 200, 'User unblocked successfully', unblockedUser);
        } catch (error) {
            next(error);
        }
    }

    // Search users (admin only)
    async searchUsers(req, res, next) {
        try {
            const { query, page = 1, limit = 10 } = req.query;
            const userRole = req.user.role;

            if (!query) {
                return sendError(res, 400, 'Search query is required');
            }

            const result = await UserService.searchUsers(userRole, query, parseInt(page), parseInt(limit));

            sendSuccess(res, 200, 'Users searched successfully', result.users, result.pagination);
        } catch (error) {
            next(error);
        }
    }

    // Create user or admin (admin/super-admin only)
    async createUser(req, res, next) {
        try {
            const { firstName, lastName, email, password, role, phone } = req.body;
            const creatorRole = req.user.role;
            const creatorId = req.user.id;
            const ipAddress = getClientIp(req);
            const userAgent = getUserAgent(req);

            const newUser = await UserService.createUser(
                creatorId, creatorRole,
                { firstName, lastName, email, password, role, phone },
                ipAddress, userAgent
            );

            sendSuccess(res, 201, 'User created successfully', newUser);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new UserController();
