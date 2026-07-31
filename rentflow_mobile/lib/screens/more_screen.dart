import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants/colors.dart';
import '../services/api_service.dart';
import '../widgets/glass_card.dart';
import 'agreements_screen.dart';
import 'bills_screen.dart';
import 'advances_screen.dart';
import 'login_screen.dart';

class MoreScreen extends StatefulWidget {
  const MoreScreen({super.key});

  @override
  State<MoreScreen> createState() => _MoreScreenState();
}

class _MoreScreenState extends State<MoreScreen> {
  Map<String, dynamic>? _user;

  @override
  void initState() {
    super.initState();
    _loadUser();
  }

  Future<void> _loadUser() async {
    final user = await ApiService.getUser();
    setState(() {
      _user = user;
    });
  }

  Future<void> _logout() async {
    await ApiService.clearSession();
    if (mounted) {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (context) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = _user?['name'] ?? 'User';
    final email = _user?['email'] ?? 'No Email';
    final phone = _user?['phone'] ?? 'No Phone';
    final role = (_user?['role'] ?? 'landlord').toString().toUpperCase();

    return Scaffold(
      backgroundColor: Colors.white,
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Profile Card
            GlassCard(
              padding: const EdgeInsets.all(20),
              backgroundColor: AppColors.accentPurple,
              opacity: 0.12,
              child: Row(
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: const BoxDecoration(
                      gradient: AppColors.accentGradient,
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        name.isNotEmpty ? name[0].toUpperCase() : 'U',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 24,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '$email · $phone',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.accentPurple.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: AppColors.accentPurple.withOpacity(0.4),
                            ),
                          ),
                          child: Text(
                            role,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: AppColors.accentCyan,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),

            Text(
              'MANAGEMENT',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.textMuted,
                letterSpacing: 1,
              ),
            ),
            const SizedBox(height: 12),

            _buildMenuItem(
              icon: Icons.description_outlined,
              gradient: AppColors.accentGradient,
              title: 'Lease Agreements',
              subtitle: 'View and manage rent agreements & documents',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const AgreementsScreen(),
                  ),
                );
              },
            ),
            const SizedBox(height: 12),

            _buildMenuItem(
              icon: Icons.receipt_long_outlined,
              gradient: AppColors.warmGradient,
              title: 'Shared Utility Bills',
              subtitle: 'Track electricity, water & maintenance split bills',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const BillsScreen()),
                );
              },
            ),
            const SizedBox(height: 12),

            _buildMenuItem(
              icon: Icons.account_balance_wallet_outlined,
              gradient: AppColors.greenGradient,
              title: 'Advance Security Payments',
              subtitle: 'Manage security deposits & advance payments',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const AdvancesScreen(),
                  ),
                );
              },
            ),
            const SizedBox(height: 28),

            Text(
              'ACCOUNT & SESSION',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.textMuted,
                letterSpacing: 1,
              ),
            ),
            const SizedBox(height: 12),

            _buildMenuItem(
              icon: Icons.logout,
              gradient: const LinearGradient(
                colors: [Color(0xFFEF4444), Color(0xFFF87171)],
              ),
              title: 'Logout',
              subtitle: 'Sign out of your account on this device',
              isDestructive: true,
              onTap: () {
                showDialog(
                  context: context,
                  builder: (context) => AlertDialog(
                    backgroundColor: Colors.white,
                    title: Text(
                      'Logout',
                      style: GoogleFonts.plusJakartaSans(
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    content: Text(
                      'Are you sure you want to log out?',
                      style: GoogleFonts.plusJakartaSans(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: Text(
                          'Cancel',
                          style: GoogleFonts.plusJakartaSans(
                            color: AppColors.textMuted,
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed: () {
                          Navigator.pop(context);
                          _logout();
                        },
                        child: Text(
                          'Logout',
                          style: GoogleFonts.plusJakartaSans(
                            color: AppColors.error,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMenuItem({
    required IconData icon,
    required Gradient gradient,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
    bool isDestructive = false,
  }) {
    return GlassCard(
      onTap: onTap,
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              gradient: gradient,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: Colors.white, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: isDestructive
                        ? AppColors.error
                        : AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: AppColors.textMuted,
                  ),
                ),
              ],
            ),
          ),
          Icon(
            Icons.chevron_right,
            color: AppColors.textMuted.withOpacity(0.5),
          ),
        ],
      ),
    );
  }
}
