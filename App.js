import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, ActivityIndicator, View, Animated, Easing } from 'react-native';
import auth from '@react-native-firebase/auth';
import * as SplashScreen from 'expo-splash-screen'; // Holds the splash screen

import Login from './pages/login';
import Profiles from './pages/profile'; 
import Home from './pages/home';

// Prevent splash screen from hiding automatically
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [activeProfile, setActiveProfile] = useState(null);
  
  // Animation States
  const [isAnimating, setIsAnimating] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setActiveProfile(null);
      
      if (initializing) {
        setInitializing(false);
        // Hide splash screen smoothly ONLY when Firebase is ready
        await SplashScreen.hideAsync();
      }
    });
    return subscriber;
  }, [initializing]);

  // Enterprise Zoom-In & Fade-Out Animation
  const handleProfileSelect = (profile) => {
    setIsAnimating(true);
    setActiveProfile(profile); // This renders Home in the background instantly

    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 5, // Zoom way into the camera
        duration: 700,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0, // Fade to black/transparent
        duration: 700,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      })
    ]).start(() => {
      // Cleanup after animation finishes
      setIsAnimating(false);
      scaleAnim.setValue(1);
      opacityAnim.setValue(1);
    });
  };

  if (initializing) {
    // True black background during Firebase init
    return (
      <View style={styles.trueBlackRoot}>
        <ActivityIndicator size="large" color="#E50914" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.trueBlackRoot}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {!user ? (
        <Login setLoggedInUser={setUser} />
      ) : (
        <View style={styles.trueBlackRoot}>
          {/* Always render Home if a profile is selected, but keep it under the animation */}
          {activeProfile && (
            <Home 
              user={user} 
              activeProfile={activeProfile} 
              onSwitchProfile={() => setActiveProfile(null)} 
            />
          )}

          {/* Render Profiles Screen OR the animating overlay */}
          {(!activeProfile || isAnimating) && (
            <Animated.View 
              style={[
                styles.overlay, 
                isAnimating && { 
                  opacity: opacityAnim, 
                  transform: [{ scale: scaleAnim }] 
                }
              ]}
            >
              <Profiles user={user} onSelectProfile={handleProfileSelect} />
            </Animated.View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  trueBlackRoot: { 
    flex: 1, 
    backgroundColor: '#000000', // STRICT ZERO WHITE SCREEN
    width: '100%',
    height: '100%'
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 10, // Keeps it on top of Home during animation
  }
});
