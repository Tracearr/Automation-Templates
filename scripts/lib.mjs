/**
 * Reading and checking the envelopes in templates/. Everything here runs off
 * @tracearr/shared, so a template that passes CI is a template the app accepts.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import {
  CONDITION_FIELDS,
  encodeShareCode,
  fingerprintOf,
  formatConditionFieldValue,
  slotValueFor,
  templateEnvelopeSchema,
} from '@tracearr/shared';

export const TEMPLATES_DIR = 'templates';

const sha256Hex = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

/** The same code the app produces: 'tracearr1.' + base64url(deflateRaw(canonicalJson(envelope))). */
export function shareCodeOf(envelope) {
  return encodeShareCode(envelope, (bytes) => new Uint8Array(deflateRawSync(bytes)));
}

/**
 * Every envelope in templates/, with one error string per problem found.
 * A non-JSON file in that directory is itself a problem: the gallery renders
 * the envelope's own fields and nothing else, so no other file belongs there.
 */
export function readTemplates(dir = TEMPLATES_DIR) {
  const errors = [];
  const templates = [];
  const seen = new Map();

  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.json')) {
      errors.push(`${dir}/${file}: only .json envelopes belong in ${dir}/`);
      continue;
    }

    let raw;
    try {
      raw = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    } catch (error) {
      errors.push(`${dir}/${file}: not valid JSON (${error.message})`);
      continue;
    }

    const parsed = templateEnvelopeSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(`${dir}/${file}: ${issue.path.join('.') || '(root)'}: ${issue.message}`);
      }
      continue;
    }

    const envelope = parsed.data;
    if (file !== `${envelope.slug}.json`) {
      errors.push(`${dir}/${file}: slug is "${envelope.slug}", so the file must be ${envelope.slug}.json`);
    }
    const first = seen.get(envelope.slug);
    if (first) {
      errors.push(`${dir}/${file}: slug "${envelope.slug}" is already used by ${first}`);
    } else {
      seen.set(envelope.slug, `${dir}/${file}`);
    }

    const recomputed = fingerprintOf(
      { inputs: envelope.inputs, definition: envelope.definition },
      sha256Hex
    );
    if (recomputed !== envelope.fingerprint) {
      errors.push(
        `${dir}/${file}: fingerprint is ${envelope.fingerprint}, recomputed ${recomputed}. ` +
          `Export it again from Tracearr rather than editing the JSON by hand.`
      );
      continue;
    }

    templates.push({ file: `${dir}/${file}`, envelope });
  }

  return { templates, errors };
}

// ---------------------------------------------------------------------------
// The plain-words sentence.
//
// A port of the web's describeAutomation() and describeTemplate(), with the
// strings lifted from the `en` locale's `automations.describe.*`. The gallery
// renders index.json, so this has to say what the app says; when the app's
// describe grammar or its copy moves, move this with it.
//
// Structural facts (units, options, value types) come from @tracearr/shared, so
// only the words are copied here.
// ---------------------------------------------------------------------------

