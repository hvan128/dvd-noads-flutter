import 'dart:async';
import 'package:douyin_downloader/components/video_card.dart';
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
  DouyinVideo? _video;
  String? _downloadedFilePath;

  @override
  void initState() {
    super.initState();
    _checkClipboard();
    _initSharedIntent();
  }

  int _secondsElapsed = 0;
  Timer? _timer;
  void _startTimer() {
    _secondsElapsed = 0;
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() {
        _secondsElapsed++;
      });
    });
  }

  void _stopTimer() {
    _timer?.cancel();
    _timer = null;
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
      _startTimer();
    });

    try {
      final video = await _douyinService.getVideoInfo(url);

      if (!mounted) return;

      setState(() {
        _isLoading = false;
        _stopTimer();
      });
      setState(() {
        _video = video;
        _downloadedFilePath = null;
        _errorMessage = '';
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = e.toString();
        _stopTimer();
      });
    }
  }

  // Dán từ clipboard
  Future<void> _pasteFromClipboard() async {
    try {
      final clipboardData = await FlutterClipboard.paste();
      setState(() {
        _video = null;
        _downloadedFilePath = null;
        _urlController.text = clipboardData;
        _errorMessage = '';
      });
      _getVideoInfo();
    } catch (e) {
      setState(() {
        _errorMessage = 'Không thể truy cập clipboard';
      });
    }
  }

  Widget _buildPasteButton() {
    return GestureDetector(
      onTap: _isLoading ? null : _pasteFromClipboard,
      child: Container(
        width: 300,
        height: 300,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: const LinearGradient(
            colors: [
              Color(0xFF00C6FF), // Cyan sáng
              Color(0xFF0072FF), // Xanh dương đậm
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.5),
              blurRadius: 5,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.content_paste_rounded,
              color: Colors.white,
              size: 40,
            ),
            const SizedBox(height: 2),
            Text(
              'Paste',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 40,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
          title: const Text('Douyin Downloader'),
          centerTitle: true,
          shadowColor: Color(0xFF1E2A38),
          backgroundColor: Color(0xFF1E2A38)),
      body: Container(
        height: MediaQuery.of(context).size.height,
        width: double.infinity,   
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [
              Color(0xFF1E2A38),
              Color(0xFF4C9AFF),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Logo hoặc icon ứng dụng
                const SizedBox(height: 40),
                _buildPasteButton(),
                const SizedBox(height: 20),
                const Text(
                  'Just copy your link and tap paste!',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 20),
                // Hiển thị thông báo lỗi nếu có
                if (_errorMessage.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8.0),
                    child: Text(
                      _errorMessage,
                      style: const TextStyle(color: Color(0xFFEF4444)),
                    ),
                  ),

                _video == null && !_isLoading
                    ? const SizedBox
                        .shrink() // Không có dữ liệu và không loading
                    : VideoCard(
                        video: _video ??
                            DouyinVideo(
                                author: "",
                                cover: "",
                                desc: "",
                                id: "",
                                type: ""), // Cung cấp video dummy nếu null
                        isLoading:
                            _isLoading, // Thêm thuộc tính isLoading vào VideoCard
                      ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _urlController.dispose();
    _intentDataStreamSubscription?.cancel();
    _stopTimer();
    super.dispose();
  }
}
