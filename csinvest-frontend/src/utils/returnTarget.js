const PREFIX = 'return-target:';

export const hasPendingReturnTarget = () => {
  try {
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(PREFIX)) {
        const value = sessionStorage.getItem(key);
        if (value) return true;
      }
    }
  } catch {
    // Ignore storage access errors.
  }
  return false;
};

export const saveReturnTarget = (scope, targetId) => {
  if (!scope || !targetId) return;
  try {
    sessionStorage.setItem(`${PREFIX}${scope}`, String(targetId));
  } catch {
    // Ignore storage write errors.
  }
};

export const restoreReturnTarget = (scope, options = {}) => {
  if (!scope) return () => {};

  const block = options.block || 'center';
  const maxTries = Number.isFinite(options.maxTries) ? options.maxTries : 60;
  const intervalMs = Number.isFinite(options.intervalMs) ? options.intervalMs : 60;

  let tries = 0;
  let timer = null;

  const lookupTarget = () => {
    try {
      return sessionStorage.getItem(`${PREFIX}${scope}`);
    } catch {
      return null;
    }
  };

  const clearTarget = () => {
    try {
      sessionStorage.removeItem(`${PREFIX}${scope}`);
    } catch {
      // Ignore storage remove errors.
    }
  };

  const findElement = (targetId) => {
    const nodes = document.querySelectorAll('[data-return-id]');
    for (const node of nodes) {
      if (node.getAttribute('data-return-id') === targetId) {
        return node;
      }
    }
    return null;
  };

  const run = () => {
    const targetId = lookupTarget();
    if (!targetId) return;

    const el = findElement(targetId);
    if (el) {
      el.scrollIntoView({ block, behavior: 'auto' });
      clearTarget();
      return;
    }

    if (tries >= maxTries) return;

    tries += 1;
    timer = setTimeout(run, intervalMs);
  };

  timer = setTimeout(run, 0);

  return () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
};
