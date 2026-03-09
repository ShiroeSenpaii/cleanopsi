// tests/suppression.test.ts — D2, F1, F2
import { describe, it, expect } from 'vitest';
import { isStopLikePhrase } from '../lib/suppression/check';

describe('STOP-like phrase detection', () => {
  const shouldSuppress = [
    'STOP', 'stop', 'Stop', 'unsubscribe', 'UNSUBSCRIBE',
    'cancel', 'end', 'quit', 'revoke', 'opt out',
    'stop texting me', 'please stop texting me', 'please stop',
    'no more texts', 'remove me',
  ];

  const shouldNotSuppress = [
    'yes', 'confirm', 'reschedule', 'see you tomorrow',
    'can you come at 3pm instead', 'thanks', '', 'hello',
    'what time are you coming', 'i will be home',
  ];

  for (const phrase of shouldSuppress) {
    it(`suppresses: "${phrase}"`, () => {
      expect(isStopLikePhrase(phrase)).toBe(true);
    });
  }

  for (const phrase of shouldNotSuppress) {
    it(`does NOT suppress: "${phrase}"`, () => {
      expect(isStopLikePhrase(phrase)).toBe(false);
    });
  }
});
