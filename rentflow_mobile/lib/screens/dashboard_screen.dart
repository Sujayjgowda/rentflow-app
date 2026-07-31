import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../constants/colors.dart';
import '../services/api_service.dart';
import '../widgets/glass_card.dart';
import '../widgets/animated_stat_card.dart';
import '../utils/helpers.dart';
import 'login_screen.dart';
import 'properties_screen.dart';
import 'payments_screen.dart';
import 'tenants_screen.dart';
import 'more_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _currentIndex = 0;
  Map<String, dynamic>? _user;
  Map<String, dynamic>? _dashboardData;
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final user = await ApiService.getUser();
      final data = await ApiService.getDashboard();

      setState(() {
        _user = user;
        _dashboardData = data;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to sync with Render server.';
        _isLoading = false;
      });
    }
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

  void _sendWhatsAppReminder({
    required String phone,
    required String tenantName,
    required String propertyName,
    required String amount,
    required String dueDate,
    String billType = 'rent',
  }) async {
    final cleanPhone = phone.replaceAll(RegExp(r'[^0-9]'), '');
    final msg = Uri.encodeComponent(
      'Hi $tenantName, this is a friendly reminder that your $billType of $amount for $propertyName is due on $dueDate. Please pay at your earliest convenience. — RentFlow',
    );
    final url = Uri.parse('https://wa.me/$cleanPhone?text=$msg');
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  void _callTenant(String phone) async {
    final cleanPhone = phone.replaceAll(RegExp(r'[^0-9+]'), '');
    final url = Uri.parse('tel:$cleanPhone');
    if (await canLaunchUrl(url)) {
      await launchUrl(url);
    }
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> screens = [
      _buildHomeTab(),
      const PropertiesScreen(),
      const PaymentsScreen(),
      const TenantsScreen(),
      const MoreScreen(),
    ];

    final titles = ['RentFlow', 'Properties', 'Payments', 'Tenants', 'More Options'];

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                gradient: AppColors.accentGradient,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.home_work_rounded, color: Colors.white, size: 20),
            ),
            const SizedBox(width: 10),
            Text(
              titles[_currentIndex],
              style: GoogleFonts.plusJakartaSans(
                fontWeight: FontWeight.w800,
                fontSize: 20,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: AppColors.textMuted),
            onPressed: _logout,
            tooltip: 'Logout',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.accentPurple),
            )
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          _errorMessage!,
                          style: GoogleFonts.plusJakartaSans(
                            color: AppColors.error,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 14),
                        ElevatedButton.icon(
                          onPressed: _loadInitialData,
                          icon: const Icon(Icons.refresh),
                          label: const Text('Retry Connection'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.accentPurple,
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              : IndexedStack(
                  index: _currentIndex,
                  children: screens,
                ),
      bottomNavigationBar: _buildBottomNavBar(),
    );
  }

  Widget _buildHomeTab() {
    final stats = _dashboardData?['stats'] ?? {};
    final upcomingDues = _dashboardData?['upcomingDues'] ?? [];
    final recentPayments =
        _dashboardData?['recentPayments'] ?? _dashboardData?['recentTransactions'] ?? [];

    final monthlyIncome = parseDouble(stats['monthlyIncome']);
    final propertyCount = parseInt(stats['propertyCount']);
    final occupiedProps = parseInt(stats['occupiedCount']);
    final vacantProps = propertyCount - occupiedProps;
    final tenantCount = parseInt(stats['tenantCount']);
    final overdueCount = parseInt(stats['overdueCount']);

    final upcomingDuesList = upcomingDues as List<dynamic>;
    final recentPaymentsList = recentPayments as List<dynamic>;

    final totalPending = upcomingDuesList.fold<double>(
      0.0,
      (sum, item) => sum + parseDouble(item['amount']),
    );

    final String firstName = _user?['name']?.split(' ')[0] ?? 'User';

    return RefreshIndicator(
      onRefresh: _loadInitialData,
      color: AppColors.accentPurple,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Welcome Section
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Welcome back, $firstName 👋',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        "Portfolio overview for this month",
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 44,
                  height: 44,
                  decoration: const BoxDecoration(
                    gradient: AppColors.accentGradient,
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      firstName.isNotEmpty ? firstName[0].toUpperCase() : 'U',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Horizontal Scrollable Stat Cards
            SizedBox(
              height: 145,
              child: ListView(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                children: [
                  AnimatedStatCard(
                    title: 'MONTHLY REVENUE',
                    value: _formatCurrency(monthlyIncome),
                    subtitle: 'Collected this month',
                    icon: Icons.account_balance_wallet,
                    gradient: AppColors.greenGradient,
                  ),
                  const SizedBox(width: 14),
                  AnimatedStatCard(
                    title: 'PROPERTIES',
                    value: '$propertyCount',
                    subtitle: '$occupiedProps occupied · $vacantProps vacant',
                    icon: Icons.domain,
                    gradient: AppColors.accentGradient,
                  ),
                  const SizedBox(width: 14),
                  AnimatedStatCard(
                    title: 'PENDING DUES',
                    value: _formatCurrency(totalPending),
                    subtitle: '$overdueCount tenants overdue',
                    icon: Icons.warning_amber_rounded,
                    gradient: AppColors.warmGradient,
                  ),
                  const SizedBox(width: 14),
                  AnimatedStatCard(
                    title: 'ACTIVE TENANTS',
                    value: '$tenantCount',
                    subtitle: 'Active in portfolio',
                    icon: Icons.people_alt,
                    gradient: const LinearGradient(
                      colors: [Color(0xFF3B82F6), Color(0xFF60A5FA)],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),

            // ── THIS MONTH: Dues & Payments Pictorial Tracker ──
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'This Month',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.accentPurple.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    DateFormat('MMM yyyy').format(DateTime.now()),
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.accentPurple,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Show dues with pictorial icons
            if (upcomingDuesList.isEmpty && recentPaymentsList.isEmpty)
              _buildEmptyState('No payment activity this month 🎉')
            else ...[
              // PENDING DUES with reminder action
              if (upcomingDuesList.isNotEmpty) ...[
                _buildSectionLabel('Due Payments', Icons.schedule, AppColors.error),
                const SizedBox(height: 10),
                ...upcomingDuesList.map((item) {
                  final amount = parseDouble(item['amount']);
                  final dueDate = parseDateTime(item['due_date']);
                  final dateStr = DateFormat('dd MMM yyyy').format(dueDate);
                  final tenantName = item['tenant_name'] ?? 'Tenant';
                  final propertyName = item['property_name'] ?? 'Property';
                  final phone = item['tenant_phone'] ?? '';

                  return _buildBillTrackingCard(
                    icon: Icons.home_rounded,
                    iconColor: AppColors.error,
                    iconBgColor: AppColors.errorBg,
                    title: '🏠 Rent — $propertyName',
                    subtitle: '$tenantName · Due $dateStr',
                    amount: _formatCurrency(amount),
                    isPaid: false,
                    phone: phone,
                    tenantName: tenantName,
                    propertyName: propertyName,
                    dueDate: dateStr,
                    amountRaw: _formatCurrency(amount),
                  );
                }),
                const SizedBox(height: 20),
              ],

              // PAID THIS MONTH
              if (recentPaymentsList.isNotEmpty) ...[
                _buildSectionLabel('Paid This Month', Icons.check_circle, AppColors.success),
                const SizedBox(height: 10),
                ...recentPaymentsList.map((item) {
                  final amount = parseDouble(item['amount']);
                  final payDate = parseDateTime(item['payment_date'] ?? item['date_paid']);
                  final dateStr = DateFormat('dd MMM yyyy').format(payDate);
                  final tenantName = item['tenant_name'] ?? 'Tenant';
                  final propertyName = item['property_name'] ?? 'Property';

                  return _buildBillTrackingCard(
                    icon: Icons.home_rounded,
                    iconColor: AppColors.success,
                    iconBgColor: AppColors.successBg,
                    title: '🏠 Rent — $propertyName',
                    subtitle: '$tenantName · Paid $dateStr',
                    amount: _formatCurrency(amount),
                    isPaid: true,
                  );
                }),
              ],
            ],
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionLabel(String text, IconData icon, Color color) {
    return Row(
      children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(width: 8),
        Text(
          text,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
      ],
    );
  }

  Widget _buildBillTrackingCard({
    required IconData icon,
    required Color iconColor,
    required Color iconBgColor,
    required String title,
    required String subtitle,
    required String amount,
    required bool isPaid,
    String phone = '',
    String tenantName = '',
    String propertyName = '',
    String dueDate = '',
    String amountRaw = '',
  }) {
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Row(
            children: [
              // Pictorial Icon
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: iconBgColor,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: iconColor, size: 22),
              ),
              const SizedBox(width: 14),
              // Text
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              // Amount & Status
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    amount,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: isPaid ? AppColors.success : AppColors.error,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: isPaid ? AppColors.successBg : AppColors.errorBg,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      isPaid ? 'PAID' : 'DUE',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: isPaid ? AppColors.success : AppColors.error,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
          // Reminder action row for unpaid
          if (!isPaid && phone.isNotEmpty) ...[
            const SizedBox(height: 12),
            Divider(color: AppColors.divider, height: 1),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: InkWell(
                    borderRadius: BorderRadius.circular(10),
                    onTap: () => _sendWhatsAppReminder(
                      phone: phone,
                      tenantName: tenantName,
                      propertyName: propertyName,
                      amount: amountRaw,
                      dueDate: dueDate,
                    ),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF25D366).withOpacity(0.08),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.chat, color: const Color(0xFF25D366), size: 16),
                          const SizedBox(width: 6),
                          Text(
                            'WhatsApp Reminder',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFF25D366),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: () => _callTenant(phone),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                    decoration: BoxDecoration(
                      color: AppColors.infoBg,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.phone, color: AppColors.info, size: 16),
                        const SizedBox(width: 6),
                        Text(
                          'Call',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.info,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildEmptyState(String message) {
    return GlassCard(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      child: Center(
        child: Text(
          message,
          style: GoogleFonts.plusJakartaSans(
            color: AppColors.textMuted,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }

  String _formatCurrency(double amt) {
    final format = NumberFormat.currency(
      locale: 'en_IN',
      symbol: '₹',
      decimalDigits: 0,
    );
    return format.format(amt);
  }

  Widget _buildBottomNavBar() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.glassBorder)),
      ),
      child: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        backgroundColor: Colors.white,
        selectedItemColor: AppColors.accentPurple,
        unselectedItemColor: AppColors.textMuted,
        type: BottomNavigationBarType.fixed,
        selectedLabelStyle: GoogleFonts.plusJakartaSans(
          fontWeight: FontWeight.w700,
          fontSize: 11,
        ),
        unselectedLabelStyle: GoogleFonts.plusJakartaSans(
          fontWeight: FontWeight.w500,
          fontSize: 11,
        ),
        elevation: 0,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_outlined),
            activeIcon: Icon(Icons.dashboard_rounded),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.home_work_outlined),
            activeIcon: Icon(Icons.home_work_rounded),
            label: 'Properties',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.payments_outlined),
            activeIcon: Icon(Icons.payments_rounded),
            label: 'Payments',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.people_outline),
            activeIcon: Icon(Icons.people_rounded),
            label: 'Tenants',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.grid_view_outlined),
            activeIcon: Icon(Icons.grid_view_rounded),
            label: 'More',
          ),
        ],
      ),
    );
  }
}
