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
    userName: "HolySeraph",
    activityLevel: 1.375
  },
  meals: [],
  foods: [],
  waters: [],
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
  themeToggle: document.querySelector("#themeToggle"),
  menuToggle: document.querySelector("#menuToggle"),
  drawerClose: document.querySelector("#drawerClose"),
  navBackdrop: document.querySelector("#navBackdrop"),
  mobileViewTitle: document.querySelector("#mobileViewTitle"),
  greetingLabel: document.querySelector("#greetingLabel"),
  appTitle: document.querySelector("#appTitle"),
  userNameLabel: document.querySelector("#userNameLabel"),
  editNameBtn: document.querySelector("#editNameBtn"),
  weekStrip: document.querySelector("#weekStrip"),
  bottomNavItems: document.querySelectorAll(".bottom-nav-item"),
  fabAddMeal: document.querySelector("#fabAddMeal"),
  exportData: document.querySelector("#exportData"),
  importData: document.querySelector("#importData"),
  themeColor: document.querySelector('meta[name="theme-color"]'),
  appleStatusBar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
};

const viewNames = {
  dashboard: "الرئيسية",
  daily: "تسجيل اليوم",
  foods: "مكتبة الأطعمة",
  weight: "المتابعة اليومية",
  reports: "التقدم",
  settings: "الإعدادات"
};

init();

function init() {
  applyTheme("dark");
  document.body.dataset.view = "dashboard";
  document.querySelector("#mealDate").value = today;
  document.querySelector("#weightDate").value = today;
  document.querySelector("#measurementDate").value = today;
  document.querySelectorAll('input[type="date"]').forEach((input) => {
    input.lang = "en-CA";
  });
  els.todayLabel.textContent = formatDateLong(today);
  els.greetingLabel.textContent = greetingText();
  els.userNameLabel.textContent = state.settings.userName || defaultState.settings.userName;
  renderWeekStrip();
  fillSettingsForm();
  bindEvents();
  registerServiceWorker();
  window.addEventListener("charts-ready", renderCharts);
  render();
}

function bindEvents() {
  els.navItems.forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  els.bottomNavItems.forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  els.fabAddMeal.addEventListener("click", () => switchView("daily"));
  document.querySelector("#weightLogToggle")?.addEventListener("click", () => {
    const panel = document.querySelector("#weightLogPanel");
    if (!panel) return;
    panel.hidden = !panel.hidden;
    if (!panel.hidden) document.querySelector("#weightValue")?.focus();
  });
  document.querySelector(".show-all-link")?.addEventListener("click", (event) => {
    event.preventDefault();
    switchView("daily");
  });
  document.querySelector("#waterAdd")?.addEventListener("click", addWaterEntry);
  els.editNameBtn.addEventListener("click", editUserName);
  els.exportData.addEventListener("click", exportAppData);
  els.importData.addEventListener("change", importAppData);

  els.menuToggle.addEventListener("click", openMenu);
  els.drawerClose.addEventListener("click", closeMenu);
  els.navBackdrop.addEventListener("click", closeMenu);

  els.themeToggle.addEventListener("click", () => {
    const nextTheme = document.body.classList.contains("dark") ? "light" : "dark";
    applyTheme(nextTheme);
    localStorage.setItem(THEME_KEY, nextTheme);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  window.addEventListener("resize", debounce(renderCharts, 150));

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
    els.mealForm.reset();
    document.querySelector("#mealDate").value = today;
    saveAndRender("تمت إضافة الوجبة");
    switchView("dashboard");
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
      userName: state.settings.userName || defaultState.settings.userName,
      activityLevel: readNumber("#activityLevel")
    };
    saveAndRender("تم تحديث الأهداف");
  });

  document.querySelector("#clearData").addEventListener("click", () => {
    if (!confirm("هل تريد حذف كل البيانات المحفوظة على هذا الجهاز؟")) return;
    localStorage.removeItem(STORAGE_KEY);
    Object.assign(state, structuredClone(defaultState));
    fillSettingsForm();
    els.userNameLabel.textContent = state.settings.userName;
    saveAndRender("تم حذف البيانات");
  });
}

function switchView(viewId) {
  document.body.dataset.view = viewId;
  els.navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === viewId));
  els.bottomNavItems.forEach((item) => item.classList.toggle("active", item.dataset.view === viewId));
  els.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
  els.viewTitle.textContent = viewNames[viewId];
  els.mobileViewTitle.textContent = viewNames[viewId];
  els.appTitle.textContent = viewId === "dashboard" ? "كالي" : viewNames[viewId];
  closeMenu();
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  requestAnimationFrame(renderCharts);
}

