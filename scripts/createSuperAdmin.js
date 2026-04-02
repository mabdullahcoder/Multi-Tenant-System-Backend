/**
 * Script to create a super-admin user
 * Run: npm run create-superadmin
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const createSuperAdminUser = async () => {
    try {
        // Get MongoDB URI from environment
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

        if (!mongoUri) {
            console.error('❌ Error: MONGODB_URI is not defined in .env file');
            console.log('\n💡 Please ensure your server/.env file contains:');
            console.log('   MONGODB_URI=mongodb://localhost:27017/multi_talented_system');
            process.exit(1);
        }

        // Connect to MongoDB
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Check if super-admin already exists
        const existingSuperAdmin = await User.findOne({ email: 'superadmin@example.com' });

        if (existingSuperAdmin) {
            console.log('⚠️  Super Admin user already exists!');
            console.log('\n📧 Email: superadmin@example.com');
            console.log('🔑 Password: SuperAdmin@123');
            await mongoose.connection.close();
            process.exit(0);
        }

        // Create super-admin user
        const superAdminUser = await User.create({
            firstName: 'Super',
            lastName: 'Admin',
            email: 'superadmin@example.com',
            password: 'SuperAdmin@123',
            role: 'super-admin',
            phone: '+1234567890',
            address: '123 Super Admin Street',
            city: 'Admin City',
            state: 'Admin State',
            country: 'USA',
            zipCode: '12345',
            isActive: true,
        });

        console.log('✅ Super Admin user created successfully!');
        console.log('\n📧 Email: superadmin@example.com');
        console.log('🔑 Password: SuperAdmin@123');
        console.log('\n⚠️  Please change the password after first login!');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating super admin user:', error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
};

createSuperAdminUser();
