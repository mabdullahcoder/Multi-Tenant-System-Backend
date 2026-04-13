/**
 * Authentication Service
 * Handles user authentication logic
 */

const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { generateToken } = require('../utils/jwtUtils');
const { validateInput, authValidationSchemas } = require('../utils/validationSchemas');

class AuthService {
    // Register user
    async register(userData) {
        // Validate input
        const validation = validateInput(authValidationSchemas.register, userData);
        if (!validation.valid) {
            throw {
                status: 400,
                message: 'Validation failed',
                errors: validation.errors,
            };
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: validation.data.email });
        if (existingUser) {
            throw {
                status: 400,
                message: 'Email already registered',
            };
        }

        // Create user
        const user = await User.create({
            firstName: validation.data.firstName,
            lastName: validation.data.lastName,
            email: validation.data.email,
            password: validation.data.password,
            role: 'user',
        });

        // Log activity
        await ActivityLog.create({
            userId: user._id,
            action: 'register',
            actionDescription: 'User registered successfully',
            status: 'success',
        });

        // Return user data without password
        const userResponseData = {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
        };

        const token = generateToken(user._id, user.role, user.email);

        return {
            user: userResponseData,
            token,
        };
    }

    // Login user
    async login(email, password, ipAddress, userAgent) {
        // Validate input
        const validation = validateInput(authValidationSchemas.login, { email, password });
        if (!validation.valid) {
            throw {
                status: 400,
                message: 'Validation failed',
                errors: validation.errors,
            };
        }

        // Find user with explicit field selection to ensure role is included
        const user = await User.findOne({ email })
            .select('+password')
            .select('firstName lastName email password role isActive isBlocked loginAttempts lockUntil');
        if (!user) {
            throw {
                status: 401,
                message: 'Invalid email or password',
            };
        }

        // Verify role field exists and is valid
        if (!user.role) {
            throw {
                status: 500,
                message: 'User role not found. Contact system administrator.',
            };
        }

        // Check if user is blocked
        if (user.isBlocked) {
            await ActivityLog.create({
                userId: user._id,
                action: 'login',
                actionDescription: 'Login attempt from blocked user',
                ipAddress,
                userAgent,
                status: 'failed',
                statusCode: 403,
            });

            throw {
                status: 403,
                message: 'Your account has been blocked',
            };
        }

        // Check if user is active
        if (!user.isActive) {
            await ActivityLog.create({
                userId: user._id,
                action: 'login',
                actionDescription: 'Login attempt from inactive user',
                ipAddress,
                userAgent,
                status: 'failed',
                statusCode: 403,
            });

            throw {
                status: 403,
                message: 'Your account is inactive. Please contact support.',
            };
        }

        // Check if account is locked
        if (user.lockUntil && user.lockUntil > new Date()) {
            throw {
                status: 429,
                message: 'Account is locked. Please try again later',
            };
        }

        // Check password
        const isPasswordValid = await user.matchPassword(password);

        if (!isPasswordValid) {
            await user.incLoginAttempts();

            await ActivityLog.create({
                userId: user._id,
                action: 'login',
                actionDescription: 'Failed login attempt',
                ipAddress,
                userAgent,
                status: 'failed',
                statusCode: 401,
            });

            throw {
                status: 401,
                message: 'Invalid email or password',
            };
        }

        // Reset login attempts and update last login
        await user.resetLoginAttempts();

        // Log successful login
        await ActivityLog.create({
            userId: user._id,
            action: 'login',
            actionDescription: `User logged in successfully with role: ${user.role}`,
            ipAddress,
            userAgent,
            status: 'success',
        });

        // Validate role before token generation
        if (!user.role || !['user', 'admin', 'super-admin'].includes(user.role)) {
            throw {
                status: 500,
                message: 'Invalid user role found in database',
            };
        }

        const token = generateToken(user._id, user.role, user.email);

        const userResponse = {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
        };

        return {
            user: userResponse,
            token,
        };
    }

    // Change password
    async changePassword(userId, currentPassword, newPassword, ipAddress, userAgent) {
        // Validate input
        const validation = validateInput(authValidationSchemas.changePassword, {
            currentPassword,
            newPassword,
            confirmPassword: newPassword,
        });

        if (!validation.valid) {
            throw {
                status: 400,
                message: 'Validation failed',
                errors: validation.errors,
            };
        }

        // Find user
        const user = await User.findById(userId).select('+password');
        if (!user) {
            throw {
                status: 404,
                message: 'User not found',
            };
        }

        // Check current password
        const isPasswordValid = await user.matchPassword(currentPassword);
        if (!isPasswordValid) {
            await ActivityLog.create({
                userId,
                action: 'password_change',
                actionDescription: 'Failed password change attempt',
                ipAddress,
                userAgent,
                status: 'failed',
            });

            throw {
                status: 401,
                message: 'Current password is incorrect',
            };
        }

        // Update password
        user.password = newPassword;
        await user.save();

        // Log activity
        await ActivityLog.create({
            userId,
            action: 'password_change',
            actionDescription: 'Password changed successfully',
            ipAddress,
            userAgent,
            status: 'success',
        });

        return {
            message: 'Password changed successfully',
        };
    }
}

module.exports = new AuthService();
