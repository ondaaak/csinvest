const slugNormalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
console.log(slugNormalize('charm-baby-karat-ct'));
