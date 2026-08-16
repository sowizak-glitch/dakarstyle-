// SAMABUSINESS Global Core — shared Region & Language form
//
// Rendered both by the first-launch onboarding flow and by the "Région &
// langue" settings panel, so the two never drift apart. Pure DOM, no
// framework: matches the vanilla-JS convention of the rest of the app.
// Country/language lists are always searchable (mission requirement: never
// show 200 countries in a non-filterable list).

export function renderRegionLanguageForm(container, ctx) {
  const { registry, locale, t, values, localePacks } = ctx;
  const countries = registry.listCountries(locale);
  const languages = localePacks; // [{tag, name, dir}]

  container.innerHTML = `
    <div class="field full">
      <label>${t('settings.country')}</label>
      <input type="text" class="sama-global-search" data-role="country-search" placeholder="${t('settings.searchCountry')}" autocomplete="off">
      <select data-role="country" size="6" class="sama-global-listbox"></select>
    </div>
    <div class="field full">
      <label>${t('settings.language')}</label>
      <select data-role="language" class="sama-global-select"></select>
    </div>
    <div class="field">
      <label>${t('settings.currency')}</label>
      <input type="text" data-role="currency" maxlength="3" class="sama-global-currency" autocomplete="off">
    </div>
    <div class="field">
      <label>${t('settings.timezone')}</label>
      <input type="text" class="sama-global-search" data-role="timezone-search" placeholder="Africa/Dakar" autocomplete="off">
    </div>
    <div class="field">
      <label>${t('settings.phoneRegion')}</label>
      <select data-role="phone-region" class="sama-global-select"></select>
    </div>
    <div class="field">
      <label>${t('settings.measurementSystem')}</label>
      <select data-role="measurement" class="sama-global-select">
        <option value="metric">${t('common.metric')}</option>
        <option value="imperial">${t('common.imperial')}</option>
      </select>
    </div>
    <div class="field full">
      <label>${t('settings.weekStart')}</label>
      <select data-role="week-start" class="sama-global-select">
        <option value="1">${t('common.monday')}</option>
        <option value="0">${t('common.sunday')}</option>
        <option value="6">${t('common.saturday')}</option>
      </select>
    </div>
  `;

  const countrySelect = container.querySelector('[data-role="country"]');
  const countrySearch = container.querySelector('[data-role="country-search"]');
  const languageSelect = container.querySelector('[data-role="language"]');
  const currencyInput = container.querySelector('[data-role="currency"]');
  const timezoneSearch = container.querySelector('[data-role="timezone-search"]');
  const phoneRegionSelect = container.querySelector('[data-role="phone-region"]');
  const measurementSelect = container.querySelector('[data-role="measurement"]');
  const weekStartSelect = container.querySelector('[data-role="week-start"]');

  function fillCountryOptions(filterText) {
    const needle = String(filterText || '').trim().toLowerCase();
    const filtered = needle
      ? countries.filter((c) => String(c.name).toLowerCase().includes(needle) || c.countryCode.toLowerCase() === needle)
      : countries;
    countrySelect.innerHTML = filtered.slice(0, 300).map((c) => `<option value="${c.countryCode}">${c.name} (${c.countryCode})</option>`).join('');
  }
  fillCountryOptions('');
  countrySelect.value = values.countryCode;

  languageSelect.innerHTML = languages.map((l) => `<option value="${l.tag}">${l.name}</option>`).join('');
  languageSelect.value = values.locale;

  phoneRegionSelect.innerHTML = countries.map((c) => `<option value="${c.countryCode}">${c.name} (${c.countryCode})</option>`).join('');
  phoneRegionSelect.value = values.phoneRegion;

  currencyInput.value = values.currency;
  timezoneSearch.value = values.timezone;
  measurementSelect.value = values.measurementSystem;
  weekStartSelect.value = String(values.weekStart);

  countrySearch.addEventListener('input', () => fillCountryOptions(countrySearch.value));
  countrySelect.addEventListener('change', () => {
    const country = registry.getCountry(countrySelect.value);
    if (!country) return;
    if (country.defaultCurrency) currencyInput.value = country.defaultCurrency;
    if (country.defaultLocale) languageSelect.value = country.defaultLocale;
    phoneRegionSelect.value = country.countryCode;
  });

  function readValues() {
    return {
      countryCode: countrySelect.value,
      locale: languageSelect.value,
      currency: currencyInput.value.trim().toUpperCase(),
      timezone: timezoneSearch.value.trim(),
      phoneRegion: phoneRegionSelect.value,
      measurementSystem: measurementSelect.value,
      weekStart: Number(weekStartSelect.value),
    };
  }

  return { readValues };
}
