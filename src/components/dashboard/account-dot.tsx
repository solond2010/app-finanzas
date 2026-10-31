import { accountColor } from "@/lib/account-colors"

/** Puntito con el color de la cuenta (con anillo sutil para tonos claros). */
export function AccountDot({ account, className = "size-2" }: { account: { id: string; color?: string | null }; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15 ${className}`}
      style={{ backgroundColor: accountColor(account) }}
    />
  )
}
