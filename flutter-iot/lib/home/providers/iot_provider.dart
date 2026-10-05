import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:my_production_app/home/providers/auth_check.dart';
import 'package:my_production_app/auth/auth_service.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:my_production_app/home/screens/widgets/head_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart'; // Line-by-line: Thư viện HTTP mạnh mẽ để upload file

class IotProvider extends ChangeNotifier {
  // --- CẤU HÌNH URL ĐỘNG ---

  // Line-by-line: Hàm lấy Base URL (có đuôi /iot) từ SharedPreferences hoặc .env
  Future<String> get _baseUrl async {
    final prefs = await SharedPreferences.getInstance();
    String? savedIp = prefs.getString('server_ip');

    // Line-by-line: Ưu tiên sử dụng IP do người dùng nhập thủ công nếu có
    if (savedIp != null && savedIp.isNotEmpty) {
      return "http://$savedIp:3000/iot";
    }

    // Line-by-line: Nếu không có IP thủ công, dùng giá trị mặc định từ file .env
    if (kIsWeb) {
      return "http://localhost:3000/iot";
    } else if (defaultTargetPlatform == TargetPlatform.android) {
      return "http://192.168.1.5:3000/iot";
    } else {
      return "http://192.168.1.5:3000/iot";
    }
  }

  // Line-by-line: Hàm lấy Root URL (bỏ đuôi /iot) để dùng cho các API user/socket
  Future<String> get _rootUrl async {
    final base = await _baseUrl;
    return base.replaceAll('/iot', '');
  }

  io.Socket? socket;
  final Dio _dio = Dio();

  // --- BIẾN TRẠNG THÁI ---
  double _temp = 0.0, _pressure = 0.0, _humidity = 0.0, _light = 0.0;
  bool _isOnline = false;
  Map<String, dynamic> _devicesControl = {};
  bool _isNotificationEnabled = true;
  bool get isNotificationEnabled => _isNotificationEnabled;

  Map<String, dynamic>? _currentUser;
  Map<String, dynamic>? get currentUser => _currentUser;

  final Map<String, bool> _activeMonitors = {
    "temperature": true,
    "pressure": true,
    "light_intensity": true,
    "humidity": true,
  };

  List<dynamic> _logs = [];
  List<dynamic> get logs => _logs;
  int get unreadCount => _logs.where((log) => log['is_read'] == false).length;

  List<double> tempHistory = List.generate(15, (index) => 0.0);
  List<double> pressureHistory = List.generate(15, (index) => 0.0);
  List<double> humiHistory = List.generate(15, (index) => 0.0);
  List<double> lightHistory = List.generate(15, (index) => 0.0);

  Timer? _timer;

  // --- GETTERS ---
  double get temp => _temp;
  double get pressure => _pressure;
  double get humidity => _humidity;
  double get light => _light;
  bool get isOnline => _isOnline;
  Map<String, dynamic> get devicesControl => _devicesControl;
  Map<String, bool> get activeMonitors => _activeMonitors;

  Future<Map<String, String>> _getHeaders() async {
    String? token = await AuthCheck.getIdToken();
    return {
      "Content-Type": "application/json",
      "Authorization": "Bearer $token",
    };
  }

  IotProvider() {
    _loadNotificationSettings();
    AuthService.session.addListener(_onSessionChanged);
    fetchIotStatus();
    fetchMe();
    _startGlobalTimer();
    _initSocket();
  }

  void _onSessionChanged() {
    if (AuthService.session.value == null) {
      socket?.dispose();
      socket = null;
      _currentUser = null;
      _devicesControl = {};
      _logs = [];
      _temp = 0;
      _pressure = 0;
      _humidity = 0;
      _light = 0;
      _isOnline = false;
      notifyListeners();
      return;
    }
    _initSocket();
    fetchMe();
    fetchIotStatus();
    fetchLogs();
  }

  // --- QUẢN LÝ USER PROFILE ---

  Future<void> fetchMe() async {
    try {
      final headers = await _getHeaders();
      final root = await _rootUrl; // Line-by-line: Đợi lấy root URL động
      final url = '${root.trim()}/auth/me';
      final response = await http.get(Uri.parse(url), headers: headers);

      if (response.statusCode == 200) {
        _currentUser = jsonDecode(response.body);
        notifyListeners();
      } else {
        debugPrint("❌ Fetch Me Failed: ${response.statusCode}");
      }
    } catch (e) {
      debugPrint("Fetch Profile Error: $e");
    }
  }

  // --- UPLOAD ẢNH ĐẠI DIỆN ---
  bool _isUploading = false;
  bool get isUploading => _isUploading;

