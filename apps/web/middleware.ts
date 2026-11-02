import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: ["/app/:path*", "/battle/:path*", "/practice/:path*", "/challenge/:path*"],
};
