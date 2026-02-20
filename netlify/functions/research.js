import axios from 'axios';
import * as cheerio from 'cheerio';

const TIMEOUT = 15000;
const rateLimitMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60000;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5'
};

const FOUNDATION_KEYWORDS = ['foundation', 'philanthropy', 'giving', 'donate', 'charitable'];
const EVENT_KEYWORDS = ['event', 'gala', 'golf', 'auction', 'dinner', 'luncheon', 'fundraiser', 'benefit'];
const REGISTRATION_PLATFORMS = [
  { name: 'Eventbrite', patterns: ['eventbrite.com'] },
  { name: 'GiveSmart', patterns: ['givesmart.com', 'e.givesmart'] },
  { name: 'OneCause', patterns: ['onecause.com'] },
  { name: 'Classy', patterns: ['classy.org'] },
  { name: 'Active.com', patterns: ['active.com'] },
  { name: 'Greater Giving', patterns: ['greatergiving.com'] },
  { name: 'Blackbaud', patterns: ['blackbaud.com'] }
];

const TEAM_TITLES = [
  'head of events', 'events coordinator', 'event coordinator', 'events manager',
  'director of development operations', 'development operations',
  'database manager', 'data manager', 'director of philanthropy',
  'major gifts officer', 'major gifts', 'director of development',
  'chief development officer', 'cdo', 'vp of development',
  'foundation director', 'executive director', 'foundation president'
];

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - record.start > RATE_WINDOW) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return true;
  }
  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  rateLimitMap.set(ip, record);
  return true;
}

function validateUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeUrl(url) {
  if (!url.startsWith('http')) url = 'https://' + url;
  return url.replace(/\/$/, '');
}

async function fetchPage(url) {
  try {
    const res = await axios.get(url, {
      headers: HEADERS,
      timeout: TIMEOUT,
      maxRedirects: 5
    });
    return res.data;
  } catch (e) {
    console.error(`Fetch error: ${e.message}`);
    return null;
  }
}

async function findFoundation(baseUrl, $) {
  const foundation = { name: null, website: null, mission: null };
  const links = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().toLowerCase();
    try {
      const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
      if (FOUNDATION_KEYWORDS.some(k => href.toLowerCase().includes(k) || text.includes(k))) {
        links.push({ url: fullUrl, text: $(el).text().trim() });
      }
    } catch {}
  });

  const title = $('title').text();
  if (FOUNDATION_KEYWORDS.some(k => title.toLowerCase().includes(k))) {
    foundation.name = title.split('|')[0].split('-')[0].trim();
    foundation.website = baseUrl;
  }

  if (links.length > 0) {
    foundation.website = links[0].url;
    if (!foundation.name) foundation.name = links[0].text || 'Foundation';
  }

  $('meta[name="description"], meta[property="og:description"]').each((_, el) => {
    const content = $(el).attr('content');
    if (content && content.length > 20) foundation.mission = content.slice(0, 500);
  });

  return foundation;
}

function extractEvents($, baseUrl) {
  const events = [];
  const seen = new Set();
  const dateRegex = /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{4})?/gi;

  $('[class*="event"], article, .card, [class*="calendar"]').each((_, el) => {
    const $el = $(el);
    const text = $el.text();
    const textLower = text.toLowerCase();

    if (!EVENT_KEYWORDS.some(k => textLower.includes(k))) return;

    let name = $el.find('h2, h3, h4, .title').first().text().trim() ||
               $el.find('a').first().text().trim();
    if (!name || name.length > 200 || seen.has(name)) return;
    seen.add(name);

    const dateMatch = text.match(dateRegex);

    let category = 'General';
    if (textLower.includes('gala')) category = 'Gala';
    else if (textLower.includes('golf')) category = 'Golf Tournament';
    else if (textLower.includes('auction')) category = 'Auction';
    else if (textLower.includes('walk') || textLower.includes('run')) category = 'Walk/Run';
    else if (textLower.includes('dinner') || textLower.includes('luncheon')) category = 'Dinner/Luncheon';

    let link = $el.find('a').attr('href');
    try {
      if (link && !link.startsWith('http')) link = new URL(link, baseUrl).href;
    } catch {
      link = null;
    }

    let location = null;
    $el.find('[class*="location"], [class*="venue"], address').each((_, loc) => {
      location = $(loc).text().trim().slice(0, 150);
      return false;
    });

    events.push({
      name: name.slice(0, 150),
      category,
      date: dateMatch?.[0] || null,
      location,
      link
    });
  });

  return events.slice(0, 20);
}

