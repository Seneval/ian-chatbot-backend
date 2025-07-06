const mongoose = require('mongoose');

let isConnected = false;
let connectionPromise = null;

const connectDB = async () => {
  if (isConnected) {
    console.log('✅ Using existing MongoDB connection');
    return;
  }
  
  // Return existing connection attempt if one is in progress
  if (connectionPromise) {
    return connectionPromise;
  }
  
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }
  
  connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,  // Reduced from default to fit within Vercel timeout
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 2,
    retryWrites: true,
    w: 'majority'
  });
  
  try {
    await connectionPromise;
    
    isConnected = true;
    console.log('✅ MongoDB connected successfully');
    
    // Connection event listeners
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('🔌 MongoDB disconnected');
      isConnected = false;
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
      isConnected = true;
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    isConnected = false;
    connectionPromise = null;  // Reset to allow retry
    throw error;
  } finally {
    connectionPromise = null;  // Clear promise after completion
  }
};

module.exports = { connectDB };