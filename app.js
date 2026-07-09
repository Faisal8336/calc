const STORAGE_KEY = "calorie-tracker-v1";
const THEME_KEY = "calorie-tracker-theme";

const defaultState = {
  settings: {
    targetCalories: 2200,
    targetProtein: 160,
    targetCarbs: 230,
    targetFat: 70,
    targetWeight: 75,
    heightCm: 175,
    age: 25,
    sex: "male",
    activityLevel: 1.375
  },
  meals: [],
  foods: [],
  weights: [],
  measurements: []
};

const state = loadState();
const charts = {};
const today = toDateKey(new Date());

const els = {
  todayLabel: document.querySelector("#todayLabel"),
  viewTitle: document.querySelector("#viewTitle"),
  toast: document.querySelector("#toast"),
  navItems: document.querySelectorAll(".nav-item"),
  views: document.querySelectorAll(".view"),
  mealForm: document.querySelector("#mealForm"),
  foodForm: document.querySelector("#foodForm"),
  weightForm: document.querySelector("#weightForm"),
  measurementForm: document.querySelector("#measurementForm"),
  settingsForm: document.querySelector("#settingsForm"),
  themeToggle: document.querySelector("#themeToggle")
};

const viewNames = {
  dashboard: "لوحة التحكم",
  daily: "تسجيل اليوم",
  foods: "مكتبة الأطعمة",
  weight: "الوزن والقياسات",
  reports: "التقارير",
  settings: "الأهداف"
};

init();

function init() {
  applyTheme(localStorage.getItem(THEME_KEY) || "light");
  document.querySelector("#mealDate").value = today;
  document.querySelector("#weightDate").value = today;
  document.querySelector("#measurementDate").value = today;
  els.todayLabel.textContent = formatDateLong(today);
  fillSettingsForm();
  bindEvents();
  window.addEventListener("charts-ready", renderCharts);
  render();
}

function bindEvents() {
  els.navItems.forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  els.themeToggle.addEventListener("click", () => {
    const nextTheme = document.body.classList.contains("dark") ? "light" : "dark";
    applyTheme(nextTheme);
    localStorage.setItem(THEME_KEY, nextTheme);
  });

  els.mealForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const meal = {
      id: createId(),
      date: document.querySelector("#mealDate").value,
      name: document.querySelector("#mealName").value.trim(),
      calories: readNumber("#mealCalories"),
      protein: readNumber("#mealProtein"),
      carbs: readNumber("#mealCarbs"),
      fat: readNumber("#mealFat")
    };
    state.meals.push(meal);
    if (document.querySelector("#saveFood").checked) {
      state.foods.push({ ...meal, id: createId() });
    }
    saveAndRender("تمت إضافة الوجبة");
    els.mealForm.reset();
    document.querySelector("#mealDate").value = today;
  });

  els.foodForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.foods.push({
      id: createId(),
      name: document.querySelector("#foodName").value.trim(),
      calories: readNumber("#foodCalories"),
      protein: readNumber("#foodProtein"),
      carbs: readNumber("#foodCarbs"),
      fat: readNumber("#foodFat")
    });
    saveAndRender("تم حفظ الطعام");
    els.foodForm.reset();
  });

  els.weightForm.addEventListener("submit", (event) => {
    event.preventDefault();
    upsertByDate(state.weights, {
      id: createId(),
      date: document.querySelector("#weightDate").value,
      value: readNumber("#weightValue")
    });
    saveAndRender("تم حفظ الوزن");
    els.weightForm.reset();
    document.querySelector("#weightDate").value = today;
  });

  els.measurementForm.addEventListener("submit", (event) => {
    event.preventDefault();
    upsertByDate(state.measurements, {
      id: createId(),
      date: document.querySelector("#measurementDate").value,
      waist: readNumber("#waist"),
      chest: readNumber("#chest"),
      arm: readNumber("#arm"),
      thigh: readNumber("#thigh")
    });
    saveAndRender("تم حفظ القياسات");
    els.measurementForm.reset();
    document.querySelector("#measurementDate").value = today;
  });

  els.settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.settings = {
      targetCalories: readNumber("#targetCalories"),
      targetProtein: readNumber("#targetProtein"),
      targetCarbs: readNumber("#targetCarbs"),
      targetFat: readNumber("#targetFat"),
      targetWeight: readNumber("#targetWeight"),
      heightCm: readNumber("#heightCm"),
      age: readNumber("#age"),
      sex: document.querySelector("#sex").value,
      activityLevel: readNumber("#activityLevel")
    };
    saveAndRender("تم تحديث الأهداف");
  });

  document.querySelector("#clearData").addEventListener("click", () => {
    if (!confirm("هل تريد حذف كل البيانات المحفوظة على هذا الجهاز؟")) return;
    localStorage.removeItem(STORAGE_KEY);
    Object.assign(state, structuredClone(defaultState));
    fillSettingsForm();
    saveAndRender("تم حذف البيانات");
  });
}

