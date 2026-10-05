import 'package:flutter/material.dart';
import 'package:glassmorphism/glassmorphism.dart';
import 'package:my_production_app/home/providers/iot_provider.dart';
import 'package:provider/provider.dart';

class DeviceDetailSheet extends StatefulWidget {
  final String deviceId;
  final dynamic data;
  final String deviceKey; // Sửa lại param này để dùng đúng key từ Provider

  const DeviceDetailSheet({
    super.key,
    required this.deviceId,
    required this.data,
    required this.deviceKey,
  });

  @override
  State<DeviceDetailSheet> createState() => _DeviceDetailSheetState();
}

class _DeviceDetailSheetState extends State<DeviceDetailSheet> {
  // Line-by-line: Controllers quản lý input
  late TextEditingController _nameController;
  late TextEditingController _powerController;
  late TextEditingController _runtimeController;
  bool _isEditing = false;

  @override
  void initState() {
    super.initState();
    // Line-by-line: Khởi tạo giá trị ban đầu
    _nameController =
        TextEditingController(text: widget.data['name']?.toString());
    _powerController =
        TextEditingController(text: widget.data['power']?.toString() ?? "0");
    _runtimeController =
        TextEditingController(text: widget.data['runtime']?.toString() ?? "0");
  }

  @override
  void dispose() {
    _nameController.dispose();
    _powerController.dispose();
    _runtimeController.dispose();
    super.dispose();
  }

