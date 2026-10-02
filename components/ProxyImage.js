import React, { useState, useEffect } from 'react';
import { Image, Animated, View, StyleSheet } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';

// GLOBAL PROXY SETTINGS
// Currently using a high-speed public CDN to bypass ISP blocks and optimize to WebP.
// When you deploy your own Cloudflare Worker, simply replace this URL.
const PROXY_BASE = 'https://wsrv.nl/?url='; 

export const getProxiedUrl = (originalUrl) => {
  if (!originalUrl) return null;
  
  // Intercept TMDB URLs to bypass regional ISP blocks
  if (originalUrl.includes('image.tmdb.org')) {
    // Strips 'https://' for the proxy and adds WebP compression
    const cleanUrl = originalUrl.replace('https://', '');
    return `${PROXY_BASE}${encodeURIComponent(cleanUrl)}&output=webp&q=80`;
  }
  
  return originalUrl;
};

export default function ProxyImage({ 
  source, 
  style, 
  resizeMode = 'cover', 
  isAnimated = false, 
  fadeDuration = 300, 
  ...props 
}) {
  const [imgUri, setImgUri] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadAndCacheImage = async () => {
      if (!source?.uri) return;

      const proxiedUrl = getProxiedUrl(source.uri);
      
      try {
        // 1. Generate a unique hash for the file name
        const hashedName = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          proxiedUrl
        );
        const localUri = `${FileSystem.cacheDirectory}${hashedName}.webp`;

        // 2. Check if the image already exists on the phone's hard drive
        const fileInfo = await FileSystem.getInfoAsync(localUri);
        
        if (fileInfo.exists) {
          // INSTANT LOAD: Serve from local storage (0ms network delay)
          if (isMounted) setImgUri(localUri);
        } else {
          // DOWNLOAD & CACHE: Fetch from edge proxy and save to device
          const download = await FileSystem.downloadAsync(proxiedUrl, localUri);
          if (isMounted) setImgUri(download.uri);
        }
      } catch (e) {
        // FALLBACK: If disk cache fails, stream directly from network
        if (isMounted) setImgUri(proxiedUrl);
      }
    };

    loadAndCacheImage();
    return () => { isMounted = false; };
  }, [source?.uri]);

  // Render an ultra-dark grey skeleton block while the image processes
  if (!imgUri) {
    return <View style={[style, { backgroundColor: '#141414' }]} />;
  }

  // Support both standard <Image> and <Animated.Image> dynamically
  const ImgComponent = isAnimated ? Animated.Image : Image;

  return (
    <ImgComponent 
      source={{ uri: imgUri }} 
      style={style} 
      resizeMode={resizeMode} 
      fadeDuration={fadeDuration}
      {...props} 
    />
  );
}
