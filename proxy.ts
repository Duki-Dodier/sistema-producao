import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "mes_operador_session";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const headers = new Headers(request.headers);
  headers.set("x-mes-pathname", pathname);

  if (pathname === "/login") {
    return NextResponse.next({ request: { headers } });
  }

  if (!request.cookies.get(COOKIE_NAME)?.value) {
    const login = new URL("/login", request.url);
    login.searchParams.set("redirect", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/agrupamento/:path*",
    "/apontamentos/:path*",
    "/configuracoes/:path*",
    "/modelos/:path*",
    "/monitoramento/:path*",
    "/ops/:path*",
    "/registros/:path*",
    "/setores/:path*",
    "/solda/:path*",
    "/api/uploads/:path*",
  ],
};
