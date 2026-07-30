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

class PropertiesScreen extends StatefulWidget {
  const PropertiesScreen({super.key});

  @override
  State<PropertiesScreen> createState() => _PropertiesScreenState();
}

class _PropertiesScreenState extends State<PropertiesScreen> {
  List<dynamic> _properties = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchProperties();
  }

  Future<void> _fetchProperties() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final properties = await ApiService.getProperties();
      setState(() {
        _properties = properties;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load properties.';
        _isLoading = false;
      });
    }
  }

  Future<void> _deleteProperty(dynamic id) async {
    try {
      await ApiService.deleteProperty(id);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Property deleted successfully')),
      );
      _fetchProperties();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
      );
    }
  }

  void _showAddPropertyDialog() {
    final nameController = TextEditingController();
    final typeController = TextEditingController();
    final addressController = TextEditingController();
    final rentController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
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
                  'Add New Property',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 20),
                GlassTextField(
                  controller: nameController,
                  hintText: 'Property Name (e.g. Sunset Heights 4B)',
                  prefixIcon: Icons.domain_outlined,
                ),
                const SizedBox(height: 12),
                GlassTextField(
                  controller: typeController,
                  hintText: 'Type (e.g. Apartment, Villa)',
                  prefixIcon: Icons.home_outlined,
                ),
                const SizedBox(height: 12),
                GlassTextField(
                  controller: addressController,
                  hintText: 'Address',
                  prefixIcon: Icons.location_on_outlined,
                ),
                const SizedBox(height: 12),
                GlassTextField(
                  controller: rentController,
                  hintText: 'Monthly Rent (₹)',
                  prefixIcon: Icons.payments_outlined,
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 24),
                GradientButton(
                  text: 'Save Property',
                  onPressed: () async {
                    if (nameController.text.trim().isEmpty ||
                        rentController.text.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Please fill property name and rent amount'),
                        ),
                      );
                      return;
                    }

                    try {
                      await ApiService.createProperty({
                        'name': nameController.text.trim(),
                        'property_type': typeController.text.trim().isEmpty
                            ? 'apartment'
                            : typeController.text.trim(),
                        'address': addressController.text.trim(),
                        'rent_amount': double.parse(rentController.text),
                      });
                      Navigator.pop(context);
                      _fetchProperties();
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
      backgroundColor: Colors.transparent,
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
                  onRefresh: _fetchProperties,
                  color: AppColors.accentPurple,
                  child: _properties.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(
                                Icons.domain_disabled_outlined,
                                size: 48,
                                color: AppColors.textMuted,
                              ),
                              const SizedBox(height: 12),
                              Text(
                                'No properties added yet.',
                                style: GoogleFonts.plusJakartaSans(
                                  color: AppColors.textMuted,
                                ),
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(20.0),
                          itemCount: _properties.length,
                          itemBuilder: (context, index) {
                            final prop = _properties[index];
                            final status = (prop['status'] ?? 'vacant').toString();
                            final isOccupied = status.toLowerCase() == 'occupied' ||
                                (prop['tenant_name'] != null &&
                                    prop['tenant_name'].toString().isNotEmpty);

                            final rentAmount = parseDouble(prop['rent_amount']);

                            return GlassCard(
                              margin: const EdgeInsets.only(bottom: 14),
                              padding: const EdgeInsets.all(18),
                              child: Row(
                                children: [
                                  // Property Icon
                                  Container(
                                    width: 48,
                                    height: 48,
                                    decoration: BoxDecoration(
                                      gradient: isOccupied
                                          ? AppColors.accentGradient
                                          : AppColors.greenGradient,
                                      borderRadius: BorderRadius.circular(14),
                                    ),
                                    child: Icon(
                                      isOccupied
                                          ? Icons.business
                                          : Icons.home_work,
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
                                          prop['name'] ?? 'Property',
                                          style: GoogleFonts.plusJakartaSans(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w700,
                                            color: AppColors.textPrimary,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          prop['address'] ?? 'No Address',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: GoogleFonts.plusJakartaSans(
                                            fontSize: 12,
                                            color: AppColors.textSecondary,
                                          ),
                                        ),
                                        const SizedBox(height: 8),
                                        Row(
                                          children: [
                                            StatusChip(
                                              status: isOccupied
                                                  ? 'Occupied'
                                                  : 'Vacant',
                                            ),
                                            const SizedBox(width: 10),
                                            Text(
                                              '${_formatCurrency(rentAmount)}/mo',
                                              style:
                                                  GoogleFonts.plusJakartaSans(
                                                fontWeight: FontWeight.w800,
                                                color: AppColors.accentCyan,
                                                fontSize: 14,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                  // Delete Button
                                  IconButton(
                                    icon: const Icon(
                                      Icons.delete_outline,
                                      color: AppColors.textMuted,
                                      size: 20,
                                    ),
                                    onPressed: () {
                                      showDialog(
                                        context: context,
                                        builder: (context) => AlertDialog(
                                          backgroundColor: AppColors.surface,
                                          title: Text(
                                            'Delete Property',
                                            style: GoogleFonts.plusJakartaSans(
                                              fontWeight: FontWeight.w700,
                                              color: AppColors.textPrimary,
                                            ),
                                          ),
                                          content: Text(
                                            'Are you sure you want to delete ${prop['name']}?',
                                            style: GoogleFonts.plusJakartaSans(
                                              color: AppColors.textSecondary,
                                            ),
                                          ),
                                          actions: [
                                            TextButton(
                                              onPressed: () =>
                                                  Navigator.pop(context),
                                              child: Text(
                                                'Cancel',
                                                style: GoogleFonts
                                                    .plusJakartaSans(
                                                  color: AppColors.textMuted,
                                                ),
                                              ),
                                            ),
                                            TextButton(
                                              onPressed: () {
                                                Navigator.pop(context);
                                                _deleteProperty(prop['id']);
                                              },
                                              child: Text(
                                                'Delete',
                                                style: GoogleFonts
                                                    .plusJakartaSans(
                                                  color: AppColors.error,
                                                  fontWeight: FontWeight.w700,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      );
                                    },
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showAddPropertyDialog,
        backgroundColor: AppColors.accentPurple,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }
}
