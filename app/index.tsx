import React, { useState, useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { CarouselOnboarding } from '../components/CarouselOnboarding';
import { UserPreferencesService } from '../services/userPreferencesService';
import { UserPersonalizationData } from '../types/userPreferences';

export default function Index() {
  const { user, loading } = useAuth();
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [checkingPreferences, setCheckingPreferences] = useState(true);

  useEffect(() => {
    if (user && !loading) {
      checkOnboardingStatus();
    }
  }, [user, loading]);

  const checkOnboardingStatus = async () => {
    try {
      const result = await UserPreferencesService.getUserPreferences();
      setOnboardingCompleted(result.onboarding_completed);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      // Default to showing onboarding if there's an error
      setOnboardingCompleted(false);
    } finally {
      setCheckingPreferences(false);
    }
  };

  const handleOnboardingComplete = (preferences: UserPersonalizationData) => {
    setOnboardingCompleted(true);
  };

  const handleOnboardingSkip = () => {
    setOnboardingCompleted(true);
  };

  if (loading || (user && checkingPreferences)) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  // Show onboarding if user is logged in but hasn't completed preferences
  if (user && onboardingCompleted === false) {
    console.log(onboardingCompleted,'from index')
    return (
      <CarouselOnboarding 
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
      />
    );
  }

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});