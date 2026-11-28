(() => {
  const byId = id => document.getElementById(id);
  const catalog = byId('skill-catalog');
  const search = byId('skill-search');
  const project = byId('skill-project');
  const status = byId('skill-status');
  const count = byId('skill-count');
  const list = byId('skill-list');
  const more = byId('skill-more');
  const pageSize = 30;
  let data, loading = false, limit = pageSize;

  function render() {
    if (!data) return;
    const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const results = data.skills.filter(skill =>
      (status.value ? skill.status === status.value : skill.status !== 'Planned') &&
      (!project.value || skill.evidence.some(source => source[0] === project.value)) &&
      terms.every(term => skill.name.toLowerCase().includes(term)));
    count.textContent = results.length
      ? `Showing ${Math.min(limit, results.length).toLocaleString()} of ${results.length.toLocaleString()} skills`
      : 'No matching skills. Try a different search or project.';
    const items = results.slice(0, limit).map(skill => {
      const item = document.createElement('li');
      const title = document.createElement('strong');
      title.textContent = skill.name;
      item.append(title);
      const evidence = skill.evidence.filter(source => !project.value || source[0] === project.value);
      for (const [index, [repo, file, line]] of evidence.entries()) {
        if (index) item.append(' · ');
        const link = document.createElement('a');
        const branch = encodeURIComponent(data.projects[repo]);
        link.href = `https://github.com/ChrishA-tech/${encodeURIComponent(repo)}/blob/${branch}/${file}#L${line}`;
        link.textContent = repo;
        item.append(link);
      }
      return item;
    });
    list.replaceChildren(...items);
    more.hidden = results.length <= limit;
  }

  catalog.addEventListener('toggle', async () => {
    if (!catalog.open || data || loading) return;
    loading = true;
    count.textContent = 'Loading project skills…';
    try {
      const response = await fetch('/skills/catalog.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
      const names = new Set(data.skills.flatMap(skill => skill.evidence.map(source => source[0])));
      project.append(...Array.from(names).sort().map(name => new Option(name, name)));
      render();
    } catch {
      count.textContent = 'Could not load project skills. Close and reopen this section to retry.';
    } finally {
      loading = false;
    }
  });

  for (const control of [search, project, status]) {
    control.addEventListener('input', () => { limit = pageSize; render(); });
  }
  more.addEventListener('click', () => {
    const firstNew = limit;
    limit += pageSize;
    render();
    list.children[firstNew]?.querySelector('a')?.focus();
  });
})();
