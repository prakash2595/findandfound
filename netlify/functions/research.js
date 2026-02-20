import axios from 'axios';
import * as cheerio from 'cheerio';

const TIMEOUT = 15000;

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
  'sponsored event', 'event sponsor', 'title sponsor', 'presenting sponsor',
  'gold sponsor', 'silver sponsor', 'platinum sponsor', 'bronze sponsor'
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

function normalizeUrl(url) {
  url = url.trim();
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

async function fetchPage(url) {
  try {
    const response = await axios.get(url, {
      headers: HEADERS,
      timeout: TIMEOUT,
      maxRedirects: 5,
      validateStatus: (status) => status < 400
    });
    return { html: response.data, finalUrl: response.request?.res?.responseUrl || url };
  } catch (error) {
    console.log('Fetch error for ' + url + ': ' + error.message);
    return { html: null, finalUrl: url };
  }
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

  const pageText = $('body').text().toLowerCase();
  for (const platform of REGISTRATION_PLATFORMS) {
    if (pageText.includes(platform.name.toLowerCase())) {
      return platform.name;
    }
  }

  return null;
}

async function crawlEventPage(eventUrl) {
  console.log('Crawling event page:', eventUrl);

  const { html } = await fetchPage(eventUrl);
  if (!html) return null;

  const $ = cheerio.load(html);

  const result = {
    url: eventUrl,
    platform: null,
    registration_link: null,
    sponsorship_link: null
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
        if (platform) result.platform = platform;
      }
    }

    if (text.includes('sponsor') && href.startsWith('http')) {
      result.sponsorship_link = href;
    }
  });

  return result;
}

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
    '[class*="program"]', '[class*="gala"]',
    'li', '.item'
  ];

  eventSelectors.forEach(selector => {
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

      const nameLower = name.toLowerCase();
      if (seen.has(nameLower)) return;
      if (nameLower === 'events' || nameLower === 'calendar' || nameLower === 'event') return;
      seen.add(nameLower);

      const dateMatches = text.match(dateRegex);
      const date = dateMatches ? dateMatches[0] : null;

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
        if (locText.length > 3 && locText.length < 150) {
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
        registration_platform: null,
        registration_link: null,
        sponsorship_link: null
      });
    });
  });

  return events;
}

async function findOwnedFoundation(baseUrl, $) {
  console.log('Step 1: Searching for owned/associated foundation...');

  const foundation = {
    name: null,
    website: null,
    mission: null,
    relationship_type: null
  };

  // Check if current page IS a foundation
  const pageTitle = $('title').text().toLowerCase();
  if (FOUNDATION_KEYWORDS.some(k => pageTitle.includes(k))) {
    foundation.name = $('title').text().split('|')[0].split('-')[0].split(':')[0].trim();
    foundation.website = baseUrl;
    foundation.relationship_type = 'owned';
    console.log('Current page is a foundation:', foundation.name);
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
    foundation.website = best.url;
    foundation.name = best.text || 'Foundation';

    const baseDomain = getDomain(baseUrl);
    const foundationDomain = getDomain(best.url);

    if (foundationDomain.includes(baseDomain.split('.')[0]) || baseDomain.includes(foundationDomain.split('.')[0])) {
      foundation.relationship_type = 'owned';
    } else {
      foundation.relationship_type = 'associated';
    }
    console.log('Found foundation link:', foundation.website, 'Type:', foundation.relationship_type);
    return foundation;
  }

  // Try common foundation URL paths
  console.log('Checking common foundation URL paths...');
  const foundationPages = await findExistingPages(baseUrl, FOUNDATION_PAGE_PATHS);
  if (foundationPages.length > 0) {
    foundation.website = foundationPages[0];
    foundation.name = getOrgName(baseUrl) + ' Foundation';
    foundation.relationship_type = 'owned';
    console.log('Found foundation page:', foundation.website);
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
      console.log('Found foundation subdomain:', url);
      return foundation;
    }
  }

  console.log('No owned/associated foundation found.');
  return foundation;
}

