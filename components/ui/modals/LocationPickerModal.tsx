import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { useDarkMode } from '@/hooks/useDarkMode';
import { filterPinamalayanResults, isWithinPinamalayan, MAP_RING_CHECK_JS, LOCATION_RESTRICTION_MESSAGE,
  locationSearchText, LocationSearchResult, PINAMALAYAN_BOUNDARY, PINAMALAYAN_CENTER,
  PINAMALAYAN_VIEWBOX, safeLocationAddress } from '@/utils/pinamalayanLocation';

interface LocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectLocation: (locationData: { latitude: number; longitude: number; address: string }) => void;
  initialLatitude?: number;
  initialLongitude?: number;
}
const ACCENT_RED = '#C53030';
const GEOCODER_HEADERS = { 'User-Agent': 'DiskarTech-Mobile-App/1.0', 'Accept-Language': 'en' };

export default function LocationPickerModal({ visible, onClose, onSelectLocation, initialLatitude, initialLongitude }: LocationPickerProps) {
  const { isDark, colors } = useDarkMode();
  const webViewRef = useRef<WebView>(null);
  const coordsRef = useRef(PINAMALAYAN_CENTER);
  const [coords, setCoords] = useState(PINAMALAYAN_CENTER);
  const [formattedAddress, setFormattedAddress] = useState('');
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRevision = useRef(0);
  const addressRevision = useRef(0);
  const sessionRevision = useRef(0);
  const isVisibleRef = useRef(false);

  const updateMap = useCallback((lat: number, lng: number) => {
    if (!isWithinPinamalayan(lat, lng)) return;
    webViewRef.current?.injectJavaScript('window.updateMapPosition && window.updateMapPosition(' + lat + ',' + lng + '); true;');
  }, []);

  const fetchAddress = useCallback(async (lat: number, lng: number) => {
    const revision = ++addressRevision.current;
    setLoadingAddress(true);
    setFormattedAddress('');
    let address: string | null = null;
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const result = results[0];
      // Avoid assigning an adjacent town's address when a geocoder snaps across the border.
      if (result && /pinamalayan/i.test(result.city || result.subregion || '')) {
        address = safeLocationAddress([result.street, result.district || result.name, 'Pinamalayan', 'Oriental Mindoro']
          .filter(Boolean).join(', '));
      }
    } catch { /* Native geocoding can require permission; use the HTTP fallback. */ }
    if (!address && isVisibleRef.current && revision === addressRevision.current) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&addressdetails=1',
          { headers: GEOCODER_HEADERS, signal: controller.signal });
        if (response.ok) {
          const data = await response.json();
          const place = data.address?.city || data.address?.town || data.address?.municipality || '';
          if (/pinamalayan/i.test(place)) address = safeLocationAddress(data.display_name);
        }
      } catch { /* Keep a coordinate-based address within the validated municipality. */ }
      finally { clearTimeout(timeout); }
    }
    if (!isVisibleRef.current || revision !== addressRevision.current) return;
    setFormattedAddress(address || 'Pinamalayan, Oriental Mindoro (' + lat.toFixed(5) + ', ' + lng.toFixed(5) + ')');
    setLoadingAddress(false);
  }, []);

  const selectCoordinates = useCallback((lat: number, lng: number) => {
    if (!isWithinPinamalayan(lat, lng)) {
      setLocationMessage(LOCATION_RESTRICTION_MESSAGE);
      updateMap(coordsRef.current.latitude, coordsRef.current.longitude);
      return false;
    }
    coordsRef.current = { latitude: lat, longitude: lng };
    setCoords(coordsRef.current);
    setLocationMessage('');
    updateMap(lat, lng);
    void fetchAddress(lat, lng);
    return true;
  }, [fetchAddress, updateMap]);

  const getCurrentLocation = useCallback(async () => {
    const session = sessionRevision.current;
    const selection = addressRevision.current;
    setLocatingUser(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!isVisibleRef.current || session !== sessionRevision.current) return;
      if (permission.status !== 'granted') {
        setLocationMessage('Location permission is off. Search or choose a pin within Pinamalayan.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!isVisibleRef.current || session !== sessionRevision.current || selection !== addressRevision.current) return;
      if (!isWithinPinamalayan(location.coords.latitude, location.coords.longitude)) {
        setLocationMessage('Your current location is outside Pinamalayan. Choose a location inside the highlighted area.');
        return;
      }
      selectCoordinates(location.coords.latitude, location.coords.longitude);
    } catch {
      if (isVisibleRef.current && session === sessionRevision.current) setLocationMessage('Could not get your location. Search or choose a pin within Pinamalayan.');
    } finally {
      if (isVisibleRef.current && session === sessionRevision.current) setLocatingUser(false);
    }
  }, [selectCoordinates]);

  useEffect(() => {
    const sessions = sessionRevision, searches = searchRevision, addresses = addressRevision;
    isVisibleRef.current = visible;
    ++sessionRevision.current;
    ++searchRevision.current;
    ++addressRevision.current;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (visible) {
      setSearchQuery(''); setSearchResults([]); setShowResults(false); setSearching(false); setLocatingUser(false); setSearchMessage('');
      const initial = isWithinPinamalayan(initialLatitude, initialLongitude)
        ? { latitude: initialLatitude!, longitude: initialLongitude! } : PINAMALAYAN_CENTER;
      selectCoordinates(initial.latitude, initial.longitude);
      if (initialLatitude !== undefined && initialLongitude !== undefined && !isWithinPinamalayan(initialLatitude, initialLongitude)) {
        setLocationMessage('Your saved location is outside Pinamalayan. Please choose a new location.');
      }
    }
    return () => {
      isVisibleRef.current = false;
      ++sessions.current; ++searches.current; ++addresses.current;
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [visible, initialLatitude, initialLongitude, selectCoordinates]);

  const searchLocation = async (query: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    const revision = ++searchRevision.current;
    let trimmed: string;
    try { trimmed = locationSearchText(query); }
    catch (error) {
      setSearchResults([]); setShowResults(true); setSearching(false); setSearchMessage((error as Error).message); return;
    }
    if (trimmed.length < 2) { setSearchResults([]); setShowResults(false); setSearching(false); return; }
    setSearching(true); setSearchMessage(''); setShowResults(false);
    let results: LocationSearchResult[] = [];
    const scopedQuery = trimmed + ', Pinamalayan, Oriental Mindoro, Philippines';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(scopedQuery)
        + '&countrycodes=ph&bounded=1&viewbox=' + PINAMALAYAN_VIEWBOX + '&limit=20&addressdetails=1',
      { headers: GEOCODER_HEADERS, signal: controller.signal });
      if (response.ok) results = filterPinamalayanResults(await response.json());
    } catch { /* Try a scoped native search, with the same polygon check. */ }
    finally { clearTimeout(timeout); }
    if (!isVisibleRef.current || revision !== searchRevision.current) return;
    if (!results.length) {
      try {
        const native = await Location.geocodeAsync(scopedQuery);
        results = filterPinamalayanResults(native.map((r, i) => ({ place_id: 'native-' + i, lat: r.latitude, lon: r.longitude, display_name: scopedQuery })));
      } catch { /* Show an empty state, without offering out-of-area results. */ }
    }
    if (!isVisibleRef.current || revision !== searchRevision.current) return;
    setSearchResults(results); setShowResults(true); setSearching(false);
    setSearchMessage(results.length ? '' : 'No matching places in Pinamalayan. Try a barangay or landmark, or choose a pin on the map.');
  };

  const handleQueryChange = (text: string) => {
    // Keep spaces while typing; sanitize and validate before making a search request.
    setSearchQuery(text.replace(/[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '').slice(0, 120));
    ++searchRevision.current;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setSearchResults([]); setShowResults(false); setSearching(false);
    if (text.trim().length < 2) return;
    searchTimeoutRef.current = setTimeout(() => void searchLocation(text), 1000);
  };

  const handleSelectSearchResult = (item: LocationSearchResult) => {
    if (selectCoordinates(item.lat, item.lon)) {
      ++searchRevision.current;
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      setShowResults(false); setSearching(false); setSearchQuery(''); Keyboard.dismiss();
    }
  };

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    if (!isVisibleRef.current) return;
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'outside_boundary') { setLocationMessage(LOCATION_RESTRICTION_MESSAGE); return; }
      if (data.type === 'location_selected') {
        selectCoordinates(data.latitude, data.longitude);
        ++searchRevision.current;
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        setSearching(false); setShowResults(false); Keyboard.dismiss();
      }
    } catch { /* Ignore malformed messages; never move or save the pin. */ }
  };

  // Keep the WebView source stable while searches and address lookups update React state.
  const mapSource = useMemo(() => ({ html: `
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
          background: rgba(197, 48, 48, 0.35);
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
        var initialLat = ${PINAMALAYAN_CENTER.latitude};
        var initialLng = ${PINAMALAYAN_CENTER.longitude};
        var boundary = ${JSON.stringify(PINAMALAYAN_BOUNDARY)};
        var withinRing = ${MAP_RING_CHECK_JS};
        function allowed(lat, lng) {
          var rings = boundary.geometry.coordinates;
          return Number.isFinite(lat) && Number.isFinite(lng) && withinRing(lat, lng, rings[0])
            && !rings.slice(1).some(function(ring) { return withinRing(lat, lng, ring); });
        }
        var bounds = L.latLngBounds([boundary.bbox[1], boundary.bbox[0]], [boundary.bbox[3], boundary.bbox[2]]);

        var map = L.map('map', {
          zoomControl: true,
          attributionControl: true,
          maxBounds: bounds.pad(0.05),
          maxBoundsViscosity: 1,
          minZoom: 11
        }).setView([initialLat, initialLng], 15);

        // OpenStreetMap Free Carto Tiles
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        L.geoJSON(boundary, { interactive: false, style: { color: '${ACCENT_RED}', weight: 2, fillOpacity: 0.06 } }).addTo(map);

        // Modern Red Pin Marker with Pulse
        var redIcon = L.divIcon({
          className: 'custom-pin',
          html: '<div class="pin-pulse"></div><svg width="34" height="44" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));"><path d="M12 0C5.37258 0 0 5.37258 0 12C0 20.5 12 32 12 32C12 32 24 20.5 24 12C24 5.37258 18.6274 0 12 0Z" fill="${ACCENT_RED}"/><circle cx="12" cy="12" r="5" fill="#FFFFFF"/></svg>',
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

        var lastValid = [initialLat, initialLng];
        function movePin(lat, lng) {
          if (!allowed(lat, lng)) {
            marker.setLatLng(lastValid);
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'outside_boundary' }));
            return false;
          }
          lastValid = [lat, lng];
          marker.setLatLng(lastValid);
          return true;
        }
        map.on('click', function(e) {
          var lat = e.latlng.lat;
          var lng = e.latlng.lng;
          if (movePin(lat, lng)) notifyApp(lat, lng);
        });

        // Pagkatapos i-drag ang pin
        marker.on('dragend', function(e) {
          var pos = e.target.getLatLng();
          if (movePin(pos.lat, pos.lng)) notifyApp(pos.lat, pos.lng);
        });

        // Function para baguhin ang center mula sa React Native
        window.updateMapPosition = function(newLat, newLng) {
          if (!movePin(newLat, newLng)) return;
          map.setView([newLat, newLng], 16, { animate: true });
        };
      </script>
    </body>
    </html>
  ` }), []);
  const canConfirm = !loadingAddress && !locatingUser && !!safeLocationAddress(formattedAddress)
    && isWithinPinamalayan(coords.latitude, coords.longitude);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        {/* Top Header */}
        <View 
          className="flex-row justify-between items-center px-5 pt-12 pb-4 border-b z-10 shadow-sm"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          <View className="flex-1 mr-3">
            <Text className="text-xl font-bold" style={{ color: colors.text }}>Pinpoint Your Location</Text>
            <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>Pinamalayan, Oriental Mindoro only</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }}
          >
            <MaterialIcons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Map Area */}
        <View className="flex-1 relative" style={{ backgroundColor: colors.background }}>
          {/* Floating Search Bar on Map */}
          <View
            style={{
              position: 'absolute',
              top: 12,
              left: 16,
              right: 16,
              zIndex: 40,
            }}
          >
            <View
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.12,
                shadowRadius: 6,
                elevation: 6,
              }}
              className="flex-row items-center px-3.5 py-2.5 rounded-2xl border"
            >
              <MaterialIcons name="search" size={22} color={ACCENT_RED} style={{ marginRight: 8 }} />
              <TextInput
                value={searchQuery}
                onChangeText={handleQueryChange}
                onSubmitEditing={() => searchLocation(searchQuery)}
                placeholder="Search a barangay or landmark..."
                maxLength={120}
                placeholderTextColor={colors.textSecondary}
                style={{
                  flex: 1,
                  color: colors.text,
                  fontSize: 14,
                  paddingVertical: 0,
                }}
                returnKeyType="search"
              />
              {searching ? (
                <ActivityIndicator size="small" color={ACCENT_RED} />
              ) : searchQuery ? (
                <TouchableOpacity
                  onPress={() => {
                    handleQueryChange('');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="cancel" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Search Results Dropdown List */}
            {showResults && (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 8,
                  elevation: 8,
                  maxHeight: 220,
                }}
                className="mt-2 rounded-2xl border overflow-hidden"
              >
                <ScrollView keyboardShouldPersistTaps="handled">
                  {!!searchMessage && <Text className="px-4 py-3 text-xs leading-5" style={{ color: colors.textSecondary }}>{searchMessage}</Text>}
                  {searchResults.map((item, index) => (
                    <TouchableOpacity
                      key={item.place_id || index}
                      onPress={() => handleSelectSearchResult(item)}
                      style={{
                        borderBottomColor: colors.border,
                        borderBottomWidth: index === searchResults.length - 1 ? 0 : 1,
                      }}
                      className="flex-row items-center px-4 py-3 active:opacity-70"
                    >
                      <View 
                        style={{ backgroundColor: isDark ? 'rgba(197, 48, 48, 0.15)' : '#FEF2F2' }}
                        className="w-8 h-8 rounded-full items-center justify-center mr-2.5"
                      >
                        <MaterialIcons name="place" size={18} color={ACCENT_RED} />
                      </View>
                      <Text
                        numberOfLines={2}
                        className="text-xs font-medium flex-1 leading-4"
                        style={{ color: colors.text }}
                      >
                        {item.display_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {visible && <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={mapSource}
            onMessage={handleWebViewMessage}
            onLoadEnd={() => updateMap(coordsRef.current.latitude, coordsRef.current.longitude)}
            style={{ flex: 1 }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            geolocationEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={ACCENT_RED} />
                <Text className="text-xs mt-2 font-medium" style={{ color: colors.textSecondary }}>Loading OpenStreetMap...</Text>
              </View>
            )}
          />}

          {/* Floating Current Location (GPS) Button */}
          <TouchableOpacity
            onPress={getCurrentLocation}
            disabled={locatingUser}
            className="absolute bottom-6 right-5 w-12 h-12 rounded-full items-center justify-center shadow-lg border z-20"
            style={{ 
              elevation: 5,
              backgroundColor: colors.surface,
              borderColor: colors.border
            }}
          >
            {locatingUser ? (
              <ActivityIndicator size="small" color={ACCENT_RED} />
            ) : (
              <MaterialIcons name="my-location" size={24} color={ACCENT_RED} />
            )}
          </TouchableOpacity>
        </View>

        {/* Address Preview Box */}
        <View 
          className="p-5 border-t shadow-sm"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          {!!locationMessage && <View className="flex-row items-start gap-2 mb-3">
            <MaterialIcons name="info-outline" size={18} color={colors.textSecondary} />
            <Text className="flex-1 text-xs leading-5" style={{ color: colors.textSecondary }} accessibilityRole="alert">{locationMessage}</Text>
          </View>}
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-1.5">
              <MaterialIcons name="place" size={16} color={ACCENT_RED} />
              <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.textSecondary }}>SELECTED ADDRESS</Text>
            </View>
            {loadingAddress && (
              <View className="flex-row items-center gap-1">
                <ActivityIndicator size="small" color={ACCENT_RED} />
                <Text className="text-[11px]" style={{ color: colors.textSecondary }}>Fetching address...</Text>
              </View>
            )}
          </View>

          <Text className="text-sm font-semibold mb-2 leading-5" numberOfLines={2} style={{ color: colors.text }}>
            {formattedAddress || 'Finding your selected address...'}
          </Text>

          {/* Coordinates Chip */}
          <View className="flex-row items-center mb-4">
            <View 
              className="px-2.5 py-1 rounded-md border"
              style={{ 
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                borderColor: colors.border
              }}
            >
              <Text className="text-[11px] font-mono" style={{ color: colors.textSecondary }}>
                {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
              </Text>
            </View>
          </View>

          {/* Confirm Button */}
          <TouchableOpacity
            disabled={!canConfirm}
            accessibilityState={{ disabled: !canConfirm }}
            onPress={() => {
              if (!canConfirm) return;
              onSelectLocation({
                latitude: coords.latitude,
                longitude: coords.longitude,
                address: formattedAddress,
              });
              onClose();
            }}
            style={{ backgroundColor: ACCENT_RED, opacity: canConfirm ? 1 : 0.5 }}
            className="rounded-2xl py-4 items-center justify-center shadow-sm flex-row gap-2 active:opacity-85"
          >
            <MaterialIcons name="check-circle" size={20} color="white" />
            <Text className="text-white font-bold text-base">CONFIRM LOCATION</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
