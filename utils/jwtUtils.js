/**
 * JWT Utility Functions
 * Generate and verify JWT tokens
 */

const jwt = require('jsonwebtoken');

const generateToken = (userId, role, email) => {
    const payload = {
        id: userId,
        role,
        email,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '7d',
    });

    return token;
};

const verifyToken = (token) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return { valid: true, decoded };
    } catch (error) {
        return { valid: false, error: error.message };
    }
};

const decodeToken = (token) => {
    try {
        const decoded = jwt.decode(token);
        return decoded;
    } catch (error) {
        return null;
    }
};

module.exports = {
    generateToken,
    verifyToken,
    decodeToken,
};
