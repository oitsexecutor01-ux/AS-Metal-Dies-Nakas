import React, { useEffect, useRef, useState } from 'react';
import { Check, RotateCcw, ShoppingCart } from 'lucide-react';
import './FuseButton.css';

/** A cart action with a short, reversible confirmation window. */
export default function FuseButton({
  label = 'Add to cart',
  doneLabel = 'Added to cart',
  undoLabel = 'Undo',
  disabled = false,
  onCommit,
  onUndo,
  className = '',
}) {
  const [phase, setPhase] = useState('idle');
  const timer = useRef(null);
  const undoAction = useRef(null);
  const callbacks = useRef({ onCommit, onUndo });
  callbacks.current = { onCommit, onUndo };

  useEffect(() => () => clearTimeout(timer.current), []);

  function undo() {
    if (phase !== 'armed') return;
    clearTimeout(timer.current);
    if (undoAction.current) undoAction.current();
    else callbacks.current.onUndo?.();
    undoAction.current = null;
    setPhase('idle');
  }

  function commit() {
    if (disabled || phase !== 'idle') return;
    undoAction.current = callbacks.current.onCommit?.() || null;
    setPhase('armed');
    timer.current = setTimeout(() => setPhase('idle'), 4000);
  }

  return (
    <span
      className={`fuse-button${className ? ` ${className}` : ''}`}
      data-phase={phase}
      onKeyDown={event => {
        if (event.key === 'Escape' && phase === 'armed') {
          event.preventDefault();
          undo();
        }
      }}
    >
      <button type="button" className="fuse-button__face" disabled={disabled || phase !== 'idle'} onClick={commit}>
        <ShoppingCart size={16} aria-hidden="true" />{label}
      </button>
      {phase === 'armed' && (
        <button type="button" className="fuse-button__face fuse-button__undo" onClick={undo} aria-label={`${undoLabel} adding to cart`}>
          <RotateCcw size={15} aria-hidden="true" />{undoLabel}
        </button>
      )}
      <span className="fuse-button__fuse" aria-hidden="true" />
      <span className="fuse-button__status" role="status" aria-live="polite">
        {phase === 'armed' ? `${doneLabel}. Select Undo within 4 seconds to remove it.` : ''}
      </span>
      {phase === 'settled' && <Check aria-hidden="true" />}
    </span>
  );
}
