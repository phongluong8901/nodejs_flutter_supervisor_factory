import 'package:flutter/material.dart';

class CustomBottomNav extends StatefulWidget {
  final int currentIndex;
  final Function(int) onTap;

  const CustomBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  @override
  State<CustomBottomNav> createState() => _CustomBottomNavState();
}

class _CustomBottomNavState extends State<CustomBottomNav> {
  int? _pressingIndex;

  @override
  Widget build(BuildContext context) {
    // Line-by-line: Tính toán chiều rộng chuẩn
    double screenWidth = MediaQuery.of(context).size.width;
    double navWidth = screenWidth - 48;
    double itemWidth = navWidth / 4;

    final List<Map<String, dynamic>> navItems = [
      {'icon': Icons.analytics_outlined, 'label': 'Giám sát'},
      {'icon': Icons.precision_manufacturing, 'label': 'Máy móc'},
      {'icon': Icons.bar_chart_rounded, 'label': 'Báo cáo'},
      {'icon': Icons.person_outline, 'label': 'Cá nhân'},
    ];

    return Container(
      margin: const EdgeInsets.fromLTRB(24, 0, 24, 40),
      height: 75,
      decoration: BoxDecoration(
        color: const Color(0xFF161B22).withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(25),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.5),
              blurRadius: 20,
              offset: const Offset(0, 10)),
        ],
      ),
      child: Stack(
        children: [
          // 1. THANH CHẠY (CURSOR) - Fix vị trí chuẩn
          AnimatedPositioned(
            duration: const Duration(milliseconds: 500),
            curve: Curves.elasticOut,
            left: widget.currentIndex * itemWidth,
            bottom: 0,
            child: SizedBox(
              width: itemWidth,
              height: 4,
              child: Center(
                child: Container(
                  width: 30,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFF00D2FF),
                    borderRadius:
                        const BorderRadius.vertical(top: Radius.circular(10)),
                    boxShadow: [
                      BoxShadow(
                          color: const Color(0xFF00D2FF).withValues(alpha: 0.5),
                          blurRadius: 10),
                    ],
                  ),
                ),
              ),
            ),
          ),

          // 2. NỘI DUNG ICON VÀ TÊN
          Row(
            children: List.generate(navItems.length, (index) {
              bool isSelected = widget.currentIndex == index;
              bool isPressing = _pressingIndex == index;

              return Expanded(
                child: GestureDetector(
                  onTapDown: (_) => setState(() => _pressingIndex = index),
                  onTapUp: (_) => setState(() => _pressingIndex = null),
                  onTapCancel: () => setState(() => _pressingIndex = null),
                  onTap: () => widget.onTap(index),
                  behavior: HitTestBehavior.opaque,
                  child: AnimatedScale(
                    scale: isPressing ? 0.9 : (isSelected ? 1.1 : 1.0),
                    duration: const Duration(milliseconds: 200),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Line-by-line: Thay AnimatedContainer bằng AnimatedPadding để tránh lỗi Assertion padding < 0
                        AnimatedPadding(
                          duration: const Duration(milliseconds: 400),
                          curve: Curves.easeOutBack,
                          // Line-by-line: Chỉ dùng padding bottom để đẩy icon lên, luôn giữ giá trị >= 0
                          padding:
                              EdgeInsets.only(bottom: isSelected ? 6.0 : 0.0),
                          child: Icon(
                            navItems[index]['icon'],
                            size: 24,
                            color: isSelected
                                ? const Color(0xFF00D2FF)
                                : Colors.white24,
                            shadows: isSelected
                                ? [
                                    Shadow(
                                        color: const Color(0xFF00D2FF)
                                            .withValues(alpha: 0.6),
                                        blurRadius: 12)
                                  ]
                                : null,
                          ),
                        ),
                        // Line-by-line: Tên nhỏ đồng bộ màu và style
                        Text(
                          navItems[index]['label'],
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: isSelected
                                ? FontWeight.bold
                                : FontWeight.normal,
                            color: isSelected
                                ? const Color(0xFF00D2FF)
                                : Colors.white24,
                          ),
                        ),
                        // Line-by-line: Đệm nhẹ dưới cùng để không dính sát cursor
                        const SizedBox(height: 5),
                      ],
                    ),
                  ),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }
}
