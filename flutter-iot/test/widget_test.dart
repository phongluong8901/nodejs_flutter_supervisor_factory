import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:my_production_app/auth/screens/login_screen.dart';

void main() {
  testWidgets('shows the Mongo-backed login form', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: LoginScreen()));

    expect(find.text('SMART FACTORY'), findsOneWidget);
    expect(find.text('KẾT NỐI HỆ THỐNG'), findsOneWidget);
    expect(find.text('ĐĂNG NHẬP VỚI GOOGLE'), findsNothing);
  });
}
