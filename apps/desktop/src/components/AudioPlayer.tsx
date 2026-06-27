import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Pause, Play } from "lucide-react";
import { clampAudioTime } from "@music-crossword/shared";
import { Button } from "./Button";

export function AudioPlayer({ url, startTime, endTime }: { url: string; startTime?: number | null; endTime?: number | null }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveRef = useRef<WaveSurfer | null>(null);
  const [playing, setPlaying] = useState(false);
  const segmentStart = startTime ?? 0;
  const segmentEnd = endTime ?? undefined;

  useEffect(() => {
    if (!containerRef.current) return;
    const wave = WaveSurfer.create({
      container: containerRef.current,
      url,
      height: 70,
      waveColor: "rgba(148, 163, 184, 0.45)",
      progressColor: "#22d3ee",
      cursorColor: "#8b5cf6",
      barWidth: 3,
      barRadius: 3,
      normalize: true
    });
    wave.on("ready", () => {
      if (segmentStart > 0) wave.setTime(segmentStart);
    });
    wave.on("finish", () => setPlaying(false));
    wave.on("pause", () => setPlaying(false));
    wave.on("timeupdate", (currentTime) => {
      if (currentTime < segmentStart) {
        wave.setTime(segmentStart);
        return;
      }
      if (segmentEnd !== undefined && currentTime >= segmentEnd) {
        wave.pause();
        wave.setTime(segmentStart);
        setPlaying(false);
      }
    });
    const keepInsideSegment = (currentTime: number) => {
      const clampedTime = clampAudioTime(currentTime, segmentStart, segmentEnd, wave.getDuration());
      if (Math.abs(clampedTime - currentTime) > 0.001) wave.setTime(clampedTime);
    };
    wave.on("interaction", keepInsideSegment);
    wave.on("seeking", keepInsideSegment);
    waveRef.current = wave;
    return () => wave.destroy();
  }, [segmentEnd, segmentStart, url]);

  return (
    <div className="rounded-lg border border-cyan/20 bg-black/25 p-3">
      <div ref={containerRef} />
      <Button
        type="button"
        className="mt-3 h-9 w-full"
        onClick={async () => {
          const wave = waveRef.current;
          if (!wave) return;
          if (playing) {
            wave.pause();
            setPlaying(false);
            return;
          }
          const currentTime = clampAudioTime(wave.getCurrentTime(), segmentStart, segmentEnd, wave.getDuration());
          await wave.play(currentTime, segmentEnd);
          setPlaying(true);
        }}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {playing ? "Pauza" : "Odtworz fragment"}
      </Button>
    </div>
  );
}
