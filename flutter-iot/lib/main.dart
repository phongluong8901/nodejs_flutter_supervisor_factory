import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'home/screens/widgets/head_notifications.dart';
import 'auth/auth_service.dart';
import 'auth/screens/login_screen.dart';
import 'home/screens/home_screen.dart';
import 'home/providers/iot_provider.dart';

void main() async {
  // Line-by-line: Đảm bảo các thành phần hệ thống của Flutter được khởi tạo
  WidgetsFlutterBinding.ensureInitialized();

  await AuthService.initialize();
  NotificationService.initialize().catchError((e) {
    debugPrint("Notification initialization failed: $e");
  });

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => IotProvider()),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Smart Factory Pro',
      theme: ThemeData(
        brightness: Brightness.dark,
        primaryColor: const Color(0xFF00D2FF),
        scaffoldBackgroundColor: const Color(0xFF0D1117),
      ),
      home: ValueListenableBuilder<MongoSession?>(
        valueListenable: AuthService.session,
        builder: (context, session, _) =>
            session == null ? const LoginScreen() : const HomeScreen(),
      ),
    );
  }
}
