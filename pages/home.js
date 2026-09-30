import React from 'react';
import { View, StyleSheet } from 'react-native';

import Header from './header';
import Carousel from './corousel';

export default function Home() {
  return (
    <View style={styles.container}>
      <Header />
      <Carousel />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Pure black space
  },
});
