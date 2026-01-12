'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Mic, MicOff } from 'lucide-react';
import clsx from 'clsx';

// Minimal WebRTC Peer wrapper
class Peer {
    public connection: RTCPeerConnection;
    public stream: MediaStream | null = null;
    public onStream: ((stream: MediaStream) => void) | null = null;
    private iceQueue: RTCIceCandidate[] = [];
    private isRemoteSet = false;

    constructor(
        public id: string,
        initiator: boolean,
        stream: MediaStream,
        emitSignal: (signal: any) => void
    ) {
        this.connection = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        this.connection.onicecandidate = (event) => {
            if (event.candidate) {
                emitSignal({ candidate: event.candidate });
            }
        };

        this.connection.oniceconnectionstatechange = () => {
            console.log(`[Peer ${id}] ICE State: ${this.connection.iceConnectionState}`);
        };

        this.connection.ontrack = (event) => {
            console.log(`[Peer ${id}] Received Remote Stream`);
            if (this.onStream) this.onStream(event.streams[0]);
        };

        stream.getTracks().forEach(track => {
            this.connection.addTrack(track, stream);
        });

        if (initiator) {
            this.createOffer(emitSignal);
        }
    }

    async createOffer(emitSignal: (signal: any) => void) {
        try {
            const offer = await this.connection.createOffer();
            await this.connection.setLocalDescription(offer);
            emitSignal({ sdp: offer });
        } catch (e) {
            console.error("Error creating offer:", e);
        }
    }

    async signal(data: any) {
        try {
            if (data.sdp) {
                console.log(`[Peer ${this.id}] Setting Remote Description (${data.sdp.type})`);
                await this.connection.setRemoteDescription(new RTCSessionDescription(data.sdp));
                this.isRemoteSet = true;
                this.processIceQueue();

                if (data.sdp.type === 'offer') {
                    const answer = await this.connection.createAnswer();
                    await this.connection.setLocalDescription(answer);
                    return { sdp: answer };
                }
            } else if (data.candidate) {
                const candidate = new RTCIceCandidate(data.candidate);
                if (this.isRemoteSet) {
                    if (this.connection.signalingState !== 'closed') {
                        await this.connection.addIceCandidate(candidate);
                    }
                } else {
                    console.log(`[Peer ${this.id}] Queueing ICE candidate`);
                    this.iceQueue.push(candidate);
                }
            }
        } catch (e) {
            console.error(`[Peer ${this.id}] Signaling Error:`, e);
        }
        return null;
    }

    private async processIceQueue() {
        for (const candidate of this.iceQueue) {
            try {
                if (this.connection.signalingState !== 'closed') {
                    await this.connection.addIceCandidate(candidate);
                }
            } catch (e) {
                console.error(`[Peer ${this.id}] Error adding queued candidate:`, e);
            }
        }
        this.iceQueue = [];
    }
}

export default function VoiceManager({ myId }: { myId: string }) {
    const { socket, players } = useGameStore();
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
    const peersRef = useRef<Map<string, Peer>>(new Map());

    // 1. Get User Media
    useEffect(() => {
        console.log("[VoiceManager] Requesting Microphone Access...");
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(s => {
                console.log("[VoiceManager] Microphone Access Granted");
                setStream(s);
            })
            .catch(err => console.error("[VoiceManager] Mic access denied", err));

        return () => {
            stream?.getTracks().forEach(t => t.stop());
        };
    }, []);

    // 2. Manage Mute
    useEffect(() => {
        if (stream) {
            stream.getAudioTracks().forEach(track => track.enabled = !isMuted);
        }
    }, [isMuted, stream]);

    // 3. Socket Logic
    useEffect(() => {
        if (!socket) return;
        if (!stream) return;

        console.log("[VoiceManager] Socket and Stream ready. Joining Voice Channel...");
        const peers = peersRef.current;

        // Trigger handshake (say "I am ready")
        socket.emit('join-voice');

        // When someone ELSE is ready
        const onUserJoinedVoice = (userId: string) => {
            if (userId === myId) return;
            if (peers.has(userId)) return;

            console.log("[VoiceManager] User joined voice:", userId, "Initiating call...");
            const peer = new Peer(userId, true, stream, (signal) => {
                socket.emit('signal', { targetId: userId, signal });
            });

            peers.set(userId, peer);
            peer.onStream = (remoteStream) => {
                setRemoteStreams(prev => new Map(prev).set(userId, remoteStream));
            };
        };

        const onPlayerLeft = (playerId: string) => {
            if (peers.has(playerId)) {
                peers.get(playerId)?.connection.close();
                peers.delete(playerId);
                setRemoteStreams(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(playerId);
                    return newMap;
                });
            }
        };

        const onSignal = async (data: { senderId: string, signal: any }) => {
            const { senderId, signal } = data;

            // If incoming offer and no peer, create responding peer (Answerer)
            if (!peers.has(senderId)) {
                console.log("[VoiceManager] Receiving call from:", senderId);
                const peer = new Peer(senderId, false, stream, (outSignal) => {
                    socket.emit('signal', { targetId: senderId, signal: outSignal });
                });
                peer.onStream = (remoteStream) => {
                    setRemoteStreams(prev => new Map(prev).set(senderId, remoteStream));
                };
                peers.set(senderId, peer);
            }

            const peer = peers.get(senderId);
            if (peer) {
                await peer.signal(signal);
            }
        };

        socket.on('user-joined-voice', onUserJoinedVoice);
        socket.on('player-left', onPlayerLeft);
        socket.on('signal', onSignal);

        return () => {
            socket.off('user-joined-voice', onUserJoinedVoice);
            socket.off('player-left', onPlayerLeft);
            socket.off('signal', onSignal);
            peers.forEach(p => p.connection.close());
        };

    }, [socket, stream, myId]);


    return (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2">
            <button
                onClick={() => setIsMuted(!isMuted)}
                className={clsx(
                    "p-3 rounded-full shadow-lg transition-all cursor-pointer border border-slate-700",
                    isMuted ? "bg-red-500 text-white" : "bg-slate-800 text-green-400 hover:bg-slate-700"
                )}
            >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Hidden Audios */}
            {Array.from(remoteStreams.entries()).map(([id, stream]) => (
                <AudioPlayer key={id} stream={stream} />
            ))}

            {/* Debug/Status Indicator */}
            <div className="px-3 py-1 bg-slate-900/80 rounded-full border border-slate-700 text-xs font-mono text-slate-400">
                Voice: {remoteStreams.size} connected
            </div>
        </div>
    );
}

function AudioPlayer({ stream }: { stream: MediaStream }) {
    const ref = useRef<HTMLAudioElement>(null);
    useEffect(() => {
        if (ref.current) {
            ref.current.srcObject = stream;
        }
    }, [stream]);
    return <audio ref={ref} autoPlay />;
}
