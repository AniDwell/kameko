import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import auth from '@react-native-firebase/auth'; // Using the native Firebase library

export default function Login({ setLoggedInUser }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        // LOGIN
        const userCredential = await auth().signInWithEmailAndPassword(email, password);
        setLoggedInUser(userCredential.user);
      } else {
        // SIGNUP
        if (!username) {
          Alert.alert('Error', 'Please enter a username');
          setLoading(false);
          return;
        }
        const userCredential = await auth().createUserWithEmailAndPassword(email, password);
        // Save Username to Firebase Profile
        await userCredential.user.updateProfile({ displayName: username });
        setLoggedInUser(auth().currentUser); // Set updated user
      }
    } catch (error) {
      // Clean up Firebase error messages
      let errorMsg = error.message;
      if (error.code === 'auth/email-already-in-use') errorMsg = 'That email address is already in use!';
      if (error.code === 'auth/invalid-email') errorMsg = 'That email address is invalid!';
      Alert.alert('Authentication Failed', errorMsg);
    }
    setLoading(false);
  };

  const handleGoogleLogin = () => {
    Alert.alert('Notice', 'Google Login requires Google Play Services configuration. Please use Email/Password for now.');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>KAMEKO</Text>
      <Text style={styles.welcomeText}>Welcome to KAMEKO</Text>
      <Text style={styles.title}>{isLogin ? 'Sign In' : 'Create Account'}</Text>

      {!isLogin && (
        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#888888"
          value={username}
          onChangeText={setUsername}
        />
      )}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888888"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#888888"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.mainBtn} onPress={handleAuth} disabled={loading}>
        {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.mainBtnText}>{isLogin ? 'Login' : 'Sign Up'}</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleLogin}>
        <Text style={styles.googleBtnText}>Continue with Google</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
        <Text style={styles.switchText}>
          {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', padding: 20 },
  logo: { color: '#E50914', fontSize: 36, fontWeight: '900', textAlign: 'center', marginBottom: 10, letterSpacing: 3 },
  welcomeText: { color: '#ffffff', fontSize: 18, textAlign: 'center', marginBottom: 30, opacity: 0.8 },
  title: { color: '#ffffff', fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { backgroundColor: '#1a1a1a', color: '#ffffff', height: 55, borderRadius: 8, paddingHorizontal: 15, marginBottom: 15, borderWidth: 1, borderColor: '#333333' },
  mainBtn: { backgroundColor: '#E50914', height: 55, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  mainBtnText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  googleBtn: { backgroundColor: '#ffffff', height: 55, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  googleBtnText: { color: '#000000', fontSize: 16, fontWeight: 'bold' },
  switchText: { color: '#aaaaaa', textAlign: 'center', fontSize: 15 }
});
