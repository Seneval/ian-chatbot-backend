const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    console.log('✅ Using existing MongoDB connection');
    return;
  }
  
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }
  
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    
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
    throw error;
  }
};

module.exports = { connectDB };