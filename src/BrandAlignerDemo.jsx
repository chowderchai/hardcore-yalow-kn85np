import React, { useMemo, useState } from "react";

// Single-file React demo with inline CSS (no external CSS imports)
// Art style: Analog Texture Minimalism (cream paper, charcoal, subtle grain).
// Fixes: remove TypeScript annotations, fix RegExp in getVal, keep tests, add more tests.
// Updates per feedback: more channels, channel optimization metric, single-column feedback, on-demand rewrite.

// ------------------------
// Demo Data & Helpers
// ------------------------
const DEFAULT_GUIDE = `Example Brand Guidelines (paste your own)

Tone: warm, human, hopeful
Avoid: jargon, guilt, all caps
Preferred terms: donor community, monthly giving, impact
Banned terms: cheap, handout, poor people
Reading level: 8
Person: second
Tense: present
CTA verbs: Give, Join, Start, Learn, Donate
Hashtag max: 3
Emoji allowed: true
Email subject length max: 65
Email preview length max: 90
PaidSocial char max: 125
OrganicSocial char max: 2200
SMS char max: 160; link required: true`;

const CHANNELS = [
  { id: "Email", label: "Email" },
  { id: "OrganicSocial", label: "Organic Social" },
  { id: "PaidSocial", label: "Paid Social" },
  { id: "SMS", label: "SMS" },
  { id: "Print", label: "Print (Flyer/One-Pager)" },
  { id: "VideoScript", label: "Video Script" },
  { id: "LandingPage", label: "Landing Page" },
  { id: "DonationPage", label: "Donation Page" },
  { id: "EventInvite", label: "Event Invite" },
  { id: "DirectMail", label: "Direct Mail Letter" },
  { id: "Blog", label: "Blog/Article" },
];

const splitLines = (t) => t.split(/\r?\n/);
const toList = (s) => (s || "").split(/,|•|\u2022|;|\n|\t/).map(x => x.trim()).filter(Boolean);
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function parseGuidelines(raw) {
  if (!raw) return {};
  const lines = splitLines(raw);
  const g = {
    voice: { tone: [], avoid: [], reading_level: null },
    style: { person: null, tense: null, sentence_length_max: null, use_contractions: null },
    vocab: { preferred: [], banned: [] },
    formatting: { cta_verbs: [], hashtag_rules: { max: null, approved: [] } },
    channel_overrides: {
      Email: { subject_length_max: null, preview_length_max: null, cta_count_max: 1 },
      OrganicSocial: { char_max: 2200, emoji_allowed: true, hashtag_max: 3 },
      PaidSocial: { char_max: 125, compliance_notes: [] },
      SMS: { char_max: 160, link_required: false },
    },
    compliance: { casl: { consent_required: true, unsubscribe_required: true } }
  };

  const getVal = (key) => {
    const pattern = new RegExp('^\\s*' + escapeRegex(key) + '\\s*:', 'i');
    const row = lines.find(l => pattern.test(l));
    if (!row) return null;
    return row.split(":").slice(1).join(":").trim();
  };

  const tone = getVal("Tone");
  const avoid = getVal("Avoid");
  const preferred = getVal("Preferred terms");
  const banned = getVal("Banned terms");
  const rl = getVal("Reading level");
  const person = getVal("Person");
  const tense = getVal("Tense");
  const cta = getVal("CTA verbs");
  const hashtagMax = getVal("Hashtag max");
  const emojiAllowed = getVal("Emoji allowed");

  const subjMax = getVal("Email subject length max");
  const prevMax = getVal("Email preview length max");
  const paidMax = getVal("PaidSocial char max");
  const orgMax = getVal("OrganicSocial char max");
  const smsMax = getVal("SMS char max");
  const smsLinkReq = /link required\s*:\s*(true|yes|y)/i.test(raw) ? "true" : getVal("link required");

  if (tone) g.voice.tone = toList(tone).map((s) => s.toLowerCase());
  if (avoid) g.voice.avoid = toList(avoid).map((s) => s.toLowerCase());
  if (preferred) g.vocab.preferred = toList(preferred).map((s) => s.toLowerCase());
  if (banned) g.vocab.banned = toList(banned).map((s) => s.toLowerCase());
  if (rl) g.voice.reading_level = Number(rl) || rl;
  if (person) g.style.person = person.toLowerCase();
  if (tense) g.style.tense = tense.toLowerCase();
  if (cta) g.formatting.cta_verbs = toList(cta);
  if (hashtagMax) g.formatting.hashtag_rules.max = Number(hashtagMax) || null;
  if (emojiAllowed) g.channel_overrides.OrganicSocial.emoji_allowed = /true|yes|y/i.test(emojiAllowed);
  if (subjMax) g.channel_overrides.Email.subject_length_max = Number(subjMax) || null;
  if (prevMax) g.channel_overrides.Email.preview_length_max = Number(prevMax) || null;
  if (paidMax) g.channel_overrides.PaidSocial.char_max = Number(paidMax) || 125;
  if (orgMax) g.channel_overrides.OrganicSocial.char_max = Number(orgMax) || 2200;
  if (smsMax) g.channel_overrides.SMS.char_max = Number(smsMax) || 160;
  if (smsLinkReq) g.channel_overrides.SMS.link_required = /true|yes|y/i.test(smsLinkReq);

  return g;
}

