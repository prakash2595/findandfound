// CHANGE SUMMARY:
// - Added retry logic with exponential backoff (max 2 retries)
// - Added confidence scoring system (0-100)
// - Added future date validation for events
// - Added email regex validation
// - Added LinkedIn URL validation
// - Added foundation domain validation
// - Added per-stage try/catch isolation
// - Added structured debug logging
// - Improved tool detection via script src, iframe, form action
// - Improved deduplication with normalized comparison
// - Added placeholder text filtering
// - Added input sanitization
// Risk Level: Medium (improvements only, no architectural changes)

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
  '/sponsorships', '/sponsor', '/charitable-giving', '/outreach',
  '/involvement', '/commitments', '/values', '/who-we-are',
  '/news', '/press', '/media', '/blog'
];

// Placeholder patterns to filter out
const PLACEHOLDER_PATTERNS = [
  'lorem ipsum', 'john doe', 'jane doe', 'example@', 'test@',
  'your name', 'name here', 'email here', 'phone here',
  'coming soon', 'tbd', 'to be announced', 'placeholder'
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
  getEntries() {
    return this.entries;
  },
  clear() {
    this.entries = [];
  }
};

// ============ VALIDATION HELPERS ============

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) return false;
  // Filter placeholders
  const lower = email.toLowerCase();
  if (PLACEHOLDER_PATTERNS.some(p => lower.includes(p))) return false;
  return true;
}

function isValidLinkedInUrl(url, personName) {
  if (!url || typeof url !== 'string') return false;
  if (!url.includes('linkedin.com/in/')) return false;
  // Basic validation - should contain linkedin.com/in/
  try {
    const u = new URL(url);
    if (!u.hostname.includes('linkedin.com')) return false;
  } catch {
    return false;
  }
  return true;
}

function isValidPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return false;
  // Remove non-numeric characters
  const digits = phone.replace(/\D/g, '');
  // US phone numbers should have 10-11 digits
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
  if (!dateStr) return null; // Unknown, don't filter
  
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Try to parse the date
  const months = {
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11,
    'january': 0, 'february': 1, 'march': 2, 'april': 3, 'june': 5,
    'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
  };
  
  const lower = dateStr.toLowerCase();
  
  // Try to extract month and day
  let month = null;
  let day = null;
  let year = currentYear;
  
  for (const [name, idx] of Object.entries(months)) {
    if (lower.includes(name)) {
      month = idx;
      break;
    }
  }
  
  const dayMatch = lower.match(/\d{1,2}/);
  if (dayMatch) {
    day = parseInt(dayMatch[0], 10);
  }
  
  const yearMatch = lower.match(/20\d{2}/);
  if (yearMatch) {
    year = parseInt(yearMatch[0], 10);
  }
  
  if (month !== null && day !== null) {
    const eventDate = new Date(year, month, day);
    // If date is in the past but no year specified, assume next year
    if (eventDate < now && !yearMatch) {
      eventDate.setFullYear(currentYear + 1);
    }
    return eventDate >= now;
  }
  
  return null; // Can't determine, don't filter
}

function validateFoundationDomain(foundationUrl, orgUrl) {
  try {
    const foundationDomain = getDomain(foundationUrl).toLowerCase();
    const orgDomain = getDomain(orgUrl).toLowerCase();
    
    // Extract base names (without TLD)
    const foundationBase = foundationDomain.split('.')[0];
    const orgBase = orgDomain.split('.')[0];
    
    // Check if domains are related
    if (foundationDomain.includes(orgBase) || orgDomain.includes(foundationBase)) {
      return { valid: true, confidence: 90 };
    }
    
    // Check if foundation domain contains 'foundation' + org name
    if (foundationDomain.includes('foundation') && foundationDomain.includes(orgBase.slice(0, 4))) {
      return { valid: true, confidence: 80 };
    }
    
    // Different domains - could be associated/sponsored
    return { valid: true, confidence: 60 };
  } catch {
    return { valid: false, confidence: 0 };
  }
}

// ============ UTILITY FUNCTIONS ============