/** `automations.describe.*` from packages/translations/src/locales/en/pages.json. */
const TEXT = {
  "more_one": "+{{count}} more",
  "more_other": "+{{count}} more",
  "noValues": "(none)",
  "includesSameDevice": "includes same device",
  "uniqueIps": "unique IPs",
  "deviceTypesOnly": "{{types}} only",
  "when": "When {{text}}",
  "or": "or {{text}}",
  "nothing": "nothing yet",
  "onlyWhen": "and only if",
  "andAlso": "and also",
  "allOf": "all of:",
  "anyOf": "any of:",
  "joinAll": "and",
  "joinAny": "or",
  "then": "then {{text}}",
  "otherwise": "Otherwise",
  "appliesTo": "Applies to {{name}}",
  "duration": {
    "minutes_one": "{{count}} minute",
    "minutes_other": "{{count}} minutes",
    "days_one": "{{count}} day",
    "days_other": "{{count}} days"
  },
  "triggers": {
    "sessionStarted": "a stream starts",
    "sessionStopped": "a stream stops",
    "sessionTranscodeChanged": "transcoding starts or stops",
    "sessionPaused": "a stream is paused",
    "sessionHeldFor": "a stream has been paused for {{duration}}",
    "sessionHeldForTotal": "a stream has been paused for {{duration}} in total",
    "accountInactiveFor": "an account has been inactive for {{duration}}",
    "mediaAdded": "media is added",
    "mediaUpgraded": "media is upgraded",
    "serverDown": "a server goes down",
    "serverUp": "a server comes back up",
    "pluginUpdateAvailable": "a plugin update is available",
    "serverUpdateAvailable": "a server update is available",
    "tracearrUpdateAvailable": "a Tracearr update is available"
  },
  "operators": {
    "eq": "is",
    "neq": "is not",
    "gt": "is above",
    "gte": "is at least",
    "lt": "is below",
    "lte": "is at most",
    "in": "is one of",
    "not_in": "is not one of",
    "contains": "contains",
    "not_contains": "does not contain"
  },
  "fields": {
    "concurrent_streams": "the stream count",
    "active_session_distance_km": "the distance between streams",
    "travel_speed_kmh": "the travel speed",
    "unique_ips_in_window": "the number of IP addresses",
    "unique_devices_in_window": "the number of devices",
    "inactive_days": "the time since the last stream",
    "current_pause_minutes": "the current pause",
    "total_pause_minutes": "the total pause time",
    "source_resolution": "the source resolution",
    "output_resolution": "the output resolution",
    "is_transcoding": "the transcoding",
    "is_transcode_downgrade": "the downgrade",
    "source_bitrate_mbps": "the source bitrate",
    "user_id": "the user",
    "trust_score": "the trust score",
    "account_age_days": "the account age",
    "device_type": "the device type",
    "client_name": "the player",
    "platform": "the platform",
    "is_local_network": "the local network",
    "country": "the country",
    "ip_in_range": "the IP address",
    "server_id": "the server",
    "media_type": "the media type",
    "library_item_type": "the item type",
    "library_name": "the library",
    "resolution_after": "the resolution",
    "dynamic_range_after": "the dynamic range",
    "video_codec_after": "the video codec",
    "audio_channels_after": "the audio channels",
    "file_size_after": "the file size"
  },
  "states": {
    "is_local_network": {
      "yes": "the user is on the local network",
      "no": "the user is not on the local network"
    },
    "is_transcode_downgrade": {
      "yes": "the stream is downgraded",
      "no": "the stream is not downgraded"
    },
    "is_transcoding": {
      "video": {
        "yes": "the stream is transcoding video",
        "no": "the stream is not transcoding video"
      },
      "audio": {
        "yes": "the stream is transcoding audio",
        "no": "the stream is not transcoding audio"
      },
      "video_or_audio": {
        "yes": "the stream is transcoding",
        "no": "the stream is not transcoding"
      },
      "neither": {
        "yes": "the stream is not transcoding",
        "no": "the stream is transcoding"
      }
    }
  },
  "actions": {
    "if": "if",
    "flagIt": "Flag it",
    "doNothing": "do nothing",
    "send": "send to {{destinations}}",
    "sendAnywhere": "send a notification",
    "kill_stream": "stop the stream",
    "message_client": "message the player",
    "trustUp": "raise trust by {{amount}}",
    "trustDown": "drop trust by {{amount}}",
    "trustAdjust": "adjust trust by {{amount}}",
    "trustSet": "set trust to {{value}}",
    "trustReset": "reset trust"
  },
  "scope": {
    "server": "one server",
    "account": "one account",
    "person": "one person"
  },
  "sameDeviceInput": "same device: {{input}}",
  "uniqueIpsInput": "unique IPs: {{input}}",
  "unbound": {
    "server": "a chosen server",
    "account": "a chosen account",
    "person": "a chosen person",
    "destinations": "a chosen destination",
    "field_value": "a chosen value",
    "select": "a chosen option",
    "number": "a chosen number",
    "duration": "a chosen length of time",
    "text": "a chosen message",
    "boolean": "a chosen setting",
    "listed": "those chosen"
  }
};

/** `automations.units.*`, for a threshold whose field declares a unit. */
const UNITS = {
  "km": "km",
  "kmh": "km/h",
  "mbps": "Mbps",
  "days": "days",
  "minutes": "minutes",
  "hours": "hours",
  "gb": "GB",
  "seconds": "seconds"
};

