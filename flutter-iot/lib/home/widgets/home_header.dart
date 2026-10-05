import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/iot_provider.dart';

class HomeHeader extends StatelessWidget {
  final String title;
  final String subTitle;

  const HomeHeader({super.key, required this.title, required this.subTitle});

  @override
  Widget build(BuildContext context) {
    // Line-by-line: Lắng nghe toàn bộ thay đổi từ IotProvider
    final iot = context.watch<IotProvider>();
    final theme = Theme.of(context);

    // Line-by-line: Lấy thông tin user hiện tại từ Provider
    final user = iot.currentUser;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(25, 60, 25, 35),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            theme.colorScheme.primary.withValues(alpha: 0.15),
            theme.colorScheme.surface.withValues(alpha: 0.05),
          ],
        ),
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(35)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        children: [
          // --- HÀNG 1: TIÊU ĐỀ TAB & NÚT THÔNG BÁO ---
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.sensors_rounded,
                          color: Color(0xFF00D2FF), size: 14),
                      const SizedBox(width: 6),
                      Text(
                        subTitle.toUpperCase(),
                        style: const TextStyle(
                          color: Color(0xFF00D2FF),
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1.8,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 26,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
              _buildNotificationCircle(context, iot),
            ],
          ),

          const SizedBox(height: 5),
          Divider(color: Colors.white.withValues(alpha: 0.05), height: 1),
          const SizedBox(height: 5),

          // --- HÀNG 2: THÔNG TIN NGƯỜI DÙNG THỰC TẾ ---
          Row(
            children: [
              // Line-by-line: Hiển thị Avatar từ URL hoặc Icon mặc định nếu trống
              Container(
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                      color: const Color(0xFF00D2FF).withValues(alpha: 0.2)),
                ),
                child: CircleAvatar(
                  radius: 18,
                  backgroundColor: Colors.white10,
                  backgroundImage: (user != null && user['avatarUrl'] != null)
                      ? NetworkImage(user['avatarUrl'])
                      : null,
                  child: (user == null || user['avatarUrl'] == null)
                      ? const Icon(Icons.person,
                          color: Color(0xFF00D2FF), size: 18)
                      : null,
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Line-by-line: Hiển thị displayName từ MongoDB
                  Text(
                    user != null
                        ? user['displayName'] ?? "Người dùng"
                        : "Đang tải...",
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: const BoxDecoration(
                            color: Colors.greenAccent, shape: BoxShape.circle),
                      ),
                      const SizedBox(width: 6),
                      // Line-by-line: Hiển thị role (ví dụ: Kỹ sư, Admin) từ MongoDB
                      Text(
                        "${user != null ? user['role'] ?? 'Thành viên' : '...'} • Ca trực",
                        style: const TextStyle(
                            color: Colors.white38, fontSize: 11),
                      ),
                    ],
                  ),
                ],
              ),
              const Spacer(),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.03),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  DateFormat('dd/MM/yyyy').format(DateTime.now()),
                  style: const TextStyle(
                      color: Colors.white24,
                      fontSize: 10,
                      fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // --- Các hàm Build phụ giữ nguyên logic của cậu ---
  Widget _buildNotificationCircle(BuildContext context, IotProvider iot) {
    return GestureDetector(
      onTap: () => _showNotificationPanel(context),
      child: Container(
        height: 50,
        width: 50,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.05),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white12, width: 1.5),
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            const Icon(Icons.notifications_active_outlined,
                color: Colors.white, size: 24),
            if (iot.unreadCount > 0)
              Positioned(
                top: 13,
                right: 13,
                child: Container(
                  height: 9,
                  width: 9,
                  decoration: BoxDecoration(
                    color: Colors.redAccent,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.black, width: 1.5),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _showNotificationPanel(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0D1117),
      elevation: 0,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(30))),
      builder: (context) {
        final iotSheet = context.watch<IotProvider>();
        final docs = iotSheet.logs;

        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.6,
          maxChildSize: 0.9,
          builder: (context, scrollController) {
            return Column(
              children: [
                const SizedBox(height: 8),
                Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                        color: Colors.white24,
                        borderRadius: BorderRadius.circular(10))),
                Padding(
                  padding: const EdgeInsets.all(25),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text("NHẬT KÝ HỆ THỐNG",
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 16)),
                      if (docs.isNotEmpty)
                        TextButton(
                          onPressed: () => iotSheet.deleteAllNotifications(),
                          child: const Text("Xóa hết",
                              style: TextStyle(
                                  color: Colors.redAccent,
                                  fontWeight: FontWeight.bold)),
                        ),
                    ],
                  ),
                ),
                const Divider(color: Colors.white10, height: 1),
                Expanded(
                  child: docs.isEmpty
                      ? const Center(
                          child: Text("Không có thông báo",
                              style: TextStyle(color: Colors.white38)))
                      : ListView.builder(
                          controller: scrollController,
                          itemCount: docs.length,
                          itemBuilder: (context, index) {
                            final data = docs[index];
                            return ListTile(
                              leading: Icon(
                                data['type'] == 'warning'
                                    ? Icons.warning_amber_rounded
                                    : Icons.info_outline,
                                color: data['type'] == 'warning'
                                    ? Colors.orange
                                    : Colors.blue,
                              ),
                              title: Text(data['title'],
                                  style: const TextStyle(
                                      color: Colors.white, fontSize: 14)),
                              subtitle: Text(data['message'],
                                  style: const TextStyle(
                                      color: Colors.white38, fontSize: 12)),
                              onTap: () => iotSheet.markAsRead(data['id']),
                            );
                          },
                        ),
                ),
              ],
            );
          },
        );
      },
    );
  }
}
