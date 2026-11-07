/**
 * Authoritative Partner & Sponsor Registry for Cyber Scotland Connect
 * 
 * Provides deterministic verification against genuine partners in src/content/partners/.
 * Used across content validation (Zod schema), RSS feeds, iCal generators,
 * and UI components to guarantee an entity is never mislabeled as an official partner.
 */

export interface RegisteredPartner {
  canonicalName: string;
  tier: 'Host Venue' | 'Academic Partner' | 'Ecosystem Partner' | 'Sponsor';
  aliases: string[];
  linkedinHandle?: string;
  linkedinUrl?: string;
  linkedinOrgId?: string;
}

export interface CommunityOrgLinkedin {
  canonicalName: string;
  aliases: string[];
  linkedinHandle?: string;
  linkedinUrl?: string;
  linkedinOrgId?: string;
}

export const REGISTERED_PARTNERS: RegisteredPartner[] = [
  // Host Venues
  {
    canonicalName: 'CodeBase Edinburgh',
    tier: 'Host Venue',
    aliases: ['codebase', 'codebase edinburgh'],
    linkedinHandle: 'thisiscodebase',
    linkedinUrl: 'https://www.linkedin.com/company/thisiscodebase/',
    linkedinOrgId: '5017421',
  },
  {
    canonicalName: 'FreeAgent',
    tier: 'Host Venue',
    aliases: ['freeagent'],
    linkedinHandle: 'freeagent',
    linkedinUrl: 'https://www.linkedin.com/company/freeagent/',
    linkedinOrgId: '208568',
  },
  {
    canonicalName: 'Skyscanner',
    tier: 'Host Venue',
    aliases: ['skyscanner'],
    linkedinHandle: 'skyscanner',
    linkedinUrl: 'https://www.linkedin.com/company/skyscanner/',
    linkedinOrgId: '47862',
  },
  {
    canonicalName: 'Trustpilot',
    tier: 'Host Venue',
    aliases: ['trustpilot'],
    linkedinHandle: 'trustpilot',
    linkedinUrl: 'https://www.linkedin.com/company/trustpilot/',
    linkedinOrgId: '418270',
  },
  {
    canonicalName: 'Wood Mackenzie',
    tier: 'Host Venue',
    aliases: ['wood mackenzie', 'woodmac'],
    linkedinHandle: 'wood-mackenzie',
    linkedinUrl: 'https://www.linkedin.com/company/wood-mackenzie/',
    linkedinOrgId: '10144',
  },

  // Academic Partners
  {
    canonicalName: 'Abertay cyberQuarter',
    tier: 'Academic Partner',
    aliases: ['abertay cyberquarter', 'abertay university', 'abertay'],
    linkedinHandle: 'abertay-university',
    linkedinUrl: 'https://www.linkedin.com/school/abertay-university/',
    linkedinOrgId: '19328',
  },
  {
    canonicalName: 'Edinburgh Napier University',
    tier: 'Academic Partner',
    aliases: [
      'edinburgh napier university',
      'napier university',
      'napier',
      'enusec',
      'enusec (napier cyber security society)',
    ],
    linkedinHandle: 'edinburgh-napier-university',
    linkedinUrl: 'https://www.linkedin.com/school/edinburgh-napier-university/',
    linkedinOrgId: '11548',
  },
  {
    canonicalName: 'University of Strathclyde',
    tier: 'Academic Partner',
    aliases: ['university of strathclyde', 'strathclyde university', 'strathclyde'],
    linkedinHandle: 'university-of-strathclyde',
    linkedinUrl: 'https://www.linkedin.com/school/university-of-strathclyde/',
    linkedinOrgId: '7467',
  },
  {
    canonicalName: 'The Cyber Academy',
    tier: 'Academic Partner',
    aliases: ['the cyber academy', 'cyber academy'],
    linkedinHandle: 'the-cyber-academy',
    linkedinUrl: 'https://www.linkedin.com/company/the-cyber-academy/',
  },

  // Ecosystem Partners
  {
    canonicalName: 'Cyber and Fraud Centre Scotland',
    tier: 'Ecosystem Partner',
    aliases: [
      'cyber and fraud centre scotland',
      'cyber & fraud centre scotland',
      'cyber and fraud centre',
      'cyber & fraud centre',
      'scottish business resilience centre',
      'sbrc',
    ],
    linkedinHandle: 'cyber-and-fraud-centre-scotland',
    linkedinUrl: 'https://www.linkedin.com/company/cyber-and-fraud-centre-scotland/',
    linkedinOrgId: '18583194',
  },
  {
    canonicalName: 'DIGIT',
    tier: 'Ecosystem Partner',
    aliases: ['digit', 'digit expo', 'scot-secure'],
    linkedinHandle: 'digit-fyi',
    linkedinUrl: 'https://www.linkedin.com/company/digit-fyi/',
    linkedinOrgId: '18162541',
  },
  {
    canonicalName: 'ScotlandIS Cyber Cluster',
    tier: 'Ecosystem Partner',
    aliases: ['scotlandis cyber cluster', 'scotlandis'],
    linkedinHandle: 'scotlandis',
    linkedinUrl: 'https://www.linkedin.com/company/scotlandis/',
    linkedinOrgId: '63765',
  },
  {
    canonicalName: 'The Data Lab',
    tier: 'Ecosystem Partner',
    aliases: ['the data lab', 'data lab'],
    linkedinHandle: 'the-data-lab',
    linkedinUrl: 'https://www.linkedin.com/company/the-data-lab/',
    linkedinOrgId: '5350618',
  },

  // Sponsors
  {
    canonicalName: 'Adarma',
    tier: 'Sponsor',
    aliases: ['adarma'],
    linkedinHandle: 'adarma-security',
    linkedinUrl: 'https://www.linkedin.com/company/adarma-security/',
    linkedinOrgId: '2815129',
  },
  {
    canonicalName: 'Cyera UK',
    tier: 'Sponsor',
    aliases: ['cyera', 'cyera uk'],
    linkedinHandle: 'cyera',
    linkedinUrl: 'https://www.linkedin.com/company/cyera/',
    linkedinOrgId: '71688924',
  },
  {
    canonicalName: 'ExtraHop',
    tier: 'Sponsor',
    aliases: ['extrahop'],
    linkedinHandle: 'extrahop-networks',
    linkedinUrl: 'https://www.linkedin.com/company/extrahop-networks/',
    linkedinOrgId: '215416',
  },
  {
    canonicalName: 'Harvey Nash',
    tier: 'Sponsor',
    aliases: ['harvey nash'],
    linkedinHandle: 'harvey-nash',
    linkedinUrl: 'https://www.linkedin.com/company/harvey-nash/',
    linkedinOrgId: '6969',
  },
  {
    canonicalName: 'RiverSafe',
    tier: 'Sponsor',
    aliases: ['riversafe'],
    linkedinHandle: 'riversafe',
    linkedinUrl: 'https://www.linkedin.com/company/riversafe/',
    linkedinOrgId: '1861942',
  },
];

