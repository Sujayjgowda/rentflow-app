import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../constants/colors.dart';
import '../services/api_service.dart';
import '../widgets/clay_container.dart';

class AgreementsScreen extends StatefulWidget {
  const AgreementsScreen({Key? key}) : super(key: key);

  @override
  State<AgreementsScreen> createState() => _AgreementsScreenState();
}

class _AgreementsScreenState extends State<AgreementsScreen> {
  List<dynamic> _agreements = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchAgreements();
  }

  Future<void> _fetchAgreements() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final agreements = await ApiService.getList('agreements');
      setState(() {
        _agreements = agreements;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load agreements.';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        title: Text('Lease Agreements', style: GoogleFonts.lora(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(child: Text(_errorMessage!, style: GoogleFonts.dmSans(color: ClayColors.red)))
              : RefreshIndicator(
                  onRefresh: _fetchAgreements,
                  child: _agreements.isEmpty
                      ? Center(child: Text('No active lease agreements found.', style: GoogleFonts.dmSans(color: ClayColors.textMuted)))
                      : ListView.builder(
                          padding: const EdgeInsets.all(20.0),
                          itemCount: _agreements.length,
                          itemBuilder: (context, index) {
                            final ag = _agreements[index];
                            final uploadDate = ag['created_at'] != null
                                ? DateTime.parse(ag['created_at'])
                                : DateTime.now();
                            final dateStr = DateFormat('dd MMM yyyy').format(uploadDate);

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
                                    color: ClayColors.pastelBlue,
                                    child: const Center(
                                      child: Text('📄', style: TextStyle(fontSize: 20)),
                                    ),
                                  ),
                                  const SizedBox(width: 16),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          ag['file_name'] ?? 'Agreement Document',
                                          style: GoogleFonts.dmSans(
                                            fontSize: 15,
                                            fontWeight: FontWeight.bold,
                                            color: ClayColors.textDark,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          'Uploaded on $dateStr · ${ag['property_name'] ?? 'General'}',
                                          style: GoogleFonts.dmSans(fontSize: 12, color: ClayColors.textMuted),
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