function render() {
  els.userNameLabel.textContent = state.settings.userName || defaultState.settings.userName;
  renderDashboard();
  renderFoods();
  renderWeightHistory();
  renderReports();
  renderProgressOverview();
  renderCharts();
}

function renderDashboard() {
  const todayTotals = totalsForDate(today);
  const remaining = state.settings.targetCalories - todayTotals.calories;
  const proteinPercent = percent(todayTotals.protein, state.settings.targetProtein);

  setText("#todayCalories", Math.round(todayTotals.calories));
  setText("#todayCaloriesHint", ` / ${state.settings.targetCalories.toLocaleString("en-US")} kcal`);
  setText("#remainingCalories", Math.round(remaining));
  setText("#proteinProgress", `${proteinPercent}%`);
  setText("#proteinHint", `${todayTotals.protein.toFixed(1)} من ${state.settings.targetProtein} جم`);
  setText("#streakCount", calculateStreak());
  document.querySelector(".calories-card")?.style.setProperty("--progress", `${Math.min(percent(todayTotals.calories, state.settings.targetCalories), 100)}%`);

  renderMacroBars(todayTotals);
  renderTodayMeals();

  const weekTotals = lastNDays(7).reduce((sum, date) => sum + totalsForDate(date).calories, 0);
  const weeklyGoal = state.settings.targetCalories * 7;
  setText("#weeklyHint", `استهلكت ${Math.round(weekTotals)} من ${weeklyGoal} سعرة هذا الأسبوع`);
  setText("#weightForecast", forecastText());
}

