/* Shared site navigation. Add a page once here and it appears on every
   page automatically -- no more editing six files to add a link. */
(function () {
  const NAV_ITEMS = [
    ["index.html", "Home"],
    ["search.html", "Search"],
    ["this-season.html", "This Season"],
    ["goats.html", "GOATs"],
    ["compare.html", "Compare"],
    ["peak-finder.html", "Peak Finder"],
    ["cy-young.html", "Cy Young"],
    ["eras.html", "Eras"],
    ["about.html", "About"],
  ];

  function currentPage() {
    const path = window.location.pathname.split("/").pop();
    return path === "" ? "index.html" : path;
  }

  function renderNav() {
    const mount = document.getElementById("site-nav");
    if (!mount) return;
    const current = currentPage();
    mount.innerHTML = NAV_ITEMS.map(
      ([href, label]) =>
        `<a href="${href}"${href === current ? ' class="active"' : ""}>${label}</a>`
    ).join("");
  }

  renderNav();
})();
