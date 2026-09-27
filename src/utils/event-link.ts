export interface EventActionLink {
  url: string;
  platform: 'meetup' | 'eventbrite' | 'luma' | 'linkedin' | 'github' | 'external';
  label: string;
  shortLabel: string;
  isMeetup: boolean;
  colorClass: {
    bg: string;
    hover: string;
    text: string;
    border?: string;
  };
}

/**
 * Inspects a URL and determines the accurate platform, label, and styling.
 * Guaranteed: Never labels an external/third-party link as "Meetup".
 */
export function parseEventLink(rawUrl?: string): EventActionLink | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || (!trimmed.startsWith('http://') && !trimmed.startsWith('https://'))) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    // 1. Meetup
    if (host === 'meetup.com' || host.endsWith('.meetup.com')) {
      return {
        url: trimmed,
        platform: 'meetup',
        label: 'RSVP on Meetup',
        shortLabel: 'Meetup',
        isMeetup: true,
        colorClass: {
          bg: 'bg-[#895294]',
          hover: 'hover:bg-[#9d5fa8]',
          text: 'text-white',
        },
      };
    }

    // 2. Eventbrite
    if (host.includes('eventbrite.')) {
      return {
        url: trimmed,
        platform: 'eventbrite',
        label: 'RSVP on Eventbrite',
        shortLabel: 'Eventbrite',
        isMeetup: false,
        colorClass: {
          bg: 'bg-[#e04f32]',
          hover: 'hover:bg-[#f05f42]',
          text: 'text-white',
        },
      };
    }

    // 3. Luma
    if (host === 'lu.ma' || host.endsWith('.lu.ma') || host.includes('luma.')) {
      return {
        url: trimmed,
        platform: 'luma',
        label: 'RSVP on Luma',
        shortLabel: 'Luma',
        isMeetup: false,
        colorClass: {
          bg: 'bg-[#eb3a4b]',
          hover: 'hover:bg-[#f25261]',
          text: 'text-white',
        },
      };
    }

    // 4. LinkedIn
    if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) {
      return {
        url: trimmed,
        platform: 'linkedin',
        label: 'View on LinkedIn',
        shortLabel: 'LinkedIn',
        isMeetup: false,
        colorClass: {
          bg: 'bg-[#0a66c2]',
          hover: 'hover:bg-[#084e96]',
          text: 'text-white',
        },
      };
    }

    // 5. GitHub
    if (host === 'github.com' || host.endsWith('.github.io')) {
      return {
        url: trimmed,
        platform: 'github',
        label: 'View on GitHub',
        shortLabel: 'GitHub',
        isMeetup: false,
        colorClass: {
          bg: 'bg-slate-800 dark:bg-slate-700',
          hover: 'hover:bg-slate-900 dark:hover:bg-slate-600',
          text: 'text-white',
        },
      };
    }

    // 6. Generic external event website / registration portal
    return {
      url: trimmed,
      platform: 'external',
      label: 'Register / Event Page',
      shortLabel: 'Register',
      isMeetup: false,
      colorClass: {
        bg: 'bg-[#56548c]',
        hover: 'hover:bg-[#6764a8]',
        text: 'text-white',
      },
    };
  } catch {
    return null;
  }
}

/**
 * Returns a deduplicated array of active action links for an event.
 */
export function getEventActionLinks(data: {
  meetupUrl?: string;
  registrationUrl?: string;
}): EventActionLink[] {
  const links: EventActionLink[] = [];
  const seenUrls = new Set<string>();

  // Helper to add if valid and unique
  const addLink = (url?: string) => {
    const link = parseEventLink(url);
    if (link && !seenUrls.has(link.url)) {
      links.push(link);
      seenUrls.add(link.url);
    }
  };

  addLink(data.meetupUrl);
  addLink(data.registrationUrl);

  return links;
}