function renderMacroBars(totals) {
  const macros = [
    ["البروتين 🍖", totals.protein, state.settings.targetProtein, "var(--red)", "protein"],
    ["الدهون 🥑", totals.fat, state.settings.targetFat, "var(--green)", "fat"],
    ["الكارب 🌽", totals.carbs, state.settings.targetCarbs, "var(--blue)", "carbs"]
  ];
  document.querySelector("#macroBars").innerHTML = macros.map(([label, value, target, color, type]) => `
    <div class="macro-row macro-card ${type}">
      <header><span>${label}</span><strong>${formatMacroAmount(value)} / ${target}g</strong></header>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.min(percent(value, target), 100)}%;background:${color}"></div></div>
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

function renderProgressOverview() {
  const weights = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  const last = weights[weights.length - 1];
  const first = weights[0];
  const previous = weights.length > 1 ? weights[weights.length - 2] : null;
  const dates = lastNDays(7);
  const totals = dates.map(totalsForDate);
  const loggedDays = totals.filter((day) => day.calories > 0);
  const avgCalories = loggedDays.length ? average(loggedDays.map((day) => day.calories)) : 0;
  const adherenceDays = totals.filter((day) => day.calories > 0 && day.calories <= state.settings.targetCalories).length;
  const todayTotals = totalsForDate(today);
  const calorieTarget = state.settings.targetCalories;
  const caloriePercent = Math.min(percent(todayTotals.calories, calorieTarget), 100);
  const waterMl = waterForDate(today);
  const waterTargetMl = 2800;
  const waterPercent = Math.min(percent(waterMl, waterTargetMl), 100);
  const currentWeight = last?.value || first?.value || state.settings.targetWeight;
  const startingWeight = first?.value || currentWeight;
  const targetWeight = state.settings.targetWeight;
  const weightDiff = last ? currentWeight - startingWeight : 0;
  const totalWeightDistance = Math.abs(startingWeight - targetWeight);
  const coveredWeightDistance = totalWeightDistance ? Math.abs(startingWeight - currentWeight) : 0;
  const weightProgress = totalWeightDistance ? Math.min(Math.round((coveredWeightDistance / totalWeightDistance) * 100), 100) : (last ? 100 : 0);
  const bmi = currentWeight && state.settings.heightCm ? currentWeight / ((state.settings.heightCm / 100) ** 2) : 0;
  const bmiStatus = bmi < 18.5 ? "نحافة" : bmi < 25 ? "طبيعي" : bmi < 30 ? "زيادة الوزن" : "سمنة";

  setText("#progressTodayCalories", Math.round(todayTotals.calories).toLocaleString("en-US"));
  setText("#progressTodayCaloriesTarget", `/ ${formatCompactNumber(calorieTarget)} kcal`);
  document.querySelector("#progressTodayCaloriesFill")?.style.setProperty("width", `${caloriePercent}%`);
  setText("#waterValue", formatWaterLiters(waterMl));
  setText("#waterPercent", `${waterPercent}%`);
  document.querySelector("#waterRing")?.style.setProperty("--water-progress", `${waterPercent * 3.6}deg`);

  setText("#currentWeightValue", last ? last.value.toFixed(1) : "-");
  setText("#startingWeightValue", `${startingWeight.toFixed(1)}kg`);
  setText("#targetWeightValue", `${targetWeight.toFixed(1)}kg`);
  setText("#weightDifferenceValue", last ? `${weightDiff >= 0 ? "↑ +" : "↓ "}${Math.abs(weightDiff).toFixed(1)} kg` : "-");
  setText("#progressLastEntry", last ? `آخر تسجيل ${formatDateLong(last.date)}` : "لا يوجد تسجيل بعد");
  setText("#bmiValue", bmi ? bmi.toFixed(1) : "-");
  setText("#bmiStatus", bmi ? bmiStatus : "-");
  setText("#progressAvgCalories", Math.round(avgCalories));
  setText("#progressAdherence", `${Math.round((adherenceDays / 7) * 100)}%`);
  document.querySelector(".weight-progress-dots")?.style.setProperty("--weight-progress", `${weightProgress}%`);
  document.querySelector(".weight-progress-dots")?.setAttribute("title", `التقدم للهدف ${weightProgress}%`);

  if (!last || !previous) {
    setText("#weeklyWeightRate", "0");
    return;
  }

  const dayGap = Math.max(daysBetween(previous.date, last.date), 1);
  const weeklyRate = ((last.value - previous.value) / dayGap) * 7;
  setText("#weeklyWeightRate", weeklyRate.toFixed(1));
}

function renderCharts() {
  renderWeeklyCaloriesChart();
  renderWeightChart();
  renderProgressWeightChart();
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
        backgroundColor: colors.orange,
        borderRadius: 8,
        maxBarThickness: isMobile() ? 28 : 44
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
        borderWidth: isMobile() ? 3 : 2,
        pointRadius: isMobile() ? 3 : 2,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.35
      }]
    },
    options: baseChartOptions()
  });
}

function renderProgressWeightChart() {
  const weights = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  const colors = chartColors();
  const fallbackWeights = weights.length ? weights : [
    { date: addDays(today, -6), value: state.settings.targetWeight },
    { date: today, value: state.settings.targetWeight }
  ];
  createChart("progressWeightChart", {
    type: "line",
    data: {
      labels: fallbackWeights.map((entry) => formatShortDate(entry.date)),
      datasets: [{
        label: "الوزن",
        data: fallbackWeights.map((entry) => entry.value),
        borderColor: colors.blue,
        backgroundColor: colors.blueFill,
        borderWidth: 3,
        pointRadius: 3,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.28
      }]
    },
    options: {
      ...baseChartOptions(),
      plugins: {
        ...baseChartOptions().plugins,
        legend: { display: false }
      }
    }
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
        { label: "السعرات", data: dates.map((date) => totalsForDate(date).calories), borderColor: colors.orange, yAxisID: "y" },
        { label: "البروتين", data: dates.map((date) => totalsForDate(date).protein), borderColor: colors.blue, yAxisID: "y1" }
      ]
    },
    options: {
      ...baseChartOptions(),
      scales: {
        y: chartScale(),
        y1: { ...chartScale(), display: !isMobile(), position: "right", grid: { drawOnChartArea: false } }
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
  const mobile = isMobile();
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false
    },
    elements: {
      line: {
        borderWidth: mobile ? 3 : 2,
        tension: 0.35
      },
      point: {
        radius: mobile ? 2.5 : 2,
        hitRadius: 14,
        hoverRadius: 5
      }
    },
    plugins: {
      legend: {
        position: mobile ? "bottom" : "top",
        align: "start",
        labels: {
          color: chartColors().muted,
          boxWidth: mobile ? 10 : 14,
          padding: mobile ? 12 : 16,
          font: { family: "Segoe UI", size: mobile ? 11 : 12 }
        }
      }
    },
    scales: {
      y: chartScale(),
      x: {
        grid: { display: false },
        ticks: {
          color: chartColors().muted,
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: mobile ? 6 : 10
        }
      }
    }
  };
}

function chartScale() {
  const colors = chartColors();
  const mobile = isMobile();
  return {
    beginAtZero: true,
    grid: { color: colors.grid },
    border: { display: false },
    ticks: {
      color: colors.muted,
      maxTicksLimit: mobile ? 5 : 7,
      padding: mobile ? 6 : 8
    }
  };
}

function chartColors() {
  return {
    green: "#36f1a7",
    blue: "#38c7ff",
    orange: "#ff9f43",
    gold: "#ff9f43",
    red: "#ff5d73",
    blueFill: "rgba(56, 199, 255, 0.16)",
    grid: "rgba(157, 187, 222, 0.13)",
    muted: "#93a7c5"
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

function addWaterEntry() {
  const value = prompt("أدخل كمية الماء بالمل (مثال: 250، 500، 750، 1000)", "250");
  if (value === null) return;
  const amount = Number(String(value).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) {
    showToast("أدخل كمية ماء صحيحة");
    return;
  }
  state.waters.push({
    id: createId(),
    date: today,
    amountMl: Math.round(amount)
  });
  saveAndRender("تمت إضافة الماء");
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

function waterForDate(date) {
  return (state.waters || [])
    .filter((entry) => entry.date === date)
    .reduce((total, entry) => total + (Number(entry.amountMl) || 0), 0);
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

function formatMacroAmount(value) {
  return Number(value) % 1 === 0 ? String(Math.round(value)) : value.toFixed(1);
}

function formatCompactNumber(value) {
  if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 ? 1 : 0)}k`;
  return String(Math.round(value));
}

function formatWaterLiters(valueMl) {
  const liters = valueMl / 1000;
  return Number.isInteger(liters) ? String(liters) : liters.toFixed(2).replace(/0$/, "");
}

function mealTemplate(meal) {
  return `
    <div class="list-item meal-item">
      <div class="meal-content">
        <h4>${escapeHtml(meal.name)}</h4>
        <p class="meal-calories">🔥 ${meal.calories} سعرة</p>
        <div class="meal-chip-row">
          <span>🍗 ${meal.protein}g</span>
          <span>🌽 ${meal.carbs}g</span>
          <span>🥑 ${meal.fat}g</span>
        </div>
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

function editUserName() {
  const currentName = state.settings.userName || defaultState.settings.userName;
  const nextName = prompt("اكتب الاسم الذي يظهر في الواجهة", currentName);
  if (nextName === null) return;
  const cleanName = nextName.trim();
  if (!cleanName) return showToast("اكتب اسمًا صالحًا");
  state.settings.userName = cleanName;
  saveAndRender("تم تحديث الاسم");
}

function exportAppData() {
  const payload = {
    app: "calorie-tracker",
    version: 2,
    exportedAt: new Date().toISOString(),
    state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `calorie-tracker-backup-${today}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("تم إنشاء ملف البيانات");
}

function importAppData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      const importedState = parsed.state || parsed;
      const nextState = normalizeImportedState(importedState);
      Object.assign(state, nextState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      fillSettingsForm();
      render();
      showToast("تم استيراد البيانات");
    } catch {
      showToast("تعذر قراءة ملف البيانات");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function normalizeImportedState(importedState) {
  return {
    ...structuredClone(defaultState),
    ...importedState,
    settings: {
      ...structuredClone(defaultState.settings),
      ...(importedState.settings || {})
    },
    meals: Array.isArray(importedState.meals) ? importedState.meals : [],
    foods: Array.isArray(importedState.foods) ? importedState.foods : [],
    waters: Array.isArray(importedState.waters) ? importedState.waters : [],
    weights: Array.isArray(importedState.weights) ? importedState.weights : [],
    measurements: Array.isArray(importedState.measurements) ? importedState.measurements : []
  };
}

function readNumber(selector) {
  return Number(document.querySelector(selector).value) || 0;
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
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
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { dateStyle: "full" }).format(new Date(`${dateKey}T00:00:00`));
}

function formatShortDate(dateKey) {
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { month: "short", day: "numeric" }).format(new Date(`${dateKey}T00:00:00`));
}

