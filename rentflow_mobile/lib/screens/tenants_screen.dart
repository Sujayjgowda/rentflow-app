import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../constants/colors.dart';
import '../services/api_service.dart';
import '../widgets/clay_container.dart';

class TenantsScreen extends StatefulWidget {
  const TenantsScreen({Key? key}) : super(key: key);

  @override
  State<TenantsScreen> createState() => _TenantsScreenState();
}

class _TenantsScreenState extends State<TenantsScreen> {
  List<dynamic> _tenants = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchTenants();
  }

  Future<void> _fetchTenants() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final tenants = await ApiService.getList('tenants');
      setState(() {
        _tenants = tenants;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load tenants list.';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        title: Text('Tenants Directory', style: GoogleFonts.lora(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(child: Text(_errorMessage!, style: GoogleFonts.dmSans(color: ClayColors.red)))
              : RefreshIndicator(
                  onRefresh: _fetchTenants,
                  child: _tenants.isEmpty
                      ? Center(child: Text('No active tenants found.', style: GoogleFonts.dmSans(color: ClayColors.textMuted)))
                      : ListView.builder(
                          padding: const EdgeInsets.all(20.0),
                          itemCount: _tenants.length,
                          itemBuilder: (context, index) {
                            final tenant = _tenants[index];
                            final startStr = tenant['lease_start'] != null
                                ? DateFormat('dd MMM yyyy').format(DateTime.parse(tenant['lease_start']))
                                : 'N/A';
                            final endStr = tenant['lease_end'] != null
                                ? DateFormat('dd MMM yyyy').format(DateTime.parse(tenant['lease_end']))
                                : 'N/A';

                            return ClayContainer(
                              color: Colors.white,
                              margin: const EdgeInsets.only(bottom: 16),
                              padding: const EdgeInsets.all(16),
                              child: Row(
                                children: [
                                  ClayContainer(
                                    width: 48,
                                    height: 48,
                                    radius: 50,
                                    color: ClayColors.pastelBlue,
                                    child: const Center(
                                      child: Text('👥', style: TextStyle(fontSize: 20)),
                                    ),
                                  ),
                                  const SizedBox(width: 16),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          tenant['name'] ?? 'Tenant',
                                          style: GoogleFonts.dmSans(
                                            fontSize: 16,
                                            fontWeight: FontWeight.bold,
                                            color: ClayColors.textDark,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          '📞 ${tenant['phone'] ?? 'No Phone'}',
                                          style: GoogleFonts.dmSans(fontSize: 13, color: ClayColors.textMuted),
                                        ),
                                        Text(
                                          '✉️ ${tenant['email'] ?? 'No Email'}',
                                          style: GoogleFonts.dmSans(fontSize: 13, color: ClayColors.textMuted),
                                        ),
                                        const SizedBox(height: 8),
                                        Row(
                                          children: [
                                            const Icon(Icons.calendar_today_outlined, size: 12, color: ClayColors.accent),
                                            const SizedBox(width: 4),
                                            Text(
                                              'Lease: $startStr - $endStr',
                                              style: GoogleFonts.dmSans(
                                                fontSize: 11,
                                                fontWeight: FontWeight.bold,
                                                color: ClayColors.accent,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
    );
  }
}
