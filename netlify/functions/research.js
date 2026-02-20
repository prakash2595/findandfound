// CHANGE SUMMARY:
// - Added reverse lookup: search foundation sponsor pages for org name
// - Added regional foundation database for healthcare orgs
// - Added extractLocationFromPage() to identify org's region
// - Added searchFoundationSponsorPages() to find org on sponsor lists
// - Added REGIONAL_FOUNDATIONS list of major health foundations
// - Improved sponsored foundation detection flow
// - All existing functionality preserved
// Risk Level: Medium (new feature, but isolated and additive)

import axios from 'axios';
import * as cheerio from 'cheerio';

const TIMEOUT = 15000;
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive'
};

const FOUNDATION_KEYWORDS = [
  'foundation', 'philanthropy', 'giving', 'donate', 'donation',
  'charitable', 'nonprofit', 'non-profit', 'support us', 'make a gift',
  'ways to give', 'give now', 'donor', 'fundraising', 'development'
];

const SPONSORSHIP_CONTEXT_KEYWORDS = [
  'proud sponsor', 'proudly sponsor', 'we sponsor', 'sponsor of',
  'community partner', 'community involvement', 'giving back',
  'corporate responsibility', 'social responsibility', 'csr',
  'we support', 'proudly support', 'proud to support', 'supporter of',
  'partner with', 'partnered with', 'in partnership', 'partnership with',
  'committed to', 'supporting', 'contributor', 'donation to',
  'charitable partner', 'nonprofit partner', 'community support',
  'sponsored event', 'event sponsor', 'title sponsor', 'presenting sponsor'
];

const EVENT_KEYWORDS = [
  'event', 'gala', 'golf', 'auction', 'dinner', 'luncheon',
  'fundraiser', 'benefit', 'walk', 'run', 'ball', 'celebration',
  'awards', 'ceremony', 'concert', 'festival', 'tournament', 'annual'
];

const REGISTRATION_PLATFORMS = [
  { name: 'Eventbrite', patterns: ['eventbrite.com', 'eventbrite.'] },
  { name: 'GiveSmart', patterns: ['givesmart.com', 'e.givesmart', 'givesmart'] },
  { name: 'OneCause', patterns: ['onecause.com', 'e.onecause', 'onecause'] },
  { name: 'Classy', patterns: ['classy.org', 'secure.classy', 'classy'] },
  { name: 'Greater Giving', patterns: ['greatergiving.com', 'greatergiving'] },
  { name: 'Blackbaud', patterns: ['blackbaud.com', 'blackbaud'] },
  { name: 'Network for Good', patterns: ['networkforgood.com', 'networkforgood'] },
  { name: 'Qgiv', patterns: ['qgiv.com', 'secure.qgiv'] },
  { name: 'Handbid', patterns: ['handbid.com', 'handbid'] },
  { name: 'BidPal', patterns: ['bidpal.com', 'bidpal'] },
  { name: 'Bloomerang', patterns: ['bloomerang.com', 'bloomerang'] },
  { name: 'DonorPerfect', patterns: ['donorperfect.com', 'donorperfect'] },
  { name: 'Fundly', patterns: ['fundly.com'] },
  { name: 'GoFundMe Charity', patterns: ['gofundme.com/charity'] },
  { name: 'JustGiving', patterns: ['justgiving.com'] },
  { name: 'Rallybound', patterns: ['rallybound.com'] },
  { name: 'RegFox', patterns: ['regfox.com'] },
  { name: 'Splash', patterns: ['splashthat.com'] },
  { name: 'Wild Apricot', patterns: ['wildapricot.org', 'wildapricot'] },
  { name: 'Active.com', patterns: ['active.com', 'activenetwork'] }
];

const TEAM_TITLES = [
  'head of events', 'events coordinator', 'event coordinator', 'events manager',
  'director of development', 'development director', 'chief development officer',
  'database manager', 'director of philanthropy', 'philanthropy director',
  'major gifts officer', 'major gifts', 'foundation director', 'foundation president',
  'executive director', 'vp of development', 'vice president of development',
  'gift officer', 'annual giving', 'planned giving', 'donor relations',
  'special events', 'event manager', 'event director', 'gala chair'
];

const EVENT_PAGE_PATHS = [
  '/events', '/event', '/calendar', '/upcoming-events', '/event-calendar',
  '/fundraising-events', '/special-events', '/community-events', '/galas'
];

const FOUNDATION_PAGE_PATHS = [
  '/foundation', '/giving', '/donate', '/philanthropy', '/support',
  '/ways-to-give', '/support-us', '/make-a-gift', '/get-involved'
];

const COMMUNITY_PAGE_PATHS = [
  '/community', '/community-involvement', '/about-us', '/about',
  '/corporate-responsibility', '/csr', '/social-responsibility',
  '/giving-back', '/our-community', '/partnerships', '/partners',
  '/sponsorships', '/sponsor', '/charitable-giving', '/outreach'
];

