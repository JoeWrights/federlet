import React, { useEffect, useState } from "react";

interface FederletSandboxRiskState {
  seckillIntervalId?: number;
  seckillRemainingSeconds?: number;
  source?: string;
}

interface SandboxRiskWindow extends Window {
  __FEDERLET_SANDBOX_RISK__?: FederletSandboxRiskState;
}

const RISK_SOURCE = "remote-umi-react/settings";
const RISK_UPDATED_EVENT = "federlet:sandbox-risk-updated";
const LEGACY_SECKILL_INITIAL_SECONDS = 12 * 60 * 60;

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

export default function SettingsPanel() {
  const [seckillRemainingSeconds, setSeckillRemainingSeconds] = useState(
    LEGACY_SECKILL_INITIAL_SECONDS,
  );
  const [, forceRender] = useState(0);
  const risk = (window as SandboxRiskWindow).__FEDERLET_SANDBOX_RISK__;

  useEffect(() => {
    let mounted = true;
    const risk = getRiskState();
    risk.seckillRemainingSeconds = LEGACY_SECKILL_INITIAL_SECONDS;
    risk.seckillIntervalId = window.setInterval(() => {
      risk.seckillRemainingSeconds = Math.max(
        (risk.seckillRemainingSeconds ?? 0) - 1,
        0,
      );
      if (mounted) {
        setSeckillRemainingSeconds(risk.seckillRemainingSeconds);
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

  return (
    <section className="umi-remote__panel">
      <strong>Isolated React 17</strong>
      <span>runtime remains bundled with the Umi remote</span>
      <div className="umi-remote__seckill-demo">
        <h2>Legacy seckill countdown</h2>
        <p>
          This demo intentionally starts a global interval so the Shell can
          compare sandbox on/off cleanup behavior for the Umi remote.
        </p>
        <strong>
          Sale starts in {formatCountdown(seckillRemainingSeconds)}
        </strong>
        <span>
          Shell risk state:{" "}
          {risk?.seckillRemainingSeconds === undefined
            ? "not started"
            : `${risk.seckillRemainingSeconds}s`}
        </span>
      </div>
    </section>
  );
}
