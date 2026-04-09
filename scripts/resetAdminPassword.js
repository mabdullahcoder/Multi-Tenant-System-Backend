/**
 * Script to reset admin/superadmin password
 * Run: npm run reset-admin-password
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const resetAdminPassword = async () => {
    try {
        // Get MongoDB URI from environment
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

        if (!mongoUri) {
            console.error('Error: MONGODB_URI is not defined in .env file');
            process.exit(1);
        }

        // Connect to MongoDB
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB\n');

        // Ask for email
        const email = await question('Enter admin email (superadmin@example.com or admin@example.com): ');

        if (!email) {
            console.log('Email is required');
            rl.close();
            await mongoose.connection.close();
            process.exit(1);
        }

        // Find user
        const user = await User.findOne({ email: email.trim() });

        if (!user) {
            console.log(`User with email ${email} not found`);
            rl.close();
            await mongoose.connection.close();
            process.exit(1);
        }

        console.log('\n Current User Status:');
        console.log('   Email:', user.email);
        console.log('   Role:', user.role);
        console.log('   Is Active:', user.isActive);
        console.log('   Is Blocked:', user.isBlocked);
        console.log('   Login Attempts:', user.loginAttempts);
        console.log('   Lock Until:', user.lockUntil || 'Not locked');
        console.log('   Last Login:', user.lastLogin || 'Never');

        // Ask for new password
        const newPassword = await question('\nEnter new password (or press Enter to keep current): ');

        // Reset account status
        user.isActive = true;
        user.isBlocked = false;
        user.loginAttempts = 0;
        user.lockUntil = null;

        if (newPassword && newPassword.trim()) {
            user.password = newPassword.trim();
            console.log('\nPassword will be updated');
        }

        await user.save();

        console.log('\nUser account reset successfully!');
        console.log('\nEmail:', user.email);
        if (newPassword && newPassword.trim()) {
            console.log('New Password:', newPassword.trim());
        } else {
            console.log('Password: (unchanged)');
        }
        console.log('Account is now active');
        console.log('Account is unblocked');
        console.log('Login attempts reset');
        console.log('Account lock removed');

        rl.close();
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        rl.close();
        await mongoose.connection.close();
        process.exit(1);
    }
};

resetAdminPassword();
