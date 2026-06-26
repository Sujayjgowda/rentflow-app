import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'constants/colors.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';
import 'services/api_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Check login session status
  final token = await ApiService.getToken();
  final Widget initialScreen = token != null ? const DashboardScreen() : const LoginScreen();

  runApp(RentFlowApp(initialScreen: initialScreen));
}

class RentFlowApp extends StatelessWidget {
  final Widget initialScreen;

  const RentFlowApp({Key? key, required this.initialScreen}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'RentFlow Mobile',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFFAF7F2),
        primaryColor: ClayColors.accent,
        colorScheme: ColorScheme.fromSeed(
          seedColor: ClayColors.accent,
          primary: ClayColors.accent,
          secondary: ClayColors.accentLight,
          background: const Color(0xFFFAF7F2),
        ),
        textTheme: GoogleFonts.dmSansTextTheme(
          Theme.of(context).textTheme,
        ),
      ),
      home: initialScreen,
    );
  }
}
