/**
 * User Repository
 * Database operations for User model
 */

const User = require('../models/User');

class UserRepository {
    // Create user
    async create(userData) {
        return await User.create(userData);
    }

    // Find user by ID
    async findById(id) {
        return await User.findById(id).select('-password');
    }

    // Find user by email
    async findByEmail(email) {
        return await User.findOne({ email }).select('+password');
    }

    // Find user with password for authentication
    async findByIdWithPassword(id) {
        return await User.findById(id).select('+password');
    }

    // Get all users with pagination
    // roleFilter: 'user' | 'admin' | 'all'
    async getAllUsers(page = 1, limit = 50, filters = {}, roleFilter = 'user') {
        const skip = (page - 1) * limit;

        // Build role constraint
        let roleQuery;
        if (roleFilter === 'all') {
            roleQuery = { role: { $in: ['user', 'admin'] } };
        } else if (roleFilter === 'admin') {
            roleQuery = { role: 'admin' };
        } else {
            roleQuery = { role: 'user' };
        }

        const query = { ...roleQuery, ...filters };

        const users = await User.find(query)
            .select('-password')
            .limit(limit)
            .skip(skip)
            .sort({ createdAt: -1 });

        const total = await User.countDocuments(query);

        return {
            users,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        };
    }

    // Update user
    async update(id, updateData) {
        return await User.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        }).select('-password');
    }

    // Update password
    async updatePassword(id, newPassword) {
        const user = await User.findById(id);
        user.password = newPassword;
        await user.save();
        return user.select('-password');
    }

    // Block user
    async blockUser(id) {
        return await User.findByIdAndUpdate(id, { isBlocked: true }, { new: true });
    }

    // Unblock user
    async unblockUser(id) {
        return await User.findByIdAndUpdate(id, { isBlocked: false }, { new: true });
    }

    // Search users
    // roleFilter: 'user' | 'admin' | 'all'
    async searchUsers(query, page = 1, limit = 50, roleFilter = 'user') {
        const skip = (page - 1) * limit;

        let roleQuery;
        if (roleFilter === 'all') {
            roleQuery = { role: { $in: ['user', 'admin'] } };
        } else if (roleFilter === 'admin') {
            roleQuery = { role: 'admin' };
        } else {
            roleQuery = { role: 'user' };
        }

        const searchQuery = {
            ...roleQuery,
            $or: [
                { firstName: { $regex: query, $options: 'i' } },
                { lastName: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } },
            ],
        };

        const users = await User.find(searchQuery)
            .select('-password')
            .limit(limit)
            .skip(skip)
            .sort({ createdAt: -1 });

        const total = await User.countDocuments(searchQuery);

        return {
            users,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        };
    }

    // Delete user
    async delete(id) {
        return await User.findByIdAndDelete(id);
    }

    // Get user statistics
    async getUserStats() {
        return await User.aggregate([
            {
                $facet: {
                    total: [{ $count: 'count' }],
                    activeUsers: [
                        { $match: { isActive: true, isBlocked: false } },
                        { $count: 'count' },
                    ],
                    blockedUsers: [
                        { $match: { isBlocked: true } },
                        { $count: 'count' },
                    ],
                    registeredToday: [
                        {
                            $match: {
                                createdAt: {
                                    $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                                },
                            },
                        },
                        { $count: 'count' },
                    ],
                },
            },
        ]);
    }
}

module.exports = new UserRepository();
