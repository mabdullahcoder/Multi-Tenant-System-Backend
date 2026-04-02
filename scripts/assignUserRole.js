#!/usr/bin/env node
/**
 * Assign User Role Script
 * SENIOR FIX: Safely assign or update user roles
 * 
 * Usage: 
 *   node scripts/assignUserRole.js <email> <role>
 *   node scripts/assignUserRole.js admin@example.com super-admin
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');
const logger = require('../utils/logger');

const VALID_ROLES = ['user', 'admin', 'super-admin'];

const assignRole = async () => {
    try {
        const email = process.argv[2];
        const role = process.argv[3];

        if (!email || !role) {
            console.log('Usage: node scripts/assignUserRole.js <email> <role>');
            console.log(`Valid roles: ${VALID_ROLES.join(', ')}`);
            process.exit(1);
        }

        if (!VALID_ROLES.includes(role)) {
            console.error(`❌ Invalid role: ${role}`);
            console.log(`Valid roles: ${VALID_ROLES.join(', ')}`);
            process.exit(1);
        }

        console.log(`🔍 Connecting to database...`);
        await connectDB();

        console.log(`🔍 Finding user: ${email}...`);
        const user = await User.findOne({ email });

        if (!user) {
            console.error(`❌ User not found: ${email}`);
            process.exit(1);
        }

        const oldRole = user.role;
        user.role = role;
        await user.save();

        console.log(`✅ Role updated successfully!`);
        console.log(`   User: ${user.firstName} ${user.lastName} (${user.email})`);
        console.log(`   Old role: ${oldRole || 'UNDEFINED'}`);
        console.log(`   New role: ${role}`);

        logger.info(
            `User role updated: ${email} - ${oldRole || 'UNDEFINED'} -> ${role}`
        );

        process.exit(0);
    } catch (error) {
        console.error('❌ Error assigning role:', error.message);
        process.exit(1);
    }
};

assignRole();
