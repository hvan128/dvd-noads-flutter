/**
 * Error handling middleware
 */

/**
 * Global error handler for the application
 */
module.exports = (err, req, res, next) => {
  console.error('[ERROR]', err);
  
  // Set appropriate status code
  const statusCode = err.statusCode || 500;
  
  // Send error response
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Đã xảy ra lỗi server'
  });
};