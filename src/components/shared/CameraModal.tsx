import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, X, Check, RefreshCw, ScanLine } from 'lucide-react';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64Image: string) => void;
  title?: string;
  hint?: string;
  showScanLine?: boolean;
  autoLive?: boolean;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title = "Scan Product",
  hint = "Position product in frame",
  showScanLine = true,
  autoLive = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [isLive, setIsLive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsLive(false);
    setIsVideoReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera(); // Ensure previous stream is stopped
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Camera is not available. Please use HTTPS or check browser permissions.");
        return;
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError('');
    } catch (err) {
      console.error("Camera access denied:", err);
      setError("Unable to access camera. Please check permissions.");
    }
  }, [stopCamera]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setIsLive(false);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Auto-start live scanning when autoLive is set and video is ready
  useEffect(() => {
    if (autoLive && isOpen && isVideoReady && !isLive) {
      setIsLive(true);
    }
  }, [autoLive, isOpen, isVideoReady]);

  const captureImage = useCallback((closeOnCapture = true) => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      // Guard: don't capture if video stream isn't ready
      if (!context || video.videoWidth === 0 || video.videoHeight === 0) {
        console.warn('Camera not ready yet, skipping capture');
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);

      if (!closeOnCapture) {
        setIsProcessing(true);
        setTimeout(() => setIsProcessing(false), 2000);
      }

      onCapture(imageBase64);

      if (closeOnCapture) {
        onClose();
      }
    }
  }, [onCapture, onClose]);

  // Handle Live Scan (Auto-capture)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLive && isOpen) {
      interval = setInterval(() => {
        captureImage(false);
      }, 4000); // Capture every 4 seconds to balance speed vs cost
    }
    return () => clearInterval(interval);
  }, [isLive, isOpen, captureImage]);

  if (!isOpen) return null;

  return (
    <div className="fixed top-4 right-4 z-[150] w-[260px] animate-fade-in" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
      <div className="rounded-2xl overflow-hidden flex flex-col relative shadow-2xl bg-white/95 backdrop-blur-xl border border-white/60 ring-1 ring-black/5">
        {/* Compact Header */}
        <div className="px-3 py-2.5 flex justify-between items-center border-b border-slate-100 bg-white/80">
          <h3 className="font-bold text-slate-800 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
            <ScanLine className={`w-3.5 h-3.5 ${isLive ? 'text-emerald-500' : 'text-amber-600'}`} />
            {isLive ? 'Live Scan' : title}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Compact Camera Preview */}
        <div className="relative bg-black aspect-square flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="text-white text-center p-4">
              <p className="mb-3 text-xs">{error}</p>
              <button onClick={startCamera} className="px-3 py-1.5 bg-white/20 rounded-full hover:bg-white/30 transition text-xs">
                Retry
              </button>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={() => setIsVideoReady(true)}
              className="w-full h-full object-cover"
            />
          )}

          {/* Scanning Overlay */}
          {!error && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className={`w-[85%] h-[85%] border-2 transition-colors duration-500 rounded-lg relative ${isLive ? 'border-emerald-400/70' : 'border-amber-400/70'}`}>
                {/* Corners */}
                <div className={`absolute top-0 left-0 w-3 h-3 border-t-[3px] border-l-[3px] -mt-0.5 -ml-0.5 ${isLive ? 'border-emerald-500' : 'border-amber-500'}`}></div>
                <div className={`absolute top-0 right-0 w-3 h-3 border-t-[3px] border-r-[3px] -mt-0.5 -mr-0.5 ${isLive ? 'border-emerald-500' : 'border-amber-500'}`}></div>
                <div className={`absolute bottom-0 left-0 w-3 h-3 border-b-[3px] border-l-[3px] -mb-0.5 -ml-0.5 ${isLive ? 'border-emerald-500' : 'border-amber-500'}`}></div>
                <div className={`absolute bottom-0 right-0 w-3 h-3 border-b-[3px] border-r-[3px] -mb-0.5 -mr-0.5 ${isLive ? 'border-emerald-500' : 'border-amber-500'}`}></div>

                {/* Scan line animation */}
                {showScanLine && (
                  <div className={`absolute left-0 right-0 h-0.5 shadow-[0_0_10px_rgba(99,102,241,0.8)] animate-[scan_2s_ease-in-out_infinite] ${isLive ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                )}

                {/* Processing Spinner */}
                {isProcessing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                    <RefreshCw className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
              </div>
              <p className="mt-3 text-white/80 text-[10px] font-bold bg-black/40 px-3 py-1 rounded-full backdrop-blur-md uppercase tracking-wider">
                {isLive ? 'Auto-scanning...' : hint}
              </p>
            </div>
          )}
        </div>

        {/* Compact Controls */}
        <div className="px-3 py-2.5 bg-white/90 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={() => setIsLive(!isLive)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${isLive
              ? 'bg-emerald-100 text-emerald-700 shadow-inner'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
            {isLive ? 'LIVE' : 'LIVE'}
          </button>

          <button
            onClick={() => captureImage(true)}
            disabled={isLive || !isVideoReady}
            className={`w-10 h-10 rounded-full border-[3px] flex items-center justify-center shadow-md transition-all ${isLive || !isVideoReady
              ? 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed'
              : 'bg-white border-amber-100 hover:scale-110 active:scale-95'
              }`}
          >
            <div className={`w-7 h-7 rounded-full ${isLive || !isVideoReady ? 'bg-slate-300' : 'bg-amber-600'}`}></div>
          </button>

          <div className="w-12"></div>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
      <style>{`
        @keyframes scan {
          0% { top: 10%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};
