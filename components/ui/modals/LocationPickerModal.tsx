import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

interface LocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectLocation: (locationData: { latitude: number; longitude: number; address: string }) => void;
}

export default function LocationPickerModal({ visible, onClose, onSelectLocation }: LocationPickerProps) {
  const [region, setRegion] = useState({
    latitude: 13.3467,
    longitude: 121.2845,
    latitudeDelta: 0.015,
    longitudeDelta: 0.0121,
  });

  const [markerCoords, setMarkerCoords] = useState({
    latitude: 13.3467,
    longitude: 121.2845,
  });

  const [formattedAddress, setFormattedAddress] = useState('Pinpoint a location on the map');

  useEffect(() => {
    if (visible) {
      getCurrentLocation();
    }
  }, [visible]);

  const getCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      let location = await Location.getCurrentPositionAsync({});
      const lat = location.coords.latitude;
      const lng = location.coords.longitude;

      setRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.015, longitudeDelta: 0.0121 });
      setMarkerCoords({ latitude: lat, longitude: lng });
      fetchAddress(lat, lng);
    } catch (error) {
      console.log(error);
    }
  };

  // I-convert ang lat/long patungong address text (Reverse Geocoding)
  const fetchAddress = async (lat: number, lng: number) => {
    try {
      let response = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (response && response.length > 0) {
        const addr = response[0];
        
        // Pinagsasama-sama natin ang subadmin/district, barangay (subregion o name), city, at province
        const barangay = addr.district || addr.name || '';
        const city = addr.city || addr.subregion || '';
        const province = addr.region || '';
        
        // Bubuo tayo ng mas kumpletong string
        const fullAddress = [addr.street, barangay, city, province]
          .filter((item) => item && item.trim() !== '') // Tanggalin ang mga walang laman
          .join(', ');

        setFormattedAddress(fullAddress || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      }
    } catch (error) {
      setFormattedAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View className="flex-1 bg-white">
        <View className="flex-row justify-between items-center p-4 pt-12 border-b border-gray-100 bg-white z-10">
          <Text className="text-lg font-bold text-slate-900">Pinpoint Your Location</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <View className="flex-1">
          <MapView
            style={{ width: '100%', height: '100%' }}
            region={region}
            onRegionChangeComplete={(r) => setRegion(r)}
            onPress={(e) => {
              const lat = e.nativeEvent.coordinate.latitude;
              const lng = e.nativeEvent.coordinate.longitude;
              setMarkerCoords({ latitude: lat, longitude: lng });
              fetchAddress(lat, lng);
            }}
          >
            <Marker coordinate={markerCoords} />
          </MapView>
        </View>

        {/* Address Preview Box */}
        <View className="p-4 bg-gray-50 border-t border-gray-100">
          <Text className="text-xs text-slate-400 mb-1 font-semibold">SELECTED ADDRESS:</Text>
          <Text className="text-sm text-slate-800 font-medium mb-3" numberOfLines={2}>{formattedAddress}</Text>
          
          <TouchableOpacity 
            onPress={() => {
              onSelectLocation({ 
                latitude: markerCoords.latitude, 
                longitude: markerCoords.longitude, 
                address: formattedAddress 
              });
              onClose();
            }}
            className="bg-red-600 rounded-2xl py-4 items-center justify-center shadow-sm"
          >
            <Text className="text-white font-bold text-base">CONFIRM LOCATION</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}