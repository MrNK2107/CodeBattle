import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = registerSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    const passwordHash = await hash(password, 10);
    const baseUsername = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "user";
    const suffix = Math.floor(Math.random() * 10_000)
      .toString()
      .padStart(4, "0");
    const username = `${baseUsername}-${suffix}`;

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        username,
      },
    });

    return NextResponse.json({ id: user.id, email: user.email, name: user.name });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: "Unable to register" }, { status: 500 });
  }
}