function runHeuristics(copy, channel, g) {
  const words = copy.trim().split(/\s+/).filter(Boolean);
  const sentences = copy.split(/[.!?]+\s+/).filter(Boolean);
  const hashtags = (copy.match(/#[A-Za-z0-9_]+/g) || []).length;
    const charCount = copy.length;
  const avgSentence = words.length / Math.max(1, sentences.length);

  const lower = copy.toLowerCase();
  const preferred = new Set((g?.vocab?.preferred || []));
  const banned = new Set((g?.vocab?.banned || []));
  const preferredUsed = [...preferred].filter(p => lower.includes(p));
  const bannedFound = [...banned].filter(b => lower.includes(b));

  const CTA_VERBS = g?.formatting?.cta_verbs?.length ? g.formatting.cta_verbs : ["Give", "Donate", "Join", "Start", "Learn", "Register", "RSVP", "Share"];
  const ctaDetected = CTA_VERBS.some((v) => new RegExp(`\\b${escapeRegex(v)}\\b`, "i").test(copy));

  const unsubPresent = /unsubscribe|opt out|manage preferences/i.test(copy);
  const linkPresent = /https?:\/\//i.test(copy);

  return {
    word_count: words.length,
    char_count: charCount,
    sentence_count: sentences.length,
    avg_sentence_length: Number(avgSentence.toFixed(2)),
    hashtag_count: hashtags,
        cta_detected: ctaDetected,
    banned_terms_found: bannedFound,
    preferred_terms_used: preferredUsed,
    unsub_line_present: channel === 'Email' ? unsubPresent : undefined,
    link_present: /SMS|PaidSocial/i.test(channel) ? linkPresent : undefined,
  };
}

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function suggestEdits(copy, channel, g, h) {
  let out = copy;
  (h.banned_terms_found || []).forEach((term) => {
    const pref = (g?.vocab?.preferred || ["support"])[0];
    out = out.replace(new RegExp(term, 'ig'), pref);
  });
  const maxHash = g?.formatting?.hashtag_rules?.max ?? 3;
  if ((h.hashtag_count || 0) > maxHash) {
    const parts = out.split(/\s+/);
    let kept = 0;
    out = parts.map(tok => {
      if (/#[A-Za-z0-9_]+/.test(tok)) {
        if (kept < maxHash) { kept++; return tok; }
        return "";
      }
      return tok;
    }).join(" ").replace(/\s{2,}/g, " ").trim();
  }
  if (!h.cta_detected) {
    const verb = (g?.formatting?.cta_verbs || ["Donate", "Join"])[0];
    out += `\n\n${verb} today to make an immediate impact.`;
  }
  if (channel === 'Email' && g?.compliance?.casl?.unsubscribe_required && !h.unsub_line_present) {
    out += `\n\nTo unsubscribe or manage preferences, click the link in the footer.`;
  }
  if (channel === 'SMS' && g?.channel_overrides?.SMS?.link_required && !h.link_present) {
    out += ` Learn more: https://exmpl.ca/give`;
  }
  return out;
}

// New: Channel Optimization rules
function channelOptimizationScore(copy, channel, g, h) {
  let score = 80; // baseline
  // Email best practices
  if (channel === 'Email') {
    const subj = (copy.match(/subject\s*:\s*(.*)/i) || [])[1] || "";
    const prev = (copy.match(/preview\s*:\s*(.*)/i) || [])[1] || "";
    const sMax = g?.channel_overrides?.Email?.subject_length_max ?? 65;
    const pMax = g?.channel_overrides?.Email?.preview_length_max ?? 90;
    if (!subj) score -= 15; // missing subject
    if (subj.length > sMax) score -= 10;
    if (prev.length > pMax) score -= 5;
    if (!h.cta_detected) score -= 15; // single clear CTA recommended
  }
  if (channel === 'PaidSocial') {
    const max = g?.channel_overrides?.PaidSocial?.char_max ?? 125;
    if (h.char_count > max) score -= 15;
    if (h.hashtag_count > 0) score -= 5; // usually minimal hashtags for ads
  }
  if (channel === 'OrganicSocial') {
    const maxHashtags = g?.formatting?.hashtag_rules?.max ?? 3;
    if (h.hashtag_count > maxHashtags) score -= 10;
    if (!h.cta_detected) score -= 10; // soft CTA still good
  }
  if (channel === 'SMS') {
    const max = g?.channel_overrides?.SMS?.char_max ?? 160;
    if (h.char_count > max) score -= 20;
    if (g?.channel_overrides?.SMS?.link_required && !h.link_present) score -= 15;
  }
  if (channel === 'Print' || channel === 'DirectMail') {
    if (!h.cta_detected) score -= 10;
    if (h.avg_sentence_length > 26) score -= 10; // readability for skimming
  }
  if (channel === 'VideoScript') {
    if (h.avg_sentence_length > 22) score -= 10; // spoken clarity
    if (!h.cta_detected) score -= 10;
  }
  if (channel === 'LandingPage' || channel === 'DonationPage') {
    if (!h.cta_detected) score -= 10;
    if (h.hashtag_count > 0) score -= 5; // prefer minimal hashtags/emojis
      }
  if (channel === 'Blog' || channel === 'EventInvite') {
    if (!h.cta_detected) score -= 5;
  }
  return clamp(score, 0, 100);
}

function generateStrengths(copy, channel, g, h) {
  const out = [];
  const tones = (g?.voice?.tone || []).slice(0, 3).join(", ");

  if (tones) out.push(`Voice reflects brand tone (${tones}) across key lines.`);
  if ((h.preferred_terms_used || []).length) out.push(`Uses approved vocabulary (${(h.preferred_terms_used || []).join(", ")}) to reinforce positioning.`);
  if (h.cta_detected) out.push(`Clear action verb present; CTA aligns with donor journey stage.`);
  if ((h.hashtag_count || 0) <= (g?.formatting?.hashtag_rules?.max ?? 3)) out.push(`Social syntax within guidelines (hashtags ≤ ${(g?.formatting?.hashtag_rules?.max ?? 3)}).`);
  if ((g?.style?.person || '').toLowerCase() === 'second') out.push(`Consistent second-person address builds direct rapport with supporters.`);
  if (h.avg_sentence_length <= 26) out.push(`Concise sentences aid readability at Grade ${g?.voice?.reading_level ?? 8}.`);
  if ((g?.formatting?.cta_verbs || []).some((v) => new RegExp(`\\b${escapeRegex(v)}\\b`, 'i').test(copy))) out.push(`CTA verb matches brand's approved list (${(g?.formatting?.cta_verbs || []).slice(0,3).join(', ') || 'n/a'}).`);
  if ((copy.match(/\bwe\b|\bour\b/i))) out.push(`Collective framing balances impact with community ethos ("we/our").`);
  if (!/(cheap|handout|poor people)/i.test(copy)) out.push(`Avoids dignity-eroding terms flagged in brand guidance.`);

  while (out.length < 5) out.push("Structure and tone generally align with brand guidance.");
  return out.slice(0, 10);
}

function generateImprovements(copy, channel, g, h) {
  const out = [];
  const hashtagMax = g?.formatting?.hashtag_rules?.max ?? 3;
  const subj = (copy.match(/subject\s*:\s*(.*)/i) || [])[1] || "";
  const prev = (copy.match(/preview\s*:\s*(.*)/i) || [])[1] || "";
  const sMax = g?.channel_overrides?.Email?.subject_length_max ?? 65;
  const pMax = g?.channel_overrides?.Email?.preview_length_max ?? 90;

  if ((h.banned_terms_found || []).length) out.push(`Replace banned terms (${h.banned_terms_found.join(", ")}) per brand "vocab.banned" list.`);
  if (!h.cta_detected) out.push(`Add a single, explicit CTA using an approved verb from "formatting.cta_verbs".`);
  if (channel === 'Email') {
    if (!subj) out.push(`Add a subject line; guidance requires clear benefit within ${sMax} chars ("channel_overrides.Email.subject_length_max").`);
    if (subj.length > sMax) out.push(`Shorten subject to ≤ ${sMax} characters to avoid truncation ("channel_overrides.Email.subject_length_max").`);
    if (prev.length > pMax) out.push(`Shorten preview text to ≤ ${pMax} characters ("channel_overrides.Email.preview_length_max").`);
    if (!/(unsubscribe|manage preferences)/i.test(copy) && g?.compliance?.casl?.unsubscribe_required) out.push(`Include an unsubscribe/manage-preferences line to meet CASL ("compliance.casl.unsubscribe_required").`);
  }
  if (channel === 'PaidSocial' && h.char_count > (g?.channel_overrides?.PaidSocial?.char_max ?? 125)) out.push(`Trim body to ≤ ${(g?.channel_overrides?.PaidSocial?.char_max ?? 125)} chars ("channel_overrides.PaidSocial.char_max").`);
  if (channel === 'OrganicSocial' && h.hashtag_count > hashtagMax) out.push(`Reduce hashtags to ≤ ${hashtagMax} ("formatting.hashtag_rules.max").`);
  if (channel === 'SMS') {
    const max = g?.channel_overrides?.SMS?.char_max ?? 160;
    if (h.char_count > max) out.push(`Shorten SMS to ≤ ${max} chars ("channel_overrides.SMS.char_max").`);
    if (g?.channel_overrides?.SMS?.link_required && !h.link_present) out.push(`Include a short link as required ("channel_overrides.SMS.link_required").`);
  }
  if (h.avg_sentence_length > 26) out.push(`Break long sentences into 1–2 clauses to hit the reading level target ("voice.reading_level").`);
  if ((g?.voice?.avoid || []).some((term) => new RegExp(term, 'i').test(copy))) out.push(`Remove discouraged tone/phrases listed under "voice.avoid".`);
  if ((g?.style?.person || '').toLowerCase() !== 'second') out.push(`Shift to second-person framing (you/your) per "style.person" guidance.`);

  while (out.length < 5) out.push("Tighten copy to foreground donor benefit and clarity.");
  return out.slice(0, 10);
}

function score(copy, channel, g) {
  const h = runHeuristics(copy, channel, g);
  const subs = { voice_tone: 70, style: 70, vocab: 70, channel_fit: 70, channel_optimization: 80, cta_clarity: 50, compliance: 70, inclusivity: 80 };
  subs.vocab += Math.min(20, (h.preferred_terms_used?.length || 0) * 5);
  subs.vocab -= Math.min(40, (h.banned_terms_found?.length || 0) * 20);
  subs.vocab = clamp(subs.vocab, 0, 100);

  if (channel === 'PaidSocial') {
    const max = g?.channel_overrides?.PaidSocial?.char_max ?? 125;
    subs.channel_fit -= (Math.max(0, h.char_count - max) > 0 ? 25 : 0);
  }
  if (channel === 'OrganicSocial') {
    const maxHashtags = g?.formatting?.hashtag_rules?.max ?? 3;
    if (h.hashtag_count > maxHashtags) subs.channel_fit -= 15;
  }
  if (channel === 'SMS') {
    const max = g?.channel_overrides?.SMS?.char_max ?? 160;
    if (h.char_count > max) subs.channel_fit -= 25;
    if (g?.channel_overrides?.SMS?.link_required && !h.link_present) subs.channel_fit -= 20;
  }
  if (channel === 'Email') {
    const subj = (copy.match(/subject\s*:\s*(.*)/i) || [])[1] || "";
    const prev = (copy.match(/preview\s*:\s*(.*)/i) || [])[1] || "";
    const sMax = g?.channel_overrides?.Email?.subject_length_max ?? 65;
    const pMax = g?.channel_overrides?.Email?.preview_length_max ?? 90;
    if (subj.length && subj.length > sMax) subs.channel_fit -= 10;
    if (prev.length && prev.length > pMax) subs.channel_fit -= 10;
  }
  subs.channel_fit = clamp(subs.channel_fit, 0, 100);

  subs.channel_optimization = channelOptimizationScore(copy, channel, g, h);

  subs.cta_clarity += h.cta_detected ? 30 : -10;
  subs.cta_clarity = clamp(subs.cta_clarity, 0, 100);

  const allCaps = (copy.match(/\b[A-Z]{4,}\b/g) || []).length;
  subs.voice_tone -= Math.min(20, allCaps * 5);
  subs.style -= h.avg_sentence_length > 26 ? 15 : 0;
  subs.voice_tone = clamp(subs.voice_tone, 0, 100);
  subs.style = clamp(subs.style, 0, 100);

  const weights = { voice_tone: 25, style: 10, vocab: 10, channel_fit: 15, channel_optimization: 20, cta_clarity: 10, compliance: 5, inclusivity: 5 };
  const overall = Math.round((
    subs.voice_tone * weights.voice_tone + subs.style * weights.style + subs.vocab * weights.vocab +
    subs.channel_fit * weights.channel_fit + subs.channel_optimization * weights.channel_optimization +
    subs.cta_clarity * weights.cta_clarity + subs.compliance * weights.compliance + subs.inclusivity * weights.inclusivity
  ) / 100);

  const strengths = generateStrengths(copy, channel, g, h);
  const improvements = generateImprovements(copy, channel, g, h);

  const edits = suggestEdits(copy, channel, g, h);

  return { overall, subs, strengths, improvements, edits };
}

function Chips({ g }) {
  const chips = [];
  (g?.voice?.tone || []).forEach((t) => chips.push(`Tone: ${t}`));
  (g?.vocab?.preferred || []).slice(0, 3).forEach((t) => chips.push(`Preferred: ${t}`));
  if (g?.formatting?.hashtag_rules?.max != null) chips.push(`# max: ${g.formatting.hashtag_rules.max}`);
  if (g?.channel_overrides?.Email?.subject_length_max) chips.push(`Subj ≤ ${g.channel_overrides.Email.subject_length_max}`);
  if (g?.channel_overrides?.PaidSocial?.char_max) chips.push(`Paid chars ≤ ${g.channel_overrides.PaidSocial.char_max}`);
  if (g?.channel_overrides?.SMS?.char_max) chips.push(`SMS chars ≤ ${g.channel_overrides.SMS.char_max}`);
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c, i) => <span key={i} className="text-xs bg-gray-100 rounded-full px-3 py-1">{c}</span>)}
    </div>
  );
}

