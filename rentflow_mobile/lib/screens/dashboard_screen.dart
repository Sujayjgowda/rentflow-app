import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../constants/colors.dart';
import '../services/api_service.dart';
import '../widgets/glass_card.dart';
import '../widgets/animated_stat_card.dart';
import '../widgets/status_chip.dart';
import '../utils/helpers.dart';
import 'login_screen.dart';
import 'properties_screen.dart';
import 'payments_screen.dart';
import 'tenants_screen.dart';
import 'more_screen.dart';

import '../widgets/glass_scaffold.dart';

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

    return GlassScaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
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

            // Upcoming Dues Section
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Upcoming Dues',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                StatusChip(status: '${upcomingDuesList.length} Dues'),
              ],
            ),
            const SizedBox(height: 12),
            upcomingDuesList.isEmpty
                ? _buildEmptyState('No upcoming rent dues 🎉')
                : ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: upcomingDuesList.length,
                    itemBuilder: (context, index) {
                      final item = upcomingDuesList[index];
                      final amount = parseDouble(item['amount']);
                      final dueDate = parseDateTime(item['due_date']);
                      final dateStr = DateFormat('dd MMM yyyy').format(dueDate);

                      return _buildListItem(
                        title: item['property_name'] ?? 'Property',
                        subtitle: 'Due on $dateStr · ${item['tenant_name'] ?? 'Tenant'}',
                        amount: _formatCurrency(amount),
                        isPending: true,
                      );
                    },
                  ),
            const SizedBox(height: 28),

            // Recent Collections
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Recent Collections',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                StatusChip(status: '${recentPaymentsList.length} Paid'),
              ],
            ),
            const SizedBox(height: 12),
            recentPaymentsList.isEmpty
                ? _buildEmptyState('No payments logged recently.')
                : ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: recentPaymentsList.length,
                    itemBuilder: (context, index) {
                      final item = recentPaymentsList[index];
                      final amount = parseDouble(item['amount']);
                      final payDate = parseDateTime(item['payment_date'] ?? item['date_paid']);
                      final dateStr = DateFormat('dd MMM yyyy').format(payDate);

                      return _buildListItem(
                        title: item['tenant_name'] ?? 'Tenant',
                        subtitle: 'Paid on $dateStr · ${item['property_name'] ?? ''}',
                        amount: _formatCurrency(amount),
                        isPending: false,
                      );
                    },
                  ),
          ],
        ),
      ),
    );
  }

  Widget _buildListItem({
    required String title,
    required String subtitle,
    required String amount,
    required bool isPending,
  }) {
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: isPending ? AppColors.errorBg : AppColors.successBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: (isPending ? AppColors.error : AppColors.success).withOpacity(0.3),
              ),
            ),
            child: Icon(
              isPending ? Icons.warning_amber_rounded : Icons.check_circle_outline,
              color: isPending ? AppColors.error : AppColors.success,
              size: 20,
            ),
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
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          Text(
            amount,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: isPending ? AppColors.error : AppColors.success,
            ),
          ),
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
        color: AppColors.bgDark,
        border: Border(top: BorderSide(color: AppColors.glassBorder)),
      ),
      child: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        backgroundColor: AppColors.bgDark,
        selectedItemColor: AppColors.accentCyan,
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
