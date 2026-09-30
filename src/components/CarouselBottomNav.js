import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const navItems = [
  { id: '1', title: 'Home' },
  { id: '2', title: 'Search' },
  { id: '3', title: 'Post' },
  { id: '4', title: 'Messages' },
  { id: '5', title: 'Profile' },
];

export default function CarouselBottomNav() {
  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.navItem}>
      <Text style={styles.navText}>{item.title}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={navItems}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        snapToAlignment="center"
        snapToInterval={width / 3} // Shows 3 items at a time
        decelerationRate="fast"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 70,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    paddingBottom: 15, // Safe area padding
  },
  navItem: {
    width: width / 3,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
  },
  navText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
