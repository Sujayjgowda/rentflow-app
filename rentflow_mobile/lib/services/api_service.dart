import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const String defaultBaseUrl = 'https://rentflow-app.onrender.com/api';

  // Retrieve current active Base URL
  static Future<String> getBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('custom_base_url') ?? defaultBaseUrl;
  }

  // Set custom Base URL (for local testing e.g. http://10.0.2.2:3000/api)
  static Future<void> setBaseUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('custom_base_url', url);
  }

  // Retrieve stored token
  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('jwt_token');
  }

  // Store token and user data
  static Future<void> saveSession(String token, Map<String, dynamic> user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('jwt_token', token);
    await prefs.setString('user_data', json.encode(user));
  }

  // Clear session
  static Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('jwt_token');
    await prefs.remove('user_data');
  }

  // Fetch current user details
  static Future<Map<String, dynamic>?> getUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userStr = prefs.getString('user_data');
    if (userStr != null) {
      return json.decode(userStr) as Map<String, dynamic>;
    }
    return null;
  }

  // Helper for headers
  static Future<Map<String, String>> _getHeaders({bool jsonContent = true}) async {
    final token = await getToken();
    final headers = <String, String>{};
    if (jsonContent) {
      headers['Content-Type'] = 'application/json';
    }
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  // Auth: Login
  static Future<Map<String, dynamic>> login(String emailOrPhone, String password) async {
    final baseUrl = await getBaseUrl();
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'email': emailOrPhone,
          'password': password,
        }),
      ).timeout(const Duration(seconds: 45));

      final data = json.decode(response.body);
      if (response.statusCode == 200 && data['token'] != null) {
        await saveSession(data['token'], data['user']);
        return {'success': true, 'user': data['user']};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Login failed'};
      }
    } on TimeoutException {
      return {'success': false, 'message': 'Server is waking up (Render cold start). Please tap Sign In again in a moment.'};
    } catch (e) {
      return {'success': false, 'message': 'Network error: Unable to reach server at $baseUrl'};
    }
  }

  // Auth: Register
  static Future<Map<String, dynamic>> register({
    required String name,
    required String phone,
    required String email,
    required String password,
    required String role,
  }) async {
    final baseUrl = await getBaseUrl();
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/register'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'name': name,
          'phone': phone,
          'email': email.isEmpty ? null : email,
          'password': password,
          'role': role,
        }),
      ).timeout(const Duration(seconds: 45));

      final data = json.decode(response.body);
      if (response.statusCode == 201 || response.statusCode == 200) {
        return {'success': true};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Registration failed'};
      }
    } on TimeoutException {
      return {'success': false, 'message': 'Server is waking up. Please retry in a few seconds.'};
    } catch (e) {
      return {'success': false, 'message': 'Network error: Unable to reach server.'};
    }
  }

  // Dashboard
  static Future<Map<String, dynamic>> getDashboard() async {
    final baseUrl = await getBaseUrl();
    final headers = await _getHeaders();
    final user = await getUser();
    final role = user?['role'] ?? 'landlord';

    try {
      final response = await http.get(
        Uri.parse('$baseUrl/dashboard/$role'),
        headers: headers,
      ).timeout(const Duration(seconds: 45));

      if (response.statusCode == 200) {
        return json.decode(response.body) as Map<String, dynamic>;
      } else {
        throw Exception('Server returned ${response.statusCode}');
      }
    } on TimeoutException {
      throw Exception('Server is waking up from sleep. Tap Retry Connection.');
    } catch (e) {
      throw Exception('Connection failed. Server might be waking up.');
    }
  }

  // Generic List Fetcher
  static Future<List<dynamic>> getList(String endpoint) async {
    final baseUrl = await getBaseUrl();
    final headers = await _getHeaders();
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/$endpoint'),
        headers: headers,
      ).timeout(const Duration(seconds: 45));

      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        if (decoded is List) {
          return decoded;
        } else if (decoded is Map) {
          if (decoded.containsKey('data')) {
            return decoded['data'] as List<dynamic>;
          } else if (decoded.containsKey(endpoint)) {
            return decoded[endpoint] as List<dynamic>;
          }
        }
        return [];
      } else {
        throw Exception('Failed to load $endpoint (${response.statusCode})');
      }
    } on TimeoutException {
      throw Exception('Server timeout. Tap to retry.');
    } catch (e) {
      throw Exception('Failed to connect to $endpoint');
    }
  }

  // Properties
  static Future<List<dynamic>> getProperties() async {
    return getList('properties');
  }

  static Future<Map<String, dynamic>> createProperty(Map<String, dynamic> propertyData) async {
    final baseUrl = await getBaseUrl();
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl/properties'),
      headers: headers,
      body: json.encode(propertyData),
    ).timeout(const Duration(seconds: 45));

    if (response.statusCode == 201 || response.statusCode == 200) {
      return json.decode(response.body) as Map<String, dynamic>;
    } else {
      final data = json.decode(response.body);
      throw Exception(data['error'] ?? 'Failed to create property');
    }
  }

  static Future<void> deleteProperty(dynamic id) async {
    final baseUrl = await getBaseUrl();
    final headers = await _getHeaders();
    final response = await http.delete(
      Uri.parse('$baseUrl/properties/$id'),
      headers: headers,
    ).timeout(const Duration(seconds: 45));

    if (response.statusCode != 200) {
      throw Exception('Failed to delete property');
    }
  }

  // Tenants
  static Future<List<dynamic>> getTenants() async {
    return getList('tenants');
  }

  static Future<Map<String, dynamic>> createTenant(Map<String, dynamic> tenantData) async {
    final baseUrl = await getBaseUrl();
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl/tenants'),
      headers: headers,
      body: json.encode(tenantData),
    ).timeout(const Duration(seconds: 45));

    if (response.statusCode == 201 || response.statusCode == 200) {
      return json.decode(response.body) as Map<String, dynamic>;
    } else {
      final data = json.decode(response.body);
      throw Exception(data['error'] ?? 'Failed to add tenant');
    }
  }

  // Transactions
  static Future<List<dynamic>> getTransactions() async {
    final baseUrl = await getBaseUrl();
    final headers = await _getHeaders();
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/transactions'),
        headers: headers,
      ).timeout(const Duration(seconds: 45));

      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        if (decoded is List) {
          return decoded;
        } else if (decoded is Map) {
          if (decoded.containsKey('transactions')) {
            return decoded['transactions'] as List<dynamic>;
          } else if (decoded.containsKey('data')) {
            return decoded['data'] as List<dynamic>;
          }
        }
        return [];
      } else {
        throw Exception('Failed to load transactions');
      }
    } catch (e) {
      throw Exception('Failed to connect to server');
    }
  }

  static Future<Map<String, dynamic>> createTransaction(Map<String, dynamic> txData) async {
    final baseUrl = await getBaseUrl();
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl/transactions'),
      headers: headers,
      body: json.encode(txData),
    ).timeout(const Duration(seconds: 45));

    if (response.statusCode == 201 || response.statusCode == 200) {
      return json.decode(response.body) as Map<String, dynamic>;
    } else {
      final data = json.decode(response.body);
      throw Exception(data['error'] ?? 'Failed to add transaction');
    }
  }

  static Future<void> markTransactionPaid(dynamic id) async {
    final baseUrl = await getBaseUrl();
    final headers = await _getHeaders();
    final response = await http.patch(
      Uri.parse('$baseUrl/transactions/$id/pay'),
      headers: headers,
      body: json.encode({
        'status': 'paid',
        'date_paid': DateTime.now().toIso8601String().split('T')[0],
      }),
    ).timeout(const Duration(seconds: 45));

    if (response.statusCode != 200) {
      throw Exception('Failed to mark payment as paid');
    }
  }

  static Future<void> deleteTransaction(dynamic id) async {
    final baseUrl = await getBaseUrl();
    final headers = await _getHeaders();
    final response = await http.delete(
      Uri.parse('$baseUrl/transactions/$id'),
      headers: headers,
    ).timeout(const Duration(seconds: 45));

    if (response.statusCode != 200) {
      throw Exception('Failed to delete transaction');
    }
  }

  // Shared Bills
  static Future<List<dynamic>> getBills() async {
    return getList('bills');
  }

  static Future<Map<String, dynamic>> createBill(Map<String, dynamic> billData) async {
    final baseUrl = await getBaseUrl();
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl/bills'),
      headers: headers,
      body: json.encode(billData),
    ).timeout(const Duration(seconds: 45));

    if (response.statusCode == 201 || response.statusCode == 200) {
      return json.decode(response.body) as Map<String, dynamic>;
    } else {
      final data = json.decode(response.body);
      throw Exception(data['error'] ?? 'Failed to add bill');
    }
  }

  static Future<void> markBillPaid(dynamic id) async {
    final baseUrl = await getBaseUrl();
    final headers = await _getHeaders();
    final response = await http.patch(
      Uri.parse('$baseUrl/bills/$id/status'),
      headers: headers,
      body: json.encode({'status': 'paid'}),
    ).timeout(const Duration(seconds: 45));

    if (response.statusCode != 200) {
      throw Exception('Failed to update bill status');
    }
  }

  // Advance Payments
  static Future<List<dynamic>> getAdvances() async {
    return getList('advances');
  }

  static Future<Map<String, dynamic>> createAdvance(Map<String, dynamic> advanceData) async {
    final baseUrl = await getBaseUrl();
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl/advances'),
      headers: headers,
      body: json.encode(advanceData),
    ).timeout(const Duration(seconds: 45));

    if (response.statusCode == 201 || response.statusCode == 200) {
      return json.decode(response.body) as Map<String, dynamic>;
    } else {
      final data = json.decode(response.body);
      throw Exception(data['error'] ?? 'Failed to add advance payment');
    }
  }

  static Future<void> deleteAdvance(dynamic id) async {
    final baseUrl = await getBaseUrl();
    final headers = await _getHeaders();
    final response = await http.delete(
      Uri.parse('$baseUrl/advances/$id'),
      headers: headers,
    ).timeout(const Duration(seconds: 45));

    if (response.statusCode != 200) {
      throw Exception('Failed to delete advance payment');
    }
  }

  // Agreements
  static Future<List<dynamic>> getAgreements() async {
    return getList('agreements');
  }
}
