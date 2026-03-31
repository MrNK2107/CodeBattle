import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import NextAuth, { type AuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { prisma } from "./prisma";

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user?.passwordHash) {
          return null;
        }

        const isValid = await compare(credentials.password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
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
      const baseUsername =
        user.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ||
        user.email?.split("@")[0]?.toLowerCase()?.replace(/[^a-z0-9]+/g, "-") ||
        "user";
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

export const { handlers: authHandlers, auth, signIn, signOut } = NextAuth(authOptions);
