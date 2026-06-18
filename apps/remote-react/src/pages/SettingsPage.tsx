import { useState } from "react";

interface FederletSandboxRiskState {
  clickCount?: number;
  intervalId?: number;
  listenerRegistered?: boolean;
  onWindowClick?: EventListener;
  source?: string;
  ticks?: number;
}

interface SandboxRiskWindow extends Window {
  __FEDERLET_SANDBOX_RISK__?: FederletSandboxRiskState;
}

const RISK_SOURCE = "remote-react/settings";

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

function startLeakingTimer() {
  const risk = getRiskState();

  if (risk.intervalId !== undefined) {
    return;
  }

  risk.ticks = 0;
  risk.intervalId = window.setInterval(() => {
    risk.ticks = (risk.ticks ?? 0) + 1;
    document.title = `remote-react timer leak ${risk.ticks}`;
  }, 1000);
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
  if (document.head.querySelector("[data-federlet-sandbox-risk='head-style']")) {
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

export default function SettingsPage() {
  const [events, setEvents] = useState<string[]>([]);

  function run(label: string, action: () => void) {
    action();
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
        <button onClick={() => run("body node leak", appendBodyNode)}>
          Append body node
        </button>
        <button onClick={() => run("runtime style leak", injectRuntimeStyle)}>
          Inject runtime style
        </button>
      </div>

      <p className="react-remote__risk-note">
        Navigate back to the Shell home after triggering these controls. The
        Shell can still observe the leaked globals, body node, timer, listener,
        and runtime style because there is no sandbox cleanup boundary.
      </p>

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
