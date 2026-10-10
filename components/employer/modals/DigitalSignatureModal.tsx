import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useDarkMode } from '@/hooks/useDarkMode';
import NotificationModal from '@/components/ui/modals/NotificationModal';

interface DigitalSignatureModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (signatureBase64: string) => void;
  studentName?: string;
  jobTitle?: string;
  signerName?: string;
  loading?: boolean;
  notification?: React.ReactNode;
}

export default function DigitalSignatureModal({
  visible,
  onClose,
  onSubmit,
  studentName = 'the student',
  jobTitle = 'Working Student Position',
  loading = false,
  notification,
}: DigitalSignatureModalProps) {
  const { isDark, colors } = useDarkMode();
  const webViewRef = useRef<WebView>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [noticeVisible, setNoticeVisible] = useState(false);

  // Reset when modal opens or closes
  useEffect(() => {
    setNoticeVisible(false);
    if (visible) {
      setSignatureData(null);
      setHasDrawn(false);
      setTimeout(() => {
        webViewRef.current?.injectJavaScript('window.clearCanvas && window.clearCanvas(); true;');
      }, 300);
    }
  }, [visible]);

  const canvasHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
    }
    html, body {
      width: 100%;
      height: 100%;
      min-height: 210px;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #FFFFFF;
      touch-action: none;
    }
    #canvas-container {
      position: relative;
      width: 100%;
      height: 210px;
      min-height: 210px;
      background: #FFFFFF;
      overflow: hidden;
    }
    canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 210px;
      min-height: 210px;
      display: block;
      background: #FFFFFF;
      touch-action: none;
    }
    .baseline {
      position: absolute;
      bottom: 38px;
      left: 20px;
      right: 20px;
      border-bottom: 1.5px dashed #CBD5E1;
      pointer-events: none;
    }
    .baseline-label {
      position: absolute;
      bottom: 12px;
      left: 20px;
      font-size: 11px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #94A3B8;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="canvas-container">
    <canvas id="sigCanvas"></canvas>
    <div class="baseline"></div>
    <div class="baseline-label">Sign above this line ✍️</div>
  </div>

  <script>
    const canvas = document.getElementById('sigCanvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('canvas-container');

    let isDrawing = false;
    let hasDrawn = false;
    let lastX = 0;
    let lastY = 0;

    function getDpr() {
      return Math.max(window.devicePixelRatio || 1, 2);
    }

    function resize() {
      const dpr = getDpr();
      const rect = container.getBoundingClientRect();
      const width = rect.width || window.innerWidth || 340;
      const height = rect.height || 210;

      let saved = null;
      if (canvas.width > 0 && hasDrawn) {
        saved = canvas.toDataURL('image/png');
      }

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';

      ctx.scale(dpr, dpr);
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2.8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (saved) {
        const img = new Image();
        img.onload = function() {
          ctx.drawImage(img, 0, 0, width, height);
        };
        img.src = saved;
      }
    }

    window.addEventListener('resize', resize);
    window.addEventListener('load', function() {
      setTimeout(resize, 80);
    });
    setTimeout(resize, 40);

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    }

    function start(e) {
      e.preventDefault();
      isDrawing = true;
      hasDrawn = true;
      const pos = getPos(e);
      lastX = pos.x;
      lastY = pos.y;
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
    }

    function draw(e) {
      if (!isDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastX = pos.x;
      lastY = pos.y;
    }

    function stop(e) {
      if (!isDrawing) return;
      isDrawing = false;
      ctx.closePath();
      notify();
    }

    function clearCanvas() {
      const dpr = getDpr();
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      hasDrawn = false;
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CLEAR' }));
      }
    }

    function notify() {
      if (!hasDrawn) return;
      try {
        const dataUrl = canvas.toDataURL('image/png');
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SIGNATURE', data: dataUrl }));
        }
      } catch (err) {}
    }

    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stop, { passive: false });

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stop);

    document.addEventListener('touchmove', function(e) {
      if (e.target === canvas) e.preventDefault();
    }, { passive: false });

    window.clearCanvas = clearCanvas;
    window.resize = resize;
  </script>
