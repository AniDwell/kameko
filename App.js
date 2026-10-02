import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, ActivityIndicator, View, Animated, Easing } from 'react-native';
import auth from '@react-native-firebase/auth';

import Login from './pages/login';
import Profiles from './pages/profile'; 
import Home from './pages/home';

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  
  const [activeProfile, setActiveProfile] = useState(null);
  const [previousProfile, setPreviousProfile] = useState(null); // REMEMBERS PROFILE FOR BACK BUTTON
  
  const [isAnimating, setIsAnimating] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      if (!currentUser) setActiveProfile(null);
      if (initializing) setInitializing(false);
    });
    return subscriber;
  }, [initializing]);

  const handleProfileSelect = (profile) => {
    setIsAnimating(true);
    setActiveProfile(profile);
    setPreviousProfile(null); // Clear history once they are logged in

    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 4, duration: 700, easing: Easing.out(Easing.exp), useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 700, easing: Easing.out(Easing.exp), useNativeDriver: true })
    ]).start(() => {
      setIsAnimating(false);
      scaleAnim.setValue(1);
      opacityAnim.setValue(1);
    });
  };

  // Triggered when user clicks the avatar in home.js
  const handleSwitchProfile = () => {
    setPreviousProfile(activeProfile); // Save current profile
    setActiveProfile(null); // Triggers the Profiles screen overlay
  };

  if (initializing) {
    return (
      <View style={styles.trueBlackRoot}>
        <ActivityIndicator size="large" color="#E50914" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.trueBlackRoot}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" translucent={false} />
      
      {!user ? (
        <Login setLoggedInUser={setUser} />
      ) : (
        <View style={styles.trueBlackRoot}>
          {activeProfile && (
            <Home 
              user={user} 
              activeProfile={activeProfile} 
              onSwitchProfile={handleSwitchProfile} 
            />
          )}

          {(!activeProfile || isAnimating) && (
            <Animated.View 
              style={[
                styles.overlay, 
                isAnimating && { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }
              ]}
            >
              <Profiles 
                user={user} 
                onSelectProfile={handleProfileSelect} 
                onHardwareBack={previousProfile ? () => setActiveProfile(previousProfile) : null} 
              />
            </Animated.View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  trueBlackRoot: { flex: 1, backgroundColor: '#000000', width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000000', zIndex: 10 }
});
