const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const settingsRoutes = require('./routes/settings');
const inventoryRoutes = require('./routes/inventory');
const categoryRoutes = require('./routes/categories');
const transactionRoutes = require('./routes/transactions');
const discountRoutes = require('./routes/discounts');


// DEBUG: Check what each route exports
console.log('=== DEBUGGING ROUTE EXPORTS ===');
console.log('authRoutes type:', typeof authRoutes);
console.log('userRoutes type:', typeof userRoutes);
console.log('settingsRoutes type:', typeof settingsRoutes);
console.log('inventoryRoutes type:', typeof inventoryRoutes);


// Check if they have router methods
console.log('\nChecking if exports are routers:');
console.log('authRoutes has use method?', typeof authRoutes.use === 'function');
console.log('userRoutes has use method?', typeof userRoutes.use === 'function');
console.log('settingsRoutes has use method?', typeof settingsRoutes.use === 'function');
console.log('inventoryRoutes has use method?', typeof inventoryRoutes.use === 'function');

// If any is an object, show its keys
if (typeof authRoutes === 'object' && !authRoutes.use) {
  console.log('authRoutes keys:', Object.keys(authRoutes));
}
if (typeof userRoutes === 'object' && !userRoutes.use) {
  console.log('userRoutes keys:', Object.keys(userRoutes));
}
if (typeof settingsRoutes === 'object' && !settingsRoutes.use) {
  console.log('settingsRoutes keys:', Object.keys(settingsRoutes));
}
if (typeof inventoryRoutes === 'object' && !inventoryRoutes.use) {
  console.log('inventoryRoutes keys:', Object.keys(inventoryRoutes));
}

console.log('=== END DEBUG ===\n');

// Initialize Express app
const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost', 'http://127.0.0.1:5500'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/orion_pos', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Test route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Orion POS Backend is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/discounts', discountRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API URL: http://localhost:${PORT}`);
  console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
});