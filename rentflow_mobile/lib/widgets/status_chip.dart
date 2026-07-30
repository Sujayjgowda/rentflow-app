import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants/colors.dart';

/// Glowing neon status chip for Paid / Pending / Overdue / Occupied / Vacant.
class StatusChip extends StatelessWidget {
  final String status;
  final double fontSize;
  final EdgeInsetsGeometry? padding;

  const StatusChip({
    super.key,
    required this.status,
    this.fontSize = 11,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    final lower = status.toLowerCase();

    Color color;
    Color bgColor;
    String label = status.toUpperCase();

    if (lower == 'paid' || lower == 'occupied' || lower == 'active') {
      color = AppColors.success;
      bgColor = AppColors.successBg;
    } else if (lower == 'pending') {
      color = AppColors.warning;
      bgColor = AppColors.warningBg;
    } else if (lower == 'overdue' || lower == 'unpaid' || lower == 'inactive') {
      color = AppColors.error;
      bgColor = AppColors.errorBg;
    } else if (lower == 'vacant') {
      color = AppColors.info;
      bgColor = AppColors.infoBg;
    } else {
      color = AppColors.accentCyan;
      bgColor = AppColors.accentCyan.withOpacity(0.15);
    }

    return Container(
      padding: padding ?? const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.3), width: 1),
        boxShadow: [
          BoxShadow(
            color: color.withOpacity(0.15),
            blurRadius: 8,
            spreadRadius: 0,
          ),
        ],
      ),
      child: Text(
        label,
        style: GoogleFonts.plusJakartaSans(
          fontSize: fontSize,
          fontWeight: FontWeight.w700,
          color: color,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}
