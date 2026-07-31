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
import '../utils/helpers.dart';

class PaymentsScreen extends StatefulWidget {
  const PaymentsScreen({super.key});

  @override
  State<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends State<PaymentsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<dynamic> _transactions = [];
  bool _isLoading = true;
  String? _errorMessage;
  String _filterStatus = 'all'; // 'all', 'paid', 'pending', 'overdue'

  // Receipt Generator Fields
  final _tenantNameController = TextEditingController();
  final _landlordNameController = TextEditingController();
  final _propertyNameController = TextEditingController();
  final _rentAmountController = TextEditingController();
  final _periodStartController = TextEditingController();
  final _periodEndController = TextEditingController();
  String _paymentMode = 'UPI';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _fetchTransactions();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchTransactions() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final txns = await ApiService.getTransactions();
      setState(() {
        _transactions = txns;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load transactions.';
        _isLoading = false;
      });
    }
  }

  Future<void> _markPaid(dynamic id) async {
    try {
      await ApiService.markTransactionPaid(id);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Payment marked as paid ✅')),
      );
      _fetchTransactions();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
      );
    }
  }

  Future<void> _deleteTransaction(dynamic id) async {
    try {
      await ApiService.deleteTransaction(id);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Transaction deleted')),
      );
      _fetchTransactions();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
      );
    }
  }

  void _sendWhatsAppReminder(String phone, String tenantName, String amount,
      String propertyName, String dueDate) async {
    final cleanPhone = phone.replaceAll(RegExp(r'[^0-9]'), '');
    final msg = Uri.encodeComponent(
        "Hi $tenantName, a friendly reminder regarding the rent payment of ₹$amount for $propertyName, due on $dueDate. Please clear it at your earliest convenience. Thank you!");
    final url = Uri.parse("https://wa.me/$cleanPhone?text=$msg");

    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not launch WhatsApp')),
      );
    }
  }

  void _showAddTransactionDialog() async {
    final amountController = TextEditingController();
    final dueDateController = TextEditingController(
      text: DateTime.now().toIso8601String().split('T')[0],
    );
    final notesController = TextEditingController();
    String mode = 'UPI';

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
                      'Add Payment Record',
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
                      controller: amountController,
                      hintText: 'Amount (₹)',
                      prefixIcon: Icons.payments_outlined,
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 12),

                    GlassTextField(
                      controller: dueDateController,
                      hintText: 'Due Date (YYYY-MM-DD)',
                      prefixIcon: Icons.calendar_month_outlined,
                    ),
                    const SizedBox(height: 12),

                    GlassTextField(
                      controller: notesController,
                      hintText: 'Notes',
                      prefixIcon: Icons.notes_outlined,
                    ),
                    const SizedBox(height: 16),

                    Text(
                      'Payment Mode',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8.0,
                      children: ['UPI', 'Cash', 'Bank Transfer'].map((m) {
                        final isSel = mode == m;
                        return ChoiceChip(
                          label: Text(m),
                          selected: isSel,
                          selectedColor: AppColors.accentPurple,
                          backgroundColor: AppColors.surfaceLight,
                          labelStyle: GoogleFonts.plusJakartaSans(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: isSel ? Colors.white : AppColors.textMuted,
                          ),
                          onSelected: (selected) {
                            if (selected) {
                              setModalState(() => mode = m);
                            }
                          },
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 24),

                    GradientButton(
                      text: 'Save Payment Record',
                      onPressed: () async {
                        if (selectedPropId == null ||
                            amountController.text.isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Please select property and enter amount'),
                            ),
                          );
                          return;
                        }

                        try {
                          await ApiService.createTransaction({
                            'property_id': selectedPropId,
                            'tenant_id': selectedTenantId,
                            'amount': double.parse(amountController.text),
                            'due_date': dueDateController.text.trim(),
                            'mode': mode,
                            'status': 'pending',
                            'notes': notesController.text.trim(),
                          });
                          Navigator.pop(context);
                          _fetchTransactions();
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

  void _generateAndShareReceipt() {
    if (_tenantNameController.text.isEmpty ||
        _landlordNameController.text.isEmpty ||
        _propertyNameController.text.isEmpty ||
        _rentAmountController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill all receipt details')),
      );
      return;
    }

    final dateStr = DateFormat('dd MMM yyyy').format(DateTime.now());
    final receiptText = '''
========================================
           RENT RECEIPT
========================================
Receipt Date: $dateStr
Property: ${_propertyNameController.text}
Tenant Name: ${_tenantNameController.text}
Landlord Name: ${_landlordNameController.text}

Rent Period: ${_periodStartController.text} to ${_periodEndController.text}
Amount Paid: ₹${_rentAmountController.text}
Payment Mode: $_paymentMode

Status: FULLY PAID
----------------------------------------
Generated via RentFlow Mobile App
========================================
''';

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: Text(
          'Rent Receipt Generated',
          style: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        content: Container(
          decoration: BoxDecoration(
            color: AppColors.surfaceLight,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.glassBorder),
          ),
          padding: const EdgeInsets.all(12),
          child: SingleChildScrollView(
            child: Text(
              receiptText,
              style: GoogleFonts.sourceCodePro(
                fontSize: 12,
                color: AppColors.textPrimary,
              ),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              'Close',
              style: GoogleFonts.plusJakartaSans(color: AppColors.textMuted),
            ),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Receipt text copied! Ready to share.'),
                ),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.accentPurple,
            ),
            child: const Text('Copy & Share'),
          ),
        ],
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Column(
        children: [
          // Tab selection header
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.surfaceLight,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.glassBorder),
            ),
            child: TabBar(
              controller: _tabController,
              indicator: BoxDecoration(
                gradient: AppColors.accentGradient,
                borderRadius: BorderRadius.circular(12),
              ),
              labelColor: Colors.white,
              unselectedLabelColor: AppColors.textMuted,
              labelStyle: GoogleFonts.plusJakartaSans(
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
              unselectedLabelStyle: GoogleFonts.plusJakartaSans(
                fontWeight: FontWeight.w500,
                fontSize: 13,
              ),
              tabs: const [
                Tab(text: 'Transactions'),
                Tab(text: 'Receipt Maker'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [_buildTransactionsTab(), _buildReceiptMakerTab()],
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showAddTransactionDialog,
        backgroundColor: AppColors.accentPurple,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  Widget _buildTransactionsTab() {
    List<dynamic> filtered = _transactions.where((t) {
      final status = (t['status'] ?? 'pending').toString().toLowerCase();
      if (_filterStatus == 'all') return true;
      return status == _filterStatus;
    }).toList();

    return Column(
      children: [
        // Status Filter Chips
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          child: Row(
            children: [
              _buildFilterChip('all', 'All Logs'),
              const SizedBox(width: 8),
              _buildFilterChip('paid', 'Paid'),
              const SizedBox(width: 8),
              _buildFilterChip('pending', 'Pending'),
              const SizedBox(width: 8),
              _buildFilterChip('overdue', 'Overdue'),
            ],
          ),
        ),
        Expanded(
          child: _isLoading
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
                      onRefresh: _fetchTransactions,
                      color: AppColors.accentPurple,
                      child: filtered.isEmpty
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
                                    'No transaction records found.',
                                    style: GoogleFonts.plusJakartaSans(
                                      color: AppColors.textMuted,
                                    ),
                                  ),
                                ],
                              ),
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.all(20.0),
                              itemCount: filtered.length,
                              itemBuilder: (context, index) {
                                final tx = filtered[index];
                                final amount = parseDouble(tx['amount']);
                                final status =
                                    (tx['status'] ?? 'pending').toString();
                                final dateStr = tx['due_date'] ?? 'N/A';
                                final tenantName =
                                    tx['tenant_name'] ?? 'Tenant';
                                final phone = tx['tenant_phone'] ?? '';
                                final propName =
                                    tx['property_name'] ?? 'Property';

                                return GlassCard(
                                  margin: const EdgeInsets.only(bottom: 12),
                                  padding: const EdgeInsets.all(16),
                                  child: Column(
                                    children: [
                                      Row(
                                        children: [
                                          Container(
                                            width: 42,
                                            height: 42,
                                            decoration: BoxDecoration(
                                              gradient: status == 'paid'
                                                  ? AppColors.greenGradient
                                                  : AppColors.warmGradient,
                                              borderRadius:
                                                  BorderRadius.circular(12),
                                            ),
                                            child: Icon(
                                              status == 'paid'
                                                  ? Icons.check_circle_outline
                                                  : Icons.hourglass_top_rounded,
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
                                                  tenantName,
                                                  style: GoogleFonts.plusJakartaSans(
                                                    fontSize: 15,
                                                    fontWeight: FontWeight.w700,
                                                    color: AppColors.textPrimary,
                                                  ),
                                                ),
                                                const SizedBox(height: 2),
                                                Text(
                                                  '$propName · Due $dateStr',
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
                                                _formatCurrency(amount),
                                                style: GoogleFonts.plusJakartaSans(
                                                  fontSize: 16,
                                                  fontWeight: FontWeight.w800,
                                                  color: status == 'paid'
                                                      ? AppColors.success
                                                      : AppColors.error,
                                                ),
                                              ),
                                              const SizedBox(height: 4),
                                              StatusChip(status: status),
                                            ],
                                          ),
                                        ],
                                      ),
                                      if (status != 'paid') ...[
                                        const SizedBox(height: 12),
                                        const Divider(),
                                        const SizedBox(height: 6),
                                        Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.end,
                                          children: [
                                            if (phone.isNotEmpty) ...[
                                              InkWell(
                                                borderRadius: BorderRadius.circular(8),
                                                onTap: () => _sendWhatsAppReminder(
                                                  phone,
                                                  tenantName,
                                                  amount.toStringAsFixed(0),
                                                  propName,
                                                  dateStr,
                                                ),
                                                child: Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                                  decoration: BoxDecoration(
                                                    color: const Color(0xFF25D366).withOpacity(0.12),
                                                    borderRadius: BorderRadius.circular(8),
                                                  ),
                                                  child: Row(
                                                    children: [
                                                      const Icon(
                                                        Icons.chat_bubble_outline,
                                                        color: Color(0xFF25D366),
                                                        size: 16,
                                                      ),
                                                      const SizedBox(width: 4),
                                                      Text(
                                                        'Reminder',
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
                                              const SizedBox(width: 8),
                                            ],
                                            InkWell(
                                              borderRadius: BorderRadius.circular(8),
                                              onTap: () => _markPaid(tx['id']),
                                              child: Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                                decoration: BoxDecoration(
                                                  color: AppColors.successBg,
                                                  borderRadius: BorderRadius.circular(8),
                                                ),
                                                child: Row(
                                                  children: [
                                                    const Icon(
                                                      Icons.check_circle_outline,
                                                      color: AppColors.success,
                                                      size: 16,
                                                    ),
                                                    const SizedBox(width: 4),
                                                    Text(
                                                      'Mark Paid',
                                                      style: GoogleFonts.plusJakartaSans(
                                                        fontSize: 12,
                                                        fontWeight: FontWeight.w700,
                                                        color: AppColors.success,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            InkWell(
                                              borderRadius: BorderRadius.circular(8),
                                              onTap: () => _deleteTransaction(tx['id']),
                                              child: Container(
                                                padding: const EdgeInsets.all(6),
                                                decoration: BoxDecoration(
                                                  color: AppColors.surfaceLight,
                                                  borderRadius: BorderRadius.circular(8),
                                                ),
                                                child: const Icon(
                                                  Icons.delete_outline,
                                                  color: AppColors.textMuted,
                                                  size: 18,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ],
                                  ),
                                );
                              },
                            ),
                  ),
        ),
      ],
    );
  }

  Widget _buildFilterChip(String key, String label) {
    final isSelected = _filterStatus == key;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      selectedColor: AppColors.accentPurple,
      backgroundColor: AppColors.surfaceLight,
      labelStyle: GoogleFonts.plusJakartaSans(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        color: isSelected ? Colors.white : AppColors.textMuted,
      ),
      onSelected: (val) {
        if (val) setState(() => _filterStatus = key);
      },
    );
  }

  Widget _buildReceiptMakerTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20.0),
      child: GlassCard(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Rent Receipt Maker',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Generate rent receipts for HRA tax exemption proof.',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 20),
            GlassTextField(
              controller: _tenantNameController,
              hintText: 'Tenant Name',
              prefixIcon: Icons.person_outline,
            ),
            const SizedBox(height: 12),
            GlassTextField(
              controller: _landlordNameController,
              hintText: 'Landlord Name',
              prefixIcon: Icons.person_outline,
            ),
            const SizedBox(height: 12),
            GlassTextField(
              controller: _propertyNameController,
              hintText: 'Property Address (e.g. Flat 302, Green Glen)',
              prefixIcon: Icons.location_on_outlined,
            ),
            const SizedBox(height: 12),
            GlassTextField(
              controller: _rentAmountController,
              hintText: 'Monthly Rent Paid (₹)',
              prefixIcon: Icons.payments_outlined,
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: GlassTextField(
                    controller: _periodStartController,
                    hintText: 'Start (Oct 2026)',
                    prefixIcon: Icons.calendar_month_outlined,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: GlassTextField(
                    controller: _periodEndController,
                    hintText: 'End (Dec 2026)',
                    prefixIcon: Icons.calendar_month_outlined,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              'Payment Mode',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8.0,
              children: ['UPI', 'Cash', 'Cheque', 'Net Banking'].map((m) {
                final isSel = _paymentMode == m;
                return ChoiceChip(
                  label: Text(m),
                  selected: isSel,
                  selectedColor: AppColors.accentPurple,
                  backgroundColor: AppColors.surfaceLight,
                  labelStyle: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: isSel ? Colors.white : AppColors.textMuted,
                  ),
                  onSelected: (selected) {
                    if (selected) {
                      setState(() => _paymentMode = m);
                    }
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: 24),
            GradientButton(
              text: 'Generate & Copy Receipt',
              icon: Icons.picture_as_pdf,
              onPressed: _generateAndShareReceipt,
            ),
          ],
        ),
      ),
    );
  }
}
