import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, Image } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Path, Circle } from 'react-native-svg';

import Carousel from './home/carousel';
import RecentSlider from './home/recent_slider';
import TrendingSlider from './home/trending_slider';
import Play from '../pages/play';
import ProfileSettings from './profile'; 

// Import the new Search Component
import Search from '../components/search'; 

const AVATARS = {
  'pfp1.jpg': require('../assets/pfp1.jpg'),
  'pfp2.jpg': require('../assets/pfp2.jpg'),
  'pfp3.jpg': require('../assets/pfp3.jpg'),
  'pfp4.jpg': require('../assets/pfp4.jpg'),
  'pfp5.jpg': require('../assets/pfp5.jpg'),
  'pfp6.jpg': require('../assets/pfp6.jpg'),
};

// Premium SVG Search Icon
const IconSearch = ({ size = 26, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="11" cy="11" r="8" />
    <Path d="M21 21l-4.35-4.35" />
  </Svg>
);

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

// Added navigation to the props
export default function Home({ user, activeProfile, onSwitchProfile, navigation }) {
  const [activeTab, setActiveTab] = useState('Home');
  const [selectedAnime, setSelectedAnime] = useState(null);

  const renderBottomNav = () => (
    <View style={styles.bottomNav}>
      {['Home', 'Search', 'My List', 'Settings'].map((tab, idx) => (
        <TouchableOpacity key={idx} style={styles.navItem} onPress={() => setActiveTab(tab)}>
          <Text style={[styles.navText, activeTab === tab && styles.navTextActive]}>{tab}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Determine if we should hide the home screen to keep it in memory
  const isOverlayActive = selectedAnime !== null || activeTab === 'Search' || activeTab === 'Settings';

  return (
    <View style={styles.masterContainer}>
      
      {/* 
        HOME SCREEN LAYER
        Using display: 'none' guarantees that Carousel/Sliders NEVER unmount.
        When you go back, no scripts reload. It is instantly exactly as you left it.
      */}
      <View style={[styles.container, isOverlayActive && { display: 'none' }]}>
        
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

        {/* FLOATING HEADER: Pushed to the top, larger logo, with gradient background */}
        <View style={styles.floatingHeader} pointerEvents="box-none">
          
          {/* Gradient Backdrop to make icons/logo pop against light anime images */}
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <Defs>
              <LinearGradient id="headerGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000000" stopOpacity="0.85" />
                <Stop offset="0.6" stopColor="#000000" stopOpacity="0.4" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#headerGrad)" />
          </Svg>

          <View style={styles.headerContent}>
            {/* BIGGER HEADER LOGO */}
            <Image 
              source={require('../assets/kameko_header.png')} 
              style={styles.headerLogoImage}
              resizeMode="contain"
            />
            
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={() => setActiveTab('Search')} activeOpacity={0.7} style={styles.searchBtn}>
                <IconSearch />
              </TouchableOpacity>

              <TouchableOpacity onPress={onSwitchProfile} style={styles.profileSwitcher} activeOpacity={0.8}>
                <Image 
                  source={AVATARS[activeProfile?.avatar || 'pfp1.jpg']} 
                  style={styles.headerAvatar} 
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {renderBottomNav()}
      </View>

      {/* --- OVERLAY SCREENS --- */}
      {/* These render perfectly over the hidden Home screen without destroying its cache */}
      
      {selectedAnime && (
        <Play 
          anime={selectedAnime} 
          user={user} 
          onBack={() => setSelectedAnime(null)} 
          navigation={navigation} /* <--- Added navigation prop here */
        />
      )}

      {activeTab === 'Search' && (
        <View style={styles.overlayScreen}>
          <Search 
            user={user} 
            onBack={() => setActiveTab('Home')} 
            onSelectAnime={(anime) => setSelectedAnime(anime)} 
          />
          {renderBottomNav()}
        </View>
      )}

      {activeTab === 'Settings' && (
        <View style={styles.overlayScreen}>
          <ProfileSettings user={user} setLoggedInUser={() => {}} onHardwareBack={() => setActiveTab('Home')} /> 
          {renderBottomNav()}
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  masterContainer: { flex: 1, backgroundColor: '#000000' },
  container: { flex: 1, backgroundColor: '#000000' },
  overlayScreen: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000000', zIndex: 50 },
  
  floatingHeader: { 
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 100, // Enough height for the gradient to fade smoothly
    zIndex: 100,
  },
  headerContent: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingTop: 15, // MOVED SIGNIFICANTLY HIGHER
  },
  headerLogoImage: { 
    width: 175, // INCREASED SIZE
    height: 48, // INCREASED SIZE
    tintColor: '#E50914'
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16
  },
  searchBtn: {
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  profileSwitcher: { 
    borderWidth: 1.5, 
    borderColor: 'rgba(255,255,255,0.3)', 
    borderRadius: 6, 
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.5)',
    elevation: 5
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
