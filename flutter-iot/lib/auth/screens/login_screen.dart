import 'dart:ui';
import 'dart:math'; // Line-by-line: Cần thiết để tính toán quỹ đạo bay cho Robot
import 'package:flutter/material.dart';

// Giả định các file này đã tồn tại trong project của bạn
import '../auth_service.dart';
import '../widgets/auth_textfield.dart';
import '../widgets/auth_button.dart';
import 'register_screen.dart';
import 'forgot_password_screen.dart';
import '../widgets/factory_background.dart';

// --------------------------------------------------------------------------
// 1. WIDGET ROBOT BAY (Dùng chung cho cả Robot phía sau)
// --------------------------------------------------------------------------
class MovingIotIcon extends StatefulWidget {
  const MovingIotIcon({super.key});

  @override
  State<MovingIotIcon> createState() => _MovingIotIconState();
}

class _MovingIotIconState extends State<MovingIotIcon>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    // Line-by-line: Khởi tạo vòng lặp 8 giây để Robot bay lượn chậm rãi
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        // Line-by-line: Công thức Sin/Cos tạo quỹ đạo Elip quanh tâm màn hình
        double dx = sin(_controller.value * 2 * pi) * 110;
        double dy = cos(_controller.value * 2 * pi) * 40;

        return Positioned(
          left: MediaQuery.of(context).size.width / 2 + dx - 40,
          top: 150 + dy,
          child: Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF00D2FF).withValues(alpha: 0.2),
                  blurRadius: 20,
                  spreadRadius: 2,
                ),
              ],
            ),
            // Line-by-line: Hiển thị Robot GIF thay vì Icon cũ
            child: Image.asset(
              'assets/images/arm_robot.gif',
              fit: BoxFit.contain,
              errorBuilder: (context, e, s) =>
                  const Icon(Icons.error, color: Colors.red),
            ),
          ),
        );
      },
    );
  }
}

// --------------------------------------------------------------------------
// 2. MÀN HÌNH ĐĂNG NHẬP CHÍNH
// --------------------------------------------------------------------------
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;

  // Authenticate using the MongoDB-backed API.
  void _login() async {
    setState(() => _loading = true);
    final error = await AuthService()
        .login(_emailController.text.trim(), _passwordController.text);

    if (!mounted) return;
    setState(() => _loading = false);

    if (error != null) {
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
      backgroundColor: const Color(0xFF0D1117),
      body: Stack(
        children: [
          // LỚP 1: Nền Grid hệ thống
          const FactoryBackground(),

          // LỚP 2: Các quầng sáng trang trí (Neon Glow)
          _buildBackgroundDecoration(),

          // LỚP 3: Robot GIF bay lượn phía dưới tấm kính
          const MovingIotIcon(),

          // LỚP 4: Form đăng nhập Kính mờ (Glassmorphism)
          Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24.0),
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
                        // Logo Robot GIF trên đỉnh Form
                        _buildAnimatedLogo(),

                        const SizedBox(height: 15),
                        const Text(
                          "SMART FACTORY",
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 3,
                          ),
                        ),
                        const Text(
                          "CONSTRUCTION IOT SYSTEM",
                          style: TextStyle(
                              color: Colors.white54,
                              fontSize: 10,
                              letterSpacing: 1),
                        ),
                        const SizedBox(height: 40),

                        // Các ô nhập liệu
                        AuthTextField(
                          controller: _emailController,
                          hintText: "ID Nhân viên / Email",
                          icon: Icons.sensors,
                        ),
                        const SizedBox(height: 15),
                        AuthTextField(
                          controller: _passwordController,
                          hintText: "Mật khẩu hệ thống",
                          icon: Icons.vpn_key_outlined,
                          obscureText: true,
                        ),

                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton(
                            onPressed: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                    builder: (c) =>
                                        const ForgotPasswordScreen())),
                            child: const Text("Quên mật khẩu?",
                                style: TextStyle(color: Color(0xFF00D2FF))),
                          ),
                        ),

                        const SizedBox(height: 20),
                        AuthButton(
                          text: "KẾT NỐI HỆ THỐNG",
                          isLoading: _loading,
                          onPressed: _login,
                        ),
                        const SizedBox(height: 25),
                        GestureDetector(
                          onTap: () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                  builder: (c) => const RegisterScreen())),
                          child: const Text(
                            "Yêu cầu cấp quyền truy cập mới",
                            style: TextStyle(
                                color: Colors.white70,
                                decoration: TextDecoration.underline),
                          ),
                        )
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

  // Line-by-line: Widget hiển thị Robot GIF cố định làm Logo
  Widget _buildAnimatedLogo() {
    return Container(
      width: 90,
      height: 90,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF00D2FF).withValues(alpha: 0.4),
            blurRadius: 30,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Image.asset(
        'assets/images/arm_robot.gif', // Line-by-line: Đường dẫn file GIF
        fit: BoxFit.contain,
      ),
    );
  }

  // Line-by-line: Hàm tạo quầng sáng trang trí Neon cho nền
  Widget _buildBackgroundDecoration() {
    return Stack(
      children: [
        Positioned(
          top: -100,
          right: -50,
          child: Container(
            width: 300,
            height: 300,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF00D2FF).withValues(alpha: 0.2),
                  blurRadius: 150,
                  spreadRadius: 50,
                ),
              ],
            ),
          ),
        ),
        Positioned(
          bottom: -100,
          left: -50,
          child: Container(
            width: 300,
            height: 300,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Colors.orange.withValues(alpha: 0.1),
                  blurRadius: 150,
                  spreadRadius: 50,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }
}
