import { generateHex } from 'cs2-inspect-create';

const inferRarityIndex = (rarity) => {
  if (!rarity || typeof rarity !== 'string') return null;
  const r = rarity.toLowerCase();
  if (r.includes('consumer')) return 1;
  if (r.includes('industrial')) return 2;
  if (r.includes('mil-spec') || r.includes('milspec')) return 3;
  if (r.includes('restricted')) return 4;
  if (r.includes('classified')) return 5;
  if (r.includes('covert') || r.includes('extraordinary')) return 6;
  if (r.includes('contraband') || r.includes('knife') || r.includes('glove')) return 7;
  return null;
};

const normalizeInspectToken = (rawInspect) => {
  if (!rawInspect || typeof rawInspect !== 'string') return null;
  const trimmed = rawInspect.trim();
  if (!trimmed) return null;

  const token = trimmed
    .replace(/^steam:\/\/rungame\/730\/76561202255233023\/\+csgo_econ_action_preview(?:%20|\s+)/i, '')
    .replace(/^csgo_econ_action_preview(?:%20|\s+)/i, '')
    .replace(/^\+?csgo_econ_action_preview(?:%20|\s+)/i, '')
    .replace(/^%20/, '')
    .trim();

  return token || null;
};

const buildFallbackInspectToken = (item) => {
  const defIndex = Number(item?.def_index);
  const paintIndex = Number(item?.paint_index);
  const rarityIndexRaw = Number(item?.rarity_index);
  const rarityIndex = Number.isFinite(rarityIndexRaw) ? rarityIndexRaw : inferRarityIndex(item?.rarity);
  const qualityRaw = Number(item?.quality);

  if (![defIndex, paintIndex, rarityIndex].every(Number.isFinite)) {
    return null;
  }

  try {
    const payload = {
      defindex: defIndex >>> 0,
      paintindex: paintIndex >>> 0,
      rarity: rarityIndex >>> 0,
      paintseed: 1,
      paintwear: 0,
    };

    if (Number.isFinite(qualityRaw) && qualityRaw > 0) {
      payload.quality = qualityRaw >>> 0;
    }

    return String(generateHex(payload)).toUpperCase();
  } catch {
    return null;
  }
};

export const buildSteamInspectHref = (rawInspect, item = null) => {
  const token = normalizeInspectToken(rawInspect) || buildFallbackInspectToken(item);
  if (!token) return null;
  return `steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20${token}`;
};

export const shouldShowInspect = (item) => {
  const paintIndex = Number(item?.paint_index);
  return Number.isFinite(paintIndex) && paintIndex > 1;
};