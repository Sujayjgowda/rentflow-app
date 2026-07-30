import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rentflow_mobile/main.dart';

void main() {
  testWidgets('App loads cleanly smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const RentFlowApp(initialScreen: Scaffold(body: Text('RentFlow'))));
    expect(find.text('RentFlow'), findsOneWidget);
  });
}
