/**
 * Database Configuration
 * Establishes MongoDB connection using Mongoose
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI;

        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        logger.info('MongoDB Connected Successfully');
        return mongoose.connection;
    } catch (error) {
        logger.error('MongoDB Connection Error', error);
        process.exit(1);
    }
};

module.exports = connectDB;
