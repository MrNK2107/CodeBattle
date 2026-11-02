import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { getServerSession, type AuthOptions } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { prisma } from "./prisma";
import { rateLimit } from "./rateLimit";

/** DEV_LOGIN=1 enables a password-less "pick a username" login for local battles. */
export const devLoginEnabled = process.env.DEV_LOGIN === "1" && process.env.NODE_ENV !== "production";

const providers: AuthOptions["providers"] = [];

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
  );
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

providers.push(
  Credentials({
    id: "credentials",
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials.password) {
        return null;
      }
      // slow down password guessing: 10 attempts per account per 15 minutes
      if (!rateLimit(`login:${credentials.email.trim().toLowerCase()}`, 10, 15 * 60 * 1000)) {
        return null;
      }

      const user = await prisma.user.findUnique({
        where: { email: credentials.email.trim().toLowerCase() },
      });

      if (!user?.passwordHash) {
        return null;
      }

      const isValid = await compare(credentials.password, user.passwordHash);
      if (!isValid) {
        return null;
      }

      return { id: user.id, email: user.email, name: user.name, role: user.role };
    },
  }),
);

if (devLoginEnabled) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev login",
      credentials: { username: { label: "Username", type: "text" } },
      async authorize(credentials) {
        const username = credentials?.username?.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, 20);
        if (!username || username.length < 2) return null;
        const user = await prisma.user.upsert({
          where: { email: `${username}@dev.codebattle.local` },
          update: {},
          create: { email: `${username}@dev.codebattle.local`, username, name: username },
        });
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  );
}

export const authOptions: AuthOptions = {
  // @auth/prisma-adapter and next-auth v4 disagree only on the token_type casing type
  adapter: PrismaAdapter(prisma) as unknown as Adapter,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        if (token.role) {
          session.user.role = token.role as string;
        }
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      const baseUsername = (
        user.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ||
        user.email?.split("@")[0]?.toLowerCase()?.replace(/[^a-z0-9]+/g, "-") ||
        "user"
      ).slice(0, 15);
      const suffix = Math.floor(Math.random() * 10_000)
        .toString()
        .padStart(4, "0");

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: user.email ? new Date() : null,
          username: `${baseUsername}-${suffix}`,
          name: user.name ?? baseUsername,
          image: user.image,
        },
      });
    },
  },
};

/** Server-side session helper (next-auth v4). */
export function auth() {
  return getServerSession(authOptions);
}
