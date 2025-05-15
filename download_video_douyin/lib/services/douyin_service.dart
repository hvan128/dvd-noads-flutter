import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:http/http.dart' as http;
import '../models/douyin_video.dart';

class DouyinService {
  // Thay đổi API_BASE_URL thành URL thực của server của bạn
  static const String API_BASE_URL = 'http://192.168.100.9:3000';
  final Dio _dio = Dio();

  /// Lấy thông tin video từ API
  Future<DouyinVideo> getVideoInfo(String url) async {
    try {
      final response = await http.post(
        Uri.parse('$API_BASE_URL/api/info'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'url': url}),
      );

      if (response.statusCode == 200) {
        final jsonResponse = jsonDecode(response.body);
        if (jsonResponse['success'] == true) {
          return DouyinVideo.fromJson(jsonResponse['data']);
        } else {
          throw Exception(jsonResponse['message'] ?? 'Lỗi không xác định');
        }
      } else {
        throw Exception('Lỗi kết nối: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Không thể lấy thông tin video: $e');
    }
  }

  /// Tải xuống video hoặc hình ảnh
  Future<String> downloadContent(DouyinVideo video) async {
    try {
      // Chuẩn bị dữ liệu cho request tải xuống
      final Map<String, dynamic> requestData = {
        'url': 'https://www.douyin.com/video/${video.id}',
        'type': video.type,
      };

      if (video.type == 'video') {
        requestData['videoUrl'] = video.videoUrl;
      } else {
        requestData['images'] = video.images;
      }

      // Gọi API để bắt đầu tải xuống
      final response = await http.post(
        Uri.parse('$API_BASE_URL/api/download'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(requestData),
      );

      if (response.statusCode == 200) {
        final jsonResponse = jsonDecode(response.body);
        if (jsonResponse['success'] == true) {
          // Lấy URL tải xuống từ API
          final String downloadUrl = '$API_BASE_URL${jsonResponse['data']['downloadUrl']}';
          
          // Lấy thư mục để lưu file
          final directory = await getApplicationDocumentsDirectory();
          final String fileExtension = video.type == 'video' ? 'mp4' : 'zip';
          final String filePath = '${directory.path}/${video.id}.$fileExtension';
          
          // Tải xuống file từ server
          await _dio.download(
            downloadUrl,
            filePath,
            onReceiveProgress: (received, total) {
              if (total != -1) {
                print('Đã tải: ${(received / total * 100).toStringAsFixed(0)}%');
              }
            },
          );
          
          return filePath;
        } else {
          throw Exception(jsonResponse['message'] ?? 'Lỗi không xác định');
        }
      } else {
        throw Exception('Lỗi kết nối: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Không thể tải xuống nội dung: $e');
    }
  }

  /// Kiểm tra URL của Douyin có hợp lệ không
  bool isValidDouyinUrl(String url) {
    return url.contains('douyin.com') || url.contains('v.douyin.com');
  }
}