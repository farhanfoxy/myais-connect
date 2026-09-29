export function membershipDisplayName(
  profileName: string | null | undefined,
  canonicalName: string | null | undefined,
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null | undefined,
): string {
  const name = [profileName, canonicalName].map(value => value?.trim().replace(/\s+/g, ' ')).find(Boolean) || 'MyAIS Member';
  const honorific = gender === 'MALE' ? 'Mr. ' : gender === 'FEMALE' ? 'Ms. ' : '';
  return `${honorific}${name}`;
}

export function membershipVerificationCode(membershipNumber: string | null): string {
  const value = membershipNumber?.trim() || '';
  return value ? `V-${value.slice(-6)}` : 'V-N/A';
}

export function memberInitials(name: string): string {
  const words = name.replace(/^(Mr\.|Ms\.)\s+/i, '').trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0]?.[0]}${words.at(-1)?.[0]}` : words[0]?.slice(0, 2) || 'MA').toUpperCase();
}
