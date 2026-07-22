const mongoose = require('mongoose');

async function connectDB() {
    try {
        const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/licensing_db';
        
        await mongoose.connect(mongoUrl);
        console.log('MongoDB successfully connected.');
    } catch (err) {
        console.error('MongoDB database connection error:', err.message);
        process.exit(1);
    }
}

module.exports = connectDB;
