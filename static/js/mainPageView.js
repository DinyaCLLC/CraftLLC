const params = new URLSearchParams(window.location.search);
if (params.get('mainPageView') === 'true') {
    const header = document.querySelector('header');
    const footer = document.getElementById('footerID');
    const body = document.querySelector('body');
    const loader = document.getElementById('loader-wrapper');
    if (header) header.style.display = 'none';
    if (footer) footer.style.display = 'none';
    if (body) body.style.background = 'transparent';
    if (loader) loader.style.display = 'none';
}