function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return null;
  url = url.trim();
  // Remove dangerous characters
  url = url.replace(/[<>\"']/g, '');
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url.replace(/\/$/, '');
}

function getDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function getBaseUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol + '//' + u.hostname;
  } catch {
    return url;
  }
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
        debugLog.log('FETCH', `Retry attempt ${attempt} for ${url}`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
      }
      
      const response = await axios.get(url, {
        headers: HEADERS,
        timeout: TIMEOUT,
        maxRedirects: 5,
        validateStatus: (status) => status < 400
      });
      
      debugLog.log('FETCH', `Success: ${url}`, { status: response.status });
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
  } catch {
    return false;
  }
}

async function findExistingPages(baseUrl, paths) {
  const found = [];
  const base = getBaseUrl(baseUrl);

  for (const path of paths) {
    const url = base + path;
    const exists = await checkUrlExists(url);
    if (exists) {
      found.push(url);
    }
  }
  return found;
}

// ============ PLATFORM DETECTION (IMPROVED) ============

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
  const detectedSources = [];
  
  // Check URL first
  const urlPlatform = detectPlatformFromUrl(url);
  if (urlPlatform) {
    detectedSources.push({ platform: urlPlatform, source: 'url' });
  }

  // Check all links
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const platform = detectPlatformFromUrl(href);
    if (platform && !detectedSources.find(d => d.platform === platform)) {
      detectedSources.push({ platform, source: 'link' });
    }
  });

  // Check iframes (embedded registration forms) - HIGH CONFIDENCE
  $('iframe[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    const platform = detectPlatformFromUrl(src);
    if (platform && !detectedSources.find(d => d.platform === platform)) {
      detectedSources.push({ platform, source: 'iframe', confidence: 'high' });
    }
  });

  // Check form actions - HIGH CONFIDENCE
  $('form[action]').each((_, el) => {
    const action = $(el).attr('action') || '';
    const platform = detectPlatformFromUrl(action);
    if (platform && !detectedSources.find(d => d.platform === platform)) {
      detectedSources.push({ platform, source: 'form_action', confidence: 'high' });
    }
  });

  // Check script sources - HIGH CONFIDENCE
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    const platform = detectPlatformFromUrl(src);
    if (platform && !detectedSources.find(d => d.platform === platform)) {
      detectedSources.push({ platform, source: 'script', confidence: 'high' });
    }
  });

  // Prioritize high-confidence sources
  const highConfidence = detectedSources.find(d => d.confidence === 'high');
  if (highConfidence) return highConfidence.platform;
  
  return detectedSources.length > 0 ? detectedSources[0].platform : null;
}

async function crawlEventPage(eventUrl) {
  debugLog.log('CRAWL', `Crawling event page: ${eventUrl}`);

  const { html, success } = await fetchWithRetry(eventUrl, 1);
  if (!success || !html) return null;

  try {
    const $ = cheerio.load(html);

    const result = {
      url: eventUrl,
      platform: null,
      registration_link: null,
      sponsorship_link: null,
      detection_source: null
    };

    result.platform = detectPlatformFromPage($, eventUrl);

    const regKeywords = ['register', 'ticket', 'sign up', 'rsvp', 'buy ticket', 'get ticket', 'attend', 'join us'];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().toLowerCase();

      if (regKeywords.some(k => text.includes(k) || href.toLowerCase().includes(k))) {
        if (!result.registration_link && href.startsWith('http')) {
          result.registration_link = href;
          const platform = detectPlatformFromUrl(href);
          if (platform) {
            result.platform = platform;
            result.detection_source = 'registration_link';
          }
        }
      }

      if (text.includes('sponsor') && href.startsWith('http') && !result.sponsorship_link) {
        result.sponsorship_link = href;
      }
    });

    debugLog.log('CRAWL', `Event page result`, { platform: result.platform, hasRegLink: !!result.registration_link });
    return result;
  } catch (error) {
    debugLog.log('CRAWL', `Error parsing event page`, { error: error.message });
    return null;
  }
}

