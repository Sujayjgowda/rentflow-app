import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../constants/colors.dart';
import '../services/api_service.dart';
import '../widgets/clay_container.dart';
import 'login_screen.dart';
import 'properties_screen.dart';
import 'payments_screen.dart';
import 'tenants_screen.dart';
import 'bills_screen.dart';
import 'agreements_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({Key? key}) : super(key: key);

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
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> screens = [
      _buildHomeTab(),
      const PropertiesScreen(),
      const PaymentsScreen(),
    ];

    final titles = ['RentFlow', 'Properties', 'Payments'];

    return Scaffold(
      drawer: _buildDrawer(),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x0A000000),
                    offset: Offset(0, 4),
                    blurRadius: 8,
                  ),
                ],
              ),
              child: const Center(
                child: Text('🏠', style: TextStyle(fontSize: 16)),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              titles[_currentIndex],
              style: GoogleFonts.lora(
                fontWeight: FontWeight.bold,
                fontSize: 20,
                color: ClayColors.textDark,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_outlined, color: ClayColors.textMuted),
            onPressed: _logout,
            tooltip: 'Logout',
          ),
        ],
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [ClayColors.bgGradStart, ClayColors.bgGradMid, ClayColors.bgGradEnd],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _errorMessage != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            _errorMessage!,
                            style: GoogleFonts.dmSans(color: ClayColors.red, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 12),
                          ElevatedButton(
                            onPressed: _loadInitialData,
                            child: const Text('Retry Connection'),
                          ),
                        ],
                      ),
                    ),
                  )
                : screens[_currentIndex],
      ),
      bottomNavigationBar: _buildBottomNavBar(),
    );
  }

  Widget _buildHomeTab() {
    final stats = _dashboardData?['stats'] ?? {};
    final upcomingDues = _dashboardData?['upcomingDues'] ?? [];
    final recentPayments = _dashboardData?['recentPayments'] ?? _dashboardData?['recentTransactions'] ?? [];

    final monthlyIncome = (stats['monthlyIncome'] ?? 0).toDouble();
    final propertyCount = stats['propertyCount'] ?? 0;
    final occupiedProps = stats['occupiedCount'] ?? 0;
    final vacantProps = propertyCount - occupiedProps;
    final tenantCount = stats['tenantCount'] ?? 0;
    final overdueCount = stats['overdueCount'] ?? 0;

    final upcomingDuesList = upcomingDues as List<dynamic>;
    final recentPaymentsList = recentPayments as List<dynamic>;

    final totalPending = upcomingDuesList.fold<double>(
      0.0,
      (sum, item) => sum + ((item['amount'] ?? 0) as num).toDouble(),
    );

    final String firstName = _user?['name']?.split(' ')[0] ?? 'User';

    return RefreshIndicator(
      onRefresh: _loadInitialData,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Welcome Section
            Text(
              'Welcome back, $firstName 👋',
              style: GoogleFonts.lora(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: ClayColors.textDark,
              ),
            ),
            Text(
              "Here is your portfolio overview for this month",
              style: GoogleFonts.dmSans(
                fontSize: 14,
                color: ClayColors.textMuted,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 24),

            // Horizontal Scrollable Cards
            SizedBox(
              height: 145,
              child: ListView(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                children: [
                  // Total Rent Collected
                  _buildStatCard(
                    title: 'Total Collected',
                    value: _formatCurrency(monthlyIncome),
                    subtext: 'Collected this month',
                    icon: '🏦',
                    cardColor: ClayColors.pastelOrange,
                    iconColor: const Color(0xFFFDE68A),
                    shadowColor: ClayColors.accent,
                  ),
                  const SizedBox(width: 16),
                  // Properties
                  _buildStatCard(
                    title: 'Properties',
                    value: '$propertyCount',
                    subtext: '$occupiedProps occupied · $vacantProps vacant',
                    icon: '🏠',
                    cardColor: ClayColors.pastelGreen,
                    iconColor: const Color(0xFFBBF7D0),
                    shadowColor: ClayColors.green,
                  ),
                  const SizedBox(width: 16),
                  // Pending Dues
                  _buildStatCard(
                    title: 'Pending Dues',
                    value: _formatCurrency(totalPending),
                    subtext: '▼ $overdueCount tenants overdue',
                    icon: '⚠️',
                    cardColor: ClayColors.pastelRed,
                    iconColor: const Color(0xFFFECACA),
                    shadowColor: ClayColors.red,
                  ),
                  const SizedBox(width: 16),
                  // Active Tenants
                  _buildStatCard(
                    title: 'Active Tenants',
                    value: '$tenantCount',
                    subtext: '▲ active in portfolio',
                    icon: '👥',
                    cardColor: ClayColors.pastelBlue,
                    iconColor: const Color(0xFFBFDBFE),
                    shadowColor: ClayColors.blue,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),

            // Upcoming Dues Section
            Text(
              'Upcoming Dues',
              style: GoogleFonts.lora(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: ClayColors.textDark,
              ),
            ),
            const SizedBox(height: 12),
            upcomingDuesList.isEmpty
                ? _buildEmptyState('No upcoming dues.')
                : ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: upcomingDuesList.length,
                    itemBuilder: (context, index) {
                      final item = upcomingDuesList[index];
                      final amount = (item['amount'] ?? 0).toDouble();
                      final dueDate = DateTime.parse(item['due_date']);
                      final dateStr = DateFormat('dd MMM yyyy').format(dueDate);

                      return _buildListItem(
                        title: item['property_name'] ?? 'Property',
                        subtitle: 'Due date: $dateStr',
                        amount: _formatCurrency(amount),
                        isPending: true,
                      );
                    },
                  ),
            const SizedBox(height: 28),

            // Recent Collections
            Text(
              'Recent Collections',
              style: GoogleFonts.lora(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: ClayColors.textDark,
              ),
            ),
            const SizedBox(height: 12),
            recentPaymentsList.isEmpty
                ? _buildEmptyState('No recent payments.')
                : ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: recentPaymentsList.length,
                    itemBuilder: (context, index) {
                      final item = recentPaymentsList[index];
                      final amount = (item['amount'] ?? 0).toDouble();
                      final payDate = DateTime.parse(item['payment_date']);
                      final dateStr = DateFormat('dd MMM yyyy').format(payDate);

                      return _buildListItem(
                        title: item['tenant_name'] ?? 'Tenant',
                        subtitle: 'Paid on $dateStr · ${item['property_name']}',
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

  Widget _buildStatCard({
    required String title,
    required String value,
    required String subtext,
    required String icon,
    required Color cardColor,
    required Color iconColor,
    required Color shadowColor,
  }) {
    return ClayContainer(
      width: 175,
      color: cardColor,
      shadowColor: shadowColor,
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              ClayContainer(
                width: 38,
                height: 38,
                radius: 10,
                color: iconColor,
                depth: 3,
                shadowColor: shadowColor,
                child: Center(
                  child: Text(icon, style: const TextStyle(fontSize: 18)),
                ),
              ),
            ],
          ),
          const Spacer(),
          Text(
            title,
            style: GoogleFonts.dmSans(
              fontSize: 11,
              color: ClayColors.textMuted,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: GoogleFonts.lora(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: ClayColors.textDark,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            subtext,
            style: GoogleFonts.dmSans(
              fontSize: 10,
              color: ClayColors.textMuted,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildListItem({
    required String title,
    required String subtitle,
    required String amount,
    required bool isPending,
  }) {
    return ClayContainer(
      color: Colors.white,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: isPending ? ClayColors.pastelRed : ClayColors.pastelGreen,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                isPending ? '⚠️' : '💸',
                style: const TextStyle(fontSize: 18),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.dmSans(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: ClayColors.textDark,
                  ),
                ),
                Text(
                  subtitle,
                  style: GoogleFonts.dmSans(
                    fontSize: 12,
                    color: ClayColors.textMuted,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          Text(
            amount,
            style: GoogleFonts.lora(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: isPending ? ClayColors.red : ClayColors.green,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(String message) {
    return ClayContainer(
      color: Colors.white,
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      child: Center(
        child: Text(
          message,
          style: GoogleFonts.dmSans(
            color: ClayColors.textMuted,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }

  String _formatCurrency(double amt) {
    final format = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    return format.format(amt);
  }

  Widget _buildBottomNavBar() {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Color(0x0A000000),
            offset: Offset(0, -4),
            blurRadius: 10,
          ),
        ],
      ),
      child: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        backgroundColor: Colors.white,
        selectedItemColor: ClayColors.accent,
        unselectedItemColor: ClayColors.textMuted,
        selectedLabelStyle: GoogleFonts.dmSans(fontWeight: FontWeight.bold, fontSize: 12),
        unselectedLabelStyle: GoogleFonts.dmSans(fontWeight: FontWeight.w500, fontSize: 12),
        elevation: 0,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_outlined),
            activeIcon: Icon(Icons.dashboard),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.home_work_outlined),
            activeIcon: Icon(Icons.home_work),
            label: 'Properties',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.payments_outlined),
            activeIcon: Icon(Icons.payments),
            label: 'Payments',
          ),
        ],
      ),
    );
  }

  Widget _buildDrawer() {
    final String name = _user?['name'] ?? 'RentFlow User';
    final String email = _user?['email'] ?? 'No Email';
    final String role = _user?['role'] ?? 'landlord';

    return Drawer(
      backgroundColor: const Color(0xFFFAF7F2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          UserAccountsDrawerHeader(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [ClayColors.accent, ClayColors.accentLight],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            currentAccountPicture: CircleAvatar(
              backgroundColor: Colors.white,
              child: Text(
                name.isNotEmpty ? name[0].toUpperCase() : 'U',
                style: GoogleFonts.lora(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: ClayColors.accent,
                ),
              ),
            ),
            accountName: Text(
              name,
              style: GoogleFonts.dmSans(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            accountEmail: Text(
              '$email · ${role.toUpperCase()}',
              style: GoogleFonts.dmSans(fontSize: 13, color: Colors.white.withOpacity(0.9)),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.dashboard_outlined, color: ClayColors.textDark),
            title: Text('Dashboard', style: GoogleFonts.dmSans(fontWeight: FontWeight.bold)),
            onTap: () {
              Navigator.pop(context);
              setState(() => _currentIndex = 0);
            },
          ),
          ListTile(
            leading: const Icon(Icons.home_work_outlined, color: ClayColors.textDark),
            title: Text('Properties', style: GoogleFonts.dmSans(fontWeight: FontWeight.bold)),
            onTap: () {
              Navigator.pop(context);
              setState(() => _currentIndex = 1);
            },
          ),
          ListTile(
            leading: const Icon(Icons.payments_outlined, color: ClayColors.textDark),
            title: Text('Payments & Receipts', style: GoogleFonts.dmSans(fontWeight: FontWeight.bold)),
            onTap: () {
              Navigator.pop(context);
              setState(() => _currentIndex = 2);
            },
          ),
          const Divider(indent: 16, endIndent: 16),
          ListTile(
            leading: const Icon(Icons.people_outline, color: ClayColors.textDark),
            title: Text('Tenants Directory', style: GoogleFonts.dmSans(fontWeight: FontWeight.bold)),
            onTap: () {
              Navigator.pop(context);
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const TenantsScreen()),
              );
            },
          ),
          ListTile(
            leading: const Icon(Icons.description_outlined, color: ClayColors.textDark),
            title: Text('Lease Agreements', style: GoogleFonts.dmSans(fontWeight: FontWeight.bold)),
            onTap: () {
              Navigator.pop(context);
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const AgreementsScreen()),
              );
            },
          ),
          ListTile(
            leading: const Icon(Icons.electrical_services_outlined, color: ClayColors.textDark),
            title: Text('Shared Bills', style: GoogleFonts.dmSans(fontWeight: FontWeight.bold)),
            onTap: () {
              Navigator.pop(context);
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const BillsScreen()),
              );
            },
          ),
          const Spacer(),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.logout, color: ClayColors.red),
            title: Text('Logout', style: GoogleFonts.dmSans(fontWeight: FontWeight.bold, color: ClayColors.red)),
            onTap: () {
              Navigator.pop(context);
              _logout();
            },
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}
