/**
 * Script to create an admin user
 * Run: npm run create-admin
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const createAdminUser = async () => {
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

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email: 'admin@example.com' });

        if (existingAdmin) {
            console.log('⚠️  Admin user already exists!');
            console.log('\n📧 Email: admin@example.com');
            console.log('🔑 Password: Admin@123');
            await mongoose.connection.close();
            process.exit(0);
        }

        // Create admin user
        const adminUser = await User.create({
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@example.com',
            password: 'Admin@123',
            role: 'admin',
            phone: '+1234567890',
            address: '123 Admin Street',
            city: 'Admin City',
            state: 'Admin State',
            country: 'USA',
            zipCode: '12345',
            isActive: true,
        });

        console.log('✅ Admin user created successfully!');
        console.log('\n📧 Email: admin@example.com');
        console.log('🔑 Password: Admin@123');
        console.log('\n⚠️  Please change the password after first login!');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating admin user:', error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
};

createAdminUser();
