require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const Admin = require('./models/Admin');
const bcrypt = require('bcryptjs');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/license', require('./routes/license.routes'));

// Default Health Probe Route
app.get('/', (req, res) => {
    res.json({ status: 'healthy', service: 'Ithu Namma Kada Licensing API' });
});

// Seed default Admin user
async function seedAdmin() {
    try {
        const adminExists = await Admin.findOne({ username: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('adminpassword123', 10);
            const newAdmin = new Admin({
                username: 'admin',
                password: hashedPassword,
                role: 'SuperAdmin'
            });
            await newAdmin.save();
            console.log('Seeded default admin user: admin / adminpassword123');
        }
    } catch (err) {
        console.error('Error seeding admin credentials:', err.message);
    }
}

// Start Server
const PORT = process.env.PORT || 5500;
connectDB().then(async () => {
    await seedAdmin();
    app.listen(PORT, () => {
        console.log(`Licensing server successfully running on port ${PORT}`);
    });
});
