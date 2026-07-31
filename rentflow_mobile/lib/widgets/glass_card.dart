import 'package:flutter/material.dart';
import '../constants/colors.dart';

/// Clean elevated white card — replaces the old glassmorphic card.
class GlassCard extends StatelessWidget {
  final Widget? child;
  final double borderRadius;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final double? width;
  final double? height;
  final double blurIntensity; // ignored, kept for API compat
  final Color? backgroundColor;
  final double opacity; // ignored, kept for API compat
  final VoidCallback? onTap;
  final Border? border;

  const GlassCard({
    super.key,
    this.child,
    this.borderRadius = 16.0,
    this.padding,
    this.margin,
    this.width,
    this.height,
    this.blurIntensity = 0,
    this.backgroundColor,
    this.opacity = 1.0,
    this.onTap,
    this.border,
  });

  @override
  Widget build(BuildContext context) {
    Widget card = Container(
      width: width,
      height: height,
      margin: margin,
      padding: padding,
      decoration: BoxDecoration(
        color: backgroundColor ?? Colors.white,
        borderRadius: BorderRadius.circular(borderRadius),
        border: border ??
            Border.all(
              color: AppColors.glassBorder,
              width: 1,
            ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
            spreadRadius: 0,
          ),
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 4,
            offset: const Offset(0, 1),
            spreadRadius: 0,
          ),
        ],
      ),
      child: child,
    );

    if (onTap != null) {
      return GestureDetector(onTap: onTap, child: card);
    }
    return card;
  }
}
