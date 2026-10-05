import 'package:flutter/material.dart';

class AuthTextField extends StatelessWidget {
  final TextEditingController controller;
  final String hintText;
  final IconData icon;
  final bool obscureText;

  const AuthTextField({
    super.key,
    required this.controller,
    required this.hintText,
    required this.icon,
    this.obscureText = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10.0),
      child: TextField(
        controller: controller,
        obscureText: obscureText,
        // 1. Ép kiểu màu chữ khi nhập là trắng để không bị lẫn vào nền tối
        style: const TextStyle(color: Colors.white, fontSize: 16),
        cursorColor: const Color(0xFF00D2FF), // Con trỏ chuột màu xanh Neon

        decoration: InputDecoration(
          hintText: hintText,
          // 2. Màu của chữ gợi ý (Hint) - dùng màu trắng mờ
          hintStyle: TextStyle(
              color: Colors.white.withValues(alpha: 0.3), fontSize: 14),

          // 3. Icon ở đầu ô nhập liệu - dùng màu xanh Neon cho đúng chất IoT
          prefixIcon: Icon(icon, color: const Color(0xFF00D2FF), size: 20),

          // 4. Đổ màu nền cho ô nhập liệu (Kính mờ)
          filled: true,
          fillColor: Colors.white.withValues(alpha: 0.05),

          // 5. Thiết lập viền mặc định và viền khi nhấn vào (Focus)
          contentPadding: const EdgeInsets.all(18),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0xFF00D2FF), width: 1.5),
          ),
        ),
      ),
    );
  }
}
