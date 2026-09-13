import {
  Room,
  Track,
  LocalAudioTrack,
  RemoteAudioTrack,
  createAudioAnalyser,
} from "livekit-client";
type AudioTrack = LocalAudioTrack | RemoteAudioTrack;
// Own analyser lifetimes independently from React renders; release tracks on mute/disconnect.
export function observeAudioLevels(
  room: Room,
  update: (levels: { user: number; agent: number }) => void,
) {
  const analysers = new Map<
    AudioTrack,
    ReturnType<typeof createAudioAnalyser>
  >();
  const read = (track: AudioTrack | undefined) => {
    if (!track || track.isMuted) return 0;
    try {
      let analyser = analysers.get(track);
      if (!analyser) {
        analyser = createAudioAnalyser(track, {
          fftSize: 256,
          smoothingTimeConstant: 0.6,
        });
        analysers.set(track, analyser);
      }
      const samples = new Float32Array(analyser.analyser.fftSize);
      analyser.analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(
        samples.reduce((sum, value) => sum + value * value, 0) / samples.length,
      );
      return rms < 0.003 ? 0 : Math.min(1, Math.sqrt(rms * 6));
    } catch {
      return 0;
    }
  };
  const timer = setInterval(() => {
    const user = room.localParticipant.getTrackPublication(
      Track.Source.Microphone,
    )?.track;
    const tracks = [...room.remoteParticipants.values()]
      .filter((p) => p.attributes["lk.agent.state"])
      .flatMap((p) =>
        [...p.audioTrackPublications.values()].map((pub) => pub.track),
      )
      .filter((t): t is RemoteAudioTrack => t instanceof RemoteAudioTrack);
    const current = new Set<AudioTrack>(tracks);
    if (user instanceof LocalAudioTrack) current.add(user);
    for (const [track, analyser] of analysers)
      if (!current.has(track) || track.isMuted) {
        void analyser.cleanup();
        analysers.delete(track);
      }
    update({
      user:
        room.localParticipant.isMicrophoneEnabled &&
        user instanceof LocalAudioTrack
          ? read(user)
          : 0,
      agent: Math.max(0, ...tracks.map(read)),
    });
  }, 60);
  return () => {
    clearInterval(timer);
    for (const analyser of analysers.values()) void analyser.cleanup();
    analysers.clear();
  };
}
