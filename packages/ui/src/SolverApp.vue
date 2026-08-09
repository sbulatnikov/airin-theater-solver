<script setup lang="ts">
import {
  type AnalysisResult,
  isStrategySolverEngine,
  type SolverEngine,
  type TurnInput,
  type TurnType,
} from '@airin-play/core/shared';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import ReplyChips from './components/ReplyChips.vue';
import ThemeToggle from './components/ThemeToggle.vue';
import type { AppConfig } from './config';
import './styles.css';

const props = defineProps<{ engine: SolverEngine; config: AppConfig }>();
const { engine, config } = props;
const state = reactive<{ started: boolean; mode: TurnType; turns: TurnInput[]; selectedQuickOptions: string[] }>({
  started: false,
  mode: 'controlled',
  turns: [],
  selectedQuickOptions: [],
});
const optionsInput = ref('');
const resultInput = ref('');
const optionsError = ref('');
const resultError = ref('');
const analyzedOptions = ref<AnalysisResult[]>([]);
const debugDownloaded = ref(false);
const optionsElement = ref<HTMLInputElement | null>(null);
const resultElement = ref<HTMLInputElement | null>(null);

type Theme = 'dark' | 'light';
const THEME_STORAGE_KEY = 'airin-play-theme';
const DARK_THEME_COLOR = '#0c1118';
const LIGHT_THEME_COLOR = '#f4f1eb';

function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : null;
  } catch {
    return null;
  }
}
function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const storedTheme = ref<Theme | null>(readStoredTheme());
const theme = ref<Theme>(storedTheme.value ?? systemTheme());
const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme(nextTheme: Theme): void {
  theme.value = nextTheme;
  document.documentElement.dataset.theme = nextTheme;
  document.documentElement.style.colorScheme = nextTheme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', nextTheme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
}
function toggleTheme(): void {
  const nextTheme = theme.value === 'dark' ? 'light' : 'dark';
  storedTheme.value = nextTheme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch {
    // The theme still applies for this session when storage is unavailable.
  }
  applyTheme(nextTheme);
}
function handleSystemThemeChange(event: MediaQueryListEvent): void {
  if (storedTheme.value === null) applyTheme(event.matches ? 'dark' : 'light');
}

const calculated = computed(() => engine.calculateState(state.turns));
const finished = computed(() => state.turns.length >= engine.totalTurns);
const currentTurn = computed(() => Math.min(state.turns.length + 1, engine.totalTurns));
const strategyResults = computed(() => (finished.value ? [] : engine.analyzeOptions(state.turns, engine.replyTypes)));
const idealReplies = computed(() => strategyResults.value.filter((result) => result.isBest).slice(0, 3));
const idealRoute = computed(() =>
  config.idealRoute && isStrategySolverEngine(engine) ? engine.buildIdealChain(state.turns) : null,
);
const remaining = computed(() => Math.max(0, engine.targetScore - calculated.value.audience));
const turnsLeft = computed(() => engine.totalTurns - state.turns.length);
const neededPace = computed(() => (turnsLeft.value > 0 ? Math.ceil(remaining.value / turnsLeft.value) : 0));
const theoreticalMaximum = computed(() =>
  strategyResults.value.length
    ? Math.max(...strategyResults.value.map((result) => result.projectedAudience))
    : calculated.value.audience,
);
const scoreSpread = computed(() => {
  const values = engine.colorKeys.map((key) => calculated.value.scores[key]);
  return Math.max(...values) - Math.min(...values);
});
const balanceText = computed(() => {
  if (scoreSpread.value === 0) return 'Все цвета равны';
  if (scoreSpread.value === 1) return 'Почти идеально';
  return `Разница: ${scoreSpread.value} ${pluralizePoints(scoreSpread.value)}`;
});
const paceText = computed(() => {
  if (remaining.value === 0) return 'цель достигнута';
  if (turnsLeft.value === 0) return 'ходы закончились';
  return `${neededPace.value} за ход${neededPace.value > 3 ? ' · невозможно' : ''}`;
});
const finishWon = computed(() => calculated.value.audience >= engine.targetScore);

