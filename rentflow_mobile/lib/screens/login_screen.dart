import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants/colors.dart';
import '../services/api_service.dart';
import '../widgets/glass_card.dart';
import '../widgets/glass_text_field.dart';
import '../widgets/gradient_button.dart';
import 'dashboard_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();

  bool _isLogin = true;
  String _role = 'landlord'; // 'landlord' or 'tenant'
  bool _isLoading = false;
  bool _obscurePassword = true;
  String? _errorMessage;

  static const String logoSvg = '''
<svg viewBox="0 0 64 64" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="roofGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffb86c" />
      <stop offset="100%" stop-color="#e28743" />
    </linearGradient>
    <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#e2e8f0" />
    </linearGradient>
    <linearGradient id="doorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#60a5fa" />
      <stop offset="100%" stop-color="#2563eb" />
    </linearGradient>
    <linearGradient id="arrowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4ade80" />
      <stop offset="100%" stop-color="#16a34a" />
    </linearGradient>
  </defs>
  <g>
    <rect x="18" y="24" width="28" height="24" rx="6" fill="url(#bodyGrad)" />
    <rect x="28" y="34" width="8" height="14" rx="2" fill="url(#doorGrad)" />
    <path d="M 12 26 L 30 10 C 31 9, 33 9, 34 10 L 52 26 C 53.5 27.2, 52.5 29, 50.5 29 L 13.5 29 C 11.5 29, 10.5 27.2, 12 26 Z" fill="url(#roofGrad)" />
    <rect x="42" y="14" width="5" height="10" rx="1.5" fill="#e28743" />
    <path d="M 11 44 C 9 53, 33 56, 44 48" fill="none" stroke="url(#arrowGrad)" stroke-width="4.5" stroke-linecap="round" />
    <path d="M 44 48 L 47 42 L 39 45 Z" fill="url(#arrowGrad)" stroke="url(#arrowGrad)" stroke-width="1.5" stroke-linejoin="round" />
  </g>
</svg>
''';

  Future<void> _handleSubmit() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      if (_isLogin) {
        if (_emailController.text.trim().isEmpty ||
            _passwordController.text.isEmpty) {
          setState(() {
            _errorMessage = 'Please fill in all fields.';
            _isLoading = false;
          });
          return;
        }

        final result = await ApiService.login(
          _emailController.text.trim(),
          _passwordController.text,
        );

        if (result['success']) {
          if (mounted) {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (context) => const DashboardScreen()),
            );
          }
        } else {
          setState(() {
            _errorMessage = result['message'];
          });
        }
      } else {
        if (_nameController.text.trim().isEmpty ||
            _phoneController.text.trim().isEmpty ||
            _emailController.text.trim().isEmpty ||
            _passwordController.text.isEmpty) {
          setState(() {
            _errorMessage = 'All fields are required for registration.';
            _isLoading = false;
          });
          return;
        }

        final result = await ApiService.register(
          name: _nameController.text.trim(),
          phone: _phoneController.text.trim(),
          email: _emailController.text.trim(),
          password: _passwordController.text,
          role: _role,
        );

        if (result['success']) {
          setState(() {
            _isLogin = true;
            _errorMessage = 'Account created successfully! Please sign in.';
          });
        } else {
          setState(() {
            _errorMessage = result['message'];
          });
        }
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Connection error: Could not reach backend.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
              padding:
                  const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // App Logo with glowing ring
                  Container(
                    width: 88,
                    height: 88,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.glassBorder),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.accentPurple.withOpacity(0.12),
                          blurRadius: 20,
                          spreadRadius: 0,
                        ),
                      ],
                    ),
                    child: SvgPicture.string(logoSvg),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'RentFlow',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 32,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Smart Rent & Portfolio Management',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Auth Glass Card
                  GlassCard(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Tab Selector (Login / Register)
                        Row(
                          children: [
                            Expanded(
                              child: GestureDetector(
                                onTap: () => setState(() {
                                  _isLogin = true;
                                  _errorMessage = null;
                                }),
                                child: Column(
                                  children: [
                                    Text(
                                      'Sign In',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w700,
                                        color: _isLogin
                                            ? AppColors.accentCyan
                                            : AppColors.textMuted,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Container(
                                      height: 3,
                                      decoration: BoxDecoration(
                                        gradient: _isLogin
                                            ? AppColors.accentGradient
                                            : null,
                                        color: _isLogin
                                            ? null
                                            : Colors.transparent,
                                        borderRadius:
                                            BorderRadius.circular(10),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            Expanded(
                              child: GestureDetector(
                                onTap: () => setState(() {
                                  _isLogin = false;
                                  _errorMessage = null;
                                }),
                                child: Column(
                                  children: [
                                    Text(
                                      'Register',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w700,
                                        color: !_isLogin
                                            ? AppColors.accentCyan
                                            : AppColors.textMuted,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Container(
                                      height: 3,
                                      decoration: BoxDecoration(
                                        gradient: !_isLogin
                                            ? AppColors.accentGradient
                                            : null,
                                        color: !_isLogin
                                            ? null
                                            : Colors.transparent,
                                        borderRadius:
                                            BorderRadius.circular(10),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 24),

                        if (_errorMessage != null) ...[
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: _errorMessage!.contains('success')
                                  ? AppColors.successBg
                                  : AppColors.errorBg,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: _errorMessage!.contains('success')
                                    ? AppColors.success.withOpacity(0.3)
                                    : AppColors.error.withOpacity(0.3),
                              ),
                            ),
                            child: Text(
                              _errorMessage!,
                              textAlign: TextAlign.center,
                              style: GoogleFonts.plusJakartaSans(
                                color: _errorMessage!.contains('success')
                                    ? AppColors.success
                                    : AppColors.error,
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],

                        if (!_isLogin) ...[
                          // Full Name
                          GlassTextField(
                            controller: _nameController,
                            hintText: 'Full Name',
                            prefixIcon: Icons.person_outline,
                          ),
                          const SizedBox(height: 14),
                          // Phone Number
                          GlassTextField(
                            controller: _phoneController,
                            hintText: 'Phone Number',
                            prefixIcon: Icons.phone_outlined,
                            keyboardType: TextInputType.phone,
                          ),
                          const SizedBox(height: 14),
                        ],

                        // Email / Username
                        GlassTextField(
                          controller: _emailController,
                          hintText: _isLogin
                              ? 'Email or Phone Number'
                              : 'Email Address',
                          prefixIcon: Icons.alternate_email,
                          keyboardType: TextInputType.emailAddress,
                        ),
                        const SizedBox(height: 14),

                        // Password
                        GlassTextField(
                          controller: _passwordController,
                          hintText: 'Password',
                          prefixIcon: Icons.lock_outline,
                          obscureText: _obscurePassword,
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscurePassword
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                              color: AppColors.textMuted,
                              size: 20,
                            ),
                            onPressed: () => setState(
                              () => _obscurePassword = !_obscurePassword,
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),

                        // Role Selector (only for registration)
                        if (!_isLogin) ...[
                          Text(
                            'Select Account Type',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                child: _buildRoleCard(
                                  role: 'landlord',
                                  label: 'Landlord',
                                  icon: Icons.domain,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: _buildRoleCard(
                                  role: 'tenant',
                                  label: 'Tenant',
                                  icon: Icons.person_outline,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 24),
                        ],

                        // Submit Button
                        GradientButton(
                          text: _isLogin ? 'Sign In' : 'Create Account',
                          isLoading: _isLoading,
                          icon: _isLogin ? Icons.login : Icons.person_add,
                          onPressed: _handleSubmit,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

  Widget _buildRoleCard({
    required String role,
    required String label,
    required IconData icon,
  }) {
    final isSelected = _role == role;
    return GestureDetector(
      onTap: () => setState(() => _role = role),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.accentPurple.withOpacity(0.2)
              : AppColors.surfaceLight,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected
                ? AppColors.accentPurple
                : AppColors.glassBorder,
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              color: isSelected ? AppColors.accentCyan : AppColors.textMuted,
              size: 22,
            ),
            const SizedBox(height: 6),
            Text(
              label,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: isSelected
                    ? AppColors.accentCyan
                    : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
