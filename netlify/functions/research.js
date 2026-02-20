import axios from 'axios';
import * as cheerio from 'cheerio';

const TIMEOUT = 20000;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive'
};

const FOUNDATION_KEYWORDS = [
  'foundation', 'philanthropy', 'giving', 'donate', 'donation',
  'charitable', 'nonprofit', 'non-profit', 'support us', 'make a gift',
  'ways to give', 'give now', 'donor', 'fundraising', 'development'
];

const SPONSORED_KEYWORDS = [
  'sponsor', 'sponsored by', 'sponsorship', 'our sponsors', 'event sponsors',
  'corporate sponsor', 'presenting sponsor', 'gold sponsor', 'silver sponsor',
  'platinum sponsor', 'bronze sponsor', 'community partner', 'supported by',
  'in partnership with', 'proud sponsor', 'sponsoring'
];

const EVENT_KEYWORDS = [
  'event', 'gala', 'golf', 'auction', 'dinner', 'luncheon',
  'fundraiser', 'benefit', 'walk', 'run', 'ball', 'celebration',
  'awards', 'ceremony', 'concert', 'festival', 'tournament'
];

const REGISTRATION_PLATFORMS = [
  { name: 'Eventbrite', patterns: ['eventbrite.com', 'eventbrite.'] },
  { name: 'GiveSmart', patterns: ['givesmart.com', 'e.givesmart'] },
  { name: 'OneCause', patterns: ['onecause.com', 'e.onecause'] },
  { name: 'Classy', patterns: ['classy.org', 'secure.classy'] },
  { name: 'Active.com', patterns: ['active.com'] },
  { name: 'Greater Giving', patterns: ['greatergiving.com'] },
  { name: 'Blackbaud', patterns: ['blackbaud.com'] },
  { name: 'Network for Good', patterns: ['networkforgood'] },
  { name: 'Double the Donation', patterns: ['doublethedonation'] }
];

const TEAM_TITLES = [
  'head of events', 'events coordinator', 'event coordinator', 'events manager',
  'director of development', 'development director', 'chief development officer',
  'database manager', 'director of philanthropy', 'philanthropy director',
  'major gifts officer', 'major gifts', 'foundation director', 'foundation president',
  'executive director', 'vp of development', 'vice president of development',
  'gift officer', 'annual giving', 'planned giving', 'donor relations'
];

function normalizeUrl(url) {
  url = url.trim().toLowerCase();
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

async function tryCommonFoundationUrls(baseUrl) {
  const domain = getDomain(baseUrl);
  const baseDomain = domain.split('.').slice(-2).join('.');

  const possibleUrls = [
    baseUrl + '/foundation',
    baseUrl + '/giving',
    baseUrl + '/donate',
    baseUrl + '/philanthropy',
    baseUrl + '/support',
    baseUrl + '/ways-to-give',
    'https://foundation.' + baseDomain,
    'https://giving.' + baseDomain,
    'https://' + baseDomain.replace('.org', 'foundation.org').replace('.com', 'foundation.org'),
    'https://' + domain.replace('www.', '') + '/foundation'
  ];

  for (const url of possibleUrls) {
    try {
      const response = await axios.head(url, {
        headers: HEADERS,
        timeout: 5000,
        maxRedirects: 3,
        validateStatus: (status) => status < 400
      });
      if (response.status === 200) {
        return url;
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function findFoundation(baseUrl, $, html) {
  const foundation = { 
    name: null, 
    website: null, 
    mission: null,
    relationship_type: 'owned'  // 'owned', 'associated', or 'sponsored'
  };
  const foundationLinks = [];

  // Check page title first
  const pageTitle = $('title').text().toLowerCase();
  const isFoundationSite = FOUNDATION_KEYWORDS.some(k => pageTitle.includes(k));

  if (isFoundationSite) {
    foundation.name = $('title').text().split('|')[0].split('-')[0].split(':')[0].trim();
    foundation.website = baseUrl;
    foundation.relationship_type = 'owned';
  }

  // Search for foundation links
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

        if (!fullUrl.includes('javascript:') && !fullUrl.includes('mailto:')) {
          foundationLinks.push({
            url: fullUrl,
            text: $(el).text().trim(),
            score: FOUNDATION_KEYWORDS.filter(k => hrefLower.includes(k) || text.includes(k)).length
          });
        }
      } catch (e) {
        // Invalid URL, skip
      }
    }
  });

  // Sort by score and pick best match
  foundationLinks.sort((a, b) => b.score - a.score);

  if (foundationLinks.length > 0 && !foundation.website) {
    const best = foundationLinks[0];
    foundation.website = best.url;
    foundation.name = best.text || 'Foundation';
    
    // Determine relationship type
    const baseDomain = getDomain(baseUrl);
    const foundationDomain = getDomain(best.url);
    if (foundationDomain.includes(baseDomain) || baseDomain.includes(foundationDomain)) {
      foundation.relationship_type = 'owned';
    } else {
      foundation.relationship_type = 'associated';
    }
  }

  // Try common foundation URL patterns if nothing found
  if (!foundation.website) {
    const commonUrl = await tryCommonFoundationUrls(baseUrl);
    if (commonUrl) {
      foundation.website = commonUrl;
      foundation.name = getOrgName(baseUrl) + ' Foundation';
      foundation.relationship_type = 'owned';
    }
  }

  // Get mission from meta tags
  const metaDesc = $('meta[name="description"]').attr('content') ||
                   $('meta[property="og:description"]').attr('content') || '';
  if (metaDesc.length > 20) {
    foundation.mission = metaDesc.slice(0, 500);
  }

  // If still no mission, look for about/mission text
  if (!foundation.mission) {
    $('p, .mission, .about, [class*="mission"], [class*="about"], [class*="description"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 50 && text.length < 600) {
        const lowerText = text.toLowerCase();
        if (lowerText.includes('mission') || lowerText.includes('dedicated') ||
            lowerText.includes('committed') || lowerText.includes('purpose') ||
            lowerText.includes('vision') || lowerText.includes('support')) {
          foundation.mission = text.slice(0, 500);
          return false;
        }
      }
    });
  }

  return foundation;
}

