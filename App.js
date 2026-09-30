import React from 'react';
import { SafeAreaView, StyleSheet, StatusBar } from 'react-native';
import Header from './src/components/Header';
import HomeScreen from './src/screens/HomeScreen';
import CarouselBottomNav from './src/components/CarouselBottomNav';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* 1. Custom Image Header */}
      <Header />
      
      {/* 2. Main Body */}
      <HomeScreen />
      
      {/* 3. External JS Carousel Bottom Nav */}
      <CarouselBottomNav />
      
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});