function Bar({ label, value }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex justify-between text-xs mb-1"><span>{label}</span><span>{Math.round(value)}</span></div>
      <div className="h-2 bg-gray-200 rounded">
        <div className="h-2 rounded" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #6366f1, #22d3ee)" }} />
      </div>
    </div>
  );
}

function List({ title, items, variant }) {
  return (
    <div>
      <h4 className="font-semibold mb-1">{title}</h4>
      <ul className={`text-sm space-y-1 ${variant === 'warn' ? 'text-red-700' : 'text-emerald-700'}`}>
        {(items && items.length ? items : ["—"]).map((s, i) => <li key={i}>• {s}</li>)}
      </ul>
    </div>
  );
}

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="mt-3 px-3 py-1 rounded border text-sm"
      onClick={async () => { await navigator.clipboard.writeText(text || ""); setOk(true); setTimeout(() => setOk(false), 1200); }}
    >{ok ? 'Copied!' : 'Copy to Clipboard'}</button>
  );
}

function labelize(k) {
  return (
    {
      voice_tone: 'Voice & Tone',
      style: 'Style',
      vocab: 'Vocabulary',
      channel_fit: 'Channel Fit (Constraints)',
      channel_optimization: 'Channel Optimization (Best Practices)',
      cta_clarity: 'CTA Clarity',
      compliance: 'Compliance',
      inclusivity: 'Inclusivity'
    }
  )[k] || k;
}