// Regional health foundations database for reverse lookup
const REGIONAL_FOUNDATIONS = [
  // Appalachian Region (TN, VA, NC, KY)
  { name: 'Ballad Health Foundation', url: 'https://www.balladhealthfoundation.org', region: ['tennessee', 'virginia', 'johnson city', 'kingsport', 'bristol', 'appalachian', 'tri-cities', 'northeast tennessee', 'southwest virginia'] },
  { name: 'Wellmont Foundation', url: 'https://www.wellmont.org/Foundation', region: ['tennessee', 'virginia', 'kingsport', 'bristol'] },
  
  // Major Health System Foundations
  { name: 'Mayo Clinic Foundation', url: 'https://philanthropy.mayoclinic.org', region: ['minnesota', 'rochester', 'jacksonville', 'phoenix', 'arizona', 'florida'] },
  { name: 'Cleveland Clinic Foundation', url: 'https://giving.ccf.org', region: ['ohio', 'cleveland', 'northeast ohio'] },
  { name: 'Johns Hopkins Foundation', url: 'https://secure.jhu.edu/form/jhm', region: ['maryland', 'baltimore'] },
  { name: 'Duke Health Foundation', url: 'https://www.dukehealth.org/giving', region: ['north carolina', 'durham', 'raleigh'] },
  { name: 'Vanderbilt Health Foundation', url: 'https://www.vumc.org/development', region: ['tennessee', 'nashville', 'middle tennessee'] },
  { name: 'Atrium Health Foundation', url: 'https://atriumhealthfoundation.org', region: ['north carolina', 'charlotte', 'south carolina'] },
  { name: 'Novant Health Foundation', url: 'https://www.novanthealth.org/foundation', region: ['north carolina', 'virginia', 'south carolina', 'winston-salem', 'charlotte'] },
  { name: 'WakeMed Foundation', url: 'https://www.wakemed.org/giving', region: ['north carolina', 'raleigh', 'wake county'] },
  { name: 'Mission Health Foundation', url: 'https://missionhealthfoundation.org', region: ['north carolina', 'asheville', 'western north carolina'] },
  { name: 'Carilion Clinic Foundation', url: 'https://www.carilionclinic.org/giving', region: ['virginia', 'roanoke', 'southwest virginia'] },
  
  // Add more regional foundations as needed
];

// Sponsor page paths to check on foundation websites
const SPONSOR_PAGE_PATHS = [
  '/sponsors', '/our-sponsors', '/event-sponsors', '/corporate-sponsors',
  '/partners', '/corporate-partners', '/community-partners',
  '/donors', '/our-donors', '/donor-recognition', '/donor-list',
  '/supporters', '/our-supporters', '/thank-you', '/acknowledgments',
  '/wine-women-shoes', '/gala', '/events', '/annual-report',
  '/giving-societies', '/corporate-giving', '/ways-to-give/sponsors'
];

const PLACEHOLDER_PATTERNS = [
  'lorem ipsum', 'john doe', 'jane doe', 'example@', 'test@',
  'your name', 'name here', 'email here', 'coming soon', 'tbd'
];

// Debug logger
const debugLog = {
  entries: [],
  log(stage, message, data = null) {
    const entry = { timestamp: new Date().toISOString(), stage, message };
    if (data) entry.data = data;
    this.entries.push(entry);
    console.log(`[${stage}] ${message}`, data || '');
  },
  getEntries() { return this.entries; },
  clear() { this.entries = []; }
};

// ============ VALIDATION HELPERS ============

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) return false;
  const lower = email.toLowerCase();
  if (PLACEHOLDER_PATTERNS.some(p => lower.includes(p))) return false;
  return true;
}

function isValidLinkedInUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (!url.includes('linkedin.com/in/')) return false;
  try {
    const u = new URL(url);
    return u.hostname.includes('linkedin.com');
  } catch { return false; }
}

function isValidPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 11;
}

function isPlaceholderText(text) {
  if (!text || typeof text !== 'string') return true;
  const lower = text.toLowerCase().trim();
  if (lower.length < 2) return true;
  if (PLACEHOLDER_PATTERNS.some(p => lower.includes(p))) return true;
  return false;
}

function isFutureDate(dateStr) {
  if (!dateStr) return null;
  const now = new Date();
  const currentYear = now.getFullYear();
  const months = {
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11,
    'january': 0, 'february': 1, 'march': 2, 'april': 3, 'june': 5,
    'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
  };
  const lower = dateStr.toLowerCase();
  let month = null, day = null, year = currentYear;
  for (const [name, idx] of Object.entries(months)) {
    if (lower.includes(name)) { month = idx; break; }
  }
  const dayMatch = lower.match(/\d{1,2}/);
  if (dayMatch) day = parseInt(dayMatch[0], 10);
  const yearMatch = lower.match(/20\d{2}/);
  if (yearMatch) year = parseInt(yearMatch[0], 10);
  if (month !== null && day !== null) {
    const eventDate = new Date(year, month, day);
    if (eventDate < now && !yearMatch) eventDate.setFullYear(currentYear + 1);
    return eventDate >= now;
  }
  return null;
}

