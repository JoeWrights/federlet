import { useEffect, useState } from "react";

interface FederletSandboxRiskState {
  clickCount?: number;
  cookiePollution?: boolean;
  directWindowWrite?: boolean;
  dynamicLinkLeak?: boolean;
  dynamicScriptLeak?: boolean;
  intervalId?: number;
  listenerRegistered?: boolean;
  onWindowClick?: EventListener;
  prototypePollution?: boolean;
  rafFired?: boolean;
  rafId?: number;
  source?: string;
  seckillIntervalId?: number;
  seckillRemainingSeconds?: number;
  timeoutFired?: boolean;
  timeoutId?: number;
  ticks?: number;
  storagePollution?: boolean;
}

interface SandboxRiskWindow extends Window {
  __FEDERLET_SANDBOX_RISK__?: FederletSandboxRiskState;
  __FEDERLET_UNSANDBOXED_WINDOW_WRITE__?: string;
}

const RISK_SOURCE = "remote-react/settings";
const RISK_UPDATED_EVENT = "federlet:sandbox-risk-updated";
const PRODUCT_SECKILL_INITIAL_SECONDS = 24 * 60 * 60;

function notifyRiskUpdated() {
  window.dispatchEvent(new Event(RISK_UPDATED_EVENT));
}

function formatCountdown(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function getRiskState() {
  const riskWindow = window as SandboxRiskWindow;
  riskWindow.__FEDERLET_SANDBOX_RISK__ ??= {};
  riskWindow.__FEDERLET_SANDBOX_RISK__.source = RISK_SOURCE;

  return riskWindow.__FEDERLET_SANDBOX_RISK__;
}

function polluteWindowGlobal() {
  const risk = getRiskState();
  risk.clickCount ??= 0;
}

function polluteDirectWindowProperty() {
  const riskWindow = window as SandboxRiskWindow;
  const risk = getRiskState();

  riskWindow.__FEDERLET_UNSANDBOXED_WINDOW_WRITE__ = RISK_SOURCE;
  risk.directWindowWrite = true;
  notifyRiskUpdated();
}

function startLeakingTimer() {
  const risk = getRiskState();

  if (risk.intervalId !== undefined) {
    return;
  }

  risk.ticks = 0;
  risk.intervalId = window.setInterval(() => {
    risk.ticks = (risk.ticks ?? 0) + 1;
    document.title = `remote-react timer leak ${risk.ticks}`;
    notifyRiskUpdated();
  }, 1000);
}

function scheduleLeakingTimeout() {
  const risk = getRiskState();

  if (risk.timeoutId !== undefined) {
    return;
  }

  risk.timeoutFired = false;
  risk.timeoutId = window.setTimeout(() => {
    risk.timeoutFired = true;
    risk.timeoutId = undefined;
    notifyRiskUpdated();
  }, 1000);
}

function scheduleLeakingRaf() {
  const risk = getRiskState();

  if (risk.rafId !== undefined) {
    return;
  }

  risk.rafFired = false;
  risk.rafId = window.requestAnimationFrame(() => {
    risk.rafFired = true;
    risk.rafId = undefined;
    notifyRiskUpdated();
  });
}

function registerLeakingClickListener() {
  const risk = getRiskState();

  if (risk.listenerRegistered) {
    return;
  }

  const onWindowClick = () => {
    risk.clickCount = (risk.clickCount ?? 0) + 1;
  };

  window.addEventListener("click", onWindowClick);
  risk.listenerRegistered = true;
  risk.onWindowClick = onWindowClick;
}

function appendBodyNode() {
  if (document.body.querySelector("[data-federlet-sandbox-risk='body-node']")) {
    return;
  }

  const node = document.createElement("div");
  node.dataset.federletSandboxRisk = "body-node";
  node.textContent = "remote-react wrote directly to document.body";
  node.className = "remote-react-sandbox-risk-toast";
  document.body.append(node);
}

function injectRuntimeStyle() {
  if (
    document.head.querySelector("[data-federlet-sandbox-risk='head-style']")
  ) {
    return;
  }

  const style = document.createElement("style");
  style.dataset.federletSandboxRisk = "head-style";
  style.textContent = `
.shell__sidebar {
  background: #7f1d1d !important;
}

.remote-react-sandbox-risk-toast {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 9999;
  border-radius: 999px;
  padding: 10px 14px;
  color: #fff;
  background: #b91c1c;
  box-shadow: 0 16px 32px rgb(127 29 29 / 32%);
}
`;
  document.head.append(style);
}

function injectDynamicLink() {
  if (
    document.head.querySelector("[data-federlet-sandbox-risk='head-link']")
  ) {
    return;
  }

  const risk = getRiskState();
  const link = document.createElement("link");
  link.dataset.federletSandboxRisk = "head-link";
  link.href = "data:text/plain,federlet-sandbox-risk";
  link.rel = "prefetch";
  document.head.append(link);
  risk.dynamicLinkLeak = true;
  notifyRiskUpdated();
}

function injectDynamicScript() {
  if (
    document.head.querySelector("[data-federlet-sandbox-risk='head-script']")
  ) {
    return;
  }

  const risk = getRiskState();
  const script = document.createElement("script");
  script.dataset.federletSandboxRisk = "head-script";
  script.type = "application/json";
  script.textContent = JSON.stringify({ source: RISK_SOURCE });
  document.head.append(script);
  risk.dynamicScriptLeak = true;
  notifyRiskUpdated();
}

function writeBrowserStorage() {
  const risk = getRiskState();

  localStorage.setItem("federlet:sandbox-risk", RISK_SOURCE);
  sessionStorage.setItem("federlet:sandbox-risk", RISK_SOURCE);
  document.cookie = "federlet_sandbox_risk=remote-react; path=/";
  risk.cookiePollution = true;
  risk.storagePollution = true;
  notifyRiskUpdated();
}

function polluteArrayPrototype() {
  const risk = getRiskState();

  (Array.prototype as { __federletSandboxRisk__?: string })
    .__federletSandboxRisk__ = RISK_SOURCE;
  risk.prototypePollution = true;
  notifyRiskUpdated();
}

export default function SettingsPage() {
  const [events, setEvents] = useState<string[]>([]);
  const [productSeckillRemainingSeconds, setProductSeckillRemainingSeconds] =
    useState(PRODUCT_SECKILL_INITIAL_SECONDS);
  const [, forceRender] = useState(0);
  const risk = (window as SandboxRiskWindow).__FEDERLET_SANDBOX_RISK__;

  useEffect(() => {
    let mounted = true;
    const risk = getRiskState();
    risk.seckillRemainingSeconds = PRODUCT_SECKILL_INITIAL_SECONDS;
    risk.seckillIntervalId = window.setInterval(() => {
      risk.seckillRemainingSeconds = Math.max(
        (risk.seckillRemainingSeconds ?? 0) - 1,
        0,
      );
      if (mounted) {
        setProductSeckillRemainingSeconds(risk.seckillRemainingSeconds);
      }
      notifyRiskUpdated();
    }, 1000);

    const update = () => {
      forceRender((version) => version + 1);
    };

    window.addEventListener(RISK_UPDATED_EVENT, update);

    return () => {
      mounted = false;
      window.removeEventListener(RISK_UPDATED_EVENT, update);
    };
  }, []);

  function run(label: string, action: () => void) {
    action();
    forceRender((version) => version + 1);
    setEvents((current) => [`${label} triggered`, ...current].slice(0, 5));
  }

  return (
    <section className="react-remote__panel react-remote__risk-lab">
      <strong>Sandbox Risk Lab</strong>
      <span>
        These buttons intentionally touch shared browser globals to show what a
        remote can do when the host does not wrap it in a JS sandbox.
      </span>

      <div className="react-remote__risk-actions">
        <button onClick={() => run("window pollution", polluteWindowGlobal)}>
          Pollute window
        </button>
        <button onClick={() => run("timer leak", startLeakingTimer)}>
          Start leaking timer
        </button>
        <button
          onClick={() =>
            run("window click listener", registerLeakingClickListener)
          }
        >
          Register window click listener
        </button>
        <button onClick={() => run("timeout leak", scheduleLeakingTimeout)}>
          Schedule timeout
        </button>
        <button onClick={() => run("raf leak", scheduleLeakingRaf)}>
          Schedule raf
        </button>
        <button
          onClick={() =>
            run("direct window write", polluteDirectWindowProperty)
          }
        >
          Pollute direct window property
        </button>
        <button onClick={() => run("body node leak", appendBodyNode)}>
          Append body node
        </button>
        <button onClick={() => run("runtime style leak", injectRuntimeStyle)}>
          Inject runtime style
        </button>
        <button onClick={() => run("dynamic link leak", injectDynamicLink)}>
          Inject dynamic link
        </button>
        <button onClick={() => run("dynamic script leak", injectDynamicScript)}>
          Inject dynamic script
        </button>
        <button onClick={() => run("storage pollution", writeBrowserStorage)}>
          Write browser storage
        </button>
        <button onClick={() => run("prototype pollution", polluteArrayPrototype)}>
          Pollute Array prototype
        </button>
      </div>

      <p className="react-remote__risk-note">
        Compare `/react/settings` with `/react-nosandbox/settings`. The sandbox
        can clean timer, timeout, raf, and window listener side effects on
        unmount. Direct window writes are snapshot-restored after the last
        sandbox unmounts, but they are still visible while mounted. DOM/head
        mutations, storage, cookie, and prototype changes remain blind spots.
      </p>

      <section className="react-remote__seckill-card">
        <span>Product seckill countdown</span>
        <strong>
          Sale starts in {formatCountdown(productSeckillRemainingSeconds)}
        </strong>
        <p>
          This business countdown starts automatically when the remote mounts.
          It should keep ticking while the remote is visible.
        </p>
      </section>

      <dl className="react-remote__risk-state">
        <div>
          <dt>interval ticks</dt>
          <dd>{risk?.ticks ?? 0}</dd>
        </div>
        <div>
          <dt>window clicks</dt>
          <dd>{risk?.clickCount ?? 0}</dd>
        </div>
        <div>
          <dt>timeout fired</dt>
          <dd>{risk?.timeoutFired ? "yes" : "no"}</dd>
        </div>
        <div>
          <dt>raf fired</dt>
          <dd>{risk?.rafFired ? "yes" : "no"}</dd>
        </div>
        <div>
          <dt>active interval</dt>
          <dd>{risk?.intervalId !== undefined ? "yes" : "no"}</dd>
        </div>
        <div>
          <dt>listener registered</dt>
          <dd>{risk?.listenerRegistered ? "yes" : "no"}</dd>
        </div>
        <div>
          <dt>direct window write</dt>
          <dd>{risk?.directWindowWrite ? "detected" : "clean"}</dd>
        </div>
        <div>
          <dt>dynamic link</dt>
          <dd>{risk?.dynamicLinkLeak ? "detected" : "clean"}</dd>
        </div>
        <div>
          <dt>dynamic script</dt>
          <dd>{risk?.dynamicScriptLeak ? "detected" : "clean"}</dd>
        </div>
        <div>
          <dt>storage/cookie</dt>
          <dd>
            {risk?.storagePollution || risk?.cookiePollution
              ? "detected"
              : "clean"}
          </dd>
        </div>
        <div>
          <dt>prototype pollution</dt>
          <dd>{risk?.prototypePollution ? "detected" : "clean"}</dd>
        </div>
        <div>
          <dt>seckill countdown</dt>
          <dd>
            {risk?.seckillRemainingSeconds === undefined
              ? "not started"
              : `Seckill starts in ${risk.seckillRemainingSeconds}s`}
          </dd>
        </div>
      </dl>

      {events.length > 0 ? (
        <ul className="react-remote__risk-events">
          {events.map((event) => (
            <li key={event}>{event}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