// ------------------------
// Inline CSS (valid)
// ------------------------
function StyleTag() {
  const css = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:wght@400;500&family=Playfair+Display:wght@500;700&display=swap');

:root { --charcoal:#2B2B2B; --cream:#FAF8F3; --cream2:#FDFCF8; }

body { background-color: var(--cream); color: var(--charcoal); font-family: 'IBM Plex Serif', serif; line-height:1.6; }

.bg-cream-texture { background-color: var(--cream); background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAlklEQVR42mJgIBEwMjCysbFhZ2dn8w8DMwMDgxsbG0ZGRhYGBkZrZ2dnEwwMDAxMbGxsTk5OZ7OzMDA8MTExoGBgbG5uZkFhYWJkZGBkZOTk5MDExASUlpYWgkqKyrrGxkb///+RkZGhgYFh1tbWf/j4+Hj39/cvLCyMjIyMOXFxcf///+Xl5ZWRkYFxcXH2hoaG1NfXU1ZWFgQGBn4oU8w6AAAAAElFTkSuQmCC'); background-repeat: repeat; }
.bg-light-cream-texture { background-color: var(--cream2); background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAjElEQVR42mL8//8/AymAiSTEsLCwMH5+/pCVlYVFRUWZmZn9MzEx+fj4iKqqKsbGxgAkgQgwMDDw//8P2dnZnp+fX0RERHcEJuSEhASLi4uLw8PDz83NDZycnGRmZr5ERkZmYmJiJOLi4q2QkJBnAikSmZDZgAgaGhpcWlpKdnZ2XjVpaWkVFbW5uRUXF1gVqEDiRhi/ho4BAAAAAElFTkSuQmCC'); background-repeat: repeat; }
.border-charcoal { border-color: var(--charcoal); }
.organic-shadow { box-shadow: 0 2px 4px rgba(0,0,0,0.08), inset 0 0 3px rgba(0,0,0,0.05); }
.organic-btn { background-color: #C97C5D; border-radius: 9999px; border: 2px solid var(--charcoal); box-shadow: inset 0 0 4px rgba(0,0,0,0.2); font-family: 'IBM Plex Serif', serif; font-weight: 500; transition: background-color .2s ease; color:#fff; }
.organic-btn:hover { background-color: #d08c6f; }
.score-badge { background-color: var(--cream2); background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAiUlEQVR42mL8//8/AymAiSTEsLCwMH5+/pCVlYVFRUWZmZn9MzEx+fj4iKqqKsbGxgAkgQgwMDDw//8P2dnZnp+fX0RERHcEJuSEhASLi4uLw8PDz83NDZycnGRmZr5ERkZmYmJiJOLi4q2QkJBnAikSmZDZgAgaGhpcWlpKdnZ2XjVpaWkVFbW5uRUXF1gVqEEZaqx7zloAAAAASUVORK5CYII='); background-repeat: repeat; border: 2px solid var(--charcoal); border-radius: 50%; font-weight: bold; font-size: 1.5rem; }
.bg-paper-highlight { background-color: #FFFDF6; background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAh0lEQVR42mL8//8/AymAiSTEsLCwMH5+/pCVlYVFRUWZmZn9MzEx+fj4iKqqKsbGxgAkgQgwMDDw//8P2dnZnp+fX0RERHcEJuSEhASLi4uLw8PDz83NDZycnGRmZr5ERkZmYmJiJOLi4q2QkJBnAikSmZDZgAgaGhpcWlpKdnZ2XjVpaWkVFbW5uRUXF1gVqEInE4s/oLXIAAAAASUVORK5CYII='); background-repeat: repeat; }
select, textarea, pre { background-color: rgba(255,255,255,.7); backdrop-filter: blur(1px); }
select { font-family: 'IBM Plex Serif', serif; }
pre { font-family: 'IBM Plex Serif', serif; border: 1px solid var(--charcoal); border-radius: 4px; }
`;
  return <style>{css}</style>;
}

// ------------------------
// Component
// ------------------------
export default function BrandAlignerDemo() {
  const [guideText, setGuideText] = useState(DEFAULT_GUIDE);
  const [copy, setCopy] = useState("Subject: Join our monthly giving family\nPreview: Make your impact felt today.\n\nHi {{first_name}},\nOur donor community helps families every day. Join as a monthly giving member. #GiveMonthly #Community #Hope");
  const [channel, setChannel] = useState("Email");
  const [result, setResult] = useState(null);
  const [showRewrite, setShowRewrite] = useState(false);
  const g = useMemo(() => parseGuidelines(guideText), [guideText]);

  // --- Lightweight runtime checks (test cases)
  try {
    const tg = parseGuidelines(DEFAULT_GUIDE);
    console.assert(Array.isArray(tg.voice.tone), 'voice.tone should be array');
    console.assert(typeof tg.channel_overrides.Email.subject_length_max !== 'undefined', 'email subject_length_max present');
  } catch {}

  try {
    const testG = parseGuidelines(DEFAULT_GUIDE);
    const bad = "This cheap offer helps poor people";
    const h = runHeuristics(bad, 'OrganicSocial', testG);
    const edited = suggestEdits(bad, 'OrganicSocial', testG, h);
    console.assert(!/cheap|poor people/i.test(edited), 'banned terms replaced in edits');
  } catch {}

  try {
    const t = score(copy, channel, g);
    console.assert(t.strengths.length >= 5, 'at least 5 strengths');
    console.assert(t.improvements.length >= 5, 'at least 5 improvements');
    console.assert(typeof t.subs.channel_optimization === 'number', 'channel optimization provided');
  } catch {}

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Inline style & fonts */}
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:wght@400;500&family=Playfair+Display:wght@500;700&display=swap" rel="stylesheet" />
      <StyleTag />

      {/* Left: Guidelines */}
      <div className="border-b lg:border-b-0 lg:border-r p-4 space-y-4 bg-cream-texture">
        <h2 className="text-xl font-semibold">Brand Guidelines</h2>
        <p className="text-sm" style={{opacity:.75}}>Paste your guidelines or tweak the example below.</p>
        <textarea className="w-full h-72 border border-charcoal rounded organic-shadow p-3 font-mono text-sm" value={guideText} onChange={e => setGuideText(e.target.value)} />
        <Chips g={g} />
      </div>

      {/* Right: Copy & Results */}
      <div className="p-4 space-y-4 bg-light-cream-texture">
        <h2 className="text-xl font-semibold">Your Copy</h2>
        <div className="flex gap-2 items-center">
          <label className="text-sm">Channel</label>
          <select className="border border-charcoal rounded px-2 py-1" value={channel} onChange={e => { setChannel(e.target.value); setShowRewrite(false); }}>
            {CHANNELS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button className="ml-auto px-4 py-2 organic-btn" onClick={() => { setResult(score(copy, channel, g)); setShowRewrite(false); }}>
            See How It Matches Your Brand Voice
          </button>
        </div>
        <textarea className="w-full h-64 border border-charcoal rounded organic-shadow p-3" value={copy} onChange={e => { setCopy(e.target.value); setShowRewrite(false); }} placeholder="Paste your text…" />

        {result && (
          <div className="border border-charcoal rounded p-4 space-y-6 organic-shadow bg-cream-texture">
            <div className="flex items-center gap-3">
              <div className="score-badge w-16 h-16 flex items-center justify-center">{result.overall}</div>
              <div className="text-sm" style={{opacity:.75}}>Brand Alignment Score</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(result.subs).map(([k, v]) => (
                <Bar key={k} label={labelize(k)} value={Number(v)} />
              ))}
            </div>

            {/* Single column feedback: Strengths then Improvements */}
            <div className="space-y-6">
              <List title="✅ Strengths (what’s working)" items={result.strengths} variant="good" />
              <List title="✏️ Make it even better (with references to your brand guide)" items={result.improvements} variant="warn" />
            </div>

            {/* Rewrite on demand only */}
            <div className="pt-2">
              {!showRewrite ? (
                <button className="px-4 py-2 organic-btn" onClick={() => setShowRewrite(true)}>Rewrite with AI</button>
              ) : (
                <div>
                  <h4 className="font-semibold mb-2">💡 Suggested Alternative (AI)</h4>
                  <pre className="bg-paper-highlight p-3 rounded text-sm whitespace-pre-wrap">{result.edits}</pre>
                  <CopyBtn text={result.edits} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
