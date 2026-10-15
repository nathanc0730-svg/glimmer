import { useEffect, useState } from 'react';
import Keypad from './Keypad.jsx';
import { SparkleIcon } from './Icons.jsx';
import { checkPasscode } from '../lib/passcode.js';

const MAX_TRIES = 5;
const LOCKOUT_MS = 30000;

export default function LockScreen({ onUnlock }) {
  const [tries, setTries] = useState(0);
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (until <= now) return undefined;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [until, now]);

  const locked = until > now;

  const submit = async (code) => {
    if (await checkPasscode(code)) {
      onUnlock();
      return true;
    }
    const n = tries + 1;
    setTries(n);
    if (n >= MAX_TRIES) {
      setUntil(Date.now() + LOCKOUT_MS);
      setNow(Date.now());
      setTries(0);
    }
    return false;
  };

  return (
    <div className="lock-screen">
      <div className="lock-logo">
        <SparkleIcon size={30} />
      </div>
      <Keypad
        title="Welcome back"
        subtitle={locked ? `Too many tries. Try again in ${Math.ceil((until - now) / 1000)}s.` : 'Enter your passcode'}
        onComplete={submit}
        disabled={locked}
      />
    </div>
  );
}
