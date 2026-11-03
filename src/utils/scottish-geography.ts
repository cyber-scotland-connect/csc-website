/**
 * Scottish Geography & Royal Mail Postcode Verification Guard
 *
 * Enforces that Cyber Scotland Connect event listings are genuinely located in Scotland
 * (or online/virtual), blocking cross-border search bleed from Northern England,
 * rest-of-UK cities, and non-Scottish UK postcodes at both discovery time and build time.
 */

// Official Royal Mail outward postcode area prefixes that cover Scotland.
// Note: TD covers the Scottish Borders EXCEPT TD15 (Berwick-upon-Tweed, Northumberland, England).
// DG16 (Gretna) straddles the border slightly, but DG is predominantly Dumfries & Galloway.
export const SCOTTISH_POSTCODE_AREAS = new Set([
  'AB', // Aberdeen & Aberdeenshire
  'DD', // Dundee & Angus
  'DG', // Dumfries & Galloway
  'EH', // Edinburgh & Lothians
  'FK', // Falkirk & Stirling
  'G',  // Glasgow
  'HS', // Outer Hebrides
  'IV', // Inverness & Highlands
  'KA', // Kilmarnock & Ayrshire
  'KW', // Kirkwall, Orkney & Caithness
  'KY', // Kirkcaldy & Fife
  'ML', // Motherwell & Lanarkshire
  'PA', // Paisley, Renfrewshire & Argyll
  'PH', // Perth & Lochaber
  'TD', // Scottish Borders (excluding TD15 Berwick-upon-Tweed)
  'ZE', // Lerwick & Shetland
]);

// Matches full UK postcodes (e.g. "EH1 2EL", "G1 1XQ", "NE1 4ST", "EC2A 4NE")
const UK_FULL_POSTCODE_REGEX = /\b([A-Z]{1,2})(\d[A-Z\d]?)\s*\d[A-Z]{2}\b/gi;

// Non-Scottish UK cities, towns, counties, and regions (particularly Northern England border-bleed)
export const NON_SCOTTISH_UK_LOCATIONS = [
  // North East & North West England (within 100-mile radius of Edinburgh/Borders)
  'newcastle',
  'newcastle upon tyne',
  'gateshead',
  'sunderland',
  'durham',
  'county durham',
  'carlisle',
  'middlesbrough',
  'darlington',
  'hartlepool',
  'stockton-on-tees',
  'berwick-upon-tweed',
  'hexham',
  'alnwick',
  'morpeth',
  'tyne and wear',
  'tyneside',
  'wearside',
  'teesside',
  'northumberland',
  'cumbria',
  'penrith',
  'kendal',
  'barrow-in-furness',
  'workington',
  'whitehaven',
  // Yorkshire, Lancashire & North England
  'york',
  'yorkshire',
  'leeds',
  'sheffield',
  'bradford',
  'huddersfield',
  'wakefield',
  'halifax',
  'harrogate',
  'hull',
  'kingston upon hull',
  'doncaster',
  'rotherham',
  'barnsley',
  'lancaster',
  'lancashire',
  'preston',
  'blackpool',
  'blackburn',
  'burnley',
  'manchester',
  'greater manchester',
  'salford',
  'bolton',
  'stockport',
  'oldham',
  'wigan',
  'warrington',
  'liverpool',
  'merseyside',
  'birkenhead',
  'chester',
  'crewe',
  // Midlands, East & South England
  'stoke-on-trent',
  'derby',
  'nottingham',
  'leicester',
  'coventry',
  'birmingham',
  'west midlands',
  'east midlands',
  'wolverhampton',
  'walsall',
  'solihull',
  'worcester',
  'hereford',
  'gloucester',
  'cheltenham',
  'bristol',
  'bath',
  'exeter',
  'plymouth',
  'truro',
  'bournemouth',
  'poole',
  'southampton',
  'portsmouth',
  'winchester',
  'brighton',
  'hove',
  'canterbury',
  'maidstone',
  'guildford',
  'reading',
  'slough',
  'oxford',
  'milton keynes',
  'luton',
  'st albans',
  'watford',
  'chelmsford',
  'colchester',
  'southend',
  'ipswich',
  'norwich',
  'cambridge',
  'peterborough',
  'northampton',
  'bedford',
  'lincoln',
  'london',
  'greater london',
  'westminster',
  'croydon',
  // Wales & Northern Ireland
  'cardiff',
  'swansea',
  'newport',
  'wrexham',
  'belfast',
  'londonderry',
  'lisburn',
  'newry',
] as const;

