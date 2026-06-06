import { getMealEntryNutrition } from '../servicos/servicoRefeicaoIA';

const DEFAULT_PLAN_WINDOW_MINUTES = 150;
const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeKey(value) {
  return normalizeText(value).replace(/\s+/g, '-');
}

function toMinutes(value) {
  const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function buildLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateString, amount) {
  const [year, month, day] = String(dateString).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  return buildLocalDateString(date);
}

function getEntryId(entry) {
  return String(entry?.databaseId || entry?.id || '').trim();
}

function normalizeSection(section, index) {
  const title = String(section?.title || section?.nome || section?.label || `Refeição ${index + 1}`).trim();
  const id = String(section?.id || section?.planSectionId || normalizeKey(title) || `meal-${index}`).trim();
  const time = String(section?.time || section?.hora || section?.horario || '').slice(0, 5);

  return {
    ...section,
    id,
    planSectionId: id,
    title,
    time,
    normalizedId: normalizeKey(id),
    normalizedTitle: normalizeText(title),
    timeMinutes: toMinutes(time),
  };
}

export function resolvePlanSections({ mealPlan, appState } = {}) {
  const activeSections =
    mealPlan?.metas?.planSections ||
    mealPlan?.metas?.refeicoes ||
    appState?.activeMealPlan?.metas?.planSections ||
    appState?.activeMealPlan?.metas?.refeicoes ||
    appState?.planSections;

  return (Array.isArray(activeSections) ? activeSections : [])
    .filter(Boolean)
    .map(normalizeSection);
}

const PLAN_SECTION_LEGACY_IDS = {
  breakfast: 'cafe-manha',
  lunch: 'almoco',
  dinner: 'jantar',
  snack: 'lanche-tarde',
  lanche: 'lanche-tarde',
};

const MEAL_LABEL_SECTION_IDS = {
  'cafe da manha': 'cafe-manha',
  'lanche da manha': 'lanche-manha',
  almoco: 'almoco',
  'lanche da tarde': 'lanche-tarde',
  jantar: 'jantar',
  ceia: 'ceia',
};

function resolveSavedSectionKey(section) {
  const normalizedId = section?.normalizedId || normalizeKey(section?.id);
  return PLAN_SECTION_LEGACY_IDS[normalizedId] || normalizedId;
}

function findSavedSectionForTemplate(templateSection, savedSections = []) {
  const templateKey = templateSection.normalizedId || normalizeKey(templateSection.id);
  const templateTitle = templateSection.normalizedTitle;

  return savedSections.find((saved) => {
    const savedKey = resolveSavedSectionKey(saved);
    if (savedKey && templateKey && savedKey === templateKey) return true;
    if (!templateTitle || !saved.normalizedTitle) return false;
    return (
      saved.normalizedTitle === templateTitle ||
      saved.normalizedTitle.includes(templateTitle) ||
      templateTitle.includes(saved.normalizedTitle)
    );
  });
}

/** Garante todos os momentos do dia no painel de estrutura, preservando dados salvos quando existirem. */
export function mergePlanStructureSections(savedSections = [], templateSections = []) {
  const normalizedSaved = (Array.isArray(savedSections) ? savedSections : [])
    .filter(Boolean)
    .map(normalizeSection);
  const normalizedTemplate = (Array.isArray(templateSections) ? templateSections : [])
    .filter(Boolean)
    .map(normalizeSection);

  if (!normalizedTemplate.length) return normalizedSaved;

  return normalizedTemplate.map((template) => {
    const saved = findSavedSectionForTemplate(template, normalizedSaved);
    if (!saved) return { ...template, planSectionId: template.id };

    return {
      ...template,
      ...saved,
      id: template.id,
      planSectionId: template.id,
      title: saved.title || template.title,
      time: saved.time && saved.time !== '--:--' ? saved.time : template.time,
      objective: saved.objective || template.objective,
      targetKcal: saved.targetKcal ?? saved.kcal ?? template.targetKcal,
      foods:
        Array.isArray(saved.foods) && saved.foods.length
          ? saved.foods
          : template.foods,
      substitutions:
        Array.isArray(saved.substitutions) && saved.substitutions.length
          ? saved.substitutions
          : template.substitutions,
    };
  });
}

