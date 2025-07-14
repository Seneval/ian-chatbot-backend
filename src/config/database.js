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
    serverSelectionTimeoutMS: 5000,  // 5 seconds - fail fast if MongoDB is down
    socketTimeoutMS: 10000,  // 10 seconds max for operations
    connectTimeoutMS: 10000,  // 10 seconds to establish connection
    maxPoolSize: 10,
    minPoolSize: 2,
    retryWrites: true,
    w: 'majority',
    heartbeatFrequencyMS: 2000,  // Check connection health every 2 seconds
    retryReads: true  // Retry failed reads automatically
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