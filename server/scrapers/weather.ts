/**
 * Weather Scraper
 * Source: National Weather Service (api.weather.gov) — free, no key required
 *
 * For each MLB ballpark, fetches:
 *   - Temperature (°F)
 *   - Wind speed and direction
 *   - Conditions (Clear, Partly Cloudy, Rain, etc.)
 *   - Precipitation probability
 *   - Humidity
 *   - Game-time forecast (matched to game start hour)
 *
 * Cache: in-memory, refreshed every 30 minutes
 *
 * Ballpark coordinates sourced from public MLB data.
 * NWS uses a two-step lookup: /points/{lat},{lon} → gridpoint → /forecast/hourly
 */

import axios from 'axios';

export interface BallparkWeather {
  venueId: number;
  venueName: string;
  city: string;
  isIndoor: boolean;
  tempF: number | null;
  feelsLikeF: number | null;
  windSpeedMph: number | null;
  windDirection: string | null;   // e.g. 'NW', 'SSW'
  windGustMph: number | null;
  conditions: string | null;      // e.g. 'Partly Cloudy', 'Rain Showers'
  precipPct: number | null;       // 0–100
  humidity: number | null;        // 0–100
  forecastHour: string | null;    // ISO string of the matched forecast period
  betImpact: 'favorable' | 'neutral' | 'unfavorable';
  betNote: string;
  fetchedAt: string;
}

// ── MLB Ballpark Registry ────────────────────────────────────────────────────
// venueId matches MLB Stats API venue IDs
const BALLPARKS: Array<{
  venueId: number;
  venueName: string;
  city: string;
  lat: number;
  lon: number;
  isIndoor: boolean;
}> = [
  { venueId: 1,    venueName: 'Angel Stadium',            city: 'Anaheim, CA',       lat: 33.8003, lon: -117.8827, isIndoor: false },
  { venueId: 2,    venueName: 'Chase Field',               city: 'Phoenix, AZ',       lat: 33.4453, lon: -112.0667, isIndoor: true  },
  { venueId: 3,    venueName: 'Truist Park',               city: 'Cumberland, GA',    lat: 33.8908, lon: -84.4678,  isIndoor: false },
  { venueId: 4,    venueName: 'Camden Yards',              city: 'Baltimore, MD',     lat: 39.2838, lon: -76.6218,  isIndoor: false },
  { venueId: 5,    venueName: 'Fenway Park',               city: 'Boston, MA',        lat: 42.3467, lon: -71.0972,  isIndoor: false },
  { venueId: 17,   venueName: 'Wrigley Field',             city: 'Chicago, IL',       lat: 41.9484, lon: -87.6553,  isIndoor: false },
  { venueId: 35,   venueName: 'Guaranteed Rate Field',     city: 'Chicago, IL',       lat: 41.8300, lon: -87.6338,  isIndoor: false },
  { venueId: 2394, venueName: 'Great American Ball Park',  city: 'Cincinnati, OH',    lat: 39.0979, lon: -84.5082,  isIndoor: false },
  { venueId: 5,    venueName: 'Progressive Field',         city: 'Cleveland, OH',     lat: 41.4962, lon: -81.6852,  isIndoor: false },
  { venueId: 16,   venueName: 'Coors Field',               city: 'Denver, CO',        lat: 39.7559, lon: -104.9942, isIndoor: false },
  { venueId: 2395, venueName: 'Comerica Park',             city: 'Detroit, MI',       lat: 42.3390, lon: -83.0485,  isIndoor: false },
  { venueId: 2392, venueName: 'Minute Maid Park',          city: 'Houston, TX',       lat: 29.7573, lon: -95.3555,  isIndoor: true  },
  { venueId: 7,    venueName: 'Kauffman Stadium',          city: 'Kansas City, MO',   lat: 39.0517, lon: -94.4803,  isIndoor: false },
  { venueId: 22,   venueName: 'Dodger Stadium',            city: 'Los Angeles, CA',   lat: 34.0739, lon: -118.2400, isIndoor: false },
  { venueId: 2,    venueName: 'loanDepot park',            city: 'Miami, FL',         lat: 25.7781, lon: -80.2197,  isIndoor: true  },
  { venueId: 32,   venueName: 'American Family Field',     city: 'Milwaukee, WI',     lat: 43.0280, lon: -87.9712,  isIndoor: true  },
  { venueId: 3312, venueName: 'Target Field',              city: 'Minneapolis, MN',   lat: 44.9817, lon: -93.2781,  isIndoor: false },
  { venueId: 3289, venueName: 'Citi Field',                city: 'New York, NY',      lat: 40.7571, lon: -73.8458,  isIndoor: false },
  { venueId: 3313, venueName: 'Yankee Stadium',            city: 'New York, NY',      lat: 40.8296, lon: -73.9262,  isIndoor: false },
  { venueId: 10,   venueName: 'Oakland Coliseum',          city: 'Oakland, CA',       lat: 37.7516, lon: -122.2005, isIndoor: false },
  { venueId: 2681, venueName: 'Citizens Bank Park',        city: 'Philadelphia, PA',  lat: 39.9061, lon: -75.1665,  isIndoor: false },
  { venueId: 31,   venueName: 'PNC Park',                  city: 'Pittsburgh, PA',    lat: 40.4469, lon: -80.0057,  isIndoor: false },
  { venueId: 2889, venueName: 'Petco Park',                city: 'San Diego, CA',     lat: 32.7073, lon: -117.1566, isIndoor: false },
  { venueId: 2395, venueName: 'Oracle Park',               city: 'San Francisco, CA', lat: 37.7786, lon: -122.3893, isIndoor: false },
  { venueId: 680,  venueName: 'T-Mobile Park',             city: 'Seattle, WA',       lat: 47.5914, lon: -122.3325, isIndoor: false },
  { venueId: 2889, venueName: 'Busch Stadium',             city: 'St. Louis, MO',     lat: 38.6226, lon: -90.1928,  isIndoor: false },
  { venueId: 12,   venueName: 'Tropicana Field',           city: 'St. Petersburg, FL',lat: 27.7683, lon: -82.6534,  isIndoor: true  },
  { venueId: 5325, venueName: 'Globe Life Field',          city: 'Arlington, TX',     lat: 32.7473, lon: -97.0845,  isIndoor: true  },
  { venueId: 14,   venueName: 'Rogers Centre',             city: 'Toronto, ON',       lat: 43.6414, lon: -79.3894,  isIndoor: true  },
  { venueId: 3309, venueName: 'Nationals Park',            city: 'Washington, DC',    lat: 38.8730, lon: -77.0074,  isIndoor: false },
];

