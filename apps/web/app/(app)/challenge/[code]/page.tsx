import { redirect } from 'next/navigation';

import { AcceptChallenge } from '@/components/battle/AcceptChallenge';
import { auth } from '@/lib/auth';

export const metadata = { title: 'Challenge' };

export default async function ChallengePage({ params }: { params: { code: string } }): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/challenge/${params.code}`);
  return <AcceptChallenge code={params.code.toUpperCase()} />;
}
