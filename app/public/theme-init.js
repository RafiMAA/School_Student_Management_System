(() => {
  const saved = localStorage.getItem('ahadiya-theme-mode') || 'system';
  const dark = saved === 'dark'
    || (saved === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('#theme-color-meta')?.setAttribute(
    'content',
    dark ? '#06101f' : '#f8fafc',
  );
})();
