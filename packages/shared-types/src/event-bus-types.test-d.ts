import type { FederletEventName, MicroEventBus } from "./index";

declare const eventBus: MicroEventBus;

type EventBusOnEventName = Parameters<MicroEventBus["on"]>[0];
type EventBusEmitEventName = Parameters<MicroEventBus["emit"]>[0];

const suggestedOnEventName: Extract<EventBusOnEventName, FederletEventName> =
  "auth.session.updated";
const suggestedEmitEventName: Extract<EventBusEmitEventName, FederletEventName> =
  "remote.lifecycle.mounted";
const customOnEventName: EventBusOnEventName = "business.panel.opened";
const customEmitEventName: EventBusEmitEventName = "business.panel.opened";

eventBus.emit("auth.session.updated", {
  isAuthenticated: true,
  userId: "u_1",
});

eventBus.on("auth.session.updated", (payload) => {
  payload.isAuthenticated;
  payload.userId;
});

eventBus.emit("business.panel.opened", {
  panelId: "settings",
});

// @ts-expect-error Built-in auth events require `isAuthenticated`.
eventBus.emit("auth.session.updated", {
  userId: "u_1",
});

eventBus.on("business.panel.opened", (payload) => {
  // @ts-expect-error Custom extension events are unknown until narrowed by the consumer.
  payload.panelId;
});
