// Temporary debug handler
module.exports = (req, res) => {
  try {
    res.status(200).json({ 
      message: 'Debug test - server is working!',
      timestamp: new Date().toISOString(),
      url: req.url,
      method: req.method
    });
  } catch (error) {
    res.status(500).json({
      error: 'Debug error: ' + error.message
    });
  }
};