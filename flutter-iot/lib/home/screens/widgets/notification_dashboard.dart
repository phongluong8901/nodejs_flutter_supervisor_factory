import 'package:flutter/material.dart';

class NotificationDashboard extends StatefulWidget {
  final String message;
  const NotificationDashboard({super.key, required this.message});

  @override
  State<NotificationDashboard> createState() => _NotificationDashboardState();
}

class _NotificationDashboardState extends State<NotificationDashboard>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    // Line-by-line: Để tốc độ 8 giây sẽ tạo cảm giác mượt và dễ đọc hơn 10 giây
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
    if (widget.message.isEmpty) return const SizedBox.shrink();

    return Container(
      height: 32, // Line-by-line: Tăng nhẹ chiều cao để dải chữ nhìn thoáng hơn
      width: double.infinity,
      margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 15),
      decoration: BoxDecoration(
        // Line-by-line: Tạo nền màu tối trong suốt (hiệu ứng kính) để làm nổi bật chữ Neon
        color: Colors.redAccent.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
            color: Colors.redAccent.withValues(alpha: 0.15), width: 0.5),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Stack(
          children: [
            AnimatedBuilder(
              animation: _controller,
              builder: (context, child) {
                return FractionalTranslation(
                  // Line-by-line: Sửa logic Offset để chữ chạy từ ngoài hẳn màn hình vào (1.5 -> -1.5)
                  translation: Offset(1.5 - (_controller.value * 3.0), 0),
                  child: child,
                );
              },
              child: ShaderMask(
                // Line-by-line: ShaderMask giúp chữ mờ dần ở 2 đầu dải chạy, tránh bị cắt đột ngột
                shaderCallback: (bounds) => LinearGradient(
                  colors: [
                    Colors.white.withValues(alpha: 0.0),
                    Colors.white,
                    Colors.white,
                    Colors.white.withValues(alpha: 0.0)
                  ],
                  stops: const [0.0, 0.15, 0.85, 1.0],
                ).createShader(bounds),
                blendMode: BlendMode.dstIn,
                child: Center(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Line-by-line: Thêm icon nhấp nháy nhẹ (nếu muốn) hoặc icon tĩnh để tăng tính thẩm mỹ
                      const Icon(Icons.flash_on,
                          color: Colors.redAccent, size: 14),
                      const SizedBox(width: 8),
                      Text(
                        widget.message.toUpperCase(),
                        style: const TextStyle(
                          color: Colors.redAccent,
                          fontWeight: FontWeight.w900,
                          fontSize: 11,
                          letterSpacing: 1.5,
                          shadows: [
                            // Line-by-line: Đổ bóng màu đỏ nhạt tạo hiệu ứng chữ Neon đang phát sáng
                            Shadow(color: Colors.redAccent, blurRadius: 12),
                          ],
                        ),
                        maxLines: 1,
                        softWrap: false,
                        overflow: TextOverflow.visible,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
