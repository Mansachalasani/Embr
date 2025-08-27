import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { router } from 'expo-router';

export default function Settings() {
  const { user, signOut } = useAuth();
  const { colors, toggleTheme, isDark } = useTheme();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    await signOut();
    // AuthContext will handle the redirect automatically
  };

  const settingsItems = [
    {
      title: '🔥 Embr Settings',
      items: [
        {
          title: 'Dark Mode',
          icon: isDark ? 'moon' : 'sunny',
          onPress: toggleTheme,
          hasToggle: true,
          toggleValue: isDark,
          gradient: true,
        },
        {
          title: 'Notifications',
          icon: 'notifications',
          onPress: () => Alert.alert('Coming Soon', 'Notification settings coming soon!'),
        },
      ],
    },
    {
      title: '👤 Account',
      items: [
        {
          title: 'Edit Profile',
          icon: 'person',
          onPress: () => Alert.alert('Coming Soon', 'Profile editing feature coming soon!'),
        },
        {
          title: 'Privacy Settings',
          icon: 'shield-checkmark',
          onPress: () => Alert.alert('Coming Soon', 'Privacy settings coming soon!'),
        },
      ],
    },
    {
      title: '🛠 Support',
      items: [
        {
          title: 'Help Center',
          icon: 'help-circle',
          onPress: () => Alert.alert('Coming Soon', 'Help center coming soon!'),
        },
        {
          title: 'Contact Us',
          icon: 'mail',
          onPress: () => Alert.alert('Coming Soon', 'Contact form coming soon!'),
        },
        {
          title: 'About Embr',
          icon: 'flame',
          onPress: () => Alert.alert('About Embr', '🔥 Your AI Assistant with Fire\nVersion 1.0.0'),
        },
      ],
    },
  ];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 20,
    },
    header: {
      alignItems: 'center',
      marginBottom: 32,
      paddingVertical: 20,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    headerSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    settingItem: {
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderRadius: 16,
      marginBottom: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
      borderWidth: 1,
      borderColor: colors.border,
    },
    settingItemGradient: {
      borderRadius: 16,
      marginBottom: 8,
    },
    settingItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    settingItemText: {
      fontSize: 16,
      color: colors.text,
      marginLeft: 12,
      fontWeight: '500',
      flex: 1,
    },
    signOutButton: {
      borderColor: colors.error,
      backgroundColor: colors.surface,
    },
    signOutText: {
      color: colors.error,
    },
    userInfo: {
      alignItems: 'center',
      marginTop: 20,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    userInfoText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    toggle: {
      transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
    },
  });

  const renderSettingItem = (item: any, itemIndex: number) => {
    if (item.hasToggle) {
      return (
        <LinearGradient
          key={itemIndex}
          colors={item.gradient ? colors.gradientPrimary : [colors.surface, colors.surface]}
          style={styles.settingItemGradient}
        >
          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: 'transparent', borderWidth: 0 }]}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <View style={styles.settingItemContent}>
              <Ionicons name={item.icon as any} size={22} color={item.gradient ? '#fff' : colors.primary} />
              <Text style={[styles.settingItemText, { color: item.gradient ? '#fff' : colors.text }]}>
                {item.title}
              </Text>
            </View>
            <Switch
              value={item.toggleValue}
              onValueChange={item.onPress}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={item.toggleValue ? colors.accent : colors.textSecondary}
              style={styles.toggle}
            />
          </TouchableOpacity>
        </LinearGradient>
      );
    }

    return (
      <TouchableOpacity
        key={itemIndex}
        style={styles.settingItem}
        onPress={item.onPress}
        activeOpacity={0.7}
      >
        <View style={styles.settingItemContent}>
          <Ionicons name={item.icon as any} size={22} color={colors.primary} />
          <Text style={styles.settingItemText}>{item.title}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient colors={colors.gradientBackground} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>🔥 Embr Settings</Text>
            <Text style={styles.headerSubtitle}>Customize your AI assistant experience</Text>
          </View>

          {/* Settings Sections */}
          {settingsItems.map((section, sectionIndex) => (
            <View key={sectionIndex} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.items.map((item, itemIndex) => renderSettingItem(item, itemIndex))}
            </View>
          ))}

          {/* Sign Out */}
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.settingItem, styles.signOutButton]}
              onPress={handleSignOut}
              disabled={loading}
              activeOpacity={0.7}
            >
              <View style={styles.settingItemContent}>
                <Ionicons name="log-out" size={22} color={colors.error} />
                <Text style={[styles.settingItemText, styles.signOutText]}>
                  {loading ? 'Signing out...' : 'Sign Out'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* User Info */}
          <View style={styles.userInfo}>
            <Text style={styles.userInfoText}>
              Signed in as {user?.email}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}