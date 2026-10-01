import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface LocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectLocation: (locationData: { latitude: number; longitude: number; address: string }) => void;
  initialLatitude?: number;
  initialLongitude?: number;
}

// Default coordinates: Calapan / Oriental Mindoro (o Metro Manila)
const DEFAULT_LAT = 13.4115;
const DEFAULT_LNG = 121.1803;

export default function LocationPickerModal({
  visible,
  onClose,
  onSelectLocation,
  initialLatitude,
  initialLongitude,
}: LocationPickerProps) {
  const webViewRef = useRef<WebView>(null);

  const [coords, setCoords] = useState({
    latitude: initialLatitude || DEFAULT_LAT,
    longitude: initialLongitude || DEFAULT_LNG,
  });

  const [formattedAddress, setFormattedAddress] = useState('Pinpoint a location on the map');
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);

  useEffect(() => {
    if (visible) {
      if (!initialLatitude || !initialLongitude) {
        getCurrentLocation();
      } else {
        fetchAddress(initialLatitude, initialLongitude);
      }
    }
  }, [visible]);

  // Kunin ang kasalukuyang GPS location ng user
  const getCurrentLocation = async () => {
    try {
      setLocatingUser(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        fetchAddress(coords.latitude, coords.longitude);
        setLocatingUser(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = location.coords.latitude;
      const lng = location.coords.longitude;

      setCoords({ latitude: lat, longitude: lng });
      fetchAddress(lat, lng);

      // I-pan at i-zoom ang OpenStreetMap sa bagong coordinates
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          if (window.updateMapPosition) {
            window.updateMapPosition(${lat}, ${lng});
          }
          true;
        `);
      }
    } catch (error) {
      console.warn('Error getting current location:', error);
      fetchAddress(coords.latitude, coords.longitude);
    } finally {
      setLocatingUser(false);
    }
  };

  // I-convert ang coordinates patungong nababasang address (Reverse Geocoding)
  const fetchAddress = async (lat: number, lng: number) => {
    setLoadingAddress(true);
    try {
      // 1. Subukan gamit ang native expo-location reverse geocoder
      const expoResult = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (expoResult && expoResult.length > 0) {
        const addr = expoResult[0];
        const barangay = addr.district || addr.name || '';
        const city = addr.city || addr.subregion || '';
        const province = addr.region || '';
        const street = addr.street || '';

        const full = [street, barangay, city, province]
          .filter((item) => item && item.trim() !== '')
          .join(', ');

        if (full) {
          setFormattedAddress(full);
          setLoadingAddress(false);
          return;
        }
      }

      // 2. Fallback: OpenStreetMap Nominatim Free Geocoder kung walang returned data ang native
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'DiskarTech-Mobile-App/1.0',
            'Accept-Language': 'en',
          },
        }
      );
      const data = await res.json();
      if (data && data.display_name) {
        setFormattedAddress(data.display_name);
      } else {
        setFormattedAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch {
      setFormattedAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setLoadingAddress(false);
    }
  };

  // Tanggapin ang mensahe mula sa Leaflet kapag nag-tap o nag-drag ang user ng pin
  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'location_selected') {
        const lat = Number(data.latitude);
        const lng = Number(data.longitude);
        setCoords({ latitude: lat, longitude: lng });
        fetchAddress(lat, lng);
      }
    } catch (err) {
      console.warn('Error parsing map message:', err);
    }
  };

  // Pure HTML + Leaflet + OpenStreetMap (100% Free, Zero API Keys, No native crashes)
  const leafletHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #f8fafc; font-family: sans-serif; }
        .custom-pin {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .pin-pulse {
          width: 24px;
          height: 24px;
          background: rgba(220, 38, 38, 0.35);
          border-radius: 50%;
          position: absolute;
          bottom: -4px;
          left: 5px;
          animation: pulse 1.8s infinite ease-out;
        }
        @keyframes pulse {
          0% { transform: scale(0.6); opacity: 1; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1) !important;
          border-radius: 12px !important;
          overflow: hidden;
        }
        .leaflet-control-zoom a {
          background: #ffffff !important;
          color: #1e293b !important;
          width: 36px !important;
          height: 36px !important;
          line-height: 36px !important;
          font-size: 18px !important;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var initialLat = ${coords.latitude};
        var initialLng = ${coords.longitude};

        var map = L.map('map', {
          zoomControl: true,
          attributionControl: false
        }).setView([initialLat, initialLng], 15);

        // OpenStreetMap Free Carto Tiles
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);

        // Modern Red Pin Marker with Pulse
        var redIcon = L.divIcon({
          className: 'custom-pin',
          html: '<div class="pin-pulse"></div><svg width="34" height="44" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));"><path d="M12 0C5.37258 0 0 5.37258 0 12C0 20.5 12 32 12 32C12 32 24 20.5 24 12C24 5.37258 18.6274 0 12 0Z" fill="#DC2626"/><circle cx="12" cy="12" r="5" fill="#FFFFFF"/></svg>',
          iconSize: [34, 44],
          iconAnchor: [17, 36]
        });

        var marker = L.marker([initialLat, initialLng], {
          icon: redIcon,
          draggable: true
        }).addTo(map);

        function notifyApp(lat, lng) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'location_selected',
              latitude: lat,
              longitude: lng
            }));
          }
        }

        // Tap saanman sa mapa para ilipat ang pin
        map.on('click', function(e) {
          var lat = e.latlng.lat;
          var lng = e.latlng.lng;
          marker.setLatLng([lat, lng]);
          notifyApp(lat, lng);
        });

        // Pagkatapos i-drag ang pin
        marker.on('dragend', function(e) {
          var pos = e.target.getLatLng();
          notifyApp(pos.lat, pos.lng);
        });

        // Function para baguhin ang center mula sa React Native
        window.updateMapPosition = function(newLat, newLng) {
          map.setView([newLat, newLng], 16, { animate: true });
          marker.setLatLng([newLat, newLng]);
        };
      </script>
    </body>
    </html>
  `;

  return (
    <Modal visible={visible} animationType="slide">
      <View className="flex-1 bg-white">
        {/* Top Header */}
        <View className="flex-row justify-between items-center px-5 pt-12 pb-4 border-b border-gray-100 bg-white z-10 shadow-sm">
          <View>
            <Text className="text-xl font-bold text-slate-900">Pinpoint Your Location</Text>
            <Text className="text-xs text-slate-500 mt-0.5">Tap anywhere or drag the pin on OpenStreetMap</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center"
          >
            <MaterialIcons name="close" size={22} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Map Area */}
        <View className="flex-1 relative bg-slate-50">
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: leafletHTML }}
            onMessage={handleWebViewMessage}
            style={{ flex: 1 }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            geolocationEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View className="absolute inset-0 items-center justify-center bg-slate-50">
                <ActivityIndicator size="large" color="#DC2626" />
                <Text className="text-xs text-slate-500 mt-2 font-medium">Loading OpenStreetMap...</Text>
              </View>
            )}
          />

          {/* Floating Current Location (GPS) Button */}
          <TouchableOpacity
            onPress={getCurrentLocation}
            disabled={locatingUser}
            className="absolute bottom-6 right-5 w-12 h-12 bg-white rounded-full items-center justify-center shadow-lg border border-gray-100 z-20"
            style={{ elevation: 5 }}
          >
            {locatingUser ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <MaterialIcons name="my-location" size={24} color="#DC2626" />
            )}
          </TouchableOpacity>
        </View>

        {/* Address Preview Box */}
        <View className="p-5 bg-white border-t border-gray-100 shadow-sm">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-1.5">
              <MaterialIcons name="place" size={16} color="#DC2626" />
              <Text className="text-xs text-slate-400 font-bold uppercase tracking-wider">SELECTED ADDRESS</Text>
            </View>
            {loadingAddress && (
              <View className="flex-row items-center gap-1">
                <ActivityIndicator size="small" color="#DC2626" />
                <Text className="text-[11px] text-slate-400">Fetching address...</Text>
              </View>
            )}
          </View>

          <Text className="text-sm font-semibold text-slate-800 mb-2 leading-5" numberOfLines={2}>
            {formattedAddress}
          </Text>

          {/* Coordinates Chip */}
          <View className="flex-row items-center mb-4">
            <View className="bg-slate-100 px-2.5 py-1 rounded-md">
              <Text className="text-[11px] text-slate-600 font-mono">
                {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
              </Text>
            </View>
          </View>

          {/* Confirm Button */}
          <TouchableOpacity
            onPress={() => {
              onSelectLocation({
                latitude: coords.latitude,
                longitude: coords.longitude,
                address: formattedAddress,
              });
              onClose();
            }}
            className="bg-red-600 rounded-2xl py-4 items-center justify-center shadow-sm flex-row gap-2 active:bg-red-700"
          >
            <MaterialIcons name="check-circle" size={20} color="white" />
            <Text className="text-white font-bold text-base">CONFIRM LOCATION</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}