async function findSponsoredFoundations(baseUrl, $, orgName) {
  const sponsoredFoundations = [];
  const seen = new Set();

  // Look for sponsorship mentions on the page
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().toLowerCase().trim();
    const parentText = $(el).parent().text().toLowerCase();
    const grandparentText = $(el).parent().parent().text().toLowerCase();
    
    const contextText = parentText + ' ' + grandparentText;
    
    // Check if this link is in a sponsorship context
    const isSponsorContext = SPONSORED_KEYWORDS.some(k => contextText.includes(k));
    const isFoundationLink = FOUNDATION_KEYWORDS.some(k => href.toLowerCase().includes(k) || text.includes(k));
    
    if ((isSponsorContext || isFoundationLink) && href.startsWith('http')) {
      const domain = getDomain(href);
      const baseDomain = getDomain(baseUrl);
      
      // Skip if it's the same domain (internal link)
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

  // Look for sponsor sections
  $('[class*="sponsor"], [id*="sponsor"], [class*="partner"], [id*="partner"]').each((_, section) => {
    $(section).find('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href.startsWith('http')) {
        const domain = getDomain(href);
        const baseDomain = getDomain(baseUrl);
        
        if (domain !== baseDomain && !seen.has(domain)) {
          seen.add(domain);
          sponsoredFoundations.push({
            url: href,
            name: $(el).text().trim() || $(el).find('img').attr('alt') || domain,
            context: 'sponsor_section'
          });
        }
      }
    });
  });

  // Look for community involvement / giving back pages
  const communityLinks = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().toLowerCase();
    if (text.includes('community') || text.includes('giving back') || 
        text.includes('social responsibility') || text.includes('csr') ||
        href.includes('community') || href.includes('giving-back')) {
      try {
        const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
        communityLinks.push(fullUrl);
      } catch {}
    }
  });

  // Fetch community pages to find sponsored foundations
  for (const link of communityLinks.slice(0, 3)) {
    try {
      const { html } = await fetchPage(link);
      if (html) {
        const $page = cheerio.load(html);
        
        $page('a[href]').each((_, el) => {
          const href = $page(el).attr('href') || '';
          const text = $page(el).text().toLowerCase();
          const isFoundation = FOUNDATION_KEYWORDS.some(k => href.toLowerCase().includes(k) || text.includes(k));
          
          if (isFoundation && href.startsWith('http')) {
            const domain = getDomain(href);
            const baseDomain = getDomain(baseUrl);
            
            if (domain !== baseDomain && !seen.has(domain)) {
              seen.add(domain);
              sponsoredFoundations.push({
                url: href,
                name: $page(el).text().trim() || domain,
                context: 'community_page'
              });
            }
          }
        });
      }
    } catch {}
  }

  return sponsoredFoundations;
}

