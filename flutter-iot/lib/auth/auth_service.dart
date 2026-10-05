import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class MongoSession {
  final String token;
  final Map<String, dynamic> user;

  const MongoSession({required this.token, required this.user});
}

class AuthService {
  static const _storage = FlutterSecureStorage();
  static const _tokenKey = 'mongo_auth_token';
  static final ValueNotifier<MongoSession?> session = ValueNotifier(null);

  static Future<void> initialize() async {
    final token = await _storage.read(key: _tokenKey);
    if (token == null || token.isEmpty) return;
    try {
      final response = await http.get(
        Uri.parse('${await _apiRoot()}/auth/me'),
        headers: {'Authorization': 'Bearer $token'},
      ).timeout(const Duration(seconds: 5));
      if (response.statusCode == 200) {
        session.value = MongoSession(
          token: token,
          user: Map<String, dynamic>.from(jsonDecode(response.body)),
        );
      } else {
        await _storage.delete(key: _tokenKey);
      }
    } catch (_) {
      // Keep the stored session if the API is temporarily unreachable.
      session.value = MongoSession(token: token, user: const {});
    }
  }

  Future<String?> login(String email, String password) =>
      _authenticate('login', email, password);

  Future<String?> register(String email, String password) =>
      _authenticate('register', email, password);

  Future<String?> _authenticate(
      String action, String email, String password) async {
    try {
      final response = await http
          .post(
            Uri.parse('${await _apiRoot()}/auth/$action'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'email': email.trim(), 'password': password}),
          )
          .timeout(const Duration(seconds: 12));
      final body = Map<String, dynamic>.from(jsonDecode(response.body));
      if (response.statusCode != 200 && response.statusCode != 201) {
        return body['message']?.toString() ?? 'Không thể đăng nhập.';
      }
      final token = body['token']?.toString();
      if (token == null || token.isEmpty) {
        return 'Máy chủ không trả về token đăng nhập.';
      }
      await _storage.write(key: _tokenKey, value: token);
      session.value = MongoSession(
        token: token,
        user: Map<String, dynamic>.from(body['user'] as Map),
      );
      return null;
    } on FormatException {
      return 'Phản hồi từ máy chủ không hợp lệ.';
    } catch (error) {
      return 'Không kết nối được máy chủ Mongo: $error';
    }
  }

  Future<String?> resetPassword(String email) async =>
      'Chức năng đặt lại mật khẩu qua email chưa được cấu hình. Vui lòng liên hệ quản trị viên.';

  Future<void> signOut() async {
    await _storage.delete(key: _tokenKey);
    session.value = null;
  }

  static Future<String?> getIdToken() async {
    return session.value?.token ?? await _storage.read(key: _tokenKey);
  }

  static Future<String> _apiRoot() async {
    final prefs = await SharedPreferences.getInstance();
    final savedIp = prefs.getString('server_ip');
    if (savedIp != null && savedIp.isNotEmpty) return 'http://$savedIp:3000';
    if (kIsWeb) return 'http://localhost:3000';
    return 'http://192.168.1.5:3000';
  }
}
