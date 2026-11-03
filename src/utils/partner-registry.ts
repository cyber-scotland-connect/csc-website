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
}

export const REGISTERED_PARTNERS: RegisteredPartner[] = [
  // Host Venues
  {
    canonicalName: 'CodeBase Edinburgh',
    tier: 'Host Venue',
    aliases: ['codebase', 'codebase edinburgh'],
  },
  {
    canonicalName: 'FreeAgent',
    tier: 'Host Venue',
    aliases: ['freeagent'],
  },
  {
    canonicalName: 'Skyscanner',
    tier: 'Host Venue',
    aliases: ['skyscanner'],
  },
  {
    canonicalName: 'Trustpilot',
    tier: 'Host Venue',
    aliases: ['trustpilot'],
  },
  {
    canonicalName: 'Wood Mackenzie',
    tier: 'Host Venue',
    aliases: ['wood mackenzie', 'woodmac'],
  },

  // Academic Partners
  {
    canonicalName: 'Abertay cyberQuarter',
    tier: 'Academic Partner',
    aliases: ['abertay cyberquarter', 'abertay university', 'abertay'],
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
  },
  {
    canonicalName: 'University of Strathclyde',
    tier: 'Academic Partner',
    aliases: ['university of strathclyde', 'strathclyde university', 'strathclyde'],
  },
  {
    canonicalName: 'The Cyber Academy',
    tier: 'Academic Partner',
    aliases: ['the cyber academy', 'cyber academy'],
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
  },
  {
    canonicalName: 'DIGIT',
    tier: 'Ecosystem Partner',
    aliases: ['digit', 'digit expo', 'scot-secure'],
  },
  {
    canonicalName: 'ScotlandIS Cyber Cluster',
    tier: 'Ecosystem Partner',
    aliases: ['scotlandis cyber cluster', 'scotlandis'],
  },
  {
    canonicalName: 'The Data Lab',
    tier: 'Ecosystem Partner',
    aliases: ['the data lab', 'data lab'],
  },

  // Sponsors
  {
    canonicalName: 'Adarma',
    tier: 'Sponsor',
    aliases: ['adarma'],
  },
  {
    canonicalName: 'Cyera UK',
    tier: 'Sponsor',
    aliases: ['cyera', 'cyera uk'],
  },
  {
    canonicalName: 'ExtraHop',
    tier: 'Sponsor',
    aliases: ['extrahop'],
  },
  {
    canonicalName: 'Harvey Nash',
    tier: 'Sponsor',
    aliases: ['harvey nash'],
  },
  {
    canonicalName: 'RiverSafe',
    tier: 'Sponsor',
    aliases: ['riversafe'],
  },
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
      if (norm === alias || norm.includes(alias) || alias.includes(norm)) {
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
 * Returns true if the entity is an official CSC Partner (Host Venue, Academic, Ecosystem).
 */
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
