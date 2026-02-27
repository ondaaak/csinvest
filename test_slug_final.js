const slugNormalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
console.log('charm-baby-karat-ct -> ' + slugNormalize('charm-baby-karat-ct'));
