import 'dart:ui';
import 'package:flutter/material.dart';

class ConfirmDevices {
  // Line-by-line: Hàm static giúp hiển thị dialog từ bất kỳ đâu trong app
  static Future<bool> show(
    BuildContext context, {
    required String title,
    required String message,
    required bool isTurningOn,
  }) async {
    // Line-by-line: Sử dụng showGeneralDialog để kiểm soát hoàn toàn hiệu ứng animation
    return await showGeneralDialog<bool>(
          context: context,
          barrierDismissible: true,
          barrierLabel: '',
          barrierColor: Colors.black.withValues(
              alpha:
                  0.6), // Line-by-line: Làm tối nền hơn một chút để nổi bật Dialog
          transitionDuration: const Duration(milliseconds: 250),
          pageBuilder: (context, anim1, anim2) => const SizedBox(),
          transitionBuilder: (context, anim1, anim2, child) {
            // Line-by-line: Kết hợp hiệu ứng Scale (phóng to) và Fade (mờ dần)
            return Transform.scale(
              scale: anim1.value,
              child: Opacity(
                opacity: anim1.value,
                child: BackdropFilter(
                  filter: ImageFilter.blur(
                      sigmaX: 8,
                      sigmaY: 8), // Line-by-line: Tăng độ mờ nền Glassmorphism
                  child: AlertDialog(
                    backgroundColor:
                        const Color(0xFF1A1A2E).withValues(alpha: 0.9),
                    // Line-by-line: Bo góc mạnh hơn và thêm viền mảnh cho sang trọng
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(28),
                      side: BorderSide(
                          color: Colors.white.withValues(alpha: 0.1)),
                    ),
                    titlePadding: const EdgeInsets.fromLTRB(24, 24, 24, 10),
                    title: Row(
                      children: [
                        Icon(
                          isTurningOn
                              ? Icons.power_settings_new
                              : Icons.power_off,
                          color: isTurningOn
                              ? Colors.greenAccent
                              : Colors.redAccent,
                          size: 28,
                        ),
                        const SizedBox(width: 12),
                        Text(title,
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.bold)),
                      ],
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 24, vertical: 10),
                    content: Text(
                      message,
                      style: const TextStyle(
                          color: Colors.white70, fontSize: 15, height: 1.5),
                    ),
                    // Line-by-line: Căn chỉnh lại khu vực chứa các nút bấm
                    actionsPadding: const EdgeInsets.fromLTRB(10, 0, 16, 16),
                    actionsAlignment: MainAxisAlignment.end,
                    actions: [
                      // Line-by-line: Nút Hủy dạng text đơn giản, màu nhạt
                      TextButton(
                        onPressed: () => Navigator.pop(context, false),
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 20, vertical: 12),
                        ),
                        child: const Text("HỦY",
                            style: TextStyle(
                                color: Colors.white38, letterSpacing: 1.1)),
                      ),
                      const SizedBox(
                          width:
                              8), // Line-by-line: Tạo khoảng cách cố định giữa 2 nút
                      // Line-by-line: Nút Xác nhận dạng nổi bật (ElevatedButton)
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: isTurningOn
                              ? Colors.greenAccent.withValues(alpha: 0.15)
                              : Colors.redAccent.withValues(alpha: 0.15),
                          foregroundColor: isTurningOn
                              ? Colors.greenAccent
                              : Colors.redAccent,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 24, vertical: 12),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(15),
                              side: BorderSide(
                                color: (isTurningOn
                                        ? Colors.greenAccent
                                        : Colors.redAccent)
                                    .withValues(alpha: 0.5),
                                width: 1,
                              )),
                        ),
                        onPressed: () => Navigator.pop(context, true),
                        child: const Text("XÁC NHẬN",
                            style: TextStyle(
                                fontWeight: FontWeight.bold,
                                letterSpacing: 0.5)),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ) ??
        false;
  }
}