function switchView(viewId) {
  els.navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === viewId));
  els.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
  els.viewTitle.textContent = viewNames[viewId];
  requestAnimationFrame(renderCharts);
}

function render() {
  renderDashboard();
  renderFoods();
  renderWeightHistory();
  renderReports();
  renderCharts();
}

function renderDashboard() {
  const todayTotals = totalsForDate(today);
  const remaining = state.settings.targetCalories - todayTotals.calories;
  const proteinPercent = percent(todayTotals.protein, state.settings.targetProtein);

  setText("#todayCalories", Math.round(todayTotals.calories));
  setText("#todayCaloriesHint", `من ${state.settings.targetCalories} سعرة`);
  setText("#remainingCalories", Math.round(remaining));
  setText("#proteinProgress", `${proteinPercent}%`);
  setText("#proteinHint", `${todayTotals.protein.toFixed(1)} من ${state.settings.targetProtein} جم`);
  setText("#streakCount", calculateStreak());

  renderMacroBars(todayTotals);
  renderTodayMeals();

  const weekTotals = lastNDays(7).reduce((sum, date) => sum + totalsForDate(date).calories, 0);
  const weeklyGoal = state.settings.targetCalories * 7;
  setText("#weeklyHint", `استهلكت ${Math.round(weekTotals)} من ${weeklyGoal} سعرة هذا الأسبوع`);
  setText("#weightForecast", forecastText());
}

function renderMacroBars(totals) {
  const macros = [
    ["البروتين", totals.protein, state.settings.targetProtein, "var(--green)"],
    ["الكارب", totals.carbs, state.settings.targetCarbs, "var(--blue)"],
    ["الدهون", totals.fat, state.settings.targetFat, "var(--gold)"]
  ];
  document.querySelector("#macroBars").innerHTML = macros.map(([label, value, target, color]) => `
    <div class="macro-row">
      <header><span>${label}</span><strong>${value.toFixed(1)} / ${target} جم</strong></header>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.min(percent(value, target), 130)}%;background:${color}"></div></div>
    </div>
  `).join("");
}

function renderTodayMeals() {
  const meals = state.meals.filter((meal) => meal.date === today);
  setText("#mealCount", meals.length ? `${meals.length} وجبة` : "لا توجد وجبات بعد");
  document.querySelector("#todayMeals").innerHTML = meals.length ? meals.map(mealTemplate).join("") : emptyState("ابدأ بإضافة وجبة من صفحة تسجيل اليوم");
  document.querySelectorAll("[data-delete-meal]").forEach((button) => {
    button.addEventListener("click", () => removeItem("meals", button.dataset.deleteMeal));
  });
}

function renderFoods() {
  setText("#foodsCount", `${state.foods.length} عنصر`);
  document.querySelector("#foodsList").innerHTML = state.foods.length ? state.foods.map(foodTemplate).join("") : emptyState("احفظ الأطعمة المتكررة لتظهر هنا");
  document.querySelector("#quickFoods").innerHTML = state.foods.length ? state.foods.map(quickFoodTemplate).join("") : emptyState("لا توجد أطعمة محفوظة بعد");

  document.querySelectorAll("[data-add-food]").forEach((button) => {
    button.addEventListener("click", () => addFoodToToday(button.dataset.addFood));
  });
  document.querySelectorAll("[data-delete-food]").forEach((button) => {
    button.addEventListener("click", () => removeItem("foods", button.dataset.deleteFood));
  });
}