// ============ UTILITY FUNCTIONS ============

function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return null;
  url = url.trim().replace(/[<>\"']/g, '');
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url.replace(/\/$/, '');
}

function getDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '');
  } catch { return url; }
}

function getBaseUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol + '//' + u.hostname;
  } catch { return url; }
}

function getOrgName(url) {
  const domain = getDomain(url);
  const name = domain.split('.')[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function normalizeText(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

// ============ FETCH WITH RETRY ============

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        debugLog.log('FETCH', `Retry ${attempt} for ${url}`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
      }
      const response = await axios.get(url, {
        headers: HEADERS,
        timeout: TIMEOUT,
        maxRedirects: 5,
        validateStatus: (status) => status < 400
      });
      return { html: response.data, finalUrl: response.request?.res?.responseUrl || url, success: true };
    } catch (error) {
      lastError = error;
      debugLog.log('FETCH', `Failed attempt ${attempt}: ${url}`, { error: error.message });
    }
  }
  return { html: null, finalUrl: url, success: false, error: lastError?.message };
}

async function checkUrlExists(url) {
  try {
    const response = await axios.head(url, {
      headers: HEADERS,
      timeout: 5000,
      maxRedirects: 3,
      validateStatus: (status) => status < 400
    });
    return response.status === 200;
  } catch { return false; }
}

async function findExistingPages(baseUrl, paths) {
  const found = [];
  const base = getBaseUrl(baseUrl);
  for (const path of paths) {
    const url = base + path;
    const exists = await checkUrlExists(url);
    if (exists) found.push(url);
  }
  return found;
}

// ============ LOCATION EXTRACTION ============

function extractLocationFromPage($, baseUrl) {
  const locations = [];
  const text = $('body').text().toLowerCase();
  
  // Common US states and cities
  const locationPatterns = [
    // States
    'tennessee', 'virginia', 'north carolina', 'south carolina', 'georgia',
    'kentucky', 'ohio', 'florida', 'texas', 'california', 'new york',
    'maryland', 'pennsylvania', 'minnesota', 'arizona', 'colorado',
    // Cities
    'johnson city', 'kingsport', 'bristol', 'nashville', 'knoxville',
    'charlotte', 'raleigh', 'durham', 'asheville', 'roanoke',
    'cleveland', 'rochester', 'baltimore', 'boston', 'chicago',
    // Regions
    'tri-cities', 'appalachian', 'northeast tennessee', 'southwest virginia'
  ];
  
  for (const loc of locationPatterns) {
    if (text.includes(loc)) {
      locations.push(loc);
    }
  }
  
  // Check address elements
  $('address, [class*="address"], [class*="location"], [itemprop="address"]').each((_, el) => {
    const addrText = $(el).text().toLowerCase();
    for (const loc of locationPatterns) {
      if (addrText.includes(loc) && !locations.includes(loc)) {
        locations.push(loc);
      }
    }
  });
  
  // Check footer
  $('footer').each((_, el) => {
    const footerText = $(el).text().toLowerCase();
    for (const loc of locationPatterns) {
      if (footerText.includes(loc) && !locations.includes(loc)) {
        locations.push(loc);
      }
    }
  });
  
  debugLog.log('LOCATION', `Found locations: ${locations.join(', ')}`);
  return locations;
}

// ============ REVERSE LOOKUP: SEARCH FOUNDATION SPONSOR PAGES ============

