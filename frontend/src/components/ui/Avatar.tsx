type AvatarProps = {
  initials: string;
};

export function Avatar({ initials }: AvatarProps) {
  return <span className="avatar" aria-label={`Usuario ${initials}`}>{initials}</span>;
}

