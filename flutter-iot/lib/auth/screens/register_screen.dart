import 'dart:ui';
import 'package:flutter/material.dart';
import '../auth_service.dart';
import '../widgets/auth_textfield.dart';
import '../widgets/auth_button.dart';
import '../widgets/factory_background.dart';
import '../widgets/rotating_robot_arm_icon.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  // 1. Quản lý dữ liệu nhập vào
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;

  // 2. Logic đăng ký tài khoản
  void _register() async {
    setState(() => _loading = true);

    // Tạo tài khoản MongoDB qua backend API.
    final error = await AuthService()
        .register(_emailController.text.trim(), _passwordController.text);

    if (!mounted) return;
    setState(() => _loading = false);

    if (error == null) {
      // Đăng ký thành công, quay về màn hình Login
      Navigator.pop(context);
    } else {
      // Hiển thị lỗi (Ví dụ: Email đã tồn tại)
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error, style: const TextStyle(color: Colors.white)),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D1117), // Nền tối nhà máy
      // Sử dụng extendBodyBehindAppBar để nền Factory tràn lên cả thanh tiêu đề
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text("CẤP QUYỀN TRUY CẬP",
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
          // LỚP 1: Nền lưới Revit Grid
          const FactoryBackground(),

          // LỚP 2: Hiệu ứng đốm sáng trang trí
          _buildDecoration(),

          // LỚP 3: Form đăng ký kiểu Kính mờ
          Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(24),
                child: BackdropFilter(
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
                        // Icon Robot thu nhỏ hơn ở trang Login
                        const RotatingRobotArmIcon(
                            size: 50, color: Color(0xFF00D2FF)),
                        const SizedBox(height: 20),

                        const Text("ĐĂNG KÝ HỆ THỐNG",
                            style: TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1.5)),
                        const Text("Vui lòng nhập thông tin nhân sự",
                            style:
                                TextStyle(color: Colors.white38, fontSize: 12)),

                        const SizedBox(height: 35),

                        // Ô nhập Email
                        AuthTextField(
                            controller: _emailController,
                            hintText: "Email công ty",
                            icon: Icons.admin_panel_settings_outlined),

                        // Ô nhập Mật khẩu
                        AuthTextField(
                            controller: _passwordController,
                            hintText: "Mật khẩu (tối thiểu 6 ký tự)",
                            icon: Icons.lock_open_rounded,
                            obscureText: true),

                        const SizedBox(height: 30),

                        // Nút Đăng ký
                        AuthButton(
                            text: "KÍCH HOẠT TÀI KHOẢN",
                            isLoading: _loading,
                            onPressed: _register),

                        const SizedBox(height: 20),

                        // Quay lại Login
                        TextButton(
                          onPressed: () => Navigator.pop(context),
                          child: const Text("Đã có quyền truy cập? Đăng nhập",
                              style: TextStyle(
                                  color: Colors.white54, fontSize: 13)),
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

  // Widget tạo các quầng sáng trang trí
  Widget _buildDecoration() {
    return Positioned(
      top: 100,
      left: -50,
      child: Container(
        width: 200,
        height: 200,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF00D2FF).withValues(alpha: 0.15),
              blurRadius: 100,
              spreadRadius: 20,
            ),
          ],
        ),
      ),
    );
  }
}
