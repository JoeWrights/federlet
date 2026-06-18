import React, { createContext, useContext, type ReactNode } from "react";
import { ConfigProvider } from "antd";

const UmiConfigProvider = ConfigProvider as unknown as React.ComponentType<{
  children?: ReactNode;
  getPopupContainer?: () => HTMLElement;
  iconPrefixCls?: string;
  prefixCls?: string;
}>;

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
  return (
    <RemoteAppContext.Provider value={{ portalContainer }}>
      <UmiConfigProvider
        prefixCls="federlet-scope-remote-umi-react-ant"
        iconPrefixCls="federlet-scope-remote-umi-react-anticon"
        getPopupContainer={() => portalContainer ?? document.body}
      >
        {children}
      </UmiConfigProvider>
    </RemoteAppContext.Provider>
  );
}

export function useRemoteAppContext() {
  return useContext(RemoteAppContext);
}
