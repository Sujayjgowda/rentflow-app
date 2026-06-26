import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const String baseUrl = 'https://rentflow-app.onrender.com/api';

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
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'email': emailOrPhone, // Backend routes handle email or phone here
        'password': password,
      }),
    );

    final data = json.decode(response.body);
    if (response.statusCode == 200 && data['token'] != null) {
      await saveSession(data['token'], data['user']);
      return {'success': true, 'user': data['user']};
    } else {
      return {'success': false, 'message': data['error'] ?? 'Login failed'};
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
    );

    final data = json.decode(response.body);
    if (response.statusCode == 201 || response.statusCode == 200) {
      return {'success': true};
    } else {
      return {'success': false, 'message': data['error'] ?? 'Registration failed'};
    }
  }

  // Dashboard: Get portfolio stats and recent items dynamically based on role
  static Future<Map<String, dynamic>> getDashboard() async {
    final headers = await _getHeaders();
    final user = await getUser();
    final role = user?['role'] ?? 'landlord';
    
    final response = await http.get(
      Uri.parse('$baseUrl/dashboard/$role'),
      headers: headers,
    );

    if (response.statusCode == 200) {
      return json.decode(response.body) as Map<String, dynamic>;
    } else {
      throw Exception('Failed to load dashboard data');
    }
  }

  // Generic List Fetcher (for Tenants, Agreements, Bills, etc.)
  static Future<List<dynamic>> getList(String endpoint) async {
    final headers = await _getHeaders();
    final response = await http.get(
      Uri.parse('$baseUrl/$endpoint'),
      headers: headers,
    );

    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      if (decoded is List) {
        return decoded;
      } else if (decoded is Map && decoded.containsKey('data')) {
        return decoded['data'] as List<dynamic>;
      }
      return [];
    } else {
      throw Exception('Failed to load $endpoint');
    }
  }

  // Properties: Get list
  static Future<List<dynamic>> getProperties() async {
    final headers = await _getHeaders();
    final response = await http.get(
      Uri.parse('$baseUrl/properties'),
      headers: headers,
    );

    if (response.statusCode == 200) {
      return json.decode(response.body) as List<dynamic>;
    } else {
      throw Exception('Failed to load properties');
    }
  }

  // Properties: Create
  static Future<Map<String, dynamic>> createProperty(Map<String, dynamic> propertyData) async {
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl/properties'),
      headers: headers,
      body: json.encode(propertyData),
    );

    if (response.statusCode == 201 || response.statusCode == 200) {
      return json.decode(response.body) as Map<String, dynamic>;
    } else {
      final data = json.decode(response.body);
      throw Exception(data['error'] ?? 'Failed to create property');
    }
  }

  // Properties: Delete
  static Future<void> deleteProperty(int id) async {
    final headers = await _getHeaders();
    final response = await http.delete(
      Uri.parse('$baseUrl/properties/$id'),
      headers: headers,
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to delete property');
    }
  }

  // Tenants: Get list
  static Future<List<dynamic>> getTenants() async {
    final headers = await _getHeaders();
    final response = await http.get(
      Uri.parse('$baseUrl/tenants'),
      headers: headers,
    );

    if (response.statusCode == 200) {
      return json.decode(response.body) as List<dynamic>;
    } else {
      throw Exception('Failed to load tenants');
    }
  }

  // Transactions: Get list
  static Future<List<dynamic>> getTransactions() async {
    final headers = await _getHeaders();
    final response = await http.get(
      Uri.parse('$baseUrl/transactions'),
      headers: headers,
    );

    if (response.statusCode == 200) {
      return json.decode(response.body) as List<dynamic>;
    } else {
      throw Exception('Failed to load transactions');
    }
  }

  // Transactions: Create
  static Future<Map<String, dynamic>> createTransaction(Map<String, dynamic> txData) async {
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl/transactions'),
      headers: headers,
      body: json.encode(txData),
    );

    if (response.statusCode == 201 || response.statusCode == 200) {
      return json.decode(response.body) as Map<String, dynamic>;
    } else {
      final data = json.decode(response.body);
      throw Exception(data['error'] ?? 'Failed to add transaction');
    }
  }

  // Transactions: Delete
  static Future<void> deleteTransaction(int id) async {
    final headers = await _getHeaders();
    final response = await http.delete(
      Uri.parse('$baseUrl/transactions/$id'),
      headers: headers,
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to delete transaction');
    }
  }
}
