import 'package:flutter/material.dart';

class AppTheme {
  static const Color factoryDark = Color(0xFF0D1117);
  static const Color neonBlue = Color(0xFF00D2FF);
  static const Color surfaceDark = Color(0xFF1C2128);

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: factoryDark,

      // Định nghĩa màu chữ toàn hệ thống (TextTheme)
      textTheme: const TextTheme(
        // Chữ lớn tiêu đề dùng trắng tinh
        displayLarge:
            TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        // Chữ nội dung dùng trắng mờ nhẹ để đỡ mỏi mắt
        bodyLarge: TextStyle(color: Colors.white),
        bodyMedium: TextStyle(color: Colors.white70),
      ),

      colorScheme: const ColorScheme.dark(
        primary: neonBlue,
        surface: surfaceDark,
        onSurface: Colors.white, // Đảm bảo chữ trên bề mặt là màu trắng
      ),

      // Card dùng để chứa các ô thông số
      cardTheme: CardThemeData(
        color: Colors.white.withValues(alpha: 0.05),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: Colors.white10),
        ),
      ),

      // Thanh BottomNav
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: factoryDark,
        selectedItemColor: neonBlue,
        unselectedItemColor: Colors.white24,
        selectedLabelStyle:
            TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
      ),
    );
  }
}
