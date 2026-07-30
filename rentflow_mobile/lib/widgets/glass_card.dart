import 'dart:ui';
import 'package:flutter/material.dart';
import '../constants/colors.dart';

/// A glassmorphic container widget with frosted blur, semi-transparent fill,
/// and subtle highlight border — the core building block for all cards.
class GlassCard extends StatelessWidget {
  final Widget? child;
  final double borderRadius;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final double? width;
  final double? height;
  final double blurIntensity;
  final Color? backgroundColor;
  final double opacity;
  final VoidCallback? onTap;
  final Border? border;

  const GlassCard({
    super.key,
    this.child,
    this.borderRadius = 20.0,
    this.padding,
    this.margin,
    this.width,
    this.height,
    this.blurIntensity = 10.0,
    this.backgroundColor,
    this.opacity = 0.08,
    this.onTap,
    this.border,
  });

  @override
  Widget build(BuildContext context) {
    final card = Container(
      width: width,
      height: height,
      margin: margin,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(borderRadius),
        border: border ??
            Border.all(
              color: AppColors.glassBorder,
              width: 1,
            ),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            (backgroundColor ?? Colors.white).withOpacity(opacity + 0.04),
            (backgroundColor ?? Colors.white).withOpacity(opacity),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.2),
            blurRadius: 20,
            offset: const Offset(0, 8),
            spreadRadius: -4,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: BackdropFilter(
          filter: ImageFilter.blur(
            sigmaX: blurIntensity,
            sigmaY: blurIntensity,
          ),
          child: Padding(
            padding: padding ?? EdgeInsets.zero,
            child: child,
          ),
        ),
      ),
    );

    if (onTap != null) {
      return GestureDetector(onTap: onTap, child: card);
    }
    return card;
  }
}
