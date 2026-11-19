'use client';

import { useId, useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './buyer-access.css';

export function BuyerAccess({ children }: { children: ReactNode }) {
  return (
    <div className="buyer-access">
      <div className="buyer-access-panel">
        <div className="buyer-access-content">{children}</div>
        <div className="buyer-access-art" aria-hidden="true" />
      </div>
    </div>
  );
}

export function AccessHeading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="buyer-access-heading">
      <h1>{title}</h1>
      <p>{children}</p>
    </div>
  );
}

export function AccessPassword({ value, onChange, disabled, creating = false, recovery }: {
  value: string;
  onChange(value: string): void;
  disabled: boolean;
  creating?: boolean;
  recovery?: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="access-field">
      <div className="access-password-label">
        <label htmlFor={id}>Contraseña</label>
        {recovery}
      </div>
      <div className="access-password">
        <input id={id} type={visible ? 'text' : 'password'} required spellCheck={false} autoCapitalize="none" autoCorrect="off"
          autoComplete={creating ? 'new-password' : 'current-password'}
          minLength={creating ? 8 : undefined} value={value} disabled={disabled}
          aria-describedby={creating ? id + '-help' : undefined}
          onChange={(event) => onChange(event.target.value)} />
        <button type="button" disabled={disabled} aria-controls={id}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          onClick={() => setVisible(!visible)}>
          <Icon aria-hidden="true" size={19} strokeWidth={1.75} />
        </button>
      </div>
      {creating && <small id={id + '-help'}>Mínimo 8 caracteres con letras y números.</small>}
    </div>
  );
}