export const COMMUNITY_LINKEDIN_DIRECTORY: CommunityOrgLinkedin[] = [
  {
    canonicalName: 'Cyber Scotland Connect',
    aliases: ['cyber scotland connect', 'csc', 'security scotland'],
    linkedinHandle: 'cyber-scotland-connect',
    linkedinUrl: 'https://www.linkedin.com/company/cyber-scotland-connect/',
    linkedinOrgId: '98412650',
  },
  {
    canonicalName: 'Hack Thursday',
    aliases: ['hack thursday', 'hackthursday'],
    linkedinHandle: 'hack-thursday',
    linkedinUrl: 'https://www.linkedin.com/company/hack-thursday/',
    linkedinOrgId: '102485912',
  },
  {
    canonicalName: 'DEF CON Dundee (DC441382)',
    aliases: ['def con dundee', 'dc441382', 'defcon dundee'],
    linkedinHandle: 'dc441382',
    linkedinUrl: 'https://www.linkedin.com/company/dc441382/',
  },
  {
    canonicalName: 'DEF CON Edinburgh (DC44131)',
    aliases: ['def con edinburgh', 'dc44131', 'defcon edinburgh'],
    linkedinHandle: 'dc44131',
    linkedinUrl: 'https://www.linkedin.com/company/dc44131/',
  },
  {
    canonicalName: 'OWASP Scotland Chapter',
    aliases: ['owasp scotland', 'owasp scotland chapter', 'owasp'],
    linkedinHandle: 'owasp-scotland',
    linkedinUrl: 'https://www.linkedin.com/company/owasp-scotland/',
  },
  {
    canonicalName: 'ISACA Scotland Chapter',
    aliases: ['isaca scotland', 'isaca scotland chapter'],
    linkedinHandle: 'isaca-scotland-chapter',
    linkedinUrl: 'https://www.linkedin.com/company/isaca-scotland-chapter/',
  },
  {
    canonicalName: 'ISC2 Scotland Chapter',
    aliases: ['isc2 scotland', 'isc2 scotland chapter'],
    linkedinUrl: 'https://www.linkedin.com/groups/7452327',
  },
  {
    canonicalName: 'Abertay Hackers',
    aliases: ['abertay hackers', 'abertay ethical hacking society', 'securi-tay'],
    linkedinHandle: 'abertay-hackers',
    linkedinUrl: 'https://www.linkedin.com/company/abertay-hackers/',
  },
  {
    canonicalName: 'ENUSEC',
    aliases: [
      'enusec',
      'edinburgh napier cyber society',
      'enusec (napier cyber security society)',
    ],
    linkedinHandle: 'enusec',
    linkedinUrl: 'https://www.linkedin.com/company/enusec/',
  },
  {
    canonicalName: 'Scotland Women in Technology (SWiT)',
    aliases: ['scotland women in technology', 'swit'],
    linkedinHandle: 'scotland-women-in-technology',
    linkedinUrl: 'https://www.linkedin.com/company/scotland-women-in-technology/',
  },
  {
    canonicalName: 'Scottish Tech Army',
    aliases: ['scottish tech army'],
    linkedinHandle: 'scottish-tech-army',
    linkedinUrl: 'https://www.linkedin.com/company/scottish-tech-army/',
  },
  {
    canonicalName: 'TechVets Scotland',
    aliases: ['techvets', 'techvets scotland'],
    linkedinHandle: 'techvets',
    linkedinUrl: 'https://www.linkedin.com/company/techvets/',
  },
  {
    canonicalName: 'Women in Cybersecurity Scotland (WiCS)',
    aliases: ['women in cybersecurity scotland', 'wics scotland', 'wics'],
    linkedinHandle: 'women-in-cybersecurity-scotland',
    linkedinUrl: 'https://www.linkedin.com/company/women-in-cybersecurity-scotland/',
  },
  {
    canonicalName: 'Glasgow Azure User Group',
    aliases: ['glasgow azure user group', 'gaug'],
    linkedinHandle: 'glasgow-azure-user-group',
    linkedinUrl: 'https://www.linkedin.com/company/glasgow-azure-user-group/',
  },
  {
    canonicalName: 'The SASIG',
    aliases: ['the sasig', 'sasig', 'scotland sasig'],
    linkedinHandle: 'the-sasig',
    linkedinUrl: 'https://www.linkedin.com/company/the-sasig/',
    linkedinOrgId: '10421882',
  },
  {
    canonicalName: 'Holyrood Connect',
    aliases: ['holyrood connect', 'holyrood events'],
    linkedinHandle: 'holyrood-communications',
    linkedinUrl: 'https://www.linkedin.com/company/holyrood-communications/',
  },
  {
    canonicalName: 'FutureScot',
    aliases: ['futurescot'],
    linkedinHandle: 'futurescot',
    linkedinUrl: 'https://www.linkedin.com/company/futurescot/',
    linkedinOrgId: '18924110',
  },
  {
    canonicalName: 'Datadog',
    tier: undefined as never,
    aliases: ['datadog'],
    linkedinHandle: 'datadog',
    linkedinUrl: 'https://www.linkedin.com/company/datadog/',
    linkedinOrgId: '1266304',
  } as CommunityOrgLinkedin,
];