/** `automations.options.*`, for an enum field's stored values. */
const OPTIONS = {
  "4K": "4K (2160p)",
  "1080p": "1080p",
  "720p": "720p",
  "480p": "480p",
  "SD": "SD",
  "unknown": "Unknown",
  "mobile": "Mobile",
  "tablet": "Tablet",
  "tv": "TV",
  "desktop": "Desktop",
  "browser": "Browser",
  "ios": "iOS",
  "android": "Android",
  "windows": "Windows",
  "macos": "macOS",
  "linux": "Linux",
  "tvos": "tvOS",
  "androidtv": "Android TV",
  "roku": "Roku",
  "webos": "webOS",
  "tizen": "Tizen",
  "movie": "Movie",
  "episode": "TV Episode",
  "track": "Music",
  "photo": "Photo",
  "live": "Live TV",
  "trailer": "Trailer",
  "video": "Video",
  "audio": "Audio",
  "video_or_audio": "Video or Audio",
  "neither": "Neither (Direct Play)",
  "8K": "8K",
  "1440p": "1440p",
  "sdr": "SDR",
  "hdr": "HDR",
  "hdr10": "HDR10",
  "hdr10+": "HDR10+",
  "hlg": "HLG",
  "dolby vision": "Dolby Vision",
  "libraryItemType": {
    "movie": "Movie",
    "show": "Show",
    "season": "Season",
    "episode": "Episode",
    "artist": "Artist",
    "album": "Album",
    "track": "Track",
    "photo": "Photo"
  }
};

/** The camelCase key each trigger type reads its words under. */
const TRIGGER_KEYS = {
  'session.started': 'sessionStarted',
  'session.stopped': 'sessionStopped',
  'session.transcode_changed': 'sessionTranscodeChanged',
  'session.paused': 'sessionPaused',
  'session.held_for': 'sessionHeldFor',
  'account.inactive_for': 'accountInactiveFor',
  'media.added': 'mediaAdded',
  'media.upgraded': 'mediaUpgraded',
  'server.down': 'serverDown',
  'server.up': 'serverUp',
  'plugin.update_available': 'pluginUpdateAvailable',
  'server.update_available': 'serverUpdateAvailable',
  'tracearr.update_available': 'tracearrUpdateAvailable',
};

/** The sentence is written for one reader, and the gallery's reader is metric. */
const UNIT_SYSTEM = 'metric';

/** i18next's `{{name}}` interpolation, which is all these strings use. */
const fill = (template, values) =>
  template.replace(/\{\{(\w+)\}\}/g, (whole, key) => (key in values ? String(values[key]) : whole));

const plural = (group, unit, count) => TEXT[group][`${unit}_${count === 1 ? 'one' : 'other'}`];

const isPlaceholder = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && '$input' in value;

const isEnabled = (node) => node.enabled !== false;

const isUnbound = (value) =>
  value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

const descriptorOf = (field) => CONDITION_FIELDS[field];

/** An optional input nothing answered; the key it sits under drops out of the definition. */
const DROP = Symbol('unbound');

/**
 * The definition as the gallery sees it: every default substituted, every optional
 * input nobody answered dropped, and every required one still naming the kind of
 * thing it holds. Mirrors describeTemplate's bindDefinition with nothing bound.
 */
function bindDefinition(envelope) {
  const resolved = new Map();
  for (const input of envelope.inputs) {
    const value = 'default' in input ? input.default : undefined;
    if (!isUnbound(value)) resolved.set(input.key, { input, value });
  }

  const substitute = (node, slot) => {
    if (isPlaceholder(node)) {
      const binding = resolved.get(node.$input);
      if (binding) return slotValueFor(binding.input, binding.value, slot);
      const input = envelope.inputs.find((entry) => entry.key === node.$input);
      return input?.required ? node : DROP;
    }
    if (Array.isArray(node)) {
      return node.map((item) => substitute(item, slot)).filter((item) => item !== DROP);
    }
    if (node !== null && typeof node === 'object') {
      const out = {};
      for (const [key, child] of Object.entries(node)) {
        const value = substitute(child, key);
        if (value !== DROP) out[key] = value;
      }
      return out;
    }
    return node;
  };

  const { definition } = envelope;
  const scope = {};
  for (const [key, value] of Object.entries(definition.scope ?? {})) {
    const bound = substitute(value, key);
    if (bound !== DROP && bound !== undefined) scope[key] = bound;
  }

  return {
    kind: definition.kind,
    inputKinds: Object.fromEntries(envelope.inputs.map((input) => [input.key, input.kind])),
    triggers: substitute(definition.triggers, 'triggers'),
    conditions: substitute(definition.conditions, 'conditions'),
    actions: substitute(definition.actions, 'actions'),
    scope,
  };
}

