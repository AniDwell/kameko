import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, Image } from 'react-native';

import Carousel from './home/carousel';
import RecentSlider from './home/recent_slider';
import TrendingSlider from './home/trending_slider';
import Play from '../pages/play';
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
  { id: '1', title: 'Continue 1' },
  { id: '2', title: 'Continue 2' },
  { id: '3', title: 'Continue 3' },
  { id: '4', title: 'Continue 4' },
];

const HorizontalRow = ({ title }) => (
  <View style={styles.rowContainer}>
    <Text style={styles.rowTitle}>{title}</Text>
    <FlatList
      data={mockData}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingHorizontal: 20 }}
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
  const [selectedAnime, setSelectedAnime] = useState(null);

  if (selectedAnime) {
    return (
      <Play 
        anime={selectedAnime} 
        user={user} 
        onBack={() => setSelectedAnime(null)} 
      />
    );
  }

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
      
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        style={styles.scroll}
        overScrollMode="never" 
        bounces={false}
      >
        <Carousel user={user} onSelectAnime={(anime) => setSelectedAnime(anime)} />
        <RecentSlider user={user} onSelectAnime={(anime) => setSelectedAnime(anime)} />
        <TrendingSlider user={user} onSelectAnime={(anime) => setSelectedAnime(anime)} />

        <View style={styles.contentPadding}>
          <HorizontalRow title={`Continue Watching for ${activeProfile?.name || 'You'}`} />
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* FLOATING HEADER IN AIR (Transparent overlay, no background padding) */}
      <View style={styles.floatingHeader} pointerEvents="box-none">
        <Image 
          source={require('../assets/kameko_header.png')} 
          style={styles.headerLogoImage}
          resizeMode="contain"
        />
        
        <TouchableOpacity onPress={onSwitchProfile} style={styles.profileSwitcher} activeOpacity={0.8}>
          <Image 
            source={AVATARS[activeProfile?.avatar || 'pfp1.jpg']} 
            style={styles.headerAvatar} 
          />
        </TouchableOpacity>
      </View>

      {renderBottomNav()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  floatingHeader: { 
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: 46, // Safe top padding floating above carousel
    paddingBottom: 15,
    zIndex: 100,
    backgroundColor: 'transparent' // Completely transparent background
  },
  headerLogoImage: { 
    width: 155, // Slightly bigger as requested
    height: 42, // Slightly bigger as requested
    tintColor: '#E50914'
  },
  profileSwitcher: { 
    borderWidth: 1.5, 
    borderColor: 'rgba(255,255,255,0.25)', 
    borderRadius: 6, 
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.4)' 
  },
  headerAvatar: { width: 38, height: 38, borderRadius: 5 },
  scroll: { flex: 1 },
  contentPadding: { paddingTop: 10 },
  rowContainer: { marginBottom: 25 },
  rowTitle: { 
    color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginLeft: 20, marginBottom: 12,
    borderLeftWidth: 3, borderLeftColor: '#E50914', paddingLeft: 8
  },
  card: { 
    width: 140, height: 210, backgroundColor: '#1A1A1A', marginRight: 15, borderRadius: 8, 
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
  },
  cardText: { color: '#555555' },
  bottomNav: { 
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', height: 65, 
    backgroundColor: '#0a0a0a', borderTopWidth: 1, borderTopColor: '#222222', paddingBottom: 10 
  },
  navItem: { alignItems: 'center', padding: 10 },
  navText: { color: '#888888', fontSize: 12, marginTop: 4, fontWeight: '600' },
  navTextActive: { color: '#E50914', fontWeight: 'bold' }
});
