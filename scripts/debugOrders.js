/**
 * Debug Orders Script
 * Check database connection and list all orders
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');

async function debugOrders() {
    try {
        console.log('='.repeat(60));
        console.log('ORDER DEBUG SCRIPT');
        console.log('='.repeat(60));

        // Connect to database
        console.log('\n1. Connecting to MongoDB...');
        console.log('   URI:', process.env.MONGODB_URI);

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('   ✓ Connected successfully');

        // Check users
        console.log('\n2. Checking users...');
        const users = await User.find({}).select('_id firstName lastName email role');
        console.log(`   Found ${users.length} users:`);
        users.forEach(user => {
            console.log(`   - ${user.email} (${user.role}) - ID: ${user._id}`);
        });

        // Check all orders
        console.log('\n3. Checking all orders...');
        const allOrders = await Order.find({}).populate('userId', 'firstName lastName email');
        console.log(`   Found ${allOrders.length} total orders`);

        if (allOrders.length > 0) {
            console.log('\n   Order details:');
            allOrders.forEach((order, index) => {
                console.log(`   ${index + 1}. Order ID: ${order.orderId}`);
                console.log(`      MongoDB _id: ${order._id}`);
                console.log(`      User: ${order.userId?.email || 'Unknown'} (${order.userId?._id})`);
                console.log(`      Product: ${order.productName}`);
                console.log(`      Status: ${order.status}`);
                console.log(`      Total: $${order.totalAmount}`);
                console.log(`      Created: ${order.createdAt}`);
                console.log('');
            });
        }

        // Check orders by user
        console.log('\n4. Checking orders by user...');
        for (const user of users) {
            const userOrders = await Order.find({ userId: user._id });
            console.log(`   ${user.email}: ${userOrders.length} orders`);
        }

        // Check database collections
        console.log('\n5. Database collections:');
        const collections = await mongoose.connection.db.listCollections().toArray();
        collections.forEach(col => {
            console.log(`   - ${col.name}`);
        });

        console.log('\n' + '='.repeat(60));
        console.log('DEBUG COMPLETE');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('\nDatabase connection closed');
        process.exit(0);
    }
}

debugOrders();