function getEntryMealText(entry) {
  return normalizeText(
    [
      entry?.planSectionId,
      entry?.mealId,
      entry?.mealType,
      entry?.meal,
      entry?.mealLabel,
      entry?.mealTypeLabel,
      entry?.title,
    ]
      .filter(Boolean)
      .join(' ')
  );
}

export function matchMealEntryToPlanSection(entry, sections, options = {}) {
  const normalizedSections = (Array.isArray(sections) ? sections : []).map(normalizeSection);
  if (!entry || !normalizedSections.length) return null;

  const explicitId = normalizeKey(entry?.planSectionId || entry?.mealId);
  if (explicitId) {
    const explicitMatch = normalizedSections.find(
      (section) => section.normalizedId === explicitId || normalizeKey(section.id) === explicitId
    );
    if (explicitMatch) return { section: explicitMatch, sectionId: explicitMatch.id, reason: 'id' };
  }

  const entryText = getEntryMealText(entry);
  if (entryText) {
    const aliasSectionId = MEAL_LABEL_SECTION_IDS[entryText];
    if (aliasSectionId) {
      const aliasMatch = normalizedSections.find(
        (section) => section.normalizedId === aliasSectionId || normalizeKey(section.id) === aliasSectionId
      );
      if (aliasMatch) {
        return { section: aliasMatch, sectionId: aliasMatch.id, reason: 'alias' };
      }
    }

    const labelMatch = normalizedSections.find((section) => {
      if (!section.normalizedTitle) return false;
      return entryText.includes(section.normalizedTitle) || section.normalizedTitle.includes(entryText);
    });
    if (labelMatch) return { section: labelMatch, sectionId: labelMatch.id, reason: 'label' };

    const fuzzyAlias = Object.entries(MEAL_LABEL_SECTION_IDS).find(
      ([label]) => entryText.includes(label) || label.includes(entryText)
    );
    if (fuzzyAlias) {
      const [, sectionId] = fuzzyAlias;
      const fuzzyMatch = normalizedSections.find(
        (section) => section.normalizedId === sectionId || normalizeKey(section.id) === sectionId
      );
      if (fuzzyMatch) {
        return { section: fuzzyMatch, sectionId: fuzzyMatch.id, reason: 'alias-fuzzy' };
      }
    }
  }

  const entryMinutes = toMinutes(entry?.time);
  if (entryMinutes === null) return null;

  const maxDistance = options.windowMinutes ?? DEFAULT_PLAN_WINDOW_MINUTES;
  const timedMatches = normalizedSections
    .filter((section) => section.timeMinutes !== null)
    .map((section) => ({
      section,
      distance: Math.abs(section.timeMinutes - entryMinutes),
    }))
    .sort((left, right) => left.distance - right.distance);

  const closest = timedMatches[0];
  if (!closest || closest.distance > maxDistance) return null;

  return { section: closest.section, sectionId: closest.section.id, reason: 'time' };
}

export function sumMealEntryNutrition(entries = []) {
  return (Array.isArray(entries) ? entries : []).reduce(
    (total, entry) => {
      const nutrition = getMealEntryNutrition(entry);
      return {
        kcal: total.kcal + (nutrition?.calories || 0),
        calories: total.calories + (nutrition?.calories || 0),
        carbs: total.carbs + (nutrition?.carbs || 0),
        protein: total.protein + (nutrition?.protein || 0),
        fat: total.fat + (nutrition?.fat || 0),
        fiber: total.fiber + (nutrition?.fiber || 0),
        sugars: total.sugars + (nutrition?.sugars || 0),
        sodium: total.sodium + (nutrition?.sodium || 0),
      };
    },
    { kcal: 0, calories: 0, carbs: 0, protein: 0, fat: 0, fiber: 0, sugars: 0, sodium: 0 }
  );
}

