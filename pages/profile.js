import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import auth from '@react-native-firebase/auth'; // Native Firebase Auth

export default function Profile({ user, setLoggedInUser }) {
  const handleLogout = async () => {
    try {
      await auth().signOut();
      setLoggedInUser(null);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      
      <View style={styles.card}>
        <Text style={styles.label}>Username:</Text>
        <Text style={styles.value}>{user?.displayName || 'Anime Fan'}</Text>
        
        <Text style={[styles.label, { marginTop: 15 }]}>Email:</Text>
        <Text style={styles.value}>{user?.email}</Text>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutBtnText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', padding: 20 },
  title: { color: '#ffffff', fontSize: 28, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
  card: { backgroundColor: '#1a1a1a', padding: 20, borderRadius: 10, marginBottom: 30, borderWidth: 1, borderColor: '#333333' },
  label: { color: '#888888', fontSize: 14, marginBottom: 5 },
  value: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  logoutBtn: { backgroundColor: '#E50914', height: 55, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  logoutBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' }
});
