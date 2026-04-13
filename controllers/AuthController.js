/**
 * Authentication Controller
 * Handles authentication endpoints
 */

const AuthService = require('../services/AuthService');
const ActivityLog = require('../models/ActivityLog');
const { sendSuccess } = require('../utils/responseFormatter');
const { getClientIp, getUserAgent } = require('../middlewares/loggerMiddleware');

class AuthController {
    // Register endpoint
    async register(req, res, next) {
        try {
            const { firstName, lastName, email, password, confirmPassword } = req.body;

            const result = await AuthService.register({
                firstName,
                lastName,
                email,
                password,
                confirmPassword,
            });

            sendSuccess(res, 201, 'User registered successfully', result);
        } catch (error) {
            next(error);
        }
    }

    // Login endpoint
    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            const ipAddress = getClientIp(req);
            const userAgent = getUserAgent(req);

            const result = await AuthService.login(email, password, ipAddress, userAgent);

            // Set token in secure cookie (optional)
            res.cookie('authToken', result.token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            });

            sendSuccess(res, 200, 'Login successful', result);
        } catch (error) {
            next(error);
        }
    }

    // Logout endpoint
    async logout(req, res, next) {
        try {
            const userId = req.user.id;
            const ipAddress = getClientIp(req);
            const userAgent = getUserAgent(req);

            await ActivityLog.create({
                userId,
                action: 'logout',
                actionDescription: 'User logged out',
                ipAddress,
                userAgent,
                status: 'success',
            });

            res.clearCookie('authToken');
            sendSuccess(res, 200, 'Logged out successfully');
        } catch (error) {
            next(error);
        }
    }

    // Change password endpoint
    async changePassword(req, res, next) {
        try {
            const { currentPassword, newPassword, confirmPassword } = req.body;
            const userId = req.user.id;
            const ipAddress = getClientIp(req);
            const userAgent = getUserAgent(req);

            const result = await AuthService.changePassword(
                userId,
                currentPassword,
                newPassword,
                ipAddress,
                userAgent
            );

            sendSuccess(res, 200, result.message);
        } catch (error) {
            next(error);
        }
    }

    // Verify token endpoint
    async verifyToken(req, res, next) {
        try {
            sendSuccess(res, 200, 'Token is valid', {
                user: req.user,
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AuthController();
