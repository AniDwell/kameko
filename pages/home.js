import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import auth from '@react-native-firebase/auth';

// Import your other screens
import Login from './login';
import Profile from './profile';

const mockData = [
  { id: '1', title: 'Movie 1' },
  { id: '2', title: 'Movie 2' },
  { id: '3', title: 'Movie 3' },
  { id: '4', title: 'Movie 4' },
];

const HorizontalRow = ({ title }) => (
  <View style={styles.rowContainer}>
    <Text style={styles.rowTitle}>{title}</Text>
    <FlatList
      data={mockData}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.cardText}>Cover</Text>
        </View>
      )}
    />
  </View>
);

export default function Home() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('Home');

  // Firebase Authentication Check
  useEffect(() => {
    const subscriber = auth().onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      if (initializing) setInitializing(false);
      
      // If user logs out, reset tab to Home so they don't get stuck on Profile
      if (!currentUser) setActiveTab('Home'); 
    });
    return subscriber; // Unsubscribe on unmount
  }, [initializing]);

  // 1. Show loading spinner while checking Firebase session
  if (initializing) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#E50914" />
      </View>
    );
  }

  // 2. Gatekeeper: If no user, open Login.js
  if (!user) {
    return <Login setLoggedInUser={setUser} />;
  }

  // Bottom Navigation Component
  const renderBottomNav = () => (
    <View style={styles.bottomNav}>
      {['Home', 'Search', 'My List', 'Profile'].map((tab, idx) => (
        <TouchableOpacity key={idx} style={styles.navItem} onPress={() => setActiveTab(tab)}>
          <Text style={[styles.navText, activeTab === tab && styles.navTextActive]}>{tab}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // 3. If user tapped Profile in bottom nav, show Profile.js
  if (activeTab === 'Profile') {
    return (
      <View style={styles.container}>
        <Profile user={user} setLoggedInUser={setUser} />
        {renderBottomNav()}
      </View>
    );
  }

  // 4. Default: Show the KAMEKO Home OTT UI
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerLogo}>KAMEKO</Text>
        <TouchableOpacity><Text style={styles.headerBtn}>Search</Text></TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* HERO CAROUSEL */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Featured Premiere</Text>
          <View style={styles.heroBtnRow}>
            <TouchableOpacity style={styles.playBtn}>
              <Text style={styles.playBtnText}>▶ Play</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.infoBtn}>
              <Text style={styles.infoBtnText}>+ My List</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SCROLLING SHELVES */}
        <HorizontalRow title="Continue Watching" />
        <HorizontalRow title="Trending Now" />
        <HorizontalRow title="Top 10 in Anime" />
        <HorizontalRow title="Action & Adventure" />
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* BOTTOM NAV */}
      {renderBottomNav()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  loaderContainer: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
  headerLogo: { color: '#E50914', fontSize: 24, fontWeight: '900', letterSpacing: 2 },
  headerBtn: { color: '#ffffff', fontSize: 16 },
  scroll: { flex: 1 },
  hero: { height: 400, backgroundColor: '#1a1a1a', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 30, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#333333' },
  heroTitle: { color: '#ffffff', fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
  heroBtnRow: { flexDirection: 'row', gap: 15 },
  playBtn: { backgroundColor: '#ffffff', paddingVertical: 8, paddingHorizontal: 25, borderRadius: 4 },
  playBtnText: { color: '#000000', fontWeight: 'bold', fontSize: 16 },
  infoBtn: { backgroundColor: '#333333', paddingVertical: 8, paddingHorizontal: 25, borderRadius: 4 },
  infoBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  rowContainer: { marginBottom: 25 },
  rowTitle: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginLeft: 15, marginBottom: 10 },
  card: { width: 120, height: 170, backgroundColor: '#222222', marginLeft: 15, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  cardText: { color: '#555555' },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', height: 65, backgroundColor: '#0a0a0a', borderTopWidth: 1, borderTopColor: '#222222', paddingBottom: 10 },
  navItem: { alignItems: 'center', padding: 10 },
  navText: { color: '#888888', fontSize: 12, marginTop: 4 },
  navTextActive: { color: '#E50914', fontWeight: 'bold' }
});
