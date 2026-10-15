import { useState } from 'react';
import Sheet from './Sheet.jsx';
import Keypad from './Keypad.jsx';
import { checkPasscode, clearPasscode, setPasscode } from '../lib/passcode.js';

/** `mode`: 'set' | 'change' | 'remove' | null */
export default function PasscodeSheet({ mode, onClose }) {
  return (
    <Sheet open={!!mode} onClose={onClose} label="Passcode" z={70}>
      {mode && <Flow key={mode} mode={mode} onClose={onClose} />}
    </Sheet>
  );
}

function Flow({ mode, onClose }) {
  // set: new -> confirm; change: current -> new -> confirm; remove: current
  const [step, setStep] = useState(mode === 'set' ? 'new' : 'current');
  const [first, setFirst] = useState('');
  const [mismatch, setMismatch] = useState(false);

  const titles = {
    current: 'Enter your current passcode',
    new: 'Choose a 4-digit passcode',
    confirm: 'Enter it once more',
  };

  const onComplete = async (code) => {
    if (step === 'current') {
      if (!(await checkPasscode(code))) return false;
      if (mode === 'remove') {
        await clearPasscode();
        onClose();
      } else setStep('new');
      return true;
    }
    if (step === 'new') {
      setMismatch(false);
      setFirst(code);
      setStep('confirm');
      return true;
    }
    if (code !== first) {
      setMismatch(true);
      setStep('new');
      setFirst('');
      return false;
    }
    await setPasscode(code);
    onClose();
    return true;
  };

  return (
    <div className="sheet-scroll passcode-flow">
      <Keypad
        key={step}
        title={titles[step]}
        subtitle={
          mismatch && step === 'new'
            ? 'Those didn’t match. Let’s try again.'
            : step === 'new'
            ? 'Asked each time Glimmer opens. There’s no way to recover a forgotten passcode, so keep a backup.'
            : null
        }
        onComplete={onComplete}
      />
    </div>
  );
}
