import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../constants/colors.dart';
import '../services/api_service.dart';
import '../widgets/clay_container.dart';

class BillsScreen extends StatefulWidget {
  const BillsScreen({Key? key}) : super(key: key);

  @override
  State<BillsScreen> createState() => _BillsScreenState();
}

class _BillsScreenState extends State<BillsScreen> {
  List<dynamic> _bills = [];
  bool _isLoading = true;
  String? _errorMessage;

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
      final bills = await ApiService.getList('bills');
      setState(() {
        _bills = bills;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load bills.';
        _isLoading = false;
      });
    }
  }

  String _formatCurrency(double amt) {
    final format = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    return format.format(amt);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        title: Text('Shared Bills', style: GoogleFonts.lora(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(child: Text(_errorMessage!, style: GoogleFonts.dmSans(color: ClayColors.red)))
              : RefreshIndicator(
                  onRefresh: _fetchBills,
                  child: _bills.isEmpty
                      ? Center(child: Text('No shared bills recorded.', style: GoogleFonts.dmSans(color: ClayColors.textMuted)))
                      : ListView.builder(
                          padding: const EdgeInsets.all(20.0),
                          itemCount: _bills.length,
                          itemBuilder: (context, index) {
                            final bill = _bills[index];
                            final total = (bill['total_amount'] ?? 0).toDouble();
                            final share = (bill['tenant_share'] ?? 0).toDouble();
                            final date = DateTime.parse(bill['due_date']);
                            final dateStr = DateFormat('dd MMM yyyy').format(date);
                            final isPaid = bill['status'] == 'paid';

                            return ClayContainer(
                              color: Colors.white,
                              margin: const EdgeInsets.only(bottom: 16),
                              padding: const EdgeInsets.all(16),
                              child: Row(
                                children: [
                                  ClayContainer(
                                    width: 46,
                                    height: 46,
                                    radius: 12,
                                    color: isPaid ? ClayColors.pastelGreen : ClayColors.pastelRed,
                                    child: Center(
                                      child: Text(
                                        isPaid ? '🔌' : '⚡',
                                        style: const TextStyle(fontSize: 20),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 16),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          bill['bill_name'] ?? 'Bill',
                                          style: GoogleFonts.dmSans(
                                            fontSize: 16,
                                            fontWeight: FontWeight.bold,
                                            color: ClayColors.textDark,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          'Total: ${_formatCurrency(total)} · Due by $dateStr',
                                          style: GoogleFonts.dmSans(fontSize: 12, color: ClayColors.textMuted),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          'Tenant Share: ${_formatCurrency(share)}',
                                          style: GoogleFonts.dmSans(
                                            fontSize: 13,
                                            fontWeight: FontWeight.bold,
                                            color: isPaid ? ClayColors.green : ClayColors.red,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: isPaid ? ClayColors.pastelGreen : ClayColors.pastelRed,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      isPaid ? 'Paid' : 'Unpaid',
                                      style: GoogleFonts.dmSans(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                        color: isPaid ? ClayColors.green : ClayColors.red,
                                      ),
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