async function findSponsoredFoundations(baseUrl, $) {
  console.log('Step 2: Searching for sponsored foundations...');

  const sponsoredFoundations = [];
  const seen = new Set();
  const baseDomain = getDomain(baseUrl);

  // Helper to check if URL is external foundation
  const isExternalFoundation = (url, text) => {
    const domain = getDomain(url);
    if (domain === baseDomain) return false;
    if (url.includes('facebook.') || url.includes('twitter.') || url.includes('linkedin.') ||
        url.includes('instagram.') || url.includes('youtube.') || url.includes('google.')) return false;

    const hasFoundationKeyword = FOUNDATION_KEYWORDS.some(k =>
      url.toLowerCase().includes(k) || text.toLowerCase().includes(k)
    );
    return hasFoundationKeyword;
  };

  // Search main page for sponsorship mentions
  const searchPage = ($page, pageUrl) => {
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
        sponsoredFoundations.push({
          url: href,
          name: text || domain,
          context: isSponsorContext ? 'sponsor_mention' : 'foundation_link',
          source_page: pageUrl
        });
        console.log('Found potential sponsored foundation:', text || domain, 'from', pageUrl);
      }
    });

    // Also check for images with alt text (sponsor logos)
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
            source_page: pageUrl
          });
          console.log('Found sponsored foundation via logo:', alt);
        }
      }
    });
  };

  // Search main page
  searchPage($, baseUrl);

  // Search community/about/sponsorship pages
  console.log('Checking community and sponsorship pages...');
  const communityPages = await findExistingPages(baseUrl, COMMUNITY_PAGE_PATHS);
  console.log('Found community pages:', communityPages.length);

  for (const pageUrl of communityPages.slice(0, 5)) {
    const { html } = await fetchPage(pageUrl);
    if (html) {
      const $page = cheerio.load(html);
      searchPage($page, pageUrl);
    }
  }

  // Sort by relevance (sponsor mentions first)
  sponsoredFoundations.sort((a, b) => {
    if (a.context === 'sponsor_mention' && b.context !== 'sponsor_mention') return -1;
    if (b.context === 'sponsor_mention' && a.context !== 'sponsor_mention') return 1;
    return 0;
  });

  console.log('Total sponsored foundations found:', sponsoredFoundations.length);
  return sponsoredFoundations;
}