async function searchFoundationSponsorPages(orgName, orgUrl, locations) {
  debugLog.log('REVERSE', `Starting reverse lookup for "${orgName}" in regional foundations...`);
  
  const foundOnFoundations = [];
  const orgNameLower = orgName.toLowerCase();
  const orgDomain = getDomain(orgUrl);
  
  // Create search variations of org name
  const searchTerms = [
    orgNameLower,
    orgNameLower.replace(/\s+/g, ''),
    orgDomain.split('.')[0],
    // Handle common patterns like "Blue Ridge Radiology" -> "blue ridge", "blueridge"
    orgNameLower.split(' ').slice(0, 2).join(' '),
    orgNameLower.split(' ').slice(0, 2).join('')
  ];
  
  debugLog.log('REVERSE', `Search terms: ${searchTerms.join(', ')}`);
  debugLog.log('REVERSE', `Org locations: ${locations.join(', ')}`);
  
  // Find relevant regional foundations based on location
  const relevantFoundations = REGIONAL_FOUNDATIONS.filter(foundation => {
    return locations.some(loc => 
      foundation.region.some(r => r.includes(loc) || loc.includes(r))
    );
  });
  
  // If no location match, try all foundations (limited)
  const foundationsToCheck = relevantFoundations.length > 0 
    ? relevantFoundations 
    : REGIONAL_FOUNDATIONS.slice(0, 5);
  
  debugLog.log('REVERSE', `Checking ${foundationsToCheck.length} foundations: ${foundationsToCheck.map(f => f.name).join(', ')}`);
  
  for (const foundation of foundationsToCheck) {
    try {
      debugLog.log('REVERSE', `Searching ${foundation.name}...`);
      
      // Check sponsor/donor pages on this foundation's website
      const baseUrl = foundation.url.replace(/\/+$/, '');
      let foundOnPages = [];
      
      for (const path of SPONSOR_PAGE_PATHS.slice(0, 8)) {
        const pageUrl = baseUrl + path;
        
        try {
          const { html, success } = await fetchWithRetry(pageUrl, 1);
          if (!success || !html) continue;
          
          const $ = cheerio.load(html);
          const pageText = $('body').text().toLowerCase();
          
          // Search for org name in page content
          for (const term of searchTerms) {
            if (pageText.includes(term)) {
              debugLog.log('REVERSE', `FOUND "${term}" on ${pageUrl}`);
              foundOnPages.push({
                page: pageUrl,
                term: term
              });
              break;
            }
          }
        } catch (e) {
          // Page doesn't exist or error, continue
        }
      }
      
      // Also check main foundation page
      try {
        const { html, success } = await fetchWithRetry(foundation.url, 1);
        if (success && html) {
          const $ = cheerio.load(html);
          const pageText = $('body').text().toLowerCase();
          
          for (const term of searchTerms) {
            if (pageText.includes(term)) {
              debugLog.log('REVERSE', `FOUND "${term}" on main page ${foundation.url}`);
              foundOnPages.push({
                page: foundation.url,
                term: term
              });
              break;
            }
          }
        }
      } catch (e) {}
      
      if (foundOnPages.length > 0) {
        foundOnFoundations.push({
          foundation: foundation,
          foundOn: foundOnPages,
          confidence: 75 + (foundOnPages.length * 5)
        });
      }
      
    } catch (error) {
      debugLog.log('REVERSE', `Error checking ${foundation.name}: ${error.message}`);
    }
  }
  
  // Sort by confidence
  foundOnFoundations.sort((a, b) => b.confidence - a.confidence);
  
  debugLog.log('REVERSE', `Reverse lookup complete. Found on ${foundOnFoundations.length} foundations.`);
  return foundOnFoundations;
}

// ============ PLATFORM DETECTION ============

function detectPlatformFromUrl(url) {
  if (!url) return null;
  const lower = url.toLowerCase();
  for (const platform of REGISTRATION_PLATFORMS) {
    if (platform.patterns.some(pattern => lower.includes(pattern))) {
      return platform.name;
    }
  }
  return null;
}

function detectPlatformFromPage($, url) {
  const urlPlatform = detectPlatformFromUrl(url);
  if (urlPlatform) return urlPlatform;

  const allLinks = [];
  $('a[href]').each((_, el) => allLinks.push($(el).attr('href') || ''));
  $('iframe[src]').each((_, el) => allLinks.push($(el).attr('src') || ''));
  $('form[action]').each((_, el) => allLinks.push($(el).attr('action') || ''));
  $('script[src]').each((_, el) => allLinks.push($(el).attr('src') || ''));

  for (const link of allLinks) {
    const platform = detectPlatformFromUrl(link);
    if (platform) return platform;
  }
  return null;
}

async function crawlEventPage(eventUrl) {
  debugLog.log('CRAWL', `Crawling event: ${eventUrl}`);
  const { html, success } = await fetchWithRetry(eventUrl, 1);
  if (!success || !html) return null;

  try {
    const $ = cheerio.load(html);
    const result = {
      url: eventUrl,
      platform: null,
      registration_link: null,
      sponsorship_link: null
    };

    result.platform = detectPlatformFromPage($, eventUrl);

    const regKeywords = ['register', 'ticket', 'sign up', 'rsvp', 'buy ticket', 'get ticket'];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().toLowerCase();
      if (regKeywords.some(k => text.includes(k) || href.toLowerCase().includes(k))) {
        if (!result.registration_link && href.startsWith('http')) {
          result.registration_link = href;
          const platform = detectPlatformFromUrl(href);
          if (platform) result.platform = platform;
        }
      }
      if (text.includes('sponsor') && href.startsWith('http') && !result.sponsorship_link) {
        result.sponsorship_link = href;
      }
    });

    return result;
  } catch (error) {
    debugLog.log('CRAWL', `Error: ${error.message}`);
    return null;
  }
}

// ============ EVENT EXTRACTION ============

