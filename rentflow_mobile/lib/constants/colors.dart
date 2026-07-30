import 'package:flutter/material.dart';

class AppColors {
  // ── Dark Background Gradients ──
  static const Color bgDark = Color(0xFF0F0F1A);
  static const Color bgMid = Color(0xFF1A1A2E);
  static const Color bgDeep = Color(0xFF16213E);
  static const Color bgCard = Color(0xFF1E1E32);

  // ── Glass Effect Colors ──
  static Color glassWhite = Colors.white.withOpacity(0.08);
  static Color glassBorder = Colors.white.withOpacity(0.12);
  static Color glassHighlight = Colors.white.withOpacity(0.15);

  // ── Accent Gradient (Purple → Cyan) ──
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
    colors: [bgDark, bgMid, bgDeep],
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
  static const Color textPrimary = Color(0xFFF1F5F9);
  static const Color textSecondary = Color(0xFF94A3B8);
  static const Color textMuted = Color(0xFF64748B);
  static const Color textWhite = Colors.white;

  // ── Status Colors ──
  static const Color success = Color(0xFF10B981);
  static const Color successBg = Color(0x1A10B981);
  static const Color warning = Color(0xFFF59E0B);
  static const Color warningBg = Color(0x1AF59E0B);
  static const Color error = Color(0xFFEF4444);
  static const Color errorBg = Color(0x1AEF4444);
  static const Color info = Color(0xFF3B82F6);
  static const Color infoBg = Color(0x1A3B82F6);

  // ── Card Surface ──
  static const Color surface = Color(0xFF1E1E32);
  static const Color surfaceLight = Color(0xFF252540);
  static const Color divider = Color(0xFF2D2D48);
}
