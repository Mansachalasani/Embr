import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Platform } from 'react-native';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Processing authentication...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('🔄 Auth callback started');
        setStatus('Checking authentication...');

        if (Platform.OS === 'web') {
          // Give Supabase a moment to process the URL parameters
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check for URL parameters first
          const urlParams = new URLSearchParams(window.location.search);
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          
          const error = urlParams.get('error') || hashParams.get('error');
          if (error) {
            console.error('❌ OAuth error in callback:', error);
            setStatus('Authentication failed');
            router.replace('/(auth)/signin?error=' + encodeURIComponent(error));
            return;
          }

          console.log('🔍 Checking for session...');
          setStatus('Retrieving session...');
          
          // Try multiple times to get the session
          let session = null;
          let attempts = 0;
          const maxAttempts = 5;

          while (!session && attempts < maxAttempts) {
            attempts++;
            console.log(`🔄 Session check attempt ${attempts}/${maxAttempts}`);
            
            const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
            
            if (sessionError) {
              console.error(`❌ Session error on attempt ${attempts}:`, sessionError);
              if (attempts === maxAttempts) {
                setStatus('Session error');
                router.replace('/(auth)/signin?error=session_failed');
                return;
              }
            } else if (currentSession) {
              session = currentSession;
              console.log('✅ Session found:', session.user.email);
              break;
            }
            
            if (!session && attempts < maxAttempts) {
              console.log('⏳ No session yet, waiting 1 second...');
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

          if (session) {
            console.log('✅ Auth callback success, user:', session.user.email);
            setStatus('Authentication successful! Redirecting...');
            
            // Clear URL parameters
            if (window.history && window.history.replaceState) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
            
            // Wait a moment before redirect to let AuthContext update
            await new Promise(resolve => setTimeout(resolve, 500));
            router.replace('/(tabs)');
          } else {
            console.log('❌ No session found after all attempts');
            setStatus('No session found');
            router.replace('/(auth)/signin?error=no_session');
          }
        } else {
          // For native platforms
          console.log('📱 Native callback handling');
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('❌ Native auth callback error:', error);
            router.replace('/(auth)/signin');
            return;
          }

          if (session) {
            console.log('✅ Native auth success:', session.user.email);
            router.replace('/(tabs)');
          } else {
            console.log('❌ No session in native callback');
            router.replace('/(auth)/signin');
          }
        }
      } catch (error) {
        console.error('💥 Auth callback error:', error);
        setStatus('Authentication error');
        router.replace('/(auth)/signin?error=callback_failed');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4285F4" />
      <Text style={styles.text}>{status}</Text>
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