/**
 * Punctuation joins clauses, so it lands on the fragment its clause ends with. Only
 * the same mark is skipped: a truncated list ends in `...` and the separator stands.
 */
function appendSuffix(fragments, suffix) {
  const last = fragments[fragments.length - 1];
  if (last === undefined || last.endsWith(suffix)) return;
  fragments[fragments.length - 1] = `${last}${suffix}`;
}

/** An `if` closes on a full stop, so whatever follows it opens a sentence. */
const capitalize = (text) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** A required input nothing answered reads as the kind of thing it holds. */
const placeholderText = (ctx, placeholder) =>
  TEXT.unbound[ctx.inputKinds[placeholder.$input] ?? 'field_value'];

function durationText(ctx, value, unit) {
  if (isPlaceholder(value)) return placeholderText(ctx, value);
  return fill(plural('duration', unit, value), { count: value });
}

function describeTrigger(ctx, trigger) {
  if (trigger.type === 'session.held_for') {
    const duration = durationText(ctx, trigger.params.minutes, 'minutes');
    return fill(
      TEXT.triggers[trigger.params.measure === 'total' ? 'sessionHeldForTotal' : 'sessionHeldFor'],
      { duration }
    );
  }
  if (trigger.type === 'account.inactive_for') {
    const duration = durationText(ctx, trigger.params.days, 'days');
    return fill(TEXT.triggers.accountInactiveFor, { duration });
  }
  return TEXT.triggers[TRIGGER_KEYS[trigger.type]] ?? trigger.type;
}

function describeTriggers(ctx, triggers) {
  const enabled = triggers.filter(isEnabled);
  if (enabled.length === 0) return [fill(TEXT.when, { text: TEXT.nothing })];
  return enabled.map((trigger, index) =>
    fill(index === 0 ? TEXT.when : TEXT.or, { text: describeTrigger(ctx, trigger) })
  );
}

/** The picker's label for one of an enum field's stored values. */
function optionLabel(field, value) {
  const options = descriptorOf(field)?.options ?? [];
  if (!options.includes(value)) return value;
  return field === 'library_item_type'
    ? (OPTIONS.libraryItemType[value] ?? value)
    : (OPTIONS[value] ?? value);
}

const scalarText = (field, value) =>
  typeof value === 'boolean' ? String(value) : optionLabel(field, value);

function listText(field, values) {
  if (values.length === 0) return TEXT.noValues;
  const labels = values.map((entry) =>
    typeof entry === 'number' ? String(entry) : scalarText(field, entry)
  );
  return labels.length > 3 ? `${labels.slice(0, 3).join(', ')}...` : labels.join(', ');
}

/** The threshold as the reader sees it, in their units. */
function conditionValue(ctx, condition) {
  const { field, value } = condition;
  // "is one of a chosen value" is not English; a list slot needs the plural frame.
  if (isPlaceholder(value)) {
    return descriptorOf(field)?.valueType === 'multiSelect'
      ? TEXT.unbound.listed
      : placeholderText(ctx, value);
  }
  if (Array.isArray(value)) return listText(field, value);

  if (typeof value === 'number') {
    if (descriptorOf(field)) {
      const converted = formatConditionFieldValue(value, field, UNIT_SYSTEM);
      if (converted.unit) return `${converted.displayValue} ${converted.unit}`;
    }
    const unit = descriptorOf(field)?.unit;
    return unit ? `${value} ${UNITS[unit] ?? unit}` : String(value);
  }

  return scalarText(field, value);
}

