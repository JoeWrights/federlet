import {
  createContext,
  createElement,
  useContext,
  type ReactNode,
} from "react";
import { ConfigProvider } from "antd";

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
    createElement(
      ConfigProvider,
      {
        getPopupContainer: () => portalContainer ?? document.body,
        iconPrefixCls: "federlet-scope-remote-react-anticon",
        prefixCls: "federlet-scope-remote-react-ant",
      },
      children,
    ),
  );
}

export function useRemoteAppContext() {
  return useContext(RemoteAppContext);
}
