import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../constants/colors.dart';
import '../services/api_service.dart';
import '../widgets/glass_card.dart';
import '../widgets/glass_text_field.dart';
import '../widgets/gradient_button.dart';
import '../widgets/status_chip.dart';

class TenantsScreen extends StatefulWidget {
  const TenantsScreen({super.key});

  @override
  State<TenantsScreen> createState() => _TenantsScreenState();
}

class _TenantsScreenState extends State<TenantsScreen> {
  List<dynamic> _tenants = [];
  bool _isLoading = true;
  String? _errorMessage;
  Map<String, dynamic>? _user;

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
      final user = await ApiService.getUser();
      final tenants = await ApiService.getTenants();
      setState(() {
        _user = user;
        _tenants = tenants;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load tenants directory.';
        _isLoading = false;
      });
    }
  }

  void _callTenant(String phone) async {
    final cleanPhone = phone.replaceAll(RegExp(r'[^0-9+]'), '');
    final url = Uri.parse('tel:$cleanPhone');
    if (await canLaunchUrl(url)) {
      await launchUrl(url);
    }
  }

  void _openWhatsApp(String phone, String name) async {
    final cleanPhone = phone.replaceAll(RegExp(r'[^0-9]'), '');
    final msg = Uri.encodeComponent('Hi $name, reaching out from RentFlow.');
    final url = Uri.parse('https://wa.me/$cleanPhone?text=$msg');
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  void _showAddTenantDialog() async {
    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    final emailController = TextEditingController();
    final leaseStartController = TextEditingController(
      text: DateTime.now().toIso8601String().split('T')[0],
    );
    final leaseEndController = TextEditingController(
      text: DateTime.now()
          .add(const Duration(days: 365))
          .toIso8601String()
          .split('T')[0],
    );

    List<dynamic> properties = [];
    String? selectedPropId;

    try {
      properties = await ApiService.getProperties();
    } catch (_) {}

    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
              ),
              padding: EdgeInsets.only(
                top: 24,
                left: 24,
                right: 24,
                bottom: MediaQuery.of(context).viewInsets.bottom + 24,
              ),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: AppColors.textMuted.withOpacity(0.4),
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      'Add New Tenant',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Property Selector Dropdown
                    DropdownButtonFormField<String>(
                      value: selectedPropId,
                      dropdownColor: Colors.white,
                      style: GoogleFonts.plusJakartaSans(
                        color: AppColors.textPrimary,
                      ),
                      decoration: InputDecoration(
                        hintText: 'Assign to Property',
                        hintStyle: GoogleFonts.plusJakartaSans(
                          color: AppColors.textMuted,
                        ),
                        filled: true,
                        fillColor: AppColors.surfaceLight,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide(color: AppColors.glassBorder),
                        ),
                      ),
                      items: properties.map<DropdownMenuItem<String>>((p) {
                        return DropdownMenuItem<String>(
                          value: p['id'].toString(),
                          child: Text(p['name'] ?? 'Property'),
                        );
                      }).toList(),
                      onChanged: (val) {
                        setModalState(() => selectedPropId = val);
                      },
                    ),
                    const SizedBox(height: 12),

                    GlassTextField(
                      controller: nameController,
                      hintText: 'Tenant Full Name',
                      prefixIcon: Icons.person_outline,
                    ),
                    const SizedBox(height: 12),

                    GlassTextField(
                      controller: phoneController,
                      hintText: 'Phone Number',
                      prefixIcon: Icons.phone_outlined,
                      keyboardType: TextInputType.phone,
                    ),
                    const SizedBox(height: 12),

                    GlassTextField(
                      controller: emailController,
                      hintText: 'Email Address (Optional)',
                      prefixIcon: Icons.alternate_email,
                      keyboardType: TextInputType.emailAddress,
                    ),
                    const SizedBox(height: 12),

                    Row(
                      children: [
                        Expanded(
                          child: GlassTextField(
                            controller: leaseStartController,
                            hintText: 'Lease Start',
                            prefixIcon: Icons.calendar_month_outlined,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: GlassTextField(
                            controller: leaseEndController,
                            hintText: 'Lease End',
                            prefixIcon: Icons.calendar_month_outlined,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    GradientButton(
                      text: 'Add Tenant',
                      onPressed: () async {
                        if (selectedPropId == null ||
                            nameController.text.trim().isEmpty ||
                            phoneController.text.trim().isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Please select property, name, and phone'),
                            ),
                          );
                          return;
                        }

                        try {
                          await ApiService.createTenant({
                            'property_id': selectedPropId,
                            'name': nameController.text.trim(),
                            'phone': phoneController.text.trim(),
                            'email': emailController.text.trim(),
                            'lease_start': leaseStartController.text.trim(),
                            'lease_end': leaseEndController.text.trim(),
                          });
                          Navigator.pop(context);
                          _fetchTenants();
                        } catch (e) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                e.toString().replaceAll('Exception: ', ''),
                              ),
                            ),
                          );
                        }
                      },
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isLandlord = (_user?['role'] ?? 'landlord') == 'landlord';

    return Scaffold(
      backgroundColor: Colors.white,
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.accentPurple),
            )
          : _errorMessage != null
              ? Center(
                  child: Text(
                    _errorMessage!,
                    style: GoogleFonts.plusJakartaSans(color: AppColors.error),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _fetchTenants,
                  color: AppColors.accentPurple,
                  child: _tenants.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(
                                Icons.people_outline,
                                size: 48,
                                color: AppColors.textMuted,
                              ),
                              const SizedBox(height: 12),
                              Text(
                                'No active tenants found.',
                                style: GoogleFonts.plusJakartaSans(
                                  color: AppColors.textMuted,
                                ),
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(20.0),
                          itemCount: _tenants.length,
                          itemBuilder: (context, index) {
                            final tenant = _tenants[index];
                            final name = tenant['name'] ?? 'Tenant';
                            final phone = tenant['phone'] ?? '';
                            final email = tenant['email'] ?? '';
                            final propName = tenant['property_name'] ?? 'Assigned Property';

                            final startStr = tenant['lease_start'] != null
                                ? DateFormat('dd MMM yyyy')
                                    .format(DateTime.parse(tenant['lease_start']))
                                : 'N/A';
                            final endStr = tenant['lease_end'] != null
                                ? DateFormat('dd MMM yyyy')
                                    .format(DateTime.parse(tenant['lease_end']))
                                : 'N/A';

                            return GlassCard(
                              margin: const EdgeInsets.only(bottom: 14),
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                children: [
                                  Row(
                                    children: [
                                      // Avatar Circle with gradient
                                      Container(
                                        width: 48,
                                        height: 48,
                                        decoration: const BoxDecoration(
                                          gradient: AppColors.accentGradient,
                                          shape: BoxShape.circle,
                                        ),
                                        child: Center(
                                          child: Text(
                                            name.isNotEmpty
                                                ? name[0].toUpperCase()
                                                : 'T',
                                            style: GoogleFonts.plusJakartaSans(
                                              fontSize: 20,
                                              fontWeight: FontWeight.w800,
                                              color: Colors.white,
                                            ),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 14),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              name,
                                              style: GoogleFonts.plusJakartaSans(
                                                fontSize: 16,
                                                fontWeight: FontWeight.w700,
                                                color: AppColors.textPrimary,
                                              ),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              propName,
                                              style: GoogleFonts.plusJakartaSans(
                                                fontSize: 12,
                                                color: AppColors.accentCyan,
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      const StatusChip(status: 'Active'),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  const Divider(),
                                  const SizedBox(height: 8),
                                  Row(
                                    children: [
                                      const Icon(
                                        Icons.calendar_month_outlined,
                                        size: 14,
                                        color: AppColors.textMuted,
                                      ),
                                      const SizedBox(width: 6),
                                      Expanded(
                                        child: Text(
                                          'Lease: $startStr - $endStr',
                                          style: GoogleFonts.plusJakartaSans(
                                            fontSize: 12,
                                            color: AppColors.textSecondary,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      if (phone.isNotEmpty) ...[
                                        const SizedBox(width: 8),
                                        InkWell(
                                          borderRadius: BorderRadius.circular(8),
                                          onTap: () => _callTenant(phone),
                                          child: Container(
                                            padding: const EdgeInsets.all(8),
                                            decoration: BoxDecoration(
                                              color: AppColors.accentCyan.withOpacity(0.12),
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: const Icon(
                                              Icons.phone_outlined,
                                              color: AppColors.accentCyan,
                                              size: 18,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        InkWell(
                                          borderRadius: BorderRadius.circular(8),
                                          onTap: () => _openWhatsApp(phone, name),
                                          child: Container(
                                            padding: const EdgeInsets.all(8),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFF25D366).withOpacity(0.12),
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: const Icon(
                                              Icons.chat_bubble_outline,
                                              color: Color(0xFF25D366),
                                              size: 18,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
      floatingActionButton: isLandlord
          ? FloatingActionButton(
              onPressed: _showAddTenantDialog,
              backgroundColor: AppColors.accentPurple,
              child: const Icon(Icons.person_add_alt_1, color: Colors.white),
            )
          : null,
    );
  }
}