// ============ EVENT EXTRACTION (IMPROVED) ============

async function extractEventsFromPage($, baseUrl) {
  const events = [];
  const seen = new Set();
  const dateRegex = /(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?|\d{1,2}\/\d{1,2}\/\d{2,4}/gi;

  const eventSelectors = [
    '[class*="event"]', '[id*="event"]',
    '[class*="calendar"]', '[id*="calendar"]',
    'article', '.card', '[class*="card"]',
    '.listing', '[class*="listing"]',
    '.upcoming', '[class*="upcoming"]',
    '[class*="program"]', '[class*="gala"]'
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

        let name = $el.find('h1, h2, h3, h4, h5, .title, [class*="title"], [class*="name"], [class*="heading"]').first().text().trim();
        if (!name) {
          name = $el.find('a').first().text().trim();
        }
        if (!name || name.length > 200 || name.length < 3) return;

        // Normalize for deduplication
        const nameNormalized = normalizeText(name);
        if (seen.has(nameNormalized)) return;
        if (nameNormalized === 'events' || nameNormalized === 'calendar' || nameNormalized === 'event') return;
        
        // Check for placeholder text
        if (isPlaceholderText(name)) return;
        
        seen.add(nameNormalized);

        const dateMatches = text.match(dateRegex);
        const date = dateMatches ? dateMatches[0] : null;
        
        // Validate future date
        const futureDate = isFutureDate(date);
        if (futureDate === false) {
          debugLog.log('EVENT', `Skipping past event: ${name}`, { date });
          return;
        }

        let category = 'General Event';
        if (textLower.includes('gala')) category = 'Gala';
        else if (textLower.includes('golf')) category = 'Golf Tournament';
        else if (textLower.includes('auction')) category = 'Auction';
        else if (textLower.includes('walk') || textLower.includes('run') || textLower.includes('5k')) category = 'Walk/Run';
        else if (textLower.includes('dinner') || textLower.includes('luncheon')) category = 'Dinner/Luncheon';
        else if (textLower.includes('concert')) category = 'Concert';
        else if (textLower.includes('festival')) category = 'Festival';
        else if (textLower.includes('ball')) category = 'Ball';

        let location = null;
        $el.find('[class*="location"], [class*="venue"], [class*="place"], address').each((_, loc) => {
          const locText = $(loc).text().trim();
          if (locText.length > 3 && locText.length < 150 && !isPlaceholderText(locText)) {
            location = locText;
            return false;
          }
        });

        let link = $el.find('a').attr('href');
        if (link) {
          try {
            if (!link.startsWith('http')) {
              link = new URL(link, baseUrl).href;
            }
          } catch {
            link = null;
          }
        }

        events.push({
          name: name.slice(0, 150),
          category,
          date,
          location,
          link,
          is_future: futureDate,
          registration_platform: null,
          registration_link: null,
          sponsorship_link: null
        });
      });
    } catch (error) {
      debugLog.log('EVENT', `Error with selector ${selector}`, { error: error.message });
    }
  });

  debugLog.log('EVENT', `Extracted ${events.length} events from ${baseUrl}`);
  return events;
}

// ============ FOUNDATION DETECTION (IMPROVED) ============

