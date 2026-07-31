import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../constants/colors.dart';
import '../services/api_service.dart';
import '../widgets/glass_card.dart';
import '../widgets/glass_text_field.dart';
import '../widgets/gradient_button.dart';
import '../widgets/status_chip.dart';
import '../utils/helpers.dart';

class BillsScreen extends StatefulWidget {
  const BillsScreen({super.key});

  @override
  State<BillsScreen> createState() => _BillsScreenState();
}

class _BillsScreenState extends State<BillsScreen> {
  List<dynamic> _bills = [];
  bool _isLoading = true;
  String? _errorMessage;
  Map<String, dynamic>? _user;

  @override
  void initState() {
    super.initState();
    _fetchBills();
  }

  Future<void> _fetchBills() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final user = await ApiService.getUser();
      final bills = await ApiService.getBills();
      setState(() {
        _user = user;
        _bills = bills;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load shared bills.';
        _isLoading = false;
      });
    }
  }

  Future<void> _markBillPaid(dynamic id) async {
    try {
      await ApiService.markBillPaid(id);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bill marked as paid ✅')),
      );
      _fetchBills();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
      );
    }
  }

  void _showAddBillDialog() async {
    final billNameController = TextEditingController();
    final totalAmountController = TextEditingController();
    final tenantShareController = TextEditingController();
    final dueDateController = TextEditingController(
      text: DateTime.now().toIso8601String().split('T')[0],
    );

    List<dynamic> properties = [];
    List<dynamic> tenants = [];
    String? selectedPropId;
    String? selectedTenantId;

    try {
      properties = await ApiService.getProperties();
      tenants = await ApiService.getTenants();
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
                      'Create Shared Bill',
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
                        hintText: 'Select Property',
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

                    // Tenant Selector Dropdown
                    DropdownButtonFormField<String>(
                      value: selectedTenantId,
                      dropdownColor: Colors.white,
                      style: GoogleFonts.plusJakartaSans(
                        color: AppColors.textPrimary,
                      ),
                      decoration: InputDecoration(
                        hintText: 'Select Tenant',
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
                      items: tenants.map<DropdownMenuItem<String>>((t) {
                        return DropdownMenuItem<String>(
                          value: t['id'].toString(),
                          child: Text(t['name'] ?? 'Tenant'),
                        );
                      }).toList(),
                      onChanged: (val) {
                        setModalState(() => selectedTenantId = val);
                      },
                    ),
                    const SizedBox(height: 12),

                    GlassTextField(
                      controller: billNameController,
                      hintText: 'Bill Name (e.g. Electricity Oct 2026)',
                      prefixIcon: Icons.bolt_outlined,
                    ),
                    const SizedBox(height: 12),

                    Row(
                      children: [
                        Expanded(
                          child: GlassTextField(
                            controller: totalAmountController,
                            hintText: 'Total Bill (₹)',
                            prefixIcon: Icons.receipt_outlined,
                            keyboardType: TextInputType.number,
                            onChanged: (val) {
                              final total = double.tryParse(val) ?? 0;
                              setModalState(() {
                                tenantShareController.text =
                                    (total * 0.5).toStringAsFixed(0);
                              });
                            },
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: GlassTextField(
                            controller: tenantShareController,
                            hintText: 'Tenant Share (₹)',
                            prefixIcon: Icons.pie_chart_outline,
                            keyboardType: TextInputType.number,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    GlassTextField(
                      controller: dueDateController,
                      hintText: 'Due Date (YYYY-MM-DD)',
                      prefixIcon: Icons.calendar_month_outlined,
                    ),
                    const SizedBox(height: 24),

                    GradientButton(
                      text: 'Add Shared Bill',
                      onPressed: () async {
                        if (selectedPropId == null ||
                            selectedTenantId == null ||
                            billNameController.text.trim().isEmpty ||
                            totalAmountController.text.isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Please fill all required fields'),
                            ),
                          );
                          return;
                        }

                        try {
                          await ApiService.createBill({
                            'property_id': selectedPropId,
                            'tenant_id': selectedTenantId,
                            'bill_name': billNameController.text.trim(),
                            'total_amount': double.parse(totalAmountController.text),
                            'tenant_share': double.parse(tenantShareController.text),
                            'due_date': dueDateController.text.trim(),
                          });
                          Navigator.pop(context);
                          _fetchBills();
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

  String _formatCurrency(double amt) {
    final format = NumberFormat.currency(
      locale: 'en_IN',
      symbol: '₹',
      decimalDigits: 0,
    );
    return format.format(amt);
  }

  @override
  Widget build(BuildContext context) {
    final isLandlord = (_user?['role'] ?? 'landlord') == 'landlord';

    return Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          title: Text(
            'Shared Utility Bills',
            style: GoogleFonts.plusJakartaSans(
              fontWeight: FontWeight.w700,
              fontSize: 18,
            ),
          ),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new, size: 18),
            onPressed: () => Navigator.pop(context),
          ),
        ),
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
                    onRefresh: _fetchBills,
                    color: AppColors.accentPurple,
                    child: _bills.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(
                                  Icons.receipt_long_outlined,
                                  size: 48,
                                  color: AppColors.textMuted,
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  'No shared bills recorded.',
                                  style: GoogleFonts.plusJakartaSans(
                                    color: AppColors.textMuted,
                                  ),
                                ),
                              ],
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(20.0),
                            itemCount: _bills.length,
                            itemBuilder: (context, index) {
                              final bill = _bills[index];
                              final total = parseDouble(bill['total_amount']);
                              final share = parseDouble(bill['tenant_share']);
                              final date = parseDateTime(bill['due_date']);
                              final dateStr =
                                  DateFormat('dd MMM yyyy').format(date);
                              final isPaid = bill['status'] == 'paid';

                              return GlassCard(
                                margin: const EdgeInsets.only(bottom: 14),
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  children: [
                                    Row(
                                      children: [
                                        Container(
                                          width: 44,
                                          height: 44,
                                          decoration: const BoxDecoration(
                                            gradient: AppColors.warmGradient,
                                            shape: BoxShape.circle,
                                          ),
                                          child: const Icon(
                                            Icons.bolt,
                                            color: Colors.white,
                                            size: 24,
                                          ),
                                        ),
                                        const SizedBox(width: 14),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                bill['bill_name'] ??
                                                    'Shared Bill',
                                                style: GoogleFonts.plusJakartaSans(
                                                  fontSize: 15,
                                                  fontWeight: FontWeight.w700,
                                                  color: AppColors.textPrimary,
                                                ),
                                              ),
                                              const SizedBox(height: 2),
                                              Text(
                                                'Tenant: ${bill['tenant_name'] ?? 'N/A'} · Due: $dateStr',
                                                style: GoogleFonts.plusJakartaSans(
                                                  fontSize: 12,
                                                  color: AppColors.textSecondary,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.end,
                                          children: [
                                            Text(
                                              _formatCurrency(share),
                                              style: GoogleFonts.plusJakartaSans(
                                                fontSize: 16,
                                                fontWeight: FontWeight.w800,
                                                color: AppColors.accentCyan,
                                              ),
                                            ),
                                            Text(
                                              'Total: ${_formatCurrency(total)}',
                                              style: GoogleFonts.plusJakartaSans(
                                                fontSize: 11,
                                                color: AppColors.textMuted,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 10),
                                    Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.spaceBetween,
                                      children: [
                                        StatusChip(
                                          status: isPaid ? 'Paid' : 'Unpaid',
                                        ),
                                        if (isLandlord && !isPaid)
                                          TextButton.icon(
                                            onPressed: () =>
                                                _markBillPaid(bill['id']),
                                            icon: const Icon(
                                              Icons.check_circle,
                                              size: 16,
                                              color: AppColors.success,
                                            ),
                                            label: Text(
                                              'Mark Paid',
                                              style: GoogleFonts.plusJakartaSans(
                                                fontSize: 12,
                                                fontWeight: FontWeight.w700,
                                                color: AppColors.success,
                                              ),
                                            ),
                                          ),
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
                onPressed: _showAddBillDialog,
                backgroundColor: AppColors.accentPurple,
                child: const Icon(Icons.add, color: Colors.white),
              )
            : null,
    );
  }
}
