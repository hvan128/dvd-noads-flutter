import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:gallery_saver_plus/gallery_saver.dart';
import 'package:open_file/open_file.dart';
import 'package:share_plus/share_plus.dart';
import 'package:video_player/video_player.dart';
import '../models/douyin_video.dart';
import '../services/douyin_service.dart';

class VideoDetailScreen extends StatefulWidget {
  final DouyinVideo video;

  const VideoDetailScreen({Key? key, required this.video}) : super(key: key);

  @override
  State<VideoDetailScreen> createState() => _VideoDetailScreenState();
}

class _VideoDetailScreenState extends State<VideoDetailScreen> {
  final DouyinService _douyinService = DouyinService();
  VideoPlayerController? _videoController;
  bool _isDownloading = false;
  double _downloadProgress = 0.0;
  String? _downloadedFilePath;
  String _statusMessage = '';

  @override
  void initState() {
    super.initState();
    // Nếu là video, khởi tạo VideoPlayerController
    if (widget.video.type == 'video' && widget.video.videoUrl != null) {
      _initVideoPlayer();
    }
  }

  // Khởi tạo video player
  void _initVideoPlayer() {
    _videoController = VideoPlayerController.network(widget.video.videoUrl!)
      ..initialize().then((_) {
        setState(() {});
        _videoController?.play();
      });
  }

  // Tải xuống video hoặc hình ảnh
  Future<void> _downloadContent() async {
    if (_isDownloading) return;

    setState(() {
      _isDownloading = true;
      _statusMessage = 'Đang chuẩn bị tải xuống...';
    });

    try {
      final filePath = await _douyinService.downloadContent(widget.video);

      setState(() {
        _downloadedFilePath = filePath;
        _statusMessage = 'Tải xuống thành công!';
      });

      // Lưu vào thư viện nếu là video
      if (widget.video.type == 'video') {
        final success = await GallerySaver.saveVideo(filePath);
        if (success == true) {
          setState(() {
            _statusMessage = 'Đã lưu video vào thư viện!';
          });
        }
      }
    } catch (e) {
      setState(() {
        _statusMessage = 'Lỗi: ${e.toString()}';
      });
    } finally {
      setState(() {
        _isDownloading = false;
      });
    }
  }

  // Mở file đã tải
  Future<void> _openDownloadedFile() async {
    if (_downloadedFilePath != null) {
      await OpenFile.open(_downloadedFilePath!);
    }
  }

  // Chia sẻ file đã tải
  Future<void> _shareFile() async {
    // if (_downloadedFilePath != null) {
    //   await Share.shareFiles([_downloadedFilePath!], text: widget.video.desc);
    // }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chi tiết video'),
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Hiển thị video hoặc hình ảnh bìa
            if (widget.video.type == 'video' &&
                _videoController != null &&
                _videoController!.value.isInitialized)
              AspectRatio(
                aspectRatio: _videoController!.value.aspectRatio,
                child: VideoPlayer(_videoController!),
              )
            else
              CachedNetworkImage(
                imageUrl: widget.video.cover,
                height: 250,
                fit: BoxFit.cover,
                placeholder: (context, url) =>
                    Center(child: CircularProgressIndicator()),
                errorWidget: (context, url, error) => Icon(Icons.error),
              ),

            // Thông tin video
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.video.desc,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Tác giả: ${widget.video.author}',
                    style: const TextStyle(fontSize: 16),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Loại: ${widget.video.type == 'video' ? 'Video' : 'Hình ảnh'}',
                    style: const TextStyle(fontSize: 16),
                  ),
                  if (widget.video.type == 'images' &&
                      widget.video.images != null)
                    Text(
                      'Số lượng hình ảnh: ${widget.video.images!.length}',
                      style: const TextStyle(fontSize: 16),
                    ),
                  const SizedBox(height: 16),

                  // Hiển thị thông báo trạng thái
                  if (_statusMessage.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: _statusMessage.contains('Lỗi')
                            ? Colors.red[100]
                            : Colors.green[100],
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(_statusMessage),
                    ),

                  const SizedBox(height: 16),

                  // Nút điều khiển
                  if (_isDownloading)
                    const Center(child: CircularProgressIndicator())
                  else
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (_downloadedFilePath == null)
                          ElevatedButton.icon(
                            icon: const Icon(Icons.download),
                            label: Text(
                                'Tải ${widget.video.type == 'video' ? 'video' : 'hình ảnh'}'),
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            onPressed: _downloadContent,
                          )
                        else
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              ElevatedButton.icon(
                                icon: const Icon(Icons.open_in_new),
                                label: const Text('Mở file đã tải'),
                                style: ElevatedButton.styleFrom(
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 12),
                                ),
                                onPressed: _openDownloadedFile,
                              ),
                              const SizedBox(height: 8),
                              ElevatedButton.icon(
                                icon: const Icon(Icons.share),
                                label: const Text('Chia sẻ'),
                                style: ElevatedButton.styleFrom(
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 12),
                                ),
                                onPressed: _shareFile,
                              ),
                            ],
                          ),
                      ],
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
      // Nút play/pause cho video
      floatingActionButton: widget.video.type == 'video' &&
              _videoController != null &&
              _videoController!.value.isInitialized
          ? FloatingActionButton(
              onPressed: () {
                setState(() {
                  _videoController!.value.isPlaying
                      ? _videoController!.pause()
                      : _videoController!.play();
                });
              },
              child: Icon(
                _videoController!.value.isPlaying
                    ? Icons.pause
                    : Icons.play_arrow,
              ),
            )
          : null,
    );
  }

  @override
  void dispose() {
    _videoController?.dispose();
    super.dispose();
  }
}
