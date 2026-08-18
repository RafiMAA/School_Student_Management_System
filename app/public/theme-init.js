(() => {
  const saved = localStorage.getItem('ahadiya-theme-mode') || 'system';
  const dark = saved === 'dark'
    || (saved === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  const pwaDashboard = innerWidth <= 820 && location.pathname === '/';
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('#theme-color-meta')?.setAttribute(
    'content',
    pwaDashboard ? '#009b55' : dark ? '#06101f' : '#f8fafc',
  );
})();
