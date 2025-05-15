import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:http/http.dart' as http;
import '../models/douyin_video.dart';

class DouyinService {
  // Thay đổi API_BASE_URL thành URL thực của server của bạn
  // static const String API_BASE_URL = 'http://192.168.100.9:3000';
  static const String API_BASE_URL = 'https://dvd-noads-flutter.onrender.com';
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

  /// Tải xuống video hoặc hình ảnh sử dụng API mới
Future<String> downloadContent(DouyinVideo video) async {
  try {
    // Chuẩn bị dữ liệu cho request lấy URL tải xuống
    final Map<String, dynamic> requestData = {
      'url': 'https://www.douyin.com/video/${video.id}',
      'type': video.type,
    };

    if (video.type == 'video') {
      requestData['videoUrl'] = video.videoUrl;
    } else {
      requestData['images'] = video.images;
    }

    // Gọi API để lấy URL tải xuống trực tiếp
    final response = await http.post(
      Uri.parse('$API_BASE_URL/api/get-download-url'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(requestData),
    );

    if (response.statusCode == 200) {
      final jsonResponse = jsonDecode(response.body);
      if (jsonResponse['success'] == true) {
        final data = jsonResponse['data'];
        
        // Lấy thư mục để lưu file
        final directory = await getApplicationDocumentsDirectory();
        String filePath;
        
        if (data['type'] == 'video') {
          // Tải xuống video
          final String videoUrl = data['url'];
          final String filename = data['filename'] ?? 'douyin_${video.id}.mp4';
          filePath = '${directory.path}/$filename';
          
          // Tải xuống file từ URL nguồn trực tiếp
          await _dio.download(
            videoUrl,
            filePath,
            onReceiveProgress: (received, total) {
              if (total != -1) {
                print('Đã tải video: ${(received / total * 100).toStringAsFixed(0)}%');
              }
            },
          );
          
          return filePath;
        } else if (data['type'] == 'images') {
          // Trường hợp nhiều hình ảnh - tạo thư mục để lưu
          final String folderName = data['prefix'] ?? 'douyin_${video.id}';
          final String folderPath = '${directory.path}/$folderName';
          
          // Tạo thư mục nếu chưa tồn tại
          final dir = Directory(folderPath);
          if (!await dir.exists()) {
            await dir.create(recursive: true);
          }
          
          // Tải xuống từng hình ảnh
          final List<String> imageUrls = List<String>.from(data['urls']);
          final List<String> downloadedPaths = [];
          
          for (int i = 0; i < imageUrls.length; i++) {
            final String imagePath = '$folderPath/image_${i+1}.jpg';
            await _dio.download(
              imageUrls[i],
              imagePath,
              onReceiveProgress: (received, total) {
                if (total != -1) {
                  print('Đã tải ảnh ${i+1}: ${(received / total * 100).toStringAsFixed(0)}%');
                }
              },
            );
            downloadedPaths.add(imagePath);
          }
          
          // Nếu người dùng muốn nén thành zip, bạn có thể thêm code nén ở đây
          // Hoặc trả về thư mục chứa tất cả các hình ảnh
          return folderPath;
        } else {
          throw Exception('Loại nội dung không được hỗ trợ');
        }
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

// Nếu bạn muốn thêm tính năng nén nhiều hình ảnh thành file zip, có thể thêm hàm này
Future<String> _compressImagesToZip(List<String> imagePaths, String outputPath) async {
  try {
    // Sử dụng thư viện như flutter_archive hoặc archive để nén file
    // Ví dụ với flutter_archive:
    // await ZipFile.createFromFiles(
    //   sourceDir: Directory(path.dirname(imagePaths.first)),
    //   files: imagePaths.map((path) => File(path)).toList(),
    //   zipFile: File(outputPath),
    // );
    
    // Hoặc sử dụng thư viện path_provider và archive
    // Bạn cần thêm các dependency phù hợp vào pubspec.yaml
    
    return outputPath;
  } catch (e) {
    throw Exception('Không thể nén ảnh: $e');
  }
}
  /// Kiểm tra URL của Douyin có hợp lệ không
  bool isValidDouyinUrl(String url) {
    return url.contains('douyin.com') || url.contains('v.douyin.com');
  }
}