  Future<void> _saveChanges() async {
    final iot = context.read<IotProvider>();
    final updateData = {
      'name': _nameController.text,
      'power': _powerController.text,
      'runtime': _runtimeController.text,
    };

    // Line-by-line: Gọi API cập nhật thông qua deviceKey (ID thật của thiết bị)
    bool success = await iot.updateDeviceSettings(widget.deviceKey, updateData);

    if (success && mounted) {
      setState(() => _isEditing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text("Hệ thống đã ghi nhận cấu hình mới"),
            backgroundColor: Colors.green),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final iot = context.read<IotProvider>();

    return GlassmorphicContainer(
      width: double.infinity,
      // Line-by-line: Tăng chiều cao để nhìn thoáng đãng hơn
      height: MediaQuery.of(context).size.height * 0.8,
      borderRadius: 35,
      blur: 30,
      alignment: Alignment.center,
      border: 0.5,
      linearGradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Colors.black.withValues(alpha: 0.8),
          const Color(0xFF0D1117).withValues(alpha: 0.9)
        ],
      ),
      borderGradient: LinearGradient(
        colors: [
          _isEditing ? Colors.greenAccent : const Color(0xFF00D2FF),
          Colors.transparent
        ],
      ),
      child: Stack(
        children: [
          // Hiệu ứng đốm sáng trang trí bên trong Sheet
          Positioned(
              top: -50,
              right: -50,
              child: _buildInnerGlow(
                  150, const Color(0xFF00D2FF).withValues(alpha: 0.1))),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 25),
            child: Column(
              children: [
                const SizedBox(height: 15),
                // Thanh kéo Handle
                Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                        color: Colors.white12,
                        borderRadius: BorderRadius.circular(10))),
                const SizedBox(height: 25),

                // Header Sheet
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text("NODE CONFIGURATION",
                            style: TextStyle(
                                color: Color(0xFF00D2FF),
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 2)),
                        Text(_isEditing ? "CHỈNH SỬA" : "CHI TIẾT THIẾT BỊ",
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 22,
                                fontWeight: FontWeight.w900)),
                      ],
                    ),
                    _buildEditButton(),
                  ],
                ),

                const SizedBox(height: 15),
                const Divider(color: Colors.white10),
                const SizedBox(height: 15),

                Expanded(
                  child: SingleChildScrollView(
                    physics: const BouncingScrollPhysics(),
                    child: Column(
                      children: [
                        // Card 1: Thông tin định danh
                        _buildSectionCard("THÔNG SỐ VẬN HÀNH", [
                          _buildEditableRow(Icons.badge_outlined,
                              "Tên thiết bị", _nameController),
                          _buildEditableRow(Icons.flash_on_outlined,
                              "Công suất (W)", _powerController),
                          _buildEditableRow(Icons.timer_outlined,
                              "Giờ chạy (h)", _runtimeController),
                        ]),

                        const SizedBox(height: 20),

                        // Card 2: Trạng thái phần cứng (Read-only)
                        _buildSectionCard("TRẠNG THÁI HỆ THỐNG", [
                          _infoRow(
                              Icons.favorite_border,
                              "Sức khỏe thiết bị",
                              "${widget.data['health'] ?? 100}%",
                              Colors.greenAccent),
                          _infoRow(
                              Icons.sensors_outlined,
                              "Trạng thái",
                              widget.data['status'] ?? "Hoạt động",
                              Colors.blueAccent),
                          _infoRow(Icons.router_outlined, "Node ID",
                              widget.deviceKey, Colors.white38),
                        ]),

                        const SizedBox(height: 35),

                        // Nút hành động
                        _isEditing
                            ? _actionButton(
                                "LƯU THAY ĐỔI",
                                Icons.check_circle_outline,
                                Colors.greenAccent,
                                _saveChanges)
                            : _actionButton(
                                "BẢO TRÌ THIẾT BỊ",
                                Icons.handyman_outlined,
                                const Color(0xFF00D2FF), () {
                                iot.resetDeviceHealth(widget.deviceKey);
                                Navigator.pop(context);
                              }),
                        const SizedBox(height: 50), // Padding cho bottom
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // --- WIDGET CẤU TRÚC CARD CON ---
  Widget _buildSectionCard(String title, List<Widget> children) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(25),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                  color: Colors.white24,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1)),
          const SizedBox(height: 10),
          ...children,
        ],
      ),
    );
  }

  Widget _buildEditButton() {
    return GestureDetector(
      onTap: () => setState(() => _isEditing = !_isEditing),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: _isEditing
              ? Colors.redAccent.withValues(alpha: 0.1)
              : const Color(0xFF00D2FF).withValues(alpha: 0.1),
          shape: BoxShape.circle,
        ),
        child: Icon(_isEditing ? Icons.close : Icons.edit_note_rounded,
            color: _isEditing ? Colors.redAccent : const Color(0xFF00D2FF),
            size: 24),
      ),
    );
  }

  Widget _buildEditableRow(
      IconData icon, String label, TextEditingController controller) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Icon(icon,
              color: const Color(0xFF00D2FF).withValues(alpha: 0.5), size: 20),
          const SizedBox(width: 15),
          Expanded(
            child: _isEditing
                ? TextField(
                    controller: controller,
                    style: const TextStyle(color: Colors.white, fontSize: 15),
                    decoration: InputDecoration(
                      labelText: label,
                      labelStyle:
                          const TextStyle(color: Colors.white24, fontSize: 12),
                      enabledBorder: const UnderlineInputBorder(
                          borderSide: BorderSide(color: Colors.white10)),
                      focusedBorder: const UnderlineInputBorder(
                          borderSide: BorderSide(color: Color(0xFF00D2FF))),
                    ),
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label,
                          style: const TextStyle(
                              color: Colors.white24, fontSize: 11)),
                      Text(controller.text,
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold)),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Icon(icon, color: color.withValues(alpha: 0.5), size: 20),
          const SizedBox(width: 15),
          Text(label,
              style: const TextStyle(color: Colors.white70, fontSize: 14)),
          const Spacer(),
          Text(value,
              style: TextStyle(
                  color: color, fontWeight: FontWeight.w900, fontSize: 14)),
        ],
      ),
    );
  }

  Widget _actionButton(
      String label, IconData icon, Color color, VoidCallback onPressed) {
    return InkWell(
      onTap: onPressed,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 18),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color.withValues(alpha: 0.5)),
          gradient: LinearGradient(colors: [
            color.withValues(alpha: 0.2),
            color.withValues(alpha: 0.05)
          ]),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(width: 12),
            Text(label,
                style: TextStyle(
                    color: color,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.5)),
          ],
        ),
      ),
    );
  }

  Widget _buildInnerGlow(double size, Color color) {
    return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(shape: BoxShape.circle, color: color));
  }
}
