import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter/services.dart';
import 'screens/home_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  requestPermissions();
  runApp(const MyApp());
  
  // Xử lý chia sẻ từ ứng dụng khác
  SystemChannels.platform.setMethodCallHandler((MethodCall call) async {
    if (call.method == 'SystemNavigator.pop') {
      // Xử lý khi người dùng nhấn nút back
      return true;
    }
    return null;
  });
}

Future<void> requestPermissions() async {
  // Yêu cầu quyền cần thiết cho ứng dụng
  await Permission.storage.request();
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Douyin Downloader',
      theme: ThemeData(
        primarySwatch: Colors.red,
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          color: Colors.red,
          foregroundColor: Colors.white,
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.red,
            foregroundColor: Colors.white,
          ),
        ),
      ),
      debugShowCheckedModeBanner: false,
      home: const HomeScreen(),
    );
  }
}