/** Params that change what a threshold counts, so the sentence has to say so. */
function conditionNotes(ctx, condition) {
  const { params } = condition;
  if (!params) return '';

  const notes = [];
  // exclude_same_device defaults to on, exclude_same_ip to off, so each shows when flipped.
  const sameDevice = params.exclude_same_device;
  if (isPlaceholder(sameDevice)) {
    notes.push(fill(TEXT.sameDeviceInput, { input: placeholderText(ctx, sameDevice) }));
  } else if (sameDevice === false) {
    notes.push(TEXT.includesSameDevice);
  }

  const uniqueIps = params.exclude_same_ip;
  if (isPlaceholder(uniqueIps)) {
    notes.push(fill(TEXT.uniqueIpsInput, { input: placeholderText(ctx, uniqueIps) }));
  } else if (uniqueIps === true) {
    notes.push(TEXT.uniqueIps);
  }

  if (params.count_device_types?.length) {
    const types = params.count_device_types
      .map((type) => OPTIONS[type] ?? type)
      .join('/');
    notes.push(fill(TEXT.deviceTypesOnly, { types }));
  }

  return notes.length > 0 ? ` (${notes.join(', ')})` : '';
}

/** Some fields read as a state ("the stream is transcoding") rather than a comparison. */
function stateClause(condition) {
  const { field, operator, value } = condition;
  if (operator !== 'eq' && operator !== 'neq') return null;

  if ((field === 'is_local_network' || field === 'is_transcode_downgrade') && typeof value === 'boolean') {
    return TEXT.states[field][value === (operator === 'eq') ? 'yes' : 'no'];
  }

  if (field === 'is_transcoding' && TEXT.states.is_transcoding[value]) {
    return TEXT.states.is_transcoding[value][operator === 'eq' ? 'yes' : 'no'];
  }

  return null;
}

function describeCondition(ctx, condition) {
  const state = stateClause(condition);
  if (state) return state;

  const { field, operator } = condition;
  const subject = TEXT.fields[field] ?? field;
  const phrase = TEXT.operators[operator] ?? operator;
  return `${subject} ${phrase} ${conditionValue(ctx, condition)}${conditionNotes(ctx, condition)}`;
}

/**
 * The condition groups as fragments. `lead` opens the first group; the rest carry
 * "and also". Three or more conditions take the list form, where the joining word
 * would be lost among the commas.
 */
function describeGroups(ctx, groups, lead) {
  const fragments = [];

  for (const group of groups.filter(isEnabled)) {
    const conditions = group.conditions.filter(isEnabled);
    if (conditions.length === 0) continue;

    let connector = lead;
    if (fragments.length > 0) {
      appendSuffix(fragments, ';');
      connector = TEXT.andAlso;
    }
    // A group saved before `match` existed matches any of its conditions.
    const all = group.match === 'all';
    const listed = conditions.length > 2;
    const match = listed ? (all ? TEXT.allOf : TEXT.anyOf) : null;
    const prefix = [connector, match].filter((part) => part !== null).join(' ');
    if (prefix) fragments.push(prefix);

    conditions.forEach((condition, index) => {
      if (index > 0) {
        if (listed) appendSuffix(fragments, ',');
        else fragments.push(all ? TEXT.joinAll : TEXT.joinAny);
      }
      fragments.push(describeCondition(ctx, condition));
    });
  }

  return fragments;
}

function trustText(ctx, action) {
  if (action.mode === 'reset') return TEXT.actions.trustReset;
  if (action.mode === 'set') {
    const value = isPlaceholder(action.value) ? placeholderText(ctx, action.value) : String(action.value);
    return fill(TEXT.actions.trustSet, { value });
  }

  const { amount } = action;
  if (isPlaceholder(amount)) {
    return fill(TEXT.actions.trustAdjust, { amount: placeholderText(ctx, amount) });
  }
  const points = Math.abs(amount ?? 0);
  return amount !== undefined && amount < 0
    ? fill(TEXT.actions.trustDown, { amount: points })
    : fill(TEXT.actions.trustUp, { amount: points });
}

function leafText(ctx, action) {
  switch (action.type) {
    case 'send':
      // The index carries no destination names, so a send always reads as a send.
      return TEXT.actions.sendAnywhere;
    case 'kill_stream':
      return TEXT.actions.kill_stream;
    case 'message_client':
      return TEXT.actions.message_client;
    case 'trust':
      return trustText(ctx, action);
    default:
      return action.type;
  }
}

