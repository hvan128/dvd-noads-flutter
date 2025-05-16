import 'package:flutter/material.dart';

class AppColors {
  static const Color primary = Color(0xFF1E2A38);
  static const Color primaryLight = Color(0xFF3E4C59);
  static const Color accent = Color(0xFF4C9AFF);
  static const Color background = Color(0xFFF9FAFB);
  static const Color surface = Color(0xFFE5E7EB);
  static const Color border = Color(0xFFCBD5E1);
  static const Color success = Color(0xFF34D399);
  static const Color warning = Color(0xFFFBBF24);
  static const Color error = Color(0xFFEF4444);
  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textMuted = Color(0xFF64748B);
}
// Kiểu phối	               |              Màu sử dụng
// Header App                | 	primary, accent, textPrimary
// Body                      |  nền sáng	background, surface, textPrimary
// Nút CTA (gọi hành động)   |  accent (nút), white (text)
// Thông báo thành công/lỗi  | 	success, warning, error với chữ trắng