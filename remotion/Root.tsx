import React from "react";
import { Composition } from "remotion";
import { NewsVideo, type NewsVideoProps } from "./components/NewsVideo";

// master 16:9 — durasi dinamis via props (dipass dari input)
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="NewsVideo"
      component={NewsVideo as React.ComponentType}
      durationInFrames={3000} // 100s @30fps — muat durasi audio hingga 100s
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        title: "Berita AI Hari Ini",
        script: "",
        audioFile: "voiceover.mp3",
        sourceNames: [],
      } as NewsVideoProps}
    />
  );
};