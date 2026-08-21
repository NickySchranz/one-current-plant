import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import type { FrameName } from '@/features/plant-view/mascot-frames';

const TUTORIAL_KEY = 'one-current-plant-tutorial-v1';

export type TutorialStep = {
  id: string;
  text: string;
  subtext?: string;
  frame: FrameName;
  highlight?: 'fab' | 'now' | 'branch' | 'history' | 'more' | 'add' | null;
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    text: "Hi! I'm Dot!",
    subtext:
      "I'm the ladybug who lives on your plant, and I help you tend what's on your mind. Let me show you around.",
    frame: 'REACT',
    highlight: null,
  },
  {
    id: 'main-line',
    text: 'This is your plant, today at the window.',
    subtext:
      'The stem is you, growing through today. Everything else grows from here.',
    frame: 'INSPECT_A',
    highlight: 'now',
  },
  {
    id: 'branches',
    text: 'These leaves are your worries.',
    subtext:
      'Each one is something pulling your attention — a worry, project, or waiting situation.',
    frame: 'INSPECT_B',
    highlight: 'branch',
  },
  {
    id: 'tap',
    text: 'Tap any leaf to tend to it.',
    subtext:
      'You can add notes, make a decision, set how wilted it feels, or let it go.',
    frame: 'TALK_A',
    highlight: 'branch',
  },
  {
    id: 'loudness',
    text: 'Drag a leaf up or down to set its wilt.',
    subtext:
      'More brown spots and droop mean it\'s taking more mental space right now. Setting it honestly helps you see clearly.',
    frame: 'INSPECT_A',
    highlight: 'branch',
  },
  {
    id: 'add',
    text: 'The + button grows a new leaf.',
    subtext:
      'When something new lands on your mind, name it here. Named things are easier to tend.',
    frame: 'REACT',
    highlight: 'add',
  },
  {
    id: 'merge',
    text: 'When a worry is resolved, let the leaf heal and settle.',
    subtext:
      'The pot holds your settled leaves, and each decision clears the sky outside a little. The energy you were spending comes home.',
    frame: 'TALK_B',
    highlight: 'branch',
  },
  {
    id: 'history',
    text: "History shows each day's tending.",
    subtext:
      'Leaves settled, notes, actions taken — all recorded. Reviewing it builds self-knowledge.',
    frame: 'INSPECT_B',
    highlight: 'history',
  },
  {
    id: 'more',
    text: 'More holds settings and your companion.',
    subtext:
      'Change the language, or swap me out for another ladybug.',
    frame: 'IDLE_A',
    highlight: 'more',
  },
  {
    id: 'done',
    text: "That's everything!",
    subtext:
      "I'll keep watch over your leaves. Tap me anytime to tend a specific leaf. You've got this.",
    frame: 'REACT',
    highlight: null,
  },
];

export function useTutorial() {
  const [step, setStep] = useState<number | null>(null); // null = not loaded yet
  const [done, setDone] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(TUTORIAL_KEY)
      .then((v) => {
        if (v === 'done') {
          setDone(true);
          setStep(null);
        } else {
          setStep(0);
        }
      })
      .catch(() => {
        setStep(0);
      });
  }, []);

  const next = () => {
    setStep((s) => {
      if (s === null) return null;
      if (s >= TUTORIAL_STEPS.length - 1) {
        AsyncStorage.setItem(TUTORIAL_KEY, 'done').catch(() => {});
        setDone(true);
        return null;
      }
      return s + 1;
    });
  };

  const skip = () => {
    AsyncStorage.setItem(TUTORIAL_KEY, 'done').catch(() => {});
    setDone(true);
    setStep(null);
  };

  const restart = () => {
    AsyncStorage.removeItem(TUTORIAL_KEY).catch(() => {});
    setDone(false);
    setStep(0);
  };

  const active = step !== null && !done;
  const currentStep = active && step !== null ? TUTORIAL_STEPS[step] : null;

  return {
    active,
    currentStep,
    stepIndex: step ?? 0,
    totalSteps: TUTORIAL_STEPS.length,
    next,
    skip,
    restart,
  };
}
