export function membershipDisplayName(
  profileName: string | null | undefined,
  canonicalName: string | null | undefined,
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null | undefined,
): string {
  const suppliedName = [profileName, canonicalName].map(value => value?.trim().replace(/\s+/g, ' ')).find(Boolean);
  if (!suppliedName) return 'MyAIS Member';
  const suppliedPrefix = suppliedName.match(/^(mr|ms)\.?\s+/i)?.[1]?.toLowerCase();
  const name = suppliedName.replace(/^(mr|ms)\.?\s+/i, '').toLocaleLowerCase('en-MY')
    .replace(/(^|[\s'-])\p{L}/gu, value => value.toLocaleUpperCase('en-MY'));
  const honorific = suppliedPrefix === 'mr' ? 'Mr ' : suppliedPrefix === 'ms' ? 'Ms ' :
    gender === 'MALE' ? 'Mr ' : gender === 'FEMALE' ? 'Ms ' : '';
  return `${honorific}${name}`;
}

export function membershipVerificationCode(membershipNumber: string | null): string {
  const value = membershipNumber?.trim() || '';
  return value ? `V-${value.slice(-6)}` : 'V-N/A';
}

export function memberInitials(name: string): string {
  const words = name.replace(/^(Mr|Ms)\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0]?.[0]}${words.at(-1)?.[0]}` : words[0]?.slice(0, 2) || 'MA').toUpperCase();
}
