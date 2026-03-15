import { cn } from '@/lib/utils';

const AVATAR_COLORS = [
  '#0066CC', '#1A1A2E', '#059669', '#DC2626',
  '#D97706', '#0891B2', '#BE185D', '#65A30D',
];

export function getAvatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getInitials(name = '') {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const sizeClasses = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-14 w-14 text-xl',
  xl: 'h-20 w-20 text-3xl',
};

export function Avatar({ name, color, size = 'md', className }) {
  const bg = color || getAvatarColor(name);
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none',
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: bg }}
    >
      {getInitials(name)}
    </div>
  );
}
