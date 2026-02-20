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

const SPONSORED_KEYWORDS = [
  'sponsor', 'sponsored by', 'sponsorship', 'our sponsors', 'event sponsors',
  'corporate sponsor', 'presenting sponsor', 'community partner', 'supported by',
  'in partnership with', 'proud sponsor'
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
  { name: 'Greater Giving', patterns: ['greatergiving.com', 'greatergiving', 'auctiontracker'] },
  { name: 'Blackbaud', patterns: ['blackbaud.com', 'blackbaud'] },
  { name: 'Network for Good', patterns: ['networkforgood.com', 'networkforgood'] },
  { name: 'Double the Donation', patterns: ['doublethedonation.com'] },
  { name: 'Qgiv', patterns: ['qgiv.com', 'secure.qgiv'] },
  { name: 'Handbid', patterns: ['handbid.com', 'handbid'] },
  { name: 'BidPal', patterns: ['bidpal.com', 'bidpal'] },
  { name: 'Auction Technology Group', patterns: ['atg.world', 'the-saleroom'] },
  { name: 'CharityAuctionsToday', patterns: ['charityauctionstoday.com'] },
  { name: 'Bloomerang', patterns: ['bloomerang.com', 'bloomerang'] },
  { name: 'DonorPerfect', patterns: ['donorperfect.com', 'donorperfect'] },
  { name: 'Fundly', patterns: ['fundly.com'] },
  { name: 'GoFundMe Charity', patterns: ['gofundme.com/charity', 'charity.gofundme'] },
  { name: 'JustGiving', patterns: ['justgiving.com'] },
  { name: 'Rallybound', patterns: ['rallybound.com'] },
  { name: 'RegFox', patterns: ['regfox.com'] },
  { name: 'SignUpGenius', patterns: ['signupgenius.com'] },
  { name: 'Splash', patterns: ['splashthat.com'] },
  { name: 'Ticketleap', patterns: ['ticketleap.com'] },
  { name: 'Eventcreate', patterns: ['eventcreate.com'] },
  { name: 'Wild Apricot', patterns: ['wildapricot.org', 'wildapricot'] },
  { name: 'MemberClicks', patterns: ['memberclicks.com'] },
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
  '/whats-happening', '/happenings', '/activities', '/programs',
  '/fundraising-events', '/special-events', '/community-events',
  '/galas', '/gala', '/annual-events', '/signature-events'
];

