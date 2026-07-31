import 'package:flutter/material.dart';

class AppColors {
  // ── Light Background ──
  static const Color bgDark = Color(0xFFFFFFFF);       // Pure white
  static const Color bgMid = Color(0xFFF8FAFC);        // Off-white
  static const Color bgDeep = Color(0xFFF1F5F9);       // Slate-100
  static const Color bgCard = Color(0xFFFFFFFF);        // White cards

  // ── Card & Border ──
  static Color glassBorder = const Color(0xFFE2E8F0);   // Slate-200
  static Color glassWhite = const Color(0xFFF8FAFC);
  static Color glassHighlight = const Color(0xFFE2E8F0);

  // ── Accent Colors (Brand Identity) ──
  static const Color accentPurple = Color(0xFF7C3AED);
  static const Color accentCyan = Color(0xFF06B6D4);
  static const Color accentPink = Color(0xFFEC4899);
  static const Color accentIndigo = Color(0xFF6366F1);

  static const LinearGradient accentGradient = LinearGradient(
    colors: [accentPurple, accentCyan],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient bgGradient = LinearGradient(
    colors: [Color(0xFFFFFFFF), Color(0xFFF8FAFC), Color(0xFFF1F5F9)],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  static const LinearGradient warmGradient = LinearGradient(
    colors: [Color(0xFFFF6B6B), Color(0xFFFF8E53)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient greenGradient = LinearGradient(
    colors: [Color(0xFF10B981), Color(0xFF34D399)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // ── Text Colors ──
  static const Color textPrimary = Color(0xFF1E293B);    // Slate-800
  static const Color textSecondary = Color(0xFF64748B);   // Slate-500
  static const Color textMuted = Color(0xFF94A3B8);       // Slate-400
  static const Color textWhite = Colors.white;

  // ── Status Colors ──
  static const Color success = Color(0xFF10B981);
  static const Color successBg = Color(0xFFECFDF5);
  static const Color warning = Color(0xFFF59E0B);
  static const Color warningBg = Color(0xFFFFFBEB);
  static const Color error = Color(0xFFEF4444);
  static const Color errorBg = Color(0xFFFEF2F2);
  static const Color info = Color(0xFF3B82F6);
  static const Color infoBg = Color(0xFFEFF6FF);

  // ── Card Surface ──
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceLight = Color(0xFFF1F5F9);
  static const Color divider = Color(0xFFE2E8F0);
}
