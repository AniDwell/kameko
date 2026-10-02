import React from 'react';
import { Image, Animated } from 'react-native';

/**
 * High-performance edge proxy builder.
 * Automatically rewrites TMDB image URLs to a blazing-fast global edge CDN,
 * converts them to lightweight WebP format on the fly, and bypasses regional ISP blocks.
 */
export const getProxiedUrl = (originalUrl) => {
  if (!originalUrl) return null;
  
  if (originalUrl.includes('image.tmdb.org')) {
    const cleanUrl = originalUrl.replace('https://', '').replace('http://', '');
    // Uses wsrv.nl edge caching + WebP compression (quality 82) for instant loads
    return `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&output=webp&q=82`;
  }
  
  return originalUrl;
};

export default function ProxyImage({ 
  source, 
  style, 
  resizeMode = 'cover', 
  isAnimated = false, 
  fadeDuration = 0, 
  ...props 
}) {
  const proxiedUri = getProxiedUrl(source?.uri);
  const ImgComponent = isAnimated ? Animated.Image : Image;

  return (
    <ImgComponent 
      source={{ uri: proxiedUri }} 
      style={style} 
      resizeMode={resizeMode} 
      fadeDuration={fadeDuration}
      {...props} 
    />
  );
}
