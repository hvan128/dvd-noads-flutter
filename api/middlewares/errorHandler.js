// middleware/errorHandler.js - Xử lý lỗi tập trung
/**
 * Middleware xử lý lỗi tập trung
 * @param {Error} err Đối tượng lỗi
 * @param {Object} req Request Express
 * @param {Object} res Response Express
 * @param {Function} next Next middleware
 */
function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err);
  
  // Xác định HTTP status code dựa trên loại lỗi
  const statusCode = err.statusCode || 500;
  
  // Chuẩn bị phản hồi lỗi
  const errorResponse = {
    success: false,
    message: err.message || 'Đã xảy ra lỗi trên máy chủ'
  };
  
  // Thêm thông tin lỗi chi tiết trong môi trường phát triển
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }
  
  // Gửi phản hồi lỗi
  res.status(statusCode).json(errorResponse);
}

module.exports = errorHandler;