function renderReports() {
  const dates = lastNDays(7);
  const totals = dates.map(totalsForDate);
  const loggedDays = totals.filter((day) => day.calories > 0);
  const avgCalories = loggedDays.length ? average(loggedDays.map((day) => day.calories)) : 0;
  const avgProtein = loggedDays.length ? average(loggedDays.map((day) => day.protein)) : 0;
  const highest = totals.map((total, index) => ({ ...total, date: dates[index] })).sort((a, b) => b.calories - a.calories)[0];
  const adherenceDays = totals.filter((day) => day.calories > 0 && day.calories <= state.settings.targetCalories).length;

  setText("#avgWeeklyCalories", Math.round(avgCalories));
  setText("#avgProtein", Math.round(avgProtein));
  setText("#highestDay", highest && highest.calories ? formatShortDate(highest.date) : "-");
  setText("#highestDayHint", highest && highest.calories ? `${Math.round(highest.calories)} سعرة` : "لا توجد بيانات");
  setText("#adherenceRate", `${Math.round((adherenceDays / 7) * 100)}%`);
}

function renderWeightHistory() {
  const weights = [...state.weights].sort((a, b) => b.date.localeCompare(a.date));
  setText("#weightCount", weights.length ? `${weights.length} سجل` : "لا توجد أوزان بعد");
  document.querySelector("#weightHistory").innerHTML = weights.length ? weights.map(weightTemplate).join("") : emptyState("سجل وزنك وسيظهر هنا مع التاريخ");
  document.querySelectorAll("[data-delete-weight]").forEach((button) => {
    button.addEventListener("click", () => removeItem("weights", button.dataset.deleteWeight));
  });
}

function renderCharts() {
  renderWeeklyCaloriesChart();
  renderWeightChart();
  renderMeasurementsChart();
  renderReportChart();
}

function renderWeeklyCaloriesChart() {
  const dates = lastNDays(7);
  const colors = chartColors();
  createChart("weeklyCaloriesChart", {
    type: "bar",
    data: {
      labels: dates.map(formatWeekday),
      datasets: [{
        label: "السعرات",
        data: dates.map((date) => totalsForDate(date).calories),
        backgroundColor: colors.green,
        borderRadius: 8
      }]
    },
    options: baseChartOptions()
  });
}

function renderWeightChart() {
  const weights = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  const colors = chartColors();
  createChart("weightChart", {
    type: "line",
    data: {
      labels: weights.map((entry) => formatShortDate(entry.date)),
      datasets: [{
        label: "الوزن",
        data: weights.map((entry) => entry.value),
        borderColor: colors.blue,
        backgroundColor: colors.blueFill,
        fill: true,
        tension: 0.35
      }]
    },
    options: baseChartOptions()
  });
}

function renderMeasurementsChart() {
  const items = [...state.measurements].sort((a, b) => a.date.localeCompare(b.date));
  const colors = chartColors();
  createChart("measurementsChart", {
    type: "line",
    data: {
      labels: items.map((entry) => formatShortDate(entry.date)),
      datasets: [
        { label: "الخصر", data: items.map((entry) => entry.waist || null), borderColor: colors.green },
        { label: "الصدر", data: items.map((entry) => entry.chest || null), borderColor: colors.blue },
        { label: "الذراع", data: items.map((entry) => entry.arm || null), borderColor: colors.gold },
        { label: "الفخذ", data: items.map((entry) => entry.thigh || null), borderColor: colors.red }
      ]
    },
    options: baseChartOptions()
  });
}

function renderReportChart() {
  const dates = lastNDays(14);
  const colors = chartColors();
  createChart("reportChart", {
    type: "line",
    data: {
      labels: dates.map(formatShortDate),
      datasets: [
        { label: "السعرات", data: dates.map((date) => totalsForDate(date).calories), borderColor: colors.green, yAxisID: "y" },
        { label: "البروتين", data: dates.map((date) => totalsForDate(date).protein), borderColor: colors.blue, yAxisID: "y1" }
      ]
    },
    options: {
      ...baseChartOptions(),
      scales: {
        y: chartScale(),
        y1: { ...chartScale(), position: "right", grid: { drawOnChartArea: false } }
      }
    }
  });
}

