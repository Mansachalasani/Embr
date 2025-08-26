import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { signInWithGoogle } from '../../services/auth-simple';
import { router } from 'expo-router';
import AuthDebug from '../../components/AuthDebug';
import { AuthDebugger } from '../../utils/authDebugger';
import { testManualSession, testDirectAuth } from '../../services/auth-test';
import { signInWithGoogleFallback, signInWithSupabaseDirect } from '../../services/auth-fallback';
import { supabase } from '../../lib/supabase';

export default function SignIn() {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      console.log('🎯 Starting Google Sign-In process...');
      
      const result = await signInWithGoogle();
      console.log('🔄 Sign in result:', result);
      
      if (result.type === 'success') {
        console.log('✅ Sign in successful! AuthContext will handle redirect.');
        // await supabase.from("user_profiles").upsert({ id: result.user.id, email: result.user.email,google_refresh_token: result.provider_refresh_token || "" });
      } else if (result.type === 'cancel') {
        console.log('⚠️ User cancelled sign in');
        Alert.alert('Cancelled', 'Sign in was cancelled');
      } else {
        console.log('❌ Sign in failed:', result);
        Alert.alert('Error', `Sign in failed: ${result.type}`);
      }
    } catch (error) {
      console.error('💥 Sign in error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Sign In Error', `Failed to sign in with Google:\n\n${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="dark" />
      
      <AuthDebug />
      
      <View style={styles.content}>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>
        
        <TouchableOpacity 
          style={[styles.googleButton, loading && styles.buttonDisabled]} 
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          <Text style={styles.googleButtonText}>
            {loading ? 'Signing in...' : 'Sign in with Google'}
          </Text>
        </TouchableOpacity>

        {/* Debug Buttons */}
        <View style={styles.debugSection}>
          <Text style={styles.debugTitle}>🔧 Debug Tools</Text>
          
          <TouchableOpacity 
            style={styles.debugButton} 
            onPress={() => AuthDebugger.fullDiagnostic()}
          >
            <Text style={styles.debugButtonText}>Run Full Diagnostic</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.debugButton} 
            onPress={() => AuthDebugger.testOAuthURL()}
          >
            <Text style={styles.debugButtonText}>Test OAuth URL</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.debugButton} 
            onPress={() => testDirectAuth()}
          >
            <Text style={styles.debugButtonText}>Test Direct Auth</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.debugButton} 
            onPress={() => testManualSession()}
          >
            <Text style={styles.debugButtonText}>Test Manual Session</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.debugButton, { backgroundColor: '#28a745' }]} 
            onPress={async () => {
              setLoading(true);
              try {
                await signInWithGoogleFallback();
              } catch (err) {
                console.error('Fallback failed:', err);
              }
              setLoading(false);
            }}
            disabled={loading}
          >
            <Text style={styles.debugButtonText}>Try Fallback Method</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.debugButton, { backgroundColor: '#17a2b8' }]} 
            onPress={async () => {
              setLoading(true);
              try {
                await signInWithSupabaseDirect();
              } catch (err) {
                console.error('Direct method failed:', err);
              }
              setLoading(false);
            }}
            disabled={loading}
          >
            <Text style={styles.debugButtonText}>Try Direct Method</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.debugButton, styles.clearButton]} 
            onPress={() => AuthDebugger.clearAllAuth()}
          >
            <Text style={styles.debugButtonText}>Clear All Auth</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
  },
  googleButton: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  debugSection: {
    marginTop: 40,
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
  },
  debugTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  debugButton: {
    backgroundColor: '#6c757d',
    padding: 12,
    borderRadius: 6,
    marginBottom: 10,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#dc3545',
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});