/**
 * Preventivo Rapido antizanzare — motore di calcolo (funzioni pure).
 *
 * Lavora sul catalogo pubblicato dal modulo antizanzare dell'app OMPRA
 * (tabella az_catalogo_pubblicato): stessi codici, stessi prezzi di
 * listino IVA esclusa. Qui ci sono solo le REGOLE del preventivo al volo,
 * concordate con Simone il 03/10/2026.
 */

/* ─────────────── regole del preventivo rapido ─────────────── */

export const REGOLE = {
  passoRaffrescamento: 1.5, // m fra un ugello e l'altro sul raffrescamento
  tuboCollegamento: 10, // m di tubo per arrivare dalla centralina al perimetro
  installazione: { fisso: 250, perUgello: 30 }, // installazione e collaudo (30 €/ugello dal 04/10/2026)
  forbice: 0.1, // ±10%: accessori e imprevisti non conteggiati
  // Zanzero DUAL a 2 uscite distinte: 350 € IVA inclusa, senza codice
  sovrapprezzoDual2Uscite: 286.89,
  minimoUgelliComfort: 20,
  mesiStagione: 5,
};

export const BRAND = [
  { id: 'geyser', label: 'Stocker', wifi: 'sempre' },
  { id: 'pro', label: 'Zanzero', wifi: 'scelta' },
  { id: 'gardheaven', label: 'Gardheaven', wifi: 'scelta' },
];

export const CONFIGURAZIONI = [
  { id: 'uno', label: '1 prodotto' },
  { id: 'stesso', label: '2 prodotti, stesso circuito' },
  { id: 'due', label: '2 prodotti, 2 circuiti' },
  { id: 'raffresc', label: 'Solo raffrescamento', soloBrand: 'gardheaven' },
];

/* Articoli d'impianto usati nel conto rapido, per brand. */
const ARTICOLI = {
  geyser: { tubo: '4213', ugello: '4219', porta: '4236', t: '4222' },
  pro: { tubo: 'AI14100N', ugello: 'AI040302', porta: 'AI529014', t: 'AI191414' },
  gardheaven: { tubo: 'TBPA30BAR1/4', ugello: 'UGEL003', porta: 'RACCPUD1/4', t: 'RACCT1/4' },
  // raffrescamento: ugello fine e tubo per l'alta pressione
  raffresc: { tubo: 'TBPA60BAR1/4', ugello: 'UGEL0015', porta: 'RACCPUD1/4', t: 'RACCT1/4' },
};

/**
 * Centraline candidate, dalla piu' piccola alla piu' grande.
 * La prima che regge gli ugelli per linea e' quella proposta.
 */
function candidate(brand, config, wifi) {
  if (brand === 'geyser') {
    if (config === 'uno') return ['436', '415'];
    if (config === 'stesso') return ['415'];
    if (config === 'due') return ['446'];
  }
  if (brand === 'pro') {
    const taglie = ['ZA100', 'ZA150', 'ZA200', 'ZA350'];
    if (config === 'uno') return taglie.map((t) => (wifi ? `${t}WIFI` : t));
    if (config === 'stesso' || config === 'due') return taglie.map((t) => `${t}DUAL`);
  }
  if (brand === 'gardheaven') {
    if (config === 'uno' || config === 'stesso') return [wifi ? 'Hobby02' : 'Hobby04', 'Comfort01'];
    if (config === 'due') return [wifi ? 'Hobby01' : 'Hobby03', 'Comfort02'];
    if (config === 'raffresc') return ['Comfort01'];
  }
  return [];
}

/* ─────────────── util ─────────────── */

const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export const arrotonda = (n, d = 2) => {
  const f = 10 ** d;
  return Math.round(Number(((n || 0) * f).toPrecision(12))) / f;
};

const a10 = (n) => Math.round(n / 10) * 10;

const unit = (art) => (art ? art.priceRaw / (art.div || 1) : 0);

function trova(cat, brand, codice) {
  const s = cat.sys?.[cat.brands?.[brand]?.sys];
  if (!s) return null;
  const tutti = [
    ...(s.tubo || []),
    ...(s.ugello || []),
    ...(s.porta || []),
    ...(s.tsel || []),
  ];
  return tutti.find((a) => a.code === codice) || null;
}

