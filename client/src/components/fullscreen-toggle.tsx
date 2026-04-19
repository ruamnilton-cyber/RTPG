import { useEffect, useState } from "react";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export function FullscreenToggle({ compact = false }: { compact?: boolean }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleChange = () => {
      const doc = document as FullscreenDocument;
      setIsFullscreen(Boolean(doc.fullscreenElement || doc.webkitFullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleChange);
    document.addEventListener("webkitfullscreenchange", handleChange as EventListener);
    handleChange();

    return () => {
      document.removeEventListener("fullscreenchange", handleChange);
      document.removeEventListener("webkitfullscreenchange", handleChange as EventListener);
    };
  }, []);

  async function toggleFullscreen() {
    const doc = document as FullscreenDocument;
    const root = document.documentElement as FullscreenElement;

    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
        return;
      }
      if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      }
      return;
    }

    if (root.requestFullscreen) {
      await root.requestFullscreen();
      return;
    }
    if (root.webkitRequestFullscreen) {
      await root.webkitRequestFullscreen();
    }
  }

  return (
    <button
      type="button"
      className={compact ? "btn-secondary px-3 py-2 text-sm" : "btn-secondary"}
      onClick={toggleFullscreen}
      title={isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"}
    >
      {isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
    </button>
  );
}
