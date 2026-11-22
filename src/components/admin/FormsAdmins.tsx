'use client';

import { useActionState } from 'react';
import { criarAdminAcao, redefinirSenhaAcao, type EstadoGestao } from '@/app/admin/acoes-conta';
import { Aviso } from '@/components/campeonato/ui';

/** Senha temporária: aparece só nesta resposta; recarregar a página a apaga. */
function SenhaUmaVez({ estado }: { estado: EstadoGestao }) {
  if (!estado.senhaTemporaria) return null;
  return (
    <div role="status" className="hud-card relative mt-3 p-3">
      <p className="hud-label !text-[11px]">Senha temporária de {estado.senhaTemporaria.usuario} · mostrada só agora</p>
      <p className="numero mt-1 select-all break-all text-3xl tracking-wider">{estado.senhaTemporaria.senha}</p>
      <p className="mt-1 text-xs text-text-3">Entregue à pessoa; no primeiro acesso ela troca por uma senha própria.</p>
    </div>
  );
}

export function FormNovoAdmin() {
  const [estado, acao, enviando] = useActionState<EstadoGestao, FormData>(criarAdminAcao, {});
  return (
    <form action={acao}>
      <Aviso texto={estado.erro} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <label className="block">
          <span className="rotulo-campo">Usuário</span>
          <input name="usuario" required autoComplete="off" autoCapitalize="none" spellCheck={false} className="campo" />
        </label>
        <label className="block">
          <span className="rotulo-campo">Nome de exibição</span>
          <input name="nome" autoComplete="off" className="campo" />
        </label>
        <label className="block">
          <span className="rotulo-campo">Tipo de conta</span>
          <select name="papel" defaultValue="admin" className="campo">
            <option value="admin">Admin (tudo)</option>
            <option value="mesario">Mesário (só o Modo Mesário)</option>
          </select>
        </label>
        <button type="submit" className="btn-cta" disabled={enviando}>
          <span>Criar conta</span>
        </button>
      </div>
      <SenhaUmaVez estado={estado} />
    </form>
  );
}

export function FormRedefinirSenha({ adminId, usuario }: { adminId: number; usuario: string }) {
  const [estado, acao, enviando] = useActionState<EstadoGestao, FormData>(redefinirSenhaAcao, {});
  return (
    <form action={acao}>
      <input type="hidden" name="adminId" value={adminId} />
      <button type="submit" className="btn-mini" disabled={enviando} aria-label={`Redefinir senha de ${usuario}`}>
        Redefinir senha
      </button>
      <Aviso texto={estado.erro} />
      <SenhaUmaVez estado={estado} />
    </form>
  );
}
