{
  "expo": {
    "name": "kameko",
    "slug": "kameko",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/logo.png",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/header.png",
      "resizeMode": "contain",
      "backgroundColor": "#000000"
    },
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/logo.png",
        "backgroundColor": "#000000"
      },
      "package": "com.yourname.kameko"
    }
  }
}
```eof

```json:package.json
{
  "name": "kameko",
  "version": "1.0.0",
  "main": "node_modules/expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  },
  "dependencies": {
    "expo": "~50.0.14",
    "expo-status-bar": "~1.11.1",
    "react": "18.2.0",
    "react-native": "0.73.6"
  },
  "devDependencies": {
    "@babel/core": "^7.20.0"
  },
  "private": true
}
```eof

```jsx:App.js
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, StatusBar, View, Image, Text, FlatList, TouchableOpacity, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

// --------------------------------------------------
// COMPONENT: Header
// --------------------------------------------------
const Header = () => {
  return (
    <View style={styles.headerContainer}>
      {/* 
        This loads the same header.png used in the splash screen.
        Make sure header.png is placed inside an "assets" folder in your repository.
      */}
      <Image 
        source={require('./assets/header.png')} 
        style={styles.headerImage}
        resizeMode="contain"
      />
    </View>
  );
};

// --------------------------------------------------
// COMPONENT: Carousel Bottom Nav
// --------------------------------------------------
const navItems = [
  { id: '1', title: 'Home' },
  { id: '2', title: 'Search' },
  { id: '3', title: 'Post' },
  { id: '4', title: 'Messages' },
  { id: '5', title: 'Profile' },
];

const CarouselBottomNav = ({ activeId, setActiveId }) => {
  const renderItem = ({ item }) => {
    const isActive = item.id === activeId;
    return (
      <TouchableOpacity 
        style={[styles.navItem, isActive && styles.navItemActive]}
        onPress={() => setActiveId(item.id)}
      >
        <Text style={[styles.navText, isActive && styles.navTextActive]}>
          {item.title}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.navContainer}>
      <FlatList
        data={navItems}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        snapToAlignment="center"
        snapToInterval={width / 3}
        decelerationRate="fast"
      />
    </View>
  );
};

// --------------------------------------------------
// COMPONENT: Home Screen Content
// --------------------------------------------------
const HomeScreen = ({ activeId }) => {
  const currentTab = navItems.find(item => item.id === activeId)?.title || 'Home';
  
  return (
    <View style={styles.content}>
      <Text style={styles.title}>Welcome to <Text style={styles.highlight}>kameko</Text></Text>
      <Text style={styles.subtitle}>Currently viewing: {currentTab}</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardText}>Pure Black, Red & White Theme</Text>
      </View>
    </View>
  );
};

// --------------------------------------------------
// MAIN APP SKELETON
// --------------------------------------------------
export default function App() {
  const [activeTab, setActiveTab] = useState('1');

  return (
    <SafeAreaView style={styles.container}>
      {/* StatusBar set to light-content for white battery/time icons on black bg */}
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      <Header />
      
      <HomeScreen activeId={activeTab} />
      
      <CarouselBottomNav activeId={activeTab} setActiveId={setActiveTab} />
      
    </SafeAreaView>
  );
}

// --------------------------------------------------
// GLOBAL STYLES
// --------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Pure Black Background
  },
  
  // Header Styles
  headerContainer: {
    height: 60,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#ff0000', // Red Accent Line
  },
  headerImage: {
    width: '60%', 
    height: 40,
  },
  
  // Home Screen Styles
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#ffffff', // White Text
  },
  highlight: {
    color: '#ff0000', // Red Text
  },
  subtitle: {
    fontSize: 16,
    color: '#aaaaaa', // Light grey for contrast
    marginBottom: 30,
  },
  card: {
    padding: 20,
    borderColor: '#ff0000', // Red border
    borderWidth: 2,
    borderRadius: 10,
    backgroundColor: '#0a0a0a',
  },
  cardText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Bottom Nav Styles
  navContainer: {
    height: 70,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: '#333333',
    justifyContent: 'center',
    paddingBottom: 15,
  },
  navItem: {
    width: width / 3,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
  },
  navItemActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#ff0000', // Red underline for active tab
  },
  navText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    opacity: 0.5, // Dim inactive items
  },
  navTextActive: {
    opacity: 1,
    color: '#ff0000', // Red text for active tab
  },
});
```eof

```yaml:.github/workflows/build.yml
name: Build Android APK

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  build:
    name: Build Release APK
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Generate Android folder (Expo Prebuild)
        run: npx expo prebuild --platform android --clean

      - name: Set up Java
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Grant execute permission for Gradle
        working-directory: android
        run: chmod +x gradlew

      - name: Build Android Release APK
        working-directory: android
        # assembleRelease fixes the red Metro Bundler error
        run: ./gradlew assembleRelease 

      - name: Upload APK as Artifact
        uses: actions/upload-artifact@v4
        with:
          name: kameko-app-release
          path: android/app/build/outputs/apk/release/app-release.apk
```eof

### Important Setup Notes for GitHub:
1. Since we consolidated your JS files, you can delete the `src/` folder from your GitHub repository if you created it earlier. 
2. Make sure you upload `logo.png` and `header.png` into an `assets` folder in the root directory. Expo will automatically use `header.png` on a pure black background (`#000000`) for the native splash screen while the app is loading.
3. Once the GitHub Action is finished, remember to uninstall the old broken app from your phone before installing this new `app-release.apk`.
