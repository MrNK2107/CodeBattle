import Link from 'next/link';

export default function NotFound(): JSX.Element {
  return (
    <div className="mx-auto max-w-md space-y-4 pt-16 text-center">
      <p className="font-display text-6xl font-bold text-faint">404</p>
      <h1 className="text-2xl font-semibold">Nothing here</h1>
      <p className="text-muted">The page, battle or player you were looking for doesn’t exist.</p>
      <Link className="btn-primary" href="/">
        Go home
      </Link>
    </div>
  );
}
