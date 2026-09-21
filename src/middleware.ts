import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/api/suppliers(.*)", "/api/certificates(.*)", "/api/uploads(.*)", "/api/alert-rules(.*)", "/api/dashboard(.*)", "/api/export(.*)", "/api/inbox(.*)", "/api/phase3(.*)", "/api/settings(.*)", "/api/checkout(.*)", "/api/blob(.*)"]);
export default clerkMiddleware(async (auth, req) => { if (isProtectedRoute(req)) await auth.protect(); });
export const config = { matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"] };