// ── Cache ────────────────────────────────────────────────────────────────────
let weatherCache: Map<number, { data: BallparkWeather; ts: number }> = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;

// NWS gridpoint cache (these don't change)
const gridpointCache = new Map<number, { gridId: string; gridX: number; gridY: number }>();

// ── Helpers ──────────────────────────────────────────────────────────────────
function windDegToCompass(deg: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function assessBetImpact(weather: Partial<BallparkWeather>): { impact: 'favorable' | 'neutral' | 'unfavorable'; note: string } {
  if (weather.isIndoor) return { impact: 'neutral', note: 'Indoor venue — weather has no effect.' };

  const wind = weather.windSpeedMph ?? 0;
  const precip = weather.precipPct ?? 0;
  const temp = weather.tempF ?? 72;

  const notes: string[] = [];

  if (precip >= 50) {
    notes.push(`${precip}% rain chance — game delay risk, overs suppressed`);
    return { impact: 'unfavorable', note: notes.join('. ') };
  }
  if (precip >= 30) notes.push(`${precip}% rain chance — monitor`);

  if (wind >= 15) {
    const dir = weather.windDirection ?? '';
    const isOutToCenter = ['N','NNE','NE','NNW','NW'].includes(dir);
    const isInFromCenter = ['S','SSE','SE','SSW','SW'].includes(dir);
    if (isOutToCenter) notes.push(`${wind}mph wind blowing out — HR/over friendly`);
    else if (isInFromCenter) notes.push(`${wind}mph wind blowing in — under/NRFI friendly`);
    else notes.push(`${wind}mph crosswind — mild effect`);
  }

  if (temp < 50) notes.push(`Cold (${temp}°F) — ball carries less, under lean`);
  else if (temp > 90) notes.push(`Hot (${temp}°F) — ball carries more, over lean`);

  if (notes.length === 0) return { impact: 'favorable', note: 'Good conditions — no weather concerns.' };
  const impact = wind >= 15 || precip >= 30 ? 'neutral' : 'favorable';
  return { impact, note: notes.join('. ') };
}

// ── NWS Fetch ────────────────────────────────────────────────────────────────
async function getNWSGridpoint(venueId: number, lat: number, lon: number) {
  if (gridpointCache.has(venueId)) return gridpointCache.get(venueId)!;

  const url = `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`;
  const { data } = await axios.get(url, {
    timeout: 8000,
    headers: { 'User-Agent': 'TheDugout/1.0 (baseball analytics app)' },
  });

  const props = data?.properties;
  const result = { gridId: props.gridId, gridX: props.gridX, gridY: props.gridY };
  gridpointCache.set(venueId, result);
  return result;
}

async function fetchVenueWeather(
  venueId: number,
  venueName: string,
  city: string,
  lat: number,
  lon: number,
  isIndoor: boolean,
  gameTimeISO?: string
): Promise<BallparkWeather> {
  const base: BallparkWeather = {
    venueId, venueName, city, isIndoor,
    tempF: null, feelsLikeF: null,
    windSpeedMph: null, windDirection: null, windGustMph: null,
    conditions: null, precipPct: null, humidity: null,
    forecastHour: null,
    betImpact: 'neutral',
    betNote: isIndoor ? 'Indoor venue — weather has no effect.' : 'Weather data unavailable.',
    fetchedAt: new Date().toISOString(),
  };

  if (isIndoor) {
    const { impact, note } = assessBetImpact(base);
    return { ...base, betImpact: impact, betNote: note };
  }

  try {
    const { gridId, gridX, gridY } = await getNWSGridpoint(venueId, lat, lon);
    const forecastUrl = `https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/forecast/hourly`;
    const { data: forecastData } = await axios.get(forecastUrl, {
      timeout: 8000,
      headers: { 'User-Agent': 'TheDugout/1.0 (baseball analytics app)' },
    });

    const periods: Record<string, unknown>[] = forecastData?.properties?.periods ?? [];
    if (periods.length === 0) return base;

    // Find the period closest to game time (or use the next upcoming period)
    let targetPeriod = periods[0];
    if (gameTimeISO) {
      const gameTime = new Date(gameTimeISO).getTime();
      let minDiff = Infinity;
      for (const p of periods) {
        const pTime = new Date(p.startTime as string).getTime();
        const diff = Math.abs(pTime - gameTime);
        if (diff < minDiff) { minDiff = diff; targetPeriod = p; }
      }
    }

    // Parse wind: "10 mph" or "10 to 15 mph"
    const windStr = String(targetPeriod.windSpeed ?? '0 mph');
    const windMatch = windStr.match(/(\d+)(?:\s+to\s+(\d+))?/);
    const windLow = windMatch ? parseInt(windMatch[1]) : 0;
    const windHigh = windMatch?.[2] ? parseInt(windMatch[2]) : windLow;
    const windAvg = Math.round((windLow + windHigh) / 2);

    const windDirStr = String(targetPeriod.windDirection ?? 'N');
    // NWS returns compass abbreviations directly

    // Precip probability
    const precipPct = (targetPeriod.probabilityOfPrecipitation as Record<string, unknown>)?.value as number ?? 0;

    const filled: BallparkWeather = {
      ...base,
      tempF: targetPeriod.temperature as number ?? null,
      windSpeedMph: windAvg,
      windDirection: windDirStr,
      windGustMph: null, // hourly doesn't always have gusts
      conditions: String(targetPeriod.shortForecast ?? ''),
      precipPct: Math.round(precipPct),
      humidity: null, // not in hourly endpoint
      forecastHour: String(targetPeriod.startTime ?? ''),
    };

    const { impact, note } = assessBetImpact(filled);
    return { ...filled, betImpact: impact, betNote: note };
  } catch (err) {
    console.warn(`[weather] Failed for ${venueName}:`, (err as Error).message);
    return base;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────
export async function scrapeWeather(
  venueIds?: number[],
  gameTimes?: Record<number, string>,
  forceRefresh = false
): Promise<BallparkWeather[]> {
  const targets = venueIds
    ? BALLPARKS.filter(b => venueIds.includes(b.venueId))
    : BALLPARKS;

  const results: BallparkWeather[] = [];

  for (const park of targets) {
    const cached = weatherCache.get(park.venueId);
    if (!forceRefresh && cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      results.push(cached.data);
      continue;
    }

    const gameTime = gameTimes?.[park.venueId];
    const data = await fetchVenueWeather(
      park.venueId, park.venueName, park.city,
      park.lat, park.lon, park.isIndoor, gameTime
    );
    weatherCache.set(park.venueId, { data, ts: Date.now() });
    results.push(data);

    // Small delay to respect NWS rate limits
    await new Promise(r => setTimeout(r, 200));
  }

  return results;
}

export function getWeatherCache(): BallparkWeather[] {
  return Array.from(weatherCache.values()).map(v => v.data);
}

export function clearWeatherCache() {
  weatherCache.clear();
}

export { BALLPARKS };