async function extractEventsFromPage($, baseUrl) {
  const events = [];
  const seen = new Set();
  const dateRegex = /(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?|\d{1,2}\/\d{1,2}\/\d{2,4}/gi;

  const eventSelectors = [
    '[class*="event"]', '[id*="event"]',
    '[class*="calendar"]', '[id*="calendar"]',
    'article', '.card', '[class*="card"]',
    '.listing', '[class*="listing"]',
    '.upcoming', '[class*="upcoming"]'
  ];

  eventSelectors.forEach(selector => {
    try {
      $(selector).each((_, el) => {
        const $el = $(el);
        const text = $el.text();
        const textLower = text.toLowerCase();

        const hasEventKeyword = EVENT_KEYWORDS.some(k => textLower.includes(k));
        const hasDate = dateRegex.test(text);
        if (!hasEventKeyword && !hasDate) return;

        let name = $el.find('h1, h2, h3, h4, h5, .title, [class*="title"]').first().text().trim();
        if (!name) name = $el.find('a').first().text().trim();
        if (!name || name.length > 200 || name.length < 3) return;

        const nameNormalized = normalizeText(name);
        if (seen.has(nameNormalized)) return;
        if (['events', 'calendar', 'event'].includes(nameNormalized)) return;
        if (isPlaceholderText(name)) return;
        seen.add(nameNormalized);

        const dateMatches = text.match(dateRegex);
        const date = dateMatches ? dateMatches[0] : null;
        const futureDate = isFutureDate(date);
        if (futureDate === false) return;

        let category = 'General Event';
        if (textLower.includes('gala')) category = 'Gala';
        else if (textLower.includes('golf')) category = 'Golf Tournament';
        else if (textLower.includes('auction')) category = 'Auction';
        else if (textLower.includes('wine')) category = 'Wine Event';
        else if (textLower.includes('walk') || textLower.includes('run')) category = 'Walk/Run';
        else if (textLower.includes('dinner') || textLower.includes('luncheon')) category = 'Dinner/Luncheon';

        let location = null;
        $el.find('[class*="location"], [class*="venue"], address').each((_, loc) => {
          const locText = $(loc).text().trim();
          if (locText.length > 3 && locText.length < 150 && !isPlaceholderText(locText)) {
            location = locText;
            return false;
          }
        });

        let link = $el.find('a').attr('href');
        if (link) {
          try {
            if (!link.startsWith('http')) link = new URL(link, baseUrl).href;
          } catch { link = null; }
        }

        events.push({
          name: name.slice(0, 150),
          category, date, location, link,
          registration_platform: null,
          registration_link: null,
          sponsorship_link: null
        });
      });
    } catch (error) {
      debugLog.log('EVENT', `Error with selector: ${error.message}`);
    }
  });

  return events;
}

// ============ FOUNDATION DETECTION ============

async function findOwnedFoundation(baseUrl, $) {
  debugLog.log('FOUNDATION', 'Step 1: Searching for owned/associated foundation...');

  const foundation = { name: null, website: null, mission: null, relationship_type: null, confidence: 0 };

  try {
    const pageTitle = $('title').text().toLowerCase();
    if (FOUNDATION_KEYWORDS.some(k => pageTitle.includes(k))) {
      foundation.name = $('title').text().split('|')[0].split('-')[0].split(':')[0].trim();
      foundation.website = baseUrl;
      foundation.relationship_type = 'owned';
      foundation.confidence = 95;
      return foundation;
    }

    const foundationLinks = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().toLowerCase().trim();
      const hrefLower = href.toLowerCase();
      if (FOUNDATION_KEYWORDS.some(k => hrefLower.includes(k) || text.includes(k))) {
        try {
          let fullUrl = href;
          if (href.startsWith('/')) fullUrl = new URL(href, baseUrl).href;
          else if (!href.startsWith('http')) fullUrl = new URL(href, baseUrl).href;
          if (!fullUrl.includes('javascript:') && !fullUrl.includes('mailto:')) {
            const score = FOUNDATION_KEYWORDS.filter(k => hrefLower.includes(k) || text.includes(k)).length;
            foundationLinks.push({ url: fullUrl, text: $(el).text().trim(), score });
          }
        } catch {}
      }
    });

    foundationLinks.sort((a, b) => b.score - a.score);
    if (foundationLinks.length > 0) {
      const best = foundationLinks[0];
      foundation.website = best.url;
      foundation.name = best.text || 'Foundation';
      const baseDomain = getDomain(baseUrl);
      const foundationDomain = getDomain(best.url);
      if (foundationDomain.includes(baseDomain.split('.')[0]) || baseDomain.includes(foundationDomain.split('.')[0])) {
        foundation.relationship_type = 'owned';
        foundation.confidence = 85;
      } else {
        foundation.relationship_type = 'associated';
        foundation.confidence = 70;
      }
      return foundation;
    }

    const foundationPages = await findExistingPages(baseUrl, FOUNDATION_PAGE_PATHS);
    if (foundationPages.length > 0) {
      foundation.website = foundationPages[0];
      foundation.name = getOrgName(baseUrl) + ' Foundation';
      foundation.relationship_type = 'owned';
      foundation.confidence = 80;
      return foundation;
    }

    const domain = getDomain(baseUrl);
    const baseDomain = domain.split('.').slice(-2).join('.');
    const subdomainUrls = [
      'https://foundation.' + baseDomain,
      'https://giving.' + baseDomain
    ];
    for (const url of subdomainUrls) {
      const exists = await checkUrlExists(url);
      if (exists) {
        foundation.website = url;
        foundation.name = getOrgName(baseUrl) + ' Foundation';
        foundation.relationship_type = 'owned';
        foundation.confidence = 85;
        return foundation;
      }
    }

    return foundation;
  } catch (error) {
    debugLog.log('FOUNDATION', `Error: ${error.message}`);
    return foundation;
  }
}