async function getFoundationDetails(foundationUrl) {
  console.log('Fetching foundation details from:', foundationUrl);

  const { html } = await fetchPage(foundationUrl);
  if (!html) return null;

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
}

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

      if (!name || name.length > 100 || name.length < 3 || seen.has(name.toLowerCase())) return;
      seen.add(name.toLowerCase());

      const fullText = $el.text();
      const emails = fullText.match(emailRegex);
      const phones = fullText.match(phoneRegex);

      let linkedin = null;
      $el.find('a[href*="linkedin"]').each((_, a) => {
        linkedin = $(a).attr('href');
        return false;
      });

      let title = matchedTitle.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      contacts.push({
        name: name.slice(0, 100),
        title,
        email: emails ? emails[0] : null,
        phone: phones ? phones[0] : null,
        linkedin_url: linkedin
      });
    });
  });

  return contacts.slice(0, 15);
}

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

  try {
    const body = JSON.parse(event.body || '{}');
    let { url } = body;

    if (!url || typeof url !== 'string') {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'URL is required' }) };
    }

    url = normalizeUrl(url);
    const orgName = getOrgName(url);
    console.log('=== Starting Research for:', url, '===');

    // Fetch main page
    const { html, finalUrl } = await fetchPage(url);
    if (!html) {
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to fetch the provided URL' })
      };
    }

    const $ = cheerio.load(html);
    let foundation = null;
    let foundationUrl = null;
    let $foundation = null;
    let sponsoredFoundations = [];
    let searchMethod = null;

    // ========== STEP 1: Find owned/associated foundation ==========
    foundation = await findOwnedFoundation(finalUrl, $);

    if (foundation.website) {
      // Fetch foundation page to get more details
      const details = await getFoundationDetails(foundation.website);
      if (details) {
        foundation.name = details.name || foundation.name;
        foundation.mission = details.mission;
        $foundation = details.$;
        foundationUrl = foundation.website;
        searchMethod = 'owned_or_associated';
      }
    }

    // ========== STEP 2: If no foundation, search for sponsored foundations ==========
    if (!foundation.website) {
      sponsoredFoundations = await findSponsoredFoundations(finalUrl, $);

      if (sponsoredFoundations.length > 0) {
        // Get details of the primary sponsored foundation
        const primary = sponsoredFoundations[0];
        const details = await getFoundationDetails(primary.url);

        if (details) {
          foundation = {
            name: details.name,
            website: details.website,
            mission: details.mission,
            relationship_type: 'sponsored'
          };
          $foundation = details.$;
          foundationUrl = primary.url;
          searchMethod = 'sponsored';
          console.log('Using sponsored foundation:', foundation.name);
        }
      }
    }

    // ========== STEP 3: Final check - no foundation found ==========
    if (!foundation || !foundation.website) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'FOUNDATION_NOT_FOUND',
          message: 'Could not identify a foundation owned by, associated with, or sponsored by this organization.',
          searched_url: url,
          organization_name: orgName,
          search_steps_completed: [
            'Checked main page for foundation links',
            'Checked common foundation URL paths (/foundation, /giving, etc.)',
            'Checked foundation subdomains',
            'Searched community/sponsorship pages for external foundations'
          ],
          suggestions: [
            'Try entering the foundation URL directly if you know it',
            'Search Google for "' + orgName + ' foundation" or "' + orgName + ' sponsor"'
          ]
        })
      };
    }

    // ========== STEP 4: Extract events from foundation ==========
    console.log('Step 3: Extracting events from foundation...');
    let allEvents = [];

    if ($foundation) {
      const foundationEvents = await extractEventsFromPage($foundation, foundationUrl);
      allEvents.push(...foundationEvents);
      console.log('Events from foundation page:', foundationEvents.length);

      // Search foundation's event pages
      const eventPages = await findExistingPages(foundationUrl, EVENT_PAGE_PATHS);
      for (const eventPage of eventPages.slice(0, 3)) {
        const { html: eventHtml } = await fetchPage(eventPage);
        if (eventHtml) {
          const $events = cheerio.load(eventHtml);
          const pageEvents = await extractEventsFromPage($events, eventPage);
          allEvents.push(...pageEvents);
          console.log('Events from', eventPage, ':', pageEvents.length);
        }
      }
    }

    // Deduplicate events
    const seenEvents = new Set();
    allEvents = allEvents.filter(evt => {
      const key = evt.name.toLowerCase();
      if (seenEvents.has(key)) return false;
      seenEvents.add(key);
      return true;
    });

    console.log('Total unique events:', allEvents.length);

    // ========== STEP 5: Crawl event pages for registration tools ==========
    console.log('Step 4: Crawling event pages for registration tools...');
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

    // ========== STEP 6: Extract team contacts ==========
    console.log('Step 5: Extracting team contacts...');
    const teamContacts = $foundation ? extractTeamContacts($foundation) : [];

    // ========== BUILD RESULT ==========
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
      context: sf.context
    }));

    const result = {
      foundation: {
        name: foundation.name || 'Foundation',
        website: foundation.website,
        mission: foundation.mission,
        relationship_type: foundation.relationship_type || 'unknown'
      },
      events,
      registration_tools: registrationTools,
      team_contacts: teamContacts,
      other_sponsored_foundations: otherSponsored.length > 0 ? otherSponsored : null,
      meta: {
        source_url: url,
        organization_name: orgName,
        foundation_url: foundationUrl,
        search_method: searchMethod,
        scraped_at: new Date().toISOString(),
        events_found: events.length,
        contacts_found: teamContacts.length
      }
    };

    console.log('=== Research Complete ===');
    console.log('Foundation:', foundation.name, '| Type:', foundation.relationship_type);
    console.log('Events:', events.length, '| Contacts:', teamContacts.length);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result, null, 2)
    };

  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
}
