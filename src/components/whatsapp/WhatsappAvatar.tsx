import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users } from 'lucide-react';
import { resolveSupabasePublicStorageUrl } from './whatsappUtils';

interface WhatsappAvatarProps {
  name?: string | null;
  pictureUrl?: string | null;
  isGroup?: boolean;
  className?: string;
}

function getInitials(name: string | null | undefined, isGroup: boolean): string {
  if (!name) return isGroup ? 'G' : '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Generamos un color determinista a partir del nombre/jid para que los chats
// sin foto siempre tengan el mismo color.
function colorFor(seed: string | null | undefined): string {
  const palette = [
    'bg-emerald-500',
    'bg-teal-500',
    'bg-sky-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-rose-500',
    'bg-amber-500',
    'bg-lime-600',
    'bg-cyan-500',
    'bg-pink-500',
  ];
  let hash = 0;
  for (const c of seed ?? '') hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

export const WhatsappAvatar: React.FC<WhatsappAvatarProps> = ({
  name,
  pictureUrl,
  isGroup,
  className,
}) => {
  const initials = getInitials(name, !!isGroup);
  const color = colorFor(name ?? '');
  const resolvedUrl = resolveSupabasePublicStorageUrl(pictureUrl) ?? pictureUrl;
  return (
    <Avatar className={className}>
      {resolvedUrl ? (
        <AvatarImage src={resolvedUrl} alt={name ?? 'avatar'} />
      ) : null}
      <AvatarFallback
        className={`${color} text-white font-semibold`}
      >
        {isGroup && !name ? <Users className="h-1/2 w-1/2" /> : initials}
      </AvatarFallback>
    </Avatar>
  );
};
