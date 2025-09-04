import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Platform } from 'react-native';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        if (Platform.OS === 'web') {
          // For web, the session should be automatically handled by Supabase
          // Just check if we have a session and redirect accordingly
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Auth callback error:', error);
            router.replace('/(auth)');
            return;
          }

          if (session) {
            console.log('Auth callback success, redirecting to tabs');
            router.replace('/(tabs)');
          } else {
            console.log('No session found, redirecting to auth');
            router.replace('/(auth)');
          }
        } else {
          // For native, this shouldn't be reached as we handle auth differently
          router.replace('/(auth)');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        router.replace('/(auth)');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4285F4" />
      <Text style={styles.text}>Completing authentication...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});