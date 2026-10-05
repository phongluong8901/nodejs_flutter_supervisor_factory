import 'package:my_production_app/auth/auth_service.dart';

class AuthCheck {
  static Future<String?> getIdToken() => AuthService.getIdToken();
}