function pluralizePoints(value: number): string {
  const absolute = Math.abs(value) % 100;
  const last = absolute % 10;
  if (absolute > 10 && absolute < 20) return 'очков';
  if (last === 1) return 'очко';
  if (last >= 2 && last <= 4) return 'очка';
  return 'очков';
}

function setMode(mode: TurnType): void {
  state.mode = mode;
  hideRecommendations();
  optionsError.value = '';
  resultError.value = '';
  void nextTick(() => (mode === 'controlled' ? optionsElement.value : resultElement.value)?.focus());
}
function handleModeKeydown(event: KeyboardEvent): void {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  setMode(
    event.key === 'Home'
      ? 'controlled'
      : event.key === 'End'
        ? 'anonymous'
        : state.mode === 'controlled'
          ? 'anonymous'
          : 'controlled',
  );
}
function hideRecommendations(): void {
  analyzedOptions.value = [];
}
function analyze(options: string[]): void {
  analyzedOptions.value = engine.analyzeOptions(state.turns, options);
}
function handleAnalyze(): void {
  const parsed = engine.parseOptions(optionsInput.value);
  if (!parsed.ok) {
    optionsError.value = parsed.error;
    hideRecommendations();
    return;
  }
  optionsError.value = '';
  analyze(parsed.value);
}
function handleOptionsInput(event: Event): void {
  optionsInput.value = engine.sanitizeOptionsInput((event.target as HTMLInputElement).value);
  const parts = optionsInput.value.trim().split(/\s+/).filter(Boolean);
  const complete = parts.length === 3 && parts.every((part) => part.length === 2);
  const validation = complete ? engine.parseOptions(optionsInput.value) : { ok: true as const, value: [] };
  optionsError.value = validation.ok ? '' : validation.error;
  hideRecommendations();
}
function handleResultInput(event: Event): void {
  resultInput.value = engine.sanitizeReplyInput((event.target as HTMLInputElement).value);
  resultError.value = '';
}
function addTurn(reply: string, type: TurnType): void {
  if (finished.value) return;
  state.turns.push({ reply, type });
  state.selectedQuickOptions = [];
  optionsInput.value = '';
  resultInput.value = '';
  optionsError.value = '';
  resultError.value = '';
  hideRecommendations();
  void nextTick(() => (state.mode === 'controlled' ? optionsElement.value : resultElement.value)?.focus());
}
function handleAnonymousRecord(): void {
  const parsed = engine.parseReply(resultInput.value);
  if (!parsed.ok) {
    resultError.value = parsed.error;
    return;
  }
  addTurn(parsed.value, 'anonymous');
}
function toggleQuickOption(reply: string): void {
  const index = state.selectedQuickOptions.indexOf(reply);
  if (index >= 0) state.selectedQuickOptions.splice(index, 1);
  else if (state.selectedQuickOptions.length < 3) state.selectedQuickOptions.push(reply);
  hideRecommendations();
  if (state.selectedQuickOptions.length === 3) analyze([...state.selectedQuickOptions]);
}
function undo(): void {
  state.turns.pop();
  state.selectedQuickOptions = [];
  optionsError.value = '';
  resultError.value = '';
  hideRecommendations();
}
function resetGame(skipConfirmation = false): void {
  if (
    !skipConfirmation &&
    state.turns.length > 0 &&
    !window.confirm('Начать новую пьесу? История текущей пьесы будет удалена.')
  )
    return;
  state.turns.splice(0);
  state.selectedQuickOptions = [];
  optionsInput.value = '';
  resultInput.value = '';
  optionsError.value = '';
  resultError.value = '';
  hideRecommendations();
  setMode('controlled');
}
function startGame(): void {
  state.started = true;
  resetGame(true);
}
function formatGainDetails(result: AnalysisResult): string[] {
  if (state.turns.length === 0) return ['Первая реплика', '+0 восторга'];
  return [`Общий цвет +${result.shared}`, `Баланс +${result.balance}`];
}
function compactResult(result: AnalysisResult) {
  return {
    reply: result.reply,
    contribution: result.contribution,
    shared: result.shared,
    balance: result.balance,
    gain: result.gain,
    spread: result.spread,
    projectedGain: result.projectedGain,
    projectedAudience: result.projectedAudience,
    isBest: result.isBest,
    scoresAfter: result.scoresAfter,
  };
}
function buildDebugPayload() {
  const summedScores = calculated.value.calculatedTurns.reduce(
    (total, turn) => {
      engine.colorKeys.forEach((key) => {
        total[key] += turn.contribution[key];
      });
      return total;
    },
    { blue: 0, green: 0, red: 0 },
  );
  const summedAudience = calculated.value.calculatedTurns.reduce((total, turn) => total + turn.gain, 0);
  return {
    schema: 'airin-play-debug-snapshot',
    schemaVersion: '1.1.0',
    encoding: 'base64(utf8-json)',
    application: {
      name: 'Суфлёр',
      variant: config.variant,
      version: config.version,
      engineVersion: engine.version,
      author: config.author,
    },
    capturedAt: new Date().toISOString(),
    environment: {
      page: window.location.href.split(/[?#]/, 1)[0],
      userAgent: navigator.userAgent,
      language: navigator.language,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      online: navigator.onLine,
    },
    rules: {
      totalTurns: engine.totalTurns,
      targetAudience: engine.targetScore,
      replyTypes: [...engine.replyTypes],
      scoringRevision: 'active-equality-minimum-two',
      firstTurnAudience: 0,
      sharedColorBonus: 1,
      pairEqualityBonus: 1,
      tripleEqualityBonus: 2,
      minimumEqualityValue: 2,
      equalityMustTouchCurrentReply: true,
    },
    session: {
      started: state.started,
      mode: state.mode,
      turnCount: state.turns.length,
      turns: state.turns.map((turn) => ({ ...turn })),
      selectedQuickOptions: [...state.selectedQuickOptions],
      inputs: {
        controlled: optionsInput.value,
        anonymous: resultInput.value,
        controlledError: optionsError.value,
        anonymousError: resultError.value,
      },
    },
    calculations: {
      current: {
        scores: calculated.value.scores,
        audience: calculated.value.audience,
        previousReply: calculated.value.previous,
        remainingTurns: turnsLeft.value,
        remainingToTarget: remaining.value,
        finished: finished.value,
        won: finishWon.value,
      },
      turns: calculated.value.calculatedTurns,
      analyzedOptions: analyzedOptions.value.map(compactResult),
      idealCandidates: strategyResults.value.map(compactResult),
      idealRoute: idealRoute.value,
    },
    integrity: {
      audienceEqualsTurnSum: calculated.value.audience === summedAudience,
      scoresEqualContributionSum: engine.colorKeys.every((key) => calculated.value.scores[key] === summedScores[key]),
      turnCountWithinLimit: state.turns.length <= engine.totalTurns,
      summedScores,
      summedAudience,
    },
  };
}
function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}
function downloadDebugSnapshot(): void {
  const payload = buildDebugPayload();
  const blob = new Blob([encodeBase64Utf8(JSON.stringify(payload))], { type: 'text/plain;charset=us-ascii' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `airinplay-debug-${config.variant}-v${config.version}-${payload.capturedAt.replace(/[:.]/g, '-')}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  debugDownloaded.value = true;
  window.setTimeout(() => {
    debugDownloaded.value = false;
  }, 1400);
}
onMounted(() => {
  applyTheme(theme.value);
  colorSchemeQuery.addEventListener('change', handleSystemThemeChange);
  document.title = `Суфлёр — ${config.version}`;
  document.querySelector('meta[name="version"]')?.setAttribute('content', config.version);
  document.querySelector('meta[name="author"]')?.setAttribute('content', config.author);
  Object.assign(window, {
    AirinPlayEngine: engine,
    AirinPlayDebug: { buildDebugPayload, encodeBase64Utf8 },
  });
});
onBeforeUnmount(() => colorSchemeQuery.removeEventListener('change', handleSystemThemeChange));
</script>

<template>
  <div class="ambient" aria-hidden="true"></div>
  <main v-if="!state.started" class="screen start-screen is-active">
    <ThemeToggle class="start-theme-toggle" :theme="theme" @toggle="toggleTheme" />
    <section class="start-card" aria-labelledby="startTitle">
      <p class="eyebrow">Помощник по пьесе</p>
      <h1 id="startTitle" class="start-title">Суфлёр</h1>
      <p class="start-copy">Выбирайте лучшие реплики и наберите 26 очков восторга за 16 ходов.</p>
      <button class="primary-button" type="button" @click="startGame">Начать пьесу</button>
      <p class="start-meta">Версия {{ config.version }} · Автор: {{ config.author }}</p>
    </section>
  </main>

  <main v-else class="screen is-active">
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark" aria-hidden="true">С</div>
          <div>
            <p class="brand-name">Суфлёр</p>
            <p class="brand-subtitle">
              Помогаем пройти пьесу с первого раза · v{{ config.version }}
              · {{ config.author }}
            </p>
          </div>
        </div>
        <div class="topbar-actions">
          <ThemeToggle :theme="theme" @toggle="toggleTheme" />
          <button
            class="ghost-button icon-button"
            :class="{ 'is-success': debugDownloaded }"
            type="button"
            title="Скачать снимок игры для диагностики"
            aria-label="Скачать снимок игры для диагностики"
            @click="downloadDebugSnapshot"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="m8 2 1.9 1.9M14.1 3.9 16 2M9 7.1v-1a3 3 0 0 1 6 0v1M12 20c-3.3 0-6-2.7-6-6v-3a6 6 0 0 1 12 0v3c0 3.3-2.7 6-6 6ZM12 20v-9M6.5 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M17.5 9C19.4 8.8 21 7.1 21 5M18 13h4M21 21c0-2.1-1.7-3.9-3.8-4"
              />
            </svg>
          </button>
          <button class="ghost-button" type="button" @click="resetGame(false)">Новая пьеса</button>
        </div>
      </header>

      <section class="progress-panel" aria-label="Прогресс пьесы">
        <p class="sr-only" role="status" aria-live="polite">
          Восторг зала: {{ calculated.audience }} из {{ engine.targetScore }}. Выполнено реплик:
          {{ state.turns.length }}
          из {{ engine.totalTurns }}.
        </p>
        <div class="score-main" title="Восторг зала">
          <span class="score-number">{{ calculated.audience }}</span
          ><span class="score-target">/ {{ engine.targetScore }}</span>
        </div>
        <div class="progress-track-wrap">
          <div class="progress-labels">
            <span>Восторг зала</span
            ><strong>{{ finished ? "Пьеса завершена" : `Реплика ${currentTurn} из ${engine.totalTurns}` }}</strong>
          </div>
          <ol class="turn-track" aria-hidden="true">
            <li
              v-for="index in engine.totalTurns"
              :key="index"
              class="turn-dot"
              :class="{ 'is-done': index <= state.turns.length, 'is-current': index === state.turns.length + 1 && !finished }"
            ></li>
          </ol>
        </div>
        <section class="strategy-preview" aria-label="Оптимальные следующие реплики">
          <span class="strategy-preview-label">Лучшие сейчас</span>
          <div class="strategy-options">
            <ReplyChips
              v-for="result in idealReplies"
              :key="result.reply"
              class="strategy-reply"
              :reply="result.reply"
            />
          </div>
        </section>
        <div class="pace">
          <strong :class="{ 'is-impossible': remaining > 0 && (neededPace > 3 || turnsLeft === 0) }"
            >{{ paceText }}</strong
          ><span>необходимый темп</span>
        </div>
      </section>

      <section class="color-scores" aria-label="Очки цветов">
        <article class="color-score blue">
          <div class="color-label"><span class="color-pip"></span>Синий</div>
          <strong class="color-value">{{ calculated.scores.blue }}</strong>
        </article>
        <article class="color-score green">
          <div class="color-label"><span class="color-pip"></span>Зелёный</div>
          <strong class="color-value">{{ calculated.scores.green }}</strong>
        </article>
        <article class="color-score red">
          <div class="color-label"><span class="color-pip"></span>Красный</div>
          <strong class="color-value">{{ calculated.scores.red }}</strong>
        </article>
      </section>

      <div class="workspace">
        <section class="panel turn-panel" aria-labelledby="turnTitle">
          <div class="panel-heading">
            <div>
              <h2 id="turnTitle">Следующая реплика</h2>
              <p>Выберите, что вы видите в игре.</p>
            </div>
            <span class="turn-badge"
              >{{ finished ? `${engine.totalTurns} / ${engine.totalTurns}` : `Ход ${currentTurn}` }}</span
            >
          </div>
          <div class="mode-switch" role="tablist" aria-label="Тип реплики">
            <button
              class="mode-button"
              :class="{ 'is-active': state.mode === 'controlled' }"
              type="button"
              role="tab"
              id="controlledModeTab"
              aria-controls="controlledModePanel"
              :aria-selected="state.mode === 'controlled'"
              :tabindex="state.mode === 'controlled' ? 0 : -1"
              @click="setMode('controlled')"
              @keydown="handleModeKeydown"
            >
              Вижу 3 варианта
            </button>
            <button
              class="mode-button"
              :class="{ 'is-active': state.mode === 'anonymous' }"
              type="button"
              role="tab"
              id="anonymousModeTab"
              aria-controls="anonymousModePanel"
              :aria-selected="state.mode === 'anonymous'"
              :tabindex="state.mode === 'anonymous' ? 0 : -1"
              @click="setMode('anonymous')"
              @keydown="handleModeKeydown"
            >
              Вижу только выбор
            </button>
          </div>

          <section v-if="config.idealRoute && idealRoute" class="route-panel" aria-labelledby="routeTitle">
            <div class="route-heading">
              <strong id="routeTitle">Лучший маршрут</strong
              ><span class="route-status" :class="{ 'is-warning': !idealRoute.canWin }"
                >{{ idealRoute.canWin ? "Цель достижима" : "Цель недостижима" }}</span
              >
            </div>
            <ol class="victory-chain" aria-label="Оптимальная последовательность оставшихся реплик">
              <li v-for="step in idealRoute.steps" :key="step.number" class="route-step">
                <span>{{ step.number }}</span><ReplyChips :reply="step.reply" /><small>+{{ step.gain }}</small>
              </li>
            </ol>
            <p class="route-note">
              Будущие варианты неизвестны, поэтому маршрут обновляется после каждого хода. Возможный итог:
              {{ idealRoute.finalAudience }}.
            </p>
          </section>

          <div
            v-if="state.mode === 'controlled'"
            id="controlledModePanel"
            class="mode-content is-active"
            role="tabpanel"
            aria-labelledby="controlledModeTab"
          >
            <template v-if="config.quickChoice">
              <div class="quick-heading">
                <span class="field-label">Выберите 3 варианта из игры</span
                ><span class="selection-counter"><strong>{{ state.selectedQuickOptions.length }}</strong> из 3</span>
              </div>
              <section class="quick-option-grid" aria-label="Выбор предложенных реплик">
                <button
                  v-for="reply in engine.replyTypes"
                  :key="reply"
                  class="quick-option"
                  :class="{ 'is-selected': state.selectedQuickOptions.includes(reply), 'is-ideal': idealReplies.some((item) => engine.replySignature(item.reply) === engine.replySignature(reply)) }"
                  type="button"
                  :aria-label="`Реплика ${reply}`"
                  :aria-pressed="state.selectedQuickOptions.includes(reply)"
                  :disabled="finished"
                  @click="toggleQuickOption(reply)"
                >
                  <ReplyChips :reply="reply" />
                </button>
              </section>
              <p class="field-help">Расчёт начнётся после третьего выбора. Золотая точка — лучший вариант сейчас.</p>
              <details class="manual-entry">
                <summary>Или ввести строкой</summary>
                <div class="input-row">
                  <input
                    id="optionsInput"
                    ref="optionsElement"
                    :value="optionsInput"
                    class="reply-input"
                    :class="{ 'is-invalid': optionsError }"
                    type="text"
                    maxlength="8"
                    aria-label="Введите 3 варианта из игры"
                    :aria-invalid="Boolean(optionsError)"
                    aria-describedby="optionsError"
                    autocomplete="off"
                    spellcheck="false"
                    placeholder="СС СК СЗ"
                    :disabled="finished"
                    @input="handleOptionsInput"
                    @keydown.enter.prevent="handleAnalyze"
                  ><button class="primary-button" type="button" :disabled="finished" @click="handleAnalyze">
                    Рассчитать
                  </button>
                </div>
              </details>
            </template>
            <template v-else>
              <label class="field-label" for="optionsInput">Введите 3 варианта из игры</label>
              <div class="input-row">
                <input
                  id="optionsInput"
                  ref="optionsElement"
                  :value="optionsInput"
                  class="reply-input"
                  :class="{ 'is-invalid': optionsError }"
                  type="text"
                  maxlength="8"
                  :aria-invalid="Boolean(optionsError)"
                  aria-describedby="optionsError"
                  autocomplete="off"
                  spellcheck="false"
                  placeholder="СС СК СЗ"
                  :disabled="finished"
                  @input="handleOptionsInput"
                  @keydown.enter.prevent="handleAnalyze"
                ><button class="primary-button" type="button" :disabled="finished" @click="handleAnalyze">
                  Рассчитать
                </button>
              </div>
              <p class="field-help">Три разные реплики через пробел. С — синий, З — зелёный, К — красный.</p>
            </template>
            <p id="optionsError" class="error-message" role="alert">{{ optionsError }}</p>

            <div v-if="analyzedOptions.length" class="recommendation is-visible" aria-live="polite">
              <div class="recommendation-head">
                <h3>
                  {{ analyzedOptions.filter((item) => item.isBest).length > 1 ? "Лучшие варианты" : "Что выбрать" }}
                </h3>
                <span>Затем запишите фактический выбор</span>
              </div>
              <div class="option-grid">
                <article
                  v-for="result in analyzedOptions"
                  :key="result.reply"
                  class="option-card"
                  :class="{ 'is-best': result.isBest }"
                >
                  <div class="best-tag">{{ result.isBest ? "лучший выбор" : "альтернатива" }}</div>
                  <ReplyChips class="option-reply" :reply="result.reply" />
                  <div class="option-points">
                    <span v-for="line in formatGainDetails(result)" :key="line">{{ line }}</span
                    ><strong>Сейчас +{{ result.gain }}</strong
                    ><span>Потенциал: <strong>{{ result.projectedAudience }}</strong></span>
                  </div>
                  <button class="choose-button" type="button" @click="addTurn(result.reply, 'controlled')">
                    Записать этот выбор
                  </button>
                </article>
              </div>
              <p class="rule-note">
                Расчёт максимизирует итог. Будущие варианты неизвестны — стратегия обновляется после каждого хода.
              </p>
            </div>
          </div>

          <div
            v-else
            id="anonymousModePanel"
            class="mode-content is-active"
            role="tabpanel"
            aria-labelledby="anonymousModeTab"
          >
            <label class="field-label" for="resultInput">Какая реплика была выбрана?</label>
            <div class="input-row">
              <input
                id="resultInput"
                ref="resultElement"
                :value="resultInput"
                class="reply-input"
                :class="{ 'is-invalid': resultError }"
                type="text"
                maxlength="2"
                :aria-invalid="Boolean(resultError)"
                aria-describedby="resultError"
                autocomplete="off"
                spellcheck="false"
                placeholder="КЗ"
                :disabled="finished"
                @input="handleResultInput"
                @keydown.enter.prevent="handleAnonymousRecord"
              ><button class="primary-button" type="button" :disabled="finished" @click="handleAnonymousRecord">
                Записать
              </button>
            </div>
            <p class="field-help">Введите выбранную реплику, например КК или КЗ.</p>
            <p id="resultError" class="error-message" role="alert">{{ resultError }}</p>
          </div>

          <div
            v-if="finished"
            class="finish-banner is-visible"
            :class="{ 'is-failure': !finishWon }"
            aria-live="polite"
          >
            <h3>{{ finishWon ? "Браво! Цель достигнута" : "Занавес" }}</h3>
            <p>
              {{ finishWon ? `Зал в восторге: ${calculated.audience} ${pluralizePoints(calculated.audience)} за ${engine.totalTurns} реплик.` : `Набрано ${calculated.audience} из ${engine.targetScore}. Можно отменить последний ход или начать новую пьесу.` }}
            </p>
          </div>
        </section>

        <aside class="side-stack">
          <section class="panel insight-panel" aria-labelledby="insightTitle">
            <div class="section-title"><h2 id="insightTitle">Состояние пьесы</h2></div>
            <div class="insight-list">
              <div class="insight-item">
                <span>До цели</span
                ><strong :class="{ good: remaining === 0 }"
                  >{{ remaining === 0 ? "Цель достигнута" : `${remaining} ${pluralizePoints(remaining)}` }}</strong
                >
              </div>
              <div class="insight-item"><span>Цветовой баланс</span><strong>{{ balanceText }}</strong></div>
              <div class="insight-item">
                <span>Теоретический максимум</span
                ><strong :class="theoreticalMaximum >= engine.targetScore ? 'good' : 'warning'"
                  >{{ theoreticalMaximum }} {{ pluralizePoints(theoreticalMaximum) }}</strong
                >
              </div>
              <div class="insight-item">
                <span>Предыдущая реплика</span
                ><strong
                  ><ReplyChips v-if="calculated.previous" :reply="calculated.previous" />
                  <template v-else>—</template></strong
                >
              </div>
            </div>
          </section>
          <section class="panel history-panel" aria-labelledby="historyTitle">
            <div class="section-title">
              <h2 id="historyTitle">История</h2>
              <span class="brand-subtitle">{{ state.turns.length }} из {{ engine.totalTurns }}</span>
            </div>
            <div class="history-list">
              <div v-if="!calculated.calculatedTurns.length" class="empty-history">
                Ходы появятся здесь. Последний ход можно отменить.
              </div>
              <article
                v-for="turn in [...calculated.calculatedTurns].reverse()"
                v-else
                :key="turn.number"
                class="history-item"
              >
                <span class="history-number">{{ turn.number }}</span>
                <ReplyChips class="history-reply" :reply="turn.reply" />
                <div class="history-meta">
                  <strong>{{ turn.type === "anonymous" ? "только выбор" : "три варианта" }}</strong
                  ><span
                    >{{ turn.number === 1 ? "первая реплика" : `общий цвет +${turn.shared} · баланс +${turn.balance}` }}</span
                  >
                </div>
                <span class="history-gain">+{{ turn.gain }}</span>
              </article>
            </div>
            <div class="history-actions">
              <button class="secondary-button" type="button" :disabled="state.turns.length === 0" @click="undo">
                Отменить последний ход
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  </main>
</template>