function createChart(id, config) {
  const canvas = document.querySelector(`#${id}`);
  if (!canvas) return;
  if (!canvas.closest(".view.active")) return;
  const fallback = canvas.nextElementSibling;
  if (fallback?.classList.contains("chart-fallback")) fallback.remove();
  canvas.hidden = false;
  if (typeof Chart === "undefined") {
    canvas.hidden = true;
    canvas.insertAdjacentHTML("afterend", `<div class="chart-fallback">تعذر تحميل مكتبة الرسوم البيانية. ستظهر الرسوم عند توفر الاتصال بالإنترنت.</div>`);
    return;
  }
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(canvas, config);
}

function baseChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: chartColors().muted, font: { family: "Segoe UI" } } }
    },
    scales: {
      y: chartScale(),
      x: { grid: { display: false }, ticks: { color: chartColors().muted } }
    }
  };
}

function chartScale() {
  const colors = chartColors();
  return {
    beginAtZero: true,
    grid: { color: colors.grid },
    ticks: { color: colors.muted }
  };
}

function chartColors() {
  const dark = document.body.classList.contains("dark");
  return dark ? {
    green: "#78d6a0",
    blue: "#8fbee8",
    gold: "#e7bd75",
    red: "#f19a9a",
    blueFill: "rgba(143, 190, 232, 0.14)",
    grid: "rgba(214, 230, 220, 0.1)",
    muted: "#b5c4ba"
  } : {
    green: "#2f7d5b",
    blue: "#376f9e",
    gold: "#ba7a27",
    red: "#b94747",
    blueFill: "rgba(55,111,158,0.12)",
    grid: "#eef1ec",
    muted: "#68736d"
  };
}

function addFoodToToday(id) {
  const food = state.foods.find((item) => item.id === id);
  if (!food) return;
  state.meals.push({
    ...food,
    id: createId(),
    date: document.querySelector("#mealDate").value || today
  });
  saveAndRender("تمت إضافة الطعام لليوم");
}

function removeItem(collection, id) {
  const index = state[collection].findIndex((item) => item.id === id);
  if (index >= 0) state[collection].splice(index, 1);
  saveAndRender("تم الحذف");
}

function upsertByDate(collection, entry) {
  const index = collection.findIndex((item) => item.date === entry.date);
  if (index >= 0) {
    collection[index] = { ...collection[index], ...entry };
  } else {
    collection.push(entry);
  }
}