/** Portata di un ugello in l/min: dichiarata se c'e', altrimenti stimata. */
export function portata(cat, articolo, bar) {
  if (!articolo) return 0;
  if (articolo.portataLmin > 0) return articolo.portataLmin;
  const t = cat.parametri?.taraturaPortata || { foroMm: 0.3, bar: 12, lMin: 0.04 };
  const d = num(articolo.foroMm);
  const p = num(bar);
  if (!d || !p) return 0;
  const k = t.lMin / (t.foroMm ** 2 * Math.sqrt(t.bar));
  return k * d * d * Math.sqrt(p);
}

/* ─────────────── calcolo ─────────────── */

/**
 * @param {Object} cat  catalogo pubblicato (campo `dati`)
 * @param {Object} inp
 * @param {string} inp.brand        geyser | pro | gardheaven
 * @param {string} inp.modo         perimetro | area
 * @param {number} inp.valore       metri o mq
 * @param {string} inp.config       uno | stesso | due | raffresc
 * @param {string} inp.prodotto     insetticida | repellente (solo con 'uno')
 * @param {boolean} inp.wifi
 * @param {boolean} inp.installazione
 */
export function calcola(cat, inp) {
  const avvisi = [];
  const brand = inp.brand;
  const config = inp.config;
  const raffresc = config === 'raffresc';

  if (raffresc && brand !== 'gardheaven') {
    return { ok: false, errore: 'Il raffrescamento è solo Gardheaven.' };
  }

  const valore = num(inp.valore);
  const perimetro = inp.modo === 'area' ? 4 * Math.sqrt(valore) : valore;
  if (!(perimetro > 0)) return { ok: false, errore: null };

  const par = cat.parametri || {};
  const passo = raffresc ? REGOLE.passoRaffrescamento : par.passoPredefinito || 4;
  const circuiti = config === 'due' ? 2 : 1;
  const ugelliCircuito = Math.ceil(perimetro / passo);
  const ugelliTot = ugelliCircuito * circuiti;

  /* centralina */
  const wifi = BRAND.find((b) => b.id === brand)?.wifi === 'sempre' ? true : Boolean(inp.wifi);
  const macchine = cat.machines?.[brand] || [];
  const codici = candidate(brand, config, wifi);
  const mac = codici
    .map((c) => macchine.find((m) => m.code === c))
    .filter(Boolean)
    .find((m) => m.perLine >= ugelliCircuito);

  if (!mac) {
    const max = Math.max(0, ...codici.map((c) => macchine.find((m) => m.code === c)?.perLine || 0));
    return {
      ok: false,
      errore: `Servono ${ugelliCircuito} ugelli per circuito: oltre la centralina più grande (${max}). Serve un progetto completo.`,
    };
  }
  if (raffresc && ugelliCircuito < REGOLE.minimoUgelliComfort) {
    avvisi.push(
      `${ugelliCircuito} ugelli: sotto il minimo della Comfort (${REGOLE.minimoUgelliComfort}).`
    );
  }
  if (brand === 'gardheaven' && mac.code.startsWith('Comfort') && !raffresc && !inp.wifi) {
    avvisi.push('Oltre 32 ugelli serve la Comfort, che si gestisce da app.');
  }

  /* materiale */
  const art = ARTICOLI[raffresc ? 'raffresc' : brand];
  const tubo = trova(cat, brand, art.tubo);
  const ugello = trova(cat, brand, art.ugello);
  const porta = trova(cat, brand, art.porta);
  const tee = trova(cat, brand, art.t);
  if (!tubo || !ugello || !porta || !tee) {
    return { ok: false, errore: 'Catalogo incompleto: manca un articolo d\'impianto.' };
  }

  const metriTubo = (perimetro + REGOLE.tuboCollegamento) * circuiti;
  const voci = [];
  const add = (desc, q, um, prezzoUnit) => {
    if (q > 0) voci.push({ desc, q, um, unit: prezzoUnit, tot: q * prezzoUnit });
  };

  add(`Centralina ${mac.label}`, 1, 'pz', mac.priceRaw);
  if (brand === 'pro' && config === 'due') {
    add('Sovrapprezzo 2ª uscita distinta (DUAL)', 1, 'pz', REGOLE.sovrapprezzoDual2Uscite);
  }
  add(`Ugelli ${ugello.label}`, ugelliTot, 'pz', unit(ugello));
  add(`Portaugelli ${porta.label}`, ugelliTot, 'pz', unit(porta));
  add(`Raccordi ${tee.label}`, ugelliTot, 'pz', unit(tee));
  add(`Tubo ${tubo.label.replace(/\s*\d+\s*m$/i, '')}`, Math.ceil(metriTubo), 'm', unit(tubo));

  const materiale = voci.reduce((a, v) => a + v.tot, 0);
  const installazione = inp.installazione
    ? REGOLE.installazione.fisso + REGOLE.installazione.perUgello * ugelliTot
    : 0;
  const impianto = materiale + installazione;

  /* prodotti per la prima stagione */
  const tipi = raffresc ? [] : config === 'uno' ? [inp.prodotto || 'insetticida'] : ['insetticida', 'repellente'];
  const bar = par.pressioneBar?.[brand] || 0;
  const lMin = portata(cat, ugello, bar);
  const giorni = REGOLE.mesiStagione * (par.giorniPerMese || 30);
  const prodotti = tipi
    .map((tipo) => stimaProdotto(cat, brand, tipo, ugelliCircuito, lMin, giorni))
    .filter(Boolean);
  const costoProdotti = prodotti.reduce((a, p) => a + p.costo, 0);

  const iva = (par.aliquotaIva ?? 22) / 100;
  const f = REGOLE.forbice;

  return {
    ok: true,
    avvisi,
    brand,
    brandLabel: BRAND.find((b) => b.id === brand)?.label || brand,
    config,
    configLabel: CONFIGURAZIONI.find((c) => c.id === config)?.label || config,
    wifi,
    perimetro,
    perimetroStimato: inp.modo === 'area',
    passo,
    circuiti,
    ugelliCircuito,
    ugelliTot,
    centralina: { code: mac.code, label: mac.label },
    voci,
    materiale,
    installazione,
    impianto,
    impiantoMin: a10(impianto * (1 - f)),
    impiantoMax: a10(impianto * (1 + f)),
    prodotti,
    costoProdotti,
    totale: impianto + costoProdotti,
    iva,
  };
}

