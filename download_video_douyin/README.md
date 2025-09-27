# ⚡ Quick Start - Chạy dự án Flutter

## 🚀 Chạy nhanh trong 5 phút

### **Bước 1: Cài đặt Flutter**
```bash
# Kiểm tra Flutter đã cài chưa
flutter --version

# Nếu chưa có, tải từ: https://flutter.dev/docs/get-started/install
```

### **Bước 2: Clone và cài đặt**
```bash
# Clone project
git clone <repository-url>
cd download_video_douyin

# Cài đặt dependencies
flutter pub get
```

### **Bước 3: Chạy API Backend**
```bash
# Option 1: Docker (Khuyến nghị)
docker run -d -p 8000:8000 social-dl-api

# Option 2: Local API
# Cài đặt Python và chạy API server
```

### **Bước 4: Chạy app**
```bash
# Chạy trên device/emulator
flutter run

# Hoặc chạy trên web
flutter run -d web-server --web-port 8080
```

### **Bước 5: Test app**
1. Mở app
2. Paste URL video (YouTube, TikTok, etc.)
3. Chọn chất lượng
4. Tap "Tải"
5. Xem progress và kết quả

## 🔧 Troubleshooting nhanh

### **Lỗi thường gặp:**

#### **Flutter not found:**
```bash
# Cấu hình PATH
export PATH="$PATH:/path/to/flutter/bin"
```

#### **Dependencies error:**
```bash
# Clean và reinstall
flutter clean
flutter pub get
```

#### **API connection failed:**
```bash
# Kiểm tra Docker
docker ps
docker logs social-dl-api
```

#### **Build failed:**
```bash
# Clean build
flutter clean
flutter build apk --debug
```

## 📱 Test với URL mẫu

### **YouTube:**
```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

### **TikTok:**
```
https://www.tiktok.com/@username/video/1234567890
```

### **Douyin:**
```
https://www.douyin.com/video/1234567890
```

## 🎯 Features chính

- ✅ **Multi-platform**: YouTube, TikTok, Douyin, Instagram, Facebook, Xiaohongshu
- ✅ **Quality selection**: HD, SD, Audio only
- ✅ **Progress tracking**: Smooth progress animation
- ✅ **Auto-detect**: Paste URL từ clipboard
- ✅ **Gallery save**: Lưu video vào thư viện

## 🐛 Debug Tools

### **Debug Button:**
- Tap icon bug trong AppBar
- Test progress flow
- Verify API connection
- Xem console logs

### **Console Logs:**
```bash
# Xem logs chi tiết
flutter logs

# Hoặc trong IDE
flutter run --verbose
```

## 📊 Project Structure

```
download_video_douyin/
├── lib/
│   ├── components/     # UI Components
│   ├── models/         # Data Models
│   ├── screens/        # App Screens
│   ├── services/       # API Services
│   ├── utils/          # Utilities
│   └── main.dart       # Entry Point
├── android/            # Android Config
├── ios/                # iOS Config
├── web/                # Web Config
└── pubspec.yaml        # Dependencies
```

## 🚀 Build Commands

```bash
# Debug build
flutter build apk --debug

# Release build
flutter build apk --release

# Web build
flutter build web --release
```

## 📞 Support

- **Issues**: Tạo GitHub issue
- **Documentation**: Xem README.md
- **Setup Guide**: Xem SETUP_GUIDE.md

---

**🎬 Happy downloading! 🚀**