export function buildPlanDayStatus({ mealEntries, sections, date } = {}) {
  const targetDate = date || buildLocalDateString();
  const normalizedSections = (Array.isArray(sections) ? sections : []).map(normalizeSection);
  const buckets = new Map(
    normalizedSections.map((section) => [
      section.id,
      {
        ...section,
        entries: [],
        completed: false,
        summary: { kcal: 0, calories: 0, carbs: 0, protein: 0, fat: 0, fiber: 0, sugars: 0, sodium: 0 },
      },
    ])
  );
  const unmatchedEntries = [];
  const seenEntries = new Set();

  (Array.isArray(mealEntries) ? mealEntries : []).forEach((entry) => {
    if (!entry) return;
    const entryDate = String(entry.date || '').slice(0, 10);
    if (!entryDate || entryDate !== targetDate) return;

    const entryId = getEntryId(entry);
    if (entryId && seenEntries.has(entryId)) return;
    if (entryId) seenEntries.add(entryId);

    const match = matchMealEntryToPlanSection(entry, normalizedSections);
    if (!match || !buckets.has(match.sectionId)) {
      unmatchedEntries.push(entry);
      return;
    }

    buckets.get(match.sectionId).entries.push(entry);
  });

  const meals = Array.from(buckets.values())
    .map((bucket) => {
      const sortedEntries = [...bucket.entries].sort((left, right) =>
        String(right.time || '').localeCompare(String(left.time || ''))
      );
      const summary = sumMealEntryNutrition(sortedEntries);
      return {
        ...bucket,
        entries: sortedEntries,
        completed: sortedEntries.length > 0,
        summary: {
          ...summary,
          completed: sortedEntries.length > 0,
          kcal: Math.round(summary.kcal),
          carbs: Math.round(summary.carbs),
          protein: Math.round(summary.protein),
          fat: Math.round(summary.fat),
        },
      };
    })
    .sort(
      (left, right) =>
        (left.timeMinutes ?? Number.MAX_SAFE_INTEGER) - (right.timeMinutes ?? Number.MAX_SAFE_INTEGER)
    );
  const completedCount = meals.filter((item) => item.completed).length;
  const totalCount = meals.length;

  return {
    date: targetDate,
    meals,
    unmatchedEntries,
    completedCount,
    totalCount,
    progressPercent: totalCount ? Math.round((completedCount / totalCount) * 100) : 0,
  };
}

export function buildPlanAdherenceSeries({
  mealEntries,
  sections,
  startDate,
  endDate,
  labelForDate,
} = {}) {
  const normalizedSections = (Array.isArray(sections) ? sections : []).map(normalizeSection);
  const safeStart = startDate || buildLocalDateString();
  const safeEnd = endDate || safeStart;
  const items = [];
  let hasRealData = false;
  let current = safeStart;

  while (current <= safeEnd) {
    const day = buildPlanDayStatus({ mealEntries, sections: normalizedSections, date: current });
    if (day.completedCount > 0) hasRealData = true;
    const date = new Date(`${current}T12:00:00`);
    items.push({
      id: `adherence-${current}`,
      isoDate: current,
      label: labelForDate ? labelForDate(current, items.length) : WEEKDAY_LABELS[date.getDay()],
      value: day.progressPercent,
      mealsLogged: day.completedCount,
      targetMeals: day.totalCount,
    });
    current = addDays(current, 1);
  }

  return { items, hasRealData };
}

export function enrichMealEntryWithPlanLink(entry, sections) {
  const match = matchMealEntryToPlanSection(entry, sections);
  if (!match) return entry;
  return {
    ...entry,
    planSectionId: match.sectionId,
    mealId: entry?.mealId || match.sectionId,
    mealLabel: entry?.mealLabel || match.section.title,
    mealTypeLabel: entry?.mealTypeLabel || entry?.mealLabel || match.section.title,
    planMatchReason: match.reason,
  };
}
