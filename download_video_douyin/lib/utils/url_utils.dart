import 'package:http/http.dart' as http;
import 'dart:async';

// Constants
const String USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

/// Cleans and validates a Douyin URL
///
/// This function extracts a valid Douyin URL from a string input
/// which might contain other text or formatting
///
/// @param url The input string containing a Douyin URL
/// @return A cleaned Douyin URL
String cleanUrl(String url) {
  // Find shortened Douyin URL in the input string
  final RegExp douyinUrlRegex =
      RegExp(r'https?:\/\/v\.douyin\.com\/[a-zA-Z0-9]+');
  final Match? douyinUrlMatch = douyinUrlRegex.firstMatch(url);
  if (douyinUrlMatch != null) {
    return douyinUrlMatch.group(0)!;
  }

  // If it's already a full Douyin URL
  if (url.startsWith('https://www.douyin.com/')) {
    return url;
  }

  return url; // Return the original URL if no pattern found
}

/// Extracts the video ID from a Douyin URL
///
/// This function parses different Douyin URL formats to extract the video ID
///
/// @param url The Douyin URL to extract from
/// @return The video ID as a string, or null if not found
String? extractVideoId(String url) {
  // Pattern for URLs with format /video/{id} or /note/{id}
  final RegExp videoPattern = RegExp(r'\/(?:video|note)\/(\d+)');
  final Match? videoMatch = videoPattern.firstMatch(url);
  if (videoMatch != null) {
    return videoMatch.group(1);
  }

  // Pattern for URLs with aweme_id parameter
  final RegExp awemePattern = RegExp(r'aweme_id=(\d+)');
  final Match? awemeMatch = awemePattern.firstMatch(url);
  if (awemeMatch != null) {
    return awemeMatch.group(1);
  }

  // Pattern for URLs with vid parameter
  final RegExp vidPattern = RegExp(r'vid=(\d+)');
  final Match? vidMatch = vidPattern.firstMatch(url);
  if (vidMatch != null) {
    return vidMatch.group(1);
  }

  return null;
}

/// Retrieves the video ID from a Douyin URL
///
/// This async function tries to extract the video ID directly, and if that fails,
/// it follows redirects to get the final URL and extract the ID from there
///
/// @param url The input Douyin URL
/// @return Future containing the video ID as a string, or null if not found
Future<String?> getVideoIdFromUrl(String url) async {
  if (url.isEmpty) return null;

  try {
    // Clean input nếu cần
    final cleanedUrl = cleanUrl(url);
    print('[INFO] Processing cleaned URL: $cleanedUrl');

    // Nếu extract được luôn thì return
    final directId = extractVideoId(cleanedUrl);
    if (directId != null) {
      print('[DEBUG] Found video ID directly: $directId');
      return directId;
    }

    print('[DEBUG] Sending GET request to follow redirect...');

    // Dùng client để follow redirect
    final client = http.Client();
    final request = http.Request('GET', Uri.parse(cleanedUrl));
    request.headers['User-Agent'] = 'Mozilla/5.0';

    final response = await client.send(request);
    final redirectedUrl = response.request?.url.toString();
    client.close();

    print('[DEBUG] Final redirected URL: $redirectedUrl');

    if (redirectedUrl == null) {
      print('[ERROR] Không tìm thấy URL sau redirect');
      return null;
    }

    // Regex tìm video ID
    final regExp = RegExp(r'/video/(\d{10,})');
    final match = regExp.firstMatch(redirectedUrl);

    if (match != null) {
      final videoId = match.group(1);
      print('[DEBUG] Found video ID: $videoId');
      return videoId;
    } else {
      print('[WARN] Không tìm thấy video ID trong URL: $redirectedUrl');
    }
  } catch (e) {
    print('[EXCEPTION] Lỗi khi lấy video ID: $e');
  }

  return null;
}
