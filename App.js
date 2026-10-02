import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, ActivityIndicator, View, Animated, Easing } from 'react-native';
import auth from '@react-native-firebase/auth';

// Navigation Imports
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';

import Login from './pages/login';
import Profiles from './pages/profile'; 
import Home from './pages/home';
import Play from './pages/play'; // Added Play Screen

const Stack = createStackNavigator();

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [activeProfile, setActiveProfile] = useState(null);
  
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

    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 4, duration: 700, easing: Easing.out(Easing.exp), useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 700, easing: Easing.out(Easing.exp), useNativeDriver: true })
    ]).start(() => {
      setIsAnimating(false);
      scaleAnim.setValue(1);
      opacityAnim.setValue(1);
    });
  };

  if (initializing) {
    return (
      <View style={styles.trueBlackRoot}>
        <ActivityIndicator size="large" color="#E50914" />
      </View>
    );
  }

  // If not logged in, show Login
  if (!user) {
    return (
      <SafeAreaView style={styles.trueBlackRoot}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" translucent={false} />
        <Login setLoggedInUser={setUser} />
      </SafeAreaView>
    );
  }

  // If logged in, but no profile selected, show Profiles
  if (!activeProfile || isAnimating) {
    return (
      <SafeAreaView style={styles.trueBlackRoot}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" translucent={false} />
        <View style={styles.trueBlackRoot}>
          {/* Keep Home mounted in background so it doesn't flash when profile animation finishes */}
          {activeProfile && (
            <NavigationContainer>
               <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: '#000000' } }}>
                 <Stack.Screen name="Home">
                   {props => <Home {...props} user={user} activeProfile={activeProfile} onSwitchProfile={() => setActiveProfile(null)} />}
                 </Stack.Screen>
               </Stack.Navigator>
            </NavigationContainer>
          )}

          <Animated.View style={[styles.overlay, isAnimating && { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
            <Profiles user={user} onSelectProfile={handleProfileSelect} />
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  // Main App Navigation (When Profile is fully selected)
  return (
    <View style={styles.trueBlackRoot}>
      <NavigationContainer>
        <Stack.Navigator 
          screenOptions={{ 
            headerShown: false, 
            cardStyle: { backgroundColor: '#000000' },
            cardStyleInterpolator: CardStyleInterpolators.forFadeFromBottomAndroid // Premium transition
          }}
        >
          <Stack.Screen name="Home">
            {props => <Home {...props} user={user} activeProfile={activeProfile} onSwitchProfile={() => setActiveProfile(null)} />}
          </Stack.Screen>
          
          <Stack.Screen name="Play">
            {props => <Play {...props} user={user} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  trueBlackRoot: { flex: 1, backgroundColor: '#000000', width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000000', zIndex: 10 }
});