function extractRegistrationTools(events, $, baseUrl) {
  const tools = [];

  const detectPlatform = (url) => {
    if (!url) return 'UNKNOWN';
    const lower = url.toLowerCase();
    for (const p of REGISTRATION_PLATFORMS) {
      if (p.patterns.some(pat => lower.includes(pat))) return p.name;
    }
    return lower.includes('register') || lower.includes('signup') ? 'Custom Form' : 'UNKNOWN';
  };

  const allLinks = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().toLowerCase();
    if (text.includes('register') || text.includes('sponsor') || text.includes('ticket') ||
        text.includes('sign up') || href.includes('register') || href.includes('sponsor')) {
      try {
        const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
        allLinks.push({
          url: fullUrl,
          text: $(el).text().trim(),
          isSponsorship: text.includes('sponsor')
        });
      } catch {}
    }
  });

  for (const evt of events) {
    const tool = {
      event_name: evt.name,
      registration_platform: 'UNKNOWN',
      registration_link: null,
      sponsorship_link: null
    };

    if (evt.link) {
      tool.registration_link = evt.link;
      tool.registration_platform = detectPlatform(evt.link);
    }

    for (const link of allLinks) {
      const evtWords = evt.name.toLowerCase().split(' ');
      if (evtWords.some(w => w.length > 3 && link.text.toLowerCase().includes(w))) {
        tool.registration_platform = detectPlatform(link.url);
        if (link.isSponsorship) {
          tool.sponsorship_link = link.url;
        } else {
          tool.registration_link = link.url;
        }
      }
    }

    tools.push(tool);
  }

  return tools;
}

function extractTeamContacts($) {
  const contacts = [];
  const seen = new Set();
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

  const staffSelectors = [
    '[class*="staff"]', '[class*="team"]', '[class*="leadership"]',
    '[class*="contact"]', '[class*="directory"]', '[id*="staff"]', '[id*="team"]'
  ];

  staffSelectors.forEach(sel => {
    $(sel).find('.person, .member, .staff-member, article, .card, li, [class*="person"]').each((_, el) => {
      const $el = $(el);
      const text = $el.text().toLowerCase();

      const matchedTitle = TEAM_TITLES.find(t => text.includes(t));
      if (!matchedTitle) return;

      let name = $el.find('h3, h4, .name, [class*="name"], strong').first().text().trim();
      if (!name) {
        const lines = $el.text().trim().split('\n').filter(l => l.trim());
        if (lines.length > 0) name = lines[0].trim();
      }
      if (!name || name.length > 100 || seen.has(name)) return;
      seen.add(name);

      const fullText = $el.text();
      const emails = fullText.match(emailRegex);
      const phones = fullText.match(phoneRegex);

      let linkedin = null;
      $el.find('a[href*="linkedin"]').each((_, a) => {
        linkedin = $(a).attr('href');
        return false;
      });

      let title = matchedTitle.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      $el.find('.title, [class*="title"], .position, [class*="position"]').each((_, t) => {
        const titleText = $(t).text().trim();
        if (titleText.length < 100) title = titleText;
        return false;
      });

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

  const clientIp = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return {
      statusCode: 429,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Rate limit exceeded. Try again later.' })
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

    url = normalizeUrl(url.trim());
    if (!validateUrl(url)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid URL format' })
      };
    }

    const html = await fetchPage(url);
    if (!html) {
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to fetch the provided URL' })
      };
    }

    const $ = cheerio.load(html);
    const foundation = await findFoundation(url, $);

    if (!foundation.name && !foundation.website) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'FOUNDATION_NOT_FOUND',
          message: 'Could not identify a foundation associated with this URL.'
        })
      };
    }

    let targetUrl = foundation.website || url;
    let $target = $;

    if (foundation.website && foundation.website !== url) {
      const foundationHtml = await fetchPage(foundation.website);
      if (foundationHtml) {
        $target = cheerio.load(foundationHtml);
        targetUrl = foundation.website;
        const meta = $target('meta[name="description"], meta[property="og:description"]').attr('content');
        if (meta && !foundation.mission) foundation.mission = meta.slice(0, 500);
        if (!foundation.name) {
          foundation.name = $target('title').text().split('|')[0].split('-')[0].trim();
        }
      }
    }

    const events = extractEvents($target, targetUrl);
    const contacts = extractTeamContacts($target);
    const registrationTools = extractRegistrationTools(events, $target, targetUrl);

    const result = {
      foundation: {
        name: foundation.name || 'Unknown Foundation',
        website: foundation.website || url,
        mission: foundation.mission || null
      },
      events,
      registration_tools: registrationTools,
      team_contacts: contacts,
      meta: {
        source_url: url,
        scraped_at: new Date().toISOString(),
        events_found: events.length,
        contacts_found: contacts.length
      }
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result, null, 2)
    };

  } catch (e) {
    console.error('Handler error:', e);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error', message: e.message })
    };
  }
}