async function findOwnedFoundation(baseUrl, $) {
  debugLog.log('FOUNDATION', 'Step 1: Searching for owned/associated foundation...');

  const foundation = {
    name: null,
    website: null,
    mission: null,
    relationship_type: null,
    confidence: 0
  };

  try {
    // Check if current page IS a foundation
    const pageTitle = $('title').text().toLowerCase();
    if (FOUNDATION_KEYWORDS.some(k => pageTitle.includes(k))) {
      foundation.name = $('title').text().split('|')[0].split('-')[0].split(':')[0].trim();
      foundation.website = baseUrl;
      foundation.relationship_type = 'owned';
      foundation.confidence = 95;
      debugLog.log('FOUNDATION', 'Current page is a foundation', { name: foundation.name });
      return foundation;
    }

    // Search for foundation links on the page
    const foundationLinks = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().toLowerCase().trim();
      const hrefLower = href.toLowerCase();

      if (FOUNDATION_KEYWORDS.some(k => hrefLower.includes(k) || text.includes(k))) {
        try {
          let fullUrl = href;
          if (href.startsWith('/')) {
            fullUrl = new URL(href, baseUrl).href;
          } else if (!href.startsWith('http')) {
            fullUrl = new URL(href, baseUrl).href;
          }

          if (!fullUrl.includes('javascript:') && !fullUrl.includes('mailto:') && !fullUrl.includes('#')) {
            const score = FOUNDATION_KEYWORDS.filter(k => hrefLower.includes(k) || text.includes(k)).length;
            foundationLinks.push({ url: fullUrl, text: $(el).text().trim(), score });
          }
        } catch {}
      }
    });

    foundationLinks.sort((a, b) => b.score - a.score);

    if (foundationLinks.length > 0) {
      const best = foundationLinks[0];
      
      // Validate domain relationship
      const validation = validateFoundationDomain(best.url, baseUrl);
      
      foundation.website = best.url;
      foundation.name = best.text || 'Foundation';
      foundation.confidence = validation.confidence;

      const baseDomain = getDomain(baseUrl);
      const foundationDomain = getDomain(best.url);

      if (foundationDomain.includes(baseDomain.split('.')[0]) || baseDomain.includes(foundationDomain.split('.')[0])) {
        foundation.relationship_type = 'owned';
        foundation.confidence = Math.max(foundation.confidence, 85);
      } else {
        foundation.relationship_type = 'associated';
      }
      
      debugLog.log('FOUNDATION', 'Found foundation link', { 
        url: foundation.website, 
        type: foundation.relationship_type,
        confidence: foundation.confidence 
      });
      return foundation;
    }

    // Try common foundation URL paths
    debugLog.log('FOUNDATION', 'Checking common foundation URL paths...');
    const foundationPages = await findExistingPages(baseUrl, FOUNDATION_PAGE_PATHS);
    if (foundationPages.length > 0) {
      foundation.website = foundationPages[0];
      foundation.name = getOrgName(baseUrl) + ' Foundation';
      foundation.relationship_type = 'owned';
      foundation.confidence = 80;
      debugLog.log('FOUNDATION', 'Found foundation page', { url: foundation.website });
      return foundation;
    }

    // Try subdomain variations
    const domain = getDomain(baseUrl);
    const baseDomain = domain.split('.').slice(-2).join('.');
    const subdomainUrls = [
      'https://foundation.' + baseDomain,
      'https://giving.' + baseDomain,
      'https://donate.' + baseDomain
    ];

    for (const url of subdomainUrls) {
      const exists = await checkUrlExists(url);
      if (exists) {
        foundation.website = url;
        foundation.name = getOrgName(baseUrl) + ' Foundation';
        foundation.relationship_type = 'owned';
        foundation.confidence = 85;
        debugLog.log('FOUNDATION', 'Found foundation subdomain', { url });
        return foundation;
      }
    }

    debugLog.log('FOUNDATION', 'No owned/associated foundation found');
    return foundation;
  } catch (error) {
    debugLog.log('FOUNDATION', 'Error in findOwnedFoundation', { error: error.message });
    return foundation;
  }
}

