import 'package:flutter/material.dart';

class ClayContainer extends StatelessWidget {
  final Widget? child;
  final double radius;
  final Color color;
  final Color shadowColor;
  final double depth;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final double? width;
  final double? height;

  const ClayContainer({
    Key? key,
    this.child,
    this.radius = 20.0,
    required this.color,
    this.shadowColor = const Color(0x1C19171A),
    this.depth = 5.0,
    this.padding,
    this.margin,
    this.width,
    this.height,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      margin: margin,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(radius),
        boxShadow: [
          // Outer floating shadow
          BoxShadow(
            color: shadowColor.withOpacity(0.06),
            offset: const Offset(0, 10),
            blurRadius: 20,
            spreadRadius: -4,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: Stack(
          children: [
            // Inner Highlight & Shadow Custom Paint
            Positioned.fill(
              child: CustomPaint(
                painter: _ClayInnerShadowPainter(
                  radius: radius,
                  depth: depth,
                ),
              ),
            ),
            if (child != null)
              Padding(
                padding: padding ?? EdgeInsets.zero,
                child: child!,
              ),
          ],
        ),
      ),
    );
  }
}

class _ClayInnerShadowPainter extends CustomPainter {
  final double radius;
  final double depth;

  _ClayInnerShadowPainter({
    required this.radius,
    required this.depth,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromLTWH(0, 0, size.width, size.height);
    final rrect = RRect.fromRectAndRadius(rect, Radius.circular(radius));

    // Paint for the white highlight (top-left)
    final paintHighlight = Paint()
      ..color = Colors.white.withOpacity(0.9)
      ..style = PaintingStyle.stroke
      ..strokeWidth = depth
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, depth * 0.5);

    // Paint for the dark shadow (bottom-right)
    final paintShadow = Paint()
      ..color = Colors.black.withOpacity(0.06)
      ..style = PaintingStyle.stroke
      ..strokeWidth = depth * 1.3
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, depth * 0.8);

    canvas.save();
    canvas.clipRRect(rrect);

    // 1. Draw bottom-right inner shadow (dark offset slightly up-left)
    canvas.save();
    canvas.translate(-depth * 0.6, -depth * 0.6);
    canvas.drawRRect(rrect, paintShadow);
    canvas.restore();

    // 2. Draw top-left inner highlight (light offset slightly down-right)
    canvas.save();
    canvas.translate(depth * 0.6, depth * 0.6);
    canvas.drawRRect(rrect, paintHighlight);
    canvas.restore();

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
