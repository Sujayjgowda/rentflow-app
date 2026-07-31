import 'package:flutter/material.dart';
import '../constants/colors.dart';

/// A wrapper scaffold that renders glowing ambient gradient light orbs behind
/// all page content, making frosted GlassCard blur and highlights visually pop.
class GlassScaffold extends StatelessWidget {
  final Widget body;
  final PreferredSizeWidget? appBar;
  final Widget? bottomNavigationBar;
  final Widget? floatingActionButton;
  final FloatingActionButtonLocation? floatingActionButtonLocation;

  const GlassScaffold({
    super.key,
    required this.body,
    this.appBar,
    this.bottomNavigationBar,
    this.floatingActionButton,
    this.floatingActionButtonLocation,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      extendBodyBehindAppBar: true,
      appBar: appBar,
      body: Stack(
        children: [
          // Deep Navy Dark Background
          Positioned.fill(
            child: Container(
              color: const Color(0xFF0C0C18),
            ),
          ),

          // Glowing Purple Radial Orb (Top Left)
          Positioned(
            top: -80,
            left: -80,
            child: Container(
              width: 320,
              height: 320,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    Color(0x887C3AED), // Vibrant purple glow
                    Color(0x447C3AED),
                    Colors.transparent,
                  ],
                  stops: [0.0, 0.45, 1.0],
                ),
              ),
            ),
          ),

          // Glowing Cyan Radial Orb (Mid Right)
          Positioned(
            top: 240,
            right: -90,
            child: Container(
              width: 340,
              height: 340,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    Color(0x6606B6D4), // Neon cyan glow
                    Color(0x3306B6D4),
                    Colors.transparent,
                  ],
                  stops: [0.0, 0.5, 1.0],
                ),
              ),
            ),
          ),

          // Glowing Indigo Radial Orb (Bottom Left)
          Positioned(
            bottom: -60,
            left: -60,
            child: Container(
              width: 300,
              height: 300,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    Color(0x556366F1), // Deep indigo glow
                    Color(0x226366F1),
                    Colors.transparent,
                  ],
                  stops: [0.0, 0.5, 1.0],
                ),
              ),
            ),
          ),

          // Page Content
          SafeArea(
            child: body,
          ),
        ],
      ),
      bottomNavigationBar: bottomNavigationBar,
      floatingActionButton: floatingActionButton,
      floatingActionButtonLocation: floatingActionButtonLocation,
    );
  }
}
