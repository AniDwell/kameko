import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, Image } from 'react-native';

// Import the new Carousel component
import Carousel from './home/carousel';
import ProfileSettings from './profile'; 

const AVATARS = {
  'pfp1.jpg': require('../assets/pfp1.jpg'),
  'pfp2.jpg': require('../assets/pfp2.jpg'),
  'pfp3.jpg': require('../assets/pfp3.jpg'),
  'pfp4.jpg': require('../assets/pfp4.jpg'),
  'pfp5.jpg': require('../assets/pfp5.jpg'),
  'pfp6.jpg': require('../assets/pfp6.jpg'),
};

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
      renderItem={() => (
        <View style={styles.card}>
          <Text style={styles.cardText}>Cover</Text>
        </View>
      )}
    />
  </View>
);

export default function Home({ user, activeProfile, onSwitchProfile }) {
  const [activeTab, setActiveTab] = useState('Home');

  const renderBottomNav = () => (
    <View style={styles.bottomNav}>
      {['Home', 'Search', 'My List', 'Settings'].map((tab, idx) => (
        <TouchableOpacity key={idx} style={styles.navItem} onPress={() => setActiveTab(tab)}>
          <Text style={[styles.navText, activeTab === tab && styles.navTextActive]}>{tab}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (activeTab === 'Settings') {
    return (
      <View style={styles.container}>
        <ProfileSettings user={user} setLoggedInUser={() => {}} /> 
        {renderBottomNav()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER WITH PROFILE AVATAR */}
      <View style={styles.header}>
        <Text style={styles.headerLogo}>KAMEKO</Text>
        <TouchableOpacity onPress={onSwitchProfile} style={styles.profileSwitcher}>
          <Image 
            source={AVATARS[activeProfile?.avatar || 'pfp1.jpg']} 
            style={styles.headerAvatar} 
          />
        </TouchableOpacity>
      </View>

      {/* OVER-SCROLL DISABLED FOR ZERO WHITE FLASH */}
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        style={styles.scroll}
        overScrollMode="never" 
        bounces={false}
      >
        
        {/* NEW DYNAMIC CAROUSEL PLACED HERE */}
        <Carousel user={user} />

        {/* SCROLLING SHELVES */}
        <View style={styles.contentPadding}>
          <HorizontalRow title={`Continue Watching for ${activeProfile?.name || 'You'}`} />
          <HorizontalRow title="Trending Now" />
          <HorizontalRow title="Top 10 in Anime" />
        </View>
        
        <View style={{ height: 30 }} />
      </ScrollView>

      {renderBottomNav()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 15,
    backgroundColor: '#000000', // Ensures top area stays black
    zIndex: 100 // Keeps header above scrolling carousel
  },
  headerLogo: { color: '#E50914', fontSize: 24, fontWeight: '900', letterSpacing: 2 },
  profileSwitcher: { borderWidth: 1, borderColor: '#333', borderRadius: 4 },
  headerAvatar: { width: 32, height: 32, borderRadius: 4 },
  scroll: { flex: 1 },
  contentPadding: { paddingTop: 20 },
  rowContainer: { marginBottom: 25 },
  rowTitle: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginLeft: 15, marginBottom: 10 },
  card: { width: 120, height: 170, backgroundColor: '#222222', marginLeft: 15, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  cardText: { color: '#555555' },
  bottomNav: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    alignItems: 'center', 
    height: 65, 
    backgroundColor: '#0a0a0a', 
    borderTopWidth: 1, 
    borderTopColor: '#222222', 
    paddingBottom: 10 
  },
  navItem: { alignItems: 'center', padding: 10 },
  navText: { color: '#888888', fontSize: 12, marginTop: 4 },
  navTextActive: { color: '#E50914', fontWeight: 'bold' }
});
