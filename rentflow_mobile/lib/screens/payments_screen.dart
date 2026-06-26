import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../constants/colors.dart';
import '../services/api_service.dart';
import '../widgets/clay_container.dart';

class PaymentsScreen extends StatefulWidget {
  const PaymentsScreen({Key? key}) : super(key: key);

  @override
  State<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends State<PaymentsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<dynamic> _transactions = [];
  bool _isLoading = true;
  String? _errorMessage;

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

  Future<void> _deleteTransaction(int id) async {
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

  void _showAddTransactionDialog() {
    final tenantNameController = TextEditingController();
    final propertyNameController = TextEditingController();
    final amountController = TextEditingController();
    String mode = 'UPI';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Container(
              decoration: const BoxDecoration(
                color: Color(0xFFFAF7F2),
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(30),
                  topRight: Radius.circular(30),
                ),
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
                        width: 50,
                        height: 5,
                        decoration: BoxDecoration(
                          color: ClayColors.textMuted.withOpacity(0.3),
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      'Add Payment Record',
                      style: GoogleFonts.lora(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: ClayColors.textDark,
                      ),
                    ),
                    const SizedBox(height: 20),
                    _buildModalTextField(tenantNameController, 'Tenant Name', Icons.person_outline),
                    const SizedBox(height: 12),
                    _buildModalTextField(propertyNameController, 'Property Name', Icons.business_outlined),
                    const SizedBox(height: 12),
                    _buildModalTextField(
                      amountController,
                      'Payment Amount (₹)',
                      Icons.payments_outlined,
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Payment Mode',
                      style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.bold, color: ClayColors.textDark),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: ['UPI', 'Cash', 'Bank Transfer'].map((m) {
                        final isSel = mode == m;
                        return Padding(
                          padding: const EdgeInsets.only(right: 8.0),
                          child: ChoiceChip(
                            label: Text(m),
                            selected: isSel,
                            selectedColor: ClayColors.pastelOrange,
                            labelStyle: GoogleFonts.dmSans(
                              fontWeight: FontWeight.bold,
                              color: isSel ? ClayColors.accent : ClayColors.textMuted,
                            ),
                            onSelected: (selected) {
                              if (selected) {
                                setModalState(() => mode = m);
                              }
                            },
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: () async {
                        if (tenantNameController.text.isEmpty ||
                            propertyNameController.text.isEmpty ||
                            amountController.text.isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Please fill all fields')),
                          );
                          return;
                        }

                        try {
                          await ApiService.createTransaction({
                            'tenant_name': tenantNameController.text.trim(),
                            'property_name': propertyNameController.text.trim(),
                            'amount': double.parse(amountController.text),
                            'payment_mode': mode,
                            'payment_date': DateTime.now().toIso8601String(),
                          });
                          Navigator.pop(context);
                          _fetchTransactions();
                        } catch (e) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
                          );
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: ClayColors.accent,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(50),
                        ),
                        elevation: 0,
                      ),
                      child: Text(
                        'Save Payment',
                        style: GoogleFonts.dmSans(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
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
        const SnackBar(content: Text('Please fill the receipt details')),
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
        title: Text(
          'Rent Receipt Generated',
          style: GoogleFonts.lora(fontWeight: FontWeight.bold),
        ),
        content: Container(
          decoration: BoxDecoration(
            color: Colors.grey[50],
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.grey[200]!),
          ),
          padding: const EdgeInsets.all(12),
          child: Text(
            receiptText,
            style: GoogleFonts.sourceCodePro(fontSize: 12),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Receipt text copied to clipboard!')),
              );
            },
            style: ElevatedButton.styleFrom(backgroundColor: ClayColors.accent, foregroundColor: Colors.white),
            child: const Text('Copy & Share'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Column(
        children: [
          // Tab selection header
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.5),
              borderRadius: BorderRadius.circular(16),
            ),
            child: TabBar(
              controller: _tabController,
              indicator: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x0A000000),
                    offset: Offset(0, 4),
                    blurRadius: 10,
                  ),
                ],
              ),
              labelColor: ClayColors.accent,
              unselectedLabelColor: ClayColors.textMuted,
              labelStyle: GoogleFonts.dmSans(fontWeight: FontWeight.bold, fontSize: 14),
              unselectedLabelStyle: GoogleFonts.dmSans(fontWeight: FontWeight.w500, fontSize: 14),
              tabs: const [
                Tab(text: 'Transactions'),
                Tab(text: 'Receipt Maker'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildTransactionsTab(),
                _buildReceiptMakerTab(),
              ],
            ),
          ),
        ],
      ),
      floatingActionButton: _tabController.index == 0
          ? FloatingActionButton(
              onPressed: _showAddTransactionDialog,
              backgroundColor: ClayColors.accent,
              child: const Icon(Icons.add, color: Colors.white),
            )
          : null,
    );
  }

  Widget _buildTransactionsTab() {
    return _isLoading
        ? const Center(child: CircularProgressIndicator())
        : _errorMessage != null
            ? Center(
                child: Text(_errorMessage!, style: GoogleFonts.dmSans(color: ClayColors.red)),
              )
            : RefreshIndicator(
                onRefresh: _fetchTransactions,
                child: _transactions.isEmpty
                    ? Center(
                        child: Text(
                          'No transaction logs found.',
                          style: GoogleFonts.dmSans(color: ClayColors.textMuted),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(20.0),
                        itemCount: _transactions.length,
                        itemBuilder: (context, index) {
                          final tx = _transactions[index];
                          final amount = (tx['amount'] ?? 0).toDouble();
                          final date = DateTime.parse(tx['payment_date']);
                          final dateStr = DateFormat('dd MMM yyyy').format(date);

                          return ClayContainer(
                            color: Colors.white,
                            margin: const EdgeInsets.only(bottom: 12),
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              children: [
                                Container(
                                  width: 40,
                                  height: 40,
                                  decoration: const BoxDecoration(
                                    color: ClayColors.pastelBlue,
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Center(
                                    child: Text('💳', style: TextStyle(fontSize: 18)),
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        tx['tenant_name'] ?? 'Tenant',
                                        style: GoogleFonts.dmSans(
                                          fontSize: 15,
                                          fontWeight: FontWeight.bold,
                                          color: ClayColors.textDark,
                                        ),
                                      ),
                                      Text(
                                        'Paid on $dateStr · ${tx['property_name']}',
                                        style: GoogleFonts.dmSans(
                                          fontSize: 12,
                                          color: ClayColors.textMuted,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      _formatCurrency(amount),
                                      style: GoogleFonts.lora(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        color: ClayColors.green,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: Colors.grey[100],
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        tx['payment_mode'] ?? 'UPI',
                                        style: GoogleFonts.dmSans(
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                          color: ClayColors.textMuted,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(width: 8),
                                IconButton(
                                  icon: const Icon(Icons.delete_outline, color: ClayColors.textMuted, size: 20),
                                  onPressed: () => _deleteTransaction(tx['id']),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
              );
  }

  Widget _buildReceiptMakerTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20.0),
      child: ClayContainer(
        color: Colors.white,
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Rent Receipt Maker',
              style: GoogleFonts.lora(fontSize: 18, fontWeight: FontWeight.bold, color: ClayColors.textDark),
            ),
            const SizedBox(height: 6),
            Text(
              'Easily create and share rent receipts for tax saving purposes.',
              style: GoogleFonts.dmSans(fontSize: 12, color: ClayColors.textMuted),
            ),
            const SizedBox(height: 20),
            _buildModalTextField(_tenantNameController, 'Tenant Name', Icons.person_outline),
            const SizedBox(height: 12),
            _buildModalTextField(_landlordNameController, 'Landlord Name', Icons.person_outline),
            const SizedBox(height: 12),
            _buildModalTextField(_propertyNameController, 'Property details (e.g. House No. 44)', Icons.location_on_outlined),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildModalTextField(
                    _rentAmountController,
                    'Rent Paid (₹)',
                    Icons.payments_outlined,
                    keyboardType: TextInputType.number,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildModalTextField(_periodStartController, 'Period Start (e.g. Oct 2026)', Icons.calendar_month_outlined),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildModalTextField(_periodEndController, 'Period End (e.g. Dec 2026)', Icons.calendar_month_outlined),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              'Payment Mode',
              style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.bold, color: ClayColors.textDark),
            ),
            const SizedBox(height: 8),
            Row(
              children: ['UPI', 'Cash', 'Cheque', 'Net Banking'].map((m) {
                final isSel = _paymentMode == m;
                return Padding(
                  padding: const EdgeInsets.only(right: 6.0),
                  child: ChoiceChip(
                    label: Text(m),
                    selected: isSel,
                    selectedColor: ClayColors.pastelOrange,
                    labelStyle: GoogleFonts.dmSans(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: isSel ? ClayColors.accent : ClayColors.textMuted,
                    ),
                    onSelected: (selected) {
                      if (selected) {
                        setState(() => _paymentMode = m);
                      }
                    },
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _generateAndShareReceipt,
              style: ElevatedButton.styleFrom(
                backgroundColor: ClayColors.accent,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(50),
                ),
                elevation: 0,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.picture_as_pdf, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'Generate Receipt',
                    style: GoogleFonts.dmSans(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildModalTextField(
    TextEditingController controller,
    String hint,
    IconData icon, {
    TextInputType keyboardType = TextInputType.text,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Color(0x05000000),
            offset: Offset(1, 2),
            blurRadius: 4,
            spreadRadius: 1,
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: TextField(
        controller: controller,
        keyboardType: keyboardType,
        style: GoogleFonts.dmSans(color: ClayColors.textDark),
        decoration: InputDecoration(
          icon: Icon(icon, color: ClayColors.textMuted, size: 20),
          hintText: hint,
          hintStyle: GoogleFonts.dmSans(color: ClayColors.textMuted, fontSize: 14),
          border: InputBorder.none,
        ),
      ),
    );
  }

  String _formatCurrency(double amt) {
    final format = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    return format.format(amt);
  }
}
