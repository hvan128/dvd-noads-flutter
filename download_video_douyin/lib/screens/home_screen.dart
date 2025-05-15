import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:clipboard/clipboard.dart';
import '../models/douyin_video.dart';
import '../services/douyin_service.dart';
import 'video_detail_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _urlController = TextEditingController();
  final DouyinService _douyinService = DouyinService();
  bool _isLoading = false;
  String _errorMessage = '';
  StreamSubscription? _intentDataStreamSubscription;

  @override
  void initState() {
    super.initState();
    _checkClipboard();
    _initSharedIntent();
  }

  // Kiểm tra URL được chia sẻ
  void _initSharedIntent() {
    // Lắng nghe các intent được gửi đến ứng dụng
    const platform = MethodChannel('app.channel.shared.data');
    platform.setMethodCallHandler((call) async {
      if (call.method == 'handleSharedData') {
        final String sharedData = call.arguments as String;
        if (_douyinService.isValidDouyinUrl(sharedData)) {
          setState(() {
            _urlController.text = sharedData;
          });
          _getVideoInfo();
        }
      }
      return null;
    });
  }

  // Kiểm tra clipboard khi màn hình được mở
  Future<void> _checkClipboard() async {
    try {
      final clipboardData = await FlutterClipboard.paste();
      if (_douyinService.isValidDouyinUrl(clipboardData)) {
        setState(() {
          _urlController.text = clipboardData;
        });

        // Hiển thị snackbar để thông báo URL đã được dán
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Đã phát hiện URL Douyin trong clipboard'),
            action: SnackBarAction(
              label: 'Tải ngay',
              onPressed: () => _getVideoInfo(),
            ),
          ),
        );
      }
    } catch (e) {
      print('Lỗi khi kiểm tra clipboard: $e');
    }
  }

  // Lấy thông tin video từ URL
  Future<void> _getVideoInfo() async {
    final url = _urlController.text.trim();
    if (url.isEmpty) {
      setState(() {
        _errorMessage = 'Vui lòng nhập URL Douyin';
      });
      return;
    }

    if (!_douyinService.isValidDouyinUrl(url)) {
      setState(() {
        _errorMessage = 'URL không hợp lệ. Vui lòng nhập URL Douyin hợp lệ.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      final video = await _douyinService.getVideoInfo(url);
      
      if (!mounted) return;
      
      setState(() {
        _isLoading = false;
      });
      
      // Chuyển đến màn hình chi tiết video
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => VideoDetailScreen(video: video),
        ),
      );
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = e.toString();
      });
    }
  }

  // Dán từ clipboard
  Future<void> _pasteFromClipboard() async {
    try {
      final clipboardData = await FlutterClipboard.paste();
      setState(() {
        _urlController.text = clipboardData;
        _errorMessage = '';
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Không thể truy cập clipboard';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Douyin Downloader'),
        centerTitle: true,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Logo hoặc icon ứng dụng
            const SizedBox(height: 40),
            Icon(
              Icons.play_circle_filled,
              size: 80,
              color: Theme.of(context).primaryColor,
            ),
            const SizedBox(height: 20),
            const Text(
              'Tải video từ Douyin',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 40),
            
            // Trường nhập URL
            TextField(
              controller: _urlController,
              decoration: InputDecoration(
                labelText: 'Nhập URL Douyin',
                hintText: 'https://v.douyin.com/xxxxx/',
                border: OutlineInputBorder(),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.paste),
                  onPressed: _pasteFromClipboard,
                  tooltip: 'Dán từ clipboard',
                ),
              ),
              keyboardType: TextInputType.url,
              textInputAction: TextInputAction.go,
              onSubmitted: (_) => _getVideoInfo(),
            ),
            const SizedBox(height: 8),
            
            // Hiển thị thông báo lỗi nếu có
            if (_errorMessage.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8.0),
                child: Text(
                  _errorMessage,
                  style: const TextStyle(color: Colors.red),
                ),
              ),
            
            const SizedBox(height: 20),
            
            // Nút tải video
            ElevatedButton(
              onPressed: _isLoading ? null : _getVideoInfo,
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: _isLoading
                  ? const CircularProgressIndicator()
                  : const Text(
                      'Lấy thông tin video',
                      style: TextStyle(fontSize: 16),
                    ),
            ),
            
            const SizedBox(height: 24),
            
            // Hướng dẫn sử dụng
            const Expanded(
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Hướng dẫn:',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    SizedBox(height: 8),
                    Text(
                      '1. Sao chép URL video từ ứng dụng Douyin\n'
                      '2. Dán URL vào ô trên\n'
                      '3. Nhấn "Lấy thông tin video"\n'
                      '4. Xem và tải xuống video',
                      style: TextStyle(fontSize: 16),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _urlController.dispose();
    _intentDataStreamSubscription?.cancel();
    super.dispose();
  }
}