</body>
</html>
  `;

  const handleMessage = (event: any) => {
    try {
      const parsed = JSON.parse(event.nativeEvent.data);
      if (parsed.type === 'SIGNATURE') {
        setSignatureData(parsed.data);
        setHasDrawn(true);
      } else if (parsed.type === 'CLEAR') {
        setSignatureData(null);
        setHasDrawn(false);
      }
    } catch (err) {
      console.error('Error handling signature message:', err);
    }
  };

  const handleClear = () => {
    setSignatureData(null);
    setHasDrawn(false);
    webViewRef.current?.injectJavaScript('window.clearCanvas(); true;');
  };

  const handleConfirm = () => {
    if (loading) return;
    if (!hasDrawn || !signatureData) {
      setNoticeVisible(true);
      return;
    }

    onSubmit(signatureData);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => { if (!loading) onClose(); }}
    >
      <View className="flex-1 justify-center items-center px-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)' }}>
        <View 
          className="rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          {/* Header */}
          <View className="p-5 pb-3 border-b flex-row items-center justify-between" style={{ borderColor: colors.border }}>
            <View className="flex-row items-center gap-3">
              <View 
                className="w-10 h-10 rounded-2xl items-center justify-center border"
                style={{ 
                  backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEF2F2',
                  borderColor: isDark ? 'rgba(220, 38, 38, 0.3)' : '#FEE2E2'
                }}
              >
                <MaterialIcons name="draw" size={22} color={colors.accent} />
              </View>
              <View>
                <Text className="text-base font-bold" style={{ color: colors.text }}>Sign Certificate</Text>
                <Text className="text-xs" style={{ color: colors.textSecondary }}>Employer Digital Signature</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              disabled={loading}
              className="w-8 h-8 rounded-full items-center justify-center"
              style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }}
            >
              <MaterialIcons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Description */}
          <View className="px-5 pt-3 pb-2">
            <Text className="text-xs leading-relaxed" style={{ color: colors.textSecondary }}>
              Please sign below using your finger to officially certify that <Text className="font-bold" style={{ color: colors.text }}>{studentName}</Text> rendered working student service for <Text className="font-bold" style={{ color: colors.text }}>{jobTitle}</Text>.
            </Text>
          </View>

          {/* Signature Canvas Pad */}
          <View className="px-5 py-2">
            <View
              style={{
                width: '100%',
                height: 210,
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : '#CBD5E1',
                overflow: 'hidden',
                backgroundColor: '#FFFFFF',
              }}
            >
              <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: canvasHtml }}
                onMessage={handleMessage}
                scrollEnabled={false}
                bounces={false}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                style={{
                  width: '100%',
                  height: 210,
                  backgroundColor: '#FFFFFF',
                }}
                containerStyle={{
                  width: '100%',
                  height: 210,
                  backgroundColor: '#FFFFFF',
                }}
              />
            </View>

            {/* Status & Clear Button */}
            <View className="flex-row justify-between items-center mt-2.5 px-1">
              <View className="flex-row items-center gap-1.5">
                <MaterialIcons
                  name={hasDrawn ? 'check-circle' : 'fingerprint'}
                  size={16}
                  color={hasDrawn ? '#059669' : colors.textSecondary}
                />
                <Text
                  className="text-xs font-semibold"
                  style={{ color: hasDrawn ? (isDark ? '#34D399' : '#047857') : colors.textSecondary }}
                >
                  {hasDrawn ? 'Signature captured' : 'Use your finger to sign'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleClear}
                disabled={loading}
                className="flex-row items-center gap-1 py-1.5 px-3 rounded-lg border"
                style={{ 
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                  borderColor: colors.border
                }}
              >
                <MaterialIcons name="refresh" size={14} color={colors.textSecondary} />
                <Text className="text-xs font-semibold" style={{ color: colors.text }}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer Actions */}
          <View className="p-5 pt-3 flex-row gap-3">
            <TouchableOpacity
              onPress={onClose}
              disabled={loading}
              className="flex-1 py-3.5 rounded-2xl items-center justify-center border"
              style={{ 
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                borderColor: colors.border
              }}
            >
              <Text className="text-sm font-bold" style={{ color: colors.text }}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleConfirm}
              disabled={loading || !hasDrawn}
              style={{ backgroundColor: hasDrawn ? '#DC2626' : (isDark ? 'rgba(220, 38, 38, 0.4)' : '#FCA5A5') }}
              className="flex-1 py-3.5 rounded-2xl items-center justify-center flex-row gap-1.5 shadow-sm active:opacity-90"
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="verified" size={18} color="#FFFFFF" />
                  <Text className="text-sm font-bold text-white">Confirm & Issue</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

        </View>
      </View>
      {notification}
      <NotificationModal
        visible={visible && noticeVisible}
        title="Signature Required"
        message="Please sign on the signature pad using your finger before issuing the Certificate of Employment."
        iconName="draw"
        onPrimaryPress={() => setNoticeVisible(false)}
      />
    </Modal>
  );
}
