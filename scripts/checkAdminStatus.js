/**
 * Script to check admin/superadmin user status
 * Run: node scripts/checkAdminStatus.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const checkAdminStatus = async () => {
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

        // Check Super Admin
        console.log('=== SUPER ADMIN STATUS ===');
        const superAdmin = await User.findOne({ email: 'superadmin@example.com' });

        if (superAdmin) {
            console.log('   Super Admin exists');
            console.log('   Email:', superAdmin.email);
            console.log('   Role:', superAdmin.role);
            console.log('   Name:', `${superAdmin.firstName} ${superAdmin.lastName}`);
            console.log('   Is Active:', superAdmin.isActive ? '✓ Yes' : '✗ No');
            console.log('   Is Blocked:', superAdmin.isBlocked ? '✗ Yes' : '✓ No');
            console.log('   Login Attempts:', superAdmin.loginAttempts);
            console.log('   Lock Until:', superAdmin.lockUntil || 'Not locked');
            console.log('   Last Login:', superAdmin.lastLogin || 'Never');
            console.log('   Created:', superAdmin.createdAt);

            if (superAdmin.isBlocked) {
                console.log('\n WARNING: Super Admin account is BLOCKED!');
            }
            if (!superAdmin.isActive) {
                console.log('\n WARNING: Super Admin account is INACTIVE!');
            }
            if (superAdmin.lockUntil && superAdmin.lockUntil > new Date()) {
                console.log('\n WARNING: Super Admin account is LOCKED until', superAdmin.lockUntil);
            }
            if (superAdmin.loginAttempts >= 5) {
                console.log('\n WARNING: Super Admin has too many failed login attempts!');
            }
        } else {
            console.log('✗ Super Admin does not exist');
            console.log('   Run: npm run create-superadmin');
        }

        console.log('\n=== ADMIN STATUS ===');
        const admin = await User.findOne({ email: 'admin@example.com' });

        if (admin) {
            console.log('Admin exists');
            console.log('Email:', admin.email);
            console.log('Role:', admin.role);
            console.log('Name:', `${admin.firstName} ${admin.lastName}`);
            console.log('Is Active:', admin.isActive ? '✓ Yes' : '✗ No');
            console.log('Is Blocked:', admin.isBlocked ? '✗ Yes' : '✓ No');
            console.log('Login Attempts:', admin.loginAttempts);
            console.log('Lock Until:', admin.lockUntil || 'Not locked');
            console.log('Last Login:', admin.lastLogin || 'Never');
            console.log('Created:', admin.createdAt);

            if (admin.isBlocked) {
                console.log('\n⚠️  WARNING: Admin account is BLOCKED!');
            }
            if (!admin.isActive) {
                console.log('\n⚠️  WARNING: Admin account is INACTIVE!');
            }
            if (admin.lockUntil && admin.lockUntil > new Date()) {
                console.log('\n⚠️  WARNING: Admin account is LOCKED until', admin.lockUntil);
            }
            if (admin.loginAttempts >= 5) {
                console.log('\n⚠️  WARNING: Admin has too many failed login attempts!');
            }
        } else {
            console.log('✗ Admin does not exist');
            console.log('   Run: npm run create-admin');
        }

        console.log('\n=== RECOMMENDATIONS ===');
        if ((superAdmin && (superAdmin.isBlocked || !superAdmin.isActive || superAdmin.loginAttempts >= 5)) ||
            (admin && (admin.isBlocked || !admin.isActive || admin.loginAttempts >= 5))) {
            console.log('⚠️  Some accounts have issues. Run: npm run reset-admin-password');
        } else {
            console.log('✓ All admin accounts look good!');
        }

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
};

checkAdminStatus()