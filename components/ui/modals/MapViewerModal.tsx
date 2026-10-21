import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useDarkMode } from '@/hooks/useDarkMode';

interface MapViewerModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export interface NavigationStep {
  instruction: string;
  distance: string;
  type: string;
  modifier?: string;
}

export interface RouteInfo {
  distanceText: string;
  durationText: string;
  distanceMeters: number;
  durationSeconds: number;
  summary: string;
  steps: NavigationStep[];
  coordinates: [number, number][];
  bounds: [number, number, number, number];
}

const DEFAULT_LAT = 13.7565; // Batangas City coordinates
const DEFAULT_LNG = 121.0583;

export default function MapViewerModal({
  visible,
  onClose,
  title,
  subtitle,
  address,
  latitude,
  longitude,
}: MapViewerModalProps) {
  const { colors, isDark } = useDarkMode();
  const webViewRef = useRef<WebView>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);

  // Destination coordinates
  const [destCoords, setDestCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: latitude || DEFAULT_LAT,
    longitude: longitude || DEFAULT_LNG,
  });
  const [resolvingCoords, setResolvingCoords] = useState(false);

  // User current GPS coordinates
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locatingUser, setLocatingUser] = useState(false);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState<boolean | null>(null);

  // In-App Directions & Routing State
  const [travelMode, setTravelMode] = useState<'driving' | 'walking'>('driving');
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  // UI Interactive States
  const [is3D, setIs3D] = useState(true);
  const [showStepsList, setShowStepsList] = useState(false);
  const [isLiveTracking, setIsLiveTracking] = useState(false);

  // 1. Kapag binuksan ang modal, i-resolve ang destination coords at kunin ang user GPS location
  useEffect(() => {
    if (!visible) {
      stopLiveTracking();
      setRouteInfo(null);
      setShowStepsList(false);
      return;
    }

    if (latitude && longitude && latitude !== 0 && longitude !== 0) {
      setDestCoords({ latitude, longitude });
    } else if (address && address !== 'Location provided upon hiring' && address !== 'Workplace Location') {
      geocodeAddress(address);
    }

    requestAndFetchUserLocation();
  }, [visible, latitude, longitude, address]);

  // 2. Kapag available na ang userCoords at destCoords, awtomatikong kalkulahin ang In-App Route
  useEffect(() => {
    if (visible && userCoords && destCoords.latitude && destCoords.longitude) {
      calculateInAppRoute(userCoords, destCoords, travelMode);
    }
  }, [visible, userCoords, destCoords.latitude, destCoords.longitude, travelMode]);

  // Cleanup location tracking on unmount
  useEffect(() => {
    return () => {
      stopLiveTracking();
    };
  }, []);

  // I-geocode ang address kung walang explicit coordinates
  const geocodeAddress = async (addr: string) => {
    try {
      setResolvingCoords(true);
      const results = await Location.geocodeAsync(addr);
      if (results && results.length > 0) {
        const { latitude: lat, longitude: lng } = results[0];
        setDestCoords({ latitude: lat, longitude: lng });

        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            if (window.setDestinationPosition) {
              window.setDestinationPosition(${lng}, ${lat});
            }
            true;
          `);
        }
      }
    } catch (err) {
      console.warn('Could not geocode address:', addr, err);
    } finally {
      setResolvingCoords(false);
    }
  };

  // Kunin ang kasalukuyang GPS location ng user gamit ang expo-location
  const requestAndFetchUserLocation = async () => {
    try {
      setLocatingUser(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setLocationPermissionGranted(granted);

      if (!granted) {
        setLocatingUser(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const uLat = location.coords.latitude;
      const uLng = location.coords.longitude;
      setUserCoords({ latitude: uLat, longitude: uLng });

      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          if (window.setUserPosition) {
            window.setUserPosition(${uLng}, ${uLat});
          }
          true;
        `);
      }
    } catch (err) {
      console.warn('Could not get user GPS location:', err);
    } finally {
      setLocatingUser(false);
    }
  };

  // Kalkulahin ang rota gamit ang OSRM (Open Source Routing Machine) nang diretso sa loob ng app
  const calculateInAppRoute = async (
    start: { latitude: number; longitude: number },
    end: { latitude: number; longitude: number },
    mode: 'driving' | 'walking'
  ) => {
    try {
      setLoadingRoute(true);

      const profile = mode === 'walking' ? 'foot' : 'driving';
      const osrmUrl = `https://router.project-osrm.org/route/v1/${profile}/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson&steps=true`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);

      const response = await fetch(osrmUrl, { signal: controller.signal });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error('Routing server error: ' + response.status);
      }

      const data = await response.json();
      if (!data || data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('No route found between coordinates');
      }

      const route = data.routes[0];
      const distanceMeters = route.distance || 0;
      const durationSeconds = route.duration || 0;
      const rawCoordinates: [number, number][] = route.geometry?.coordinates || [];

      // Step-by-step turn directions
      const rawSteps = route.legs?.[0]?.steps || [];
      const steps: NavigationStep[] = rawSteps.map((s: any, idx: number) => {
        const isLast = idx === rawSteps.length - 1;
        return {
          instruction: formatStepInstruction(s, isLast, title || 'Destination'),
          distance: formatDistance(s.distance || 0),
          type: s.maneuver?.type || 'turn',
          modifier: s.maneuver?.modifier || '',
        };
      });

      // Calculate Bounding Box
      let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
      rawCoordinates.forEach(([lng, lat]) => {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      });

      const bounds: [number, number, number, number] = [minLng, minLat, maxLng, maxLat];

      const parsedRoute: RouteInfo = {
        distanceText: formatDistance(distanceMeters),
        durationText: formatDuration(durationSeconds),
        distanceMeters,
        durationSeconds,
        summary: route.legs?.[0]?.summary ? `via ${route.legs[0].summary}` : 'Fastest route',
        steps,
        coordinates: rawCoordinates,
        bounds,
      };

      setRouteInfo(parsedRoute);

      // I-draw ang rota sa MapLibre GL
      if (webViewRef.current) {
        const coordsJson = JSON.stringify(rawCoordinates);
        const boundsJson = JSON.stringify(bounds);
        webViewRef.current.injectJavaScript(`
          if (window.drawRoute) {
            window.drawRoute(${coordsJson}, ${boundsJson});
          }
          if (window.setUserPosition) {
            window.setUserPosition(${start.longitude}, ${start.latitude});
          }
          true;
        `);
      }
    } catch (err: any) {
      console.warn('Error calculating in-app route:', err);
    } finally {
      setLoadingRoute(false);
    }
  };

  // Live Location Tracking (In-App Navigation Mode)
  const toggleLiveTracking = async () => {
    if (isLiveTracking) {
      stopLiveTracking();
    } else {
      startLiveTracking();
    }
  };

  const startLiveTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      setIsLiveTracking(true);
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2500,
          distanceInterval: 4,
        },
        (loc) => {
          const uLat = loc.coords.latitude;
          const uLng = loc.coords.longitude;
          setUserCoords({ latitude: uLat, longitude: uLng });

          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(`
              if (window.setUserPosition) {
                window.setUserPosition(${uLng}, ${uLat});
              }
              if (window.followUser) {
                window.followUser(${uLng}, ${uLat});
              }
              true;
            `);
          }
        }
      );
      locationSubRef.current = sub;
    } catch (err) {
      console.warn('Error starting live tracking:', err);
      setIsLiveTracking(false);
    }
  };

  const stopLiveTracking = () => {
    if (locationSubRef.current) {
      locationSubRef.current.remove();
      locationSubRef.current = null;
    }
    setIsLiveTracking(false);
  };

  // Map Camera Helpers
  const handleFitRoute = () => {
    if (!routeInfo || !webViewRef.current) return;
    const boundsJson = JSON.stringify(routeInfo.bounds);
    webViewRef.current.injectJavaScript(`
      if (window.fitRouteBounds) {
        window.fitRouteBounds(${boundsJson});
      }
      true;
    `);
  };

  const handleCenterUser = () => {
    if (!userCoords || !webViewRef.current) {
      requestAndFetchUserLocation();
      return;
    }
    webViewRef.current.injectJavaScript(`
      if (window.centerUser) {
        window.centerUser(${userCoords.longitude}, ${userCoords.latitude});
      }
      true;
    `);
  };

  const handleCenterDestination = () => {
    if (!webViewRef.current) return;
    webViewRef.current.injectJavaScript(`
      if (window.centerDestination) {
        window.centerDestination();
      }
      true;
    `);
  };

  const handleToggle3D = () => {
    const nextState = !is3D;
    setIs3D(nextState);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (window.togglePitch) {
          window.togglePitch(${nextState});
        }
        true;
      `);
    }
  };

  // External OpenStreetMap backup web link
  const handleOpenExternalMaps = () => {
    const lat = destCoords.latitude;
    const lng = destCoords.longitude;

    if (lat && lng && (lat !== DEFAULT_LAT || lng !== DEFAULT_LNG)) {
      Linking.openURL(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`).catch(() => {
        Linking.openURL(`https://www.openstreetmap.org/search?query=${lat}%2C${lng}`);
      });
    } else if (address) {
      Linking.openURL(`https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`);
    }
  };

  // Helpers para sa Step Instructions & Formatting
  const formatStepInstruction = (step: any, isLast: boolean, destName: string) => {
    if (isLast || step.maneuver?.type === 'arrive') {
      return `Arrive at ${destName}`;
    }
    const street = step.name ? `onto ${step.name}` : '';
    const modifier = step.maneuver?.modifier || '';
    const type = step.maneuver?.type || '';

    if (type === 'depart') {
      return step.name ? `Head towards ${step.name}` : 'Head towards destination';
    }
    if (modifier.includes('left')) {
      return `Turn ${modifier} ${street}`.trim();
    }
    if (modifier.includes('right')) {
      return `Turn ${modifier} ${street}`.trim();
    }
    if (modifier === 'straight' || type === 'continue') {
      return `Continue straight ${street}`.trim();
    }
    if (type === 'roundabout') {
      return `Take roundabout exit ${street}`.trim();
    }
    return `${type.charAt(0).toUpperCase() + type.slice(1)} ${modifier} ${street}`.trim();
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.round(seconds / 60);
    if (mins < 60) {
      return `${mins} min${mins > 1 ? 's' : ''}`;
    }
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m`;
  };

  const getStepIcon = (modifier?: string, type?: string): keyof typeof MaterialIcons.glyphMap => {
    if (type === 'arrive') return 'flag';
    if (type === 'depart') return 'my-location';
    if (type === 'roundabout') return 'sync';

    const mod = (modifier || '').toLowerCase();
    if (mod.includes('slight right')) return 'north-east';
    if (mod.includes('slight left')) return 'north-west';
    if (mod.includes('right')) return 'turn-right';
    if (mod.includes('left')) return 'turn-left';
    if (mod.includes('straight')) return 'straight';
    if (mod.includes('uturn')) return 'u-turn-left';
    return 'navigation';
  };

  // Safe string escapes para sa JavaScript injection
  const escapedTitle = (title || 'Destination').replace(/'/g, "\\'").replace(/"/g, '\\"');
  const escapedSubtitle = (subtitle || 'Interview Venue').replace(/'/g, "\\'").replace(/"/g, '\\"');
  const escapedAddress = (address || '').replace(/'/g, "\\'").replace(/"/g, '\\"');

  // MapLibre GL HTML na may vector styles at fallback sa OSM raster tiles
  const mapLibreHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
      <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #map { width: 100%; height: 100%; overflow: hidden; background: #F8FAFC; }

        /* User GPS Pulse (Blue) */
        .user-marker-wrap {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .user-pulse {
          position: absolute;
          width: 44px;
          height: 44px;
          background: rgba(220, 38, 38, 0.28);
          border-radius: 50%;
          animation: pulse-user 2s infinite ease-out;
        }
        @keyframes pulse-user {
          0% { transform: scale(0.5); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .user-dot {
          width: 18px;
          height: 18px;
          background: #DC2626;
          border: 3px solid #FFFFFF;
          border-radius: 50%;
          box-shadow: 0 3px 8px rgba(220, 38, 38, 0.45);
          position: relative;
          z-index: 2;
        }

        /* Destination Pulse (DiskarTech Red) */
        .dest-marker-wrap {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .dest-pulse {
          position: absolute;
          width: 44px;
          height: 44px;
          background: rgba(220, 38, 38, 0.35);
          border-radius: 50%;
          bottom: 2px;
          animation: pulse-dest 1.8s infinite ease-out;
        }
        @keyframes pulse-dest {
          0% { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }

        /* Popups */
        .maplibregl-popup {
          max-width: 250px !important;
        }
        .maplibregl-popup-content {
          border-radius: 14px;
          padding: 8px 12px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: #FFFFFF;
          border: 1px solid #F1F5F9;
        }
        .popup-badge {
          display: inline-block;
          font-size: 9px;
          font-weight: 800;
          color: #DC2626;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 2px;
        }
        .popup-title {
          font-weight: 800;
          font-size: 13px;
          color: #0F172A;
          line-height: 1.2;
        }
        .popup-addr {
          font-size: 11px;
          color: #64748B;
          margin-top: 3px;
          line-height: 1.3;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var destLng = ${destCoords.longitude};
        var destLat = ${destCoords.latitude};
        var escapedTitle = "${escapedTitle}";
        var escapedSubtitle = "${escapedSubtitle}";
        var escapedAddress = "${escapedAddress}";

        // Initialize MapLibre GL na may OpenFreeMap Vector Tiles & OSM Fallback
        var map = new maplibregl.Map({
          container: 'map',
          style: 'https://tiles.openfreemap.org/styles/bright',
          center: [destLng, destLat],
          zoom: 15,
          pitch: 35,
          attributionControl: false
        });

        var userMarker = null;
        var destMarker = null;

        map.on('load', function() {
          // Setup Destination Marker
          var destEl = document.createElement('div');
          destEl.className = 'dest-marker-wrap';
          destEl.innerHTML = '<div class="dest-pulse"></div><svg width="34" height="44" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35)); position: relative; z-index: 2;"><path d="M12 0C5.37258 0 0 5.37258 0 12C0 20.5 12 32 12 32C12 32 24 20.5 24 12C24 5.37258 18.6274 0 12 0Z" fill="#DC2626"/><circle cx="12" cy="12" r="5" fill="#FFFFFF"/></svg>';

          var popupHtml = '';
          if (escapedSubtitle) {
            popupHtml += '<div class="popup-badge">' + escapedSubtitle + '</div>';
          }
          popupHtml += '<div class="popup-title">' + escapedTitle + '</div>';
          if (escapedAddress) {
            popupHtml += '<div class="popup-addr">' + escapedAddress + '</div>';
          }

          var popup = new maplibregl.Popup({ offset: [0, -34], closeButton: false })
            .setHTML(popupHtml);

          destMarker = new maplibregl.Marker({ element: destEl, anchor: 'bottom' })
            .setLngLat([destLng, destLat])
            .setPopup(popup)
            .addTo(map);

          popup.addTo(map);

          // Route Source and Layers
          map.addSource('route-source', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: []
              }
            }
          });

          // Route Casing Layer (White border for contrast)
          map.addLayer({
            id: 'route-casing',
            type: 'line',
            source: 'route-source',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#FFFFFF',
              'line-width': 8.5,
              'line-opacity': 0.95
            }
          });

          // Main Route Line Layer (DiskarTech Red)
          map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route-source',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#DC2626',
              'line-width': 5.5,
              'line-opacity': 1.0
            }
          });
        });

        // Automatic fallback kung may issue sa vector tile server
        map.on('error', function(e) {
          if (e && e.error && e.error.message && e.error.message.includes('style')) {
            map.setStyle({
              version: 8,
              sources: {
                'osm-raster': {
                  type: 'raster',
                  tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                  tileSize: 256
                }
              },
              layers: [{ id: 'osm-raster-layer', type: 'raster', source: 'osm-raster' }]
            });
          }
        });

        // Window Methods accessible via injectJavaScript
        window.setUserPosition = function(lng, lat) {
          if (!userMarker) {
            var userEl = document.createElement('div');
            userEl.className = 'user-marker-wrap';
            userEl.innerHTML = '<div class="user-pulse"></div><div class="user-dot"></div>';
            userMarker = new maplibregl.Marker({ element: userEl })
              .setLngLat([lng, lat])
              .addTo(map);
          } else {
            userMarker.setLngLat([lng, lat]);
          }
        };

        window.setDestinationPosition = function(lng, lat) {
          destLng = lng;
          destLat = lat;
          if (destMarker) {
            destMarker.setLngLat([lng, lat]);
          }
        };

        window.drawRoute = function(coords, bounds) {
          if (map.getSource('route-source')) {
            map.getSource('route-source').setData({
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: coords
              }
            });
          }
          if (bounds && bounds.length === 4) {
            map.fitBounds([
              [bounds[0], bounds[1]],
              [bounds[2], bounds[3]]
            ], {
              padding: { top: 90, bottom: 270, left: 45, right: 45 },
              pitch: 35,
              maxZoom: 17,
              duration: 1000
            });
          }
        };

        window.fitRouteBounds = function(bounds) {
          if (bounds && bounds.length === 4) {
            map.fitBounds([
              [bounds[0], bounds[1]],
              [bounds[2], bounds[3]]
            ], {
              padding: { top: 90, bottom: 270, left: 45, right: 45 },
              pitch: 35,
              maxZoom: 17,
              duration: 1000
            });
          }
        };

        window.centerDestination = function() {
          map.flyTo({ center: [destLng, destLat], zoom: 16, pitch: 35, duration: 900 });
        };

        window.centerUser = function(lng, lat) {
          map.flyTo({ center: [lng, lat], zoom: 16, pitch: 35, duration: 900 });
        };

        window.followUser = function(lng, lat) {
          map.easeTo({ center: [lng, lat], zoom: 16, duration: 1200 });
        };

        window.togglePitch = function(enable3D) {
          map.easeTo({ pitch: enable3D ? 45 : 0, duration: 700 });
        };
      </script>
    </body>
    </html>
  `;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        {/* Top Header */}
        <View 
          className="px-5 pt-12 pb-3.5 border-b flex-row items-center justify-between z-10 shadow-sm"
          style={{ backgroundColor: colors.surface, borderBottomColor: colors.border }}
        >
          <View className="flex-row items-center gap-3 flex-1 mr-2">
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              className="w-10 h-10 items-center justify-center"
            >
              <MaterialIcons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-base font-bold" style={{ color: colors.text }} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text className="text-xs text-red-600 font-semibold" numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Travel Mode Switcher (Driving vs Walking) */}
          <View 
            className="flex-row items-center p-1 rounded-2xl border"
            style={{ 
              backgroundColor: isDark ? colors.background : '#F1F5F9',
              borderColor: colors.border
            }}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setTravelMode('driving')}
              className="px-3 py-1.5 rounded-xl flex-row items-center gap-1"
              style={{ backgroundColor: travelMode === 'driving' ? '#DC2626' : 'transparent' }}
            >
              <MaterialIcons
                name="directions-car"
                size={16}
                color={travelMode === 'driving' ? '#FFFFFF' : colors.textSecondary}
              />
              <Text
                className="text-xs font-bold"
                style={{ color: travelMode === 'driving' ? '#FFFFFF' : colors.textSecondary }}
              >
                Drive
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setTravelMode('walking')}
              className="px-3 py-1.5 rounded-xl flex-row items-center gap-1"
              style={{ backgroundColor: travelMode === 'walking' ? '#DC2626' : 'transparent' }}
            >
              <MaterialIcons
                name="directions-walk"
                size={16}
                color={travelMode === 'walking' ? '#FFFFFF' : colors.textSecondary}
              />
              <Text
                className="text-xs font-bold"
                style={{ color: travelMode === 'walking' ? '#FFFFFF' : colors.textSecondary }}
              >
                Walk
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Map Container rendered via MapLibre GL */}
        <View className="flex-1 relative bg-slate-100">
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: mapLibreHTML }}
            style={{ flex: 1 }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View className="absolute inset-0 items-center justify-center bg-slate-50 z-30">
                <ActivityIndicator size="large" color="#DC2626" />
                <Text className="text-xs text-slate-500 mt-2 font-medium">
                  Loading In-App Map...
                </Text>
              </View>
            )}
          />

          {/* Floating Indicators */}
          {(resolvingCoords || locatingUser || loadingRoute) && (
            <View 
              className="absolute top-4 self-center px-4 py-2 rounded-full border flex-row items-center gap-2 shadow-md z-20"
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            >
              <ActivityIndicator size="small" color="#DC2626" />
              <Text className="text-xs font-semibold" style={{ color: colors.text }}>
                {resolvingCoords
                  ? 'Finding venue location...'
                  : locatingUser
                    ? 'Getting your GPS position...'
                    : 'Calculating live in-app route...'}
              </Text>
            </View>
          )}

          {/* Live Navigation Active Pill */}
          {isLiveTracking && (
            <View className="absolute top-4 left-4 bg-emerald-600 px-3.5 py-1.5 rounded-full flex-row items-center gap-1.5 shadow-md z-20">
              <View className="w-2.5 h-2.5 rounded-full bg-white" />
              <Text className="text-xs font-bold text-white uppercase tracking-wider">
                Live Navigation Active
              </Text>
            </View>
          )}

          {/* Floating Map Controls on Right Side */}
          <View className="absolute top-4 right-4 gap-2.5 z-20">
            {/* 3D / 2D Perspective Toggle */}
            <TouchableOpacity
              onPress={handleToggle3D}
              activeOpacity={0.8}
              className="w-11 h-11 rounded-2xl items-center justify-center shadow-md border"
              style={{
                backgroundColor: is3D ? '#DC2626' : colors.surface,
                borderColor: is3D ? '#B91C1C' : colors.border,
              }}
            >
              <Text
                className="text-xs font-extrabold"
                style={{ color: is3D ? '#FFFFFF' : colors.text }}
              >
                3D
              </Text>
            </TouchableOpacity>

            {/* Fit Entire Route */}
            {routeInfo && (
              <TouchableOpacity
                onPress={handleFitRoute}
                activeOpacity={0.8}
                className="w-11 h-11 rounded-2xl items-center justify-center shadow-md border"
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              >
                <MaterialIcons name="alt-route" size={20} color={colors.accent} />
              </TouchableOpacity>
            )}

            {/* Recenter Destination */}
            <TouchableOpacity
              onPress={handleCenterDestination}
              activeOpacity={0.8}
              className="w-11 h-11 rounded-2xl items-center justify-center shadow-md border"
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            >
              <MaterialIcons name="place" size={22} color={colors.accent} />
            </TouchableOpacity>

            {/* Recenter to My Location */}
            <TouchableOpacity
              onPress={handleCenterUser}
              activeOpacity={0.8}
              className="w-11 h-11 rounded-2xl items-center justify-center shadow-md border"
              style={{ 
                backgroundColor: userCoords ? colors.surface : (isDark ? colors.background : '#F1F5F9'),
                borderColor: colors.border
              }}
            >
              <MaterialIcons
                name="my-location"
                size={20}
                color={userCoords ? '#DC2626' : colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom In-App Directions Dashboard */}
        <View 
          className="border-t shadow-xl"
          style={{ backgroundColor: colors.surface, borderTopColor: colors.border }}
        >
          <View className="p-4">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-1 mr-3">
                <Text className="text-[11px] font-bold text-red-600 uppercase tracking-wider">
                  {subtitle || 'Interview Venue'}
                </Text>
                <Text className="text-base font-bold mt-0.5 leading-snug" style={{ color: colors.text }} numberOfLines={1}>
                  {title}
                </Text>
                <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }} numberOfLines={1}>
                  {address || 'Location provided upon hiring'}
                </Text>
              </View>

              {/* Route ETA / Distance Badge */}
              {routeInfo ? (
                <View 
                  className="px-3.5 py-2 rounded-2xl items-end border"
                  style={{
                    backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEF2F2',
                    borderColor: isDark ? 'rgba(220, 38, 38, 0.3)' : '#FEE2E2',
                  }}
                >
                  <Text className="text-lg font-black text-red-600 leading-none">
                    {routeInfo.durationText}
                  </Text>
                  <Text className="text-[11px] font-bold mt-0.5" style={{ color: colors.textSecondary }}>
                    {routeInfo.distanceText} • {travelMode === 'driving' ? 'Drive' : 'Walk'}
                  </Text>
                </View>
              ) : loadingRoute ? (
                <View 
                  className="px-3 py-2 rounded-2xl items-center justify-center"
                  style={{ backgroundColor: isDark ? colors.background : '#F8FAFC' }}
                >
                  <ActivityIndicator size="small" color="#DC2626" />
                  <Text className="text-[10px] mt-1 font-semibold" style={{ color: colors.textSecondary }}>Routing...</Text>
                </View>
              ) : null}
            </View>

            {/* Next Turn / Step Preview Banner */}
            {routeInfo && routeInfo.steps.length > 0 && (
              <TouchableOpacity
                onPress={() => setShowStepsList(true)}
                activeOpacity={0.8}
                className="rounded-2xl p-3 flex-row items-center justify-between mb-3 border"
                style={{
                  backgroundColor: isDark ? colors.background : '#F8FAFC',
                  borderColor: colors.border
                }}
              >
                <View className="flex-row items-center gap-2.5 flex-1 mr-2">
                  <View 
                    className="w-8 h-8 rounded-xl items-center justify-center"
                    style={{ backgroundColor: isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEE2E2' }}
                  >
                    <MaterialIcons
                      name={getStepIcon(routeInfo.steps[0].modifier, routeInfo.steps[0].type)}
                      size={18}
                      color={colors.accent}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-bold" style={{ color: colors.text }} numberOfLines={1}>
                      {routeInfo.steps[0].instruction}
                    </Text>
                    <Text className="text-[10px] font-medium" style={{ color: colors.textSecondary }}>
                      Next step in {routeInfo.steps[0].distance}
                    </Text>
                  </View>
                </View>

                <View 
                  className="flex-row items-center gap-1 px-2 py-1 rounded-lg border"
                  style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                >
                  <Text className="text-[10px] font-bold text-red-600">
                    {routeInfo.steps.length} Steps
                  </Text>
                  <MaterialIcons name="chevron-right" size={14} color={colors.accent} />
                </View>
              </TouchableOpacity>
            )}

            {/* Permission Prompt if location is disabled */}
            {locationPermissionGranted === false && (
              <TouchableOpacity
                onPress={requestAndFetchUserLocation}
                activeOpacity={0.8}
                className="rounded-2xl p-2.5 mb-3 flex-row items-center justify-between border"
                style={{
                  backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEF2F2',
                  borderColor: isDark ? 'rgba(220, 38, 38, 0.3)' : '#FECACA'
                }}
              >
                <View className="flex-row items-center gap-2 flex-1 mr-2">
                  <MaterialIcons name="location-off" size={18} color={colors.accent} />
                  <Text className="text-xs font-medium flex-1" style={{ color: colors.text }}>
                    GPS disabled. Enable location to see live directions from your spot.
                  </Text>
                </View>
                <Text className="text-xs font-bold text-red-600 underline">Enable</Text>
              </TouchableOpacity>
            )}

            {/* Bottom Action Buttons Row */}
            <View className="flex-row items-center gap-2.5">
              {/* Primary: In-App Live Navigation Button */}
              <TouchableOpacity
                onPress={toggleLiveTracking}
                activeOpacity={0.85}
                className="flex-1 py-3.5 px-4 rounded-2xl flex-row items-center justify-center gap-2 shadow-sm"
                style={{ backgroundColor: isLiveTracking ? '#991B1B' : '#DC2626' }}
              >
                <MaterialIcons
                  name={isLiveTracking ? 'navigation' : 'near-me'}
                  size={20}
                  color="white"
                />
                <Text className="text-white font-bold text-sm">
                  {isLiveTracking ? 'Stop In-App Navigation' : 'Start In-App Navigation'}
                </Text>
              </TouchableOpacity>

              {/* View All Steps Button */}
              {routeInfo && routeInfo.steps.length > 0 && (
                <TouchableOpacity
                  onPress={() => setShowStepsList(true)}
                  className="w-12 h-12 rounded-2xl items-center justify-center border"
                  style={{
                    backgroundColor: isDark ? colors.background : '#F1F5F9',
                    borderColor: colors.border
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="format-list-numbered" size={22} color={colors.text} />
                </TouchableOpacity>
              )}

              {/* Secondary Google Maps Backup */}
              <TouchableOpacity
                onPress={handleOpenExternalMaps}
                className="w-12 h-12 rounded-2xl items-center justify-center border"
                style={{
                  backgroundColor: isDark ? colors.background : '#F1F5F9',
                  borderColor: colors.border
                }}
                activeOpacity={0.8}
              >
                <MaterialIcons name="open-in-new" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Turn-by-Turn Steps Modal / Drawer */}
        <Modal
          visible={showStepsList}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowStepsList(false)}
        >
          <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)' }}>
            <View 
              className="rounded-t-3xl max-h-[75%] p-5 shadow-2xl"
              style={{ backgroundColor: colors.surface }}
            >
              {/* Header */}
              <View 
                className="flex-row items-center justify-between pb-3 border-b"
                style={{ borderBottomColor: colors.border }}
              >
                <View>
                  <Text className="text-base font-bold" style={{ color: colors.text }}>
                    Turn-by-Turn Directions
                  </Text>
                  <Text className="text-xs text-red-600 font-semibold mt-0.5">
                    {routeInfo?.durationText} • {routeInfo?.distanceText} ({routeInfo?.summary})
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowStepsList(false)}
                  activeOpacity={0.7}
                  className="w-8 h-8 rounded-full items-center justify-center"
                  style={{ backgroundColor: isDark ? colors.background : '#F1F5F9' }}
                >
                  <MaterialIcons name="close" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Steps ScrollView */}
              <ScrollView showsVerticalScrollIndicator={false} className="mt-3">
                {routeInfo?.steps.map((step, idx) => {
                  const isLast = idx === routeInfo.steps.length - 1;
                  return (
                    <View key={idx} className="flex-row items-start gap-3.5 mb-4">
                      {/* Step Icon with Vertical connector line */}
                      <View className="items-center">
                        <View
                          className="w-9 h-9 rounded-2xl items-center justify-center border"
                          style={{
                            backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEF2F2',
                            borderColor: isLast ? '#F87171' : (isDark ? 'rgba(220, 38, 38, 0.3)' : '#FECACA'),
                          }}
                        >
                          <MaterialIcons
                            name={getStepIcon(step.modifier, step.type)}
                            size={18}
                            color={colors.accent}
                          />
                        </View>
                        {!isLast && (
                          <View 
                            className="w-0.5 h-6 my-1 rounded-full" 
                            style={{ backgroundColor: colors.border }}
                          />
                        )}
                      </View>

                      {/* Step Description */}
                      <View className="flex-1 pt-1">
                        <Text className="text-sm font-bold leading-snug" style={{ color: colors.text }}>
                          {step.instruction}
                        </Text>
                        <Text className="text-xs font-medium mt-0.5" style={{ color: colors.textSecondary }}>
                          {step.distance}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Close Button */}
              <TouchableOpacity
                onPress={() => setShowStepsList(false)}
                activeOpacity={0.8}
                className="mt-3 py-3 bg-red-600 rounded-2xl items-center justify-center shadow-sm"
              >
                <Text className="text-white font-bold text-sm">Close Directions</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}