async function getFoundationDetails(foundationUrl) {
  const { html } = await fetchPage(foundationUrl);
  if (!html) return null;

  const $ = cheerio.load(html);
  
  const name = $('title').text().split('|')[0].split('-')[0].split(':')[0].trim();
  const mission = $('meta[name="description"]').attr('content') ||
                  $('meta[property="og:description"]').attr('content') || null;

  return {
    name: name || getDomain(foundationUrl),
    website: foundationUrl,
    mission: mission ? mission.slice(0, 500) : null
  };
}

function extractEvents($, baseUrl) {
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
    $(selector).each((_, el) => {
      const $el = $(el);
      const text = $el.text();
      const textLower = text.toLowerCase();

      if (!EVENT_KEYWORDS.some(k => textLower.includes(k))) return;

      let name = $el.find('h1, h2, h3, h4, .title, [class*="title"], [class*="name"]').first().text().trim();
      if (!name) {
        name = $el.find('a').first().text().trim();
      }
      if (!name || name.length > 200 || name.length < 3 || seen.has(name.toLowerCase())) return;
      seen.add(name.toLowerCase());

      const dateMatches = text.match(dateRegex);
      const date = dateMatches ? dateMatches[0] : null;

      let category = 'General Event';
      if (textLower.includes('gala')) category = 'Gala';
      else if (textLower.includes('golf')) category = 'Golf Tournament';
      else if (textLower.includes('auction')) category = 'Auction';
      else if (textLower.includes('walk') || textLower.includes('run') || textLower.includes('marathon')) category = 'Walk/Run';
      else if (textLower.includes('dinner') || textLower.includes('luncheon')) category = 'Dinner/Luncheon';
      else if (textLower.includes('concert')) category = 'Concert';
      else if (textLower.includes('festival')) category = 'Festival';

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
        link
      });
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
    if (lower.includes('register') || lower.includes('signup') || lower.includes('tickets')) {
      return 'Custom Form';
    }
    return 'UNKNOWN';
  };

  // Find all registration/sponsorship links on page
  const regLinks = [];
  const sponsorLinks = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().toLowerCase();

    if (text.includes('register') || text.includes('ticket') || text.includes('sign up') || text.includes('rsvp')) {
      try {
        const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
        regLinks.push({ url: fullUrl, text: $(el).text().trim() });
      } catch {}
    }

    if (text.includes('sponsor')) {
      try {
        const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
        sponsorLinks.push({ url: fullUrl, text: $(el).text().trim() });
      } catch {}
    }
  });

  for (const evt of events) {
    const tool = {
      event_name: evt.name,
      registration_platform: detectPlatform(evt.link),
      registration_link: evt.link,
      sponsorship_link: null
    };

    // Try to match registration links to events
    for (const reg of regLinks) {
      const evtWords = evt.name.toLowerCase().split(' ').filter(w => w.length > 3);
      if (evtWords.some(w => reg.text.toLowerCase().includes(w))) {
        tool.registration_link = reg.url;
        tool.registration_platform = detectPlatform(reg.url);
        break;
      }
    }

    // Try to match sponsorship links
    for (const sp of sponsorLinks) {
      const evtWords = evt.name.toLowerCase().split(' ').filter(w => w.length > 3);
      if (evtWords.some(w => sp.text.toLowerCase().includes(w))) {
        tool.sponsorship_link = sp.url;
        break;
      }
    }

    // If no specific match, use first available
    if (!tool.registration_link && regLinks.length > 0) {
      tool.registration_link = regLinks[0].url;
      tool.registration_platform = detectPlatform(regLinks[0].url);
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
      $el.find('.title, [class*="title"], .position, [class*="position"], .role, [class*="role"]').each((_, t) => {
        const titleText = $(t).text().trim();
        if (titleText.length > 3 && titleText.length < 100) {
          title = titleText;
          return false;
        }
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
        body: JSON.stringify({ error: 'Failed to fetch the provided URL. The site may be blocking requests or unavailable.' })
      };
    }

    const $ = cheerio.load(html);

    // Find foundation info
    let foundation = await findFoundation(finalUrl, $, html);
    let targetUrl = finalUrl;
    let $target = $;
    let sponsoredFoundations = [];

    // If foundation website found and different from original, fetch it
    if (foundation.website && foundation.website !== finalUrl) {
      console.log('Found foundation URL:', foundation.website);
      const { html: foundationHtml } = await fetchPage(foundation.website);
      if (foundationHtml) {
        $target = cheerio.load(foundationHtml);
        targetUrl = foundation.website;

        // Update foundation info from foundation page
        const newTitle = $target('title').text();
        if (newTitle && !foundation.name) {
          foundation.name = newTitle.split('|')[0].split('-')[0].trim();
        }

        const newMission = $target('meta[name="description"]').attr('content') ||
                          $target('meta[property="og:description"]').attr('content');
        if (newMission && newMission.length > 20) {
          foundation.mission = newMission.slice(0, 500);
        }
      }
    }

    // If still no foundation found, try common URL patterns
    if (!foundation.name && !foundation.website) {
      const commonUrl = await tryCommonFoundationUrls(url);
      if (commonUrl) {
        const { html: commonHtml } = await fetchPage(commonUrl);
        if (commonHtml) {
          const $common = cheerio.load(commonHtml);
          foundation.website = commonUrl;
          foundation.name = $common('title').text().split('|')[0].split('-')[0].trim() ||
                           orgName + ' Foundation';
          foundation.mission = $common('meta[name="description"]').attr('content')?.slice(0, 500);
          foundation.relationship_type = 'owned';
          $target = $common;
          targetUrl = commonUrl;
        }
      }
    }

    // If STILL no foundation found, search for sponsored foundations
    if (!foundation.name && !foundation.website) {
      console.log('No direct foundation found, searching for sponsored foundations...');
      
      sponsoredFoundations = await findSponsoredFoundations(finalUrl, $, orgName);
      
      if (sponsoredFoundations.length > 0) {
        console.log('Found sponsored foundations:', sponsoredFoundations.length);
        
        // Get details for the first/primary sponsored foundation
        const primarySponsored = sponsoredFoundations[0];
        const details = await getFoundationDetails(primarySponsored.url);
        
        if (details) {
          foundation = {
            name: details.name,
            website: details.website,
            mission: details.mission,
            relationship_type: 'sponsored'
          };
          
          // Fetch the sponsored foundation page for events/contacts
          const { html: sponsoredHtml } = await fetchPage(primarySponsored.url);
          if (sponsoredHtml) {
            $target = cheerio.load(sponsoredHtml);
            targetUrl = primarySponsored.url;
          }
        }
      }
    }

    // Final check - if still nothing, return not found
    if (!foundation.name && !foundation.website) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'FOUNDATION_NOT_FOUND',
          message: 'Could not identify a foundation associated with or sponsored by this organization. Try entering the foundation URL directly if you know it.',
          searched_url: url,
          suggestions: [
            'Try entering the foundation URL directly',
            'Search for "[Organization Name] Foundation" in Google',
            'Check if the organization has a "Community" or "Giving Back" page'
          ]
        })
      };
    }

    // Extract events, tools, and contacts
    const events = extractEvents($target, targetUrl);
    const registrationTools = extractRegistrationTools(events, $target, targetUrl);
    const teamContacts = extractTeamContacts($target);

    // Format additional sponsored foundations (if any beyond the primary)
    const additionalSponsored = sponsoredFoundations.slice(1, 6).map(sf => ({
      name: sf.name,
      website: sf.url,
      context: sf.context
    }));

    // Build result
    const result = {
      foundation: {
        name: foundation.name || 'Foundation',
        website: foundation.website || url,
        mission: foundation.mission || null,
        relationship_type: foundation.relationship_type || 'unknown'
      },
      events,
      registration_tools: registrationTools,
      team_contacts: teamContacts,
      other_sponsored_foundations: additionalSponsored.length > 0 ? additionalSponsored : null,
      meta: {
        source_url: url,
        organization_name: orgName,
        foundation_url: targetUrl,
        scraped_at: new Date().toISOString(),
        events_found: events.length,
        contacts_found: teamContacts.length,
        relationship_type: foundation.relationship_type || 'unknown'
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