async function findSponsoredFoundations(baseUrl, $) {
  debugLog.log('SPONSORED', 'Step 2: Searching org website for sponsored foundations...');

  const sponsoredFoundations = [];
  const seen = new Set();
  const baseDomain = getDomain(baseUrl);

  const isExternalFoundation = (url, text) => {
    try {
      const domain = getDomain(url);
      if (domain === baseDomain) return false;
      const skipDomains = ['facebook.', 'twitter.', 'linkedin.', 'instagram.', 'youtube.', 'google.'];
      if (skipDomains.some(d => url.includes(d))) return false;
      return FOUNDATION_KEYWORDS.some(k => url.toLowerCase().includes(k) || text.toLowerCase().includes(k));
    } catch { return false; }
  };

  const searchPage = ($page, pageUrl) => {
    try {
      $page('a[href]').each((_, el) => {
        const href = $page(el).attr('href') || '';
        const text = $page(el).text().trim();
        const parentText = $page(el).parent().text().toLowerCase();
        const contextText = parentText + ' ' + $page(el).parent().parent().text().toLowerCase();

        if (!href.startsWith('http')) return;
        const domain = getDomain(href);
        if (seen.has(domain)) return;

        const isSponsorContext = SPONSORSHIP_CONTEXT_KEYWORDS.some(k => contextText.includes(k));
        const isFoundation = isExternalFoundation(href, text);

        if (isSponsorContext || isFoundation) {
          seen.add(domain);
          sponsoredFoundations.push({
            url: href,
            name: text || domain,
            context: isSponsorContext ? 'sponsor_mention' : 'foundation_link',
            confidence: isSponsorContext ? 75 : 60
          });
        }
      });

      $page('img[alt]').each((_, el) => {
        const alt = $page(el).attr('alt') || '';
        const parentLink = $page(el).closest('a').attr('href');
        if (parentLink && parentLink.startsWith('http')) {
          const domain = getDomain(parentLink);
          if (seen.has(domain)) return;
          if (FOUNDATION_KEYWORDS.some(k => alt.toLowerCase().includes(k))) {
            seen.add(domain);
            sponsoredFoundations.push({
              url: parentLink, name: alt, context: 'sponsor_logo', confidence: 70
            });
          }
        }
      });
    } catch (error) {
      debugLog.log('SPONSORED', `Error: ${error.message}`);
    }
  };

  searchPage($, baseUrl);

  try {
    const communityPages = await findExistingPages(baseUrl, COMMUNITY_PAGE_PATHS);
    for (const pageUrl of communityPages.slice(0, 5)) {
      const { html, success } = await fetchWithRetry(pageUrl, 1);
      if (success && html) {
        searchPage(cheerio.load(html), pageUrl);
      }
    }
  } catch (error) {
    debugLog.log('SPONSORED', `Error fetching community pages: ${error.message}`);
  }

  sponsoredFoundations.sort((a, b) => b.confidence - a.confidence);
  return sponsoredFoundations;
}

async function getFoundationDetails(foundationUrl) {
  debugLog.log('DETAILS', `Fetching: ${foundationUrl}`);
  const { html, success } = await fetchWithRetry(foundationUrl);
  if (!success || !html) return null;

  try {
    const $ = cheerio.load(html);
    const name = $('title').text().split('|')[0].split('-')[0].split(':')[0].trim();
    const mission = $('meta[name="description"]').attr('content') ||
                    $('meta[property="og:description"]').attr('content') || null;
    return {
      name: name || getDomain(foundationUrl),
      website: foundationUrl,
      mission: mission ? mission.slice(0, 500) : null,
      $: $
    };
  } catch (error) {
    debugLog.log('DETAILS', `Error: ${error.message}`);
    return null;
  }
}

// ============ TEAM CONTACTS ============

function extractTeamContacts($) {
  const contacts = [];
  const seen = new Set();
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

  const staffSelectors = [
    '[class*="staff"]', '[class*="team"]', '[class*="leadership"]',
    '[class*="people"]', '[class*="directory"]', '[class*="contact"]'
  ];

  staffSelectors.forEach(selector => {
    try {
      $(selector).find('*').each((_, el) => {
        const $el = $(el);
        const text = $el.text().toLowerCase();
        const matchedTitle = TEAM_TITLES.find(t => text.includes(t));
        if (!matchedTitle) return;

        let name = $el.find('h2, h3, h4, h5, .name, [class*="name"], strong').first().text().trim();
        if (!name || name.length > 100 || name.length < 3) return;
        if (isPlaceholderText(name)) return;
        const nameNormalized = normalizeText(name);
        if (seen.has(nameNormalized)) return;
        seen.add(nameNormalized);

        const fullText = $el.text();
        const emailMatches = fullText.match(emailRegex);
        const phoneMatches = fullText.match(phoneRegex);

        let email = null;
        if (emailMatches) {
          for (const e of emailMatches) {
            if (isValidEmail(e)) { email = e; break; }
          }
        }

        let phone = null;
        if (phoneMatches) {
          for (const p of phoneMatches) {
            if (isValidPhoneNumber(p)) { phone = p; break; }
          }
        }

        let linkedin = null;
        $el.find('a[href*="linkedin"]').each((_, a) => {
          const href = $(a).attr('href');
          if (isValidLinkedInUrl(href)) { linkedin = href; return false; }
        });

        let title = matchedTitle.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        contacts.push({ name: name.slice(0, 100), title, email, phone, linkedin_url: linkedin });
      });
    } catch (error) {
      debugLog.log('CONTACTS', `Error: ${error.message}`);
    }
  });

  return contacts.slice(0, 15);
}

