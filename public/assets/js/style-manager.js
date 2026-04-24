/**
 * StyleManager — PDF style defaults, color palettes, merge/diff utilities
 */
window.StyleManager = (() => {
  const DEFAULTS = {
    h1: { color: '#1565C0', size: '22px' },
    h2: { color: '#1976D2', size: '18px' },
    h3: { color: '#1976D2', size: '16px' },
    h4: { color: '#1976D2', size: '14px' },
    h5: { color: '#1976D2', size: '12px' },
    body: { color: '#1a1a1a', size: '12px' },
    fontFamily: 'Roboto',
  };

  // Color palettes — h1 uses 800 shade, h2-h5 use 700 shade
  const COLOR_PALETTES = [
    { label: 'Blue',    swatch: '#1565C0', h1: '#1565C0', h2: '#1976D2', h3: '#1976D2', h4: '#1976D2', h5: '#1976D2' },
    { label: 'Indigo',  swatch: '#283593', h1: '#283593', h2: '#303F9F', h3: '#303F9F', h4: '#303F9F', h5: '#303F9F' },
    { label: 'Purple',  swatch: '#6A1B9A', h1: '#6A1B9A', h2: '#7B1FA2', h3: '#7B1FA2', h4: '#7B1FA2', h5: '#7B1FA2' },
    { label: 'Teal',    swatch: '#00695C', h1: '#00695C', h2: '#00796B', h3: '#00796B', h4: '#00796B', h5: '#00796B' },
    { label: 'Green',   swatch: '#2E7D32', h1: '#2E7D32', h2: '#388E3C', h3: '#388E3C', h4: '#388E3C', h5: '#388E3C' },
    { label: 'Red',     swatch: '#C62828', h1: '#C62828', h2: '#D32F2F', h3: '#D32F2F', h4: '#D32F2F', h5: '#D32F2F' },
    { label: 'Slate',   swatch: '#37474F', h1: '#37474F', h2: '#455A64', h3: '#455A64', h4: '#455A64', h5: '#455A64' },
  ];

  const HEADING_KEYS = ['h1', 'h2', 'h3', 'h4', 'h5'];

  function mergeStyles(overrides) {
    if (!overrides || typeof overrides !== 'object') return { ...deepCopy(DEFAULTS) };

    const merged = deepCopy(DEFAULTS);

    for (const key of HEADING_KEYS) {
      if (overrides[key]) {
        if (overrides[key].color) merged[key].color = overrides[key].color;
        if (overrides[key].size) merged[key].size = overrides[key].size;
      }
    }

    if (overrides.body) {
      if (overrides.body.color) merged.body.color = overrides.body.color;
      if (overrides.body.size) merged.body.size = overrides.body.size;
    }

    if (overrides.fontFamily) merged.fontFamily = overrides.fontFamily;

    return merged;
  }

  function diffFromDefaults(styles) {
    if (!styles || typeof styles !== 'object') return {};

    const diff = {};

    for (const key of HEADING_KEYS) {
      if (styles[key]) {
        const d = {};
        if (styles[key].color && styles[key].color !== DEFAULTS[key].color) d.color = styles[key].color;
        if (styles[key].size && styles[key].size !== DEFAULTS[key].size) d.size = styles[key].size;
        if (Object.keys(d).length > 0) diff[key] = d;
      }
    }

    if (styles.body) {
      const d = {};
      if (styles.body.color && styles.body.color !== DEFAULTS.body.color) d.color = styles.body.color;
      if (styles.body.size && styles.body.size !== DEFAULTS.body.size) d.size = styles.body.size;
      if (Object.keys(d).length > 0) diff.body = d;
    }

    if (styles.fontFamily && styles.fontFamily !== DEFAULTS.fontFamily) {
      diff.fontFamily = styles.fontFamily;
    }

    return diff;
  }

  function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  return {
    DEFAULTS,
    COLOR_PALETTES,
    HEADING_KEYS,
    mergeStyles,
    diffFromDefaults,
    deepCopy,
  };
})();
