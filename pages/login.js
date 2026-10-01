import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image,
  ScrollView, Animated, KeyboardAvoidingView, Platform, Easing
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import Svg, { Path, Circle } from 'react-native-svg';

const EyeIcon = ({ visible }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    {visible ? (
      <>
        <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#AAAAAA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="12" cy="12" r="3" stroke="#AAAAAA" strokeWidth="2" />
      </>
    ) : (
      <>
        <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="#888888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M1 1l22 22" stroke="#E50914" strokeWidth="2" strokeLinecap="round" />
      </>
    )}
  </Svg>
);

const GoogleIcon = () => (
  <Svg width="20" height="20" viewBox="0 0 48 48">
    <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </Svg>
);

export default function Login({ setLoggedInUser }) {
  const [mode, setMode] = useState('login'); 
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current; 

  useEffect(() => {
    try {
      GoogleSignin.configure({
        scopes: ['email', 'profile'],
        webClientId: '953026999234-vtpccvf4nboqi8mtdndqfmopbol5h4i4.apps.googleusercontent.com',
      });
    } catch (e) {
      console.log('GoogleSignin config error:', e);
    }
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, easing: Easing.out(Easing.exp), useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (loading) {
      progressAnim.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(progressAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
          Animated.timing(progressAnim, { toValue: 0, duration: 0, useNativeDriver: false }),
        ])
      ).start();
    } else {
      progressAnim.stopAnimation();
      progressAnim.setValue(0);
    }
  }, [loading]);

  const progressBarWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const changeMode = (newMode) => {
    setMode(newMode);
    fadeAnim.setValue(0.5);
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  const handleAuth = async () => {
    if (mode === 'forgot') {
      if (!email.trim()) return Alert.alert('Error', 'Please enter your email address.');
      setLoading(true);
      try {
        await auth().sendPasswordResetEmail(email.trim());
        Alert.alert('Email Sent', 'Password reset instructions dispatched.', [{ text: 'OK', onPress: () => changeMode('login') }]);
      } catch (err) {
        Alert.alert('Reset Failed', err.message);
      }
      setLoading(false);
      return;
    }

    if (!email.trim() || !password) return Alert.alert('Error', 'Please provide email and password.');

    if (mode === 'signup') {
      if (!username.trim()) return Alert.alert('Error', 'Username is required.');
      if (password !== confirmPassword) return Alert.alert('Error', 'Passwords do not match.');
      if (password.length < 6) return Alert.alert('Error', 'Password must be at least 6 characters.');
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const userCredential = await auth().signInWithEmailAndPassword(email.trim(), password);
        setLoggedInUser(userCredential.user);
      } else {
        const userCredential = await auth().createUserWithEmailAndPassword(email.trim(), password);
        await userCredential.user.updateProfile({ displayName: username.trim() });
        setLoggedInUser(auth().currentUser);
      }
    } catch (error) {
      let msg = error.message;
      if (error.code === 'auth/email-already-in-use') msg = 'Email is already registered.';
      if (error.code === 'auth/invalid-email') msg = 'Invalid email address.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') msg = 'Incorrect email or password.';
      Alert.alert('Authentication Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();
      const idToken = signInResult?.data?.idToken || signInResult?.idToken;

      if (!idToken) throw new Error('Google Sign-In returned no identity token.');

      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const userCredential = await auth().signInWithCredential(googleCredential);
      setLoggedInUser(userCredential.user);
    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Error', 'Play Services not available.');
      } else {
        Alert.alert('Google Sign-In Failed', error.message || 'Unable to authenticate.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {loading && (
        <View style={styles.progressBarBg}>
          <Animated.View style={[styles.progressBarFill, { width: progressBarWidth }]} />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" overScrollMode="never" bounces={false}>
        <Animated.View style={[styles.animContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          
          <View style={styles.headerWrapper}>
            <Image source={require('../assets/kameko_header.png')} style={styles.headerImage} resizeMode="contain" />
          </View>

          <View style={styles.card}>
            <Text style={styles.formTitle}>
              {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
            </Text>

            {mode === 'signup' && (
              <View style={styles.inputWrapper}>
                <TextInput style={styles.input} placeholder="Username" placeholderTextColor="#777777" value={username} onChangeText={setUsername} autoCapitalize="none" />
              </View>
            )}

            <View style={styles.inputWrapper}>
              <TextInput style={styles.input} placeholder="Email address" placeholderTextColor="#777777" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
            </View>

            {mode !== 'forgot' && (
              <View style={styles.inputWrapperWithIcon}>
                <TextInput style={styles.inputFlex} placeholder="Password" placeholderTextColor="#777777" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} />
                <TouchableOpacity style={styles.iconButton} onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <EyeIcon visible={showPassword} />
                </TouchableOpacity>
              </View>
            )}

            {mode === 'signup' && (
              <View style={styles.inputWrapperWithIcon}>
                <TextInput style={styles.inputFlex} placeholder="Confirm password" placeholderTextColor="#777777" secureTextEntry={!showConfirmPassword} value={confirmPassword} onChangeText={setConfirmPassword} />
                <TouchableOpacity style={styles.iconButton} onPress={() => setShowConfirmPassword(!showConfirmPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <EyeIcon visible={showConfirmPassword} />
                </TouchableOpacity>
              </View>
            )}

            {mode === 'login' && (
              <TouchableOpacity style={styles.forgotRow} onPress={() => changeMode('forgot')}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.primaryBtn, loading && styles.btnDisabled]} onPress={handleAuth} disabled={loading} activeOpacity={0.8}>
              <Text style={styles.primaryBtnText}>
                {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Recovery Email'}
              </Text>
            </TouchableOpacity>

            {mode !== 'forgot' && (
              <>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} /><Text style={styles.dividerText}>OR</Text><View style={styles.dividerLine} />
                </View>

                <TouchableOpacity style={[styles.googleBtn, loading && styles.btnDisabled]} onPress={handleGoogleLogin} disabled={loading} activeOpacity={0.8}>
                  <GoogleIcon />
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.switchWrapper}>
              {mode === 'login' && (
                <TouchableOpacity onPress={() => changeMode('signup')}>
                  <Text style={styles.switchPrompt}>New to Kameko? <Text style={styles.switchAction}>Sign up now</Text></Text>
                </TouchableOpacity>
              )}
              {mode === 'signup' && (
                <TouchableOpacity onPress={() => changeMode('login')}>
                  <Text style={styles.switchPrompt}>Already have an account? <Text style={styles.switchAction}>Sign In</Text></Text>
                </TouchableOpacity>
              )}
              {mode === 'forgot' && (
                <TouchableOpacity onPress={() => changeMode('login')}>
                  <Text style={styles.switchAction}>← Return to Sign In</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  progressBarBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: '#222222', zIndex: 9999 },
  progressBarFill: { height: '100%', backgroundColor: '#E50914' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 40 },
  animContainer: { width: '100%', alignItems: 'center' },
  headerWrapper: { marginBottom: 35 },
  headerImage: { width: 240, height: 65 },
  card: { width: '100%', backgroundColor: '#121212', borderRadius: 14, borderWidth: 1, borderColor: '#262626', padding: 25 },
  formTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginBottom: 25, textAlign: 'center' },
  inputWrapper: { marginBottom: 16 },
  input: { backgroundColor: '#1C1C1C', color: '#FFFFFF', height: 55, borderRadius: 10, borderWidth: 1, borderColor: '#333333', paddingHorizontal: 16, fontSize: 16 },
  inputWrapperWithIcon: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1C', height: 55, borderRadius: 10, borderWidth: 1, borderColor: '#333333', marginBottom: 16, paddingHorizontal: 16 },
  inputFlex: { flex: 1, color: '#FFFFFF', fontSize: 16, paddingVertical: 0 },
  iconButton: { paddingLeft: 10, justifyContent: 'center', alignItems: 'center' },
  forgotRow: { alignSelf: 'flex-end', marginBottom: 20 },
  forgotText: { color: '#AAAAAA', fontSize: 14, fontWeight: '500' },
  primaryBtn: { backgroundColor: '#E50914', height: 55, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 5 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold', letterSpacing: 0.5 },
  btnDisabled: { opacity: 0.6 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 25 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#2A2A2A' },
  dividerText: { color: '#666666', fontSize: 13, fontWeight: 'bold', marginHorizontal: 12 },
  googleBtn: { flexDirection: 'row', backgroundColor: '#FFFFFF', height: 55, borderRadius: 10, justifyContent: 'center', alignItems: 'center', gap: 12 },
  googleBtnText: { color: '#000000', fontSize: 16, fontWeight: 'bold' },
  switchWrapper: { marginTop: 30, alignItems: 'center' },
  switchPrompt: { color: '#888888', fontSize: 15 },
  switchAction: { color: '#FFFFFF', fontWeight: 'bold' },
});
