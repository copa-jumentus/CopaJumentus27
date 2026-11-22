import { GuardaAdmin } from '@/components/admin/GuardaAdmin';

// Modo Mesário: aceita admin e conta de mesário (CLAUDE.md §4.5 e §8.11), com a
// mesma troca de senha obrigatória do resto do admin.
export default function LayoutMesario({ children }: { children: React.ReactNode }) {
  return <GuardaAdmin mesario>{children}</GuardaAdmin>;
}