const NON_SCOTTISH_LOCATION_REGEX = new RegExp(
  `\\b(${NON_SCOTTISH_UK_LOCATIONS.map((loc) => loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'i'
);

const EXPLICIT_SCOTTISH_PLACE_REGEX =
  /\b(Edinburgh|Glasgow|Dundee|Aberdeen|Aberdeenshire|Inverness|Stirling|Perth|Perthshire|St\s+Andrews|Scotland|Scottish|Fife|Lothian|Midlothian|East\s+Lothian|West\s+Lothian|Highland|Highlands|Falkirk|Paisley|Renfrewshire|Lanarkshire|Ayr|Ayrshire|Kilmarnock|Motherwell|Hamilton|East\s+Kilbride|Livingston|Dunfermline|Kirkcaldy|Glenrothes|Dumfries|Galloway|Galashiels|Hawick|Kelso|Peebles|Melrose|Selkirk|Oban|Fort\s+William|Inverclyde|Greenock|Dumbarton|Clydebank|Helensburgh|Stirlingshire|Clackmannanshire|Alloa|Angus|Arbroath|Montrose|Forfar|Moray|Elgin|Banff|Peterhead|Fraserburgh|Stonehaven|Aviemore|Thurso|Wick|Caithness|Sutherland|Ross-shire|Skye|Lochaber|Argyll|Bute|Arran|Islay|Mull|Orkney|Kirkwall|Shetland|Lerwick|Hebrides|Stornoway|Gogarburn|Leith)\b/i;

/**
 * Returns true if the text contains a full UK postcode outside Scotland
 * (e.g. NE1 4ST, EC2A 4NE, M1 1AG, BT1 5GS, CF10 1EP, or TD15 Berwick-upon-Tweed).
 */
export function hasNonScottishUkPostcode(text: string): boolean {
  UK_FULL_POSTCODE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = UK_FULL_POSTCODE_REGEX.exec(text)) !== null) {
    const area = match[1].toUpperCase();
    const district = `${area}${match[2].toUpperCase()}`;
    // TD15 is Berwick-upon-Tweed (Northumberland, England)
    if (district === 'TD15') {
      return true;
    }
    if (!SCOTTISH_POSTCODE_AREAS.has(area)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns true if the text contains a valid full Scottish UK postcode.
 */
export function hasScottishPostcode(text: string): boolean {
  UK_FULL_POSTCODE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = UK_FULL_POSTCODE_REGEX.exec(text)) !== null) {
    const area = match[1].toUpperCase();
    const district = `${area}${match[2].toUpperCase()}`;
    if (district !== 'TD15' && SCOTTISH_POSTCODE_AREAS.has(area)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns true if the text contains an explicit Scottish city, town, region, or valid Scottish postcode.
 */
export function hasExplicitScottishPlace(text: string): boolean {
  if (!text) return false;
  return hasScottishPostcode(text) || EXPLICIT_SCOTTISH_PLACE_REGEX.test(text);
}

/**
 * Returns true if the provided location/text references a non-Scottish UK city,
 * county, or non-Scottish UK postcode.
 *
 * Disambiguates Scottish street names (e.g. "34-38 York Pl, Edinburgh EH1 3HU"
 * or "120 Bath Street, Glasgow G2 2EN") by checking postcodes first and allowing
 * street names when paired with an explicit Scottish city or Scottish postcode.
 */
export function isNonScottishLocation(text: string): boolean {
  if (!text) return false;
  // 1. Any non-Scottish UK postcode (NE1, EC2A, M1, BT1, TD15, etc.) is unconditionally rejected
  if (hasNonScottishUkPostcode(text)) return true;
  // 2. If the string explicitly names a Scottish city/region or valid Scottish postcode,
  // street names like "York Pl, Edinburgh" or "Bath Street, Glasgow" are valid Scottish addresses
  if (hasExplicitScottishPlace(text)) return false;
  // 3. Otherwise, reject if it matches any non-Scottish UK city, county, or region
  if (NON_SCOTTISH_LOCATION_REGEX.test(text)) return true;
  return false;
}
