import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'

export type AvatarType = 'male' | 'female'

interface UserAvatarProps extends Omit<SVGProps<SVGSVGElement>, 'type'> {
  type?: AvatarType | string | null
  className?: string
}

export function MaleAvatarSvg({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('size-full', className)}
      {...props}
    >
      <circle cx="50" cy="50" r="48" fill="#0d9488" fillOpacity="0.15" stroke="#14b8a6" strokeWidth="2.5" />
      {/* Short neat male hair */}
      <path
        d="M32 40C32 26 40 18 50 18C60 18 68 26 68 40V43C68 43 65 37 50 37C35 37 32 43 32 43V40Z"
        fill="#2dd4bf"
      />
      {/* Head */}
      <circle cx="50" cy="46" r="17" fill="#fde68a" />
      {/* Eyes & smile */}
      <circle cx="44.5" cy="45" r="2" fill="#1e293b" />
      <circle cx="55.5" cy="45" r="2" fill="#1e293b" />
      <path d="M46 52C48.5 54.5 51.5 54.5 54 52" stroke="#1e293b" strokeWidth="1.8" strokeLinecap="round" />
      {/* Shoulders / Shirt */}
      <path
        d="M26 86C26 73 36 67 50 67C64 67 74 73 74 86"
        fill="#0f766e"
      />
      {/* Collar */}
      <path d="M45 67L50 75L55 67" stroke="#5eead4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function FemaleAvatarSvg({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('size-full', className)}
      {...props}
    >
      <circle cx="50" cy="50" r="48" fill="#ec4899" fillOpacity="0.15" stroke="#f472b6" strokeWidth="2.5" />
      {/* Hair back / sides */}
      <path
        d="M29 44C27 56 30 68 32 72C33 66 35 55 35 50C35 30 41 20 50 20C59 20 65 30 65 50C65 55 67 66 68 72C70 68 73 56 71 44C70 28 62 18 50 18C38 18 30 28 29 44Z"
        fill="#f472b6"
      />
      {/* Head */}
      <circle cx="50" cy="46" r="17" fill="#fde68a" />
      {/* Hair front bangs */}
      <path
        d="M33 38C37 32 44 32 50 35C56 32 63 32 67 38C63 34 56 34 50 37C44 34 37 34 33 38Z"
        fill="#db2777"
      />
      {/* Eyes with lashes & smile */}
      <circle cx="44.5" cy="46" r="2" fill="#1e293b" />
      <circle cx="55.5" cy="46" r="2" fill="#1e293b" />
      <path d="M42 43L44 44" stroke="#1e293b" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M58 43L56 44" stroke="#1e293b" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M46 53C48.5 55.5 51.5 55.5 54 53" stroke="#1e293b" strokeWidth="1.8" strokeLinecap="round" />
      {/* Shoulders / Dress */}
      <path
        d="M26 86C26 73 36 67 50 67C64 67 74 73 74 86"
        fill="#be185d"
      />
      {/* Collar / Necklace */}
      <path d="M44 69C47 73 53 73 56 69" stroke="#fbcfe8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function UserAvatar({ type, className, ...props }: UserAvatarProps) {
  if (type === 'female') {
    return <FemaleAvatarSvg className={className} {...props} />
  }
  return <MaleAvatarSvg className={className} {...props} />
}
