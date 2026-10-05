import 'dart:ui';
import 'package:flutter/material.dart';
import '../auth_service.dart';
import '../widgets/auth_textfield.dart';
import '../widgets/auth_button.dart';
import '../widgets/factory_background.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  // 1. Controller để lấy email từ ô nhập liệu
  final _emailController = TextEditingController();
  bool _loading = false;

  // Mongo accounts do not use Firebase email reset.
  void _resetPassword() async {
    // Kiểm tra nhanh xem user đã nhập email chưa
    if (_emailController.text.isEmpty) {
      _showSnackBar("Vui lòng nhập email của bạn", Colors.orangeAccent);
      return;
    }

    setState(() => _loading = true);

    // Gọi hàm từ AuthService đã viết sẵn
    final error =
        await AuthService().resetPassword(_emailController.text.trim());

    if (!mounted) return;
    setState(() => _loading = false);

    if (error == null) {
      _showSnackBar("Đã xử lý yêu cầu.", Colors.greenAccent);
      Navigator.pop(context);
    } else {
      // Thất bại: Hiển thị lỗi từ hệ thống (VD: Email không tồn tại)
      _showSnackBar(error, Colors.redAccent);
    }
  }

  // Hàm phụ để hiển thị SnackBar nhanh với giao diện tối
  void _showSnackBar(String message, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: const TextStyle(color: Colors.white)),
        backgroundColor: color.withValues(alpha: 0.8),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D1117), // Nền tối đặc trưng
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text("KHÔI PHỤC TRUY CẬP",
            style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
                letterSpacing: 2)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Stack(
        children: [
          // LỚP 1: Nền lưới kỹ thuật Revit
          const FactoryBackground(),

          // LỚP 2: Form xử lý khôi phục mật khẩu
          Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(24),
                child: BackdropFilter(
                  // Hiệu ứng làm nhòe nền kính mờ
                  filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
                  child: Container(
                    padding: const EdgeInsets.all(30),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                          color: Colors.white.withValues(alpha: 0.1)),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Icon chìa khóa bảo mật
                        const Icon(Icons.lock_reset_rounded,
                            size: 60, color: Color(0xFF00D2FF)),
                        const SizedBox(height: 20),

                        const Text(
                          "QUÊN MẬT KHẨU?",
                          style: TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.5),
                        ),
                        const SizedBox(height: 10),
                        const Text(
                          "Đặt lại mật khẩu Mongo hiện do quản trị viên xử lý. Vui lòng liên hệ quản trị viên hệ thống.",
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.white54, fontSize: 12),
                        ),
                        const SizedBox(height: 35),

                        // Ô nhập Email đã được tối ưu màu chữ ở file auth_textfield
                        AuthTextField(
                          controller: _emailController,
                          hintText: "Nhập Email đăng ký",
                          icon: Icons.alternate_email_rounded,
                        ),

                        const SizedBox(height: 30),

                        // Nút bấm gửi yêu cầu
                        AuthButton(
                          text: "YÊU CẦU HƯỚNG DẪN",
                          isLoading: _loading,
                          onPressed: _resetPassword,
                        ),

                        const SizedBox(height: 15),

                        // Nút quay lại
                        TextButton(
                          onPressed: () => Navigator.pop(context),
                          child: const Text("Quay lại Đăng nhập",
                              style: TextStyle(
                                  color: Color(0xFF00D2FF), fontSize: 13)),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
