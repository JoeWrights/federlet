import {
  createContext,
  createElement,
  useContext,
  type ReactNode,
} from "react";

interface RemoteAppContextValue {
  portalContainer?: HTMLElement;
}

const RemoteAppContext = createContext<RemoteAppContextValue>({});

interface RemoteAppProviderProps extends RemoteAppContextValue {
  children: ReactNode;
}

export function RemoteAppProvider({
  children,
  portalContainer,
}: RemoteAppProviderProps) {
  return createElement(
    RemoteAppContext.Provider,
    { value: { portalContainer } },
    children,
  );
}

export function useRemoteAppContext() {
  return useContext(RemoteAppContext);
}
