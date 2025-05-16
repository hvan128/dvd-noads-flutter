import 'package:douyin_downloader/components/skeleton.dart';
import 'package:douyin_downloader/models/douyin_video.dart';
import 'package:douyin_downloader/services/douyin_service.dart';
import 'package:flutter/material.dart';
import 'package:gallery_saver_plus/gallery_saver.dart';
import 'dart:io';
import 'package:open_file/open_file.dart'; // Thêm package để mở file

class VideoCard extends StatefulWidget {
  final DouyinVideo video;
  final bool isLoading;

  const VideoCard({super.key, required this.video, this.isLoading = false});

  @override
  State<VideoCard> createState() => _VideoCardState();
}

class _VideoCardState extends State<VideoCard> {
  bool _isDownloading = false;
  bool _isDownloaded = false;
  double _downloadProgress = 0.0;
  String _statusMessage = '';
  String? _downloadedFilePath;
  final DouyinService _douyinService = DouyinService();

  @override
  void didUpdateWidget(covariant VideoCard oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (oldWidget.isLoading &&
        !widget.isLoading &&
        !_isDownloading &&
        !_isDownloaded) {
      _downloadContent();
    }
    // Kiểm tra nếu isLoading chuyển từ false -> true
    if (!oldWidget.isLoading && widget.isLoading) {
      _resetDownloadState();
    }
  }

  void _resetDownloadState() {
    setState(() {
      _isDownloading = false;
      _isDownloaded = false;
      _downloadProgress = 0.0;
      _statusMessage = '';
      _downloadedFilePath = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return widget.isLoading
        ? VideoCardSkeleton()
        : Container(
            height: 200,
            margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.1),
                  blurRadius: 10,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Stack(
                children: [
                  // Background image/video thumbnail
                  Positioned.fill(
                    child: Image.network(
                      widget.video.cover,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) {
                        return Container(
                          color: Colors.grey.shade300,
                          child: const Center(
                            child: Icon(Icons.error, color: Colors.grey),
                          ),
                        );
                      },
                    ),
                  ),

                  // Dark overlay gradient
                  Positioned.fill(
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.centerLeft,
                          end: Alignment.centerRight,
                          colors: [
                            Colors.black.withOpacity(0.8),
                            Colors.black.withOpacity(0.5),
                            Colors.black.withOpacity(0.3),
                          ],
                        ),
                      ),
                    ),
                  ),

                  // Video info (left side)
                  Positioned(
                    left: 16,
                    top: 16,
                    bottom: 16,
                    right: 100,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Title and description
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                widget.video.author,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 4),
                              Expanded(
                                child: Text(
                                  widget.video.desc,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 14,
                                  ),
                                  maxLines: 3,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),
                        
                        // Status message
                        if (_statusMessage.isNotEmpty)
                          Container(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: Text(
                              _statusMessage,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          
                        // Action buttons
                        Row(
                          mainAxisAlignment: MainAxisAlignment.start,
                          children: [
                            // Download button
                            IconButton(
                              onPressed:
                                  _isDownloading ? null : _downloadContent,
                              icon: Icon(
                                _isDownloading
                                    ? Icons.hourglass_empty
                                    : _isDownloaded
                                        ? Icons.check_circle
                                        : Icons.download,
                                color: Colors.white,
                                size: 28,
                              ),
                              tooltip: 'Tải xuống',
                            ),
                            // Open file button (only visible after download)
                            if (_isDownloaded && _downloadedFilePath != null)
                              IconButton(
                                onPressed: _openDownloadedFile,
                                icon: const Icon(
                                  Icons.folder_open,
                                  color: Colors.white,
                                  size: 28,
                                ),
                                tooltip: 'Mở file',
                              ),
                            // Share button
                            IconButton(
                              onPressed: () {
                                // TODO: Implement share functionality
                              },
                              icon: const Icon(
                                Icons.share,
                                color: Colors.white,
                                size: 28,
                              ),
                              tooltip: 'Chia sẻ',
                            ),
                          ],
                        ),

                        // Type indicator
                        // Container(
                        //   padding: const EdgeInsets.symmetric(
                        //       horizontal: 8, vertical: 4),
                        //   decoration: BoxDecoration(
                        //     color: Colors.white.withOpacity(0.2),
                        //     borderRadius: BorderRadius.circular(12),
                        //   ),
                        //   child: Text(
                        //     widget.video.type.toUpperCase(),
                        //     style: const TextStyle(
                        //       color: Colors.white,
                        //       fontSize: 12,
                        //       fontWeight: FontWeight.bold,
                        //     ),
                        //   ),
                        // ),
                      ],
                    ),
                  ),

                  // Download progress indicator
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: _isDownloading
                        ? LinearProgressIndicator(
                            value: _downloadProgress,
                            backgroundColor: Colors.white.withOpacity(0.2),
                            valueColor: const AlwaysStoppedAnimation<Color>(
                                Colors.blue),
                            minHeight: 5,
                          )
                        : const SizedBox(height: 5),
                  ),
                ],
              ),
            ),
          );
  }

  Future<void> _downloadContent() async {
  if (_isDownloading) return;

  setState(() {
    _isDownloading = true;
    // Bắt đầu từ 28% (vì skeleton đã hiển thị loading từ 0-28%)
    _downloadProgress = 0.28;
    _statusMessage = 'Bắt đầu tải xuống...';
  });

  try {
    // Thêm callback để cập nhật tiến trình
    final filePath = await _douyinService.downloadContent(
      widget.video,
      onProgress: (progress) {
        setState(() {
          // Điều chỉnh tiến trình để bắt đầu từ 28% và kết thúc ở 100%
          // Công thức: 0.28 + (progress * 0.72)
          // 0.72 = (1.0 - 0.28) để đảm bảo kết thúc ở 100%
          _downloadProgress = 0.28 + (progress * 0.72);
          _statusMessage =
              'Đang tải xuống: ${(_downloadProgress * 100).toStringAsFixed(0)}%';
        });
      },
    );

    setState(() {
      _downloadedFilePath = filePath;
      _statusMessage = 'Đã tải xuống thành công!';
      _isDownloaded = true;
      _downloadProgress = 1.0; // Đảm bảo tiến trình hiển thị đúng 100%
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
  
  // Hàm mở file đã tải xuống
  void _openDownloadedFile() {
    if (_downloadedFilePath != null) {
      final file = File(_downloadedFilePath!);
      if (file.existsSync()) {
        OpenFile.open(_downloadedFilePath!);
      } else {
        setState(() {
          _statusMessage = 'Không tìm thấy file!';
        });
      }
    }
  }
} 