/**
 * Consumo della prima stagione per un tipo di prodotto, con il formato
 * (o il numero di confezioni) che costa meno a coprirla.
 */
export function stimaProdotto(cat, brand, tipo, ugelli, lMin, giorni) {
  const ciclo = cat.parametri?.cicloPredefinito?.[tipo];
  const formati = (cat.consumabili?.[brand] || []).filter((p) => p.tipo === tipo && p.litri > 0);
  if (!ciclo || formati.length === 0) return null;

  const concentrato = (ugelli * lMin * ciclo.minutiGiorno * ciclo.percentuale * giorni) / 100;

  let migliore = null;
  formati.forEach((p) => {
    const conf = Math.max(1, Math.ceil(Number((concentrato / p.litri).toPrecision(12))));
    const costo = conf * p.priceRaw;
    if (!migliore || costo < migliore.costo) migliore = { p, conf, costo };
  });

  return {
    tipo,
    label: migliore.p.label,
    code: migliore.p.code,
    confezioni: migliore.conf,
    litriStagione: concentrato,
    costo: migliore.costo,
    minutiGiorno: ciclo.minutiGiorno,
    percentuale: ciclo.percentuale,
  };
}

/* ─────────────── testo per il cliente ─────────────── */

/* Migliaia col punto anche a 4 cifre (2.320 €): Intl it-IT non lo fa. */
export const eur = (n, decimali = 0) => {
  const [i, d] = Math.abs(n || 0).toFixed(decimali).split('.');
  const intero = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '-' : '') + intero + (d ? ',' + d : '') + ' €';
};

export function testoCliente(r) {
  if (!r?.ok) return '';
  const righe = [
    'Preventivo indicativo impianto antizanzare – OMPRA',
    '',
    `Sistema: ${r.brandLabel} – ${r.centralina.label}`,
    `${r.config === 'raffresc' ? 'Raffrescamento' : 'Configurazione: ' + r.configLabel}`,
    `Perimetro ${r.perimetroStimato ? 'stimato ' : ''}${Math.round(r.perimetro)} m – ${r.ugelliTot} ugelli`,
    `Installazione e collaudo: ${r.installazione > 0 ? 'compresi' : 'esclusi'}`,
    '',
    `Impianto: da ${eur(r.impiantoMin)} a ${eur(r.impiantoMax)} + IVA`,
  ];
  if (r.prodotti.length) {
    righe.push(
      `Prodotti prima stagione: circa ${eur(r.costoProdotti)} + IVA (${r.prodotti
        .map((p) => p.label)
        .join(', ')})`
    );
  }
  righe.push('', 'Stima indicativa, da confermare dopo sopralluogo.');
  return righe.join('\n');
}
