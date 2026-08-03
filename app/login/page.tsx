import { redirect } from "next/navigation";
import { loginSistema } from "@/lib/actions/auth";
import { buscarOperadorLogado, destinoInicial } from "@/lib/auth-operador";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const conectado = await buscarOperadorLogado();
  if (conectado) redirect(destinoInicial(conectado));

  const destino = sp.redirect?.startsWith("/") && !sp.redirect.startsWith("//")
    ? sp.redirect
    : "";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#07101f] px-4 py-10 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(14,165,201,0.16),transparent_32%),radial-gradient(circle_at_85%_75%,rgba(59,130,246,0.13),transparent_34%)]" />
      <section className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/80 bg-[#121b2d]/95 shadow-2xl shadow-black/40">
        <div className="border-b border-white/5 bg-[#0d1728] px-7 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/20">
              <span className="font-mono text-sm font-black tracking-tight text-white">MES</span>
            </div>
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
                Fabrica de engates
              </p>
              <h1 className="mt-0.5 text-xl font-bold text-white">Painel de Manufatura</h1>
            </div>
          </div>
        </div>

        <div className="px-7 py-7">
          <h2 className="text-lg font-semibold text-white">Entre no sistema</h2>
          <p className="mt-1 text-sm text-slate-400">
            Use seu primeiro nome e a senha temporaria cadastrada.
          </p>

          <form action={loginSistema} className="mt-6 space-y-4">
            <input type="hidden" name="redirect" value={destino} />
            {sp.erro && (
              <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
                {sp.erro}
              </p>
            )}
            <div>
              <label htmlFor="usuario" className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Usuario
              </label>
              <input
                id="usuario"
                name="usuario"
                autoComplete="username"
                autoCapitalize="none"
                required
                placeholder="Ex.: pedro ou tiago"
                className="w-full rounded-lg border border-slate-600 bg-[#07101f] px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10"
              />
            </div>
            <div>
              <label htmlFor="senha" className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Senha
              </label>
              <input
                id="senha"
                name="senha"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                required
                placeholder="Digite sua senha"
                className="w-full rounded-lg border border-slate-600 bg-[#07101f] px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10"
              />
            </div>
            <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-white shadow-lg shadow-cyan-600/20 transition hover:brightness-110">
              Entrar no MES
            </button>
          </form>

          <div className="mt-6 rounded-lg border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-xs leading-relaxed text-amber-100/80">
            Acesso de teste: use o primeiro nome do funcionario e a senha <strong className="font-mono text-amber-200">1234</strong>.
            Administrador: <strong className="font-mono text-amber-200">tiago</strong>.
          </div>
        </div>
      </section>
    </main>
  );
}
