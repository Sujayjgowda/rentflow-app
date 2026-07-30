import 'package:flutter/material.dart';
import 'constants/app_theme.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';
import 'services/api_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Check login session status
  final token = await ApiService.getToken();
  final Widget initialScreen =
      token != null ? const DashboardScreen() : const LoginScreen();

  runApp(RentFlowApp(initialScreen: initialScreen));
}

class RentFlowApp extends StatelessWidget {
  final Widget initialScreen;

  const RentFlowApp({super.key, required this.initialScreen});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'RentFlow Mobile',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.dark,
      home: initialScreen,
    );
  }
}
