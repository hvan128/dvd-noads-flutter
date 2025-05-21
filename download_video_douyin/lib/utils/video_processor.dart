import 'package:douyin_downloader/models/douyin_video.dart';

DouyinVideo? processVideoData(Map<String, dynamic> videoData) {
  // Kiểm tra tính hợp lệ của dữ liệu
  if (videoData['aweme_detail'] == null) {
    return null;
  }
  
  final Map<String, dynamic> data = videoData['aweme_detail'];
  final bool isImagePost = data['images'] != null && data['images'] is List;
  
  // Chuẩn bị các thông tin cơ bản
  String id = data['aweme_id']?.toString() ?? '';
  String desc = data['desc']?.toString() ?? '';
  String author = data['author']?['nickname']?.toString() ?? 'Unknown';
  String cover = '';
  
  // Lấy URL ảnh bìa
  if (data['video'] != null && 
      data['video']['cover'] != null && 
      data['video']['cover']['url_list'] is List &&
      (data['video']['cover']['url_list'] as List).isNotEmpty) {
    cover = data['video']['cover']['url_list'][0]?.toString() ?? '';
  }
  
  // Xác định kiểu nội dung
  String type = isImagePost ? 'images' : 'video';
  
  // Tạo đối tượng kết quả với thông tin cơ bản
  DouyinVideo result = DouyinVideo(
    id: id,
    desc: desc,
    author: author,
    cover: cover,
    type: type,
  );
  
  if (isImagePost) {
    // Trường hợp bài đăng hình ảnh
    List<dynamic> imageData = data['images'] as List;
    List<String> images = [];
    
    for (var image in imageData) {
      if (image['url_list'] != null && image['url_list'] is List && (image['url_list'] as List).isNotEmpty) {
        List urlList = image['url_list'] as List;
        // Lấy URL cuối cùng trong danh sách (thường là chất lượng cao nhất)
        images.add(urlList[urlList.length - 1]?.toString() ?? '');
      }
    }
    
    result = DouyinVideo(
      id: id,
      desc: desc,
      author: author,
      cover: cover,
      type: type,
      images: images,
    );
  } else {
    // Trường hợp video
    String videoUrl = '';
    
    // Tìm URL video chất lượng cao nhất từ bit_rate
    if (data['video'] != null && 
        data['video']['bit_rate'] != null && 
        data['video']['bit_rate'] is List) {
      
      int maxBitRate = 0;
      List<dynamic> bitRates = data['video']['bit_rate'] as List;
      
      for (var item in bitRates) {
        int bitRate = item['bit_rate'] as int? ?? 0;
        
        if (bitRate > maxBitRate && 
            item['play_addr'] != null && 
            item['play_addr']['url_list'] != null &&
            item['play_addr']['url_list'] is List &&
            (item['play_addr']['url_list'] as List).isNotEmpty) {
          
          maxBitRate = bitRate;
          videoUrl = item['play_addr']['url_list'][0]?.toString() ?? '';
        }
      }
    }
    
    // Nếu không tìm thấy từ bit_rate, thử từ play_addr
    if (videoUrl.isEmpty && 
        data['video'] != null && 
        data['video']['play_addr'] != null &&
        data['video']['play_addr']['url_list'] != null &&
        data['video']['play_addr']['url_list'] is List &&
        (data['video']['play_addr']['url_list'] as List).isNotEmpty) {
      
      videoUrl = data['video']['play_addr']['url_list'][0]?.toString() ?? '';
    }
    
    // Nếu vẫn không tìm thấy, kiểm tra download_addr
    if (videoUrl.isEmpty && 
        data['video'] != null && 
        data['video']['download_addr'] != null &&
        data['video']['download_addr']['url_list'] != null &&
        data['video']['download_addr']['url_list'] is List &&
        (data['video']['download_addr']['url_list'] as List).isNotEmpty) {
      
      videoUrl = data['video']['download_addr']['url_list'][0]?.toString() ?? '';
    }
    
    // Nếu vẫn không có URL video, thử lấy từ URI
    if (videoUrl.isEmpty && 
        data['video'] != null && 
        data['video']['play_addr'] != null &&
        data['video']['play_addr']['uri'] != null) {
      
      String uri = data['video']['play_addr']['uri']?.toString() ?? '';
      videoUrl = 'https://aweme.snssdk.com/aweme/v1/play/?video_id=$uri&ratio=720p&line=0';
    }
    
    result = DouyinVideo(
      id: id,
      desc: desc,
      author: author,
      cover: cover,
      type: type,
      videoUrl: videoUrl,
    );
  }
  
  return result;
}