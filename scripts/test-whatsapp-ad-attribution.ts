/**
 * Smoke tests for Meta/CTWA attribution (strict).
 * Run: npx --yes tsx scripts/test-whatsapp-ad-attribution.ts
 */
import {
  extractWhatsappAdAttribution,
  isMetaAdSourceUrl,
  isVerifiedMetaAdAttribution,
} from '../supabase/functions/_shared/whatsappAdAttribution.ts';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

// Organic message — no ad nodes
{
  const a = extractWhatsappAdAttribution({ body: 'Hola, quiero info' });
  assert(!a.fromAd && a.confidence === 'none', 'organic must not be fromAd');
  assert(!isVerifiedMetaAdAttribution(a), 'organic not verified');
}

// Empty nested externalAdReply must not count
{
  const a = extractWhatsappAdAttribution({
    message: { contextInfo: { externalAdReply: {} } },
  });
  assert(!a.fromAd, 'empty externalAdReply must not be fromAd');
}

// Product-like reply with only title (no Meta ids/url/type) must not count
{
  const a = extractWhatsappAdAttribution({
    contextInfo: { externalAdReply: { title: 'Oferta lipo', body: 'Consulta' } },
  });
  assert(!a.fromAd && a.confidence === 'none', 'title-only reply is not Meta ad');
}

// Cloud API referral with ctwa_clid = verified
{
  const a = extractWhatsappAdAttribution({
    referral: {
      source_url: 'https://fb.me/xyz',
      source_id: '120330000012345',
      source_type: 'ad',
      headline: 'Lipoout verano',
      body: 'Escríbenos',
      ctwa_clid: 'AbCdEf123',
    },
  });
  assert(a.fromAd && a.confidence === 'verified', 'ctwa_clid => verified');
  assert(a.ctwaClid === 'AbCdEf123', 'clid extracted');
  assert(isVerifiedMetaAdAttribution(a), 'verified helper');
}

// source_id alone = verified
{
  const a = extractWhatsappAdAttribution({
    contextInfo: {
      externalAdReply: {
        sourceId: '999888777',
        title: 'Anuncio',
      },
    },
  });
  assert(a.fromAd && a.confidence === 'verified', 'sourceId => verified');
}

// source_type=ad without ids = likely
{
  const a = extractWhatsappAdAttribution({
    referral: { source_type: 'ad', headline: 'Promo' },
  });
  assert(a.fromAd && a.confidence === 'likely', 'source_type=ad => likely');
}

// Meta URL = likely
{
  assert(isMetaAdSourceUrl('https://www.facebook.com/ads/xxx'), 'fb ads url');
  const a = extractWhatsappAdAttribution({
    contextInfo: {
      externalAdReply: {
        sourceUrl: 'https://www.facebook.com/ads/library/?id=1',
        title: 'Ad',
      },
    },
  });
  assert(a.fromAd && a.confidence === 'likely', 'meta url => likely');
}

// Random URL without ad type/id = none
{
  const a = extractWhatsappAdAttribution({
    contextInfo: {
      externalAdReply: {
        sourceUrl: 'https://example.com/promo',
        title: 'Promo web',
      },
    },
  });
  assert(!a.fromAd, 'non-meta url alone is not fromAd');
}

console.log('ok: whatsapp ad attribution strict checks passed');