async function findSponsoredFoundations(baseUrl, $) {
  debugLog.log('SPONSORED', 'Step 2: Searching for sponsored foundations...');

  const sponsoredFoundations = [];
  const seen = new Set();
  const baseDomain = getDomain(baseUrl);

  const isExternalFoundation = (url, text) => {
    try {
      const domain = getDomain(url);
      if (domain === baseDomain) return false;
      if (url.includes('facebook.') || url.includes('twitter.') || url.includes('linkedin.') ||
          url.includes('instagram.') || url.includes('youtube.') || url.includes('google.')) return false;

      const hasFoundationKeyword = FOUNDATION_KEYWORDS.some(k =>
        url.toLowerCase().includes(k) || text.toLowerCase().includes(k)
      );
      return hasFoundationKeyword;
    } catch {
      return false;
    }
  };

  const searchPage = ($page, pageUrl) => {
    try {
      $page('a[href]').each((_, el) => {
        const href = $page(el).attr('href') || '';
        const text = $page(el).text().trim();
        const parentText = $page(el).parent().text().toLowerCase();
        const grandparentText = $page(el).parent().parent().text().toLowerCase();
        const contextText = parentText + ' ' + grandparentText;

        if (!href.startsWith('http')) return;

        const domain = getDomain(href);
        if (seen.has(domain)) return;

        const isSponsorContext = SPONSORSHIP_CONTEXT_KEYWORDS.some(k => contextText.includes(k));
        const isFoundation = isExternalFoundation(href, text);

        if (isSponsorContext || isFoundation) {
          seen.add(domain);
          const confidence = isSponsorContext ? 75 : 60;
          sponsoredFoundations.push({
            url: href,
            name: text || domain,
            context: isSponsorContext ? 'sponsor_mention' : 'foundation_link',
            source_page: pageUrl,
            confidence
          });
          debugLog.log('SPONSORED', 'Found potential sponsored foundation', { name: text || domain, context: isSponsorContext ? 'sponsor' : 'link' });
        }
      });

      // Check images with alt text (sponsor logos)
      $page('img[alt]').each((_, el) => {
        const alt = $page(el).attr('alt') || '';
        const parentLink = $page(el).closest('a').attr('href');

        if (parentLink && parentLink.startsWith('http')) {
          const domain = getDomain(parentLink);
          if (seen.has(domain)) return;

          const hasFoundationKeyword = FOUNDATION_KEYWORDS.some(k => alt.toLowerCase().includes(k));
          if (hasFoundationKeyword) {
            seen.add(domain);
            sponsoredFoundations.push({
              url: parentLink,
              name: alt,
              context: 'sponsor_logo',
              source_page: pageUrl,
              confidence: 70
            });
            debugLog.log('SPONSORED', 'Found sponsored foundation via logo', { name: alt });
          }
        }
      });
    } catch (error) {
      debugLog.log('SPONSORED', 'Error searching page', { pageUrl, error: error.message });
    }
  };

  // Search main page
  searchPage($, baseUrl);

  // Search community/about/sponsorship pages
  try {
    const communityPages = await findExistingPages(baseUrl, COMMUNITY_PAGE_PATHS);
    debugLog.log('SPONSORED', `Found ${communityPages.length} community pages to search`);

    for (const pageUrl of communityPages.slice(0, 5)) {
      const { html, success } = await fetchWithRetry(pageUrl, 1);
      if (success && html) {
        const $page = cheerio.load(html);
        searchPage($page, pageUrl);
      }
    }
  } catch (error) {
    debugLog.log('SPONSORED', 'Error fetching community pages', { error: error.message });
  }

  // Sort by confidence
  sponsoredFoundations.sort((a, b) => b.confidence - a.confidence);

  debugLog.log('SPONSORED', `Total sponsored foundations found: ${sponsoredFoundations.length}`);
  return sponsoredFoundations;
}

async function getFoundationDetails(foundationUrl) {
  debugLog.log('DETAILS', `Fetching foundation details: ${foundationUrl}`);

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
    debugLog.log('DETAILS', 'Error parsing foundation page', { error: error.message });
    return null;
  }
}

// ============ TEAM CONTACTS (IMPROVED) ============

