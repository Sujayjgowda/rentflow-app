import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants/colors.dart';
import '../services/api_service.dart';
import '../widgets/clay_container.dart';
import 'dashboard_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

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
    <filter id="clayShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.1" />
    </filter>
  </defs>
  <g filter="url(#clayShadow)">
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
        if (_nameController.text.isEmpty ||
            _phoneController.text.isEmpty ||
            _emailController.text.isEmpty ||
            _passwordController.text.isEmpty) {
          setState(() {
            _errorMessage = 'All fields are required';
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
            _errorMessage = 'Account created successfully! Please login.';
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
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [ClayColors.bgGradStart, ClayColors.bgGradMid, ClayColors.bgGradEnd],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Logo SVG (Claymorphic Logo)
                  SizedBox(
                    width: 90,
                    height: 90,
                    child: SvgPicture.string(logoSvg),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'RentFlow',
                    style: GoogleFonts.lora(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: ClayColors.textDark,
                    ),
                  ),
                  Text(
                    'Smart Rent Management',
                    style: GoogleFonts.dmSans(
                      fontSize: 14,
                      color: ClayColors.textMuted,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 28),

                  // Auth Card
                  ClayContainer(
                    color: ClayColors.cardWhite,
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Tabs
                        Row(
                          children: [
                            Expanded(
                              child: GestureDetector(
                                onTap: () => setState(() => _isLogin = true),
                                child: Column(
                                  children: [
                                    Text(
                                      'Login',
                                      style: GoogleFonts.dmSans(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        color: _isLogin ? ClayColors.accent : ClayColors.textMuted,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    Container(
                                      height: 3,
                                      decoration: BoxDecoration(
                                        color: _isLogin ? ClayColors.accent : Colors.transparent,
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            Expanded(
                              child: GestureDetector(
                                onTap: () => setState(() => _isLogin = false),
                                child: Column(
                                  children: [
                                    Text(
                                      'Register',
                                      style: GoogleFonts.dmSans(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        color: !_isLogin ? ClayColors.accent : ClayColors.textMuted,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    Container(
                                      height: 3,
                                      decoration: BoxDecoration(
                                        color: !_isLogin ? ClayColors.accent : Colors.transparent,
                                        borderRadius: BorderRadius.circular(10),
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
                          Text(
                            _errorMessage!,
                            textAlign: TextAlign.center,
                            style: GoogleFonts.dmSans(
                              color: _errorMessage!.contains('success') ? ClayColors.green : ClayColors.red,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],

                        if (!_isLogin) ...[
                          // Full Name
                          _buildTextField(
                            controller: _nameController,
                            hint: 'Full Name',
                            icon: Icons.person_outline,
                          ),
                          const SizedBox(height: 16),
                          // Phone Number
                          _buildTextField(
                            controller: _phoneController,
                            hint: 'Phone Number',
                            icon: Icons.phone_outlined,
                            keyboardType: TextInputType.phone,
                          ),
                          const SizedBox(height: 16),
                        ],

                        // Email / Username
                        _buildTextField(
                          controller: _emailController,
                          hint: _isLogin ? 'Email or Phone' : 'Email Address',
                          icon: Icons.alternate_email,
                          keyboardType: TextInputType.emailAddress,
                        ),
                        const SizedBox(height: 16),

                        // Password
                        _buildTextField(
                          controller: _passwordController,
                          hint: 'Password',
                          icon: Icons.lock_outline,
                          obscureText: true,
                        ),
                        const SizedBox(height: 20),

                        // Role Selector (only for registration)
                        if (!_isLogin) ...[
                          Text(
                            'Select Role',
                            style: GoogleFonts.dmSans(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: ClayColors.textDark,
                            ),
                          ),
                          const SizedBox(height: 8),
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
                        _isLoading
                            ? const Center(child: CircularProgressIndicator())
                            : ElevatedButton(
                                onPressed: _handleSubmit,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: ClayColors.accent,
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(vertical: 16),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(50),
                                  ),
                                  elevation: 0,
                                  shadowColor: Colors.transparent,
                                ).copyWith(
                                  elevation: ButtonStyleButton.allOrNull(0),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      _isLogin ? 'Sign In' : 'Create Account',
                                      style: GoogleFonts.dmSans(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    const Icon(Icons.arrow_forward, size: 18),
                                  ],
                                ),
                              ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    bool obscureText = false,
    TextInputType keyboardType = TextInputType.text,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          insetShadow(),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: TextField(
        controller: controller,
        obscureText: obscureText,
        keyboardType: keyboardType,
        style: GoogleFonts.dmSans(color: ClayColors.textDark),
        decoration: InputDecoration(
          icon: Icon(icon, color: ClayColors.textMuted, size: 20),
          hintText: hint,
          hintStyle: GoogleFonts.dmSans(color: ClayColors.textMuted),
          border: InputBorder.none,
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
        decoration: BoxDecoration(
          color: isSelected ? ClayColors.pastelOrange : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? ClayColors.accent : const Color(0xFFE2E8F0),
            width: 1.5,
          ),
          boxShadow: isSelected
              ? []
              : [
                  const BoxShadow(
                    color: Color(0x0F1E293B),
                    offset: Offset(0, 4),
                    blurRadius: 10,
                  ),
                ],
        ),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        child: Column(
          children: [
            Icon(
              icon,
              color: isSelected ? ClayColors.accent : ClayColors.textMuted,
              size: 24,
            ),
            const SizedBox(height: 6),
            Text(
              label,
              style: GoogleFonts.dmSans(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: isSelected ? ClayColors.accent : ClayColors.textDark,
              ),
            ),
          ],
        ),
      ),
    );
  }

  BoxShadow insetShadow() {
    return const BoxShadow(
      color: Color(0x0A000000),
      offset: Offset(1, 2),
      blurRadius: 4,
      spreadRadius: 1,
    );
  }
}
