#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');

const VALID_ROLES = ['user', 'admin', 'super-admin'];

const validateRoles = async () => {
    try {
        console.log('Connecting to database...');
        await connectDB();

        console.log('🔍 Checking all users for role issues...\n');

        const users = await User.find({}).select('_id email firstName lastName role');

        if (users.length === 0) {
            console.log('No users found in database');
            process.exit(0);
        }

        console.log(`📊 Total users in database: ${users.length}\n`);

        let issuesFound = 0;
        const usersWithIssues = [];

        users.forEach((user) => {
            const issues = [];

            if (!user.role) {
                issues.push('MISSING_ROLE');
            } else if (!VALID_ROLES.includes(user.role)) {
                issues.push(`INVALID_ROLE[${user.role}]`);
            }

            if (issues.length > 0) {
                issuesFound++;
                usersWithIssues.push({
                    _id: user._id,
                    email: user.email,
                    name: `${user.firstName} ${user.lastName}`,
                    role: user.role || 'UNDEFINED',
                    issues: issues.join(', '),
                });
            }
        });

        if (issuesFound === 0) {
            console.log('✅ All users have valid roles!');
            console.log(`   Total valid users: ${users.length}`);
            process.exit(0);
        }

        console.log(`❌ Found ${issuesFound} users with role issues:\n`);
        console.table(usersWithIssues);

        console.log('\n📝 To fix these issues:');
        console.log('   1. Use /scripts/assignUserRole.js to assign roles');
        console.log('   2. Example: node scripts/assignUserRole.js user@example.com admin\n');

        process.exit(issuesFound > 0 ? 1 : 0);
    } catch (error) {
        console.error('❌ Error validating roles:', error.message);
        process.exit(1);
    }
};

validateRoles();