function totalsForDate(date) {
  return state.meals
    .filter((meal) => meal.date === date)
    .reduce((totals, meal) => ({
      calories: totals.calories + meal.calories,
      protein: totals.protein + meal.protein,
      carbs: totals.carbs + meal.carbs,
      fat: totals.fat + meal.fat
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function calculateStreak() {
  let streak = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const date = addDays(today, -offset);
    if (totalsForDate(date).calories <= 0) break;
    streak += 1;
  }
  return streak;
}

function forecastText() {
  const sorted = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return "أضف وزنك الحالي لعرض الوقت المتوقع";

  const last = sorted[sorted.length - 1];
  const remaining = state.settings.targetWeight - last.value;
  const direction = remaining > 0 ? "زيادة" : "نزول";
  const absoluteRemaining = Math.abs(remaining);

  if (absoluteRemaining < 0.05) {
    return `أنت عند هدفك الحالي ${state.settings.targetWeight} كجم`;
  }

  const maintenanceCalories = estimateMaintenanceCalories(last.value);
  const dailyBalance = state.settings.targetCalories - maintenanceCalories;
  const weeklyWeightChange = (dailyBalance * 7) / 7700;
  const usableRate = Math.abs(weeklyWeightChange);

  if (usableRate < 0.05) {
    return `سعراتك قريبة من الثبات. احتياجك التقريبي ${Math.round(maintenanceCalories)} سعرة`;
  }

  if (Math.sign(weeklyWeightChange) !== Math.sign(remaining)) {
    const action = remaining > 0 ? "ارفع" : "قلل";
    return `${action} السعرات لتحقيق ${direction} الوزن. احتياجك التقريبي ${Math.round(maintenanceCalories)} سعرة`;
  }

  const weeks = Math.ceil(absoluteRemaining / usableRate);
  const targetDate = addDays(last.date, Math.round(weeks * 7));
  const balanceLabel = dailyBalance > 0 ? "فائض" : "عجز";
  return `تحتاج ${formatWeeks(weeks)} للوصول إلى هدفك (${direction} ${usableRate.toFixed(1)} كجم أسبوعيًا، ${balanceLabel} ${Math.abs(Math.round(dailyBalance))} سعرة يوميًا) - تقريبًا ${formatDateLong(targetDate)}`;
}

function estimateMaintenanceCalories(weightKg) {
  const s = state.settings;
  const sexAdjustment = s.sex === "female" ? -161 : 5;
  const bmr = (10 * weightKg) + (6.25 * s.heightCm) - (5 * s.age) + sexAdjustment;
  return bmr * Number(s.activityLevel || 1.2);
}

function formatWeeks(weeks) {
  if (weeks === 1) return "أسبوعًا واحدًا";
  if (weeks === 2) return "أسبوعين";
  if (weeks <= 10) return `${weeks} أسابيع`;
  return `${weeks} أسبوعًا`;
}

function mealTemplate(meal) {
  return `
    <div class="list-item">
      <div>
        <h4>${escapeHtml(meal.name)}</h4>
        <p>${meal.calories} سعرة | بروتين ${meal.protein} جم | كارب ${meal.carbs} جم | دهون ${meal.fat} جم</p>
      </div>
      <button class="small-btn delete" data-delete-meal="${meal.id}" type="button">حذف</button>
    </div>
  `;
}

function foodTemplate(food) {
  return `
    <div class="list-item">
      <div>
        <h4>${escapeHtml(food.name)}</h4>
        <p>${food.calories} سعرة | بروتين ${food.protein} جم | كارب ${food.carbs} جم | دهون ${food.fat} جم</p>
      </div>
      <div class="item-actions">
        <button class="small-btn" data-add-food="${food.id}" type="button">إضافة</button>
        <button class="small-btn delete" data-delete-food="${food.id}" type="button">حذف</button>
      </div>
    </div>
  `;
}

function weightTemplate(entry) {
  return `
    <div class="list-item">
      <div>
        <h4>${entry.value} كجم</h4>
        <p>${formatDateLong(entry.date)}</p>
      </div>
      <button class="small-btn delete" data-delete-weight="${entry.id}" type="button">حذف</button>
    </div>
  `;
}

function quickFoodTemplate(food) {
  return `
    <button class="ghost-btn" data-add-food="${food.id}" type="button">
      ${escapeHtml(food.name)} - ${food.calories} سعرة
    </button>
  `;
}

function emptyState(message) {
  return `<div class="empty-state">${message}</div>`;
}

function saveAndRender(message) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
  showToast(message);
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultState);
  try {
    const parsed = JSON.parse(saved);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      settings: {
        ...structuredClone(defaultState.settings),
        ...(parsed.settings || {})
      }
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function fillSettingsForm() {
  Object.entries(state.settings).forEach(([key, value]) => {
    const input = document.querySelector(`#${key}`);
    if (input) input.value = value;
  });
}

function readNumber(selector) {
  return Number(document.querySelector(selector).value) || 0;
}

function setText(selector, value) {
  document.querySelector(selector).textContent = value;
}

function percent(value, target) {
  if (!target) return 0;
  return Math.round((value / target) * 100);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function lastNDays(count) {
  return Array.from({ length: count }, (_, index) => addDays(today, index - count + 1));
}

function addDays(dateKey, amount) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

function daysBetween(start, end) {
  return Math.round((new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) / 86400000);
}

function toDateKey(date) {
  const value = date instanceof Date ? date : new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLong(dateKey) {
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "full" }).format(new Date(`${dateKey}T00:00:00`));
}

function formatShortDate(dateKey) {
  return new Intl.DateTimeFormat("ar-SA", { month: "short", day: "numeric" }).format(new Date(`${dateKey}T00:00:00`));
}

function formatWeekday(dateKey) {
  return new Intl.DateTimeFormat("ar-SA", { weekday: "short" }).format(new Date(`${dateKey}T00:00:00`));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 1800);
}

function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  els.themeToggle.textContent = theme === "dark" ? "الوضع النهاري" : "الوضع الليلي";
  requestAnimationFrame(renderCharts);
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
