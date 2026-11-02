import Link from 'next/link';

import { TierEmblem } from '@/components/ladder/TierBadge';
import { SignOutButton } from '@/components/SignOutButton';
import { standingFor } from '@/lib/ladder';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export function Logo(): JSX.Element {
  return (
    <span className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
      <svg aria-hidden width="22" height="22" viewBox="0 0 22 22">
        <path d="M2 4h9v14H2z" fill="#38D6F5" />
        <path d="M11 4h9v14h-9z" fill="#FF8F2B" />
        <path d="M11 2v18" stroke="#0A0B10" strokeWidth="2" />
      </svg>
      <span className="hidden sm:inline">CodeBattle</span>
    </span>
  );
}

export async function Nav(): Promise<JSX.Element> {
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { username: true, rating: true } }).catch(() => null)
    : null;

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-ink/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link href={user ? '/app' : '/'} aria-label="CodeBattle home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto text-sm sm:gap-1">
          {user ? (
            <>
              <NavLink href="/app">Play</NavLink>
              <NavLink href="/practice">Practice</NavLink>
            </>
          ) : null}
          <NavLink href="/leaderboard">
            <span className="sm:hidden">Ranks</span>
            <span className="hidden sm:inline">Leaderboard</span>
          </NavLink>
        </nav>
        {user ? (
          <div className="flex shrink-0 items-center gap-1 text-sm sm:gap-3">
            <Link href={`/profile/${user.username}`} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-panel" aria-label={`Your profile (${user.username})`}>
              <span className="hidden max-w-[10rem] truncate text-text sm:inline">{user.username}</span>
              <span className="flex items-center gap-1 rounded bg-raised px-1.5 py-0.5 font-display text-xs font-semibold text-you" title={`Rating, ${standingFor(user.rating).label}`}>
                <TierEmblem standing={standingFor(user.rating)} size={14} />
                {user.rating}
              </span>
            </Link>
            <SignOutButton />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link className="btn-quiet px-3 py-1.5" href="/login">
              Sign in
            </Link>
            <Link className="btn-primary hidden px-3 py-1.5 sm:inline-flex" href="/register">
              Create account
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }): JSX.Element {
  return (
    <Link href={href} className="whitespace-nowrap rounded-md px-2 py-1.5 text-muted transition-colors hover:bg-panel hover:text-text sm:px-3">
      {children}
    </Link>
  );
}
