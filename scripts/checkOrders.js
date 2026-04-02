/**
 * Check Orders Script
 * Verifies orders in the database
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');

async function checkOrders() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✓ MongoDB connected');

        const orders = await Order.find({}).populate('userId', 'firstName lastName email');
        console.log(`\nTotal orders in database: ${orders.length}`);

        if (orders.length > 0) {
            console.log('\n--- Sample Orders ---');
            orders.slice(0, 3).forEach((order, index) => {
                console.log(`\nOrder ${index + 1}:`);
                console.log(`  Order ID: ${order.orderId}`);
                console.log(`  User ID: ${order.userId?._id || order.userId}`);
                console.log(`  User: ${order.userId?.firstName} ${order.userId?.lastName}`);
                console.log(`  Product: ${order.productName}`);
                console.log(`  Status: ${order.status}`);
                console.log(`  Total: $${order.totalAmount}`);
                console.log(`  Created: ${order.createdAt}`);
            });
        } else {
            console.log('\n⚠ No orders found in database');
        }

        const users = await User.find({});
        console.log(`\n\nTotal users in database: ${users.length}`);
        if (users.length > 0) {
            console.log('\n--- Sample Users ---');
            users.slice(0, 3).forEach((user, index) => {
                console.log(`\nUser ${index + 1}:`);
                console.log(`  ID: ${user._id}`);
                console.log(`  Name: ${user.firstName} ${user.lastName}`);
                console.log(`  Email: ${user.email}`);
                console.log(`  Role: ${user.role}`);
            });
        }

        await mongoose.connection.close();
        console.log('\n✓ Connection closed');
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkOrders();
