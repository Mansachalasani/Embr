import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { router } from 'expo-router';

export default function Settings() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    
              setLoading(true);
              await signOut();
              // AuthContext will handle the redirect automatically
       
  };

  const settingsItems = [
    {
      title: 'Account',
      items: [
        {
          title: 'Edit Profile',
          icon: 'person-outline',
          onPress: () => Alert.alert('Coming Soon', 'Profile editing feature coming soon!'),
        },
        {
          title: 'Privacy Settings',
          icon: 'shield-outline',
          onPress: () => Alert.alert('Coming Soon', 'Privacy settings coming soon!'),
        },
      ],
    },
    {
      title: 'App',
      items: [
        {
          title: 'Notifications',
          icon: 'notifications-outline',
          onPress: () => Alert.alert('Coming Soon', 'Notification settings coming soon!'),
        },
        {
          title: 'Dark Mode',
          icon: 'moon-outline',
          onPress: () => Alert.alert('Coming Soon', 'Dark mode toggle coming soon!'),
        },
        {
          title: 'Language',
          icon: 'language-outline',
          onPress: () => Alert.alert('Coming Soon', 'Language settings coming soon!'),
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          title: 'Help Center',
          icon: 'help-circle-outline',
          onPress: () => Alert.alert('Coming Soon', 'Help center coming soon!'),
        },
        {
          title: 'Contact Us',
          icon: 'mail-outline',
          onPress: () => Alert.alert('Coming Soon', 'Contact form coming soon!'),
        },
        {
          title: 'About',
          icon: 'information-circle-outline',
          onPress: () => Alert.alert('About', 'Expo + Supabase Auth App\nVersion 1.0.0'),
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {settingsItems.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((item, itemIndex) => (
              <TouchableOpacity
                key={itemIndex}
                style={styles.settingItem}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.settingItemContent}>
                  <Ionicons name={item.icon as any} size={22} color="#4285F4" />
                  <Text style={styles.settingItemText}>{item.title}</Text>
                </View>
                <Ionicons name="chevron-forward-outline" size={20} color="#8e8e93" />
              </TouchableOpacity>
            ))}
          </View>
        ))}

        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.settingItem, styles.signOutButton]}
            onPress={handleSignOut}
            disabled={loading}
            activeOpacity={0.7}
          >
            <View style={styles.settingItemContent}>
              <Ionicons name="log-out-outline" size={22} color="#dc3545" />
              <Text style={[styles.settingItemText, styles.signOutText]}>
                {loading ? 'Signing out...' : 'Sign Out'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.userInfoText}>
            Signed in as {user?.email}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  settingItem: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settingItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingItemText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    fontWeight: '500',
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: '#dc3545',
    backgroundColor: '#fff',
  },
  signOutText: {
    color: '#dc3545',
  },
  userInfo: {
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
  },
  userInfoText: {
    fontSize: 14,
    color: '#8e8e93',
  },
});