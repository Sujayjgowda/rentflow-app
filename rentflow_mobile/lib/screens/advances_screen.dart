import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../constants/colors.dart';
import '../services/api_service.dart';
import '../widgets/glass_card.dart';
import '../widgets/glass_text_field.dart';
import '../widgets/gradient_button.dart';
import '../utils/helpers.dart';

class AdvancesScreen extends StatefulWidget {
  const AdvancesScreen({super.key});

  @override
  State<AdvancesScreen> createState() => _AdvancesScreenState();
}

class _AdvancesScreenState extends State<AdvancesScreen> {
  List<dynamic> _advances = [];
  bool _isLoading = true;
  String? _errorMessage;
  Map<String, dynamic>? _user;

  @override
  void initState() {
    super.initState();
    _fetchAdvances();
  }

  Future<void> _fetchAdvances() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final user = await ApiService.getUser();
      final advances = await ApiService.getAdvances();
      setState(() {
        _user = user;
        _advances = advances;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load security deposits.';
        _isLoading = false;
      });
    }
  }

  Future<void> _deleteAdvance(dynamic id) async {
    try {
      await ApiService.deleteAdvance(id);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Advance deposit record deleted')),
      );
      _fetchAdvances();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
      );
    }
  }

  void _showAddAdvanceDialog() async {
    final amountController = TextEditingController();
    final notesController = TextEditingController();
    final dateController = TextEditingController(
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
                color: AppColors.bgCard,
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
                      'Record Advance Payment',
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
                      dropdownColor: AppColors.surface,
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
                      dropdownColor: AppColors.surface,
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
                      controller: amountController,
                      hintText: 'Advance Amount (₹)',
                      prefixIcon: Icons.account_balance_wallet_outlined,
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 12),

                    GlassTextField(
                      controller: dateController,
                      hintText: 'Paid Date (YYYY-MM-DD)',
                      prefixIcon: Icons.calendar_month_outlined,
                    ),
                    const SizedBox(height: 12),

                    GlassTextField(
                      controller: notesController,
                      hintText: 'Notes (e.g. 2 Months Rent Deposit)',
                      prefixIcon: Icons.edit_note_outlined,
                    ),
                    const SizedBox(height: 24),

                    GradientButton(
                      text: 'Save Advance Deposit',
                      onPressed: () async {
                        if (selectedPropId == null ||
                            selectedTenantId == null ||
                            amountController.text.isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Please select property, tenant and amount'),
                            ),
                          );
                          return;
                        }

                        try {
                          await ApiService.createAdvance({
                            'property_id': selectedPropId,
                            'tenant_id': selectedTenantId,
                            'amount': double.parse(amountController.text),
                            'paid_date': dateController.text.trim(),
                            'notes': notesController.text.trim(),
                          });
                          Navigator.pop(context);
                          _fetchAdvances();
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

    return Container(
      decoration: const BoxDecoration(gradient: AppColors.bgGradient),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: Text(
            'Security Advances',
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
                    onRefresh: _fetchAdvances,
                    color: AppColors.accentPurple,
                    child: _advances.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(
                                  Icons.account_balance_wallet_outlined,
                                  size: 48,
                                  color: AppColors.textMuted,
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  'No advance deposits recorded.',
                                  style: GoogleFonts.plusJakartaSans(
                                    color: AppColors.textMuted,
                                  ),
                                ),
                              ],
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(20.0),
                            itemCount: _advances.length,
                            itemBuilder: (context, index) {
                              final adv = _advances[index];
                              final amount = parseDouble(adv['amount']);
                              final date = parseDateTime(adv['paid_date']);
                              final dateStr =
                                  DateFormat('dd MMM yyyy').format(date);

                              return GlassCard(
                                margin: const EdgeInsets.only(bottom: 14),
                                padding: const EdgeInsets.all(16),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 44,
                                      height: 44,
                                      decoration: BoxDecoration(
                                        gradient: AppColors.greenGradient,
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: const Icon(
                                        Icons.security,
                                        color: Colors.white,
                                        size: 22,
                                      ),
                                    ),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            adv['property_name'] ?? 'Property',
                                            style: GoogleFonts.plusJakartaSans(
                                              fontSize: 15,
                                              fontWeight: FontWeight.w700,
                                              color: AppColors.textPrimary,
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            'Tenant: ${adv['tenant_name'] ?? 'N/A'}',
                                            style: GoogleFonts.plusJakartaSans(
                                              fontSize: 12,
                                              color: AppColors.textSecondary,
                                            ),
                                          ),
                                          if (adv['notes'] != null &&
                                              adv['notes'].toString().isNotEmpty)
                                            Text(
                                              'Notes: ${adv['notes']}',
                                              style: GoogleFonts.plusJakartaSans(
                                                fontSize: 11,
                                                color: AppColors.textMuted,
                                              ),
                                            ),
                                          Text(
                                            'Paid on $dateStr',
                                            style: GoogleFonts.plusJakartaSans(
                                              fontSize: 11,
                                              color: AppColors.textMuted,
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
                                          _formatCurrency(amount),
                                          style: GoogleFonts.plusJakartaSans(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w800,
                                            color: AppColors.success,
                                          ),
                                        ),
                                        if (isLandlord)
                                          IconButton(
                                            icon: const Icon(
                                              Icons.delete_outline,
                                              color: AppColors.textMuted,
                                              size: 18,
                                            ),
                                            onPressed: () =>
                                                _deleteAdvance(adv['id']),
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
                onPressed: _showAddAdvanceDialog,
                backgroundColor: AppColors.accentPurple,
                child: const Icon(Icons.add, color: Colors.white),
              )
            : null,
      ),
    );
  }
}
