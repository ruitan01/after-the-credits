import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Private by default: only the welcome page and Clerk's own routes are public.
// `/` is public so signed-out visitors see the welcome; app/page.tsx decides
// what to render from the session, and shows no entries when signed out.
const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(
  async (auth, req) => {
    if (!isPublicRoute(req)) await auth.protect();
  },
  { signInUrl: "/sign-in", signUpUrl: "/sign-up" },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
