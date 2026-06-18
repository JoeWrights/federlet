import type React from "react";
import {
  BrowserRouter as RawBrowserRouter,
  NavLink as RawNavLink,
  Route as RawRoute,
  Switch as RawSwitch,
} from "react-router-dom";

export const BrowserRouter = RawBrowserRouter as unknown as React.ComponentType<{
  basename?: string;
  children?: React.ReactNode;
}>;

export const NavLink = RawNavLink as unknown as React.ComponentType<{
  to: string;
  exact?: boolean;
  activeClassName?: string;
  className?: string;
  children?: React.ReactNode;
}>;

export const Route = RawRoute as unknown as React.ComponentType<{
  path: string;
  exact?: boolean;
  children?: React.ReactNode;
}>;

export const Switch = RawSwitch as unknown as React.ComponentType<{
  children?: React.ReactNode;
}>;
