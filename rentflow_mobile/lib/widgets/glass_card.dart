import 'dart:ui';
import 'package:flutter/material.dart';
import '../constants/colors.dart';

/// True glassmorphic container widget with BackdropFilter blur, top-left specular
/// highlight border, and semi-transparent frosted fill layer.
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
    this.borderRadius = 22.0,
    this.padding,
    this.margin,
    this.width,
    this.height,
    this.blurIntensity = 16.0,
    this.backgroundColor,
    this.opacity = 0.12,
    this.onTap,
    this.border,
  });

  @override
  Widget build(BuildContext context) {
    Widget card = Container(
      width: width,
      height: height,
      margin: margin,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(borderRadius),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.35),
            blurRadius: 24,
            offset: const Offset(0, 10),
            spreadRadius: -4,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: Stack(
          children: [
            // 1. Frosted Glass Backdrop Blur (blurs light/orbs directly behind the card)
            Positioned.fill(
              child: BackdropFilter(
                filter: ImageFilter.blur(
                  sigmaX: blurIntensity,
                  sigmaY: blurIntensity,
                ),
                child: const SizedBox.expand(),
              ),
            ),

            // 2. Translucent Glass Tint & Specular Top-Left Highlight Border
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(borderRadius),
                  border: border ??
                      Border.all(
                        color: Colors.white.withOpacity(0.20),
                        width: 1.2,
                      ),
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      (backgroundColor ?? Colors.white).withOpacity(opacity + 0.08),
                      (backgroundColor ?? Colors.white).withOpacity(opacity * 0.3),
                    ],
                  ),
                ),
              ),
            ),

            // 3. Child Content
            Padding(
              padding: padding ?? EdgeInsets.zero,
              child: child,
            ),
          ],
        ),
      ),
    );

    if (onTap != null) {
      return GestureDetector(onTap: onTap, child: card);
    }
    return card;
  }
}
