import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "mes_operador_session";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestTarget = `${pathname}${request.nextUrl.search}`;
  const headers = new Headers(request.headers);
  headers.set("x-mes-pathname", pathname);
  headers.set("x-mes-request-target", requestTarget);

  if (pathname === "/login") {
    return NextResponse.next({ request: { headers } });
  }

  if (!request.cookies.get(COOKIE_NAME)?.value) {
    const login = new URL("/login", request.url);
    login.searchParams.set("redirect", requestTarget);
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
    "/pecas/:path*",
    "/historico/:path*",
    "/monitoramento/:path*",
    "/ops/:path*",
    "/plasma/:path*",
    "/ponteiras/:path*",
    "/relatorios/:path*",
    "/registros/:path*",
    "/setores/:path*",
    "/solda/:path*",
    "/api/uploads/:path*",
  ],
};