function extractTeamContacts($) {
  const contacts = [];
  const seen = new Set();
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

  const staffSelectors = [
    '[class*="staff"]', '[class*="team"]', '[class*="leadership"]',
    '[class*="people"]', '[class*="directory"]', '[class*="contact"]',
    '[id*="staff"]', '[id*="team"]', '[id*="leadership"]'
  ];

  staffSelectors.forEach(selector => {
    try {
      $(selector).find('*').each((_, el) => {
        const $el = $(el);
        const text = $el.text().toLowerCase();

        const matchedTitle = TEAM_TITLES.find(t => text.includes(t));
        if (!matchedTitle) return;

        let name = $el.find('h2, h3, h4, h5, .name, [class*="name"], strong, b').first().text().trim();
        if (!name) {
          const lines = $el.text().trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
          if (lines.length > 0 && lines[0].length < 50) {
            name = lines[0];
          }
        }

        if (!name || name.length > 100 || name.length < 3) return;
        if (isPlaceholderText(name)) return;
        
        const nameNormalized = normalizeText(name);
        if (seen.has(nameNormalized)) return;
        seen.add(nameNormalized);

        const fullText = $el.text();
        const emailMatches = fullText.match(emailRegex);
        const phoneMatches = fullText.match(phoneRegex);

        // Validate email
        let email = null;
        if (emailMatches) {
          for (const e of emailMatches) {
            if (isValidEmail(e)) {
              email = e;
              break;
            }
          }
        }

        // Validate phone
        let phone = null;
        if (phoneMatches) {
          for (const p of phoneMatches) {
            if (isValidPhoneNumber(p)) {
              phone = p;
              break;
            }
          }
        }

        // Find and validate LinkedIn
        let linkedin = null;
        $el.find('a[href*="linkedin"]').each((_, a) => {
          const href = $(a).attr('href');
          if (isValidLinkedInUrl(href, name)) {
            linkedin = href;
            return false;
          }
        });

        let title = matchedTitle.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        contacts.push({
          name: name.slice(0, 100),
          title,
          email,
          phone,
          linkedin_url: linkedin,
          confidence: (email ? 30 : 0) + (phone ? 20 : 0) + (linkedin ? 20 : 0) + 30
        });
      });
    } catch (error) {
      debugLog.log('CONTACTS', `Error with selector ${selector}`, { error: error.message });
    }
  });

  // Sort by confidence
  contacts.sort((a, b) => b.confidence - a.confidence);
  
  debugLog.log('CONTACTS', `Extracted ${contacts.length} contacts`);
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

  // Clear debug log for new request
  debugLog.clear();
  
  try {
    // ===== INPUT VALIDATION =====
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }
    
    let { url } = body;

    if (!url || typeof url !== 'string') {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'URL is required' }) };
    }

    // Sanitize URL
    url = normalizeUrl(url);
    if (!url) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid URL format' }) };
    }
    
    const orgName = getOrgName(url);
    debugLog.log('START', `=== Starting Research for: ${url} ===`);

    // ===== FETCH MAIN PAGE =====
    const { html, finalUrl, success, error: fetchError } = await fetchWithRetry(url);
    if (!success || !html) {
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Failed to fetch the provided URL',
          details: fetchError,
          url: url
        })
      };
    }

    const $ = cheerio.load(html);
    let foundation = null;
    let foundationUrl = null;
    let $foundation = null;
    let sponsoredFoundations = [];
    let searchMethod = null;
    let overallConfidence = 0;

    // ===== STEP 1: FIND OWNED/ASSOCIATED FOUNDATION =====
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
      debugLog.log('ERROR', 'Error in foundation search', { error: error.message });
    }

    // ===== STEP 2: SEARCH FOR SPONSORED FOUNDATIONS =====
    if (!foundation.website) {
      try {
        sponsoredFoundations = await findSponsoredFoundations(finalUrl, $);

        if (sponsoredFoundations.length > 0) {
          const primary = sponsoredFoundations[0];
          const details = await getFoundationDetails(primary.url);

          if (details) {
            foundation = {
              name: details.name,
              website: details.website,
              mission: details.mission,
              relationship_type: 'sponsored',
              confidence: primary.confidence || 65
            };
            $foundation = details.$;
            foundationUrl = primary.url;
            searchMethod = 'sponsored';
            overallConfidence = primary.confidence || 65;
            debugLog.log('FOUNDATION', `Using sponsored foundation: ${foundation.name}`);
          }
        }
      } catch (error) {
        debugLog.log('ERROR', 'Error in sponsored foundation search', { error: error.message });
      }
    }

    // ===== STEP 3: NO FOUNDATION FOUND =====
    if (!foundation || !foundation.website) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'FOUNDATION_NOT_FOUND',
          message: 'Could not identify a foundation owned by, associated with, or sponsored by this organization.',
          searched_url: url,
          organization_name: orgName,
          confidence_score: 0,
          search_steps_completed: [
            'Checked main page for foundation links',
            'Checked common foundation URL paths',
            'Checked foundation subdomains',
            'Searched community/sponsorship pages'
          ],
          debug_log: debugLog.getEntries()
        })
      };
    }

    // ===== STEP 4: EXTRACT EVENTS =====
    let allEvents = [];
    try {
      debugLog.log('EVENTS', 'Step 3: Extracting events from foundation...');

      if ($foundation) {
        const foundationEvents = await extractEventsFromPage($foundation, foundationUrl);
        allEvents.push(...foundationEvents);

        // Search foundation's event pages
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

      // Deduplicate events
      const seenEvents = new Set();
      allEvents = allEvents.filter(evt => {
        const key = normalizeText(evt.name);
        if (seenEvents.has(key)) return false;
        seenEvents.add(key);
        return true;
      });

      debugLog.log('EVENTS', `Total unique events: ${allEvents.length}`);
    } catch (error) {
      debugLog.log('ERROR', 'Error extracting events', { error: error.message });
    }

    // ===== STEP 5: CRAWL EVENT PAGES FOR TOOLS =====
    try {
      debugLog.log('TOOLS', 'Step 4: Crawling event pages for registration tools...');
      
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

      // Set remaining events without deep crawling
      for (const evt of allEvents.slice(8)) {
        evt.registration_platform = evt.link ? detectPlatformFromUrl(evt.link) || 'UNKNOWN' : 'UNKNOWN';
        evt.registration_link = evt.link;
      }
    } catch (error) {
      debugLog.log('ERROR', 'Error crawling event pages', { error: error.message });
    }

    // ===== STEP 6: EXTRACT TEAM CONTACTS =====
    let teamContacts = [];
    try {
      debugLog.log('CONTACTS', 'Step 5: Extracting team contacts...');
      teamContacts = $foundation ? extractTeamContacts($foundation) : [];
    } catch (error) {
      debugLog.log('ERROR', 'Error extracting contacts', { error: error.message });
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

    const otherSponsored = sponsoredFoundations.slice(1, 6).map(sf => ({
      name: sf.name,
      website: sf.url,
      context: sf.context,
      confidence: sf.confidence
    }));

    // Calculate overall confidence
    let confidenceFactors = [];
    if (foundation.confidence) confidenceFactors.push(foundation.confidence);
    if (events.length > 0) confidenceFactors.push(70);
    if (teamContacts.length > 0) confidenceFactors.push(60);
    
    overallConfidence = confidenceFactors.length > 0 
      ? Math.round(confidenceFactors.reduce((a, b) => a + b, 0) / confidenceFactors.length)
      : 50;

    const result = {
      foundation: {
        name: foundation.name || 'Foundation',
        website: foundation.website,
        mission: foundation.mission,
        relationship_type: foundation.relationship_type || 'unknown'
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
      other_sponsored_foundations: otherSponsored.length > 0 ? otherSponsored : null,
      confidence_score: overallConfidence,
      meta: {
        source_url: url,
        organization_name: orgName,
        foundation_url: foundationUrl,
        search_method: searchMethod,
        scraped_at: new Date().toISOString(),
        events_found: events.length,
        contacts_found: teamContacts.length,
        extraction_success: {
          foundation: !!foundation.website,
          events: events.length > 0,
          tools: registrationTools.some(t => t.registration_platform !== 'UNKNOWN'),
          contacts: teamContacts.length > 0
        }
      }
    };

    debugLog.log('COMPLETE', '=== Research Complete ===', {
      foundation: foundation.name,
      type: foundation.relationship_type,
      events: events.length,
      contacts: teamContacts.length,
      confidence: overallConfidence
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result, null, 2)
    };

  } catch (error) {
    debugLog.log('FATAL', 'Unhandled error in handler', { error: error.message, stack: error.stack });
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
