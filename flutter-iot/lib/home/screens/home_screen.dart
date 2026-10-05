import 'package:flutter/material.dart';
import 'package:my_production_app/home/screens/tabs/analytics_tab.dart';
import 'package:my_production_app/home/screens/tabs/dashboard_tab.dart';
import 'package:my_production_app/home/screens/tabs/devices_tab.dart';
import 'package:my_production_app/home/screens/tabs/profile_tab.dart';
import 'package:my_production_app/home/screens/widgets/custom_bottom_nav.dart';
import 'package:my_production_app/home/widgets/home_header.dart';
import '../../auth/widgets/factory_background.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;

  // Line-by-line: Danh sách thông tin động cho Header
  final List<String> _titles = ["OPERATOR", "DEVICES", "ANALYTICS", "PROFILE"];
  final List<String> _subTitles = [
    "HỆ THỐNG GIÁM SÁT",
    "TRẠM ĐIỀU KHIỂN",
    "DỰ BÁO VẬN HÀNH",
    "CÀI ĐẶT CÁ NHÂN"
  ];

  final List<Widget> _tabs = [
    const DashboardTab(),
    const DevicesTab(),
    const AnalyticsTab(),
    const ProfileTab(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D1117),
      extendBody: true,
      body: Stack(
        children: [
          const FactoryBackground(),
          Column(
            children: [
              // Line-by-line: Header nhận dữ liệu động dựa trên index
              HomeHeader(
                title: _titles[_selectedIndex],
                subTitle: _subTitles[_selectedIndex],
              ),
              Expanded(
                child: IndexedStack(
                  index: _selectedIndex,
                  children: _tabs,
                ),
              ),
            ],
          ),
        ],
      ),
      bottomNavigationBar: CustomBottomNav(
        currentIndex: _selectedIndex,
        onTap: (index) {
          setState(() {
            _selectedIndex = index;
          });
        },
      ),
    );
  }
}
