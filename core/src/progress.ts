// Copyright (c) Daniel Mejia (Denphi)
// Distributed under the terms of the Modified BSD License.

// Loading panel: the steps of a load (download, reading the file, secondary
// structure, bonds, meshes, shading) with what each one found. It only
// appears when a load takes longer than SHOW_AFTER ms (long enough that fast
// loads do not flash it, short enough to answer a click at once), so small structures
// show nothing; once the molecule is on screen it shrinks to a small
// "Shading n%" label while ambient occlusion refines.

const SHOW_AFTER = 150;

interface Step {
  key: string;
  label: string;
  detail: string;
  fraction: number | null; // null: indeterminate
  done: boolean;
  row: HTMLDivElement;
}

export class LoadPanel {
  private card: HTMLDivElement;
  private list: HTMLDivElement;
  private pill: HTMLDivElement;
  private actionButton: HTMLButtonElement | null = null;
  private steps: Step[] = [];
  private active = false;
  private showTimer: any = null;
  private shadingSince = 0;
  private shadingShown = false;
  shading = false;

  constructor(parent: HTMLElement) {
    this.card = document.createElement('div');
    this.card.className = 'ipyspeck-progress';
    this.card.setAttribute('role', 'status');
    this.card.setAttribute('aria-live', 'polite');
    this.card.style.display = 'none';
    this.list = document.createElement('div');
    this.card.appendChild(this.list);
    parent.appendChild(this.card);

    this.pill = document.createElement('div');
    this.pill.className = 'ipyspeck-progress-pill';
    this.pill.setAttribute('role', 'status');
    this.pill.style.display = 'none';
    parent.appendChild(this.pill);
  }

  // Starts or updates a step; the previous active step is marked done.
  step(key: string, label: string, fraction: number | null = null, detail = '') {
    this.begin();
    let step = this.steps.find((s) => s.key === key);
    if (!step) {
      for (const s of this.steps) {
        if (!s.done) this.finishStep(s);
      }
      const row = document.createElement('div');
      row.className = 'ipyspeck-progress-step';
      step = { key, label, detail, fraction, done: false, row };
      this.steps.push(step);
      this.list.appendChild(row);
    }
    step.label = label;
    step.fraction = fraction;
    if (detail) step.detail = detail;
    this.draw(step);
  }

  update(key: string, fraction: number | null, detail?: string) {
    const step = this.steps.find((s) => s.key === key);
    if (!step) return;
    step.fraction = fraction;
    if (detail !== undefined) step.detail = detail;
    this.draw(step);
  }

  done(key: string, detail?: string) {
    const step = this.steps.find((s) => s.key === key);
    if (!step) return;
    if (detail !== undefined) step.detail = detail;
    this.finishStep(step);
  }

  // The load failed: keep the panel up with the message.
  fail(message: string) {
    this.begin();
    for (const s of this.steps) {
      if (!s.done) {
        s.row.className = 'ipyspeck-progress-step failed';
        s.detail = '';
        this.draw(s);
      }
    }
    const row = document.createElement('div');
    row.className = 'ipyspeck-progress-error';
    row.textContent = message;
    this.list.appendChild(row);
    this.show();
  }

  // A button under the steps (e.g. Cancel for a video export), until finish().
  action(label: string, run: () => void) {
    this.begin();
    if (!this.actionButton) {
      this.actionButton = document.createElement('button');
      this.actionButton.type = 'button';
      this.actionButton.className = 'ipyspeck-progress-action';
      this.card.appendChild(this.actionButton);
    }
    this.actionButton.textContent = label;
    this.actionButton.onclick = run;
  }

  // The structure is on screen: hide the panel and follow the shading.
  finish(followShading: boolean) {
    clearTimeout(this.showTimer);
    if (this.actionButton) {
      this.actionButton.remove();
      this.actionButton = null;
    }
    const wasShown = this.card.style.display !== 'none';
    this.card.style.display = 'none';
    this.active = false;
    this.steps = [];
    this.list.innerHTML = '';
    this.shading = followShading;
    this.shadingSince = performance.now();
    // Show the shading label at once after a visible load, else only if
    // shading takes a while.
    this.shadingShown = wasShown;
    this.pill.style.display = 'none';
  }

  // Called every frame while shading is followed, with the AO progress (0 - 1).
  shadingProgress(fraction: number) {
    if (!this.shading) return;
    if (fraction >= 1) {
      this.stopShading();
      return;
    }
    if (!this.shadingShown && performance.now() - this.shadingSince > 1200) this.shadingShown = true;
    if (!this.shadingShown) return;
    this.pill.style.display = '';
    this.pill.textContent = 'Shading ' + Math.floor(fraction * 100) + '%';
  }

  stopShading() {
    this.shading = false;
    this.pill.style.display = 'none';
  }

  get busy(): boolean {
    return this.active;
  }

  private begin() {
    if (this.active) return;
    this.active = true;
    this.stopShading();
    this.steps = [];
    this.list.innerHTML = '';
    clearTimeout(this.showTimer);
    this.showTimer = setTimeout(() => this.show(), SHOW_AFTER);
  }

  private show() {
    if (this.active) this.card.style.display = '';
  }

  private finishStep(step: Step) {
    step.done = true;
    step.fraction = 1;
    this.draw(step);
  }

  private draw(step: Step) {
    const row = step.row;
    if (!/failed/.test(row.className)) {
      row.className = 'ipyspeck-progress-step ' + (step.done ? 'done' : 'active');
    }
    const percent = !step.done && step.fraction !== null ? ' ' + Math.floor(step.fraction * 100) + '%' : '';
    row.innerHTML = '';
    const icon = document.createElement('span');
    icon.className = 'ipyspeck-progress-icon';
    icon.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.className = 'ipyspeck-progress-label';
    text.textContent = step.label + percent;
    row.appendChild(icon);
    row.appendChild(text);
    if (step.detail) {
      const detail = document.createElement('span');
      detail.className = 'ipyspeck-progress-detail';
      detail.textContent = step.detail;
      row.appendChild(detail);
    }
    if (!step.done && !/failed/.test(row.className)) {
      const bar = document.createElement('div');
      bar.className = 'ipyspeck-progress-bar' + (step.fraction === null ? ' indeterminate' : '');
      const fill = document.createElement('div');
      if (step.fraction !== null) fill.style.width = Math.round(step.fraction * 100) + '%';
      bar.appendChild(fill);
      row.appendChild(bar);
    }
  }
}