// ============ MAIN HANDLER ============

export async function handler(event) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  debugLog.clear();

  try {
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    let { url } = body;
    if (!url || typeof url !== 'string') {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'URL is required' }) };
    }

    url = normalizeUrl(url);
    if (!url) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid URL' }) };
    }

    const orgName = getOrgName(url);
    debugLog.log('START', `=== Research: ${url} | Org: ${orgName} ===`);

    // Fetch main page
    const { html, finalUrl, success, error: fetchError } = await fetchWithRetry(url);
    if (!success || !html) {
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to fetch URL', details: fetchError })
      };
    }

    const $ = cheerio.load(html);
    let foundation = null;
    let foundationUrl = null;
    let $foundation = null;
    let sponsoredFoundations = [];
    let searchMethod = null;
    let overallConfidence = 0;

    // Extract location info for regional matching
    const locations = extractLocationFromPage($, finalUrl);

    // ===== STEP 1: FIND OWNED FOUNDATION =====
    try {
      foundation = await findOwnedFoundation(finalUrl, $);
      if (foundation.website) {
        const details = await getFoundationDetails(foundation.website);
        if (details) {
          foundation.name = details.name || foundation.name;
          foundation.mission = details.mission;
          $foundation = details.$;
          foundationUrl = foundation.website;
          searchMethod = 'owned_or_associated';
          overallConfidence = foundation.confidence || 80;
        }
      }
    } catch (error) {
      debugLog.log('ERROR', `Step 1 error: ${error.message}`);
    }

    // ===== STEP 2: SEARCH ORG WEBSITE FOR SPONSORED FOUNDATIONS =====
    if (!foundation.website) {
      try {
        sponsoredFoundations = await findSponsoredFoundations(finalUrl, $);
        if (sponsoredFoundations.length > 0) {
          for (const candidate of sponsoredFoundations) {
            if (candidate.url) {
              const details = await getFoundationDetails(candidate.url);
              if (details) {
                foundation = {
                  name: details.name,
                  website: details.website,
                  mission: details.mission,
                  relationship_type: 'sponsored',
                  confidence: candidate.confidence || 65
                };
                $foundation = details.$;
                foundationUrl = candidate.url;
                searchMethod = 'sponsored_from_org_website';
                overallConfidence = candidate.confidence || 65;
                debugLog.log('FOUNDATION', `Found via org website: ${foundation.name}`);
                break;
              }
            }
          }
        }
      } catch (error) {
        debugLog.log('ERROR', `Step 2 error: ${error.message}`);
      }
    }

    // ===== STEP 3: REVERSE LOOKUP - SEARCH FOUNDATION SPONSOR PAGES =====
    if (!foundation.website) {
      try {
        debugLog.log('REVERSE', 'Step 3: Reverse lookup - searching foundation sponsor pages...');
        
        // Extract company name from page for better matching
        let companyName = orgName;
        const titleText = $('title').text();
        if (titleText && titleText.length < 100) {
          // Try to get better company name from title
          const cleanTitle = titleText.split('|')[0].split('-')[0].split(':')[0].trim();
          if (cleanTitle.length > 3 && cleanTitle.length < 50) {
            companyName = cleanTitle;
          }
        }
        
        // Also try meta tags
        const ogSiteName = $('meta[property="og:site_name"]').attr('content');
        if (ogSiteName && ogSiteName.length > 3 && ogSiteName.length < 50) {
          companyName = ogSiteName;
        }
        
        debugLog.log('REVERSE', `Using company name: "${companyName}"`);
        
        const reverseResults = await searchFoundationSponsorPages(companyName, url, locations);
        
        if (reverseResults.length > 0) {
          const bestMatch = reverseResults[0];
          debugLog.log('REVERSE', `Best match: ${bestMatch.foundation.name} (confidence: ${bestMatch.confidence})`);
          
          const details = await getFoundationDetails(bestMatch.foundation.url);
          if (details) {
            foundation = {
              name: details.name,
              website: details.website,
              mission: details.mission,
              relationship_type: 'sponsored',
              confidence: bestMatch.confidence
            };
            $foundation = details.$;
            foundationUrl = bestMatch.foundation.url;
            searchMethod = 'reverse_lookup_sponsor_page';
            overallConfidence = bestMatch.confidence;
            
            // Add info about where we found the sponsorship
            foundation.found_on_pages = bestMatch.foundOn.map(f => f.page);
            
            debugLog.log('FOUNDATION', `Found via reverse lookup: ${foundation.name}`);
          }
        }
      } catch (error) {
        debugLog.log('ERROR', `Step 3 error: ${error.message}`);
      }
    }

    // ===== STEP 4: NO FOUNDATION FOUND =====
    if (!foundation || !foundation.website) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'FOUNDATION_NOT_FOUND',
          message: 'Could not identify a foundation owned by, associated with, or sponsored by this organization.',
          searched_url: url,
          organization_name: orgName,
          locations_detected: locations,
          confidence_score: 0,
          search_steps_completed: [
            'Checked org website for foundation links',
            'Checked common foundation URL paths',
            'Searched org community/partnership pages',
            'Reverse lookup: searched regional foundation sponsor pages'
          ],
          regional_foundations_checked: REGIONAL_FOUNDATIONS.filter(f => 
            locations.some(loc => f.region.some(r => r.includes(loc) || loc.includes(r)))
          ).map(f => f.name),
          debug_log: debugLog.getEntries()
        })
      };
    }

    // ===== STEP 5: EXTRACT EVENTS =====
    let allEvents = [];
    try {
      debugLog.log('EVENTS', 'Extracting events from foundation...');
      if ($foundation) {
        const foundationEvents = await extractEventsFromPage($foundation, foundationUrl);
        allEvents.push(...foundationEvents);

        const eventPages = await findExistingPages(foundationUrl, EVENT_PAGE_PATHS);
        for (const eventPage of eventPages.slice(0, 3)) {
          const { html: eventHtml, success } = await fetchWithRetry(eventPage, 1);
          if (success && eventHtml) {
            const $events = cheerio.load(eventHtml);
            const pageEvents = await extractEventsFromPage($events, eventPage);
            allEvents.push(...pageEvents);
          }
        }
      }

      // Deduplicate
      const seenEvents = new Set();
      allEvents = allEvents.filter(evt => {
        const key = normalizeText(evt.name);
        if (seenEvents.has(key)) return false;
        seenEvents.add(key);
        return true;
      });
    } catch (error) {
      debugLog.log('ERROR', `Events error: ${error.message}`);
    }

    // ===== STEP 6: CRAWL EVENT PAGES =====
    try {
      for (const evt of allEvents.slice(0, 8)) {
        if (evt.link) {
          const eventDetails = await crawlEventPage(evt.link);
          if (eventDetails) {
            evt.registration_platform = eventDetails.platform || 'UNKNOWN';
            evt.registration_link = eventDetails.registration_link || evt.link;
            evt.sponsorship_link = eventDetails.sponsorship_link;
          } else {
            evt.registration_platform = detectPlatformFromUrl(evt.link) || 'UNKNOWN';
            evt.registration_link = evt.link;
          }
        } else {
          evt.registration_platform = 'UNKNOWN';
        }
      }
      for (const evt of allEvents.slice(8)) {
        evt.registration_platform = evt.link ? detectPlatformFromUrl(evt.link) || 'UNKNOWN' : 'UNKNOWN';
        evt.registration_link = evt.link;
      }
    } catch (error) {
      debugLog.log('ERROR', `Crawl error: ${error.message}`);
    }

    // ===== STEP 7: EXTRACT CONTACTS =====
    let teamContacts = [];
    try {
      teamContacts = $foundation ? extractTeamContacts($foundation) : [];
    } catch (error) {
      debugLog.log('ERROR', `Contacts error: ${error.message}`);
    }

    // ===== BUILD RESULT =====
    const registrationTools = allEvents.map(evt => ({
      event_name: evt.name,
      registration_platform: evt.registration_platform || 'UNKNOWN',
      registration_link: evt.registration_link,
      sponsorship_link: evt.sponsorship_link
    }));

    const events = allEvents.map(evt => ({
      name: evt.name,
      category: evt.category,
      date: evt.date,
      location: evt.location,
      link: evt.link
    }));

    const result = {
      foundation: {
        name: foundation.name || 'Foundation',
        website: foundation.website,
        mission: foundation.mission,
        relationship_type: foundation.relationship_type || 'unknown',
        found_on_pages: foundation.found_on_pages || null
      },
      events,
      registration_tools: registrationTools,
      team_contacts: teamContacts.map(c => ({
        name: c.name,
        title: c.title,
        email: c.email,
        phone: c.phone,
        linkedin_url: c.linkedin_url
      })),
      confidence_score: overallConfidence,
      meta: {
        source_url: url,
        organization_name: orgName,
        foundation_url: foundationUrl,
        search_method: searchMethod,
        locations_detected: locations,
        scraped_at: new Date().toISOString(),
        events_found: events.length,
        contacts_found: teamContacts.length
      }
    };

    debugLog.log('COMPLETE', `=== Done: ${foundation.name} | ${events.length} events | ${teamContacts.length} contacts ===`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result, null, 2)
    };

  } catch (error) {
    debugLog.log('FATAL', `Unhandled error: ${error.message}`);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        debug_log: debugLog.getEntries()
      })
    };
  }
}
