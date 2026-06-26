import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../constants/colors.dart';
import '../services/api_service.dart';
import '../widgets/clay_container.dart';

class PropertiesScreen extends StatefulWidget {
  const PropertiesScreen({Key? key}) : super(key: key);

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
        _errorMessage = 'Failed to load properties from server.';
        _isLoading = false;
      });
    }
  }

  Future<void> _deleteProperty(int id) async {
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
    final depositController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
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
                  'Add New Property',
                  style: GoogleFonts.lora(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: ClayColors.textDark,
                  ),
                ),
                const SizedBox(height: 20),
                _buildModalTextField(nameController, 'Property Name (e.g. Apartment 3B)', Icons.business_outlined),
                const SizedBox(height: 12),
                _buildModalTextField(typeController, 'Type (e.g. Apartment, Villa)', Icons.house_outlined),
                const SizedBox(height: 12),
                _buildModalTextField(addressController, 'Address', Icons.location_on_outlined),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _buildModalTextField(
                        rentController,
                        'Rent Amount (₹)',
                        Icons.payments_outlined,
                        keyboardType: TextInputType.number,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _buildModalTextField(
                        depositController,
                        'Deposit (₹)',
                        Icons.security_outlined,
                        keyboardType: TextInputType.number,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () async {
                    if (nameController.text.isEmpty ||
                        typeController.text.isEmpty ||
                        rentController.text.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Please fill all required fields')),
                      );
                      return;
                    }

                    try {
                      await ApiService.createProperty({
                        'name': nameController.text.trim(),
                        'type': typeController.text.trim(),
                        'address': addressController.text.trim(),
                        'rent_amount': double.parse(rentController.text),
                        'deposit_amount': depositController.text.isEmpty
                            ? 0.0
                            : double.parse(depositController.text),
                      });
                      Navigator.pop(context);
                      _fetchProperties();
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
                    'Save Property',
                    style: GoogleFonts.dmSans(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(
                  child: Text(_errorMessage!, style: GoogleFonts.dmSans(color: ClayColors.red)),
                )
              : RefreshIndicator(
                  onRefresh: _fetchProperties,
                  child: _properties.isEmpty
                      ? Center(
                          child: Text(
                            'No properties added yet.',
                            style: GoogleFonts.dmSans(color: ClayColors.textMuted),
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(20.0),
                          itemCount: _properties.length,
                          itemBuilder: (context, index) {
                            final prop = _properties[index];
                            final status = prop['status'] ?? 'vacant';
                            final isOccupied = status.toLowerCase() == 'occupied';

                            final rentAmount = (prop['rent_amount'] ?? 0).toDouble();

                            return ClayContainer(
                              color: Colors.white,
                              margin: const EdgeInsets.only(bottom: 16),
                              padding: const EdgeInsets.all(20),
                              child: Row(
                                children: [
                                  // Clay Property Icon
                                  ClayContainer(
                                    width: 50,
                                    height: 50,
                                    radius: 12,
                                    color: isOccupied ? ClayColors.pastelBlue : ClayColors.pastelGreen,
                                    child: Center(
                                      child: Text(
                                        isOccupied ? '🏢' : '🏡',
                                        style: const TextStyle(fontSize: 22),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 16),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          prop['name'] ?? 'Property',
                                          style: GoogleFonts.dmSans(
                                            fontSize: 16,
                                            fontWeight: FontWeight.bold,
                                            color: ClayColors.textDark,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          prop['address'] ?? 'No Address',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: GoogleFonts.dmSans(
                                            fontSize: 13,
                                            color: ClayColors.textMuted,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                        const SizedBox(height: 8),
                                        Row(
                                          children: [
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                              decoration: BoxDecoration(
                                                color: isOccupied
                                                    ? ClayColors.pastelBlue
                                                    : ClayColors.pastelGreen,
                                                borderRadius: BorderRadius.circular(8),
                                              ),
                                              child: Text(
                                                isOccupied ? 'Occupied' : 'Vacant',
                                                style: GoogleFonts.dmSans(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.bold,
                                                  color: isOccupied ? ClayColors.blue : ClayColors.green,
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            Text(
                                              _formatCurrency(rentAmount),
                                              style: GoogleFonts.lora(
                                                fontWeight: FontWeight.bold,
                                                color: ClayColors.accent,
                                                fontSize: 14,
                                              ),
                                            ),
                                            Text(
                                              '/mo',
                                              style: GoogleFonts.dmSans(
                                                fontSize: 11,
                                                color: ClayColors.textMuted,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                  // Delete Button
                                  IconButton(
                                    icon: const Icon(Icons.delete_outline, color: ClayColors.textMuted),
                                    onPressed: () {
                                      showDialog(
                                        context: context,
                                        builder: (context) => AlertDialog(
                                          title: Text('Delete Property', style: GoogleFonts.lora(fontWeight: FontWeight.bold)),
                                          content: Text('Are you sure you want to delete ${prop['name']}?'),
                                          actions: [
                                            TextButton(
                                              onPressed: () => Navigator.pop(context),
                                              child: const Text('Cancel'),
                                            ),
                                            TextButton(
                                              onPressed: () {
                                                Navigator.pop(context);
                                                _deleteProperty(prop['id']);
                                              },
                                              child: const Text('Delete', style: TextStyle(color: Colors.red)),
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
        backgroundColor: ClayColors.accent,
        child: const Icon(Icons.add, color: Colors.white),
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
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A000000),
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
          hintStyle: GoogleFonts.dmSans(color: ClayColors.textMuted),
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