function describeAction(ctx, action) {
  if (action.type !== 'if') return [leafText(ctx, action)];

  const fragments = [TEXT.actions.if];
  const conditions = describeGroups(ctx, action.conditions.groups, null);
  // A half-built `if` reads as one rather than trailing off into a comma.
  fragments.push(...(conditions.length > 0 ? conditions : [TEXT.nothing]));
  appendSuffix(fragments, ',');
  fragments.push(...describeBranch(ctx, action.then));
  appendSuffix(fragments, '.');
  fragments.push(TEXT.otherwise);
  fragments.push(...describeBranch(ctx, action.else));
  appendSuffix(fragments, '.');

  return fragments;
}

/** An empty branch still says so: the sentence has to close the `if`. */
function describeBranch(ctx, actions) {
  const fragments = describeActions(ctx, actions);
  return fragments.length > 0 ? fragments : [TEXT.actions.doNothing];
}

function describeActions(ctx, actions, kind) {
  const fragments = [];
  // A policy records a violation whatever else it does, so the flag opens the clause.
  if (kind === 'policy') fragments.push(TEXT.actions.flagIt);

  for (const action of actions.filter(isEnabled)) {
    const next = describeAction(ctx, action);
    const first = next[0];
    const previous = fragments[fragments.length - 1];

    if (first !== undefined && previous !== undefined) {
      if (previous.endsWith('.')) next[0] = capitalize(first);
      else {
        appendSuffix(fragments, ',');
        next[0] = fill(TEXT.then, { text: first });
      }
    }

    fragments.push(...next);
  }

  return fragments;
}

function describeScope(ctx, definition) {
  const { serverId, serverUserId, userId } = definition.scope;
  const named = (id, fallback) => (isPlaceholder(id) ? placeholderText(ctx, id) : TEXT.scope[fallback]);

  let name = null;
  if (serverId) name = named(serverId, 'server');
  else if (serverUserId) name = named(serverUserId, 'account');
  else if (userId) name = named(userId, 'person');
  if (name === null) return null;

  return fill(TEXT.appliesTo, { name });
}

/** A policy's flag opens a sentence of its own; other actions close the clause they follow. */
const actionSeparator = (kind, hasConditions) =>
  kind === 'policy' ? '.' : hasConditions ? ';' : ',';

/**
 * The template in one sentence, with its defaults filled in, as
 * "When a stream starts, and only if the stream count is above 3. Flag it."
 */
export function sentenceOf(envelope) {
  const ctx = bindDefinition(envelope);
  const fragments = describeTriggers(ctx, ctx.triggers ?? []);

  const conditions = describeGroups(ctx, ctx.conditions?.groups ?? [], TEXT.onlyWhen);
  if (conditions.length > 0) {
    appendSuffix(fragments, ',');
    fragments.push(...conditions);
  }

  const actions = describeActions(ctx, ctx.actions?.actions ?? [], ctx.kind);
  if (actions.length > 0) {
    appendSuffix(fragments, actionSeparator(ctx.kind, conditions.length > 0));
    fragments.push(...actions);
  }
  appendSuffix(fragments, '.');

  const scope = describeScope(ctx, ctx);
  if (scope) {
    fragments.push(scope);
    appendSuffix(fragments, '.');
  }

  return fragments.join(' ');
}

/**
 * The consequence ids the app shows under "What this does", in the same order
 * and by the same rules as the web's templateEffects().
 */
export function effectsOf(envelope) {
  const found = new Set();
  const walk = (actions) => {
    for (const action of actions) {
      if (action.type === 'if') {
        walk(action.then);
        walk(action.else);
        continue;
      }
      if (action.type === 'kill_stream') found.add('kill');
      if (action.type === 'trust') found.add('trust');
      if (action.type === 'message_client') found.add('message');
    }
  };
  walk(envelope.definition.actions.actions);

  const lines = ['kill', 'trust', 'message'].filter((line) => found.has(line));
  if (envelope.definition.kind === 'policy') lines.push('violation');
  if (lines.length === 0) lines.push('tellsOnly');

  const hasServerInput = envelope.inputs.some((input) => input.kind === 'server');
  lines.push(hasServerInput ? 'allServers' : 'everyServer');
  return lines;
}
