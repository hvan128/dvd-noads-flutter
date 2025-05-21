class DouyinVideo {
  final String id;
  final String desc;
  final String author;
  final String cover;
  final String type;
  final String? videoUrl;
  final List<String>? images;

  DouyinVideo({
    required this.id,
    required this.desc,
    required this.author,
    required this.cover,
    required this.type,
    this.videoUrl,
    this.images,
  });

  factory DouyinVideo.fromJson(Map<String, dynamic> json) {
    List<String>? imagesList;
    if (json['type'] == 'images' && json['images'] != null) {
      imagesList = List<String>.from(json['images']);
    }

    return DouyinVideo(
      id: json['id'] ?? '',
      desc: json['desc'] ?? '',
      author: json['author'] ?? '',
      cover: json['cover'] ?? '',
      type: json['type'] ?? 'video',
      videoUrl: json['videoUrl'],
      images: imagesList,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'desc': desc,
      'author': author,
      'cover': cover,
      'type': type,
      if (images != null) 'images': images,
      if (videoUrl != null) 'videoUrl': videoUrl,
    };
  }

  @override
  String toString() {
    return 'DouyinVideo{id: $id, desc: $desc, author: $author, cover: $cover, type: $type, videoUrl: $videoUrl, images: $images}';
  }
}