/**
 * Normalizes an organizer or partner name for deterministic matching.
 */
function normalize(name: string): string {
  return name.toLowerCase().replace(/['"’]/g, '').trim();
}

/**
 * Look up partner record from canonical name or alias.
 */
export function getRegisteredPartner(name?: string): RegisteredPartner | null {
  if (!name) return null;
  const norm = normalize(name);
  if (!norm) return null;

  for (const partner of REGISTERED_PARTNERS) {
    if (normalize(partner.canonicalName) === norm) {
      return partner;
    }
    for (const alias of partner.aliases) {
      if (
        norm === alias ||
        (alias.length >= 4 && norm.includes(alias)) ||
        (norm.length >= 6 && alias.includes(norm))
      ) {
        return partner;
      }
    }
  }
  return null;
}

/**
 * Returns true if the entity is a recognized active CSC Partner or Sponsor.
 */
export function isOfficialPartnerOrSponsor(name?: string): boolean {
  return getRegisteredPartner(name) !== null;
}

/**
 * Returns true if the entity is an official CSC Sponsor.
 */
export function isOfficialSponsor(name?: string): boolean {
  const partner = getRegisteredPartner(name);
  return partner !== null && partner.tier === 'Sponsor';
}

/**
 * Look up LinkedIn metadata (handle + URL) for any partner, sponsor, or community organization.
 */
export function resolveLinkedinOrg(name?: string): {
  canonicalName: string;
  linkedinHandle?: string;
  linkedinUrl?: string;
  linkedinOrgId?: string;
  apiUrnMention?: string;
  tagDisplay: string;
} | null {
  if (!name) return null;
  const norm = normalize(name);
  if (!norm) return null;

  const buildResolved = (org: {
    canonicalName: string;
    linkedinHandle?: string;
    linkedinUrl?: string;
    linkedinOrgId?: string;
  }) => ({
    canonicalName: org.canonicalName,
    linkedinHandle: org.linkedinHandle,
    linkedinUrl: org.linkedinUrl,
    linkedinOrgId: org.linkedinOrgId,
    apiUrnMention: org.linkedinOrgId
      ? `@[${org.canonicalName}](urn:li:organization:${org.linkedinOrgId})`
      : undefined,
    tagDisplay: org.linkedinHandle
      ? `@${org.canonicalName} (linkedin.com/company/${org.linkedinHandle}${org.linkedinOrgId ? ` · URN:${org.linkedinOrgId}` : ''})`
      : org.canonicalName,
  });

  // Check COMMUNITY_LINKEDIN_DIRECTORY exact/alias matches first when more specific
  for (const org of COMMUNITY_LINKEDIN_DIRECTORY) {
    if (normalize(org.canonicalName) === norm) {
      return buildResolved(org);
    }
    for (const alias of org.aliases) {
      if (norm === alias) {
        return buildResolved(org);
      }
    }
  }

  const partner = getRegisteredPartner(name);
  if (partner) {
    return buildResolved(partner);
  }

  for (const org of COMMUNITY_LINKEDIN_DIRECTORY) {
    for (const alias of org.aliases) {
      if (
        (alias.length >= 4 && norm.includes(alias)) ||
        (norm.length >= 6 && alias.includes(norm))
      ) {
        return buildResolved(org);
      }
    }
  }

  return null;
}

/**
 * Formats an organization mention for LinkedIn copy:
 * - Default mode: `@Canonical Name` when a known LinkedIn page exists, or plain name otherwise.
 * - API URN mode (`useApiUrn: true`): `@[Canonical Name](urn:li:organization:12345)` when numeric URN is known.
 */
export function formatLinkedinMention(
  name?: string,
  options?: { useApiUrn?: boolean }
): string {
  if (!name) return '';
  const resolved = resolveLinkedinOrg(name);
  if (resolved) {
    if (options?.useApiUrn && resolved.apiUrnMention) {
      return resolved.apiUrnMention;
    }
    if (resolved.linkedinHandle) {
      return `@${resolved.canonicalName}`;
    }
  }
  return name.trim();
}

export function isOfficialPartner(name?: string): boolean {
  const partner = getRegisteredPartner(name);
  return partner !== null && partner.tier !== 'Sponsor';
}

export type EventAffiliationType = 'csc' | 'partner' | 'sponsor' | 'community' | 'external';

export interface EventClassification {
  type: EventAffiliationType;
  badgeLabel: string;
  badgeClass: string;
  hostDescription: string;
  isOfficialCsc: boolean;
  isPartnerOrSponsor: boolean;
}

/**
 * Deterministically classifies an event based on its partnerName, organizerType, and partnership status.
 */
export function classifyEvent(event: {
  isPartnerEvent?: boolean;
  partnerName?: string;
  organizerType?: string;
}): EventClassification {
  const partnerName = event.partnerName?.trim();
  const isCscOrganized =
    !partnerName ||
    partnerName === 'Cyber Scotland Connect' ||
    partnerName === 'CSC';

  if (isCscOrganized && !event.isPartnerEvent) {
    return {
      type: 'csc',
      badgeLabel: 'CSC Gathering',
      badgeClass:
        'bg-sky-100 dark:bg-[#6fb7e6]/20 text-sky-800 dark:text-sky-200 border-sky-200 dark:border-[#6fb7e6]/40',
      hostDescription: 'Cyber Scotland Connect',
      isOfficialCsc: true,
      isPartnerOrSponsor: false,
    };
  }

  // Check if partnerName belongs to an official partner or sponsor
  const partnerRecord = getRegisteredPartner(partnerName);
  if (partnerRecord) {
    if (partnerRecord.tier === 'Sponsor') {
      return {
        type: 'sponsor',
        badgeLabel: `Sponsor: ${partnerName}`,
        badgeClass:
          'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-700',
        hostDescription: `${partnerName} (Official CSC Sponsor)`,
        isOfficialCsc: false,
        isPartnerOrSponsor: true,
      };
    }

    return {
      type: 'partner',
      badgeLabel: `Partner: ${partnerName}`,
      badgeClass:
        'bg-pink-100 dark:bg-[#895294]/30 text-pink-800 dark:text-pink-300 border-pink-200 dark:border-[#895294]',
      hostDescription: `${partnerName} (Official CSC Partner)`,
      isOfficialCsc: false,
      isPartnerOrSponsor: true,
    };
  }

  // Distinguish community grass-roots vs signposted external/commercial
  const isCommunity =
    event.organizerType === 'Community' ||
    event.organizerType === 'Academic';

  if (isCommunity) {
    return {
      type: 'community',
      badgeLabel: `Community: ${partnerName || 'Scottish Cyber'}`,
      badgeClass:
        'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700',
      hostDescription: `${partnerName || 'Community Organiser'} (Scottish Cyber Community)`,
      isOfficialCsc: false,
      isPartnerOrSponsor: false,
    };
  }

  // Commercial, Public Sector, or external signposting
  return {
    type: 'external',
    badgeLabel: `Signposted: ${partnerName || 'External'}`,
    badgeClass:
      'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    hostDescription: `${partnerName || 'External Organiser'} (Signposted Scottish Ecosystem Event)`,
    isOfficialCsc: false,
    isPartnerOrSponsor: false,
  };
}
