import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../constants/colors.dart';
import '../services/api_service.dart';
import '../widgets/glass_card.dart';

class AgreementsScreen extends StatefulWidget {
  const AgreementsScreen({super.key});

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
      final agreements = await ApiService.getAgreements();
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

  void _openFileUrl(String filePath) async {
    String urlStr = filePath;
    if (!urlStr.startsWith('http')) {
      final baseUrl = await ApiService.getBaseUrl();
      urlStr = '${baseUrl.replaceAll('/api', '')}$filePath';
    }
    final url = Uri.parse(urlStr);
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not open document link: $urlStr')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          title: Text(
            'Lease Agreements',
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
                    onRefresh: _fetchAgreements,
                    color: AppColors.accentPurple,
                    child: _agreements.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(
                                  Icons.description_outlined,
                                  size: 48,
                                  color: AppColors.textMuted,
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  'No lease agreements uploaded.',
                                  style: GoogleFonts.plusJakartaSans(
                                    color: AppColors.textMuted,
                                  ),
                                ),
                              ],
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(20.0),
                            itemCount: _agreements.length,
                            itemBuilder: (context, index) {
                              final ag = _agreements[index];
                              final dateStr = ag['uploaded_at'] != null
                                  ? DateFormat('dd MMM yyyy').format(
                                      DateTime.parse(ag['uploaded_at']))
                                  : 'N/A';
                              final isPdf = (ag['file_type'] ?? '')
                                  .toString()
                                  .contains('pdf');
                              final filePath = ag['file_path'] ?? '';

                              return GlassCard(
                                margin: const EdgeInsets.only(bottom: 14),
                                padding: const EdgeInsets.all(16),
                                onTap: filePath.isNotEmpty
                                    ? () => _openFileUrl(filePath)
                                    : null,
                                child: Row(
                                  children: [
                                    Container(
                                      width: 46,
                                      height: 46,
                                      decoration: BoxDecoration(
                                        gradient: isPdf
                                            ? AppColors.warmGradient
                                            : AppColors.accentGradient,
                                        borderRadius:
                                            BorderRadius.circular(12),
                                      ),
                                      child: Icon(
                                        isPdf
                                            ? Icons.picture_as_pdf
                                            : Icons.image_outlined,
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
                                            ag['file_name'] ??
                                                'Lease Agreement Document',
                                            style: GoogleFonts.plusJakartaSans(
                                              fontSize: 15,
                                              fontWeight: FontWeight.w700,
                                              color: AppColors.textPrimary,
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            'Uploaded on $dateStr · ${ag['property_name'] ?? 'General'}',
                                            style: GoogleFonts.plusJakartaSans(
                                              fontSize: 12,
                                              color: AppColors.textSecondary,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const Icon(
                                      Icons.open_in_new,
                                      color: AppColors.accentCyan,
                                      size: 20,
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