function formatWeekday(dateKey) {
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { weekday: "short" }).format(new Date(`${dateKey}T00:00:00`));
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
  document.body.classList.add("dark");
  els.themeToggle.textContent = "الوضع الليلي";
  els.themeColor.content = "#071225";
  els.appleStatusBar.content = "black-translucent";
  requestAnimationFrame(renderCharts);
}

function renderWeekStrip() {
  if (!els.weekStrip) return;
  const days = lastNDays(7);
  els.weekStrip.innerHTML = days.map((date) => {
    const dayNumber = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { day: "numeric" }).format(new Date(`${date}T00:00:00`));
    return `
      <div class="week-day ${date === today ? "active" : ""}">
        <span>${formatWeekday(date)}</span>
        <strong>${dayNumber}</strong>
      </div>
    `;
  }).join("");
}

function greetingText() {
  const hour = new Date().getHours();
  if (hour < 12) return "صباح النشاط";
  if (hour < 18) return "نهارك صحي";
  return "مساء الإنجاز";
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

function openMenu() {
  document.body.classList.add("menu-open");
  els.menuToggle.setAttribute("aria-expanded", "true");
}

function closeMenu() {
  document.body.classList.remove("menu-open");
  els.menuToggle.setAttribute("aria-expanded", "false");
}

function isMobile() {
  return window.matchMedia("(max-width: 680px)").matches;
}

function debounce(callback, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), delay);
  };
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