  Future<void> uploadAvatar(XFile imageFile) async {
    _isUploading = true;
    notifyListeners();

    try {
      String? token = await AuthCheck.getIdToken();
      final root = await _rootUrl; // Line-by-line: Đợi lấy root URL động
      final String uploadUrl = "${root.trim()}/auth/upload-avatar";

      MultipartFile multipartFile;

      if (kIsWeb) {
        final bytes = await imageFile.readAsBytes();
        multipartFile = MultipartFile.fromBytes(
          bytes,
          filename: imageFile.name,
        );
      } else {
        multipartFile = await MultipartFile.fromFile(
          imageFile.path,
          filename: imageFile.name,
        );
      }

      FormData formData = FormData.fromMap({"file": multipartFile});

      var response = await _dio.post(
        uploadUrl,
        data: formData,
        options: Options(
          headers: {
            "Authorization": "Bearer $token",
            "Accept": "application/json",
          },
        ),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        if (response.data['success'] == true) {
          debugPrint("✅ Thành công trên ${kIsWeb ? 'Web' : 'Mobile'}");
          await fetchMe();
        }
      }
    } catch (e) {
      debugPrint("❌ Lỗi upload chi tiết: $e");
    } finally {
      _isUploading = false;
      notifyListeners();
    }
  }

  Future<bool> updateUserProfile(Map<String, dynamic> updateData) async {
    try {
      final headers = await _getHeaders();
      String root = await _rootUrl; // Line-by-line: Đợi lấy root URL động
      if (root.endsWith('/')) {
        root = root.substring(0, root.length - 1);
      }
      final url = Uri.parse('$root/auth/me');

      final response = await http.patch(
        url,
        headers: headers,
        body: jsonEncode(updateData),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        await fetchMe();
        return true;
      }
      return false;
    } catch (e) {
      debugPrint("--- ❌ LỖI UPDATE: $e ---");
      return false;
    }
  }

  // --- LOGIC THÔNG BÁO ---
  Future<void> _loadNotificationSettings() async {
    final prefs = await SharedPreferences.getInstance();
    _isNotificationEnabled = prefs.getBool('noti_enabled') ?? true;
    notifyListeners();
  }

  Future<void> toggleNotificationPermission(bool value) async {
    _isNotificationEnabled = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('noti_enabled', value);
    notifyListeners();
  }

  // --- SOCKET ---
  void _initSocket() async {
    final token = await AuthCheck.getIdToken();
    if (token == null) return;
    socket?.dispose();
    final socketUrl = await _rootUrl;
    socket = io.io(
      socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .enableAutoConnect()
          .build(),
    );

    socket!.onConnect((_) => debugPrint("✅ Socket Connected: ${socket?.id}"));
    socket!.on('sensor-alert', (data) {
      if (!_isNotificationEnabled || _activeMonitors[data['sensor']] != true) {
        return;
      }
      NotificationService.showLocalAlert(data['title'] ?? 'Cảnh báo',
          data['message'] ?? 'Phát hiện bất thường!');
      fetchLogs();
    });
  }

