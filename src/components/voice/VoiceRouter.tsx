'use client';

/** VoiceRouter：断点路由（≥1024 桌面双面板 / 横屏双端面对面 / 竖屏单手） */
import { useEffect, useState } from 'react';
import VoiceMobileView from './VoiceMobileView';
import VoiceFaceView from './VoiceFaceView';
import VoiceDesktopView from './VoiceDesktopView';

type View = 'mobile' | 'face' | 'desktop';

export default function VoiceRouter() {
  const [view, setView] = useState<View>('mobile');

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w >= 1024) setView('desktop');
      else if (w > h) setView('face');
      else setView('mobile');
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  if (view === 'face') return <VoiceFaceView />;
  if (view === 'desktop') return <VoiceDesktopView />;
  return <VoiceMobileView />;
}
