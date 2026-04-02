#!/usr/bin/env node

/**
 * Environment Configuration Validator
 * Validates that all required environment variables are set
 * Run this before starting the application
 */

const fs = require('fs');
const path = require('path');

const requiredServerEnvVars = [
    'MONGODB_URI',
    'JWT_SECRET',
    'JWT_EXPIRE',
    'PORT',
    'NODE_ENV',
    'CLIENT_URL',
];

const requiredClientEnvVars = [
    'VITE_API_BASE_URL',
];

function validateEnv(envFilePath, requiredVars, appName) {
    console.log(`\nValidating ${appName} environment variables...`);

    if (!fs.existsSync(envFilePath)) {
        console.error(`${appName} .env file not found at ${envFilePath}`);
        console.log(`   Please create it by running: cp .env.example .env`);
        return false;
    }

    const envContent = fs.readFileSync(envFilePath, 'utf-8');
    let allValid = true;

    requiredVars.forEach((varName) => {
        if (!envContent.includes(varName) || envContent.includes(`${varName}=`)) {
            const value = envContent
                .split('\n')
                .find((line) => line.startsWith(varName))
                ?.split('=')[1]?.trim();

            if (!value || value === '') {
                console.warn(`${varName} is not set or is empty`);
                allValid = false;
            } else {
                console.log(`${varName} is configured`);
            }
        }
    });

    return allValid;
}

function checkServerEnv() {
    const serverEnvPath = path.join(__dirname, '.env');
    return validateEnv(serverEnvPath, requiredServerEnvVars, 'Server');
}

function checkClientEnv() {
    const clientEnvPath = path.join(__dirname, '..', 'client', '.env');
    return validateEnv(clientEnvPath, requiredClientEnvVars, 'Client');
}

function main() {
    console.log('\nChecking environment configuration...\n');

    const serverValid = checkServerEnv();
    const clientValid = checkClientEnv();

    if (!serverValid && !clientValid) {
        console.error('\nEnvironment configuration is incomplete!');
        console.log('\nPlease follow these steps:');
        console.log('1. Copy .env.example to .env in both client and server directories');
        console.log('2. Update the variables with your actual values');
        console.log('3. Re-run this validator\n');
        process.exit(1);
    }

    if (serverValid && clientValid) {
        console.log('\nAll environment variables are properly configured!');
        console.log('\nYou can now start the application:\n');
        console.log('Backend:  cd server && npm run dev');
        console.log('Frontend: cd client && npm run dev\n');
    } else {
        console.log('\nSome environment variables may need attention.\n');
    }
}

main();