  // --- API LOGS & STATUS ---
  Future<void> fetchLogs() async {
    try {
      final headers = await _getHeaders();
      final base = await _baseUrl; // Line-by-line: Đợi lấy base URL động
      final response = await http.get(
        Uri.parse('$base/logs'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        _logs = jsonDecode(response.body);
        notifyListeners();
      }
    } catch (e) {
      debugPrint("Logs Error: $e");
    }
  }

  Future<void> deleteAllNotifications() async {
    try {
      final headers = await _getHeaders();
      final base = await _baseUrl;
      await http.delete(Uri.parse('$base/logs'), headers: headers);
      _logs.clear();
      notifyListeners();
    } catch (e) {
      debugPrint("Delete Error: $e");
    }
  }

  Future<void> markAsRead(String id) async {
    try {
      final headers = await _getHeaders();
      final base = await _baseUrl;
      final response = await http.patch(
        Uri.parse('$base/logs/$id'),
        headers: headers,
        body: jsonEncode({"is_read": true}),
      );
      if (response.statusCode == 200) await fetchLogs();
    } catch (e) {
      debugPrint("Update Error: $e");
    }
  }

  Future<void> deleteSingleLog(String id) async {
    try {
      final headers = await _getHeaders();
      final base = await _baseUrl;
      await http.delete(Uri.parse('$base/logs/$id'), headers: headers);
      await fetchLogs();
    } catch (e) {
      debugPrint("Delete Single Error: $e");
    }
  }

  // --- LOGIC MÀU SẮC ---
  Color getTempColor() => _temp > 40.0
      ? Colors.redAccent
      : (_temp > 30.0 ? Colors.orangeAccent : Colors.greenAccent);
  Color getHumidityColor() =>
      (_humidity < 30 || _humidity > 80) ? Colors.redAccent : Colors.cyanAccent;
  Color getPressureColor() => _pressure < 970 || _pressure > 1050
      ? Colors.redAccent
      : (_pressure < 990 || _pressure > 1030
          ? Colors.orangeAccent
          : Colors.greenAccent);
  Color getLightColor() => _light < 50 || _light > 3000
      ? Colors.redAccent
      : (_light < 250 || _light > 2400
          ? Colors.orangeAccent
          : Colors.yellowAccent);

  String getStatusText(double val, String type) {
    switch (type) {
      case 'temp':
        return val > 40.0
            ? "QUÁ NHIỆT (Bật quạt)"
            : (val > 30.0 ? "Nhiệt độ cao" : "Ổn định");
      case 'humi':
        return (val < 30 || val > 80) ? "ẨM NGUY HIỂM (Mở cửa)" : "Tốt";
      case 'pressure':
        return (val < 970 || val > 1050)
            ? "ÁP SUẤT NGUY HIỂM"
            : (val < 990 || val > 1030 ? "Áp suất bất thường" : "Ổn định");
      case 'light':
        return (val < 50 || val > 3000)
            ? "CƯỜNG ĐỘ ÁNH SÁNG NGUY HIỂM"
            : "Bình thường";
      default:
        return "Bình thường";
    }
  }

  void toggleMonitoring(String key) {
    if (_activeMonitors.containsKey(key)) {
      _activeMonitors[key] = !(_activeMonitors[key]!);
      notifyListeners();
    }
  }

  Future<void> fetchIotStatus() async {
    try {
      final headers = await _getHeaders();
      final base = await _baseUrl; // Line-by-line: Lấy URL động cho status
      final response = await http
          .get(Uri.parse('$base/status'), headers: headers)
          .timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final sensors = Map<String, dynamic>.from(data['iot_sensors'] ?? {});
        double valueFor(String key) =>
            ((sensors[key] as Map?)?['value'] as num?)?.toDouble() ?? 0;
        _temp = valueFor('temperature');
        _pressure = valueFor('pressure');
        _light = valueFor('light_intensity');
        _humidity = valueFor('humidity');
        _isOnline = (sensors['temperature'] as Map?)?['is_online'] == true;
        _devicesControl =
            Map<String, dynamic>.from(data['devices_control'] ?? {});

        _updateList(tempHistory, _temp);
        _updateList(pressureHistory, _pressure);
        _updateList(humiHistory, _humidity);
        _updateList(lightHistory, _light);
        notifyListeners();
      }
    } catch (e) {
      debugPrint("Error Status: $e");
    }
  }

  // --- ĐIỀU KHIỂN THIẾT BỊ ---
  Future<void> toggleDevicePower(String deviceKey, bool status) async {
    try {
      final headers = await _getHeaders();
      final base = await _baseUrl; // Line-by-line: Lấy URL động cho control
      final body = {"name": deviceKey, "is_on": status};
      final response = await http.post(
        Uri.parse('$base/control'),
        headers: headers,
        body: jsonEncode(body),
      );
      if (response.statusCode == 200) await fetchIotStatus();
    } catch (e) {
      debugPrint("Error Control: $e");
    }
  }

  Future<bool> updateDeviceSettings(
    String deviceId,
    Map<String, dynamic> updateData,
  ) async {
    try {
      final headers = await _getHeaders();
      final base = await _baseUrl;
      final response = await http.patch(
        Uri.parse('$base/devices/$deviceId'),
        headers: headers,
        body: jsonEncode(updateData),
      );
      if (response.statusCode == 200) {
        await fetchIotStatus();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<void> resetDeviceHealth(String deviceId) async {
    try {
      final headers = await _getHeaders();
      final base = await _baseUrl;
      final response = await http.post(
        Uri.parse('$base/devices/$deviceId/reset-health'),
        headers: headers,
      );
      if (response.statusCode == 200) await fetchIotStatus();
    } catch (e) {
      debugPrint("Error Health: $e");
    }
  }

  void _startGlobalTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(
      const Duration(seconds: 3),
      (timer) => fetchIotStatus(),
    );
  }

  void _updateList(List<double> list, double newValue) {
    if (list.length >= 15) list.removeAt(0);
    list.add(newValue);
  }

  @override
  void dispose() {
    AuthService.session.removeListener(_onSessionChanged);
    _timer?.cancel();
    socket?.dispose();
    super.dispose();
  }
}
