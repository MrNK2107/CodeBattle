"use client";

import { signOut } from 'next-auth/react';

export function SignOutButton(): JSX.Element {
  return (
    <button type="button" className="whitespace-nowrap rounded-md px-2 py-1 text-sm text-muted hover:text-text" onClick={() => void signOut({ callbackUrl: '/' })}>
      Sign out
    </button>
  );
}
