export function Panel(title, content) {
  return `
    <div class="panel fade-in">
      <div class="panel-header">
        <div class="panel-title">${title}</div>
      </div>
      <div class="panel-body">
        ${content}
      </div>
    </div>
  `;
}

export function StatCard(label, value, unit, progress = 0) {
  return `
    <div class="stat-card">
      <div class="stat-label">${label}</div>
      <div>
        <span class="stat-value">${value}</span>
        <span class="stat-unit">${unit || ''}</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${progress}%"></div>
      </div>
    </div>
  `;
}

export function Button(text, variant = 'gold') {
  return `
    <button class="btn btn-${variant}">
      ${text}
    </button>
  `;
}

export function InsightCard(text) {
  return `
    <div class="insight-card">
      <div class="insight-eyebrow">
        <span class="insight-dot"></span>
        EVA INSIGHT
      </div>
      <div class="insight-text">
        ${text}
      </div>
    </div>
  `;
}

export function EmptyState(message) {
  return `
    <div class="panel">
      <div class="panel-body" style="text-align:center;">
        <div class="muted">${message}</div>
      </div>
    </div>
  `;
}

export function LoadingState(message = 'Loading...') {
  return `
    <div class="panel">
      <div class="panel-body" style="text-align:center;">
        <div class="spinner"></div>
        <div class="muted">${message}</div>
      </div>
    </div>
  `;
}
