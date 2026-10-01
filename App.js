import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, ActivityIndicator, View } from 'react-native';
import auth from '@react-native-firebase/auth';

import Login from './pages/login';
import Profiles from './pages/profiles';
import Home from './pages/home';

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [activeProfile, setActiveProfile] = useState(null); // Tracks the chosen profile

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      if (!currentUser) setActiveProfile(null); // Clear profile if logged out
      if (initializing) setInitializing(false);
    });
    return subscriber;
  }, [initializing]);

  if (initializing) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#E50914" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {!user ? (
        <Login setLoggedInUser={setUser} />
      ) : !activeProfile ? (
        <Profiles user={user} onSelectProfile={setActiveProfile} />
      ) : (
        <Home 
          user={user} 
          activeProfile={activeProfile} 
          onSwitchProfile={() => setActiveProfile(null)} 
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  loaderContainer: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }
});