const FOUNDATION_PAGE_PATHS = [
  '/foundation', '/giving', '/donate', '/philanthropy', '/support',
  '/ways-to-give', '/support-us', '/make-a-gift', '/get-involved'
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

async function findEventPages(baseUrl) {
  const eventPages = [];
  const base = getBaseUrl(baseUrl);

  console.log('Searching for event pages on:', base);

  for (const path of EVENT_PAGE_PATHS) {
    const url = base + path;
    const exists = await checkUrlExists(url);
    if (exists) {
      console.log('Found event page:', url);
      eventPages.push(url);
    }
  }

  return eventPages;
}

async function findFoundationPages(baseUrl) {
  const foundationPages = [];
  const base = getBaseUrl(baseUrl);
  const domain = getDomain(baseUrl);
  const baseDomain = domain.split('.').slice(-2).join('.');

  console.log('Searching for foundation pages on:', base);

  // Try paths on the main domain
  for (const path of FOUNDATION_PAGE_PATHS) {
    const url = base + path;
    const exists = await checkUrlExists(url);
    if (exists) {
      console.log('Found foundation page:', url);
      foundationPages.push(url);
    }
  }

  // Try subdomain variations
  const subdomainUrls = [
    'https://foundation.' + baseDomain,
    'https://giving.' + baseDomain,
    'https://donate.' + baseDomain,
    'https://philanthropy.' + baseDomain
  ];

  for (const url of subdomainUrls) {
    const exists = await checkUrlExists(url);
    if (exists) {
      console.log('Found foundation subdomain:', url);
      foundationPages.push(url);
    }
  }

  return foundationPages;
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
  // Check the URL first
  const urlPlatform = detectPlatformFromUrl(url);
  if (urlPlatform) return urlPlatform;

  // Check all links on the page
  const allLinks = [];
  $('a[href]').each((_, el) => {
    allLinks.push($(el).attr('href') || '');
  });

  // Check iframes (embedded registration forms)
  $('iframe[src]').each((_, el) => {
    allLinks.push($(el).attr('src') || '');
  });

  // Check form actions
  $('form[action]').each((_, el) => {
    allLinks.push($(el).attr('action') || '');
  });

  // Check scripts for embedded widgets
  $('script[src]').each((_, el) => {
    allLinks.push($(el).attr('src') || '');
  });

  for (const link of allLinks) {
    const platform = detectPlatformFromUrl(link);
    if (platform) return platform;
  }

  // Check page content for platform mentions
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

  // Detect platform from the page
  result.platform = detectPlatformFromPage($, eventUrl);

  // Find registration links
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

  // Check for buttons
  $('button, [class*="button"], [class*="btn"]').each((_, el) => {
    const text = $(el).text().toLowerCase();
    const onclick = $(el).attr('onclick') || '';
    const dataHref = $(el).attr('data-href') || '';
    
    if (regKeywords.some(k => text.includes(k))) {
      const link = dataHref || onclick.match(/https?:\/\/[^\s'"]+/)?.[0];
      if (link && !result.registration_link) {
        result.registration_link = link;
        const platform = detectPlatformFromUrl(link);
        if (platform) result.platform = platform;
      }
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

      // Check if this contains event-related content
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
      seen.add(nameLower);

      // Skip navigation/menu items
      if (name.toLowerCase() === 'events' || name.toLowerCase() === 'calendar') return;

      const dateMatches = text.match(dateRegex);
      const date = dateMatches ? dateMatches[0] : null;

      let category = 'General Event';
      if (textLower.includes('gala')) category = 'Gala';
      else if (textLower.includes('golf')) category = 'Golf Tournament';
      else if (textLower.includes('auction')) category = 'Auction';
      else if (textLower.includes('walk') || textLower.includes('run') || textLower.includes('marathon') || textLower.includes('5k')) category = 'Walk/Run';
      else if (textLower.includes('dinner') || textLower.includes('luncheon')) category = 'Dinner/Luncheon';
      else if (textLower.includes('concert')) category = 'Concert';
      else if (textLower.includes('festival')) category = 'Festival';
      else if (textLower.includes('ball')) category = 'Ball';

      let location = null;
      $el.find('[class*="location"], [class*="venue"], [class*="place"], [class*="address"], address').each((_, loc) => {
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

async function findFoundation(baseUrl, $) {
  const foundation = {
    name: null,
    website: null,
    mission: null,
    relationship_type: 'owned'
  };

  // Check page title
  const pageTitle = $('title').text().toLowerCase();
  const isFoundationSite = FOUNDATION_KEYWORDS.some(k => pageTitle.includes(k));

  if (isFoundationSite) {
    foundation.name = $('title').text().split('|')[0].split('-')[0].split(':')[0].trim();
    foundation.website = baseUrl;
    foundation.relationship_type = 'owned';
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
          foundationLinks.push({
            url: fullUrl,
            text: $(el).text().trim(),
            score: FOUNDATION_KEYWORDS.filter(k => hrefLower.includes(k) || text.includes(k)).length
          });
        }
      } catch {}
    }
  });

  foundationLinks.sort((a, b) => b.score - a.score);

  if (foundationLinks.length > 0 && !foundation.website) {
    const best = foundationLinks[0];
    foundation.website = best.url;
    foundation.name = best.text || 'Foundation';

    const baseDomain = getDomain(baseUrl);
    const foundationDomain = getDomain(best.url);
    if (foundationDomain.includes(baseDomain) || baseDomain.includes(foundationDomain.split('.')[0])) {
      foundation.relationship_type = 'owned';
    } else {
      foundation.relationship_type = 'associated';
    }
  }

  // Get mission
  const metaDesc = $('meta[name="description"]').attr('content') ||
                   $('meta[property="og:description"]').attr('content') || '';
  if (metaDesc.length > 20) {
    foundation.mission = metaDesc.slice(0, 500);
  }

  return foundation;
}

async function findSponsoredFoundations(baseUrl, $) {
  const sponsoredFoundations = [];
  const seen = new Set();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const parentText = $(el).parent().text().toLowerCase() + ' ' + $(el).parent().parent().text().toLowerCase();

    const isSponsorContext = SPONSORED_KEYWORDS.some(k => parentText.includes(k));
    const isFoundationLink = FOUNDATION_KEYWORDS.some(k => href.toLowerCase().includes(k));

    if ((isSponsorContext || isFoundationLink) && href.startsWith('http')) {
      const domain = getDomain(href);
      const baseDomain = getDomain(baseUrl);

      if (domain !== baseDomain && !seen.has(domain)) {
        seen.add(domain);
        sponsoredFoundations.push({
          url: href,
          name: $(el).text().trim() || domain,
          context: isSponsorContext ? 'sponsor' : 'foundation_link'
        });
      }
    }
  });

  return sponsoredFoundations;
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
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    let { url } = body;

    if (!url || typeof url !== 'string') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'URL is required' })
      };
    }

    url = normalizeUrl(url);
    const orgName = getOrgName(url);
    console.log('Processing URL:', url, 'Org:', orgName);

    // Fetch the main page
    const { html, finalUrl } = await fetchPage(url);
    if (!html) {
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to fetch the provided URL' })
      };
    }

    const $ = cheerio.load(html);

    // Step 1: Find foundation
    let foundation = await findFoundation(finalUrl, $);
    let foundationUrl = finalUrl;
    let $foundation = $;

    // Try to find foundation pages if not found
    if (!foundation.website) {
      const foundationPages = await findFoundationPages(finalUrl);
      if (foundationPages.length > 0) {
        foundation.website = foundationPages[0];
        foundation.name = orgName + ' Foundation';
        foundation.relationship_type = 'owned';
      }
    }

    // Fetch foundation page if found
    if (foundation.website && foundation.website !== finalUrl) {
      console.log('Fetching foundation page:', foundation.website);
      const { html: foundationHtml } = await fetchPage(foundation.website);
      if (foundationHtml) {
        $foundation = cheerio.load(foundationHtml);
        foundationUrl = foundation.website;

        const newTitle = $foundation('title').text();
        if (newTitle) {
          foundation.name = newTitle.split('|')[0].split('-')[0].split(':')[0].trim();
        }

        const newMission = $foundation('meta[name="description"]').attr('content') ||
                          $foundation('meta[property="og:description"]').attr('content');
        if (newMission && newMission.length > 20) {
          foundation.mission = newMission.slice(0, 500);
        }
      }
    }

    // Step 2: Find events - search multiple sources
    let allEvents = [];
    const eventPagesSearched = [];

    // Search main page for events
    const mainPageEvents = await extractEventsFromPage($, finalUrl);
    allEvents.push(...mainPageEvents);
    console.log('Events from main page:', mainPageEvents.length);

    // Search foundation page for events
    if ($foundation !== $) {
      const foundationEvents = await extractEventsFromPage($foundation, foundationUrl);
      allEvents.push(...foundationEvents);
      console.log('Events from foundation page:', foundationEvents.length);
    }

    // Search dedicated event pages
    const eventPages = await findEventPages(foundationUrl || finalUrl);
    for (const eventPage of eventPages.slice(0, 3)) {
      eventPagesSearched.push(eventPage);
      const { html: eventHtml } = await fetchPage(eventPage);
      if (eventHtml) {
        const $events = cheerio.load(eventHtml);
        const pageEvents = await extractEventsFromPage($events, eventPage);
        allEvents.push(...pageEvents);
        console.log('Events from', eventPage, ':', pageEvents.length);
      }
    }

    // Also try event pages on main domain if foundation is different
    if (foundation.website && getDomain(foundation.website) !== getDomain(finalUrl)) {
      const mainEventPages = await findEventPages(finalUrl);
      for (const eventPage of mainEventPages.slice(0, 2)) {
        if (!eventPagesSearched.includes(eventPage)) {
          eventPagesSearched.push(eventPage);
          const { html: eventHtml } = await fetchPage(eventPage);
          if (eventHtml) {
            const $events = cheerio.load(eventHtml);
            const pageEvents = await extractEventsFromPage($events, eventPage);
            allEvents.push(...pageEvents);
            console.log('Events from main domain', eventPage, ':', pageEvents.length);
          }
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

    console.log('Total unique events found:', allEvents.length);

    // Step 3: Crawl event pages to find registration tools
    const eventsWithTools = [];
    for (const evt of allEvents.slice(0, 10)) {
      if (evt.link) {
        console.log('Crawling event:', evt.name);
        const eventDetails = await crawlEventPage(evt.link);
        if (eventDetails) {
          evt.registration_platform = eventDetails.platform || 'UNKNOWN';
          evt.registration_link = eventDetails.registration_link || evt.link;
          evt.sponsorship_link = eventDetails.sponsorship_link;
        } else {
          evt.registration_platform = 'UNKNOWN';
          evt.registration_link = evt.link;
        }
      } else {
        evt.registration_platform = 'UNKNOWN';
      }
      eventsWithTools.push(evt);
    }

    // Add remaining events without crawling
    for (const evt of allEvents.slice(10)) {
      evt.registration_platform = evt.link ? detectPlatformFromUrl(evt.link) || 'UNKNOWN' : 'UNKNOWN';
      evt.registration_link = evt.link;
      eventsWithTools.push(evt);
    }

    // Step 4: If no foundation found, search for sponsored foundations
    let sponsoredFoundations = [];
    if (!foundation.name && !foundation.website) {
      console.log('No foundation found, searching for sponsored foundations...');
      sponsoredFoundations = await findSponsoredFoundations(finalUrl, $);

      if (sponsoredFoundations.length > 0) {
        const primary = sponsoredFoundations[0];
        const { html: sponsoredHtml } = await fetchPage(primary.url);
        if (sponsoredHtml) {
          const $sponsored = cheerio.load(sponsoredHtml);
          foundation = {
            name: $sponsored('title').text().split('|')[0].split('-')[0].trim() || primary.name,
            website: primary.url,
            mission: $sponsored('meta[name="description"]').attr('content')?.slice(0, 500) || null,
            relationship_type: 'sponsored'
          };
          $foundation = $sponsored;
          foundationUrl = primary.url;
        }
      }
    }

    // Final check
    if (!foundation.name && !foundation.website) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'FOUNDATION_NOT_FOUND',
          message: 'Could not identify a foundation associated with this URL.',
          searched_url: url,
          event_pages_checked: eventPagesSearched,
          suggestions: [
            'Try entering the foundation URL directly',
            'Check if the organization has a separate foundation website'
          ]
        })
      };
    }

    // Step 5: Extract team contacts
    const teamContacts = extractTeamContacts($foundation);

    // Build registration tools array
    const registrationTools = eventsWithTools.map(evt => ({
      event_name: evt.name,
      registration_platform: evt.registration_platform || 'UNKNOWN',
      registration_link: evt.registration_link,
      sponsorship_link: evt.sponsorship_link
    }));

    // Format events for output
    const events = eventsWithTools.map(evt => ({
      name: evt.name,
      category: evt.category,
      date: evt.date,
      location: evt.location,
      link: evt.link
    }));

    // Other sponsored foundations
    const otherSponsored = sponsoredFoundations.slice(1, 6).map(sf => ({
      name: sf.name,
      website: sf.url
    }));

    const result = {
      foundation: {
        name: foundation.name || 'Foundation',
        website: foundation.website || url,
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
        event_pages_searched: eventPagesSearched,
        scraped_at: new Date().toISOString(),
        events_found: events.length,
        contacts_found: teamContacts.length
      }
    };

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
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
}
