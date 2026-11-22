// Envolve toda página de admin (painel, pote e cerimônia).
// Com troca de senha pendente, a página fica inerte por baixo e um pop-up que
// não fecha (sem X, sem Esc, sem clique fora) pede a nova senha. O servidor
// também recusa qualquer ação até a troca (exigirAdmin).

import { exigirAdmin, exigirMesario } from '@/lib/auth/servidor';
import { FormTrocaSenha } from './FormTrocaSenha';

/** `mesario`: também aceita conta de mesário (só no Modo Mesário). */
export async function GuardaAdmin({ children, mesario = false }: { children: React.ReactNode; mesario?: boolean }) {
  const conta = await (mesario ? exigirMesario : exigirAdmin)({ permitirTrocaPendente: true });
  if (!conta.deveTrocarSenha) return <>{children}</>;
  return (
    <>
      <div inert aria-hidden="true">
        {children}
      </div>
      <div className="modal-fundo fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="troca-titulo"
          aria-describedby="troca-texto"
          className="hud-card hud-clip modulo animar-revelar relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-6"
        >
          <p className="hud-label" style={{ color: 'var(--accent)' }}>
            Primeiro acesso de {conta.nome}
          </p>
          <h2 id="troca-titulo" className="titulo-hero t-sm mt-1 text-3xl">
            Crie sua senha
          </h2>
          <div className="filete mt-3 w-16" aria-hidden="true" />
          <p id="troca-texto" className="mb-5 mt-3 text-sm text-text-2">
            A senha que você recebeu é temporária. Escolha uma nova para continuar; até lá, nenhuma ação é aceita.
          </p>
          <FormTrocaSenha exigirAtual={false} volta={conta.papel === 'mesario' ? '/admin/mesario' : '/admin'} autoFocus />
        </div>
      </div>
    </>
  );
}
