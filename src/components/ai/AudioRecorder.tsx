import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, Upload, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface AudioRecorderProps {
    onRecordingComplete: (file: File) => void;
    isProcessing?: boolean;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onRecordingComplete, isProcessing }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | null>(null);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    useEffect(() => {
        return () => {
            stopTimer();
            cancelAnimationFrame(animationFrameRef.current!);
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const startTimer = () => {
        stopTimer();
        setRecordingTime(0);
        timerRef.current = window.setInterval(() => {
            setRecordingTime(prev => prev + 1);
        }, 1000);
    };

    const stopTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const visualize = (stream: MediaStream) => {
        if (!canvasRef.current) return;

        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        const audioCtx = audioContextRef.current;
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const analyser = audioCtx.createAnalyser();
        analyserRef.current = analyser;
        analyser.fftSize = 256;

        const source = audioCtx.createMediaStreamSource(stream);
        sourceRef.current = source;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const canvas = canvasRef.current;
        const canvasCtx = canvas.getContext('2d');

        if (!canvasCtx) return;

        const draw = () => {
            animationFrameRef.current = requestAnimationFrame(draw);

            analyser.getByteFrequencyData(dataArray);

            canvasCtx.fillStyle = 'rgb(249, 250, 251)'; // bg-gray-50 matches
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 2;

                const gradient = canvasCtx.createLinearGradient(0, 0, 0, canvas.height);
                gradient.addColorStop(0, '#ed4618'); // Peach-600
                gradient.addColorStop(1, '#ff8563'); // Peach-400

                canvasCtx.fillStyle = gradient;
                canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

                x += barWidth + 1;
            }
        };

        draw();
    };

    const startRecording = async () => {
        setError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            visualize(stream);

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' }); // Verify MIME support
                setAudioBlob(audioBlob);

                // Stop all tracks to release microphone
                stream.getTracks().forEach(track => track.stop());

                // Stop visualization
                if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
                if (sourceRef.current) sourceRef.current.disconnect();
            };

            mediaRecorder.start();
            setIsRecording(true);
            startTimer();
        } catch (err) {
            console.error('Error accessing microphone:', err);
            setError('Could not access microphone. Please check permissions.');
            toast.error('Microphone access denied');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            stopTimer();
        }
    };

    const deleteRecording = () => {
        setAudioBlob(null);
        setRecordingTime(0);
        setError(null);
        if (audioPlayerRef.current) {
            audioPlayerRef.current.src = '';
        }
    };

    const togglePlayback = () => {
        if (audioPlayerRef.current) {
            if (isPlaying) {
                audioPlayerRef.current.pause();
            } else {
                audioPlayerRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleUpload = () => {
        if (audioBlob) {
            const file = new File([audioBlob], `recording-${Date.now()}.mp3`, { type: audioBlob.type });
            onRecordingComplete(file);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type.startsWith('audio/')) {
                onRecordingComplete(file);
            } else {
                toast.error('Please upload a valid audio file');
            }
        }
    };

    return (
        <div className="flex flex-col items-center bg-white rounded-2xl border border-slate-200 p-6 shadow-sm w-full max-w-md mx-auto">
            <div className="w-full flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-slate-800">Record Consultation</h3>
                {isRecording && (
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                        <span className="text-red-500 font-medium font-mono">{formatTime(recordingTime)}</span>
                    </div>
                )}
            </div>

            {error && (
                <div className="w-full mb-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}

            {/* Visualization Canvas */}
            <div className="w-full h-32 bg-gray-50 rounded-lg overflow-hidden mb-6 border border-slate-100 relative">
                {!isRecording && !audioBlob && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                        Waveform visualization
                    </div>
                )}
                <canvas
                    ref={canvasRef}
                    width="400"
                    height="128"
                    className="w-full h-full object-cover"
                />
            </div>

            {/* Controls */}
            <div className="flex gap-4 items-center">
                {!audioBlob ? (
                    !isRecording ? (
                        <div className="flex flex-col gap-4 items-center w-full">
                            <button
                                onClick={startRecording}
                                className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
                            >
                                <Mic className="w-8 h-8" />
                            </button>
                            <div className="relative">
                                <input
                                    type="file"
                                    accept="audio/*"
                                    className="hidden"
                                    id="audio-upload"
                                    onChange={handleFileUpload}
                                />
                                <label
                                    htmlFor="audio-upload"
                                    className="text-sm text-amber-600 hover:text-amber-700 cursor-pointer flex items-center gap-1"
                                >
                                    <Upload className="w-4 h-4" /> Or upload audio file
                                </label>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={stopRecording}
                            className="h-16 w-16 rounded-full bg-slate-800 hover:bg-slate-900 flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105 active:scale-95 animate-pulse"
                        >
                            <Square className="w-6 h-6 fill-current" />
                        </button>
                    )
                ) : (
                    <div className="w-full flex flex-col gap-4">
                        <audio
                            ref={audioPlayerRef}
                            src={window.URL.createObjectURL(audioBlob)}
                            onEnded={() => setIsPlaying(false)}
                            className="hidden"
                        />

                        <div className="flex items-center justify-between w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={togglePlayback}
                                    className="p-3 rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50 text-slate-700"
                                >
                                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                                </button>
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-slate-700">Recording.mp3</span>
                                    <span className="text-xs text-slate-500">{formatTime(recordingTime)}</span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={deleteRecording}
                                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                    title="Delete"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={handleUpload}
                            disabled={isProcessing}
                            className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-600 text-white rounded-xl font-medium shadow-md hover:from-amber-700 hover:to-amber-700 transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isProcessing ? (
                                <>
                                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                    Transcribing...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-5 h-5" />
                                    Process Recording
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
