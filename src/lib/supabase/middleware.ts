import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const devRole = request.cookies.get("salut_dev_role")?.value;
  const isPlaceholder = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder");
  const isAuthenticated = Boolean(user || (isPlaceholder && devRole));

  const isAuthPage = request.nextUrl.pathname.startsWith("/login");
  const isDashboardPage =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/calon-mahasiswa") ||
    request.nextUrl.pathname.startsWith("/mahasiswa") ||
    request.nextUrl.pathname.startsWith("/registrasi") ||
    request.nextUrl.pathname.startsWith("/lip-tagihan") ||
    request.nextUrl.pathname.startsWith("/pembayaran") ||
    request.nextUrl.pathname.startsWith("/setoran-ut") ||
    request.nextUrl.pathname.startsWith("/kas-operasional") ||
    request.nextUrl.pathname.startsWith("/laporan") ||
    request.nextUrl.pathname.startsWith("/master-data") ||
    request.nextUrl.pathname.startsWith("/pengguna") ||
    request.nextUrl.pathname.startsWith("/audit-log") ||
    request.nextUrl.pathname.startsWith("/pengaturan");

  if (!isAuthenticated && isDashboardPage) {
    // no user, redirecting to login page
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && isAuthPage) {
    // authenticated user trying to access login, redirect to dashboard
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

